import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Settings, ChevronRight, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useAssinatura, nomeNivel, diasRestantesTrial } from "@/lib/assinaturas";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

function rotuloStatus(status: string | null, diasTrial: number | null) {
  if (status === "trial") {
    if (diasTrial === null || diasTrial <= 0) return { texto: "Trial expirado", cor: "text-red-600 bg-red-50" };
    return { texto: `Trial — ${diasTrial} ${diasTrial === 1 ? "dia" : "dias"} restantes`, cor: "text-sky-600 bg-sky-50" };
  }
  if (status === "ativa") return { texto: "Ativa", cor: "text-emerald-600 bg-emerald-50" };
  if (status === "pendente") return { texto: "Aguardando pagamento", cor: "text-amber-600 bg-amber-50" };
  if (status === "inadimplente") return { texto: "Pagamento atrasado", cor: "text-red-600 bg-red-50" };
  if (status === "cancelada") return { texto: "Cancelada", cor: "text-slate-500 bg-slate-100" };
  return { texto: "Sem assinatura", cor: "text-slate-500 bg-slate-100" };
}

function PerfilPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const est = useAssinatura();

  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("id", user.id).single()
      .then(({ data }) => setName(data?.name ?? user.user_metadata?.name ?? ""));
    setEmail(user.email ?? "");
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background md:max-w-2xl md:mx-auto">

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
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-3">

        {/* Minha assinatura — superadmin não assina nada, então o card é
            só informativo (sem navegação pra tela de planos) */}
        {est.ehSuperadmin ? (
          <div className="flex w-full items-center gap-3.5 rounded-2xl border bg-white dark:bg-card px-4 py-3.5 shadow-sm text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <ShieldCheck className="h-5 w-5 text-indigo-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">Acesso de superadmin</p>
              <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">
                Acesso total liberado, sem necessidade de assinatura
              </p>
            </div>
          </div>
        ) : (
          <button onClick={() => router.navigate({ to: "/assinar" })}
            className="flex w-full items-center gap-3.5 rounded-2xl border bg-white dark:bg-card px-4 py-3.5 shadow-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-muted/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <CreditCard className="h-5 w-5 text-indigo-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-slate-800 dark:text-foreground">
                {est.nivel !== "nenhum" ? nomeNivel(est.nivel) : "Minha assinatura"}
              </p>
              <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${rotuloStatus(est.status, diasRestantesTrial(est)).cor}`}>
                {rotuloStatus(est.status, diasRestantesTrial(est)).texto}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0"/>
          </button>
        )}

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
          <LogOut className="h-4 w-4"/> Sair
        </button>

        <p className="text-center text-xs text-muted-foreground pt-2">KyraOne v1.0</p>
      </div>
    </div>
  );
}
