// src/components/scope-bottom-sheet.tsx
// Componente compartilhado de seleção de escopo de edição.
// Visual padronizado (bottom sheet com opções azul/vermelho) usado em:
//   - Tela de Transações (_app.transacoes.tsx)
//   - Tela de Despesas no cartão (expense-detail-modal.tsx)
//   - Modais do dashboard (_app.dashboard.tsx)

import { cn } from "@/lib/utils";

export type ScopeType = "single" | "bulk";

export interface ScopeBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (scope: ScopeType) => void;
  /** "installment" | "recurring" | "generic" — determina os textos exibidos */
  expenseType?: "installment" | "recurring" | "generic";
  /** Título opcional da transação (exibido no cabeçalho) */
  title?: string;
}

const LABELS: Record<
  "installment" | "recurring" | "generic",
  { heading: string; single: string; singleSub: string; bulk: string; bulkSub: string }
> = {
  installment: {
    heading:   "parcelada",
    single:    "Apenas esta parcela",
    singleSub: "Altera somente a parcela atual",
    bulk:      "Esta e as próximas parcelas",
    bulkSub:   "Altera da parcela atual em diante",
  },
  recurring: {
    heading:   "recorrente",
    single:    "Apenas este lançamento",
    singleSub: "Altera somente o lançamento do mês atual",
    bulk:      "Este e os próximos lançamentos",
    bulkSub:   "Altera a partir deste mês em diante",
  },
  generic: {
    heading:   "repetida",
    single:    "Apenas esta ocorrência",
    singleSub: "Altera somente este lançamento específico",
    bulk:      "Esta e as próximas ocorrências",
    bulkSub:   "Altera a partir deste ponto em diante",
  },
};

export function ScopeBottomSheet({
  open,
  onClose,
  onSelect,
  expenseType = "generic",
  title,
}: ScopeBottomSheetProps) {
  if (!open) return null;

  const L = LABELS[expenseType];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm" onClick={onClose}/>

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[501] rounded-t-3xl bg-white dark:bg-card overflow-hidden shadow-2xl"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-muted"/>
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-border">
          <div>
            <h2 className="text-[18px] font-bold text-foreground">
              Editar — <span className="text-slate-500 dark:text-muted-foreground font-semibold">{L.heading}</span>
            </h2>
            {title && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[260px]">"{title}"</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-muted text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Opções */}
        <div className="px-4 py-4 space-y-3 pb-[env(safe-area-inset-bottom,16px)]">

          {/* Opção azul — Apenas esta */}
          <button
            type="button"
            onClick={() => onSelect("single")}
            className="flex w-full items-center gap-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-100 dark:border-blue-900/40 px-4 py-4 text-left transition-all active:scale-[0.98] hover:border-blue-300"
          >
            <div className="h-4 w-4 rounded-full bg-blue-500 shrink-0"/>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-blue-700 dark:text-blue-400 leading-snug">{L.single}</p>
              <p className="text-[13px] text-slate-500 dark:text-muted-foreground mt-0.5">{L.singleSub}</p>
            </div>
          </button>

          {/* Opção vermelha — Esta e próximas */}
          <button
            type="button"
            onClick={() => onSelect("bulk")}
            className="flex w-full items-center gap-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-100 dark:border-red-900/40 px-4 py-4 text-left transition-all active:scale-[0.98] hover:border-red-300"
          >
            <div className="h-4 w-4 rounded-full bg-red-500 shrink-0"/>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-red-600 dark:text-red-400 leading-snug">{L.bulk}</p>
              <p className="text-[13px] text-slate-500 dark:text-muted-foreground mt-0.5">{L.bulkSub}</p>
            </div>
          </button>

        </div>
      </div>
    </>
  );
}
