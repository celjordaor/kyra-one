import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { User, Bell, Shield, HelpCircle, ChevronRight, LogOut, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/perfil")({
  head: () => ({
    meta: [{ title: "Perfil — Finanças Pessoais" }],
  }),
  component: PerfilPage,
});

type Profile = { name: string; email: string };
type Notifs = {
  expenseAlerts: boolean;
  monthlySummary: boolean;
  goalsReached: boolean;
  billReminders: boolean;
};

const PROFILE_KEY = "fp:profile";
const NOTIFS_KEY = "fp:notifs";
const DEFAULT_PROFILE: Profile = { name: "João Silva", email: "joao.silva@email.com" };
const DEFAULT_NOTIFS: Notifs = {
  expenseAlerts: true,
  monthlySummary: true,
  goalsReached: true,
  billReminders: false,
};

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

function PerfilPage() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [notifs, setNotifs] = useState<Notifs>(DEFAULT_NOTIFS);
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifs, setOpenNotifs] = useState(false);
  const [draftProfile, setDraftProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    setProfile(loadJSON(PROFILE_KEY, DEFAULT_PROFILE));
    setNotifs(loadJSON(NOTIFS_KEY, DEFAULT_NOTIFS));
  }, []);

  const openProfileDialog = () => {
    setDraftProfile(profile);
    setOpenProfile(true);
  };

  const saveProfile = () => {
    if (!draftProfile.name.trim() || !draftProfile.email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setProfile(draftProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(draftProfile));
    setOpenProfile(false);
    toast.success("Dados pessoais atualizados");
  };

  const updateNotif = (key: keyof Notifs, value: boolean) => {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-6 p-5">
      <h1 className="text-xl font-bold text-foreground">Perfil</h1>

      {/* Profile card */}
      <button
        onClick={openProfileDialog}
        className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/50"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {getInitials(profile.name)}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">{profile.name}</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-foreground">47</p>
          <p className="text-[10px] text-muted-foreground">Transações</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-primary">3</p>
          <p className="text-[10px] text-muted-foreground">Metas</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-600">R$3.6k</p>
          <p className="text-[10px] text-muted-foreground">Economizado</p>
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1">
        <MenuButton icon={User} label="Dados pessoais" onClick={openProfileDialog} />
        <MenuLink icon={Tag} label="Categorias" to="/categorias" />
        <MenuButton icon={Bell} label="Notificações" onClick={() => setOpenNotifs(true)} />
        <MenuButton icon={Shield} label="Segurança e privacidade" disabled badge="Em breve" />
        <MenuButton icon={HelpCircle} label="Ajuda e suporte" disabled badge="Em breve" />
      </div>

      {/* Logout */}
      <button
        onClick={async () => {
          await signOut();
          router.navigate({ to: "/login" });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>

      <p className="text-center text-xs text-muted-foreground">Versão 1.0.0</p>

      {/* Dados pessoais dialog */}
      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados pessoais</DialogTitle>
            <DialogDescription>Atualize seu nome e e-mail de contato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={draftProfile.name}
                onChange={(e) => setDraftProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                type="email"
                value={draftProfile.email}
                onChange={(e) => setDraftProfile((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenProfile(false)}>
              Cancelar
            </Button>
            <Button onClick={saveProfile}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notificações dialog */}
      <Dialog open={openNotifs} onOpenChange={setOpenNotifs}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
            <DialogDescription>Escolha o que você quer receber.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <NotifRow
              label="Alertas de despesas"
              hint="Avisos ao ultrapassar limites por categoria"
              checked={notifs.expenseAlerts}
              onChange={(v) => updateNotif("expenseAlerts", v)}
            />
            <NotifRow
              label="Resumo mensal"
              hint="Receba o fechamento do mês com receitas e despesas"
              checked={notifs.monthlySummary}
              onChange={(v) => updateNotif("monthlySummary", v)}
            />
            <NotifRow
              label="Metas atingidas"
              hint="Comemore quando bater uma meta de economia"
              checked={notifs.goalsReached}
              onChange={(v) => updateNotif("goalsReached", v)}
            />
            <NotifRow
              label="Lembretes de contas"
              hint="Avisos de contas a pagar próximas do vencimento"
              checked={notifs.billReminders}
              onChange={(v) => updateNotif("billReminders", v)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpenNotifs(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type IconType = typeof User;

function MenuLink({ icon: Icon, label, to }: { icon: IconType; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  badge,
}: {
  icon: IconType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  const base =
    "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 shadow-sm text-left transition-colors";
  const active = "bg-card hover:bg-accent/50";
  const inactive = "bg-muted/60 cursor-not-allowed opacity-70";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${disabled ? inactive : active}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {badge ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {badge}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

function NotifRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
