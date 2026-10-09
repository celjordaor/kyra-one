import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useCardStore, type CardFlag } from "@/lib/card-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cartoes/novo")({
  component: NovoCartaoPage,
});

const schema = z.object({
  name:        z.string().min(1, "Informe o nome do cartão"),
  bank:        z.string().min(1, "Informe o banco ou instituição"),
  flag:        z.string().min(1, "Selecione a bandeira"),
  limit_total: z.coerce.number().positive("O limite deve ser maior que zero"),
  closing_day: z.coerce.number().int().min(1).max(31, "Dia inválido"),
  due_day:     z.coerce.number().int().min(1).max(31, "Dia inválido"),
});

type FormData = z.infer<typeof schema>;

const FLAGS: CardFlag[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];
const FLAG_COLORS: Record<string, string> = {
  Visa: "#1a1f71", Mastercard: "#eb001b", Elo: "#f5b800",
  Amex: "#007bc1", Hipercard: "#cc0000", Outro: "#4f46e5",
};

// Mesmo padrão de formatação da tela de nova transação
function handleLimitInput(raw: string): { display: string; value: number } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { display: "", value: 0 };
  const value = parseInt(digits, 10) / 100;
  const display = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { display, value };
}

function NovoCartaoPage() {
  const router = useRouter();
  const { addCard } = useCardStore();

  // Campo limite controlado (formatação ao digitar)
  const [limitDisplay, setLimitDisplay] = useState("");
  const [limitValue, setLimitValue]     = useState(0);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { closing_day: 1, due_day: 10, flag: "" },
  });

  const flagValue = watch("flag");
  const nameValue = watch("name");

  const onSubmit = async (data: FormData) => {
    try {
      await addCard({
        name: data.name, bank: data.bank, flag: data.flag as CardFlag,
        limit_total: limitValue, closing_day: data.closing_day,
        due_day: data.due_day, active: true,
      });
      toast.success("Cartão cadastrado com sucesso!");
      router.navigate({ to: "/cartoes" });
    } catch (err: unknown) {
      console.error("[novo-cartao]", err);
      toast.error((err as { message?: string })?.message || "Erro ao cadastrar cartão.");
    }
  };

  return (
    <div className="w-screen max-w-[100vw] overflow-x-hidden min-h-screen bg-background md:w-full md:max-w-xl md:mx-auto md:overflow-x-visible">
      <form id="novo-cartao-form" onSubmit={handleSubmit(onSubmit)}>

        {/* ── Cabeçalho gradiente com campo de limite integrado ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-5 pb-6 text-white md:rounded-2xl md:mt-4">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"/>
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/10"/>
          <div className="relative">
            {/* Voltar */}
            <div className="flex items-center gap-3 mb-4">
              <button type="button" onClick={() => router.history.back()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                <ArrowLeft className="h-5 w-5"/>
              </button>
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide leading-none">Cartões de crédito</p>
                <p className="text-base font-bold">Novo cartão</p>
              </div>
            </div>

            {/* Preview + Limite no cabeçalho */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white"
                style={{ background: flagValue ? (FLAG_COLORS[flagValue] ?? "#4f46e5") : "rgba(255,255,255,0.2)" }}>
                {nameValue?.[0]?.toUpperCase() ?? <CreditCard className="h-5 w-5"/>}
              </div>
              <div className="min-w-0">
                <p className="text-base font-black truncate">{nameValue || "Novo cartão"}</p>
                <p className="text-sm text-white/70">{flagValue || "Bandeira"}</p>
              </div>
            </div>

            {/* Campo limite — mesmo padrão de nova-transacao */}
            <div>
              <p className="text-xs text-white/60 mb-1">Limite total</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white/60">R$</span>
                <input
                  inputMode="decimal"
                  value={limitDisplay}
                  onChange={e => {
                    const { display, value } = handleLimitInput(e.target.value);
                    setLimitDisplay(display);
                    setLimitValue(value);
                    setValue("limit_total", value, { shouldValidate: true });
                  }}
                  placeholder="0,00"
                  className="bg-transparent text-3xl font-black text-white placeholder-white/30 outline-none w-full tracking-tight"
                />
              </div>
              {errors.limit_total && (
                <p className="text-xs text-red-300 mt-1">{errors.limit_total.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Campos ── */}
        <div className="px-4 pt-4 space-y-3 md:pb-4">

          <div className="rounded-2xl border bg-card px-4 py-2.5 space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Nome do cartão</p>
            <input {...register("name")} placeholder="Ex: Nubank Gold"
              className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div className="rounded-2xl border bg-card px-4 py-2.5 space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Banco / Instituição</p>
            <input {...register("bank")} placeholder="Ex: Nubank, Bradesco, Itaú"
              className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder-muted-foreground/50"/>
            {errors.bank && <p className="text-xs text-destructive mt-1">{errors.bank.message}</p>}
          </div>

          {/* Bandeira — pills */}
          <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Bandeira</p>
            <div className="flex flex-wrap gap-2">
              {FLAGS.map(f => {
                const isSel = flagValue === f;
                const color = FLAG_COLORS[f] ?? "#4f46e5";
                return (
                  <button key={f} type="button"
                    onClick={() => setValue("flag", f, { shouldValidate: true })}
                    className={cn(
                      "rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-all",
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
            <div className="rounded-2xl border bg-card px-4 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia de fechamento</p>
              <input {...register("closing_day")} type="number" min="1" max="31"
                className="w-full bg-transparent text-[16px] font-bold text-foreground outline-none"/>
              {errors.closing_day && <p className="text-xs text-destructive mt-1">{errors.closing_day.message}</p>}
            </div>
            <div className="rounded-2xl border bg-card px-4 py-2.5 space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dia de vencimento</p>
              <input {...register("due_day")} type="number" min="1" max="31"
                className="w-full bg-transparent text-[16px] font-bold text-foreground outline-none"/>
              {errors.due_day && <p className="text-xs text-destructive mt-1">{errors.due_day.message}</p>}
            </div>
          </div>
        </div>

        {/* Botão desktop — inline no formulário, alinhado com a coluna de conteúdo */}
        <div className="hidden md:block px-4 mt-2 mb-6">
          <button type="submit" disabled={isSubmitting}
            className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70">
            {isSubmitting ? "Salvando..." : "Salvar cartão"}
          </button>
        </div>
      </form>

      {/* Espaçador mobile: evita que o conteúdo fique atrás do botão fixo */}
      <div className="md:hidden" style={{ height: "6.5rem" }} />

      {/* ── Botão mobile — fixo no rodapé, acima do menu inferior ── */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-4"
        style={{
          bottom: 0,
          paddingBottom: "calc(68px + env(safe-area-inset-bottom, 0px) + 12px)",
          paddingTop: "12px",
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(255,255,255,0.96)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}>
        <button type="submit" form="novo-cartao-form" disabled={isSubmitting}
          className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70">
          {isSubmitting ? "Salvando..." : "Salvar cartão"}
        </button>
      </div>
    </div>
  );
}
