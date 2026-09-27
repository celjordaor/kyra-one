import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Tag, Target, LogOut, ChevronRight,
  Lock, Sprout, Bell, HelpCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/mais")({
  component: MaisPage,
});

// ── Tipos de notificação ───────────────────────────────────────────────────
type Notifs = {
  expenseAlerts: boolean; monthlySummary: boolean;
  goalsReached: boolean; billReminders: boolean;
};
const NOTIFS_KEY = "fp:notifs";
const DEFAULT_NOTIFS: Notifs = {
  expenseAlerts: true, monthlySummary: true,
  goalsReached: true, billReminders: false,
};
function loadNotifs(): Notifs {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    return raw ? { ...DEFAULT_NOTIFS, ...JSON.parse(raw) } : DEFAULT_NOTIFS;
  } catch { return DEFAULT_NOTIFS; }
}

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
    <button type="button" onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
        !last && "border-b border-slate-100 dark:border-border",
        onClick ? "hover:bg-slate-50 dark:hover:bg-muted/30" : "cursor-default",
        locked && "opacity-60"
      )}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg, iconColor)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-slate-800 dark:text-foreground leading-snug">{label}</p>
        {sublabel && <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {locked ? <Lock className="h-4 w-4 text-slate-400" /> : onClick && <ChevronRight className="h-4 w-4 text-slate-400" />}
      </div>
    </button>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
// TODO: gating por assinatura do portal (Fase Asaas)
function MaisPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // ── Estados dos dialogs ──────────────────────────────────────────────────
  const [openNotifs, setOpenNotifs] = useState(false);

  // Dados pessoais (exibição)
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");

  // Notificações
  const [notifs, setNotifs] = useState<Notifs>(DEFAULT_NOTIFS);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("id", user.id).single()
      .then(({ data }) => setName(data?.name ?? user.user_metadata?.name ?? ""));
    setEmail(user.email ?? "");
    setNotifs(loadNotifs());
  }, [user]);

  function getInitials(n: string) {
    const parts = n.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
  }

  // Notificações
  function updateNotif(key: keyof Notifs, value: boolean) {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(next));
  }

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background md:max-w-2xl md:mx-auto">

      {/* ── Header com avatar do usuário ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-5 pt-10 pb-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
            {getInitials(name || email)}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{name || "Sem nome"}</p>
            <p className="text-sm text-white/60 truncate">{email}</p>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-8">

        {/* ── Conta ──────────────────────────────────────────────────── */}
        <Section title="Conta">
          <Row
            icon={<Sprout className="h-5 w-5"/>}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30" iconColor="text-emerald-600"
            label="Minha conta"
            sublabel="Dados, senha e segurança"
            onClick={() => router.navigate({ to: "/perfil" })}
          />
          <Row
            icon={<Bell className="h-5 w-5"/>}
            iconBg="bg-amber-50 dark:bg-amber-950/30" iconColor="text-amber-500"
            label="Notificações"
            sublabel="Alertas e lembretes"
            onClick={() => setOpenNotifs(true)}
            last
          />
        </Section>

        {/* ── Organização ────────────────────────────────────────────── */}
        <Section title="Organização">
          <Row
            icon={<Tag className="h-5 w-5"/>}
            iconBg="bg-violet-50 dark:bg-violet-950/30" iconColor="text-violet-600"
            label="Categorias"
            sublabel="Gerencie suas categorias"
            onClick={() => router.navigate({ to: "/categorias" })}
          />
          <Row
            icon={<Target className="h-5 w-5"/>}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30" iconColor="text-emerald-600"
            label="Metas e Orçamentos"
            sublabel="Defina metas e controle orçamentos"
            onClick={() => router.navigate({ to: "/metas" })}
            last
          />
        </Section>

        {/* ── Suporte ────────────────────────────────────────────────── */}
        <Section title="Suporte">
          <Row
            icon={<HelpCircle className="h-5 w-5"/>}
            iconBg="bg-blue-50 dark:bg-blue-950/30" iconColor="text-blue-500"
            label="Ajuda e suporte"
            sublabel="Dúvidas e documentação"
            onClick={() => toast.info("Em breve!")}
            last
          />
        </Section>

        {/* ── Sair ───────────────────────────────────────────────────── */}
        <div className="mx-4 mt-2">
          <button type="button" onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-card py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <LogOut className="h-4 w-4"/> Sair
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-300 dark:text-muted-foreground/40">
          KyraOne v1.0
        </p>
      </div>

      {/* ══ Dialog: Notificações ══════════════════════════════════════ */}
      <Dialog open={openNotifs} onOpenChange={setOpenNotifs}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-5 pb-4 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
              <Bell className="h-5 w-5"/>
            </div>
            <h2 className="text-base font-bold">Notificações</h2>
            <p className="text-sm text-white/80 mt-0.5">Escolha o que você quer receber.</p>
          </div>
          <div className="px-5 py-4 space-y-1">
            <NotifRow label="Alertas de despesas" hint="Avisos ao ultrapassar limites por categoria"
              checked={notifs.expenseAlerts} onChange={v => updateNotif("expenseAlerts", v)}/>
            <NotifRow label="Resumo mensal" hint="Receba o fechamento do mês com receitas e despesas"
              checked={notifs.monthlySummary} onChange={v => updateNotif("monthlySummary", v)}/>
            <NotifRow label="Metas atingidas" hint="Comemore quando bater uma meta de economia"
              checked={notifs.goalsReached} onChange={v => updateNotif("goalsReached", v)}/>
            <NotifRow label="Lembretes de contas" hint="Avisos de contas a pagar próximas do vencimento"
              checked={notifs.billReminders} onChange={v => updateNotif("billReminders", v)}/>
          </div>
          <div className="border-t px-5 py-3.5">
            <Button className="w-full" onClick={() => setOpenNotifs(false)}>Concluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────
function NotifRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange}/>
    </div>
  );
}
