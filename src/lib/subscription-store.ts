import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export type PlanId = "essencial" | "avancado";
export type SubscriptionStatus = "trial" | "active" | "inactive" | "cancelled";

export type UserSubscription = {
  id: string;
  planId: PlanId;
  planName: string;
  price: number;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  periodEnd: Date | null;
  isActive: boolean;
  isAdvancado: boolean;
  daysLeftInTrial: number | null;
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*, plan:plans(*)")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      const plan = data.plan as { id: string; name: string; price: number };
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
      const isActive = data.status === "active" || data.status === "trial";
      const daysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : null;

      setSubscription({
        id: data.id,
        planId: plan.id as PlanId,
        planName: plan.name,
        price: plan.price,
        status: data.status as SubscriptionStatus,
        trialEndsAt,
        periodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
        isActive,
        isAdvancado: plan.id === "avancado" && isActive,
        daysLeftInTrial: data.status === "trial" ? daysLeft : null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Simula seleção de plano (será substituído pelo gateway de pagamento)
  const selectPlan = async (planId: PlanId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("subscriptions")
      .update({ plan_id: planId, status: "trial", updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await load();
  };

  return { subscription, loading, selectPlan, reload: load };
}
