# AUDITORIA KYRAONE — Segurança, Isolamento de Dados e Prontidão Comercial

*Conduzida em 10/out/2026 a pedido do fundador. Escopo: RLS/isolamento de dados no Supabase, autenticação, uso do service role nas Vercel Functions, integração Asaas, vínculo de WhatsApp (Kyra), exclusão de conta (LGPD). Plano original (prompt anexado na sessão) foi reescrito aqui porque referenciava um estágio anterior do projeto (antes do onboarding guiado, do billing Asaas em produção e do fluxo de exclusão com retenção, todos já entregues — ver `kyraone-contexto-projeto.md`).*

**Status: Fase 2 encerrada em 10/out/2026.** Todos os 10 itens da Fase 2 foram aplicados (9 via código/SQL, 1 — leaked password protection — parcialmente, ver item 4). Resta em aberto só a Fase 3 (testes dinâmicos ponta a ponta), que é opcional/reforço, não bloqueio.

---

## FASE 1 — DIAGNÓSTICO (concluído)

Método: leitura de todo o código em `api/*` e `src/lib/*-store.ts`, inspeção de `pg_policies`/`information_schema` e `get_advisors` (security + performance) do projeto Supabase `eqzqrwbtibelafvzvbfb` via MCP, e revisão dos padrões de autenticação (Bearer token da SPA, chaves compartilhadas pros webhooks de serviço).

### 🔴 CRÍTICO — Escalonamento de privilégio via `profiles.role`

A policy de UPDATE em `public.profiles` é:

```
profiles_update_own: USING (auth.uid() = id)   -- sem WITH CHECK
```

Quando uma policy de UPDATE não define `WITH CHECK`, o Postgres reaplica o `USING` como check da linha nova — ou seja, a única coisa validada é que `id` continua sendo o próprio usuário. **Nenhuma coluna é protegida especificamente**, incluindo `role`.

Isso significa que qualquer usuário autenticado pode, hoje, chamar a REST API do Supabase diretamente (sem passar pelo app) com o próprio token:

```
PATCH /rest/v1/profiles?id=eq.<próprio-id>
Authorization: Bearer <token do próprio usuário>
{ "role": "admin" }
```

e isso é aceito pelo RLS. Confirmei que não existe nenhum trigger em `profiles` que proteja a coluna (`pg_trigger` vazio pra essa tabela). Como `role='admin'` é exatamente o que `api/admin/dashboard.ts` e `api/admin/atualizar-conta.ts` checam (via service role, lendo `profiles.role` fresco a cada chamada), **qualquer usuário pode se promover a superadmin e, a partir daí**:
- ver e-mail + CPF de todos os assinantes (`admin/dashboard.ts`);
- mudar status/plano/CPF/estender trial de qualquer conta, inclusive a própria, à vontade (`admin/atualizar-conta.ts`);
- passar por qualquer gate de assinatura no app (`_app.tsx` já trata superadmin como bypass universal).

Isso não é um problema de isolamento entre linhas (cada usuário só vê as próprias linhas em todas as outras tabelas, confirmado abaixo) — é especificamente a ausência de proteção de **coluna** dentro da própria linha do usuário. Prioridade de correção: **antes de qualquer outra coisa**, incluindo antes de testar o resto com a conta de teste.

### 🟢 Isolamento entre contas (demais tabelas) — OK

Todas as 12 tabelas de `public` têm RLS habilitado. Policies de `categories`, `credit_cards`, `transactions`, `invoices`, `card_expenses`, `card_installments`, `budgets`, `goals`, `goal_contributions`, `account_balance` seguem o mesmo padrão correto nas 4 operações: `user_id = auth.uid()` (SELECT/UPDATE/DELETE) e `WITH CHECK (user_id = auth.uid())` (INSERT) — aqui sim o `WITH CHECK` existe e fecha o INSERT corretamente, então um usuário não consegue inserir linha em nome de outro `user_id`, nem ler/alterar linha de terceiro.

`assinaturas` só tem policy de **SELECT** (`profile_id = auth.uid()`) — sem INSERT/UPDATE/DELETE pro client. Correto: toda escrita passa obrigatoriamente pelas Vercel Functions com service role, RLS bloqueia qualquer tentativa de escrita direta.

### 🟡 MÉDIO — Funções `SECURITY DEFINER` expostas via RPC

