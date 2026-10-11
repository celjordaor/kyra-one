import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

// Remove a assinatura Web Push salva (usuário desativou nas configurações,
// ou o navegador cancelou a assinatura e avisou o front).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  const { error } = await admin
    .from("profiles")
    .update({ push_subscription: null })
    .eq("id", user.id);
  if (error) {
    console.error("[notificacoes/desinscrever] erro:", error);
    return res.status(500).json({ erro: "Não consegui desativar as notificações agora." });
  }

  return res.status(200).json({ ok: true });
}
