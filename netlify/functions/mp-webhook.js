exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { type, data, action } = body;

    console.log("Webhook MP recebido:", JSON.stringify({ type, action, data }));

    // Processar assinaturas
    if (type === "subscription_preapproval" && data?.id) {
      await handleSubscription(data.id);
    }

    // Processar pagamentos individuais
    if (type === "payment" && data?.id) {
      await handlePayment(data.id);
    }

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Erro webhook:", err);
    return { statusCode: 200, body: "OK" }; // Sempre 200 para MP não reenviar
  }
};

async function handleSubscription(mpId) {
  // Buscar detalhes da assinatura no MP
  const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${mpId}`, {
    headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  const sub = await mpRes.json();

  console.log("Assinatura MP:", sub.status, sub.external_reference);

  // Mapear status do MP para o nosso
  const STATUS_MAP = {
    authorized: "active",
    pending:    "trial",
    paused:     "past_due",
    cancelled:  "cancelled",
  };

  const ourStatus = STATUS_MAP[sub.status] || "inactive";
  const userId = sub.external_reference;

  if (!userId) return;

  const updates = {
    status: ourStatus,
    updated_at: new Date().toISOString(),
  };

  // Se ativou, limpar carência e definir fim do período
  if (ourStatus === "active") {
    updates.grace_period_ends_at = null;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    updates.current_period_end = periodEnd.toISOString();
  }

  // Se pausou (falha no pagamento), definir carência de 5 dias
  if (ourStatus === "past_due") {
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 5);
    updates.grace_period_ends_at = graceEnd.toISOString();
  }

  await updateSubscription(userId, updates);
}

async function handlePayment(paymentId) {
  // Buscar detalhes do pagamento no MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  const payment = await mpRes.json();

  console.log("Pagamento MP:", payment.status, payment.external_reference);

  const userId = payment.external_reference;
  if (!userId) return;

  if (payment.status === "approved") {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await updateSubscription(userId, {
      status: "active",
      grace_period_ends_at: null,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 5);
    await updateSubscription(userId, {
      status: "past_due",
      grace_period_ends_at: graceEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

async function updateSubscription(userId, updates) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!res.ok) {
    console.error("Erro ao atualizar Supabase:", await res.text());
  }
}
