import type { CSSProperties } from "react";

/**
 * Single source of truth for every performance colour on the scout pages.
 * Grades, ratings and percentiles all resolve to the same five tiers so the
 * palette stays consistent no matter which metric is being rendered.
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export type TierToken = {
  tier: Tier;
  label: string;
  color: string;
  soft: string;
  border: string;
  glow: string;
};

export const TIERS: Record<Tier, TierToken> = {
  5: {
    tier: 5,
    label: "Elite",
    color: "#31e981",
    soft: "rgba(49, 233, 129, 0.12)",
    border: "rgba(49, 233, 129, 0.38)",
    glow: "rgba(49, 233, 129, 0.22)",
  },
  4: {
    tier: 4,
    label: "Alto",
    color: "#9bec6f",
    soft: "rgba(155, 236, 111, 0.12)",
    border: "rgba(155, 236, 111, 0.34)",
    glow: "rgba(155, 236, 111, 0.2)",
  },
  3: {
    tier: 3,
    label: "Médio",
    color: "#fed766",
    soft: "rgba(254, 215, 102, 0.12)",
    border: "rgba(254, 215, 102, 0.34)",
    glow: "rgba(254, 215, 102, 0.2)",
  },
  2: {
    tier: 2,
    label: "Baixo",
    color: "#fe9b52",
    soft: "rgba(254, 155, 82, 0.12)",
    border: "rgba(254, 155, 82, 0.32)",
    glow: "rgba(254, 155, 82, 0.18)",
  },
  1: {
    tier: 1,
    label: "Crítico",
    color: "#fe4a49",
    soft: "rgba(254, 74, 73, 0.12)",
    border: "rgba(254, 74, 73, 0.32)",
    glow: "rgba(254, 74, 73, 0.18)",
  },
};

/** Maps a 0-100 performance score to a tier. */
export function tierFromScore(score: number): TierToken {
  if (score >= 85) return TIERS[5];
  if (score >= 68) return TIERS[4];
  if (score >= 48) return TIERS[3];
  if (score >= 28) return TIERS[2];
  return TIERS[1];
}

/** Letter grades emitted by the data pipeline, expressed on the 0-100 scale. */
const GRADE_SCORE: Record<string, number> = {
  "A+": 97,
  A: 92,
  "A-": 87,
  "B+": 80,
  B: 70,
  "B-": 60,
  "C+": 50,
  C: 40,
  "C-": 30,
  "D+": 22,
  D: 15,
  "D-": 10,
  E: 6,
  F: 2,
};

export function normalizeGrade(grade: string): string {
  return grade.trim().toUpperCase().replace("−", "-").replace("–", "-");
}

export function gradeScore(grade: string): number {
  return GRADE_SCORE[normalizeGrade(grade)] ?? 40;
}

export function gradeTier(grade: string): TierToken {
  return tierFromScore(gradeScore(grade));
}

export function ratingTier(rating: number, max = 10): TierToken {
  return tierFromScore((rating / max) * 100);
}

