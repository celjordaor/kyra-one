import type { VercelRequest, VercelResponse } from "@vercel/node";
import { addMonths, setDate, isAfter, format, parseISO } from "date-fns";
import { clienteAdmin } from "../_lib/supabase-admin.js";
import { buscarPlano } from "../../src/lib/planos.js";

// Endpoint de serviço pra Kyra (WhatsApp, via n8n) lançar uma despesa de
// cartão em nome do usuário. Não usa o fluxo normal de sessão (Bearer do
// Supabase Auth) porque quem chama é o workflow do n8n, não o navegador do
// usuário — autentica com uma chave compartilhada (header) e identifica o
// usuário pelo telefone (profiles.phone), que é o mesmo formato que o
// WhatsApp manda no remoteJid (55 + DDD + número, só dígitos).
//
// Reaplica aqui, do lado do servidor, a mesma lógica de resolução de fatura
// que existe em src/lib/card-store.ts (buildInvoiceDates / ensureInvoices /
// resolveInvoiceForDate) — client-side porque author original não previa
// um caller sem sessão de navegador. Mantém os dois em sincronia se mudar
// a regra de fechamento/vencimento de fatura.

type CardRow = {
  id: string; user_id: string; name: string; bank: string;
  closing_day: number; due_day: number; active: boolean; is_default: boolean;
};
type InvoiceRow = {
  id: string; card_id: string; competence: string;
  closing_date: string; due_date: string; status: string; total_amount: number;
};

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function buildInvoiceDates(card: CardRow, ref: Date) {
  const competence = format(ref, "MM/yyyy");
  const closingDate = setDate(ref, card.closing_day);
  let dueDate = setDate(ref, card.due_day);
  if (card.due_day <= card.closing_day) dueDate = setDate(addMonths(ref, 1), card.due_day);
  return { competence, closing_date: format(closingDate, "yyyy-MM-dd"), due_date: format(dueDate, "yyyy-MM-dd") };
}

function competenceToSortKey(c: string): string {
  const [mm, yyyy] = c.split("/");
  return `${yyyy}-${mm}`;
}

