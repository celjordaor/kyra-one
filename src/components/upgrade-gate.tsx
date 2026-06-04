import { Link } from "@tanstack/react-router";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeGateProps {
  featureName: string;
  description?: string;
}

export function UpgradeGate({
  featureName,
  description = "Faça upgrade para o plano Avançado e desbloqueie essa funcionalidade.",
}: UpgradeGateProps) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <div className="relative">
          <Lock className="h-8 w-8 text-primary" />
          <Crown className="absolute -right-2 -top-2 h-4 w-4 text-yellow-500" />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {featureName}
      </h1>

      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {description}
      </p>

      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 text-sm">
        <span className="font-semibold text-primary">Plano Avançado</span>
        <span className="text-muted-foreground"> — R$ 19,90/mês</span>
      </div>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <Button asChild className="h-11 bg-primary font-semibold">
          <Link to="/planos">Ver planos e fazer upgrade</Link>
        </Button>
        <Button asChild variant="ghost" className="h-11 text-muted-foreground">
          <Link to="/dashboard">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
