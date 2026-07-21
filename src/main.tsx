import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { getRouter } from "./router";
import { supabase } from "./lib/supabase";
import "./styles.css";

const rootElement = document.getElementById("root")!;

// Splash mínimo exibido apenas enquanto o token SSO está sendo trocado
// pela sessão — evita que o roteador chegue a montar (e o guard de auth
// avaliar a rota) antes desse processamento terminar.
function showSsoSplash() {
  rootElement.innerHTML = `
    <div style="display:flex;min-height:100dvh;width:100%;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:var(--background);color:var(--foreground);font-family:system-ui,sans-serif;">
      <div style="height:32px;width:32px;border-radius:9999px;border:4px solid var(--primary);border-top-color:transparent;animation:sso-spin 0.8s linear infinite;"></div>
      <p style="font-size:14px;font-weight:600;margin:0;">Abrindo seu Quintal... 🌱</p>
    </div>
    <style>@keyframes sso-spin{to{transform:rotate(360deg)}}</style>
  `;
}

// ── Receptor SSO do portal Quintalzim ──────────────────────────────────
// O portal redireciona de volta com #access_token=...&refresh_token=... no
// fragmento da URL. Isso precisa ser resolvido de forma bloqueante e ANTES
// do roteador ser criado/montado — caso contrário o guard de auth (ou o
// beforeLoad de "/") avalia a rota primeiro e manda o usuário para /login,
// descartando o fragmento no caminho.
async function receiveSsoSession(): Promise<void> {
  const hash = window.location.hash;
  if (!hash.includes("access_token") || !hash.includes("refresh_token")) return;

  showSsoSplash();

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return;
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  const path = window.location.pathname;
  // Só força a rota inicial logada em caso de sucesso — se setSession falhar,
  // apenas limpamos o hash e seguimos ao fluxo normal (guard manda a /login).
  const nextPath = !error && (path === "/" || path === "/login") ? "/dashboard" : path;
  window.history.replaceState(null, "", nextPath + window.location.search);

  if (error) {
    console.warn("[sso] falha ao autenticar sessão recebida do portal:", error.message);
  }
}

async function bootstrap() {
  await receiveSsoSession();

  const router = getRouter();
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
}

bootstrap();
