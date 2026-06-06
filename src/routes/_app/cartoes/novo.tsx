import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCardStore, type CardFlag } from "@/lib/card-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes/novo")({
  component: NovoCartaoPage,
});

const schema = z.object({
  name: z.string().min(1, "Informe o nome do cartão"),
  bank: z.string().min(1, "Informe o banco ou instituição"),
  flag: z.string().min(1, "Selecione a bandeira"),
  limit_total: z.coerce.number().positive("O limite deve ser maior que zero"),
  closing_day: z.coerce
    .number()
    .int()
    .min(1)
    .max(31, "Dia inválido"),
  due_day: z.coerce
    .number()
    .int()
    .min(1)
    .max(31, "Dia inválido"),
});

type FormData = z.infer<typeof schema>;

const FLAGS: CardFlag[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];

function NovoCartaoPage() {
  const router = useRouter();
  const { addCard } = useCardStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { closing_day: 1, due_day: 10 },
  });

  const flagValue = watch("flag");

  const onSubmit = async (data: FormData) => {
    try {
      await addCard({
        name: data.name,
        bank: data.bank,
        flag: data.flag as CardFlag,
        limit_total: data.limit_total,
        closing_day: data.closing_day,
        due_day: data.due_day,
        active: true,
      });
      toast.success("Cartão cadastrado com sucesso!");
      router.navigate({ to: "/cartoes" });
    } catch {
      toast.error("Erro ao cadastrar cartão. Tente novamente.");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Novo Cartão</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados do cartão</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome do cartão</Label>
          <Input id="name" placeholder="Ex: Nubank Gold" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Banco */}
        <div className="space-y-1.5">
          <Label htmlFor="bank">Banco / Instituição</Label>
          <Input id="bank" placeholder="Ex: Nubank, Bradesco, Itaú" {...register("bank")} />
          {errors.bank && <p className="text-xs text-destructive">{errors.bank.message}</p>}
        </div>

        {/* Bandeira */}
        <div className="space-y-1.5">
          <Label>Bandeira</Label>
          <Select value={flagValue} onValueChange={(v) => setValue("flag", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a bandeira" />
            </SelectTrigger>
            <SelectContent>
              {FLAGS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.flag && <p className="text-xs text-destructive">{errors.flag.message}</p>}
        </div>

        {/* Limite */}
        <div className="space-y-1.5">
          <Label htmlFor="limit_total">Limite total (R$)</Label>
          <Input
            id="limit_total"
            type="number"
            step="0.01"
            min="0"
            placeholder="5000.00"
            {...register("limit_total")}
          />
          {errors.limit_total && (
            <p className="text-xs text-destructive">{errors.limit_total.message}</p>
          )}
        </div>

        {/* Dias */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="closing_day">Dia de fechamento</Label>
            <Input
              id="closing_day"
              type="number"
              min="1"
              max="31"
              {...register("closing_day")}
            />
            {errors.closing_day && (
              <p className="text-xs text-destructive">{errors.closing_day.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due_day">Dia de vencimento</Label>
            <Input
              id="due_day"
              type="number"
              min="1"
              max="31"
              {...register("due_day")}
            />
            {errors.due_day && (
              <p className="text-xs text-destructive">{errors.due_day.message}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          💡 As próximas 12 faturas serão criadas automaticamente após salvar.
        </p>

        <Button
          type="submit"
          className="h-11 w-full bg-primary font-semibold"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : "Salvar cartão"}
        </Button>
      </form>
    </div>
  );
}
