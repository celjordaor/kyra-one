import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, TrendingUp, Target, PieChart, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/boas-vindas")({
  component: BoasVindasPage,
});

const FEATURES = [
  { icon: TrendingUp,  text: "Controle suas receitas e despesas" },
  { icon: PieChart,    text: "Dashboard com relatórios visuais" },
  { icon: Target,      text: "Crie e acompanhe metas financeiras" },
  { icon: ShieldCheck, text: "Dados criptografados e seguros" },
];

const CONFETTI_COLORS = ["#10b981","#34d399","#6ee7b7","#fbbf24","#60a5fa","#f472b6","#a78bfa"];

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

function BoasVindasPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [confetti] = useState(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.8,
      duration: 2.2 + Math.random() * 2,
      size: 6 + Math.random() * 9,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
      shape: i % 3,
    }))
  );

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
  }, []);

  const handleStart = () => {
    localStorage.setItem("jadeone:welcomed", "true");
    router.navigate({ to: "/dashboard" });
  };

  return (
    <>
      {/* Keyframes injetados */}
      <style>{`
        @keyframes jd-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes jd-fadeup {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes jd-popin {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes jd-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.35; }
          100% { transform: scale(1.65); opacity: 0;   }
        }
        .jd-card { animation: jd-fadeup 0.55s ease both; }
        .jd-logo-wrap { animation: jd-popin 0.45s 0.25s both; }
        .jd-ring {
          position: absolute; inset: -14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.28);
          animation: jd-pulse-ring 2.2s ease-out infinite;
        }
      `}</style>

      {/* Confetti */}
      {confetti.map((p) => (
        <div key={p.id} style={{
          position: "fixed", left: `${p.x}%`, top: -20,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: p.shape === 0 ? "50%" : p.shape === 1 ? "2px" : "50% 0",
          transform: `rotate(${p.rotation}deg)`,
          animation: `jd-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          pointerEvents: "none", zIndex: 0,
        }}/>
      ))}

      {/* Fundo */}
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-sky-50 px-4 py-10 relative overflow-hidden">

        {/* Card */}
        <div className={`jd-card relative z-10 w-full max-w-[480px] overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-primary/15 ${visible ? "" : "opacity-0"}`}>

          {/* Header verde */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 px-9 pt-10 pb-9 text-center">
            {/* Círculos */}
            <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full bg-white/[0.07]"/>
            <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-white/[0.06]"/>

            {/* Logo */}
            <div className="jd-logo-wrap relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-white/20 shadow-lg backdrop-blur-sm">
              <div className="jd-ring"/>
              <LogoIcon size={38}/>
            </div>

            <h1 className="text-xl font-bold text-white leading-snug">
              Seja bem-vindo(a) ao seu Quintal de Finanças 🌱
            </h1>
            <p className="mt-2 text-sm text-white/75 leading-relaxed">
              Seu cantinho pra cuidar do dinheiro sem complicação.
            </p>
          </div>

          {/* Corpo */}
          <div className="px-9 pt-8 pb-9">

            {/* Features */}
            <p className="mb-3.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              O que você pode fazer
            </p>
            <ul className="mb-7 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/10">
                    <Icon className="h-[15px] w-[15px] text-primary"/>
                  </div>
                  <span className="flex-1 text-sm text-foreground">{text}</span>
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary"/>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              onClick={handleStart}
              className="h-12 w-full gap-2 rounded-2xl text-[15px] font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-transform"
            >
              Começar
              <ArrowRight className="h-5 w-5"/>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
