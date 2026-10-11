import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";
import { enviarPushParaUsuario, type PushSubscriptionJSON } from "../_lib/push.js";

// Disparo de push pro próprio usuário autenticado — chamado pelos stores do
// client bem depois de uma despesa/meta já ter sido salva (fire-and-forget,
// nunca bloqueia o fluxo principal). "tipo" decide qual preferência checar;
// "teste" (botão "Testar notificação" em /mais) ignora a preferência, já que
// o próprio clique já é o consentimento pra esse envio pontual.
const PREFERENCIA_POR_TIPO: Record<
  string,
  "notif_expense_alerts" | "notif_goals_reached" | "notif_monthly_summary" | null
> = {
  despesa: "notif_expense_alerts",
  meta: "notif_goals_reached",
  resumo: "notif_monthly_summary",
  teste: null,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const body = req.body ?? {};
  const tipo = body.tipo as string | undefined;
  const titulo = body.titulo as string | undefined;
  const corpo = body.corpo as string | undefined;
  const url = body.url as string | undefined;
  if (!tipo || !(tipo in PREFERENCIA_POR_TIPO) || !titulo || !corpo) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  const { data: perfil } = await admin
    .from("profiles")
    .select("push_subscription, notif_expense_alerts, notif_goals_reached, notif_monthly_summary")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil?.push_subscription) {
    // Usuário nunca ativou push (ou a assinatura expirou) — não é erro, só
    // não tem onde entregar.
    return res.status(200).json({ ok: true, entregue: false, motivo: "sem_assinatura" });
  }

  const colunaPreferencia = PREFERENCIA_POR_TIPO[tipo];
  if (colunaPreferencia && !perfil[colunaPreferencia]) {
    // Nunca confia só na checagem feita no client (src/lib/notificacoes-store.ts)
    // — essa aqui é a que de fato decide se o push sai ou não.
    return res.status(200).json({ ok: true, entregue: false, motivo: "preferencia_desativada" });
  }

  const entregue = await enviarPushParaUsuario(
    user.id,
    perfil.push_subscription as PushSubscriptionJSON,
    { titulo, corpo, url },
  );

  return res.status(200).json({ ok: true, entregue });
}
