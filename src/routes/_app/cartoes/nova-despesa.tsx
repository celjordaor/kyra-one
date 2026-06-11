import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, ChevronRight, CheckCircle2, Search,
  CreditCard, Tag, Calendar, FileText, Receipt, Repeat, StickyNote, Layers,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCardStore, type Invoice } from "@/lib/card-store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { DatePicker } from "@/components/cartoes/date-picker";
import { InstallmentPicker } from "@/components/cartoes/installment-picker";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";

function isValidEmoji(s: string): boolean {
  if (!s) return false;
  return (s.codePointAt(0) ?? 0) > 0x2000;
}

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

function formatCurrencyInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  return (parseInt(nums, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrencyInput(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}
function competenceToSortKey(c: string): string { const [mm, yyyy] = c.split("/"); return `${yyyy}-${mm}`; }
function sortInvoicesByCompetence(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => competenceToSortKey(a.competence).localeCompare(competenceToSortKey(b.competence)));
}
function resolveDefaultInvoice(invoices: Invoice[], cardId: string, purchaseDate: string): Invoice | null {
  const today = startOfDay(new Date());
  const pDate = purchaseDate ? startOfDay(parseISO(purchaseDate)) : today;
  const open  = sortInvoicesByCompetence(invoices.filter(i => i.card_id === cardId && i.status === "open"));
  for (const inv of open) {
    const closing = startOfDay(parseISO(inv.closing_date));
    if (!isAfter(pDate, closing)) return inv;
  }
  return open[0] ?? null;
}

// ── Componentes visuais ────────────────────────────────────────────────────
function TxSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      {title && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground mb-1.5 px-1">
          {title}
        </p>
      )}
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
  const cls = cn(
    "flex items-center gap-3.5 px-4 py-3.5 w-full text-left",
    !last && "border-b border-slate-100 dark:border-border",
    onClick && "hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
  );
  const inner = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground mb-0.5">{label}</p>
        {children}
        {error && <p className="text-[11px] text-destructive mt-0.5">{error}</p>}
      </div>
      {onClick && <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

// ── Página ─────────────────────────────────────────────────────────────────
function NovaDespesaPage() {
  const router = useRouter();
  const { cardId: preselectedCardId } = Route.useSearch();
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const allCategories = useCategories();
  const categories    = allCategories.filter(c => c.active && c.type === "expense");

  const [displayValue, setDisplayValue]   = useState("");
  const [openCard, setOpenCard]           = useState(false);
  const [openCat, setOpenCat]             = useState(false);
  const [openBilling, setOpenBilling]     = useState(false);
  const [catSearch, setCatSearch]         = useState("");
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
  const cardInvoices    = sortInvoicesByCompetence(invoices.filter(i => i.card_id === selectedCardId && i.status === "open")).slice(0, 6);
  const selectedInvoice = cardInvoices.find(i => i.id === selectedInvId);
  const parsedAmount    = parseCurrencyInput(displayValue);

  useEffect(() => {
    if (cards.length === 0) fetchCards();
  }, []);

  useEffect(() => {
    if (cards.length === 0) return;
    const current = watch("card_id");
    if (!current) {
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
    const def = resolveDefaultInvoice(invoices, selectedCardId, purchaseDate);
    if (def) setValue("invoice_id", def.id, { shouldValidate: true });
  }, [selectedCardId, purchaseDate, invoices.length]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCurrencyInput(e.target.value);
    setDisplayValue(formatted);
    setValue("amount_raw", formatted, { shouldValidate: true });
  }

  const onSubmit = async (data: FormData) => {
    if (!selectedCard) return;
    const amount = parseCurrencyInput(data.amount_raw);
    try {
      await addExpense({
        card: selectedCard, invoiceId: data.invoice_id, category: data.category,
        description: data.description, amount, purchaseDate: data.purchase_date,
        installments: data.installments, isRecurring: data.is_recurring,
        observations: data.observations,
      });
      toast.success("Despesa lançada com sucesso!");
      router.navigate({ to: "/cartoes/$cardId", params: { cardId: selectedCard.id } });
    } catch { toast.error("Erro ao lançar despesa."); }
  };

  const HEADER_BG = "bg-indigo-600";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">
      <form onSubmit={handleSubmit(onSubmit)}>

        {/* ── HEADER COLORIDO ─────────────────────────────────────────── */}
        <div className={cn(HEADER_BG, "px-5 pt-5 pb-10 text-white")}>
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={() => router.history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-base">Nova despesa cartão</span>
            <div className="w-9" />
          </div>

          <div>
            <p className="text-white/70 text-sm mb-1">Valor da despesa</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white/70">R$</span>
              <input
                type="text" inputMode="numeric"
                value={displayValue}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent text-white outline-none border-none text-4xl font-bold placeholder-white/40 min-w-0"
                placeholder="0,00"
              />
            </div>
            {errors.amount_raw && (
              <p className="text-white/80 text-xs mt-1 bg-white/10 rounded-lg px-2 py-1">
                {errors.amount_raw.message}
              </p>
            )}
          </div>
        </div>

        <div className="-mt-6 pb-6">

          {/* ── Informações ──────────────────────────────────────────── */}
          <TxSection title="Informações">
            {/* Descrição */}
            <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" error={errors.description?.message}>
              <input
                {...register("description")}
                className="text-[15px] font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-400"
                placeholder="Ex: Netflix, Supermercado Extra"
                autoComplete="off"
              />
            </FieldRow>

            {/* Cartão */}
            <FieldRow
              icon={<CreditCard className="h-5 w-5" />}
              label="Cartão"
              onClick={() => setOpenCard(true)}
              error={errors.card_id?.message}
            >
              {selectedCard ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-indigo-600 border border-indigo-300 rounded px-1.5 py-0.5">
                    {selectedCard.flag}
                  </span>
                  <span className="text-[15px] font-medium text-slate-800 dark:text-foreground">{selectedCard.name}</span>
                  {selectedCard.is_default && (
                    <span className="text-[10px] font-bold text-indigo-500">⭐ Padrão</span>
                  )}
                </div>
              ) : (
                <p className="text-[15px] text-slate-400 dark:text-muted-foreground">Selecione o cartão</p>
              )}
            </FieldRow>

            {/* Categoria */}
            <FieldRow
              icon={
                selectedCat
                  ? <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
                      {isValidEmoji(selectedCat.icon || "") ? selectedCat.icon : <Tag className="h-5 w-5" />}
                    </div>
                  : <Tag className="h-5 w-5" />
              }
              label="Categoria"
              onClick={() => setOpenCat(true)}
              error={errors.category?.message}
              last
            >
              <p className={cn("text-[15px] font-medium", selectedCatName ? "text-slate-800 dark:text-foreground" : "text-slate-400")}>
                {selectedCatName || "Selecione a categoria"}
              </p>
            </FieldRow>
          </TxSection>

          {/* ── Data e fatura ────────────────────────────────────────── */}
          <TxSection title="Data e fatura">
            <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data da compra">
              <DatePicker
                value={purchaseDate}
                onChange={v => setValue("purchase_date", v)}
              />
            </FieldRow>
            <FieldRow
              icon={<Receipt className="h-5 w-5" />}
              label="Fatura destino"
              onClick={() => setOpenBilling(true)}
              last
              error={errors.invoice_id?.message}
            >
              {loadingInvoices ? (
                <p className="text-[15px] text-slate-400">Carregando faturas...</p>
              ) : selectedInvoice ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[15px] font-medium text-slate-800 dark:text-foreground">{selectedInvoice.competence}</span>
                  <span className="text-xs text-slate-400">
                    • vence {new Date(selectedInvoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ) : (
                <p className="text-[15px] text-slate-400">Selecione a fatura</p>
              )}
            </FieldRow>
          </TxSection>

          {/* ── Parcelamento ─────────────────────────────────────────── */}
          {!isRecurring && parsedAmount > 0 && (
            <TxSection title="Parcelamento">
              <div className="px-4 py-3.5 border-b border-slate-100 dark:border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Número de parcelas</p>
                <InstallmentPicker
                  amount={parsedAmount}
                  value={installments}
                  onChange={n => setValue("installments", n)}
                />
              </div>
              {/* Recorrente toggle */}
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500">
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">Despesa recorrente</p>
                  <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">Lançada nas próximas 12 faturas</p>
                </div>
                <Controller name="is_recurring" control={control} render={({ field }) => (
                  <Switch checked={!!field.value}
                    onCheckedChange={v => { field.onChange(v); if (v) setValue("installments", 1); }} />
                )} />
              </div>
            </TxSection>
          )}

          {/* ── Observações ──────────────────────────────────────────── */}
          <TxSection title="Observações">
            <FieldRow icon={<StickyNote className="h-5 w-5" />} label="Nota (opcional)" last>
              <input
                {...register("observations")}
                className="text-[15px] font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-400"
                placeholder="Alguma nota sobre esta despesa"
              />
            </FieldRow>
          </TxSection>

          {/* ── Botão ────────────────────────────────────────────────── */}
          <div className="mx-4 mt-1">
            <button type="submit" disabled={isSubmitting}
              className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-70"
              style={{ boxShadow: "0 8px 24px #4f46e555" }}>
              {isSubmitting ? "Salvando..." : "Lançar despesa"}
            </button>
          </div>
        </div>
      </form>

      {/* ── Modais ────────────────────────────────────────────────────────── */}

      {/* Cartão */}
      <Dialog open={openCard} onOpenChange={setOpenCard}>
        <DialogContent className="max-w-xs" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Selecionar cartão</DialogTitle></DialogHeader>
          <div className="space-y-2 pb-1">
            {cards.filter(c => c.active).map(card => {
              const isSel = selectedCardId === card.id;
              return (
                <button key={card.id} type="button"
                  onClick={() => { setValue("card_id", card.id, { shouldValidate: true }); setOpenCard(false); }}
                  className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <span className="text-sm font-bold text-primary">{card.flag[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{card.name}</p>
                      {card.is_default && <span className="text-[10px] font-bold text-primary">Padrão</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{card.bank} · {card.flag}</p>
                  </div>
                  {isSel && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Categoria */}
      <Dialog open={openCat} onOpenChange={v => { setOpenCat(v); if (!v) setCatSearch(""); }}>
        <DialogContent className="max-w-sm p-0 gap-0" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Selecionar categoria</DialogTitle>
          </DialogHeader>
          <div className="relative mx-4 mt-3 mb-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Pesquisar categoria..."
              value={catSearch} onChange={e => setCatSearch(e.target.value)}
              className="h-10 w-full rounded-lg border bg-muted pl-9 pr-3 text-sm outline-none" />
          </div>
          <div className="max-h-80 overflow-y-auto px-2 pb-3">
            {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
              const isSel = selectedCatName === cat.name;
              return (
                <button key={cat.name} type="button"
                  onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-muted/60 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base text-white"
                    style={{ background: cat.color || "#6b7280" }}>
                    {cat.icon || "📦"}
                  </div>
                  <span className="flex-1 text-sm font-medium">{cat.name}</span>
                  <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSel ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}>
                    {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fatura */}
      <Dialog open={openBilling} onOpenChange={setOpenBilling}>
        <DialogContent className="max-w-xs" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Fatura destino</DialogTitle></DialogHeader>
          <div className="space-y-2 pb-1">
            {cardInvoices.map(inv => {
              const isSel     = selectedInvId === inv.id;
              const dueLabel  = new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              return (
                <div key={inv.id} className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => { setValue("invoice_id", inv.id, { shouldValidate: true }); setOpenBilling(false); }}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      background: isSel ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: isSel ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}>
                    {inv.competence}
                    {isSel && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  <span className="text-xs text-muted-foreground">vence {dueLabel}</span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
