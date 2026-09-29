import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAssinatura } from "@/lib/assinaturas";
import { formatBRL } from "@/lib/goals-store";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

type DadosAdmin = {
  totalContas: number;
  totalAssinantesAtivos: number;
  mrr: number;
  porPlano: Record<string, number>;
  inadimplentes: number;
  pendentes: number;
  canceladas: number;
  assinantes: { email: string; plano: string; status: string; atualizadoEm: string }[];
};

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function corStatus(status: string) {
  if (status === "ativa") return "text-emerald-600 bg-emerald-50";
  if (status === "pendente") return "text-amber-600 bg-amber-50";
  if (status === "inadimplente") return "text-red-600 bg-red-50";
  return "text-slate-500 bg-slate-100";
}

function AdminPage() {
  const est = useAssinatura();
  const [dados, setDados] = useState<DadosAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (est.loading) return;
    if (!est.ehSuperadmin) return;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErro(json?.erro ?? "Não consegui carregar o painel.");
        return;
      }
      setDados(json);
    })();
  }, [est.loading, est.ehSuperadmin]);

  if (!est.loading && !est.ehSuperadmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-12 text-center">
        <p className="text-muted-foreground">Essa página é restrita.</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-6 py-12 text-center">
        <p className="text-muted-foreground">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 md:py-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="text-muted-foreground">Visão geral de assinantes e receita do KyraOne.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Contas totais</p>
          <p className="text-2xl font-bold text-foreground">{dados.totalContas}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Assinantes ativos</p>
          <p className="text-2xl font-bold text-emerald-600">{dados.totalAssinantesAtivos}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="text-2xl font-bold text-foreground">{formatBRL(dados.mrr)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Inadimplentes</p>
          <p className="text-2xl font-bold text-red-600">{dados.inadimplentes}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Por plano</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Kyra One Controle</span>
          <span className="font-semibold text-foreground">{dados.porPlano.kyraone_controle ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Kyra One Pro</span>
          <span className="font-semibold text-foreground">{dados.porPlano.kyraone_pro ?? 0}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Pendentes / Canceladas</span>
          <span className="font-semibold text-foreground">
            {dados.pendentes} / {dados.canceladas}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">Assinaturas</p>
        {dados.assinantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma assinatura ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dados.assinantes.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{a.email}</p>
                  <p className="text-xs text-muted-foreground">{a.plano} · {formatarData(a.atualizadoEm)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${corStatus(a.status)}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
