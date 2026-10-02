import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cancelarAssinatura } from "../_lib/asaas.js";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

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

  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("id, asaas_subscription_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!assinatura?.asaas_subscription_id) {
    return res.status(404).json({ erro: "Nenhuma assinatura encontrada." });
  }

  try {
    await cancelarAssinatura(assinatura.asaas_subscription_id);
  } catch (erro) {
    console.error("Erro ao cancelar assinatura Asaas:", erro);
    return res.status(502).json({ erro: "Não consegui cancelar agora. Tenta de novo." });
  }

  await admin
    .from("assinaturas")
    .update({ status: "cancelada", updated_at: new Date().toISOString() })
    .eq("profile_id", user.id);

  return res.status(200).json({ ok: true });
}
