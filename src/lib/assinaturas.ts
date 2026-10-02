// Estado de assinatura do usuário logado — lê `profiles.role` (superadmin) e
// `assinaturas` (status/plano/trial_fim) direto do Supabase via RLS (cada um
// só vê a própria linha). Mesmo padrão de "nível de plano" usado no
// Quintalzim (lib/assinaturas.ts lá), adaptado pro KyraOne (1 assinatura,
// sem categoria).
//
// Trial: todo cadastro novo nasce com status='trial' (trigger
// handle_new_user no Supabase), plano='kyraone_pro' e trial_fim = data de
// criação + 14 dias — libera o nível Pro completo (Cartões/Faturas/Metas)
// sem precisar de cartão/Pix. Quando trial_fim passa, calcularNivel()
// derruba pra "nenhum" só no client (o status no banco continua 'trial'
// até o usuário assinar de verdade ou o Asaas mudar o status).

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { buscarPlano, type PlanoId } from "./planos";

export type NivelAssinatura = "nenhum" | "controle" | "pro";

export type EstadoAssinatura = {
  loading: boolean;
  ehSuperadmin: boolean;
  plano: PlanoId | null;
  status: string | null; // 'trial' | 'pendente' | 'ativa' | 'inadimplente' | 'cancelada' | null (nunca assinou)
  trialFim: string | null; // ISO date, só relevante quando status === 'trial'
  nivel: NivelAssinatura;
};

const ESTADO_INICIAL: EstadoAssinatura = {
  loading: true,
  ehSuperadmin: false,
  plano: null,
  status: null,
  trialFim: null,
  nivel: "nenhum",
};

let estado: EstadoAssinatura = ESTADO_INICIAL;
let currentUserId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

function trialAtivo(trialFim: string | null): boolean {
  if (!trialFim) return false;
  return new Date(trialFim).getTime() > Date.now();
}

function calcularNivel(plano: PlanoId | null, status: string | null, trialFim: string | null): NivelAssinatura {
  if (status === "trial") {
    return trialAtivo(trialFim) ? "pro" : "nenhum";
  }
  if (status !== "ativa" || !plano) return "nenhum";
  const p = buscarPlano(plano);
  if (!p) return "nenhum";
  return p.nivel >= 2 ? "pro" : "controle";
}

async function carregar(forcar = false) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    estado = ESTADO_INICIAL;
    currentUserId = null;
    notify();
    return;
  }

  if (!forcar && currentUserId === user.id && !estado.loading) return;

  const [{ data: perfil }, { data: assinatura }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("assinaturas").select("plano, status, trial_fim").eq("profile_id", user.id).maybeSingle(),
  ]);

  const plano = (assinatura?.plano as PlanoId | undefined) ?? null;
  const status = (assinatura?.status as string | undefined) ?? null;
  const trialFim = (assinatura?.trial_fim as string | undefined) ?? null;

  estado = {
    loading: false,
    ehSuperadmin: perfil?.role === "admin",
    plano,
    status,
    trialFim,
    nivel: calcularNivel(plano, status, trialFim),
  };
  currentUserId = user.id;
  notify();
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    estado = ESTADO_INICIAL;
    currentUserId = null;
    notify();
  }
  if (event === "SIGNED_IN") {
    carregar(true);
  }
});

export function useAssinatura(): EstadoAssinatura {
  useEffect(() => {
    carregar();
  }, []);
  return useSyncExternalStore(subscribe, () => estado, () => ESTADO_INICIAL);
}

export function useRecarregarAssinatura(): () => Promise<void> {
  const [, setTick] = useState(0);
  return async () => {
    await carregar(true);
    setTick((t) => t + 1);
  };
}

// Superadmin (profiles.role='admin') sempre passa por qualquer gate — é o
// mesmo padrão do Quintalzim, e evita que o fundador fique trancado fora do
// próprio produto por causa de um webhook do Asaas que ainda não rodou.
export function podeAcessar(nivelExigido: NivelAssinatura, est: EstadoAssinatura): boolean {
  if (est.ehSuperadmin) return true;
  if (nivelExigido === "nenhum") return true;
  if (nivelExigido === "controle") return est.nivel === "controle" || est.nivel === "pro";
  return est.nivel === "pro";
}

export function nomeNivel(nivel: NivelAssinatura): string {
  if (nivel === "pro") return "Kyra One Pro";
  if (nivel === "controle") return "Kyra One Controle";
  return "nenhum plano";
}

// Dias restantes de trial (arredondado pra cima), ou null se não está em
// trial ativo. Usado nos banners de /assinar e /perfil.
export function diasRestantesTrial(est: EstadoAssinatura): number | null {
  if (est.status !== "trial" || !est.trialFim) return null;
  const ms = new Date(est.trialFim).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
