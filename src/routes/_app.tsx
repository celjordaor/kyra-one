import { createFileRoute, Outlet, Link, useLocation, Navigate, useRouter } from "@tanstack/react-router";
import { Home, Receipt, User, PlusCircle, CreditCard, TrendingUp, TrendingDown, X, Tag, ChevronRight, MoreHorizontal, Target, Lock, Settings, LayoutDashboard, Layers } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { PaymentRequired } from "@/components/payment-required";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { extendRecurringIfNeeded } from "@/lib/transactions-store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// ── Nav items desktop (sidebar) — mantém Transações ──────────────────────
const navItems = [
  { to: "/dashboard",      label: "Início",     icon: Home },
  { to: "/transacoes",     label: "Transações", icon: Receipt },
  { to: "/cartoes",        label: "Cartões",    icon: CreditCard },
  { to: "/faturas-cartao", label: "Faturas",    icon: Tag },
  { to: "/mais",           label: "Config.",    icon: Settings },
];

// ── Nav items mobile bottom bar: Início | Cartões | [+] | Faturas | Config ──
// Transações foi removida do nav mobile — fica no dashboard como atalho
const mobileNavLeft  = [
  { to: "/dashboard", label: "Início",  icon: Home },
  { to: "/cartoes",   label: "Cartões", icon: CreditCard },
];
const mobileNavRight = [
  { to: "/faturas-cartao", label: "Faturas", icon: Tag },
  { to: "/mais",           label: "Config.", icon: Settings },
];

