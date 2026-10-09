import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart, Sparkles, AlertTriangle, Tag } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAssinatura, diasRestantesTrial, nomeNivel } from "@/lib/assinaturas";
import { buscarPlano } from "@/lib/planos";

type Etapa = "retencao" | "confirmacao";

/**
 * Fluxo de exclusão de conta com retenção, usado em /mais (Zona de risco) e
 * como saída em /assinar. Duas etapas:
 *  1) Retenção — mensagem amigável (trial) ou oferta de desconto permanente
 *     (assinante pagante) antes de seguir pra exclusão.
 *  2) Confirmação final — irreversível, exige digitar "EXCLUIR".
 */
export function ExcluirContaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const est = useAssinatura();
  const diasTrial = diasRestantesTrial(est);

  const [etapa, setEtapa] = useState<Etapa>("retencao");
  const [confirmText, setConfirmText] = useState("");
  const [carregando, setCarregando] = useState(false);

  const emTrialAtivo = est.status === "trial" && diasTrial !== null && diasTrial > 0;
  const assinantePagante = est.status === "ativa";
  const planoAtual = est.plano ? buscarPlano(est.plano) : null;

  function fechar() {
    onOpenChange(false);
    // Reseta pro próximo uso, com um pequeno atraso pra não "piscar" durante
    // a animação de fechamento do dialog.
    setTimeout(() => {
      setEtapa("retencao");
      setConfirmText("");
    }, 200);
  }

  async function aceitarDesconto() {
    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch("/api/conta/aplicar-desconto-retencao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const dados = await resp.json();
      if (!resp.ok) {
        toast.error(dados?.erro ?? "Não consegui aplicar o desconto agora.");
        return;
      }
      toast.success(
        `Combinado! Seu novo valor é R$ ${Number(dados.novoValor).toFixed(2).replace(".", ",")}/mês, pra sempre.`,
      );
      fechar();
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarExclusao() {
    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch("/api/conta/excluir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const dados = await resp.json();
      if (!resp.ok) {
        toast.error(dados?.erro ?? "Não consegui excluir sua conta agora. Tenta de novo.");
        setCarregando(false);
        return;
      }
      toast.success("Sua conta foi excluída. Sentiremos sua falta. 💚");
      await supabase.auth.signOut();
      router.navigate({ to: "/" });
    } catch {
      toast.error("Não consegui excluir sua conta agora. Tenta de novo.");
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {etapa === "retencao" && assinantePagante && planoAtual && (
          <>
            <div className="bg-gradient-to-br from-emerald-500 to-primary px-5 pt-5 pb-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
                <Heart className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">Antes de ir, uma ideia</h2>
              <p className="text-sm text-white/80 mt-0.5">Que tal continuar por um valor menor?</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-xl border-2 border-primary bg-primary/5 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                  <Tag className="h-3.5 w-3.5" /> Oferta especial pra você
                </div>
                <p className="text-sm text-foreground">
                  Continue no <strong>{planoAtual.nome}</strong> pagando{" "}
                  <span className="line-through text-muted-foreground">
                    R$ {planoAtual.valor.toFixed(2).replace(".", ",")}
                  </span>{" "}
                  <strong className="text-primary">
                    R$ {planoAtual.valorDesconto.toFixed(2).replace(".", ",")}/mês
                  </strong>{" "}
                  — pra sempre, enquanto continuar com a gente.
                </p>
              </div>
              <Button className="w-full" disabled={carregando} onClick={aceitarDesconto}>
                {carregando ? "Aplicando..." : "Quero o desconto e vou ficar"}
              </Button>
              <button
                type="button"
                disabled={carregando}
                onClick={() => setEtapa("confirmacao")}
                className="w-full text-center text-xs text-muted-foreground hover:text-destructive underline underline-offset-2"
              >
                Não, mesmo assim quero excluir minha conta
              </button>
            </div>
          </>
        )}

        {etapa === "retencao" && !assinantePagante && (
          <>
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-5 pb-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">Antes de ir...</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {emTrialAtivo
                  ? `Você ainda tem ${diasTrial} ${diasTrial === 1 ? "dia" : "dias"} de teste grátis com o ${nomeNivel(est.nivel)}.`
                  : "Tem certeza? Você vai perder tudo que já organizou por aqui."}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {emTrialAtivo
                  ? "Cartões, faturas e metas liberados sem custo — dá uma chance pro KyraOne te ajudar a organizar a grana antes de decidir."
                  : "Suas categorias, cartões, transações e metas serão apagados permanentemente."}
              </p>
              <Button className="w-full" onClick={fechar}>
                Continuar aproveitando
              </Button>
              <button
                type="button"
                onClick={() => setEtapa("confirmacao")}
                className="w-full text-center text-xs text-muted-foreground hover:text-destructive underline underline-offset-2"
              >
                Mesmo assim, quero excluir minha conta
              </button>
            </div>
          </>
        )}

        {etapa === "confirmacao" && (
          <>
            <div className="bg-gradient-to-br from-red-500 to-red-600 px-5 pt-5 pb-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">Excluir conta definitivamente</h2>
              <p className="text-sm text-white/80 mt-0.5">Essa ação não pode ser desfeita.</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Todas as suas transações, categorias, cartões e metas serão apagados</li>
                <li>Sua assinatura (se houver) será cancelada</li>
                <li>Seu acesso ao KyraOne e à Kyra no WhatsApp será encerrado</li>
                <li>Não é possível recuperar os dados depois</li>
              </ul>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">
                  Digite <strong>EXCLUIR</strong> pra confirmar:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="EXCLUIR"
                  autoFocus
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={confirmText !== "EXCLUIR" || carregando}
                onClick={confirmarExclusao}
              >
                {carregando ? "Excluindo..." : "Excluir minha conta definitivamente"}
              </Button>
              <button
                type="button"
                disabled={carregando}
                onClick={fechar}
                className="w-full text-center text-xs text-muted-foreground hover:underline underline-offset-2"
              >
                Cancelar, não quero excluir
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
