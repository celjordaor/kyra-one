import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sincronizarStatusAssinatura } from "../_lib/asaas";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin";

// Fallback manual: consulta o Asaas direto (em vez de esperar o webhook) e
// atualiza o status da assinatura. Útil logo após o checkout, ou se o
// webhook falhar por qualquer motivo.
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
    .select("asaas_subscription_id, status")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!assinatura?.asaas_subscription_id) {
    return res.status(404).json({ erro: "Nenhuma assinatura encontrada." });
  }

  try {
    const statusAtualizado = await sincronizarStatusAssinatura(assinatura.asaas_subscription_id);

    if (statusAtualizado !== assinatura.status) {
      await admin
        .from("assinaturas")
        .update({ status: statusAtualizado, updated_at: new Date().toISOString() })
        .eq("profile_id", user.id);
    }

    return res.status(200).json({ status: statusAtualizado });
  } catch (erro) {
    console.error("Erro ao sincronizar assinatura Asaas:", erro);
    return res.status(502).json({ erro: "Não consegui checar agora. Tenta de novo." });
  }
}
