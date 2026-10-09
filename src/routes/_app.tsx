import { createFileRoute, Outlet, Link, useLocation, Navigate, useRouter } from "@tanstack/react-router";
import { Home, Receipt, User, PlusCircle, CreditCard, TrendingUp, TrendingDown, X, Tag, ChevronRight, MoreHorizontal, Target, Settings, LayoutDashboard, Layers } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { extendRecurringIfNeeded } from "@/lib/transactions-store";
import { useAssinatura, podeAcessar, nomeNivel } from "@/lib/assinaturas";
import TelaBloqueada from "@/components/paywall/tela-bloqueada";

// Rotas do nível Pro (Cartões, Faturas, Metas) — fora dessas, qualquer
// assinatura ativa (Controle ou Pro) libera o resto do app.
const PREFIXOS_PRO = ["/cartoes", "/faturas-cartao", "/metas"];
// Rotas sempre acessíveis mesmo sem assinatura ativa — precisam ficar
// abertas pra dar pra gerenciar a própria assinatura e sair da conta.
const ROTAS_LIVRES_SEM_ASSINATURA = ["/assinar", "/perfil", "/mais"];

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// ── Nav items desktop (sidebar) — mantém Transações ──────────────────────
const navItems = [
  { to: "/dashboard",      label: "Início",     icon: Home },
  { to: "/transacoes",     label: "Transações", icon: Receipt },
  { to: "/cartoes",        label: "Cartões",    icon: CreditCard },
  { to: "/faturas-cartao", label: "Faturas",    icon: Tag },
  { to: "/mais",           label: "Config.",    icon: Settings },
];

// ── Nav items mobile — com cor de ícone e fundo para estilo visual ───────
const mobileNavLeft: { to: string; label: string; icon: React.ElementType; iconBg: string; iconColor: string; activeBg: string; activeColor: string }[] = [
  {
    to: "/dashboard", label: "Início", icon: Home,
    iconBg: "bg-indigo-100",  iconColor: "text-indigo-500",
    activeBg: "bg-indigo-500", activeColor: "text-indigo-600",
  },
  {
    to: "/cartoes", label: "Cartões", icon: CreditCard,
    iconBg: "bg-blue-100",    iconColor: "text-blue-500",
    activeBg: "bg-blue-500",   activeColor: "text-blue-600",
  },
];
const mobileNavRight: typeof mobileNavLeft = [
  {
    to: "/faturas-cartao", label: "Faturas", icon: Tag,
    iconBg: "bg-amber-100",    iconColor: "text-amber-500",
    activeBg: "bg-amber-500",  activeColor: "text-amber-600",
  },
  {
    to: "/mais", label: "Config.", icon: Settings,
    iconBg: "bg-slate-100",    iconColor: "text-slate-500",
    activeBg: "bg-slate-400",  activeColor: "text-slate-600",
  },
];

