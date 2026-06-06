import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Star, MoreVertical, Trash2, Pencil, ArrowLeft, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCards, type CreditCard } from "@/lib/cartoes-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/cartoes")({
  component: CartoesPage,
});

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f97316","#10b981","#3b82f6","#ef4444","#f59e0b","#14b8a6","#6b7280"];
const ICONS  = ["💳","🏦","💰","💵","🪙","🏧","💎","⭐","🌟","🔵"];

const emptyForm = {
  name: "", lastDigits: "", color: "#6366f1", icon: "💳",
  creditLimit: "", closingDay: "", dueDay: "",
};

function CartoesPage() {
  const { cards, loading, defaultCard, addCard, updateCard, deleteCard, setDefault } = useCards();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<CreditCard | null>(null);

  const openAdd = () => { setForm(emptyForm); setEditing(null); setOpenForm(true); };
  const openEdit = (c: CreditCard) => {
    setForm({ name: c.name, lastDigits: c.lastDigits, color: c.color, icon: c.icon,
      creditLimit: c.creditLimit ? String(c.creditLimit) : "",
      closingDay: c.closingDay ? String(c.closingDay) : "",
      dueDay: c.dueDay ? String(c.dueDay) : "" });
    setEditing(c); setOpenForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome do cartão é obrigatório"); return; }
    const payload = {
      name: form.name.trim(), lastDigits: form.lastDigits.trim(),
      color: form.color, icon: form.icon,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
      closingDay: form.closingDay ? parseInt(form.closingDay) : null,
      dueDay: form.dueDay ? parseInt(form.dueDay) : null,
    };
    if (editing) { await updateCard(editing.id, payload); toast.success("Cartão atualizado"); }
    else { await addCard(payload); toast.success("Cartão adicionado"); }
    setOpenForm(false);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Meus cartões</h1>
        </div>
        <button onClick={openAdd}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum cartão cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione seu primeiro cartão</p>
          <Button onClick={openAdd} size="sm" className="mt-1">Adicionar cartão</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
              {/* Chip do cartão */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
                style={{ background: card.color + "22", border: `1.5px solid ${card.color}44` }}>
                {card.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
                  {card.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <Star className="h-2.5 w-2.5 fill-primary" /> Padrão
                    </span>
                  )}
                </div>
                {card.lastDigits && (
                  <p className="text-xs text-muted-foreground">•••• {card.lastDigits}</p>
                )}
                {(card.closingDay || card.dueDay) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {card.closingDay && `Fecha dia ${card.closingDay}`}
                    {card.closingDay && card.dueDay && " · "}
                    {card.dueDay && `Vence dia ${card.dueDay}`}
                  </p>
                )}
              </div>

              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: card.color }}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {!card.isDefault && (
                    <DropdownMenuItem onClick={() => { setDefault(card.id); toast.success(`${card.name} definido como padrão`); }} className="cursor-pointer gap-2 text-primary">
                      <Star className="h-4 w-4" /> Definir como padrão
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => openEdit(card)} className="cursor-pointer gap-2">
                    <Pencil className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleting(card)} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Modal de formulário */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview */}
            <div className="flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-md"
                style={{ background: form.color + "22", border: `2px solid ${form.color}55` }}>
                {form.icon}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome do cartão</Label>
              <Input placeholder="Ex: Nubank, Itaú..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Últimos 4 dígitos (opcional)</Label>
              <Input placeholder="1234" maxLength={4} value={form.lastDigits}
                onChange={e => setForm(f => ({ ...f, lastDigits: e.target.value.replace(/\D/g, "") }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-primary" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Ícone</Label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-all ${form.icon === ic ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dia fechamento</Label>
                <Input type="number" min={1} max={31} placeholder="10" value={form.closingDay}
                  onChange={e => setForm(f => ({ ...f, closingDay: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dia vencimento</Label>
                <Input type="number" min={1} max={31} placeholder="17" value={form.dueDay}
                  onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Limite (opcional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input type="number" placeholder="5.000,00" className="pl-9" value={form.creditLimit}
                  onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de exclusão */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir cartão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{deleting?.name}</strong>? Os lançamentos associados não serão excluídos.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (deleting) { await deleteCard(deleting.id); toast.success("Cartão excluído"); setDeleting(null); }
            }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
