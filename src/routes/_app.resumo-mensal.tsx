// Tela do resumo mensal (/resumo-mensal) — aberta a partir do push "Seu
// resumo mensal está pronto" (ver api/cron/gerar-resumo-mensal.ts) ou pelo
// atalho em /mais. Só lê o resumo já pré-computado em `resumos_mensais`
// (números + insight/dica gerados pelo Claude Haiku) — nunca chama IA na
// hora que o usuário abre a tela.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Lightbulb, CalendarX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/resumo-mensal")({
  head: () => ({ meta: [{ title: "Resumo mensal — KyraOne" }] }),
  component: ResumoMensalPage,
});

type Resumo = {
  competencia: string;
  receitas: number;
  despesas: number;
  saldo: number;
  por_categoria: { categoria: string; valor: number }[];
  insight: string | null;
  dica: string | null;
};

function formatarReal(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function formatarCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function ResumoMensalPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("resumos_mensais")
          .select("competencia, receitas, despesas, saldo, por_categoria, insight, dica, id")
          .eq("user_id", user.id)
          .order("competencia", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setResumo(data);
          // Marca como visualizado (não bloqueia a tela nem precisa de retry).
          supabase
            .from("resumos_mensais")
            .update({ visualizado_em: new Date().toISOString() })
            .eq("id", data.id);
        }
      } catch (erro) {
        console.error("Erro ao carregar resumo mensal:", erro);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5 p-5 md:max-w-2xl md:mx-auto pb-10">
      <div className="flex items-center gap-3">
        <Link
          to="/mais"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Resumo mensal</h1>
      </div>

      {carregando && (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      )}

      {!carregando && !resumo && (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-2">
          <CalendarX className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Ainda não tem nenhum resumo</p>
          <p className="text-xs text-muted-foreground">
            O resumo do mês fica pronto automaticamente nos primeiros dias do mês seguinte.
          </p>
        </div>
      )}

      {!carregando && resumo && (
        <>
          <div className="bg-gradient-to-br from-emerald-500 to-primary rounded-2xl px-5 pt-5 pb-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {formatarCompetencia(resumo.competencia)}
            </p>
            <p className="text-3xl font-bold mt-1">{formatarReal(resumo.saldo)}</p>
            <p className="text-sm text-white/80">
              {resumo.saldo >= 0 ? "de saldo no mês" : "de saldo negativo no mês"}
            </p>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="h-4 w-4 text-white/80" />
                {formatarReal(resumo.receitas)}
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingDown className="h-4 w-4 text-white/80" />
                {formatarReal(resumo.despesas)}
              </div>
            </div>
          </div>

          {resumo.insight && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-sm text-foreground leading-relaxed pt-1">{resumo.insight}</p>
              </div>
              {resumo.dica && (
                <div className="flex items-start gap-3 border-t pt-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-500">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                    {resumo.dica}
                  </p>
                </div>
              )}
            </div>
          )}

          {resumo.por_categoria.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Despesas por categoria
              </p>
              <div className="space-y-2.5">
                {[...resumo.por_categoria]
                  .sort((a, b) => b.valor - a.valor)
                  .map((c) => {
                    const pct = resumo.despesas > 0 ? (c.valor / resumo.despesas) * 100 : 0;
                    return (
                      <div key={c.categoria}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground">{c.categoria}</span>
                          <span className="text-muted-foreground">{formatarReal(c.valor)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full bg-primary")}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
