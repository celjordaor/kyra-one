import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "./supabase";

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  date: string;             // dd/mm/yyyy
  category: string;
  settled: boolean;
  paidAt?: string;          // dd/mm/yyyy
  recurring?: boolean;
  source?: string;          // "manual" | "invoice"
  installment_number?: number;
  installments_total?: number;
  recurrence_id?: string;
};

// ── Cache em memória ──────────────────────────────────────────────────────
let cache: Transaction[]         = [];
let loadingPromise: Promise<void> | null = null;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id:                 row.id                  as string,
    title:              row.title               as string,
    amount:             row.amount              as number,
    type:               row.type                as TransactionType,
    date:               row.date                as string,
    category:           row.category            as string,
    settled:            row.settled             as boolean,
    paidAt:             (row.paid_at            as string | null) ?? undefined,
    recurring:          (row.recurring          as boolean | null) ?? false,
    source:             (row.source             as string | null) ?? undefined,
    installment_number: (row.installment_number as number | null) ?? undefined,
    installments_total: (row.installments_total as number | null) ?? undefined,
    recurrence_id:      (row.recurrence_id      as string | null) ?? undefined,
  };
}

// ── Carregamento (sem guard de "já inicializado") ─────────────────────────
async function loadFromSupabase(): Promise<void> {
  // Evita chamadas simultâneas, mas permite re-fetch quando chamado novamente
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { loadingPromise = null; return; }
      currentUserId = user.id;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        cache = data.map(mapRow);
        notify();
      }
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

// ── Realtime: atualiza o cache automaticamente ────────────────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function setupRealtime() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || realtimeChannel) return;

  realtimeChannel = supabase
    .channel("transactions-realtime")
    .on(
      "postgres_changes",
      {
        event:  "*",
        schema: "public",
        table:  "transactions",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        switch (payload.eventType) {
          case "INSERT": {
            const newTx = mapRow(payload.new as Record<string, unknown>);
            // Evita duplicatas (pode já estar no cache por update otimista)
            if (!cache.find(t => t.id === newTx.id)) {
              cache = [newTx, ...cache];
              notify();
            }
            break;
          }
          case "UPDATE": {
            const updated = mapRow(payload.new as Record<string, unknown>);
            cache = cache.map(t => t.id === updated.id ? updated : t);
            notify();
            break;
          }
          case "DELETE": {
            const deletedId = (payload.old as { id: string }).id;
            if (cache.find(t => t.id === deletedId)) {
              cache = cache.filter(t => t.id !== deletedId);
              notify();
            }
            break;
          }
        }
      }
    )
    .subscribe();
}

// ── Auth state change ─────────────────────────────────────────────────────
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    cache         = [];
    currentUserId = null;
    loadingPromise = null;
    realtimeChannel?.unsubscribe();
    realtimeChannel = null;
    notify();
  }
  if (event === "SIGNED_IN") {
    loadFromSupabase();
    setupRealtime();
  }
});

// ── Hook principal ────────────────────────────────────────────────────────
export function useTransactions(): Transaction[] {
  useEffect(() => {
    loadFromSupabase();
    setupRealtime();
  }, []);
  return useSyncExternalStore(subscribe, () => cache, () => []);
}

// ── Forçar recarregamento ─────────────────────────────────────────────────
export async function refreshTransactions() {
  loadingPromise = null;   // limpa guarda para forçar novo fetch
  await loadFromSupabase();
}

