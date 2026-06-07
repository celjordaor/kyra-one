import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Undo2, Lock, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCardStore } from "@/lib/card-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ExpenseDetailModal,
  TYPE_ICON, TYPE_LABEL, TYPE_CLASS, fmt, recalcTotal,
  type UnifiedItem, type InvoiceStatus,
} from "@/components/cartoes/expense-detail-modal";
import type { ExpenseType } from "@/lib/card-store";

export const Route = createFileRoute("/_app/cartoes/$cardId/fatura/$invoiceId")({
  component: FaturaDetailPage,
});

function FaturaDetailPage() {
  const { cardId, invoiceId } = Route.useParams();
  const router = useRouter();
  const {
    cards, invoices, fetchCards, fetchInvoices, fetchExpenses, fetchInstallments,
    payInvoice, reverseInvoice, ensureInvoices,
    getInvoiceExpenses, getInvoiceInstallments,
  } = useCardStore();

  const [paying, setPaying]         = useState(false);
  const [reversing, setReversing]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [modalItem, setModalItem]   = useState<UnifiedItem | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [confirmReverse, setConfirmReverse]     = useState(false);
  const [blockedByInvoice, setBlockedByInvoice] = useState<typeof invoices[0] | null>(null);

  const card    = cards.find(c => c.id === cardId);
  const invoice = invoices.find(i => i.id === invoiceId);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (useCardStore.getState().cards.length === 0) await fetchCards();
        const c = useCardStore.getState().cards.find(c => c.id === cardId);
        if (!c) return;
        await ensureInvoices(c);
        await fetchInvoices(cardId);
        await fetchExpenses(invoiceId);
        await fetchInstallments(invoiceId);
      } finally { setLoading(false); }
    };
    init();
  }, [invoiceId, cardId]);

  const rawExpenses     = getInvoiceExpenses(invoiceId);
  const rawInstallments = getInvoiceInstallments(invoiceId);

  const allItems: UnifiedItem[] = [
    ...rawExpenses.map(e => ({
      id: e.id, description: e.description, category: e.category,
      amount: e.amount, purchase_date: e.purchase_date,
      expense_type: e.expense_type, isInstallment: false, invoiceId,
      cardId, installmentNumber: e.installment_number,
    })),
    ...rawInstallments.map(i => ({
      id: i.id, description: i.description, category: i.category,
      amount: i.amount, purchase_date: i.purchase_date,
      expense_type: "installment" as ExpenseType, isInstallment: true, invoiceId,
      parentExpenseId: i.parent_expense_id,
      installmentNumber: i.installment_number,
    })),
  ].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  const handlePay = () => {
    if (!card || !invoice) return;
    const openPrevious = invoices
      .filter(inv =>
        inv.card_id === cardId && inv.id !== invoiceId &&
        inv.status === "open" && inv.total_amount > 0 &&
        new Date(inv.due_date + "T12:00:00") < new Date(invoice.due_date + "T12:00:00")
      )
      .sort((a, b) =>
        new Date(a.due_date + "T12:00:00").getTime() - new Date(b.due_date + "T12:00:00").getTime()
      );
    if (openPrevious.length > 0) { setBlockedByInvoice(openPrevious[0]); return; }
    doPay();
  };

  const doPay = async () => {
    if (!card || !invoice) return;
    setPaying(true);
    try { await payInvoice(invoiceId, card); toast.success("Fatura marcada como paga!"); }
    catch { toast.error("Erro ao pagar fatura."); }
    finally { setPaying(false); }
  };

  const doReverse = async () => {
    setReversing(true);
    try { await reverseInvoice(invoiceId); toast.success("Fatura estornada."); }
    catch { toast.error("Erro ao estornar."); }
    finally { setReversing(false); }
  };

  const reloadData = async () => {
    await fetchExpenses(invoiceId);
    await fetchInstallments(invoiceId);
    await fetchInvoices(cardId);
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      <div className="text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm">Carregando fatura...</p>
      </div>
    </div>
  );

  if (!invoice || !card) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      Fatura não encontrada.
    </div>
  );

  const isPaid   = invoice.status === "paid";
  const isClosed = invoice.status === "closed";
  const isOpen   = invoice.status === "open";
  const invoiceStatus: InvoiceStatus = isPaid ? "paid" : isClosed ? "closed" : "open";

  const categoryTotals = allItems.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold">{card.name} · {invoice.competence}</h1>
          <p className="text-sm text-muted-foreground">
            {isPaid ? "Fatura paga" : isClosed ? "Fatura fechada" : "Fatura aberta"}
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Competência</p><p className="font-medium">{invoice.competence}</p></div>
          <div><p className="text-xs text-muted-foreground">Fechamento</p><p className="font-medium">{new Date(invoice.closing_date+"T12:00:00").toLocaleDateString("pt-BR")}</p></div>
          <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">{new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</p></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{fmt(invoice.total_amount)}</p></div>
        </div>
        {!isPaid && invoice.total_amount > 0 && (
          <Button className="mt-4 h-11 w-full gap-2 bg-green-600 font-semibold hover:bg-green-700" onClick={handlePay} disabled={paying}>
            <CheckCircle2 className="h-4 w-4" /> {paying ? "Processando..." : "Marcar como paga"}
          </Button>
        )}
        {isPaid && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 py-3 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Fatura paga · Transação registrada
            </div>
            <Button variant="outline" className="h-10 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => setConfirmReverse(true)} disabled={reversing}>
              <Undo2 className="h-4 w-4" /> {reversing ? "Estornando..." : "Estornar fatura"}
            </Button>
          </div>
        )}
      </div>

      {/* Por categoria */}
      {Object.keys(categoryTotals).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Por categoria</h2>
          <div className="space-y-2">
            {Object.entries(categoryTotals).sort(([,a],[,b]) => b-a).map(([cat, total]) => (
              <div key={cat} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <span className="text-sm">{cat}</span>
                <span className="text-sm font-semibold">{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lançamentos */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lançamentos ({allItems.length})</h2>
          {!isOpen && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {isPaid ? "Paga · somente leitura" : "Fechada · somente leitura"}
            </span>
          )}
        </div>
        {allItems.length === 0 ? (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nenhuma despesa nesta fatura.
          </div>
        ) : (
          <div className="space-y-2">
            {allItems.map(item => (
              <button key={item.id} type="button"
                onClick={() => { setModalItem(item); setModalOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left hover:bg-muted/40 transition-colors">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {TYPE_ICON[item.expense_type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.purchase_date+"T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", TYPE_CLASS[item.expense_type])}>
                      {TYPE_LABEL[item.expense_type]}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-sm font-semibold">{fmt(item.amount)}</p>
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-full",
                    isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {isOpen ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      <ExpenseDetailModal
        item={modalItem} invoiceStatus={invoiceStatus} open={modalOpen}
        onClose={() => { setModalOpen(false); setModalItem(null); }}
        onSaved={async () => { setModalOpen(false); setModalItem(null); await reloadData(); }}
        onDeleted={async () => { setModalOpen(false); setModalItem(null); await reloadData(); }}
      />

      <ConfirmDialog
        open={confirmReverse}
        title="Estornar fatura"
        description="A transação registrada será removida e o valor voltará ao saldo. Essa ação não pode ser desfeita."
        confirmLabel="Estornar"
        onConfirm={doReverse}
        onClose={() => setConfirmReverse(false)}
      />

      <ConfirmDialog
        open={!!blockedByInvoice}
        title="Fatura anterior em aberto"
        description={blockedByInvoice ? (
          <span>
            Não é possível pagar esta fatura pois a fatura de{" "}
            <strong className="text-foreground">{blockedByInvoice.competence}</strong>{" "}
            ainda está em aberto. Quite as faturas anteriores antes de continuar.
          </span>
        ) : ""}
        variant="warning"
        alertOnly
        onClose={() => setBlockedByInvoice(null)}
      />
    </div>
  );
}
