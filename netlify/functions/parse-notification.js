// netlify/functions/parse-notification.js
// Recebe o texto de uma notificação de banco/cartão e usa a API do Claude
// para extrair: valor, descrição, estabelecimento, se é cartão, qual cartão.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let text = "";
  try {
    const body = JSON.parse(event.body || "{}");
    text = (body.text || "").trim();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "text is required" }) };
  }

  const prompt = `Você é um assistente financeiro especializado em notificações de bancos e cartões brasileiros.

Analise a seguinte notificação e extraia as informações da transação.

NOTIFICAÇÃO:
"${text}"

Responda SOMENTE com um objeto JSON válido (sem markdown, sem explicação):

{
  "amount": <número em reais, ex: 150.00>,
  "merchant": "<nome limpo do estabelecimento, ex: 'Supermercado Extra' não 'SUPERMERCADO EXTRA LTDA'>",
  "description": "<descrição curta e clara da transação>",
  "isCard": <true se for compra em cartão de crédito, false se for débito/transferência/PIX>,
  "cardHint": "<nome do banco ou cartão mencionado, ex: 'Nubank', 'Itaú', 'C6', 'Bradesco', ou null se não mencionado>",
  "transactionType": "<'expense' ou 'income'>",
  "confidence": <número de 0 a 1 indicando sua confiança na extração>
}

Regras:
- Se a notificação mencionar "crédito", "cartão", "aprovada no cartão" → isCard: true
- Se mencionar "débito", "PIX", "transferência", "conta" → isCard: false
- Quando houver dúvida, prefira isCard: true (o usuário informou que a maioria é cartão)
- amount deve ser um número puro, ex: 150.00 (não "R$ 150,00")
- Se não conseguir extrair o valor, retorne: {"error": "Não foi possível identificar o valor da transação"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-notification] Claude API error:", err);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Erro ao processar com a IA. Tente novamente." }),
      };
    }

    const data = await response.json();
    const rawText = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Remove possíveis backticks de markdown
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error("[parse-notification] erro:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Erro interno ao processar a notificação." }),
    };
  }
};
