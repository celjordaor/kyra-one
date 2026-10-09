// Exclusão definitiva de conta (self-service, LGPD art. 18 — direito à
// eliminação). Cancela a assinatura ativa no Asaas (se houver), apaga todos
// os dados pessoais/financeiros do usuário em todas as tabelas, e por fim
// remove o usuário do Supabase Auth. Irreversível — a confirmação final
// acontece no client (ver excluir-conta-dialog.tsx) antes de chegar aqui.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cancelarAssinatura } from "../_lib/asaas.js";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin.js";

// Ordem importa: tabelas "filhas" (que referenciam outras) antes das "mães",
// pra nunca esbarrar numa constraint de FK mesmo que ON DELETE CASCADE não
// esteja configurado em alguma delas. Todas usam `user_id`, exceto
// `assinaturas` (profile_id) e `profiles` (id = auth.users.id).
const TABELAS_POR_USER_ID = [
  "card_installments",
  "card_expenses",
  "invoices",
  "credit_cards",
  "goal_contributions",
  "goals",
  "budgets",
  "transactions",
  "account_balance",
  "categories",
] as const;

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

  // 1) Cancela a assinatura no Asaas, se houver uma ativa. Se a chamada ao
  // Asaas falhar, aborta — melhor pedir pra tentar de novo do que apagar a
  // conta e deixar uma cobrança ativa "órfã" rodando no gateway.
  const { data: assinatura } = await admin
    .from("assinaturas")
    .select("status, asaas_subscription_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (assinatura?.status === "ativa" && assinatura.asaas_subscription_id) {
    try {
      await cancelarAssinatura(assinatura.asaas_subscription_id);
    } catch (erro) {
      console.error("Erro ao cancelar assinatura durante exclusão de conta:", erro);
      return res
        .status(502)
        .json({ erro: "Não consegui cancelar sua assinatura agora. Tenta de novo em instantes." });
    }
  }

  // 2) Apaga os dados em todas as tabelas, service role (ignora RLS).
  for (const tabela of TABELAS_POR_USER_ID) {
    const { error } = await admin.from(tabela).delete().eq("user_id", user.id);
    if (error) {
      console.error(`Erro ao apagar dados de "${tabela}" na exclusão de conta:`, error);
      return res
        .status(500)
        .json({ erro: "Não consegui apagar todos os seus dados agora. Tenta de novo." });
    }
  }

  const { error: erroAssinatura } = await admin
    .from("assinaturas")
    .delete()
    .eq("profile_id", user.id);
  if (erroAssinatura) {
    console.error("Erro ao apagar assinatura na exclusão de conta:", erroAssinatura);
    return res
      .status(500)
      .json({ erro: "Não consegui apagar todos os seus dados agora. Tenta de novo." });
  }

  const { error: erroPerfil } = await admin.from("profiles").delete().eq("id", user.id);
  if (erroPerfil) {
    console.error("Erro ao apagar perfil na exclusão de conta:", erroPerfil);
    return res
      .status(500)
      .json({ erro: "Não consegui apagar todos os seus dados agora. Tenta de novo." });
  }

  // 3) Por último, remove o usuário do Auth — depois disso não há mais
  // volta, e o token de sessão dele deixa de ser válido.
  const { error: erroAuth } = await admin.auth.admin.deleteUser(user.id);
  if (erroAuth) {
    console.error("Erro ao remover usuário do Auth na exclusão de conta:", erroAuth);
    return res.status(500).json({
      erro: "Seus dados foram apagados, mas não consegui remover sua conta de acesso. Fala com o suporte.",
    });
  }

  return res.status(200).json({ ok: true });
}
