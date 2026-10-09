import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type OnboardingStep = "categoria" | "cartao" | "despesa" | "whatsapp";

export type OnboardingState = {
  loading: boolean;
  categoria: boolean;
  cartao: boolean;
  despesa: boolean;
  whatsapp: boolean;
  dismissed: boolean;
};

const EMPTY: OnboardingState = {
  loading: true,
  categoria: false,
  cartao: false,
  despesa: false,
  whatsapp: false,
  dismissed: false,
};

let cache: OnboardingState = EMPTY;
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function loadFromSupabase() {
  if (initialized) return;
  initialized = true;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    cache = { ...EMPTY, loading: false };
    notify();
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "onboarding_categoria, onboarding_cartao, onboarding_despesa, onboarding_whatsapp, onboarding_dismissed",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!error && data) {
    cache = {
      loading: false,
      categoria: !!data.onboarding_categoria,
      cartao: !!data.onboarding_cartao,
      despesa: !!data.onboarding_despesa,
      whatsapp: !!data.onboarding_whatsapp,
      dismissed: !!data.onboarding_dismissed,
    };
  } else {
    // Coluna ainda não existe no banco (migração não aplicada) ou erro de
    // rede — não trava a tela, só esconde o checklist por segurança.
    cache = { ...EMPTY, loading: false, dismissed: true };
  }
  notify();
}

supabase.auth.onAuthStateChange((ev) => {
  if (ev === "SIGNED_OUT") {
    cache = EMPTY;
    initialized = false;
    notify();
  }
  if (ev === "SIGNED_IN") {
    initialized = false;
    loadFromSupabase();
  }
});

export function useOnboarding(): OnboardingState {
  if (typeof window !== "undefined" && !initialized) loadFromSupabase();
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}

export async function markOnboardingStep(step: OnboardingStep) {
  const column = `onboarding_${step}` as const;
  if (cache[step]) return; // já estava feito, evita escrita redundante

  cache = { ...cache, [step]: true };
  notify();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ [column]: true })
    .eq("id", user.id);
}

export async function dismissOnboarding() {
  if (cache.dismissed) return;
  cache = { ...cache, dismissed: true };
  notify();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ onboarding_dismissed: true }).eq("id", user.id);
}
