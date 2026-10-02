import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin } from "../_lib/supabase-admin.js";

// Webhook do Asaas — configurar manualmente no painel (Configurações →
// Integrações → Webhooks), apontando pra
// https://kyraone.com.br/api/asaas/webhook, com o mesmo valor de
// ASAAS_WEBHOOK_TOKEN como "Token de acesso" (Asaas devolve esse token no
// header `asaas-access-token` em toda chamada, é como validamos que a
// chamada é de fato do Asaas). Mesmo padrão do Quintalzim.

const EVENTOS_ATIVA = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
const EVENTOS_INADIMPLENTE = ["PAYMENT_OVERDUE"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = req.headers["asaas-access-token"];

  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const corpo = req.body ?? {};
  const evento = corpo.event as string | undefined;
  const payment = corpo.payment as { customer?: string; subscription?: string } | undefined;

  if (!evento || !payment?.subscription) {
    return res.status(200).json({ ok: true }); // evento que não precisamos tratar
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  let novoStatus: string | null = null;
  if (EVENTOS_ATIVA.includes(evento)) novoStatus = "ativa";
  else if (EVENTOS_INADIMPLENTE.includes(evento)) novoStatus = "inadimplente";

  if (!novoStatus) {
    return res.status(200).json({ ok: true });
  }

  await admin
    .from("assinaturas")
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq("asaas_subscription_id", payment.subscription);

  return res.status(200).json({ ok: true });
}
