// Utilitário para comunicar o tipo pré-selecionado ao formulário de nova transação
// Usa sessionStorage para não poluir a URL nem alterar a rota existente

const KEY = "jadeone:new-transaction-type";

export function setPreselectedTransactionType(type: "income" | "expense") {
  sessionStorage.setItem(KEY, type);
}

export function getAndClearPreselectedTransactionType(): "income" | "expense" | null {
  const value = sessionStorage.getItem(KEY) as "income" | "expense" | null;
  if (value) sessionStorage.removeItem(KEY);
  return value;
}
