import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, TrendingUp, TrendingDown, Repeat, Repeat2,
  Minus, Plus, CheckCircle2, ChevronRight, Tag, Calendar,
  FileText, Layers, Search, X,
} from "lucide-react";
import { DatePicker } from "@/components/cartoes/date-picker";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/lib/categories-store";
import { addTransactions, formatBrDate, isTodayOrPast, calcInstallmentDate } from "@/lib/transactions-store";
import { cn } from "@/lib/utils";

const RECURRING_MONTHS = 24;

export const Route = createFileRoute("/_app/nova-transacao")({
  head: () => ({ meta: [{ title: "Nova Transação — JadeOne" }] }),
  validateSearch: z.object({ type: z.enum(["income", "expense"]).optional() }),
  component: NovaTransacaoPage,
});

const schema = z.object({
  title:    z.string().min(2, "Informe a descrição"),
  amount:   z.string().min(1, "Informe o valor"),
  category: z.string().min(1, "Selecione uma categoria"),
  date:     z.string().min(1, "Informe a data"),
});
type TxForm = z.infer<typeof schema>;

function isEmoji(s: string) { return (s?.codePointAt(0) ?? 0) > 0x2000; }

// ── Bottom Sheet customizado (sem Radix Dialog) ────────────────────────────
function BottomSheet({
  open, onClose, title, maxHeight = "78vh", children,
}: {
  open: boolean; onClose: () => void; title: string;
  maxHeight?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[201] flex flex-col bg-white dark:bg-card rounded-t-3xl overflow-hidden"
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

// ── Seção visual ─────────────────────────────────────────────────────────
function TxSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-4 overflow-hidden">
      {title && <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 px-1">{title}</p>}
      <div className="w-full rounded-2xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border overflow-hidden">
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
  const base = cn(
    "flex items-center gap-3 px-4 w-full text-left",
    !last && "border-b border-slate-100 dark:border-border",
    onClick && "active:bg-slate-50"
  );
  const inner = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0 py-4 overflow-hidden">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        {children}
        {error && <p className="text-[12px] text-destructive mt-1">{error}</p>}
      </div>
      {onClick && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={base}>{inner}</button>
    : <div className={base}>{inner}</div>;
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
      "flex items-center gap-3 px-4 py-4",
      !last && "border-b border-slate-100 dark:border-border",
      disabled && "opacity-50"
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-medium text-slate-800 dark:text-foreground">{label}</p>
        <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
function NovaTransacaoPage() {
  const navigate   = useNavigate();
  const { type: initialType } = Route.useSearch();
  const [tipo, setTipo]               = useState<"income" | "expense">(initialType ?? "expense");
  const [recurring, setRecurring]     = useState(false);
  const [repeat, setRepeat]           = useState(false);
  const [repeatMonths, setRepeatMonths] = useState(3);
  const [settled, setSettled]         = useState(true);
  const [success, setSuccess]         = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [openCat, setOpenCat]         = useState(false);
  const [catSearch, setCatSearch]     = useState("");

  const allCats  = useCategories();
  const cats     = allCats.filter(c => c.active && c.type === tipo);
  const filtered = cats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<TxForm>({
      resolver: zodResolver(schema),
      defaultValues: { title: "", amount: "", category: "", date: new Date().toISOString().split("T")[0] },
    });

  const dateValue     = watch("date");
  const categoryValue = watch("category");
  const isFuture      = dateValue ? !isTodayOrPast(dateValue) : false;
  const selectedCat   = cats.find(c => c.name === categoryValue);
  const isIncome      = tipo === "income";
  const accentHex     = isIncome ? "#10b981" : "#f43f5e";
  const headerBg      = isIncome ? "bg-emerald-500" : "bg-rose-500";

  useEffect(() => { setValue("category", ""); }, [tipo]);
  useEffect(() => { if (isFuture) setSettled(false); else setSettled(true); }, [isFuture]);

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); setValue("amount", "", { shouldValidate: true }); return; }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    setAmountDisplay(parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setValue("amount", value, { shouldValidate: true });
  }

  const onSubmit = async (data: TxForm) => {
    await new Promise(r => setTimeout(r, 200));
    const numeric = parseFloat(data.amount);
    const signed  = tipo === "expense" ? -Math.abs(numeric) : Math.abs(numeric);
    const [y, m, d] = data.date.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    const label = isIncome ? "Receita" : "Despesa";

    if (repeat && repeatMonths > 1) {
      const rid = crypto.randomUUID();
      addTransactions(Array.from({ length: repeatMonths }, (_, i) => {
        const dt = calcInstallmentDate(y, m, d, i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return { title: data.title, amount: signed, type: tipo,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso),
          recurring: false, source: "manual" as const,
          installment_number: i + 1, installments_total: repeatMonths, recurrence_id: rid };
      }));
      setSuccess(`${label} parcelada em ${repeatMonths}x!`);
    } else {
      const count = recurring ? RECURRING_MONTHS : 1;
      addTransactions(Array.from({ length: count }, (_, i) => {
        const dt = new Date(base); dt.setMonth(dt.getMonth() + i);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        return { title: data.title, amount: signed, type: tipo,
          date: formatBrDate(dt), category: data.category,
          settled: i === 0 ? settled : isTodayOrPast(iso), recurring, source: "manual" as const };
      }));
      setSuccess(recurring ? `${label} recorrente criada!` : `${label} adicionada!`);
    }

    reset(); setAmountDisplay(""); setRecurring(false); setRepeat(false); setRepeatMonths(3); setSettled(true);
    const mp = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,"0")}`;
    setTimeout(() => { setSuccess(null); navigate({ to: "/transacoes", search: { month: mp } }); }, 800);
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto" >
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className={cn(headerBg, "w-full text-white px-4 pb-8")}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={() => navigate({ to: "/transacoes" })}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-bold text-[17px]">Nova transação</span>
            <div className="w-10" />
          </div>
          <div className="flex rounded-2xl bg-white/20 p-1 gap-1">
            {(["expense", "income"] as const).map(tp => (
              <button key={tp} type="button" onClick={() => setTipo(tp)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold",
                  tipo === tp
                    ? `bg-white shadow ${tp === "expense" ? "text-rose-500" : "text-emerald-600"}`
                    : "text-white/80"
                )}>
                {tp === "expense" ? <TrendingDown className="h-4 w-4 shrink-0" /> : <TrendingUp className="h-4 w-4 shrink-0" />}
                {tp === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>
        </div>

        {/* ── VALOR ─────────────────────────────────────────────────── */}
        <div className="mx-4 -mt-4 mb-5 rounded-3xl bg-white dark:bg-card shadow-xl border border-white/50 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: accentHex }}>VALOR</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-400 shrink-0">R$</span>
              <input type="text" inputMode="decimal"
                value={amountDisplay} onChange={e => handleAmountChange(e.target.value)}
                className="min-w-0 flex-1 font-bold text-slate-800 dark:text-foreground bg-transparent outline-none placeholder-slate-200"
                style={{ fontSize: "clamp(2rem, 9vw, 3rem)", lineHeight: 1.2 }}
                placeholder="0,00" />
            </div>
            {errors.amount && <p className="text-[12px] text-destructive mt-1">{errors.amount.message}</p>}
          </div>
          <div className="h-1" style={{ background: accentHex }} />
        </div>

        {/* ── INFORMAÇÕES ───────────────────────────────────────────── */}
        <TxSection title="Informações">
          <FieldRow icon={<FileText className="h-5 w-5" />} label="Descrição" error={errors.title?.message}>
            <input {...register("title")}
              className="text-[16px] font-medium text-slate-800 dark:text-foreground bg-transparent outline-none w-full placeholder-slate-300"
              placeholder="Ex: Supermercado, Salário..." autoComplete="off" />
          </FieldRow>
          <FieldRow
            icon={selectedCat
              ? <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
                  {isEmoji(selectedCat.icon || "") ? selectedCat.icon : <Tag className="h-5 w-5" />}
                </div>
              : <Tag className="h-5 w-5" />}
            label="Categoria" onClick={() => setOpenCat(true)} last error={errors.category?.message}>
            <p className={cn("text-[16px] font-medium", categoryValue ? "text-slate-800 dark:text-foreground" : "text-slate-300")}>
              {categoryValue || "Selecione a categoria"}
            </p>
          </FieldRow>
        </TxSection>

        {/* ── DATA E PAGAMENTO ──────────────────────────────────────── */}
        <TxSection title="Data e pagamento">
          <FieldRow icon={<Calendar className="h-5 w-5" />} label="Data">
            <DatePicker value={dateValue} onChange={v => setValue("date", v)} />
          </FieldRow>
          <SwitchRow
            icon={<CheckCircle2 className={cn("h-5 w-5", isIncome ? "text-emerald-500" : "text-rose-500")} />}
            label={isIncome ? "Recebida" : "Paga"}
            description={isFuture ? "Data futura — disponível após a data" : `Marque se já foi ${isIncome ? "recebida" : "paga"}`}
            checked={settled && !isFuture} onCheckedChange={setSettled} disabled={isFuture} last />
        </TxSection>

        {/* ── REPETIÇÃO ─────────────────────────────────────────────── */}
        <TxSection title="Repetição">
          <SwitchRow icon={<Repeat className="h-5 w-5" />} label="Recorrente"
            description={`Replica pelos próximos ${RECURRING_MONTHS} meses`}
            checked={recurring} onCheckedChange={v => { setRecurring(v); if (v) setRepeat(false); }} />

          <div className={cn(repeat && "bg-slate-50/80 dark:bg-muted/20")}>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 dark:border-border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-500">
                <Repeat2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-medium text-slate-800 dark:text-foreground">Repetir N meses</p>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  {repeat ? `${repeatMonths} parcelas a partir desta data` : "Cria cópias nos próximos meses"}
                </p>
              </div>
              <Switch checked={repeat} onCheckedChange={v => { setRepeat(v); if (v) setRecurring(false); }} />
            </div>
            {repeat && (
              <div className="flex items-center justify-between px-4 pb-4 pt-2 border-b border-slate-100 dark:border-border">
                <p className="text-[13px] text-slate-500">Meses</p>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setRepeatMonths(n => Math.max(2, n - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-200 dark:border-border bg-white dark:bg-background">
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex w-10 flex-col items-center">
                    <span className="text-xl font-bold" style={{ color: accentHex }}>{repeatMonths}</span>
                    <span className="text-[11px] text-slate-400">{repeatMonths === 1 ? "mês" : "meses"}</span>
                  </div>
                  <button type="button" onClick={() => setRepeatMonths(n => Math.min(36, n + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-200 dark:border-border bg-white dark:bg-background">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <FieldRow icon={<Layers className="h-5 w-5" />} label="Parcelamento de cartão" last>
            <p className="text-[13px] text-slate-400">Use "Nova Despesa Cartão" para parcelamento via fatura</p>
          </FieldRow>
        </TxSection>

        {/* ── BOTÃO ─────────────────────────────────────────────────── */}
        <div className="mx-4 mt-2 mb-4">
          <button type="submit" disabled={isSubmitting}
            className="w-full rounded-2xl text-white font-bold transition-all active:scale-95 disabled:opacity-70"
            style={{ height: "60px", fontSize: "17px", backgroundColor: accentHex, boxShadow: `0 6px 20px ${accentHex}44` }}>
            {isSubmitting ? "Salvando..." : isIncome ? "✓  Registrar receita" : "✓  Registrar despesa"}
          </button>
          {success && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: accentHex }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {success}
            </div>
          )}
        </div>
      </form>

      {/* ── BOTTOM SHEET: CATEGORIA ───────────────────────────────────── */}
      <BottomSheet open={openCat} onClose={() => { setOpenCat(false); setCatSearch(""); }}
        title="Categoria">
        <div className="px-4 pt-3 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar categoria..."
              value={catSearch} onChange={e => setCatSearch(e.target.value)}
              className="h-11 w-full rounded-2xl bg-slate-100 dark:bg-muted pl-11 pr-4 text-base outline-none placeholder-slate-400" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 pb-8">
          {filtered.length === 0
            ? <p className="col-span-3 py-8 text-center text-sm text-slate-400">Nenhuma categoria encontrada</p>
            : filtered.map(cat => {
              const isSel = categoryValue === cat.name;
              const color = cat.color || "#6b7280";
              return (
                <button key={cat.id} type="button"
                  onClick={() => { setValue("category", cat.name, { shouldValidate: true }); setOpenCat(false); setCatSearch(""); }}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                  style={isSel ? { background: color + "18", borderColor: color + "66" } : { borderColor: "transparent", background: "#f8fafc" }}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: color + "22" }}>
                    {isEmoji(cat.icon || "") ? cat.icon : (cat.name[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-foreground leading-tight">{cat.name}</span>
                </button>
              );
            })
          }
        </div>
      </BottomSheet>
    </div>
  );
}
