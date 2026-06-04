import { createFileRoute, Outlet, Link, useLocation, Navigate } from "@tanstack/react-router";
import { Home, Receipt, Target, User, PlusCircle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { PaymentRequired } from "@/components/payment-required";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const navItems = [
  { to: "/dashboard",      label: "Início",      icon: Home },
  { to: "/transacoes",     label: "Transações",  icon: Receipt },
  { to: "/nova-transacao", label: "Adicionar",   icon: PlusCircle, isAction: true },
  { to: "/metas",          label: "Metas",       icon: Target },
  { to: "/perfil",         label: "Perfil",      icon: User },
];

function AppLayout() {
  const { pathname } = useLocation();
  const { session, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;

  // Bloqueado: tela de pagamento/reativação
  if (subscription?.isBlocked) {
    return <PaymentRequired subscription={subscription} />;
  }

  // Determina qual banner mostrar
  const showBanner =
    subscription?.needsAttention ||
    (subscription?.isNewAccount && (subscription.daysLeft ?? 999) <= 10);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {showBanner && subscription && (
          <GracePeriodBanner subscription={subscription} />
        )}

        <main className="flex-1 pb-20 overflow-y-auto">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to;

              if (item.isAction) {
                return (
                  <Link key={item.to} to={item.to} className="flex flex-col items-center gap-0.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                  </Link>
                );
              }

              return (
                <Link key={item.to} to={item.to} className="flex flex-col items-center gap-0.5 px-3 py-1">
                  <Icon className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
