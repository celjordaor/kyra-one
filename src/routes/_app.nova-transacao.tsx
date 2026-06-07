import { Repeat2, Minus,
 createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, TrendingUp, TrendingDown, Repeat, CheckCircle2, ChevronRight, X } from "lucide-react";
import { DatePicker } from "@/components/cartoes/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/lib/categories-store";
import { addTransactions, formatBrDate, isTodayOrPast, calcInstallmentDate } from "@/lib/transactions-store";

const RECURRING_MONTHS = 24;

export const Route = createFileRoute("/_app/nova-transacao")({
  head: () => ({ meta: [{ title: "Nova Transação — Finanças Pessoais" }] }),
  validateSearch: z.object({
    type: z.enum(["income", "expense"]).optional(),
  }),
  component: NovaTransacaoPage,
});

const transactionSchema = z.object({
  title:    z.string().min(2, "Descrição é obrigatória"),
  amount:   z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  date:     z.string().min(1, "Data é obrigatória"),
});
type TransactionForm = z.infer<typeof transactionSchema>;

// ── Emoji helpers (igual ao padrão de cartões) ────────────────────────
function isValidEmoji(s: string): boolean {
  if (!s) return false;
  const cp = s.codePointAt(0) ?? 0;
  return cp > 0x2000;
}

