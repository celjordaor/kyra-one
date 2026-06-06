import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

export type CreditCard = {
  id: string;
  name: string;
  lastDigits: string;
  color: string;
  icon: string;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  isDefault: boolean;
};

async function fetchCards(): Promise<CreditCard[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id,
    name: r.name,
    lastDigits: r.last_digits ?? "",
    color: r.color ?? "#6366f1",
    icon: r.icon ?? "💳",
    creditLimit: r.credit_limit ?? null,
    closingDay: r.closing_day ?? null,
    dueDay: r.due_day ?? null,
    isDefault: r.is_default ?? false,
  }));
}

export function useCards() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const running = useRef(false);

  const load = async () => {
    if (running.current) return;
    running.current = true;
    try { setCards(await fetchCards()); }
    finally { setLoading(false); running.current = false; }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const addCard = async (card: Omit<CreditCard, "id" | "isDefault">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isFirst = cards.length === 0;
    const { data } = await supabase.from("credit_cards").insert([{
      user_id: user.id,
      name: card.name,
      last_digits: card.lastDigits || null,
      color: card.color,
      icon: card.icon,
      credit_limit: card.creditLimit,
      closing_day: card.closingDay,
      due_day: card.dueDay,
      is_default: isFirst,
    }]).select().single();
    if (data) await load();
  };

  const updateCard = async (id: string, patch: Partial<Omit<CreditCard, "id">>) => {
    await supabase.from("credit_cards").update({
      name: patch.name,
      last_digits: patch.lastDigits,
      color: patch.color,
      icon: patch.icon,
      credit_limit: patch.creditLimit,
      closing_day: patch.closingDay,
      due_day: patch.dueDay,
    }).eq("id", id);
    await load();
  };

  const deleteCard = async (id: string) => {
    await supabase.from("credit_cards").delete().eq("id", id);
    await load();
  };

  const setDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Remove default de todos, seta no escolhido
    await supabase.from("credit_cards")
      .update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("credit_cards")
      .update({ is_default: true }).eq("id", id);
    await load();
  };

  const defaultCard = cards.find(c => c.isDefault) ?? cards[0] ?? null;

  return { cards, loading, defaultCard, addCard, updateCard, deleteCard, setDefault, reload: load };
}
