import { useEffect, useState } from "react";
import { Lock, Save, Trash2, Eye, Pencil, ShoppingBag, RotateCcw, Layers, X, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/cartoes/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScopeBottomSheet, type ScopeType } from "@/components/scope-bottom-sheet";
import { useCategories } from "@/lib/categories-store";
import {
  useCardStore, type ExpenseType,
  deleteExpenseWithScope, updateExpenseWithScope, type SeriesExpenseRef,
} from "@/lib/card-store";
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
// FIX: delega para a implementação única e canônica em card-store.ts
export async function recalcTotal(invoiceId: string) {
  await useCardStore.getState().recalcInvoiceTotal(invoiceId);
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

  function toRef(it: UnifiedItem): SeriesExpenseRef {
    return {
      id: it.id,
      description: it.description,       // original (prop), não o texto editado no form
      expenseType: it.expense_type,
      purchaseDate: it.purchase_date,     // original
      invoiceId: it.invoiceId,
      isInstallmentRow: it.isInstallment,
      parentExpenseId: it.parentExpenseId,
      installmentNumber: it.installmentNumber,
    };
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
      const scope = editScope === "bulk" && isSeries ? "bulk" : "single";
      await updateExpenseWithScope(toRef(item), patch, scope);
      toast.success("Lançamento atualizado!");
      onSaved();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  function handleDelete() {
    if (!item || !canEdit) return;
    // Para recorrentes/parceladas: usa o escopo já selecionado no ScopeBottomSheet
    if (isSeries && editScope === "bulk") {
      deleteFuture();
      return;
    }
    setConfirmSingle(true);
  }

  async function deleteSingle() {
    if (!item) return;
    try {
      await deleteExpenseWithScope(toRef(item), "single");
      toast.success("Lançamento excluído.");
      onDeleted();
    } catch { toast.error("Erro ao excluir."); }
  }

  async function deleteFuture() {
    if (!item) return;
    try {
      await deleteExpenseWithScope(toRef(item), "bulk");
      toast.success("Lançamentos excluídos.");
      onDeleted();
    } catch (e) {
      console.error("deleteFuture error:", e);
      toast.error("Erro ao excluir.");
    }
  }

  const [openCat, setOpenCat]   = useState(false);
  const [catSearch, setCatSearch] = useState("");
  // Escopo de edição: mostrado PRIMEIRO para recorrentes/parceladas (antes do formulário)
  const [editScope, setEditScope] = useState<ScopeType | null>(null);

  const isSeries = item
    ? item.expense_type === "recurring" || item.expense_type === "installment"
    : false;

  // Resetar escopo ao abrir/fechar
  useEffect(() => {
    if (!open) setEditScope(null);
  }, [open]);

  if (!item) return null;

  // Para recorrentes/parceladas editáveis: mostrar ScopeBottomSheet primeiro
  if (open && isSeries && canEdit && !editScope) {
    return (
      <ScopeBottomSheet
        open={true}
        onClose={onClose}
        onSelect={setEditScope}
        expenseType={item.expense_type === "installment" ? "installment" : "recurring"}
        title={item.description}
      />
    );
  }

  const selectedCat = categories.find(c => c.name === category);
  const isEmoji = (icon?: string) => (icon?.codePointAt(0) ?? 0) > 0x2000;

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-[100] bg-black/50" onClick={onClose} />}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[101] flex flex-col md:inset-0 md:items-center md:justify-center">
          <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
            style={{ maxHeight: "92dvh" }}>

            {/* ── Cabeçalho gradiente indigo ── */}
            <div className={cn(
              "relative overflow-hidden px-5 pt-5 pb-5 text-white shrink-0",
              canEdit
                ? "bg-gradient-to-br from-indigo-600 to-violet-700"
                : "bg-gradient-to-br from-slate-500 to-slate-700"
            )}>
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide leading-none">
                      {canEdit ? "Editar lançamento" : "Detalhes do lançamento"}
                    </p>
                    <span className={cn(
                      "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-white/20 text-white"
                    )}>
                      {TYPE_ICON[item.expense_type]} {TYPE_LABEL[item.expense_type]}
                    </span>
                  </div>
                  <button onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>

                {/* Valor em destaque */}
                <div>
                  <p className="text-xs text-white/60 mb-1">Valor</p>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-white/70">R$</span>
                      <input
                        type="text" inputMode="decimal"
                        value={amountDisplay}
                        onChange={e => setAmountDisplay(formatCurrencyInput(e.target.value))}
                        placeholder="0,00"
                        className="bg-transparent text-4xl font-black text-white placeholder-white/40 outline-none w-full tracking-tight"
                      />
                    </div>
                  ) : (
                    <p className="text-4xl font-black tracking-tight">-{fmt(item.amount)}</p>
                  )}
                </div>

                {!canEdit && (
                  <p className="mt-2 text-xs text-white/60">
                    {invoiceStatus === "paid" ? "🔒 Fatura paga — somente leitura" : "🔒 Fatura fechada — somente leitura"}
                  </p>
                )}
              </div>
            </div>

            {/* ── Campos ── */}
            <div className="overflow-y-auto flex-1">
              <div className="px-4 py-4 space-y-3">

                {/* Descrição */}
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Descrição</p>
                  {canEdit ? (
                    <input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Nome da despesa"
                      className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"
                    />
                  ) : (
                    <p className="text-[16px] font-semibold text-foreground">{item.description}</p>
                  )}
                </div>

                {/* Categoria — campo fechado que abre BottomSheet */}
                {canEdit ? (
                  <button type="button" onClick={() => setOpenCat(true)}
                    className="w-full rounded-2xl border bg-card px-4 py-3.5 text-left flex items-center gap-3 transition-colors hover:bg-muted/30">
                    {selectedCat ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
                        {isEmoji(selectedCat.icon) ? selectedCat.icon : "📦"}
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <span className="text-xs">📦</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
                      <p className={cn("text-[16px] font-semibold mt-0.5", category ? "text-foreground" : "text-muted-foreground/50")}>
                        {category || "Selecione a categoria"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>
                  </button>
                ) : (
                  <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
                    <p className="text-[16px] font-semibold text-foreground">{item.category}</p>
                  </div>
                )}

                {/* Data */}
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Data da compra</p>
                  {canEdit ? (
                    <DatePicker value={date} onChange={setDate}/>
                  ) : (
                    <p className="text-[16px] font-semibold text-foreground">
                      {new Date(item.purchase_date + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "long" })}
                    </p>
                  )}
                </div>

                {canEdit && <div className="h-20 md:hidden"/>}
              </div>
            </div>

            {/* ── Botões mobile fixos ── */}
            {canEdit && (
              <div className="md:hidden fixed left-0 right-0 z-10 px-4 pt-3 pb-[env(safe-area-inset-bottom,12px)] bg-background/97 border-t border-border/40"
                style={{ bottom: "0px", backdropFilter: "blur(8px)" }}>
                <button onClick={handleSave} disabled={saving}
                  className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70">
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button onClick={handleDelete}
                  className="w-full mt-2 h-11 rounded-xl text-red-500 font-semibold text-sm flex items-center justify-center gap-2">
                  <Trash2 className="h-4 w-4"/> Excluir lançamento
                </button>
              </div>
            )}
            {!canEdit && (
              <div className="md:hidden fixed left-0 right-0 z-10 px-4 pt-3 pb-[env(safe-area-inset-bottom,12px)] bg-background/97 border-t"
                style={{ bottom: "0px" }}>
                <button onClick={onClose}
                  className="w-full h-12 rounded-xl bg-muted text-foreground font-semibold text-sm">
                  Fechar
                </button>
              </div>
            )}

            {/* ── Botões desktop inline ── */}
            <div className={cn("hidden md:flex items-center border-t px-5 py-3 shrink-0",
              canEdit ? "justify-between" : "justify-end"
            )}>
              {canEdit && (
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 text-sm text-red-500 font-medium hover:text-red-600">
                  <Trash2 className="h-4 w-4"/> Excluir
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-4 h-9 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50">
                  {canEdit ? "Cancelar" : "Fechar"}
                </button>
                {canEdit && (
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 h-9 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5"/> {saving ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BottomSheet: Categoria ── */}
      {openCat && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={() => { setOpenCat(false); setCatSearch(""); }}/>
          <div className="fixed bottom-0 left-0 right-0 z-[201] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden"
            style={{ maxHeight:"80vh" }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/>
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-slate-100 dark:border-border">
              <h2 className="text-[18px] font-bold text-slate-800 dark:text-foreground">Categoria</h2>
              <button onClick={() => { setOpenCat(false); setCatSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-muted">
                <X className="h-4 w-4 text-slate-500"/>
              </button>
            </div>
            <div className="px-4 pt-3 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input type="text" placeholder="Buscar categoria..." value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-slate-100 dark:bg-muted pl-11 pr-4 text-base outline-none placeholder-slate-400"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-3 gap-3 px-4 pb-8">
                {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
                  const isSel  = category === cat.name;
                  const color  = cat.color || "#6b7280";
                  const emoji  = isEmoji(cat.icon);
                  return (
                    <button key={cat.name} type="button"
                      onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                      style={isSel ? { background: color+"18", borderColor: color+"66" } : { borderColor:"transparent", background:"#f8fafc" }}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                        style={{ background: color+"22" }}>
                        {emoji ? cat.icon : "📦"}
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-foreground leading-tight">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

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
