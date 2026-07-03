import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Eye, EyeOff, AlertCircle, Check, User, LogOut, KeyRound, CreditCard, Plus, Receipt, Shield, ListChecks, Settings, Wallet, X, Pencil, Save, Trash2, Search } from "lucide-react";
import { useTransactions, parseBrDate, toggleSettled, updateTransaction, deleteTransaction, deleteTransactionSeries, type Transaction } from "@/lib/transactions-store";
import { useCategories } from "@/lib/categories-store";
import { useAccountBalance, saveAccountBalance } from "@/lib/account-balance-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { DatePicker } from "@/components/cartoes/date-picker";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Finanças Pessoais" }] }),
  component: DashboardPage,
});

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
// Paleta neutra (slate) usada no gráfico de barras de "Gastos por categoria"
const NEUTRAL_BAR_COLORS = ["bg-slate-800","bg-slate-600","bg-slate-500","bg-slate-400","bg-slate-300","bg-slate-200"];
const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR",{ style:"currency", currency:"BRL" }).format(v);

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
  const h=new Date().getHours();
  if(h<12)return "Bom dia"; if(h<18)return "Boa tarde"; return "Boa noite";
}
function isCardRelated(t:{source?:string;category?:string}):boolean {
  return t.source==="invoice"||t.category==="Cartão de Crédito";
}

// ── Helpers de input monetário (mesmo padrão usado em outras telas do app) ─
function formatBalanceInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseBalanceInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

// Item unificado para "Últimas transações"
type RecentItem = {
  id: string; title: string; amount: number; type: "income"|"expense";
  category: string; _d: Date; isCardExpense: boolean; cardName?: string; settled?: boolean;
};

