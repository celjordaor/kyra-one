import { createFileRoute, useRouter, Outlet, useChildMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, ChevronRight, Settings, AlertCircle } from "lucide-react";
import { useCardStore } from "@/lib/card-store";
import { EditCardSheet } from "@/components/cartoes/edit-card-sheet";
import { useLimitUsed } from "@/hooks/use-limit-used";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/$cardId")({
  component: CartaoDetailPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Utilitários de data ────────────────────────────────────────────────────
function toYYYYMM(competence: string): string {
  const [mm, yyyy] = competence.split("/");
  return `${yyyy}-${mm}`;
}

function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Estilos por status ─────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  open:    "bg-amber-400",
  closed:  "bg-slate-400",
  paid:    "bg-emerald-400",
  overdue: "bg-red-400",
};
const STATUS_TEXT: Record<string, string> = {
  open:    "text-amber-700",
  closed:  "text-slate-600",
  paid:    "text-emerald-700",
  overdue: "text-red-700",
};
const STATUS_BG: Record<string, string> = {
  open:    "bg-amber-50",
  closed:  "bg-slate-100",
  paid:    "bg-emerald-50",
  overdue: "bg-red-50",
};
const STATUS_LABEL: Record<string, string> = {
  open:    "Em aberto",
  closed:  "Fechada",
  paid:    "Paga",
  overdue: "Em atraso",
};

