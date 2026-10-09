import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Chrome compartilhado das páginas públicas de Termos de Uso e Política de
 * Privacidade (/termos, /privacidade). Conteúdo em prosa simples — sem
 * plugin de typography, formatação manual via componentes auxiliares
 * (H2/P/Ul abaixo) pra manter espaçamento e tipografia consistentes.
 */
export function LegalPageLayout({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white dark:bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/icons/icon-192.png"
              alt="KyraOne"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg"
            />
            <span className="font-bold text-foreground">KyraOne</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{titulo}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Última atualização: {atualizadoEm}</p>

        <div className="mt-8 space-y-7">{children}</div>
      </main>

      <footer className="border-t bg-white dark:bg-card px-5 py-8 text-center text-xs text-muted-foreground">
        KyraOne © 2026 — Universo Kyra Ltda
      </footer>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold text-foreground">{children}</h2>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <H2>{title}</H2>
      <div className="space-y-2.5 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}
