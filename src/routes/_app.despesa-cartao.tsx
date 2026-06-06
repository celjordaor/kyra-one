import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import { useCards, type CreditCard } from "@/lib/cartoes-store";
import { useCategories } from "@/lib/categories-store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/despesa-cartao")({
  component: DespesaCartaoPage,
});

const INSTALLMENT_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,18,24];

const CATEGORY_COLORS: Record<string, string> = {
  "Alimentação":"#f97316","Transporte":"#3b82f6","Moradia":"#8b5cf6",
  "Entretenimento":"#ec4899","Saúde":"#10b981","Educação":"#6366f1",
  "Salário":"#10b981","Renda extra":"#f59e0b","Investimentos":"#14b8a6",
  "Outros":"#6b7280",
};
const CATEGORY_ICONS: Record<string, string> = {
  "Alimentação":"🍔","Transporte":"🚗","Moradia":"🏠","Entretenimento":"🎭",
  "Saúde":"❤️","Educação":"📚","Salário":"💰","Renda extra":"💡",
  "Investimentos":"📈","Outros":"📦",
};

function getBillingMonths(closingDay: number | null, count = 4) {
  const today = new Date();
  const months: { label: string; value: string; dueDate: string }[] = [];
  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    const dueDate = closingDay
      ? `Vence dia ${closingDay}/${String(d.getMonth()+2 > 12 ? 1 : d.getMonth()+2).padStart(2,"0")}`
      : "";
    months.push({ label, value, dueDate });
  }
  return months;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function DespesaCartaoPage() {
  const navigate = useNavigate();
  const { cards, defaultCard, loading: cardsLoading } = useCards();
  const categories = useCategories().filter(c => c.active && c.type === "expense");

  const [title, setTitle]               = useState("");
  const [amount, setAmount]             = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [date, setDate]                 = useState(toIso(new Date()));
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [installments, setInstallments] = useState(1);
  const [saving, setSaving]             = useState(false);

  const [openCard, setOpenCard]         = useState(false);
  const [openCat, setOpenCat]           = useState(false);
  const [openBilling, setOpenBilling]   = useState(false);
  const [openInstall, setOpenInstall]   = useState(false);

  // Setar cartão padrão quando carregado
  useEffect(() => {
    if (defaultCard && !selectedCard) setSelectedCard(defaultCard);
  }, [defaultCard]);

  // Setar fatura atual como padrão
  useEffect(() => {
    if (!billingMonth) {
      const today = new Date();
      setBillingMonth(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`);
    }
  }, []);

  const billingMonths = getBillingMonths(selectedCard?.dueDay ?? null);

  function handleAmount(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) { setAmountDisplay(""); setAmount(""); return; }
    const value = (parseInt(digits, 10) / 100).toFixed(2);
    setAmountDisplay(parseFloat(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setAmount(value);
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (!amount) { toast.error("Valor é obrigatório"); return; }
    if (!selectedCard) { toast.error("Selecione um cartão"); return; }
    if (!selectedCategory) { toast.error("Selecione a categoria"); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const numeric = parseFloat(amount);
    const perInstallment = +(numeric / installments).toFixed(2);

    const rows = Array.from({ length: installments }, (_, i) => ({
      user_id: user.id,
      title: installments > 1 ? `${title} (${i+1}/${installments})` : title,
      amount: -Math.abs(perInstallment),
      type: "expense",
      date: date, // guardamos a data da compra
      category: selectedCategory,
      settled: false,
      card_id: selectedCard.id,
      installments,
      billing_month: billingMonth,
    }));

    const { error } = await supabase.from("transactions").insert(rows);
    if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }

    toast.success(installments > 1
      ? `Despesa parcelada em ${installments}x salva!`
      : "Despesa no cartão salva!");
    setTimeout(() => navigate({ to: "/transacoes" }), 800);
    setSaving(false);
  }

  const selectedBilling = billingMonths.find(b => b.value === billingMonth);

  return (
    <div className="space-y-5 p-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Despesa no cartão</h1>
      </div>

      <div className="space-y-4">
        {/* 1. Descrição */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Descrição</Label>
          <Input placeholder="Ex: iFood, Zara, Netflix..." className="h-11"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* 2. Cartão */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Cartão</Label>
          <button type="button" onClick={() => setOpenCard(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50">
            {selectedCard ? (
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-base"
                  style={{ background: selectedCard.color + "22" }}>
                  {selectedCard.icon}
                </div>
                <span className="font-medium text-foreground">{selectedCard.name}</span>
                {selectedCard.lastDigits && (
                  <span className="text-xs text-muted-foreground">•••• {selectedCard.lastDigits}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione um cartão</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 3. Categoria */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Categoria</Label>
          <button type="button" onClick={() => setOpenCat(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50">
            {selectedCategory ? (
              <div className="flex items-center gap-2.5">
                <span className="text-base">{CATEGORY_ICONS[selectedCategory] ?? "📦"}</span>
                <span className="font-medium text-foreground">{selectedCategory}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Selecione a categoria</span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 4. Valor */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Valor total</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input type="text" inputMode="decimal" placeholder="0,00"
              className="h-12 pl-9 text-lg font-bold"
              value={amountDisplay} onChange={e => handleAmount(e.target.value)} />
          </div>
        </div>

        {/* 5. Data da compra */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Data da compra</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        {/* 6. Fatura destino */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Fatura destino</Label>
          <button type="button" onClick={() => setOpenBilling(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50">
            <span className={billingMonth ? "font-medium text-foreground" : "text-muted-foreground"}>
              {selectedBilling ? selectedBilling.label : "Selecione a fatura"}
            </span>
            <div className="flex items-center gap-2">
              {selectedBilling?.dueDate && (
                <span className="text-xs text-muted-foreground">{selectedBilling.dueDate}</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* 7. Parcelamento */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Parcelamento</Label>
          <button type="button" onClick={() => setOpenInstall(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm hover:bg-muted/50">
            <span className="font-medium text-foreground">
              {installments === 1 ? "À vista" : `${installments}x de R$ ${amount ? (parseFloat(amount)/installments).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "0,00"}`}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}
        className="h-12 w-full bg-primary text-base font-semibold shadow-md shadow-primary/25">
        {saving ? "Salvando..." : "Salvar despesa"}
      </Button>

      {/* Modal: Cartão */}
      <Dialog open={openCard} onOpenChange={setOpenCard}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Selecionar cartão</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {cards.map(card => (
              <button key={card.id} type="button" onClick={() => { setSelectedCard(card); setOpenCard(false); }}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selectedCard?.id === card.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ background: card.color + "22" }}>
                  {card.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{card.name}</p>
                    {card.isDefault && <span className="text-[10px] font-bold text-primary">Padrão</span>}
                  </div>
                  {card.lastDigits && <p className="text-xs text-muted-foreground">•••• {card.lastDigits}</p>}
                </div>
                {selectedCard?.id === card.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Categoria */}
      <Dialog open={openCat} onOpenChange={setOpenCat}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Selecionar categoria</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 pb-2">
            {categories.map(cat => {
              const color = CATEGORY_COLORS[cat.name] ?? "#6b7280";
              const icon  = CATEGORY_ICONS[cat.name] ?? "📦";
              const isSelected = selectedCategory === cat.name;
              return (
                <button key={cat.id} type="button"
                  onClick={() => { setSelectedCategory(cat.name); setOpenCat(false); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: isSelected ? color : color + "18",
                    color: isSelected ? "white" : color,
                    border: `1.5px solid ${color}44`,
                    transform: isSelected ? "scale(1.05)" : "scale(1)",
                  }}>
                  <span>{icon}</span>
                  <span>{cat.name}</span>
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Fatura destino */}
      <Dialog open={openBilling} onOpenChange={setOpenBilling}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Fatura destino</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 pb-2">
            {billingMonths.map(m => {
              const isSelected = billingMonth === m.value;
              return (
                <div key={m.value} className="flex items-center gap-2">
                  <button type="button" onClick={() => { setBillingMonth(m.value); setOpenBilling(false); }}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      background: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}>
                    {m.label}
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  {m.dueDate && (
                    <span className="text-xs text-muted-foreground">{m.dueDate}</span>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Parcelamento */}
      <Dialog open={openInstall} onOpenChange={setOpenInstall}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Parcelamento</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 pb-2">
            {INSTALLMENT_OPTIONS.map(n => {
              const isSelected = installments === n;
              const perValue = amount ? (parseFloat(amount)/n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : null;
              return (
                <button key={n} type="button" onClick={() => { setInstallments(n); setOpenInstall(false); }}
                  className="flex flex-col items-center rounded-xl px-3 py-2 text-center text-xs font-semibold transition-all"
                  style={{
                    background: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    minWidth: 56,
                  }}>
                  <span className="text-sm font-bold">{n === 1 ? "À vista" : `${n}x`}</span>
                  {perValue && n > 1 && <span className="mt-0.5 opacity-80">R$ {perValue}</span>}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
