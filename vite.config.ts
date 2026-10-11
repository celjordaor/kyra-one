import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest em vez do generateSW padrão: precisamos de um service
      // worker próprio (src/sw.ts) pra escutar `push`/`notificationclick`
      // (notificações de alerta de despesa, meta atingida e resumo mensal —
      // ver api/notificacoes/disparar.ts). O Workbox ainda cuida do
      // precache/offline de sempre, só que a partir do nosso arquivo.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      includeAssets: ["favicon.ico", "icons/*.png"],
      manifest: {
        name: "KyraOne",
        short_name: "KyraOne",
        description: "Controle suas finanças de forma simples e inteligente.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FBF7EC",
        theme_color: "#3F6B34",
        lang: "pt-BR",
        categories: ["finance", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // ── Share Target API ────────────────────────────────────────────
        // Registra o KyraOne como destino de compartilhamento no Android.
        // Texto da notificação do banco/cartão chega como ?text=... na rota
        // /share-intent. Uso: toque longo na notificação → Compartilhar → KyraOne
        share_target: {
          action: "/share-intent",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
      // `workbox.runtimeCaching` (NetworkFirst pra API do Supabase) só vale
      // pra generateSW — com injectManifest essa rota agora é registrada à
      // mão dentro de src/sw.ts, com a mesma config de antes.
    }),
  ],
});
