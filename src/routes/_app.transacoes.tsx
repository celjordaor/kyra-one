import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Circle,
  Pencil, Repeat, Repeat2, Trash2, CreditCard, Lock, Plus, Receipt,
  ChevronDown, LayoutList, X, Eye,
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
  deleteTransactionSeries, isInstallmentTransaction, getDisplayTitle,
  parseBrDate, formatBrDate, isTodayOrPast, type Transaction,
} from "@/lib/transactions-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/cartoes/date-picker";
import {
  ExpenseDetailModal, ExpenseActionButton,
  TYPE_CLASS, TYPE_LABEL, fmt as fmtExp,
  type UnifiedItem, type InvoiceStatus,
} from "@/components/cartoes/expense-detail-modal";
import { ScopeBottomSheet } from "@/components/scope-bottom-sheet";

export const Route = createFileRoute("/_app/transacoes")({
  head: () => ({ meta: [{ title: "TransaÃ§Ãµes â€” FinanÃ§as Pessoais" }] }),
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

// â”€â”€ Pills de filtro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FILTER_OPTIONS = [
  { key: "Todas",    label: "Todas",    Icon: LayoutList,  activeClass: "bg-primary text-primary-foreground",  iconClass: "text-muted-foreground" },
  { key: "Receitas", label: "Receitas", Icon: TrendingUp,  activeClass: "bg-emerald-500 text-white",           iconClass: "text-emerald-500" },
  { key: "Despesas", label: "Despesas", Icon: TrendingDown,activeClass: "bg-red-500 text-white",               iconClass: "text-red-500" },
  { key: "Faturas",  label: "Faturas",  Icon: CreditCard,  activeClass: "bg-blue-500 text-white",              iconClass: "text-blue-500" },
] as const;
type ActiveFilter = (typeof FILTER_OPTIONS)[number]["key"];

const STATUS_FILTER_OPTIONS = [
  { key: "Todas",           label: "Todas",           Icon: LayoutList,   activeClass: "bg-foreground text-background",  iconClass: "text-muted-foreground" },
  { key: "Pagas/Recebidas", label: "Pagas/Recebidas", Icon: CheckCircle2, activeClass: "bg-emerald-500 text-white",      iconClass: "text-emerald-500" },
  { key: "Pendentes",       label: "Pendentes",        Icon: Circle,       activeClass: "bg-amber-500 text-white",        iconClass: "text-amber-500" },
] as const;
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]["key"];

const MONTHS = ["Janeiro","Fevereiro","MarÃ§o","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc";
const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Data (mais recente)", "date-asc": "Data (mais antiga)",
  "amount-desc": "Valor (maior)", "amount-asc": "Valor (menor)", "title-asc": "TÃ­tulo (Aâ€“Z)",
};