`get_advisors` aponta `public.handle_new_user()` (trigger de criação de perfil+trial) e `public.rls_auto_enable()` (event trigger) como chamáveis diretamente por `anon`/`authenticated` via `/rest/v1/rpc/<nome>`. Na prática, ambas são funções de trigger (`handle_new_user` espera contexto de `NEW` de trigger; `rls_auto_enable` é event trigger, usa `pg_event_trigger_ddl_commands()`) — chamadas fora desse contexto devem falhar com erro do Postgres, então o risco real de execução é baixo. Ainda assim é superfície de ataque desnecessária exposta publicamente; correção é só revogar `EXECUTE` de `anon`/`authenticated`, sem efeito colateral.

### 🟡 MÉDIO — Leaked Password Protection desligada

Supabase Auth não está checando senhas de cadastro/redefinição contra a base do HaveIBeenPwned. Liga-se em Authentication → Policies no painel, sem mudança de código.

### 🟡 MÉDIO — Sem log de auditoria de ações administrativas

Já registrado como pendência aberta no documento de contexto (item 7, nunca fechado): `api/admin/atualizar-conta.ts` muda status/plano/CPF/trial de qualquer assinante sem gravar quem fez, quando, e qual era o valor anterior. Combinado com o problema crítico acima (qualquer um podia virar admin), a ausência de trilha de auditoria piora o diagnóstico: hoje não haveria como provar que uma alteração indevida aconteceu nem reverter com confiança.

### 🟢 Autenticação por chave compartilhada (`lancar-despesa.ts`, `webhook.ts`) — desenho aceitável, com ressalvas

- `api/asaas/webhook.ts`: valida `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`. Padrão correto pro Asaas (não assina payload, só token fixo no header). Comparação com `!==` (não é constant-time, mas o token não muda por requisição e o risco de timing attack num endpoint HTTP com latência de rede é baixíssimo — não prioritário).
- `api/cartoes/lancar-despesa.ts`: autentica com `KYRA_WHATSAPP_API_KEY` fixa no header e identifica o usuário só pelo `phone` (sem nenhuma prova de posse do número além do que o n8n/Evolution API já garante na borda). O desenho é razoável *dado* que quem chama é um workflow n8n que você controla, não o navegador do usuário — mas isso faz dessa chave um segredo de alto valor: qualquer um com ela consegue lançar despesa em nome de **qualquer telefone vinculado**, sem rate limit nem log de anomalia. Ação: confirmar que a chave só existe como credencial do n8n (nunca hardcoded num node exportável) e considerar um rate limit básico (ex: X requisições/minuto por telefone) — baixo esforço, reduz o dano de uma chave vazada.

### 🟢 Exclusão de conta (LGPD art. 18) — bem implementada

`api/conta/excluir.ts`: cancela assinatura ativa no Asaas primeiro (aborta se falhar, evitando cobrança "órfã"), apaga as 10 tabelas pessoais na ordem certa (filhas antes de mães, já validado na prática na sessão anterior por uma FK ter rejeitado uma ordem errada), depois `assinaturas`, depois `profiles`, e só por último remove o usuário do Auth. Única lacuna: não fica nenhum registro (nem anonimizado) de que a exclusão ocorreu — se um dia precisar provar cumprimento de uma solicitação LGPD específica, não há como. Sugestão de baixo risco: tabela separada `exclusoes_lgpd(hash_email, executado_em)`, sem dado pessoal reversível.

### 🟡 INFO — CPF em texto plano, exposto em bulco pro admin

`profiles.cpf` não é criptografado em coluna, e `admin/dashboard.ts` devolve CPF de todos os assinantes numa única resposta JSON pra quem tem `role='admin'`. Aceitável *se* o acesso a `role='admin'` for de fato restrito (ver item crítico) — não é uma vulnerabilidade nova, é uma consequência do mesmo problema. Depois do fix do item crítico, reavaliar se vale mascarar CPF na UI do admin (mostrar só os 3 últimos dígitos, por exemplo) como reforço.

### ⚪ Performance (fora do escopo de segurança, mas achados no mesmo levantamento)

44 policies RLS reavaliam `auth.uid()` por linha em vez de `(select auth.uid())` (recomendação padrão do Supabase pra performance em escala), e 9 foreign keys sem índice de cobertura (`card_expenses`, `card_installments`, `invoices`, `transactions`, `goal_contributions`). Sem risco de segurança — citado aqui só porque a migration do item crítico já vai tocar nessas mesmas policies, então faz sentido resolver tudo numa passada só.

