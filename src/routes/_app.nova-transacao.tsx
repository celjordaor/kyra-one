import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, TrendingUp, TrendingDown, Repeat, CheckCircle2 } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/lib/categories-store";
import {
  addTransactions,
  formatBrDate,
  isTodayOrPast,
} from "@/lib/transactions-store";

const RECURRING_MONTHS = 24;

export const Route = createFileRoute("/_app/nova-transacao")({
  head: () => ({
    meta: [{ title: "Nova Transação — Finanças Pessoais" }],
  }),
  component: NovaTransacaoPage,
});

const transactionSchema = z.object({
  title: z.string().min(2, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  date: z.string().min(1, "Data é obrigatória"),
});

type TransactionForm = z.infer<typeof transactionSchema>;

function NovaTransacaoPage() {
  const navigate = useNavigate();
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");
  const [recurring, setRecurring] = useState(false);
  const [settled, setSettled] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState("");
  const categories = useCategories().filter((c) => c.active && c.type === transactionType);


  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { title: "", amount: "", category: "", date: new Date().toISOString().split("T")[0] },
  });

  const dateValue = watch("date");
  const isFuture = dateValue ? !isTodayOrPast(dateValue) : false;

  // Auto-update settled default based on date
  useEffect(() => {
    if (isFuture) setSettled(false);
    else setSettled(true);
  }, [isFuture]);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setAmountDisplay("");
      setValue("amount", "", { shouldValidate: true });
      return;
    }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    const formatted = parseFloat(value).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setAmountDisplay(formatted);
    setValue("amount", value, { shouldValidate: true });
  }

  const onSubmit = async (data: TransactionForm) => {
    await new Promise((r) => setTimeout(r, 300));

    const numeric = parseFloat(data.amount);
    const signed = transactionType === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y, m, d] = data.date.split("-").map(Number);
    const baseDate = new Date(y, m - 1, d);

    const count = recurring ? RECURRING_MONTHS : 1;
    const items = Array.from({ length: count }, (_, i) => {
      const dt = new Date(baseDate);
      dt.setMonth(dt.getMonth() + i);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      return {
        title: data.title,
        amount: signed,
        type: transactionType,
        date: formatBrDate(dt),
        category: data.category,
        settled: i === 0 ? settled : isTodayOrPast(iso),
        recurring,
      };
    });

    addTransactions(items);

    const label = transactionType === "income" ? "Receita" : "Despesa";
    setSuccess(
      recurring
        ? `${label} recorrente criada para os próximos ${RECURRING_MONTHS} meses!`
        : `${label} adicionada com sucesso!`,
    );
    reset();
    setAmountDisplay("");
    setRecurring(false);
    setSettled(true);
    const monthParam = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}`;
    setTimeout(() => {
      setSuccess(null);
      navigate({ to: "/transacoes", search: { month: monthParam } });
    }, 900);
  };


  const settledLabel = transactionType === "income" ? "Recebida" : "Paga";
  const settledHelp = isFuture
    ? `Disponível somente para ${transactionType === "income" ? "receitas" : "despesas"} com data até hoje`
    : `Marque se esta ${transactionType === "income" ? "receita já foi recebida" : "despesa já foi paga"}`;

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Nova transação</h1>
      </div>

      {success && (
        <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setTransactionType("expense")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              transactionType === "expense"
                ? "bg-card text-red-500 shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setTransactionType("income")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              transactionType === "income"
                ? "bg-card text-emerald-600 shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Receita
          </button>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Valor</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              className="h-12 pl-9 text-lg font-bold"
              value={amountDisplay}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
          </div>
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Descrição</Label>
          <Input
            placeholder="Ex: Supermercado, Salário, Uber..."
            className="h-11"
            {...register("title")}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Categoria</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <label key={cat.id} className="cursor-pointer">
                <input
                  type="radio"
                  value={cat.name}
                  className="peer sr-only"
                  {...register("category")}
                />
                <span className="inline-block rounded-full border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                  {cat.name}
                </span>
              </label>
            ))}
          </div>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Data</Label>
          <DatePicker
            value={dateValue}
            onChange={(iso) => setValue("date", iso, { shouldValidate: true })}
          />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>

        {/* Settled */}
        <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              transactionType === "income" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
            }`}>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{settledLabel}</p>
              <p className="text-xs text-muted-foreground">{settledHelp}</p>
            </div>
          </div>
          <Switch
            checked={settled && !isFuture}
            onCheckedChange={setSettled}
            disabled={isFuture}
          />
        </div>

        {/* Recurring */}
        <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Recorrente</p>
              <p className="text-xs text-muted-foreground">
                Replica esta {transactionType === "income" ? "receita" : "despesa"} pelos próximos {RECURRING_MONTHS} meses
              </p>
            </div>
          </div>
          <Switch checked={recurring} onCheckedChange={setRecurring} />
        </div>

        <Button
          type="submit"
          className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Salvar transação"}
        </Button>
      </form>
    </div>
  );
}
