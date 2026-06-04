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
  if (!plan) {
    return { statusCode: 400, body: JSON.stringify({ error: "Plano inválido" }) };
  }

  const amount   = billingCycle === "annual" ? plan.annual : plan.monthly;
  const freq     = billingCycle === "annual" ? 12 : 1;
  const label    = billingCycle === "annual" ? "Anual" : "Mensal";
  const siteUrl  = process.env.URL || "https://jadeone.com.br";
  const mpToken  = process.env.MP_ACCESS_TOKEN;

  if (!mpToken) {
    return { statusCode: 500, body: JSON.stringify({ error: "MP_ACCESS_TOKEN não configurado" }) };
  }

  console.log("Criando assinatura MP para:", userEmail, planId, billingCycle, amount);

  try {
    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: `JadeOne - Plano ${plan.name} ${label}`,
        external_reference: userId,
        payer_email: userEmail,
        back_url: `${siteUrl}/assinatura-sucesso`,
        auto_recurring: {
          frequency: freq,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
        status: "pending",
      }),
    });

    const mpData = await mpRes.json();
    console.log("Resposta MP (status:", mpRes.status, "):", JSON.stringify(mpData));

    if (!mpData.id || !mpData.init_point) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Erro ao criar assinatura no Mercado Pago",
          mp_status: mpRes.status,
          mp_error: mpData,
        }),
      };
    }

    // Salvar MP ID no Supabase
    const supRes = await fetch(
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

    if (!supRes.ok) {
      console.error("Erro Supabase:", await supRes.text());
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ checkout_url: mpData.init_point, mp_id: mpData.id }),
    };
  } catch (err) {
    console.error("Erro interno create-checkout:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Erro interno", detail: String(err) }) };
  }
};
