import { createFileRoute, useRouter, Outlet, useChildMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, ChevronRight, Settings } from "lucide-react";
import { useCardStore } from "@/lib/card-store";
import { EditCardSheet } from "@/components/cartoes/edit-card-sheet";
import { useLimitUsed } from "@/hooks/use-limit-used";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/$cardId")({
  component: CartaoDetailPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_DOT: Record<string, string> = {
  open:   "bg-amber-400",
  closed: "bg-slate-400",
  paid:   "bg-emerald-400",
};
const STATUS_TEXT: Record<string, string> = {
  open:   "text-amber-700",
  closed: "text-slate-600",
  paid:   "text-emerald-700",
};
const STATUS_BG: Record<string, string> = {
  open:   "bg-amber-50",
  closed: "bg-slate-100",
  paid:   "bg-emerald-50",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto", closed: "Fechada", paid: "Paga",
};

function CartaoDetailPage() {
  const { cardId } = Route.useParams();
  const router = useRouter();
  const childMatches = useChildMatches();

  if (childMatches.length > 0) return <Outlet />;

  const [showEdit, setShowEdit] = useState(false);
  const { cards, invoices, fetchCards, fetchInvoices, ensureInvoices } = useCardStore();
  const { limitUsed } = useLimitUsed(cardId);

  const card = cards.find(c => c.id === cardId);
  const cardInvoices = invoices
    .filter(i => i.card_id === cardId)
    .sort((a, b) => {
      const [am, ay] = a.competence.split("/");
      const [bm, by] = b.competence.split("/");
      return `${by}-${bm}`.localeCompare(`${ay}-${am}`); // mais recente primeiro
    });

  useEffect(() => {
    const init = async () => {
      if (cards.length === 0) await fetchCards();
      const c = useCardStore.getState().cards.find(c => c.id === cardId);
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

  const available = Math.max(card.limit_total - limitUsed, 0);
  const pct       = card.limit_total > 0 ? Math.min((limitUsed / card.limit_total) * 100, 100) : 0;
  const isHigh    = pct > 80;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* ── HEADER GRADIENTE ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-5 pt-5 pb-14 text-white">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setShowEdit(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Identidade do cartão */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <span className="text-2xl font-bold">{(card.flag?.[0] ?? "C").toUpperCase()}</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/50">Cartão de crédito</p>
            <p className="text-xl font-bold leading-tight">{card.name}</p>
            <p className="text-sm text-white/70">{card.flag} · {card.bank}</p>
          </div>
        </div>

        {/* Limite */}
        <div className="rounded-2xl bg-white/10 p-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/60">Utilizado</span>
            <span className="text-xs text-white/60">Disponível</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className={cn("text-xl font-bold", isHigh && "text-red-300")}>{fmt(limitUsed)}</span>
            <span className="text-xl font-semibold text-white/80">{fmt(available)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", isHigh ? "bg-red-400" : "bg-white")}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-white/50">{pct.toFixed(0)}% usado</span>
            <span className="text-[11px] text-white/50">Limite {fmt(card.limit_total)}</span>
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/10 text-xs text-white/60">
            <span>Fecha dia {card.closing_day}</span>
            <span>·</span>
            <span>Vence dia {card.due_day}</span>
          </div>
        </div>
      </div>

      {/* ── Botão nova despesa ────────────────────────────────────────── */}
      <div className="px-4 -mt-5 mb-5">
        <button
          onClick={() => router.navigate({ to: "/cartoes/nova-despesa", search: { cardId: card.id } })}
          className="flex w-full h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white font-semibold text-sm shadow-lg transition-all active:scale-95"
          style={{ boxShadow: "0 8px 20px #4f46e544" }}>
          <Plus className="h-4 w-4" /> Lançar despesa
        </button>
      </div>

      {/* ── Lista de faturas ──────────────────────────────────────────── */}
      <div className="px-4 pb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground">
            Faturas
          </p>
          <span className="text-[11px] text-slate-400 dark:text-muted-foreground">
            {cardInvoices.length} fatura{cardInvoices.length !== 1 ? "s" : ""}
          </span>
        </div>

        {cardInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-10 text-center text-sm text-slate-400 dark:text-muted-foreground">
            Nenhuma fatura disponível.
          </div>
        ) : (
          <div className="space-y-2.5">
            {cardInvoices.map(invoice => {
              const [mon, yr]  = invoice.competence.split("/");
              const status = invoice.status as "open" | "closed" | "paid";
              return (
                <a
                  key={invoice.id}
                  href={`/cartoes/${card.id}/fatura/${invoice.id}`}
                  className="flex items-center gap-3.5 rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border px-4 py-4 shadow-sm hover:shadow-md transition-shadow">
                  {/* Ícone mês */}
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                    <span className="text-[10px] font-bold uppercase text-indigo-400">{mon.slice(0, 3)}</span>
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">/{yr.slice(2)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-semibold text-slate-800 dark:text-foreground">
                        {invoice.competence}
                      </p>
                      <span className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        STATUS_BG[status], STATUS_TEXT[status]
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])}/>
                        {STATUS_LABEL[status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground mt-0.5">
                      Vence {new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <p className="text-[15px] font-bold text-slate-800 dark:text-foreground">
                      {fmt(invoice.total_amount)}
                    </p>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {showEdit && <EditCardSheet card={card} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
