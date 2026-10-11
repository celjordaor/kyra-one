import { supabase } from "./supabase";
import { dispararAlerta } from "./notificacoes-store";

// Checa se a categoria de um lançamento recém-salvo tem orçamento definido
// (tabela `budgets` — CRUD já existe em goals-store.ts, mas hoje não tem
// nenhuma tela que o alimenta, então isso só dispara pra quem já tiver
// criado um orçamento por fora) e, se esse lançamento fez o total do mês
// cruzar o limite, dispara um push. Só dispara no momento da travessia (não
// a cada lançamento novo depois de já ter passado), senão o usuário levaria
// um push a cada despesa pro resto do mês.
//
// Fire-and-forget: chamada depois que a despesa já foi salva, nunca lança —
// um erro aqui não pode desfazer ou atrasar o lançamento em si.
export async function verificarAlertaOrcamento(
  categoria: string,
  valorLancamento: number,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: orcamento } = await supabase
      .from("budgets")
      .select("limit_amount")
      .eq("user_id", user.id)
      .eq("category", categoria)
      .maybeSingle();
    if (!orcamento) return;

    const limite = Number(orcamento.limit_amount);
    const hoje = new Date();
    const anoMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const inicioMes = `${anoMes}-01`;

    const [{ data: transacoes }, { data: despesasCartao }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, date")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("category", categoria),
      supabase
        .from("card_expenses")
        .select("amount")
        .eq("user_id", user.id)
        .eq("category", categoria)
        .gte("purchase_date", inicioMes),
    ]);

    // `transactions.amount` pode vir negativo pra despesa (ver dashboard,
    // que também usa Math.abs ao somar) — sem o abs aqui, uma despesa
    // negativa diminuía o total em vez de aumentar, e o alerta nunca
    // cruzava o limite. `card_expenses.amount` já é sempre positivo, mas o
    // abs não faz diferença nesse caso (só reforça).
    const totalTransacoes = (transacoes ?? [])
      .filter((t) => dataBrEhDoMes(t.date as string, anoMes))
      .reduce((soma, t) => soma + Math.abs(Number(t.amount)), 0);
    const totalCartao = (despesasCartao ?? []).reduce(
      (soma, e) => soma + Math.abs(Number(e.amount)),
      0,
    );

    const valorAbs = Math.abs(valorLancamento);
    const totalComEsse = totalTransacoes + totalCartao;
    const totalAntesDesse = totalComEsse - valorAbs;

    if (totalAntesDesse < limite && totalComEsse >= limite) {
      await dispararAlerta("despesa", {
        titulo: "Limite de orçamento atingido",
        corpo: `Você já gastou R$ ${totalComEsse.toFixed(2).replace(".", ",")} em ${categoria} este mês (limite: R$ ${limite.toFixed(2).replace(".", ",")}).`,
        url: "/transacoes",
      });
    }
  } catch (erro) {
    console.error("Erro ao verificar alerta de orçamento:", erro);
  }
}

// `transactions.date` é salvo como dd/mm/yyyy (ver transactions-store.ts).
function dataBrEhDoMes(dataBr: string, anoMes: string): boolean {
  const partes = dataBr.split("/");
  if (partes.length !== 3) return false;
  const [, mm, yyyy] = partes;
  return `${yyyy}-${mm}` === anoMes;
}
