import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategories, addCategory, updateCategory, deleteCategory,
  type Category, type CategoryType,
} from "@/lib/categories-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Finanças Pessoais" }] }),
  component: CategoriasPage,
});

type Tab = "expense" | "income";
interface CategoryForm { name: string; color: string; icon: string; }

// ── Paleta de cores ────────────────────────────────────────────────────
const COLORS = [
  "#ef4444","#f97316","#f59e0b","#84cc16","#10b981",
  "#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899",
  "#6b7280","#1e293b",
];

// ── Emojis por grupo ───────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: "Alimentação",    emojis: ["🍔","🍕","🍣","🍺","☕","🛒","🍽️","🥗","🍰","🧃"] },
  { label: "Transporte",     emojis: ["🚗","✈️","🚌","⛽","🚲","🛵","🚕","🚆"] },
  { label: "Moradia",        emojis: ["🏠","🛋️","💡","🔧","📦","🪴","🛏️","🚿"] },
  { label: "Saúde",          emojis: ["❤️","💊","🏥","🏋️","🧘","🦷","👓","🩺"] },
  { label: "Entretenimento", emojis: ["🎭","🎮","📺","🎵","📚","🎬","🎲","🎸"] },
  { label: "Finanças",       emojis: ["💰","💳","📈","💵","🏦","🪙","💹","📊"] },
  { label: "Compras",        emojis: ["👗","👟","💄","📱","💻","🛍️","⌚","🕶️"] },
  { label: "Educação",       emojis: ["📚","🎓","✏️","🖊️","📐","🔬","🖥️","📝"] },
  { label: "Outros",         emojis: ["🐶","🎁","⭐","🔖","📌","🌿","🏆","✨"] },
];

// ── Verifica se é emoji real (não texto ASCII) ─────────────────────────
function isValidEmoji(s: string): boolean {
  if (!s) return false;
  const cp = s.codePointAt(0) ?? 0;
  return cp > 0x2000;
}

// ── Exibe ícone: emoji ou inicial colorida ─────────────────────────────
function CatBadge({ icon, name, color, size = "md" }: {
  icon: string; name: string; color: string; size?: "sm" | "md";
}) {
  const bg = color || "#6b7280";
  const cls = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-xl";
  if (isValidEmoji(icon)) {
    return (
      <div className={`flex ${cls} shrink-0 items-center justify-center rounded-xl`}
        style={{ background: bg + "22" }}>
        <span className="leading-none">{icon}</span>
      </div>
    );
  }
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-xl font-bold text-white`}
      style={{ background: bg }}>
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );
}

// ── Picker de emoji + cor ──────────────────────────────────────────────
function EmojiColorPicker({ color, icon, onColorChange, onIconChange }: {
  color: string; icon: string;
  onColorChange: (c: string) => void;
  onIconChange: (i: string) => void;
}) {
  const [emojiGroup, setEmojiGroup] = useState(0);

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-sm"
          style={{ background: color + "22", border: `2px solid ${color}44` }}>
          {isValidEmoji(icon) ? icon : <span className="text-2xl font-bold" style={{ color }}>{icon[0]?.toUpperCase() ?? "?"}</span>}
        </div>
      </div>

      {/* Cores */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor</Label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => onColorChange(c)}
              className={cn("h-7 w-7 rounded-full transition-transform",
                color === c ? "scale-125 ring-2 ring-offset-1 ring-foreground/30" : "hover:scale-110"
              )}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* Emojis */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ícone</Label>
        {/* Abas de grupos */}
        <div className="flex flex-wrap gap-1">
          {EMOJI_GROUPS.map((g, i) => (
            <button key={g.label} type="button" onClick={() => setEmojiGroup(i)}
              className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                emojiGroup === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}>
              {g.label}
            </button>
          ))}
        </div>
        {/* Grid de emojis */}
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_GROUPS[emojiGroup].emojis.map(em => (
            <button key={em} type="button" onClick={() => onIconChange(em)}
              className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-all",
                icon === em ? "bg-primary/15 ring-2 ring-primary scale-110" : "hover:bg-muted"
              )}>
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────
function CategoriasPage() {
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>("expense");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>({ name: "", color: "#6b7280", icon: "📦" });
  const [saving, setSaving] = useState(false);

  const filtered = categories.filter(c => c.type === tab).sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", color: "#6b7280", icon: "📦" });
    setShowForm(true);
  };
  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, color: cat.color ?? "#6b7280", icon: cat.icon ?? "📦" });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome da categoria."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, form.name, tab, form.color, form.icon);
        toast.success("Categoria atualizada!");
      } else {
        await addCategory(form.name, tab, form.color, form.icon);
        toast.success("Categoria criada!");
      }
      closeForm();
    } catch {
      toast.error("Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir a categoria "${name}"?`)) return;
    await deleteCategory(id);
    toast.success("Categoria excluída.");
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <Link to="/perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Categorias</h1>
      </div>

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {([["expense","DESPESAS"],["income","RECEITAS"]] as [Tab,string][]).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={cn("flex-1 rounded-lg py-2 text-sm font-semibold tracking-wide transition-colors",
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </button>
        ))}
      </div>

      <Button className="h-10 w-full gap-2 bg-primary font-semibold" onClick={openNew}>
        <Plus className="h-4 w-4" /> Nova categoria
      </Button>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cat => (
            <div key={cat.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <CatBadge icon={cat.icon ?? "📦"} name={cat.name} color={cat.color ?? "#6b7280"} />
                <span className="text-sm font-medium text-foreground">{cat.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(cat)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(cat.id, cat.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criação/edição */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-card sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "Editar categoria" : "Nova categoria"}
              </h2>
              <button onClick={closeForm}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Descrição</Label>
                <Input id="cat-name" placeholder="Nome da categoria" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <EmojiColorPicker
                color={form.color} icon={form.icon}
                onColorChange={color => setForm(f => ({ ...f, color }))}
                onIconChange={icon => setForm(f => ({ ...f, icon }))}
              />

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="h-11 flex-1" onClick={closeForm}>Cancelar</Button>
                <Button className="h-11 flex-1 bg-primary font-semibold" onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Concluído"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
