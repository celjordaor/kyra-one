import { useEffect, useState } from "react";
import { Lock, Save, Trash2, Eye, Pencil, ShoppingBag, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/cartoes/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabase";
import { useCategories } from "@/lib/categories-store";
import { type ExpenseType } from "@/lib/card-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Tipos exportados ───────────────────────────────────────────────────────
export type UnifiedItem = {
  id: string; description: string; category: string;
  amount: number; purchase_date: string; expense_type: ExpenseType;
  isInstallment: boolean; invoiceId: string;
  parentExpenseId?: string;
  installmentNumber?: number;
  cardId?: string;
};

export type InvoiceStatus = "open" | "closed" | "paid";

// ── Ícones e labels de tipo ────────────────────────────────────────────────
export const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  single:      <ShoppingBag className="h-3.5 w-3.5" />,
  installment: <Layers className="h-3.5 w-3.5" />,
  recurring:   <RotateCcw className="h-3.5 w-3.5" />,
};
export const TYPE_LABEL: Record<ExpenseType, string> = {
  single: "Única", installment: "Parcelada", recurring: "Recorrente",
};
export const TYPE_CLASS: Record<ExpenseType, string> = {
  single:      "bg-muted text-muted-foreground",
  installment: "bg-blue-100 text-blue-700",
  recurring:   "bg-purple-100 text-purple-700",
};

