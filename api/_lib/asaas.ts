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

async function chamarAsaas<T>(
  caminho: string,
  opcoes: { method?: string; body?: unknown } = {}
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

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
};

export async function buscarClientePorCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const { ok, dados } = await chamarAsaas<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`
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
    throw new Error(`Falha ao criar cliente no Asaas (status ${status}): ${JSON.stringify(dados)}`);
  }
  return dados;
}

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  nextDueDate: string;
};

export async function criarAssinatura(params: {
  customer: string;
  value: number;
  nextDueDate: string;
  description: string;
}): Promise<AsaasSubscription> {
  const { ok, dados, status } = await chamarAsaas<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: {
      customer: params.customer,
      billingType: "PIX",
      cycle: "MONTHLY",
      value: params.value,
      nextDueDate: params.nextDueDate,
      description: params.description,
    },
  });
  if (!ok || !dados) {
    throw new Error(`Falha ao criar assinatura no Asaas (status ${status}): ${JSON.stringify(dados)}`);
  }
  return dados;
}

export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  const { ok, status } = await chamarAsaas(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
  if (!ok) {
    throw new Error(`Falha ao cancelar assinatura no Asaas (status ${status}).`);
  }
}

export type AsaasPayment = {
  id: string;
  invoiceUrl: string;
  status: string;
};

export async function buscarPrimeiraCobranca(subscriptionId: string): Promise<AsaasPayment | null> {
  const { ok, dados } = await chamarAsaas<{ data: AsaasPayment[] }>(
    `/payments?subscription=${subscriptionId}&limit=1`
  );
  if (!ok || !dados?.data?.length) return null;
  return dados.data[0];
}

const STATUS_PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export async function sincronizarStatusAssinatura(
  subscriptionId: string
): Promise<"ativa" | "inadimplente" | "pendente"> {
  const { ok, dados } = await chamarAsaas<{ data: { status: string }[] }>(
    `/payments?subscription=${subscriptionId}&limit=20`
  );
  if (!ok || !dados?.data?.length) return "pendente";

  if (dados.data.some((p) => STATUS_PAGO.includes(p.status))) return "ativa";
  if (dados.data.some((p) => p.status === "OVERDUE")) return "inadimplente";
  return "pendente";
}
