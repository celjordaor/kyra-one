import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAssinatura } from "@/lib/assinaturas";
import { formatBRL } from "@/lib/goals-store";
import { listarPlanos } from "@/lib/planos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings2, X } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

type Assinante = {
  profileId: string;
  email: string;
  cpf: string;
  planoId: string;
  plano: string;
  status: string;
  trialFim: string | null;
  atualizadoEm: string;
};

type DadosAdmin = {
  totalContas: number;
  totalAssinantesAtivos: number;
  mrr: number;
  porPlano: Record<string, number>;
  inadimplentes: number;
  pendentes: number;
  canceladas: number;
  assinantes: Assinante[];
};

const STATUS_OPCOES = [
  { valor: "trial", label: "Trial" },
  { valor: "pendente", label: "Pendente" },
  { valor: "ativa", label: "Ativa" },
  { valor: "inadimplente", label: "Inadimplente" },
  { valor: "cancelada", label: "Cancelada / suspensa" },
];

function formatarData(iso: string | null) {
  if (!iso) return "—";
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
  if (status === "trial") return "text-sky-600 bg-sky-50";
  return "text-slate-500 bg-slate-100";
}

function AdminPage() {
  const est = useAssinatura();
  const [dados, setDados] = useState<DadosAdmin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Form da conta em edição
  const [fStatus, setFStatus] = useState("");
  const [fPlano, setFPlano] = useState("");
  const [fCpf, setFCpf] = useState("");
  const [fDiasTrial, setFDiasTrial] = useState("7");

  async function carregar() {
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
  }

  useEffect(() => {
    if (est.loading) return;
    if (!est.ehSuperadmin) return;
    carregar().catch((e) => {
      console.error("[admin]", e);
      setErro("Não consegui carregar o painel.");
    });
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

  function abrirEdicao(a: Assinante) {
    setEditandoId(a.profileId);
    setFStatus(a.status);
    setFPlano(a.planoId);
    setFCpf(a.cpf || "");
    setFDiasTrial("7");
  }

  function fecharEdicao() {
    setEditandoId(null);
  }

  async function salvar(campo: "status" | "plano" | "cpf" | "trial", a: Assinante) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const body: Record<string, unknown> = { profileId: a.profileId };
    if (campo === "status") body.status = fStatus;
    if (campo === "plano") body.plano = fPlano;
    if (campo === "cpf") {
      const limpo = fCpf.replace(/\D/g, "");
      if (limpo.length !== 11) {
        toast.error("CPF inválido.");
        return;
      }
      body.cpf = limpo;
    }
    if (campo === "trial") {
      const dias = Number(fDiasTrial);
      if (!dias || dias <= 0) {
        toast.error("Informa quantos dias adicionar.");
        return;
      }
      body.trialDiasExtras = dias;
    }

    setSalvando(true);
    try {
      const resp = await fetch("/api/admin/atualizar-conta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json?.erro ?? "Não consegui salvar.");
        return;
      }
      toast.success("Atualizado!");
      await carregar();
    } catch {
      toast.error("Não consegui salvar agora. Tenta de novo.");
    } finally {
      setSalvando(false);
    }
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
            {dados.assinantes.map((a) => (
              <div key={a.profileId} className="border-b last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{a.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.plano} · {formatarData(a.atualizadoEm)}
                      {a.status === "trial" && a.trialFim ? ` · trial até ${formatarData(a.trialFim)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${corStatus(a.status)}`}>
                      {a.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => (editandoId === a.profileId ? fecharEdicao() : abrirEdicao(a))}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      title="Gerenciar"
                    >
                      {editandoId === a.profileId ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {editandoId === a.profileId && (
                  <div className="mt-3 space-y-3 rounded-xl bg-muted/40 p-3">
                    {/* Status: suspender / reativar / marcar inadimplente */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                      <div className="flex gap-2">
                        <select
                          value={fStatus}
                          onChange={(e) => setFStatus(e.target.value)}
                          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {STATUS_OPCOES.map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" disabled={salvando} onClick={() => salvar("status", a)}>
                          Salvar
                        </Button>
                      </div>
                    </div>

                    {/* Plano */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano</p>
                      <div className="flex gap-2">
                        <select
                          value={fPlano}
                          onChange={(e) => setFPlano(e.target.value)}
                          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {listarPlanos().map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" disabled={salvando} onClick={() => salvar("plano", a)}>
                          Salvar
                        </Button>
                      </div>
                    </div>

                    {/* CPF */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CPF</p>
                      <div className="flex gap-2">
                        <Input
                          value={fCpf}
                          onChange={(e) => setFCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="h-9 flex-1"
                        />
                        <Button size="sm" disabled={salvando} onClick={() => salvar("cpf", a)}>
                          Salvar
                        </Button>
                      </div>
                    </div>

                    {/* Estender trial */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Estender trial (dias)
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={fDiasTrial}
                          onChange={(e) => setFDiasTrial(e.target.value)}
                          className="h-9 w-24"
                        />
                        <Button size="sm" disabled={salvando} onClick={() => salvar("trial", a)}>
                          Adicionar dias
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
