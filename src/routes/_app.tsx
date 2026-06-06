import { createFileRoute, Outlet, Link, useLocation, Navigate, useRouter } from "@tanstack/react-router";
import { Home, Receipt, User, PlusCircle, CreditCard, TrendingUp, TrendingDown, X } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { PaymentRequired } from "@/components/payment-required";
import { setPreselectedTransactionType } from "@/lib/transaction-type-preset";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const navItems = [
  { to: "/dashboard",  label: "Início",     icon: Home },
  { to: "/transacoes", label: "Transações", icon: Receipt },
  { to: "/cartoes",    label: "Cartões",    icon: CreditCard },
  { to: "/perfil",     label: "Perfil",     icon: User },
];

function AppLayout() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
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
    setPreselectedTransactionType(type);
    router.navigate({ to: "/nova-transacao" });
  };

  const handleAddCardExpense = () => {
    setAddMenuOpen(false);
    router.navigate({ to: "/cartoes/nova-despesa" });
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {showBanner && <GracePeriodBanner subscription={subscription} />}

        <main className="flex-1 pb-20">
          <Outlet />
        </main>

        {/* Overlay escuro ao abrir o menu */}
        {addMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setAddMenuOpen(false)}
          />
        )}

        {/* Botões flutuantes do menu de adição */}
        {addMenuOpen && (
          <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-end gap-6">
            {/* Receita */}
            <button
              onClick={() => handleAddTransaction("income")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Receita</span>
            </button>

            {/* Despesa */}
            <button
              onClick={() => handleAddTransaction("expense")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Despesa</span>
            </button>

            {/* Despesa Cartão */}
            <button
              onClick={handleAddCardExpense}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/40">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Cartão</span>
            </button>
          </div>
        )}

        {/* Barra de navegação inferior */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
            {/* Itens esquerdos */}
            {navItems.slice(0, 2).map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}

            {/* Botão central */}
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex flex-col items-center gap-0.5 px-3 py-1"
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200",
                addMenuOpen && "rotate-45 shadow-lg shadow-primary/30"
              )}>
                {addMenuOpen ? <X className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
              </div>
              <span className={cn("text-[10px] font-medium", addMenuOpen ? "text-primary" : "text-muted-foreground")}>
                Adicionar
              </span>
            </button>

            {/* Itens direitos */}
            {navItems.slice(2).map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link key={to} to={to} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
