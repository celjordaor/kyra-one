import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  planId: string;
  planName: string;
  planPrice: number;
  status: string;
  billingCycle: string;
  trialEndsAt: Date | null;
  periodEnd: Date | null;
};

export type AdminMetrics = {
  total: number;
  trial: number;
  active: number;
  pastDue: number;
  inactive: number;
  cancelled: number;
  mrrEstimate: number;
};

export function useAdminData() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Consultas separadas — mais confiável que nested select
    const [profilesRes, subsRes, plansRes] = await Promise.all([
      supabase.from("profiles").select("id, name, email, role, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id, plan_id, status, billing_cycle, trial_ends_at, current_period_end"),
      supabase.from("plans").select("id, name, price"),
    ]);

    if (profilesRes.error) {
      console.error("Erro ao carregar perfis:", profilesRes.error);
      setLoading(false);
      return;
    }

    const profiles = profilesRes.data ?? [];
    const subs = subsRes.data ?? [];
    const plans = plansRes.data ?? [];

    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    const subMap = Object.fromEntries(subs.map((s) => [s.user_id, s]));

    const merged: AdminUser[] = profiles.map((p) => {
      const sub = subMap[p.id];
      const plan = sub ? planMap[sub.plan_id] : planMap["essencial"];
      return {
        id: p.id,
        name: p.name ?? "",
        email: p.email ?? "",
        role: p.role ?? "user",
        createdAt: new Date(p.created_at),
        planId: sub?.plan_id ?? "essencial",
        planName: plan?.name ?? "Essencial",
        planPrice: plan?.price ?? 9.9,
        status: sub?.status ?? "sem_plano",
        billingCycle: sub?.billing_cycle ?? "monthly",
        trialEndsAt: sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null,
        periodEnd: sub?.current_period_end ? new Date(sub.current_period_end) : null,
      };
    });

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (userId: string, status: string) => {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    // Ao marcar como inadimplente, define 5 dias de carência
    if (status === "past_due") {
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 5);
      updates.grace_period_ends_at = graceEnd.toISOString();
    }
    // Ao ativar ou cancelar, limpa a carência
    if (status === "active" || status === "cancelled" || status === "inactive") {
      updates.grace_period_ends_at = null;
    }
    const { error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("user_id", userId);
    if (error) console.error("Erro ao atualizar status:", error);
    await load();
  };

  const updatePlan = async (userId: string, planId: string) => {
    const { error } = await supabase
      .from("subscriptions")
      .update({ plan_id: planId, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) console.error("Erro ao atualizar plano:", error);
    await load();
  };

  const extendTrial = async (userId: string, days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        trial_ends_at: newDate.toISOString(),
        status: "trial",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) console.error("Erro ao estender trial:", error);
    await load();
  };

  // Excluir admins de todas as métricas
  const nonAdmins = users.filter((u) => u.role !== "admin");

  const metrics: AdminMetrics = {
    total: nonAdmins.length,
    trial: nonAdmins.filter((u) => u.status === "trial").length,
    active: nonAdmins.filter((u) => u.status === "active").length,
    pastDue: nonAdmins.filter((u) => u.status === "past_due").length,
    inactive: nonAdmins.filter((u) => u.status === "inactive").length,
    cancelled: nonAdmins.filter((u) => u.status === "cancelled").length,
    mrrEstimate: nonAdmins
      .filter((u) => u.status === "active")
      .reduce((acc, u) => acc + (u.billingCycle === "annual" ? u.planPrice / 12 : u.planPrice), 0),
  };

  return { users, metrics, loading, reload: load, updateStatus, updatePlan, extendTrial };
}
