import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin, usuarioAutenticado } from "../_lib/supabase-admin";
import { buscarPlano } from "../../src/lib/planos";

// Painel de controle do KyraOne — só superadmin (profiles.role='admin').
// Roda como função serverless porque a SPA não tem acesso a auth.users (só
// o service role vê e-mail dos usuários) nem pode calcular MRR sem RLS.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
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

  const { data: perfilChamador } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilChamador?.role !== "admin") {
    return res.status(403).json({ erro: "Acesso restrito." });
  }

  const { data: perfis } = await admin.from("profiles").select("id, name, created_at");
  const { data: assinaturas } = await admin
    .from("assinaturas")
    .select("profile_id, plano, status, updated_at, created_at");

  // auth.users não é uma tabela normal (schema auth) — listUsers é o jeito
  // suportado de buscar e-mail via admin API.
  const { data: usuariosAuth } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailPorId = new Map((usuariosAuth?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const totalContas = perfis?.length ?? 0;
  const assinantesAtivos = (assinaturas ?? []).filter((a) => a.status === "ativa");
  const mrr = assinantesAtivos.reduce((soma, a) => {
    const plano = buscarPlano(a.plano as string);
    return soma + (plano?.valor ?? 0);
  }, 0);

  const porPlano = { kyraone_controle: 0, kyraone_pro: 0 } as Record<string, number>;
  for (const a of assinantesAtivos) {
    if (a.plano in porPlano) porPlano[a.plano] += 1;
  }

  const inadimplentes = (assinaturas ?? []).filter((a) => a.status === "inadimplente").length;
  const pendentes = (assinaturas ?? []).filter((a) => a.status === "pendente").length;
  const canceladas = (assinaturas ?? []).filter((a) => a.status === "cancelada").length;

  const assinantesLista = (assinaturas ?? [])
    .slice()
    .sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime())
    .map((a) => ({
      email: emailPorId.get(a.profile_id as string) ?? "—",
      plano: buscarPlano(a.plano as string)?.nome ?? a.plano,
      status: a.status,
      atualizadoEm: a.updated_at,
    }));

  return res.status(200).json({
    totalContas,
    totalAssinantesAtivos: assinantesAtivos.length,
    mrr,
    porPlano,
    inadimplentes,
    pendentes,
    canceladas,
    assinantes: assinantesLista,
  });
}
