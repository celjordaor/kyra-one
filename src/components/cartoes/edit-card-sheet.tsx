import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, CreditCard } from "lucide-react";
import { useCardStore, type CreditCard as CreditCardType, type CardFlag } from "@/lib/card-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FLAGS: CardFlag[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];
const FLAG_COLORS: Record<string, string> = {
  Visa: "#1a1f71", Mastercard: "#eb001b", Elo: "#f5b800",
  Amex: "#007bc1", Hipercard: "#cc0000", Outro: "#4f46e5",
};

const schema = z.object({
  name:        z.string().min(1, "Informe o nome do cartão"),
  bank:        z.string().min(1, "Informe o banco"),
  flag:        z.string().min(1, "Selecione a bandeira"),
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day:     z.coerce.number().int().min(1).max(31),
});

type FormData = z.infer<typeof schema>;

function handleLimitInput(raw: string): { display: string; value: number } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { display: "", value: 0 };
  const value = parseInt(digits, 10) / 100;
  const display = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { display, value };
}

interface EditCardSheetProps {
  card: CreditCardType;
  onClose: () => void;
}

export function EditCardSheet({ card, onClose }: EditCardSheetProps) {
  const { updateCard } = useCardStore();

  const [limitDisplay, setLimitDisplay] = useState(
    card.limit_total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [limitValue, setLimitValue] = useState(card.limit_total);
  const [limitError, setLimitError] = useState("");

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: card.name, bank: card.bank,
      flag: card.flag ?? "", closing_day: card.closing_day, due_day: card.due_day,
    },
  });

  useEffect(() => {
    reset({
      name: card.name, bank: card.bank,
      flag: card.flag ?? "", closing_day: card.closing_day, due_day: card.due_day,
    });
    setLimitDisplay(card.limit_total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setLimitValue(card.limit_total);
    setLimitError("");
  }, [card.id]);

  const flagValue = watch("flag");
  const nameValue = watch("name");

  const onSubmit = async (data: FormData) => {
    if (limitValue <= 0) { setLimitError("O limite deve ser maior que zero"); return; }
    try {
      await updateCard(card.id, {
        name: data.name, bank: data.bank, flag: data.flag as CardFlag,
        limit_total: limitValue, closing_day: data.closing_day, due_day: data.due_day,
      });
      toast.success("Cartão atualizado!");
      onClose();
    } catch (err: unknown) {
      console.error("[edit-card]", err);
      toast.error((err as { message?: string })?.message || "Erro ao atualizar cartão.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}/>

      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:inset-0 md:items-center md:justify-center">
        <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
          style={{ maxHeight: "90dvh" }}>

          <form id="edit-card-form" onSubmit={handleSubmit(onSubmit)}>

            {/* ── Cabeçalho gradiente com limite integrado ── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-5 pb-7 text-white shrink-0">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"/>
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/10"/>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white/80">Editar cartão</p>
                  <button type="button" onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
                    <X className="h-4 w-4"/>
                  </button>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white"
                    style={{ background: flagValue ? (FLAG_COLORS[flagValue] ?? "#4f46e5") : "rgba(255,255,255,0.2)" }}>
                    {nameValue?.[0]?.toUpperCase() ?? <CreditCard className="h-6 w-6"/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black truncate">{nameValue || "—"}</p>
                    <p className="text-sm text-white/70">{flagValue || "—"}</p>
                  </div>
                </div>

                {/* Campo limite — mesmo padrão de nova-transacao */}
                <div>
                  <p className="text-xs text-white/60 mb-1">Limite total</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white/60">R$</span>
                    <input
                      inputMode="decimal"
                      value={limitDisplay}
                      onChange={e => {
                        const { display, value } = handleLimitInput(e.target.value);
                        setLimitDisplay(display);
                        setLimitValue(value);
                        if (limitError) setLimitError("");
                      }}
                      placeholder="0,00"
                      className="bg-transparent text-4xl font-black text-white placeholder-white/30 outline-none w-full tracking-tight"
                    />
                  </div>
                  {limitError && <p className="text-xs text-red-300 mt-1">{limitError}</p>}
                </div>
              </div>
            </div>

            {/* ── Campos ── */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 pt-4 pb-28 space-y-3">

              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nome do cartão</p>
                <input {...register("name")}
                  className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none"/>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Banco / Instituição</p>
                <input {...register("bank")}
                  className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none"/>
                {errors.bank && <p className="text-xs text-destructive mt-1">{errors.bank.message}</p>}
              </div>

              {/* Bandeira — pills */}
              <div className="rounded-2xl border bg-card px-4 py-3.5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bandeira</p>
                <div className="flex flex-wrap gap-2">
                  {FLAGS.map(f => {
                    const isSel = flagValue === f;
                    const color = FLAG_COLORS[f] ?? "#4f46e5";
                    return (
                      <button key={f} type="button"
                        onClick={() => setValue("flag", f, { shouldValidate: true })}
                        className={cn(
                          "rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all",
                          isSel ? "text-white border-transparent" : "border-border text-foreground hover:border-indigo-300"
                        )}
                        style={isSel ? { background: color, borderColor: color } : {}}>
                        {f}
                      </button>
                    );
                  })}
                </div>
                {errors.flag && <p className="text-xs text-destructive">{errors.flag.message}</p>}
              </div>

              {/* Dias */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia fechamento</p>
                  <input {...register("closing_day")} type="number" min="1" max="31"
                    className="w-full min-w-0 bg-transparent text-[20px] font-black text-foreground outline-none"/>
                  {errors.closing_day && <p className="text-xs text-destructive mt-1">{errors.closing_day.message}</p>}
                </div>
                <div className="min-w-0 rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia vencimento</p>
                  <input {...register("due_day")} type="number" min="1" max="31"
                    className="w-full min-w-0 bg-transparent text-[20px] font-black text-foreground outline-none"/>
                  {errors.due_day && <p className="text-xs text-destructive mt-1">{errors.due_day.message}</p>}
                </div>
              </div>
            </div>
          </form>

          {/* ── Botão sempre suspenso (fixo) ── */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-[env(safe-area-inset-bottom,16px)] border-t border-border/40 shrink-0"
            style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(255,255,255,0.96)" }}>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="h-12 px-5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50">
                Cancelar
              </button>
              <button type="submit" form="edit-card-form" disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-70">
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