// â”€â”€ CabeÃ§alho colapsÃ¡vel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SectionHeader({
  title, count, countColor = "bg-muted-foreground/20 text-muted-foreground",
  open, onToggle, right,
}: {
  title: string; count?: number; countColor?: string;
  open: boolean; onToggle: () => void; right?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl bg-muted/60 px-4 py-2.5 transition-colors hover:bg-muted">
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
  const [deleteTarget, setDeleteTarget]   = useState<Transaction | null>(null);
  const [editScopeTarget, setEditScopeTarget] = useState<Transaction | null>(null);
  const [bulkEdit, setBulkEdit]               = useState(false);
  const [showTransactions, setShowTransactions] = useState(true);
  const [showCards, setShowCards]               = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailCard, setDetailCard]       = useState<CreditCardType | null>(null);

  const editing = useMemo(
    () => allTransactions.find(t => t.id === editingId) ?? null,
    [allTransactions, editingId]
  );

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  useEffect(() => { fetchCards(); }, []);
  useEffect(() => { cards.forEach(c => fetchInvoices(c.id)); }, [cards.length]);

  const goPrevMonth = () => { if (selectedMonth===0){setSelectedMonth(11);setSelectedYear(y=>y-1);}else setSelectedMonth(m=>m-1); };
  const goNextMonth = () => { if (selectedMonth===11){setSelectedMonth(0);setSelectedYear(y=>y+1);}else setSelectedMonth(m=>m+1); };

  // â”€â”€ TransaÃ§Ãµes regulares â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredRegular = useMemo(() => {
    if (activeFilter === "Faturas") return [];
    return allTransactions
      .filter(t => {
        if (isFaturaTransaction(t)) return false;
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
      });
  }, [allTransactions, selectedMonth, selectedYear, search, activeFilter, statusFilter, sort]);

  // â”€â”€ Faturas do mÃªs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cardInvoices = useMemo(() =>
    invoices.filter(inv => {
      if (inv.total_amount <= 0) return false;
      const due = new Date(inv.due_date + "T12:00:00");
      if (!(due.getMonth() === selectedMonth && due.getFullYear() === selectedYear)) return false;
      // Filtro de status aplicado Ã s faturas
      if (statusFilter === "Pagas/Recebidas" && inv.status !== "paid") return false;
      if (statusFilter === "Pendentes" && inv.status !== "open") return false;
      // Busca por nome do cartÃ£o quando filtro Faturas ativo
      if (activeFilter === "Faturas" && search) {
        const card = cards.find(c => c.id === inv.card_id);
        return card?.name.toLowerCase().includes(search.toLowerCase()) ?? false;
      }
      return true;
    })
    .map(inv => ({ invoice: inv, card: cards.find(c => c.id === inv.card_id) }))
    .filter(item => item.card?.active),
    [invoices, cards, selectedMonth, selectedYear, activeFilter, search, statusFilter]
  );

  const showCardSection = activeFilter === "Todas" || activeFilter === "Faturas";
  const showRegularSection = activeFilter !== "Faturas";

  // Realizado: apenas transaÃ§Ãµes quitadas/recebidas
  const settledBalance = filteredRegular
    .filter(t => t.settled)
    .reduce((s, t) => s + t.amount, 0);

  // Previsto: transaÃ§Ãµes nÃ£o quitadas ainda
  const pendingBalance = filteredRegular
    .filter(t => !t.settled)
    .reduce((s, t) => s + t.amount, 0);

  // Para compatibilidade com o cÃ³digo existente
  const totalBalance = settledBalance;
  const totalFaturas = cardInvoices.reduce((s, i) => s + i.invoice.total_amount, 0);

  const openDetail = async (invoice: Invoice, card: CreditCardType) => {
    setDetailInvoice(invoice); setDetailCard(card);
    await fetchExpenses(invoice.id);
    await fetchInstallments(invoice.id);
  };

  return (
    <div className="space-y-4 md:p-8 md:max-w-3xl md:mx-auto" style={{ width: "100%", maxWidth: "100%", overflowX: "hidden", padding: "1.25rem", paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}>
      <h1 className="text-xl font-bold text-foreground">TransaÃ§Ãµes</h1>

      {/* Seletor de mÃªs */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-2 shadow-sm">
        <button onClick={goPrevMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
          {isCurrentMonth && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">MÃªs atual</span>}
        </div>
        <button onClick={goNextMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar transaÃ§Ã£o..." className="h-10 pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Pills de filtro com Ã­cones */}
      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map(({ key, label, Icon, activeClass, iconClass }) => {
          const isActive = activeFilter === key;
          return (
            <button key={key} onClick={() => setActiveFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? activeClass : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}>
              <Icon className={cn("h-3.5 w-3.5", isActive ? "opacity-90" : iconClass)} />
              {label}
            </button>
          );
        })}
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

      {/* Filtros de status com Ã­cones â€” mesmo visual das pills de categoria */}
      <div className="flex items-center gap-2">
        {STATUS_FILTER_OPTIONS.map(({ key, label, Icon, activeClass, iconClass }) => {
          const isActive = statusFilter === key;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? activeClass : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}>
              <Icon className={cn("h-3.5 w-3.5", isActive ? "opacity-90" : iconClass)} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Resumo dinÃ¢mico */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        {activeFilter === "Faturas" ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total em faturas</p>
              <p className="text-lg font-bold text-blue-500">{fmt(totalFaturas)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{cardInvoices.length} fatura(s)</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Realizado</p>
              <p className={cn(
                "text-lg font-bold",
                settledBalance >= 0 ? "text-foreground" : "text-red-500"
              )}>
                {fmt(settledBalance)}
              </p>
              {pendingBalance !== 0 && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fmt(Math.abs(pendingBalance))} pendente{pendingBalance < 0 ? " a pagar" : " a receber"}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground shrink-0">
              {filteredRegular.length} transaÃ§Ãµes
            </p>
          </div>
        )}
      </div>

      {/* â•â• SEÃ‡ÃƒO 1: Receitas e Despesas â•â• */}
      {showRegularSection && (
        <>
          <SectionHeader
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
                  Nenhuma transaÃ§Ã£o encontrada para este perÃ­odo.
                </div>
              ) : filteredRegular.map(t => {
                const isFuture  = parseBrDate(t.date).getTime() > today.getTime();
                const isFatura  = isFaturaTransaction(t);
                const statusLabel = t.type === "income" ? "Recebida" : "Paga";
                return (
                  <div key={t.id}
                    className={`flex items-center justify-between rounded-xl border p-3 shadow-sm ${t.settled ? "bg-settled" : "bg-pending"}`}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full",
                        isFatura ? "bg-blue-100" : t.type === "income" ? "bg-emerald-100" : "bg-red-100"
                      )}>
                        {isFatura
                          ? <CreditCard className="h-4 w-4 text-blue-500" />
                          : isInstallmentTransaction(t)
                          ? (t.type === "income"
                              ? <Repeat2 className="h-4 w-4 text-emerald-600" />
                              : <Repeat2 className="h-4 w-4 text-red-500" />)
                          : t.type === "income"
                          ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                          : <TrendingDown className="h-4 w-4 text-red-500" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">{getDisplayTitle(t)}</p>
                          {t.recurring && !isFatura && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex"><Repeat className="h-3 w-3 text-muted-foreground" /></span>
                              </TooltipTrigger>
                              <TooltipContent>Recorrente</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.category} â€¢ {t.date}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-semibold",
                          isFatura ? "text-blue-500" : t.type === "income" ? "text-emerald-600" : "text-red-500"
                        )}>
                          {t.type === "income" ? "+" : ""}{fmt(Math.abs(t.amount))}
                        </p>
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
                            <button onClick={() => !isFuture && toggleSettled(t.id)} disabled={isFuture}
                              className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                isFuture ? "cursor-not-allowed text-muted-foreground/40"
                                : t.settled ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                : "border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                              )}>
                              {t.settled ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => {
                                if (t.recurring || isInstallmentTransaction(t)) {
                                  setEditScopeTarget(t);
                                } else {
                                  setEditingId(t.id);
                                }
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (t.settled) return;
                                if (isInstallmentTransaction(t)) {
                                  setDeleteTarget(t);
                                } else {
                                  deleteTransaction(t.id);
                                }
                              }}
                              disabled={t.settled}
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
        </>
      )}

      {/* â•â• SEÃ‡ÃƒO 2: CartÃµes de CrÃ©dito â•â• */}
      {cardInvoices.length > 0 && showCardSection && (
        <>
          <SectionHeader
            title="CartÃµes de CrÃ©dito"
            count={cardInvoices.length}
            countColor="bg-blue-100 text-blue-600"
            open={showCards}
            onToggle={() => setShowCards(v => !v)}
            right={
              <span className="text-xs text-muted-foreground mr-1">
                {fmt(totalFaturas)}
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
                    className={cn("flex items-center justify-between gap-3 rounded-xl border p-3 shadow-sm",
                      isPaid ? "bg-card border-border" : "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40"
                    )}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {isPaid ? "Paga" : "Em aberto"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.competence} â€¢ Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="shrink-0 text-sm font-semibold text-red-500">
                        -{fmt(invoice.total_amount)}
                      </p>
                      <button onClick={() => openDetail(invoice, card)} title="Ver despesas desta fatura"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400 text-blue-500 hover:bg-blue-500/10 transition-colors">
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
        invoice={detailInvoice} card={detailCard}
        expenses={expenses.filter(e => e.invoice_id === detailInvoice?.id)}
        installments={installments.filter(i => i.invoice_id === detailInvoice?.id)}
        open={!!detailInvoice}
        onClose={() => { setDetailInvoice(null); setDetailCard(null); }}
        onAddExpense={() => {
          const cardId = detailCard?.id;
          setDetailInvoice(null); setDetailCard(null);
          router.navigate({ to: "/cartoes/nova-despesa", search: { cardId } });
        }}
        onDataChanged={async () => {
          if (detailInvoice) {
            // Recarregar despesas e parcelas da fatura
            await fetchExpenses(detailInvoice.id);
            await fetchInstallments(detailInvoice.id);
            // Recarregar faturas do cartÃ£o para atualizar totais
            await fetchInvoices(detailInvoice.card_id);
          }
        }}
      />

      <EditTransactionDialog
        transaction={editing}
        bulkEdit={bulkEdit}
        onClose={() => { setEditingId(null); setBulkEdit(false); }}
        allTransactions={allTransactions}
      />

      {/* Modal de escopo de ediÃ§Ã£o: apenas essa ou todas */}
      <ScopeBottomSheet
        open={!!editScopeTarget}
        onClose={() => setEditScopeTarget(null)}
        expenseType={
          editScopeTarget
            ? isInstallmentTransaction(editScopeTarget)
              ? "installment"
              : "recurring"
            : "generic"
        }
        title={editScopeTarget?.title}
        onSelect={(scope) => {
          if (!editScopeTarget) return;
          if (scope === "single") { setBulkEdit(false); setEditingId(editScopeTarget.id); }
          else                    { setBulkEdit(true);  setEditingId(editScopeTarget.id); }
          setEditScopeTarget(null);
        }}
      />

      {/* Modal de exclusÃ£o para transaÃ§Ãµes parceladas */}
      <TransactionDeleteModal
        transaction={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleteSingle={() => {
          if (deleteTarget) deleteTransaction(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onDeleteFuture={() => {
          if (deleteTarget?.recurrence_id && deleteTarget.installment_number) {
            deleteTransactionSeries(deleteTarget.recurrence_id, deleteTarget.installment_number);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

// â”€â”€ Modal de exclusÃ£o de sÃ©rie de transaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TransactionDeleteModal({
  transaction, open, onClose, onDeleteSingle, onDeleteFuture,
}: {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onDeleteSingle: () => void;
  onDeleteFuture: () => void;
}) {
  const [selected, setSelected] = useState<"single" | "future">("single");

  useEffect(() => { if (open) setSelected("single"); }, [open]);
  if (!transaction) return null;

  const remaining = (transaction.installments_total ?? 0) - (transaction.installment_number ?? 0);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-foreground">Excluir transaÃ§Ã£o</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Como deseja excluir <span className="font-medium text-foreground">"{transaction.title}"</span>?
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-3">
          {[
            {
              key: "single" as const,
              title: "Excluir apenas essa parcela",
              description: `Remove somente a parcela ${transaction.installment_number}/${transaction.installments_total}`,
              danger: false,
            },
            {
              key: "future" as const,
              title: "Excluir essa e as prÃ³ximas",
              description: remaining > 0
                ? `Remove esta parcela e as ${remaining} seguintes`
                : "Remove esta Ãºltima parcela",
              danger: true,
            },
          ].map(opt => {
            const isSel = selected === opt.key;
            return (
              <button key={opt.key} type="button" onClick={() => setSelected(opt.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  isSel
                    ? opt.danger ? "border-destructive/50 bg-destructive/5" : "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}>
                <div className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSel
                    ? opt.danger ? "border-destructive bg-destructive" : "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}>
                  {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium leading-snug",
                    isSel && opt.danger ? "text-destructive" : "text-foreground"
                  )}>{opt.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm"
            onClick={() => selected === "single" ? onDeleteSingle() : onDeleteFuture()}
            className={cn(selected === "future" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€ Modal de detalhes da fatura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InvoiceDetailModal({
  invoice, card, expenses, installments, open, onClose, onAddExpense, onDataChanged,
}: {
  invoice: Invoice | null; card: CreditCardType | null;
  expenses: ReturnType<typeof useCardStore.getState>["expenses"];
  installments: ReturnType<typeof useCardStore.getState>["installments"];
  open: boolean; onClose: () => void; onAddExpense: () => void;
  onDataChanged: () => Promise<void>;
}) {
  const allCategories = useCategories();
  const categoryIconMap = useMemo(
    () => Object.fromEntries(allCategories.map(c => [c.name, c.icon ?? "ðŸ“¦"])),
    [allCategories]
  );
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null);

  if (!invoice || !card) return null;

  const isPaid = invoice.status === "paid";
  const isClosed = invoice.status === "closed";
  const invoiceStatus: InvoiceStatus = isPaid ? "paid" : isClosed ? "closed" : "open";

  const allItems: UnifiedItem[] = [
    ...expenses.map(e => ({
      id: e.id, description: e.description, amount: e.amount, category: e.category,
      purchase_date: e.purchase_date, expense_type: e.expense_type,
      isInstallment: false, invoiceId: invoice.id,
      installmentNumber: e.installment_number,
    })),
    ...installments.map(i => ({
      id: i.id, description: i.description, amount: i.amount, category: i.category,
      purchase_date: i.purchase_date, expense_type: "installment" as const,
      isInstallment: true, invoiceId: invoice.id,
      parentExpenseId: i.parent_expense_id,
      installmentNumber: i.installment_number,
    })),
  ].sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());

  // Agrupa por data (yyyy-mm-dd) desc
  const itemsByDay: Record<string, UnifiedItem[]> = {};
  for (const item of allItems) {
    if (!itemsByDay[item.purchase_date]) itemsByDay[item.purchase_date] = [];
    itemsByDay[item.purchase_date].push(item);
  }
  const dayEntries = Object.entries(itemsByDay).sort((a, b) => b[0].localeCompare(a[0]));
  const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","SÃ¡b"];

  const dueDate = new Date(invoice.due_date + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const isOverdue = !isPaid && dueDate < today;

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:inset-0 md:items-center md:justify-center">
          <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
            style={{ maxHeight: "92dvh" }}>

            {/* â”€â”€ CabeÃ§alho gradiente teal/indigo â”€â”€ */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide leading-none">Fatura</p>
                    <p className="text-lg font-bold">{card.name}</p>
                  </div>
                  <button onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="text-4xl font-black tracking-tight mt-3">{fmt(invoice.total_amount)}</p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">CompetÃªncia</p>
                    <p className="text-sm font-semibold">{invoice.competence}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Vencimento</p>
                    <p className={cn("text-sm font-semibold", isOverdue && "text-red-300")}>
                      {dueDate.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Status</p>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      isPaid    ? "bg-emerald-400/30 text-emerald-100" :
                      isOverdue ? "bg-red-400/30 text-red-100" :
                      isClosed  ? "bg-slate-300/30 text-white/80" :
                                  "bg-amber-400/30 text-amber-100"
                    )}>
                      {isPaid ? "âœ“ Paga" : isOverdue ? "âš  Vencida" : isClosed ? "ðŸ”’ Fechada" : "â— Em aberto"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Lista de lanÃ§amentos agrupada por data â”€â”€ */}
            <div className="overflow-y-auto flex-1">
              {allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma despesa lanÃ§ada nesta fatura.</p>
                </div>
              ) : (
                <div className="px-4 pb-4">
                  {dayEntries.map(([date, items]) => {
                    const [yyyy, mm, dd] = date.split("-").map(Number);
                    const weekday = DAY_NAMES[new Date(yyyy, mm - 1, dd).getDay()];
                    const dayTotal = items.reduce((s, i) => s + i.amount, 0);
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between pt-4 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                            <span className="text-xs text-muted-foreground">/{String(mm).padStart(2,"0")}</span>
                          </div>
                          <span className="text-sm font-semibold text-indigo-600">-{fmt(dayTotal)}</span>
                        </div>
                        <div className="rounded-2xl bg-card border overflow-hidden">
                          {items.map((item, i) => (
                            <button key={item.id} type="button"
                              onClick={() => setEditingItem(item)}
                              className={cn(
                                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30",
                                i < items.length - 1 && "border-b border-border/40"
                              )}>
                              {/* Ãcone emoji da categoria */}
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                                style={{ background: "#ede9fe" }}>
                                {categoryIconMap[item.category] ?? "ðŸ“¦"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-semibold text-foreground truncate">{item.description}</p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground truncate">{item.category}</span>
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                                    TYPE_CLASS[item.expense_type])}>
                                    {TYPE_LABEL[item.expense_type]}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <p className="text-[15px] font-bold text-indigo-600">-{fmt(item.amount)}</p>
                                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full",
                                  isPaid ? "bg-muted text-muted-foreground" : "bg-indigo-50 text-indigo-500"
                                )}>
                                  {isPaid ? <Eye className="h-3.5 w-3.5"/> : <Pencil className="h-3.5 w-3.5"/>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* â”€â”€ RodapÃ© â”€â”€ */}
            <div className="flex items-center justify-between border-t px-5 py-3 shrink-0">
              <button onClick={onClose}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Fechar
              </button>
              {!isPaid && (
                <button onClick={onAddExpense}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:-translate-y-0.5 transition-all">
                  <Plus className="h-5 w-5"/>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ExpenseDetailModal
        item={editingItem}
        invoiceStatus={invoiceStatus}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={async () => { setEditingItem(null); await onDataChanged(); }}
        onDeleted={async () => { setEditingItem(null); await onDataChanged(); }}
      />
    </>
  );
}

// â”€â”€ Dialog de ediÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Modal de escopo de ediÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditScopeModal({
  transaction, open, onClose, onEditSingle, onEditAll,
}: {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onEditSingle: () => void;
  onEditAll: () => void;
}) {
  const [selected, setSelected] = useState<"single" | "all">("single");
  useEffect(() => { if (open) setSelected("single"); }, [open]);
  if (!transaction) return null;

  const isInstallment = isInstallmentTransaction(transaction);
  const label         = isInstallment ? "parcela" : "recorrÃªncia";
  const labelAll      = isInstallment ? "todas as parcelas" : "todas as recorrÃªncias";

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-foreground">Editar transaÃ§Ã£o</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">"{transaction.title}"</span>{" "}
            Ã© uma {label}. O que deseja editar?
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-3">
          {([
            { key: "single" as const, title: `Apenas essa ${label}`, description: "Edita somente este lanÃ§amento especÃ­fico" },
            { key: "all" as const, title: `Editar ${labelAll}`, description: isInstallment ? "Aplica as alteraÃ§Ãµes em todas as parcelas desta sÃ©rie" : "Aplica as alteraÃ§Ãµes em todas as recorrÃªncias futuras" },
          ]).map(opt => {
            const isSel = selected === opt.key;
            return (
              <button key={opt.key} type="button" onClick={() => setSelected(opt.key)}
                className={cn("flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  isSel ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
                )}>
                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSel ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}>
                  {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground">{opt.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => selected === "single" ? onEditSingle() : onEditAll()}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTransactionDialog({ transaction, onClose, bulkEdit = false, allTransactions = [] }: {
  transaction: Transaction | null;
  onClose: () => void;
  bulkEdit?: boolean;
  allTransactions?: Transaction[];
}) {
  const categories = useCategories();
  const [title, setTitle]             = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [type, setType]               = useState<"income"|"expense">("expense");
  const [category, setCategory]       = useState("");
  const [dateIso, setDateIso]         = useState("");
  const [settled, setSettled]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [openCat, setOpenCat]         = useState(false);
  const [catSearch, setCatSearch]     = useState("");

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
    if (!title.trim()) return setError("DescriÃ§Ã£o Ã© obrigatÃ³ria");
    if (!amountValue) return setError("Valor Ã© obrigatÃ³rio");
    if (!category) return setError("Categoria Ã© obrigatÃ³ria");
    if (!dateIso) return setError("Data Ã© obrigatÃ³ria");
    const numeric  = parseFloat(amountValue);
    const signed   = type === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y,m,d]  = dateIso.split("-").map(Number);
    const brDate   = formatBrDate(new Date(y, m-1, d));
    const todayStr = formatBrDate(new Date());
    const paidAt   = settled ? (transaction.settled ? (transaction.paidAt ?? todayStr) : todayStr) : undefined;

    if (bulkEdit) {
      // â”€â”€ Editar em lote: aplica a sÃ©rie â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const isInstallment = isInstallmentTransaction(transaction);
      const newDay = d; // dia escolhido â€” serÃ¡ mantido em cada mÃªs

      // Encontrar transaÃ§Ãµes futuras da sÃ©rie
      const futures = isInstallment
        ? allTransactions.filter(t =>
            t.recurrence_id === transaction.recurrence_id &&
            (t.installment_number ?? 0) >= (transaction.installment_number ?? 0)
          )
        : allTransactions.filter(t =>
            t.recurring === true &&
            t.title === transaction.title &&
            t.type === transaction.type &&
            parseBrDate(t.date).getTime() >= parseBrDate(transaction.date).getTime()
          );

      for (const t of futures) {
        const patch: Partial<Transaction> = {};

        // DescriÃ§Ã£o: atualiza o tÃ­tulo base (N/M Ã© gerado via getDisplayTitle)
        if (title.trim() !== transaction.title) patch.title = title.trim();

        // Categoria
        if (category !== transaction.category) patch.category = category;

        // Valor: atualiza com sinal correto conforme tipo
        const origSigned = t.type === "expense" ? -Math.abs(Math.abs(transaction.amount)) : Math.abs(transaction.amount);
        if (signed !== origSigned) patch.amount = t.type === "expense" ? -Math.abs(numeric) : Math.abs(numeric);

        // Data: mantÃ©m mÃªs/ano de cada parcela, altera sÃ³ o dia
        if (newDay !== parseBrDate(t.date).getDate()) {
          const tDate   = parseBrDate(t.date);
          const lastDay = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0).getDate();
          patch.date    = formatBrDate(new Date(tDate.getFullYear(), tDate.getMonth(), Math.min(newDay, lastDay)));
        }

        // Settled/paidAt: sÃ³ aplica na transaÃ§Ã£o atual
        if (t.id === transaction.id) {
          patch.settled = settled;
          patch.paidAt  = paidAt;
        }

        if (Object.keys(patch).length > 0) updateTransaction(t.id, patch);
      }
    } else {
      // â”€â”€ EdiÃ§Ã£o simples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      updateTransaction(transaction.id, { title: title.trim(), amount: signed, type, category, date: brDate, settled, paidAt });
    }
    onClose();
  }

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-50 bg-black/50" onClick={() => onClose()} />}

      {/* Sheet â€” sobe do rodapÃ© no mobile, centraliza no desktop */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:inset-0 md:items-center md:justify-center">
          <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
            style={{ maxHeight: "93dvh" }}>

            {/* â”€â”€ CabeÃ§alho gradiente (vermelho=despesa, verde=receita) â”€â”€ */}
            <div className={cn(
              "relative overflow-hidden px-5 pt-5 pb-5 text-white shrink-0",
              type === "expense"
                ? "bg-gradient-to-br from-red-500 to-rose-600"
                : "bg-gradient-to-br from-emerald-500 to-teal-600"
            )}>
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                {/* TÃ­tulo + fechar */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide leading-none">
                      {bulkEdit ? "Editar sÃ©rie" : "Editar transaÃ§Ã£o"}
                    </p>
                    {bulkEdit && (
                      <span className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Todas as parcelas
                      </span>
                    )}
                  </div>
                  <button onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>

                {/* Toggle Despesa / Receita */}
                <div className="flex rounded-xl bg-white/15 p-1 gap-1">
                  {(["expense","income"] as const).map(tp => (
                    <button key={tp} type="button" onClick={() => setType(tp)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all",
                        type === tp ? "bg-white text-slate-800 shadow-sm" : "text-white/80 hover:text-white"
                      )}>
                      {tp === "expense"
                        ? <TrendingDown className="h-4 w-4"/>
                        : <TrendingUp className="h-4 w-4"/>}
                      {tp === "expense" ? "Despesa" : "Receita"}
                    </button>
                  ))}
                </div>

                {/* Valor em destaque */}
                <div className="mt-4">
                  <p className="text-xs text-white/60 mb-1">Valor</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white/70">R$</span>
                    <input
                      inputMode="decimal"
                      value={amountDisplay}
                      onChange={e => handleAmountChange(e.target.value)}
                      placeholder="0,00"
                      className="bg-transparent text-4xl font-black text-white placeholder-white/40 outline-none w-full tracking-tight"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* â”€â”€ Corpo com campos â”€â”€ */}
            <div className="overflow-y-auto flex-1">
              <div className="px-4 py-4 space-y-3">

                {/* DescriÃ§Ã£o */}
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">DescriÃ§Ã£o</p>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Nome da transaÃ§Ã£o"
                    className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"
                  />
                </div>

                {/* Categoria â€” campo fechado que abre BottomSheet */}
                <button type="button"
                  onClick={() => setOpenCat(true)}
                  className="w-full rounded-2xl border bg-card px-4 py-3.5 text-left flex items-center gap-3 transition-colors hover:bg-muted/30">
                  {(() => {
                    const cat = availableCategories.find(c => c.name === category);
                    const color = cat?.color || "#6b7280";
                    const isEmoji = (cat?.icon?.codePointAt(0) ?? 0) > 0x2000;
                    return cat ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{ background: color + "22" }}>
                        {isEmoji ? cat.icon : <span className="text-sm font-bold" style={{ color }}>{cat.name[0]}</span>}
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <span className="text-xs">ðŸ“¦</span>
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
                    <p className={cn("text-[16px] font-semibold mt-0.5", category ? "text-foreground" : "text-muted-foreground/50")}>
                      {category || "Selecione a categoria"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>
                </button>

                {/* Data */}
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Data</p>
                  <DatePicker value={dateIso} onChange={setDateIso} />
                  {bulkEdit && (
                    <p className="text-[11px] text-muted-foreground">
                      â„¹ï¸ Altera apenas o <strong>dia</strong> â€” cada parcela mantÃ©m seu prÃ³prio mÃªs.
                    </p>
                  )}
                </div>

                {/* Paga / Recebida */}
                <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{type === "income" ? "Recebida" : "Paga"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFuture ? "Antecipar efetivaÃ§Ã£o" : "Marca como concluÃ­da"}
                    </p>
                  </div>
                  <Switch checked={settled} onCheckedChange={setSettled}/>
                </div>

                {error && <p className="text-xs text-destructive px-1">{error}</p>}

                {/* EspaÃ§ador para o botÃ£o fixo no mobile */}
                <div className="h-20 md:hidden"/>
              </div>
            </div>

            {/* â”€â”€ BotÃ£o salvar â€” fixo no rodapÃ© mobile, inline no desktop â”€â”€ */}
            <div className="md:hidden fixed left-0 right-0 z-10 px-4 pt-3 pb-[env(safe-area-inset-bottom,12px)] bg-background/97 border-t border-border/40"
              style={{ bottom: "0px", backdropFilter: "blur(8px)" }}>
              <button onClick={handleSave}
                className={cn(
                  "w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-95",
                  type === "expense" ? "bg-red-500 shadow-red-500/25" : "bg-emerald-600 shadow-emerald-600/25"
                )}>
                Salvar alteraÃ§Ãµes
              </button>
            </div>

            {/* Desktop: botÃ£o inline */}
            <div className="hidden md:flex gap-3 px-4 pb-4 pt-2 border-t shrink-0">
              <button onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave}
                className={cn(
                  "flex-1 h-11 rounded-xl text-white font-semibold text-sm transition-all",
                  type === "expense" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-600 hover:bg-emerald-700"
                )}>
                Salvar alteraÃ§Ãµes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ BottomSheet: Categoria â”€â”€ */}
      {openCat && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={() => { setOpenCat(false); setCatSearch(""); }} />
          <div className="fixed bottom-0 left-0 right-0 z-[201] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden"
            style={{ maxHeight:"80vh" }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/>
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-slate-100 dark:border-border">
              <h2 className="text-[18px] font-bold text-slate-800 dark:text-foreground">Categoria</h2>
              <button onClick={() => { setOpenCat(false); setCatSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-muted">
                <X className="h-4 w-4 text-slate-500"/>
              </button>
            </div>
            <div className="px-4 pt-3 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input type="text" placeholder="Buscar categoria..." value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-slate-100 dark:bg-muted pl-11 pr-4 text-base outline-none placeholder-slate-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-3 gap-3 px-4 pb-8">
                {availableCategories
                  .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
                  .map(cat => {
                    const isSel   = category === cat.name;
                    const color   = cat.color || "#6b7280";
                    const isEmoji = (cat.icon?.codePointAt(0) ?? 0) > 0x2000;
                    return (
                      <button key={cat.name} type="button"
                        onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                        style={isSel
                          ? { background: color+"18", borderColor: color+"66" }
                          : { borderColor:"transparent", background:"#f8fafc" }}>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                          style={{ background: color+"22" }}>
                          {isEmoji ? cat.icon : "ðŸ“¦"}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-700 dark:text-foreground leading-tight">{cat.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
