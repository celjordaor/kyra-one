import { createFileRoute, useRouter } from "@tanstack/react-router";
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

function LogoIcon({ size = 24, className = "text-white" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M12 2v20"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

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

      {/* ── Painel esquerdo ─────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-primary to-primary/75">

        {/* Círculos decorativos */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white opacity-[0.08]" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-white opacity-[0.08]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-white opacity-[0.04]" />

        {/* Logo + nome grande */}
        <div className="relative z-10">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
            <LogoIcon size={32} />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[42px] font-black text-white leading-none tracking-tight">
              JadeOne
            </span>
            <span className="rounded border border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
              Finanças
            </span>
          </div>
          <p className="mt-1.5 text-sm text-white/55 tracking-wide">
            seu sistema financeiro pessoal
          </p>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 space-y-7">
          <div>
            <h1 className="text-[34px] font-extrabold text-white leading-tight">
              Controle total<br/>das suas finanças
            </h1>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Simples, seguro e eficiente.
            </p>
          </div>
          <ul className="space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-white/15">
                  <Icon className="h-[15px] w-[15px] text-white" />
                </div>
                <span className="text-[13.5px] font-medium text-white/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-white/30">
          © {new Date().getFullYear()} JadeOne. Todos os direitos reservados.
        </p>
      </div>

      {/* ── Painel direito — fundo cinza + card ─────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-slate-100 px-6 py-12">
        {/* Card branco */}
        <div className="w-full max-w-[400px] rounded-2xl bg-white px-9 py-10 shadow-xl shadow-black/[0.08]">

          {/* Logo mobile (só no mobile) */}
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
              <LogoIcon size={18} />
            </div>
            <span className="text-lg font-black text-foreground tracking-tight">JadeOne</span>
          </div>

          {/* Logo desktop dentro do card */}
          <div className="mb-7 hidden items-center gap-2.5 lg:flex">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
              <LogoIcon size={20} />
            </div>
            <span className="text-[18px] font-black text-foreground tracking-tight">JadeOne</span>
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
                <a href="https://quintalzim.com.br/entrar" className="text-xs font-semibold text-primary hover:underline">
                  Esqueceu a senha?
                </a>
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

            <Button type="submit" className="h-11 w-full font-bold shadow-md shadow-primary/25" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar na conta"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <a href="https://quintalzim.com.br/entrar" className="font-bold text-primary hover:underline">
              Ela nasce no Quintalzim 🌱
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
