import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ArrowRightLeft,
  CreditCard,
  Target,
  Layers,
  ShieldCheck,
  Gift,
  Lock,
  Unlock,
  Check,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { KYRA_WHATSAPP_CTA_LINK, KYRA_WHATSAPP_NUMBER_DISPLAY } from "@/lib/constants";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const NAVY = "#03264E";
const GOLD = "#F2B33D";
const CLAY = "#C4693B";
const WHATS = "#25D366";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BarChart3, title: "Dashboard inteligente", text: "Veja de cara como seu mês está: receitas, despesas e saldo num gráfico que faz sentido." },
  { icon: ArrowRightLeft, title: "Receitas e despesas", text: "Lança receita e despesa rapidinho, separa por categoria e esquece a planilha de Excel." },
  { icon: CreditCard, title: "Cartões e faturas", text: "Controla cartão de crédito, parcelamentos e fatura por fatura sem perder o fio da meada." },
  { icon: Target, title: "Metas e orçamentos", text: "Define quanto quer gastar por categoria e acompanha se tá no caminho ou surtando no cartão." },
  { icon: Layers, title: "Categorias sob medida", text: "Cria, edita e organiza categorias do seu jeito, pra combinar com a sua vida real." },
  { icon: ShieldCheck, title: "Seguro de ponta a ponta", text: "Seus dados ficam criptografados. Só você vê as suas finanças — ninguém mais." },
];

const TRUST = [
  { icon: Gift, label: "14 dias grátis" },
  { icon: CreditCard, label: "Sem cartão de crédito" },
  { icon: Lock, label: "Dados criptografados" },
  { icon: Unlock, label: "Cancele quando quiser" },
];

const STEPS = [
  { n: "1", title: "Cria sua conta", text: "Em menos de um minuto, sem cartão de crédito." },
  { n: "2", title: "Organiza tudo", text: "Cadastra contas, cartões e categorias do seu jeito." },
  { n: "3", title: "Acompanha e ajusta", text: "Vê pra onde o dinheiro vai e corrige a rota quando precisar." },
];

const PLANOS = [
  {
    nome: "Kyra One Controle",
    preco: "29,90",
    desc: "O essencial pra organizar a vida financeira.",
    destaque: false,
    itens: ["Transações de receitas e despesas", "Categorias personalizadas", "Dashboard com relatórios"],
  },
  {
    nome: "Kyra One Pro",
    preco: "49,90",
    desc: "Tudo do Controle, liberado por completo.",
    destaque: true,
    itens: ["Tudo do Kyra One Controle", "Cartões e faturas", "Metas e orçamentos"],
  },
];

