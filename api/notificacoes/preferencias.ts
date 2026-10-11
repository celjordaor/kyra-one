import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

// Preferências de notificação — antes viviam só em localStorage (`fp:notifs`
// em _app.mais.tsx), sem nenhum efeito real. Agora moram em `profiles`, pra
// api/notificacoes/disparar.ts conseguir checar antes de mandar um push (e
// pra sincronizar entre dispositivos). "Lembretes de contas" continua sem
// disparo de push — só controla o KPI de pendências no dashboard, como já
// era antes.
const COLUNAS = {
  expenseAlerts: "notif_expense_alerts",
  monthlySummary: "notif_monthly_summary",
  goalsReached: "notif_goals_reached",
  billReminders: "notif_bill_reminders",
} as const;
type Chave = keyof typeof COLUNAS;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("profiles")
      .select(
        "notif_expense_alerts, notif_monthly_summary, notif_goals_reached, notif_bill_reminders, push_subscription",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) {
      return res.status(500).json({ erro: "Não consegui carregar suas preferências agora." });
    }
    return res.status(200).json({
      expenseAlerts: !!data.notif_expense_alerts,
      monthlySummary: !!data.notif_monthly_summary,
      goalsReached: !!data.notif_goals_reached,
      billReminders: !!data.notif_bill_reminders,
      pushAtivo: !!data.push_subscription,
    });
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const chave = body.chave as Chave | undefined;
    const valor = body.valor;
    if (!chave || !(chave in COLUNAS) || typeof valor !== "boolean") {
      return res.status(400).json({ erro: "Parâmetros inválidos." });
    }
    const { error } = await admin
      .from("profiles")
      .update({ [COLUNAS[chave]]: valor })
      .eq("id", user.id);
    if (error) {
      console.error("[notificacoes/preferencias] erro ao salvar:", error);
      return res.status(500).json({ erro: "Não consegui salvar essa preferência agora." });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: "Método não permitido." });
}
