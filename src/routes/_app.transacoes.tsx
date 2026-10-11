import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Circle,
  Pencil, Repeat, Repeat2, Trash2, CreditCard, Lock, Plus, Receipt,
  ChevronDown, LayoutList, X, Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useTransactions, toggleSettled,
  deleteTransactionWithScope, isInstallmentTransaction, isSeriesTransaction,
  getDisplayTitle, parseBrDate, type Transaction,
} from "@/lib/transactions-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import {
  ExpenseDetailModal,
  TYPE_CLASS, TYPE_LABEL,
  type UnifiedItem, type InvoiceStatus,
} from "@/components/cartoes/expense-detail-modal";
import { ScopeBottomSheet } from "@/components/scope-bottom-sheet";
import { TransactionEditDialog } from "@/components/transacoes/transaction-edit-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

// ── Pills de filtro ────────────────────────────────────────────────────
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

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc";
const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Data (mais recente)", "date-asc": "Data (mais antiga)",
  "amount-desc": "Valor (maior)", "amount-asc": "Valor (menor)", "title-asc": "Título (A–Z)",
};

// ── Cabeçalho colapsável ───────────────────────────────────────────────
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
  const [deleteScopeTarget, setDeleteScopeTarget] = useState<Transaction | null>(null);
  // Confirmação pra exclusão de uma transação avulsa (sem série) — antes o
  // clique na lixeira apagava direto, sem nenhuma confirmação, a mesma
  // falha já corrigida no botão "Cancelar assinatura".
  const [deleteSingleTarget, setDeleteSingleTarget] = useState<Transaction | null>(null);
  const [editScopeTarget, setEditScopeTarget] = useState<Transaction | null>(null);
  const [bulkEdit, setBulkEdit]               = useState(false);
  const [showTransactions, setShowTransactions] = useState(true);
  const [showCards, setShowCards]               = useState(true);
  // Guardamos só os IDs, nunca os objetos — invoice/card são derivados
  // reativamente da store a cada render (ver abaixo), senão o cabeçalho do
  // modal mostra valores desatualizados até fechar e abrir de novo (ex.:
  // total da fatura depois de editar/excluir uma despesa com o modal aberto).
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId]       = useState<string | null>(null);

  const editing = useMemo(
    () => allTransactions.find(t => t.id === editingId) ?? null,
    [allTransactions, editingId]
  );

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  useEffect(() => { fetchCards(); }, []);
  useEffect(() => { cards.forEach(c => fetchInvoices(c.id)); }, [cards.length]);

  const goPrevMonth = () => { if (selectedMonth===0){setSelectedMonth(11);setSelectedYear(y=>y-1);}else setSelectedMonth(m=>m-1); };
  const goNextMonth = () => { if (selectedMonth===11){setSelectedMonth(0);setSelectedYear(y=>y+1);}else setSelectedMonth(m=>m+1); };

  // ── Transações regulares ───────────────────────────────────────────────
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

  // ── Faturas do mês ─────────────────────────────────────────────────────
  const cardInvoices = useMemo(() =>
    invoices.filter(inv => {
      if (inv.total_amount <= 0) return false;
      const due = new Date(inv.due_date + "T12:00:00");
      if (!(due.getMonth() === selectedMonth && due.getFullYear() === selectedYear)) return false;
      // Filtro de status aplicado às faturas
      if (statusFilter === "Pagas/Recebidas" && inv.status !== "paid") return false;
      if (statusFilter === "Pendentes" && inv.status !== "open") return false;
      // Busca por nome do cartão quando filtro Faturas ativo
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

  // Realizado: apenas transações quitadas/recebidas
  const settledBalance = filteredRegular
    .filter(t => t.settled)
    .reduce((s, t) => s + t.amount, 0);

  // Previsto: transações não quitadas ainda
  const pendingBalance = filteredRegular
    .filter(t => !t.settled)
    .reduce((s, t) => s + t.amount, 0);

  // Para compatibilidade com o código existente
  const totalBalance = settledBalance;
  const totalFaturas = cardInvoices.reduce((s, i) => s + i.invoice.total_amount, 0);

  // Derivados reativamente da store a cada render — nunca um snapshot do
  // momento em que o modal foi aberto (ver comentário no useState acima).
  const detailInvoice = detailInvoiceId ? invoices.find(i => i.id === detailInvoiceId) ?? null : null;
  const detailCard    = detailCardId ? cards.find(c => c.id === detailCardId) ?? null : null;

  const openDetail = async (invoice: Invoice, card: CreditCardType) => {
    setDetailInvoiceId(invoice.id); setDetailCardId(card.id);
    await fetchExpenses(invoice.id);
    await fetchInstallments(invoice.id);
  };

  return (
    <div className="space-y-4 md:p-8 md:max-w-3xl md:mx-auto" style={{ width: "100%", maxWidth: "100%", overflowX: "hidden", padding: "1.25rem", paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}>
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

      {/* Pills de filtro com ícones */}
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

      {/* Filtros de status com ícones — mesmo visual das pills de categoria */}
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

      {/* Resumo dinâmico */}
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
              {filteredRegular.length} transações
            </p>
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 1: Receitas e Despesas ══ */}
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
                        <p className="text-xs text-muted-foreground">{t.category} • {t.date}</p>
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
                                if (isSeriesTransaction(t)) {
                                  setDeleteScopeTarget(t);
                                } else {
                                  setDeleteSingleTarget(t);
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

      {/* ══ SEÇÃO 2: Cartões de Crédito ══ */}
      {cardInvoices.length > 0 && showCardSection && (
        <>
          <SectionHeader
            title="Cartões de Crédito"
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
                          {invoice.competence} • Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}
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
        onClose={() => { setDetailInvoiceId(null); setDetailCardId(null); }}
        onAddExpense={() => {
          const cardId = detailCard?.id;
          setDetailInvoiceId(null); setDetailCardId(null);
          router.navigate({ to: "/cartoes/nova-despesa", search: { cardId } });
        }}
        onDataChanged={async () => {
          if (detailInvoice) {
            // Recarregar despesas e parcelas da fatura
            await fetchExpenses(detailInvoice.id);
            await fetchInstallments(detailInvoice.id);
            // Recarregar faturas do cartão para atualizar totais
            await fetchInvoices(detailInvoice.card_id);
          }
        }}
      />

      <TransactionEditDialog
        transaction={editing}
        bulkEdit={bulkEdit}
        onClose={() => { setEditingId(null); setBulkEdit(false); }}
        allTransactions={allTransactions}
      />

      {/* Modal de escopo de edição: apenas essa ou todas */}
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

      {/* Modal de escopo de exclusão: apenas essa ou toda a série (recorrente ou parcelada) */}
      <ScopeBottomSheet
        open={!!deleteScopeTarget}
        onClose={() => setDeleteScopeTarget(null)}
        action="delete"
        expenseType={
          deleteScopeTarget
            ? isInstallmentTransaction(deleteScopeTarget)
              ? "installment"
              : "recurring"
            : "generic"
        }
        title={deleteScopeTarget?.title}
        onSelect={(scope) => {
          if (deleteScopeTarget) deleteTransactionWithScope(deleteScopeTarget, scope);
          setDeleteScopeTarget(null);
        }}
      />

      {/* Confirmação de exclusão de transação avulsa (sem série) */}
      <ConfirmDialog
        open={!!deleteSingleTarget}
        onClose={() => setDeleteSingleTarget(null)}
        variant="destructive"
        title="Excluir transação?"
        confirmLabel="Excluir"
        description={
          deleteSingleTarget
            ? `"${getDisplayTitle(deleteSingleTarget)}" será excluída permanentemente. Essa ação não pode ser desfeita.`
            : ""
        }
        onConfirm={() => {
          if (deleteSingleTarget) deleteTransactionWithScope(deleteSingleTarget, "single");
          setDeleteSingleTarget(null);
        }}
      />
    </div>
  );
}

// ── Modal de detalhes da fatura ────────────────────────────────────────
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
    () => Object.fromEntries(allCategories.map(c => [c.name, c.icon ?? "📦"])),
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
  const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

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

            {/* ── Cabeçalho gradiente teal/indigo ── */}
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
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Competência</p>
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
                      {isPaid ? "✓ Paga" : isOverdue ? "⚠ Vencida" : isClosed ? "🔒 Fechada" : "● Em aberto"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Lista de lançamentos agrupada por data ── */}
            <div className="overflow-y-auto flex-1">
              {allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma despesa lançada nesta fatura.</p>
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
                              {/* Ícone emoji da categoria */}
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                                style={{ background: "#ede9fe" }}>
                                {categoryIconMap[item.category] ?? "📦"}
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

            {/* ── Rodapé ── */}
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

