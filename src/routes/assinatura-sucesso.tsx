import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/subscription-store";
import { z } from "zod";

const searchSchema = z.object({
  collection_status: z.string().optional(),
  status: z.string().optional(),
  external_reference: z.string().optional(),
});

export const Route = createFileRoute("/assinatura-sucesso")({
  validateSearch: searchSchema,
  component: AssinaturaSucessoPage,
});

function AssinaturaSucessoPage() {
  const search = useSearch({ from: "/assinatura-sucesso" });
  const { reload } = useSubscription();
  const [state, setState] = useState<"loading" | "success" | "pending" | "failed">("loading");

  const mpStatus = search.collection_status || search.status;

  useEffect(() => {
    if (mpStatus === "approved") {
      // Aguardar webhook processar e recarregar status
      setTimeout(async () => {
        await reload();
        setState("success");
      }, 3000);
    } else if (mpStatus === "pending") {
      setState("pending");
    } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
      setState("failed");
    } else {
      // Sem parâmetro — verificar diretamente
      setTimeout(async () => {
        await reload();
        setState("pending");
      }, 3000);
    }
  }, [mpStatus]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-xl font-bold text-foreground">Processando seu pagamento...</h1>
        <p className="text-sm text-muted-foreground">Aguarde um momento.</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Assinatura ativada!</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Seu pagamento foi confirmado e seu acesso já está liberado.
        </p>
        <Button asChild className="mt-4 h-11 w-full max-w-xs bg-primary font-semibold">
          <Link to="/dashboard">Ir para o app</Link>
        </Button>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <Loader2 className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Pagamento em análise</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Seu pagamento está sendo processado. Assim que confirmado, seu acesso será liberado automaticamente.
        </p>
        <Button asChild variant="outline" className="mt-4 h-11 w-full max-w-xs">
          <Link to="/dashboard">Voltar ao app</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Pagamento não concluído</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Houve um problema com o pagamento. Tente novamente ou escolha outra forma de pagamento.
      </p>
      <Button asChild className="mt-4 h-11 w-full max-w-xs bg-primary font-semibold">
        <Link to="/planos">Tentar novamente</Link>
      </Button>
      <Button asChild variant="ghost" className="w-full max-w-xs">
        <Link to="/dashboard">Voltar ao app</Link>
      </Button>
    </div>
  );
}
