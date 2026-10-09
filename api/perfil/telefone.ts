import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

// Autoatendimento: o próprio usuário vincula o WhatsApp dele ao perfil.
// Guardado só com dígitos, com código do país (55) na frente, sem símbolos —
// é o formato que bate com o remoteJid que o WhatsApp manda (ex:
// 5511991234567), necessário pra Kyra achar o perfil pelo telefone.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const body = req.body ?? {};
  const bruto = (body.phone as string | undefined)?.replace(/\D/g, "") ?? "";

  // Aceita com ou sem o 55 na frente — DDD (2) + número (8 ou 9 dígitos).
  let digitos = bruto;
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = "55" + digitos;
  }
  if (digitos.length !== 12 && digitos.length !== 13) {
    return res.status(400).json({ erro: "Telefone inválido. Usa DDD + número (ex: 11 91234-5678)." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível (variáveis de ambiente do Supabase não configuradas)." });
  }

  const { data: existente } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", digitos)
    .neq("id", user.id)
    .maybeSingle();
  if (existente) {
    return res.status(409).json({ erro: "Esse número já está vinculado a outra conta." });
  }

  const { error } = await admin.from("profiles").update({ phone: digitos }).eq("id", user.id);
  if (error) {
    console.error("[perfil/telefone] erro ao salvar:", error);
    return res.status(500).json({ erro: "Não consegui salvar o telefone agora." });
  }

  return res.status(200).json({ ok: true, phone: digitos });
}
