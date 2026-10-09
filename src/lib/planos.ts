// Planos do KyraOne, cobrados via Asaas. Fonte única de verdade pra
// nome/valor de cada plano — usado nas funções serverless /api/asaas/* e na
// seção "Minha assinatura" do Perfil.
//
// Kyra One Controle: funcionalidades básicas (transações, categorias,
// dashboard). Kyra One Pro: tudo do Controle + Cartões/Faturas e Metas.

export type PlanoId = "kyraone_controle" | "kyraone_pro";

export type Plano = {
  id: PlanoId;
  nome: string;
  valor: number;
  // Valor com desconto de retenção — oferecido quando um assinante tenta
  // excluir a conta (ver src/lib/constants.ts e api/conta/*). Permanente:
  // uma vez aceito, o assinante paga esse valor enquanto continuar ativo.
  valorDesconto: number;
  descricao: string;
  nivel: 1 | 2; // usado pra saber se um plano "cobre" o nível exigido por uma tela
};

export const PLANOS: Record<PlanoId, Plano> = {
  kyraone_controle: {
    id: "kyraone_controle",
    nome: "Kyra One Controle",
    valor: 29.9,
    valorDesconto: 19.9,
    descricao: "Transações, categorias e dashboard — o essencial pra organizar suas finanças.",
    nivel: 1,
  },
  kyraone_pro: {
    id: "kyraone_pro",
    nome: "Kyra One Pro",
    valor: 49.9,
    valorDesconto: 29.9,
    descricao: "Tudo do Controle + Cartões, Faturas e Metas & Orçamentos.",
    nivel: 2,
  },
};

export function listarPlanos(): Plano[] {
  return Object.values(PLANOS);
}

export function buscarPlano(id: string): Plano | null {
  return (PLANOS as Record<string, Plano>)[id] ?? null;
}
