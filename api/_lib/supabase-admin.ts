// Client Supabase com a service role key — só roda em funções serverless
// (/api/*), nunca no bundle do navegador. Ignora RLS: usado pra escrever em
// `assinaturas` (o client autenticado só tem SELECT nessa tabela) e pra
// validar o token de sessão que a SPA manda no header Authorization.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

export function clienteAdmin(): SupabaseClient | null {
  if (cliente) return cliente;
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  cliente = createClient(url, chave, { auth: { persistSession: false } });
  return cliente;
}

// A SPA não usa cookies de sessão (createClient padrão, sem @supabase/ssr) —
// o token de acesso vem no header Authorization: Bearer <access_token> e é
// validado aqui contra o Supabase Auth.
export async function usuarioAutenticado(authHeader: string | null | undefined) {
  const admin = clienteAdmin();
  if (!admin || !authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
