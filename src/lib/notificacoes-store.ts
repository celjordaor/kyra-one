import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

// ── Preferências ─────────────────────────────────────────────────────────
// Antes viviam só em localStorage (`fp:notifs`, em _app.mais.tsx) sem efeito
// real nenhum. Agora moram em `profiles` (mesmo padrão de onboarding-store.ts
// — cache em módulo + useSyncExternalStore), pra api/notificacoes/disparar.ts
// conseguir checar antes de mandar um push, e pra sincronizar entre
// dispositivos. "Lembretes de contas" continua sem disparo de push — só
// controla o KPI de pendências no dashboard, como já era antes.
export type NotifPrefs = {
  loading: boolean;
  expenseAlerts: boolean;
  monthlySummary: boolean;
  goalsReached: boolean;
  billReminders: boolean;
};

const EMPTY: NotifPrefs = {
  loading: true,
  expenseAlerts: true,
  monthlySummary: true,
  goalsReached: true,
  billReminders: false,
};

let cache: NotifPrefs = EMPTY;
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
      "notif_expense_alerts, notif_monthly_summary, notif_goals_reached, notif_bill_reminders",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!error && data) {
    cache = {
      loading: false,
      expenseAlerts: !!data.notif_expense_alerts,
      monthlySummary: !!data.notif_monthly_summary,
      goalsReached: !!data.notif_goals_reached,
      billReminders: !!data.notif_bill_reminders,
    };
  } else {
    // Coluna ainda não existe (migração não aplicada) ou erro de rede — não
    // trava a tela, só volta pros defaults.
    cache = { ...EMPTY, loading: false };
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

export function useNotifPrefs(): NotifPrefs {
  if (typeof window !== "undefined" && !initialized) loadFromSupabase();
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  );
}

const COLUNA_POR_CHAVE = {
  expenseAlerts: "notif_expense_alerts",
  monthlySummary: "notif_monthly_summary",
  goalsReached: "notif_goals_reached",
  billReminders: "notif_bill_reminders",
} as const;
export type NotifPrefKey = keyof typeof COLUNA_POR_CHAVE;

export async function updateNotifPref(chave: NotifPrefKey, valor: boolean) {
  cache = { ...cache, [chave]: valor };
  notify();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await fetch("/api/notificacoes/preferencias", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ chave, valor }),
  });
}

// ── Web Push: permissão + assinatura ────────────────────────────────────────

export type PushStatus = "unsupported" | "default" | "denied" | "subscribed" | "not-subscribed";

export function pushSuportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function statusPush(): Promise<PushStatus> {
  if (!pushSuportado()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "default";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "not-subscribed";
  } catch {
    return "not-subscribed";
  }
}

// PushManager.subscribe() espera a chave VAPID em Uint8Array, não na string
// base64url que a API devolve — precisa desse decode manual.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function ativarPush(): Promise<{ ok: boolean; erro?: string }> {
  if (!pushSuportado()) {
    return { ok: false, erro: "Seu navegador não suporta notificações push." };
  }
  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      return { ok: false, erro: "Permissão de notificação não concedida." };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, erro: "Sessão expirada. Entra de novo." };

    const chaveResp = await fetch("/api/notificacoes/vapid-public-key");
    if (!chaveResp.ok) {
      return { ok: false, erro: "Notificações push ainda não estão configuradas no servidor." };
    }
    const { publicKey } = await chaveResp.json();

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // TS >=5.7 tipa Uint8Array como genérico sobre o buffer e o overload de
      // subscribe() exige especificamente ArrayBuffer (não SharedArrayBuffer)
      // — na prática é sempre um ArrayBuffer comum aqui, só o tipo é
      // excessivamente estrito.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const resp = await fetch("/api/notificacoes/inscrever", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!resp.ok) {
      return { ok: false, erro: "Não consegui salvar sua assinatura de notificações agora." };
    }
    return { ok: true };
  } catch (erro) {
    console.error("Erro ao ativar notificações push:", erro);
    return { ok: false, erro: "Não consegui ativar as notificações agora. Tenta de novo." };
  }
}

export async function desativarPush(): Promise<void> {
  try {
    if (pushSuportado()) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notificacoes/desinscrever", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (erro) {
    console.error("Erro ao desativar notificações push:", erro);
  }
}

// ── Disparo de alerta ────────────────────────────────────────────────────────
// Usado por src/lib/goals-store.ts (meta atingida) e pelos hooks de orçamento
// em card-store.ts/transactions-store.ts (limite de categoria ultrapassado).
// Fire-and-forget por design: nunca deve travar nem reverter o fluxo
// principal (salvar despesa/contribuição) por causa de uma notificação que
// não saiu. A preferência de verdade é checada no backend
// (api/notificacoes/disparar.ts) — aqui é só o disparo.
export type TipoAlerta = "despesa" | "meta" | "resumo" | "teste";

export async function dispararAlerta(
  tipo: TipoAlerta,
  payload: { titulo: string; corpo: string; url?: string },
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notificacoes/disparar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tipo, ...payload }),
    });
  } catch (erro) {
    console.error("Erro ao disparar alerta:", erro);
  }
}
