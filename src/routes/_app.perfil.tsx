import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Settings, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { supabase } from "@/lib/supabase";
import { Crown, Star } from "lucide-react";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

function PerfilPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { subscription } = useSubscription();

  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("id", user.id).single()
      .then(({ data }) => setName(data?.name ?? user.user_metadata?.name ?? ""));
    setEmail(user.email ?? "");
  }, [user]);

  const isAdvancado = subscription?.isAdvancado ?? false;
  const planName    = subscription?.planName ?? "Essencial";

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* ── Header com avatar ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-12 pb-10 text-white">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-2xl font-black">
            {getInitials(name || email)}
          </div>
          <div>
            <p className="text-xl font-bold">{name || "Sem nome"}</p>
            <p className="text-sm text-white/60 mt-0.5">{email}</p>
          </div>
          {/* Badge do plano */}
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mt-1"
            style={{
              background: isAdvancado ? "#10b98122" : "#f59e0b22",
              border: `1px solid ${isAdvancado ? "#10b98144" : "#f59e0b44"}`,
            }}>
            {isAdvancado
              ? <Crown className="h-3.5 w-3.5 text-emerald-400"/>
              : <Star  className="h-3.5 w-3.5 text-amber-400"/>}
            <span className="text-xs font-semibold" style={{ color: isAdvancado ? "#10b981" : "#f59e0b" }}>
              Plano {planName}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-3">

        {/* Info do plano */}
        <div className="rounded-2xl border bg-white dark:bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano atual</p>
              <p className="mt-0.5 text-base font-bold text-foreground">{planName}</p>
              {subscription?.status === "trial" && subscription.daysLeft !== null && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Período de teste — {subscription.daysLeft} dias restantes
                </p>
              )}
              {subscription?.status === "active" && (
                <p className="text-xs text-primary">Assinatura ativa</p>
              )}
            </div>
            <button onClick={() => router.navigate({ to: "/planos" })}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              {isAdvancado ? "Gerenciar" : "Upgrade"}
            </button>
          </div>
        </div>

        {/* Atalho para Configurações */}
        <button onClick={() => router.navigate({ to: "/mais" })}
          className="flex w-full items-center gap-3.5 rounded-2xl border bg-white dark:bg-card px-4 py-3.5 shadow-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-muted/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted">
            <Settings className="h-5 w-5 text-slate-600 dark:text-muted-foreground"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">Configurações</p>
            <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">
              Perfil, segurança, notificações e mais
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0"/>
        </button>

        {/* Sair */}
        <button type="button" onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-card py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
          <LogOut className="h-4 w-4"/> Sair da conta
        </button>

        <p className="text-center text-xs text-muted-foreground pt-2">JadeOne v1.0</p>
      </div>
    </div>
  );
}
