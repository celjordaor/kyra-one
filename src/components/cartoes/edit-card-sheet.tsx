import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
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
import { useCardStore, type CreditCard, type CardFlag } from "@/lib/card-store";
import { toast } from "sonner";

const FLAGS: CardFlag[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];

const schema = z.object({
  name: z.string().min(1, "Informe o nome do cartão"),
  bank: z.string().min(1, "Informe o banco"),
  flag: z.string().min(1, "Selecione a bandeira"),
  limit_total: z.coerce.number().positive("Limite deve ser maior que zero"),
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day: z.coerce.number().int().min(1).max(31),
});

type FormData = z.infer<typeof schema>;

interface EditCardSheetProps {
  card: CreditCard;
  onClose: () => void;
}

export function EditCardSheet({ card, onClose }: EditCardSheetProps) {
  const { updateCard } = useCardStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: card.name,
      bank: card.bank,
      flag: card.flag,
      limit_total: card.limit_total,
      closing_day: card.closing_day,
      due_day: card.due_day,
    },
  });

  const flagValue = watch("flag");

  const onSubmit = async (data: FormData) => {
    try {
      await updateCard(card.id, {
        name: data.name,
        bank: data.bank,
        flag: data.flag as CardFlag,
        limit_total: data.limit_total,
        closing_day: data.closing_day,
        due_day: data.due_day,
      });
      toast.success("Cartão atualizado!");
      onClose();
    } catch {
      toast.error("Erro ao atualizar cartão.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Painel */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-card sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Editar cartão</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto p-5 max-h-[70vh]">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome do cartão</Label>
            <Input id="edit-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-bank">Banco / Instituição</Label>
            <Input id="edit-bank" {...register("bank")} />
            {errors.bank && <p className="text-xs text-destructive">{errors.bank.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Bandeira</Label>
            <Select value={flagValue} onValueChange={(v) => setValue("flag", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLAGS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.flag && <p className="text-xs text-destructive">{errors.flag.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-limit">Limite total (R$)</Label>
            <Input id="edit-limit" type="number" step="0.01" min="0" {...register("limit_total")} />
            {errors.limit_total && <p className="text-xs text-destructive">{errors.limit_total.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-closing">Dia de fechamento</Label>
              <Input id="edit-closing" type="number" min="1" max="31" {...register("closing_day")} />
              {errors.closing_day && <p className="text-xs text-destructive">{errors.closing_day.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due">Dia de vencimento</Label>
              <Input id="edit-due" type="number" min="1" max="31" {...register("due_day")} />
              {errors.due_day && <p className="text-xs text-destructive">{errors.due_day.message}</p>}
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-primary font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </div>
    </div>
  );
}
