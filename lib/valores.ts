import type { PositionFamily } from "./types";

/**
 * Valor SADA v4 — "espelho de mercado".
 *
 * ln(V) = 11.644 + liga + rating(rd,rd²) + idade(faixas) + 0.296·ln(min)
 *         + posição + perfil(por família) + contrato + jogouA
 *         + reputação(caps/exterior) + vitrine(G12)
 *
 * OLS unificado sobre ln(TM) — 881 jogadores ≥400 min das séries A/B/C com
 * valor TM (R²≈0.67). Coeficientes gerados por
 * sada-test/scripts/calibrate_valor_v4.py. O valor TM **não** entra como
 * insumo — é a referência externa contra a qual o modelo é comparado.
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
  /** Prêmio de vitrine — clube do G12. */
  club: number;
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
  /**
   * Probabilidade de "salto" (divisão acima ou exterior) na próxima
   * temporada — modelo logístico treinado em A/B/C 2022–2024 (AUC 0,65).
   * 0–100; null para posições fora das famílias de campo.
   */
  resaleScore: number | null;
  factors: ValorFactors;
};

export type ResaleModel = {
  version: string;
  auc: number;
  base_rate: number;
  coef: Record<string, number>;
  upsider_profiles: string[];
};

export type ValorSummary = {
  total: number;
  comTm: number;
  acima: number;
  abaixo: number;
  medianSada: number;
};

export const VALOR_BASE = 11.644;

/**
 * Efeito da liga vs Série A. B/C medidos no OLS unificado v4;
 * D/estaduais extrapolados mantendo os offsets abaixo da C.
 */
export const LEAGUE_COEF: Record<string, number> = {
  "serie-a": 0,
  "serie-b": -1.451,
  "serie-c": -1.684,
  "serie-d": -2.3,
  "est-nv1": -2.1,
  "est-nv2": -2.4,
  "est-nv3": -2.7,
  "est-nv4": -3.0,
};

/** Efeito por família posicional — base: zagueiros (0). Medido v4. */
export const POSITION_COEF: Record<string, number> = {
  zagueiros: 0,
  laterais: 0.238,
  "meio-campistas": 0.275,
  extremos: 0.494,
  atacantes: 0.513,
};

/**
 * Coeficiente por perfil dentro da família — base = perfil mais frequente
 * (Defensor de Área, Ofensivo, Contenção, Driblador, Alvo). Medido v4.
 */
export const PROFILE_COEF: Record<string, Record<string, number>> = {
  zagueiros: { Construtor: 0.335, Combativo: 0.092 },
  laterais: { Construtor: 0.14, Híbrido: 0.04, Defensivo: -0.262 },
  "meio-campistas": { Construtor: 0.236, "Box-to-box": 0.229, Híbrido: 0.134 },
  extremos: { "Meia Ponta": 0.112, Ruptura: 0.014, Híbrido: -0.042 },
  atacantes: { Finalizador: 0.348, Móvel: 0.043, Híbrido: -0.363 },
};

/** Faixas de idade — base: 26–28 anos (0). Medido v4. */
export function ageTerm(age: number | null): number {
  if (age == null) return 0;
  if (age < 21) return -0.026;
  if (age < 23) return -0.056;
  if (age < 26) return 0.105;
  if (age < 29) return 0;
  return -0.594;
}

/** Restante de contrato → termo (anos restantes). Medido v4. */
export function contractTerm(years: number | null): number {
  if (years == null) return -0.229; // sem registro — desconto medido
  if (years < 1) return 0;
  if (years < 2) return 0.261;
  if (years < 3.5) return 0.634;
  return 0.988;
}

export const PLAYED_A_COEF = 0.391;
export const CAPS_COEF = 0.098;
export const ABROAD_COEF = 0.406;
export const ABROAD_OTHER_COEF = 0.209;
export const G12_COEF = 0.468;

/** Clubes do G12 (normalizados por normClub) — efeito vitrine do mercado. */
export const G12_CLUBS: ReadonlySet<string> = new Set([
  "flamengo",
  "palmeiras",
  "corinthians",
  "saopaulo",
  "santos",
  "gremio",
  "internacional",
  "atleticomg",
  "fluminense",
  "botafogofr",
  "vasco",
  "cruzeiro",
]);

/** Formata valor em € estilo TM: 38M€ / 400mil€ / 50mil€. */
export function formatEur(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M€`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}mil€`;
  return `${Math.round(value / 1_000)}mil€`;
}
