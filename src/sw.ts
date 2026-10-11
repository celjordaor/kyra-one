/// <reference lib="webworker" />
// Service worker customizado do KyraOne. Trocado de `generateSW` (padrão do
// VitePWA, só cache/offline, sem como adicionar lógica própria) pra
// `injectManifest` — o Workbox ainda cuida do precache/offline normalmente,
// mas aqui também escutamos `push` (pra notificações de alerta de despesa,
// meta atingida e resumo mensal — ver api/notificacoes/disparar.ts) e
// `notificationclick` (pra abrir a tela certa ao tocar na notificação).
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());

// Mesma config de cache que já existia (generateSW/workbox.runtimeCaching,
// antes desta troca pra injectManifest) — NetworkFirst pra API do Supabase,
// com timeout curto pra não travar a UI offline esperando a rede.
registerRoute(
  ({ url }) => url.hostname.endsWith(".supabase.co"),
  new NetworkFirst({
    cacheName: "supabase-api-cache",
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 })],
  }),
);

// ── Notificações push ───────────────────────────────────────────────────────
// Payload enviado por api/_lib/push.ts: { title, body, url }.
self.addEventListener("push", (event) => {
  let dados: { title?: string; body?: string; url?: string } = {};
  try {
    dados = event.data?.json() ?? {};
  } catch {
    dados = { title: "KyraOne", body: event.data?.text() ?? "" };
  }

  const titulo = dados.title || "KyraOne";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: dados.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Se o KyraOne já estiver aberto numa aba, foca ela e navega, em vez de
      // abrir uma aba nova por cima.
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await (client as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
