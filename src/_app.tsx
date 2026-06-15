import { createFileRoute, Outlet, Link, useLocation, Navigate, useRouter } from "@tanstack/react-router";
import { Home, Receipt, User, PlusCircle, CreditCard, TrendingUp, TrendingDown, X, Tag, ChevronRight, MoreHorizontal, Target, Lock } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { PaymentRequired } from "@/components/payment-required";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const navItems = [
  { to: "/dashboard",  label: "Início",     icon: Home },
  { to: "/transacoes", label: "Transações", icon: Receipt },
  { to: "/cartoes",    label: "Cartões",    icon: CreditCard },
  { to: "/mais",       label: "Mais",        icon: MoreHorizontal },
];

function AppLayout() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const isAdvancado = subscription?.isAdvancado ?? false;
  const [addMenuOpen, setAddMenuOpen] = useState(false);

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
      <div className="bg-background" style={{ minHeight: "100dvh" }}>
        {showBanner && (
          <div className="fixed top-0 left-0 right-0 z-50 md:left-64">
            <GracePeriodBanner subscription={subscription} />
          </div>
        )}

        {/* ══ SIDEBAR DESKTOP (hidden on mobile) ════════════════════════ */}
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 border-r bg-card z-30 shadow-sm">

          {/* Brand */}
          <Link to="/dashboard"
            className="flex items-center gap-3 px-5 py-5 border-b hover:bg-accent/30 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-lg">
              J
            </div>
            <div>
              <p className="font-bold text-foreground leading-none">JadeOne</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Finanças Pessoais</p>
            </div>
          </Link>

          {/* Nav principal */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}

            {/* Categorias */}
            <Link to="/categorias"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/categorias"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
              <Tag className="h-4 w-4 shrink-0" />
              Categorias
            </Link>

            {/* Metas e Orçamentos */}
            {isAdvancado ? (
              <Link to="/metas"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === "/metas"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                <Target className="h-4 w-4 shrink-0" />
                Metas e Orçamentos
              </Link>
            ) : (
              <Link to="/mais"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-60">
                <Target className="h-4 w-4 shrink-0" />
                Metas e Orçamentos
                <Lock className="h-3 w-3 ml-auto" />
              </Link>
            )}

            {/* Perfil (sidebar desktop mantém o acesso) */}
            <Link to="/perfil"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/perfil"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
              <User className="h-4 w-4 shrink-0" />
              Perfil
            </Link>
          </nav>

          {/* Ações rápidas */}
          <div className="p-3 border-t space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pb-1.5">
              Lançar
            </p>
            <button
              onClick={() => router.navigate({ to: "/nova-transacao", search: { type: "income" } })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
              <TrendingUp className="h-4 w-4 shrink-0" /> Receita
            </button>
            <button
              onClick={() => router.navigate({ to: "/nova-transacao", search: { type: "expense" } })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <TrendingDown className="h-4 w-4 shrink-0" /> Despesa
            </button>
            <button
              onClick={() => router.navigate({ to: "/cartoes/nova-despesa" })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
              <CreditCard className="h-4 w-4 shrink-0" /> Despesa Cartão
            </button>
          </div>
        </aside>

        {/* ══ CONTEÚDO PRINCIPAL ════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col md:ml-64">
          {showBanner && <div className="h-10 md:block hidden" />}
          <main className="md:pb-8" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 20px))" }}>
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

        {/* Bottom nav — apenas mobile */}
        {/* ══ BOTTOM NAV — PWA / MOBILE ══════════════════════════════════ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-card/98 backdrop-blur-md">
          <div className="flex w-full items-stretch" style={{ height: "68px" }}>

            {navItems.slice(0, 2).map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to}
                  className="flex flex-1 flex-col items-center justify-center gap-1 h-full">
                  <Icon className={cn("h-[26px] w-[26px]",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn("text-[11px] font-semibold",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>{label}</span>
                </Link>
              );
            })}

            {/* Botão central + */}
            <button onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex flex-1 flex-col items-center justify-center gap-1 h-full">
              <div className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200",
                addMenuOpen && "rotate-45 shadow-lg shadow-primary/30"
              )}>
                {addMenuOpen ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
              </div>
              <span className={cn("text-[11px] font-semibold",
                addMenuOpen ? "text-primary" : "text-muted-foreground"
              )}>Adicionar</span>
            </button>

            {navItems.slice(2).map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to}
                  className="flex flex-1 flex-col items-center justify-center gap-1 h-full">
                  <Icon className={cn("h-[26px] w-[26px]",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn("text-[11px] font-semibold",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>{label}</span>
                </Link>
              );
            })}

          </div>
          {/* Safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)", backgroundColor: "transparent" }} />
        </nav>
      </div>
    </TooltipProvider>
  );
}
