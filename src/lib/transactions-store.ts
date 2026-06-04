import { useSyncExternalStore } from "react";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number; // positive for income, negative for expense
  type: TransactionType;
  date: string; // dd/mm/yyyy
  category: string;
  settled: boolean; // paid (expense) / received (income)
  paidAt?: string; // dd/mm/yyyy — date when settled was set to true
  recurring?: boolean; // recurring / repeating transaction
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

function getRecurringKey(transaction: Transaction) {
  return [
    transaction.title.trim().toLowerCase(),
    transaction.category.trim().toLowerCase(),
    transaction.type,
    transaction.amount,
  ].join("|");
}

function normalizeTransactions(items: Transaction[]): Transaction[] {
  const counts = new Map<string, number>();

  items.forEach((transaction) => {
    const key = getRecurringKey(transaction);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return items.map((transaction) => {
    if (typeof transaction.recurring === "boolean") return transaction;

    return {
      ...transaction,
      recurring: (counts.get(getRecurringKey(transaction)) ?? 0) > 1,
    };
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
  } catch {
    return SEED;
  }
}

function persist() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      /* ignore quota errors */
    }
  }
  listeners.forEach((l) => l());
}



function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTransactions(): Transaction[] {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => SEED,
  );
}

export function addTransaction(t: Omit<Transaction, "id">) {
  cache = [...cache, { ...t, id: crypto.randomUUID() }];
  persist();
}

export function addTransactions(items: Omit<Transaction, "id">[]) {
  cache = [...cache, ...items.map((t) => ({ ...t, id: crypto.randomUUID() }))];
  persist();
}



export function toggleSettled(id: string) {
  const todayStr = formatBrDate(new Date());
  cache = cache.map((t) => {
    if (t.id !== id) return t;
    const nextSettled = !t.settled;
    return {
      ...t,
      settled: nextSettled,
      paidAt: nextSettled ? (t.paidAt ?? todayStr) : undefined,
    };
  });
  persist();
}

export function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t));
  persist();
}

export function deleteTransaction(id: string) {
  cache = cache.filter((t) => t.id !== id);
  persist();
}

/** Parse dd/mm/yyyy → Date at local midnight */
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

/** Whether a yyyy-mm-dd ISO date is today or in the past (local time) */
export function isTodayOrPast(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}
