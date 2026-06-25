import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const schema = z
  .object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

// Traduz os erros mais comuns do Supabase para uma mensagem amigável,
// mas SEMPRE loga o erro original no console para diagnóstico.
function friendlyError(error: { message?: string; status?: number } | null): string {
  if (!error) return "Erro desconhecido. Tente novamente.";
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token")) {
    return "O link expirou ou já foi utilizado. Solicite um novo e-mail de recuperação.";
  }
  if (msg.includes("session") || msg.includes("not authenticated") || msg.includes("aud")) {
    return "Sessão de recuperação não encontrada. Abra o link do e-mail novamente (sem recarregar a página antes) ou solicite um novo.";
  }
  if (msg.includes("same") || msg.includes("different")) {
    return "A nova senha deve ser diferente da anterior.";
  }
  if (msg.includes("weak") || msg.includes("at least")) {
    return "Senha muito simples. Use pelo menos 6 caracteres, misturando letras e números.";
  }
  // Fallback: mostra a mensagem original do Supabase, é melhor que um texto genérico
  return error.message || "Não foi possível redefinir a senha. Tente novamente.";
}

function RedefinirSenhaPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null); // null = checando

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Escuta o evento PASSWORD_RECOVERY (forma oficial recomendada pelo Supabase)
  // e também verifica se já existe sessão (caso o evento já tenha disparado antes do mount).
  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[redefinir-senha] auth event:", event, !!session);
      if (event === "PASSWORD_RECOVERY") {
        resolved = true;
        setRecoveryReady(true);
      }
    });

    // Fallback: se o evento já disparou antes do listener ser registrado,
    // uma sessão válida já deve existir.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved && session) {
        setRecoveryReady(true);
      } else if (!resolved) {
        // Dá uma janela curta para o evento chegar antes de declarar inválido
        setTimeout(() => {
          if (!resolved) setRecoveryReady(false);
        }, 2500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      console.error("[redefinir-senha] erro real do Supabase:", error);
      setAuthError(friendlyError(error));
      return;
    }
    setDone(true);
    setTimeout(() => router.navigate({ to: "/dashboard" }), 2000);
  };

  if (done) {
    return (
      <Centered>
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Senha redefinida!</h2>
        <p className="mt-2 text-sm text-muted-foreground">Redirecionando para o painel...</p>
      </Centered>
    );
  }

  // Ainda checando se o link de recuperação é válido
  if (recoveryReady === null) {
    return (
      <Centered>
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Validando seu link de recuperação...</p>
      </Centered>
    );
  }

  // Link inválido/expirado — evita mostrar o formulário para só falhar depois
  if (recoveryReady === false) {
    return (
      <Centered>
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esse link de recuperação não é mais válido. Volte para o login e solicite um novo e-mail de recuperação de senha.
        </p>
        <Button asChild className="mt-5 h-11 w-full bg-primary font-semibold">
          <a href="/recuperar-senha">Solicitar novo link</a>
        </Button>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nova senha</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Escolha uma nova senha para sua conta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                className="h-11 pl-10 pr-10" {...register("password")} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="••••••••"
              className="h-11" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" className="h-11 w-full bg-primary font-semibold" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Redefinir senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