function CatIcon({ icon, name, color, size = "md" }: {
  icon: string; name: string; color: string; size?: "sm" | "md";
}) {
  const bg = color || "#6b7280";
  const cls = size === "sm" ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg";
  if (isValidEmoji(icon)) {
    return (
      <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full`}
        style={{ background: bg + "20", border: `1.5px solid ${bg}44` }}>
        <span className="leading-none">{icon}</span>
      </div>
    );
  }
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ background: bg }}>
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────
function NovaTransacaoPage() {
  const navigate = useNavigate();
  const { type: initialType } = Route.useSearch();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(initialType ?? "expense");
  const [recurring, setRecurring]             = useState(false);
  const [repeat, setRepeat]                   = useState(false);
  const [repeatMonths, setRepeatMonths]       = useState(3);
  const [settled, setSettled]                 = useState(true);
  const [success, setSuccess]                 = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay]     = useState("");
  const [openCat, setOpenCat]                 = useState(false);
  const [catSearch, setCatSearch]             = useState("");

  const allCategories = useCategories();
  const categories    = allCategories.filter(c => c.active && c.type === transactionType);
  const filtered      = categories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<TransactionForm>({
      resolver: zodResolver(transactionSchema),
      defaultValues: { title: "", amount: "", category: "", date: new Date().toISOString().split("T")[0] },
    });

  const dateValue     = watch("date");
  const categoryValue = watch("category");
  const isFuture      = dateValue ? !isTodayOrPast(dateValue) : false;
  const selectedCat   = categories.find(c => c.name === categoryValue);

  // Limpar categoria ao trocar tipo (despesa/receita)
  useEffect(() => { setValue("category", ""); }, [transactionType]);

  useEffect(() => {
    if (isFuture) setSettled(false);
    else setSettled(true);
  }, [isFuture]);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); setValue("amount", "", { shouldValidate: true }); return; }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    const formatted = parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setAmountDisplay(formatted);
    setValue("amount", value, { shouldValidate: true });
  }

  const onSubmit = async (data: TransactionForm) => {
    await new Promise(r => setTimeout(r, 300));
    const numeric = parseFloat(data.amount);
    const signed  = transactionType === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y, m, d] = data.date.split("-").map(Number);
    const baseDate  = new Date(y, m - 1, d);
    const label     = transactionType === "income" ? "Receita" : "Despesa";

    if (repeat && repeatMonths > 1) {
      // Série de N meses (parcelamento manual)
      const recurrenceId = crypto.randomUUID();
      const items = Array.from({ length: repeatMonths }, (_, i) => {
        const dt = calcInstallmentDate(y, m, d, i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return {
          title: data.title, amount: signed, type: transactionType,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso),
          recurring: false, source: "manual" as const,
          installment_number: i + 1,
          installments_total: repeatMonths,
          recurrence_id: recurrenceId,
        };
      });
      addTransactions(items);
      setSuccess(`${label} parcelada em ${repeatMonths}x criada com sucesso!`);
    } else {
      // Recorrente ou simples
      const count = recurring ? RECURRING_MONTHS : 1;
      const items = Array.from({ length: count }, (_, i) => {
        const dt  = new Date(baseDate);
        dt.setMonth(dt.getMonth() + i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return {
          title: data.title, amount: signed, type: transactionType,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso),
          recurring, source: "manual" as const,
        };
      });
      addTransactions(items);
      setSuccess(recurring
        ? `${label} recorrente criada para os próximos ${RECURRING_MONTHS} meses!`
        : `${label} adicionada com sucesso!`
      );
    }

    reset();
    setAmountDisplay("");
    setRecurring(false);
    setRepeat(false);
    setRepeatMonths(3);
    setSettled(true);
    const monthParam = `${baseDate.getFullYear()}-${String(baseDate.getMonth()+1).padStart(2,"0")}`;
    setTimeout(() => { setSuccess(null); navigate({ to: "/transacoes", search: { month: monthParam } }); }, 900);
  };

  const settledLabel = transactionType === "income" ? "Recebida" : "Paga";
  const settledHelp  = isFuture
    ? `Disponível somente para ${transactionType === "income" ? "receitas" : "despesas"} com data até hoje`
    : `Marque se esta ${transactionType === "income" ? "receita já foi recebida" : "despesa já foi paga"}`;

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
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

        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {(["expense","income"] as const).map(type => (
            <button key={type} type="button" onClick={() => setTransactionType(type)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                transactionType === type
                  ? `bg-card shadow-sm ${type === "expense" ? "text-red-500" : "text-emerald-600"}`
                  : "text-muted-foreground"
              }`}>
              {type === "expense" ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {type === "expense" ? "Despesa" : "Receita"}
            </button>
          ))}
        </div>

        {/* Valor */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Valor</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input type="text" inputMode="decimal" placeholder="0,00"
              className="h-12 pl-9 text-lg font-bold"
              value={amountDisplay} onChange={e => handleAmountChange(e.target.value)} />
          </div>
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Descrição</Label>
          <Input placeholder="Ex: Supermercado, Salário, Uber..." className="h-11" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* ── Categoria — mesmo padrão dos cartões ── */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Categoria</Label>
          <button type="button" onClick={() => setOpenCat(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50 transition-colors">
            {selectedCat ? (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                style={{
                  background: (selectedCat.color || "#6b7280") + "20",
                  color: selectedCat.color || "#6b7280",
                  border: `1.5px solid ${selectedCat.color || "#6b7280"}55`,
                }}>
                <CatIcon icon={selectedCat.icon || ""} name={selectedCat.name} color={selectedCat.color || "#6b7280"} size="sm" />
                <span>{selectedCat.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Selecione a categoria</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        {/* ── Data — mesmo componente dos cartões ── */}
        <div className="space-y-1.5">
          <DatePicker
            label="Data"
            value={dateValue}
            onChange={iso => setValue("date", iso, { shouldValidate: true })}
          />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>

        {/* Pago/Recebido */}
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
          <Switch checked={settled && !isFuture} onCheckedChange={setSettled} disabled={isFuture} />
        </div>

        {/* Recorrente */}
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
          <Switch
            checked={recurring}
            onCheckedChange={v => { setRecurring(v); if (v) setRepeat(false); }}
          />
        </div>

        {/* Repetir N meses */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Repeat2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Repetir por N meses</p>
                <p className="text-xs text-muted-foreground">
                  {repeat
                    ? `Lança ${repeatMonths} parcelas a partir desta data`
                    : `Cria cópias desta ${transactionType === "income" ? "receita" : "despesa"} nos próximos meses`}
                </p>
              </div>
            </div>
            <Switch
              checked={repeat}
              onCheckedChange={v => { setRepeat(v); if (v) setRecurring(false); }}
            />
          </div>

          {/* Stepper de meses */}
          {repeat && (
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Quantidade de meses</p>
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setRepeatMonths(n => Math.max(2, n - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted transition-colors">
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex w-12 flex-col items-center">
                  <span className="text-xl font-bold text-primary leading-none">{repeatMonths}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {repeatMonths === 1 ? "mês" : "meses"}
                  </span>
                </div>
                <button type="button"
                  onClick={() => setRepeatMonths(n => Math.min(36, n + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" className="h-12 w-full bg-primary text-base font-semibold" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar transação"}
        </Button>
      </form>

      {/* ── Modal de categoria — mesmo padrão dos cartões ── */}
      <Dialog open={openCat} onOpenChange={v => { setOpenCat(v); if (!v) setCatSearch(""); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Selecionar categoria</DialogTitle>
          </DialogHeader>

          {/* Busca */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" placeholder="Pesquisar categoria"
                value={catSearch} onChange={e => setCatSearch(e.target.value)}
                className="h-10 w-full rounded-lg bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto pb-2">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma categoria encontrada</p>
            ) : filtered.map(cat => {
              const isSelected = categoryValue === cat.name;
              const color      = cat.color || "#6b7280";
              return (
                <button key={cat.id} type="button"
                  onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                  <CatIcon icon={cat.icon || ""} name={cat.name} color={color} />
                  <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{ borderColor: isSelected ? color : "#d1d5db", background: isSelected ? color : "transparent" }}>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
