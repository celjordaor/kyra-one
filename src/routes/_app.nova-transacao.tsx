import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, TrendingUp, TrendingDown, Repeat, Repeat2,
  Minus, Plus, CheckCircle2, ChevronRight, Tag, Calendar,
  FileText, RotateCcw, Layers,
} from "lucide-react";
import { DatePicker } from "@/components/cartoes/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/lib/categories-store";
import { addTransactions, formatBrDate, isTodayOrPast, calcInstallmentDate } from "@/lib/transactions-store";
import { cn } from "@/lib/utils";

const RECURRING_MONTHS = 24;

export const Route = createFileRoute("/_app/nova-transacao")({
  head: () => ({ meta: [{ title: "Nova Transação — Finanças Pessoais" }] }),
  validateSearch: z.object({ type: z.enum(["income", "expense"]).optional() }),
  component: NovaTransacaoPage,
});

const transactionSchema = z.object({
  title:    z.string().min(2, "Descrição é obrigatória"),
  amount:   z.string().min(1, "Valor é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  date:     z.string().min(1, "Data é obrigatória"),
});
type TransactionForm = z.infer<typeof transactionSchema>;

function isValidEmoji(s: string): boolean {
  if (!s) return false;
  return (s.codePointAt(0) ?? 0) > 0x2000;
}

// ── Componentes visuais locais ─────────────────────────────────────────────
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
    onClick && "hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors cursor-pointer"
  );
  const inner = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-muted-foreground mb-0.5">{label}</p>
        {children}
        {error && <p className="text-[11px] text-destructive mt-0.5">{error}</p>}
      </div>
      {onClick && <ChevronRight className="h-4 w-4 text-slate-400 dark:text-muted-foreground shrink-0" />}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

