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
  open: "Em aberto", closed: "Fechada", paid: "Quitada", overdue: "Em atraso",
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

  // ── Aba "Fechadas": fatura mais recente não-aberta por cartão ──────────
  // Inclui "closed" (aguardando pagamento) e "paid" (já quitada)
  // Lógica: para cada cartão, pega a fatura mais recente que não está em aberto
  const closedList = useMemo(() => activeCards
    .map(card => {
      const cardNonOpen = enriched
        .filter(i => i.card_id === card.id && i.status !== "open")
        .sort((a, b) => toYYYYMM(b.competence).localeCompare(toYYYYMM(a.competence)));
      return cardNonOpen[0] ?? null;   // mais recente fechada ou paga
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
  // Faturas fechadas (a pagar) vs quitadas
  const closedToPay  = useMemo(() => closedList.filter(i => i.status === "closed"), [closedList]);
  const closedPaid   = useMemo(() => closedList.filter(i => i.status === "paid"),   [closedList]);
  const totalClosed  = useMemo(() => closedList.reduce((s, i) => s + i.total_amount, 0), [closedList]);
  const totalToPay   = useMemo(() => closedToPay.reduce((s, i) => s + i.total_amount, 0), [closedToPay]);
  const totalPaid    = useMemo(() => closedPaid.reduce((s, i) => s + i.total_amount, 0), [closedPaid]);
  const totalOpen      = useMemo(() => openList.reduce((s, i) => s + i.total_amount, 0), [openList]);
  const totalAvailable = Math.max(totalLimit - totalClosed - totalOpen, 0);
  const pct            = totalLimit > 0 ? Math.min(((totalClosed + totalOpen) / totalLimit) * 100, 100) : 0;
  const isHigh         = pct > 80;

  const currentList  = tab === "closed" ? closedList  : openList;
  const currentTotal = tab === "closed" ? totalClosed : totalOpen;

  // ── Card de fatura ────────────────────────────────────────────────────────
  type Inv = (typeof enriched)[0];

  function InvoiceCard({ inv, highlight }: { inv: Inv; highlight?: boolean }) {
    const status  = inv.status as "open" | "closed" | "paid";
    const dueDate = new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR");

    // Cor de fundo do card
    const cardBg = highlight && status === "paid"
      ? "bg-emerald-600 border-emerald-500"
      : highlight
      ? "bg-indigo-600 border-indigo-500"
      : "bg-white dark:bg-card border-slate-100 dark:border-border";

    // Cor do ícone do cartão (baseada na bandeira)
    const flagColors: Record<string, string> = {
      Visa:       "#1a1f71", Mastercard: "#eb001b", Amex: "#007bc1",
      Elo:        "#ffcb05", Hipercard:  "#cc0000",
    };
    const flagBg = flagColors[inv.cardFlag] ?? "#4f46e5";

    // Pills de status
    const pillBg: Record<string, string> = {
      open:    highlight ? "bg-white/20 text-white"        : "bg-amber-50 text-amber-700",
      closed:  highlight ? "bg-white/20 text-white"        : "bg-slate-100 text-slate-600",
      paid:    highlight ? "bg-white/20 text-white"        : "bg-emerald-50 text-emerald-700",
      overdue: highlight ? "bg-red-400/30 text-white"      : "bg-red-50 text-red-700",
    };

    return (
      <a href={`/cartoes/${inv.card_id}/fatura/${inv.id}`}
        className={cn(
          "block rounded-2xl border shadow-sm transition-all active:scale-[0.98]",
          "px-4 pt-4 pb-3.5",
          cardBg
        )}>

        {/* ── Linha 1: ícone cartão + nome em destaque + valor ── */}
        <div className="flex items-center gap-3 mb-3">
          {/* Ícone da bandeira */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-extrabold text-white"
            style={{ background: highlight ? "rgba(255,255,255,0.2)" : flagBg }}>
            {(inv.cardFlag?.[0] ?? "C").toUpperCase()}
          </div>

          {/* Nome do cartão — elemento principal */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-[18px] font-extrabold leading-tight truncate",
              highlight ? "text-white" : "text-slate-800 dark:text-foreground"
            )}>
              {inv.cardName}
            </p>
            <p className={cn(
              "text-[12px] font-medium",
              highlight ? "text-white/60" : "text-slate-400"
            )}>
              {inv.cardFlag}
            </p>
          </div>

          {/* Valor + chevron */}
          <div className="flex shrink-0 items-center gap-1">
            <p className={cn(
              "text-[18px] font-extrabold",
              highlight ? "text-white" : "text-slate-800 dark:text-foreground"
            )}>
              {fmt(inv.total_amount)}
            </p>
            <ChevronRight className={cn("h-4 w-4 shrink-0",
              highlight ? "text-white/50" : "text-slate-400")} />
          </div>
        </div>

        {/* ── Linha 2: Pills (competência · status · vencimento) ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Pill competência (mês/ano) */}
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            highlight ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          )}>
            {inv.competence}
          </span>

          {/* Pill status */}
          <span className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
            pillBg[status] ?? pillBg.open
          )}>
            {status === "overdue"
              ? <AlertCircle className="h-2.5 w-2.5 shrink-0" />
              : <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])} />}
            {STATUS_LABEL[status]}
          </span>

          {/* Pill vencimento */}
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px]",
            highlight ? "text-white/60" : "text-slate-400"
          )}>
            Vence {dueDate}
          </span>
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
              🔒 A pagar: <span className="font-bold text-white">{fmt(totalToPay)}</span>
            </span>
            <span className="text-white/60">
              ✅ Quitadas: <span className="font-bold text-emerald-300">{fmt(totalPaid)}</span>
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
            {currentList.length > 0 && tab === "closed" && (
              <div className="rounded-2xl border border-slate-200 bg-white dark:bg-card mb-4 overflow-hidden">
                {closedToPay.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">A pagar</p>
                      <p className="text-lg font-extrabold text-slate-700 mt-0.5">{fmt(totalToPay)}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {closedToPay.length} fatura{closedToPay.length !== 1 ? "s" : ""} fechada{closedToPay.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                )}
                {closedPaid.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Quitadas</p>
                      <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmt(totalPaid)}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                        {closedPaid.length} fatura{closedPaid.length !== 1 ? "s" : ""} quitada{closedPaid.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {currentList.length > 0 && tab === "open" && (
              <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500">Acumulado em aberto</p>
                  <p className="text-lg font-extrabold text-amber-700 mt-0.5">{fmt(currentTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">
                    {currentList.length} cartão{currentList.length !== 1 ? "es" : ""}
                  </p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Próxima fatura disponível</p>
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
