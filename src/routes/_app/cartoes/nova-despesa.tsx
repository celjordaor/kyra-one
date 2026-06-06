import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  card_id: z.string().min(1, "Selecione o cartão"),
  category: z.string().min(1, "Selecione a categoria"),
  description: z.string().min(1, "Informe a descrição"),
  amount_raw: z.string().min(1, "Informe o valor"),
  purchase_date: z.string().min(1, "Informe a data"),
  installments: z.number().int().min(1).max(48),
  is_recurring: z.boolean().default(false),
  invoice_id: z.string().min(1, "Selecione a fatura"),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Formata dígitos em valor BRL enquanto digita
function formatCurrencyInput(digits: string): string {
  const nums = digits.replace(/\D/g, "");
  if (!nums) return "";
  const cents = parseInt(nums, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

// Converte "MM/yyyy" → "yyyy-MM" para ordenação cronológica correta
function competenceToSortKey(competence: string): string {
  const [mm, yyyy] = competence.split("/");
  return `${yyyy}-${mm}`;
}

function sortInvoicesByCompetence(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) =>
    competenceToSortKey(a.competence).localeCompare(competenceToSortKey(b.competence))
  );
}

// Retorna a fatura aberta mais próxima (menor closing_date que ainda não passou)
// Se todas já passaram, retorna a próxima em ordem cronológica
function resolveDefaultInvoice(invoices: Invoice[], cardId: string, purchaseDate: string): Invoice | null {
  const today = startOfDay(new Date());
  const purchase = startOfDay(parseISO(purchaseDate));

  const openInvoices = sortInvoicesByCompetence(
    invoices.filter((i) => i.card_id === cardId && i.status === "open")
  );

  if (openInvoices.length === 0) return null;

  // Procura a fatura cuja data de fechamento é após a data da compra E após hoje
  const best = openInvoices.find(
    (inv) =>
      isAfter(parseISO(inv.closing_date), today) &&
      isAfter(parseISO(inv.closing_date), purchase)
  );

  // Se encontrou, retorna ela (é a mais próxima já que a lista está ordenada)
  // Se não encontrou, retorna a primeira da lista (mais próxima em ordem)
  return best ?? openInvoices[0];
}

function NovaDespesaPage() {
  const router = useRouter();
  const { cardId: preselectedCardId } = Route.useSearch();
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const [categories, setCategories] = useState<{ name: string; color: string; icon: string }[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      card_id: preselectedCardId ?? "",
      installments: 1,
      is_recurring: false,
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      invoice_id: "",
      amount_raw: "",
    },
  });

  const selectedCardId = watch("card_id");
  const installments = watch("installments");
  const isRecurring = watch("is_recurring");
  const purchaseDate = watch("purchase_date");
  const amountRaw = watch("amount_raw");
  const parsedAmount = parseCurrencyInput(amountRaw);

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  // Faturas abertas deste cartão — ordenadas cronologicamente, limitadas às próximas 6
  const cardInvoices = sortInvoicesByCompetence(
    invoices.filter((i) => i.card_id === selectedCardId && i.status === "open")
  ).slice(0, 6);

  useEffect(() => {
    if (cards.length === 0) fetchCards();
    loadCategories();
  }, []);

  // Auto-seleciona a fatura mais próxima quando cartão ou data mudam
  useEffect(() => {
    if (!selectedCard || !purchaseDate) return;
    const allOpen = invoices.filter(
      (i) => i.card_id === selectedCard.id && i.status === "open"
    );
    if (allOpen.length === 0) return;
    const resolved = resolveDefaultInvoice(invoices, selectedCard.id, purchaseDate);
    if (resolved) setValue("invoice_id", resolved.id);
  }, [selectedCardId, purchaseDate, invoices.length]);

  // Carrega/garante faturas ao trocar de cartão
  useEffect(() => {
    if (!selectedCard) return;
    setLoadingInvoices(true);
    ensureInvoices(selectedCard)
      .then(() => fetchInvoices(selectedCard.id))
      .finally(() => setLoadingInvoices(false));
  }, [selectedCardId]);

  const loadCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("categories")
      .select("name, color, icon")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("name");
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
      await addExpense({
        card: selectedCard,
        invoiceId: data.invoice_id,
        category: data.category,
        description: data.description,
        amount,
        purchaseDate: data.purchase_date,
        installments: data.installments,
        isRecurring: data.is_recurring,
        observations: data.observations,
      });
      toast.success("Despesa lançada com sucesso!");
      router.navigate({ to: "/cartoes/$cardId", params: { cardId: selectedCard.id } });
    } catch {
      toast.error("Erro ao lançar despesa.");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nova Despesa</h1>
          <p className="text-sm text-muted-foreground">Lance uma despesa no cartão</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Cartão */}
        <div className="space-y-1.5">
          <Label>Cartão</Label>
          <Controller
            name="card_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter((c) => c.active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {c.bank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.card_id && <p className="text-xs text-destructive">{errors.card_id.message}</p>}
        </div>

        {/* Categoria */}
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color ?? "#6b7280" }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição</Label>
          <Input id="description" placeholder="Ex: Netflix, Supermercado Extra" {...register("description")} />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* Valor com máscara BRL */}
        <div className="space-y-1.5">
          <Label htmlFor="amount_display">Valor (R$)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              id="amount_display"
              inputMode="numeric"
              placeholder="0,00"
              className="pl-9"
              value={displayValue}
              onChange={handleAmountChange}
            />
          </div>
          {errors.amount_raw && <p className="text-xs text-destructive">{errors.amount_raw.message}</p>}
        </div>

        {/* DatePicker moderno */}
        <DatePicker
          label="Data da compra"
          value={purchaseDate}
          onChange={(v) => setValue("purchase_date", v)}
        />

        {/* InstallmentPicker — só aparece quando há valor e não é recorrente */}
        {!isRecurring && parsedAmount > 0 && (
          <InstallmentPicker
            amount={parsedAmount}
            value={installments}
            onChange={(n) => setValue("installments", n)}
          />
        )}

        {/* Recorrente */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <Controller
            name="is_recurring"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="is_recurring"
                className="mt-0.5"
                checked={!!field.value}
                onCheckedChange={(v) => {
                  field.onChange(v);
                  if (v) setValue("installments", 1);
                }}
              />
            )}
          />
          <div>
            <Label htmlFor="is_recurring" className="cursor-pointer font-medium">
              Despesa recorrente
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Será lançada nas próximas 12 faturas com o mesmo valor.
            </p>
          </div>
        </div>

        {/* Fatura destino — ordenada cronologicamente, próximas 6 meses */}
        {selectedCard && (
          <div className="space-y-1.5">
            <Label>Fatura destino</Label>
            {loadingInvoices ? (
              <p className="text-xs text-muted-foreground">Carregando faturas...</p>
            ) : (
              <Controller
                name="invoice_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fatura" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardInvoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.competence} · vence{" "}
                          {new Date(inv.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.invoice_id && <p className="text-xs text-destructive">{errors.invoice_id.message}</p>}
          </div>
        )}

        {/* Observações */}
        <div className="space-y-1.5">
          <Label htmlFor="observations">Observações (opcional)</Label>
          <Input id="observations" placeholder="Alguma nota sobre esta despesa" {...register("observations")} />
        </div>

        <Button type="submit" className="h-11 w-full bg-primary font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Lançar despesa"}
        </Button>
      </form>
    </div>
  );
}
