import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ChevronRight, Tag, FileText, Calendar,
  Trash2, Save, Lock, Search, X, ShoppingBag, RotateCcw, Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCategories } from "@/lib/categories-store";
import { DatePicker } from "@/components/cartoes/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/editar-despesa")({
  validateSearch: z.object({
    expenseId:     z.string(),
    isInstallment: z.boolean().default(false),
    invoiceId:     z.string(),
    cardId:        z.string(),
    invoiceStatus: z.enum(["open", "closed", "paid"]).default("open"),
  }),
  component: EditarDespesaPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtInput(digits: string): string {
  const n = digits.replace(/\D/g, "");
  if (!n) return "";
  return (parseInt(n, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}
function parseInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}
function isEmoji(s: string) { return (s?.codePointAt(0) ?? 0) > 0x2000; }

type ExpenseType = "single" | "installment" | "recurring";

const TYPE_ICON: Record<ExpenseType, React.ReactNode> = {
  single:      <ShoppingBag className="h-4 w-4" />,
  installment: <Layers      className="h-4 w-4" />,
  recurring:   <RotateCcw   className="h-4 w-4" />,
};
const TYPE_LABEL: Record<ExpenseType, string> = {
  single: "Despesa única", installment: "Despesa parcelada", recurring: "Despesa recorrente",
};
const TYPE_COLOR: Record<ExpenseType, string> = {
  single:      "#6b7280",
  installment: "#3b82f6",
  recurring:   "#8b5cf6",
};

// ── Bottom Sheet ───────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, maxHeight = "75vh", children }: {
  open: boolean; onClose: () => void; title: string;
  maxHeight?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[201] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden"
        style={{ maxHeight }}>
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-slate-100 dark:border-border">
          <h2 className="text-[18px] font-bold text-slate-800 dark:text-foreground">{title}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-muted">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </>
  );
}

// ── Modal escopo de edição/exclusão ────────────────────────────────────────
function ScopeSheet({ open, onClose, expenseType, action, onSingle, onFuture, loading }: {
  open: boolean; onClose: () => void;
  expenseType: ExpenseType; action: "edit" | "delete";
  onSingle: () => void; onFuture: () => void; loading: boolean;
}) {
  const isInstallment = expenseType === "installment";
  const verb = action === "edit" ? "Editar" : "Excluir";
  const singleLabel  = isInstallment ? "Apenas esta parcela"      : "Apenas esta ocorrência";
  const futureLabel  = isInstallment ? "Esta e as próximas parcelas" : "Esta e todas as futuras";
  const singleDesc   = isInstallment ? "Altera somente a parcela atual"    : "Altera somente este mês";
  const futureDesc   = isInstallment ? "Altera da parcela atual em diante" : "Altera este e todos os meses seguintes";

  return (
    <BottomSheet open={open} onClose={onClose}
      title={`${verb} — ${isInstallment ? "parcelada" : "recorrente"}`} maxHeight="50vh">
      <div className="px-4 pt-2 pb-8 space-y-3">
        {[
          { label: singleLabel, desc: singleDesc, action: onSingle, danger: action === "delete" },
          { label: futureLabel, desc: futureDesc,  action: onFuture, danger: true },
        ].map(opt => (
          <button key={opt.label} type="button" disabled={loading}
            onClick={opt.action}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-95",
              opt.danger
                ? "border-red-200 bg-red-50 hover:bg-red-100"
                : "border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
            )}>
            <div className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
              opt.danger ? "bg-red-400" : "bg-indigo-400")} />
            <div>
              <p className={cn("font-semibold text-sm", opt.danger ? "text-red-700" : "text-indigo-700")}>
                {opt.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

// ── Seção e FieldRow ── mesmo padrão de nova-despesa ──────────────────────
function TxSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingLeft:"1rem", paddingRight:"1rem", marginBottom:"0.75rem" }}>
      {title && <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-0.5">{title}</p>}
      <div className="w-full rounded-2xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function FieldRow({ icon, label, children, last = false, onClick, readonly = false }: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
  last?: boolean; onClick?: () => void; readonly?: boolean;
}) {
  const base = cn(
    "flex items-center gap-3 px-4 text-left w-full",
    !last && "border-b border-slate-100 dark:border-border",
    onClick && !readonly && "active:bg-slate-50"
  );
  const inner = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0 py-4 overflow-hidden">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        {children}
      </div>
      {onClick && !readonly && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </>
  );
  return onClick && !readonly
    ? <button type="button" onClick={onClick} className={base}>{inner}</button>
    : <div className={base}>{inner}</div>;
}

