import { Link } from "@tanstack/react-router";
import { CreditCard, LogOut, PartyPopper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRouter } from "@tanstack/react-router";
import type { UserSubscription } from "@/lib/subscription-store";

export function PaymentRequired({ subscription }: { subscription: UserSubscription }) {
  const { signOut } = useAuth();
  const router = useRouter();

  const isCancelled      = subscription.effectiveStatus === "cancelled";
  const isNewAccountEnd  = subscription.newAccountExpired;
  const isPaymentIssue   = !isNewAccountEnd && !isCancelled;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">

      {/* Ícone */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        {isNewAccountEnd
          ? <PartyPopper className="h-9 w-9 text-primary" />
          : isCancelled
          ? <RefreshCw className="h-9 w-9 text-primary" />
          : <CreditCard className="h-9 w-9 text-primary" />
        }
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {isNewAccountEnd
          ? "Seu período de boas-vindas encerrou"
          : isCancelled
          ? "Assinatura cancelada"
          : "Acesso temporariamente bloqueado"
        }
      </h1>

      {/* Mensagem */}
      <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {isNewAccountEnd
          ? "Esperamos que tenha adorado o JadeOne! 🎉 Seus dados estão salvos e te esperando. Escolha um plano para continuar controlando suas finanças sem interrupção."
          : isCancelled
          ? "Sua assinatura foi cancelada, mas seus dados continuam salvos. Reative quando quiser e retome de onde parou."
          : "Seu acesso foi bloqueado por falta de pagamento. Regularize para continuar usando o sistema."
        }
      </p>

      {/* Destaque: dados seguros */}
      {isNewAccountEnd && (
        <div className="mt-4 flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          🔒 Seus dados estão seguros e aguardando você
        </div>
      )}

      {/* CTAs */}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button asChild className="h-11 bg-primary font-semibold shadow-md shadow-primary/25">
          <Link to="/planos">
            {isNewAccountEnd
              ? "Escolher meu plano"
              : isCancelled
              ? "Reativar assinatura"
              : "Regularizar pagamento"
            }
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-11">
          <Link to="/perfil">Ir para o perfil</Link>
        </Button>

        <button
          onClick={async () => { await signOut(); router.navigate({ to: "/login" }); }}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
    </div>
  );
}
