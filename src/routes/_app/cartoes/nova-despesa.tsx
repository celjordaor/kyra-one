import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Info } from "lucide-react";
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
import { useCardStore, resolveInvoiceForDate } from "@/lib/card-store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/cartoes/nova-despesa")({
  validateSearch: z.object({ cardId: z.string().optional() }),
  component: NovaDespesaPage,
});

const schema = z.object({
  card_id: z.string().min(1, "Selecione o cartão"),
  category: z.string().min(1, "Selecione a categoria"),
  description: z.string().min(1, "Informe a descrição"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  purchase_date: z.string().min(1, "Informe a data"),
  installments: z.coerce.number().int().min(1).max(48),
  is_recurring: z.boolean().default(false),
  invoice_id: z.string().min(1, "Selecione a fatura"),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function NovaDespesaPage() {
  const router = useRouter();
  const { cardId: preselectedCardId } = useSearch({ from: "/_app/cartoes/nova-despesa" });
  const { cards, invoices, fetchCards, ensureInvoices, fetchInvoices, addExpense } = useCardStore();
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

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
    },
  });

  const selectedCardId = watch("card_id");
  const installments = watch("installments");
  const isRecurring = watch("is_recurring");
  const purchaseDate = watch("purchase_date");
  const amount = watch("amount");

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const cardInvoices = invoices
    .filter((i) => i.card_id === selectedCardId && i.status === "open")
    .sort((a, b) => a.competence.localeCompare(b.competence))
    .slice(0, 7); // atual + próximas 6

  // Carrega cartões e categorias
  useEffect(() => {
    if (cards.length === 0) fetchCards();
    loadCategories();
  }, []);

  // Auto-seleciona a fatura correta quando cartão ou data mudam
  useEffect(() => {
    if (!selectedCard || !purchaseDate || cardInvoices.length === 0) return;
    const resolved = resolveInvoiceForDate(purchaseDate, invoices, selectedCard);
    if (resolved) setValue("invoice_id", resolved.id);
  }, [selectedCardId, purchaseDate, invoices.length]);

  // Carrega faturas quando troca de cartão
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
      .select("name")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("name");
    setCategories((data ?? []).map((c) => c.name));
  };

  const installmentAmount = amount > 0 && installments > 1
    ? Math.round((amount / installments) * 100) / 100
    : null;

  const onSubmit = async (data: FormData) => {
    if (!selectedCard) return;
    try {
      await addExpense({
        card: selectedCard,
        invoiceId: data.invoice_id,
        category: data.category,
        description: data.description,
        amount: data.amount,
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
      {/* Header */}
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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.bank}
                    </SelectItem>
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
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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

        {/* Valor */}
        <div className="space-y-1.5">
          <Label htmlFor="amount">Valor total (R$)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("amount")}
          />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>

        {/* Data */}
        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Data da compra</Label>
          <Input id="purchase_date" type="date" {...register("purchase_date")} />
          {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
        </div>

        {/* Parcelas */}
        {!isRecurring && (
          <div className="space-y-1.5">
            <Label htmlFor="installments">Número de parcelas</Label>
            <Input
              id="installments"
              type="number"
              min="1"
              max="48"
              {...register("installments")}
            />
            {installmentAmount && (
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                {installments}x de {installmentAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} nas próximas faturas
              </div>
            )}
          </div>
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
                onCheckedChange={field.onChange}
              />
            )}
          />
          <div>
            <Label htmlFor="is_recurring" className="cursor-pointer font-medium">
              Despesa recorrente
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Será lançada automaticamente nas próximas 12 faturas com o mesmo valor.
            </p>
          </div>
        </div>

        {/* Fatura destino */}
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

        <Button
          type="submit"
          className="h-11 w-full bg-primary font-semibold"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Lançar despesa"}
        </Button>
      </form>
    </div>
  );
}
