// Tela de Ajuda e Suporte (/ajuda). Antes era só um item de menu que
// mostrava um toast "Em breve!" — substituído por uma tela real com dois
// blocos: como falar com o suporte (e-mail, sem formulário/anexo ainda —
// isso dependeria de montar uma integração de envio de e-mail do zero,
// deixado pra uma próxima rodada) e um guia rápido das principais telas do
// app, pra tirar dúvida sem precisar escrever pra ninguém.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Mail, Copy, Check, ChevronDown,
  LayoutDashboard, ArrowRightLeft, CreditCard, Target, Tag, UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUPORTE_EMAIL, SUPORTE_MAILTO } from "@/lib/constants";

export const Route = createFileRoute("/_app/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda e suporte — KyraOne" }] }),
  component: AjudaPage,
});

const GUIA = [
  {
    icon: LayoutDashboard, color: "#4f46e5",
    titulo: "Início",
    texto: "Visão geral do mês: saldo, receitas, despesas e pendências (contas a vencer e faturas em aberto). O atalho \"Lançar do clipboard\" copia o texto de uma notificação de banco e tenta preencher a transação sozinho — confira sempre os dados antes de salvar.",
  },
  {
    icon: ArrowRightLeft, color: "#f43f5e",
    titulo: "Transações",
    texto: "Lista completa de receitas e despesas. Lançamentos recorrentes ou parcelados mostram a opção de editar/excluir \"só este\" ou \"este e os próximos\" — escolha com atenção, principalmente ao excluir.",
  },
  {
    icon: CreditCard, color: "#3b82f6",
    titulo: "Cartões e Faturas",
    texto: "Cadastre seus cartões e lance despesas por fatura. Faturas fechadas ainda podem ser editadas; faturas pagas ficam só para consulta. Disponível no plano Pro.",
  },
  {
    icon: Target, color: "#10b981",
    titulo: "Metas e Orçamentos",
    texto: "Defina quanto quer gastar por categoria no mês e acompanhe o progresso. Disponível no plano Pro.",
  },
  {
    icon: Tag, color: "#8b5cf6",
    titulo: "Categorias",
    texto: "Crie e organize categorias de receita e despesa do seu jeito, com cor e ícone próprios.",
  },
  {
    icon: UserCircle, color: "#64748b",
    titulo: "Perfil e assinatura",
    texto: "Dados da conta, vínculo com o WhatsApp da Kyra e gerenciamento da assinatura (plano atual, cancelamento).",
  },
];

function AjudaPage() {
  const [copiado, setCopiado] = useState(false);
  const [abertoIdx, setAbertoIdx] = useState<number | null>(null);

  async function copiarEmail() {
    try {
      await navigator.clipboard.writeText(SUPORTE_EMAIL);
      setCopiado(true);
      toast.success("E-mail copiado!");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Copie manualmente: " + SUPORTE_EMAIL);
    }
  }

  return (
    <div className="space-y-5 p-5 md:max-w-2xl md:mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Link to="/mais"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Ajuda e suporte</h1>
      </div>

      {/* ── Falar com o suporte ──────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-500">
            <Mail className="h-5 w-5"/>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Precisa de ajuda?</p>
            <p className="text-xs text-muted-foreground">Qualquer dúvida ou problema, manda um e-mail pra gente.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5">
          <span className="flex-1 text-sm font-medium text-foreground truncate">{SUPORTE_EMAIL}</span>
          <button type="button" onClick={copiarEmail}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            title="Copiar e-mail">
            {copiado ? <Check className="h-4 w-4 text-emerald-500"/> : <Copy className="h-4 w-4 text-muted-foreground"/>}
          </button>
        </div>
        <a href={SUPORTE_MAILTO}
          className="mt-3 flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          <Mail className="h-4 w-4"/> Enviar e-mail
        </a>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Se puder, descreva o que aconteceu e anexe um print da tela — ajuda bastante a resolver mais rápido.
        </p>
      </div>

      {/* ── Guia rápido ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
          Guia rápido
        </p>
        <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border">
          {GUIA.map((item, i) => {
            const aberto = abertoIdx === i;
            const Icon = item.icon;
            return (
              <div key={item.titulo}>
                <button type="button" onClick={() => setAbertoIdx(aberto ? null : i)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: item.color + "1a", color: item.color }}>
                    <Icon className="h-4.5 w-4.5"/>
                  </div>
                  <span className="flex-1 text-[15px] font-medium text-foreground">{item.titulo}</span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", aberto && "rotate-180")}/>
                </button>
                {aberto && (
                  <div className="px-4 pb-4 pl-[3.75rem]">
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{item.texto}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
