import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "./supabase";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  date: string; // dd/mm/yyyy
  category: string;
  settled: boolean;
  paidAt?: string;
  recurring?: boolean;
  source?: string; // "manual" | "invoice" — transações de fatura não podem ser editadas
};

let cache: Transaction[] = [];
let initialized = false;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    title: row.title as string,
    amount: row.amount as number,
    type: row.type as TransactionType,
    date: row.date as string,
    category: row.category as string,
    settled: row.settled as boolean,
    paidAt: (row.paid_at as string | null) ?? undefined,
    recurring: (row.recurring as boolean | null) ?? false,
    source: (row.source as string | null) ?? "manual",
  };
}

async function loadFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (initialized && currentUserId === user.id) return;
  const { data, error } = await supabase
    .from("transactions").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (!error && data) {
    cache = data.map(mapRow);
    initialized = true;
    currentUserId = user.id;
    notify();
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { cache = []; initialized = false; currentUserId = null; notify(); }
});

export function useTransactions(): Transaction[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subscribe, () => cache, () => []);
}

export async function addTransaction(t: Omit<Transaction, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const newItem: Transaction = { ...t, id: crypto.randomUUID() };
  cache = [newItem, ...cache];
  notify();
  await supabase.from("transactions").insert([{
    id: newItem.id, user_id: user.id,
    title: t.title, amount: t.amount, type: t.type,
    date: t.date, category: t.category,
    settled: t.settled, paid_at: t.paidAt ?? null,
    recurring: t.recurring ?? false,
    source: t.source ?? "manual",
  }]);
}

export async function addTransactions(items: Omit<Transaction, "id">[]) {
  for (const item of items) await addTransaction(item);
}

export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>) {
  cache = cache.map(t => t.id === id ? { ...t, ...patch } : t);
  notify();
  await supabase.from("transactions").update({
    title: patch.title, amount: patch.amount, type: patch.type,
    date: patch.date, category: patch.category,
    settled: patch.settled, paid_at: patch.paidAt ?? null,
    recurring: patch.recurring,
  }).eq("id", id);
}

export async function toggleSettled(id: string) {
  const todayStr = formatBrDate(new Date());
  const transaction = cache.find(t => t.id === id);
  if (!transaction) return;
  const nextSettled = !transaction.settled;
  const paidAt = nextSettled ? (transaction.paidAt ?? todayStr) : undefined;
  cache = cache.map(t => t.id === id ? { ...t, settled: nextSettled, paidAt } : t);
  notify();
  await supabase.from("transactions").update({ settled: nextSettled, paid_at: paidAt ?? null }).eq("id", id);
}

export async function deleteTransaction(id: string) {
  cache = cache.filter(t => t.id !== id);
  notify();
  await supabase.from("transactions").delete().eq("id", id);
}

export function parseBrDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export function formatBrDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

export function isTodayOrPast(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  return date.getTime() <= today.getTime();
}
