import type { PositionFamily } from "./types";

/**
 * Valor SADA — modelo próprio de precificação por produção.
 *
 * ln(V) = 11.975 + liga + rating + idade + 0.321·ln(min) + posição + perfil
 *         + 0.231·contrato + 0.532·jogouA + reputação(caps/exterior)
 *
 * Coeficientes calibrados por regressão log-linear sobre o valor de mercado
 * Transfermarkt (R²≈0.69, jogadores ≥600 min, A/B/C). O valor TM **não** entra
 * como insumo — é a referência externa contra a qual o modelo é comparado.
 */

export type ValorSide = "acima" | "neutro" | "abaixo" | "sem_tm";

export type ValorFactors = {
  league: number;
  rating: number;
  age: number;
  minutes: number;
  position: number;
  profile: number;
  contract: number;
  career: number;
  reputation: number;
};

export type ValorPlayer = {
  playerId: string;
  athleteId: string | null;
  name: string;
  club: string;
  position: string;
  positionFamily: PositionFamily | null;
  profile: string | null;
  age: number | null;
  rating: number;
  minutes: number;
  photo: string | null;
  /** Jogos de seleção principal (perfil TM). null = perfil não verificado. */
  caps: number | null;
  capsTeam: string | null;
  contractUntil: string | null;
  /** Anos restantes de contrato na data-base do modelo. */
  contractYears: number | null;
  /** Veio do exterior na última movimentação registrada (clube de origem fora do BR). */
  exAbroad: string | null;
  /** Jogou Série A em temporada anterior (só fora da A). */
  playedSerieA: boolean;
  /** Valor de mercado Transfermarkt em € (referência — não alimenta o modelo). */
  marketValueEur: number | null;
  /** Estimativa SADA em €. */
  sadaValue: number;
  /** sadaValue / marketValueEur (>1 = mercado abaixo da produção). */
  ratio: number | null;
  side: ValorSide;
  factors: ValorFactors;
};

export type ValorSummary = {
  total: number;
  comTm: number;
  acima: number;
  abaixo: number;
  medianSada: number;
};

export const VALOR_BASE = 11.975;

/** Efeito da liga vs Série A (B/C medidos; D/estaduais extrapolados pela mediana observada). */
export const LEAGUE_COEF: Record<string, number> = {
  "serie-a": 0,
  "serie-b": -1.471,
  "serie-c": -2.451,
  "serie-d": -3.1,
  "est-nv1": -2.9,
  "est-nv2": -3.2,
  "est-nv3": -3.5,
  "est-nv4": -3.8,
};

/** Efeito por família posicional (referência: extremos). */
export const POSITION_COEF: Record<string, number> = {
  extremos: 0,
  atacantes: 0.184,
  "meio-campistas": -0.045,
  laterais: -0.275,
  zagueiros: -0.309,
};

/** Perfis que o mercado paga prêmio dentro de cada família (+0.10). */
export const PROFILE_PREMIUM: Record<string, ReadonlySet<string>> = {
  zagueiros: new Set(["Construtor"]),
  laterais: new Set(["Ofensivo", "Híbrido"]),
  "meio-campistas": new Set(["Construtor", "Box-to-box", "Híbrido"]),
  extremos: new Set(["Híbrido", "Meia Ponta", "Driblador"]),
  atacantes: new Set(["Finalizador", "Móvel"]),
};

/** Perfis descontados dentro de cada família (−0.10). */
export const PROFILE_DISCOUNT: Record<string, ReadonlySet<string>> = {
  zagueiros: new Set(["Defensor de Área"]),
  laterais: new Set(["Construtor"]),
  "meio-campistas": new Set(["Contenção"]),
  extremos: new Set(["Ruptura"]),
  atacantes: new Set(["Alvo", "Híbrido"]),
};

export const CONTRACT_STEP = 0.231;
export const PLAYED_A_COEF = 0.532;
export const CAPS_COEF = 0.28;
export const ABROAD_COEF = 0.4;

/** Formata valor em € estilo TM: 38M€ / 400mil€ / 50mil€. */
export function formatEur(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M€`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}mil€`;
  return `${Math.round(value / 1_000)}mil€`;
}