// ── Helpers ────────────────────────────────────────────────────────────────
export function formatCurrencyInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
export function parseCurrencyInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}
export const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Recalcular total da fatura ─────────────────────────────────────────────
export async function recalcTotal(invoiceId: string) {
  const { data: expData }  = await supabase.from("card_expenses").select("amount").eq("invoice_id", invoiceId);
  const { data: instData } = await supabase.from("card_installments").select("amount").eq("invoice_id", invoiceId);
  const total = (expData  ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
              + (instData ?? []).reduce((s, i) => s + (i.amount ?? 0), 0);
  await supabase.from("invoices").update({ total_amount: total }).eq("id", invoiceId);
}

// ── Modal de opções de exclusão (recorrente / parcelada) ───────────────────
function DeleteOptionsModal({
  open, item, onClose, onDeleteSingle, onDeleteFuture,
}: {
  open: boolean; item: UnifiedItem | null; onClose: () => void;
  onDeleteSingle: () => Promise<void>; onDeleteFuture: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<"single" | "future">("single");
  const [loading, setLoading]   = useState(false);

  useEffect(() => { if (open) setSelected("single"); }, [open]);
  if (!item) return null;

  const isRecurring = item.expense_type === "recurring";
  const options = [
    { key: "single" as const, title: "Deletar apenas essa despesa", description: "Remove somente este lançamento da fatura", danger: false },
    { key: "future" as const, title: "Deletar essa e futuras", description: isRecurring ? "Remove este e todos os lançamentos recorrentes futuros" : "Remove esta parcela e todas as seguintes", danger: true },
  ];

  async function handleConfirm() {
    setLoading(true);
    try { selected === "single" ? await onDeleteSingle() : await onDeleteFuture(); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="px-5 pt-5 pb-2">
          <DialogHeader><DialogTitle className="text-base">Excluir lançamento</DialogTitle></DialogHeader>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Escolha como deseja excluir <span className="font-medium text-foreground">"{item.description}"</span>:
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-3">
          {options.map(opt => {
            const isSel = selected === opt.key;
            return (
              <button key={opt.key} type="button" onClick={() => setSelected(opt.key)}
                className={cn("flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                  isSel ? (opt.danger ? "border-destructive/50 bg-destructive/5" : "border-primary/50 bg-primary/5") : "border-border hover:bg-muted/40"
                )}>
                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSel ? (opt.danger ? "border-destructive bg-destructive" : "border-primary bg-primary") : "border-muted-foreground/40"
                )}>
                  {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium leading-snug", isSel && opt.danger ? "text-destructive" : "text-foreground")}>{opt.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button size="sm" disabled={loading} onClick={handleConfirm}
            className={cn(selected === "future" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
            {loading ? "Excluindo..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ExpenseDetailModal (componente principal exportado) ────────────────────
export function ExpenseDetailModal({
  item, invoiceStatus, open, onClose, onSaved, onDeleted,
}: {
  item: UnifiedItem | null; invoiceStatus: InvoiceStatus;
  open: boolean; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const categories = useCategories().filter(c => c.active && c.type === "expense");
  const [description, setDescription]    = useState("");
  const [category, setCategory]          = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [date, setDate]                  = useState("");
  const [saving, setSaving]              = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [confirmSingle, setConfirmSingle]         = useState(false);

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
      await recalcTotal(item.invoiceId);
      toast.success("Lançamento atualizado!");
      onSaved();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  function handleDelete() {
    if (!item || !canEdit) return;
    if (item.expense_type === "recurring" || item.expense_type === "installment") {
      setShowDeleteOptions(true);
      return;
    }
    setConfirmSingle(true);
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
          const { data: rows } = await supabase.from("card_installments").select("invoice_id")
            .eq("parent_expense_id", item.parentExpenseId).gte("installment_number", item.installmentNumber);
          rows?.forEach(r => affectedIds.add(r.invoice_id));
          await supabase.from("card_installments").delete()
            .eq("parent_expense_id", item.parentExpenseId).gte("installment_number", item.installmentNumber);
        } else if (!item.isInstallment) {
          const { data: children } = await supabase.from("card_installments").select("invoice_id").eq("parent_expense_id", item.id);
          children?.forEach(r => affectedIds.add(r.invoice_id));
          await supabase.from("card_expenses").delete().eq("id", item.id);
          await supabase.from("card_installments").delete().eq("parent_expense_id", item.id);
        }
      } else if (item.expense_type === "recurring") {
        const { data: rows } = await supabase.from("card_expenses").select("invoice_id")
          .eq("description", item.description).eq("expense_type", "recurring").gte("purchase_date", item.purchase_date);
        rows?.forEach(r => affectedIds.add(r.invoice_id));
        await supabase.from("card_expenses").delete()
          .eq("description", item.description).eq("expense_type", "recurring").gte("purchase_date", item.purchase_date);
      }
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
    <>
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
              {canEdit ? <Input value={description} onChange={e => setDescription(e.target.value)} className="h-10" />
                : <p className="text-sm font-medium text-foreground">{item.description}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
              {canEdit ? (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {categories.map(cat => {
                    const isSel = category === cat.name;
                    const color = cat.color || "#6b7280";
                    const isEmoji = (cat.icon?.codePointAt(0) ?? 0) > 0x2000;
                    return (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.name)}
                        className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                          isSel ? "border-transparent shadow-sm" : "border-border hover:border-transparent hover:shadow-sm"
                        )}
                        style={isSel ? { background: color + "22", borderColor: color + "88", color } : {}}>
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                          style={{ background: color + "33" }}>
                          {isEmoji ? cat.icon : (cat.name[0] ?? "?").toUpperCase()}
                        </span>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-sm font-medium text-foreground">{item.category}</p>}
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
              {canEdit ? <DatePicker value={date} onChange={setDate} />
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

      <DeleteOptionsModal
        open={showDeleteOptions} item={item}
        onClose={() => setShowDeleteOptions(false)}
        onDeleteSingle={deleteSingle} onDeleteFuture={deleteFuture}
      />

      <ConfirmDialog
        open={confirmSingle}
        title="Excluir lançamento"
        description={`Deseja excluir "${item.description}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={deleteSingle}
        onClose={() => setConfirmSingle(false)}
      />
    </>
  );
}

// ── Botão de ação reutilizável (✏️ editar / 👁 visualizar) ─────────────────
export function ExpenseActionButton({
  item, invoiceStatus, onOpen,
}: {
  item: UnifiedItem; invoiceStatus: InvoiceStatus; onOpen: (item: UnifiedItem) => void;
}) {
  const isOpen = invoiceStatus === "open";
  return (
    <button type="button" onClick={() => onOpen(item)} title={isOpen ? "Editar lançamento" : "Ver detalhes"}
      className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
        isOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}>
      {isOpen ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}