function AppLayout() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const isAdvancado = subscription?.isAdvancado ?? false;
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Extensão automática de recorrentes + backfill de recurrence_id (roda 1x por sessão)
  useEffect(() => {
    if (!session) return;
    extendRecurringIfNeeded().catch(err =>
      console.warn("[extendRecurring]", err)
    );
  }, [session?.user?.id]);

  if (authLoading || subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;
  if (subscription?.isBlocked) return <PaymentRequired subscription={subscription} />;

  const showBanner =
    subscription?.needsAttention ||
    (subscription?.isNewAccount && (subscription.daysLeft ?? 30) <= 10);

  const handleAddTransaction = (type: "income" | "expense") => {
    setAddMenuOpen(false);
    router.navigate({ to: "/nova-transacao", search: { type } });
  };
  const handleAddCardExpense = () => {
    setAddMenuOpen(false);
    router.navigate({ to: "/cartoes/nova-despesa" });
  };

  return (
    <TooltipProvider>
      <div style={{ display:"block", background:"var(--color-background)", minHeight:"100dvh", width:"100%", maxWidth:"100vw", overflowX:"hidden" }}>
        {showBanner && (
          <div className="fixed top-0 left-0 right-0 z-50 md:left-64">
            <GracePeriodBanner subscription={subscription} />
          </div>
        )}

        {/* ══ SIDEBAR DESKTOP ═══════════════════════════════════════════ */}
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 border-r bg-card z-30 shadow-sm">

          {/* Brand */}
          <Link to="/dashboard"
            className="flex items-center gap-3 px-5 py-5 border-b hover:bg-accent/30 transition-colors shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-lg">J</div>
            <div>
              <p className="font-bold text-foreground leading-none">JadeOne</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Finanças Pessoais</p>
            </div>
          </Link>

          {/* ── Botões de lançamento (destaque) ── */}
          <div className="px-3 pt-4 pb-2 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 pb-2">Lançar</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={()=>router.navigate({to:"/nova-transacao",search:{type:"income"}})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors">
                <TrendingUp className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Receita</span>
              </button>
              <button onClick={()=>router.navigate({to:"/nova-transacao",search:{type:"expense"}})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                <TrendingDown className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Despesa</span>
              </button>
              <button onClick={()=>router.navigate({to:"/cartoes/nova-despesa"})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                <CreditCard className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Cartão</span>
              </button>
            </div>
          </div>

          <div className="mx-3 border-t mb-1"/>

          {/* ── Navegação principal ── */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
            {[
              {to:"/dashboard",    label:"Início",      icon:Home},
              {to:"/transacoes",   label:"Transações",  icon:Receipt},
              {to:"/cartoes",      label:"Cartões",     icon:CreditCard},
              {to:"/faturas-cartao",label:"Faturas",    icon:Tag},
              {to:"/categorias",   label:"Categorias",  icon:Layers},
            ].map(({to,label,icon:Icon})=>{
              const isActive=pathname===to||pathname.startsWith(to+"/");
              return(
                <Link key={to} to={to}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                  <Icon className="h-4 w-4 shrink-0"/>{label}
                </Link>
              );
            })}
            {isAdvancado?(
              <Link to="/metas"
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname==="/metas"?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                <Target className="h-4 w-4 shrink-0"/>Metas e Orçamentos
              </Link>
            ):(
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed">
                <Target className="h-4 w-4 shrink-0"/>Metas e Orçamentos
                <Lock className="h-3 w-3 ml-auto"/>
              </div>
            )}
            <Link to="/perfil"
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname==="/perfil"?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
              <User className="h-4 w-4 shrink-0"/>Perfil
            </Link>
          </nav>

          {/* ── Configurações (último) ── */}
          <div className="px-3 pb-4 pt-1 border-t shrink-0">
            <Link to="/mais"
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname==="/mais"?"bg-primary/10 text-primary":"text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
              <Settings className="h-4 w-4 shrink-0"/>Configurações
            </Link>
          </div>
        </aside>

                {/* ══ CONTEÚDO PRINCIPAL ════════════════════════════════════════ */}
        <div className="md:ml-64" style={{ overflowX:"hidden" }}>
          {showBanner && <div className="h-10 md:block hidden" />}
          <main style={{ paddingBottom:"calc(72px + env(safe-area-inset-bottom, 20px))" }}
            className="md:pb-0 md:min-h-screen">
            <Outlet />
          </main>
        </div>

        {/* ══ MOBILE ONLY: overlay + botões flutuantes + bottom nav ══════ */}
        {addMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setAddMenuOpen(false)}
          />
        )}

        {addMenuOpen && (
          <div className="md:hidden fixed z-50 flex items-end gap-6 left-1/2 -translate-x-1/2" style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 20px))" }}>
            <button onClick={() => handleAddTransaction("income")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Receita</span>
            </button>
            <button onClick={() => handleAddTransaction("expense")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Despesa</span>
            </button>
            <button onClick={handleAddCardExpense}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/40">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Cartão</span>
            </button>
          </div>
        )}

        {/* ══ BOTTOM NAV — PWA / MOBILE ══════════════════════════════════ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-card/98 backdrop-blur-md">
          <div className="flex w-full items-stretch" style={{ height: "68px" }}>

            {/* ── Esquerda: Início + Cartões ── */}
            {mobileNavLeft.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to}
                  className="flex flex-1 flex-col items-center justify-center h-full"
                  style={{ gap: "3px" }}>
                  <Icon className={cn("h-[24px] w-[24px] shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn("text-[10px] font-semibold leading-none",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>{label}</span>
                </Link>
              );
            })}

            {/* ── Centro: botão Adicionar destacado ── */}
            <button onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex flex-1 flex-col items-center justify-center h-full"
              style={{ gap: "3px" }}>
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200",
                addMenuOpen && "rotate-45 shadow-lg shadow-primary/30"
              )}>
                {addMenuOpen ? <X className="h-6 w-6" /> : <PlusCircle className="h-6 w-6" />}
              </div>
              <span className={cn("text-[10px] font-semibold leading-none",
                addMenuOpen ? "text-primary" : "text-muted-foreground"
              )}>Adicionar</span>
            </button>

            {/* ── Direita: Faturas + Configurações ── */}
            {mobileNavRight.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to}
                  className="flex flex-1 flex-col items-center justify-center h-full"
                  style={{ gap: "3px" }}>
                  <Icon className={cn("h-[24px] w-[24px] shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn("text-[10px] font-semibold leading-none",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>{label}</span>
                </Link>
              );
            })}

          </div>
          {/* Safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </nav>
      </div>
    </TooltipProvider>
  );
}
