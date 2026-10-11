// Job diário (Vercel Cron, ver vercel.json) que gera o resumo do mês
// anterior (números + insight/dica via Claude Haiku) pra cada usuário que
// ainda não tiver um, e dispara o push "seu resumo está pronto". Roda todo
// dia (não só no dia 1) de propósito: `UNIQUE(user_id, competencia)` em
// resumos_mensais faz os dias seguintes só pularem quem já foi gerado —
// serve de retry automático se a geração de algum usuário falhar num dia
// (ex: Anthropic fora do ar), sem duplicar nada.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clienteAdmin } from "../_lib/supabase-admin.js";
import { enviarPushParaUsuario, type PushSubscriptionJSON } from "../_lib/push.js";
import { gerarInsightMensal } from "../_lib/anthropic.js";

// `transactions.date` é dd/mm/yyyy (mesmo parse de parseBrDate em
// transactions-store.ts) — reimplementado aqui porque esse arquivo é
// client-side e não pode ser importado numa função serverless.
function parseBrDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function competenciaAnterior(): { competencia: string; mes: number; ano: number } {
  const hoje = new Date();
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return {
    competencia: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
    mes: ref.getMonth(),
    ano: ref.getFullYear(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel injeta esse header automaticamente nas chamadas de Cron Job
  // quando CRON_SECRET está configurada nas env vars — protege contra
  // qualquer um disparar o job manualmente batendo na URL.
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ erro: "Não autorizado." });
  }

  const admin = clienteAdmin();
  if (!admin) {
    return res.status(500).json({ erro: "Indisponível." });
  }

  const { competencia, mes, ano } = competenciaAnterior();

  const { data: perfis, error: erroPerfis } = await admin
    .from("profiles")
    .select("id, push_subscription, notif_monthly_summary");
  if (erroPerfis || !perfis) {
    console.error("[cron/gerar-resumo-mensal] erro ao listar perfis:", erroPerfis);
    return res.status(500).json({ erro: "Não consegui listar os usuários." });
  }

  let gerados = 0;
  let pulados = 0;
  let comErro = 0;

  for (const perfil of perfis) {
    try {
      const { data: jaExiste } = await admin
        .from("resumos_mensais")
        .select("id")
        .eq("user_id", perfil.id)
        .eq("competencia", competencia)
        .maybeSingle();
      if (jaExiste) {
        pulados++;
        continue;
      }

      const { data: transacoes } = await admin
        .from("transactions")
        .select("amount, type, category, date")
        .eq("user_id", perfil.id);

      const doMes = (transacoes ?? []).filter((t) => {
        const d = parseBrDate(t.date as string);
        return d.getMonth() === mes && d.getFullYear() === ano;
      });

      if (doMes.length === 0) {
        // Usuário sem nenhuma movimentação nesse mês — não gera resumo vazio
        // (nada pra mostrar, só criaria ruído). Também não conta como
        // "pulado" de propósito: não é skip por já existir, é skip por falta
        // de dado; mantido fora das duas métricas pra não confundir no log.
        continue;
      }

      let receitas = 0;
      let despesas = 0;
      const porCategoriaMap = new Map<string, number>();
      for (const t of doMes) {
        const valor = Math.abs(Number(t.amount));
        if (t.type === "income") {
          receitas += valor;
        } else {
          despesas += valor;
          porCategoriaMap.set(
            t.category as string,
            (porCategoriaMap.get(t.category as string) ?? 0) + valor,
          );
        }
      }
      const saldo = receitas - despesas;
      const porCategoria = [...porCategoriaMap.entries()].map(([categoria, valor]) => ({
        categoria,
        valor,
      }));

      const insightGerado = await gerarInsightMensal({
        competencia,
        receitas,
        despesas,
        saldo,
        porCategoria,
      });

      const { error: erroInsert } = await admin.from("resumos_mensais").insert({
        user_id: perfil.id,
        competencia,
        receitas,
        despesas,
        saldo,
        por_categoria: porCategoria,
        insight: insightGerado?.insight ?? null,
        dica: insightGerado?.dica ?? null,
      });
      if (erroInsert) {
        console.error(
          `[cron/gerar-resumo-mensal] erro ao salvar resumo de ${perfil.id}:`,
          erroInsert,
        );
        comErro++;
        continue;
      }
      gerados++;

      if (perfil.notif_monthly_summary && perfil.push_subscription) {
        await enviarPushParaUsuario(perfil.id, perfil.push_subscription as PushSubscriptionJSON, {
          titulo: "Seu resumo mensal está pronto",
          corpo: "Clique aqui para visualizar.",
          url: "/resumo-mensal",
        });
      }
    } catch (erro) {
      console.error(`[cron/gerar-resumo-mensal] erro inesperado pro usuário ${perfil.id}:`, erro);
      comErro++;
    }
  }

  return res.status(200).json({ ok: true, competencia, gerados, pulados, comErro });
}
