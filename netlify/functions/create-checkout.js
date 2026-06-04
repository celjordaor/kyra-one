exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { planId, billingCycle, userId, userEmail } = JSON.parse(event.body || "{}");

  if (!planId || !userId || !userEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: "Dados incompletos" }) };
  }

  const PLANS = {
    essencial: { name: "Essencial", monthly: 9.90, annual: 99.00 },
    avancado:  { name: "Avançado",  monthly: 19.90, annual: 199.00 },
  };

  const plan   = PLANS[planId];
  const amount = billingCycle === "annual" ? plan.annual : plan.monthly;
  const freq   = billingCycle === "annual" ? 12 : 1; // meses
  const label  = billingCycle === "annual" ? "Anual" : "Mensal";
  const siteUrl = process.env.URL || "https://jadeone.com.br";

  try {
    // 1. Criar assinatura no Mercado Pago
    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: `JadeOne – Plano ${plan.name} ${label}`,
        external_reference: userId,
        payer_email: userEmail,
        back_url: `${siteUrl}/assinatura-sucesso`,
        auto_recurring: {
          frequency: freq,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
      }),
    });

    const mpData = await mpRes.json();

    if (!mpData.id || !mpData.init_point) {
      console.error("Erro MP:", mpData);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Erro ao criar assinatura no Mercado Pago", detail: mpData }),
      };
    }

    // 2. Salvar o ID do Mercado Pago no banco
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          external_subscription_id: mpData.id,
          payment_provider: "mercado_pago",
          plan_id: planId,
          billing_cycle: billingCycle,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ checkout_url: mpData.init_point, mp_id: mpData.id }),
    };
  } catch (err) {
    console.error("Erro create-checkout:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erro interno" }) };
  }
};
