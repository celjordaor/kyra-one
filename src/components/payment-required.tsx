import { Link } from "@tanstack/react-router";
import { CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@tanstack/react-router";
import type { UserSubscription } from "@/lib/subscription-store";

export function PaymentRequired({ subscription }: { subscription: UserSubscription }) {
  const { signOut } = useAuth();
  const router = useRouter();

  const isTrialExpired = subscription.isTrialExpired;
  const isCancelled = subscription.effectiveStatus === "cancelled";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <CreditCard className="h-9 w-9 text-primary" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {isTrialExpired
          ? "Seu período de teste encerrou"
          : isCancelled
          ? "Assinatura cancelada"
          : "Acesso temporariamente bloqueado"}
      </h1>

      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {isTrialExpired
          ? "Escolha um plano para continuar usando o JadeOne e mantendo acesso aos seus dados."
          : isCancelled
          ? "Sua assinatura foi cancelada. Reative para voltar a usar o sistema."
          : "Seu acesso foi bloqueado por falta de pagamento. Regularize para continuar."}
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button asChild className="h-11 bg-primary font-semibold">
          <Link to="/planos">
            {isTrialExpired ? "Escolher plano" : "Regularizar pagamento"}
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-11">
          <Link to="/perfil">Ir para o perfil</Link>
        </Button>

        <button
          onClick={async () => {
            await signOut();
            router.navigate({ to: "/login" });
          }}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
