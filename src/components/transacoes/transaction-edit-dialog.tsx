// src/components/transacoes/transaction-edit-dialog.tsx
// Modal único de edição/exclusão de transação (avulsa, recorrente ou parcelada).
// Usado tanto pela tela de Transações (_app.transacoes.tsx) quanto pelo
// Dashboard (_app.dashboard.tsx) — antes cada tela tinha sua própria cópia
// (EditTransactionDialog / DashboardEditTxDialog), com comportamentos
// divergentes: uma tinha botão de excluir e a outra não, uma preservava o
// mês de cada parcela ao editar em lote e a outra sobrescrevia a mesma data
// em todos os lançamentos futuros (bug). Esta versão unifica as duas,
// mantendo sempre o melhor comportamento das duas telas.
import { useState } from "react";
import { X, TrendingUp, TrendingDown, ChevronRight, Search, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/cartoes/date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCategories } from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import {
  updateTransaction, deleteTransactionWithScope, getFutureSeriesMembers,
  parseBrDate, formatBrDate, isTodayOrPast, type Transaction,
} from "@/lib/transactions-store";

function brDateToIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

export function TransactionEditDialog({
  transaction, bulkEdit = false, allTransactions = [], onClose, onSaved, onDeleted,
}: {
  transaction: Transaction | null;
  bulkEdit?: boolean;
  allTransactions?: Transaction[];
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const categories = useCategories();
  const open = transaction !== null;

  // ── Estado do formulário — inicializado a partir da transação recebida ──
  const [title, setTitle]             = useState(transaction?.title ?? "");
  const [type, setType]               = useState<"income"|"expense">(transaction?.type ?? "expense");
  const [category, setCategory]       = useState(transaction?.category ?? "");
  const [amountDisplay, setAmountDisplay] = useState(
    transaction ? Math.abs(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }) : ""
  );
  const [dateIso, setDateIso]         = useState(transaction ? brDateToIso(transaction.date) : "");
  const [settled, setSettled]         = useState(transaction?.settled ?? false);
  const [saving, setSaving]           = useState(false);
  const [openCat, setOpenCat]         = useState(false);
  const [catSearch, setCatSearch]     = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Guarda a chave da transação carregada no form, pra reinicializar o
  // estado quando uma transação diferente é passada (o componente nunca
  // desmonta entre uma edição e outra, só o prop `transaction` muda).
  const [loadedId, setLoadedId] = useState(transaction?.id ?? null);
  if (transaction && transaction.id !== loadedId) {
    setLoadedId(transaction.id);
    setTitle(transaction.title);
    setType(transaction.type);
    setCategory(transaction.category);
    setAmountDisplay(Math.abs(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }));
    setDateIso(brDateToIso(transaction.date));
    setSettled(transaction.settled);
  }

  if (!open || !transaction) return null;

  const isFuture = dateIso ? !isTodayOrPast(dateIso) : false;
  const availableCategories = categories.filter(c => c.active && c.type === type);
  const selectedCat = availableCategories.find(c => c.name === category);
  const accent = type === "income" ? "#10b981" : "#f43f5e";

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); return; }
    const val = (parseInt(digits,10)/100).toLocaleString("pt-BR",{ minimumFractionDigits:2, maximumFractionDigits:2 });
    setAmountDisplay(val);
  }

  function parseAmount(): number {
    return parseFloat(amountDisplay.replace(/\./g,"").replace(",",".")) || 0;
  }

  async function handleSave() {
    if (!transaction) return;
    if (!title.trim()) { toast.error("Informe a descrição."); return; }
    if (!category)     { toast.error("Selecione uma categoria."); return; }
    if (!dateIso)       { toast.error("Informe a data."); return; }

    const numeric  = parseAmount();
    const signed   = type === "expense" ? -numeric : numeric;
    const [y,m,d]  = dateIso.split("-").map(Number);
    const brDate   = formatBrDate(new Date(y, m-1, d));
    const todayStr = formatBrDate(new Date());
    const paidAt   = settled ? (transaction.settled ? (transaction.paidAt ?? todayStr) : todayStr) : undefined;

    setSaving(true);
    try {
      if (bulkEdit) {
        // Edição em lote: aplica nos lançamentos futuros da série (ver
        // getFutureSeriesMembers em transactions-store.ts), preservando o
        // mês/ano de cada parcela — só o dia escolhido é replicado. Data,
        // settled/paidAt só se aplicam à transação atual, nunca às outras.
        const newDay = d;
        const futures = getFutureSeriesMembers(transaction, allTransactions);
        await Promise.all(futures.map(t => {
          const patch: Partial<Transaction> = {};
          if (title.trim() !== transaction.title) patch.title = title.trim();
          if (category !== transaction.category) patch.category = category;
          const origSigned = t.type === "expense" ? -Math.abs(Math.abs(transaction.amount)) : Math.abs(transaction.amount);
          if (signed !== origSigned) patch.amount = t.type === "expense" ? -numeric : numeric;
          if (newDay !== parseBrDate(t.date).getDate()) {
            const tDate   = parseBrDate(t.date);
            const lastDay = new Date(tDate.getFullYear(), tDate.getMonth() + 1, 0).getDate();
            patch.date    = formatBrDate(new Date(tDate.getFullYear(), tDate.getMonth(), Math.min(newDay, lastDay)));
          }
          if (t.id === transaction.id) { patch.settled = settled; patch.paidAt = paidAt; }
          if (Object.keys(patch).length > 0) return updateTransaction(t.id, patch);
          return Promise.resolve();
        }));
      } else {
        await updateTransaction(transaction.id, { title: title.trim(), amount: signed, type, category, date: brDate, settled, paidAt });
      }
      toast.success("Transação atualizada!");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!transaction) return;
    setConfirmDelete(false);
    setSaving(true);
    try {
      // Ponto único de decisão single/série — ver deleteTransactionWithScope
      // em transactions-store.ts.
      await deleteTransactionWithScope(transaction, bulkEdit ? "bulk" : "single");
      toast.success("Transação excluída.");
      onDeleted?.();
      onClose();
    } catch {
      toast.error("Erro ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}/>
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:inset-0 md:items-center md:justify-center">
        <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-md md:rounded-2xl"
          style={{ maxHeight:"90dvh" }}>

          {/* Cabeçalho gradiente — compacto, sem scroll */}
          <div className="relative overflow-hidden px-4 pt-4 pb-4 text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${accent}dd, ${accent}99)` }}>
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10"/>
            <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-white/10"/>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] text-white/60 uppercase tracking-wide leading-none">
                    {bulkEdit ? "Editar série" : "Editar transação"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {bulkEdit && (
                      <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Todas as parcelas
                      </span>
                    )}
                    {transaction.settled && (
                      <span className="inline-flex text-[10px] font-semibold rounded-full bg-white/20 px-2 py-0.5 text-white">
                        Lançamento pago
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                  <X className="h-4 w-4"/>
                </button>
              </div>
              {/* Toggle tipo */}
              <div className="flex rounded-xl bg-white/15 p-1 gap-1 mb-3">
                {(["expense","income"] as const).map(tp => (
                  <button key={tp} type="button" onClick={() => setType(tp)}
                    className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all",
                      type===tp ? "bg-white text-slate-800 shadow-sm" : "text-white/80 hover:text-white")}>
                    {tp === "expense" ? <TrendingDown className="h-3.5 w-3.5"/> : <TrendingUp className="h-3.5 w-3.5"/>}
                    {tp === "expense" ? "Despesa" : "Receita"}
                  </button>
                ))}
              </div>
              {/* Valor */}
              <div>
                <p className="text-[11px] text-white/60 mb-0.5">Valor</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-white/70">R$</span>
                  <input inputMode="decimal" value={amountDisplay} onChange={e => handleAmountChange(e.target.value)}
                    placeholder="0,00"
                    className="bg-transparent text-3xl font-black text-white placeholder-white/40 outline-none w-full tracking-tight"/>
                </div>
              </div>
            </div>
          </div>

          {/* Campos — sem scroll próprio: tudo cabe numa tela só */}
          <div className="overflow-y-auto flex-1">
            <div className="px-4 py-3 space-y-2">
              {/* Descrição */}
              <div className="rounded-xl border bg-card px-3.5 py-2.5 space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Descrição</p>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Nome da transação"
                  className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
              </div>
              {/* Categoria */}
              <button type="button" onClick={() => setOpenCat(true)}
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-muted/30 transition-colors">
                {selectedCat ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ background: (selectedCat.color||"#6b7280")+"22" }}>
                    {(selectedCat.icon?.codePointAt(0)??0)>0x2000 ? selectedCat.icon : "📦"}
                  </div>
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><span className="text-[11px]">📦</span></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
                  <p className={cn("text-[15px] font-semibold", category?"text-foreground":"text-muted-foreground/50")}>
                    {category || "Selecione a categoria"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>
              </button>
              {/* Data */}
              <div className="rounded-xl border bg-card px-3.5 py-2.5 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</p>
                <DatePicker value={dateIso} onChange={setDateIso}/>
                {bulkEdit && (
                  <p className="text-[10.5px] text-muted-foreground">
                    ℹ️ Altera apenas o <strong>dia</strong> — cada parcela mantém seu próprio mês.
                  </p>
                )}
              </div>
              {/* Pago/Recebido */}
              <div className="rounded-xl border bg-card px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{type==="income"?"Recebida":"Paga"}</p>
                  <p className="text-[11px] text-muted-foreground">{isFuture?"Antecipar efetivação":"Marca como concluída"}</p>
                </div>
                <Switch checked={settled} onCheckedChange={setSettled}/>
              </div>
            </div>
          </div>

          {/* Rodapé de ações — sempre visível, igual mobile/desktop */}
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-sm text-red-500 font-medium hover:text-red-600 shrink-0">
              <Trash2 className="h-4 w-4"/> Excluir
            </button>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 h-9 rounded-xl border text-sm text-muted-foreground hover:bg-muted/50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 h-9 rounded-xl text-white font-semibold text-sm disabled:opacity-70 flex items-center gap-1.5"
                style={{ background: accent }}>
                <Save className="h-3.5 w-3.5"/> {saving?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BottomSheet de Categoria */}
      {openCat && (
        <>
          <div className="fixed inset-0 z-[600] bg-black/50" onClick={() => { setOpenCat(false); setCatSearch(""); }}/>
          <div className="fixed bottom-0 left-0 right-0 z-[601] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden" style={{ maxHeight:"80vh" }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200"/>
            </div>
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b">
              <h2 className="text-[18px] font-bold">Categoria</h2>
              <button onClick={() => { setOpenCat(false); setCatSearch(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <X className="h-4 w-4 text-slate-500"/>
              </button>
            </div>
            <div className="px-4 pt-3 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input type="text" placeholder="Buscar..." value={catSearch} onChange={e => setCatSearch(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-slate-100 pl-11 pr-4 text-base outline-none"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 px-4 pb-8">
                {availableCategories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
                  const isSel = category === cat.name;
                  const color = cat.color || "#6b7280";
                  const emoji = (cat.icon?.codePointAt(0)??0) > 0x2000;
                  return (
                    <button key={cat.name} type="button"
                      onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                      className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                      style={isSel ? { background: color+"18", borderColor: color+"66" } : { borderColor:"transparent", background:"#f8fafc" }}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" style={{ background: color+"22" }}>
                        {emoji ? cat.icon : "📦"}
                      </div>
                      <span className="text-[13px] font-semibold text-slate-700 leading-tight">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir transação"
        description={`Deseja excluir "${transaction.title}"${bulkEdit ? " e todos os lançamentos futuros da série" : ""}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
