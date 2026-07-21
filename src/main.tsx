import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { getRouter } from "./router";
import { supabase } from "./lib/supabase";
import "./styles.css";

// ── Receptor SSO do portal Quintalzim ──────────────────────────────────
// O portal redireciona de volta com #access_token=...&refresh_token=... no
// fragmento da URL. Antes do guard de auth avaliar a rota, consumimos o
// fragmento, autenticamos a sessão local e limpamos a URL.
async function receiveSsoSession() {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) {
    console.warn("[sso] falha ao autenticar sessão recebida do portal:", error.message);
  }

  const path = window.location.pathname;
  const nextPath = path === "/" || path === "/login" ? "/dashboard" : path;
  window.history.replaceState(null, "", nextPath + window.location.search);
}

async function bootstrap() {
  await receiveSsoSession();

  const router = getRouter();
  const rootElement = document.getElementById("root")!;
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
}

bootstrap();
