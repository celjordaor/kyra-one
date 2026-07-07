import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  User, Tag, Target, LogOut, ChevronRight,
  Lock, Star, Shield, Bell, HelpCircle, Crown,
  Eye, EyeOff,
} from "lucide-react";
import { useSubscription } from "@/lib/subscription-store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// ── Campo de senha com toggle de visibilidade ──────────────────────────────
function PasswordInput({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-10 pr-10"/>
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
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
function MaisPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();

  const isAdvancado = subscription?.isAdvancado ?? false;
  const planName    = subscription?.planName ?? "Essencial";

  // ── Estados dos dialogs ──────────────────────────────────────────────────
  const [openProfile,  setOpenProfile]  = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [openNotifs,   setOpenNotifs]   = useState(false);
  const [showUpgrade,  setShowUpgrade]  = useState(false);

  // Dados pessoais
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [draftName, setDraftName] = useState("");

  // Alterar senha
  const [currentPwd,  setCurrentPwd]  = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [pwdError,    setPwdError]    = useState<string | null>(null);
  const [pwdSaving,   setPwdSaving]   = useState(false);

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

  // Dados pessoais
  function openProfileDialog() { setDraftName(name); setOpenProfile(true); }
  async function saveProfile() {
    if (!draftName.trim()) { toast.error("Preencha o nome"); return; }
    await supabase.from("profiles").update({ name: draftName.trim() }).eq("id", user?.id);
    setName(draftName.trim());
    setOpenProfile(false);
    toast.success("Dados pessoais atualizados");
  }

  // Alterar senha
  function openPasswordDialog() {
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdError(null);
    setOpenPassword(true);
  }
  async function savePassword() {
    setPwdError(null);
    if (!currentPwd)         { setPwdError("Informe a senha atual"); return; }
    if (newPwd.length < 6)   { setPwdError("A nova senha deve ter pelo menos 6 caracteres"); return; }
    if (newPwd !== confirmPwd) { setPwdError("As senhas não coincidem"); return; }
    if (newPwd === currentPwd) { setPwdError("A nova senha deve ser diferente da atual"); return; }
    setPwdSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPwd });
      if (signInError) { setPwdError("Senha atual incorreta"); return; }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setOpenPassword(false);
    } catch { setPwdError("Erro ao alterar senha. Tente novamente."); }
    finally { setPwdSaving(false); }
  }

  // Notificações
  function updateNotif(key: keyof Notifs, value: boolean) {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(next));
  }

  // Metas
  function handleMetas() {
    if (!isAdvancado) { setShowUpgrade(true); return; }
    router.navigate({ to: "/metas" });
  }

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background md:max-w-2xl md:mx-auto">

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
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
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

      <div className="pt-4 pb-8">

        {/* ── Conta ──────────────────────────────────────────────────── */}
        <Section title="Conta">
          <Row
            icon={<User className="h-5 w-5"/>}
            iconBg="bg-indigo-50 dark:bg-indigo-950/30" iconColor="text-indigo-600"
            label="Perfil"
            sublabel="Editar dados pessoais"
            onClick={openProfileDialog}
          />
          <Row
            icon={<Bell className="h-5 w-5"/>}
            iconBg="bg-amber-50 dark:bg-amber-950/30" iconColor="text-amber-500"
            label="Notificações"
            sublabel="Alertas e lembretes"
            onClick={() => setOpenNotifs(true)}
          />
          <Row
            icon={<Shield className="h-5 w-5"/>}
            iconBg="bg-slate-100 dark:bg-muted" iconColor="text-slate-500"
            label="Segurança"
            sublabel="Alterar senha"
            onClick={openPasswordDialog}
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
            iconBg={isAdvancado ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-slate-100 dark:bg-muted"}
            iconColor={isAdvancado ? "text-emerald-600" : "text-slate-400"}
            label="Metas e Orçamentos"
            sublabel={isAdvancado ? "Defina metas e controle orçamentos" : "Disponível no plano Avançado"}
            onClick={handleMetas}
            locked={!isAdvancado}
            badge={!isAdvancado ? (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-bold text-amber-600">Avançado</span>
            ) : undefined}
            last
          />
        </Section>

        {/* ── Assinatura ─────────────────────────────────────────────── */}
        <Section title="Assinatura">
          <Row
            icon={isAdvancado ? <Crown className="h-5 w-5"/> : <Star className="h-5 w-5"/>}
            iconBg={isAdvancado ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}
            iconColor={isAdvancado ? "text-emerald-600" : "text-amber-500"}
            label={`Plano ${planName}`}
            sublabel={isAdvancado ? "Todos os recursos desbloqueados" : "Toque para fazer upgrade"}
            onClick={() => router.navigate({ to: "/planos" })}
            badge={!isAdvancado ? (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Upgrade</span>
            ) : undefined}
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
            <LogOut className="h-4 w-4"/> Sair da conta
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-300 dark:text-muted-foreground/40">
          JadeOne v1.0 · Finanças Pessoais
        </p>
      </div>

      {/* ══ Dialog: Dados Pessoais ════════════════════════════════════ */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="max-w-sm" aria-describedby={undefined} onOpenAutoFocus={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
                <User className="h-4 w-4 text-indigo-600"/>
              </div>
              Dados pessoais
            </DialogTitle>
            <DialogDescription>Atualize seu nome de exibição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mais-name">Nome</Label>
              <Input id="mais-name" value={draftName} onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveProfile()}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mais-email">E-mail</Label>
              <Input id="mais-email" type="email" value={email} disabled className="opacity-60"/>
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenProfile(false)}>Cancelar</Button>
            <Button onClick={saveProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog: Segurança / Alterar Senha ════════════════════════ */}
      <Dialog open={openPassword} onOpenChange={o => { if (!pwdSaving) setOpenPassword(o); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="bg-gradient-to-br from-slate-600 to-slate-800 px-5 pt-5 pb-4 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
              <Shield className="h-5 w-5"/>
            </div>
            <h2 className="text-base font-bold">Segurança</h2>
            <p className="text-sm text-white/70 mt-0.5">Crie uma nova senha para sua conta.</p>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="mais-cur-pwd">Senha atual</Label>
              <PasswordInput id="mais-cur-pwd" value={currentPwd} onChange={setCurrentPwd}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mais-new-pwd">Nova senha</Label>
              <PasswordInput id="mais-new-pwd" value={newPwd} onChange={setNewPwd} placeholder="Mínimo 6 caracteres"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mais-conf-pwd">Confirmar nova senha</Label>
              <PasswordInput id="mais-conf-pwd" value={confirmPwd} onChange={setConfirmPwd}/>
            </div>
            {/* Indicador de força */}
            {newPwd.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= (newPwd.length >= 12 ? 4 : newPwd.length >= 8 ? 3 : newPwd.length >= 6 ? 2 : 1)
                        ? (newPwd.length >= 12 ? "bg-emerald-500" : newPwd.length >= 8 ? "bg-yellow-500" : "bg-red-400")
                        : "bg-muted"
                    }`}/>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {newPwd.length >= 12 ? "Senha forte" : newPwd.length >= 8 ? "Senha média" : "Senha fraca"}
                </p>
              </div>
            )}
            {pwdError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{pwdError}</p>
            )}
          </div>
          <div className="flex gap-2 border-t px-5 py-3.5">
            <Button variant="outline" className="flex-1" onClick={() => setOpenPassword(false)} disabled={pwdSaving}>Cancelar</Button>
            <Button className="flex-1" onClick={savePassword} disabled={pwdSaving}>
              {pwdSaving ? "Verificando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* ══ Dialog: Upgrade ═══════════════════════════════════════════ */}
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby={undefined} onOpenAutoFocus={e => e.preventDefault()}>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 mb-3">
              <Crown className="h-7 w-7"/>
            </div>
            <h2 className="text-lg font-bold">Recurso do Plano Avançado</h2>
            <p className="text-sm text-white/80 mt-1">Metas e Orçamentos está disponível exclusivamente no plano Avançado.</p>
          </div>
          <div className="p-5 space-y-3">
            {["🎯 Defina metas de economia e gastos","📊 Controle orçamentos por categoria","📈 Relatórios e análises avançadas","🔔 Alertas quando se aproximar do limite"].map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-foreground">
                <span>{item}</span>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={() => { setShowUpgrade(false); router.navigate({ to: "/planos" }); }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-lg">
                Ver planos e fazer upgrade
              </button>
              <button onClick={() => setShowUpgrade(false)}
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-border text-slate-500 text-sm font-medium">
                Agora não
              </button>
            </div>
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
