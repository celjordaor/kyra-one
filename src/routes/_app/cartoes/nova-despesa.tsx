import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, ChevronRight, CheckCircle2, Search,
  CreditCard, Tag, Calendar, FileText, Receipt, Repeat, StickyNote, X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCardStore, type Invoice } from "@/lib/card-store";
import { toast } from "sonner";
import { parseISO, isAfter, startOfDay } from "date-fns";
import { DatePicker } from "@/components/cartoes/date-picker";
import { InstallmentPicker } from "@/components/cartoes/installment-picker";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";

function isEmoji(s: string) { return (s?.codePointAt(0) ?? 0) > 0x2000; }

export const Route = createFileRoute("/_app/cartoes/nova-despesa")({
  validateSearch: z.object({ cardId: z.string().optional() }),
  component: NovaDespesaPage,
});

const schema = z.object({
  card_id:       z.string().min(1, "Selecione o cartão"),
  category:      z.string().min(1, "Selecione a categoria"),
  description:   z.string().min(1, "Informe a descrição"),
  amount_raw:    z.string().min(1, "Informe o valor"),
  purchase_date: z.string().min(1, "Informe a data"),
  installments:  z.number().int().min(1).max(48),
  is_recurring:  z.boolean().default(false),
  invoice_id:    z.string().min(1, "Selecione a fatura"),
  observations:  z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function fmtInput(digits: string): string {
  const n = digits.replace(/\D/g, "");
  if (!n) return "";
  return (parseInt(n, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}
function parseInput(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}
function toSortKey(c: string) { const [mm, yyyy] = c.split("/"); return `${yyyy}-${mm}`; }
function sortedOpen(invs: Invoice[], cardId: string) {
  return [...invs.filter(i => i.card_id === cardId && i.status === "open")]
    .sort((a, b) => toSortKey(a.competence).localeCompare(toSortKey(b.competence)));
}
function defaultInvoice(invs: Invoice[], cardId: string, date: string): Invoice | null {
  const pDate = date ? startOfDay(parseISO(date)) : startOfDay(new Date());
  const open  = sortedOpen(invs, cardId);
  for (const inv of open) {
    if (!isAfter(pDate, startOfDay(parseISO(inv.closing_date)))) return inv;
  }
  return open[0] ?? null;
}

// ── Bottom Sheet ─────────────────────────────────────────────────────────
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

// ── Seção ─────────────────────────────────────────────────────────────────
const S: React.CSSProperties = {
  display: "block",
  marginLeft: "1rem",
  marginRight: "1rem",
  marginBottom: "0.75rem",
  borderRadius: "1rem",
  background: "white",
  border: "1px solid #f1f5f9",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
};

function TxSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "block" }}>
      {title && (
        <p style={{ display:"block", fontSize:"0.6875rem", fontWeight:700,
          textTransform:"uppercase", letterSpacing:"0.1em", color:"#94a3b8",
          marginLeft:"1rem", marginBottom:"0.375rem" }}>
          {title}
        </p>
      )}
      <div style={S}>{children}</div>
    </div>
  );
}

function FieldRow({ icon, label, children, last = false, onClick, error }: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
  last?: boolean; onClick?: () => void; error?: string;
}) {
  const inner = (
    <>
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
        width:"2.5rem", height:"2.5rem", borderRadius:"0.75rem",
        background:"#f1f5f9", color:"#64748b" }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0, paddingTop:"1rem", paddingBottom:"1rem", overflow:"hidden" }}>
        <p style={{ fontSize:"0.6875rem", fontWeight:700, textTransform:"uppercase",
          letterSpacing:"0.06em", color:"#94a3b8", marginBottom:"0.25rem" }}>{label}</p>
        {children}
        {error && <p style={{ fontSize:"0.75rem", color:"#ef4444", marginTop:"0.25rem" }}>{error}</p>}
      </div>
      {onClick && <ChevronRight style={{ flexShrink:0, width:"1.25rem", height:"1.25rem", color:"#cbd5e1" }} />}
    </>
  );
  const baseStyle: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:"0.75rem",
    paddingLeft:"1rem", paddingRight:"1rem", width:"100%",
    borderBottom: last ? "none" : "1px solid #f1f5f9",
    background:"transparent", cursor: onClick ? "pointer" : "default",
    textAlign:"left",
  };
  return onClick
    ? <button type="button" onClick={onClick} style={baseStyle}>{inner}</button>
    : <div style={baseStyle}>{inner}</div>;
}