// ── Página principal ───────────────────────────────────────────────────────
function EditarDespesaPage() {
  const router = useRouter();
  const { expenseId, isInstallment, invoiceId, cardId, invoiceStatus } = Route.useSearch();

  const categories = useCategories().filter(c => c.active && c.type === "expense");
  // Fechada e aberta permitem edição; apenas "paid" é somente leitura
  const canEdit    = invoiceStatus !== "paid";

  // Dados do item
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [date,        setDate]        = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>("single");
  const [parentId,    setParentId]    = useState<string | null>(null);
  const [installNum,  setInstallNum]  = useState<number>(1);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // Modais
  const [openCat,    setOpenCat]    = useState(false);
  const [catSearch,  setCatSearch]  = useState("");
  const [openEdit,   setOpenEdit]   = useState(false);
  const [openDelete, setOpenDelete]     = useState(false);
  const [confirmSingle, setConfirmSingle] = useState(false);
  const [editPatch,  setEditPatch]  = useState<Record<string, unknown> | null>(null);

  // Carregar dados do Supabase
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const table = isInstallment ? "card_installments" : "card_expenses";
        const { data, error } = await supabase.from(table).select("*").eq("id", expenseId).single();
        if (error || !data) { toast.error("Despesa não encontrada."); router.history.back(); return; }
        setDescription(data.description ?? "");
        setCategory(data.category ?? "");
        setDate(data.purchase_date ?? "");
        setExpenseType((data.expense_type ?? (isInstallment ? "installment" : "single")) as ExpenseType);
        setParentId(data.parent_expense_id ?? null);
        setInstallNum(data.installment_number ?? 1);
        const abs = Math.abs(data.amount ?? 0);
        setAmountDisplay(abs.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
      } finally { setLoading(false); }
    })();
  }, [expenseId, isInstallment]);

  // ── Recalcular total da fatura ─────────────────────────────────────────
  async function recalcTotal(invId: string) {
    const { data: expData }  = await supabase.from("card_expenses").select("amount").eq("invoice_id", invId);
    const { data: instData } = await supabase.from("card_installments").select("amount").eq("invoice_id", invId);
    const total = [...(expData ?? []), ...(instData ?? [])].reduce((s, r) => s + (r.amount ?? 0), 0);
    await supabase.from("invoices").update({ total_amount: total }).eq("id", invId);
  }

  // ── Salvar ─────────────────────────────────────────────────────────────
  function handleSave() {
    if (!description.trim()) { toast.error("Informe a descrição"); return; }
    if (!category)            { toast.error("Selecione a categoria"); return; }
    const amount = parseInput(amountDisplay);
    if (amount <= 0)          { toast.error("Informe um valor válido"); return; }
    const patch = { description: description.trim(), category, amount, purchase_date: date };
    if (expenseType === "single") { doSaveSingle(patch); return; }
    setEditPatch(patch);
    setOpenEdit(true);
  }

  async function doSaveSingle(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const table = isInstallment ? "card_installments" : "card_expenses";
      const { error } = await supabase.from(table).update(patch).eq("id", expenseId);
      if (error) throw error;
      await recalcTotal(invoiceId);
      toast.success("Despesa atualizada!");
      router.history.back();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function doSaveFuture(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      if (expenseType === "installment" && parentId) {
        await supabase.from("card_installments")
          .update(patch)
          .eq("parent_expense_id", parentId)
          .gte("installment_number", installNum);
      } else if (expenseType === "recurring") {
        await supabase.from("card_expenses")
          .update(patch)
          .eq("description", description.trim()) // antes da mudança
          .eq("expense_type", "recurring")
          .gte("purchase_date", date);
      }
      await recalcTotal(invoiceId);
      toast.success("Despesas atualizadas!");
      setOpenEdit(false);
      router.history.back();
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  // ── Excluir ────────────────────────────────────────────────────────────
  function handleDelete() {
    if (expenseType === "single") { setConfirmSingle(true); return; }
    setOpenDelete(true);
  }

  async function doDeleteSingle() {
    setSaving(true);
    try {
      const table = isInstallment ? "card_installments" : "card_expenses";
      await supabase.from(table).delete().eq("id", expenseId);
      await recalcTotal(invoiceId);
      toast.success("Despesa excluída.");
      router.history.back();
    } catch { toast.error("Erro ao excluir."); }
    finally { setSaving(false); }
  }

  async function doDeleteFuture() {
    setSaving(true);
    try {
      if (expenseType === "installment" && parentId) {
        await supabase.from("card_installments")
          .delete()
          .eq("parent_expense_id", parentId)
          .gte("installment_number", installNum);
      } else if (expenseType === "recurring") {
        await supabase.from("card_expenses")
          .delete()
          .eq("description", description)
          .eq("expense_type", "recurring")
          .gte("purchase_date", date);
      }
      await recalcTotal(invoiceId);
      toast.success("Despesas excluídas.");
      setOpenDelete(false);
      router.history.back();
    } catch { toast.error("Erro ao excluir."); }
    finally { setSaving(false); }
  }

  const selectedCat = categories.find(c => c.name === category);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const typeColor = TYPE_COLOR[expenseType];

  return (
    <div style={{ width:"100vw", maxWidth:"100vw", overflowX:"hidden" }}
      className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* HEADER */}
      <div style={{ background: canEdit ? "#4f46e5" : "#64748b", paddingTop:"calc(env(safe-area-inset-top,0px) + 1rem)" }}
        className="text-white px-4 pb-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.history.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-[17px]">
            {invoiceStatus === "paid"
              ? "Detalhes da despesa"
              : invoiceStatus === "closed"
              ? "Editar despesa (fatura fechada)"
              : "Editar despesa"}
          </span>
          <div className="w-10" />
        </div>
      </div>

      {/* VALOR */}
      <div style={{ paddingLeft:"1rem", paddingRight:"1rem", marginTop:"-1rem", marginBottom:"1.25rem" }}>
        <div style={{ borderRadius:"1.5rem", background:"white", overflow:"hidden", boxShadow:"0 10px 25px rgba(0,0,0,.1)" }}>
          <div className="px-5 pt-5 pb-3">
            {/* Tipo da despesa */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-white"
                style={{ background: typeColor }}>
                {TYPE_ICON[expenseType]}
                {TYPE_LABEL[expenseType]}
              </div>
              {invoiceStatus === "paid" && (
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-500">
                  <Lock className="h-3 w-3" /> Fatura paga
                </div>
              )}
              {invoiceStatus === "closed" && (
                <div className="flex items-center gap-1 rounded-full bg-gray-800/20 px-3 py-1 text-[12px] font-semibold text-white/80">
                  🔒 Fatura fechada — edições permitidas
                </div>
              )}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: typeColor }}>
              VALOR DA DESPESA
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-400 shrink-0">R$</span>
              {canEdit ? (
                <input type="text" inputMode="numeric" value={amountDisplay}
                  onChange={e => { const f = fmtInput(e.target.value); setAmountDisplay(f); }}
                  className="min-w-0 flex-1 font-bold text-slate-800 bg-transparent outline-none placeholder-slate-200"
                  style={{ fontSize:"clamp(2rem,9vw,3rem)", lineHeight:1.2 }}
                  placeholder="0,00" />
              ) : (
                <span className="font-bold text-slate-800"
                  style={{ fontSize:"clamp(2rem,9vw,3rem)", lineHeight:1.2 }}>
                  {amountDisplay}
                </span>
              )}
            </div>
          </div>
          <div className="h-1" style={{ background: `linear-gradient(to right, ${typeColor}33, ${typeColor})` }} />
        </div>
      </div>

      {/* CAMPOS */}
      <div className="pb-4">
        <TxSection title="Informações">
          <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" readonly={!canEdit}>
            {canEdit ? (
              <input value={description} onChange={e => setDescription(e.target.value)}
                className="text-[16px] font-medium text-slate-800 bg-transparent outline-none w-full placeholder-slate-300"
                placeholder="Descrição da despesa" />
            ) : (
              <p className="text-[16px] font-medium text-slate-800">{description}</p>
            )}
          </FieldRow>

          <FieldRow
            icon={selectedCat
              ? <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
                  {isEmoji(selectedCat.icon || "") ? selectedCat.icon : <Tag className="h-5 w-5" />}
                </div>
              : <Tag className="h-5 w-5" />}
            label="Categoria"
            onClick={canEdit ? () => setOpenCat(true) : undefined}
            readonly={!canEdit}
            last>
            <p className={cn("text-[16px] font-medium", category ? "text-slate-800" : "text-slate-300")}>
              {category || "Selecione a categoria"}
            </p>
          </FieldRow>
        </TxSection>

        <TxSection title="Data">
          <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data da compra" last readonly={!canEdit}>
            {canEdit
              ? <DatePicker value={date} onChange={setDate} />
              : <p className="text-[16px] font-medium text-slate-800">
                  {date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "long" }) : "—"}
                </p>}
          </FieldRow>
        </TxSection>

        {/* Botões */}
        {canEdit && (
          <div style={{ paddingLeft:"1rem", paddingRight:"1rem", marginTop:"0.5rem" }} className="space-y-3">
            <button onClick={handleSave} disabled={saving}
              className="flex w-full h-[60px] items-center justify-center rounded-2xl text-white font-bold text-[17px] transition-all active:scale-95 disabled:opacity-70"
              style={{ background:"#4f46e5", boxShadow:"0 6px 20px #4f46e544" }}>
              <Save className="h-5 w-5 mr-2" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={handleDelete} disabled={saving}
              className="flex w-full h-12 items-center justify-center rounded-2xl font-semibold text-[15px] text-red-500 bg-red-50 border border-red-200 transition-all active:scale-95">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir despesa
            </button>
          </div>
        )}

        {!canEdit && (
          <div style={{ paddingLeft:"1rem", paddingRight:"1rem", marginTop:"0.5rem" }}>
            <button onClick={() => router.history.back()}
              className="flex w-full h-[60px] items-center justify-center rounded-2xl font-bold text-[17px] bg-slate-100 text-slate-600 transition-all active:scale-95">
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET: CATEGORIA */}
      <BottomSheet open={openCat} onClose={() => { setOpenCat(false); setCatSearch(""); }}
        title="Categoria" maxHeight="80vh">
        <div className="px-4 pt-3 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar categoria..." value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              className="h-11 w-full rounded-2xl bg-slate-100 pl-11 pr-4 text-base outline-none placeholder-slate-400" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 pb-8">
          {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
            const isSel  = category === cat.name;
            const color  = cat.color || "#6b7280";
            return (
              <button key={cat.name} type="button"
                onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95"
                style={isSel ? { background: color+"18", borderColor: color+"66" } : { borderColor:"transparent", background:"#f8fafc" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: color+"22" }}>
                  {cat.icon || "📦"}
                </div>
                <span className="text-[13px] font-semibold text-slate-700 leading-tight">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* BOTTOM SHEET: ESCOPO EDIÇÃO */}
      <ScopeSheet
        open={openEdit} onClose={() => setOpenEdit(false)}
        expenseType={expenseType} action="edit"
        onSingle={() => { setOpenEdit(false); if (editPatch) doSaveSingle(editPatch); }}
        onFuture={() => { if (editPatch) doSaveFuture(editPatch); }}
        loading={saving}
      />

      {/* BOTTOM SHEET: ESCOPO EXCLUSÃO */}
      <ScopeSheet
        open={openDelete} onClose={() => setOpenDelete(false)}
        expenseType={expenseType} action="delete"
        onSingle={() => { setOpenDelete(false); doDeleteSingle(); }}
        onFuture={doDeleteFuture}
        loading={saving}
      />

      {/* CONFIRM: EXCLUSÃO AVULSA */}
      <ConfirmDialog
        open={confirmSingle}
        title="Excluir despesa"
        description={`Deseja excluir "${description}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={() => { setConfirmSingle(false); doDeleteSingle(); }}
        onClose={() => setConfirmSingle(false)}
      />
    </div>
  );
}
