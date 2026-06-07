import { useSyncExternalStore } from "react";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;          // dd/mm/yyyy
  category: string;
  settled: boolean;
  paidAt?: string;       // dd/mm/yyyy
  recurring?: boolean;
  source?: string;       // "manual" | "invoice"
  // Campos de série (Repetir N meses)
  installment_number?: number;   // 1, 2, 3 ...
  installments_total?: number;   // total de parcelas
  recurrence_id?: string;        // UUID que agrupa a série
};

const STORAGE_KEY = "finance.transactions.v2";

const SEED: Transaction[] = [
  { id: "t1", title: "Salário", amount: 5200, type: "income", date: "02/06/2025", category: "Renda", settled: true, recurring: true },
  { id: "t2", title: "Supermercado Extra", amount: -342.5, type: "expense", date: "02/06/2025", category: "Alimentação", settled: true },
  { id: "t3", title: "Netflix", amount: -39.9, type: "expense", date: "01/06/2025", category: "Entretenimento", settled: true, recurring: true },
  { id: "t4", title: "Uber", amount: -24.8, type: "expense", date: "01/06/2025", category: "Transporte", settled: true },
  { id: "t5", title: "Freelance Design", amount: 800, type: "income", date: "31/05/2025", category: "Renda", settled: true },
  { id: "t6", title: "Conta de Luz", amount: -189.4, type: "expense", date: "30/05/2025", category: "Moradia", settled: false, recurring: true },
  { id: "t7", title: "Restaurante", amount: -127, type: "expense", date: "29/05/2025", category: "Alimentação", settled: true },
  { id: "t8", title: "Spotify", amount: -19.9, type: "expense", date: "28/05/2025", category: "Entretenimento", settled: true, recurring: true },
  { id: "t9", title: "Aluguel", amount: -1500, type: "expense", date: "28/05/2025", category: "Moradia", settled: true, recurring: true },
  { id: "t10", title: "Uber Eats", amount: -58.3, type: "expense", date: "27/05/2025", category: "Alimentação", settled: true },
];

let cache: Transaction[] = load();
const listeners = new Set<() => void>();

function getRecurringKey(t: Transaction) {
  return [t.title.trim().toLowerCase(), t.category.trim().toLowerCase(), t.type, t.amount].join("|");
}

function normalizeTransactions(items: Transaction[]): Transaction[] {
  const counts = new Map<string, number>();
  items.forEach(t => { const k = getRecurringKey(t); counts.set(k, (counts.get(k) ?? 0) + 1); });
  return items.map(t => {
    if (typeof t.recurring === "boolean") return t;
    return { ...t, recurring: (counts.get(getRecurringKey(t)) ?? 0) > 1 };
  });
}

function load(): Transaction[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Transaction[];
    if (!Array.isArray(parsed)) return SEED;
    return normalizeTransactions(parsed);
  } catch { return SEED; }
}

function persist() {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); }
    catch { /* ignore quota errors */ }
  }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTransactions(): Transaction[] {
  return useSyncExternalStore(subscribe, () => cache, () => SEED);
}

export function addTransaction(t: Omit<Transaction, "id">) {
  cache = [...cache, { ...t, id: crypto.randomUUID() }];
  persist();
}

export function addTransactions(items: Omit<Transaction, "id">[]) {
  cache = [...cache, ...items.map(t => ({ ...t, id: crypto.randomUUID() }))];
  persist();
}

export function toggleSettled(id: string) {
  const todayStr = formatBrDate(new Date());
  cache = cache.map(t => {
    if (t.id !== id) return t;
    const next = !t.settled;
    return { ...t, settled: next, paidAt: next ? (t.paidAt ?? todayStr) : undefined };
  });
  persist();
}

export function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  cache = cache.map(t => (t.id === id ? { ...t, ...patch } : t));
  persist();
}

export function deleteTransaction(id: string) {
  cache = cache.filter(t => t.id !== id);
  persist();
}

/** Exclui esta parcela e todas as seguintes da mesma série */
export function deleteTransactionSeries(recurrenceId: string, fromInstallment: number) {
  cache = cache.filter(t =>
    !(t.recurrence_id === recurrenceId && (t.installment_number ?? 0) >= fromInstallment)
  );
  persist();
}

/** Verifica se uma transação pertence a uma série de N meses */
export function isInstallmentTransaction(t: Transaction): boolean {
  return !!(t.recurrence_id && t.installments_total && t.installments_total > 1);
}

/** Título de exibição com sufixo (N/M) para série */
export function getDisplayTitle(t: Transaction): string {
  if (isInstallmentTransaction(t)) {
    return `${t.title} (${t.installment_number}/${t.installments_total})`;
  }
  return t.title;
}

/** Parse dd/mm/yyyy → Date */
export function parseBrDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/** Format Date → dd/mm/yyyy */
export function formatBrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Whether yyyy-mm-dd is today or in the past */
export function isTodayOrPast(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}

/** Calcula a data de uma parcela mantendo o dia original (trata overflow de mês) */
export function calcInstallmentDate(baseYear: number, baseMonth: number, baseDay: number, offset: number): Date {
  const targetTotalMonth = baseMonth - 1 + offset;
  const targetYear  = baseYear + Math.floor(targetTotalMonth / 12);
  const targetMonth = ((targetTotalMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(baseDay, lastDay));
}
