import { create } from "zustand";
import { supabase } from "./supabase";
import { addMonths, setDate, isAfter, format, parseISO } from "date-fns";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CardFlag = "Visa" | "Mastercard" | "Elo" | "Amex" | "Hipercard" | "Outro";
export type InvoiceStatus = "open" | "closed" | "paid";
export type ExpenseType = "single" | "installment" | "recurring";

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  bank: string;
  flag: CardFlag;
  limit_total: number;
  closing_day: number;
  due_day: number;
  active: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  card_id: string;
  competence: string; // "07/2026"
  closing_date: string;
  due_date: string;
  total_amount: number;
  status: InvoiceStatus;
  created_at: string;
}

export interface CardExpense {
  id: string;
  user_id: string;
  card_id: string;
  invoice_id: string;
  category: string;
  description: string;
  amount: number;
  purchase_date: string;
  installments_total: number;
  installment_number: number;
  expense_type: ExpenseType;
  observations?: string;
  created_at: string;
}

export interface CardInstallment {
  id: string;
  user_id: string;
  card_id: string;
  invoice_id: string;
  parent_expense_id: string;
  description: string;
  category: string;
  amount: number;
  installment_number: number;
  installments_total: number;
  purchase_date: string;
  created_at: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CardStore {
  cards: CreditCard[];
  invoices: Invoice[];
  expenses: CardExpense[];
  installments: CardInstallment[];
  loading: boolean;

  // Cartões
  fetchCards: () => Promise<void>;
  addCard: (card: Omit<CreditCard, "id" | "user_id" | "created_at">) => Promise<void>;
  updateCard: (id: string, data: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;

  // Faturas
  fetchInvoices: (cardId: string) => Promise<void>;
  ensureInvoices: (card: CreditCard) => Promise<Invoice[]>;
  payInvoice: (invoiceId: string, card: CreditCard) => Promise<void>;

  // Despesas
  fetchExpenses: (invoiceId: string) => Promise<void>;
  addExpense: (expense: {
    card: CreditCard;
    invoiceId: string;
    category: string;
    description: string;
    amount: number;
    purchaseDate: string;
    installments: number;
    isRecurring: boolean;
    observations?: string;
  }) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  // Helpers
  getCardInvoices: (cardId: string) => Invoice[];
  getInvoiceExpenses: (invoiceId: string) => CardExpense[];
  getCardLimitUsed: (cardId: string) => number;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function buildInvoiceDates(card: CreditCard, referenceDate: Date) {
  // Competência: mês/ano da fatura
  const competence = format(referenceDate, "MM/yyyy");

  // Data de fechamento: dia de fechamento no mês referência
  const closingDate = setDate(referenceDate, card.closing_day);

  // Data de vencimento: dia de vencimento — pode ser no mês seguinte
  let dueDate = setDate(referenceDate, card.due_day);
  if (card.due_day <= card.closing_day) {
    dueDate = setDate(addMonths(referenceDate, 1), card.due_day);
  }

  return {
    competence,
    closing_date: format(closingDate, "yyyy-MM-dd"),
    due_date: format(dueDate, "yyyy-MM-dd"),
  };
}

export function resolveInvoiceForDate(
  purchaseDate: string,
  invoices: Invoice[],
  card: CreditCard
): Invoice | null {
  const date = parseISO(purchaseDate);

  // Encontra fatura aberta cuja data de fechamento seja após a compra
  const current = invoices.find(
    (inv) =>
      inv.card_id === card.id &&
      inv.status === "open" &&
      isAfter(parseISO(inv.closing_date), date)
  );

  if (current) return current;

  // Caso contrário, próxima fatura futura
  const next = invoices
    .filter((inv) => inv.card_id === card.id && inv.status === "open")
    .sort((a, b) => a.competence.localeCompare(b.competence))[0];

  return next ?? null;
}

// ─── Implementação ────────────────────────────────────────────────────────────

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  invoices: [],
  expenses: [],
  installments: [],
  loading: false,

  // ── Cartões ────────────────────────────────────────────────────────────────

  fetchCards: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from("credit_cards")
      .select("*")
      .order("created_at", { ascending: true });
    set({ cards: data ?? [], loading: false });
  },

  addCard: async (card) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("credit_cards")
      .insert({ ...card, user_id: user.id })
      .select()
      .single();

    if (error || !data) return;

    set((s) => ({ cards: [...s.cards, data] }));

    // Gera as próximas 12 faturas automaticamente
    await get().ensureInvoices(data);
  },

