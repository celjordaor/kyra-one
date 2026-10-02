# KYRAONE — Documento de Contexto do Projeto

*Versão 1.1 — 02/out/2026. Este documento dá contexto completo a qualquer nova conversa. Atualizar ao fim de sessões que mudem decisões, arquitetura ou estado. Sucede `quintalzim-contexto-projeto.md` (repo Quintalzim), que parou de ser atualizado na v1.31 quando o Quintalzim foi oficialmente descontinuado — este é o documento de memória ativo a partir de agora.*

**Changelog**
- **v1.1 (02/out/2026)**: (1) Ícone novo do app (K com seta verde, fundo navy) aplicado em favicon, PWA (`public/icons/*`, inclui variante maskable) e no avatar do sidebar (`icon-192.png`, mesmo arquivo usado nos três lugares). (2) `celjordaor@gmail.com` promovido a superadmin (`profiles.role='admin')` — rodado direto via MCP do Supabase, `docs/sql/superadmin.sql` agora só histórico. (3) Trial grátis de 14 dias: migration `trial_14_dias_signup` adiciona `assinaturas.trial_fim` e atualiza o trigger `handle_new_user()` pra criar, em todo cadastro novo, uma linha `assinaturas` com `status='trial'`, `plano='kyraone_pro'` e `trial_fim = now()+14 dias` — libera Pro completo (Cartões/Faturas/Metas) sem cartão/Pix. Lógica de nível em `src/lib/assinaturas.ts` (`calcularNivel`, `diasRestantesTrial`) trata trial ativo como nível "pro" e trial expirado como "nenhum" (client-side, sem mudar o status no banco). UI de contagem em `/assinar` e `/perfil`.

---

## 1. O QUE É O KYRAONE

App de finanças pessoais (PWA), fundado pelo mesmo empreendedor solo do Quintalzim (usando IA em todo o processo de construção). Nasceu como "Quintal de Finanças", módulo integrado ao Quintalzim via SSO, e foi **separado em produto independente** entre 26/set e 01/out/2026 (7 fases, ver seção 4) — conta própria em tudo: Supabase, GitHub, Vercel, domínio, billing. O Quintalzim (o produto "mãe", portal multi-serviço pra cidades pequenas) foi descontinuado por completo em 01/out/2026; o KyraOne é o único produto ativo da conta a partir daqui.

**Fundador:** Celso Jordão (celjordaor@gmail.com).

**Domínio:** `kyraone.com.br` (e `www.kyraone.com.br`, canônico — `kyraone.com.br` faz redirect 308). Registro em Registro.br, DNS na Hostgator, hospedagem Vercel.

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
- `api/_lib/asaas.ts` — cliente HTTP do Asaas (sandbox: `api-sandbox.asaas.com/v3`, produção: `api.asaas.com/v3`, via `ASAAS_API_URL`)
- `api/asaas/assinar.ts`, `cancelar.ts`, `sincronizar.ts` (fallback manual), `webhook.ts` (valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`)
- `api/admin/dashboard.ts` — agrega contas/assinantes/MRR, só pra `role='admin'`

**Gate de assinatura** (`src/lib/assinaturas.ts`, aplicado em `_app.tsx`): sem nenhuma assinatura ativa, só `/perfil`, `/mais`, `/assinar` acessíveis — resto redireciona pra `/assinar`. Cartões/Faturas/Metas exigem especificamente o Pro (`TelaBloqueada` no lugar do conteúdo). **Superadmin sempre passa em qualquer gate** — proteção pra não travar o fundador fora do próprio produto por causa de webhook do Asaas.

**Variáveis de ambiente** (Vercel → Project Settings → Environment Variables, documentadas em `.env.example`): `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`.

---

## 6. PENDÊNCIAS E BLOQUEIOS ATUAIS

1. ~~SQL de superadmin não rodado ainda~~ — **resolvido em 02/out/2026**, `celjordaor@gmail.com` já é `role='admin'`.
2. **Conta Asaas do KyraOne ainda não criada.** Sem ela, `/api/asaas/*` não funciona (erro "ASAAS_API_KEY não configurada"). Precisa: criar conta Asaas própria (separada da antiga do Quintalzim, já deletada), gerar API key (sandbox pra testar), configurar `ASAAS_API_KEY`/`ASAAS_API_URL` na Vercel, e configurar o webhook no painel do Asaas apontando pra `https://www.kyraone.com.br/api/asaas/webhook` com o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.
3. **Cadastro de usuário quebrado por SPF ausente (bug ativo, 01/out/2026).** Signup retorna 500 — causa confirmada nos logs do Supabase Auth: o SMTP customizado (Titan, remetente `contato@kyraone.com.br`) é rejeitado por falta de registro SPF no domínio. Correção: adicionar TXT em `kyraone.com.br` na Hostgator — `v=spf1 include:spf.titan.email ~all` (cuidado: só pode haver 1 registro `v=spf1` por domínio — editar se já existir um). Não confirmado se já foi aplicado.
4. **Reconstruir "registrar despesa por WhatsApp" nativo no KyraOne** — feature Premium que existia no Quintalzim (removida de lá na Fase 6). Reaproveitar a lógica do extrator antigo ("Prontim - Extrator de Despesas", hoje arquivado no n8n mas recuperável), redirecionando a gravação pro Supabase do KyraOne. Infra (Evolution API + n8n) preservada na VPS Hostinger especificamente pra isso (seção 4). Sem data definida.
5. **Hostinger — e-mail Titan `@quintalzim.com.br` pendente de cancelamento** (resíduo do Quintalzim, não é do KyraOne, mas aparece na mesma conta Hostinger). Dois passos pendentes do usuário: cancelar a assinatura "Starter Business Email" e remover o domínio externo em hpanel.hostinger.com/domains.
6. **`.gitignore`** ganhou `.vercel` e `.env*` durante a sessão de billing (29/set) — bom, evita commit acidental de segredo, mas vale conferir se não existe nenhum `.env.local` com segredo real já commitado antes dessa regra.

---

## 7. COMO USAR ESTE DOCUMENTO

- Classificar novos insights em: (a) arquitetura/infra, (b) produto/UX, (c) decisões de negócio já tomadas (não rediscutir do zero).
- Nunca colocar segredos/senhas neste documento — só referências ao gerenciador de senhas ou nomes de env vars.
- Atualizar a cada sessão que mude algo relevante — seguir o padrão de changelog no topo do documento (cada versão como um parágrafo datado, mais recente primeiro).
