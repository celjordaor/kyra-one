import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CreditCard, Plus, ChevronRight, Wallet, Star, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCardStore } from "@/lib/card-store";
import { LimitBar } from "@/components/cartoes/limit-bar";
import { useLimitUsed } from "@/hooks/use-limit-used";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes/")({
  component: CartoesPage,
});

const FLAG_COLORS: Record<string, string> = {
  Visa: "bg-blue-600", Mastercard: "bg-red-600", Elo: "bg-yellow-500",
  Amex: "bg-green-600", Hipercard: "bg-red-700", Outro: "bg-muted-foreground",
};

function CardItem({ card }: { card: ReturnType<typeof useCardStore.getState>["cards"][number] }) {
  const { setDefaultCard } = useCardStore();
  const { limitUsed } = useLimitUsed(card.id);
  const available = Math.max(card.limit_total - limitUsed, 0);
  const pct = card.limit_total > 0 ? (limitUsed / card.limit_total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border bg-card transition-shadow hover:shadow-md">
      {/* Header do cartão */}
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <Link
          to="/cartoes/$cardId"
          params={{ cardId: card.id }}
          className="flex flex-1 items-center gap-3"
        >
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl text-white",
            FLAG_COLORS[card.flag] ?? "bg-muted-foreground"
          )}>
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-foreground">{card.name}</p>
              {card.is_default && (
                <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  <Star className="h-2.5 w-2.5 fill-primary" /> Padrão
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{card.bank} · {card.flag}</p>
          </div>
        </Link>

        {/* Menu de ações */}
        <div className="flex items-center gap-1">
          <Link to="/cartoes/$cardId" params={{ cardId: card.id }}>
            <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!card.is_default && (
                <DropdownMenuItem
                  onClick={async () => {
                    await setDefaultCard(card.id);
                    toast.success(`${card.name} definido como padrão`);
                  }}
                  className="cursor-pointer gap-2 text-primary"
                >
                  <Star className="h-4 w-4" /> Definir como padrão
                </DropdownMenuItem>
              )}
              {card.is_default && (
                <DropdownMenuItem disabled className="gap-2 opacity-50">
                  <Star className="h-4 w-4 fill-primary text-primary" /> Cartão padrão
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer gap-2">
                <Link to="/cartoes/$cardId" params={{ cardId: card.id }}>
                  <ChevronRight className="h-4 w-4" /> Ver detalhes
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de limite */}
      <Link to="/cartoes/$cardId" params={{ cardId: card.id }} className="block px-5 pt-4">
        <LimitBar used={limitUsed} total={card.limit_total} />
        <div className="mt-3 grid grid-cols-3 gap-2 pb-5 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="text-sm font-semibold text-foreground">
              {card.limit_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Utilizado</p>
            <p className={cn("text-sm font-semibold", pct > 80 ? "text-destructive" : "text-foreground")}>
              {limitUsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
    </div>
  );
}

// TODO: gating por assinatura do portal (Fase Asaas)
function CartoesPage() {
  const { cards, fetchCards, loading } = useCardStore();

  useEffect(() => { fetchCards(); }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl md:max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground">
            {cards.filter((c) => c.active).length} cartão(ões) ativo(s)
          </p>
        </div>
        <Button asChild size="sm" className="h-9 gap-1.5 bg-primary font-semibold">
          <Link to="/cartoes/novo"><Plus className="h-4 w-4" /> Novo cartão</Link>
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card py-14 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nenhum cartão cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Adicione seu primeiro cartão para começar o controle.</p>
          </div>
          <Button asChild className="mt-2 h-10 bg-primary font-semibold">
            <Link to="/cartoes/novo"><Plus className="mr-1.5 h-4 w-4" /> Adicionar cartão</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
          {cards.map((card) => <CardItem key={card.id} card={card} />)}
        </div>
      )}
    </div>
  );
}
