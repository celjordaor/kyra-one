import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, ChevronRight, CheckCircle2, Search,
  CreditCard, Tag, Calendar, FileText, Receipt, Repeat, StickyNote,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCardStore, type Invoice } from "@/lib/card-store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
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

// ── Componentes ────────────────────────────────────────────────────────────
function TxSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-4">
      {title && <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">{title}</p>}
      <div className="rounded-2xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  icon, label, children, last = false, onClick, error,
}: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
  last?: boolean; onClick?: () => void; error?: string;
}) {
  const cls = cn("flex items-center gap-4 px-5 w-full text-left",
    !last && "border-b border-slate-100 dark:border-border",
    onClick && "active:bg-slate-50 dark:active:bg-muted/30");
  const inner = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-muted text-slate-500">{icon}</div>
      <div className="flex-1 min-w-0 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        {children}
        {error && <p className="text-[12px] text-destructive mt-1">{error}</p>}
      </div>
      {onClick && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}

// ── Página ─────────────────────────────────────────────────────────────────
function NovaDespesaPage() {
  const router = useRouter();
  const { cardId: preselectedCardId } = Route.useSearch();
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const allCats    = useCategories();
  const categories = allCats.filter(c => c.active && c.type === "expense");

  const [displayValue, setDisplayValue]       = useState("");
  const [openCard, setOpenCard]               = useState(false);
  const [openCat, setOpenCat]                 = useState(false);
  const [openBilling, setOpenBilling]         = useState(false);
  const [catSearch, setCatSearch]             = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const { register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { card_id: "", category: "", description: "", amount_raw: "",
        purchase_date: new Date().toISOString().split("T")[0],
        installments: 1, is_recurring: false, invoice_id: "", observations: "" },
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

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = fmtInput(e.target.value);
    setDisplayValue(f);
    setValue("amount_raw", f, { shouldValidate: true });
  }

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
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">

        {/* ── HEADER SLIM ─────────────────────────────────────────────── */}
        <div className="bg-indigo-600 text-white px-4 pb-8"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => router.history.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 active:bg-white/30">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-bold text-[17px]">Nova despesa cartão</span>
            <div className="w-10" />
          </div>
        </div>

        {/* ── VALOR — card flutuante ─────────────────────────────────── */}
        <div className="mx-4 -mt-5 mb-5 rounded-3xl bg-white dark:bg-card shadow-xl border border-indigo-100 dark:border-border overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 mb-2">VALOR DA DESPESA</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-400">R$</span>
              <input type="text" inputMode="numeric" value={displayValue} onChange={handleAmountChange}
                className="flex-1 font-bold text-slate-800 dark:text-foreground bg-transparent outline-none placeholder-slate-200"
                style={{ fontSize: "clamp(2.5rem, 10vw, 3.5rem)", lineHeight: 1.1 }}
                placeholder="0,00" />
            </div>
            {errors.amount_raw && <p className="text-[12px] text-destructive mt-2">{errors.amount_raw.message}</p>}
          </div>
          <div className="h-1.5" style={{ background: "linear-gradient(to right, #4f46e533, #4f46e5)" }} />
        </div>

        <div className="pb-4">
          {/* ── INFORMAÇÕES ──────────────────────────────────────────── */}
          <TxSection title="Informações">
            <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" error={errors.description?.message}>
              <input {...register("description")}
                className="text-[17px] font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-300"
                placeholder="Ex: Netflix, Supermercado..." autoComplete="off" />
            </FieldRow>
            <FieldRow icon={<CreditCard className="h-5 w-5" />} label="Cartão"
              onClick={() => setOpenCard(true)} error={errors.card_id?.message}>
              {selectedCard ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-indigo-600 border border-indigo-300 rounded-md px-1.5 py-0.5">{selectedCard.flag}</span>
                  <span className="text-[17px] font-medium text-slate-800 dark:text-foreground">{selectedCard.name}</span>
                </div>
              ) : <p className="text-[17px] text-slate-300">Selecione o cartão</p>}
            </FieldRow>
            <FieldRow
              icon={selectedCat
                ? <div className="h-11 w-11 rounded-2xl flex items-center justify-center text-2xl" style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
                    {isEmoji(selectedCat.icon || "") ? selectedCat.icon : <Tag className="h-5 w-5" />}
                  </div>
                : <Tag className="h-5 w-5" />}
              label="Categoria" onClick={() => setOpenCat(true)} last error={errors.category?.message}>
              <p className={cn("text-[17px] font-medium", selectedCatName ? "text-slate-800 dark:text-foreground" : "text-slate-300")}>
                {selectedCatName || "Selecione a categoria"}
              </p>
            </FieldRow>
          </TxSection>

          {/* ── DATA E FATURA ─────────────────────────────────────────── */}
          <TxSection title="Data e fatura">
            <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data da compra">
              <DatePicker value={purchaseDate} onChange={v => setValue("purchase_date", v)} />
            </FieldRow>
            <FieldRow icon={<Receipt className="h-5 w-5" />} label="Fatura destino"
              onClick={() => setOpenBilling(true)} last error={errors.invoice_id?.message}>
              {loadingInvoices
                ? <p className="text-[17px] text-slate-300">Carregando...</p>
                : selectedInvoice
                ? <div className="flex items-center gap-2">
                    <span className="text-[17px] font-semibold text-slate-800 dark:text-foreground">{selectedInvoice.competence}</span>
                    <span className="text-[13px] text-slate-400">• vence {new Date(selectedInvoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                : <p className="text-[17px] text-slate-300">Selecione a fatura</p>}
            </FieldRow>
          </TxSection>

          {/* ── PARCELAMENTO ─────────────────────────────────────────── */}
          {!isRecurring && parsedAmount > 0 && (
            <TxSection title="Parcelamento">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-border">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Número de parcelas</p>
                <InstallmentPicker amount={parsedAmount} value={installments}
                  onChange={n => setValue("installments", n)} />
              </div>
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-muted text-slate-500">
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[17px] font-medium text-slate-800 dark:text-foreground">Despesa recorrente</p>
                  <p className="text-[13px] text-slate-400 mt-0.5">Lançada nas próximas 12 faturas</p>
                </div>
                <Controller name="is_recurring" control={control} render={({ field }) => (
                  <Switch checked={!!field.value}
                    onCheckedChange={v => { field.onChange(v); if (v) setValue("installments", 1); }} />
                )} />
              </div>
            </TxSection>
          )}

          {/* ── OBSERVAÇÕES ──────────────────────────────────────────── */}
          <TxSection title="Observações">
            <FieldRow icon={<StickyNote className="h-5 w-5" />} label="Nota (opcional)" last>
              <input {...register("observations")}
                className="text-[17px] font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-300"
                placeholder="Alguma nota sobre esta despesa" />
            </FieldRow>
          </TxSection>

          {/* ── BOTÃO ─────────────────────────────────────────────────── */}
          <div className="mx-4 mt-2">
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-2xl bg-indigo-600 text-white font-bold transition-all active:scale-95 disabled:opacity-70"
              style={{ height: "64px", fontSize: "18px", boxShadow: "0 8px 28px #4f46e555" }}>
              {isSubmitting ? "Salvando..." : "✓  Lançar despesa"}
            </button>
          </div>
        </div>
      </form>

      {/* ── MODAL CARTÃO ─────────────────────────────────────────────────── */}
      <Dialog open={openCard} onOpenChange={setOpenCard}>
        <DialogContent className="fixed bottom-0 left-0 right-0 top-auto m-0 w-screen max-w-none rounded-t-3xl p-0 border-0"
          style={{ maxHeight: "60vh", transform: "none" }} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/></div>
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-[18px] font-bold">Cartão</h2>
            <button onClick={() => setOpenCard(false)} className="text-[13px] font-semibold text-primary">Fechar</button>
          </div>
          <div className="overflow-y-auto px-4 pb-6 space-y-2">
            {cards.filter(c => c.active).map(card => {
              const isSel = selectedCardId === card.id;
              return (
                <button key={card.id} type="button"
                  onClick={() => { setValue("card_id", card.id, { shouldValidate: true }); setOpenCard(false); }}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-95",
                    isSel ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-50 dark:bg-muted/40")}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/30">
                    <span className="text-base font-bold text-indigo-600">{card.flag?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-slate-800 dark:text-foreground">{card.name}</p>
                    <p className="text-[13px] text-slate-400">{card.bank} · {card.flag}</p>
                  </div>
                  {isSel && <CheckCircle2 className="h-6 w-6 shrink-0 text-indigo-500" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL CATEGORIA ──────────────────────────────────────────────── */}
      <Dialog open={openCat} onOpenChange={v => { setOpenCat(v); if (!v) setCatSearch(""); }}>
        <DialogContent className="fixed bottom-0 left-0 right-0 top-auto m-0 w-screen max-w-none rounded-t-3xl p-0 border-0"
          style={{ maxHeight: "78vh", transform: "none" }} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/></div>
          <div className="flex items-center justify-between px-5 pb-3">
            <h2 className="text-[18px] font-bold">Categoria</h2>
            <button onClick={() => setOpenCat(false)} className="text-[13px] font-semibold text-primary">Fechar</button>
          </div>
          <div className="relative mx-4 mb-3">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar categoria..." value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              className="h-12 w-full rounded-2xl bg-slate-100 dark:bg-muted pl-11 pr-4 text-base outline-none placeholder-slate-400" />
          </div>
          <div className="overflow-y-auto pb-6 px-4" style={{ maxHeight: "calc(78vh - 140px)" }}>
            <div className="grid grid-cols-3 gap-3">
              {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
                const isSel = selectedCatName === cat.name;
                const color = cat.color || "#6b7280";
                return (
                  <button key={cat.name} type="button"
                    onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                    className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 transition-all active:scale-95",
                      isSel ? "border-transparent shadow-md" : "border-transparent bg-slate-50 dark:bg-muted/40")}
                    style={isSel ? { background: color + "18", borderColor: color + "66" } : {}}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                      style={{ background: color + "22" }}>
                      {cat.icon || "📦"}
                    </div>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-foreground leading-tight text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL FATURA ─────────────────────────────────────────────────── */}
      <Dialog open={openBilling} onOpenChange={setOpenBilling}>
        <DialogContent className="fixed bottom-0 left-0 right-0 top-auto m-0 w-screen max-w-none rounded-t-3xl p-0 border-0"
          style={{ maxHeight: "60vh", transform: "none" }} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/></div>
          <div className="flex items-center justify-between px-5 pb-4">
            <h2 className="text-[18px] font-bold">Fatura destino</h2>
            <button onClick={() => setOpenBilling(false)} className="text-[13px] font-semibold text-primary">Fechar</button>
          </div>
          <div className="overflow-y-auto px-4 pb-6 space-y-2">
            {cardInvoices.map(inv => {
              const isSel    = selectedInvId === inv.id;
              const dueLabel = new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              return (
                <button key={inv.id} type="button"
                  onClick={() => { setValue("invoice_id", inv.id, { shouldValidate: true }); setOpenBilling(false); }}
                  className={cn("flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-95",
                    isSel ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-50 dark:bg-muted/40")}>
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                    <span className="text-[10px] font-bold uppercase text-indigo-400">{inv.competence.split("/")[0].slice(0,3)}</span>
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">/{inv.competence.split("/")[1].slice(2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-slate-800 dark:text-foreground">{inv.competence}</p>
                    <p className="text-[13px] text-slate-400">Vence {dueLabel}</p>
                  </div>
                  {isSel && <CheckCircle2 className="h-6 w-6 shrink-0 text-indigo-500" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