function LandingPage() {
  return (
    <>
      {/* Fontes — hoisted pro <head> pelo React 19 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Figtree:wght@400;500;600;700&display=swap"
      />

      <div
        className="w-full overflow-x-hidden"
        style={{ fontFamily: "'Figtree', system-ui, sans-serif", background: "#FBF7EC", color: "#1C2333" }}
      >
        {/* ============ NAV ============ */}
        <header className="sticky top-0 z-50 border-b border-[#03264E]/10 backdrop-blur-md" style={{ background: "rgba(251,247,236,0.88)" }}>
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
            <a href="#topo" className="flex items-center gap-2.5" aria-label="KyraOne — início">
              <img src="/icons/icon-192.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-[9px]" />
              <span style={{ fontFamily: "'Sora', sans-serif" }} className="text-lg font-bold" >
                <span style={{ color: NAVY }}>KyraOne</span>
              </span>
            </a>
            <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
              <a href="#funcionalidades" className="text-sm font-medium text-[#3A4152] hover:text-[#03264E]">O que faz</a>
              <a href="#como-funciona" className="text-sm font-medium text-[#3A4152] hover:text-[#03264E]">Como funciona</a>
              <a href="#whatsapp" className="text-sm font-medium text-[#3A4152] hover:text-[#03264E]">WhatsApp</a>
              <a href="#planos" className="text-sm font-medium text-[#3A4152] hover:text-[#03264E]">Planos</a>
            </nav>
            <Link
              to="/login"
              style={{ background: NAVY, color: "#FBF7EC" }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
            >
              Entrar
            </Link>
          </div>
        </header>

        {/* ============ HERO ============ */}
        <section id="topo" className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-24" style={{ background: NAVY }}>
          <div
            className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full blur-md"
            style={{ background: "radial-gradient(circle, rgba(63,107,52,0.55), rgba(63,107,52,0) 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-40 -left-28 h-[460px] w-[460px] rounded-full blur-md"
            style={{ background: "radial-gradient(circle, rgba(242,179,61,0.22), rgba(242,179,61,0) 70%)" }}
          />
          <svg viewBox="0 0 1440 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-10">
            <polyline points="0,420 180,380 340,430 520,300 680,340 860,200 1040,250 1220,110 1440,150" fill="none" stroke="#6FCF97" strokeWidth={3} />
          </svg>

          <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 lg:grid-cols-2">
            <div>
              <span
                className="mb-5 inline-block rounded-full px-4 py-1.5 text-[13px] font-semibold"
                style={{ background: "rgba(242,179,61,0.16)", color: GOLD }}
              >
                14 dias grátis · sem cartão de crédito
              </span>
              <h1
                style={{ fontFamily: "'Sora', sans-serif", color: "#FBF7EC" }}
                className="mb-5 text-[2.1rem] font-extrabold leading-[1.08] sm:text-[2.6rem] lg:text-[3.4rem]"
              >
                Suas finanças, organizadas sem drama.
              </h1>
              <p className="mb-8 max-w-[480px] text-[17.5px] leading-relaxed" style={{ color: "rgba(251,247,236,0.72)" }}>
                O KyraOne mostra pra onde seu dinheiro vai: contas, cartões, faturas e metas, tudo num lugar só.
                Sem planilha, sem letra miúda, sem complicação.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${CLAY})`, color: NAVY, fontFamily: "'Sora', sans-serif" }}
                  className="rounded-full px-8 py-4 text-base font-bold shadow-[0_14px_28px_-10px_rgba(242,179,61,0.45)] transition-transform hover:-translate-y-0.5"
                >
                  Entrar no KyraOne
                </Link>
                <span className="text-[13.5px]" style={{ color: "rgba(251,247,236,0.55)" }}>
                  Leva menos de 1 minuto pra criar sua conta.
                </span>
              </div>
            </div>

            <div className="relative min-h-[300px] sm:min-h-[360px]">
              <div
                className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(111,207,151,0.25), rgba(111,207,151,0) 72%)" }}
              />
              <img
                src="/icons/icon-192.png"
                alt="Logo KyraOne"
                className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-[34px] shadow-[0_30px_60px_-18px_rgba(0,0,0,0.5)] sm:h-[168px] sm:w-[168px]"
              />
              <div className="absolute left-1 top-4 flex max-w-[210px] items-center gap-2.5 rounded-2xl bg-[#FBF7EC] px-4 py-3 shadow-[0_16px_30px_-12px_rgba(0,0,0,0.35)]">
                <ArrowRightLeft className="h-5 w-5 shrink-0" style={{ color: "#3F6B34" }} />
                <span className="text-[13px] font-semibold text-[#1C2333]">Receitas &amp; despesas em dia</span>
              </div>
              <div className="absolute bottom-3 right-0 flex max-w-[200px] items-center gap-2.5 rounded-2xl bg-[#FBF7EC] px-4 py-3 shadow-[0_16px_30px_-12px_rgba(0,0,0,0.35)]">
                <Target className="h-5 w-5 shrink-0" style={{ color: CLAY }} />
                <span className="text-[13px] font-semibold text-[#1C2333]">Metas no caminho certo</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TRUST STRIP ============ */}
        <section className="border-b border-[#03264E]/10">
          <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-8 px-5 py-7 sm:px-8">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5" style={{ color: NAVY }}>
                <Icon className="h-5 w-5" style={{ color: "#3F6B34" }} />
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ FUNCIONALIDADES ============ */}
        <section id="funcionalidades" className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-13 max-w-[560px]">
              <span className="mb-3 inline-block text-[13px] font-bold uppercase tracking-wider" style={{ color: "#3F6B34" }}>
                O que você faz aqui
              </span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", color: NAVY }} className="mb-3.5 text-[1.8rem] font-extrabold leading-tight sm:text-[2.5rem]">
                Tudo que a sua vida financeira precisa, num app só.
              </h2>
              <p className="text-[16.5px] leading-relaxed text-[#55596A]">
                Esquece aquela mistura de planilha, extrato de banco e papelzinho. Aqui é um lugar só pra tudo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="flex flex-col gap-3.5 rounded-[20px] border border-[#03264E]/10 bg-white p-6 transition-transform hover:-translate-y-1 hover:shadow-[0_14px_30px_-10px_rgba(3,38,78,0.18)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(63,107,52,0.1)" }}>
                    <Icon className="h-[22px] w-[22px]" style={{ color: "#3F6B34" }} />
                  </div>
                  <h3 style={{ fontFamily: "'Sora', sans-serif", color: NAVY }} className="text-[17px] font-bold">
                    {title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-[#55596A]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ COMO FUNCIONA ============ */}
        <section id="como-funciona" className="px-5 py-24 sm:px-8" style={{ background: "#EDF1E6" }}>
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto mb-14 max-w-[580px] text-center">
              <span className="mb-3 inline-block text-[13px] font-bold uppercase tracking-wider" style={{ color: "#3F6B34" }}>
                Sem enrolação
              </span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", color: NAVY }} className="text-[1.8rem] font-extrabold leading-tight sm:text-[2.5rem]">
                Começa a usar em 3 passos
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="flex flex-col items-center gap-3.5 text-center">
                  <div
                    style={{ background: GOLD, color: NAVY, fontFamily: "'Sora', sans-serif" }}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-lg font-extrabold"
                  >
                    {s.n}
                  </div>
                  <h3 style={{ fontFamily: "'Sora', sans-serif", color: NAVY }} className="text-[17px] font-bold">
                    {s.title}
                  </h3>
                  <p className="max-w-[220px] text-[14.5px] leading-relaxed text-[#55596A]">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ WHATSAPP (destaque) ============ */}
        <section id="whatsapp" className="relative overflow-hidden px-5 py-24 sm:px-8" style={{ background: NAVY }}>
          <div
            className="pointer-events-none absolute -left-28 top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full blur-md"
            style={{ background: `radial-gradient(circle, ${WHATS}33, ${WHATS}00 70%)` }}
          />
          <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 lg:grid-cols-2">
            <div>
              <span
                className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold"
                style={{ background: `${WHATS}26`, color: WHATS }}
              >
                <MessageCircle className="h-[15px] w-[15px]" /> Novidade
              </span>
              <h2
                style={{ fontFamily: "'Sora', sans-serif", color: "#FBF7EC" }}
                className="mb-4 text-[1.8rem] font-extrabold leading-tight sm:text-[2.5rem]"
              >
                Lança uma despesa só mandando um "oi" pra Kyra.
              </h2>
              <p className="mb-7 max-w-[480px] text-[16.5px] leading-relaxed" style={{ color: "rgba(251,247,236,0.72)" }}>
                Gastou no mercado, no Uber, no delivery? Manda uma mensagem pro WhatsApp da Kyra contando o
                que foi — ela registra a despesa certinha, na hora, sem você precisar abrir o app.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={KYRA_WHATSAPP_CTA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: WHATS, color: "#06230F", fontFamily: "'Sora', sans-serif" }}
                  className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-base font-bold shadow-[0_14px_28px_-10px_rgba(37,211,102,0.45)] transition-transform hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-5 w-5" /> Falar com a Kyra agora
                </a>
                <span className="text-[13.5px]" style={{ color: "rgba(251,247,236,0.55)" }}>
                  {KYRA_WHATSAPP_NUMBER_DISPLAY}
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[360px]">
              <div className="rounded-[26px] bg-[#0B141A] p-4 shadow-[0_30px_60px_-18px_rgba(0,0,0,0.55)]">
                <div className="mb-3 flex items-center gap-2.5 rounded-t-xl px-1 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <img src="/icons/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-white">Kyra</p>
                    <p className="text-[11px]" style={{ color: WHATS }}>online</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 px-1 pb-2">
                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5" style={{ background: "#005C4B" }}>
                    <p className="text-[13.5px] leading-snug text-white">Gastei 45 reais no mercado</p>
                  </div>
                  <div className="mr-auto max-w-[82%] rounded-2xl rounded-tl-sm bg-[#202C33] px-3.5 py-2.5">
                    <p className="text-[13.5px] leading-snug text-white">
                      Prontim ✅ Anotei: <strong>Mercado</strong>, R$ 45,00 em Alimentação.
                    </p>
                  </div>
                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-sm px-3.5 py-2.5" style={{ background: "#005C4B" }}>
                    <p className="text-[13.5px] leading-snug text-white">rolou 32 reais de Uber tbm</p>
                  </div>
                  <div className="mr-auto max-w-[82%] rounded-2xl rounded-tl-sm bg-[#202C33] px-3.5 py-2.5">
                    <p className="text-[13.5px] leading-snug text-white">
                      Prontim ✅ Anotei: <strong>Uber</strong>, R$ 32,00 em Transporte.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PLANOS ============ */}
        <section id="planos" className="px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[620px] text-center">
              <span className="mb-3 inline-block text-[13px] font-bold uppercase tracking-wider" style={{ color: "#3F6B34" }}>
                Sem pegadinha
              </span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", color: NAVY }} className="mb-3.5 text-[1.8rem] font-extrabold leading-tight sm:text-[2.5rem]">
                Comece de graça, decida depois.
              </h2>
              <p className="text-[16.5px] leading-relaxed text-[#55596A]">
                Toda conta nova já nasce com <strong style={{ color: NAVY }}>14 dias de Kyra One Pro completo</strong> — Cartões,
                Faturas e Metas liberados sem precisar de cartão de crédito.
              </p>
            </div>

            <div className="mx-auto mt-13 grid max-w-[880px] grid-cols-1 gap-6 sm:grid-cols-2">
              {PLANOS.map((p) => (
                <div
                  key={p.nome}
                  className="relative flex flex-col gap-4.5 rounded-[22px] border p-7 transition-transform hover:-translate-y-1"
                  style={{
                    background: p.destaque ? NAVY : "#fff",
                    borderColor: p.destaque ? NAVY : "rgba(3,38,78,0.08)",
                  }}
                >
                  {p.destaque && (
                    <span
                      className="absolute -top-3 right-6 rounded-full px-3 py-1 text-[11.5px] font-bold"
                      style={{ background: GOLD, color: NAVY }}
                    >
                      Mais popular
                    </span>
                  )}
                  <div>
                    <h3
                      style={{ fontFamily: "'Sora', sans-serif", color: p.destaque ? "#FBF7EC" : NAVY }}
                      className="mb-1.5 text-[19px] font-bold"
                    >
                      {p.nome}
                    </h3>
                    <p className="text-sm" style={{ color: p.destaque ? "rgba(251,247,236,0.65)" : "#55596A" }}>
                      {p.desc}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span style={{ fontFamily: "'Sora', sans-serif", color: p.destaque ? "#FBF7EC" : NAVY }} className="text-[34px] font-extrabold">
                      R$ {p.preco}
                    </span>
                    <span className="text-[13.5px]" style={{ color: p.destaque ? "rgba(251,247,236,0.55)" : "#55596A" }}>
                      /mês
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-2.5">
                    {p.itens.map((it) => (
                      <div key={it} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: p.destaque ? GOLD : "#3F6B34" }} />
                        <span className="text-sm leading-tight" style={{ color: p.destaque ? "rgba(251,247,236,0.85)" : "#1C2333" }}>
                          {it}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 text-center">
              <Link
                to="/login"
                style={{ background: NAVY, color: "#FBF7EC", fontFamily: "'Sora', sans-serif" }}
                className="inline-block rounded-full px-8 py-4 text-[15.5px] font-bold transition-transform hover:-translate-y-0.5"
              >
                Entrar e começar meu trial
              </Link>
            </div>
          </div>
        </section>

        {/* ============ CTA FINAL ============ */}
        <section className="relative overflow-hidden px-5 py-22 text-center sm:px-8" style={{ background: NAVY }}>
          <div
            className="pointer-events-none absolute -top-36 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-md"
            style={{ background: "radial-gradient(circle, rgba(111,207,151,0.22), rgba(111,207,151,0) 70%)" }}
          />
          <div className="relative mx-auto max-w-[640px]">
            <h2 style={{ fontFamily: "'Sora', sans-serif", color: "#FBF7EC" }} className="mb-4 text-[1.9rem] font-extrabold leading-tight sm:text-[2.7rem]">
              Bora organizar essa grana?
            </h2>
            <p className="mb-8 text-[16.5px]" style={{ color: "rgba(251,247,236,0.7)" }}>
              14 dias grátis, Pro completo, zero cartão de crédito. Só entrar e começar.
            </p>
            <Link
              to="/login"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${CLAY})`, color: NAVY, fontFamily: "'Sora', sans-serif" }}
              className="inline-block rounded-full px-9 py-4 text-base font-bold shadow-[0_14px_28px_-10px_rgba(242,179,61,0.45)] transition-transform hover:-translate-y-0.5"
            >
              Entrar no KyraOne
            </Link>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="px-5 py-10 sm:px-8" style={{ background: "#021C3D" }}>
          <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/icons/icon-192.png" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-[7px]" />
              <span className="text-[13.5px]" style={{ color: "rgba(251,247,236,0.6)" }}>
                🌱 Seu cantinho pra cuidar do dinheiro · © 2026 KyraOne
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/login" className="text-[13.5px] font-medium" style={{ color: "rgba(251,247,236,0.75)" }}>
                Entrar
              </Link>
              <Link to="/termos" className="text-[13.5px] font-medium" style={{ color: "rgba(251,247,236,0.75)" }}>
                Termos de Uso
              </Link>
              <Link to="/privacidade" className="text-[13.5px] font-medium" style={{ color: "rgba(251,247,236,0.75)" }}>
                Privacidade
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
