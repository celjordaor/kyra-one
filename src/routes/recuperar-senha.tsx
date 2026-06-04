import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const recoverySchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
});

type RecoveryForm = z.infer<typeof recoverySchema>;

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryForm>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: RecoveryForm) => {
    setAuthError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setAuthError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }

    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Recuperar senha
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enviaremos um link para redefinir sua senha
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">E-mail enviado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {authError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="h-11 pl-10"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
