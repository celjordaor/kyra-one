import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "./supabase";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;           // positivo = receita, negativo = despesa
  type: TransactionType;
  date: string;             // dd/mm/yyyy
  category: string;
  settled: boolean;
  paidAt?: string;          // dd/mm/yyyy
  recurring?: boolean;
  source?: string;          // "manual" | "invoice"
  // ── Campos de série (Repetir N meses) ─────────────────────────────
  installment_number?: number;  // 1, 2, 3 ...
  installments_total?: number;  // total de parcelas
  recurrence_id?: string;       // UUID que agrupa a série
};

// ── Cache em memória ──────────────────────────────────────────────────────
let cache: Transaction[]    = [];
let initialized             = false;
let currentUserId: string | null = null;
const listeners             = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ── Mapeamento de linha do Supabase → Transaction ─────────────────────────
function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id:                  row.id                  as string,
    title:               row.title               as string,
    amount:              row.amount              as number,
    type:                row.type                as TransactionType,
    date:                row.date                as string,
    category:            row.category            as string,
    settled:             row.settled             as boolean,
    paidAt:              (row.paid_at            as string | null) ?? undefined,
    recurring:           (row.recurring          as boolean | null) ?? false,
    source:              (row.source             as string | null) ?? undefined,
    installment_number:  (row.installment_number as number | null) ?? undefined,
    installments_total:  (row.installments_total as number | null) ?? undefined,
    recurrence_id:       (row.recurrence_id      as string | null) ?? undefined,
  };
}

// ── Carregamento do Supabase ──────────────────────────────────────────────
async function loadFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (initialized && currentUserId === user.id) return;

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!error && data) {
    cache         = data.map(mapRow);
    initialized   = true;
    currentUserId = user.id;
    notify();
  }
}

// Recarrega quando o usuário muda
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    cache         = [];
    initialized   = false;
    currentUserId = null;
    notify();
  }
  if (event === "SIGNED_IN") {
    initialized = false;   // força reload na próxima chamada
    loadFromSupabase();
  }
});

// ── Hook principal ────────────────────────────────────────────────────────
export function useTransactions(): Transaction[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subscribe, () => cache, () => []);
}

// ── Forçar recarregamento (útil após criação em lote) ─────────────────────
export async function refreshTransactions() {
  initialized = false;
  await loadFromSupabase();
}

// ── Adicionar transação única ─────────────────────────────────────────────
export async function addTransaction(t: Omit<Transaction, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const newItem: Transaction = { ...t, id: crypto.randomUUID() };
  cache = [newItem, ...cache];
  notify();

  await supabase.from("transactions").insert([{
    id:                  newItem.id,
    user_id:             user.id,
    title:               t.title,
    amount:              t.amount,
    type:                t.type,
    date:                t.date,
    category:            t.category,
    settled:             t.settled,
    paid_at:             t.paidAt              ?? null,
    recurring:           t.recurring           ?? false,
    source:              t.source              ?? "manual",
    installment_number:  t.installment_number  ?? null,
    installments_total:  t.installments_total  ?? null,
    recurrence_id:       t.recurrence_id       ?? null,
  }]);
}