---

## FASE 2 — CORREÇÕES (aplicadas em 10/out/2026)

Rodadas via `mcp__Supabase__execute_sql` direto no projeto `eqzqrwbtibelafvzvbfb` (o `apply_migration`/lotes grandes foram cancelados pelo MCP sem explicação — contornado rodando `CREATE FUNCTION`, `CREATE TRIGGER` e os `REVOKE` isoladamente; `ALTER POLICY`/`CREATE INDEX` em lote funcionaram normalmente). Nenhuma migration ficou registrada em `supabase_migrations` (só o SQL direto) — considerar formalizar como migration num momento calmo, não é urgente.

| # | Prioridade | Ação | Status |
|---|---|---|---|
| 1 | **P0** | Trigger `BEFORE UPDATE` em `profiles` (`protect_profile_role()`) que bloqueia mudança de `role` quando `auth.uid()` não é nulo (bloqueia qualquer cliente autenticado comum; deixa passar SQL Editor/postgres e as Vercel Functions, que não carregam JWT de usuário) | ✅ **Aplicado e testado** |
| 2 | **P0** | `WITH CHECK` explícito em `profiles_update_own` fixando `id` | ✅ Aplicado |
| 3 | P1 | Revogar `EXECUTE` de `PUBLIC`/`anon`/`authenticated` em `handle_new_user()`, `rls_auto_enable()` e também na própria `protect_profile_role()` nova (nasce com `EXECUTE` público por padrão do Postgres — mesma categoria de achado, corrigida na hora) | ✅ Aplicado — `get_advisors` confirma os 2 avisos de `SECURITY DEFINER` zerados |
| 4 | P1 | Ligar "Leaked Password Protection" no painel do Supabase Auth | ⚠️ **Bloqueado pelo plano Free** — o toggle existe em Authentication → Providers → Email, mas o Supabase não aplica de fato fora do plano Pro ($25/mês); `get_advisors` continua acusando desligado mesmo com o toggle ligado e salvo. **Mitigação aplicada**: `minimum password length` subido de 6 para 8 (gratuito, mesma tela) — reduz senha fraca por tamanho, não cobre senha vazada em outro serviço. Reavaliar se/quando migrar pra Pro. |
| 5 | P1 | Tabela de auditoria `admin_acoes_log` (quem, quando, campo, valor anterior/novo), gravada a cada escrita de `api/admin/atualizar-conta.ts` | ✅ Aplicado — tabela criada (RLS sem policy, só service role lê), `registrarLog()` chamado nas 4 ações (status/plano/trial/cpf). Sem UI de leitura ainda — hoje só consultável via SQL Editor; se quiser ver no painel, é uma seção nova em `/admin` |
| 6 | P2 | Rate limit básico em `api/cartoes/lancar-despesa.ts` | ✅ Aplicado — bloqueia (`429 muitas_despesas_rapido`) acima de 8 despesas lançadas no mesmo minuto pro mesmo usuário, contando direto em `card_expenses.created_at` (sem infra nova) |
| 7 | P2 | `CHECK (cpf ~ '^\d{11}$')` em `profiles.cpf` | ✅ Aplicado (`profiles_cpf_format`) |
| 8 | P2 | Wrap de `auth.uid()` em `(select ...)` nas 44 policies + índices nas 9 FKs sem cobertura | ✅ Aplicado — `get_advisors` (performance) confirma os 44 avisos `auth_rls_initplan` zerados; os 9 índices aparecem como "unused" por enquanto (esperado, zero tráfego neles ainda) |
| 9 | P3 | Tabela `exclusoes_lgpd` com hash não-reversível + timestamp, inserida no fim de `api/conta/excluir.ts` | ✅ Aplicado — `sha256(email)` gravado depois do `deleteUser`, não bloqueia a resposta se falhar |
| 10 | P3 | Mascarar CPF na UI do admin | ✅ Aplicado — `api/admin/dashboard.ts` agora devolve o CPF mascarado (`••••••••XXX`, só os 3 últimos dígitos) na listagem geral; o campo de edição em `/admin` começa vazio (placeholder mostra o valor mascarado) em vez de pré-carregar a máscara como se fosse o CPF real |

---

## FASE 3 — VALIDAÇÃO

### ✅ Feito nesta sessão (via SQL, sem precisar da conta de teste)

