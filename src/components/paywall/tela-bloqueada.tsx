import { Lock } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

// Card padrão mostrado no lugar de uma tela/recurso quando o usuário não tem
// o plano necessário. Mesmo padrão do Quintalzim (components/app/TelaBloqueada.tsx),
// adaptado ao design system do KyraOne.
export default function TelaBloqueada({
  titulo,
  descricao,
  nomePlano,
  textoBotao = "Ver planos",
}: {
  titulo: string;
  descricao: string;
  nomePlano: string;
  textoBotao?: string;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Recurso do plano {nomePlano}
        </span>
        <h1 className="text-lg font-bold text-foreground">{titulo}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      <Button className="w-full" onClick={() => router.navigate({ to: "/assinar" })}>
        {textoBotao}
      </Button>
    </div>
  );
}
