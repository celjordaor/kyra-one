import { useSyncExternalStore, useMemo } from "react";
import { supabase } from "./supabase";
import { useTransactions } from "./transactions-store";

export type AccountBalanceConfig = {
  initialBalance: number;
  enabled: boolean;
};

// ── Cache em memória (mesmo padrão de categories-store/goals-store) ───────
let cache: AccountBalanceConfig | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

async function loadFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { cache = null; initialized = true; notify(); return; }

  const { data, error } = await supabase
    .from("account_balance")
    .select("initial_balance, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[account-balance] erro ao carregar configuração:", error);
  }

  cache = data
    ? { initialBalance: Number(data.initial_balance) || 0, enabled: !!data.enabled }
    : { initialBalance: 0, enabled: false };

  initialized = true;
  notify();
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { cache = null; initialized = false; notify(); }
  if (event === "SIGNED_IN") { initialized = false; loadFromSupabase(); }
});

// ── Hook de configuração (saldo inicial + ligado/desligado) ───────────────
export function useAccountBalanceConfig(): { config: AccountBalanceConfig | null; loading: boolean } {
  if (typeof window !== "undefined" && !initialized) loadFromSupabase();
  const config = useSyncExternalStore(subscribe, () => cache, () => null);
  return { config, loading: !initialized };
}

// ── Salvar/atualizar configuração ──────────────────────────────────────────
export async function saveAccountBalance(patch: Partial<AccountBalanceConfig>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const next: AccountBalanceConfig = {
    initialBalance: patch.initialBalance ?? cache?.initialBalance ?? 0,
    enabled: patch.enabled ?? cache?.enabled ?? false,
  };

  // Atualização otimista
  const prev = cache;
  cache = next;
  notify();

  const { error } = await supabase.from("account_balance").upsert(
    {
      user_id: user.id,
      initial_balance: next.initialBalance,
      enabled: next.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[account-balance] erro ao salvar configuração:", error);
    cache = prev; // reverte
    notify();
    throw error;
  }
}

// ── Hook principal: saldo ATUAL da conta (calculado, não armazenado) ──────
//
// Fórmula: saldo_inicial + Σ(receitas efetivadas) − Σ(despesas efetivadas)
//
// "Efetivada" = transactions.settled === true, independente da data do
// lançamento (o que importa é o usuário ter marcado como paga/recebida).
//
// Usa Math.abs(amount) + campo `type` para decidir a direção — NÃO confia
// no sinal armazenado em `amount`, porque esse sinal não é consistente em
// todo o app (ex.: pagamento de fatura de cartão grava valor positivo com
// type="expense", enquanto o formulário de nova transação grava despesas
// como valor negativo). Mesma defesa que o dashboard já usa.
//
// Cobre automaticamente, sem código extra:
//  - Receita/despesa marcada como paga/recebida (toggleSettled)
//  - Receita/despesa "estornada" (toggleSettled de volta para pendente)
//  - Fatura de cartão paga (gera uma transação settled=true) e estornada
//    (a transação correspondente é excluída)
//  - Edição do valor de uma transação já efetivada
//  - Exclusão de uma transação já efetivada
export function useAccountBalance() {
  const { config, loading: loadingConfig } = useAccountBalanceConfig();
  const transactions = useTransactions();

  const currentBalance = useMemo(() => {
    const initial = config?.initialBalance ?? 0;
    let total = initial;
    for (const t of transactions) {
      if (!t.settled) continue;
      const amount = Math.abs(t.amount);
      if (t.type === "income") total += amount;
      else total -= amount;
    }
    return total;
  }, [config, transactions]);

  return {
    enabled: config?.enabled ?? false,
    initialBalance: config?.initialBalance ?? 0,
    currentBalance,
    loading: loadingConfig,
  };
}
