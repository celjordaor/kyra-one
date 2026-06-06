import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  CreditCard,
  Calendar,
  ChevronRight,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardStore } from "@/lib/card-store";
import { LimitBar } from "@/components/cartoes/limit-bar";
import { EditCardSheet } from "@/components/cartoes/edit-card-sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/$cardId")({
  component: CartaoDetailPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function CartaoDetailPage() {
  const { cardId } = Route.useParams();
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const { cards, invoices, fetchCards, fetchInvoices, ensureInvoices, getCardLimitUsed } =
    useCardStore();

  const card = cards.find((c) => c.id === cardId);
  const cardInvoices = invoices
    .filter((i) => i.card_id === cardId)
    .sort((a, b) => a.competence.localeCompare(b.competence));

  useEffect(() => {
    const init = async () => {
      if (cards.length === 0) await fetchCards();
      const c = useCardStore.getState().cards.find((c) => c.id === cardId);
      if (!c) return;
      await ensureInvoices(c);
      await fetchInvoices(cardId);
    };
    init();
  }, [cardId]);

  if (!card) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Cartão não encontrado.
      </div>
    );
  }

  const used = getCardLimitUsed(card.id);
  const available = Math.max(card.limit_total - used, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{card.name}</h1>
            <p className="text-sm text-muted-foreground">
              {card.bank} · {card.flag}
            </p>
          </div>
        </div>
        {/* Botão de configuração — abre sheet de edição */}
        <button
          onClick={() => setShowEdit(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Card de limite */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <LimitBar used={used} total={card.limit_total} showLabel />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Limite Total</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {card.limit_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Utilizado</p>
            <p className={cn("mt-0.5 text-sm font-bold",
              (used / card.limit_total) > 0.8 ? "text-destructive" : "text-foreground"
            )}>
              {used.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Disponível</p>
            <p className="mt-0.5 text-sm font-bold text-green-600 dark:text-green-400">
              {available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span>Fecha dia {card.closing_day}</span>
          <span>·</span>
          <span>Vence dia {card.due_day}</span>
        </div>
      </div>

      {/* Botão nova despesa */}
      <Button asChild className="h-11 w-full gap-2 bg-primary font-semibold">
        <Link to="/cartoes/nova-despesa" search={{ cardId: card.id }}>
          <Plus className="h-4 w-4" />
          Lançar despesa
        </Link>
      </Button>

      {/* Faturas */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          Faturas
        </h2>

        {cardInvoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhuma fatura disponível.
          </div>
        ) : (
          <div className="space-y-2">
            {cardInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                to="/cartoes/$cardId/fatura/$invoiceId"
                params={{ cardId: card.id, invoiceId: invoice.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{invoice.competence}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence {new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {invoice.total_amount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      STATUS_CLASS[invoice.status]
                    )}>
                      {STATUS_LABEL[invoice.status]}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sheet de edição */}
      {showEdit && (
        <EditCardSheet card={card} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
