import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { aspectQualityPercentile, aspectQuantityPercentile } from "@/lib/aspectGrades";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function averageDefined(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return undefined;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

const SECTION_VOL_WEIGHT = 0.4;
const SECTION_EFF_WEIGHT = 0.6;

function blendVolEff(volume: number | undefined, efficiency: number | undefined): number | undefined {
  if (volume != null && efficiency != null) {
    return SECTION_VOL_WEIGHT * volume + SECTION_EFF_WEIGHT * efficiency;
  }
  return volume ?? efficiency;
}

/** 40% volume + 60% efficiency when both exist; otherwise whichever is available. */
function volEffScore(item: AspectItem): number | undefined {
  return blendVolEff(num(item.percentile), num(item.efficiency_pct));
}

function defActionsGroupScore(item: AspectItem): number | undefined {
  const subs = item.sub_metrics ?? [];
  const pick = (label: string) => num(subs.find((row) => row.label === label)?.percentile);
  return averageDefined([pick("Rebatidas"), pick("Interceptações"), pick("Chutes Bloqueados"), pick("Recuperações")]);
}

function defEfficiencyGroupScore(item: AspectItem): number | undefined {
  const subs = item.sub_metrics ?? [];
  const pick = (...labels: string[]) => num(subs.find((row) => labels.includes(row.label))?.percentile);
  return averageDefined([
    pick("Erros Totais"),
    pick("Ações sem Bola/90"),
    pick("Índice de Eficiência", "Eficiência Defensiva"),
  ]);
}

function metricGroupScore(item: AspectItem): number | undefined {
  const subs = item.sub_metrics ?? [];
  if (!subs.length) return num(item.percentile);

  if (item.label === "Cruzamentos") {
    const vol = subs.find((row) => row.label === "Cruzamentos");
    const eff = subs.find((row) => row.label === "Eficiência");
    return blendVolEff(num(vol?.percentile), num(eff?.percentile));
  }

  if (item.label === "Finalizações") {
    const vol = subs.find((row) => row.label === "Finalizações");
    const xg = subs.find((row) => row.label === "xG");
    return blendVolEff(num(vol?.percentile), num(xg?.percentile));
  }

  if (item.label === "Progressão" || item.label === "Pré Assistências e xA") {
    return num(item.percentile) ?? averageDefined(subs.map((row) => num(row.percentile)));
  }

  return averageDefined(subs.map((row) => num(row.percentile)));
}

function blockQuantityScore(item: AspectItem | undefined): number | undefined {
  if (!item) return undefined;
  return aspectQuantityPercentile(item);
}

function blockQualityScore(item: AspectItem | undefined): number | undefined {
  if (!item) return undefined;
  return aspectQualityPercentile(item);
}

function blockScore(item: AspectItem | undefined): number | undefined {
  if (!item) return undefined;
  if (item.kind === "def_efficiency_group") return defEfficiencyGroupScore(item);
  if (item.kind === "metric_group") {
    if (item.label.startsWith("Ações Defensivas")) return defActionsGroupScore(item);
    return metricGroupScore(item);
  }
  if (item.kind === "pass_certos" || item.kind === "metric" || !item.kind) return volEffScore(item);
  return num(item.percentile);
}

/** Optional per-block weights when averaging a section letter (default 1). */
const SECTION_BLOCK_WEIGHTS: Partial<
  Record<PositionFamily, Partial<Record<string, Partial<Record<string, number>>>>>
> = {
  laterais: {
    Passes: {
      Distribuição: 0.35,
    },
  },
  "meio-campistas": {
    Passes: {
      Distribuição: 0.35,
    },
  },
  extremos: {
    Passes: {
      Distribuição: 0.35,
    },
  },
};

/** Block labels per section — used for composite section score. */
const SECTION_BLOCK_LABELS: Partial<Record<PositionFamily, Record<string, string[]>>> = {
  zagueiros: {
    Defensivos: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva"],
    Aéreo: ["Aéreo"],
    Passes: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
    "Dribles e Condução": ["Disputas com Bola", "Conduções Progressivas"],
  },
  laterais: {
    Defensivos: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva", "Duelos Aéreos"],
    Passes: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    "Dribles e Condução": ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
    "Passes Finais": ["Cruzamentos", "Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
    Ofensividade: ["Ofensividade"],
  },
  "meio-campistas": {
    Defensivos: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva", "Duelos Aéreos"],
    Passes: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    "Dribles e Condução": ["Disputas com Bola", "1v1 - Ofensivo", "Conduções Progressivas"],
    "Passes Finais": ["Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
    Ofensividade: ["Finalizações", "Ofensividade"],
  },
  extremos: {
    Passes: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    "Passes Finais": ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
    "Condução e Drible": ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
    Finalização: ["Gols e xG", "Finalizações"],
    Ofensividade: ["Ações Terminais", "Verticalidade"],
    Defensivos: ["Duelos Vencidos", "Ações Defensivas", "Recuperações"],
  },
  atacantes: {
    "Duelos Aéreos": ["Duelos Aéreos"],
    Passes: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
    "Passes Finais": ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
    "Condução e Drible": ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
    Finalização: ["Gols e xG", "Finalizações"],
    Ofensividade: ["Ações Terminais", "Verticalidade"],
  },
};

export type SectionGradeTriple = {
  geral: string;
  quantidade: string;
  qualidade: string;
};

export type SectionGradeLookup = Map<string, Record<string, SectionGradeTriple>>;

type SectionAxis = "geral" | "quantidade" | "qualidade";

function playerSectionAxisScore(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
  axis: SectionAxis,
): number | undefined {
  const blockLabels = SECTION_BLOCK_LABELS[family]?.[sectionTitle];
  if (!blockLabels?.length) return undefined;

  const all = flattenAspects(player);
  const weights = SECTION_BLOCK_WEIGHTS[family]?.[sectionTitle] ?? {};
  const scoreFn =
    axis === "quantidade"
      ? blockQuantityScore
      : axis === "qualidade"
        ? blockQualityScore
        : blockScore;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const label of blockLabels) {
    const score = scoreFn(findAspect(all, label));
    if (score == null) continue;
    const weight = weights[label] ?? 1;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (!totalWeight) return undefined;
  return weightedSum / totalWeight;
}

export function playerSectionScore(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
): number | undefined {
  return playerSectionAxisScore(player, family, sectionTitle, "geral");
}

function axisScoresForSection(
  players: PlayerProfile[],
  family: PositionFamily,
  sectionTitle: string,
  axis: SectionAxis,
): { id: string; score: number }[] {
  return players
    .map((player) => ({
      id: player.player_id,
      score: playerSectionAxisScore(player, family, sectionTitle, axis),
    }))
    .filter((entry): entry is { id: string; score: number } => entry.score != null);
}

function letterFromAxisPool(scored: { id: string; score: number }[]): Map<string, string> {
  const allScores = scored.map((entry) => entry.score);
  const letters = new Map<string, string>();
  for (const { id, score } of scored) {
    const pct = poolPercentileRank(allScores, score);
    letters.set(id, letterFromPoolPercentile(pct));
  }
  return letters;
}

/** Percentile rank within a pool (100 = best, 0 = worst). Ties use average rank. */
export function poolPercentileRank(scores: number[], value: number): number {
  if (!scores.length) return 0;
  if (scores.length === 1) return 100;
  const less = scores.filter((score) => score < value).length;
  const equal = scores.filter((score) => score === value).length;
  const avgRank = less + (equal + 1) / 2;
  return ((avgRank - 1) / (scores.length - 1)) * 100;
}

/** Letter from pool percentile — compressed scale for more homogeneous grades. */
export function letterFromPoolPercentile(pct: number): string {
  if (pct >= 85) return "A";
  if (pct >= 72) return "B+";
  if (pct >= 58) return "B";
  if (pct >= 45) return "B-";
  if (pct >= 32) return "C+";
  if (pct >= 20) return "C";
  if (pct >= 10) return "C-";
  return "D";
}

/** @deprecated pipeline-style thresholds without A+ */
export function letterFromPercentile(pct: number): string {
  if (pct >= 85) return "A";
  if (pct >= 75) return "B+";
  if (pct >= 65) return "B";
  if (pct >= 55) return "B-";
  if (pct >= 45) return "C+";
  if (pct >= 35) return "C";
  if (pct >= 25) return "C-";
  return "D";
}

export function letterFromRating(rating: number, max = 10): string {
  return letterFromPoolPercentile((rating / max) * 100);
}

export function buildSectionGradeLookup(
  players: PlayerProfile[],
  family: PositionFamily,
): SectionGradeLookup {
  const lookup: SectionGradeLookup = new Map();
  const sections = statSectionsForFamily(family);

  for (const section of sections) {
    const geralLetters = letterFromAxisPool(axisScoresForSection(players, family, section.title, "geral"));
    const qtyLetters = letterFromAxisPool(axisScoresForSection(players, family, section.title, "quantidade"));
    const qualLetters = letterFromAxisPool(axisScoresForSection(players, family, section.title, "qualidade"));

    const ids = new Set([...geralLetters.keys(), ...qtyLetters.keys(), ...qualLetters.keys()]);
    for (const id of ids) {
      const geral = geralLetters.get(id);
      const quantidade = qtyLetters.get(id);
      const qualidade = qualLetters.get(id);
      if (!geral && !quantidade && !qualidade) continue;
      const existing = lookup.get(id) ?? {};
      existing[section.title] = {
        geral: geral ?? quantidade ?? qualidade ?? "D",
        quantidade: quantidade ?? geral ?? "D",
        qualidade: qualidade ?? geral ?? "D",
      };
      lookup.set(id, existing);
    }
  }

  return lookup;
}

export function getPlayerSectionGrades(
  lookup: SectionGradeLookup,
  playerId: string,
  sectionTitle: string,
): SectionGradeTriple | undefined {
  return lookup.get(playerId)?.[sectionTitle];
}

export function getPlayerSectionGrade(
  lookup: SectionGradeLookup,
  playerId: string,
  sectionTitle: string,
): string | undefined {
  return getPlayerSectionGrades(lookup, playerId, sectionTitle)?.geral;
}

export function playerSectionGrade(
  player: PlayerProfile,
  family: PositionFamily,
  sectionTitle: string,
  pool: PlayerProfile[],
): string | undefined {
  const lookup = buildSectionGradeLookup(pool, family);
  return getPlayerSectionGrade(lookup, player.player_id, sectionTitle);
}

export function allSectionGrades(
  lookup: SectionGradeLookup,
  playerId: string,
  family: PositionFamily,
): Record<string, SectionGradeTriple | undefined> {
  const sections = statSectionsForFamily(family);
  return Object.fromEntries(
    sections.map((section) => [section.title, getPlayerSectionGrades(lookup, playerId, section.title)]),
  );
}
