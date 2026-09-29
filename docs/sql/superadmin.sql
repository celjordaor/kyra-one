-- Promove o fundador a superadmin do KyraOne (profiles.role='admin').
-- A tabela `assinaturas` e a coluna `profiles.role` já foram criadas via
-- migration "billing_asaas_e_superadmin" (MCP do Supabase). Falta só esta
-- UPDATE, que o classificador de permissão do Claude bloqueia rodar sozinho
-- por escrever em profiles.role — rode manualmente UMA VEZ no Supabase
-- (Dashboard → SQL Editor → New query), projeto KyraOne (eqzqrwbtibelafvzvbfb).

UPDATE public.profiles
SET role = 'admin'
WHERE id = '863a2878-0b34-47a5-b705-425f5a2b7816'; -- celjordaor@gmail.com (fundador)
