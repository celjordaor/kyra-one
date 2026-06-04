import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Verifique o arquivo .env — URL e chave do Supabase são obrigatórios.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);