// ── Campo de senha com toggle mostrar/ocultar ─────────────────────────────
function PasswordInput({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-10 pr-10" />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function DashboardPage() {
  const {user,signOut}=useAuth();
  const router=useRouter();
  const [userName,setUserName]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);
  const [openPassword, setOpenPassword]   = useState(false);
  const [currentPwd, setCurrentPwd]       = useState("");
  const [newPwd, setNewPwd]               = useState("");
  const [confirmPwd, setConfirmPwd]       = useState("");
  const [pwdError, setPwdError]           = useState<string|null>(null);
  const [pwdSaving, setPwdSaving]         = useState(false);

  useEffect(()=>{
    if(!user)return;
    supabase.from("profiles").select("name,role").eq("id",user.id).single()
      .then(({data})=>{setUserName(data?.name??user.user_metadata?.name??"");setIsAdmin(data?.role==="admin");});
  },[user]);

  const handleSignOut=async()=>{await signOut();router.navigate({to:"/login"});};

  const openPasswordDialog = () => {
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdError(null);
    setOpenPassword(true);
  };

  const savePassword = async () => {
    setPwdError(null);
    if (!currentPwd) { setPwdError("Informe a senha atual"); return; }
    if (newPwd.length < 6) { setPwdError("Mínimo 6 caracteres"); return; }
    if (newPwd !== confirmPwd) { setPwdError("As senhas não coincidem"); return; }
    if (newPwd === currentPwd) { setPwdError("A nova senha deve ser diferente da atual"); return; }
    setPwdSaving(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user?.email ?? "", password: currentPwd });
      if (signInErr) { setPwdError("Senha atual incorreta"); return; }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updErr) throw updErr;
      toast.success("Senha alterada com sucesso!");
      setOpenPassword(false);
    } catch { setPwdError("Erro ao alterar senha. Tente novamente."); }
    finally { setPwdSaving(false); }
  };

  const now=new Date();
  const [selectedMonth,setSelectedMonth]=useState(now.getMonth());
  const [selectedYear,setSelectedYear]=useState(now.getFullYear());
  const [showValues,setShowValues]=useState(true);
  const [billReminders,setBillReminders]=useState(DEFAULT_NOTIFS.billReminders);
  const [showRecent,setShowRecent]=useState(false); // "Últimas movimentações" — colapsada por padrão
  const allCategories=useCategories();
  const categoryIconMap=useMemo(()=>Object.fromEntries(allCategories.map(c=>[c.name,c.icon??"📦"])),[allCategories]);

  // ── Estados dos modais (só useState, sem dependência de monthTx) ─────────
  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [openIncomeModal, setOpenIncomeModal] = useState(false);
  // Modal de detalhe por categoria
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Edição de transação (nos modais do dashboard) ─────────────────────────
  const [editingTx, setEditingTx]         = useState<Transaction | null>(null);
  const [editScope, setEditScope]         = useState<"single" | "bulk" | null>(null);
  const [showEditScope, setShowEditScope] = useState(false);

  function openTxEdit(tx: Transaction) {
    setEditingTx(tx);
    // Transações geradas por fatura não são editáveis pelo dashboard
    if (tx.source === "invoice") {
      toast.info("Esta transação é um pagamento de fatura. Edite pela tela de Faturas.");
      return;
    }
    if (tx.recurrence_id) {
      setShowEditScope(true);  // perguntar: só esta ou todas
    } else {
      setEditScope("single");  // editar direto
    }
  }

  function closeTxEdit() {
    setEditingTx(null);
    setEditScope(null);
    setShowEditScope(false);
  }

  // ── Saldo da conta ───────────────────────────────────────────────────────
  const accountBalance = useAccountBalance();
  const [openBalanceSetup, setOpenBalanceSetup] = useState(false);
  const [balanceEnabled, setBalanceEnabled] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);

  // Preenche o formulário do modal com os valores atuais sempre que ele abre
  useEffect(() => {
    if (openBalanceSetup) {
      setBalanceEnabled(accountBalance.enabled);
      setBalanceInput(
        accountBalance.initialBalance
          ? accountBalance.initialBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : ""
      );
    }
  }, [openBalanceSetup]); // eslint-disable-line

  const handleSaveBalance = async () => {
    setSavingBalance(true);
    try {
      await saveAccountBalance({
        initialBalance: parseBalanceInput(balanceInput),
        enabled: balanceEnabled,
      });
      toast.success("Saldo da conta atualizado!");
      setOpenBalanceSetup(false);
    } catch (err: unknown) {
      console.error("[dashboard] erro ao salvar saldo da conta:", err);
      toast.error((err as { message?: string })?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSavingBalance(false);
    }
  };

  useEffect(()=>{
    const notifs=loadNotifs();setBillReminders(notifs.billReminders);
    const onStorage=(e:StorageEvent)=>{if(e.key==="fp:notifs")setBillReminders(loadNotifs().billReminders);};
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[]);

  const hidden=(v:number)=>showValues?fmtCurrency(v):"••••";
  const hiddenSign=(v:number,sign:string)=>showValues?`${sign}${fmtCurrency(v)}`:"••••";

  const transactions=useTransactions();
  const {cards,invoices,expenses,installments,fetchCards,fetchInvoices,fetchExpenses,fetchInstallments}=useCardStore();

  // Carregar dados de cartão
  useEffect(()=>{fetchCards();},[]);
  useEffect(()=>{cards.forEach(c=>fetchInvoices(c.id));},[cards.length]);

  // Carregar despesas das faturas do mês selecionado
  useEffect(()=>{
    const monthInvoices=invoices.filter(inv=>{
      const due=new Date(inv.due_date+"T12:00:00");
      const closing=new Date(inv.closing_date+"T12:00:00");
      return (due.getMonth()===selectedMonth&&due.getFullYear()===selectedYear)||
             (closing.getMonth()===selectedMonth&&closing.getFullYear()===selectedYear);
    });
    monthInvoices.forEach(inv=>{fetchExpenses(inv.id);fetchInstallments(inv.id);});
  },[invoices.length,selectedMonth,selectedYear]);

  const monthTx=useMemo(()=>transactions
    .map(t=>({...t,_d:parseBrDate(t.date)}))
    .filter(t=>t._d.getMonth()===selectedMonth&&t._d.getFullYear()===selectedYear)
    .sort((a,b)=>b._d.getTime()-a._d.getTime()),
    [transactions,selectedMonth,selectedYear]
  );

  const {income,expense,balance}=useMemo(()=>{
    let inc=0,exp=0;
    for(const t of monthTx){if(t.type==="income")inc+=Math.abs(t.amount);else exp+=Math.abs(t.amount);}
    return{income:inc,expense:exp,balance:inc-exp};
  },[monthTx]);

  const categories=useMemo(()=>{
    const totals:any={};let total=0;
    for(const t of monthTx){if(t.type!=="expense")continue;const v=Math.abs(t.amount);totals[t.category]=(totals[t.category]||0)+v;total+=v;}
    return Object.entries(totals).sort((a,b)=>(b[1] as number)-(a[1] as number)).map(([name,amount])=>({
      name,
      amount: amount as number,
      percent: total>0?Math.round(((amount as number)/total)*100):0,
    }));
  },[monthTx]);

  // ── Dados para os modais de Despesas e Receitas (dependem de monthTx) ───
  function groupByDay(items: typeof monthTx) {
    const map: Record<string, typeof items> = {};
    for (const t of items) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return Object.entries(map).sort((a, b) => {
      const [da, ma, ya] = a[0].split("/").map(Number);
      const [db, mb, yb] = b[0].split("/").map(Number);
      return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
    });
  }

  const expensesByDay  = useMemo(() => groupByDay(monthTx.filter(t => t.type === "expense")), [monthTx]);
  const expensePaid    = useMemo(() => monthTx.filter(t => t.type === "expense" && t.settled).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTx]);
  const expensePending = useMemo(() => monthTx.filter(t => t.type === "expense" && !t.settled).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTx]);

  const incomesByDay   = useMemo(() => groupByDay(monthTx.filter(t => t.type === "income")), [monthTx]);
  const incomePaid     = useMemo(() => monthTx.filter(t => t.type === "income" && t.settled).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTx]);
  const incomePending  = useMemo(() => monthTx.filter(t => t.type === "income" && !t.settled).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTx]);

  // ── Transações da categoria selecionada (para o modal de categoria) ───────
  const categoryTxs = useMemo(() =>
    selectedCategory
      ? monthTx.filter(t => t.type === "expense" && t.category === selectedCategory)
              .sort((a, b) => b._d.getTime() - a._d.getTime())
      : [],
    [monthTx, selectedCategory]
  );
  const categoryTxsByDay = useMemo(() => groupByDay(categoryTxs), [categoryTxs]);
  const categoryTotal    = useMemo(() => categoryTxs.reduce((s, t) => s + Math.abs(t.amount), 0), [categoryTxs]);

  // ── Itens unificados para "Últimas transações" ────────────────────────
  const recentItems=useMemo(():RecentItem[]=>{
    const today=new Date(); today.setHours(0,0,0,0);

    // ── Transações regulares (não-cartão) ─────────────────────────────────
    // Regras de agrupamento:
    //  • Parceladas (installments_total > 1): mostrar apenas installment_number=1
    //    (a "compra original"), independente da data — representa toda a série.
    //  • Recorrentes (recurrence_id sem installments_total): mostrar a parcela
    //    mais próxima de hoje (passada ou futura imediata), 1 por recurrence_id.
    //  • Avulsas: sempre mostrar individualmente.

    // Agrupa recorrentes por recurrence_id → guarda a mais próxima de hoje
    const recMap:Record<string,typeof transactions[0]&{_d:Date}>={}; 
    const withDate=transactions
      .filter(t=>!isCardRelated(t))
      .map(t=>({...t,_d:parseBrDate(t.date)}));

    for(const t of withDate){
      if(!t.recurrence_id) continue;
      // Parceladas: só o representante (parcela 1) entra neste mapa
      if((t.installments_total??0)>1){
        if((t.installment_number??0)===1) recMap[t.recurrence_id]=t;
        continue;
      }
      // Recorrentes mensais: guarda a mais próxima de hoje
      const existing=recMap[t.recurrence_id];
      if(!existing){
        recMap[t.recurrence_id]=t; continue;
      }
      const diffNew=Math.abs(t._d.getTime()-today.getTime());
      const diffOld=Math.abs(existing._d.getTime()-today.getTime());
      if(diffNew<diffOld) recMap[t.recurrence_id]=t;
    }

    const regular:RecentItem[]=withDate
      .filter(t=>{
        if(!t.recurrence_id) return true; // avulsa: sempre inclui
        // recorrente/parcelada: só entra se for o representante escolhido acima
        return recMap[t.recurrence_id]?.id===t.id;
      })
      .map(t=>({
        id:t.id,title:t.title,amount:t.amount,type:t.type,category:t.category,_d:t._d,
        isCardExpense:false,settled:t.settled,
        expenseType:t.recurrence_id
          ?((t.installments_total??0)>1?"installment":"recurring")
          :"single" as const,
        installmentsTotal:t.installments_total??undefined,
        totalAmount:((t.installment_number??0)===1&&(t.installments_total??0)>1)
          ?Math.abs(t.amount)*(t.installments_total??1):undefined,
      }));

    // ── Despesas avulsas de cartão ────────────────────────────────────────
    const cardExp:RecentItem[]=expenses
      .filter(e=>e.expense_type==="single")
      .map(e=>{
        const card=cards.find(c=>c.id===e.card_id);
        return{id:e.id,title:e.description,amount:-Math.abs(e.amount),type:"expense" as const,
          category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),
          isCardExpense:true,cardName:card?.name,expenseType:"single"};
      });

    // ── Parceladas de cartão: só a parcela 1 (representa toda a compra) ───
    const cardInst:RecentItem[]=expenses
      .filter(e=>e.expense_type==="installment"&&(e.installment_number??1)===1)
      .map(e=>{
        const card=cards.find(c=>c.id===e.card_id);
        const tot=Math.abs(e.amount)*(e.installments_total??1);
        const ttl=e.description.replace(" 1/"+String(e.installments_total||""),"").trim();
        return{id:e.id,title:ttl||e.description,amount:-Math.abs(e.amount),totalAmount:tot,
          type:"expense" as const,category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),
          isCardExpense:true,cardName:card?.name,expenseType:"installment",
          installmentsTotal:(e.installments_total??1)};
      });

    // ── Recorrentes de cartão: 1 por descrição+cartão, mais próxima de hoje ─
    const cardRecMap:Record<string,typeof expenses[0]>={};
    for(const e of expenses.filter(e=>e.expense_type==="recurring")){
      const k=e.description+"__"+e.card_id;
      const existing=cardRecMap[k];
      if(!existing){cardRecMap[k]=e;continue;}
      const dNew=Math.abs(new Date(e.purchase_date+"T12:00:00").getTime()-today.getTime());
      const dOld=Math.abs(new Date(existing.purchase_date+"T12:00:00").getTime()-today.getTime());
      if(dNew<dOld) cardRecMap[k]=e;
    }
    const cardRec:RecentItem[]=Object.values(cardRecMap).map(e=>{
      const card=cards.find(c=>c.id===e.card_id);
      return{id:e.id,title:e.description,amount:-Math.abs(e.amount),type:"expense" as const,
        category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),
        isCardExpense:true,cardName:card?.name,expenseType:"recurring"};
    });

    // ── Ordenação final: mais próximo de hoje primeiro (passado ou futuro) ─
    // Não usamos simplesmente "mais recente" porque isso faria futuros subirem
    // ao topo. Queremos: primeiro as do dia de hoje/ontem, depois passado
    // recente, depois futuro próximo.
    return[...regular,...cardExp,...cardInst,...cardRec]
      .sort((a,b)=>{
        const da=Math.abs(a._d.getTime()-today.getTime());
        const db=Math.abs(b._d.getTime()-today.getTime());
        return da-db;
      })
      .slice(0,7);
  },[transactions,expenses,cards]);



  const monthCardTotal=useMemo(()=>invoices.filter(inv=>{
    const due=new Date(inv.due_date+"T12:00:00");
    return due.getMonth()===selectedMonth&&due.getFullYear()===selectedYear&&inv.status!=="paid";
  }).reduce((s,inv)=>s+inv.total_amount,0),[invoices,selectedMonth,selectedYear]);

  const goPrevMonth=()=>{if(selectedMonth===0){setSelectedMonth(11);setSelectedYear(y=>y-1);}else setSelectedMonth(m=>m-1);};
  const goNextMonth=()=>{if(selectedMonth===11){setSelectedMonth(0);setSelectedYear(y=>y+1);}else setSelectedMonth(m=>m+1);};
  const isCurrentMonth=selectedMonth===now.getMonth()&&selectedYear===now.getFullYear();

  return (
    <div className="space-y-5 p-5 md:p-8 md:max-w-screen-xl md:mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 md:pb-4">
        <div>
          <p className="text-sm text-muted-foreground">{getGreeting()},</p>
          <h1 className="text-lg font-bold text-foreground">{userName||"..."}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowValues(s=>!s)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-secondary/80">
            {showValues?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}
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
              <DropdownMenuSeparator/>
              <DropdownMenuItem onClick={()=>router.navigate({to:"/perfil"})} className="cursor-pointer gap-2"><User className="h-4 w-4"/>Dados pessoais</DropdownMenuItem>
              <DropdownMenuItem onClick={openPasswordDialog} className="cursor-pointer gap-2"><KeyRound className="h-4 w-4"/>Trocar senha</DropdownMenuItem>
              {isAdmin&&(<><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>router.navigate({to:"/admin"})} className="cursor-pointer gap-2 text-primary"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Painel Admin</DropdownMenuItem></>)}
              <DropdownMenuSeparator/>
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive"><LogOut className="h-4 w-4"/>Sair da conta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm md:p-5">
        <button onClick={goPrevMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"><ChevronLeft className="h-5 w-5"/></button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary"/><span className="text-base font-semibold text-foreground">{MONTHS[selectedMonth]} {selectedYear}</span></div>
          {isCurrentMonth&&<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Mês atual</span>}
        </div>
        <button onClick={goNextMonth} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"><ChevronRight className="h-5 w-5"/></button>
      </div>

      {/* Balance Cards — Saldo do mês + Saldo da conta (mesma linha) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10"/>
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/10"/>
          <div className="relative">
            <p className="text-xs opacity-90">Saldo do mês</p>
            <p className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{hidden(balance)}</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-800 p-5 text-white shadow-lg shadow-slate-800/20">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10"/>
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/10"/>
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs opacity-80">Saldo da conta</p>
              <button onClick={() => setOpenBalanceSetup(true)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                title="Configurar saldo da conta">
                <Settings className="h-3 w-3"/>
              </button>
            </div>
            {accountBalance.enabled ? (
              <p className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{hidden(accountBalance.currentBalance)}</p>
            ) : (
              <button onClick={() => setOpenBalanceSetup(true)}
                className="mt-2 text-left text-[13px] font-medium text-white/85 underline underline-offset-2">
                Configurar saldo inicial
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setOpenIncomeModal(true)}
          className="rounded-xl border bg-card p-4 shadow-sm text-left transition-all active:scale-[0.97] hover:shadow-md hover:border-emerald-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100"><TrendingUp className="h-4 w-4 text-emerald-600"/></div><span className="text-xs text-muted-foreground">Receitas</span></div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50"/>
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-600">{hidden(income)}</p>
        </button>
        <button type="button" onClick={() => setOpenExpenseModal(true)}
          className="rounded-xl border bg-card p-4 shadow-sm text-left transition-all active:scale-[0.97] hover:shadow-md hover:border-red-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100"><TrendingDown className="h-4 w-4 text-red-500"/></div><span className="text-xs text-muted-foreground">Despesas</span></div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50"/>
          </div>
          <p className="mt-2 text-lg font-bold text-red-500">{hidden(expense)}</p>
        </button>
      </div>

      {/* ── Pendências — logo abaixo das receitas/despesas ── */}
      {billReminders&&(
        <PendingSection
          transactions={monthTx} showValues={showValues}
          selectedMonth={selectedMonth} selectedYear={selectedYear}
          cards={cards} invoices={invoices} expenses={expenses} installments={installments}
          router={router} categoryIconMap={categoryIconMap}
        />
      )}

      {/* ── Desktop: 2 colunas — coluna esquerda: savings/categories | direita: recent ── */}
      <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start space-y-5 md:space-y-0">
        {/* Coluna esquerda (desktop): savings, categories, pending */}
        <div className="space-y-5">
      {monthCardTotal > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 shrink-0">
            <CreditCard className="h-5 w-5 text-blue-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Faturas do mês</p>
            <p className="text-xs text-muted-foreground">{MONTHS[selectedMonth]} · a vencer</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-red-500">{hidden(monthCardTotal)}</p>
            <button onClick={()=>router.navigate({to:"/faturas-cartao"})} className="text-[10px] text-blue-500 font-medium">Ver faturas</button>
          </div>
        </div>
      )}

      {/* Savings hint */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20"><PiggyBank className="h-5 w-5 text-primary"/></div>
        <div>
          <p className="text-sm font-medium text-foreground">Economia do mês</p>
          <p className="text-xs text-muted-foreground">{income>0?`Você economizou ${Math.max(0,Math.round((balance/income)*100))}% das receitas`:"Sem receitas neste mês"}</p>
        </div>
        <div className="ml-auto"><span className="text-sm font-bold text-primary">{hidden(Math.max(0,balance))}</span></div>
      </div>

      {/* Category breakdown — barras horizontais, paleta neutra, ícone + valor + percentual */}
      {categories.length>0&&(
        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
            <span className="text-xs text-muted-foreground">{MONTHS[selectedMonth]}</span>
          </div>
          <div className="space-y-3.5">
            {categories.slice(0,6).map((cat,i)=>{
              const icon=categoryIconMap[cat.name]??"📦";
              const barColor=NEUTRAL_BAR_COLORS[i%NEUTRAL_BAR_COLORS.length];
              return (
                <button key={cat.name} type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className="flex w-full items-center gap-3 text-left transition-all active:scale-[0.98] hover:opacity-80 rounded-xl">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{cat.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs font-semibold text-foreground">
                          {hidden(cat.amount)}
                          <span className="ml-1 font-normal text-muted-foreground">· {cat.percent}%</span>
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className="text-muted-foreground/50 shrink-0">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all duration-500",barColor)} style={{width:`${cat.percent}%`}}/>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      </div>{/* fim coluna esquerda */}

        {/* Coluna direita (desktop): últimas transações */}
        <div className="space-y-5">
      {/* ── Últimas movimentações — sem filtro de mês, cabeçalho colapsável ── */}
      <div className="md:bg-card md:border md:rounded-2xl md:p-5 md:shadow-sm">
        <div
          role="button"
          tabIndex={0}
          onClick={()=>setShowRecent(o=>!o)}
          onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" ")setShowRecent(o=>!o);}}
          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm md:border-none md:bg-transparent md:p-0 md:shadow-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ListChecks className="h-4.5 w-4.5 text-primary"/>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Últimas movimentações</h2>
              <p className="text-xs text-muted-foreground">
                {recentItems.length} {recentItems.length===1?"lançamento":"lançamentos"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={(e)=>{e.stopPropagation();router.navigate({to:"/transacoes"});}}
              className="text-xs text-primary font-medium hover:underline"
            >
              Ver tudo
            </button>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300",showRecent&&"rotate-180")}/>
          </div>
        </div>

        <div className={cn("grid transition-all duration-300 ease-in-out",showRecent?"grid-rows-[1fr] opacity-100":"grid-rows-[0fr] opacity-0")}>
          <div className="overflow-hidden min-h-0">
        <div className="mt-3 space-y-2">
          {recentItems.length===0&&(
            <p className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">Nenhuma movimentação.</p>
          )}
          {recentItems.slice(0,7).map(t=>(
            <div key={t.id} className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-full",
                  t.isCardExpense?"bg-blue-100":t.type==="income"?"bg-emerald-100":"bg-red-100"
                )}>
                  {t.isCardExpense
                    ?<CreditCard className="h-4 w-4 text-blue-500"/>
                    :t.type==="income"
                    ?<TrendingUp className="h-4 w-4 text-emerald-600"/>
                    :<TrendingDown className="h-4 w-4 text-red-500"/>
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeLabel(t._d)}
                    {t.isCardExpense&&t.cardName&&<span className="ml-1 font-medium text-blue-500">• {t.cardName}</span>}
                    {t.expenseType==="recurring"&&<span className="ml-1 text-violet-600">♺</span>}
                    {t.expenseType==="installment"&&t.installmentsTotal&&<span className="ml-1 text-blue-600">1/{t.installmentsTotal}x</span>}
                  </p>
                  {t.expenseType==="installment"&&t.totalAmount&&t.installmentsTotal&&(
                    <p className="text-[11px] text-muted-foreground">{showValues?fmtCurrency(t.totalAmount):"••••"} total · {t.installmentsTotal}x</p>
                  )}
                </div>
              </div>
              <p className={cn("text-sm font-semibold",
                t.isCardExpense?"text-blue-500":t.type==="income"?"text-emerald-600":"text-red-500"
              )}>
                {t.type==="income"?"+":"-"}{showValues?fmtCurrency(Math.abs(t.amount)):"••••"}
              </p>
            </div>
          ))}
        </div>
          </div>
        </div>
      </div>
      {/* Dialog: Configurar saldo da conta */}
      <Dialog open={openBalanceSetup} onOpenChange={o => { if (!savingBalance) setOpenBalanceSetup(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" /> Saldo da conta
            </DialogTitle>
            <DialogDescription>
              Informe o saldo atual da sua conta para começar a acompanhar. A partir de agora,
              toda receita ou despesa marcada como paga/recebida ajusta esse valor automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Mostrar saldo da conta</p>
                <p className="text-xs text-muted-foreground">Exibe o KPI no dashboard</p>
              </div>
              <Switch checked={balanceEnabled} onCheckedChange={setBalanceEnabled} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="initial-balance">Saldo inicial (R$)</Label>
              <Input id="initial-balance" type="text" inputMode="decimal"
                value={balanceInput}
                onChange={e => setBalanceInput(formatBalanceInput(e.target.value))}
                placeholder="0,00" className="h-11" />
              <p className="text-xs text-muted-foreground">
                Esse é o ponto de partida. Depois disso, o saldo é ajustado automaticamente
                conforme você marca receitas e despesas como pagas/recebidas (inclusive faturas
                de cartão pagas ou estornadas).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBalanceSetup(false)} disabled={savingBalance}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBalance} disabled={savingBalance}>
              {savingBalance ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alterar senha */}
      <Dialog open={openPassword} onOpenChange={o => { if (!pwdSaving) setOpenPassword(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Alterar senha
            </DialogTitle>
            <DialogDescription>
              Crie uma nova senha. Não é necessário confirmar por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="d-current-pwd">Senha atual</Label>
              <PasswordInput id="d-current-pwd" value={currentPwd} onChange={setCurrentPwd} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-new-pwd">Nova senha</Label>
              <PasswordInput id="d-new-pwd" value={newPwd} onChange={setNewPwd} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-confirm-pwd">Confirmar nova senha</Label>
              <PasswordInput id="d-confirm-pwd" value={confirmPwd} onChange={setConfirmPwd} />
            </div>
            {newPwd.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= (newPwd.length >= 12 ? 4 : newPwd.length >= 8 ? 3 : newPwd.length >= 6 ? 2 : 1)
                        ? (newPwd.length >= 12 ? "bg-emerald-500" : newPwd.length >= 8 ? "bg-yellow-500" : "bg-red-400")
                        : "bg-muted"
                    }`} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {newPwd.length >= 12 ? "Senha forte" : newPwd.length >= 8 ? "Senha média" : "Senha fraca"}
                </p>
              </div>
            )}
            {pwdError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{pwdError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPassword(false)} disabled={pwdSaving}>Cancelar</Button>
            <Button onClick={savePassword} disabled={pwdSaving}>
              {pwdSaving ? "Verificando..." : "Salvar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ MODAL DESPESAS ═══════════════════════════════════════════════ */}
      {openExpenseModal && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenExpenseModal(false)} />

          {/* Sheet — sobe do rodapé no mobile, centraliza no desktop */}
          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background"
            style={{ maxHeight: "90dvh" }}>

            {/* Cabeçalho vermelho */}
            <div className="relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <TrendingDown className="h-5 w-5"/>
                    </div>
                    <div>
                      <p className="text-xs text-white/70 leading-none">Despesas</p>
                      <p className="text-sm font-semibold">{MONTHS[selectedMonth]} {selectedYear}</p>
                    </div>
                  </div>
                  <button onClick={() => setOpenExpenseModal(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{hidden(expense)}</p>
                <div className="mt-3 flex gap-4">
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Pagas</p>
                    <p className="text-base font-bold text-white/90">{hidden(expensePaid)}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Pendentes</p>
                    <p className="text-base font-bold text-white/90">{hidden(expensePending)}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Lançamentos</p>
                    <p className="text-base font-bold text-white/90">{monthTx.filter(t=>t.type==="expense").length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista agrupada por data */}
            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {expensesByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingDown className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma despesa neste mês</p>
                </div>
              ) : expensesByDay.map(([date, items]) => {
                const [dd, mm] = date.split("/");
                const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                const [d, m, y] = date.split("/").map(Number);
                const weekday = dayNames[new Date(y, m - 1, d).getDay()];
                const dayTotal = items.reduce((s, t) => s + Math.abs(t.amount), 0);
                return (
                  <div key={date}>
                    {/* Separador de dia */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                        <span className="text-xs text-muted-foreground">/{mm}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-500">-{fmtCurrency(dayTotal)}</span>
                    </div>
                    {/* Itens do dia */}
                    {items.map((t, i) => (
                      <button key={t.id} type="button" onClick={() => openTxEdit(t)}
                        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                          i < items.length - 1 && "border-b border-border/40"
                        )}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                          style={{ background: t.settled ? "#fee2e2" : "#fef3c7" }}>
                          {categoryIconMap[t.category] ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[15px] font-bold text-red-500">-{hidden(Math.abs(t.amount))}</p>
                            <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5",
                              t.settled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {t.settled ? "Paga" : "Pendente"}
                            </span>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Pencil className="h-3.5 w-3.5"/>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL RECEITAS ═══════════════════════════════════════════════ */}
      {openIncomeModal && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenIncomeModal(false)} />

          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background"
            style={{ maxHeight: "90dvh" }}>

            {/* Cabeçalho verde */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <TrendingUp className="h-5 w-5"/>
                    </div>
                    <div>
                      <p className="text-xs text-white/70 leading-none">Receitas</p>
                      <p className="text-sm font-semibold">{MONTHS[selectedMonth]} {selectedYear}</p>
                    </div>
                  </div>
                  <button onClick={() => setOpenIncomeModal(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{hidden(income)}</p>
                <div className="mt-3 flex gap-4">
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Recebidas</p>
                    <p className="text-base font-bold text-white/90">{hidden(incomePaid)}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Pendentes</p>
                    <p className="text-base font-bold text-white/90">{hidden(incomePending)}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Lançamentos</p>
                    <p className="text-base font-bold text-white/90">{monthTx.filter(t=>t.type==="income").length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {incomesByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma receita neste mês</p>
                </div>
              ) : incomesByDay.map(([date, items]) => {
                const [dd, mm] = date.split("/");
                const dayNames = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                const [d, m, y] = date.split("/").map(Number);
                const weekday = dayNames[new Date(y, m - 1, d).getDay()];
                const dayTotal = items.reduce((s, t) => s + Math.abs(t.amount), 0);
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                        <span className="text-xs text-muted-foreground">/{mm}</span>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">+{fmtCurrency(dayTotal)}</span>
                    </div>
                    {items.map((t, i) => (
                      <button key={t.id} type="button" onClick={() => openTxEdit(t)}
                        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                          i < items.length - 1 && "border-b border-border/40"
                        )}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                          style={{ background: t.settled ? "#d1fae5" : "#fef3c7" }}>
                          {categoryIconMap[t.category] ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[15px] font-bold text-emerald-600">+{hidden(Math.abs(t.amount))}</p>
                            <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5",
                              t.settled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {t.settled ? "Recebida" : "Pendente"}
                            </span>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Pencil className="h-3.5 w-3.5"/>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL — Detalhe da Categoria ══════════════════════════════ */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedCategory(null)} />
          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background" style={{ maxHeight:"90dvh" }}>

            {/* Cabeçalho com a cor da barra da categoria */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                      {categoryIconMap[selectedCategory] ?? "📦"}
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-wide leading-none">Categoria</p>
                      <p className="text-lg font-bold">{selectedCategory}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCategory(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{hidden(categoryTotal)}</p>
                <div className="mt-3 flex gap-4">
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Lançamentos</p>
                    <p className="text-base font-bold">{categoryTxs.length}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Mês</p>
                    <p className="text-base font-bold">{MONTHS[selectedMonth]}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista agrupada por data */}
            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {categoryTxsByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingDown className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma despesa nesta categoria</p>
                </div>
              ) : categoryTxsByDay.map(([date, items]) => {
                const d = items[0]._d;
                const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                const weekday  = DAY_NAMES[d.getDay()];
                const dd       = String(d.getDate()).padStart(2,"0");
                const mm       = String(d.getMonth()+1).padStart(2,"0");
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                      <span className="text-xs text-muted-foreground">/{mm}</span>
                    </div>
                    {items.map((t, i) => (
                      <button key={t.id} type="button" onClick={() => openTxEdit(t)}
                        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30",
                          i < items.length-1 && "border-b border-border/40")}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl" style={{ background:"#f1f5f9" }}>
                          {categoryIconMap[t.category] ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[15px] font-bold text-slate-700">{hidden(Math.abs(t.amount))}</p>
                            <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5",
                              t.settled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {t.settled ? "Paga" : "Pendente"}
                            </span>
                          </div>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Pencil className="h-3.5 w-3.5"/>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3 shrink-0">
              <button onClick={() => setSelectedCategory(null)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground">Fechar</button>
              <button onClick={() => { setSelectedCategory(null); router.navigate({to:"/transacoes"}); }}
                className="text-sm text-primary font-semibold hover:underline">Ver todas →</button>
            </div>
          </div>
        </div>
      )}

        </div>{/* fim coluna direita */}
      </div>{/* fim grid desktop */}

      {/* ══ MODAL DE ESCOPO (editar só esta / toda a série) ══════════ */}
      {showEditScope && editingTx && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeTxEdit}/>
          <div className="relative z-10 w-full max-w-sm mx-4 md:mx-auto bg-background rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b">
              <p className="text-base font-bold text-foreground">Editar transação</p>
              <p className="text-sm text-muted-foreground mt-1">
                "{editingTx.title}" faz parte de uma série. O que deseja editar?
              </p>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => { setEditScope("single"); setShowEditScope(false); }}
                className="flex w-full items-start gap-3 rounded-xl border p-4 text-left hover:bg-muted/30 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Pencil className="h-4 w-4 text-primary"/>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Editar somente esta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Altera apenas o lançamento do dia {editingTx.date}</p>
                </div>
              </button>
              <button onClick={() => { setEditScope("bulk"); setShowEditScope(false); }}
                className="flex w-full items-start gap-3 rounded-xl border p-4 text-left hover:bg-muted/30 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <Receipt className="h-4 w-4 text-primary"/>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Editar esta e futuras</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Altera este e todos os lançamentos futuros da série</p>
                </div>
              </button>
            </div>
            <div className="px-5 pb-5">
              <button onClick={closeTxEdit}
                className="w-full h-10 rounded-xl border text-sm text-muted-foreground hover:bg-muted/30">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DE EDIÇÃO (mesmo padrão visual das outras telas) ═══ */}
      {editingTx && editScope && (
        <DashboardEditTxDialog
          tx={editingTx}
          bulkEdit={editScope === "bulk"}
          allTransactions={transactions}
          categories={allCategories}
          onClose={closeTxEdit}
        />
      )}

    </div>
  );
}

// ── DashboardEditTxDialog ──────────────────────────────────────────────────
// Diálogo de edição de transação embutido no dashboard,
// mesmo padrão visual da tela de Transações.
function DashboardEditTxDialog({
  tx, bulkEdit, allTransactions, categories, onClose
}: {
  tx: Transaction;
  bulkEdit: boolean;
  allTransactions: Transaction[];
  categories: ReturnType<typeof useCategories>;
  onClose: () => void;
}) {
  const isIncome = tx.type === "income";
  const accentHex = isIncome ? "#10b981" : tx.type === "expense" ? "#f43f5e" : "#4f46e5";

  // ── Estado do formulário ──────────────────────────────────────────
  const [type,          setType]          = useState<"income"|"expense">(tx.type);
  const [title,         setTitle]         = useState(tx.title);
  const [category,      setCategory]      = useState(tx.category);
  const [amountDisplay, setAmountDisplay] = useState(
    Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })
  );
  const now = new Date();
  const txDate = (() => {
    const [d, m, y] = tx.date.split("/").map(Number);
    return new Date(y, m-1, d);
  })();
  const [dateIso, setDateIso] = useState(txDate.toISOString().split("T")[0]);
  const [settled, setSettled] = useState(tx.settled);
  const [saving,  setSaving]  = useState(false);
  const [openCat, setOpenCat] = useState(false);
  const [catSearch, setCatSearch] = useState("");

  const isFuture = new Date(dateIso) > now;
  const isPaid   = tx.settled;

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); return; }
    const val = (parseInt(digits,10)/100).toLocaleString("pt-BR",{ minimumFractionDigits:2, maximumFractionDigits:2 });
    setAmountDisplay(val);
  }

  function parseAmount(): number {
    return parseFloat(amountDisplay.replace(/\./g,"").replace(",",".")) || 0;
  }

  function brDate(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Informe a descrição."); return; }
    if (!category)     { toast.error("Selecione uma categoria."); return; }
    const amount = (type === "expense" ? -1 : 1) * parseAmount();
    const patch = { title: title.trim(), category, amount, type, date: brDate(dateIso), settled };

    setSaving(true);
    try {
      if (bulkEdit && tx.recurrence_id) {
        const installNum = tx.installment_number ?? 1;
        const related = allTransactions.filter(
          t => t.recurrence_id === tx.recurrence_id && (t.installment_number ?? 1) >= installNum
        );
        await Promise.all(related.map(t => updateTransaction(t.id, patch)));
      } else {
        await updateTransaction(tx.id, patch);
      }
      toast.success("Transação atualizada!");
      onClose();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${tx.title}"?`)) return;
    setSaving(true);
    try {
      if (bulkEdit && tx.recurrence_id) {
        const { deleteTransactionSeries } = await import("@/lib/transactions-store");
        await deleteTransactionSeries(tx.recurrence_id, tx.installment_number ?? 1);
      } else {
        await deleteTransaction(tx.id);
      }
      toast.success("Transação excluída.");
      onClose();
    } catch {
      toast.error("Erro ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  const availableCategories = categories.filter(c => c.type === type || !c.type);
  const selectedCat = availableCategories.find(c => c.name === category);
  const accent = type === "income" ? "#10b981" : "#f43f5e";

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/50" onClick={onClose}/>
      <div className="fixed inset-x-0 bottom-0 z-[151] flex flex-col md:inset-0 md:items-center md:justify-center">
        <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
          style={{ maxHeight:"93dvh" }}>

          {/* Cabeçalho gradiente */}
          <div className={cn("relative overflow-hidden px-5 pt-5 pb-5 text-white shrink-0")}
            style={{ background: `linear-gradient(135deg, ${accent}dd, ${accent}99)` }}>
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
            <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide leading-none">
                    {bulkEdit ? "Editar série" : "Editar transação"}
                  </p>
                  {isPaid && <span className="mt-1 inline-flex text-[10px] font-semibold rounded-full bg-white/20 px-2 py-0.5 text-white">Lançamento pago</span>}
                </div>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                  <X className="h-4 w-4"/>
                </button>
              </div>
              {/* Toggle tipo */}
              <div className="flex rounded-xl bg-white/15 p-1 gap-1 mb-4">
                {(["expense","income"] as const).map(tp => (
                  <button key={tp} type="button" onClick={() => setType(tp)}
                    className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all",
                      type===tp ? "bg-white text-slate-800 shadow-sm" : "text-white/80 hover:text-white")}>
                    {tp === "expense" ? <TrendingDown className="h-4 w-4"/> : <TrendingUp className="h-4 w-4"/>}
                    {tp === "expense" ? "Despesa" : "Receita"}
                  </button>
                ))}
              </div>
              {/* Valor */}
              <div>
                <p className="text-xs text-white/60 mb-1">Valor</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-white/70">R$</span>
                  <input inputMode="decimal" value={amountDisplay} onChange={e => handleAmountChange(e.target.value)}
                    placeholder="0,00"
                    className="bg-transparent text-4xl font-black text-white placeholder-white/40 outline-none w-full tracking-tight"/>
                </div>
              </div>
            </div>
          </div>

          {/* Campos */}
          <div className="overflow-y-auto flex-1">
            <div className="px-4 py-4 space-y-3">
              {/* Descrição */}
              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Descrição</p>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
              </div>
              {/* Categoria */}
              <button type="button" onClick={() => setOpenCat(true)}
                className="w-full rounded-2xl border bg-card px-4 py-3.5 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors">
                {selectedCat ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: (selectedCat.color||"#6b7280")+"22" }}>
                    {(selectedCat.icon?.codePointAt(0)??0)>0x2000 ? selectedCat.icon : "📦"}
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><span className="text-xs">📦</span></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
                  <p className={cn("text-[16px] font-semibold mt-0.5", category?"text-foreground":"text-muted-foreground/50")}>
                    {category || "Selecione a categoria"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>
              </button>
              {/* Data */}
              <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Data</p>
                <DatePicker value={dateIso} onChange={setDateIso}/>
              </div>
              {/* Pago/Recebido */}
              <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{type==="income"?"Recebida":"Paga"}</p>
                  <p className="text-xs text-muted-foreground">{isFuture?"Antecipar efetivação":"Marca como concluída"}</p>
                </div>
                <Switch checked={settled} onCheckedChange={setSettled}/>
              </div>
              <div className="h-20 md:hidden"/>
            </div>
          </div>

          {/* Botão mobile fixo */}
          <div className="md:hidden fixed left-0 right-0 z-10 px-4 pt-3 pb-[env(safe-area-inset-bottom,12px)] bg-background/97 border-t"
            style={{ bottom:"0px", backdropFilter:"blur(8px)" }}>
            <button onClick={handleSave} disabled={saving}
              className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-95 disabled:opacity-70"
              style={{ background: accent, boxShadow:`0 6px 20px ${accent}44` }}>
              {saving?"Salvando...":"Salvar alterações"}
            </button>
            <button onClick={handleDelete}
              className="w-full mt-2 h-11 rounded-xl text-red-500 font-semibold text-sm flex items-center justify-center gap-2">
              <Trash2 className="h-4 w-4"/> Excluir lançamento
            </button>
          </div>
          {/* Botão desktop */}
          <div className="hidden md:flex items-center justify-between border-t px-5 py-3 shrink-0">
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm text-red-500 font-medium hover:text-red-600">
              <Trash2 className="h-4 w-4"/> Excluir
            </button>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 h-9 rounded-xl border text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 h-9 rounded-xl text-white font-semibold text-sm disabled:opacity-70 flex items-center gap-1.5"
                style={{ background: accent }}>
                <Save className="h-3.5 w-3.5"/> {saving?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BottomSheet de Categoria */}
      {openCat && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/50" onClick={() => { setOpenCat(false); setCatSearch(""); }}/>
          <div className="fixed bottom-0 left-0 right-0 z-[301] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden" style={{ maxHeight:"80vh" }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200"/>
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b">
              <h2 className="text-[18px] font-bold">Categoria</h2>
              <button onClick={() => { setOpenCat(false); setCatSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <X className="h-4 w-4 text-slate-500"/>
              </button>
            </div>
            <div className="px-4 pt-3 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input type="text" placeholder="Buscar..." value={catSearch} onChange={e => setCatSearch(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-slate-100 pl-11 pr-4 text-base outline-none"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 px-4 pb-8">
                {availableCategories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
                  const isSel = category === cat.name;
                  const color = cat.color || "#6b7280";
                  const isEmoji = (cat.icon?.codePointAt(0)??0) > 0x2000;
                  return (
                    <button key={cat.name} type="button"
                      onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                      style={isSel ? { background:color+"18", borderColor:color+"66" } : { borderColor:"transparent", background:"#f8fafc" }}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background:color+"22" }}>
                        {isEmoji ? cat.icon : "📦"}
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 leading-tight">{cat.name}</span>
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

// ── PendingSection ────────────────────────────────────────────────────
type PendingTx={id:string;title:string;amount:number;type:"income"|"expense";category:string;settled:boolean;source?:string;_d:Date};

function PendingSection({transactions,showValues,selectedMonth,selectedYear,cards,invoices,expenses,installments,router,categoryIconMap}:{
  transactions:PendingTx[];showValues:boolean;selectedMonth:number;selectedYear:number;
  cards:CreditCardType[];invoices:Invoice[];
  expenses:ReturnType<typeof useCardStore.getState>["expenses"];
  installments:ReturnType<typeof useCardStore.getState>["installments"];
  router:ReturnType<typeof useRouter>;
  categoryIconMap:Record<string,string>;
}) {
  const {payInvoice}=useCardStore();
  const [showDespesas,setShowDespesas]=useState(false);
  const [showReceitas,setShowReceitas]=useState(false);
  const [showFaturas,setShowFaturas]=useState(false);
  const [paying,setPaying]=useState<string|null>(null);

  // Separar despesas e receitas pendentes
  const allPending=useMemo(()=>transactions.filter(t=>!t.settled&&t.source!=="invoice"&&t.category!=="Cartão de Crédito"),[transactions]);
  const pendingExpenses=useMemo(()=>allPending.filter(t=>t.type==="expense"),[allPending]);
  const pendingIncome  =useMemo(()=>allPending.filter(t=>t.type==="income"), [allPending]);
  // "regularPending" mantido para compatibilidade com a contagem total
  const regularPending=allPending;

  const pendingInvoices=useMemo(()=>invoices.filter(inv=>{
    if(inv.status!=="open"||inv.total_amount<=0)return false;
    const due=new Date(inv.due_date+"T12:00:00");
    return due.getMonth()===selectedMonth&&due.getFullYear()===selectedYear;
  }).map(inv=>({invoice:inv,card:cards.find(c=>c.id===inv.card_id)})).filter(item=>item.card?.active),[invoices,cards,selectedMonth,selectedYear]);

  const totalExpenses=pendingExpenses.reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalIncome  =pendingIncome.reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalRegular =regularPending.reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalFaturas =pendingInvoices.reduce((s,t)=>s+t.invoice.total_amount,0);
  const totalCount   =regularPending.length+pendingInvoices.length;
  if(totalCount===0)return null;

  const handleSettle=(t:PendingTx)=>{toggleSettled(t.id);toast.success(t.type==="income"?"Receita recebida":"Despesa paga",{description:t.title});};

  const handlePayInvoice=async(invoice:Invoice,card:CreditCardType)=>{
    setPaying(invoice.id);
    try{
      await payInvoice(invoice.id,card);
      toast.success("Fatura marcada como paga!");
    }catch{toast.error("Erro ao pagar fatura.");}
    finally{setPaying(null);}
  };

  // ── Agrupamento por data (mesmo padrão dos modais de Despesas/Receitas) ──
  function groupByDayPending(items: PendingTx[]) {
    const map: Record<string, PendingTx[]> = {};
    for (const t of items) {
      const key = `${String(t._d.getDate()).padStart(2,"0")}/${String(t._d.getMonth()+1).padStart(2,"0")}/${t._d.getFullYear()}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map).sort((a, b) => {
      const [da, ma, ya] = a[0].split("/").map(Number);
      const [db, mb, yb] = b[0].split("/").map(Number);
      return new Date(yb, mb-1, db).getTime() - new Date(ya, ma-1, da).getTime();
    });
  }
  const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const expByDay = groupByDayPending(pendingExpenses);
  const incByDay = groupByDayPending(pendingIncome);

  return(
    <>
      {/* ── Dois cards resumo ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Pendências</h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">{totalCount}</span>
          </div>
          <span className="text-xs text-muted-foreground">Clique para detalhes</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Card — Despesas pendentes (só expenses) */}
          {pendingExpenses.length>0&&(
            <button onClick={()=>setShowDespesas(true)}
              className="flex flex-col items-start rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm text-left transition-all active:scale-95 hover:bg-amber-100/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 mb-2">
                <TrendingDown className="h-4 w-4 text-amber-600"/>
              </div>
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{showValues?fmtCurrency(totalExpenses):"••••"}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">{pendingExpenses.length} pendente{pendingExpenses.length!==1?"s":""}</p>
            </button>
          )}

          {/* Card — Receitas pendentes (só income) */}
          {pendingIncome.length>0&&(
            <button onClick={()=>setShowReceitas(true)}
              className="flex flex-col items-start rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm text-left transition-all active:scale-95 hover:bg-emerald-100/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-600"/>
              </div>
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{showValues?fmtCurrency(totalIncome):"••••"}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">{pendingIncome.length} a receber</p>
            </button>
          )}

          {/* Card — Faturas em aberto */}
          {pendingInvoices.length>0&&(
            <button onClick={()=>setShowFaturas(true)}
              className="flex flex-col items-start rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm text-left transition-all active:scale-95 hover:bg-blue-100/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 mb-2">
                <CreditCard className="h-4 w-4 text-blue-600"/>
              </div>
              <p className="text-xs text-muted-foreground">Faturas</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">{showValues?fmtCurrency(totalFaturas):"••••"}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">{pendingInvoices.length} em aberto</p>
            </button>
          )}
        </div>
      </div>

      {/* ══ MODAL — Despesas pendentes ════════════════════════════════ */}
      {showDespesas && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDespesas(false)} />
          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background" style={{ maxHeight:"90dvh" }}>
            {/* Cabeçalho laranja */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <TrendingDown className="h-5 w-5"/>
                    </div>
                    <div>
                      <p className="text-xs text-white/70 leading-none">Despesas pendentes</p>
                      <p className="text-sm font-semibold">{MONTHS_PT[selectedMonth]} {selectedYear}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDespesas(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{showValues?fmtCurrency(totalExpenses):"••••"}</p>
                <div className="mt-3 flex gap-4">
                  <div><p className="text-[11px] text-white/60 uppercase tracking-wide">Lançamentos</p><p className="text-base font-bold">{pendingExpenses.length}</p></div>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {expByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingDown className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma despesa pendente</p>
                </div>
              ) : expByDay.map(([date, items]) => {
                const [dd, mm, yyyy] = date.split("/");
                const weekday = DAY_NAMES[new Date(Number(yyyy), Number(mm)-1, Number(dd)).getDay()];
                const dayTotal = items.reduce((s,t) => s + Math.abs(t.amount), 0);
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                        <span className="text-xs text-muted-foreground">/{mm}</span>
                      </div>
                      <span className="text-sm font-semibold text-amber-600">-{fmtCurrency(dayTotal)}</span>
                    </div>
                    {items.map((t, i) => (
                      <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", i < items.length-1 && "border-b border-border/40")}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl" style={{ background:"#fef3c7" }}>
                          {categoryIconMap[t.category] ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[15px] font-bold text-amber-600">-{showValues?fmtCurrency(Math.abs(t.amount)):"••••"}</p>
                            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Pendente</span>
                          </div>
                          <button onClick={() => handleSettle(t)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Marcar como paga">
                            <Check className="h-4 w-4"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 shrink-0">
              <button onClick={() => setShowDespesas(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Fechar</button>
              <button onClick={() => { setShowDespesas(false); router.navigate({to:"/transacoes"}); }}
                className="text-sm text-primary font-semibold hover:underline">Ver todas →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL — Receitas pendentes ════════════════════════════════ */}
      {showReceitas && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReceitas(false)} />
          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background" style={{ maxHeight:"90dvh" }}>
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <TrendingUp className="h-5 w-5"/>
                    </div>
                    <div>
                      <p className="text-xs text-white/70 leading-none">Receitas pendentes</p>
                      <p className="text-sm font-semibold">{MONTHS_PT[selectedMonth]} {selectedYear}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowReceitas(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{showValues?fmtCurrency(totalIncome):"••••"}</p>
                <div className="mt-3 flex gap-4">
                  <div><p className="text-[11px] text-white/60 uppercase tracking-wide">Lançamentos</p><p className="text-base font-bold">{pendingIncome.length}</p></div>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {incByDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma receita pendente</p>
                </div>
              ) : incByDay.map(([date, items]) => {
                const [dd, mm, yyyy] = date.split("/");
                const weekday = DAY_NAMES[new Date(Number(yyyy), Number(mm)-1, Number(dd)).getDay()];
                const dayTotal = items.reduce((s,t) => s + Math.abs(t.amount), 0);
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                        <span className="text-xs text-muted-foreground">/{mm}</span>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">+{fmtCurrency(dayTotal)}</span>
                    </div>
                    {items.map((t, i) => (
                      <div key={t.id} className={cn("flex items-center gap-3 px-4 py-3", i < items.length-1 && "border-b border-border/40")}>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl" style={{ background:"#d1fae5" }}>
                          {categoryIconMap[t.category] ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[15px] font-bold text-emerald-600">+{showValues?fmtCurrency(Math.abs(t.amount)):"••••"}</p>
                            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Pendente</span>
                          </div>
                          <button onClick={() => handleSettle(t)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            title="Marcar como recebida">
                            <Check className="h-4 w-4"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 shrink-0">
              <button onClick={() => setShowReceitas(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Fechar</button>
              <button onClick={() => { setShowReceitas(false); router.navigate({to:"/transacoes"}); }}
                className="text-sm text-primary font-semibold hover:underline">Ver todas →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL — Faturas em aberto ════════════════════════════════ */}
      {showFaturas && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFaturas(false)} />
          <div className="relative z-10 mt-auto md:m-auto w-full md:max-w-lg md:rounded-2xl flex flex-col overflow-hidden bg-background" style={{ maxHeight:"90dvh" }}>

            {/* Cabeçalho azul */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 px-5 pt-5 pb-6 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <CreditCard className="h-5 w-5"/>
                    </div>
                    <div>
                      <p className="text-xs text-white/70 leading-none">Faturas em aberto</p>
                      <p className="text-sm font-semibold">{MONTHS_PT[selectedMonth]} {selectedYear}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowFaturas(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>
                <p className="mt-3 text-3xl font-black tracking-tight">{showValues?fmtCurrency(totalFaturas):"••••"}</p>
                <div className="mt-3 flex gap-4">
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Faturas</p>
                    <p className="text-base font-bold">{pendingInvoices.length}</p>
                  </div>
                  <div className="w-px bg-white/20"/>
                  <div>
                    <p className="text-[11px] text-white/60 uppercase tracking-wide">Cartões</p>
                    <p className="text-base font-bold">{new Set(pendingInvoices.map(i=>i.card?.id)).size}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de faturas */}
            <div className="overflow-y-auto flex-1 pb-[env(safe-area-inset-bottom,16px)]">
              {pendingInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mb-3 opacity-30"/>
                  <p className="text-sm">Nenhuma fatura em aberto</p>
                </div>
              ) : pendingInvoices.map(({ invoice, card }, i) => {
                const dueDate = new Date(invoice.due_date + "T12:00:00");
                const today = new Date(); today.setHours(0,0,0,0);
                const isOverdue = dueDate < today;
                const flagLetter = (card?.flag?.[0] ?? card?.name?.[0] ?? "C").toUpperCase();
                return (
                  <div key={invoice.id} className={cn("flex items-center gap-3 px-4 py-4", i < pendingInvoices.length-1 && "border-b border-border/40")}>
                    {/* Avatar do cartão */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                      {flagLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-foreground truncate">{card?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invoice.competence} · Vence {dueDate.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-blue-600">
                          -{showValues ? fmtCurrency(invoice.total_amount) : "••••"}
                        </p>
                        <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5",
                          isOverdue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {isOverdue ? "Vencida" : "Em aberto"}
                        </span>
                      </div>
                      <button
                        onClick={() => card && handlePayInvoice(invoice, card)}
                        disabled={paying === invoice.id}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                        title="Marcar como paga">
                        <Check className="h-4 w-4"/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3 shrink-0">
              <button onClick={() => setShowFaturas(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Fechar</button>
              <button onClick={() => { setShowFaturas(false); router.navigate({to:"/faturas-cartao"}); }}
                className="text-sm text-primary font-semibold hover:underline">Ver faturas →</button>
            </div>
          </div>
        </div>
      )}

      {/* InvoiceDetailModal mantido para compatibilidade */}
    </>
  );
}

// ── InvoiceDetailModal ────────────────────────────────────────────────
function InvoiceDetailModal({invoice,card,expenses,installments,open,onClose,onAddExpense}:{
  invoice:Invoice|null;card:CreditCardType|null;
  expenses:ReturnType<typeof useCardStore.getState>["expenses"];
  installments:ReturnType<typeof useCardStore.getState>["installments"];
  open:boolean;onClose:()=>void;onAddExpense:()=>void;
}) {
  if(!invoice||!card)return null;
  const isPaid=invoice.status==="paid";
  const allItems=[
    ...expenses.map(e=>({id:e.id,description:e.description,amount:e.amount,category:e.category,date:e.purchase_date})),
    ...installments.map(i=>({id:i.id,description:i.description,amount:i.amount,category:i.category,date:i.purchase_date})),
  ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

  return(
    <Dialog open={open} onOpenChange={o=>!o&&onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="bg-primary px-5 pt-5 pb-4 text-primary-foreground">
          <DialogHeader><DialogTitle className="text-primary-foreground">Fatura {card.name}</DialogTitle></DialogHeader>
          <p className="mt-1 text-sm text-primary-foreground/80">{invoice.competence} • Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</p>
          <p className="mt-3 text-2xl font-bold">{fmtCurrency(invoice.total_amount)}</p>
          <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold",isPaid?"bg-emerald-400/30 text-emerald-100":"bg-amber-400/30 text-amber-100")}>{isPaid?"Paga":"Em aberto"}</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {allItems.length===0
            ?<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa lançada nesta fatura.</p>
            :<div className="divide-y">{allItems.map(item=>(
              <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.category} • {new Date(item.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-red-500">-{fmtCurrency(item.amount)}</p>
              </div>
            ))}</div>
          }
        </div>
        <div className="flex items-center justify-between border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          {!isPaid&&(<button onClick={onAddExpense} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-all"><Plus className="h-5 w-5"/></button>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
