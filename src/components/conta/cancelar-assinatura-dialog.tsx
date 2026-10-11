import { useState } from "react";
import { toast } from "sonner";
import { Heart, Tag, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabase";
import { useAssinatura, useRecarregarAssinatura, nomeNivel } from "@/lib/assinaturas";
import { buscarPlano } from "@/lib/planos";

type Etapa = "retencao" | "confirmacao";

/**
 * Fluxo de retenção pro cancelamento de assinatura, usado em /assinar.
 * Antes, o botão "Cancelar assinatura" chamava a API direto, sem nenhuma
 * confirmação e sem oferecer nada pro usuário ficar — reportado pelo
 * fundador com captura de tela mostrando a assinatura já cancelada sem
 * nenhum clique de confirmação. Reaproveita o mesmo desconto permanente já
 * usado no fluxo de exclusão de conta (api/conta/aplicar-desconto-retencao),
 * já que faz sentido oferecer o mesmo desconto pra quem só quer cancelar.
 * Duas etapas:
 *  1) Retenção — oferta de desconto permanente, com saída pra "mesmo assim
 *     quero cancelar".
 *  2) Confirmação — explica o que acontece (acesso bloqueado, dados
 *     preservados) e exige um clique explícito antes de chamar a API de
 *     cancelamento de verdade (recebida via prop, já existe em /assinar).
 */
export function CancelarAssinaturaDialog({
  open,
  onOpenChange,
  onConfirmarCancelamento,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmarCancelamento: () => Promise<boolean>;
}) {
  const est = useAssinatura();
  const recarregar = useRecarregarAssinatura();
  const planoAtual = est.plano ? buscarPlano(est.plano) : null;

  const [etapa, setEtapa] = useState<Etapa>("retencao");
  const [carregando, setCarregando] = useState(false);
  // Erro permanente (ex: assinatura apagada direto no Asaas) — mostrado no
  // modal de aviso (padrão já existente em ConfirmDialog, modo `alertOnly`,
  // antes nunca usado em lugar nenhum do app) em vez de só um toast, porque
  // tentar de novo sozinho não resolve e o usuário precisa de uma ação
  // diferente (falar com o suporte).
  const [avisoPermanente, setAvisoPermanente] = useState<string | null>(null);

  function fechar() {
    onOpenChange(false);
    // Reseta pro próximo uso, com um pequeno atraso pra não "piscar" durante
    // a animação de fechamento do dialog.
    setTimeout(() => setEtapa("retencao"), 200);
  }

  async function aceitarDesconto() {
    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Entra de novo.");
        return;
      }

      const resp = await fetch("/api/conta/aplicar-desconto-retencao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const dados = await resp.json().catch(() => null);
      if (!resp.ok) {
        // A API já devolve uma mensagem tratada (mensagemAmigavelAsaas no
        // backend) — nunca o JSON cru do Asaas. `permanente` decide entre o
        // modal de aviso (precisa de ação do usuário, ex: falar com
        // suporte) e um toast comum (erro passageiro, só tentar de novo).
        const mensagem = dados?.erro ?? "Não consegui aplicar o desconto agora. Tenta de novo.";
        if (dados?.permanente) setAvisoPermanente(mensagem);
        else toast.error(mensagem);
        return;
      }
      await recarregar();
      toast.success(
        `Combinado! Seu novo valor é R$ ${Number(dados.novoValor).toFixed(2).replace(".", ",")}/mês, pra sempre.`,
      );
      fechar();
    } catch (erro) {
      // Sem isso, um erro de rede (ou uma resposta que não é JSON, ex: a
      // função serverless crashando antes de montar a resposta) passava em
      // branco pro usuário — o botão "travava" sem nenhum feedback, sem
      // nunca mostrar o toast de erro. Reportado pelo fundador como "clico
      // e não acontece nada".
      console.error("Erro ao aplicar desconto de retenção:", erro);
      toast.error("Não consegui aplicar o desconto agora. Tenta de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarCancelamento() {
    setCarregando(true);
    try {
      // onConfirmarCancelamento() (a função cancelar() de /assinar) já
      // mostra seu próprio toast de erro/sucesso e nunca lança — só fecha
      // o diálogo quando ela de fato conseguir cancelar, senão o usuário
      // fica com um diálogo fechado e nenhuma pista do que deu errado.
      const sucesso = await onConfirmarCancelamento();
      if (sucesso) fechar();
    } catch (erro) {
      console.error("Erro ao confirmar cancelamento:", erro);
      toast.error("Não consegui cancelar agora. Tenta de novo.");
    } finally {
      setCarregando(false);
    }
  }

  if (!planoAtual) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {etapa === "retencao" && (
          <>
            <div className="bg-gradient-to-br from-emerald-500 to-primary px-5 pt-5 pb-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
                <Heart className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">Antes de cancelar, uma ideia</h2>
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
                Não, mesmo assim quero cancelar
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
              <h2 className="text-base font-bold">Cancelar assinatura?</h2>
              <p className="text-sm text-white/80 mt-0.5">
                Seu acesso ao {nomeNivel(est.nivel)} será encerrado.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>O KyraOne fica bloqueado até você assinar de novo</li>
                <li>Seus dados continuam salvos — nada é apagado</li>
                <li>Você pode assinar de novo quando quiser</li>
              </ul>
              <Button
                variant="destructive"
                className="w-full"
                disabled={carregando}
                onClick={confirmarCancelamento}
              >
                {carregando ? "Cancelando..." : "Cancelar assinatura definitivamente"}
              </Button>
              <button
                type="button"
                disabled={carregando}
                onClick={() => setEtapa("retencao")}
                className="w-full text-center text-xs text-muted-foreground hover:underline underline-offset-2"
              >
                Voltar, não quero cancelar
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={!!avisoPermanente}
      onClose={() => setAvisoPermanente(null)}
      alertOnly
      variant="warning"
      title="Não consegui aplicar o desconto"
      description={avisoPermanente ?? ""}
    />
    </>
  );
}
