import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Bell, Shield, HelpCircle, ChevronRight, LogOut, Tag, Eye, EyeOff } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

type Notifs = {
  expenseAlerts: boolean; monthlySummary: boolean;
  goalsReached: boolean; billReminders: boolean;
};

const NOTIFS_KEY = "fp:notifs";
const DEFAULT_NOTIFS: Notifs = {
  expenseAlerts: true, monthlySummary: true,
  goalsReached: true, billReminders: false,
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch { return fallback; }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

// ── Componente de campo de senha com toggle ────────────────────────────────
function PasswordInput({
  id, value, onChange, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PerfilPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { subscription } = useSubscription();

  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [notifs, setNotifs]       = useState<Notifs>(DEFAULT_NOTIFS);
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifs, setOpenNotifs]   = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [draftName, setDraftName] = useState("");

  // Estados do dialog de senha
  const [currentPwd, setCurrentPwd]   = useState("");
  const [newPwd, setNewPwd]           = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [pwdError, setPwdError]       = useState<string | null>(null);
  const [pwdSaving, setPwdSaving]     = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("name").eq("id", user.id).single()
      .then(({ data }) => { setName(data?.name ?? user.user_metadata?.name ?? ""); });
    setEmail(user.email ?? "");
    setNotifs(loadJSON(NOTIFS_KEY, DEFAULT_NOTIFS));
  }, [user]);

  const openProfileDialog = () => { setDraftName(name); setOpenProfile(true); };

  const saveProfile = async () => {
    if (!draftName.trim()) { toast.error("Preencha o nome"); return; }
    await supabase.from("profiles").update({ name: draftName.trim() }).eq("id", user?.id);
    setName(draftName.trim());
    setOpenProfile(false);
    toast.success("Dados pessoais atualizados");
  };

  const openPasswordDialog = () => {
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); setPwdError(null);
    setOpenPassword(true);
  };

  const savePassword = async () => {
    setPwdError(null);
    if (!currentPwd) { setPwdError("Informe a senha atual"); return; }
    if (newPwd.length < 6) { setPwdError("A nova senha deve ter pelo menos 6 caracteres"); return; }
    if (newPwd !== confirmPwd) { setPwdError("As senhas não coincidem"); return; }
    if (newPwd === currentPwd) { setPwdError("A nova senha deve ser diferente da atual"); return; }

    setPwdSaving(true);
    try {
      // Verificar senha atual re-autenticando silenciosamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPwd,
      });
      if (signInError) {
        setPwdError("Senha atual incorreta");
        return;
      }
      // Atualizar para nova senha (sem envio de e-mail)
      const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
      if (updateError) throw updateError;
      toast.success("Senha alterada com sucesso!");
      setOpenPassword(false);
    } catch {
      setPwdError("Erro ao alterar senha. Tente novamente.");
    } finally {
      setPwdSaving(false);
    }
  };

  const updateNotif = (key: keyof Notifs, value: boolean) => {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(next));
  };

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="space-y-6 p-5">
      <h1 className="text-xl font-bold text-foreground">Perfil</h1>

      {/* Profile card */}
      <button onClick={openProfileDialog}
        className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/50">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {getInitials(name || email)}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">{name || "Sem nome"}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Plano atual */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plano atual</p>
            <p className="mt-0.5 text-base font-bold text-foreground">{subscription?.planName ?? "Carregando..."}</p>
            {subscription?.status === "trial" && subscription.daysLeftInTrial !== null && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Período de teste — {subscription.daysLeftInTrial} dias restantes
              </p>
            )}
            {subscription?.status === "active" && (
              <p className="text-xs text-primary">Assinatura ativa</p>
            )}
          </div>
          <Link to="/planos"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            {subscription?.planId === "avancado" ? "Gerenciar" : "Upgrade"}
          </Link>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1">
        <MenuButton icon={User}        label="Dados pessoais"     onClick={openProfileDialog} />
        <MenuLink   icon={Tag}         label="Categorias"         to="/categorias" />
        <MenuButton icon={Bell}        label="Notificações"       onClick={() => setOpenNotifs(true)} />
        <MenuButton icon={Shield}      label="Alterar senha"      onClick={openPasswordDialog} />
        <MenuButton icon={HelpCircle}  label="Ajuda e suporte"    disabled badge="Em breve" />
      </div>

      {/* Logout */}
      <button onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>

      <p className="text-center text-xs text-muted-foreground">Versão 1.0.0</p>

      {/* ── Dialog: Dados pessoais ─────────────────────────────── */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados pessoais</DialogTitle>
            <DialogDescription>Atualize seu nome de exibição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Nome</Label>
              <Input id="profile-name" value={draftName} onChange={e => setDraftName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input id="profile-email" type="email" value={email} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenProfile(false)}>Cancelar</Button>
            <Button onClick={saveProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Alterar senha ──────────────────────────────── */}
      <Dialog open={openPassword} onOpenChange={o => { if (!pwdSaving) setOpenPassword(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Alterar senha
            </DialogTitle>
            <DialogDescription>
              Crie uma nova senha para sua conta. Não é necessário confirmar por e-mail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pwd">Senha atual</Label>
              <PasswordInput id="current-pwd" value={currentPwd} onChange={setCurrentPwd} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">Nova senha</Label>
              <PasswordInput id="new-pwd" value={newPwd} onChange={setNewPwd}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
              <PasswordInput id="confirm-pwd" value={confirmPwd} onChange={setConfirmPwd} />
            </div>

            {/* Indicador de força da senha */}
            {newPwd.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= (newPwd.length >= 12 ? 4 : newPwd.length >= 8 ? 3 : newPwd.length >= 6 ? 2 : 1)
                        ? (newPwd.length >= 12 ? "bg-emerald-500" : newPwd.length >= 8 ? "bg-yellow-500" : "bg-red-400")
                        : "bg-muted"
                    }`} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {newPwd.length >= 12 ? "Senha forte" : newPwd.length >= 8 ? "Senha média" : "Senha fraca"}
                </p>
              </div>
            )}

            {pwdError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {pwdError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPassword(false)} disabled={pwdSaving}>
              Cancelar
            </Button>
            <Button onClick={savePassword} disabled={pwdSaving}>
              {pwdSaving ? "Verificando..." : "Salvar senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Notificações ───────────────────────────────── */}
      <Dialog open={openNotifs} onOpenChange={setOpenNotifs}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
            <DialogDescription>Escolha o que você quer receber.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <NotifRow label="Alertas de despesas" hint="Avisos ao ultrapassar limites por categoria"
              checked={notifs.expenseAlerts} onChange={v => updateNotif("expenseAlerts", v)} />
            <NotifRow label="Resumo mensal" hint="Receba o fechamento do mês com receitas e despesas"
              checked={notifs.monthlySummary} onChange={v => updateNotif("monthlySummary", v)} />
            <NotifRow label="Metas atingidas" hint="Comemore quando bater uma meta de economia"
              checked={notifs.goalsReached} onChange={v => updateNotif("goalsReached", v)} />
            <NotifRow label="Lembretes de contas" hint="Avisos de contas a pagar próximas do vencimento"
              checked={notifs.billReminders} onChange={v => updateNotif("billReminders", v)} />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenNotifs(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────
type IconType = typeof User;

function MenuLink({ icon: Icon, label, to }: { icon: IconType; label: string; to: string }) {
  return (
    <Link to={to}
      className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-accent/50">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function MenuButton({ icon: Icon, label, onClick, disabled, badge }: {
  icon: IconType; label: string; onClick?: () => void; disabled?: boolean; badge?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 shadow-sm text-left transition-colors ${
        disabled ? "bg-muted/60 cursor-not-allowed opacity-70" : "bg-card hover:bg-accent/50"
      }`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {badge
        ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span>
        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
      }
    </button>
  );
}

function NotifRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