  updateCard: async (id, data) => {
    await supabase.from("credit_cards").update(data).eq("id", id);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
  },

  deleteCard: async (id) => {
    await supabase.from("credit_cards").delete().eq("id", id);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },

  // ── Faturas ────────────────────────────────────────────────────────────────

  fetchInvoices: async (cardId) => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("card_id", cardId)
      .order("competence", { ascending: true });
    set((s) => ({
      invoices: [
        ...s.invoices.filter((i) => i.card_id !== cardId),
        ...(data ?? []),
      ],
    }));
  },

  ensureInvoices: async (card) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Verifica faturas já existentes
    const { data: existing } = await supabase
      .from("invoices")
      .select("competence")
      .eq("card_id", card.id);

    const existingCompetences = new Set((existing ?? []).map((i) => i.competence));

    const now = new Date();
    const toInsert: Omit<Invoice, "id" | "created_at">[] = [];

    for (let i = 0; i < 12; i++) {
      const ref = addMonths(now, i);
      const { competence, closing_date, due_date } = buildInvoiceDates(card, ref);

      if (!existingCompetences.has(competence)) {
        toInsert.push({
          user_id: user.id,
          card_id: card.id,
          competence,
          closing_date,
          due_date,
          total_amount: 0,
          status: "open",
        });
      }
    }

    if (toInsert.length === 0) {
      await get().fetchInvoices(card.id);
      return get().invoices.filter((i) => i.card_id === card.id);
    }

    const { data: inserted } = await supabase
      .from("invoices")
      .insert(toInsert)
      .select();

    set((s) => ({
      invoices: [...s.invoices, ...(inserted ?? [])],
    }));

    return get().invoices.filter((i) => i.card_id === card.id);
  },

  payInvoice: async (invoiceId, card) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const invoice = get().invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    // Atualiza status da fatura
    await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoiceId);

    // Registra movimentação na tabela transactions existente
    await supabase.from("transactions").insert({
      user_id: user.id,
      title: `Fatura ${card.name} – ${invoice.competence}`,
      amount: invoice.total_amount,
      type: "expense",
      date: invoice.due_date,
      category: "Cartão de Crédito",
      settled: true,
      paid_at: format(new Date(), "yyyy-MM-dd"),
    });

    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId ? { ...i, status: "paid" } : i
      ),
    }));
  },

  // ── Despesas ───────────────────────────────────────────────────────────────

  fetchExpenses: async (invoiceId) => {
    const { data } = await supabase
      .from("card_expenses")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("purchase_date", { ascending: false });
    set((s) => ({
      expenses: [
        ...s.expenses.filter((e) => e.invoice_id !== invoiceId),
        ...(data ?? []),
      ],
    }));
  },

  addExpense: async ({ card, invoiceId, category, description, amount, purchaseDate, installments, isRecurring, observations }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const allInvoices = get().invoices.filter((i) => i.card_id === card.id);

    if (isRecurring) {
      // Replica nas próximas 12 faturas abertas
      const openInvoices = allInvoices
        .filter((i) => i.status === "open")
        .sort((a, b) => a.competence.localeCompare(b.competence))
        .slice(0, 12);

      const rows = openInvoices.map((inv, idx) => ({
        user_id: user.id,
        card_id: card.id,
        invoice_id: inv.id,
        category,
        description,
        amount,
        purchase_date: purchaseDate,
        installments_total: 1,
        installment_number: idx + 1,
        expense_type: "recurring" as ExpenseType,
        observations,
      }));

      const { data } = await supabase.from("card_expenses").insert(rows).select();
      if (data) set((s) => ({ expenses: [...s.expenses, ...data] }));

    } else if (installments > 1) {
      // Compra parcelada: primeira parcela na fatura escolhida, demais nas seguintes
      const installmentAmount = Math.round((amount / installments) * 100) / 100;
      const startIndex = allInvoices.findIndex((i) => i.id === invoiceId);

      // Cria a despesa mãe (parcela 1)
      const { data: parent } = await supabase
        .from("card_expenses")
        .insert({
          user_id: user.id,
          card_id: card.id,
          invoice_id: invoiceId,
          category,
          description: `${description} 1/${installments}`,
          amount: installmentAmount,
          purchase_date: purchaseDate,
          installments_total: installments,
          installment_number: 1,
          expense_type: "installment" as ExpenseType,
          observations,
        })
        .select()
        .single();

      if (!parent) return;

      set((s) => ({ expenses: [...s.expenses, parent] }));

      // Cria as demais parcelas em card_installments
      const remainingInstallments = [];
      for (let i = 1; i < installments; i++) {
        const targetInvoice = allInvoices[startIndex + i];
        if (!targetInvoice) break;

        remainingInstallments.push({
          user_id: user.id,
          card_id: card.id,
          invoice_id: targetInvoice.id,
          parent_expense_id: parent.id,
          description: `${description} ${i + 1}/${installments}`,
          category,
          amount: installmentAmount,
          installment_number: i + 1,
          installments_total: installments,
          purchase_date: purchaseDate,
        });
      }

      if (remainingInstallments.length > 0) {
        const { data: instData } = await supabase
          .from("card_installments")
          .insert(remainingInstallments)
          .select();
        if (instData) set((s) => ({ installments: [...s.installments, ...instData] }));
      }

    } else {
      // Despesa simples (avulsa)
      const { data } = await supabase
        .from("card_expenses")
        .insert({
          user_id: user.id,
          card_id: card.id,
          invoice_id: invoiceId,
          category,
          description,
          amount,
          purchase_date: purchaseDate,
          installments_total: 1,
          installment_number: 1,
          expense_type: "single" as ExpenseType,
          observations,
        })
        .select()
        .single();

      if (data) set((s) => ({ expenses: [...s.expenses, data] }));
    }

    // Recalcula total da fatura
    const { data: allExpenses } = await supabase
      .from("card_expenses")
      .select("amount")
      .eq("invoice_id", invoiceId);

    const total = (allExpenses ?? []).reduce((sum, e) => sum + e.amount, 0);
    await supabase.from("invoices").update({ total_amount: total }).eq("id", invoiceId);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId ? { ...i, total_amount: total } : i
      ),
    }));
  },

  deleteExpense: async (expenseId) => {
    const expense = get().expenses.find((e) => e.id === expenseId);
    await supabase.from("card_expenses").delete().eq("id", expenseId);
    // Se parcelada, exclui as demais parcelas
    if (expense?.expense_type === "installment") {
      await supabase.from("card_installments").delete().eq("parent_expense_id", expenseId);
    }
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== expenseId) }));
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  getCardInvoices: (cardId) =>
    get().invoices
      .filter((i) => i.card_id === cardId)
      .sort((a, b) => a.competence.localeCompare(b.competence)),

  getInvoiceExpenses: (invoiceId) =>
    get().expenses.filter((e) => e.invoice_id === invoiceId),

  getCardLimitUsed: (cardId) => {
    const openInvoices = get().invoices.filter(
      (i) => i.card_id === cardId && i.status !== "paid"
    );
    const invoiceIds = new Set(openInvoices.map((i) => i.id));
    const expenseTotal = get()
      .expenses.filter((e) => invoiceIds.has(e.invoice_id))
      .reduce((sum, e) => sum + e.amount, 0);
    const installmentTotal = get()
      .installments.filter((i) => invoiceIds.has(i.invoice_id))
      .reduce((sum, i) => sum + i.amount, 0);
    return expenseTotal + installmentTotal;
  },
}));
