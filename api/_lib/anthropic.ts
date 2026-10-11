// Cliente mínimo pra Claude (Anthropic API) — usado hoje só pelo resumo
// mensal (api/cron/gerar-resumo-mensal.ts), pra gerar 1 insight + 1 dica em
// cima dos números já calculados. Nunca manda dado identificável (nome,
// e-mail) — só valores agregados (receitas/despesas/categorias).
import Anthropic from "@anthropic-ai/sdk";

let cliente: Anthropic | null = null;
function clienteAnthropic(): Anthropic | null {
  if (cliente) return cliente;
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return null;
  cliente = new Anthropic({ apiKey: chave });
  return cliente;
}

export type ResumoParaIA = {
  competencia: string; // "YYYY-MM"
  receitas: number;
  despesas: number;
  saldo: number;
  porCategoria: { categoria: string; valor: number }[];
};

export type InsightGerado = { insight: string; dica: string };

// Pede pro Haiku (rápido e barato — roda 1x por usuário por mês, não precisa
// de um modelo caro) ler os números já computados e devolver 1 insight (o
// que chamou atenção no mês) + 1 dica prática, em JSON. Se a chamada falhar
// ou a API key não estiver configurada, devolve null — o resumo numérico
// ainda é salvo sem insight (degrada graciosamente, nunca bloqueia o resto
// do job pros outros usuários).
export async function gerarInsightMensal(dados: ResumoParaIA): Promise<InsightGerado | null> {
  const anthropic = clienteAnthropic();
  if (!anthropic) {
    console.error("[anthropic] ANTHROPIC_API_KEY não configurada — pulando geração de insight.");
    return null;
  }

  const categoriasTexto = dados.porCategoria
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)
    .map((c) => `${c.categoria}: R$ ${c.valor.toFixed(2)}`)
    .join(", ");

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "Você gera um insight e uma dica curtos pro resumo financeiro mensal de um app de finanças pessoais " +
        "chamado KyraOne. Tom: direto, acolhedor, nunca alarmista nem moralista sobre os gastos da pessoa. " +
        "Responda só com um objeto JSON válido, sem texto antes ou depois, no formato " +
        '{"insight": "...", "dica": "..."}. O insight tem 1-2 frases comentando o mês (ex: categoria que mais ' +
        "pesou, comparação receita vs despesa, saldo). A dica tem 1 frase, prática e específica pro que foi " +
        "observado — nunca genérica tipo 'economize mais'. Português do Brasil, sem emoji.",
      messages: [
        {
          role: "user",
          content:
            `Mês ${dados.competencia}: receitas R$ ${dados.receitas.toFixed(2)}, ` +
            `despesas R$ ${dados.despesas.toFixed(2)}, saldo R$ ${dados.saldo.toFixed(2)}. ` +
            `Maiores categorias de despesa: ${categoriasTexto || "nenhuma"}.`,
        },
      ],
    });

    const bloco = resp.content.find((b) => b.type === "text");
    if (!bloco || bloco.type !== "text") return null;

    const json = JSON.parse(bloco.text.trim());
    if (typeof json.insight !== "string" || typeof json.dica !== "string") return null;
    return { insight: json.insight, dica: json.dica };
  } catch (erro) {
    console.error("[anthropic] erro ao gerar insight mensal:", erro);
    return null;
  }
}
