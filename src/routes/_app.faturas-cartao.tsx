import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, CreditCard, Lock } from "lucide-react";
import { useCardStore } from "@/lib/card-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/faturas-cartao")({
  head: () => ({ meta: [{ title: "Faturas — JadeOne" }] }),
  component: FaturasCartaoPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toYYYYMM(competence: string) {
  const [mm, yyyy] = competence.split("/");
  return `${yyyy}-${mm}`;
}

type Tab = "closed" | "open";

// ── Estilos por status ─────────────────────────────────────────────────────
const STATUS_DOT:   Record<string, string> = {
  open: "bg-amber-400", closed: "bg-slate-400", paid: "bg-emerald-400", overdue: "bg-red-400",
};
const STATUS_TEXT:  Record<string, string> = {
  open: "text-amber-700", closed: "text-slate-600", paid: "text-emerald-700", overdue: "text-red-700",
};
const STATUS_BG:    Record<string, string> = {
  open: "bg-amber-50", closed: "bg-slate-100", paid: "bg-emerald-50", overdue: "bg-red-50",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto", closed: "Fechada", paid: "Paga", overdue: "Em atraso",
};

function FaturasCartaoPage() {
  const router   = useRouter();
  const { cards, invoices, fetchCards, fetchInvoices, ensureInvoices } = useCardStore();
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>("closed");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchCards();
        const activeCards = useCardStore.getState().cards.filter(c => c.active);
        await Promise.all(
          activeCards.flatMap(card => [ensureInvoices(card), fetchInvoices(card.id)])
        );
      } finally { setLoading(false); }
    })();
  }, []);

  const activeCards = useMemo(() => cards.filter(c => c.active), [cards]);

  // ── Faturas enriquecidas ─────────────────────────────────────────────────
  const enriched = useMemo(() => invoices
    .filter(inv => activeCards.some(c => c.id === inv.card_id))
    .map(inv => {
      const card = activeCards.find(c => c.id === inv.card_id)!;
      return { ...inv, cardName: card?.name ?? "", cardFlag: card?.flag ?? "" };
    }),
  [invoices, activeCards]);

  // ── Aba "Fechadas": fatura mais recente com status=closed por cartão ─────
  // Conceito: fatura cujo ciclo encerrou, total fixado, aguardando pagamento
  const closedList = useMemo(() => activeCards
    .map(card => {
      const cardInvoices = enriched
        .filter(i => i.card_id === card.id && i.status === "closed")
        .sort((a, b) => toYYYYMM(b.competence).localeCompare(toYYYYMM(a.competence)));
      return cardInvoices[0] ?? null;
    })
    .filter(Boolean) as typeof enriched,
  [enriched, activeCards]);

  // ── Aba "Em aberto": primeira fatura open por cartão ────────────────────
  // Conceito: ciclo corrente, despesas acumulando; próxima fatura disponível
  // após a última fechada/paga
  const openList = useMemo(() => activeCards
    .map(card => {
      const cardOpen = enriched
        .filter(i => i.card_id === card.id && i.status === "open")
        .sort((a, b) => toYYYYMM(a.competence).localeCompare(toYYYYMM(b.competence)));
      return cardOpen[0] ?? null;   // primeiro aberto = próxima fatura disponível
    })
    .filter(Boolean) as typeof enriched,
  [enriched, activeCards]);

  // ── Totais consolidados para o cabeçalho (ambas as abas) ─────────────────
  const totalLimit     = useMemo(() => activeCards.reduce((s, c) => s + (c.limit_total ?? 0), 0), [activeCards]);
  const totalClosed    = useMemo(() => closedList.reduce((s, i) => s + i.total_amount, 0), [closedList]);
  const totalOpen      = useMemo(() => openList.reduce((s, i) => s + i.total_amount, 0), [openList]);
  const totalAvailable = Math.max(totalLimit - totalClosed - totalOpen, 0);
  const pct            = totalLimit > 0 ? Math.min(((totalClosed + totalOpen) / totalLimit) * 100, 100) : 0;
  const isHigh         = pct > 80;

  const currentList  = tab === "closed" ? closedList  : openList;
  const currentTotal = tab === "closed" ? totalClosed : totalOpen;

  // ── Card de fatura ────────────────────────────────────────────────────────
  type Inv = (typeof enriched)[0];

  function InvoiceCard({ inv, highlight }: { inv: Inv; highlight?: boolean }) {
    const [mon, yr] = inv.competence.split("/");
    const status    = inv.status as "open" | "closed" | "paid";

    const iconBg:   Record<string, string> = { open: "bg-amber-50",  closed: "bg-slate-100", paid: "bg-emerald-50"  };
    const iconText: Record<string, string> = { open: "text-amber-600", closed: "text-slate-600", paid: "text-emerald-600" };

    return (
      <a href={`/cartoes/${inv.card_id}/fatura/${inv.id}`}
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm transition-all active:scale-[0.98]",
          highlight
            ? "bg-indigo-600 border-indigo-500 text-white"
            : "bg-white dark:bg-card border-slate-100 dark:border-border"
        )}>

        {/* Ícone mês/ano */}
        <div className={cn(
          "flex shrink-0 flex-col items-center justify-center rounded-xl h-12 w-16",
          highlight ? "bg-white/15" : iconBg[status]
        )}>
          <span className={cn("text-[11px] font-bold uppercase leading-none",
            highlight ? "text-white/70" : iconText[status])}>
            {mon.slice(0, 3)}
          </span>
          <span className={cn("text-[18px] font-extrabold leading-tight",
            highlight ? "text-white" : iconText[status])}>
            {yr}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Nome do cartão */}
          <p className={cn("text-[12px] font-semibold truncate",
            highlight ? "text-white/70" : "text-slate-500")}>
            {inv.cardFlag} · {inv.cardName}
          </p>
          {/* Competência + badge na mesma linha */}
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden mt-0.5">
            <p className={cn("text-[15px] font-bold shrink-0",
              highlight ? "text-white" : "text-slate-800 dark:text-foreground")}>
              {inv.competence}
            </p>
            <span className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
              highlight ? "bg-white/20 text-white" : cn(STATUS_BG[status], STATUS_TEXT[status])
            )}>
              {status === "overdue"
                ? <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                : <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])} />}
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className={cn("text-[11px] mt-0.5",
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

      {/* ── CABEÇALHO CONSOLIDADO ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-5 pb-5 text-white"
        style={{ paddingTop:"calc(env(safe-area-inset-top,0px) + 1.25rem)" }}>
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1">
            {activeCards.length} cartão{activeCards.length !== 1 ? "es" : ""} ativo{activeCards.length !== 1 ? "s" : ""}
          </p>
          <h1 className="text-2xl font-extrabold">Faturas de cartão</h1>
        </div>

        {/* Resumo consolidado */}
        <div className="rounded-2xl bg-white/10 p-4 mb-5">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/60">Comprometido</span>
            <span className="text-xs text-white/60">Disponível estimado</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className={cn("text-2xl font-bold", isHigh && "text-red-300")}>
              {fmt(totalClosed + totalOpen)}
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
          {/* Breakdown fechadas / em aberto */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-[11px]">
            <span className="text-white/60">
              🔒 Fechadas a pagar: <span className="font-bold text-white">{fmt(totalClosed)}</span>
            </span>
            <span className="text-white/60">
              📊 Em aberto: <span className="font-bold text-white">{fmt(totalOpen)}</span>
            </span>
          </div>
        </div>

        {/* ── SELETOR DE ABAS ─────────────────────────────────────────── */}
        <div className="flex rounded-2xl bg-white/15 p-1 gap-1">
          {([
            { key: "closed" as Tab, label: "Faturas fechadas", icon: "🔒" },
            { key: "open"   as Tab, label: "Faturas em aberto", icon: "📊" },
          ] as const).map(t => (
            <button key={t.key} type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5",
                "text-[13px] font-bold transition-all",
                tab === t.key
                  ? "bg-white text-indigo-700 shadow"
                  : "text-white/80 hover:text-white"
              )}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO DA ABA ──────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-8">

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {!loading && (
          <>
            {/* Resumo da aba selecionada */}
            {currentList.length > 0 && (
              <div className={cn(
                "flex items-center justify-between rounded-2xl px-4 py-3 mb-4",
                tab === "closed"
                  ? "bg-slate-100 dark:bg-card border border-slate-200"
                  : "bg-amber-50 dark:bg-card border border-amber-100"
              )}>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {tab === "closed" ? "Total a pagar (fechadas)" : "Total acumulado (em aberto)"}
                  </p>
                  <p className={cn("text-xl font-extrabold mt-0.5",
                    tab === "closed" ? "text-slate-700" : "text-amber-700")}>
                    {fmt(currentTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">
                    {currentList.length} cartão{currentList.length !== 1 ? "es" : ""}
                  </p>
                  {tab === "closed" && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Aguardando pagamento</p>
                  )}
                  {tab === "open" && (
                    <p className="text-[11px] text-amber-600 mt-0.5">Próxima fatura disponível</p>
                  )}
                </div>
              </div>
            )}

            {/* Lista de faturas */}
            {currentList.length > 0 ? (
              <div className="space-y-2.5">
                {currentList.map((inv, idx) => (
                  <InvoiceCard key={inv.id} inv={inv} highlight={idx === 0 && tab === "closed"} />
                ))}
              </div>
            ) : (
              /* Estado vazio por aba */
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-14 text-center">
                {tab === "closed" ? (
                  <>
                    <Lock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma fatura fechada</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Faturas fecham automaticamente na data de encerramento de cada cartão
                    </p>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma fatura em aberto</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Todas as faturas foram encerradas ou pagas
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
