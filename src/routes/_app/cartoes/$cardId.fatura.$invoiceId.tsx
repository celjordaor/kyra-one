import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ShoppingBag, RotateCcw, Layers, Undo2,
  Eye, Pencil, Lock, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCardStore, type ExpenseType } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes/$cardId/fatura/$invoiceId")({
  component: FaturaDetailPage,
});

const TYPE_LABEL: Record<ExpenseType, string> = {
  single: "Única", installment: "Parcelada", recurring: "Recorrente",
};
const TYPE_CLASS: Record<ExpenseType, string> = {
  single:      "bg-slate-100 text-slate-600",
  installment: "bg-blue-100 text-blue-700",
  recurring:   "bg-purple-100 text-purple-700",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

type UnifiedItem = {
  id: string; description: string; category: string;
  amount: number; purchase_date: string; expense_type: ExpenseType;
  isInstallment: boolean; invoiceId: string;
  parentExpenseId?: string;
  installmentNumber?: number;
  cardId?: string;
};

function FaturaDetailPage() {
  const { cardId, invoiceId } = Route.useParams();
  const router = useRouter();
  const {
    cards, invoices, fetchCards, fetchInvoices, fetchExpenses, fetchInstallments,
    payInvoice, reverseInvoice, ensureInvoices,
    getInvoiceExpenses, getInvoiceInstallments,
  } = useCardStore();

  const categories = useCategories();
  const categoryIconMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.name, c.icon ?? "📦"])),
    [categories]
  );

  const [paying, setPaying]             = useState(false);
  const [reversing, setReversing]       = useState(false);
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [loading, setLoading]     = useState(true);

  const card    = cards.find(c => c.id === cardId);
  const invoice = invoices.find(i => i.id === invoiceId);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (useCardStore.getState().cards.length === 0) await fetchCards();
        const c = useCardStore.getState().cards.find(c => c.id === cardId);
        if (!c) return;
        await ensureInvoices(c);
        await fetchInvoices(cardId);
        await fetchExpenses(invoiceId);
        await fetchInstallments(invoiceId);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [invoiceId, cardId]);

  const rawExpenses     = getInvoiceExpenses(invoiceId);
  const rawInstallments = getInvoiceInstallments(invoiceId);

  // Lista unificada ordenada por data DESC (mais recente primeiro)
  const allItems: UnifiedItem[] = [
    ...rawExpenses.map(e => ({
      id: e.id, description: e.description, category: e.category,
      amount: e.amount, purchase_date: e.purchase_date,
      expense_type: e.expense_type, isInstallment: false, invoiceId, cardId,
    })),
    ...rawInstallments.map(i => ({
      id: i.id, description: i.description, category: i.category,
      amount: i.amount, purchase_date: i.purchase_date,
      expense_type: "installment" as ExpenseType, isInstallment: true, invoiceId,
      parentExpenseId: i.parent_expense_id,
      installmentNumber: i.installment_number,
    })),
  ].sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

  // Agrupa por data (yyyy-mm-dd) para exibir separadores de dia
  const itemsByDay = useMemo(() => {
    const map: Record<string, UnifiedItem[]> = {};
    for (const item of allItems) {
      if (!map[item.purchase_date]) map[item.purchase_date] = [];
      map[item.purchase_date].push(item);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allItems]);

  const handlePay = async () => {
    if (!card || !invoice) return;
    setPaying(true);
    try { await payInvoice(invoiceId, card); toast.success("Fatura marcada como paga!"); }
    catch { toast.error("Erro ao pagar fatura."); }
    finally { setPaying(false); }
  };

  const handleReverse = async () => {
    setConfirmReverse(true);
  };

  const doReverse = async () => {
    setReversing(true);
    try { await reverseInvoice(invoiceId); toast.success("Fatura estornada."); }
    catch { toast.error("Erro ao estornar."); }
    finally { setReversing(false); }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      <div className="text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm">Carregando fatura...</p>
      </div>
    </div>
  );

  if (!invoice || !card) return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      Fatura não encontrada.
    </div>
  );

  const isPaid   = invoice.status === "paid";
  const isClosed = invoice.status === "closed";
  const isOpen   = invoice.status === "open";
  const invoiceStatus: "open" | "closed" | "paid" = isPaid ? "paid" : isClosed ? "closed" : "open";

  const closingDate = new Date(invoice.closing_date + "T12:00:00");
  const dueDate     = new Date(invoice.due_date + "T12:00:00");
  const today       = new Date(); today.setHours(0,0,0,0);
  const isOverdue   = !isPaid && dueDate < today;

  return (
    <div className="w-screen max-w-[100vw] overflow-x-hidden min-h-screen bg-background md:w-full md:max-w-2xl md:mx-auto md:overflow-x-visible">

      {/* ── CABEÇALHO GRADIENTE ──────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-5 pb-6 text-white">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"/>
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/10"/>
        <div className="relative">
          {/* Voltar + botão lançar despesa */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => router.history.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <ArrowLeft className="h-5 w-5"/>
            </button>
            <div className="text-center">
              <p className="text-xs text-white/60 leading-none uppercase tracking-wide">Fatura</p>
              <p className="text-base font-bold leading-tight">{card.name} · {invoice.competence}</p>
            </div>
            {/* Lançar despesa nesta fatura — passa cardId para pré-selecionar o cartão correto */}
            {!isPaid ? (
              <button
                onClick={() => router.navigate({ to: "/cartoes/nova-despesa", search: { cardId } })}
                className="flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 px-3 h-9 text-sm font-bold transition-colors">
                <span className="text-base leading-none">+</span> Despesa
              </button>
            ) : (
              <div className="w-9"/>
            )}
          </div>

          {/* Total em destaque */}
          <p className="text-4xl font-black tracking-tight mb-4">{fmt(invoice.total_amount)}</p>

          {/* Stats: fechamento, vencimento, status */}
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-[11px] text-white/60 uppercase tracking-wide">Fechamento</p>
              <p className="text-sm font-semibold">{closingDate.toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="w-px bg-white/20"/>
            <div>
              <p className="text-[11px] text-white/60 uppercase tracking-wide">Vencimento</p>
              <p className={cn("text-sm font-semibold", isOverdue && "text-red-300")}>
                {dueDate.toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="w-px bg-white/20"/>
            <div>
              <p className="text-[11px] text-white/60 uppercase tracking-wide">Status</p>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                isPaid   ? "bg-emerald-400/30 text-emerald-100" :
                isOverdue? "bg-red-400/30 text-red-100" :
                isClosed ? "bg-slate-300/30 text-white/80" :
                           "bg-amber-400/30 text-amber-100"
              )}>
                {isPaid ? "✓ Paga" : isOverdue ? "⚠ Vencida" : isClosed ? "🔒 Fechada" : "● Em aberto"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AÇÕES (pagar / estornar) ──────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        {!isPaid && (
          <div className="space-y-2">
            {invoice.total_amount === 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[13px] text-amber-700">
                <span>ℹ️</span> Fatura zerada — nenhum lançamento neste período.
              </div>
            )}
            <Button className="h-12 w-full gap-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-base rounded-2xl shadow-lg shadow-emerald-600/20"
              onClick={handlePay} disabled={paying}>
              <CheckCircle2 className="h-5 w-5"/>
              {paying ? "Processando..." : invoice.total_amount === 0 ? "Marcar como quitada" : "Pagar fatura"}
            </Button>
          </div>
        )}
        {isPaid && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4"/> Fatura paga · Transação registrada
            </div>
            <Button variant="outline"
              className="h-10 w-full gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={handleReverse} disabled={reversing}>
              <Undo2 className="h-4 w-4"/>
              {reversing ? "Estornando..." : "Estornar fatura"}
            </Button>
          </div>
        )}
      </div>

      {/* ── LANÇAMENTOS agrupados por data ───────────────────────────── */}
      <div className="px-4 pb-10">
        {/* Cabeçalho da seção */}
        <div className="flex items-center justify-between py-3">
          <h2 className="text-sm font-bold text-foreground">
            Lançamentos ({allItems.length})
          </h2>
          {!isOpen && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3"/>
              {isPaid ? "Paga · somente leitura" : "Fechada · somente leitura"}
            </span>
          )}
        </div>

        {allItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-2xl border border-dashed">
            <CreditCard className="h-10 w-10 mb-3 opacity-30"/>
            <p className="text-sm">Nenhuma despesa nesta fatura.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {itemsByDay.map(([date, items]) => {
              const [yyyy, mm, dd] = date.split("-").map(Number);
              const d = new Date(yyyy, mm - 1, dd);
              const weekday = DAY_NAMES[d.getDay()];
              return (
                <div key={date}>
                  {/* Separador de dia — sem total */}
                  <div className="flex items-center gap-2 pt-4 pb-2">
                    <span className="text-base font-bold text-foreground">{weekday}, {dd}</span>
                    <span className="text-xs text-muted-foreground">/{mm.toString().padStart(2,"0")}</span>
                  </div>

                  {/* Itens do dia */}
                  <div className="rounded-2xl bg-card border overflow-hidden">
                    {items.map((item, i) => (
                      <button key={item.id} type="button"
                        onClick={() => router.navigate({
                          to: "/cartoes/editar-despesa",
                          search: {
                            expenseId:     item.id,
                            isInstallment: item.isInstallment,
                            invoiceId:     item.invoiceId,
                            cardId:        cardId,
                            invoiceStatus: invoiceStatus,
                          }
                        })}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30",
                          i < items.length - 1 && "border-b border-border/40"
                        )}>
                        {/* Ícone emoji da categoria */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                          style={{ background: "#ede9fe" }}>
                          {categoryIconMap[item.category] ?? "📦"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{item.description}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <p className="text-xs text-muted-foreground truncate">{item.category}</p>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0", TYPE_CLASS[item.expense_type])}>
                              {TYPE_LABEL[item.expense_type]}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <p className="text-[15px] font-bold text-indigo-600">{fmt(item.amount)}</p>
                          <div className={cn("flex h-7 w-7 items-center justify-center rounded-full",
                            isPaid ? "bg-muted text-muted-foreground" : "bg-indigo-50 text-indigo-500"
                          )}>
                            {isPaid ? <Eye className="h-3.5 w-3.5"/> : <Pencil className="h-3.5 w-3.5"/>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReverse}
        title="Estornar fatura"
        description="Estornar esta fatura irá remover a transação de pagamento registrada. Essa ação não pode ser desfeita."
        confirmLabel="Estornar"
        onConfirm={() => { setConfirmReverse(false); doReverse(); }}
        onClose={() => setConfirmReverse(false)}
      />
    </div>
  );
}
