// Cliente mínimo pra Web Push (VAPID) — só roda em funções serverless. As
// chaves (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) são geradas uma vez com
// `web-push generate-vapid-keys` e vivem só nas env vars da Vercel; nunca no
// bundle do navegador (só a pública é exposta, via
// api/notificacoes/vapid-public-key.ts).
import webpush from "web-push";
import { clienteAdmin } from "./supabase-admin.js";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:suporte@kyraone.com.br";

let configurado = false;
function garantirConfigurado() {
  if (configurado) return;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas nas env vars.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
}

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = { titulo: string; corpo: string; url?: string };

// Envia um push pro usuário e, se a assinatura tiver expirado (404/410 — o
// navegador descartou, ex: PWA desinstalado, troca de dispositivo), limpa
// `profiles.push_subscription` pra não insistir em algo morto nas próximas
// tentativas. Nunca lança — quem chama trata o retorno `false` como "não
// consegui entregar", sem travar o fluxo principal (salvar despesa/meta/etc).
export async function enviarPushParaUsuario(
  userId: string,
  subscription: PushSubscriptionJSON,
  payload: PushPayload,
): Promise<boolean> {
  try {
    garantirConfigurado();
    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify({ title: payload.titulo, body: payload.corpo, url: payload.url ?? "/" }),
    );
    return true;
  } catch (erro) {
    const status = (erro as { statusCode?: number } | null)?.statusCode;
    if (status === 404 || status === 410) {
      const admin = clienteAdmin();
      if (admin) await admin.from("profiles").update({ push_subscription: null }).eq("id", userId);
    } else {
      console.error("Erro ao enviar push:", erro);
    }
    return false;
  }
}
