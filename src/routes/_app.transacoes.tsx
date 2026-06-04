import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useTransactions,
  toggleSettled,
  updateTransaction,
  deleteTransaction,
  parseBrDate,
  formatBrDate,
  isTodayOrPast,
  type Transaction,
} from "@/lib/transactions-store";
import { useCategories } from "@/lib/categories-store";

export const Route = createFileRoute("/_app/transacoes")({
  head: () => ({
    meta: [{ title: "Transações — Finanças Pessoais" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    month: typeof search.month === "string" ? search.month : undefined,
  }),
  component: TransacoesPage,
});

function brDateToIso(br: string): string {
  const [dd, mm, yyyy] = br.split("/");
  return `${yyyy}-${mm}-${dd}`;
}



const filters = ["Todas", "Receitas", "Despesas"];
const statusFilters = ["Todas", "Pagas/Recebidas", "Pendentes"] as const;
type StatusFilter = (typeof statusFilters)[number];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "title-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Data (mais recente)",
  "date-asc": "Data (mais antiga)",
  "amount-desc": "Valor (maior)",
  "amount-asc": "Valor (menor)",
  "title-asc": "Título (A–Z)",
};

function TransacoesPage() {
  const { month: monthParam } = Route.useSearch();
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = (() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      return { month: m - 1, year: y };
    }
    return { month: now.getMonth(), year: now.getFullYear() };
  })();

  const allTransactions = useTransactions();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todas");
  const [selectedMonth, setSelectedMonth] = useState<number>(initial.month);
  const [selectedYear, setSelectedYear] = useState<number>(initial.year);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo(
    () => allTransactions.find((t) => t.id === editingId) ?? null,
    [allTransactions, editingId],
  );



  const isCurrentMonth =
    selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  const goPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const filtered = allTransactions
    .filter((t) => {
      const date = parseBrDate(t.date);
      const matchesMonth =
        date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        activeFilter === "Todas" ||
        (activeFilter === "Receitas" && t.type === "income") ||
        (activeFilter === "Despesas" && t.type === "expense");
      const matchesStatus =
        statusFilter === "Todas" ||
        (statusFilter === "Pagas/Recebidas" && t.settled) ||
        (statusFilter === "Pendentes" && !t.settled);
      return matchesMonth && matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return parseBrDate(b.date).getTime() - parseBrDate(a.date).getTime();
        case "date-asc":
          return parseBrDate(a.date).getTime() - parseBrDate(b.date).getTime();
        case "amount-desc":
          return Math.abs(b.amount) - Math.abs(a.amount);
        case "amount-asc":
          return Math.abs(a.amount) - Math.abs(b.amount);
        case "title-asc":
          return a.title.localeCompare(b.title);
      }
    });

  return (
    <div className="space-y-4 p-5">
      <h1 className="text-xl font-bold text-foreground">Transações</h1>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-2 shadow-sm">
        <button
          onClick={goPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
          {isCurrentMonth && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Mês atual
            </span>
          )}
        </div>
        <button
          onClick={goNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar transação..."
          className="h-10 pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              aria-label="Ordenar"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as SortKey)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === f
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "Pagas/Recebidas" && <CheckCircle2 className="h-3 w-3" />}
            {f === "Pendentes" && <Circle className="h-3 w-3" />}
            {f}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total do período</p>
          <p className="text-lg font-bold text-foreground">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              filtered.reduce((sum, t) => sum + t.amount, 0)
            )}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} transações</p>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            Nenhuma transação encontrada para este período.
          </div>
        ) : (
          filtered.map((t) => {
            const isFuture = parseBrDate(t.date).getTime() > today.getTime();
            const statusLabel = t.type === "income" ? "Recebida" : "Paga";
            return (
              <div
                key={t.id}
                className={`flex items-center justify-between rounded-xl border p-3 shadow-sm ${
                  t.settled ? "bg-settled" : "bg-pending"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      t.type === "income" ? "bg-emerald-100" : "bg-red-100"
                    }`}
                  >
                    {t.type === "income" ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      {t.recurring && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center">
                              <Repeat className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Recorrente</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.category} • {t.date}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        t.type === "income" ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {t.type === "income" ? "+" : ""}
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(t.amount))}
                    </p>
                    <button
                      onClick={() => !isFuture && toggleSettled(t.id)}
                      disabled={isFuture}
                      aria-label={t.settled ? `Marcar como pendente` : `Marcar como ${statusLabel.toLowerCase()}`}
                      title={
                        isFuture
                          ? "Disponível somente a partir da data da transação"
                          : t.settled
                            ? `${statusLabel} — clique para desfazer`
                            : `Marcar como ${statusLabel.toLowerCase()}`
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        isFuture
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : t.settled
                            ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                            : "border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t.settled ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingId(t.id)}
                      aria-label="Editar transação"
                      title="Editar transação"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => !t.settled && deleteTransaction(t.id)}
                      disabled={t.settled}
                      aria-label="Excluir transação"
                      title={t.settled ? "Transações efetivadas não podem ser excluídas" : "Excluir transação"}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        t.settled
                          ? "cursor-not-allowed text-muted-foreground/30"
                          : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {t.settled && t.paidAt && (
                    <p className="text-[10px] font-medium text-emerald-600">
                      {t.type === "income" ? "Recebido" : "Pago"} em {t.paidAt}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <EditTransactionDialog
        transaction={editing}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

function EditTransactionDialog({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const categories = useCategories();
  const [title, setTitle] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [dateIso, setDateIso] = useState("");
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = transaction !== null;

  useEffect(() => {
    if (!transaction) return;
    setTitle(transaction.title);
    setType(transaction.type);
    setCategory(transaction.category);
    setDateIso(brDateToIso(transaction.date));
    setSettled(transaction.settled);
    const abs = Math.abs(transaction.amount);
    setAmountValue(abs.toFixed(2));
    setAmountDisplay(
      abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
    setError(null);
  }, [transaction]);

  const isFuture = dateIso ? !isTodayOrPast(dateIso) : false;
  const availableCategories = categories.filter((c) => c.active && c.type === type);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setAmountDisplay("");
      setAmountValue("");
      return;
    }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    setAmountValue(value);
    setAmountDisplay(
      parseFloat(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }

  function handleSave() {
    if (!transaction) return;
    if (!title.trim()) return setError("Descrição é obrigatória");
    if (!amountValue) return setError("Valor é obrigatório");
    if (!category) return setError("Categoria é obrigatória");
    if (!dateIso) return setError("Data é obrigatória");

    const numeric = parseFloat(amountValue);
    const signed = type === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y, m, d] = dateIso.split("-").map(Number);
    const brDate = formatBrDate(new Date(y, m - 1, d));
    const todayStr = formatBrDate(new Date());
    // Em edição, permitimos efetivar mesmo transações futuras.
    // Quando marcada agora, registra a data de pagamento/recebimento como hoje.
    const wasSettled = transaction.settled;
    const paidAt = settled
      ? wasSettled
        ? (transaction.paidAt ?? todayStr)
        : todayStr
      : undefined;

    updateTransaction(transaction.id, {
      title: title.trim(),
      amount: signed,
      type,
      category,
      date: brDate,
      settled,
      paidAt,
    });

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                type === "expense" ? "bg-card text-red-500 shadow-sm" : "text-muted-foreground"
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                type === "income" ? "bg-card text-emerald-600 shadow-sm" : "text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Receita
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                inputMode="decimal"
                className="h-11 pl-9 font-semibold"
                value={amountDisplay}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat.name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">
                {type === "income" ? "Recebida" : "Paga"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFuture
                  ? "Antecipar efetivação: registra hoje como data de recebimento/pagamento"
                  : "Marca como concluída na data de hoje"}
              </p>
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