function AppLayout() {
  const { pathname } = useLocation();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const est = useAssinatura();
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Classe dos itens da sidebar desktop — visual navy/gold da landing.
  // Só estilo (cores); não altera destino, estrutura ou comportamento dos links.
  const navLinkClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      isActive ? "bg-[#F2B33D] text-[#03264E]" : "text-white/60 hover:bg-white/10 hover:text-white"
    );

  // Extensão automática de recorrentes + backfill de recurrence_id (roda 1x por sessão)
  useEffect(() => {
    if (!session) return;
    extendRecurringIfNeeded().catch(err =>
      console.warn("[extendRecurring]", err)
    );
  }, [session?.user?.id]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;

  // Gate de assinatura: sem plano ativo, só perfil/config/assinar ficam de
  // pé — superadmin (profiles.role='admin') sempre passa direto.
  const semAssinatura = !est.loading && est.nivel === "nenhum" && !est.ehSuperadmin;
  const rotaLivre = ROTAS_LIVRES_SEM_ASSINATURA.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (semAssinatura && !rotaLivre) {
    return <Navigate to="/assinar" />;
  }

  const rotaExigePro = PREFIXOS_PRO.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const bloqueadaPorPro = !est.loading && rotaExigePro && !podeAcessar("pro", est);

  const handleAddTransaction = (type: "income" | "expense") => {
    setAddMenuOpen(false);
    router.navigate({ to: "/nova-transacao", search: { type } });
  };
  const handleAddCardExpense = () => {
    setAddMenuOpen(false);
    router.navigate({ to: "/cartoes/nova-despesa" });
  };

  return (
    <TooltipProvider>
      <div style={{ display:"block", background:"var(--color-background)", minHeight:"100dvh", width:"100%", maxWidth:"100vw", overflowX:"hidden" }}>
        {/* ══ SIDEBAR DESKTOP ═══════════════════════════════════════════ */}
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 border-r border-white/10 z-30 shadow-sm" style={{ background: "#03264E" }}>

          {/* Brand */}
          <Link to="/dashboard"
            className="flex items-center gap-3 px-5 py-5 border-b border-white/10 hover:bg-white/5 transition-colors shrink-0">
            <img src="/icons/icon-192.png" alt="KyraOne" className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"/>
            <div>
              <p className="font-bold text-white leading-none text-sm">KyraOne</p>
              <p className="text-[11px] text-white/50 mt-0.5">Finanças Pessoais</p>
            </div>
          </Link>

          {/* ── Botões de lançamento (destaque) ── */}
          <div className="px-3 pt-4 pb-2 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-2 pb-2">Lançar</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={()=>router.navigate({to:"/nova-transacao",search:{type:"income"}})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-white/[0.06] hover:bg-white/[0.12] text-emerald-300 transition-colors">
                <TrendingUp className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Receita</span>
              </button>
              <button onClick={()=>router.navigate({to:"/nova-transacao",search:{type:"expense"}})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-white/[0.06] hover:bg-white/[0.12] text-red-300 transition-colors">
                <TrendingDown className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Despesa</span>
              </button>
              <button onClick={()=>router.navigate({to:"/cartoes/nova-despesa"})}
                className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 bg-white/[0.06] hover:bg-white/[0.12] text-sky-300 transition-colors">
                <CreditCard className="h-4 w-4"/>
                <span className="text-[10px] font-semibold leading-none">Cartão</span>
              </button>
            </div>
          </div>

          <div className="mx-3 border-t border-white/10 mb-1"/>

          {/* ── Navegação principal ── */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
            {[
              {to:"/dashboard",    label:"Início",      icon:Home},
              {to:"/transacoes",   label:"Transações",  icon:Receipt},
              {to:"/cartoes",      label:"Cartões",     icon:CreditCard},
              {to:"/faturas-cartao",label:"Faturas",    icon:Tag},
              {to:"/categorias",   label:"Categorias",  icon:Layers},
            ].map(({to,label,icon:Icon})=>{
              const isActive=pathname===to||pathname.startsWith(to+"/");
              return(
                <Link key={to} to={to} className={navLinkClass(isActive)}>
                  <Icon className="h-4 w-4 shrink-0"/>{label}
                </Link>
              );
            })}
            <Link to="/metas" className={navLinkClass(pathname==="/metas")}>
              <Target className="h-4 w-4 shrink-0"/>Metas e Orçamentos
            </Link>
            <Link to="/perfil" className={navLinkClass(pathname==="/perfil")}>
              <User className="h-4 w-4 shrink-0"/>Perfil
            </Link>
            {est.ehSuperadmin && (
              <Link to="/admin" className={navLinkClass(pathname==="/admin")}>
                <Settings className="h-4 w-4 shrink-0"/>Painel Admin
              </Link>
            )}
          </nav>

          {/* ── Configurações (último) ── */}
          <div className="px-3 pb-4 pt-1 border-t border-white/10 shrink-0">
            <Link to="/mais" className={navLinkClass(pathname==="/mais")}>
              <Settings className="h-4 w-4 shrink-0"/>Configurações
            </Link>
          </div>
        </aside>

                {/* ══ CONTEÚDO PRINCIPAL ════════════════════════════════════════ */}
        <div className="md:ml-64" style={{ overflowX:"hidden" }}>
          <main
            className="md:pb-0 md:min-h-screen"
            style={{ paddingBottom:"calc(88px + env(safe-area-inset-bottom, 0px))" }}>
            {/* 88px = 68px (nav) + 20px folga — garante que botões não ficam atrás do nav */}
            {bloqueadaPorPro ? (
              <TelaBloqueada
                titulo="Recurso do Kyra One Pro"
                descricao="Cartões, faturas e metas fazem parte do plano Pro. Assina pra desbloquear."
                nomePlano={nomeNivel("pro")}
              />
            ) : (
              <Outlet />
            )}
          </main>
        </div>

        {/* ══ MOBILE ONLY: overlay + botões flutuantes + bottom nav ══════ */}
        {addMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setAddMenuOpen(false)}
          />
        )}

        {addMenuOpen && (
          <div className="md:hidden fixed z-50 flex items-end gap-6 left-1/2 -translate-x-1/2" style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 20px))" }}>
            <button onClick={() => handleAddTransaction("income")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Receita</span>
            </button>
            <button onClick={() => handleAddTransaction("expense")}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Despesa</span>
            </button>
            <button onClick={handleAddCardExpense}
              className="flex flex-col items-center gap-1.5 transition-transform active:scale-95">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/40">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow-sm">Cartão</span>
            </button>
          </div>
        )}

        {/* ══ BOTTOM NAV — PWA / MOBILE ══════════════════════════════════ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30"
          style={{
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 -1px 0 rgba(0,0,0,0.06), 0 -4px 20px rgba(0,0,0,0.05)",
          }}>
          <div className="flex w-full items-center px-2" style={{ height: "68px" }}>

            {/* ── Esquerda: Início + Cartões ── */}
            {mobileNavLeft.map(({ to, label, icon: Icon, iconBg, iconColor, activeBg, activeColor }) => {
              const isActive = pathname === to || (to !== "/dashboard" && pathname.startsWith(to + "/"));
              return (
                <button key={to} type="button"
                  onClick={() => router.navigate({ to })}
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95">
                  {/* Caixa do ícone */}
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    isActive ? activeBg : iconBg
                  )}>
                    <Icon className={cn(
                      "h-[19px] w-[19px] transition-colors duration-200",
                      isActive ? "text-white" : iconColor
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold leading-none transition-colors",
                    isActive ? activeColor : "text-slate-400"
                  )}>{label}</span>
                </button>
              );
            })}

            {/* ── Centro: botão Adicionar ── */}
            <button type="button" onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex flex-1 flex-col items-center justify-center gap-1.5 h-full active:scale-95 transition-transform">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200",
                addMenuOpen
                  ? "bg-slate-700 shadow-slate-700/30 rotate-45"
                  : "bg-primary shadow-primary/30"
              )}>
                {addMenuOpen
                  ? <X className="h-6 w-6 text-white"/>
                  : <PlusCircle className="h-6 w-6 text-white"/>}
              </div>
              <span className={cn(
                "text-[10px] font-semibold leading-none",
                addMenuOpen ? "text-slate-500" : "text-primary"
              )}>Adicionar</span>
            </button>

            {/* ── Direita: Faturas + Configurações ── */}
            {mobileNavRight.map(({ to, label, icon: Icon, iconBg, iconColor, activeBg, activeColor }) => {
              const isActive = pathname === to || pathname.startsWith(to + "/");
              return (
                <button key={to} type="button"
                  onClick={() => router.navigate({ to })}
                  className="flex flex-1 flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    isActive ? activeBg : iconBg
                  )}>
                    <Icon className={cn(
                      "h-[19px] w-[19px] transition-colors duration-200",
                      isActive ? "text-white" : iconColor
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold leading-none transition-colors",
                    isActive ? activeColor : "text-slate-400"
                  )}>{label}</span>
                </button>
              );
            })}

          </div>
          {/* Safe area iOS */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </nav>
      </div>
    </TooltipProvider>
  );
}