export function percentileTier(value: number): TierToken {
  return tierFromScore(value);
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Pastel red → dark-green stops for stat bars (sampled at percentile). */
const STAT_BAR_STOPS: { p: number; r: number; g: number; b: number }[] = [
  { p: 0, r: 245, g: 168, b: 168 },
  { p: 50, r: 239, g: 229, b: 176 },
  { p: 100, r: 22, g: 101, b: 52 },
];

/** Blue → red spectrum for construction / defensive profile bars. */
export const SPECTRUM_BAR_GRADIENT =
  "linear-gradient(90deg, #4a8fd8 0%, #9e6bb8 50%, #d95555 100%)";

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function sampleStatBarRgb(pct: number): [number, number, number] {
  const value = clampPercent(pct);
  for (let i = 0; i < STAT_BAR_STOPS.length - 1; i += 1) {
    const left = STAT_BAR_STOPS[i];
    const right = STAT_BAR_STOPS[i + 1];
    if (value <= right.p) {
      const span = right.p - left.p || 1;
      const t = (value - left.p) / span;
      return [
        lerpChannel(left.r, right.r, t),
        lerpChannel(left.g, right.g, t),
        lerpChannel(left.b, right.b, t),
      ];
    }
  }
  const last = STAT_BAR_STOPS[STAT_BAR_STOPS.length - 1];
  return [last.r, last.g, last.b];
}

/** Pastel tint of the gradient colour at a given percentile. */
export function statBarPastelColor(pct: number, mix = 0.42): string {
  const [r, g, b] = sampleStatBarRgb(pct);
  const pr = Math.round(r + (255 - r) * mix);
  const pg = Math.round(g + (255 - g) * mix);
  const pb = Math.round(b + (255 - b) * mix);
  return `rgb(${pr}, ${pg}, ${pb})`;
}

/** Rating colour on a red → green scale (5–10), green reads clearly from ~7.5. */
export function ratingGradientColor(rating: number, max = 10): string {
  const t = clampPercent(((rating - 5) / (max - 5)) * 100) / 100;
  let hue: number;
  if (t >= 0.5) {
    hue = lerpChannel(115, 145, (t - 0.5) / 0.5);
  } else if (t >= 0.2) {
    hue = lerpChannel(15, 115, (t - 0.2) / 0.3);
  } else {
    hue = lerpChannel(4, 15, t / 0.2);
  }
  const saturation = t >= 0.5 ? lerpChannel(48, 56, (t - 0.5) / 0.5) : lerpChannel(72, 48, t / 0.5);
  const lightness = t >= 0.5 ? lerpChannel(46, 42, (t - 0.5) / 0.5) : lerpChannel(58, 46, t / 0.5);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function ratingGradientStyle(rating: number, max = 10): CSSProperties {
  const color = ratingGradientColor(rating, max);
  return {
    color,
    ["--rating-accent" as string]: color,
    ["--tier-color" as string]: color,
    ["--rating-glow" as string]: `color-mix(in srgb, ${color} 35%, transparent)`,
  };
}

export function percentileBarFillStyle(pct: number): CSSProperties {
  const color = statBarPastelColor(pct);
  return {
    width: `${clampPercent(pct)}%`,
    background: color,
    ["--stat-bar-accent" as string]: color,
  };
}

export function statValueStyle(pct: number): CSSProperties {
  const color = statBarPastelColor(pct, 0.28);
  return { color, ["--stat-bar-accent" as string]: color };
}

/** Inline CSS custom properties so a component can theme itself from a tier. */
export function tierVars(token: TierToken): CSSProperties {
  return {
    ["--tier-color" as string]: token.color,
    ["--tier-soft" as string]: token.soft,
    ["--tier-border" as string]: token.border,
    ["--tier-glow" as string]: token.glow,
  };
}

export function ratingToLetterGrade(rating: number, max = 10): string {
  const score = (rating / max) * 100;
  if (score >= 82) return "A";
  if (score >= 74) return "B+";
  if (score >= 66) return "B";
  if (score >= 58) return "B-";
  if (score >= 50) return "C+";
  if (score >= 42) return "C";
  if (score >= 34) return "C-";
  return "D";
}

/** Scouting grades A+ → D, cut on the peer pool percentile. D carries no sign. */
const PROFILE_GRADE_CUTS: { min: number; grade: string }[] = [
  { min: 98, grade: "A+" },
  { min: 93, grade: "A" },
  { min: 86, grade: "A-" },
  { min: 76, grade: "B+" },
  { min: 64, grade: "B" },
  { min: 52, grade: "B-" },
  { min: 40, grade: "C+" },
  { min: 28, grade: "C" },
  { min: 16, grade: "C-" },
];

export function profileGradeFromRank(rank: number, poolSize: number): string | null {
  if (!poolSize || rank < 1) return null;
  const pct = rankPercentile(rank, poolSize);
  for (const cut of PROFILE_GRADE_CUTS) {
    if (pct >= cut.min) return cut.grade;
  }
  return "D";
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function playerInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Medals come from rank percentile buckets in the pipeline, not literal podium places. */
export const MEDAL_META = {
  gold: { label: "Top 10%", short: "Top 10", tone: "Ouro" },
  silver: { label: "Top 25%", short: "Top 25", tone: "Prata" },
  bronze: { label: "Acima de P50", short: "P50+", tone: "Bronze" },
} as const;

export type MedalKind = keyof typeof MEDAL_META;

export function rankPercentile(rank: number, poolSize: number): number {
  if (!poolSize) return 0;
  return clampPercent(((poolSize - rank) / poolSize) * 100);
}

export const TENDENCY_META = [
  {
    key: "contencao",
    short: "CNT",
    compact: "Contenção",
    label: "Contenção",
    hint: "Leitura e cobertura defensiva",
  },
  {
    key: "def1v1",
    short: "1V1",
    compact: "1v1 Def.",
    label: "1vs1 defensivo",
    hint: "Eficiência em duelos individuais",
  },
  {
    key: "duelo_aereo",
    short: "ARE",
    compact: "Aéreo",
    label: "Duelo aéreo",
    hint: "Domínio nas disputas pelo alto",
  },
  {
    key: "construcao",
    short: "CNS",
    compact: "Construção",
    label: "Construção",
    hint: "Saída e progressão de bola",
  },
  {
    key: "ofensividade",
    short: "OFE",
    compact: "Ofensivo",
    label: "Ofensividade",
    hint: "Impacto no terço ofensivo",
  },
] as const;