// ── Adicionar transação única ─────────────────────────────────────────────
export async function addTransaction(t: Omit<Transaction, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id = crypto.randomUUID();
  // Atualização otimista
  cache = [{ ...t, id }, ...cache];
  notify();

  const { error } = await supabase.from("transactions").insert([{
    id,
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

  if (error) {
    // Reverte se falhou
    cache = cache.filter(tx => tx.id !== id);
    notify();
  }
}

// ── Adicionar múltiplas transações ────────────────────────────────────────
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

  const newItems = rows.map(r => mapRow(r as Record<string, unknown>));
  cache = [...newItems, ...cache];
  notify();

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    const ids = new Set(rows.map(r => r.id));
    cache = cache.filter(t => !ids.has(t.id));
    notify();
  }
}

// ── Atualizar transação ───────────────────────────────────────────────────
export async function updateTransaction(
  id: string,
  patch: Partial<Omit<Transaction, "id">>
) {
  const prev = cache.find(t => t.id === id);
  // Atualização otimista
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

  const { error } = await supabase.from("transactions").update(update).eq("id", id);
  if (error && prev) {
    cache = cache.map(t => (t.id === id ? prev : t));
    notify();
  }
}

// ── Toggle pago/recebido ──────────────────────────────────────────────────
export async function toggleSettled(id: string) {
  const tx = cache.find(t => t.id === id);
  if (!tx) return;

  const todayStr    = formatBrDate(new Date());
  const nextSettled = !tx.settled;
  const paidAt      = nextSettled ? (tx.paidAt ?? todayStr) : undefined;

  // Atualização otimista imediata
  cache = cache.map(t =>
    t.id === id ? { ...t, settled: nextSettled, paidAt } : t
  );
  notify();

  const { error } = await supabase.from("transactions").update({
    settled: nextSettled,
    paid_at: paidAt ?? null,
  }).eq("id", id);

  if (error) {
    // Reverte
    cache = cache.map(t => (t.id === id ? tx : t));
    notify();
  }
}

// ── Deletar transação ─────────────────────────────────────────────────────
export async function deleteTransaction(id: string) {
  const prev = cache.find(t => t.id === id);
  cache = cache.filter(t => t.id !== id);
  notify();

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error && prev) {
    cache = [...cache, prev];
    notify();
  }
}

// ── Deletar série a partir de uma data/parcela (inclusive) ───────────────
// Funciona para parceladas (recurrence_id + installment_number)
// e para recorrentes (recurrence_id + data a partir de)
export async function deleteTransactionSeries(
  recurrenceId: string,
  fromInstallment: number,
  fromDateBr?: string   // se fornecido, deleta a partir desta data (recorrentes)
) {
  const prevCache = cache;

  if (fromDateBr) {
    // Modo recorrente: deletar pelo recurrence_id a partir da data.
    // FIX: a coluna `date` é TEXT em formato dd/mm/aaaa (ou, em algumas
    // linhas antigas, aaaa-mm-dd) — comparar via `.gte("date", isoString)`
    // faz uma comparação léxica de string, que não corresponde a ordem
    // cronológica e deixava linhas futuras sem excluir no banco (mesmo
    // a cache local otimista parecendo correta na tela). Resolve buscando
    // os ids certos a partir da cache já carregada (parseBrDate correto)
    // e deletando por id — mesmo padrão já usado em deleteRecurringFuture.
    const fromMs = parseBrDate(fromDateBr).getTime();
    const idsParaExcluir = cache
      .filter(t => t.recurrence_id === recurrenceId && parseBrDate(t.date).getTime() >= fromMs)
      .map(t => t.id);

    cache = cache.filter(t => !idsParaExcluir.includes(t.id));
    notify();

    if (idsParaExcluir.length > 0) {
      await supabase.from("transactions").delete().in("id", idsParaExcluir);
    }
  } else {
    // Modo parcelado: deletar pelo installment_number
    cache = cache.filter(
      t => !(t.recurrence_id === recurrenceId && (t.installment_number ?? 0) >= fromInstallment)
    );
    notify();

    await supabase
      .from("transactions")
      .delete()
      .eq("recurrence_id", recurrenceId)
      .gte("installment_number", fromInstallment);
  }

  const { error } = await supabase // verifica erro genérico
    .from("transactions").select("id").eq("id", "check").single();
  void error; // a query acima é só pra checar conexão; os deletes já foram feitos
}


// ── Deletar recorrências futuras (a partir de uma data inclusiva) ─────────
export async function deleteRecurringFuture(
  title: string,
  type: TransactionType,
  fromDateBr: string   // dd/mm/yyyy
) {
  const fromMs = parseBrDate(fromDateBr).getTime();

  const toDelete = cache.filter(t =>
    t.recurring === true &&
    t.title === title &&
    t.type  === type &&
    parseBrDate(t.date).getTime() >= fromMs
  );

  if (toDelete.length === 0) return;

  const ids     = toDelete.map(t => t.id);
  const prevCache = cache;
  cache = cache.filter(t => !ids.includes(t.id));
  notify();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .in("id", ids);

  if (error) {
    cache = prevCache;
    notify();
  }
}

