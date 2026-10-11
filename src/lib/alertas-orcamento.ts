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
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth(); // 0-indexed
    const anoMes = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    const competenciaAtual = `${String(mes + 1).padStart(2, "0")}/${ano}`;

    // Mesmas fontes que a tela /metas usa pra calcular "gasto" de um
    // orçamento (BudgetsSection em _app.metas.tsx): transações avulsas
    // (filtradas por `date`) + card_expenses/card_installments.
    //
    // FIX: card_expenses/card_installments eram filtrados por `purchase_date`
    // dentro do mês civil atual — mas numa compra parcelada (ver
    // card-store.ts/addExpense), TODAS as parcelas são gravadas com o mesmo
    // `purchase_date` (a data da compra original); só o `invoice_id` muda,
    // apontando pra fatura real de cada parcela. O mesmo vale pra despesa
    // recorrente (uma linha por fatura aberta, todas com o `purchase_date`
    // da criação). Ou seja: filtrar por purchase_date somava TODAS as
    // parcelas/ocorrências futuras no "gasto" do mês da compra, não só a que
    // de fato cai na fatura deste mês — por isso o alerta às vezes cruzava o
    // limite cedo demais. Corrigido buscando pelo `invoice_id`: só conta quem
    // pertence à fatura cuja `competence` é o mês/ano atual.
    const { data: invoicesDoMes } = await supabase
      .from("invoices")
      .select("id")
      .eq("competence", competenciaAtual);
    const invoiceIds = (invoicesDoMes ?? []).map((i) => i.id);

    const [{ data: transacoes }, { data: despesasCartao }, { data: parcelasCartao }] =
      await Promise.all([
        supabase
          .from("transactions")
          .select("amount, date")
          .eq("user_id", user.id)
          .eq("type", "expense")
          .eq("category", categoria),
        invoiceIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from("card_expenses")
              .select("amount")
              .eq("user_id", user.id)
              .eq("category", categoria)
              .in("invoice_id", invoiceIds),
        invoiceIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from("card_installments")
              .select("amount")
              .eq("user_id", user.id)
              .eq("category", categoria)
              .in("invoice_id", invoiceIds),
      ]);

    // `transactions.amount` pode vir negativo pra despesa (ver dashboard,
    // que também usa Math.abs ao somar) — sem o abs aqui, uma despesa
    // negativa diminuía o total em vez de aumentar, e o alerta nunca
    // cruzava o limite. `card_expenses`/`card_installments` já vêm sempre
    // positivos, mas o abs não faz diferença nesse caso (só reforça).
    const totalTransacoes = (transacoes ?? [])
      .filter((t) => dataBrEhDoMes(t.date as string, anoMes))
      .reduce((soma, t) => soma + Math.abs(Number(t.amount)), 0);
    const totalCartao = (despesasCartao ?? []).reduce(
      (soma, e) => soma + Math.abs(Number(e.amount)),
      0,
    );
    const totalParcelas = (parcelasCartao ?? []).reduce(
      (soma, p) => soma + Math.abs(Number(p.amount)),
      0,
    );

    const valorAbs = Math.abs(valorLancamento);
    const totalComEsse = totalTransacoes + totalCartao + totalParcelas;
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
