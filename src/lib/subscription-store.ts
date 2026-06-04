import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

export type PlanId = "essencial" | "avancado";
export type SubscriptionStatus = 
  "new_account" | "trial" | "active" | "past_due" | "inactive" | "cancelled";

export type UserSubscription = {
  id: string;
  planId: PlanId;
  planName: string;
  price: number;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  periodEnd: Date | null;
  isActive: boolean;
  isAdvancado: boolean;
  isNewAccount: boolean;
  daysLeft: number | null;          // dias restantes (trial ou new_account)
  daysLeftInGrace: number | null;   // dias restantes na carência
  isTrialExpired: boolean;
  isBlocked: boolean;
  needsAttention: boolean;
  newAccountExpired: boolean;
};

async function fetchSubscription(): Promise<UserSubscription | null> {
  try { await supabase.rpc("expire_grace_periods"); } catch (_) {}

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plan:plans(*)")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const plan = data.plan as { id: string; name: string; price: number };
  const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const gracePeriodEndsAt = data.grace_period_ends_at ? new Date(data.grace_period_ends_at) : null;
  const now = Date.now();

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86_400_000))
    : null;

  const daysLeftInGrace = gracePeriodEndsAt
    ? Math.max(0, Math.ceil((gracePeriodEndsAt.getTime() - now) / 86_400_000))
    : null;

  const isTrialExpired =
    ["new_account", "trial"].includes(data.status) &&
    trialEndsAt !== null &&
    trialEndsAt.getTime() < now;

  const newAccountExpired = data.status === "new_account" && isTrialExpired;

  const effectiveStatus: SubscriptionStatus = isTrialExpired
    ? "inactive"
    : (data.status as SubscriptionStatus);

  const isActive = effectiveStatus === "active" ||
    effectiveStatus === "trial" ||
    effectiveStatus === "new_account";

  return {
    id: data.id,
    planId: plan.id as PlanId,
    planName: plan.name,
    price: plan.price,
    status: data.status as SubscriptionStatus,
    effectiveStatus,
    trialEndsAt,
    gracePeriodEndsAt,
    periodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    isActive,
    isAdvancado: plan.id === "avancado" && isActive,
    isNewAccount: data.status === "new_account" && !isTrialExpired,
    daysLeft: ["new_account", "trial"].includes(data.status) ? daysLeft : null,
    daysLeftInGrace: data.status === "past_due" ? daysLeftInGrace : null,
    isTrialExpired,
    newAccountExpired,
    isBlocked: effectiveStatus === "inactive" || effectiveStatus === "cancelled",
    needsAttention: effectiveStatus === "past_due",
  };
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const runningRef = useRef(false);

  const load = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const data = await fetchSubscription();
      setSubscription(data);
    } finally {
      setLoading(false);
      runningRef.current = false;
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

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