1. **Fechamento do crítico confirmado**: simulei, dentro de uma transação com `ROLLBACK` (nenhum dado real tocado), uma sessão `authenticated` com `request.jwt.claims.sub` = um `profiles.id` real tentando `UPDATE profiles SET role='admin' WHERE id = <próprio id>`. Resultado: **rejeitado** — `ERRO 42501: Não autorizado a alterar role.`, disparado pelo trigger novo. Antes do fix (Fase 1), essa mesma chamada teria sucesso — não cheguei a confirmar isso contra dado real por decisão de não deixar uma promoção de verdade pendente de reversão, mas o código da policy antiga (sem `WITH CHECK`) não deixava dúvida.
2. **Caminho legítimo continua funcionando**: a mesma simulação alterando só `name` (não `role`) passou normal. E a promoção de `role` feita sem contexto de usuário (como o SQL Editor roda, ou como as Vercel Functions operam com a service role) **continua funcionando** — testei `UPDATE profiles SET role='admin'` sem `SET ROLE authenticated`/sem JWT, sucesso (também dentro de transação com `ROLLBACK`).
3. **`get_advisors` (security)**: zerou os 2 avisos de `SECURITY DEFINER` (e corrigiu de brinde um terceiro que a própria função nova introduziu, `protect_profile_role` nasce com `EXECUTE` público por padrão do Postgres — revogado na mesma hora). Sobra só o aviso de leaked-password-protection (item 4, pendente, painel apenas).
4. **`get_advisors` (performance)**: zerou os 44 avisos de `auth_rls_initplan`. Os 9 índices novos aparecem como "unused" — esperado, ainda não rodou tráfego real contra eles.

### ⏳ Ainda não feito — precisa de teste ponta a ponta no app (não dá pra fazer só com SQL)

Itens que dependem de login real, criação de dados via UI, ou chamada HTTP contra `kyraone.com.br`/Vercel (fora do alcance de rede desta sessão sem usar um navegador):

1. **Isolamento entre duas contas de teste reais** em todas as tabelas pessoais — a lógica das policies foi conferida estaticamente (todas usam `user_id = auth.uid()`/`WITH CHECK` correto) e é o mesmo padrão em todas, mas um teste ponta a ponta com duas contas reais fecha com mais confiança.
2. **Endpoints `/api/admin/*`** rejeitando a conta de teste comum (403) e aceitando só depois de promovida pela via correta.
3. **Webhook do Asaas** e **`lancar-despesa.ts`** rejeitando chamada sem a chave/token certos — comportamento já revisado no código (Fase 1), não testado contra produção nesta sessão.
4. **Exclusão de conta** ponta a ponta — já testado parcialmente em sessão anterior (ver `kyraone-contexto-projeto.md` v1.10); falta a execução real do endpoint implantado.

Posso fazer esses testes dinâmicos usando o navegador (Claude in Chrome) contra `kyraone.com.br` com a conta `celjordaor+kyraone@gmail.com` se você quiser — envolve logar, criar uma segunda conta de teste, e mexer em dados de teste reais (vou pedir confirmação antes de qualquer ação irreversível, como sempre). Ou, se preferir, você mesmo roda esses testes manualmente — o roteiro acima serve como roteiro de teste.

---

## Encerramento (10/out/2026)

**Fase 2 encerrada.** Dos 10 itens: 9 aplicados e validados (SQL + código, commits `aa83f65` e `6999f00`), 1 (leaked password protection) parcialmente mitigado — bloqueado pelo plano Free do Supabase, contornado subindo o tamanho mínimo de senha de 6 pra 8.

**O que fica em aberto, sem bloquear nada:**
- Fase 3 (testes dinâmicos ponta a ponta — isolamento entre duas contas reais, endpoints `/api/admin/*` via HTTP, webhook/lancar-despesa contra produção) — a lógica foi toda conferida estaticamente e o crítico foi validado via simulação SQL, mas um teste real fecha com mais confiança. Fica disponível sob demanda (via navegador) ou pra rodar manualmente quando quiser.
- Upgrade pro plano Pro do Supabase, se algum dia quiser leaked-password-protection de verdade — não é urgente.
- `rls_enabled_no_policy` (INFO, não WARN) nas duas tabelas novas (`admin_acoes_log`, `exclusoes_lgpd`) é esperado e intencional — só a service role acessa, de propósito.

Sem pendência crítica, alta ou média em aberto. Auditoria considerada concluída até que surja um motivo pra reabrir (nova feature que toque RLS/auth, ou um achado novo).
