import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useCategories,
  addCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  type CategoryType,
} from "@/lib/categories-store";

export const Route = createFileRoute("/_app/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Finanças Pessoais" }] }),
  component: CategoriasPage,
});

function TypePills({
  value,
  onChange,
  size = "md",
}: {
  value: CategoryType;
  onChange: (t: CategoryType) => void;
  size?: "sm" | "md";
}) {
  const base =
    size === "sm"
      ? "h-7 px-2.5 text-[11px]"
      : "h-9 px-3 text-xs";
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onChange("expense")}
        className={`${base} inline-flex items-center gap-1 rounded-full font-medium transition-all ${
          value === "expense"
            ? "bg-card text-red-500 shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        <TrendingDown className="h-3 w-3" />
        Despesa
      </button>
      <button
        type="button"
        onClick={() => onChange("income")}
        className={`${base} inline-flex items-center gap-1 rounded-full font-medium transition-all ${
          value === "income"
            ? "bg-card text-emerald-600 shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        <TrendingUp className="h-3 w-3" />
        Receita
      </button>
    </div>
  );
}

function CategoriasPage() {
  const categories = useCategories();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("expense");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<CategoryType>("expense");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addCategory(newName, newType);
    setNewName("");
  };

  const startEdit = (id: string, name: string, type: CategoryType) => {
    setEditingId(id);
    setEditingName(name);
    setEditingType(type);
  };

  const saveEdit = () => {
    if (editingId) updateCategory(editingId, editingName, editingType);
    setEditingId(null);
  };

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  const renderItem = (cat: typeof categories[number]) => (
    <div
      key={cat.id}
      className="flex items-center gap-2 rounded-xl border bg-card p-3 shadow-sm"
    >
      {editingId === cat.id ? (
        <>
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            maxLength={40}
            autoFocus
            className="h-9 flex-1"
          />
          <TypePills value={editingType} onChange={setEditingType} size="sm" />
          <button
            onClick={saveEdit}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
            aria-label="Salvar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span
            className={`flex-1 text-sm font-medium ${
              cat.active ? "text-foreground" : "text-muted-foreground line-through"
            }`}
          >
            {cat.name}
          </span>
          <Switch
            checked={cat.active}
            onCheckedChange={() => toggleCategory(cat.id)}
            aria-label={cat.active ? "Desativar" : "Ativar"}
          />
          <button
            onClick={() => startEdit(cat.id, cat.name, cat.type)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Excluir a categoria "${cat.name}"?`)) {
                deleteCategory(cat.id);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <Link
          to="/perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Categorias</h1>
      </div>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={40}
            className="h-11"
          />
          <Button type="submit" className="h-11 gap-1">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <TypePills value={newType} onChange={setNewType} />
      </form>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingDown className="h-4 w-4 text-red-500" /> Despesas
        </h2>
        {expense.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma categoria de despesa.</p>
        ) : (
          expense.map(renderItem)
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="h-4 w-4 text-emerald-600" /> Receitas
        </h2>
        {income.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma categoria de receita.</p>
        ) : (
          income.map(renderItem)
        )}
      </section>
    </div>
  );
}
