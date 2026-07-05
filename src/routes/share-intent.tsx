import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Share2, ArrowLeft, CreditCard, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle2, ChevronRight, X, Search,
} from "lucide-react";
import { useCardStore } from "@/lib/card-store";
import { useCategories } from "@/lib/categories-store";
import { addTransactions } from "@/lib/transactions-store";
import { DatePicker } from "@/components/cartoes/date-picker";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";

export const Route = createFileRoute("/share-intent")({
  validateSearch: z.object({
    text:  z.string().optional(),
    title: z.string().optional(),
    url:   z.string().optional(),
  }),
  component: ShareIntentPage,
});

// ══════════════════════════════════════════════════════════════════════════
// PARSER DE NOTIFICAÇÕES BANCÁRIAS — 100% client-side, sem API, sem custo
// Cobre os principais bancos brasileiros: Nubank, Itaú, Bradesco, C6,
// Inter, Santander, Caixa, XP, PicPay, Porto, BTG e formato genérico.
// ══════════════════════════════════════════════════════════════════════════

type ParseResult = {
  amount: number;
  merchant: string;
  isCard: boolean;
  cardHint: string | null;
  confidence: number; // 0-1: quão seguro está o parser
};

// Bancos/cartões reconhecidos (usados para identificar o cartão no app)
const BANK_PATTERNS: Array<{ hint: string; rx: RegExp }> = [
  { hint: "Nubank",    rx: /nubank/i },
  { hint: "Itaú",     rx: /ita[uú]/i },
  { hint: "Bradesco",  rx: /bradesco/i },
  { hint: "C6",        rx: /\bc6\b|c6\s*bank/i },
  { hint: "Inter",     rx: /\binter\b/i },
  { hint: "Santander", rx: /santander/i },
  { hint: "Caixa",     rx: /\bcaixa\b/i },
  { hint: "XP",        rx: /\bxp\b/i },
  { hint: "PicPay",    rx: /picpay/i },
  { hint: "Porto",     rx: /\bporto\b/i },
  { hint: "BTG",       rx: /\bbtg\b/i },
  { hint: "Original",  rx: /original/i },
  { hint: "Neon",      rx: /\bneon\b/i },
  { hint: "Sicoob",    rx: /sicoob/i },
  { hint: "Sicredi",   rx: /sicredi/i },
  { hint: "SemParar",  rx: /sem\s*parar/i },
];

// Palavras que indicam CARTÃO DE CRÉDITO
const CARD_WORDS = /cartão|cart[aã]o\s+de\s+cr[eé]dito|crédito|compra\s+aprovada|aprovada?\s+no\s+cart|limite|fatura/i;
// Palavras que indicam DÉBITO / PIX / TRANSFERÊNCIA
const DEBIT_WORDS = /d[eé]bito|pix|ted|doc|transfer[eê]ncia|conta\s+corrente|saldo\s+insuficiente/i;

// Padrões de valor monetário: "R$ 1.234,56", "R$1234,56", "1.234,56" com contexto
const AMOUNT_RX = [
  /R\$\s*([\d]+(?:\.\d{3})*(?:,\d{2})?)/i,       // R$ 1.234,56
  /(?:valor|compra|débito|crédito)[:\s]+R?\$?\s*([\d]+(?:\.\d{3})*(?:,\d{2})?)/i,
  /([\d]+(?:\.\d{3})*,\d{2})/,                    // genérico: 1.234,56
];

