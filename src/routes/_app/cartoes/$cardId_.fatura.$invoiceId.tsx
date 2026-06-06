import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ShoppingBag,
  RotateCcw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCardStore, type CardExpense, type ExpenseType } from "@/lib/card-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes/$cardId_/fatura/$invoiceId")({
  component: FaturaDetailPage,
});

const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  single: <ShoppingBag className="h-3.5 w-3.5" />,
  installment: <Layers className="h-3.5 w-3.5" />,
  recurring: <RotateCcw className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<ExpenseType, string> = {
  single: "Única",
  installment: "Parcelada",
  recurring: "Recorrente",
};

function groupByCategory(expenses: CardExpense[]) {
  return expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
}

function FaturaDetailPage() {
  const { cardId, invoiceId } = Route.useParams();
  const router = useRouter();
  const { cards, invoices, expenses, fetchInvoices, fetchExpenses, payInvoice, ensureInvoices } =
    useCardStore();
  const [paying, setPaying] = useState(false);

  const card = cards.find((c) => c.id === cardId);
  const invoice = invoices.find((i) => i.id === invoiceId);
  const invoiceExpenses = expenses.filter((e) => e.invoice_id === invoiceId);

  useEffect(() => {
    const init = async () => {
      if (!card) return;
      await ensureInvoices(card);
      await fetchInvoices(cardId);
      await fetchExpenses(invoiceId);
    };
    init();
  }, [invoiceId, cardId]);

  const handlePayInvoice = async () => {
    if (!card || !invoice) return;
    setPaying(true);
    try {
      await payInvoice(invoiceId, card);
      toast.success("Fatura marcada como paga!");
    } catch {
      toast.error("Erro ao pagar fatura.");
    } finally {
      setPaying(false);
    }
  };

  if (!invoice || !card) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Fatura não encontrada.
      </div>
    );
  }

  const categoryTotals = groupByCategory(invoiceExpenses);
  const isPaid = invoice.status === "paid";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {card.name} · {invoice.competence}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {invoice.status === "open"
              ? "Fatura aberta"
              : invoice.status === "closed"
              ? "Fatura fechada"
              : "Fatura paga"}
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Competência</p>
            <p className="font-medium text-foreground">{invoice.competence}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fechamento</p>
            <p className="font-medium text-foreground">
              {new Date(invoice.closing_date + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p className="font-medium text-foreground">
              {new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-foreground">
              {invoice.total_amount.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
        </div>

        {!isPaid && invoice.total_amount > 0 && (
          <Button
            className="mt-4 h-11 w-full gap-2 bg-green-600 font-semibold hover:bg-green-700"
            onClick={handlePayInvoice}
            disabled={paying}
          >
            <CheckCircle2 className="h-4 w-4" />
            {paying ? "Processando..." : "Marcar como paga"}
          </Button>
        )}

        {isPaid && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-50 py-3 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Fatura paga
          </div>
        )}
      </div>

      {/* Totais por categoria */}
      {Object.keys(categoryTotals).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Por categoria</h2>
          <div className="space-y-2">
            {Object.entries(categoryTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, total]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm text-foreground">{cat}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Lista de despesas */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Despesas ({invoiceExpenses.length})
        </h2>

        {invoiceExpenses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhuma despesa nesta fatura.
          </div>
        ) : (
          <div className="space-y-2">
            {invoiceExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {TYPE_ICON[expense.expense_type]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{expense.description}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{expense.category}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(expense.purchase_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        expense.expense_type === "recurring"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : expense.expense_type === "installment"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {TYPE_LABEL[expense.expense_type]}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {expense.amount.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
