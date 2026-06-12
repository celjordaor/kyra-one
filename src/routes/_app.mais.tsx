import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  User, Tag, Target, CreditCard, LogOut, ChevronRight,
  Lock, Star, Shield, Bell, HelpCircle, Crown,
} from "lucide-react";
import { useSubscription } from "@/lib/subscription-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/mais")({
  component: MaisPage,
});

// ── Componentes visuais ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground mb-1.5 px-1">
        {title}
      </p>
      <div className="rounded-2xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon, iconBg = "bg-slate-100 dark:bg-muted", iconColor = "text-slate-600 dark:text-muted-foreground",
  label, sublabel, last = false, onClick, badge, locked = false,
}: {
  icon: React.ReactNode; iconBg?: string; iconColor?: string;
  label: string; sublabel?: string; last?: boolean;
  onClick?: () => void; badge?: React.ReactNode; locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
        !last && "border-b border-slate-100 dark:border-border",
        onClick ? "hover:bg-slate-50 dark:hover:bg-muted/30" : "cursor-default",
        locked && "opacity-60"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        iconBg, iconColor
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-slate-800 dark:text-foreground leading-snug">{label}</p>
        {sublabel && (
          <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {locked
          ? <Lock className="h-4 w-4 text-slate-400" />
          : onClick && <ChevronRight className="h-4 w-4 text-slate-400" />
        }
      </div>
    </button>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
function MaisPage() {
  const router   = useRouter();
  const { signOut } = useAuth();
  const { subscription } = useSubscription();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isAdvancado  = subscription?.isAdvancado ?? false;
  const planName     = subscription?.planName ?? "Essencial";
  const planId       = subscription?.planId   ?? "essencial";

  function handleMetas() {
    if (!isAdvancado) {
      setShowUpgradeModal(true);
      return;
    }
    router.navigate({ to: "/metas" });
  }

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-5 pt-10 pb-10 text-white">
        <p className="text-[11px] uppercase tracking-widest text-white/50 mb-1">JadeOne</p>
        <h1 className="text-2xl font-bold">Mais</h1>
        <p className="text-sm text-white/60 mt-1">Configurações e recursos do app</p>

        {/* Badge do plano */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: isAdvancado ? "#10b98122" : "#f59e0b22",
                   border: `1px solid ${isAdvancado ? "#10b98144" : "#f59e0b44"}` }}>
          {isAdvancado
            ? <Crown className="h-3.5 w-3.5 text-emerald-400" />
            : <Star  className="h-3.5 w-3.5 text-amber-400"   />}
          <span className="text-xs font-semibold" style={{ color: isAdvancado ? "#10b981" : "#f59e0b" }}>
            Plano {planName}
          </span>
        </div>
      </div>

      <div className="pt-4 pb-8">

        {/* ── Conta ──────────────────────────────────────────────────── */}
        <Section title="Conta">
          <Row
            icon={<User className="h-5 w-5" />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/30"
            iconColor="text-indigo-600"
            label="Perfil"
            sublabel="Nome, e-mail e senha"
            onClick={() => router.navigate({ to: "/perfil" })}
          />
          <Row
            icon={<Shield className="h-5 w-5" />}
            iconBg="bg-slate-100 dark:bg-muted"
            iconColor="text-slate-500"
            label="Segurança"
            sublabel="Alterar senha"
            onClick={() => router.navigate({ to: "/perfil" })}
            last
          />
        </Section>

        {/* ── Organização ────────────────────────────────────────────── */}
        <Section title="Organização">
          <Row
            icon={<Tag className="h-5 w-5" />}
            iconBg="bg-violet-50 dark:bg-violet-950/30"
            iconColor="text-violet-600"
            label="Categorias"
            sublabel="Gerencie suas categorias"
            onClick={() => router.navigate({ to: "/categorias" })}
          />
          <Row
            icon={<Target className="h-5 w-5" />}
            iconBg={isAdvancado ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-slate-100 dark:bg-muted"}
            iconColor={isAdvancado ? "text-emerald-600" : "text-slate-400"}
            label="Metas e Orçamentos"
            sublabel={isAdvancado
              ? "Defina metas e controle orçamentos"
              : "Disponível no plano Avançado"}
            onClick={handleMetas}
            locked={!isAdvancado}
            badge={!isAdvancado ? (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                Avançado
              </span>
            ) : undefined}
            last
          />
        </Section>

        {/* ── Assinatura ─────────────────────────────────────────────── */}
        <Section title="Assinatura">
          <Row
            icon={isAdvancado ? <Crown className="h-5 w-5" /> : <Star className="h-5 w-5" />}
            iconBg={isAdvancado ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}
            iconColor={isAdvancado ? "text-emerald-600" : "text-amber-500"}
            label={`Plano ${planName}`}
            sublabel={isAdvancado ? "Todos os recursos desbloqueados" : "Toque para fazer upgrade"}
            onClick={() => router.navigate({ to: "/planos" })}
            badge={!isAdvancado ? (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                Upgrade
              </span>
            ) : undefined}
            last
          />
        </Section>

        {/* ── Suporte ────────────────────────────────────────────────── */}
        <Section title="Suporte">
          <Row
            icon={<HelpCircle className="h-5 w-5" />}
            iconBg="bg-blue-50 dark:bg-blue-950/30"
            iconColor="text-blue-500"
            label="Ajuda e suporte"
            sublabel="Dúvidas e documentação"
            onClick={() => toast.info("Em breve!")}
            last
          />
        </Section>

        {/* ── Sair ───────────────────────────────────────────────────── */}
        <div className="mx-4 mt-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-card py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-300 dark:text-muted-foreground/40">
          JadeOne v1.0 · Finanças Pessoais
        </p>
      </div>

      {/* ── Modal: Upgrade necessário ───────────────────────────────── */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined}
          onOpenAutoFocus={e => e.preventDefault()}>

          {/* Header colorido */}
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
              <Crown className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">Recurso do Plano Avançado</h2>
            <p className="text-sm text-white/80 mt-1">
              Metas e Orçamentos está disponível exclusivamente no plano Avançado.
            </p>
          </div>

          <div className="p-5 space-y-3">
            {/* O que vem no avançado */}
            {[
              "🎯 Defina metas de economia e gastos",
              "📊 Controle orçamentos por categoria",
              "📈 Relatórios e análises avançadas",
              "🔔 Alertas quando se aproximar do limite",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-foreground">
                <span>{item}</span>
              </div>
            ))}

            {/* Botões */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => { setShowUpgradeModal(false); router.navigate({ to: "/planos" }); }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-lg">
                Ver planos e fazer upgrade
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-border text-slate-500 dark:text-muted-foreground text-sm font-medium hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
                Agora não
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
