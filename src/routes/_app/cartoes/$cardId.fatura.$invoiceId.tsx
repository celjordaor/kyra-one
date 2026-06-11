import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ShoppingBag, RotateCcw, Layers, Undo2,
  Eye, Pencil, Lock, Save, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCardStore, type ExpenseType } from "@/lib/card-store";
import { DatePicker } from "@/components/cartoes/date-picker";
import { useCategories } from "@/lib/categories-store";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/cartoes/$cardId/fatura/$invoiceId")({
  component: FaturaDetailPage,
});

const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  single:      <ShoppingBag className="h-3.5 w-3.5" />,
  installment: <Layers className="h-3.5 w-3.5" />,
  recurring:   <RotateCcw className="h-3.5 w-3.5" />,
};
const TYPE_LABEL: Record<ExpenseType, string> = {
  single: "Única", installment: "Parcelada", recurring: "Recorrente",
};
const TYPE_CLASS: Record<ExpenseType, string> = {
  single:      "bg-muted text-muted-foreground",
  installment: "bg-blue-100 text-blue-700",
  recurring:   "bg-purple-100 text-purple-700",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type UnifiedItem = {
  id: string; description: string; category: string;
  amount: number; purchase_date: string; expense_type: ExpenseType;
  isInstallment: boolean; invoiceId: string;
  parentExpenseId?: string;   // para parceladas
  installmentNumber?: number; // para parceladas
  cardId?: string;            // para recorrentes (filtrar por cartão)
};

function formatCurrencyInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function parseCurrencyInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

// ── Modal de opções de exclusão (recorrente / parcelada) ──────────────────
function DeleteOptionsModal({
  open, item, onClose, onDeleteSingle, onDeleteFuture,
}: {
  open: boolean;
  item: UnifiedItem | null;
  onClose: () => void;
  onDeleteSingle: () => Promise<void>;
  onDeleteFuture: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<"single" | "future">("single");
  const [loading, setLoading] = useState(false);

  // Resetar seleção ao abrir
  useEffect(() => { if (open) setSelected("single"); }, [open]);

  if (!item) return null;
  const isRecurring = item.expense_type === "recurring";

  async function handleConfirm() {
    setLoading(true);
    try {
      if (selected === "single") await onDeleteSingle();
      else await onDeleteFuture();
    } finally { setLoading(false); }
  }

  const options: { key: "single" | "future"; title: string; description: string; danger: boolean }[] = [
    {
      key: "single",
      title: "Deletar apenas essa despesa",
      description: "Remove somente este lançamento da fatura",
      danger: false,
    },
    {
      key: "future",
      title: "Deletar essa e futuras",
      description: isRecurring
        ? "Remove este e todos os lançamentos recorrentes futuros"
        : "Remove esta parcela e todas as seguintes",
      danger: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="px-5 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle className="text-base">Excluir lançamento</DialogTitle>
          </DialogHeader>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Escolha como deseja excluir{" "}
            <span className="font-medium text-foreground">"{item.description}"</span>:
          </p>
        </div>

        <div className="flex flex-col gap-2 px-5 py-3">
          {options.map(opt => {
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelected(opt.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  isSelected
                    ? opt.danger
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}
              >
                {/* Radio circle */}
                <div className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? opt.danger ? "border-destructive bg-destructive" : "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-medium leading-snug",
                    isSelected && opt.danger ? "text-destructive" : "text-foreground"
                  )}>
                    {opt.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              selected === "future"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            )}
          >
            {loading ? "Excluindo..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function ExpenseDetailModal({
  item, invoiceStatus, open, onClose, onSaved, onDeleted,
}: {
  item: UnifiedItem | null;
  invoiceStatus: "open" | "closed" | "paid";
  open: boolean; onClose: () => void;
  onSaved: () => void; onDeleted: () => void;
}) {
  const categories = useCategories().filter(c => c.active && c.type === "expense");
  const [description, setDescription]    = useState("");
  const [category, setCategory]          = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [date, setDate]                  = useState("");
  const [saving, setSaving]              = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const canEdit = invoiceStatus === "open";

  useEffect(() => {
    if (!item) return;
    setDescription(item.description);
    setCategory(item.category);
    setDate(item.purchase_date);
    const abs = Math.abs(item.amount);
    setAmountDisplay(abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [item]);

  async function handleSave() {
    if (!item || !canEdit) return;
    if (!description.trim()) { toast.error("Informe a descrição"); return; }
    if (!category) { toast.error("Selecione a categoria"); return; }
    const amount = parseCurrencyInput(amountDisplay);
    if (amount <= 0) { toast.error("Informe um valor válido"); return; }
    setSaving(true);
    try {
      const patch = { description: description.trim(), category, amount, purchase_date: date };
      const table = item.isInstallment ? "card_installments" : "card_expenses";
      const { error } = await supabase.from(table).update(patch).eq("id", item.id);
      if (error) throw error;
      const { data: expData } = await supabase.from("card_expenses").select("amount").eq("invoice_id", item.invoiceId);
      const { data: instData } = await supabase.from("card_installments").select("amount").eq("invoice_id", item.invoiceId);
      const total = (expData ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
                  + (instData ?? []).reduce((s, i) => s + (i.amount ?? 0), 0);
      await supabase.from("invoices").update({ total_amount: total }).eq("id", item.invoiceId);
      toast.success("Lançamento atualizado!");
      onSaved();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  // Recalcula o total de uma fatura
  async function recalcTotal(invoiceId: string) {
    const { data: expData } = await supabase.from("card_expenses").select("amount").eq("invoice_id", invoiceId);
    const { data: instData } = await supabase.from("card_installments").select("amount").eq("invoice_id", invoiceId);
    const total = (expData ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
                + (instData ?? []).reduce((s, i) => s + (i.amount ?? 0), 0);
    await supabase.from("invoices").update({ total_amount: total }).eq("id", invoiceId);
  }

  function handleDelete() {
    if (!item || !canEdit) return;
    // Recorrente ou parcelada: mostrar modal de opções
    if (item.expense_type === "recurring" || item.expense_type === "installment") {
      setShowDeleteOptions(true);
      return;
    }
    // Despesa única: confirmar e deletar
    if (!confirm(`Excluir "${item.description}"?`)) return;
    deleteSingle();
  }

  async function deleteSingle() {
    if (!item) return;
    try {
      const table = item.isInstallment ? "card_installments" : "card_expenses";
      await supabase.from(table).delete().eq("id", item.id);
      await recalcTotal(item.invoiceId);
      toast.success("Lançamento excluído.");
      setShowDeleteOptions(false);
      onDeleted();
    } catch { toast.error("Erro ao excluir."); }
  }

  async function deleteFuture() {
    if (!item) return;
    try {
      const affectedIds = new Set<string>([item.invoiceId]);

      if (item.expense_type === "installment") {
        if (item.isInstallment && item.parentExpenseId && item.installmentNumber !== undefined) {
          // Buscar invoices afetados ANTES de deletar
          const { data: rows } = await supabase
            .from("card_installments")
            .select("invoice_id")
            .eq("parent_expense_id", item.parentExpenseId)
            .gte("installment_number", item.installmentNumber);
          rows?.forEach(r => affectedIds.add(r.invoice_id));

          // Deletar parcelas seguintes
          await supabase
            .from("card_installments")
            .delete()
            .eq("parent_expense_id", item.parentExpenseId)
            .gte("installment_number", item.installmentNumber);

        } else if (!item.isInstallment) {
          // Buscar todos os filhos ANTES de deletar
          const { data: children } = await supabase
            .from("card_installments")
            .select("invoice_id")
            .eq("parent_expense_id", item.id);
          children?.forEach(r => affectedIds.add(r.invoice_id));

          // Deletar pai + todos os filhos
          await supabase.from("card_expenses").delete().eq("id", item.id);
          await supabase.from("card_installments").delete().eq("parent_expense_id", item.id);
        }

      } else if (item.expense_type === "recurring") {
        // Buscar invoices afetados ANTES de deletar
        const { data: rows } = await supabase
          .from("card_expenses")
          .select("invoice_id")
          .eq("description", item.description)
          .eq("expense_type", "recurring")
          .gte("purchase_date", item.purchase_date);
        rows?.forEach(r => affectedIds.add(r.invoice_id));

        // Deletar recorrentes futuras
        await supabase
          .from("card_expenses")
          .delete()
          .eq("description", item.description)
          .eq("expense_type", "recurring")
          .gte("purchase_date", item.purchase_date);
      }

      // Recalcular TODOS os invoices afetados em paralelo
      await Promise.all([...affectedIds].map(id => recalcTotal(id)));

      toast.success("Lançamentos excluídos.");
      setShowDeleteOptions(false);
      onDeleted();
    } catch (e) {
      console.error("deleteFuture error:", e);
      toast.error("Erro ao excluir.");
    }
  }

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <div className={cn("px-5 pt-5 pb-4", !canEdit ? "bg-muted/60" : "bg-primary/5")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {!canEdit && <Lock className="h-4 w-4 text-muted-foreground" />}
              {canEdit ? "Editar lançamento" : "Detalhes do lançamento"}
            </DialogTitle>
          </DialogHeader>
          {!canEdit && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {invoiceStatus === "paid" ? "🔒 Fatura paga — edição não permitida" : "🔒 Fatura fechada — edição não permitida"}
            </p>
          )}
          <div className="mt-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", TYPE_CLASS[item.expense_type])}>
              {TYPE_ICON[item.expense_type]} {TYPE_LABEL[item.expense_type]}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</Label>
            {canEdit
              ? <Input value={description} onChange={e => setDescription(e.target.value)} className="h-10" />
              : <p className="text-sm font-medium text-foreground">{item.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
            {canEdit ? (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pb-0.5">
                {categories.map(cat => {
                  const isSelected = category === cat.name;
                  const color = cat.color || "#6b7280";
                  const isEmoji = (cat.icon?.codePointAt(0) ?? 0) > 0x2000;
                  return (
                    <button key={cat.id} type="button" onClick={() => setCategory(cat.name)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                        isSelected ? "border-transparent shadow-sm" : "border-border hover:border-transparent hover:shadow-sm"
                      )}
                      style={isSelected
                        ? { background: color + "22", borderColor: color + "88", color }
                        : {}
                      }>
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                        style={{ background: color + "33" }}>
                        {isEmoji ? cat.icon : (cat.name[0] ?? "?").toUpperCase()}
                      </span>
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">{item.category}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</Label>
            {canEdit ? (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input type="text" inputMode="decimal" className="h-10 pl-9"
                  value={amountDisplay} onChange={e => setAmountDisplay(formatCurrencyInput(e.target.value))} />
              </div>
            ) : <p className="text-sm font-semibold text-red-500">-{fmt(item.amount)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data da compra</Label>
            {canEdit
              ? <DatePicker value={date} onChange={setDate} />
              : <p className="text-sm font-medium text-foreground">
                  {new Date(item.purchase_date + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "long" })}
                </p>}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-5 py-4">
          {canEdit ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleDelete}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>

              <DeleteOptionsModal
                open={showDeleteOptions}
                item={item}
                onClose={() => setShowDeleteOptions(false)}
                onDeleteSingle={deleteSingle}
                onDeleteFuture={deleteFuture}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FaturaDetailPage() {
  const { cardId, invoiceId } = Route.useParams();
  const router = useRouter();
  const {
    cards, invoices, fetchCards, fetchInvoices, fetchExpenses, fetchInstallments,
    payInvoice, reverseInvoice, ensureInvoices,
    getInvoiceExpenses, getInvoiceInstallments,
  } = useCardStore();

  const [paying, setPaying]       = useState(false);
  const [reversing, setReversing] = useState(false);
  const [modalItem, setModalItem] = useState<UnifiedItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "cats">("items");

  const card    = cards.find(c => c.id === cardId);
  const invoice = invoices.find(i => i.id === invoiceId);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Garante que os cartões estão carregados
        if (useCardStore.getState().cards.length === 0) await fetchCards();
        const c = useCardStore.getState().cards.find(c => c.id === cardId);
        if (!c) return;
        await ensureInvoices(c);
        await fetchInvoices(cardId);
        await fetchExpenses(invoiceId);
        await fetchInstallments(invoiceId);
      } finally {
        setLoading(false);
      }
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
      cardId,
      installmentNumber: e.installment_number, // para parceladas (installment_number=1 é o pai)
    })),
    ...rawInstallments.map(i => ({
      id: i.id, description: i.description, category: i.category,
      amount: i.amount, purchase_date: i.purchase_date,
      expense_type: "installment" as ExpenseType, isInstallment: true, invoiceId,
      parentExpenseId: i.parent_expense_id,
      installmentNumber: i.installment_number,
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
    if (!confirm("Estornar esta fatura? A transação será removida.")) return;
    setReversing(true);
    try { await reverseInvoice(invoiceId); toast.success("Fatura estornada."); }
    catch { toast.error("Erro ao estornar."); }
    finally { setReversing(false); }
  };

  const reloadData = async () => {
    // Recarrega detalhes da fatura atual
    await fetchExpenses(invoiceId);
    await fetchInstallments(invoiceId);
    // Recarrega TODAS as faturas do cartão (atualiza totais nos cards)
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
  const invoiceStatus: "open" | "closed" | "paid" = isPaid ? "paid" : isClosed ? "closed" : "open";

  const categoryTotals = allItems.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc;
  }, {});

  // Cor do header por status
  const headerGradient = isPaid
    ? "from-emerald-500 to-teal-600"
    : isClosed
    ? "from-slate-500 to-slate-700"
    : "from-emerald-400 to-emerald-600";

  const statusLabel = isPaid ? "Paga" : isClosed ? "Fechada" : "Em aberto";
  const statusDot   = isPaid ? "bg-emerald-200" : isClosed ? "bg-slate-300" : "bg-amber-300";

  const catEntries = Object.entries(categoryTotals).sort(([,a],[,b]) => b - a);
  const totalForPct = catEntries.reduce((s, [,v]) => s + v, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* ── HEADER VERDE ─────────────────────────────────────────────── */}
      <div className={cn("bg-gradient-to-br px-5 pt-5 pb-12 text-white", headerGradient)}>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/60">{card.name} · {card.flag ?? ""}</p>
            <p className="text-lg font-bold">Fatura {invoice.competence}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 shrink-0">
            <span className={cn("h-2 w-2 rounded-full", statusDot)} />
            <span className="text-xs font-bold">{statusLabel}</span>
          </div>
        </div>

        {/* Total + datas */}
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-white/60 text-xs mb-1">Total da fatura</p>
          <p className="text-4xl font-bold mb-3">{fmt(invoice.total_amount)}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Competência", value: invoice.competence },
              { label: "Fechamento",  value: new Date(invoice.closing_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) },
              { label: "Vencimento",  value: new Date(invoice.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[10px] text-white/50 mb-0.5">{label}</p>
                <p className="text-xs font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Ações ────────────────────────────────────────────────────── */}
      <div className="px-4 -mt-5 mb-4 space-y-2">
        {isOpen && invoice.total_amount > 0 && (
          <button onClick={handlePay} disabled={paying}
            className="flex w-full h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70"
            style={{ boxShadow: "0 8px 20px #10b98144" }}>
            <CheckCircle2 className="h-4 w-4" />
            {paying ? "Processando..." : "Marcar como paga"}
          </button>
        )}
        {isPaid && (
          <>
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Fatura paga · Transação registrada
            </div>
            <button onClick={handleReverse} disabled={reversing}
              className="flex w-full h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white dark:bg-card text-red-500 font-medium text-sm transition-all hover:bg-red-50 active:scale-95 disabled:opacity-70">
              <Undo2 className="h-4 w-4" /> {reversing ? "Estornando..." : "Estornar fatura"}
            </button>
          </>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <div className="flex rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border shadow-sm p-1 gap-1">
          {([["items", `Lançamentos (${allItems.length})`], ["cats", "Por categoria"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                activeTab === key
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 dark:text-muted-foreground hover:text-slate-700"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lançamentos ──────────────────────────────────────────────── */}
      {activeTab === "items" && (
        <div className="px-4 pb-8">
          {allItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-10 text-center text-sm text-slate-400">
              Nenhuma despesa nesta fatura.
            </div>
          ) : (
            <div className="space-y-2">
              {allItems.map(item => {
                const installLabel = item.installmentNumber !== undefined
                  ? ` · ${item.installmentNumber}ª parcela`
                  : "";
                return (
                  <button key={item.id} type="button"
                    onClick={() => { setModalItem(item); setModalOpen(true); }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border px-4 py-3.5 text-left shadow-sm hover:shadow-md transition-shadow">
                    {/* Ícone tipo */}
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm",
                      item.expense_type === "installment" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600" :
                      item.expense_type === "recurring"   ? "bg-purple-50 dark:bg-purple-950/30 text-purple-600" :
                      "bg-slate-100 dark:bg-muted text-slate-500"
                    )}>
                      {TYPE_ICON[item.expense_type]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-slate-800 dark:text-foreground truncate">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={cn(
                          "text-[10px] font-semibold rounded-full px-2 py-0.5",
                          item.expense_type === "installment" ? "bg-blue-50 text-blue-600" :
                          item.expense_type === "recurring"   ? "bg-purple-50 text-purple-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {TYPE_LABEL[item.expense_type]}{installLabel}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-muted-foreground">{item.category}</span>
                        <span className="text-[11px] text-slate-300 dark:text-muted-foreground/40">·</span>
                        <span className="text-[11px] text-slate-400 dark:text-muted-foreground">
                          {new Date(item.purchase_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-[14px] font-bold text-slate-800 dark:text-foreground">{fmt(item.amount)}</p>
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        isOpen ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" : "bg-muted text-muted-foreground"
                      )}>
                        {isOpen ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Por categoria ─────────────────────────────────────────────── */}
      {activeTab === "cats" && (
        <div className="px-4 pb-8 space-y-2">
          {catEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-border py-10 text-center text-sm text-slate-400">
              Nenhuma categoria registrada.
            </div>
          ) : catEntries.map(([cat, total], idx) => {
            const pct = totalForPct > 0 ? (total / totalForPct) * 100 : 0;
            const colors = ["#10b981","#3b82f6","#8b5cf6","#f97316","#ef4444","#6b7280","#14b8a6","#f59e0b"];
            const color  = colors[idx % colors.length];
            return (
              <div key={cat} className="rounded-2xl bg-white dark:bg-card border border-slate-100 dark:border-border px-4 py-3.5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}/>
                    <span className="text-[14px] font-medium text-slate-800 dark:text-foreground">{cat}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-slate-800 dark:text-foreground">{fmt(total)}</p>
                    <p className="text-[11px] text-slate-400 dark:text-muted-foreground">{pct.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExpenseDetailModal
        item={modalItem} invoiceStatus={invoiceStatus} open={modalOpen}
        onClose={() => { setModalOpen(false); setModalItem(null); }}
        onSaved={async () => { setModalOpen(false); setModalItem(null); await reloadData(); }}
        onDeleted={async () => { setModalOpen(false); setModalItem(null); await reloadData(); }}
      />
    </div>
  );
}
