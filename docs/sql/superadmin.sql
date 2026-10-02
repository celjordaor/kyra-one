-- Promove o fundador a superadmin do KyraOne (profiles.role='admin').
--
-- EXECUTADO em 02/out/2026 via mcp__Supabase__execute_sql (projeto KyraOne,
-- eqzqrwbtibelafvzvbfb), confirmado antes e depois do UPDATE. profiles.role
-- de celjordaor@gmail.com = 'admin'. Mantido aqui só como registro/histórico.

UPDATE public.profiles
SET role = 'admin'
WHERE id = '863a2878-0b34-47a5-b705-425f5a2b7816'; -- celjordaor@gmail.com (fundador)
