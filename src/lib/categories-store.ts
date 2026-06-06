import { useSyncExternalStore, useEffect } from "react";
import { supabase } from "./supabase";

export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  color: string;
  icon: string;
};

const DEFAULT_CATEGORIES = [
  { name: "Alimentação",    type: "expense" as CategoryType, color: "#f97316", icon: "utensils" },
  { name: "Transporte",     type: "expense" as CategoryType, color: "#3b82f6", icon: "car" },
  { name: "Moradia",        type: "expense" as CategoryType, color: "#8b5cf6", icon: "home" },
  { name: "Entretenimento", type: "expense" as CategoryType, color: "#ec4899", icon: "gamepad-2" },
  { name: "Saúde",          type: "expense" as CategoryType, color: "#ef4444", icon: "heart" },
  { name: "Educação",       type: "expense" as CategoryType, color: "#06b6d4", icon: "graduation-cap" },
  { name: "Cartão de Crédito", type: "expense" as CategoryType, color: "#6b7280", icon: "credit-card" },
  { name: "Outros",         type: "expense" as CategoryType, color: "#6b7280", icon: "tag" },
  { name: "Salário",        type: "income" as CategoryType,  color: "#22c55e", icon: "briefcase" },
  { name: "Renda extra",    type: "income" as CategoryType,  color: "#10b981", icon: "zap" },
  { name: "Investimentos",  type: "income" as CategoryType,  color: "#14b8a6", icon: "piggy-bank" },
];

let cache: Category[] = [];
let initialized = false;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function seedDefaults(userId: string) {
  const defaults = DEFAULT_CATEGORIES.map((c) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name: c.name,
    type: c.type,
    active: true,
    color: c.color,
    icon: c.icon,
  }));
  await supabase.from("categories").insert(defaults);
  return defaults.map(({ user_id: _uid, ...rest }) => rest) as Category[];
}

async function loadFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (initialized && currentUserId === user.id) return;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (!error) {
    if (!data || data.length === 0) {
      const seeded = await seedDefaults(user.id);
      cache = seeded;
    } else {
      cache = data.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        type: r.type as CategoryType,
        active: r.active as boolean,
        color: (r.color as string) ?? "#6b7280",
        icon: (r.icon as string) ?? "tag",
      }));
    }
    initialized = true;
    currentUserId = user.id;
    notify();
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    cache = [];
    initialized = false;
    currentUserId = null;
    notify();
  }
});

export function useCategories(): Category[] {
  useEffect(() => { loadFromSupabase(); }, []);
  return useSyncExternalStore(subscribe, () => cache, () => []);
}

export async function addCategory(
  name: string,
  type: CategoryType,
  color = "#6b7280",
  icon = "tag"
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const trimmed = name.trim();
  if (!trimmed) return;
  if (cache.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === type)) return;

  const newCat: Category = {
    id: crypto.randomUUID(),
    name: trimmed,
    type,
    active: true,
    color,
    icon,
  };
  cache = [...cache, newCat];
  notify();

  await supabase.from("categories").insert([{ ...newCat, user_id: user.id }]);
}

export async function updateCategory(
  id: string,
  name: string,
  type?: CategoryType,
  color?: string,
  icon?: string
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  cache = cache.map((c) =>
    c.id === id
      ? {
          ...c,
          name: trimmed,
          type: type ?? c.type,
          color: color ?? c.color,
          icon: icon ?? c.icon,
        }
      : c
  );
  notify();

  await supabase.from("categories").update({
    name: trimmed,
    ...(type ? { type } : {}),
    ...(color ? { color } : {}),
    ...(icon ? { icon } : {}),
  }).eq("id", id);
}

export async function toggleCategory(id: string) {
  cache = cache.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
  notify();

  const updated = cache.find((c) => c.id === id);
  if (updated) await supabase.from("categories").update({ active: updated.active }).eq("id", id);
}

export async function deleteCategory(id: string) {
  cache = cache.filter((c) => c.id !== id);
  notify();
  await supabase.from("categories").delete().eq("id", id);
}
