import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ShoppingBag, RotateCcw, Layers, Undo2,
  Eye, Pencil, Trash2, Lock, X, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCardStore, type CardExpense, type CardInstallment, type ExpenseType } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes/$cardId_fatura/$invoiceId")({
  component: FaturaDetailPage,
});

const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  single: <ShoppingBag className="h-3.5 w-3.5" />,
  installment: <Layers className="h-3.5 w-3.5" />,
  recurring: <RotateCcw className="h-3.5 w-3.5" />,
};
const TYPE_LABEL: Record<ExpenseType, string> = { single: "Única", installment: "Parcelada", recurring: "Recorrente" };
const TYPE_CLASS: Record<ExpenseType, string> = {
  single: "bg-muted text-muted-foreground",
  installment: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  recurring: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type UnifiedItem = {
  id: string; description: string; category: string;
  amount: number; purchase_date: string; expense_type: ExpenseType;
  isInstallment: boolean; invoiceId: string;
};

function groupByCategory(items: UnifiedItem[]) {
  return items.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc;
  }, {});
}

function formatCurrencyInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrencyInput(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

// ── Modal de detalhe / edição ──────────────────────────────────────────
function ExpenseDetailModal({
  item, invoiceStatus, open, onClose, onSaved, onDeleted,
}: {
  item: UnifiedItem | null;
  invoiceStatus: "open" | "closed" | "paid";
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { updateExpense, updateInstallment, deleteExpense, deleteInstallment } = useCardStore();
  const categories = useCategories().filter(c => c.active && c.type === "expense");

  const [description, setDescription] = useState("");
  const [category, setCategory]       = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [date, setDate]               = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isReadOnly = invoiceStatus !== "open";
  const canEdit    = invoiceStatus === "open";

  useEffect(() => {
    if (!item) return;
    setDescription(item.description);
    setCategory(item.category);
    setDate(item.purchase_date);
    const abs = Math.abs(item.amount);
    setAmountValue(abs.toFixed(2));
    setAmountDisplay(abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [item]);

  function handleAmountChange(raw: string) {
    const formatted = formatCurrencyInput(raw);
    setAmountDisplay(formatted);
    setAmountValue(parseCurrencyInput(formatted).toFixed(2));
  }

  async function handleSave() {
    if (!item || !canEdit) return;
    if (!description.trim()) { toast.error("Informe a descrição"); return; }
    if (!category) { toast.error("Selecione a categoria"); return; }
    const amount = parseCurrencyInput(amountDisplay);
    if (amount <= 0) { toast.error("Informe um valor válido"); return; }

    setSaving(true);
    try {
      const patch = { description: description.trim(), category, amount, purchase_date: date };
      if (item.isInstallment) {
        await updateInstallment(item.id, item.invoiceId, patch);
      } else {
        await updateExpense(item.id, patch);
      }
      toast.success("Lançamento atualizado!");
      onSaved();
    } catch { toast.error("Erro ao salvar lançamento."); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!item || !canEdit) return;
    try {
      if (item.isInstallment) {
        await deleteInstallment(item.id, item.invoiceId);
      } else {
        await deleteExpense(item.id);
      }
      toast.success("Lançamento excluído.");
      onDeleted();
    } catch { toast.error("Erro ao excluir lançamento."); }
    setConfirmDelete(false);
  }

  if (!item) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="max-w-sm overflow-hidden p-0">
          {/* Header */}
          <div className={cn("px-5 pt-5 pb-4", isReadOnly ? "bg-muted/50" : "bg-primary/5")}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isReadOnly && <Lock className="h-4 w-4 text-muted-foreground" />}
                {canEdit ? "Editar lançamento" : "Detalhes do lançamento"}
              </DialogTitle>
            </DialogHeader>
            {isReadOnly && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {invoiceStatus === "paid" ? "Fatura paga — edição não permitida" : "Fatura fechada — edição não permitida"}
              </p>
            )}
            {/* Badge de tipo */}
            <div className="mt-2">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 w-fit", TYPE_CLASS[item.expense_type])}>
                {TYPE_ICON[item.expense_type]}
                {TYPE_LABEL[item.expense_type]}
              </span>
            </div>
          </div>

          <div className="space-y-4 px-5 py-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</Label>
              {canEdit ? (
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição" className="h-10" />
              ) : (
                <p className="text-sm font-medium text-foreground">{item.description}</p>
              )}
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
              {canEdit ? (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.name)}
                      className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        category === cat.name ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      )}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">{item.category}</p>
              )}
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</Label>
              {canEdit ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input type="text" inputMode="decimal" className="h-10 pl-9"
                    value={amountDisplay} onChange={e => handleAmountChange(e.target.value)} />
                </div>
              ) : (
                <p className="text-sm font-semibold text-red-500">-{fmt(item.amount)}</p>
              )}
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data da compra</Label>
              {canEdit ? (
                <Input type="date" className="h-10" value={date} onChange={e => setDate(e.target.value)} />
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {new Date(item.purchase_date + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "long" })}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-5 py-4">
            {canEdit ? (
              <>
                <Button variant="ghost" size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "<strong>{item.description}</strong>" será removido desta fatura e o total será recalculado.
              {item.expense_type === "installment" && " Esta parcela específica será excluída."}
              {item.expense_type === "recurring" && " Somente este mês recorrente será excluído."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Página principal ───────────────────────────────────────────────────
function FaturaDetailPage() {
  const { cardId, invoiceId } = Route.useParams();
  const router = useRouter();
  const {
    cards, invoices, fetchInvoices, fetchExpenses, fetchInstallments,
    payInvoice, reverseInvoice, ensureInvoices,
    getInvoiceExpenses, getInvoiceInstallments,
  } = useCardStore();

  const [paying, setPaying]       = useState(false);
  const [reversing, setReversing] = useState(false);
  const [modalItem, setModalItem] = useState<UnifiedItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const card    = cards.find(c => c.id === cardId);
  const invoice = invoices.find(i => i.id === invoiceId);

  useEffect(() => {
    const init = async () => {
      if (!card) return;
      await ensureInvoices(card);
      await fetchInvoices(cardId);
      await fetchExpenses(invoiceId);
      await fetchInstallments(invoiceId);
    };
    init();
  }, [invoiceId, cardId]);

  const invoiceExpenses    = getInvoiceExpenses(invoiceId);
  const invoiceInstallments = getInvoiceInstallments(invoiceId);

  const allItems: UnifiedItem[] = [
    ...invoiceExpenses.map(e => ({
      id: e.id, description: e.description, category: e.category,
      amount: e.amount, purchase_date: e.purchase_date,
      expense_type: e.expense_type, isInstallment: false, invoiceId,
    })),
    ...invoiceInstallments.map(i => ({
      id: i.id, description: i.description, category: i.category,
      amount: i.amount, purchase_date: i.purchase_date,
      expense_type: "installment" as ExpenseType, isInstallment: true, invoiceId,
    })),
  ].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  const handlePay = async () => {
    if (!card || !invoice) return;
    setPaying(true);
    try { await payInvoice(invoiceId, card); toast.success("Fatura marcada como paga!"); }
    catch { toast.error("Erro ao pagar fatura."); }
    finally { setPaying(false); }
  };

  const handleReverse = async () => {
    if (!confirm("Estornar esta fatura? A transação será removida e o valor voltará ao saldo.")) return;
    setReversing(true);
    try { await reverseInvoice(invoiceId); toast.success("Fatura estornada."); }
    catch { toast.error("Erro ao estornar fatura."); }
    finally { setReversing(false); }
  };

  const openModal = (item: UnifiedItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const reloadExpenses = async () => {
    await fetchExpenses(invoiceId);
    await fetchInstallments(invoiceId);
  };

  if (!invoice || !card) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Fatura não encontrada.</div>
  );

  const isPaid      = invoice.status === "paid";
  const isClosed    = invoice.status === "closed";
  const isOpen      = invoice.status === "open";
  const invoiceStatus = isPaid ? "paid" : isClosed ? "closed" : "open";
  const categoryTotals = groupByCategory(allItems);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{card.name} · {invoice.competence}</h1>
          <p className="text-sm text-muted-foreground">
            {isPaid ? "Fatura paga" : isClosed ? "Fatura fechada" : "Fatura aberta"}
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Competência</p><p className="font-medium">{invoice.competence}</p></div>
          <div><p className="text-xs text-muted-foreground">Fechamento</p><p className="font-medium">{new Date(invoice.closing_date+"T12:00:00").toLocaleDateString("pt-BR")}</p></div>
          <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">{new Date(invoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</p></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{fmt(invoice.total_amount)}</p></div>
        </div>
        {!isPaid && invoice.total_amount > 0 && (
          <Button className="mt-4 h-11 w-full gap-2 bg-green-600 font-semibold hover:bg-green-700" onClick={handlePay} disabled={paying}>
            <CheckCircle2 className="h-4 w-4" />
            {paying ? "Processando..." : "Marcar como paga"}
          </Button>
        )}
        {isPaid && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 py-3 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Fatura paga · Transação registrada
            </div>
            <Button variant="outline"
              className="h-10 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={handleReverse} disabled={reversing}>
              <Undo2 className="h-4 w-4" />
              {reversing ? "Estornando..." : "Estornar fatura"}
            </Button>
          </div>
        )}
      </div>

      {/* Totais por categoria */}
      {Object.keys(categoryTotals).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Por categoria</h2>
          <div className="space-y-2">
            {Object.entries(categoryTotals).sort(([,a],[,b])=>b-a).map(([cat,total])=>(
              <div key={cat} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <span className="text-sm text-foreground">{cat}</span>
                <span className="text-sm font-semibold text-foreground">{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lançamentos */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Lançamentos ({allItems.length})</h2>
          {(isPaid || isClosed) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {isPaid ? "Fatura paga" : "Fatura fechada"}
            </div>
          )}
        </div>

        {allItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhuma despesa nesta fatura.
          </div>
        ) : (
          <div className="space-y-2">
            {allItems.map(item => (
              <div key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/30">
                {/* Ícone de tipo */}
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {TYPE_ICON[item.expense_type]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
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

                {/* Valor */}
                <p className="shrink-0 text-sm font-semibold text-foreground">{fmt(item.amount)}</p>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-1">
                  {isOpen ? (
                    <>
                      {/* Editar */}
                      <button onClick={() => openModal(item)} title="Editar lançamento"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    /* Visualizar (somente leitura) */
                    <button onClick={() => openModal(item)} title="Ver detalhes"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalhe/edição */}
      <ExpenseDetailModal
        item={modalItem}
        invoiceStatus={invoiceStatus}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalItem(null); }}
        onSaved={async () => { setModalOpen(false); setModalItem(null); await reloadExpenses(); }}
        onDeleted={async () => { setModalOpen(false); setModalItem(null); await reloadExpenses(); }}
      />
    </div>
  );
}
