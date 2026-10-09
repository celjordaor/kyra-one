import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { markOnboardingStep } from "./onboarding-store";

export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  icon?: string;
  color?: string;
};

const DEFAULTS: Category[] = [
  { name: "Alimentação",    type: "expense", icon: "🍔", color: "#f97316" },
  { name: "Transporte",     type: "expense", icon: "🚗", color: "#3b82f6" },
  { name: "Moradia",        type: "expense", icon: "🏠", color: "#8b5cf6" },
  { name: "Entretenimento", type: "expense", icon: "🎮", color: "#ec4899" },
  { name: "Saúde",          type: "expense", icon: "💊", color: "#ef4444" },
  { name: "Educação",       type: "expense", icon: "📚", color: "#06b6d4" },
  { name: "Salário",        type: "income",  icon: "💰", color: "#10b981" },
  { name: "Renda extra",    type: "income",  icon: "📈", color: "#84cc16" },
  { name: "Investimentos",  type: "income",  icon: "💹", color: "#6366f1" },
  { name: "Outros",         type: "expense", icon: "📦", color: "#6b7280" },
].map(c => ({ id: crypto.randomUUID(), name: c.name, type: c.type as CategoryType,
  active: true, icon: c.icon, color: c.color }));

let cache: Category[] = [];
let initialized       = false;
const listeners       = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

function mapRow(row: Record<string, unknown>): Category {
  return {
    id:     row.id     as string,
    name:   row.name   as string,
    type:   row.type   as CategoryType,
    active: row.active as boolean,
    icon:   (row.icon  as string | null) ?? undefined,
    color:  (row.color as string | null) ?? undefined,
  };
}

async function loadFromSupabase() {
  if (initialized) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { cache = DEFAULTS; notify(); return; }

  const { data, error } = await supabase
    .from("categories").select("*").eq("user_id", user.id).order("name");

  if (!error && data) {
    if (data.length > 0) {
      cache = data.map(mapRow);
    } else {
      cache = DEFAULTS;
      // Seed inicial
      await supabase.from("categories").insert(
        DEFAULTS.map(c => ({ ...c, user_id: user.id }))
      );
    }
    initialized = true;
    notify();
  } else {
    // Fallback localStorage
    try {
      const raw = localStorage.getItem("finance.categories.v2");
      cache = raw ? JSON.parse(raw) : DEFAULTS;
    } catch { cache = DEFAULTS; }
    notify();
  }
}

supabase.auth.onAuthStateChange(ev => {
  if (ev === "SIGNED_OUT") { cache = []; initialized = false; notify(); }
  if (ev === "SIGNED_IN")  { initialized = false; loadFromSupabase(); }
});

export function useCategories(): Category[] {
  if (typeof window !== "undefined" && !initialized) loadFromSupabase();
  return useSyncExternalStore(subscribe, () => cache, () => DEFAULTS);
}

export async function addCategory(
  name: string, type: CategoryType,
  color = "#6b7280", icon = "📦"
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const newCat: Category = { id: crypto.randomUUID(), name: trimmed, type, active: true, color, icon };
  cache = [...cache, newCat];
  notify();
  await supabase.from("categories").insert({ ...newCat, user_id: user.id });
  markOnboardingStep("categoria");
}

export async function updateCategory(
  id: string, name: string,
  type?: CategoryType, color?: string, icon?: string
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  cache = cache.map(c => c.id === id
    ? { ...c, name: trimmed, type: type ?? c.type, color: color ?? c.color, icon: icon ?? c.icon }
    : c
  );
  notify();
  const patch: Record<string, unknown> = { name: trimmed };
  if (type  !== undefined) patch.type  = type;
  if (color !== undefined) patch.color = color;
  if (icon  !== undefined) patch.icon  = icon;
  await supabase.from("categories").update(patch).eq("id", id);
}

export async function toggleCategory(id: string) {
  const cat = cache.find(c => c.id === id);
  if (!cat) return;
  const next = !cat.active;
  cache = cache.map(c => c.id === id ? { ...c, active: next } : c);
  notify();
  await supabase.from("categories").update({ active: next }).eq("id", id);
}

export async function deleteCategory(id: string) {
  cache = cache.filter(c => c.id !== id);
  notify();
  await supabase.from("categories").delete().eq("id", id);
}
