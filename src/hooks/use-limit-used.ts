import { useState, useEffect } from "react";
import { useCardStore } from "@/lib/card-store";

/**
 * Hook que calcula o limite utilizado de um cartão de forma assíncrona.
 * Recalcula sempre que as faturas mudam (pagamento, novo lançamento).
 */
export function useLimitUsed(cardId: string) {
  const { invoices, getCardLimitUsed } = useCardStore();
  const [limitUsed, setLimitUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    getCardLimitUsed(cardId)
      .then((v) => setLimitUsed(v))
      .finally(() => setLoading(false));
  }, [cardId, invoices]); // recalcula sempre que invoices mudar (ex: fatura paga)

  return { limitUsed, loading };
}
