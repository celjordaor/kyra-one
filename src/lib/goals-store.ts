import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "./supabase";

export type Budget = {
  id: string;
  category: string;
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

let budgets: Budget[] = [];
let goals: Goal[] = [];
let contributions: GoalContribution[] = [];
let initialized = false;
let currentUserId: string | null = null;

const bListeners = new Set<() => void>();
const gListeners = new Set<() => void>();
const cListeners = new Set<() => void>();

const notifyB = () => bListeners.forEach((l) => l());
const notifyG = () => gListeners.forEach((l) => l());
const notifyC = () => cListeners.forEach((l) => l());

const subB = (cb: () => void) => { bListeners.add(cb); return () => bListeners.delete(cb); };
const subG = (cb: () => void) => { gListeners.add(cb); return () => gListeners.delete(cb); };
const subC = (cb: () => void) => { cListeners.add(cb); return () => cListeners.delete(cb); };

async function loadFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (initialized && currentUserId === user.id) return;

  const [bRes, gRes, cRes] = await Promise.all([
    supabase.from("budgets").select("*").eq("user_id", user.id),
    supabase.from("goals").select("*").eq("user_id", user.id),
    supabase.from("goal_contributions").select("*").eq("user_id", user.id),
  ]);

  if (!bRes.error) {
    budgets = (bRes.data ?? []).map((r) => ({
      id: r.id as string,
      category: r.category as string,
      limit: r.limit_amount as number,
      period: "Mensal" as const,
    }));
  }

  if (!gRes.error) {
    goals = (gRes.data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      target: r.target as number,
      current: r.current as number,
      deadline: r.deadline as string,
      createdAt: r.created_date as string,
    }));
  }

  if (!cRes.error) {
    contributions = (cRes.data ?? []).map((r) => ({
      id: r.id as string,
      goalId: r.goal_id as string,
      amount: r.amount as number,
      date: r.date as string,
      note: (r.note as string | null) ?? undefined,
    }));
  }

  initialized = true;
  currentUserId = user.id;
  notifyB(); notifyG(); notifyC();
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    budgets = []; goals = []; contributions = [];
    initialized = false; currentUserId = null;
    notifyB(); notifyG(); notifyC();
  }
});

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useBudgets(): Budget[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subB, () => budgets, () => []);
}

export function useGoals(): Goal[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subG, () => goals, () => []);
}

export function useGoalContributions(): GoalContribution[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subC, () => contributions, () => []);
}

// ── Budget mutations ───────────────────────────────────────────────────────

export async function addBudget(b: Omit<Budget, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const newBudget: Budget = { id: crypto.randomUUID(), ...b };
  budgets = [...budgets, newBudget];
  notifyB();

  await supabase.from("budgets").insert([{
    id: newBudget.id,
    user_id: user.id,
    category: b.category,
    limit_amount: b.limit,
    period: b.period,
  }]);
}

export async function updateBudget(id: string, patch: Partial<Omit<Budget, "id">>) {
  budgets = budgets.map((b) => (b.id === id ? { ...b, ...patch } : b));
  notifyB();

  await supabase.from("budgets").update({
    ...(patch.category !== undefined && { category: patch.category }),
    ...(patch.limit !== undefined && { limit_amount: patch.limit }),
    ...(patch.period !== undefined && { period: patch.period }),
  }).eq("id", id);
}

export async function deleteBudget(id: string) {
  budgets = budgets.filter((b) => b.id !== id);
  notifyB();
  await supabase.from("budgets").delete().eq("id", id);
}

// ── Goal mutations ─────────────────────────────────────────────────────────

export async function addGoal(g: { name: string; target: number; current: number; deadline: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const newGoal: Goal = { id: crypto.randomUUID(), createdAt: today, ...g };
  goals = [...goals, newGoal];
  notifyG();

  await supabase.from("goals").insert([{
    id: newGoal.id,
    user_id: user.id,
    name: g.name,
    target: g.target,
    current: g.current,
    deadline: g.deadline,
    created_date: today,
  }]);
}

export async function updateGoal(id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>) {
  goals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
  notifyG();

  await supabase.from("goals").update({
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.target !== undefined && { target: patch.target }),
    ...(patch.current !== undefined && { current: patch.current }),
    ...(patch.deadline !== undefined && { deadline: patch.deadline }),
  }).eq("id", id);
}

export async function deleteGoal(id: string) {
  goals = goals.filter((g) => g.id !== id);
  contributions = contributions.filter((c) => c.goalId !== id);
  notifyG(); notifyC();
  await supabase.from("goals").delete().eq("id", id);
}

// ── Contribution mutations ─────────────────────────────────────────────────

export async function addContribution(c: Omit<GoalContribution, "id">) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const newContrib: GoalContribution = { ...c, id: crypto.randomUUID() };
  contributions = [...contributions, newContrib];

  const updatedGoal = goals.find((g) => g.id === c.goalId);
  const newCurrent = (updatedGoal?.current ?? 0) + c.amount;
  goals = goals.map((g) =>
    g.id === c.goalId ? { ...g, current: newCurrent } : g
  );
  notifyG(); notifyC();

  await supabase.from("goal_contributions").insert([{
    id: newContrib.id,
    user_id: user.id,
    goal_id: c.goalId,
    amount: c.amount,
    date: c.date,
    note: c.note ?? null,
  }]);
  await supabase.from("goals").update({ current: newCurrent }).eq("id", c.goalId);
}

export async function deleteContribution(id: string) {
  const contrib = contributions.find((c) => c.id === id);
  if (contrib) {
    const newCurrent = Math.max(0, (goals.find((g) => g.id === contrib.goalId)?.current ?? 0) - contrib.amount);
    goals = goals.map((g) =>
      g.id === contrib.goalId ? { ...g, current: newCurrent } : g
    );
    notifyG();
    await supabase.from("goals").update({ current: newCurrent }).eq("id", contrib.goalId);
  }
  contributions = contributions.filter((c) => c.id !== id);
  notifyC();
  await supabase.from("goal_contributions").delete().eq("id", id);
}

// ── Utilitários ────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDeadline(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[m - 1]} ${y}`;
}
