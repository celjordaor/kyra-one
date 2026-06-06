import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  type Category,
  type CategoryType,
} from "@/lib/categories-store";
import { ColorIconPicker, CategoryIcon } from "@/components/categorias/color-icon-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Finanças Pessoais" }] }),
  component: CategoriasPage,
});

type Tab = "expense" | "income";

interface CategoryForm {
  name: string;
  color: string;
  icon: string;
}

function CategoriasPage() {
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>("expense");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>({ name: "", color: "#6b7280", icon: "tag" });
  const [saving, setSaving] = useState(false);

  const filtered = categories
    .filter((c) => c.type === tab)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", color: "#6b7280", icon: "tag" });
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      color: cat.color ?? "#6b7280",
      icon: cat.icon ?? "tag",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Categorias</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {([["expense", "DESPESAS"], ["income", "RECEITAS"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold tracking-wide transition-colors",
              tab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Botão nova categoria */}
      <Button className="h-10 w-full gap-2 bg-primary font-semibold" onClick={openNew}>
        <Plus className="h-4 w-4" />
        Nova categoria
      </Button>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: cat.color ?? "#6b7280" }}
                >
                  <CategoryIcon iconName={cat.icon ?? "tag"} color="white" size={18} />
                </div>
                <span className="text-sm font-medium text-foreground">{cat.name}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(cat)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-card sm:rounded-2xl">
            {/* Header do modal */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "Editar categoria" : "Nova categoria"}
              </h2>
              <button
                onClick={closeForm}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Descrição</Label>
                <Input
                  id="cat-name"
                  placeholder="Nome da categoria"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Picker de cor e ícone */}
              <ColorIconPicker
                selectedColor={form.color}
                selectedIcon={form.icon}
                onColorChange={(color) => setForm((f) => ({ ...f, color }))}
                onIconChange={(icon) => setForm((f) => ({ ...f, icon }))}
              />

              {/* Botões */}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="h-11 flex-1" onClick={closeForm}>
                  CANCELAR
                </Button>
                <Button
                  className="h-11 flex-1 bg-primary font-semibold"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "CONCLUÍDO"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
