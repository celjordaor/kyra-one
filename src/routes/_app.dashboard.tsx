import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight, CalendarDays, Eye, EyeOff, AlertCircle, Check, User, LogOut, KeyRound } from "lucide-react";
import { useTransactions, parseBrDate, toggleSettled } from "@/lib/transactions-store";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Finanças Pessoais" }],
  }),
  component: DashboardPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CATEGORY_COLORS = ["bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-slate-400"];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function relativeLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff > 1 && diff < 7) return `${diff} dias atrás`;
  return d.toLocaleDateString("pt-BR");
}

type Notifs = {
  expenseAlerts: boolean;
  monthlySummary: boolean;
  goalsReached: boolean;
  billReminders: boolean;
};

const DEFAULT_NOTIFS: Notifs = {
  expenseAlerts: true,
  monthlySummary: true,
  goalsReached: true,
  billReminders: false,
};

function loadNotifs(): Notifs {
  if (typeof window === "undefined") return DEFAULT_NOTIFS;
  try {
    const raw = localStorage.getItem("fp:notifs");
    return raw ? { ...DEFAULT_NOTIFS, ...(JSON.parse(raw) as Notifs) } : DEFAULT_NOTIFS;
  } catch {
    return DEFAULT_NOTIFS;
  }
}


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setUserName(data?.name ?? user.user_metadata?.name ?? "");
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showValues, setShowValues] = useState(true);
  const [billReminders, setBillReminders] = useState(DEFAULT_NOTIFS.billReminders);

  useEffect(() => {
    const notifs = loadNotifs();
    setBillReminders(notifs.billReminders);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "fp:notifs") {
        const updated = loadNotifs();
        setBillReminders(updated.billReminders);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const hidden = (v: number) => showValues ? formatCurrency(v) : "••••";
  const hiddenSign = (v: number, sign: string) => showValues ? `${sign}${formatCurrency(v)}` : "••••";

  const transactions = useTransactions();

  const monthTx = useMemo(() => {
    return transactions
      .map((t) => ({ ...t, _d: parseBrDate(t.date) }))
      .filter((t) => t._d.getMonth() === selectedMonth && t._d.getFullYear() === selectedYear)
      .sort((a, b) => b._d.getTime() - a._d.getTime());
  }, [transactions, selectedMonth, selectedYear]);

  const { income, expense, balance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of monthTx) {
      if (t.type === "income") inc += Math.abs(t.amount);
      else exp += Math.abs(t.amount);
    }
    return { income: inc, expense: exp, balance: inc - exp };
  }, [monthTx]);

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0;
    for (const t of monthTx) {
      if (t.type !== "expense") continue;
      const v = Math.abs(t.amount);
      totals.set(t.category, (totals.get(t.category) ?? 0) + v);
      total += v;
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value], i) => ({
      name,
      value: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [monthTx]);

  const goPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <h1 className="text-lg font-bold text-foreground">
            {userName || "..."}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowValues((s) => !s)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
            aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          >
            {showValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>

          {/* Avatar com menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl shadow-sm ring-2 ring-primary/30 transition-all hover:ring-primary/50 focus:outline-none"
                aria-label="Menu do usuário"
              >
                🐶
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-foreground truncate">
                  {userName || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email ?? ""}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.navigate({ to: "/perfil" })}
                className="cursor-pointer gap-2"
              >
                <User className="h-4 w-4" />
                Dados pessoais
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.navigate({ to: "/recuperar-senha" })}
                className="cursor-pointer gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Trocar senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm">
        <button
          onClick={goPrevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-base font-semibold text-foreground">
              {MONTHS[selectedMonth]} {selectedYear}
            </span>
          </div>
          {isCurrentMonth && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Mês atual
            </span>
          )}
        </div>

        <button
          onClick={goNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm opacity-90">Saldo do mês</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{hidden(balance)}</p>
        </div>
      </div>

      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">Receitas</span>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600">{hiddenSign(income, "+")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-xs text-muted-foreground">Despesas</span>
          </div>
          <p className="mt-2 text-lg font-bold text-red-500">{hiddenSign(expense, "-")}</p>
        </div>
      </div>

      {/* Savings hint */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
          <PiggyBank className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Economia do mês</p>
          <p className="text-xs text-muted-foreground">
            {income > 0
              ? `Você economizou ${Math.max(0, Math.round((balance / income) * 100))}% das receitas`
              : "Sem receitas neste mês"}
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-sm font-bold text-primary">{hidden(Math.max(0, balance))}</span>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {categories.map((cat) => (
              <div key={cat.name} className={`${cat.color}`} style={{ width: `${cat.value}%` }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {categories.slice(0, 4).map((cat) => (
              <div key={cat.name} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${cat.color}`} />
                <span className="text-xs text-muted-foreground">{cat.name} • {cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pendências */}
      {billReminders && <PendingSection transactions={monthTx} showValues={showValues} />}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Últimas transações</h2>
          <span className="text-xs text-muted-foreground">{MONTHS[selectedMonth]}</span>
        </div>
        <div className="mt-3 space-y-2">
          {monthTx.length === 0 && (
            <p className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">
              Nenhuma transação neste mês.
            </p>
          )}
          {monthTx.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm"
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
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.category} • {relativeLabel(t._d)}</p>
                </div>
              </div>
              <p
                className={`text-sm font-semibold ${
                  t.type === "income" ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {hiddenSign(Math.abs(t.amount), t.type === "income" ? "+" : "-")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type PendingTx = ReturnType<typeof parseBrDate> extends Date
  ? { id: string; title: string; amount: number; type: "income" | "expense"; category: string; settled: boolean; _d: Date }
  : never;

function PendingSection({ transactions, showValues }: { transactions: PendingTx[]; showValues: boolean }) {
  const pending = transactions.filter((t) => !t.settled);
  if (pending.length === 0) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleSettle = (t: PendingTx) => {
    toggleSettled(t.id);
    toast.success(t.type === "income" ? "Receita recebida" : "Despesa paga", {
      description: t.title,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Pendências</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
            {pending.length}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Marque para concluir</span>
      </div>
      <div className="mt-3 space-y-2">
        {pending.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.category} • {t.type === "income" ? "A receber" : "A pagar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-semibold ${
                  t.type === "income" ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {showValues
                  ? `${t.type === "income" ? "+" : "-"}${fmt(Math.abs(t.amount))}`
                  : "••••"}
              </p>
              <button
                onClick={() => handleSettle(t)}
                aria-label={t.type === "income" ? "Marcar como recebida" : "Marcar como paga"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 bg-transparent text-emerald-500 shadow-sm transition-colors hover:bg-emerald-500/10"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
