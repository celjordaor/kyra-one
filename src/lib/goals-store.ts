import { useSyncExternalStore } from "react";

export type Budget = {
  id: string;
  category: string; // expense category name
  limit: number;
  period: "Mensal";
};

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string; // yyyy-mm
  createdAt: string; // yyyy-mm-dd
};

export type GoalContribution = {
  id: string;
  goalId: string;
  amount: number;
  date: string; // yyyy-mm-dd
  note?: string;
};

const BUDGETS_KEY = "finance.budgets.v1";
const GOALS_KEY = "finance.goals.v1";
const CONTRIB_KEY = "finance.goal-contribs.v1";

const SEED_BUDGETS: Budget[] = [
  { id: "b1", category: "Alimentação", limit: 1200, period: "Mensal" },
  { id: "b2", category: "Transporte", limit: 400, period: "Mensal" },
  { id: "b3", category: "Entretenimento", limit: 200, period: "Mensal" },
  { id: "b4", category: "Moradia", limit: 1800, period: "Mensal" },
];

const SEED_GOALS: Goal[] = [
  { id: "g1", name: "Reserva de Emergência", target: 15000, current: 6200, deadline: "2025-12", createdAt: "2025-01-01" },
  { id: "g2", name: "Viagem para o Nordeste", target: 5000, current: 1800, deadline: "2026-07", createdAt: "2025-03-01" },
  { id: "g3", name: "Novo Notebook", target: 6000, current: 2400, deadline: "2026-03", createdAt: "2025-02-01" },
];

let budgets: Budget[] = loadList(BUDGETS_KEY, SEED_BUDGETS);
let goals: Goal[] = loadList(GOALS_KEY, SEED_GOALS);
let contributions: GoalContribution[] = loadList(CONTRIB_KEY, []);

const bListeners = new Set<() => void>();
const gListeners = new Set<() => void>();
const cListeners = new Set<() => void>();

function loadList<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed;
    return parsed;
  } catch {
    return seed;
  }
}

function persist<T>(key: string, val: T[], set: Set<() => void>) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }
  set.forEach((l) => l());
}

export function useBudgets(): Budget[] {
  return useSyncExternalStore(
    (cb) => {
      bListeners.add(cb);
      return () => bListeners.delete(cb);
    },
    () => budgets,
    () => SEED_BUDGETS,
  );
}

export function useGoals(): Goal[] {
  return useSyncExternalStore(
    (cb) => {
      gListeners.add(cb);
      return () => gListeners.delete(cb);
    },
    () => goals,
    () => SEED_GOALS,
  );
}

export function useGoalContributions(): GoalContribution[] {
  return useSyncExternalStore(
    (cb) => {
      cListeners.add(cb);
      return () => cListeners.delete(cb);
    },
    () => contributions,
    () => [],
  );
}

// Budgets
export function addBudget(b: Omit<Budget, "id">) {
  budgets = [...budgets, { ...b, id: crypto.randomUUID() }];
  persist(BUDGETS_KEY, budgets, bListeners);
}
export function updateBudget(id: string, patch: Partial<Omit<Budget, "id">>) {
  budgets = budgets.map((b) => (b.id === id ? { ...b, ...patch } : b));
  persist(BUDGETS_KEY, budgets, bListeners);
}
export function deleteBudget(id: string) {
  budgets = budgets.filter((b) => b.id !== id);
  persist(BUDGETS_KEY, budgets, bListeners);
}

// Goals
export function addGoal(g: Omit<Goal, "id" | "createdAt" | "current"> & { current?: number }) {
  const today = new Date().toISOString().slice(0, 10);
  goals = [
    ...goals,
    { ...g, current: g.current ?? 0, id: crypto.randomUUID(), createdAt: today },
  ];
  persist(GOALS_KEY, goals, gListeners);
}
export function updateGoal(id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) {
  goals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
  persist(GOALS_KEY, goals, gListeners);
}
export function deleteGoal(id: string) {
  goals = goals.filter((g) => g.id !== id);
  contributions = contributions.filter((c) => c.goalId !== id);
  persist(GOALS_KEY, goals, gListeners);
  persist(CONTRIB_KEY, contributions, cListeners);
}

// Contributions
export function addContribution(c: Omit<GoalContribution, "id">) {
  contributions = [...contributions, { ...c, id: crypto.randomUUID() }];
  goals = goals.map((g) => (g.id === c.goalId ? { ...g, current: g.current + c.amount } : g));
  persist(CONTRIB_KEY, contributions, cListeners);
  persist(GOALS_KEY, goals, gListeners);
}
export function deleteContribution(id: string) {
  const c = contributions.find((x) => x.id === id);
  if (!c) return;
  contributions = contributions.filter((x) => x.id !== id);
  goals = goals.map((g) => (g.id === c.goalId ? { ...g, current: Math.max(0, g.current - c.amount) } : g));
  persist(CONTRIB_KEY, contributions, cListeners);
  persist(GOALS_KEY, goals, gListeners);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDeadline(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[m - 1]} ${y}`;
}
