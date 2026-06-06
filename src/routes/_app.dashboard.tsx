import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight,
  CalendarDays, Eye, EyeOff, AlertCircle, Check, User, LogOut,
  KeyRound, CreditCard, Plus, ChevronRight as ChevRight, Receipt,
} from "lucide-react";
import { useTransactions, parseBrDate, toggleSettled } from "@/lib/transactions-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Finanças Pessoais" }] }),
  component: DashboardPage,
});

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CATEGORY_COLORS = ["bg-emerald-500","bg-teal-500","bg-cyan-500","bg-sky-500","bg-indigo-500","bg-violet-500","bg-slate-400"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR",{ style:"currency", currency:"BRL" }).format(v);

function relativeLabel(date: Date): string {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(date); d.setHours(0,0,0,0);
  const diff = Math.round((today.getTime()-d.getTime())/86400000);
  if (diff===0) return "Hoje";
  if (diff===1) return "Ontem";
  if (diff>1&&diff<7) return `${diff} dias atrás`;
  return d.toLocaleDateString("pt-BR");
}

type Notifs = { expenseAlerts:boolean; monthlySummary:boolean; goalsReached:boolean; billReminders:boolean };
const DEFAULT_NOTIFS: Notifs = { expenseAlerts:true, monthlySummary:true, goalsReached:true, billReminders:false };

function loadNotifs(): Notifs {
  if (typeof window==="undefined") return DEFAULT_NOTIFS;
  try { const raw=localStorage.getItem("fp:notifs"); return raw?{...DEFAULT_NOTIFS,...(JSON.parse(raw) as Notifs)}:DEFAULT_NOTIFS; }
  catch { return DEFAULT_NOTIFS; }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h<12) return "Bom dia"; if (h<18) return "Boa tarde"; return "Boa noite";
}

// ── Identifica transação de cartão de crédito (não mostrar em pendências) ──
function isCardTransaction(t: { source?: string; category?: string }): boolean {
  return t.source === "invoice" || t.category === "Cartão de Crédito";
}

