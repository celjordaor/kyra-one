import { useState } from "react";
import { Layers, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallmentPickerProps {
  amount: number;        // valor total já parseado
  value: number;         // parcelas selecionadas atualmente
  onChange: (n: number) => void;
}

export function InstallmentPicker({ amount, value, onChange }: InstallmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [inputQty, setInputQty] = useState(String(value));
  const maxInstallments = 12;

  const options = Array.from({ length: maxInstallments }, (_, i) => {
    const n = i + 1;
    const installmentValue = amount > 0 ? Math.round((amount / n) * 100) / 100 : 0;
    return { n, installmentValue };
  });

  const selected = options.find((o) => o.n === value);

  const handleSelect = (n: number) => {
    onChange(n);
    setInputQty(String(n));
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "");
    setInputQty(v);
    const n = parseInt(v, 10);
    if (n >= 1 && n <= maxInstallments) onChange(n);
  };

  if (amount <= 0) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">Parcelamento</label>

      {/* Botão que abre o modal */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors",
          value > 1
            ? "border-primary bg-primary/5 text-primary"
            : "border-border bg-card text-foreground hover:bg-accent"
        )}
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {value === 1 ? (
            <span className="text-muted-foreground">À vista (sem parcelamento)</span>
          ) : (
            <span className="font-medium">
              {value}x de{" "}
              {selected?.installmentValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          )}
        </div>
        {value > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(1);
              setInputQty("1");
            }}
            className="ml-2 rounded-full p-0.5 hover:bg-primary/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      {/* Modal / Bottom Sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Painel */}
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-card pb-safe sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-base font-semibold text-foreground">
                Como sua compra se repete?
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Input de quantidade no topo */}
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Número de vezes</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={inputQty}
                  onChange={handleInputChange}
                  className="ml-auto w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm font-medium focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Lista de opções */}
            <div className="max-h-72 overflow-y-auto">
              {options.map(({ n, installmentValue }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleSelect(n)}
                  className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-medium text-foreground">
                    {n}x de{" "}
                    {installmentValue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                    {n === 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">(à vista)</span>
                    )}
                  </span>
                  {value === n && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {value !== n && (
                    <div className="h-5 w-5 rounded-full border border-border" />
                  )}
                </button>
              ))}
            </div>

            {/* Botão confirmar */}
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
              >
                CONCLUÍDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