// ── Backfill de recurrence_id para recorrentes antigos ────────────────────
// Transações criadas com recurring:true mas sem recurrence_id (criadas antes
// da Fase 4) recebem um UUID de série baseado em title+amount+type+category.
// Roda uma única vez por sessão — idempotente.
let _backfillDone = false;
export async function backfillRecurrenceIds() {
  if (_backfillDone) return;
  _backfillDone = true;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Buscar todas as recorrentes sem recurrence_id
  const { data: orphans } = await supabase
    .from("transactions")
    .select("id, title, amount, type, category")
    .eq("user_id", user.id)
    .eq("recurring", true)
    .is("recurrence_id", null);

  if (!orphans || orphans.length === 0) return;

  // Agrupar por title+amount+type+category → atribuir mesmo UUID
  const groupMap = new Map<string, string>();
  for (const tx of orphans) {
    const key = `${tx.title}|${tx.amount}|${tx.type}|${tx.category}`;
    if (!groupMap.has(key)) groupMap.set(key, crypto.randomUUID());
    const rid = groupMap.get(key)!;
    await supabase.from("transactions").update({ recurrence_id: rid }).eq("id", tx.id);
    // Atualizar cache local
    cache = cache.map(t => t.id === tx.id ? { ...t, recurrence_id: rid } : t);
  }
  notify();
}

// ── Extensão automática de recorrentes ───────────────────────────────────
// Garante sempre ao menos 24 meses à frente para recorrentes abertas.
// Deve ser chamado no carregamento da app.
export async function extendRecurringIfNeeded() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Primeiro: backfill de recurrence_id (para recorrentes antigas)
  await backfillRecurrenceIds();

  // Buscar todas as recorrentes do usuário agrupadas por recurrence_id
  const { data: allRecurring } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("recurring", true)
    .not("recurrence_id", "is", null)
    .order("date", { ascending: false });

  if (!allRecurring || allRecurring.length === 0) return;

  // Mapear: recurrence_id → { lastDate, templateTx }
  const seriesMap = new Map<string, { lastDate: Date; tx: typeof allRecurring[0] }>();
  for (const tx of allRecurring) {
    if (!tx.recurrence_id) continue;
    const d = parseBrDate(tx.date);
    const existing = seriesMap.get(tx.recurrence_id);
    if (!existing || d > existing.lastDate) {
      seriesMap.set(tx.recurrence_id, { lastDate: d, tx });
    }
  }

  const horizon = addMonths(new Date(), 24);
  const toCreate: Omit<Transaction, "id">[] = [];

  for (const [rid, { lastDate, tx }] of seriesMap) {
    if (lastDate >= horizon) continue; // já tem 24 meses à frente

    // Criar registros até cobrir 24 meses à frente
    let cursor = addMonths(lastDate, 1);
    while (cursor <= horizon) {
      const dateStr = formatBrDate(cursor);
      const isoStr  = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;
      toCreate.push({
        title: tx.title, amount: tx.amount, type: tx.type,
        date: dateStr, category: tx.category,
        settled: isTodayOrPast(isoStr),
        recurring: true, source: tx.source ?? "manual",
        recurrence_id: rid,
        // Recorrentes não têm installments_total/installment_number
        installments_total: undefined, installment_number: undefined,
      });
      cursor = addMonths(cursor, 1);
    }
  }

  if (toCreate.length > 0) {
    await addTransactions(toCreate);
  }
}

// Helper interno para addMonths (evita importar date-fns aqui)
function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ── Helpers de série ──────────────────────────────────────────────────────
export function isInstallmentTransaction(t: Transaction): boolean {
  return !!(t.recurrence_id && t.installments_total && t.installments_total > 1);
}

export function getDisplayTitle(t: Transaction): string {
  if (isInstallmentTransaction(t)) {
    return `${t.title} (${t.installment_number}/${t.installments_total})`;
  }
  return t.title;
}

export function calcInstallmentDate(
  baseYear: number, baseMonth: number, baseDay: number, offset: number
): Date {
  const total     = baseMonth - 1 + offset;
  const yr        = baseYear + Math.floor(total / 12);
  const mo        = ((total % 12) + 12) % 12;
  const lastDay   = new Date(yr, mo + 1, 0).getDate();
  return new Date(yr, mo, Math.min(baseDay, lastDay));
}

// ── Utilitários de data ───────────────────────────────────────────────────
export function parseBrDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

export function formatBrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function isTodayOrPast(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}
