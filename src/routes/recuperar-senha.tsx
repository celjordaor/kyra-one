import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
});

type FormValues = z.infer<typeof schema>;

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
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (data: FormValues) => {
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) {
      setAuthError("Não deu pra mandar o link agora. Tenta de novo em instantes.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-[400px] rounded-2xl bg-white px-9 py-10 text-center shadow-xl shadow-black/[0.08]">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Verifica seu e-mail</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Se esse e-mail tiver uma conta no KyraOne, mandamos um link pra você redefinir a senha.
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm font-bold text-primary hover:underline">
            Voltar pro login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px] rounded-2xl bg-white px-9 py-10 shadow-xl shadow-black/[0.08]">
        <div className="mb-7">
          <h2 className="text-[22px] font-bold tracking-tight text-foreground">Esqueceu a senha?</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Digita seu e-mail que mandamos um link pra redefinir.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {authError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground/60" />
              <Input id="email" type="email" placeholder="seu@email.com" className="h-11 pl-9 bg-white" {...register("email")} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <Button type="submit" className="h-11 w-full font-bold shadow-md shadow-primary/25" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
