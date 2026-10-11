import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

// Salva a assinatura Web Push (PushSubscription.toJSON()) do navegador/PWA
// do usuário. Um dispositivo por conta por ora — assinar de novo (outro
// navegador, reinstalou o PWA) substitui a anterior.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const subscription = req.body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ erro: "Assinatura de push inválida." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  const { error } = await admin
    .from("profiles")
    .update({ push_subscription: subscription })
    .eq("id", user.id);
  if (error) {
    console.error("[notificacoes/inscrever] erro ao salvar:", error);
    return res
      .status(500)
      .json({ erro: "Não consegui salvar a assinatura de notificações agora." });
  }

  return res.status(200).json({ ok: true });
}
