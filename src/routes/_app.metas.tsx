import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Target, Plus, TrendingDown, Pencil, Trash2, PiggyBank, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/lib/categories-store";
import { useTransactions, parseBrDate } from "@/lib/transactions-store";
import { supabase } from "@/lib/supabase";
import {
  useBudgets,
  useGoals,
  addBudget,
  updateBudget,
  deleteBudget,
  addGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  useGoalContributions,
  formatBRL,
  formatDeadline,
  type Budget,
  type Goal,
  type GoalContribution,
} from "@/lib/goals-store";

function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = (parseInt(digits, 10) / 100).toFixed(2);
  return parseFloat(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmountInput(display: string): number {
  if (!display) return NaN;
  return Number(display.replace(/\./g, "").replace(",", "."));
}

function numberToAmountDisplay(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AmountInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        className="h-12 pl-9 text-lg font-bold"
        value={value}
        onChange={(e) => onChange(formatAmountInput(e.target.value))}
        autoFocus={autoFocus}
      />
    </div>
  );
}

export const Route = createFileRoute("/_app/metas")({
  head: () => ({ meta: [{ title: "Metas — Finanças Pessoais" }] }),
  component: MetasPage,
});

type Tab = "budgets" | "goals";

// TODO: gating por assinatura do portal (Fase Asaas)
function MetasPage() {
  const [tab, setTab] = useState<Tab>("budgets");

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Metas e Orçamentos</h1>
      </div>

      {/* Tabs */}
      <div className="inline-flex w-full rounded-full bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setTab("budgets")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            tab === "budgets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Orçamentos
        </button>
        <button
          type="button"
          onClick={() => setTab("goals")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            tab === "goals" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Metas
        </button>
      </div>

      {tab === "budgets" ? <BudgetsSection /> : <GoalsSection />}
    </div>
  );
}

/* ======================== BUDGETS ======================== */

