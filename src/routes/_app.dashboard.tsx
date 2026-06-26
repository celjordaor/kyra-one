import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Eye, EyeOff, AlertCircle, Check, User, LogOut, KeyRound, CreditCard, Plus, Receipt, Shield, ListChecks } from "lucide-react";
import { useTransactions, parseBrDate, toggleSettled } from "@/lib/transactions-store";
import { useCategories } from "@/lib/categories-store";
import { useCardStore, type Invoice, type CreditCard as CreditCardType } from "@/lib/card-store";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // ── Itens unificados para "Últimas transações" ────────────────────────
  const recentItems=useMemo(():RecentItem[]=>{
    // Transações regulares — SEM filtro de mês, deduplicando recorrentes/parceladas
    const seenRec:any={};
    const regular:RecentItem[]=transactions
      .map(t=>({...t,_d:parseBrDate(t.date)}))
      .filter(t=>!isCardRelated(t))
      .sort((a,b)=>b._d.getTime()-a._d.getTime())
      .filter(t=>{
        // Parceladas: manter apenas installment_number=1 (compra original)
        if(t.installment_number&&t.installment_number>1)return false;
        // Recorrentes: manter apenas a mais recente por recurrence_id
        if(t.recurrence_id){
          if(seenRec[t.recurrence_id])return false;
          seenRec[t.recurrence_id]=1;
        }
        return true;
      })
      .slice(0,10)
      .map(t=>({
        id:t.id,title:t.title,amount:t.amount,type:t.type,category:t.category,_d:t._d,
        isCardExpense:false,settled:t.settled,
        expenseType:t.recurrence_id?(t.installment_number?"installment":"recurring"):"single" as const,
        installmentsTotal:t.installments_total??undefined,
        totalAmount:(t.installment_number===1&&(t.installments_total??0)>1)
          ?Math.abs(t.amount)*(t.installments_total??1):undefined,
      }));
    // Despesas avulsas de cartão
    const cardExp:RecentItem[]=expenses
      .filter(e=>e.expense_type==="single")
      .map(e=>{
        const card=cards.find(c=>c.id===e.card_id);
        return{id:e.id,title:e.description,amount:-Math.abs(e.amount),type:"expense" as const,category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),isCardExpense:true,cardName:card?.name,expenseType:"single"};
      });
    // Parceladas: só installment_number=1
    const cardInst:RecentItem[]=expenses
      .filter(e=>e.expense_type==="installment"&&(e.installment_number??1)===1)
      .map(e=>{
        const card=cards.find(c=>c.id===e.card_id);
        const tot=Math.abs(e.amount)*(e.installments_total??1);
        const ttl=e.description.replace(" 1/"+String(e.installments_total||""),"").trim();
        return{id:e.id,title:ttl||e.description,amount:-Math.abs(e.amount),totalAmount:tot,type:"expense" as const,category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),isCardExpense:true,cardName:card?.name,expenseType:"installment",installmentsTotal:(e.installments_total??1)};
      });
    // Recorrentes deduplicadas (sem novos genéricos)
    const seen:any={};
    const cardRec:RecentItem[]=expenses
      .filter(e=>e.expense_type==="recurring")
      .sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date))
      .filter(e=>{const k=e.description+e.card_id;if(seen[k])return false;seen[k]=1;return true;})
      .map(e=>{
        const card=cards.find(c=>c.id===e.card_id);
        return{id:e.id,title:e.description,amount:-Math.abs(e.amount),type:"expense" as const,category:e.category,_d:new Date(e.purchase_date+"T12:00:00"),isCardExpense:true,cardName:card?.name,expenseType:"recurring"};
      });
    return[...regular,...cardExp,...cardInst,...cardRec].sort((a,b)=>b._d.getTime()-a._d.getTime()).slice(0,7);
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

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10"/>
        <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/10"/>
        <div className="relative"><p className="text-sm opacity-90">Saldo do mês</p><p className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">{hidden(balance)}</p></div>
      </div>

      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100"><TrendingUp className="h-4 w-4 text-emerald-600"/></div><span className="text-xs text-muted-foreground">Receitas</span></div>
          <p className="mt-2 text-lg font-bold text-emerald-600">{hidden(income)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100"><TrendingDown className="h-4 w-4 text-red-500"/></div><span className="text-xs text-muted-foreground">Despesas</span></div>
          <p className="mt-2 text-lg font-bold text-red-500">{hidden(expense)}</p>
        </div>
      </div>

      {/* ── Pendências — logo abaixo das receitas/despesas ── */}
      {billReminders&&(
        <PendingSection
          transactions={monthTx} showValues={showValues}
          selectedMonth={selectedMonth} selectedYear={selectedYear}
          cards={cards} invoices={invoices} expenses={expenses} installments={installments}
          router={router}
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
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{cat.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-foreground">
                        {hidden(cat.amount)}
                        <span className="ml-1 font-normal text-muted-foreground">· {cat.percent}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-all duration-500",barColor)} style={{width:`${cat.percent}%`}}/>
                    </div>
                  </div>
                </div>
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
        </div>{/* fim coluna direita */}
      </div>{/* fim grid desktop */}
    </div>
  );
}

// ── PendingSection ────────────────────────────────────────────────────
type PendingTx={id:string;title:string;amount:number;type:"income"|"expense";category:string;settled:boolean;source?:string;_d:Date};

function PendingSection({transactions,showValues,selectedMonth,selectedYear,cards,invoices,expenses,installments,router}:{
  transactions:PendingTx[];showValues:boolean;selectedMonth:number;selectedYear:number;
  cards:CreditCardType[];invoices:Invoice[];
  expenses:ReturnType<typeof useCardStore.getState>["expenses"];
  installments:ReturnType<typeof useCardStore.getState>["installments"];
  router:ReturnType<typeof useRouter>;
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

      {/* ── Modal — Despesas pendentes (SÓ expenses) ─────────────────── */}
      <Dialog open={showDespesas} onOpenChange={setShowDespesas}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-amber-500 px-5 pt-5 pb-4 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <TrendingDown className="h-5 w-5"/> Despesas pendentes
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-sm text-white/80">{pendingExpenses.length} despesa{pendingExpenses.length!==1?"s":""} · {showValues?fmtCurrency(totalExpenses):"••••"}</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pendingExpenses.length===0
              ?<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa pendente.</p>
              :<div className="divide-y">
                {pendingExpenses.map(t=>(
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <TrendingDown className="h-3.5 w-3.5 text-red-500"/>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.category} • A pagar</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-semibold text-red-500">
                        {showValues?`-${fmtCurrency(Math.abs(t.amount))}`:"••••"}
                      </p>
                      <button onClick={()=>handleSettle(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        title="Marcar como paga">
                        <Check className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={()=>setShowDespesas(false)}>Fechar</Button>
            <button onClick={()=>{setShowDespesas(false);router.navigate({to:"/transacoes"});}}
              className="text-xs text-primary font-medium hover:underline">Ver todas →</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal — Receitas pendentes (SÓ income) ───────────────────── */}
      <Dialog open={showReceitas} onOpenChange={setShowReceitas}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-emerald-600 px-5 pt-5 pb-4 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5"/> Receitas pendentes
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-sm text-white/80">{pendingIncome.length} receita{pendingIncome.length!==1?"s":""} · {showValues?fmtCurrency(totalIncome):"••••"}</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pendingIncome.length===0
              ?<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma receita pendente.</p>
              :<div className="divide-y">
                {pendingIncome.map(t=>(
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600"/>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.category} • A receber</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-semibold text-emerald-600">
                        {showValues?`+${fmtCurrency(Math.abs(t.amount))}`:"••••"}
                      </p>
                      <button onClick={()=>handleSettle(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        title="Marcar como recebida">
                        <Check className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={()=>setShowReceitas(false)}>Fechar</Button>
            <button onClick={()=>{setShowReceitas(false);router.navigate({to:"/transacoes"});}}
              className="text-xs text-primary font-medium hover:underline">Ver todas →</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal — Faturas em aberto ────────────────────────────────── */}
      <Dialog open={showFaturas} onOpenChange={setShowFaturas}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-blue-600 px-5 pt-5 pb-4 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5"/> Faturas em aberto
              </DialogTitle>
            </DialogHeader>
            <p className="mt-1 text-sm text-white/80">{pendingInvoices.length} fatura{pendingInvoices.length!==1?"s":""} · {showValues?fmtCurrency(totalFaturas):"••••"}</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pendingInvoices.length===0
              ?<p className="py-8 text-center text-sm text-muted-foreground">Nenhuma fatura em aberto.</p>
              :<div className="divide-y">
                {pendingInvoices.map(({invoice,card})=>(
                  <div key={invoice.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <CreditCard className="h-3.5 w-3.5 text-blue-600"/>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{card?.name} — {invoice.competence}</p>
                        <p className="truncate text-xs text-muted-foreground">Vence {new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="text-sm font-semibold text-red-500">
                        {showValues?`-${fmtCurrency(invoice.total_amount)}`:"••••"}
                      </p>
                      <button
                        onClick={()=>card&&handlePayInvoice(invoice,card)}
                        disabled={paying===invoice.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
                        title="Marcar como paga">
                        <Check className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3">
            <Button variant="outline" size="sm" onClick={()=>setShowFaturas(false)}>Fechar</Button>
            <button onClick={()=>{setShowFaturas(false);router.navigate({to:"/faturas-cartao"});}}
              className="text-xs text-primary font-medium hover:underline">Ver faturas →</button>
          </div>
        </DialogContent>
      </Dialog>

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
