import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, CreditCard, TrendingDown } from "lucide-react";
import { useCardStore } from "@/lib/card-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/faturas-cartao")({
  head: () => ({ meta: [{ title: "Faturas — JadeOne" }] }),
  component: FaturasCartaoPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toYYYYMM(competence: string): string {
  const [mm, yyyy] = competence.split("/");
  return `${yyyy}-${mm}`;
}
function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function nextYYYYMM(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_DOT:   Record<string, string> = { open: "bg-amber-400", paid: "bg-emerald-400", closed: "bg-slate-400", overdue: "bg-red-400" };
const STATUS_TEXT:  Record<string, string> = { open: "text-amber-700", paid: "text-emerald-700", closed: "text-slate-600", overdue: "text-red-700" };
const STATUS_BG:    Record<string, string> = { open: "bg-amber-50", paid: "bg-emerald-50", closed: "bg-slate-100", overdue: "bg-red-50" };
const STATUS_LABEL: Record<string, string> = { open: "Em aberto", paid: "Paga", closed: "Fechada", overdue: "Em atraso" };

function FaturasCartaoPage() {
  const router = useRouter();
  const { cards, invoices, fetchCards, fetchInvoices, ensureInvoices } = useCardStore();
  const [loading, setLoading] = useState(true);

  // Carregar todos os cartões e suas faturas
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchCards();
        const activeCards = useCardStore.getState().cards.filter(c => c.active);
        await Promise.all(
          activeCards.flatMap(card => [
            ensureInvoices(card),
            fetchInvoices(card.id),
          ])
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now  = currentYYYYMM();
  const next = nextYYYYMM();

  // ── Faturas enriquecidas com nome do cartão ──────────────────────────────
  const enriched = useMemo(() => {
    return invoices
      .filter(inv => {
        const card = cards.find(c => c.id === inv.card_id);
        return card?.active;
      })
      .map(inv => {
        const card    = cards.find(c => c.id === inv.card_id)!;
        const ym      = toYYYYMM(inv.competence);
        const isPast  = ym < now;
        const rawStatus = inv.status as "open" | "closed" | "paid";
        const status  = isPast && rawStatus === "open" ? "overdue" : rawStatus;
        return { ...inv, cardName: card?.name ?? "", cardFlag: card?.flag ?? "", ym, status };
      });
  }, [invoices, cards, now]);

  // ── Seção 1: Faturas do mês atual (em aberto ou em atraso) ───────────────
  const currentSection = useMemo(() =>
    enriched
      .filter(inv => (inv.ym === now && inv.status !== "paid") ||
                     (inv.ym < now  && (inv.status === "overdue" || inv.status === "open")))
      .sort((a, b) => {
        if (a.ym === now && b.ym !== now) return -1;
        if (b.ym === now && a.ym !== now) return  1;
        return b.ym.localeCompare(a.ym);
      }),
  [enriched, now]);

  // ── Seção 2: Próximo mês ─────────────────────────────────────────────────
  const nextSection = useMemo(() =>
    enriched
      .filter(inv => inv.ym === next)
      .sort((a, b) => a.cardName.localeCompare(b.cardName)),
  [enriched, next]);

  // ── Totais do cabeçalho ──────────────────────────────────────────────────
  const { totalLimit, totalUsed } = useMemo(() => {
    const activeCards = cards.filter(c => c.active);
    const totalLimit  = activeCards.reduce((s, c) => s + (c.limit_total ?? 0), 0);
    // "Utilizado" = soma dos totais das faturas abertas (mês atual + próximos)
    const openInvoices = enriched.filter(inv =>
      inv.status !== "paid" && inv.ym >= now
    );
    const totalUsed = openInvoices.reduce((s, inv) => s + (inv.total_amount ?? 0), 0);
    return { totalLimit, totalUsed };
  }, [cards, enriched, now]);

  const totalAvailable = Math.max(totalLimit - totalUsed, 0);
  const pct = totalLimit > 0 ? Math.min((totalUsed / totalLimit) * 100, 100) : 0;
  const isHigh = pct > 80;

  // ── Card de fatura ────────────────────────────────────────────────────────
  type EnrichedInvoice = (typeof enriched)[0];

  function InvoiceCard({ inv, highlight = false }: { inv: EnrichedInvoice; highlight?: boolean }) {
    const [mon, yr] = inv.competence.split("/");
    const iconBg:   Record<string, string> = { open: "bg-amber-50", overdue: "bg-red-50", closed: "bg-slate-100", paid: "bg-emerald-50" };
    const iconText: Record<string, string> = { open: "text-amber-600", overdue: "text-red-600", closed: "text-slate-600", paid: "text-emerald-600" };

    return (
      <a
        href={`/cartoes/${inv.card_id}/fatura/${inv.id}`}
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm",
          "transition-all active:scale-[0.98]",
          highlight
            ? "bg-indigo-600 border-indigo-500 text-white"
            : "bg-white dark:bg-card border-slate-100 dark:border-border"
        )}>

        {/* Ícone mês/ano */}
        <div className={cn(
          "flex shrink-0 flex-col items-center justify-center rounded-xl h-12 w-16",
          highlight ? "bg-white/15" : iconBg[inv.status]
        )}>
          <span className={cn("text-[11px] font-bold uppercase leading-none",
            highlight ? "text-white/70" : iconText[inv.status])}>
            {mon.slice(0, 3)}
          </span>
          <span className={cn("text-[18px] font-extrabold leading-tight",
            highlight ? "text-white" : iconText[inv.status])}>
            {yr}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Nome do cartão */}
          <p className={cn("text-[12px] font-semibold truncate",
            highlight ? "text-white/70" : "text-slate-500 dark:text-muted-foreground")}>
            {inv.cardFlag} · {inv.cardName}
          </p>
          {/* Competência + badge — mesma linha, sem quebra */}
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden mt-0.5">
            <p className={cn("text-[15px] font-bold shrink-0",
              highlight ? "text-white" : "text-slate-800 dark:text-foreground")}>
              {inv.competence}
            </p>
            <span className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
              highlight
                ? "bg-white/20 text-white"
                : cn(STATUS_BG[inv.status], STATUS_TEXT[inv.status])
            )}>
              {inv.status === "overdue"
                ? <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                : <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[inv.status])} />}
              {STATUS_LABEL[inv.status]}
            </span>
          </div>
          <p className={cn("text-[11px] mt-0.5 truncate",
            highlight ? "text-white/60" : "text-slate-400")}>
            Vence {new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <p className={cn("text-[15px] font-bold",
            highlight ? "text-white" : "text-slate-800 dark:text-foreground")}>
            {fmt(inv.total_amount)}
          </p>
          <ChevronRight className={cn("h-4 w-4",
            highlight ? "text-white/60" : "text-slate-400")} />
        </div>
      </a>
    );
  }

  return (
    <div style={{ width:"100vw", maxWidth:"100vw", overflowX:"hidden" }}
      className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-5 pb-14 text-white"
        style={{ paddingTop:"calc(env(safe-area-inset-top,0px) + 1.25rem)" }}>
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">
            Resumo de faturas
          </p>
          <h1 className="text-2xl font-extrabold leading-tight">Faturas de cartão</h1>
        </div>

        {/* Card resumo consolidado */}
        <div className="rounded-2xl bg-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-white/60" />
            <span className="text-[12px] text-white/60">
              {cards.filter(c => c.active).length} cartão{cards.filter(c => c.active).length !== 1 ? "es" : ""} ativo{cards.filter(c => c.active).length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/60">Comprometido</span>
            <span className="text-xs text-white/60">Disponível</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className={cn("text-2xl font-bold", isHigh && "text-red-300")}>
              {fmt(totalUsed)}
            </span>
            <span className="text-2xl font-semibold text-white/80">{fmt(totalAvailable)}</span>
          </div>

          <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", isHigh ? "bg-red-400" : "bg-white")}
              style={{ width:`${pct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-white/50">{pct.toFixed(0)}% do limite</span>
            <span className="text-[11px] text-white/50">Limite total {fmt(totalLimit)}</span>
          </div>

          {/* Totais por status */}
          {currentSection.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
              <TrendingDown className="h-3.5 w-3.5 text-white/50 shrink-0" />
              <span className="text-[12px] text-white/60">
                {currentSection.length} fatura{currentSection.length !== 1 ? "s" : ""} em aberto este mês ·{" "}
                {fmt(currentSection.reduce((s, i) => s + i.total_amount, 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTEÚDO ───────────────────────────────────────────────────── */}
      <div className="px-4 -mt-6 pb-8 space-y-6">

        {loading && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── FATURAS DO MÊS ATUAL ───────────────────────────────── */}
            {currentSection.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                  Fatura atual
                </p>
                <div className="space-y-2.5">
                  {currentSection.map((inv, idx) => (
                    <InvoiceCard key={inv.id} inv={inv} highlight={idx === 0} />
                  ))}
                </div>
              </div>
            )}

            {/* ── PRÓXIMO MÊS ────────────────────────────────────────── */}
            {nextSection.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Próximo mês
                  </p>
                  <span className="text-[11px] text-slate-400">
                    {nextSection.length} fatura{nextSection.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {nextSection.map(inv => (
                    <InvoiceCard key={inv.id} inv={inv} />
                  ))}
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {currentSection.length === 0 && nextSection.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-12 text-center">
                <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Nenhuma fatura em aberto</p>
                <p className="text-xs text-slate-400 mt-1">Todos os cartões estão em dia</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