function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name, role").eq("id", user.id).single()
      .then(({ data }) => { setUserName(data?.name ?? user.user_metadata?.name ?? ""); setIsAdmin(data?.role==="admin"); });
  }, [user]);

  const handleSignOut = async () => { await signOut(); router.navigate({ to:"/login" }); };

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [showValues, setShowValues]       = useState(true);
  const [billReminders, setBillReminders] = useState(DEFAULT_NOTIFS.billReminders);

  useEffect(() => {
    const notifs = loadNotifs(); setBillReminders(notifs.billReminders);
    const onStorage = (e: StorageEvent) => { if (e.key==="fp:notifs") setBillReminders(loadNotifs().billReminders); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const hidden = (v: number) => showValues ? fmt(v) : "••••";
  const hiddenSign = (v: number, sign: string) => showValues ? `${sign}${fmt(v)}` : "••••";
  const transactions = useTransactions();

  const monthTx = useMemo(() => transactions
    .map(t => ({ ...t, _d: parseBrDate(t.date) }))
    .filter(t => t._d.getMonth()===selectedMonth && t._d.getFullYear()===selectedYear)
    .sort((a,b) => b._d.getTime()-a._d.getTime()),
    [transactions, selectedMonth, selectedYear]
  );

  const { income, expense, balance } = useMemo(() => {
    let inc=0, exp=0;
    for (const t of monthTx) { if (t.type==="income") inc+=Math.abs(t.amount); else exp+=Math.abs(t.amount); }
    return { income:inc, expense:exp, balance:inc-exp };
  }, [monthTx]);

  const categories = useMemo(() => {
    const totals = new Map<string,number>(); let total=0;
    for (const t of monthTx) {
      if (t.type!=="expense") continue;
      const v=Math.abs(t.amount); totals.set(t.category,(totals.get(t.category)??0)+v); total+=v;
    }
    return [...totals.entries()].sort((a,b)=>b[1]-a[1])
      .map(([name,value],i) => ({ name, value: total>0?Math.round((value/total)*100):0, color:CATEGORY_COLORS[i%CATEGORY_COLORS.length] }));
  }, [monthTx]);

  const goPrevMonth = () => { if (selectedMonth===0){setSelectedMonth(11);setSelectedYear(y=>y-1);}else setSelectedMonth(m=>m-1); };
  const goNextMonth = () => { if (selectedMonth===11){setSelectedMonth(0);setSelectedYear(y=>y+1);}else setSelectedMonth(m=>m+1); };
  const isCurrentMonth = selectedMonth===now.getMonth()&&selectedYear===now.getFullYear();

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <h1 className="text-lg font-bold text-foreground">{userName||"..."}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowValues(s=>!s)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-secondary/80">
            {showValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xl shadow-sm ring-2 ring-primary/30 hover:ring-primary/50 focus:outline-none">🐶</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-foreground truncate">{userName||"Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email??""}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.navigate({ to:"/perfil" })} className="cursor-pointer gap-2">
                <User className="h-4 w-4" /> Dados pessoais
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.navigate({ to:"/recuperar-senha" })} className="cursor-pointer gap-2">
                <KeyRound className="h-4 w-4" /> Trocar senha
              </DropdownMenuItem>
              {isAdmin && (<>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.navigate({ to:"/admin" })} className="cursor-pointer gap-2 text-primary">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Painel Admin
                </DropdownMenuItem>
              </>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm">
        <button onClick={goPrevMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-base font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span>
          </div>
          {isCurrentMonth && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Mês atual</span>}
        </div>
        <button onClick={goNextMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
            <span className="text-xs text-muted-foreground">Receitas</span>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600">{hiddenSign(income,"+")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100"><TrendingDown className="h-4 w-4 text-red-500" /></div>
            <span className="text-xs text-muted-foreground">Despesas</span>
          </div>
          <p className="mt-2 text-lg font-bold text-red-500">{hiddenSign(expense,"-")}</p>
        </div>
      </div>

      {/* Savings hint */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20"><PiggyBank className="h-5 w-5 text-primary" /></div>
        <div>
          <p className="text-sm font-medium text-foreground">Economia do mês</p>
          <p className="text-xs text-muted-foreground">{income>0?`Você economizou ${Math.max(0,Math.round((balance/income)*100))}% das receitas`:"Sem receitas neste mês"}</p>
        </div>
        <div className="ml-auto"><span className="text-sm font-bold text-primary">{hidden(Math.max(0,balance))}</span></div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {categories.map(cat => <div key={cat.name} className={cat.color} style={{ width:`${cat.value}%` }} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {categories.slice(0,4).map(cat => (
              <div key={cat.name} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${cat.color}`} />
                <span className="text-xs text-muted-foreground">{cat.name} • {cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pendências */}
      {billReminders && (
        <PendingSection
          transactions={monthTx}
          showValues={showValues}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Últimas transações</h2>
          <span className="text-xs text-muted-foreground">{MONTHS[selectedMonth]}</span>
        </div>
        <div className="mt-3 space-y-2">
          {monthTx.length === 0 && (
            <p className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">Nenhuma transação neste mês.</p>
          )}
          {monthTx.slice(0,5).map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type==="income"?"bg-emerald-100":"bg-red-100"}`}>
                  {t.type==="income" ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.category} • {relativeLabel(t._d)}</p>
                </div>
              </div>
              <p className={`text-sm font-semibold ${t.type==="income"?"text-emerald-600":"text-red-500"}`}>
                {hiddenSign(Math.abs(t.amount),t.type==="income"?"+":"-")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PendingSection ─────────────────────────────────────────────────────
type PendingTx = { id:string; title:string; amount:number; type:"income"|"expense"; category:string; settled:boolean; source?:string; _d:Date };

function PendingSection({
  transactions, showValues, selectedMonth, selectedYear
}: {
  transactions: PendingTx[];
  showValues: boolean;
  selectedMonth: number;
  selectedYear: number;
}) {
  const router = useRouter();
  const { cards, invoices, expenses, installments, fetchCards, fetchInvoices, fetchExpenses, fetchInstallments } = useCardStore();
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailCard, setDetailCard]       = useState<CreditCardType | null>(null);

  useEffect(() => { fetchCards(); }, []);
  useEffect(() => {
    cards.forEach(c => fetchInvoices(c.id));
  }, [cards.length]);

  // Pendências regulares: excluir transações de cartão
  const regularPending = useMemo(() =>
    transactions.filter(t => !t.settled && !isCardTransaction(t)),
    [transactions]
  );

  // Faturas abertas com despesas no mês selecionado (pelo vencimento)
  const pendingInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status !== "open" || inv.total_amount <= 0) return false;
      const due = new Date(inv.due_date + "T12:00:00");
      return due.getMonth() === selectedMonth && due.getFullYear() === selectedYear;
    }).map(inv => ({
      invoice: inv,
      card: cards.find(c => c.id === inv.card_id),
    })).filter(item => item.card?.active);
  }, [invoices, cards, selectedMonth, selectedYear]);

  const totalCount = regularPending.length + pendingInvoices.length;
  if (totalCount === 0) return null;

  const handleSettle = (t: PendingTx) => {
    toggleSettled(t.id);
    toast.success(t.type==="income"?"Receita recebida":"Despesa paga", { description: t.title });
  };

  const openDetail = async (invoice: Invoice, card: CreditCardType) => {
    setDetailInvoice(invoice);
    setDetailCard(card);
    await fetchExpenses(invoice.id);
    await fetchInstallments(invoice.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Pendências</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
            {totalCount}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Marque para concluir</span>
      </div>

      <div className="mt-3 space-y-2">
        {/* Faturas de cartão */}
        {pendingInvoices.map(({ invoice, card }) => (
          <div key={invoice.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  Fatura {card?.name} — {invoice.competence}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")} • A pagar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-red-500">
                {showValues ? `-${fmt(invoice.total_amount)}` : "••••"}
              </p>
              {/* Botão detalhar despesas */}
              <button
                onClick={() => card && openDetail(invoice, card)}
                title="Ver despesas desta fatura"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400 bg-transparent text-blue-500 transition-colors hover:bg-blue-500/10"
              >
                <Receipt className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Pendências regulares */}
        {regularPending.map(t => (
          <div key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.category} • {t.type==="income"?"A receber":"A pagar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${t.type==="income"?"text-emerald-600":"text-red-500"}`}>
                {showValues ? `${t.type==="income"?"+":"-"}${fmt(Math.abs(t.amount))}` : "••••"}
              </p>
              <button onClick={() => handleSettle(t)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10">
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de detalhes da fatura */}
      <InvoiceDetailModal
        invoice={detailInvoice}
        card={detailCard}
        expenses={expenses.filter(e => e.invoice_id === detailInvoice?.id)}
        installments={installments.filter(i => i.invoice_id === detailInvoice?.id)}
        open={!!detailInvoice}
        onClose={() => { setDetailInvoice(null); setDetailCard(null); }}
        onAddExpense={() => {
          setDetailInvoice(null);
          setDetailCard(null);
          router.navigate({ to: "/cartoes/nova-despesa", search: { cardId: detailCard?.id } });
        }}
      />
    </div>
  );
}

// ── Modal de detalhes da fatura ────────────────────────────────────────
function InvoiceDetailModal({
  invoice, card, expenses, installments, open, onClose, onAddExpense,
}: {
  invoice: Invoice | null;
  card: CreditCardType | null;
  expenses: ReturnType<typeof useCardStore.getState>["expenses"];
  installments: ReturnType<typeof useCardStore.getState>["installments"];
  open: boolean;
  onClose: () => void;
  onAddExpense: () => void;
}) {
  if (!invoice || !card) return null;

  const isPaid = invoice.status === "paid";

  const allItems = [
    ...expenses.map(e => ({
      id: e.id, description: e.description,
      amount: e.amount, category: e.category,
      date: e.purchase_date, type: e.expense_type,
    })),
    ...installments.map(i => ({
      id: i.id, description: i.description,
      amount: i.amount, category: i.category,
      date: i.purchase_date, type: "installment" as const,
    })),
  ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-5 pt-5 pb-4 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground">
              Fatura {card.name}
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {invoice.competence} • Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-3 text-2xl font-bold text-primary-foreground">
            {fmt(invoice.total_amount)}
          </p>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${isPaid ? "bg-emerald-400/30 text-emerald-100" : "bg-amber-400/30 text-amber-100"}`}>
            {isPaid ? "Paga" : "Em aberto"}
          </span>
        </div>

        {/* Lista de despesas */}
        <div className="max-h-72 overflow-y-auto">
          {allItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma despesa lançada nesta fatura.
            </p>
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
                  <p className="shrink-0 text-sm font-semibold text-red-500">
                    -{fmt(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>

          {/* Botão "+" para nova despesa — só se fatura não estiver paga */}
          {!isPaid && (
            <button
              onClick={onAddExpense}
              title="Adicionar despesa nesta fatura"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
