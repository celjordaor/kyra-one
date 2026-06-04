import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, type PlanId } from "@/lib/subscription-store";
import { useState } from "react";

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
});

const PLANS = [
  {
    id: "essencial" as PlanId,
    name: "Essencial",
    price: 9.90,
    description: "Controle básico das finanças pessoais",
    icon: Zap,
    color: "border-border",
    badgeColor: "bg-muted text-muted-foreground",
    features: [
      "Transações ilimitadas",
      "Categorias personalizadas",
      "Dashboard com resumo mensal",
      "Controle de receitas e despesas",
      "Suporte por e-mail",
    ],
  },
  {
    id: "avancado" as PlanId,
    name: "Avançado",
    price: 19.90,
    description: "Planejamento e controle financeiro completo",
    icon: Crown,
    color: "border-primary",
    badgeColor: "bg-primary text-primary-foreground",
    recommended: true,
    features: [
      "Tudo do plano Essencial",
      "Metas de economia",
      "Orçamentos por categoria",
      "Relatórios e análises avançadas",
      "Controle de cartão de crédito",
      "Acompanhamento financeiro completo",
      "Suporte prioritário",
    ],
  },
];

function PlanosPage() {
  const { subscription, loading, selectPlan } = useSubscription();
  const [selecting, setSelecting] = useState<PlanId | null>(null);
  const [selected, setSelected] = useState<PlanId | null>(null);

  const handleSelect = async (planId: PlanId) => {
    setSelecting(planId);
    await selectPlan(planId);
    setSelecting(null);
    setSelected(planId);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            to="/perfil"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao perfil
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Escolha seu plano
          </h1>
          <p className="mt-2 text-muted-foreground">
            Comece no plano Essencial e faça upgrade quando precisar.
          </p>
          {subscription?.status === "trial" && subscription.daysLeftInTrial !== null && (
            <div className="mt-4 inline-block rounded-full bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-600 dark:text-yellow-400">
              ⏳ Período de teste — {subscription.daysLeftInTrial} dias restantes
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = !loading && subscription?.planId === plan.id;
            const isSelecting = selecting === plan.id;
            const justSelected = selected === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 bg-card p-6 shadow-sm transition-all ${plan.color} ${plan.recommended ? "shadow-primary/10 shadow-lg" : ""}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Mais completo
                    </span>
                  </div>
                )}

                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${plan.recommended ? "text-primary" : "text-muted-foreground"}`} />
                      <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                  {isCurrent && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${plan.badgeColor}`}>
                      Atual
                    </span>
                  )}
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-foreground">
                    R$ {plan.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                <ul className="mb-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="flex h-11 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                    ✓ Plano atual
                  </div>
                ) : justSelected ? (
                  <div className="flex h-11 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                    ✓ Plano selecionado!
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      className={`h-11 w-full font-semibold ${plan.recommended ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-primary bg-transparent text-primary hover:bg-primary/10"}`}
                      disabled={!!selecting}
                      onClick={() => handleSelect(plan.id)}
                    >
                      {isSelecting ? "Selecionando..." : "Assinar agora"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      🔒 Pagamento em breve
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="mt-8 rounded-xl border bg-card p-4 text-center">
          <p className="text-sm font-medium text-foreground">Formas de pagamento aceitas</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>💳 Cartão de crédito</span>
            <span>•</span>
            <span>⚡ PIX</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A integração com o sistema de pagamento estará disponível em breve.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <p className="text-center">
            Dúvidas? Entre em contato pelo suporte.
          </p>
        </div>

      </div>
    </div>
  );
}
