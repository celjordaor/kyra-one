import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buscarClientePorCpf, criarAssinatura, criarCliente, buscarPrimeiraCobranca } from "../_lib/asaas.js";
import { buscarPlano } from "../../src/lib/planos.js";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

function proximoDiaUtilISO(): string {
  // Asaas exige nextDueDate >= hoje. Usamos amanhã pra dar folga de fuso.
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  return amanha.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const user = await usuarioAutenticado(req.headers.authorization);
  if (!user || !user.email) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const body = req.body ?? {};
  const cpf = (body.cpf as string | undefined)?.replace(/\D/g, "");
  const planoId = body.plano as string | undefined;

  if (!cpf || cpf.length !== 11) {
    return res.status(400).json({ erro: "CPF inválido." });
  }

  const plano = planoId ? buscarPlano(planoId) : null;
  if (!plano) {
    return res.status(400).json({ erro: "Plano inválido." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Assinatura temporariamente indisponível." });
  }

  // Guarda o CPF no perfil (self-service, baixo risco)
  await admin.from("profiles").update({ cpf }).eq("id", user.id);

  const { data: assinaturaExistente } = await admin
    .from("assinaturas")
    .select("id, status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (assinaturaExistente && assinaturaExistente.status === "ativa") {
    return res.status(400).json({
      erro: "Você já tem uma assinatura ativa. Cancela a atual antes de trocar de plano.",
    });
  }

  try {
    let clienteAsaas = await buscarClientePorCpf(cpf);
    if (!clienteAsaas) {
      const nome = (user.user_metadata?.name as string | undefined)?.trim() || user.email;
      clienteAsaas = await criarCliente({ name: nome, email: user.email, cpfCnpj: cpf });
    }

    const assinatura = await criarAssinatura({
      customer: clienteAsaas.id,
      value: plano.valor,
      nextDueDate: proximoDiaUtilISO(),
      description: `KyraOne — ${plano.nome}`,
    });

    await admin.from("assinaturas").upsert(
      {
        profile_id: user.id,
        asaas_customer_id: clienteAsaas.id,
        asaas_subscription_id: assinatura.id,
        plano: plano.id,
        status: "pendente",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );

    const primeiraCobranca = await buscarPrimeiraCobranca(assinatura.id);

    return res.status(200).json({ invoiceUrl: primeiraCobranca?.invoiceUrl ?? null });
  } catch (erro) {
    console.error("Erro ao criar assinatura Asaas:", erro);
    return res.status(502).json({ erro: "Não consegui criar a assinatura agora. Tenta de novo em instantes." });
  }
}
