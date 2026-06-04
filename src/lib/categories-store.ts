import { useSyncExternalStore } from "react";

export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
};

const STORAGE_KEY = "finance.categories.v2";

const DEFAULTS: Category[] = [
  { name: "Alimentação", type: "expense" },
  { name: "Transporte", type: "expense" },
  { name: "Moradia", type: "expense" },
  { name: "Entretenimento", type: "expense" },
  { name: "Saúde", type: "expense" },
  { name: "Educação", type: "expense" },
  { name: "Salário", type: "income" },
  { name: "Renda extra", type: "income" },
  { name: "Investimentos", type: "income" },
  { name: "Outros", type: "expense" },
].map((c) => ({ id: crypto.randomUUID(), name: c.name, type: c.type as CategoryType, active: true }));

let cache: Category[] = load();
const listeners = new Set<() => void>();

function load(): Category[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Category[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULTS;
    return parsed;
  } catch {
    return DEFAULTS;
  }
}

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCategories(): Category[] {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => DEFAULTS,
  );
}

export function addCategory(name: string, type: CategoryType) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (cache.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === type)) return;
  cache = [...cache, { id: crypto.randomUUID(), name: trimmed, type, active: true }];
  persist();
}

export function updateCategory(id: string, name: string, type?: CategoryType) {
  const trimmed = name.trim();
  if (!trimmed) return;
  cache = cache.map((c) => (c.id === id ? { ...c, name: trimmed, type: type ?? c.type } : c));
  persist();
}

export function toggleCategory(id: string) {
  cache = cache.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
  persist();
}

export function deleteCategory(id: string) {
  cache = cache.filter((c) => c.id !== id);
  persist();
}