// Padrões para extrair o estabelecimento/merchant
const MERCHANT_RX = [
  // "no MERCHANT aprovada" / "no(a) MERCHANT"
  /\b(?:no|na|no\(a\)|na\(o\))\s+([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s&.''´`\-]{2,40?}?)(?:\s+aprovada?|\s+R\$|[.,!?]|$)/i,
  // "em MERCHANT" (evitando capturar datas/cidades comuns)
  /\bem\s+([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s&.''´`\-]{2,40?}?)(?:\s+aprovada?|\s+R\$|[.,!?]|$)/i,
  // "R$ XX - MERCHANT" ou "R$ XX – MERCHANT"
  /R\$\s*[\d.,]+\s*[-–]\s*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s&.''´`\-]{2,40?}?)(?:[.,!?]|$)/i,
  // ": MERCHANT R$" (antes do valor)
  /:\s*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s&.''´`\-]{3,40?}?)\s+R\$/i,
  // Após a primeira linha/banco: "BANCO: MERCHANT R$..."
  /^[^:]+:\s*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s&.''´`\-]{3,40?}?)\s+R\$/im,
];

// Limpeza do nome do merchant
const NOISE_WORDS = /\b(compra|aprovada?|realizada?|cartão|crédito|débito|fatura|banco|app|aplicativo|via|ref|pix|ted|doc)\b/gi;

function cleanMerchant(raw: string): string {
  return raw
    .replace(NOISE_WORDS, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    // Capitaliza primeira letra de cada palavra
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function parseAmount(raw: string): number {
  // Remove pontos de milhar, troca vírgula por ponto
  const clean = raw.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return isNaN(v) ? 0 : v;
}

export function parseNotification(text: string): ParseResult {
  const result: ParseResult = {
    amount: 0,
    merchant: "",
    isCard: true, // default: cartão (conforme instrução do usuário)
    cardHint: null,
    confidence: 0,
  };

  if (!text.trim()) return result;

  // 1. Extrair valor ──────────────────────────────────────────────────────
  for (const rx of AMOUNT_RX) {
    const m = text.match(rx);
    if (m && m[1]) {
      const v = parseAmount(m[1]);
      if (v > 0) { result.amount = v; result.confidence += 0.4; break; }
    }
  }

  // 2. Detectar cartão vs débito ──────────────────────────────────────────
  const hasCardWord  = CARD_WORDS.test(text);
  const hasDebitWord = DEBIT_WORDS.test(text);
  if (hasCardWord && !hasDebitWord) {
    result.isCard = true;
    result.confidence += 0.2;
  } else if (hasDebitWord && !hasCardWord) {
    result.isCard = false;
    result.confidence += 0.2;
  } else {
    // Sem sinal claro: assume cartão (instrução do usuário)
    result.isCard = true;
  }

  // 3. Identificar banco/cartão ───────────────────────────────────────────
  for (const { hint, rx } of BANK_PATTERNS) {
    if (rx.test(text)) {
      result.cardHint = hint;
      result.confidence += 0.1;
      break;
    }
  }

  // 4. Extrair merchant ───────────────────────────────────────────────────
  for (const rx of MERCHANT_RX) {
    const m = text.match(rx);
    if (m && m[1]) {
      const clean = cleanMerchant(m[1]);
      if (clean.length >= 3) {
        result.merchant = clean;
        result.confidence += 0.3;
        break;
      }
    }
  }

  // Fallback: se não achou merchant, usa o texto limpo como descrição
  if (!result.merchant && result.amount > 0) {
    // Remove o valor e o banco do texto e usa o que sobrar
    const stripped = text
      .replace(/R\$\s*[\d.,]+/gi, "")
      .replace(new RegExp(BANK_PATTERNS.map(b => b.rx.source).join("|"), "gi"), "")
      .replace(/\b(aprovada?|compra|crédito|cartão|débito)\b/gi, "")
      .replace(/[^\w\sÀ-ú]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (stripped.length > 3) result.merchant = stripped.substring(0, 40);
  }

  result.confidence = Math.min(result.confidence, 1);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════════

type Mode = "card" | "expense" | "income";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatAmount(raw: string): { display: string; value: number } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { display: "", value: 0 };
  const value = parseInt(digits, 10) / 100;
  return { display: value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), value };
}

function isoToday() { return new Date().toISOString().split("T")[0]; }
function brDate(iso: string) { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; }

function ShareIntentPage() {
  const router = useRouter();
  const { text, title } = Route.useSearch();
  const sharedText = (text || title || "").trim();

  // Parsing síncrono (sem API, sem espera)
  const parsed = useMemo(() => parseNotification(sharedText), [sharedText]);

  // Estado do formulário — inicializado com os dados parseados
  const [mode, setMode] = useState<Mode>(() =>
    parsed.isCard ? "card" : "expense"
  );
  const [amountDisplay, setAmountDisplay] = useState(() =>
    parsed.amount > 0
      ? parsed.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : ""
  );
  const [amountValue, setAmountValue]     = useState(parsed.amount);
  const [description, setDescription]    = useState(parsed.merchant);
  const [category, setCategory]          = useState("");
  const [dateIso, setDateIso]            = useState(isoToday());
  const [settled, setSettled]            = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(() => null);
  const [openCat, setOpenCat]            = useState(false);
  const [catSearch, setCatSearch]        = useState("");
  const [saving, setSaving]              = useState(false);

  // Dados do app
  const { cards, invoices, fetchInvoices } = useCardStore();
  const allCategories = useCategories();

  // Selecionar cartão automaticamente pelo hint do parser
  useMemo(() => {
    if (parsed.cardHint && cards.length > 0) {
      const hint = parsed.cardHint.toLowerCase();
      const match = cards.find(c =>
        c.name.toLowerCase().includes(hint) || c.bank.toLowerCase().includes(hint)
      );
      if (match && !selectedCardId) {
        setSelectedCardId(match.id);
        fetchInvoices(match.id);
      }
    }
  }, [cards, parsed.cardHint]);

  const availableCategories = useMemo(
    () => allCategories.filter(c => mode === "income" ? c.type === "income" : c.type === "expense" || !c.type),
    [allCategories, mode]
  );
  const selectedCat = availableCategories.find(c => c.name === category);

  const cardInvoices = useMemo(() => {
    if (!selectedCardId) return [];
    return invoices
      .filter(i => i.card_id === selectedCardId && i.status === "open")
      .sort((a, b) => a.competence.localeCompare(b.competence));
  }, [invoices, selectedCardId]);

  const defaultInvoice = cardInvoices[0] ?? null;

  const isEmoji = (icon?: string) => (icon?.codePointAt(0) ?? 0) > 0x2000;
  const accentColor = mode === "income" ? "#10b981" : mode === "card" ? "#4f46e5" : "#f43f5e";

  async function handleSubmit() {
    if (!amountValue || amountValue <= 0) { toast.error("Informe o valor."); return; }
    if (!description.trim())              { toast.error("Informe a descrição."); return; }
    if (!category)                        { toast.error("Selecione a categoria."); return; }

    setSaving(true);
    try {
      if (mode === "card") {
        if (!selectedCardId)  { toast.error("Selecione o cartão."); setSaving(false); return; }
        if (!defaultInvoice)  { toast.error("Nenhuma fatura aberta para este cartão."); setSaving(false); return; }
        const card = cards.find(c => c.id === selectedCardId)!;
        await useCardStore.getState().addExpense({
          card,
          invoiceId:    defaultInvoice.id,
          category,
          description:  description.trim(),
          amount:       amountValue,
          purchaseDate: dateIso,
          installments: 1,
          isRecurring:  false,
        });
        toast.success("Lançado no cartão!", { description: `${card.name} · ${fmt(amountValue)}` });
      } else {
        await addTransactions([{
          title:    description.trim(),
          amount:   mode === "expense" ? -amountValue : amountValue,
          type:     mode === "expense" ? "expense" : "income",
          date:     brDate(dateIso),
          category,
          settled,
          paidAt:   settled ? brDate(isoToday()) : undefined,
          recurring: false,
        }]);
        toast.success(mode === "income" ? "Receita registrada!" : "Despesa registrada!", {
          description: `${description.trim()} · ${fmt(amountValue)}`,
        });
      }
      router.navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      console.error("[share-intent]", err);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-screen max-w-[100vw] overflow-x-hidden min-h-screen bg-slate-50 md:w-full md:max-w-lg md:mx-auto">

      {/* ── Cabeçalho gradiente ── */}
      <div className="relative overflow-hidden px-5 pt-5 pb-8 text-white"
        style={{ background: `linear-gradient(135deg, ${accentColor}ee, ${accentColor}99)` }}>
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10"/>
        <div className="absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-white/10"/>
        <div className="relative">

          {/* Voltar */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.navigate({ to: "/dashboard" })}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
              <ArrowLeft className="h-5 w-5"/>
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Share2 className="h-4 w-4"/>
            </div>
          </div>

          {/* Subtítulo + notificação */}
          <p className="text-xs text-white/60 uppercase tracking-wide">Novo lançamento</p>
          {sharedText ? (
            <>
              <p className="text-sm text-white/80 mt-0.5">
                {parsed.confidence >= 0.7
                  ? "✓ Identificado automaticamente"
                  : parsed.confidence >= 0.4
                  ? "~ Identificação parcial — confira os dados"
                  : "Não identificado — preencha manualmente"}
              </p>
              <p className="mt-1.5 text-xs text-white/50 italic line-clamp-2">"{sharedText}"</p>
            </>
          ) : (
            <p className="text-sm text-white/80 mt-0.5">Preencha os dados do lançamento</p>
          )}

          {/* Toggle: Cartão / Despesa / Receita */}
          <div className="mt-4 flex rounded-xl bg-white/15 p-1 gap-1">
            {([
              { key: "card",    label: "Cartão",  Icon: CreditCard  },
              { key: "expense", label: "Despesa", Icon: TrendingDown },
              { key: "income",  label: "Receita", Icon: TrendingUp   },
            ] as const).map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => setMode(key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all",
                  mode === key ? "bg-white text-slate-800 shadow-sm" : "text-white/80 hover:text-white"
                )}>
                <Icon className="h-3.5 w-3.5"/> {label}
              </button>
            ))}
          </div>

          {/* Valor — input grande igual ao de nova-transacao */}
          <div className="mt-4">
            <p className="text-xs text-white/60 mb-1">Valor</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white/70">R$</span>
              <input
                inputMode="decimal"
                value={amountDisplay}
                onChange={e => {
                  const { display, value } = formatAmount(e.target.value);
                  setAmountDisplay(display);
                  setAmountValue(value);
                }}
                placeholder="0,00"
                className="bg-transparent text-4xl font-black text-white placeholder-white/30 outline-none w-full tracking-tight"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Campos ── */}
      <div className="px-4 pt-4 pb-32 space-y-3">

        {/* Seletor de cartão */}
        {mode === "card" && (
          <div className="rounded-2xl border bg-card px-4 py-3.5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cartão</p>
            {cards.filter(c => c.active).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cards.filter(c => c.active).map(c => {
                  const isSel = selectedCardId === c.id;
                  return (
                    <button key={c.id} type="button"
                      onClick={() => { setSelectedCardId(c.id); fetchInvoices(c.id); }}
                      className={cn(
                        "flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all",
                        isSel ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border text-foreground hover:border-indigo-300"
                      )}>
                      <CreditCard className="h-3.5 w-3.5"/> {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCardId && defaultInvoice && (
              <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0"/>
                <p className="text-xs text-indigo-700 font-medium">
                  Fatura {defaultInvoice.competence} · Vence {new Date(defaultInvoice.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
            {selectedCardId && !defaultInvoice && (
              <p className="text-xs text-amber-600">Nenhuma fatura aberta para este cartão.</p>
            )}
          </div>
        )}

        {/* Descrição */}
        <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Descrição</p>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Nome do estabelecimento"
            className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"
          />
        </div>

        {/* Categoria */}
        <button type="button" onClick={() => setOpenCat(true)}
          className="w-full rounded-2xl border bg-card px-4 py-3.5 text-left flex items-center gap-3 hover:bg-muted/30 transition-colors">
          {selectedCat ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: (selectedCat.color || "#6b7280") + "22" }}>
              {isEmoji(selectedCat.icon) ? selectedCat.icon : "📦"}
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <span className="text-xs">📦</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</p>
            <p className={cn("text-[16px] font-semibold mt-0.5", category ? "text-foreground" : "text-muted-foreground/50")}>
              {category || "Selecione a categoria"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0"/>
        </button>

        {/* Data */}
        <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Data</p>
          <DatePicker value={dateIso} onChange={setDateIso}/>
        </div>

        {/* Paga/Recebida */}
        {mode !== "card" && (
          <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{mode === "income" ? "Recebida" : "Paga"}</p>
              <p className="text-xs text-muted-foreground">Marcar como concluída agora</p>
            </div>
            <Switch checked={settled} onCheckedChange={setSettled}/>
          </div>
        )}

        {/* Aviso de confiança baixa */}
        {sharedText && parsed.confidence < 0.5 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">
              Não consegui identificar todos os dados desta notificação. Verifique o valor e a descrição antes de salvar.
            </p>
          </div>
        )}
      </div>

      {/* ── Botão fixo no rodapé ── */}
      <div className="fixed left-0 right-0 bottom-0 z-20 px-4 pt-3 pb-[env(safe-area-inset-bottom,16px)] border-t border-border/40"
        style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(255,255,255,0.96)" }}>
        <button onClick={handleSubmit} disabled={saving}
          className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-95 disabled:opacity-70"
          style={{ background: accentColor, boxShadow: `0 6px 20px ${accentColor}44` }}>
          {saving ? "Salvando..."
            : mode === "card"    ? "Lançar no cartão"
            : mode === "income"  ? "Registrar receita"
            :                      "Registrar despesa"}
        </button>
      </div>

      {/* ── BottomSheet: Categoria ── */}
      {openCat && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={() => { setOpenCat(false); setCatSearch(""); }}/>
          <div className="fixed bottom-0 left-0 right-0 z-[101] flex flex-col rounded-t-3xl bg-white dark:bg-card overflow-hidden"
            style={{ maxHeight: "80vh" }}>
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
                <input type="text" placeholder="Buscar categoria..." value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="h-11 w-full rounded-2xl bg-slate-100 pl-11 pr-4 text-base outline-none"/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-3 gap-3 px-4 pb-8">
                {availableCategories
                  .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
                  .map(cat => {
                    const isSel  = category === cat.name;
                    const color  = cat.color || "#6b7280";
                    const emoji  = isEmoji(cat.icon);
                    return (
                      <button key={cat.name} type="button"
                        onClick={() => { setCategory(cat.name); setOpenCat(false); setCatSearch(""); }}
                        className="flex flex-col items-center gap-2 rounded-2xl border-2 py-4 px-2 text-center active:scale-95 transition-transform"
                        style={isSel
                          ? { background: color + "18", borderColor: color + "66" }
                          : { borderColor: "transparent", background: "#f8fafc" }}>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                          style={{ background: color + "22" }}>
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
    </div>
  );
}
