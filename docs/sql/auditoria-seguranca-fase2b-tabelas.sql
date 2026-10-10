-- Auditoria de segurança — Fase 2b (docs/auditoria-seguranca-2026-10.md,
-- itens 5 e 9). EXECUTADO em 10/out/2026 via mcp__Supabase__execute_sql
-- (projeto KyraOne, eqzqrwbtibelafvzvbfb). Mantido aqui só como
-- registro/histórico — já rodou. RLS habilitado automaticamente nas duas
-- (trigger de evento rls_auto_enable) e sem nenhuma policy — só a service
-- role (Vercel Functions) lê/escreve.

-- ── Item 5: log de auditoria das ações de api/admin/atualizar-conta.ts ──
CREATE TABLE IF NOT EXISTS public.admin_acoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  profile_id_alvo uuid NOT NULL REFERENCES public.profiles(id),
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_acoes_log IS 'Auditoria das ações de api/admin/atualizar-conta.ts — quem mudou o quê, quando, de/para qual valor. Só lido via service role (RLS sem policy de SELECT para authenticated/anon).';

-- ── Item 9: comprovante não-reversível de exclusão de conta (LGPD art. 18) ──
CREATE TABLE IF NOT EXISTS public.exclusoes_lgpd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_email text NOT NULL,
  executado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.exclusoes_lgpd IS 'Comprovante não-reversível de exclusão de conta (LGPD art. 18), gravado no fim de api/conta/excluir.ts. hash_email = sha256 do e-mail (não é possível recuperar o e-mail original a partir daqui).';
