// Cliente HTTP mínimo pra API do Asaas (cobrança de assinaturas). Só roda em
// funções serverless — usa a API key, nunca importar em código de cliente.
// Sandbox: https://api-sandbox.asaas.com/v3 — produção: https://api.asaas.com/v3
// (troca só via env var ASAAS_API_URL quando for a hora de ir pra produção).
// Mesmo padrão do lib/asaas.ts do Quintalzim — conta Asaas própria do
// KyraOne, API key separada (ASAAS_API_KEY nas env vars da Vercel).

const BASE_URL = process.env.ASAAS_API_URL || "https://api-sandbox.asaas.com/v3";

function chaveApi(): string | null {
  return process.env.ASAAS_API_KEY || null;
}

// Formato padrão de erro do Asaas: { errors: [{ code, description }] }.
type AsaasErrorBody = { errors?: { code: string; description: string }[] };

// Erro estruturado (em vez de só uma string com o JSON cru dentro) — permite
// que quem chama decida a mensagem certa pro usuário final a partir do
// `codigo`, sem precisar fazer parsing de texto. Nunca deve vazar pro
// usuário o JSON bruto do Asaas (isso já aconteceu uma vez, ver
// api/conta/aplicar-desconto-retencao.ts v1.20/v1.21 — corrigido aqui).
export class AsaasError extends Error {
  status: number;
  codigo?: string;

  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.codigo = codigo;
  }
}

// Traduz os códigos de erro do Asaas que já vimos em produção pra uma
// mensagem específica e amigável — nunca cai numa genérica quando o motivo
// já é conhecido. Central pra todo o módulo, assim cada endpoint que chama
// o Asaas devolve a mesma mensagem pro mesmo problema.
export function mensagemAmigavelAsaas(erro: unknown): string {
  if (erro instanceof AsaasError) {
    switch (erro.codigo) {
      case "invalid_action":
        // Caso real já visto: assinatura apagada/alterada direto no painel
        // do Asaas (fora do fluxo do app) — ela deixa de aceitar updates,
        // mesmo continuando "ativa" no nosso banco até o próximo webhook.
        return "Essa assinatura não existe mais no Asaas (pode ter sido alterada ou cancelada direto por lá). Fala com o suporte (suporte@kyraone.com.br) pra gente resolver.";
      case "invalid_customer":
      case "invalid_creditCard":
        return "Seus dados de pagamento no Asaas precisam ser atualizados antes de continuar. Fala com o suporte (suporte@kyraone.com.br).";
      default:
        return "Não consegui concluir essa operação agora. Tenta de novo em instantes, ou fala com o suporte se persistir.";
    }
  }
  return "Não consegui concluir essa operação agora. Tenta de novo em instantes.";
}

async function chamarAsaas<T>(
  caminho: string,
  opcoes: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; dados: T | null }> {
  const chave = chaveApi();
  if (!chave) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method: opcoes.method || "GET",
    headers: {
      "Content-Type": "application/json",
      access_token: chave,
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  const dados = await resposta.json().catch(() => null);
  return { ok: resposta.ok, status: resposta.status, dados: dados as T | null };
}

// Monta o AsaasError a partir do corpo de erro padrão do Asaas, com uma
// mensagem de fallback (pra quando `dados` não vem no formato esperado).
function erroAsaas(status: number, dados: unknown, fallback: string): AsaasError {
  const body = dados as AsaasErrorBody | null;
  const primeiro = body?.errors?.[0];
  return new AsaasError(primeiro?.description ?? fallback, status, primeiro?.code);
}

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
};

export async function buscarClientePorCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const { ok, dados } = await chamarAsaas<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
  );
  if (!ok || !dados?.data?.length) return null;
  return dados.data[0];
}

export async function criarCliente(params: {
  name: string;
  email: string;
  cpfCnpj: string;
}): Promise<AsaasCustomer> {
  const { ok, dados, status } = await chamarAsaas<AsaasCustomer>("/customers", {
    method: "POST",
    body: params,
  });
  if (!ok || !dados) {
    throw erroAsaas(status, dados, `Falha ao criar cliente no Asaas (status ${status}).`);
  }
  return dados;
}

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  nextDueDate: string;
};

export type AsaasBillingType = "PIX" | "CREDIT_CARD";

export async function criarAssinatura(params: {
  customer: string;
  value: number;
  nextDueDate: string;
  description: string;
  billingType: AsaasBillingType;
}): Promise<AsaasSubscription> {
  const { ok, dados, status } = await chamarAsaas<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: {
      customer: params.customer,
      // Fixo em PIX ou CREDIT_CARD (nunca UNDEFINED/BOLETO) — o cliente
      // escolhe o método na tela /assinar, e é esse valor que decide o que
      // a página de cobrança hospedada pelo Asaas (invoiceUrl) vai pedir.
      billingType: params.billingType,
      cycle: "MONTHLY",
      value: params.value,
      nextDueDate: params.nextDueDate,
      description: params.description,
    },
  });
  if (!ok || !dados) {
    throw erroAsaas(status, dados, `Falha ao criar assinatura no Asaas (status ${status}).`);
  }
  return dados;
}

export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  const { ok, status, dados } = await chamarAsaas(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
  if (!ok) {
    throw erroAsaas(status, dados, `Falha ao cancelar assinatura no Asaas (status ${status}).`);
  }
}

// Usado pelo fluxo de retenção (api/conta/aplicar-desconto-retencao.ts): o
// assinante tentou excluir a conta, aceitou um desconto permanente pra
// ficar, e isso atualiza o valor da cobrança mensal já ativa no Asaas.
export async function atualizarValorAssinatura(
  subscriptionId: string,
  value: number,
): Promise<void> {
  const { ok, status, dados } = await chamarAsaas(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: { value },
  });
  if (!ok) {
    // AsaasError estruturado (code/description) em vez de um texto cru com
    // o JSON do Asaas dentro — quem chama usa mensagemAmigavelAsaas() pra
    // traduzir pro usuário final, nunca expõe esse JSON na tela.
    throw erroAsaas(status, dados, `Falha ao atualizar valor da assinatura no Asaas (status ${status}).`);
  }
}

export type AsaasPayment = {
  id: string;
  invoiceUrl: string;
  status: string;
};

export async function buscarPrimeiraCobranca(subscriptionId: string): Promise<AsaasPayment | null> {
  const { ok, dados } = await chamarAsaas<{ data: AsaasPayment[] }>(
    `/payments?subscription=${subscriptionId}&limit=1`,
  );
  if (!ok || !dados?.data?.length) return null;
  return dados.data[0];
}

const STATUS_PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export async function sincronizarStatusAssinatura(
  subscriptionId: string,
): Promise<"ativa" | "inadimplente" | "pendente"> {
  const { ok, dados } = await chamarAsaas<{ data: { status: string }[] }>(
    `/payments?subscription=${subscriptionId}&limit=20`,
  );
  if (!ok || !dados?.data?.length) return "pendente";

  if (dados.data.some((p) => STATUS_PAGO.includes(p.status))) return "ativa";
  if (dados.data.some((p) => p.status === "OVERDUE")) return "inadimplente";
  return "pendente";
}
