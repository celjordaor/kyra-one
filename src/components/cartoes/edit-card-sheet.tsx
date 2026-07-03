import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, CreditCard } from "lucide-react";
import { useCardStore, type CreditCard as CreditCardType, type CardFlag } from "@/lib/card-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FLAGS: CardFlag[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];

const FLAG_COLORS: Record<string, string> = {
  Visa:       "#1a1f71",
  Mastercard: "#eb001b",
  Elo:        "#f5b800",
  Amex:       "#007bc1",
  Hipercard:  "#cc0000",
  Outro:      "#4f46e5",
};

const schema = z.object({
  name:        z.string().min(1, "Informe o nome do cartão"),
  bank:        z.string().min(1, "Informe o banco"),
  flag:        z.string().min(1, "Selecione a bandeira"),
  limit_total: z.coerce.number().positive("Limite deve ser maior que zero"),
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day:     z.coerce.number().int().min(1).max(31),
});

type FormData = z.infer<typeof schema>;

interface EditCardSheetProps {
  card: CreditCardType;
  onClose: () => void;
}

export function EditCardSheet({ card, onClose }: EditCardSheetProps) {
  const { updateCard } = useCardStore();

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        card.name,
      bank:        card.bank,
      flag:        card.flag ?? "",
      limit_total: card.limit_total,
      closing_day: card.closing_day,
      due_day:     card.due_day,
    },
  });

  useEffect(() => {
    reset({
      name:        card.name,
      bank:        card.bank,
      flag:        card.flag ?? "",
      limit_total: card.limit_total,
      closing_day: card.closing_day,
      due_day:     card.due_day,
    });
  }, [card.id]);

  const flagValue  = watch("flag");
  const nameValue  = watch("name");
  const limitValue = watch("limit_total");

  const onSubmit = async (data: FormData) => {
    try {
      await updateCard(card.id, {
        name: data.name, bank: data.bank, flag: data.flag as CardFlag,
        limit_total: data.limit_total, closing_day: data.closing_day, due_day: data.due_day,
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
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}/>

      {/* Sheet — sobe do rodapé mobile, centraliza no desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:inset-0 md:items-center md:justify-center">
        <div className="relative flex flex-col overflow-hidden bg-background md:w-full md:max-w-lg md:rounded-2xl"
          style={{ maxHeight: "94dvh" }}>

          <form id="edit-card-form" onSubmit={handleSubmit(onSubmit)}>
            {/* ── Cabeçalho gradiente indigo ── */}
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

                {/* Preview do cartão */}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white"
                    style={{ background: flagValue ? (FLAG_COLORS[flagValue] ?? "#4f46e5") : "rgba(255,255,255,0.2)" }}>
                    {nameValue?.[0]?.toUpperCase() ?? <CreditCard className="h-6 w-6"/>}
                  </div>
                  <div>
                    <p className="text-xl font-black tracking-tight">{nameValue || "—"}</p>
                    <p className="text-sm text-white/70">
                      {flagValue || "—"} · R$ {Number(limitValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Campos ── */}
            <div className="overflow-y-auto flex-1 px-4 pt-4 pb-4 space-y-3">

              {/* Nome */}
              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nome do cartão</p>
                <input {...register("name")} placeholder="Nome do cartão"
                  className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>

              {/* Banco */}
              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Banco / Instituição</p>
                <input {...register("bank")} placeholder="Ex: Nubank, Bradesco"
                  className="w-full bg-transparent text-[16px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
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
                      <button key={f} type="button" onClick={() => setValue("flag", f, { shouldValidate: true })}
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

              {/* Limite */}
              <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Limite total</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-muted-foreground">R$</span>
                  <input {...register("limit_total")} type="number" step="0.01" min="0"
                    className="w-full bg-transparent text-[20px] font-black text-foreground outline-none"/>
                </div>
                {errors.limit_total && <p className="text-xs text-destructive mt-1">{errors.limit_total.message}</p>}
              </div>

              {/* Dias */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia fechamento</p>
                  <input {...register("closing_day")} type="number" min="1" max="31"
                    className="w-full bg-transparent text-[20px] font-black text-foreground outline-none"/>
                  {errors.closing_day && <p className="text-xs text-destructive mt-1">{errors.closing_day.message}</p>}
                </div>
                <div className="rounded-2xl border bg-card px-4 py-3 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia vencimento</p>
                  <input {...register("due_day")} type="number" min="1" max="31"
                    className="w-full bg-transparent text-[20px] font-black text-foreground outline-none"/>
                  {errors.due_day && <p className="text-xs text-destructive mt-1">{errors.due_day.message}</p>}
                </div>
              </div>

              {/* Espaçador mobile */}
              <div className="h-20 md:hidden"/>
            </div>
          </form>

          {/* ── Botão fixo mobile ── */}
          <div className="md:hidden fixed left-0 right-0 bottom-0 z-10 px-4 pt-3 pb-[env(safe-area-inset-bottom,12px)] bg-background/97 border-t border-border/40"
            style={{ backdropFilter: "blur(8px)" }}>
            <button type="submit" form="edit-card-form" disabled={isSubmitting}
              className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70">
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>

          {/* ── Botão desktop ── */}
          <div className="hidden md:flex gap-3 px-4 pb-4 pt-2 border-t shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Cancelar
            </button>
            <button type="submit" form="edit-card-form" disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-70">
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
