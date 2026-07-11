// src/routes/share-intent.tsx
// Rota removida — funcionalidade de captura por clipboard está no dashboard.
// Redireciona qualquer acesso para o dashboard.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/share-intent")({
  validateSearch: z.object({
    text:  z.string().optional(),
    title: z.string().optional(),
    url:   z.string().optional(),
  }),
  component: () => <Navigate to="/dashboard" />,
});
