import type { VercelRequest, VercelResponse } from "@vercel/node";

// Chave pública VAPID — segura de expor (é assim que o Web Push funciona: a
// chave privada nunca sai do servidor). Usada pelo navegador ao assinar o
// push (PushManager.subscribe), em src/lib/notificacoes-store.ts.
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ erro: "Método não permitido." });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ erro: "Notificações push ainda não configuradas." });
  }
  return res.status(200).json({ publicKey });
}
