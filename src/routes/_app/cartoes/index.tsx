import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreditCard, Plus, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardStore } from "@/lib/card-store";
import { useSubscription } from "@/lib/subscription-store";
import { LimitBar } from "@/components/cartoes/limit-bar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/")({
  component: CartoesPage,
});

const FLAG_COLORS: Record<string, string> = {
  Visa: "bg-blue-600",
  Mastercard: "bg-red-600",
  Elo: "bg-yellow-500",
  Amex: "bg-green-600",
  Hipercard: "bg-red-700",
  Outro: "bg-muted-foreground",
};

function CartoesPage() {
  const { cards, fetchCards, getCardLimitUsed, loading } = useCardStore();
  const { subscription } = useSubscription();

  // Bloqueia acesso se não for plano avançado
  // DEPOIS:
     const hasAccess = subscription?.plan_id === "avancado";

  useEffect(() => {
    if (hasAccess) fetchCards();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Recurso exclusivo do plano Avançado
        </h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          O controle de cartão de crédito está disponível no plano Avançado por R$&nbsp;19,90/mês.
        </p>
        <Button asChild className="mt-2 h-11 bg-primary font-semibold">
          <Link to="/planos">Ver planos</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">
            {cards.filter((c) => c.active).length} cartão(ões) ativo(s)
          </p>
        </div>
        <Button asChild size="sm" className="h-9 gap-1.5 bg-primary font-semibold">
          <Link to="/cartoes/novo">
            <Plus className="h-4 w-4" />
            Novo cartão
          </Link>
        </Button>
      </div>

      {/* Lista de cartões */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nenhum cartão cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Adicione seu primeiro cartão para começar o controle.
            </p>
          </div>
          <Button asChild className="mt-2 h-10 bg-primary font-semibold">
            <Link to="/cartoes/novo">
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar cartão
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const used = getCardLimitUsed(card.id);
            const available = Math.max(card.limit_total - used, 0);
            const pct = card.limit_total > 0 ? (used / card.limit_total) * 100 : 0;

            return (
              <Link
                key={card.id}
                to="/cartoes/$cardId"
                params={{ cardId: card.id }}
                className="block rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Ícone da bandeira */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                        FLAG_COLORS[card.flag] ?? "bg-muted-foreground"
                      )}
                    >
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.bank} · {card.flag}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>

                {/* Barra de limite */}
                <div className="mt-4">
                  <LimitBar used={used} total={card.limit_total} />
                </div>

                {/* Resumo de valores */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold text-foreground">
                      {card.limit_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Utilizado</p>
                    <p className={cn("text-sm font-semibold", pct > 80 ? "text-destructive" : "text-foreground")}>
                      {used.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Disponível</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
