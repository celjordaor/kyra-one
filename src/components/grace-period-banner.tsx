import { Link } from "@tanstack/react-router";
import { AlertTriangle, Info, X } from "lucide-react";
import { useState } from "react";
import type { UserSubscription } from "@/lib/subscription-store";

export function GracePeriodBanner({ subscription }: { subscription: UserSubscription }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  // Banner de carência (inadimplente) — laranja urgente
  if (subscription.needsAttention) {
    const days = subscription.daysLeftInGrace;
    return (
      <div className="sticky top-0 z-50 bg-orange-500 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">
              Pagamento pendente.{" "}
              {days !== null && days > 0
                ? `Você tem ${days} dia${days > 1 ? "s" : ""} para regularizar.`
                : "Acesso será bloqueado em breve."}{" "}
              <Link to="/planos" className="underline font-semibold">Regularizar agora</Link>
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="shrink-0 text-white/80 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Banner de nova conta — verde/primário informativo (últimos 10 dias)
  if (
    subscription.isNewAccount &&
    subscription.daysLeft !== null &&
    subscription.daysLeft <= 10
  ) {
    return (
      <div className="sticky top-0 z-50 bg-primary px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">
              {subscription.daysLeft === 0
                ? "Seu período gratuito encerra hoje!"
                : `Seu período gratuito encerra em ${subscription.daysLeft} dia${subscription.daysLeft > 1 ? "s" : ""}.`}{" "}
              <Link to="/planos" className="underline font-semibold">Assine agora</Link>
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="shrink-0 text-primary-foreground/70 hover:text-primary-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
