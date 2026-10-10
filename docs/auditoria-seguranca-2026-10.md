# AUDITORIA KYRAONE — Segurança, Isolamento de Dados e Prontidão Comercial

*Conduzida em 10/out/2026 a pedido do fundador. Escopo: RLS/isolamento de dados no Supabase, autenticação, uso do service role nas Vercel Functions, integração Asaas, vínculo de WhatsApp (Kyra), exclusão de conta (LGPD). Plano original (prompt anexado na sessão) foi reescrito aqui porque referenciava um estágio anterior do projeto (antes do onboarding guiado, do billing Asaas em produção e do fluxo de exclusão com retenção, todos já entregues — ver `kyraone-contexto-projeto.md`).*

**Como usar este documento**: Fase 1 (diagnóstico) está concluída e é a fonte de verdade das descobertas. Fase 2 (correções) é uma lista priorizada — nada foi alterado no banco ou no código ainda, está pendente de aprovação item por item. Fase 3 (validação) só começa depois que algum item da Fase 2 for aplicado.

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

## FASE 2 — CORREÇÕES PROPOSTAS (nenhuma aplicada ainda)

| # | Prioridade | Ação | Onde |
|---|---|---|---|
| 1 | **P0** | Trigger `BEFORE UPDATE` em `profiles` que bloqueia mudança de `role` quando a sessão não é `service_role` (deixa SQL Editor/postgres e as Vercel Functions passarem; bloqueia qualquer `PATCH` autenticado comum) | migration nova |
| 2 | **P0** | `WITH CHECK` explícito em `profiles_update_own` fixando `id` (reforço, já coberto pelo trigger acima, mas deixa a intenção explícita na própria policy) | mesma migration |
| 3 | P1 | Revogar `EXECUTE` de `anon`/`authenticated` em `handle_new_user()` e `rls_auto_enable()` | mesma migration |
| 4 | P1 | Ligar "Leaked Password Protection" no painel do Supabase Auth | config, sem código |
| 5 | P1 | Tabela de auditoria simples (`admin_acoes_log`: quem, quando, o quê, valor anterior/novo) gravada em toda escrita de `api/admin/atualizar-conta.ts` | migration + 1 insert no endpoint |
| 6 | P2 | Rate limit básico em `api/cartoes/lancar-despesa.ts` por telefone (ex: Upstash/Vercel KV, ou simples contagem em tabela) | código |
| 7 | P2 | `CHECK (cpf ~ '^\d{11}$')` em `profiles.cpf` (defesa em profundidade — já validado na API, reforça no banco) | mesma migration |
| 8 | P2 | Wrap de `auth.uid()`/`auth.role()` em `(select ...)` nas 44 policies + índices nas 9 FKs sem cobertura | mesma migration |
| 9 | P3 | Tabela `exclusoes_lgpd` com hash não-reversível + timestamp, inserida no fim de `api/conta/excluir.ts` | migration + 1 insert |
| 10 | P3 | Mascarar CPF na UI do admin (mostrar só os últimos 3 dígitos) | `src/routes/_app.admin.tsx` |

Itens 1, 2, 3, 7 e 8 cabem numa única migration (todos tocam RLS/constraints de `profiles` e performance das mesmas policies). Proponho rodar essa migration primeiro — é o item que fecha o risco crítico — e tratar 4-10 em paralelo ou depois, conforme prioridade.

---

## FASE 3 — VALIDAÇÃO (depois da Fase 2)

Usando a conta de teste `celjordaor+kyraone@gmail.com` (e uma segunda conta de teste a ser criada, pra testar isolamento *entre* contas):

1. **Confirmar o fechamento do crítico**: repetir o `PATCH /rest/v1/profiles {"role":"admin"}` com o token da conta de teste — tem que ser rejeitado após a migration (e eu documento que, antes da migration, esse teste teria sucesso — não vou executá-lo contra uma conta antes do fix pra não deixar uma promoção real pendente de reversão).
2. **Isolamento entre as duas contas de teste** em todas as tabelas pessoais (categorias, cartões, transações, metas, orçamentos, saldo, faturas, despesas de cartão/parcelas): tentar ler/escrever a linha da conta B autenticado como conta A, confirmar 0 linhas / erro em todos os casos.
3. **Endpoints `/api/admin/*`** rejeitando a conta de teste comum (403) e aceitando só depois de promovida **pela via correta** (SQL direto como postgres, ou uma rota admin-only ainda a criar — hoje não existe nenhuma, a promoção sempre foi manual via SQL Editor).
4. **Webhook do Asaas** rejeitando chamada sem o header `asaas-access-token` certo.
5. **`lancar-despesa.ts`** rejeitando sem `x-kyra-whatsapp-key`, e respeitando o gate de plano (conta trial/Pro passa, conta sem acesso recebe `sem_acesso_pro`).
6. **Exclusão de conta** ponta a ponta na conta de teste: assinatura (se houver) cancelada no Asaas, as 10 tabelas + `assinaturas` + `profiles` zeradas, usuário removido do Auth, token antigo invalidado, e (se o item 9 da Fase 2 for aplicado) linha criada em `exclusoes_lgpd`.
7. Rodar `get_advisors` (security) de novo no final — critério de sucesso: os 2 avisos de `SECURITY DEFINER` e o de leaked password resolvidos, zero aviso novo introduzido pela migration.

---

## Próximo passo

Aguardando sua decisão sobre a Fase 2: posso aplicar os itens 1/2/3/7/8 (a migration que fecha o crítico) agora, ou prefere revisar o SQL antes de eu rodar? Os itens 5, 6, 9, 10 dependem de decisão de produto (ex: onde mostrar o log de auditoria) e posso detalhar cada um à parte.
