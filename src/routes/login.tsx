import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, TrendingUp, Target, PieChart, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const FEATURES = [
  { icon: TrendingUp,   text: "Controle de receitas e despesas" },
  { icon: PieChart,     text: "Dashboard com relatórios e análises" },
  { icon: Target,       text: "Defina e acompanhe suas metas" },
  { icon: ShieldCheck,  text: "Dados seguros com criptografia" },
];

const NAVY = "#03264E";
const GOLD = "#F2B33D";
const CLAY = "#C4693B";

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError]       = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = async (data: LoginForm) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setAuthError("E-mail ou senha incorretos. Verifique e tente novamente.");
      return;
    }
    router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen">

      {/* Fontes da landing — hoisted pro <head> pelo React 19 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Figtree:wght@400;500;600;700&display=swap"
      />

      {/* ── Painel esquerdo ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: NAVY, fontFamily: "'Figtree', system-ui, sans-serif" }}
      >

        {/* Orbs desfocados — mesmo padrão da landing */}
        <div
          className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: GOLD }}
        />
        <div
          className="absolute -bottom-28 -left-20 w-[380px] h-[380px] rounded-full opacity-20 blur-3xl"
          style={{ background: CLAY }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-white opacity-[0.03]" />

        {/* Logo + nome grande */}
        <div className="relative z-10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-lg backdrop-blur-sm overflow-hidden">
            <img src="/icons/icon-192.png" alt="KyraOne" width={40} height={40} className="h-10 w-10 rounded-[9px]" />
          </div>
          <div className="flex items-baseline gap-3">
            <span
              style={{ fontFamily: "'Sora', sans-serif" }}
              className="text-[32px] font-bold text-white leading-none tracking-tight"
            >
              KyraOne
            </span>
          </div>
          <p className="mt-1.5 text-sm text-white/55 tracking-wide">
            seu sistema financeiro pessoal
          </p>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 space-y-7">
          <div>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide"
              style={{ background: GOLD, color: NAVY }}
            >
              14 dias grátis
            </span>
            <h1
              style={{ fontFamily: "'Sora', sans-serif" }}
              className="mt-3 text-[34px] font-bold text-white leading-tight"
            >
              Controle total<br/>das suas finanças
            </h1>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Simples, seguro e eficiente.
            </p>
          </div>
          <ul className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-emerald-400/15">
                  <Icon className="h-[15px] w-[15px] text-emerald-400" />
                </div>
                <span className="text-[13.5px] font-medium text-white/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-white/30">
          © {new Date().getFullYear()} KyraOne. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Painel direito — fundo cinza + card ─────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        {/* Card branco */}
        <div className="w-full max-w-[400px] rounded-2xl bg-white px-9 py-10 shadow-xl shadow-black/[0.08]">

          {/* Logo mobile (só no mobile) */}
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md" style={{ boxShadow: `0 4px 10px ${NAVY}30` }}>
              <img src="/icons/icon-192.png" alt="KyraOne" width={36} height={36} className="h-9 w-9" />
            </div>
            <span className="text-lg font-black text-foreground tracking-tight">KyraOne</span>
          </div>

          {/* Logo desktop dentro do card */}
          <div className="mb-7 hidden items-center gap-2.5 lg:flex">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl overflow-hidden shadow-md" style={{ boxShadow: `0 4px 10px ${NAVY}30` }}>
              <img src="/icons/icon-192.png" alt="KyraOne" width={38} height={38} className="h-[38px] w-[38px]" />
            </div>
            <span className="text-[18px] font-black text-foreground tracking-tight">KyraOne</span>
          </div>

          {/* Saudação */}
          <div className="mb-7">
            <h2 className="text-[22px] font-bold tracking-tight text-foreground">
              Acesse sua conta
            </h2>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {authError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="email" type="email" placeholder="seu@email.com"
                  className="h-11 pl-9 bg-white"
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Senha
                </Label>
                <Link to="/recuperar-senha" className="text-xs font-semibold text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="password" type={showPassword ? "text" : "password"}
                  placeholder="••••••••" className="h-11 pl-9 pr-10 bg-white"
                  {...register("password")}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember" {...register("remember")} />
              <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
                Lembrar de mim
              </Label>
            </div>

            <Button
              type="submit"
              className="h-11 w-full font-bold text-white shadow-md hover:opacity-90"
              style={{ background: NAVY, boxShadow: `0 4px 14px ${NAVY}40` }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Entrando..." : "Entrar na conta"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-bold text-primary hover:underline">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