function SwitchRow({
  icon, label, description, checked, onCheckedChange, last = false, disabled = false,
}: {
  icon: React.ReactNode; label: string; description: string;
  checked: boolean; onCheckedChange: (v: boolean) => void;
  last?: boolean; disabled?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3.5 px-4 py-3.5",
      !last && "border-b border-slate-100 dark:border-border",
      disabled && "opacity-50"
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-slate-800 dark:text-foreground leading-snug">{label}</p>
        <p className="text-[13px] text-slate-400 dark:text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
function NovaTransacaoPage() {
  const navigate = useNavigate();
  const { type: initialType } = Route.useSearch();
  const [transactionType, setTransactionType] = useState<"income" | "expense">(initialType ?? "expense");
  const [recurring, setRecurring] = useState(false);
  const [repeat, setRepeat]       = useState(false);
  const [repeatMonths, setRepeatMonths] = useState(3);
  const [settled, setSettled]     = useState(true);
  const [success, setSuccess]     = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [openCat, setOpenCat]     = useState(false);
  const [catSearch, setCatSearch] = useState("");

  const allCategories = useCategories();
  const categories    = allCategories.filter(c => c.active && c.type === transactionType);
  const filtered      = categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<TransactionForm>({
      resolver: zodResolver(transactionSchema),
      defaultValues: { title: "", amount: "", category: "", date: new Date().toISOString().split("T")[0] },
    });

  const dateValue     = watch("date");
  const categoryValue = watch("category");
  const isFuture      = dateValue ? !isTodayOrPast(dateValue) : false;
  const selectedCat   = categories.find(c => c.name === categoryValue);
  const isIncome      = transactionType === "income";

  const headerBg    = isIncome ? "bg-emerald-500" : "bg-rose-500";
  const accentColor = isIncome ? "#10b981" : "#f43f5e";
  const accentLight = isIncome ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500";

  useEffect(() => { setValue("category", ""); }, [transactionType]);
  useEffect(() => { if (isFuture) setSettled(false); else setSettled(true); }, [isFuture]);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); setValue("amount", "", { shouldValidate: true }); return; }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    setAmountDisplay(parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setValue("amount", value, { shouldValidate: true });
  }

  const onSubmit = async (data: TransactionForm) => {
    await new Promise(r => setTimeout(r, 300));
    const numeric = parseFloat(data.amount);
    const signed  = transactionType === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y, m, d] = data.date.split("-").map(Number);
    const baseDate  = new Date(y, m - 1, d);
    const label     = isIncome ? "Receita" : "Despesa";

    if (repeat && repeatMonths > 1) {
      const recurrenceId = crypto.randomUUID();
      const items = Array.from({ length: repeatMonths }, (_, i) => {
        const dt = calcInstallmentDate(y, m, d, i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return {
          title: data.title, amount: signed, type: transactionType,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso),
          recurring: false, source: "manual" as const,
          installment_number: i + 1, installments_total: repeatMonths, recurrence_id: recurrenceId,
        };
      });
      addTransactions(items);
      setSuccess(`${label} parcelada em ${repeatMonths}x criada!`);
    } else {
      const count = recurring ? RECURRING_MONTHS : 1;
      const items = Array.from({ length: count }, (_, i) => {
        const dt = new Date(baseDate); dt.setMonth(dt.getMonth() + i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return {
          title: data.title, amount: signed, type: transactionType,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso),
          recurring, source: "manual" as const,
        };
      });
      addTransactions(items);
      setSuccess(recurring ? `${label} recorrente criada para ${RECURRING_MONTHS} meses!` : `${label} adicionada!`);
    }

    reset(); setAmountDisplay(""); setRecurring(false); setRepeat(false); setRepeatMonths(3); setSettled(true);
    const monthParam = `${baseDate.getFullYear()}-${String(baseDate.getMonth()+1).padStart(2,"0")}`;
    setTimeout(() => { setSuccess(null); navigate({ to: "/transacoes", search: { month: monthParam } }); }, 900);
  };

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">
      <form onSubmit={handleSubmit(onSubmit)}>

        {/* ── HEADER COLORIDO ─────────────────────────────────────────── */}
        <div className={cn(headerBg, "px-5 pt-5 pb-10 text-white")}>
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={() => navigate({ to: "/transacoes" })}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-base">Nova transação</span>
            <div className="w-9" />
          </div>

          {/* Toggle Receita / Despesa */}
          <div className="flex rounded-2xl bg-white/20 p-1 gap-1 mb-5">
            {(["expense", "income"] as const).map(tp => (
              <button key={tp} type="button" onClick={() => setTransactionType(tp)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  transactionType === tp
                    ? `bg-white shadow-sm ${tp === "expense" ? "text-rose-500" : "text-emerald-600"}`
                    : "text-white/80 hover:text-white"
                )}>
                {tp === "expense"
                  ? <TrendingDown className="h-4 w-4" />
                  : <TrendingUp className="h-4 w-4" />}
                {tp === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          {/* Valor grande */}
          <div>
            <p className="text-white/70 text-sm mb-1">Valor</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white/70">R$</span>
              <input
                type="text" inputMode="decimal"
                value={amountDisplay}
                onChange={e => handleAmountChange(e.target.value)}
                className="flex-1 bg-transparent text-white outline-none border-none text-4xl font-bold placeholder-white/40 min-w-0" style={{ fontSize: "clamp(2rem, 8vw, 2.5rem)" }}
                placeholder="0,00"
              />
            </div>
            {errors.amount && (
              <p className="text-white/80 text-xs mt-1 bg-white/10 rounded-lg px-2 py-1">
                {errors.amount.message}
              </p>
            )}
          </div>
        </div>

        {/* Formulário com -mt para "sobrepor" o header */}
        <div className="-mt-6 pb-6">

          {/* ── Informações ──────────────────────────────────────────── */}
          <TxSection title="Informações">
            {/* Descrição */}
            <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" error={errors.title?.message}>
              <input
                {...register("title")}
                className="text-base font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-400 dark:placeholder-muted-foreground"
                placeholder="Ex: Supermercado, Salário..."
                autoComplete="off"
              />
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
              last
              error={errors.category?.message}
            >
              <p className={cn("text-[15px] font-medium", categoryValue ? "text-slate-800 dark:text-foreground" : "text-slate-400 dark:text-muted-foreground")}>
                {categoryValue || "Selecione uma categoria"}
              </p>
            </FieldRow>
          </TxSection>

          {/* ── Data e pagamento ─────────────────────────────────────── */}
          <TxSection title="Data e pagamento">
            <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data">
              <DatePicker value={dateValue} onChange={v => setValue("date", v)} />
            </FieldRow>
            <SwitchRow
              icon={<CheckCircle2 className={cn("h-5 w-5", isIncome ? "text-emerald-500" : "text-rose-500")} />}
              label={isIncome ? "Recebida" : "Paga"}
              description={isFuture
                ? "Data futura — disponível após a data"
                : `Marque se já foi ${isIncome ? "recebida" : "paga"}`}
              checked={settled && !isFuture}
              onCheckedChange={setSettled}
              disabled={isFuture}
              last
            />
          </TxSection>

          {/* ── Repetição ────────────────────────────────────────────── */}
          <TxSection title="Repetição">
            <SwitchRow
              icon={<Repeat className="h-5 w-5" />}
              label="Recorrente"
              description={`Replica pelos próximos ${RECURRING_MONTHS} meses`}
              checked={recurring}
              onCheckedChange={v => { setRecurring(v); if (v) setRepeat(false); }}
            />

            {/* Repetir N meses */}
            <div className={cn(
              "border-b border-slate-100 dark:border-border",
              repeat && "bg-slate-50/80 dark:bg-muted/20"
            )}>
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground">
                  <Repeat2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">Repetir N meses</p>
                  <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">
                    {repeat ? `${repeatMonths} parcelas a partir desta data` : "Cria cópias nos próximos meses"}
                  </p>
                </div>
                <Switch checked={repeat} onCheckedChange={v => { setRepeat(v); if (v) setRecurring(false); }} />
              </div>

              {/* Stepper */}
              {repeat && (
                <div className="flex items-center justify-between px-4 pb-3.5">
                  <p className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Quantidade de meses</p>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setRepeatMonths(n => Math.max(2, n - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-border bg-white dark:bg-background text-slate-600 dark:text-foreground hover:bg-slate-50 transition-colors">
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="flex w-10 flex-col items-center">
                      <span className="text-xl font-bold" style={{ color: accentColor }}>{repeatMonths}</span>
                      <span className="text-[10px] text-slate-400 dark:text-muted-foreground">
                        {repeatMonths === 1 ? "mês" : "meses"}
                      </span>
                    </div>
                    <button type="button"
                      onClick={() => setRepeatMonths(n => Math.min(36, n + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-border bg-white dark:bg-background text-slate-600 dark:text-foreground hover:bg-slate-50 transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recorrente info (quando selecionada) */}
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">Parcelamento de cartão?</p>
                <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">
                  Use "Nova Despesa Cartão" para parcelamento via fatura
                </p>
              </div>
            </div>
          </TxSection>

          {/* ── Botão submit ─────────────────────────────────────────── */}
          <div className="mx-4 mt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl text-white font-bold text-[17px] shadow-lg transition-all active:scale-95 disabled:opacity-70"
              style={{ backgroundColor: accentColor, boxShadow: `0 8px 24px ${accentColor}55` }}>
              {isSubmitting ? "Salvando..." : isIncome ? "Registrar receita" : "Registrar despesa"}
            </button>
          </div>

          {/* ── Sucesso ──────────────────────────────────────────────── */}
          {success && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl p-4 text-sm font-semibold text-white"
              style={{ backgroundColor: accentColor }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {success}
            </div>
          )}
        </div>
      </form>

      {/* ── Modal Categoria ──────────────────────────────────────────────── */}
      <Dialog open={openCat} onOpenChange={v => { setOpenCat(v); if (!v) setCatSearch(""); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle>Selecionar categoria</DialogTitle>
          </DialogHeader>
          <div className="relative mx-4 mt-3 mb-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Pesquisar categoria"
              value={catSearch} onChange={e => setCatSearch(e.target.value)}
              className="h-10 w-full rounded-lg bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="max-h-72 overflow-y-auto pb-2">
            {filtered.length === 0
              ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma categoria encontrada</p>
              : filtered.map(cat => {
                const isSel   = categoryValue === cat.name;
                const color   = cat.color || "#6b7280";
                const isEmoji = isValidEmoji(cat.icon || "");
                return (
                  <button key={cat.id} type="button"
                    onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white"
                      style={{ background: color }}>
                      {isEmoji ? cat.icon : (cat.name[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                      style={{ borderColor: isSel ? color : "#d1d5db", background: isSel ? color : "transparent" }}>
                      {isSel && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
