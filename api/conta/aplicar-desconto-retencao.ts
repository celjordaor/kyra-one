// Fluxo de retenção: chamado quando um assinante ativo tenta excluir a
// conta e aceita a oferta de desconto permanente pra ficar (ver
// src/components/conta/excluir-conta-dialog.tsx). Atualiza o valor da
// cobrança no Asaas e registra em `assinaturas.valor_desconto`.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { atualizarValorAssinatura } from "../_lib/asaas.js";
import { buscarPlano } from "../../src/lib/planos.js";
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
    .select("id, plano, status, asaas_subscription_id, valor_desconto")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!assinatura || assinatura.status !== "ativa" || !assinatura.asaas_subscription_id) {
    return res
      .status(400)
      .json({ erro: "Você precisa ter uma assinatura ativa pra receber esse desconto." });
  }

  // Idempotente: se já tinha aceitado antes, só devolve o valor já aplicado.
  if (assinatura.valor_desconto) {
    return res.status(200).json({ ok: true, novoValor: Number(assinatura.valor_desconto) });
  }

  const plano = buscarPlano(assinatura.plano);
  if (!plano) {
    return res.status(400).json({ erro: "Plano inválido." });
  }

  try {
    await atualizarValorAssinatura(assinatura.asaas_subscription_id, plano.valorDesconto);
  } catch (erro) {
    console.error("Erro ao aplicar desconto de retenção no Asaas:", erro);
    return res.status(502).json({ erro: "Não consegui aplicar o desconto agora. Tenta de novo." });
  }

  await admin
    .from("assinaturas")
    .update({
      valor_desconto: plano.valorDesconto,
      desconto_retencao_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", user.id);

  return res.status(200).json({ ok: true, novoValor: plano.valorDesconto });
}
