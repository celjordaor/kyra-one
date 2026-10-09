# KYRAONE — Documento de Contexto do Projeto

*Versão 1.5 — 09/out/2026. Este documento dá contexto completo a qualquer nova conversa. Atualizar ao fim de sessões que mudem decisões, arquitetura ou estado. Sucede `quintalzim-contexto-projeto.md` (repo Quintalzim), que parou de ser atualizado na v1.31 quando o Quintalzim foi oficialmente descontinuado — este é o documento de memória ativo a partir de agora.*

**Changelog**
- **v1.5 (09/out/2026)**: **Pendência 7 resolvida** — painel `/admin` ganhou ações de gestão por assinante (antes só lia dados): trocar status (suspender/reativar/marcar inadimplente, sem depender do webhook do Asaas), trocar plano, editar CPF, e estender trial por N dias (soma ao `trial_fim` atual se ainda estiver no futuro, senão conta a partir de agora; se a conta estava `cancelada`/`inadimplente`, volta pra `trial`). Nova rota `api/admin/atualizar-conta.ts` (service role, mesma checagem de `role='admin'` do `dashboard.ts`), que agora também expõe `profileId`/`cpf`/`planoId`/`trialFim` por assinante. UI: botão "Gerenciar" por linha, abre um painel inline com os 4 campos. Sem tabela de auditoria/histórico de quem mudou o quê ainda — considerar se virar necessidade.
- **v1.4 (09/out/2026)**: Fechamento do billing Asaas, testado ponta a ponta em produção:
  (1) **Conta Asaas criada e validada** — chaves (`ASAAS_API_KEY`, `ASAAS_API_URL` apontando pra produção, `ASAAS_WEBHOOK_TOKEN`) configuradas na Vercel, webhook ativado no painel do Asaas apontando pra `/api/asaas/webhook`, teste real de assinatura feito em produção e confirmado funcionando (status foi pra `ativa` via webhook). **Pendência 2 resolvida.**
  (2) **Fix: forma de pagamento.** A assinatura criada em `criarAssinatura` (`api/_lib/asaas.ts`) estava com `billingType` fixo em `"PIX"`, por isso só aparecia Pix na cobrança. Como o fundador não quer oferecer boleto, em vez de usar `"UNDEFINED"` (que mostraria Pix + boleto + cartão), foi adicionado um seletor explícito Pix/Cartão na tela `/assinar` — o valor escolhido vai como `metodo` pro `/api/asaas/assinar`, que valida (só aceita `"PIX"` ou `"CREDIT_CARD"`) e passa direto como `billingType`. Boleto nunca é uma opção possível, garantido no código, não depende de configuração no painel do Asaas.
  (3) **Fix: card "Acesso de superadmin" em `/perfil` levava pra `/assinar`** — não fazia sentido pro superadmin, que já tem acesso total via bypass de qualquer gate de assinatura. Agora esse card é só informativo pra esse caso.
  (4) **Item 6 (segredos no histórico do git) auditado** — `.env` apareceu em 2 commits antigos (de quando este repo ainda era "Quintal de Finanças"), mas só continha `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, valores públicos por design (prefixo `VITE_`, anon key protegida por RLS). Nenhuma service role key ou credencial de billing foi commitada em nenhum momento. **Pendência 6 resolvida, sem risco.**
  (5) **Item 5 (e-mail Titan `@quintalzim.com.br` na Hostinger) cancelado pelo fundador.** **Pendência 5 resolvida.**
- **v1.3 (09/out/2026)**: Sessões de produto/UX desde a v1.2, ainda não registradas aqui:
  (1) **Landing page em `/`** — antes era só um redirect pro `/login`; agora é uma landing de marketing real (hero, prova social, grade de funcionalidades, como funciona, planos com preços reais de `src/lib/planos.ts`, CTA), com botão levando pro login. Auditoria de impacto feita em seguida confirmou que não quebrou nenhum fluxo existente (cadastro, recuperação/redefinição de senha, logout, share-intent) — o único ajuste necessário foi a página de 404/erro (`__root.tsx`), que agora manda quem já está logado de volta pro `/dashboard` em vez de sempre pra `/`.
  (2) **Boas-vindas + paywall de trial**: confirmado que a tela de boas-vindas (`/boas-vindas`, com banner de contagem do trial) já existe e é o destino do `emailRedirectTo` do cadastro; confirmado que `/assinar` já cobre o caso de trial expirado via o gate de assinatura em `_app.tsx`.
  (3) **Fix: botão "Salvar" sumindo no formulário de cartão (mobile) e desalinhado/com campos grandes (desktop)** — em `/cartoes/novo` o botão fixo de salvar tinha `z-20`, menor que o menu inferior mobile (`z-30`), e por isso ficava escondido atrás do menu; no desktop, esse mesmo botão fixo ignorava a sidebar e ocupava a tela toda. Corrigido: botão mobile agora em `z-40` com padding que o levanta acima do menu (mesmo padrão já usado em `nova-transacao.tsx`), e um botão separado em fluxo normal pro desktop, alinhado com a coluna de conteúdo. Reduzido também o tamanho de fontes/campos (cabeçalho, limite, dia de fechamento/vencimento) em `novo.tsx` e no modal `edit-card-sheet.tsx`, que estavam desproporcionais.
  (4) **Fix: superadmin caindo na tela de assinatura** — em `/perfil`, o card "Acesso de superadmin" tinha o rótulo certo mas o clique sempre navegava pra `/assinar` (tela de escolha de plano), que não faz sentido pra quem já tem acesso total via `ehSuperadmin`. Agora, pra superadmin, esse card é só informativo (sem navegação).
  (5) **Painel admin (`/admin`) é só leitura** — mostra métricas (contas, assinantes ativos, MRR, inadimplentes, lista de assinantes) mas não tem nenhuma ação de gestão (suspender por inadimplência, estender trial, editar dados de uma conta). Registrado como pendência nova — ver seção 6, item 7.
- **v1.2 (02/out/2026)**: Correção da pendência #3 (cadastro quebrado, 500). A causa raiz **não era SPF** (esse já estava OK) — era **DKIM ausente**, descoberto via `auth_logs` do Supabase: `gomail: could not send email 1: 550 "5.8.1 Error in dkim public key,DKIM public key not found in dns"`. Também corrigido um engano de arquitetura neste doc: **a autoridade de DNS de `kyraone.com.br` é a Vercel**, não a Hostgator (confirmado por lookup dos registros NS: `ns1.vercel-dns.com` / `ns2.vercel-dns.com`) — a Hostgator só hospeda as contas de e-mail Titan (`@kyraone.com.br`), não o DNS. Ver seção 1 corrigida. Fix: localizado o par host+valor do DKIM no painel "Gerenciar E-mail Titan" da Hostgator (`cliente.hostgator.com.br` → E-mails → kyraone.com.br → Reputação de e-mail → Adicionar registro DKIM) e publicado como registro TXT em **Vercel** (`vercel.com/universokyra/~/domains/kyraone.com.br` → DNS Records): `titan1._domainkey` → `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaxp2ZozWFGjyvRw/570aQaw+Mn7Y+8QRse4FTTwFIbEN/2zjysKt7IlIoCjuXvbCTjaxpxz/H99bf2kFHsnR6o1nuyLQm8nq8GSL1HoEzRNSoCG/YdbcbDaasm/YsJs+Cv0JPrIVRISzV4uz/QXCbwO6DorSV2Hd9sw3oyssUeQIDAQAB`. Confirmado via lookup DNS público (dnspython) que o registro já resolve corretamente. **Falta só validar ponta a ponta**: nenhum cadastro real foi submetido nesta sessão (exigiria criar conta de verdade em produção — fora do que posso fazer sem permissão explícita pra cada ação). Fundador: tenta um cadastro de teste pra confirmar que o 500 não volta mais; se persistir, vale checar de novo `auth_logs` do Supabase.
- **v1.1 (02/out/2026)**: (1) Ícone novo do app (K com seta verde, fundo navy) aplicado em favicon, PWA (`public/icons/*`, inclui variante maskable) e no avatar do sidebar (`icon-192.png`, mesmo arquivo usado nos três lugares). (2) `celjordaor@gmail.com` promovido a superadmin (`profiles.role='admin')` — rodado direto via MCP do Supabase, `docs/sql/superadmin.sql` agora só histórico. (3) Trial grátis de 14 dias: migration `trial_14_dias_signup` adiciona `assinaturas.trial_fim` e atualiza o trigger `handle_new_user()` pra criar, em todo cadastro novo, uma linha `assinaturas` com `status='trial'`, `plano='kyraone_pro'` e `trial_fim = now()+14 dias` — libera Pro completo (Cartões/Faturas/Metas) sem cartão/Pix. Lógica de nível em `src/lib/assinaturas.ts` (`calcularNivel`, `diasRestantesTrial`) trata trial ativo como nível "pro" e trial expirado como "nenhum" (client-side, sem mudar o status no banco). UI de contagem em `/assinar` e `/perfil`. (4) ~~Confirmado que o registro TXT SPF... resolvida do lado de DNS~~ — **correção na v1.2**: SPF de fato já estava OK, mas isso não era a causa raiz do 500; a causa real era DKIM ausente (ver v1.2).

---

## 1. O QUE É O KYRAONE

App de finanças pessoais (PWA), fundado pelo mesmo empreendedor solo do Quintalzim (usando IA em todo o processo de construção). Nasceu como "Quintal de Finanças", módulo integrado ao Quintalzim via SSO, e foi **separado em produto independente** entre 26/set e 01/out/2026 (7 fases, ver seção 4) — conta própria em tudo: Supabase, GitHub, Vercel, domínio, billing. O Quintalzim (o produto "mãe", portal multi-serviço pra cidades pequenas) foi descontinuado por completo em 01/out/2026; o KyraOne é o único produto ativo da conta a partir daqui.

**Fundador:** Celso Jordão (celjordaor@gmail.com).

**Domínio:** `kyraone.com.br` (e `www.kyraone.com.br`, canônico — `kyraone.com.br` faz redirect 308). Registro em Registro.br, **DNS gerenciado na Vercel** (nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com` — confirmado por lookup NS em 02/out/2026; registros TXT/MX/CAA etc. são editados em `vercel.com/universokyra/~/domains/kyraone.com.br`, não na Hostgator), hospedagem Vercel. A Hostgator entra só como provedora do e-mail Titan (`@kyraone.com.br`, painel em `cliente.hostgator.com.br` → E-mails) — qualquer registro DNS que o Titan exigir (SPF, DKIM) precisa ser *lido* lá e *publicado* na Vercel.

---

## 2. ARQUITETURA

- **Frontend**: SPA Vite + React 19 + TanStack Router (file-based routing em `src/routes`) + Tailwind v4 + shadcn/ui. PWA via `vite-plugin-pwa`. **Sem Next.js, sem SSR** — importante diferença do Quintalzim.
- **Backend**: não existe camada de servidor própria além de **Vercel Functions** na pasta `/api` (Node serverless, roteadas por `vercel.json` com `/((?!api/).*)` → `index.html`, pra não engolir `/api/*` no catch-all do SPA). Hoje só tem as rotas de billing (`/api/asaas/*`) e admin (`/api/admin/dashboard`).
- **Banco**: Supabase próprio, projeto `eqzqrwbtibelafvzvbfb` (org separada, região sa-east-1, criado na Fase 1). Tabelas: `categories`, `credit_cards`, `account_balance`, `budgets`, `goals`, `goal_contributions`, `transactions`, `invoices`, `card_expenses`, `card_installments`, `profiles` (com `role` e `cpf`), `assinaturas` (com `trial_fim`, ver seção 5).
- **Auth**: Supabase Auth nativo (login/cadastro/recuperação de senha próprios, sem SSO com nada). Client `supabase-js` padrão (`src/lib/supabase.ts`), sessão em localStorage (não cookies) — por isso as Vercel Functions de billing recebem o token via header `Authorization: Bearer <access_token>`, não por cookie.
- **Hospedagem**: Vercel, projeto `kyra-one` (conta pessoal do fundador, não mais a org "Quintalzim" na Vercel — essa foi descontinuada). Deploy a partir do repo GitHub `celjordaor/kyra-one`.
- **Billing**: Conta Asaas própria do KyraOne (separada da antiga conta do Quintalzim). Ver seção 5.

---

## 3. ESTRUTURA DO APP

Rotas principais (`src/routes/_app.*.tsx`, layout comum em `_app.tsx`):
- `/dashboard` — início
- `/transacoes` — lançamentos
- `/categorias` — categorias de receita/despesa
- `/cartoes` (+ `/cartoes/[id]`, `/cartoes/novo`, `/cartoes/nova-despesa`) — cartões de crédito e despesas parceladas
- `/faturas-cartao` — faturas
- `/metas` — metas e orçamentos
- `/perfil` — dados da conta + card "Minha assinatura"
- `/mais` — configurações, notificações
- `/assinar` — escolher plano, CPF, checkout Pix via Asaas, ou cancelar assinatura ativa
- `/admin` — painel de controle (só superadmin, `profiles.role='admin'`)

Navegação: sidebar desktop fixa + bottom nav mobile (ambas em `_app.tsx`), com botão flutuante central de "Adicionar" (receita/despesa/despesa de cartão).

---

## 4. HISTÓRICO DA SEPARAÇÃO DO QUINTALZIM (Fases 0-6, 26-29/set/2026)

Resumo — detalhe completo está no changelog do `quintalzim-contexto-projeto.md` (repo Quintalzim, agora só leitura/histórico, v1.27 a v1.29):

- **Fase 0**: decisões — contas 100% separadas, domínio próprio, sem SSO, billing próprio fica pra depois.
- **Fase 1**: projeto Supabase novo (`eqzqrwbtibelafvzvbfb`), schema das 10 tabelas de Finanças replicado com RLS idêntico, `profiles` próprio com trigger `handle_new_user()`.
- **Fase 2**: decisão de não migrar dados reais (só havia 1 usuário real, o fundador) — começar do zero.
- **Fase 3**: `quintal-financas` desacoplado do SSO do Quintalzim, login/cadastro/recuperação nativos, rebrand completo "KyraOne".
- **Fase 4**: lado Quintalzim desacoplado (DRE da Empresa parou de ler `transactions` do KyraOne, removida a leitura cross-database).
- **Fase 5**: infra separada — GitHub (`celjordaor/kyra-one`), Vercel, DNS (`kyraone.com.br`, A record `76.76.21.21` + CNAME `www`), Supabase Auth URL Configuration ajustada pro domínio novo.
- **Fase 6**: corte — tabelas antigas de Finanças **dropadas** do banco compartilhado do Quintalzim; feature "registrar despesa por WhatsApp" removida do Quintalzim (ver pendência na seção 7); n8n do Quintalzim (`Chamar Extrator`) desativado.
- **Fase 7 → ver seção 5.**

**01/out/2026 — Quintalzim descontinuado por completo** (decisão do usuário, não é mais um produto ativo). Nessa limpeza: Vercel (projetos `quintalzim` e `quintal-financas`) deletados, Supabase do Quintalzim (`rzwgkbekhtkstixtytyw`) deletado, GitHub (`quintalzim/quintalzim` e `quintalzim/quintal-financas`) deletados, domínio `quintalzim.com.br` desconectado no Registro.br, os 15 workflows do n8n do Quintalzim arquivados. **A VPS Hostinger (`srv1841198.hstgr.cloud`, `/opt/kyra`) foi mantida** (contrato de 1 ano já pago) — tem Evolution API (WhatsApp via Cloud API da Meta) e n8n (`https://n8n.universokyra.com.br`) funcionando, reservada pra quando a feature de despesa por WhatsApp for reconstruída nativamente no KyraOne. Nada na VPS é usado pelo KyraOne hoje (confirmado por busca no código — zero referências).

---

## 5. FASE 7 — BILLING (Asaas), implementado em 29/set/2026

**Planos:**
| Plano | Valor | Libera |
|---|---|---|
| Kyra One Controle | R$ 29,90/mês | Transações, categorias, dashboard |
| Kyra One Pro | R$ 49,90/mês | + Cartões, Faturas, Metas |

`src/lib/planos.ts` é a fonte única de verdade dos valores.

**Banco** (migration `billing_asaas_e_superadmin`): `profiles.role` (`'user'`/`'admin'`), `profiles.cpf`; tabela `assinaturas` (1 por usuário — sem categoria, o KyraOne só tem 1 produto — `plano`, `status`: `trial`|`pendente`|`ativa`|`inadimplente`|`cancelada`, `trial_fim`, `asaas_customer_id`, `asaas_subscription_id`). RLS: só SELECT pro dono, toda escrita via service role (exceto a própria linha de trial, inserida pelo trigger abaixo via SECURITY DEFINER).

**Trial grátis (migration `trial_14_dias_signup`, 02/out/2026):** o trigger `handle_new_user()` (dispara em todo `auth.users` novo) agora, além de criar o `profiles`, insere a linha em `assinaturas` já com `status='trial'`, `plano='kyraone_pro'` e `trial_fim = now() + interval '14 days'`. Isso libera nível Pro completo (Cartões/Faturas/Metas) por 14 dias sem precisar de CPF/Pix. `src/lib/assinaturas.ts`: `calcularNivel()` trata `status==='trial'` como nível `"pro"` enquanto `trial_fim` não passou, e `"nenhum"` depois — isso é calculado só no client (o `status` no banco continua `'trial'` pra sempre, não há job que mude pra `'expirado'` ou similar; se precisar reportar/filtrar trials expirados no admin, calcular por `trial_fim < now()` direto na query). `diasRestantesTrial()` dá a contagem regressiva usada nos banners de `/assinar` e `/perfil`.

**Vercel Functions** (`/api`):
- `api/_lib/supabase-admin.ts` — client service role + `usuarioAutenticado()` (valida Bearer token da SPA)
- `api/_lib/asaas.ts` — cliente HTTP do Asaas (sandbox: `api-sandbox.asaas.com/v3`, produção: `api.asaas.com/v3`, via `ASAAS_API_URL`; **produção já configurada e validada em 09/out/2026**)
- `api/asaas/assinar.ts` — recebe `cpf`, `plano` e `metodo` (`"PIX"` ou `"CREDIT_CARD"`, escolhido pelo usuário em `/assinar`) e cria a assinatura no Asaas com esse `billingType` exato — **boleto nunca é oferecido**, por decisão de produto (nada de `"UNDEFINED"`)
- `cancelar.ts`, `sincronizar.ts` (fallback manual que consulta o Asaas direto e atualiza o status, útil se o webhook falhar), `webhook.ts` (valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`, **ativado e testado em produção em 09/out/2026**)
- `api/admin/dashboard.ts` — agrega contas/assinantes/MRR por assinante (incluindo `profileId`/`cpf`/`trialFim`), só pra `role='admin'`
- `api/admin/atualizar-conta.ts` — ações de gestão por assinante (status, plano, CPF, estender trial), só pra `role='admin'`

**Gate de assinatura** (`src/lib/assinaturas.ts`, aplicado em `_app.tsx`): sem nenhuma assinatura ativa, só `/perfil`, `/mais`, `/assinar` acessíveis — resto redireciona pra `/assinar`. Cartões/Faturas/Metas exigem especificamente o Pro (`TelaBloqueada` no lugar do conteúdo). **Superadmin sempre passa em qualquer gate** — proteção pra não travar o fundador fora do próprio produto por causa de webhook do Asaas.

**Variáveis de ambiente** (Vercel → Project Settings → Environment Variables, documentadas em `.env.example`): `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`.

---

## 6. PENDÊNCIAS E BLOQUEIOS ATUAIS

1. ~~SQL de superadmin não rodado ainda~~ — **resolvido em 02/out/2026**, `celjordaor@gmail.com` já é `role='admin'`.
2. ~~Conta Asaas do KyraOne ainda não criada~~ — **resolvido em 09/out/2026.** Conta criada, chaves configuradas na Vercel (produção), webhook ativo, assinatura de teste real confirmada de ponta a ponta (status foi pra `ativa` via webhook).
3. ~~Cadastro de usuário quebrado (500) por registro DKIM ausente~~ — **DNS corrigido em 02/out/2026**. SPF já estava OK desde antes; a causa raiz real era o **DKIM** (confirmado via `auth_logs` do Supabase: `550 5.8.1 Error in dkim public key, DKIM public key not found in dns`). Valor do DKIM obtido no painel Titan da Hostgator e publicado como TXT `titan1._domainkey` em `kyraone.com.br` **na Vercel** (não na Hostgator — ver seção 1). Confirmado via lookup DNS público que o registro já resolve. **Falta só validar ponta a ponta**: nenhuma tentativa de cadastro real foi feita (não crio contas de verdade em produção sem permissão explícita pra cada ação). Fundador: tenta um cadastro de teste pra confirmar que o 500 não volta mais; se voltar, checar `auth_logs` de novo pra ver se é outro provedor/registro faltando.
4. **Reconstruir "registrar despesa por WhatsApp" nativo no KyraOne** — feature Premium que existia no Quintalzim (removida de lá na Fase 6). Reaproveitar a lógica do extrator antigo ("Prontim - Extrator de Despesas", hoje arquivado no n8n mas recuperável), redirecionando a gravação pro Supabase do KyraOne. Infra (Evolution API + n8n) preservada na VPS Hostinger especificamente pra isso (seção 4). Sem data definida.
5. ~~Hostinger — e-mail Titan `@quintalzim.com.br` pendente de cancelamento~~ — **resolvido em 09/out/2026**, cancelado pelo fundador.
6. ~~Conferir se não existe `.env.local`/`.env` com segredo real commitado antes da regra do `.gitignore`~~ — **auditado e resolvido em 09/out/2026**: `.env` apareceu em 2 commits antigos do histórico, mas só com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (públicos por design). Nenhuma service role key ou credencial de billing foi commitada. Sem risco, sem ação necessária.
7. ~~Painel admin sem ações de gestão~~ — **resolvido em 09/out/2026**: `/admin` agora permite suspender/reativar assinatura, trocar plano, editar CPF e estender trial, por assinante (ver `api/admin/atualizar-conta.ts`). Não tem log/auditoria de quem fez a mudança ainda — avaliar se vira necessidade.

---

## 7. COMO USAR ESTE DOCUMENTO

- Classificar novos insights em: (a) arquitetura/infra, (b) produto/UX, (c) decisões de negócio já tomadas (não rediscutir do zero).
- Nunca colocar segredos/senhas neste documento — só referências ao gerenciador de senhas ou nomes de env vars.
- Atualizar a cada sessão que mude algo relevante — seguir o padrão de changelog no topo do documento (cada versão como um parágrafo datado, mais recente primeiro).
