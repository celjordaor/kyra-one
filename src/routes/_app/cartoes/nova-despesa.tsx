import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronRight, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCardStore, type Invoice } from "@/lib/card-store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { DatePicker } from "@/components/cartoes/date-picker";
import { InstallmentPicker } from "@/components/cartoes/installment-picker";

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
  const purchase = startOfDay(parseISO(purchaseDate));
  const open = sortInvoicesByCompetence(invoices.filter(i => i.card_id === cardId && i.status === "open"));
  if (open.length === 0) return null;
  return open.find(inv => isAfter(parseISO(inv.closing_date), today) && isAfter(parseISO(inv.closing_date), purchase)) ?? open[0];
}

function NovaDespesaPage() {
  const router = useRouter();
  const { cardId: preselectedCardId } = Route.useSearch();
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const [categories, setCategories] = useState<{ name: string; color: string; icon: string }[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  // Modal controls
  const [openCard, setOpenCard]       = useState(false);
  const [openCat, setOpenCat]         = useState(false);
  const [openBilling, setOpenBilling] = useState(false);
  const [catSearch, setCatSearch] = useState("");

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      card_id: preselectedCardId ?? "",
      installments: 1, is_recurring: false,
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      invoice_id: "", amount_raw: "",
    },
  });

  const selectedCardId  = watch("card_id");
  const installments    = watch("installments");
  const isRecurring     = watch("is_recurring");
  const purchaseDate    = watch("purchase_date");
  const amountRaw       = watch("amount_raw");
  const selectedCatName = watch("category");
  const selectedInvId   = watch("invoice_id");
  const parsedAmount    = parseCurrencyInput(amountRaw);

  const selectedCard    = cards.find(c => c.id === selectedCardId);
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );
  const cardInvoices    = sortInvoicesByCompetence(invoices.filter(i => i.card_id === selectedCardId && i.status === "open")).slice(0, 6);
  const selectedInvoice = cardInvoices.find(i => i.id === selectedInvId);
  const selectedCat     = categories.find(c => c.name === selectedCatName);

  useEffect(() => {
    if (cards.length === 0) fetchCards();
    loadCategories();
  }, []);

  // Auto-selecionar cartão padrão
  useEffect(() => {
    if (cards.length === 0) return;
    const current = watch("card_id");
    if (!current) {
      const def = cards.find(c => c.is_default && c.active) ?? cards.find(c => c.active);
      if (def) setValue("card_id", def.id);
    }
  }, [cards]);

  // Auto-selecionar fatura
  useEffect(() => {
    if (!selectedCard || !purchaseDate) return;
    const resolved = resolveDefaultInvoice(invoices, selectedCard.id, purchaseDate);
    if (resolved) setValue("invoice_id", resolved.id);
  }, [selectedCardId, purchaseDate, invoices.length]);

  // Carregar faturas ao trocar cartão
  useEffect(() => {
    if (!selectedCard) return;
    setLoadingInvoices(true);
    ensureInvoices(selectedCard).then(() => fetchInvoices(selectedCard.id)).finally(() => setLoadingInvoices(false));
  }, [selectedCardId]);

  const loadCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data } = await supabase.from("categories").select("name, color, icon").eq("user_id", user.id).eq("type", "expense").order("name");
    setCategories(data ?? []);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setDisplayValue(formatted);
    setValue("amount_raw", formatted, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedCard) return;
    const amount = parseCurrencyInput(data.amount_raw);
    if (amount <= 0) { toast.error("Informe um valor válido."); return; }
    try {
      await addExpense({ card: selectedCard, invoiceId: data.invoice_id, category: data.category, description: data.description, amount, purchaseDate: data.purchase_date, installments: data.installments, isRecurring: data.is_recurring, observations: data.observations });
      toast.success("Despesa lançada com sucesso!");
      router.navigate({ to: "/cartoes/$cardId", params: { cardId: selectedCard.id } });
    } catch { toast.error("Erro ao lançar despesa."); }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nova Despesa</h1>
          <p className="text-sm text-muted-foreground">Lance uma despesa no cartão</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* 1. DESCRIÇÃO — primeiro campo */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição</Label>
          <Input id="description" placeholder="Ex: Netflix, Supermercado Extra" {...register("description")} />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* 2. CARTÃO — modal com pills */}
        <div className="space-y-1.5">
          <Label>Cartão</Label>
          <button type="button" onClick={() => setOpenCard(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50 transition-colors">
            {selectedCard ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-xs font-bold text-primary">{selectedCard.flag[0]}</span>
                </div>
                <span className="font-medium text-foreground">{selectedCard.name}</span>
                <span className="text-xs text-muted-foreground">{selectedCard.bank}</span>
                {selectedCard.is_default && <span className="text-[10px] font-bold text-primary">Padrão</span>}
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione o cartão</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {errors.card_id && <p className="text-xs text-destructive">{errors.card_id.message}</p>}
        </div>

        {/* 3. CATEGORIA — modal com pills coloridas + ícone */}
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <button type="button" onClick={() => setOpenCat(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50 transition-colors">
            {selectedCat ? (
              <div className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={{ borderColor: selectedCat.color || "#6b7280", background: (selectedCat.color || "#6b7280") + "18" }}>
                <div className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: selectedCat.color || "#6b7280" }}>
                  <span className="text-xs text-white">{selectedCat.icon || "📦"}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: selectedCat.color || "#6b7280" }}>
                  {selectedCat.name}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione a categoria</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        {/* 4. VALOR */}
        <div className="space-y-1.5">
          <Label htmlFor="amount_display">Valor (R$)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input id="amount_display" inputMode="numeric" placeholder="0,00" className="pl-9" value={displayValue} onChange={handleAmountChange} />
          </div>
          {errors.amount_raw && <p className="text-xs text-destructive">{errors.amount_raw.message}</p>}
        </div>

        {/* 5. DATA */}
        <DatePicker label="Data da compra" value={purchaseDate} onChange={v => setValue("purchase_date", v)} />

        {/* 6. FATURA DESTINO — pills + data de vencimento fora da pill */}
        {selectedCard && (
          <div className="space-y-1.5">
            <Label>Fatura destino</Label>
            {loadingInvoices ? (
              <p className="text-xs text-muted-foreground">Carregando faturas...</p>
            ) : (
              <button type="button" onClick={() => setOpenBilling(true)}
                className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50 transition-colors">
                {selectedInvoice ? (
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{selectedInvoice.competence}</span>
                    <span className="text-xs text-muted-foreground">
                      vence {new Date(selectedInvoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Selecione a fatura</span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {errors.invoice_id && <p className="text-xs text-destructive">{errors.invoice_id.message}</p>}
          </div>
        )}

        {/* 7. PARCELAMENTO */}
        {!isRecurring && parsedAmount > 0 && (
          <InstallmentPicker amount={parsedAmount} value={installments} onChange={n => setValue("installments", n)} />
        )}

        {/* 8. RECORRENTE */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <Controller name="is_recurring" control={control} render={({ field }) => (
            <Checkbox id="is_recurring" className="mt-0.5" checked={!!field.value}
              onCheckedChange={v => { field.onChange(v); if (v) setValue("installments", 1); }} />
          )} />
          <div>
            <Label htmlFor="is_recurring" className="cursor-pointer font-medium">Despesa recorrente</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">Será lançada nas próximas 12 faturas com o mesmo valor.</p>
          </div>
        </div>

        {/* 9. OBSERVAÇÕES */}
        <div className="space-y-1.5">
          <Label htmlFor="observations">Observações (opcional)</Label>
          <Input id="observations" placeholder="Alguma nota sobre esta despesa" {...register("observations")} />
        </div>

        <Button type="submit" className="h-11 w-full bg-primary font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Lançar despesa"}
        </Button>
      </form>

      {/* ── Modal: Cartão ── */}
      <Dialog open={openCard} onOpenChange={setOpenCard}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Selecionar cartão</DialogTitle></DialogHeader>
          <div className="space-y-2 pb-1">
            {cards.filter(c => c.active).map(card => {
              const isSelected = selectedCardId === card.id;
              return (
                <button key={card.id} type="button"
                  onClick={() => { setValue("card_id", card.id, { shouldValidate: true }); setOpenCard(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <span className="text-sm font-bold text-primary">{card.flag[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
                      {card.is_default && <span className="shrink-0 text-[10px] font-bold text-primary">Padrão</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{card.bank} · {card.flag}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Categoria — lista com busca ── */}
      <Dialog open={openCat} onOpenChange={(v) => { setOpenCat(v); if (!v) setCatSearch(""); }}>
        <DialogContent className="max-w-sm p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Selecionar categoria</DialogTitle>
          </DialogHeader>

          {/* Busca */}
          <div className="relative mx-4 mt-3 mb-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar categoria..."
              value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              className="h-10 w-full rounded-lg border bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto px-2 pb-3">
            {categories
              .filter(cat => cat.name.toLowerCase().includes(catSearch.toLowerCase()))
              .map(cat => {
                const isSelected = selectedCatName === cat.name;
                return (
                  <button key={cat.name} type="button"
                    onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60">

                    {/* Ícone colorido */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base text-white"
                      style={{ background: cat.color || "#6b7280" }}>
                      {cat.icon || "📦"}
                    </div>

                    {/* Nome */}
                    <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>

                    {/* Indicador de seleção */}
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    }`}>
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Fatura destino — pills + vencimento fora ── */}
      <Dialog open={openBilling} onOpenChange={setOpenBilling}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Fatura destino</DialogTitle></DialogHeader>
          <div className="space-y-2 pb-1">
            {cardInvoices.map(inv => {
              const isSelected = selectedInvId === inv.id;
              const dueLabel = new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              return (
                <div key={inv.id} className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => { setValue("invoice_id", inv.id, { shouldValidate: true }); setOpenBilling(false); }}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      background: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}>
                    {inv.competence}
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  {/* Data de vencimento FORA da pill, apenas informativo */}
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
