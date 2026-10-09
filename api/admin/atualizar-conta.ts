import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";
import { buscarPlano } from "../../src/lib/planos.js";

// Ações de gestão do painel /admin — só superadmin (profiles.role='admin').
// Tudo aqui é escrita direta via service role (RLS bloqueia o client comum),
// então a checagem de role é obrigatória em toda chamada.

const STATUS_VALIDOS = ["trial", "pendente", "ativa", "inadimplente", "cancelada"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const user = await usuarioAutenticado(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ erro: "Não autorizado." });
    }

    const admin = clienteAdmin();
    if (!admin) {
      return res.status(500).json({ erro: "Indisponível (variáveis de ambiente do Supabase não configuradas)." });
    }

    const { data: perfilChamador, error: erroPerfil } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (erroPerfil) throw erroPerfil;
    if (perfilChamador?.role !== "admin") {
      return res.status(403).json({ erro: "Acesso restrito." });
    }

    const body = req.body ?? {};
    const profileId = body.profileId as string | undefined;
    if (!profileId) {
      return res.status(400).json({ erro: "profileId é obrigatório." });
    }

    const { data: assinaturaAtual, error: erroAtual } = await admin
      .from("assinaturas")
      .select("status, plano, trial_fim")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (erroAtual) throw erroAtual;
    if (!assinaturaAtual) {
      return res.status(404).json({ erro: "Essa conta não tem assinatura cadastrada." });
    }

    // ── Trocar status (suspender / reativar / marcar inadimplente etc.) ──
    if (body.status !== undefined) {
      const novoStatus = body.status as string;
      if (!STATUS_VALIDOS.includes(novoStatus)) {
        return res.status(400).json({ erro: "Status inválido." });
      }
      const { error } = await admin
        .from("assinaturas")
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq("profile_id", profileId);
      if (error) throw error;
    }

    // ── Trocar plano ──
    if (body.plano !== undefined) {
      const plano = buscarPlano(body.plano as string);
      if (!plano) {
        return res.status(400).json({ erro: "Plano inválido." });
      }
      const { error } = await admin
        .from("assinaturas")
        .update({ plano: plano.id, updated_at: new Date().toISOString() })
        .eq("profile_id", profileId);
      if (error) throw error;
    }

    // ── Estender trial (soma dias ao trial_fim atual, ou a partir de agora
    //    se já tiver expirado / nunca teve) ──
    if (body.trialDiasExtras !== undefined) {
      const dias = Number(body.trialDiasExtras);
      if (!Number.isFinite(dias) || dias <= 0 || dias > 365) {
        return res.status(400).json({ erro: "Quantidade de dias inválida (1 a 365)." });
      }
      const trialAtual = assinaturaAtual.trial_fim ? new Date(assinaturaAtual.trial_fim as string) : null;
      const base = trialAtual && trialAtual.getTime() > Date.now() ? trialAtual : new Date();
      const novoTrialFim = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);

      const { error } = await admin
        .from("assinaturas")
        .update({
          trial_fim: novoTrialFim.toISOString(),
          // Se a conta já tinha expirado (status não é mais 'trial' porque o
          // client calcula nível no front), devolve pro status 'trial' pra
          // ela voltar a ser contada como trial ativo.
          status: assinaturaAtual.status === "cancelada" || assinaturaAtual.status === "inadimplente"
            ? "trial"
            : assinaturaAtual.status,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profileId);
      if (error) throw error;
    }

    // ── Editar CPF ──
    if (body.cpf !== undefined) {
      const cpf = (body.cpf as string).replace(/\D/g, "");
      if (cpf.length !== 11) {
        return res.status(400).json({ erro: "CPF inválido." });
      }
      const { error } = await admin.from("profiles").update({ cpf }).eq("id", profileId);
      if (error) throw error;
    }

    return res.status(200).json({ ok: true });
  } catch (erro) {
    console.error("[admin/atualizar-conta] erro inesperado:", erro);
    return res.status(500).json({
      erro: "Erro interno ao atualizar a conta.",
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
