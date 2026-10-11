import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Tag,
  Target,
  LogOut,
  ChevronRight,
  Lock,
  Sprout,
  Bell,
  HelpCircle,
  UserX,
  BellRing,
  Clock,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAssinatura, podeAcessar } from "@/lib/assinaturas";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExcluirContaDialog } from "@/components/conta/excluir-conta-dialog";
import {
  useNotifPrefs,
  updateNotifPref,
  type NotifPrefKey,
  pushSuportado,
  statusPush,
  ativarPush,
  desativarPush,
  dispararAlerta,
  type PushStatus,
} from "@/lib/notificacoes-store";
import { toast } from "sonner";

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
  icon,
  iconBg = "bg-slate-100 dark:bg-muted",
  iconColor = "text-slate-600 dark:text-muted-foreground",
  label,
  sublabel,
  last = false,
  onClick,
  badge,
  locked = false,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  last?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
        !last && "border-b border-slate-100 dark:border-border",
        onClick ? "hover:bg-slate-50 dark:hover:bg-muted/30" : "cursor-default",
        locked && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-slate-800 dark:text-foreground leading-snug">
          {label}
        </p>
        {sublabel && (
          <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {locked ? (
          <Lock className="h-4 w-4 text-slate-400" />
        ) : (
          onClick && <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </div>
    </button>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────
function MaisPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const est = useAssinatura();

  // ── Estados dos dialogs ──────────────────────────────────────────────────
  const [openNotifs, setOpenNotifs] = useState(false);
  const [openExcluirConta, setOpenExcluirConta] = useState(false);

  // Dados pessoais (exibição)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Notificações
  const notifs = useNotifPrefs();
  const podeNotifPro = podeAcessar("pro", est);
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [ativandoPush, setAtivandoPush] = useState(false);
  function irParaAssinar() {
    setOpenNotifs(false);
    router.navigate({ to: "/assinar" });
  }

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setName(data?.name ?? user.user_metadata?.name ?? ""));
    setEmail(user.email ?? "");
  }, [user]);

  // Só checa o status real do push quando o dialog abre (evita pedir acesso
  // ao service worker sem necessidade em toda renderização de /mais).
  useEffect(() => {
    if (openNotifs) statusPush().then(setPushStatus);
  }, [openNotifs]);

  function getInitials(n: string) {
    const parts = n.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
  }

  // Notificações
  function updateNotif(key: NotifPrefKey, value: boolean) {
    updateNotifPref(key, value);
  }

  async function handleAtivarPush() {
    setAtivandoPush(true);
    const resultado = await ativarPush();
    setAtivandoPush(false);
    if (resultado.ok) {
      setPushStatus("subscribed");
      toast.success("Notificações ativadas! Você pode testar abaixo.");
    } else {
      toast.error(resultado.erro ?? "Não consegui ativar as notificações agora.");
      statusPush().then(setPushStatus);
    }
  }

  async function handleDesativarPush() {
    await desativarPush();
    setPushStatus("not-subscribed");
    toast.success("Notificações desativadas neste dispositivo.");
  }

  async function handleTestarPush() {
    await dispararAlerta("teste", {
      titulo: "KyraOne 👋",
      corpo: "Suas notificações estão funcionando certinho!",
      url: "/mais",
    });
    toast.success("Enviado! Deve chegar em alguns segundos.");
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
            icon={<Sprout className="h-5 w-5" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-600"
            label="Minha conta"
            sublabel="Dados, senha e segurança"
            onClick={() => router.navigate({ to: "/perfil" })}
          />
          <Row
            icon={<Bell className="h-5 w-5" />}
            iconBg="bg-amber-50 dark:bg-amber-950/30"
            iconColor="text-amber-500"
            label="Notificações"
            sublabel="Alertas e lembretes"
            onClick={() => setOpenNotifs(true)}
          />
          <Row
            icon={<Sparkles className="h-5 w-5" />}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            label="Resumo mensal"
            sublabel="Receitas, despesas e um insight do mês"
            onClick={() => router.navigate({ to: "/resumo-mensal" })}
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
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-600"
            label="Metas e Orçamentos"
            sublabel="Defina metas e controle orçamentos"
            onClick={() => router.navigate({ to: "/metas" })}
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
            onClick={() => router.navigate({ to: "/ajuda" })}
            last
          />
        </Section>

        {/* ── Sair ───────────────────────────────────────────────────── */}
        <div className="mx-4 mt-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-card py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>

        {/* ── Zona de risco ──────────────────────────────────────────── */}
        {/* Contas superadmin nunca mostram essa opção — exclusão apagaria a
            conta que administra o sistema. Reforçado também no backend
            (api/conta/excluir.ts), que recusa a chamada pra quem for admin. */}
        {!est.ehSuperadmin && (
          <div className="mx-4 mt-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground mb-1.5 px-1">
              Zona de risco
            </p>
            <button
              type="button"
              onClick={() => setOpenExcluirConta(true)}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-white dark:bg-card shadow-sm border border-slate-100 dark:border-border px-4 py-3.5 text-left transition-colors hover:bg-red-50/50 dark:hover:bg-red-950/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500">
                <UserX className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-red-500 leading-snug">Excluir conta</p>
                <p className="text-[12px] text-slate-400 dark:text-muted-foreground mt-0.5">
                  Apaga seus dados permanentemente
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-300 dark:text-muted-foreground/40">
          KyraOne v1.0
        </p>
      </div>

      {/* ══ Dialog: Notificações ══════════════════════════════════════ */}
      <Dialog open={openNotifs} onOpenChange={setOpenNotifs}>
        <DialogContent
          className="max-w-sm p-0 overflow-hidden"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-5 pb-4 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
              <Bell className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Notificações</h2>
            <p className="text-sm text-white/80 mt-0.5">Escolha o que você quer receber.</p>
          </div>
          {/* ── Ativação do push (por dispositivo) ──────────────────────── */}
          <div className="px-5 pt-4">
            {pushStatus === "unsupported" && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5">
                Seu navegador não suporta notificações push. No celular, instale o KyraOne como app
                (tela inicial) pra conseguir ativar.
              </p>
            )}
            {pushStatus === "denied" && (
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5">
                As notificações estão bloqueadas pro KyraOne nas configurações do seu navegador. Pra
                ativar, permite notificações pro site nas configurações e volta aqui.
              </p>
            )}
            {(pushStatus === "default" || pushStatus === "not-subscribed") && (
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={ativandoPush}
                onClick={handleAtivarPush}
              >
                <BellRing className="h-4 w-4" />
                {ativandoPush ? "Ativando..." : "Ativar notificações neste dispositivo"}
              </Button>
            )}
            {pushStatus === "subscribed" && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Notificações ativadas neste dispositivo
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestarPush}
                    className="text-[11px] font-semibold text-primary"
                  >
                    Testar
                  </button>
                  <button
                    type="button"
                    onClick={handleDesativarPush}
                    className="text-[11px] text-muted-foreground underline underline-offset-2"
                  >
                    Desativar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-1">
            {/* Alertas de despesas/Resumo mensal/Metas atingidas agora têm
                disparo real (Web Push), condicionado a: usuário ter ativado
                push acima + preferência marcada aqui (checado de novo no
                backend, api/notificacoes/disparar.ts, nunca só no client).
                "Lembretes de contas" continua sem push — só controla o KPI
                de pendências no dashboard, como já era antes. */}
            <NotifRow
              label="Alertas de despesas"
              hint="Avisos ao ultrapassar limites por categoria"
              checked={notifs.expenseAlerts}
              onChange={(v) => updateNotif("expenseAlerts", v)}
              locked={!podeNotifPro}
              onLockedClick={irParaAssinar}
            />
            <NotifRow
              label="Resumo mensal"
              hint="Receba o fechamento do mês com receitas e despesas"
              checked={notifs.monthlySummary}
              onChange={(v) => updateNotif("monthlySummary", v)}
              locked={!podeNotifPro}
              onLockedClick={irParaAssinar}
            />
            <NotifRow
              label="Metas atingidas"
              hint="Comemore quando bater uma meta de economia"
              checked={notifs.goalsReached}
              onChange={(v) => updateNotif("goalsReached", v)}
              locked={!podeNotifPro}
              onLockedClick={irParaAssinar}
            />
            <NotifRow
              label="Lembretes de contas"
              hint="Avisos de contas a pagar próximas do vencimento"
              checked={notifs.billReminders}
              onChange={(v) => updateNotif("billReminders", v)}
            />
            {/* Avisos por WhatsApp: liberado pros dois planos (Controle e
                Pro) desde já — ainda não dá pra ativar porque a Kyra hoje só
                responde dentro da janela de 24h aberta pelo usuário; mandar
                um aviso por fora disso exige template aprovado pela Meta
                (ver análise de custo do WhatsApp — pedido do fundador em
                11/out/2026). Fica como preview do que vem a seguir. */}
            <NotifRow
              label="Avisos por WhatsApp"
              hint="Receba alertas e o resumo mensal direto no WhatsApp"
              checked={false}
              onChange={() => {}}
              comingSoon
            />
          </div>
          {!podeNotifPro && (
            <p className="px-5 pb-3 -mt-1 text-[11px] text-muted-foreground">
              <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />
              Alertas de despesas, resumo mensal e metas atingidas são recursos do plano Pro.
            </p>
          )}
          <div className="border-t px-5 py-3.5">
            <Button className="w-full" onClick={() => setOpenNotifs(false)}>
              Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Dialog: Excluir conta (com retenção) ════════════════════════ */}
      <ExcluirContaDialog open={openExcluirConta} onOpenChange={setOpenExcluirConta} />
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────────────────────
function NotifRow({
  label,
  hint,
  checked,
  onChange,
  locked = false,
  onLockedClick,
  comingSoon = false,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
  onLockedClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-1 py-2.5",
        (locked || comingSoon) && "opacity-60",
      )}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          {label}
          {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {comingSoon ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground whitespace-nowrap rounded-full bg-muted px-2 py-1">
          <Clock className="h-3 w-3" /> Em breve
        </span>
      ) : locked ? (
        <button
          type="button"
          onClick={onLockedClick}
          className="text-[11px] font-semibold text-primary whitespace-nowrap"
        >
          Ver planos
        </button>
      ) : (
        <Switch checked={checked} onCheckedChange={onChange} />
      )}
    </div>
  );
}
