import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Verifique o arquivo .env — URL e chave do Supabase são obrigatórios.");
}

// KyraOne agora tem login/cadastro/recuperação de senha próprios — sem
// receptor SSO. detectSessionInUrl volta a ficar ligado (padrão do
// supabase-js) porque os links de confirmação de e-mail e recuperação de
// senha do próprio Supabase usam o mesmo formato de fragmento #access_token
// na URL, e precisam ser processados automaticamente pelo client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);