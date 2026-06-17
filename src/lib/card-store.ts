import { create } from "zustand";
import { supabase } from "./supabase";
import { addMonths, setDate, isAfter, format, parseISO, startOfDay } from "date-fns";

export type CardFlag = "Visa" | "Mastercard" | "Elo" | "Amex" | "Hipercard" | "Outro";
export type InvoiceStatus = "open" | "closed" | "paid";
export type ExpenseType = "single" | "installment" | "recurring";

export interface CreditCard {
  id: string; user_id: string; name: string; bank: string; flag: CardFlag;
  limit_total: number; closing_day: number; due_day: number; active: boolean;
  is_default?: boolean; created_at: string;
}
export interface Invoice {
  id: string; user_id: string; card_id: string; competence: string;
  closing_date: string; due_date: string; total_amount: number;
  status: InvoiceStatus; transaction_id: string | null; created_at: string;
}
export interface CardExpense {
  id: string; user_id: string; card_id: string; invoice_id: string;
  category: string; description: string; amount: number; purchase_date: string;
  installments_total: number; installment_number: number;
  expense_type: ExpenseType; observations?: string; created_at: string;
}
export interface CardInstallment {
  id: string; user_id: string; card_id: string; invoice_id: string;
  parent_expense_id: string; description: string; category: string;
  amount: number; installment_number: number; installments_total: number;
  purchase_date: string; created_at: string;
}

