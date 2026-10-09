import { useRouter } from "@tanstack/react-router";
import {
  ListChecks,
  CreditCard,
  Receipt,
  MessageCircle,
  Check,
  ChevronRight,
  X,
} from "lucide-react";
import { useOnboarding, dismissOnboarding, type OnboardingStep } from "@/lib/onboarding-store";

type StepDef = {
  step: OnboardingStep;
  icon: typeof ListChecks;
  titulo: string;
  descricao: string;
  to: string;
};

const STEPS: StepDef[] = [
  {
    step: "categoria",
    icon: ListChecks,
    titulo: "Crie sua primeira categoria",
    descricao: "Organize seus gastos do seu jeito",
    to: "/categorias",
  },
  {
    step: "cartao",
    icon: CreditCard,
    titulo: "Cadastre um cartão",
    descricao: "Pra acompanhar faturas e limites",
    to: "/cartoes/novo",
  },
  {
    step: "despesa",
    icon: Receipt,
    titulo: "Lance sua primeira despesa",
    descricao: "Avulsa ou no cartão, você decide",
    to: "/nova-transacao",
  },
  {
    step: "whatsapp",
    icon: MessageCircle,
    titulo: "Conecte seu WhatsApp",
    descricao: "Registre despesas conversando com a Kyra",
    to: "/perfil",
  },
];

export function OnboardingChecklist() {
  const router = useRouter();
  const onboarding = useOnboarding();

  if (onboarding.loading || onboarding.dismissed) return null;
  const concluidos = STEPS.filter((s) => onboarding[s.step]).length;
  if (concluidos === STEPS.length) return null;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Primeiros passos</p>
          <p className="text-xs text-muted-foreground">
            {concluidos}/{STEPS.length} concluído{concluidos === 1 ? "" : "s"} — são só sugestões
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismissOnboarding()}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" /> Dispensar
        </button>
      </div>

      <div className="space-y-1.5">
        {STEPS.map(({ step, icon: Icon, titulo, descricao, to }) => {
          const feito = onboarding[step];
          return (
            <button
              key={step}
              type="button"
              onClick={() => router.navigate({ to })}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feito ? "bg-emerald-100" : "bg-primary/10"}`}
              >
                <Icon className={`h-4.5 w-4.5 ${feito ? "text-emerald-600" : "text-primary"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${feito ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {titulo}
                </p>
                <p className="text-xs text-muted-foreground truncate">{descricao}</p>
              </div>
              {feito ? (
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
