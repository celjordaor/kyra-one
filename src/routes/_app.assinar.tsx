import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Smartphone, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { listarPlanos, type PlanoId } from "@/lib/planos";
import { useAssinatura, useRecarregarAssinatura, nomeNivel, diasRestantesTrial } from "@/lib/assinaturas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ExcluirContaDialog } from "@/components/conta/excluir-conta-dialog";

export const Route = createFileRoute("/_app/assinar")({
  component: AssinarPage,
});

function formatarCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function AssinarPage() {
  const est = useAssinatura();
  const recarregar = useRecarregarAssinatura();
  const planos = listarPlanos();

  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoId>(planos[0].id);
  const [metodo, setMetodo] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [cpf, setCpf] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [openExcluirConta, setOpenExcluirConta] = useState(false);

  const jaAssinante = est.status === "ativa";
  const emTrial = est.status === "trial";
  const diasTrial = diasRestantesTrial(est);
  const trialExpirado = emTrial && (diasTrial === null || diasTrial <= 0);

  async function assinar() {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) {
      toast.error("Digita um CPF válido.");
      return;
    }

    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Entra de novo.");
        return;
      }

      const resp = await fetch("/api/asaas/assinar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cpf: cpfLimpo, plano: planoSelecionado, metodo }),
      });
      const dados = await resp.json();

      if (!resp.ok) {
        toast.error(dados?.erro ?? "Não consegui criar a assinatura agora.");
        return;
      }

      await recarregar();

      if (dados.invoiceUrl) {
        window.open(dados.invoiceUrl, "_blank");
        toast.success("Assinatura criada! Finaliza o pagamento na aba que abriu.");
      } else {
        toast.success("Assinatura criada!");
      }
    } catch {
      toast.error("Não consegui criar a assinatura agora. Tenta de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function cancelar() {
    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch("/api/asaas/cancelar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const dados = await resp.json();
      if (!resp.ok) {
        toast.error(dados?.erro ?? "Não consegui cancelar agora.");
        return;
      }
      await recarregar();
      toast.success("Assinatura cancelada.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background md:max-w-2xl md:mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-12 pb-8 text-white">
        <p className="text-sm font-semibold text-white/70">Assinatura</p>
        <h1 className="mt-1 text-xl font-bold">
          {jaAssinante
            ? `Você está no ${nomeNivel(est.nivel)}`
            : emTrial && !trialExpirado
              ? "Você está no período de teste"
              : trialExpirado
                ? "Teu teste gratuito acabou"
                : "Escolhe teu plano"}
        </h1>
        <p className="mt-1 text-sm text-white/70">
          {jaAssinante
            ? "Assinatura ativa."
            : emTrial && !trialExpirado
              ? `Acesso completo (Kyra One Pro) liberado por mais ${diasTrial} ${diasTrial === 1 ? "dia" : "dias"}. Quer continuar depois? Escolhe um plano abaixo.`
              : trialExpirado
                ? "Teus 14 dias de teste grátis terminaram. Escolhe um plano pra continuar usando o KyraOne."
                : "Sem assinatura ativa, o KyraOne fica bloqueado."}
        </p>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-3">
        {!jaAssinante && (
          <>
            {planos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanoSelecionado(p.id)}
                className={cn(
                  "w-full rounded-2xl border-2 bg-white dark:bg-card p-4 text-left transition-colors",
                  planoSelecionado === p.id ? "border-primary" : "border-transparent shadow-sm"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">{p.nome}</p>
                  {planoSelecionado === p.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>
                <p className="mt-2 font-bold text-primary">
                  R$ {p.valor.toFixed(2).replace(".", ",")}/mês
                </p>
              </button>
            ))}

            <div className="rounded-2xl border bg-white dark:bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetodo("PIX")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors",
                    metodo === "PIX" ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground"
                  )}
                >
                  <Smartphone className="h-4 w-4" /> Pix
                </button>
                <button
                  type="button"
                  onClick={() => setMetodo("CREDIT_CARD")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors",
                    metodo === "CREDIT_CARD" ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground"
                  )}
                >
                  <CreditCard className="h-4 w-4" /> Cartão
                </button>
              </div>

              <p className="text-sm font-medium text-foreground pt-1">Teu CPF</p>
              <Input
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Necessário pra gerar a cobrança no Asaas.
              </p>
            </div>

            <Button className="w-full" disabled={carregando} onClick={assinar}>
              {carregando ? "Processando..." : "Assinar"}
            </Button>

            <button
              type="button"
              onClick={() => setOpenExcluirConta(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 pt-1"
            >
              Não quero mais continuar
            </button>
          </>
        )}

        {jaAssinante && (
          <Button
            variant="outline"
            className="w-full text-red-500 border-red-200"
            disabled={carregando}
            onClick={cancelar}
          >
            Cancelar assinatura
          </Button>
        )}
      </div>

      <ExcluirContaDialog open={openExcluirConta} onOpenChange={setOpenExcluirConta} />
    </div>
  );
}