function resolveInvoiceForDate(purchaseDate: string, invoices: InvoiceRow[], cardId: string): InvoiceRow | null {
  const date = parseISO(purchaseDate);
  const abertas = invoices.filter(inv => inv.card_id === cardId && inv.status === "open");
  const atual = abertas.find(inv => isAfter(parseISO(inv.closing_date), date));
  if (atual) return atual;
  return [...abertas].sort((a, b) => competenceToSortKey(a.competence).localeCompare(competenceToSortKey(b.competence)))[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const chaveEsperada = process.env.KYRA_WHATSAPP_API_KEY;
  const chaveRecebida = req.headers["x-kyra-whatsapp-key"];
  if (!chaveEsperada || chaveRecebida !== chaveEsperada) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível (variáveis de ambiente do Supabase não configuradas)." });
  }

  const body = req.body ?? {};
  const telefoneBruto = (body.phone as string | undefined)?.replace(/\D/g, "") ?? "";
  const cardId = body.cardId as string | undefined;
  const cardName = (body.cardName as string | undefined)?.trim();
  const category = (body.category as string | undefined)?.trim();
  const description = (body.description as string | undefined)?.trim();
  const amount = Number(body.amount);
  const purchaseDate = (body.purchaseDate as string | undefined) ?? format(new Date(), "yyyy-MM-dd");

  if (!telefoneBruto) return res.status(400).json({ erro: "Telefone não informado." });
  if (!category || !description) return res.status(400).json({ erro: "Categoria e descrição são obrigatórias." });
  if (!amount || amount <= 0) return res.status(400).json({ erro: "Valor inválido." });
  if (!cardId && !cardName) return res.status(400).json({ erro: "Informe cardId ou cardName." });

  // ── 1. Resolve o usuário pelo telefone ───────────────────────────────
  const { data: perfil } = await admin
    .from("profiles")
    .select("id, role")
    .eq("phone", telefoneBruto)
    .maybeSingle();
  if (!perfil) {
    return res.status(404).json({ erro: "numero_nao_vinculado" });
  }
  const userId = perfil.id as string;
  const ehSuperadmin = perfil.role === "admin";

  // ── 2. Checa gating (Kyra One Pro, ou trial ainda ativo, ou superadmin) ──
  if (!ehSuperadmin) {
    const { data: assinatura } = await admin
      .from("assinaturas")
      .select("status, plano, trial_fim")
      .eq("user_id", userId)
      .maybeSingle();
    const status = assinatura?.status ?? null;
    const trialFim = assinatura?.trial_fim ?? null;
    const plano = assinatura?.plano ?? null;
    let nivelPro = false;
    if (status === "trial") {
      nivelPro = !!trialFim && new Date(trialFim).getTime() > Date.now();
    } else if (status === "ativa" && plano) {
      const p = buscarPlano(plano);
      nivelPro = !!p && p.nivel >= 2;
    }
    if (!nivelPro) {
      return res.status(403).json({ erro: "sem_acesso_pro" });
    }
  }

  // ── 3. Resolve o cartão ───────────────────────────────────────────────
  const { data: cartoesUsuario } = await admin
    .from("credit_cards")
    .select("id, user_id, name, bank, closing_day, due_day, active, is_default")
    .eq("user_id", userId)
    .eq("active", true);
  const cartoes = (cartoesUsuario ?? []) as CardRow[];

  let cartao: CardRow | null = null;
  if (cardId) {
    cartao = cartoes.find(c => c.id === cardId) ?? null;
    if (!cartao) return res.status(404).json({ erro: "cartao_nao_encontrado" });
  } else if (cardName) {
    const alvo = normaliza(cardName);
    const candidatos = cartoes.filter(c => {
      const nome = normaliza(c.name);
      const banco = normaliza(c.bank ?? "");
      return nome.includes(alvo) || alvo.includes(nome) || banco.includes(alvo) || alvo.includes(banco);
    });
    if (candidatos.length === 0) {
      return res.status(404).json({ erro: "cartao_nao_encontrado", cartoesDisponiveis: cartoes.map(c => ({ id: c.id, name: c.name, bank: c.bank })) });
    }
    if (candidatos.length > 1) {
      return res.status(409).json({ erro: "cartao_ambiguo", candidatos: candidatos.map(c => ({ id: c.id, name: c.name, bank: c.bank })) });
    }
    cartao = candidatos[0];
  }
  if (!cartao) return res.status(404).json({ erro: "cartao_nao_encontrado" });

  // ── 4. Resolve (ou cria) a fatura certa pra data da compra ───────────
  const { data: invoicesData } = await admin
    .from("invoices")
    .select("id, card_id, competence, closing_date, due_date, status, total_amount")
    .eq("card_id", cartao.id);
  let invoices = (invoicesData ?? []) as InvoiceRow[];

  let invoice = resolveInvoiceForDate(purchaseDate, invoices, cartao.id);
  if (!invoice) {
    // Sem fatura aberta pra essa data — cria a fatura necessária (e a
    // seguinte, de margem) na hora, igual ensureInvoices faria.
    const existentes = new Set(invoices.map(i => i.competence));
    const refBase = parseISO(purchaseDate);
    const novas = [];
    for (let i = 0; i < 2; i++) {
      const ref = addMonths(refBase, i);
      const { competence, closing_date, due_date } = buildInvoiceDates(cartao, ref);
      if (!existentes.has(competence)) {
        novas.push({ user_id: userId, card_id: cartao.id, competence, closing_date, due_date, total_amount: 0, status: "open", transaction_id: null });
      }
    }
    if (novas.length > 0) {
      const { data: criadas } = await admin.from("invoices").insert(novas).select();
      invoices = [...invoices, ...((criadas ?? []) as InvoiceRow[])];
    }
    invoice = resolveInvoiceForDate(purchaseDate, invoices, cartao.id);
  }
  if (!invoice) {
    return res.status(500).json({ erro: "Não consegui resolver a fatura pra essa compra." });
  }

  // ── 5. Lança a despesa (avulsa, 1x) e recalcula o total da fatura ────
  const { data: despesa, error: erroInsercao } = await admin
    .from("card_expenses")
    .insert({
      user_id: userId, card_id: cartao.id, invoice_id: invoice.id,
      category, description, amount, purchase_date: purchaseDate,
      installments_total: 1, installment_number: 1,
      expense_type: "single",
    })
    .select()
    .single();
  if (erroInsercao || !despesa) {
    console.error("[cartoes/lancar-despesa] erro ao inserir:", erroInsercao);
    return res.status(500).json({ erro: "Não consegui lançar a despesa agora." });
  }

  const { data: despesasFatura } = await admin.from("card_expenses").select("amount").eq("invoice_id", invoice.id);
  const { data: parcelasFatura } = await admin.from("card_installments").select("amount").eq("invoice_id", invoice.id);
  const novoTotal =
    (despesasFatura ?? []).reduce((s, e) => s + Number(e.amount), 0) +
    (parcelasFatura ?? []).reduce((s, i) => s + Number(i.amount), 0);
  await admin.from("invoices").update({ total_amount: novoTotal }).eq("id", invoice.id);

  return res.status(200).json({
    ok: true,
    cardName: cartao.name,
    invoiceCompetence: invoice.competence,
    amount,
    description,
    category,
  });
}