function BudgetsSection() {
  const budgets = useBudgets();
  const categories = useCategories();
  const transactions = useTransactions();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  // ── Despesas de cartão de crédito por mês de compra ───────────────────────
  // Buscamos card_expenses e card_installments pelo purchase_date (data da compra),
  // não pela data de vencimento da fatura. Assim "Alimentação" de julho aparece
  // no orçamento de julho mesmo que a fatura só vença em agosto.
  const [cardExpenses, setCardExpenses] = useState<
    { category: string; amount: number; purchase_date: string }[]
  >([]);

  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = `${yyyy}-${mm}-01`;
    const monthEnd   = `${yyyy}-${mm}-31`;

    Promise.all([
      supabase
        .from("card_expenses")
        .select("category, amount, purchase_date")
        .gte("purchase_date", monthStart)
        .lte("purchase_date", monthEnd),
      supabase
        .from("card_installments")
        .select("category, amount, purchase_date")
        .gte("purchase_date", monthStart)
        .lte("purchase_date", monthEnd),
    ]).then(([expRes, instRes]) => {
      setCardExpenses([
        ...(expRes.data  ?? []),
        ...(instRes.data ?? []),
      ]);
    }).catch(() => {});
  }, []);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense" && c.active),
    [categories],
  );

  const spentByCategory = useMemo(() => {
    const now    = new Date();
    const curMon = now.getMonth();
    const curYr  = now.getFullYear();
    const map    = new Map<string, number>();

    // ── Transações normais ─────────────────────────────────────────────────
    transactions.forEach((t) => {
      if (t.type !== "expense") return;

      // Exclui pagamentos de fatura gerados automaticamente pelo payInvoice.
      // Esses registros têm título no formato "Fatura <Cartão> – MM/YYYY"
      // e categoria "Cartão de Crédito". Eles não representam gastos reais
      // por categoria — as compras individuais são contadas abaixo via card_expenses.
      if (
        t.category === "Cartão de Crédito" &&
        /^Fatura .+ – \d{2}\/\d{4}$/.test(t.title)
      ) return;

      const d = parseBrDate(t.date);
      if (d.getMonth() !== curMon || d.getFullYear() !== curYr) return;
      map.set(t.category, (map.get(t.category) ?? 0) + Math.abs(t.amount));
    });

    // ── Despesas de cartão de crédito (por data da compra) ─────────────────
    // Inclui card_expenses (avulsas, recorrentes, parceladas 1ª parcela)
    // e card_installments (parcelas 2..N). O purchase_date é sempre a data
    // real da compra, não a data de vencimento da fatura.
    const monthPrefix = `${curYr}-${String(curMon + 1).padStart(2, "0")}`;
    cardExpenses.forEach((e) => {
      if (!e.purchase_date.startsWith(monthPrefix)) return;
      map.set(e.category, (map.get(e.category) ?? 0) + Math.abs(e.amount));
    });

    return map;
  }, [transactions, cardExpenses]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Orçamentos do mês</h2>
        <Button size="sm" onClick={() => setCreating(true)} className="h-8 gap-1 rounded-full px-3 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Novo
        </Button>
      </div>

      {budgets.length === 0 && (
        <EmptyState
          icon={<TrendingDown className="h-6 w-6 text-muted-foreground" />}
          title="Sem orçamentos"
          description="Crie um orçamento mensal para acompanhar seus gastos por categoria."
        />
      )}

      {budgets.map((b) => {
        const spent = spentByCategory.get(b.category) ?? 0;
        const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
        const rawPct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        const remaining = b.limit - spent;
        const barColor =
          rawPct > 90 ? "bg-danger" : rawPct >= 70 ? "bg-warning" : "bg-success";
        const textColor =
          rawPct > 90 ? "text-danger" : rawPct >= 70 ? "text-warning" : "text-success";
        return (
          <div key={b.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{b.category}</p>
                  <p className="text-xs text-muted-foreground">{b.period}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(b)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleting(b)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <p className={`text-sm font-bold ${textColor}`}>
                {formatBRL(spent)}
              </p>
              <p className="text-xs text-muted-foreground">de {formatBRL(b.limit)}</p>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={rawPct > 90 ? "text-danger" : "text-muted-foreground"}>
                {rawPct.toFixed(0)}% utilizado
              </span>
              <span className={remaining < 0 ? "text-danger" : "text-muted-foreground"}>
                {remaining < 0 ? "Excedido " : "Restante "}
                {formatBRL(Math.abs(remaining))}
              </span>
            </div>
          </div>
        );
      })}

      <BudgetDialog
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
        categories={expenseCategories.map((c) => c.name)}
        usedCategories={budgets.map((b) => b.category)}
        onSave={(data) => {
          addBudget({ ...data, period: "Mensal" });
          toast.success("Orçamento criado");
          setCreating(false);
        }}
      />

      <BudgetDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        budget={editing ?? undefined}
        categories={expenseCategories.map((c) => c.name)}
        usedCategories={budgets.filter((b) => b.id !== editing?.id).map((b) => b.category)}
        onSave={(data) => {
          if (editing) {
            updateBudget(editing.id, data);
            toast.success("Orçamento atualizado");
          }
          setEditing(null);
        }}
      />

      <ConfirmDelete
        open={!!deleting}
        title="Excluir orçamento?"
        description={`O orçamento de "${deleting?.category}" será removido.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteBudget(deleting.id);
            toast.success("Orçamento excluído");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  budget,
  categories,
  usedCategories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budget?: Budget;
  categories: string[];
  usedCategories: string[];
  onSave: (data: { category: string; limit: number }) => void;
}) {
  const [category, setCategory] = useState(budget?.category ?? "");
  const [limit, setLimit] = useState(budget ? numberToAmountDisplay(budget.limit) : "");

  // reset on open
  useMemo(() => {
    if (open) {
      setCategory(budget?.category ?? "");
      setLimit(budget ? numberToAmountDisplay(budget.limit) : "");
    }
  }, [open, budget]);

  const availableCats = categories.filter(
    (c) => !usedCategories.includes(c) || c === budget?.category,
  );

  const handleSave = () => {
    const n = parseAmountInput(limit);
    if (!category) return toast.error("Selecione uma categoria");
    if (!Number.isFinite(n) || n <= 0) return toast.error("Informe um limite válido");
    onSave({ category, limit: n });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{budget ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>Defina um limite mensal por categoria.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {availableCats.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Todas as categorias já possuem orçamento.
                  </div>
                )}
                {availableCats.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Limite mensal</Label>
            <AmountInput value={limit} onChange={setLimit} />
          </div>
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== GOALS ======================== */

function GoalsSection() {
  const goals = useGoals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [depositing, setDepositing] = useState<Goal | null>(null);
  const [history, setHistory] = useState<Goal | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Metas de economia</h2>
        <Button size="sm" onClick={() => setCreating(true)} className="h-8 gap-1 rounded-full px-3 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Nova
        </Button>
      </div>

      {goals.length === 0 && (
        <EmptyState
          icon={<Target className="h-6 w-6 text-muted-foreground" />}
          title="Sem metas"
          description="Crie metas para acompanhar o progresso das suas economias."
        />
      )}

      {goals.map((g) => {
        const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
        const rawPct = g.target > 0 ? (g.current / g.target) * 100 : 0;
        const remaining = Math.max(0, g.target - g.current);
        const done = g.current >= g.target;
        const barColor =
          rawPct > 90 ? "bg-success" : rawPct >= 70 ? "bg-warning" : "bg-danger-light";
        const textColor =
          rawPct > 90 ? "text-success" : rawPct >= 70 ? "text-warning" : "text-danger-light";
        return (
          <div key={g.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{g.name}</p>
                  <p className="text-xs text-muted-foreground">Meta: {formatDeadline(g.deadline)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDepositing(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-500/10"
                  aria-label="Depositar"
                  title="Adicionar depósito"
                >
                  <PiggyBank className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setHistory(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Ver depósitos"
                  title="Ver depósitos"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditing(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleting(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <p className={`text-sm font-bold ${textColor}`}>
                {formatBRL(g.current)}
              </p>
              <p className="text-xs text-muted-foreground">de {formatBRL(g.target)}</p>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={rawPct > 90 ? "text-success" : "text-muted-foreground"}>
                {pct.toFixed(0)}% concluído
              </span>
              <span className="text-muted-foreground">
                {done ? "Meta atingida 🎉" : `Faltam ${formatBRL(remaining)}`}
              </span>
            </div>
          </div>
        );
      })}

      <GoalDialog
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
        onSave={(data) => {
          addGoal(data);
          toast.success("Meta criada");
          setCreating(false);
        }}
      />

      <GoalDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        goal={editing ?? undefined}
        onSave={(data) => {
          if (editing) {
            updateGoal(editing.id, data);
            toast.success("Meta atualizada");
          }
          setEditing(null);
        }}
      />

      <DepositDialog
        open={!!depositing}
        onOpenChange={(v) => !v && setDepositing(null)}
        goal={depositing ?? undefined}
        onSave={(amount) => {
          if (depositing) {
            addContribution({
              goalId: depositing.id,
              amount,
              date: new Date().toISOString().slice(0, 10),
            });
            toast.success("Depósito registrado");
          }
          setDepositing(null);
        }}
      />



      <ContributionsDialog
        open={!!history}
        onOpenChange={(v) => !v && setHistory(null)}
        goal={history ?? undefined}
      />

      <ConfirmDelete
        open={!!deleting}
        title="Excluir meta?"
        description={`A meta "${deleting?.name}" e seus depósitos serão removidos.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteGoal(deleting.id);
            toast.success("Meta excluída");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Goal;
  onSave: (data: { name: string; target: number; current: number; deadline: string }) => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? numberToAmountDisplay(goal.target) : "");
  const [current, setCurrent] = useState(goal ? numberToAmountDisplay(goal.current) : "");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");

  useMemo(() => {
    if (open) {
      setName(goal?.name ?? "");
      setTarget(goal ? numberToAmountDisplay(goal.target) : "");
      setCurrent(goal ? numberToAmountDisplay(goal.current) : "");
      setDeadline(goal?.deadline ?? "");
    }
  }, [open, goal]);

  const handleSave = () => {
    const t = parseAmountInput(target);
    const c = current ? parseAmountInput(current) : 0;
    if (!name.trim()) return toast.error("Informe o nome da meta");
    if (!Number.isFinite(t) || t <= 0) return toast.error("Informe um valor de meta válido");
    if (!Number.isFinite(c) || c < 0) return toast.error("Informe um valor inicial válido");
    if (!deadline) return toast.error("Informe o prazo");
    onSave({ name: name.trim(), target: t, current: c, deadline });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>Defina um objetivo de economia e seu prazo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reserva de emergência"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor da meta</Label>
            <AmountInput value={target} onChange={setTarget} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor inicial</Label>
            <AmountInput value={current} onChange={setCurrent} />
          </div>


          <div className="space-y-1.5">
            <Label className="text-xs">Prazo</Label>
            <Input
              type="month"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepositDialog({
  open,
  onOpenChange,
  goal,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Goal;
  onSave: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");

  useMemo(() => {
    if (open) setAmount("");
  }, [open]);

  const handleSave = () => {
    const n = parseAmountInput(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Informe um valor válido");
    onSave(n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar depósito</DialogTitle>
          <DialogDescription>
            {goal ? `Contribuir para "${goal.name}"` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Valor</Label>
          <AmountInput value={amount} onChange={setAmount} autoFocus />
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Depositar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== SHARED ======================== */

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ConfirmDelete({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ContributionsDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Goal;
}) {
  const all = useGoalContributions();
  const items = useMemo<GoalContribution[]>(() => {
    if (!goal) return [];
    return all
      .filter((c) => c.goalId === goal.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [all, goal]);

  const total = items.reduce((s, c) => s + c.amount, 0);

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Depósitos realizados</DialogTitle>
          <DialogDescription>
            {goal ? `Histórico de "${goal.name}"` : ""}
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum depósito registrado.</p>
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <PiggyBank className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(c.date)}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatBRL(c.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">Total depositado</span>
            <span className="text-sm font-bold text-foreground">{formatBRL(total)}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

