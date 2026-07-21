import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Verifique o arquivo .env — URL e chave do Supabase são obrigatórios.");
}

// detectSessionInUrl: false — o receptor SSO em main.tsx processa o
// fragmento #access_token manualmente e de forma bloqueante, antes do
// roteador montar. Deixar o parsing automático do supabase-js ligado
// cria uma corrida com esse processamento (ele tenta ler/limpar o mesmo
// hash de forma assíncrona e não coordenada).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: false },
});