function competenceToSortKey(c: string): string {
  const [mm, yyyy] = c.split("/");
  return `${yyyy}-${mm}`;
}
function sortByCompetence(a: Invoice, b: Invoice): number {
  return competenceToSortKey(a.competence).localeCompare(competenceToSortKey(b.competence));
}
function buildInvoiceDates(card: CreditCard, ref: Date) {
  const competence = format(ref, "MM/yyyy");
  const closingDate = setDate(ref, card.closing_day);
  let dueDate = setDate(ref, card.due_day);
  if (card.due_day <= card.closing_day) dueDate = setDate(addMonths(ref, 1), card.due_day);
  return { competence, closing_date: format(closingDate, "yyyy-MM-dd"), due_date: format(dueDate, "yyyy-MM-dd") };
}
export function resolveInvoiceForDate(purchaseDate: string, invoices: Invoice[], card: CreditCard): Invoice | null {
  const date = parseISO(purchaseDate);
  const current = invoices.find(inv => inv.card_id === card.id && inv.status === "open" && isAfter(parseISO(inv.closing_date), date));
  if (current) return current;
  return invoices.filter(inv => inv.card_id === card.id && inv.status === "open").sort(sortByCompetence)[0] ?? null;
}
function toTransactionDate(iso: string): string {
  const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`;
}

interface CardStore {
  cards: CreditCard[]; invoices: Invoice[]; expenses: CardExpense[];
  installments: CardInstallment[]; loading: boolean;
  fetchCards: () => Promise<void>;
  closeExpiredInvoices: () => Promise<void>;
  addCard: (c: Omit<CreditCard, "id"|"user_id"|"created_at">) => Promise<void>;
  updateCard: (id: string, d: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  setDefaultCard: (id: string) => Promise<void>;
  fetchInvoices: (cardId: string) => Promise<void>;
  ensureInvoices: (card: CreditCard) => Promise<Invoice[]>;
  payInvoice: (invoiceId: string, card: CreditCard) => Promise<void>;
  reverseInvoice: (invoiceId: string) => Promise<void>;
  fetchExpenses: (invoiceId: string) => Promise<void>;
  fetchInstallments: (invoiceId: string) => Promise<void>;
  addExpense: (e: { card: CreditCard; invoiceId: string; category: string; description: string; amount: number; purchaseDate: string; installments: number; isRecurring: boolean; observations?: string }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, patch: Partial<Pick<CardExpense, "description"|"category"|"amount"|"purchase_date">>) => Promise<void>;
  updateInstallment: (id: string, invoiceId: string, patch: Partial<Pick<CardInstallment, "description"|"category"|"amount"|"purchase_date">>) => Promise<void>;
  deleteInstallment: (id: string, invoiceId: string) => Promise<void>;
  getCardInvoices: (cardId: string) => Invoice[];
  getInvoiceExpenses: (invoiceId: string) => CardExpense[];
  getInvoiceInstallments: (invoiceId: string) => CardInstallment[];
  getCardLimitUsed: (cardId: string) => Promise<number>;
  recalcInvoiceTotal: (invoiceId: string) => Promise<void>;
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [], invoices: [], expenses: [], installments: [], loading: false,

  // ── Fechar faturas cujo closing_date chegou ──────────────────────────
  closeExpiredInvoices: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: closed, error } = await supabase
      .from("invoices")
      .update({ status: "closed" })
      .eq("status", "open")
      .lte("closing_date", today)   // closing_date <= hoje = fatura fechada
      .select("id");
    if (!error && closed && closed.length > 0) {
      const ids = new Set(closed.map(r => r.id));
      set(s => ({
        invoices: s.invoices.map(inv =>
          ids.has(inv.id) ? { ...inv, status: "closed" as const } : inv
        ),
      }));
    }
  },

  fetchCards: async () => {
    set({ loading: true });
    const { data } = await supabase.from("credit_cards").select("*").order("created_at", { ascending: true });
    set({ cards: data ?? [], loading: false });
    // Verificar e fechar faturas expiradas ao carregar cartões
    await get().closeExpiredInvoices();
  },

  setDefaultCard: async (id) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    await supabase.from("credit_cards").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("credit_cards").update({ is_default: true }).eq("id", id);
    set(s => ({ cards: s.cards.map(c => ({ ...c, is_default: c.id === id })) }));
  },

  addCard: async (card) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const isFirst = get().cards.filter(c => c.active).length === 0;
    const { data, error } = await supabase.from("credit_cards").insert({ ...card, user_id: user.id, is_default: isFirst }).select().single();
    if (error || !data) return;
    set(s => ({ cards: [...s.cards, data] }));
    await get().ensureInvoices(data);
  },

  updateCard: async (id, data) => {
    await supabase.from("credit_cards").update(data).eq("id", id);
    set(s => ({ cards: s.cards.map(c => c.id === id ? { ...c, ...data } : c) }));
  },
  deleteCard: async (id) => {
    await supabase.from("credit_cards").delete().eq("id", id);
    set(s => ({ cards: s.cards.filter(c => c.id !== id) }));
  },

  fetchInvoices: async (cardId) => {
    const { data } = await supabase.from("invoices").select("*").eq("card_id", cardId).order("closing_date", { ascending: true });
    set(s => ({ invoices: [...s.invoices.filter(i => i.card_id !== cardId), ...(data ?? [])] }));
    // Fechar faturas expiradas ao atualizar lista de invoices
    await get().closeExpiredInvoices();
  },
  ensureInvoices: async (card) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return [];
    const { data: existing } = await supabase.from("invoices").select("competence").eq("card_id", card.id);
    const existingSet = new Set((existing ?? []).map(i => i.competence));
    const now = new Date(); const toInsert: Omit<Invoice, "id"|"created_at">[] = [];
    for (let i = 0; i < 12; i++) {
      const ref = addMonths(now, i);
      const { competence, closing_date, due_date } = buildInvoiceDates(card, ref);
      if (!existingSet.has(competence)) toInsert.push({ user_id: user.id, card_id: card.id, competence, closing_date, due_date, total_amount: 0, status: "open", transaction_id: null });
    }
    if (toInsert.length > 0) await supabase.from("invoices").insert(toInsert);
    await get().fetchInvoices(card.id);
    return get().invoices.filter(i => i.card_id === card.id);
  },

  payInvoice: async (invoiceId, card) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const invoice = get().invoices.find(i => i.id === invoiceId); if (!invoice) return;

    let txId: string | null = null;

    // Só cria transação se a fatura tiver valor (> 0)
    // Fatura zerada: apenas atualiza status, sem gerar lançamento R$ 0,00
    if (invoice.total_amount > 0) {
      const { addTransaction } = await import("./transactions-store");
      await addTransaction({
        title: `Fatura ${card.name} – ${invoice.competence}`,
        amount: invoice.total_amount,
        type: "expense",
        date: toTransactionDate(invoice.due_date),
        category: "Cartão de Crédito",
        settled: true,
        paidAt: toTransactionDate(format(new Date(), "yyyy-MM-dd")),
        recurring: false,
      });
      const { data: txRow } = await supabase
        .from("transactions").select("id")
        .eq("user_id", user.id)
        .eq("category", "Cartão de Crédito")
        .eq("title", `Fatura ${card.name} – ${invoice.competence}`)
        .order("created_at", { ascending: false }).limit(1).single();
      txId = txRow?.id ?? null;
    }

    await supabase.from("invoices")
      .update({ status: "paid", transaction_id: txId }).eq("id", invoiceId);
    set(s => ({
      invoices: s.invoices.map(i =>
        i.id === invoiceId ? { ...i, status: "paid", transaction_id: txId } : i
      ),
    }));
  },

  reverseInvoice: async (invoiceId) => {
    const invoice = get().invoices.find(i => i.id === invoiceId);
    if (!invoice || invoice.status !== "paid") return;
    if (invoice.transaction_id) { const { deleteTransaction } = await import("./transactions-store"); await deleteTransaction(invoice.transaction_id); }
    await supabase.from("invoices").update({ status: "open", transaction_id: null }).eq("id", invoiceId);
    set(s => ({ invoices: s.invoices.map(i => i.id === invoiceId ? { ...i, status: "open", transaction_id: null } : i) }));
  },

  fetchExpenses: async (invoiceId) => {
    const { data } = await supabase.from("card_expenses").select("*").eq("invoice_id", invoiceId).order("purchase_date", { ascending: false });
    set(s => ({ expenses: [...s.expenses.filter(e => e.invoice_id !== invoiceId), ...(data ?? [])] }));
  },
  fetchInstallments: async (invoiceId) => {
    const { data } = await supabase.from("card_installments").select("*").eq("invoice_id", invoiceId).order("installment_number", { ascending: true });
    set(s => ({ installments: [...s.installments.filter(i => i.invoice_id !== invoiceId), ...(data ?? [])] }));
  },
  recalcInvoiceTotal: async (invoiceId) => {
    const { data: expData } = await supabase.from("card_expenses").select("amount").eq("invoice_id", invoiceId);
    const { data: instData } = await supabase.from("card_installments").select("amount").eq("invoice_id", invoiceId);
    const total = (expData ?? []).reduce((s, e) => s + e.amount, 0) + (instData ?? []).reduce((s, i) => s + i.amount, 0);
    await supabase.from("invoices").update({ total_amount: total }).eq("id", invoiceId);
    set(s => ({ invoices: s.invoices.map(inv => inv.id === invoiceId ? { ...inv, total_amount: total } : inv) }));
  },

  addExpense: async ({ card, invoiceId, category, description, amount, purchaseDate, installments, isRecurring, observations }) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const allInvoices = get().invoices.filter(i => i.card_id === card.id && i.status === "open").sort(sortByCompetence);
    if (isRecurring) {
      const rows = allInvoices.slice(0, 12).map((inv, idx) => ({ user_id: user.id, card_id: card.id, invoice_id: inv.id, category, description, amount, purchase_date: purchaseDate, installments_total: 1, installment_number: idx + 1, expense_type: "recurring" as ExpenseType, observations }));
      const { data } = await supabase.from("card_expenses").insert(rows).select();
      if (data) set(s => ({ expenses: [...s.expenses, ...data] }));
      for (const inv of allInvoices.slice(0, 12)) await get().recalcInvoiceTotal(inv.id);
    } else if (installments > 1) {
      const instAmt = Math.round((amount / installments) * 100) / 100;
      const startIdx = allInvoices.findIndex(i => i.id === invoiceId);
      const { data: parent } = await supabase.from("card_expenses").insert({ user_id: user.id, card_id: card.id, invoice_id: invoiceId, category, description: `${description} 1/${installments}`, amount: instAmt, purchase_date: purchaseDate, installments_total: installments, installment_number: 1, expense_type: "installment" as ExpenseType, observations }).select().single();
      if (!parent) return;
      set(s => ({ expenses: [...s.expenses, parent] }));
      await get().recalcInvoiceTotal(invoiceId);
      const remaining = [];
      for (let i = 1; i < installments; i++) {
        const target = allInvoices[startIdx + i]; if (!target) break;
        remaining.push({ user_id: user.id, card_id: card.id, invoice_id: target.id, parent_expense_id: parent.id, description: `${description} ${i + 1}/${installments}`, category, amount: instAmt, installment_number: i + 1, installments_total: installments, purchase_date: purchaseDate });
      }
      if (remaining.length > 0) {
        const { data: instData } = await supabase.from("card_installments").insert(remaining).select();
        if (instData) { set(s => ({ installments: [...s.installments, ...instData] })); const ids = [...new Set(remaining.map(r => r.invoice_id))]; for (const id of ids) await get().recalcInvoiceTotal(id); }
      }
    } else {
      const { data } = await supabase.from("card_expenses").insert({ user_id: user.id, card_id: card.id, invoice_id: invoiceId, category, description, amount, purchase_date: purchaseDate, installments_total: 1, installment_number: 1, expense_type: "single" as ExpenseType, observations }).select().single();
      if (data) set(s => ({ expenses: [...s.expenses, data] }));
      await get().recalcInvoiceTotal(invoiceId);
    }
  },

  updateExpense: async (id, patch) => {
    const expense = get().expenses.find(e => e.id === id);
    if (!expense) return;
    await supabase.from("card_expenses").update(patch).eq("id", id);
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...patch } : e) }));
    await get().recalcInvoiceTotal(expense.invoice_id);
  },
  updateInstallment: async (id, invoiceId, patch) => {
    await supabase.from("card_installments").update(patch).eq("id", id);
    set(s => ({ installments: s.installments.map(i => i.id === id ? { ...i, ...patch } : i) }));
    await get().recalcInvoiceTotal(invoiceId);
  },
  deleteInstallment: async (id, invoiceId) => {
    await supabase.from("card_installments").delete().eq("id", id);
    set(s => ({ installments: s.installments.filter(i => i.id !== id) }));
    await get().recalcInvoiceTotal(invoiceId);
  },
  deleteExpense: async (expenseId) => {
    const expense = get().expenses.find(e => e.id === expenseId);
    await supabase.from("card_expenses").delete().eq("id", expenseId);
    if (expense?.expense_type === "installment") await supabase.from("card_installments").delete().eq("parent_expense_id", expenseId);
    set(s => ({ expenses: s.expenses.filter(e => e.id !== expenseId) }));
    if (expense) await get().recalcInvoiceTotal(expense.invoice_id);
  },

  getCardInvoices: (cardId) => get().invoices.filter(i => i.card_id === cardId).sort(sortByCompetence),
  getInvoiceExpenses: (invoiceId) => get().expenses.filter(e => e.invoice_id === invoiceId),
  getInvoiceInstallments: (invoiceId) => get().installments.filter(i => i.invoice_id === invoiceId),

  getCardLimitUsed: async (cardId) => {
    const today = startOfDay(new Date());
    const invoices = get().invoices.filter(i => i.card_id === cardId && i.status !== "paid");
    let total = 0;
    for (const inv of invoices) {
      const closing = startOfDay(parseISO(inv.closing_date));
      if (isAfter(closing, today)) { total += inv.total_amount; }
      else {
        const { data: inst } = await supabase.from("card_installments").select("amount").eq("invoice_id", inv.id);
        total += (inst ?? []).reduce((s, i) => s + i.amount, 0);
        const { data: exp } = await supabase.from("card_expenses").select("amount, expense_type").eq("invoice_id", inv.id).neq("expense_type", "recurring");
        total += (exp ?? []).reduce((s, e) => s + e.amount, 0);
      }
    }
    return total;
  },
}));