function CartaoDetailPage() {
  const { cardId } = Route.useParams();
  const router = useRouter();
  const childMatches = useChildMatches();

  if (childMatches.length > 0) return <Outlet />;

  const [showEdit, setShowEdit] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false); // próximas faturas colapsadas por padrão
  const { cards, invoices, fetchCards, fetchInvoices, ensureInvoices } = useCardStore();
  const { limitUsed } = useLimitUsed(cardId);

  const card = cards.find(c => c.id === cardId);

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
  const now       = currentYYYYMM();

  const cardInvoices = invoices.filter(i => i.card_id === cardId);

  // ── Seção 1: Fatura atual + inadimplentes anteriores ──────────────────────
  // Inclui: fatura do mês atual (aberta) + faturas de meses anteriores não pagas
  const currentAndOverdue = cardInvoices
    .filter(inv => {
      const ym = toYYYYMM(inv.competence);
      const isPast    = ym < now;
      const isCurrent = ym === now;
      const isUnpaid  = inv.status === "open" || inv.status === "closed";
      return isCurrent || (isPast && isUnpaid);
    })
    .sort((a, b) => toYYYYMM(b.competence).localeCompare(toYYYYMM(a.competence))); // mais recente primeiro

  // ── Seção 2: Próximas faturas ────────────────────────────────────────────
  // Faturas com competência > mês atual, ordenadas asc (mais próxima primeiro)
  const upcoming = cardInvoices
    .filter(inv => toYYYYMM(inv.competence) > now)
    .sort((a, b) => toYYYYMM(a.competence).localeCompare(toYYYYMM(b.competence)));

  // ── Card de fatura ────────────────────────────────────────────────────────
  function InvoiceCard({ invoice, highlight = false }: {
    invoice: typeof cardInvoices[0];
    highlight?: boolean;
  }) {
    const ym      = toYYYYMM(invoice.competence);
    const isPast  = ym < now;
    const rawStatus = invoice.status as "open" | "closed" | "paid";
    const status  = isPast && rawStatus === "open" ? "overdue" : rawStatus;
    const [mon, yr] = invoice.competence.split("/");

    // Cores do ícone por status
    const iconBg: Record<string, string> = {
      open:    "bg-amber-50",
      overdue: "bg-red-50",
      closed:  "bg-slate-100",
      paid:    "bg-emerald-50",
    };
    const iconText: Record<string, string> = {
      open:    "text-amber-600",
      overdue: "text-red-600",
      closed:  "text-slate-600",
      paid:    "text-emerald-600",
    };

    return (
      <a
        key={invoice.id}
        href={`/cartoes/${card.id}/fatura/${invoice.id}`}
        className={cn(
          "flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-sm",
          "transition-all active:scale-[0.98]",
          highlight
            ? "bg-indigo-600 border-indigo-500 text-white"
            : "bg-white dark:bg-card border-slate-100 dark:border-border"
        )}>

        {/* Ícone mês/ano — compacto, mesma linha */}
        <div className={cn(
          "flex shrink-0 flex-col items-center justify-center rounded-xl",
          "h-12 w-16",
          highlight ? "bg-white/15" : iconBg[status]
        )}>
          <span className={cn(
            "text-[11px] font-bold uppercase leading-none",
            highlight ? "text-white/70" : iconText[status]
          )}>
            {mon.slice(0, 3)}
          </span>
          <span className={cn(
            "text-[18px] font-extrabold leading-tight",
            highlight ? "text-white" : iconText[status]
          )}>
            {yr}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Competência + badge — na mesma linha, sem quebra */}
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden">
            <p className={cn(
              "text-[16px] font-bold shrink-0",
              highlight ? "text-white" : "text-slate-800 dark:text-foreground"
            )}>
              {invoice.competence}
            </p>
            <span className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5",
              "text-[10px] font-bold whitespace-nowrap",
              highlight
                ? "bg-white/20 text-white"
                : cn(STATUS_BG[status], STATUS_TEXT[status])
            )}>
              {status === "overdue" && <AlertCircle className="h-2.5 w-2.5 shrink-0" />}
              {!["overdue"].includes(status) && (
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[status])} />
              )}
              {STATUS_LABEL[status]}
            </span>
          </div>

          <p className={cn(
            "text-xs mt-0.5 truncate",
            highlight ? "text-white/60" : "text-slate-400 dark:text-muted-foreground"
          )}>
            Vence {new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <p className={cn(
            "text-[15px] font-bold",
            highlight ? "text-white" : "text-slate-800 dark:text-foreground"
          )}>
            {fmt(invoice.total_amount)}
          </p>
          <ChevronRight className={cn(
            "h-4 w-4",
            highlight ? "text-white/60" : "text-slate-400"
          )} />
        </div>
      </a>
    );
  }

  return (
    <div className="w-screen max-w-[100vw] overflow-x-hidden min-h-screen bg-slate-50 dark:bg-background md:w-full md:max-w-2xl md:mx-auto md:overflow-x-visible">

      {/* HEADER */}
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

        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <span className="text-2xl font-bold">{(card.flag?.[0] ?? "C").toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/50">Cartão de crédito</p>
            <p className="text-xl font-bold leading-tight truncate">{card.name}</p>
            <p className="text-sm text-white/70">{card.flag} · {card.bank}</p>
          </div>
        </div>

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

      {/* BOTÃO NOVA DESPESA */}
      <div className="px-4 -mt-5 mb-5">
        <button
          onClick={() => router.navigate({ to: "/cartoes/nova-despesa", search: { cardId: card.id } })}
          className="flex w-full h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-white font-semibold text-sm shadow-lg transition-all active:scale-95"
          style={{ boxShadow: "0 8px 20px #4f46e544" }}>
          <Plus className="h-4 w-4" /> Lançar despesa
        </button>
      </div>

      {/* LISTAS DE FATURAS */}
      <div className="px-4 pb-8 space-y-6">

        {/* ── FATURA ATUAL + EM ATRASO ──────────────────────────────── */}
        {currentAndOverdue.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
              Fatura atual
            </p>
            <div className="space-y-2.5">
              {currentAndOverdue.map((inv, idx) => (
                <InvoiceCard key={inv.id} invoice={inv} highlight={idx === 0} />
              ))}
            </div>
          </div>
        )}

        {/* ── PRÓXIMAS FATURAS ──────────────────────────────────────── */}
        {upcoming.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowUpcoming(o => !o)}
              className="flex w-full items-center justify-between mb-2.5"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Próximas faturas
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  {upcoming.length} fatura{upcoming.length !== 1 ? "s" : ""}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`text-slate-400 transition-transform duration-300 ${showUpcoming ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${showUpcoming ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="space-y-2.5">
                  {upcoming.map(inv => (
                    <InvoiceCard key={inv.id} invoice={inv} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {currentAndOverdue.length === 0 && upcoming.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-10 text-center text-sm text-slate-400 dark:text-muted-foreground">
            Nenhuma fatura disponível.
          </div>
        )}
      </div>

      {showEdit && <EditCardSheet card={card} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
