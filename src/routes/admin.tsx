import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Users, TrendingUp, AlertTriangle, XCircle,
  Clock, CheckCircle, MoreVertical, Search,
  ArrowLeft, RefreshCw, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useAdminData, type AdminUser } from "@/lib/admin-store";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminWrapper,
});

function AdminWrapper() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  if (authLoading) return <LoadingScreen />;

  // Check admin via profile (loaded lazily)
  if (isAdmin === null) {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("profiles").select("role").eq("id", user?.id ?? "").single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    });
    return <LoadingScreen />;
  }

  if (!isAdmin) return <Navigate to="/dashboard" />;
  return <AdminPage />;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

type Tab = "overview" | "users";
type StatusFilter = "all" | "trial" | "active" | "past_due" | "inactive" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  trial: "Trial", active: "Ativo", past_due: "Inadimplente",
  inactive: "Bloqueado", cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-orange-100 text-orange-700",
  inactive: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function AdminPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { users, metrics, loading, reload, updateStatus, updatePlan, extendTrial } = useAdminData();
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.role === "admin") return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, search, statusFilter]);

  const handleAction = async (action: string, user: AdminUser) => {
    const labels: Record<string, string> = {
      active: "Assinatura ativada",
      past_due: "Marcado como inadimplente",
      inactive: "Acesso bloqueado",
      cancelled: "Assinatura cancelada",
      trial: "Trial estendido por 7 dias",
      essencial: "Plano alterado para Essencial",
      avancado: "Plano alterado para Avançado",
    };

    if (action === "trial") {
      await extendTrial(user.id, 7);
    } else if (action === "essencial" || action === "avancado") {
      await updatePlan(user.id, action);
    } else {
      await updateStatus(user.id, action);
    }
    toast.success(labels[action] ?? "Atualizado");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-bold text-foreground">Painel Admin</span>
            </div>
          </div>
          <button
            onClick={reload}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {([["overview", "Visão Geral"], ["users", "Usuários"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* VISÃO GERAL */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard icon={Users} label="Total usuários" value={metrics.total} color="text-foreground" />
              <MetricCard icon={Clock} label="Em trial" value={metrics.trial} color="text-amber-600" />
              <MetricCard icon={CheckCircle} label="Ativos" value={metrics.active} color="text-emerald-600" />
              <MetricCard icon={AlertTriangle} label="Inadimplentes" value={metrics.pastDue} color="text-orange-500" />
              <MetricCard icon={XCircle} label="Bloqueados" value={metrics.inactive} color="text-red-500" />
              <MetricCard icon={TrendingUp} label="MRR estimado"
                value={`R$ ${metrics.mrrEstimate.toFixed(2).replace(".", ",")}`}
                color="text-primary" />
            </div>

            {/* Status breakdown */}
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">Distribuição por status</p>
              <div className="space-y-2">
                {[
                  { label: "Trial", value: metrics.trial, color: "bg-amber-400" },
                  { label: "Ativos", value: metrics.active, color: "bg-emerald-500" },
                  { label: "Inadimplentes", value: metrics.pastDue, color: "bg-orange-400" },
                  { label: "Bloqueados", value: metrics.inactive, color: "bg-red-500" },
                  { label: "Cancelados", value: metrics.cancelled, color: "bg-gray-400" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-muted-foreground">{item.label}</span>
                    <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${item.color} transition-all`}
                        style={{ width: metrics.total > 0 ? `${(item.value / metrics.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* USUÁRIOS */}
        {tab === "users" && (
          <div className="space-y-3">
            {/* Search and filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", "trial", "active", "past_due", "inactive", "cancelled"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {s === "all" ? "Todos" : STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {/* User list */}
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(u.name || u.email)[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.name || "Sem nome"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[u.status]}`}>
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {u.planName} • {u.billingCycle === "annual" ? "Anual" : "Mensal"}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Status</p>
                        <DropdownMenuItem onClick={() => handleAction("active", u)} className="cursor-pointer gap-2 text-emerald-600">
                          <CheckCircle className="h-4 w-4" /> Ativar assinatura
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("past_due", u)} className="cursor-pointer gap-2 text-orange-500">
                          <AlertTriangle className="h-4 w-4" /> Marcar inadimplente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("inactive", u)} className="cursor-pointer gap-2 text-red-500">
                          <XCircle className="h-4 w-4" /> Bloquear acesso
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("cancelled", u)} className="cursor-pointer gap-2 text-destructive">
                          <XCircle className="h-4 w-4" /> Cancelar assinatura
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("trial", u)} className="cursor-pointer gap-2 text-amber-600">
                          <Clock className="h-4 w-4" /> Estender trial +7 dias
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Plano</p>
                        <DropdownMenuItem onClick={() => handleAction("essencial", u)} className="cursor-pointer gap-2">
                          Mudar para Essencial
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction("avancado", u)} className="cursor-pointer gap-2 text-primary">
                          Mudar para Avançado
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, color,
}: {
  icon: typeof Users; label: string; value: number | string; color: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <Icon className={`mb-2 h-5 w-5 ${color}`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
