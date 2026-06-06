import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Circle,
  Pencil, Repeat, Trash2, CreditCard, Lock, Plus, Receipt,
  ChevronDown, LayoutList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useTransactions, toggleSettled, updateTransaction, deleteTransaction,
  parseBrDate, formatBrDate, isTodayOrPast, type Transaction,
} from "@/lib/transactions-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/transacoes")({
  head: () => ({ meta: [{ title: "Transações — Finanças Pessoais" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === "string" ? search.month : undefined,
  }),
  component: TransacoesPage,
});

function isFaturaTransaction(t: Transaction): boolean {
  return t.source === "invoice";
}

function brDateToIso(br: string): string {
  const [dd, mm, yyyy] = br.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const FILTER_OPTIONS = [
  { key: "Todas",    label: "Todas",    Icon: LayoutList,  activeClass: "bg-primary text-primary-foreground",  iconClass: "" },
  { key: "Receitas", label: "Receitas", Icon: TrendingUp,  activeClass: "bg-emerald-500 text-white",           iconClass: "text-emerald-500" },
  { key: "Despesas", label: "Despesas", Icon: TrendingDown,activeClass: "bg-red-500 text-white",               iconClass: "text-red-500" },
  { key: "Faturas",  label: "Faturas",  Icon: CreditCard,  activeClass: "bg-blue-500 text-white",              iconClass: "text-blue-500" },
] as const;
type ActiveFilter = (typeof FILTER_OPTIONS)[number]["key"];

const statusFilters = ["Todas", "Pagas/Recebidas", "Pendentes"] as const;
type StatusFilter = (typeof statusFilters)[number];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc";
const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Data (mais recente)", "date-asc": "Data (mais antiga)",
  "amount-desc": "Valor (maior)", "amount-asc": "Valor (menor)", "title-asc": "Título (A–Z)",
};

// ── Cabeçalho de seção colapsável ──────────────────────────────────────
function SectionHeader({
  title, count, countColor = "bg-muted-foreground/20 text-muted-foreground",
  open, onToggle, right,
}: {
  title: string; count?: number; countColor?: string;
  open: boolean; onToggle: () => void; right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl bg-muted/60 px-4 py-2.5 transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {count !== undefined && (
          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${countColor}`}>
            {count}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </div>
    </button>
  );
}

function TransacoesPage() {
  const router = useRouter();
  const { month: monthParam } = Route.useSearch();
  const now = new Date();
  const today = new Date(); today.setHours(0,0,0,0);

  const initial = (() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      return { month: m - 1, year: y };
    }
    return { month: now.getMonth(), year: now.getFullYear() };
  })();

  const allTransactions = useTransactions();
  const { cards, invoices, expenses, installments, fetchCards, fetchInvoices, fetchExpenses, fetchInstallments } = useCardStore();

  const [search, setSearch]               = useState("");
  const [activeFilter, setActiveFilter]   = useState<ActiveFilter>("Todas");
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("Todas");
  const [selectedMonth, setSelectedMonth] = useState<number>(initial.month);
  const [selectedYear, setSelectedYear]   = useState<number>(initial.year);
  const [sort, setSort]                   = useState<SortKey>("date-desc");
  const [editingId, setEditingId]         = useState<string | null>(null);

  // Seções colapsáveis
  const [showTransactions, setShowTransactions] = useState(true);
  const [showCards, setShowCards]               = useState(true);

  // Modal de fatura
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailCard, setDetailCard]       = useState<CreditCardType | null>(null);

  const editing = useMemo(
    () => allTransactions.find(t => t.id === editingId) ?? null,
    [allTransactions, editingId]
  );

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Carregar cartões e suas faturas
  useEffect(() => { fetchCards(); }, []);
  useEffect(() => { cards.forEach(c => fetchInvoices(c.id)); }, [cards.length]);

  const goPrevMonth = () => { if (selectedMonth===0){setSelectedMonth(11);setSelectedYear(y=>y-1);}else setSelectedMonth(m=>m-1); };
  const goNextMonth = () => { if (selectedMonth===11){setSelectedMonth(0);setSelectedYear(y=>y+1);}else setSelectedMonth(m=>m+1); };

  // ── Transações regulares (excluir faturas) ────────────────────────────
  const filteredRegular = useMemo(() => allTransactions
    .filter(t => {
      if (isFaturaTransaction(t)) return false;
      if (activeFilter === "Faturas") return false; // faturas ficam só na seção própria
      const date = parseBrDate(t.date);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear
        && t.title.toLowerCase().includes(search.toLowerCase())
        && (activeFilter === "Todas" || (activeFilter === "Receitas" && t.type === "income") || (activeFilter === "Despesas" && t.type === "expense"))
        && (statusFilter === "Todas" || (statusFilter === "Pagas/Recebidas" && t.settled) || (statusFilter === "Pendentes" && !t.settled));
    })
    .sort((a, b) => {
      switch (sort) {
        case "date-desc": return parseBrDate(b.date).getTime() - parseBrDate(a.date).getTime();
        case "date-asc":  return parseBrDate(a.date).getTime() - parseBrDate(b.date).getTime();
        case "amount-desc": return Math.abs(b.amount) - Math.abs(a.amount);
        case "amount-asc":  return Math.abs(a.amount) - Math.abs(b.amount);
        case "title-asc":   return a.title.localeCompare(b.title);
      }
    }), [allTransactions, selectedMonth, selectedYear, search, activeFilter, statusFilter, sort]
  );

  // ── Faturas do cartão no mês selecionado ──────────────────────────────
  const cardInvoices = useMemo(() =>
    invoices.filter(inv => {
      if (inv.total_amount <= 0) return false;
      const due = new Date(inv.due_date + "T12:00:00");
      return due.getMonth() === selectedMonth && due.getFullYear() === selectedYear;
    }).map(inv => ({ invoice: inv, card: cards.find(c => c.id === inv.card_id) }))
      .filter(item => item.card?.active),
    [invoices, cards, selectedMonth, selectedYear]
  );

  const totalBalance = filteredRegular.reduce((s, t) => s + t.amount, 0);

  const openDetail = async (invoice: Invoice, card: CreditCardType) => {
    setDetailInvoice(invoice);
    setDetailCard(card);
    await fetchExpenses(invoice.id);
    await fetchInstallments(invoice.id);
  };

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold text-foreground">Transações</h1>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-2 shadow-sm">
        <button onClick={goPrevMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
          {isCurrentMonth && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Mês atual</span>}
        </div>
        <button onClick={goNextMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar transação..." className="h-10 pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {filters.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sort} onValueChange={v => setSort(v as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                <DropdownMenuRadioItem key={key} value={key}>{SORT_LABELS[key]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtros de status — oculto no filtro Faturas */}
      {activeFilter !== "Faturas" && <div className="flex items-center gap-2">
        {statusFilters.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {f === "Pagas/Recebidas" && <CheckCircle2 className="h-3 w-3" />}
            {f === "Pendentes" && <Circle className="h-3 w-3" />}
            {f}
          </button>
        ))}
      </div>

      {/* Resumo */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">
            {activeFilter === "Faturas" ? "Total em faturas" : "Total do período"}
          </p>
          <p className={cn("text-lg font-bold", activeFilter === "Faturas" ? "text-blue-500" : "text-foreground")}>
            {activeFilter === "Faturas"
              ? `-${fmt(cardInvoices.reduce((s, i) => s + i.invoice.total_amount, 0))}`
              : fmt(totalBalance)
            }
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {activeFilter === "Faturas"
            ? `${cardInvoices.length} fatura(s)`
            : `${filteredRegular.length} transações`
          }
        </p>
      </div>

      {/* ══ SEÇÃO 1: Transações regulares ══ */}
      {activeFilter !== "Faturas" && <SectionHeader
        title="Receitas e Despesas"
        count={filteredRegular.length}
        countColor="bg-primary/10 text-primary"
        open={showTransactions}
        onToggle={() => setShowTransactions(v => !v)}
      />

      {showTransactions && (
        <div className="space-y-2">
          {filteredRegular.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
              Nenhuma transação encontrada para este período.
            </div>
          ) : filteredRegular.map(t => {
            const isFuture  = parseBrDate(t.date).getTime() > today.getTime();
            const isFatura  = isFaturaTransaction(t);
            const statusLabel = t.type === "income" ? "Recebida" : "Paga";

            return (
              <div key={t.id}
                className={`flex items-center justify-between rounded-xl border p-3 shadow-sm ${t.settled ? "bg-settled" : "bg-pending"}`}>
                <div className="flex items-center gap-3">
                  {/* Ícone: 💳 azul para fatura, normal para o resto */}
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    isFatura ? "bg-blue-100" : t.type === "income" ? "bg-emerald-100" : "bg-red-100"
                  )}>
                    {isFatura
                      ? <CreditCard className="h-4 w-4 text-blue-500" />
                      : t.type === "income"
                      ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                      : <TrendingDown className="h-4 w-4 text-red-500" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      {t.recurring && !isFatura && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><Repeat className="h-3 w-3 text-muted-foreground" /></span>
                          </TooltipTrigger>
                          <TooltipContent>Recorrente</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.category} • {t.date}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-semibold", isFatura ? "text-blue-500" : t.type === "income" ? "text-emerald-600" : "text-red-500")}>
                      {t.type === "income" ? "+" : ""}{fmt(Math.abs(t.amount))}
                    </p>

                    {/* Fatura: só cadeado */}
                    {isFatura ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground/50 cursor-default">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[180px] text-center text-xs">
                          Gerada pelo pagamento de fatura. Estorne pela tela de faturas.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <button
                          onClick={() => !isFuture && toggleSettled(t.id)} disabled={isFuture}
                          className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                            isFuture ? "cursor-not-allowed text-muted-foreground/40"
                            : t.settled ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                            : "border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                          )}>
                          {t.settled ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditingId(t.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => !t.settled && deleteTransaction(t.id)} disabled={t.settled}
                          className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                            t.settled ? "cursor-not-allowed text-muted-foreground/30" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          )}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  {t.settled && t.paidAt && (
                    <p className="text-[10px] font-medium text-emerald-600">
                      {t.type === "income" ? "Recebido" : "Pago"} em {t.paidAt}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      }

      {/* ══ SEÇÃO 2: Cartões de Crédito ══ */}
      {cardInvoices.length > 0 && (activeFilter === "Todas" || activeFilter === "Faturas") && (
        <>
          <SectionHeader
            title="Cartões de Crédito"
            count={cardInvoices.length}
            countColor="bg-blue-100 text-blue-600"
            open={showCards}
            onToggle={() => setShowCards(v => !v)}
            right={
              <span className="text-xs text-muted-foreground mr-1">
                {fmt(cardInvoices.reduce((s, i) => s + i.invoice.total_amount, 0))}
              </span>
            }
          />

          {showCards && (
            <div className="space-y-2">
              {cardInvoices.map(({ invoice, card }) => {
                if (!card) return null;
                const isPaid = invoice.status === "paid";
                return (
                  <div key={invoice.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3 shadow-sm",
                      isPaid ? "bg-card border-border" : "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40"
                    )}>
                    <div className="flex min-w-0 items-center gap-3">
                      {/* 💳 azul */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {isPaid ? "Paga" : "Em aberto"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.competence} • Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="shrink-0 text-sm font-semibold text-red-500">
                        -{fmt(invoice.total_amount)}
                      </p>
                      {/* Botão detalhar */}
                      <button
                        onClick={() => openDetail(invoice, card)}
                        title="Ver despesas desta fatura"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400 text-blue-500 hover:bg-blue-500/10 transition-colors"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes da fatura */}
      <InvoiceDetailModal
        invoice={detailInvoice}
        card={detailCard}
        expenses={expenses.filter(e => e.invoice_id === detailInvoice?.id)}
        installments={installments.filter(i => i.invoice_id === detailInvoice?.id)}
        open={!!detailInvoice}
        onClose={() => { setDetailInvoice(null); setDetailCard(null); }}
        onAddExpense={() => {
          const cardId = detailCard?.id;
          setDetailInvoice(null); setDetailCard(null);
          router.navigate({ to: "/cartoes/nova-despesa", search: { cardId } });
        }}
      />

      <EditTransactionDialog transaction={editing} onClose={() => setEditingId(null)} />
    </div>
  );
}

// ── Modal de detalhes da fatura ────────────────────────────────────────
function InvoiceDetailModal({
  invoice, card, expenses, installments, open, onClose, onAddExpense,
}: {
  invoice: Invoice | null; card: CreditCardType | null;
  expenses: ReturnType<typeof useCardStore.getState>["expenses"];
  installments: ReturnType<typeof useCardStore.getState>["installments"];
  open: boolean; onClose: () => void; onAddExpense: () => void;
}) {
  if (!invoice || !card) return null;
  const isPaid = invoice.status === "paid";

  const allItems = [
    ...expenses.map(e => ({ id:e.id, description:e.description, amount:e.amount, category:e.category, date:e.purchase_date })),
    ...installments.map(i => ({ id:i.id, description:i.description, amount:i.amount, category:i.category, date:i.purchase_date })),
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-5 pt-5 pb-4 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground">Fatura {card.name}</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {invoice.competence} • Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-3 text-2xl font-bold">{fmt(invoice.total_amount)}</p>
          <span className={cn(
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold",
            isPaid ? "bg-emerald-400/30 text-emerald-100" : "bg-amber-400/30 text-amber-100"
          )}>
            {isPaid ? "Paga" : "Em aberto"}
          </span>
        </div>

        {/* Lista */}
        <div className="max-h-72 overflow-y-auto">
          {allItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa lançada nesta fatura.</p>
          ) : (
            <div className="divide-y">
              {allItems.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} • {new Date(item.date+"T12:00:00").toLocaleDateString("pt-BR",{ day:"2-digit", month:"short" })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-red-500">-{fmt(item.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          {!isPaid && (
            <button onClick={onAddExpense} title="Adicionar despesa nesta fatura"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-all hover:shadow-lg hover:shadow-primary/30">
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog de edição ───────────────────────────────────────────────────
function EditTransactionDialog({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const categories = useCategories();
  const [title, setTitle]             = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [type, setType]               = useState<"income"|"expense">("expense");
  const [category, setCategory]       = useState("");
  const [dateIso, setDateIso]         = useState("");
  const [settled, setSettled]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const open = transaction !== null;

  useEffect(() => {
    if (!transaction) return;
    setTitle(transaction.title); setType(transaction.type);
    setCategory(transaction.category); setDateIso(brDateToIso(transaction.date));
    setSettled(transaction.settled);
    const abs = Math.abs(transaction.amount);
    setAmountValue(abs.toFixed(2));
    setAmountDisplay(abs.toLocaleString("pt-BR",{ minimumFractionDigits:2, maximumFractionDigits:2 }));
    setError(null);
  }, [transaction]);

  const isFuture = dateIso ? !isTodayOrPast(dateIso) : false;
  const availableCategories = categories.filter(c => c.active && c.type === type);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g,"");
    if (!digits) { setAmountDisplay(""); setAmountValue(""); return; }
    const value = (parseInt(digits,10)/100).toFixed(2);
    setAmountValue(value);
    setAmountDisplay(parseFloat(value).toLocaleString("pt-BR",{ minimumFractionDigits:2, maximumFractionDigits:2 }));
  }

  function handleSave() {
    if (!transaction) return;
    if (!title.trim()) return setError("Descrição é obrigatória");
    if (!amountValue) return setError("Valor é obrigatório");
    if (!category) return setError("Categoria é obrigatória");
    if (!dateIso) return setError("Data é obrigatória");
    const numeric = parseFloat(amountValue);
    const signed = type==="expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y,m,d] = dateIso.split("-").map(Number);
    const brDate = formatBrDate(new Date(y,m-1,d));
    const todayStr = formatBrDate(new Date());
    const paidAt = settled ? (transaction.settled?(transaction.paidAt??todayStr):todayStr) : undefined;
    updateTransaction(transaction.id,{ title:title.trim(), amount:signed, type, category, date:brDate, settled, paidAt });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar transação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(["expense","income"] as const).map(tp => (
              <button key={tp} type="button" onClick={() => setType(tp)}
                className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all",
                  type===tp ? `bg-card shadow-sm ${tp==="expense"?"text-red-500":"text-emerald-600"}` : "text-muted-foreground"
                )}>
                {tp==="expense" ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                {tp==="expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input inputMode="decimal" className="h-11 pl-9 font-semibold" value={amountDisplay} onChange={e => handleAmountChange(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => (
                <button key={cat.id} type="button" onClick={() => setCategory(cat.name)}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    category===cat.name ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={dateIso} onChange={e => setDateIso(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">{type==="income"?"Recebida":"Paga"}</p>
              <p className="text-xs text-muted-foreground">{isFuture?"Antecipar efetivação":"Marca como concluída na data de hoje"}</p>
            </div>
            <Switch checked={settled} onCheckedChange={setSettled} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