// ── Adicionar múltiplas transações (série parcelada / recorrente) ──────────
export async function addTransactions(items: Omit<Transaction, "id">[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows = items.map(t => ({
    id:                  crypto.randomUUID(),
    user_id:             user.id,
    title:               t.title,
    amount:              t.amount,
    type:                t.type,
    date:                t.date,
    category:            t.category,
    settled:             t.settled,
    paid_at:             t.paidAt              ?? null,
    recurring:           t.recurring           ?? false,
    source:              t.source              ?? "manual",
    installment_number:  t.installment_number  ?? null,
    installments_total:  t.installments_total  ?? null,
    recurrence_id:       t.recurrence_id       ?? null,
  }));

  // Atualiza cache otimisticamente
  cache = [...rows.map(r => mapRow(r as Record<string, unknown>)), ...cache];
  notify();

  // Persiste no Supabase
  await supabase.from("transactions").insert(rows);
}

// ── Atualizar transação ───────────────────────────────────────────────────
export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  cache = cache.map(t => (t.id === id ? { ...t, ...patch } : t));
  notify();

  const update: Record<string, unknown> = {};
  if (patch.title               !== undefined) update.title               = patch.title;
  if (patch.amount              !== undefined) update.amount              = patch.amount;
  if (patch.type                !== undefined) update.type                = patch.type;
  if (patch.date                !== undefined) update.date                = patch.date;
  if (patch.category            !== undefined) update.category            = patch.category;
  if (patch.settled             !== undefined) update.settled             = patch.settled;
  if (patch.paidAt              !== undefined) update.paid_at             = patch.paidAt ?? null;
  if (patch.recurring           !== undefined) update.recurring           = patch.recurring;
  if (patch.installment_number  !== undefined) update.installment_number  = patch.installment_number;
  if (patch.installments_total  !== undefined) update.installments_total  = patch.installments_total;
  if (patch.recurrence_id       !== undefined) update.recurrence_id       = patch.recurrence_id;

  await supabase.from("transactions").update(update).eq("id", id);
}

// ── Marcar como pago/recebido ─────────────────────────────────────────────
export async function toggleSettled(id: string) {
  const todayStr   = formatBrDate(new Date());
  const transaction = cache.find(t => t.id === id);
  if (!transaction) return;

  const nextSettled = !transaction.settled;
  const paidAt      = nextSettled ? (transaction.paidAt ?? todayStr) : undefined;

  cache = cache.map(t =>
    t.id === id ? { ...t, settled: nextSettled, paidAt } : t
  );
  notify();

  await supabase.from("transactions").update({
    settled:  nextSettled,
    paid_at:  paidAt ?? null,
  }).eq("id", id);
}

// ── Deletar transação única ───────────────────────────────────────────────
export async function deleteTransaction(id: string) {
  cache = cache.filter(t => t.id !== id);
  notify();
  await supabase.from("transactions").delete().eq("id", id);
}

// ── Deletar série a partir de uma parcela (inclusive) ────────────────────
export async function deleteTransactionSeries(
  recurrenceId: string,
  fromInstallment: number
) {
  // IDs a deletar
  const toDelete = cache
    .filter(t =>
      t.recurrence_id === recurrenceId &&
      (t.installment_number ?? 0) >= fromInstallment
    )
    .map(t => t.id);

  cache = cache.filter(t => !toDelete.includes(t.id));
  notify();

  await supabase
    .from("transactions")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .gte("installment_number", fromInstallment);
}

// ── Helpers de série ──────────────────────────────────────────────────────

/** Verifica se a transação pertence a uma série de N meses */
export function isInstallmentTransaction(t: Transaction): boolean {
  return !!(t.recurrence_id && t.installments_total && t.installments_total > 1);
}

/** Título de exibição — adiciona (N/M) para parcelas */
export function getDisplayTitle(t: Transaction): string {
  if (isInstallmentTransaction(t)) {
    return `${t.title} (${t.installment_number}/${t.installments_total})`;
  }
  return t.title;
}

/**
 * Calcula a data de uma parcela mantendo o dia original,
 * com cap no último dia do mês (ex: 31/jan → 28/fev em ano não-bissexto).
 */
export function calcInstallmentDate(
  baseYear: number,
  baseMonth: number,
  baseDay: number,
  offset: number
): Date {
  const targetTotal = baseMonth - 1 + offset;
  const targetYear  = baseYear + Math.floor(targetTotal / 12);
  const targetMonth = ((targetTotal % 12) + 12) % 12;
  const lastDay     = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(baseDay, lastDay));
}

// ── Utilitários de data ───────────────────────────────────────────────────

/** Parse dd/mm/yyyy → Date */
export function parseBrDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/** Date → dd/mm/yyyy */
export function formatBrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Verifica se uma data yyyy-mm-dd é hoje ou anterior */
export function isTodayOrPast(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}