// ── Página ─────────────────────────────────────────────────────────────────
function NovaDespesaPage() {
  const router = useRouter();
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const allCats    = useCategories();
  const categories = allCats.filter(c => c.active && c.type === "expense");

  const [displayValue, setDisplayValue]       = useState("");
  const [openCard, setOpenCard]               = useState(false);
  const [openCat, setOpenCat]                 = useState(false);
  const [openBilling, setOpenBilling]         = useState(false);
  const [catSearch, setCatSearch]             = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const { register, handleSubmit, setValue, watch, control,
    formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      card_id: "", category: "", description: "", amount_raw: "",
      purchase_date: new Date().toISOString().split("T")[0],
      installments: 1, is_recurring: false, invoice_id: "", observations: "",
    },
  });

  const selectedCardId  = watch("card_id");
  const purchaseDate    = watch("purchase_date");
  const installments    = watch("installments");
  const isRecurring     = watch("is_recurring");
  const selectedCatName = watch("category");
  const selectedInvId   = watch("invoice_id");

  const selectedCard    = cards.find(c => c.id === selectedCardId);
  const selectedCat     = categories.find(c => c.name === selectedCatName);
  const cardInvoices    = sortedOpen(invoices, selectedCardId).slice(0, 6);
  const selectedInvoice = cardInvoices.find(i => i.id === selectedInvId);
  const parsedAmount    = parseInput(displayValue);

  useEffect(() => { if (cards.length === 0) fetchCards(); }, []);
  useEffect(() => {
    if (!cards.length) return;
    if (!watch("card_id")) {
      const def = cards.find(c => c.is_default && c.active) ?? cards.find(c => c.active);
      if (def) setValue("card_id", def.id);
    }
  }, [cards]);
  useEffect(() => {
    if (!selectedCardId) return;
    const c = cards.find(c => c.id === selectedCardId);
    if (!c) return;
    setLoadingInvoices(true);
    Promise.all([ensureInvoices(c), fetchInvoices(selectedCardId)]).finally(() => setLoadingInvoices(false));
  }, [selectedCardId]);
  useEffect(() => {
    if (!selectedCardId || !purchaseDate) return;
    const def = defaultInvoice(invoices, selectedCardId, purchaseDate);
    if (def) setValue("invoice_id", def.id, { shouldValidate: true });
  }, [selectedCardId, purchaseDate, invoices.length]);

  const onSubmit = async (data: FormData) => {
    if (!selectedCard) return;
    try {
      await addExpense({ card: selectedCard, invoiceId: data.invoice_id, category: data.category,
        description: data.description, amount: parseInput(data.amount_raw),
        purchaseDate: data.purchase_date, installments: data.installments,
        isRecurring: data.is_recurring, observations: data.observations });
      toast.success("Despesa lançada!");
      router.navigate({ to: "/cartoes/$cardId", params: { cardId: selectedCard.id } });
    } catch { toast.error("Erro ao lançar despesa."); }
  };

  return (
    <div style={{ display:"block", background:"#f8fafc" }}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ display:"block" }}>

        {/* HEADER */}
        <div style={{ display:"block", background:"#4f46e5", color:"white",
          paddingLeft:"1rem", paddingRight:"1rem", paddingBottom:"2rem",
          paddingTop:"calc(env(safe-area-inset-top,0px) + 1rem)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button type="button" onClick={() => router.history.back()}
              style={{ display:"flex", alignItems:"center", justifyContent:"center",
                width:"2.5rem", height:"2.5rem", flexShrink:0,
                borderRadius:"9999px", background:"rgba(255,255,255,0.2)", border:"none",
                color:"white", cursor:"pointer" }}>
              <ArrowLeft style={{ width:"1.25rem", height:"1.25rem" }} />
            </button>
            <span style={{ fontWeight:700, fontSize:"1.0625rem" }}>Nova despesa cartão</span>
            <div style={{ width:"2.5rem" }} />
          </div>
        </div>

        {/* VALOR — margem explícita, sem wrapper extra */}
        <div style={{ display:"block", marginLeft:"1rem", marginRight:"1rem",
          marginTop:"-1rem", marginBottom:"1.25rem",
          borderRadius:"1.5rem", background:"white", overflow:"hidden",
          boxShadow:"0 10px 25px rgba(0,0,0,0.1)" }}>
          <div style={{ padding:"1.25rem 1.25rem 0.75rem" }}>
            <p style={{ fontSize:"0.6875rem", fontWeight:700, textTransform:"uppercase",
              letterSpacing:"0.1em", color:"#818cf8", marginBottom:"0.5rem" }}>
              VALOR DA DESPESA
            </p>
            <div style={{ display:"flex", alignItems:"baseline", gap:"0.5rem" }}>
              <span style={{ fontSize:"1.5rem", fontWeight:700, color:"#94a3b8", flexShrink:0 }}>R$</span>
              <input type="text" inputMode="numeric" value={displayValue}
                onChange={e => { const f = fmtInput(e.target.value); setDisplayValue(f); setValue("amount_raw", f, { shouldValidate: true }); }}
                style={{ flex:1, minWidth:0, fontWeight:700, color:"#1e293b", background:"transparent",
                  outline:"none", border:"none", fontSize:"clamp(2rem,9vw,3rem)", lineHeight:1.2 }}
                placeholder="0,00" />
            </div>
            {errors.amount_raw && <p style={{ fontSize:"0.75rem", color:"#ef4444", marginTop:"0.5rem" }}>{errors.amount_raw.message}</p>}
          </div>
          <div style={{ height:"4px", background:"linear-gradient(to right,#4f46e533,#4f46e5)" }} />
        </div>

        {/* SEÇÕES */}
        <div style={{ display:"block", paddingBottom:"1rem" }}>

          <TxSection title="Informações">
            <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" error={errors.description?.message}>
              <input {...register("description")}
                style={{ fontSize:"1rem", fontWeight:500, color:"#1e293b",
                  background:"transparent", outline:"none", border:"none", width:"100%" }}
                placeholder="Ex: Netflix, Supermercado..." autoComplete="off" />
            </FieldRow>
            <FieldRow icon={<CreditCard className="h-5 w-5" />} label="Cartão" onClick={() => setOpenCard(true)} error={errors.card_id?.message}>
              {selectedCard
                ? <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginTop:"0.125rem" }}>
                    <span style={{ fontSize:"0.6875rem", fontWeight:700, color:"#4f46e5",
                      border:"1px solid #a5b4fc", borderRadius:"0.375rem",
                      padding:"0.125rem 0.375rem" }}>{selectedCard.flag}</span>
                    <span style={{ fontSize:"1rem", fontWeight:500, color:"#1e293b" }}>{selectedCard.name}</span>
                  </div>
                : <p style={{ fontSize:"1rem", color:"#cbd5e1" }}>Selecione o cartão</p>}
            </FieldRow>
            <FieldRow
              icon={selectedCat
                ? <div style={{ width:"2.5rem", height:"2.5rem", borderRadius:"0.75rem",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.25rem",
                    background:(selectedCat.color||"#6b7280")+"22" }}>
                    {isEmoji(selectedCat.icon||"") ? selectedCat.icon : <Tag className="h-5 w-5" />}
                  </div>
                : <Tag className="h-5 w-5" />}
              label="Categoria" onClick={() => setOpenCat(true)} last error={errors.category?.message}>
              <p style={{ fontSize:"1rem", fontWeight:500,
                color: selectedCatName ? "#1e293b" : "#cbd5e1" }}>
                {selectedCatName || "Selecione a categoria"}
              </p>
            </FieldRow>
          </TxSection>

          <TxSection title="Data e fatura">
            <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data da compra">
              <DatePicker value={purchaseDate} onChange={v => setValue("purchase_date", v)} />
            </FieldRow>
            <FieldRow icon={<Receipt className="h-5 w-5" />} label="Fatura destino" onClick={() => setOpenBilling(true)} last error={errors.invoice_id?.message}>
              {loadingInvoices
                ? <p style={{ fontSize:"1rem", color:"#cbd5e1" }}>Carregando...</p>
                : selectedInvoice
                ? <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                    <span style={{ fontSize:"1rem", fontWeight:600, color:"#1e293b" }}>{selectedInvoice.competence}</span>
                    <span style={{ fontSize:"0.8125rem", color:"#94a3b8" }}>• vence {new Date(selectedInvoice.due_date+"T12:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                : <p style={{ fontSize:"1rem", color:"#cbd5e1" }}>Selecione a fatura</p>}
            </FieldRow>
          </TxSection>

          {!isRecurring && parsedAmount > 0 && (
            <TxSection title="Parcelamento">
              <div style={{ padding:"1rem", borderBottom:"1px solid #f1f5f9" }}>
                <p style={{ fontSize:"0.6875rem", fontWeight:700, textTransform:"uppercase",
                  letterSpacing:"0.06em", color:"#94a3b8", marginBottom:"0.75rem" }}>
                  Número de parcelas
                </p>
                <InstallmentPicker amount={parsedAmount} value={installments} onChange={n => setValue("installments", n)} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"1rem" }}>
                <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                  width:"2.5rem", height:"2.5rem", borderRadius:"0.75rem",
                  background:"#f1f5f9", color:"#64748b" }}>
                  <Repeat className="h-5 w-5" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:"1rem", fontWeight:500, color:"#1e293b" }}>Despesa recorrente</p>
                  <p style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:"0.125rem" }}>Lançada nas próximas 12 faturas</p>
                </div>
                <Controller name="is_recurring" control={control} render={({ field }) => (
                  <Switch checked={!!field.value} onCheckedChange={v => { field.onChange(v); if (v) setValue("installments", 1); }} />
                )} />
              </div>
            </TxSection>
          )}

          <TxSection title="Observações">
            <FieldRow icon={<StickyNote className="h-5 w-5" />} label="Nota (opcional)" last>
              <input {...register("observations")}
                style={{ fontSize:"1rem", fontWeight:500, color:"#1e293b",
                  background:"transparent", outline:"none", border:"none", width:"100%" }}
                placeholder="Alguma nota sobre esta despesa" />
            </FieldRow>
          </TxSection>

          {/* BOTÃO */}
          <div style={{ display:"block", marginLeft:"1rem", marginRight:"1rem", marginTop:"0.5rem" }}>
            <button type="submit" disabled={isSubmitting}
              style={{ display:"block", width:"100%", height:"3.75rem", fontSize:"1.0625rem",
                fontWeight:700, color:"white", background:"#4f46e5", border:"none",
                borderRadius:"1rem", cursor:"pointer", opacity: isSubmitting ? 0.7 : 1,
                boxShadow:"0 6px 20px rgba(79,70,229,0.4)" }}>
              {isSubmitting ? "Salvando..." : "✓  Lançar despesa"}
            </button>
          </div>
        </div>
      </form>

      {/* CARTÃO */}
      <BottomSheet open={openCard} onClose={() => setOpenCard(false)} title="Cartão" maxHeight="65vh">
        <div className="px-4 pt-3 pb-6 space-y-2">
          {cards.filter(c => c.active).map(card => {
            const isSel = selectedCardId === card.id;
            return (
              <button key={card.id} type="button"
                onClick={() => { setValue("card_id", card.id, { shouldValidate: true }); setOpenCard(false); }}
                className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left active:scale-95",
                  isSel ? "border-indigo-400 bg-indigo-50" : "border-transparent bg-slate-50")}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100">
                  <span className="text-base font-bold text-indigo-600">{card.flag?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-slate-800">{card.name}</p>
                  <p className="text-[13px] text-slate-400">{card.bank} · {card.flag}</p>
                </div>
                {isSel && <CheckCircle2 className="h-6 w-6 shrink-0 text-indigo-500" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* CATEGORIA */}
      <BottomSheet open={openCat} onClose={() => { setOpenCat(false); setCatSearch(""); }} title="Categoria" maxHeight="80vh">
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
            const isSel = selectedCatName === cat.name;
            const color = cat.color || "#6b7280";
            return (
              <button key={cat.name} type="button"
                onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95"
                style={isSel ? { background:color+"18", borderColor:color+"66" } : { borderColor:"transparent", background:"#f8fafc" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background:color+"22" }}>
                  {cat.icon || "📦"}
                </div>
                <span className="text-[13px] font-semibold text-slate-700 leading-tight text-center">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* FATURA */}
      <BottomSheet open={openBilling} onClose={() => setOpenBilling(false)} title="Fatura destino" maxHeight="65vh">
        <div className="px-4 pt-3 pb-6 space-y-2">
          {cardInvoices.map(inv => {
            const isSel = selectedInvId === inv.id;
            const dueLabel = new Date(inv.due_date+"T12:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
            return (
              <button key={inv.id} type="button"
                onClick={() => { setValue("invoice_id", inv.id, { shouldValidate: true }); setOpenBilling(false); }}
                className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left active:scale-95",
                  isSel ? "border-indigo-400 bg-indigo-50" : "border-transparent bg-slate-50")}>
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50">
                  <span className="text-[10px] font-bold uppercase text-indigo-400">{inv.competence.split("/")[0].slice(0,3)}</span>
                  <span className="text-sm font-bold text-indigo-700">/{inv.competence.split("/")[1].slice(2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-slate-800">{inv.competence}</p>
                  <p className="text-[13px] text-slate-400">Vence {dueLabel}</p>
                </div>
                {isSel && <CheckCircle2 className="h-6 w-6 shrink-0 text-indigo-500" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
