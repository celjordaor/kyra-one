import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, type PlanId } from "@/lib/subscription-store";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
});

type BillingCycle = "monthly" | "annual";

const PLANS = [
  {
    id: "essencial" as PlanId,
    name: "Essencial",
    monthly: 9.90,
    annual: 99.00,
    description: "Controle básico das finanças pessoais",
    icon: Zap,
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
    monthly: 19.90,
    annual: 199.00,
    description: "Planejamento e controle financeiro completo",
    icon: Crown,
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
  const { subscription } = useSubscription();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState<PlanId | null>(null);

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      toast.error("Você precisa estar logado para assinar.");
      return;
    }

    setLoading(planId);

    try {
      const res = await fetch("/.netlify/functions/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingCycle,
          userId: user.id,
          userEmail: user.email,
        }),
      });

      const data = await res.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.error("Erro ao criar checkout. Tente novamente.");
        console.error(data);
      }
    } catch (err) {
      toast.error("Erro ao conectar com o servidor.");
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const annualDiscount = Math.round((1 - (PLANS[0].annual / (PLANS[0].monthly * 12))) * 100);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 text-center">
          <Link to="/perfil" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao perfil
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolha seu plano</h1>
          <p className="mt-2 text-muted-foreground">Cancele quando quiser.</p>

          {/* Billing toggle */}
          <div className="mt-5 inline-flex items-center rounded-xl bg-muted p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "monthly" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === "annual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Anual
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                -{annualDiscount}%
              </span>
            </button>
          </div>

          {subscription?.status === "trial" && subscription.daysLeftInTrial !== null && (
            <div className="mt-3 inline-block rounded-full bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-600">
              ⏳ Teste — {subscription.daysLeftInTrial} dias restantes
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = subscription?.planId === plan.id && subscription?.isActive;
            const price = billingCycle === "annual" ? plan.annual : plan.monthly;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 bg-card p-6 shadow-sm ${
                  plan.recommended ? "border-primary shadow-primary/10 shadow-lg" : "border-border"
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Mais completo
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${plan.recommended ? "text-primary" : "text-muted-foreground"}`} />
                    <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-1">
                  <span className="text-3xl font-bold text-foreground">
                    R$ {price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {billingCycle === "annual" ? "/ano" : "/mês"}
                  </span>
                </div>
                {billingCycle === "annual" && (
                  <p className="mb-4 text-xs text-primary">
                    equivale a R$ {(price / 12).toFixed(2).replace(".", ",")}/mês
                  </p>
                )}

                <ul className="mb-6 mt-4 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="flex h-11 items-center justify-center rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                    ✓ Plano atual
                  </div>
                ) : (
                  <Button
                    className={`h-11 w-full font-semibold ${
                      plan.recommended
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-primary bg-transparent text-primary hover:bg-primary/10"
                    }`}
                    disabled={!!loading}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...
                      </span>
                    ) : (
                      "Assinar agora"
                    )}
                  </Button>
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
          <p className="mt-2 text-xs text-muted-foreground">Pagamento processado com segurança pelo Mercado Pago.</p>
        </div>

      </div>
    </div>
  );
}
