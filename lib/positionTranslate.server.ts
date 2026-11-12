import "server-only";

import {
  buildCertosModel,
  certosFeaturesForLabel,
  percentileInPool,
  rankCrossLeagueSimilarity,
  rawCertos,
} from "@/lib/crossLeagueSimilarity";
import {
  AT_ARCHETYPE_META,
  EX_ARCHETYPE_META,
  LAT_ARCHETYPE_META,
  MC_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
} from "@/lib/clusterMeta";
import { archetypeClusterSlug, profileAccent } from "@/lib/profileShares";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { getFamilyPlayers, getPlayerProfile } from "@/lib/data.server";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type PositionViewMetric = {
  /** "Cruzamentos · certos/90" — feature id do modelo. */
  label: string;
  /** Valor bruto por 90 do atleta (formato de exibição já truncado). */
  value: number;
  /** Percentil do valor dentro da pool da família alvo da própria liga. */
  percentile: number;
};

export type PositionViewSection = {
  title: string;
  items: PositionViewMetric[];
};

export type PositionViewSimilar = {
  name: string;
  club: string;
  profile: string;
  similarity: number;
};

/** Linha pronta para o SectionRadar (mesmo shape do relatório nativo). */
export type PositionViewScore = {
  title: string;
  tone: string;
  score: number;
  color?: string;
  display?: string;
};

export type PositionView = {
  family: PositionFamily;
  poolSize: number;
  /** Cobertura: fração das métricas da família alvo em que o atleta tem dado. */
  coverage: number;
  /** Perfil estimado dentro da família alvo (arquétipo dominante estimado). */
  estimatedProfile: string | null;
  /** Radar "Perfil estatístico" recalculado na pool da família alvo. */
  statScores: PositionViewScore[];
  /** Radar "Perfil": shares por arquétipo ponderados pelos mais parecidos. */
  profileScores: PositionViewScore[];
  sections: PositionViewSection[];
  similar: PositionViewSimilar[];
};

const FAMILY_LABEL: Record<PositionFamily, string> = {
  zagueiros: "zagueiros",
  laterais: "laterais",
  "meio-campistas": "meio-campistas",
  extremos: "extremos",
  atacantes: "atacantes",
};

/** Arquétipos da família (sem "Híbrido"), na ordem do meta. */
const FAMILY_ARCHETYPES: Record<PositionFamily, { archetype: string; tone: string }[]> = {
  zagueiros: ZAG_ARCHETYPE_META.map((m) => ({ archetype: m.archetype, tone: m.tone })),
  laterais: LAT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((m) => ({
    archetype: m.archetype,
    tone: m.tone,
  })),
  "meio-campistas": MC_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((m) => ({
    archetype: m.archetype,
    tone: m.tone,
  })),
  extremos: EX_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((m) => ({
    archetype: m.archetype,
    tone: m.tone,
  })),
  atacantes: AT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((m) => ({
    archetype: m.archetype,
    tone: m.tone,
  })),
};

/**
 * Tradução de posição: pontua o atleta contra a pool da família alvo na
 * própria liga dele — mesma régua do dossiê, família diferente. Métricas que
 * o dossiê dele não coleta simplesmente não aparecem (cobertura sinaliza).
 */
export function positionViewFor(
  playerId: string,
  league: LeagueId | undefined,
  targetFamily: PositionFamily,
): PositionView | null {
  const source = getPlayerProfile(playerId, league);
  if (!source || source.position_family === targetFamily) return null;
  const pool = getFamilyPlayers(targetFamily, league).filter(
    (player) => player.minutes >= 300,
  );
  if (pool.length < 10) return null;

  const { featureIds } = buildCertosModel(targetFamily, pool);
  if (!featureIds.length) return null;

  // Percentil de cada feature do atleta dentro da pool alvo + score por
  // seção (média — mesmo cálculo do radar "Perfil estatístico" nativo).
  const sections: PositionViewSection[] = [];
  const statScores: PositionViewScore[] = [];
  for (const section of statSectionsForFamily(targetFamily)) {
    const items: PositionViewMetric[] = [];
    for (const label of section.labels) {
      if (label === "Eficiência Defensiva") continue;
      for (const feature of certosFeaturesForLabel(source, label)) {
        const featureId = `${label} · ${feature.key}`;
        const poolValues = pool
          .map((player) => rawCertos(player, featureId))
          .filter((value): value is number => value != null);
        if (poolValues.length < 10) continue;
        items.push({
          label: featureId,
          value: feature.value,
          percentile: Math.round(percentileInPool(feature.value, poolValues)),
        });
      }
    }
    if (items.length) {
      const score = Math.round(items.reduce((sum, item) => sum + item.percentile, 0) / items.length);
      statScores.push({ title: section.title, tone: section.tone, score });
    }
    // As mais fortes primeiro — é a "nova perspectiva" que interessa.
    items.sort((a, b) => b.percentile - a.percentile);
    if (items.length) sections.push({ title: section.title, items: items.slice(0, 4) });
  }

  const covered = featureIds.filter((fid) => rawCertos(source, fid) != null).length;
  const sharesById = new Map(
    pool.map((player) => [player.player_id, player.cluster?.shares as Record<string, number> | undefined]),
  );
  const similar = rankCrossLeagueSimilarity(source, pool, {
    limit: 8,
    targetFamily,
    sourcePool: pool,
  }).map((hit) => ({
    name: hit.name,
    club: hit.club,
    profile: hit.profile,
    similarity: hit.similarity,
    shares: sharesById.get(hit.player_id),
  }));

  // Radar "Perfil": shares dos arquétipos da família alvo, ponderados pela
  // similaridade dos jogadores mais parecidos da pool.
  const archetypes = FAMILY_ARCHETYPES[targetFamily] ?? [];
  const weightSum = similar.reduce((sum, hit) => sum + Math.max(0, hit.similarity), 0);
  const shareRows = archetypes.map((meta) => {
    const slug = archetypeClusterSlug(meta.archetype);
    const weighted = slug
      ? similar.reduce(
          (sum, hit) => sum + (hit.shares?.[slug] ?? 0) * Math.max(0, hit.similarity),
          0,
        )
      : 0;
    return {
      archetype: meta.archetype,
      tone: meta.tone,
      share: weightSum > 0 ? weighted / weightSum : 0,
    };
  });
  const profileScores: PositionViewScore[] = shareRows
    .sort((a, b) => b.share - a.share)
    .map((row) => ({
      title: row.archetype,
      tone: row.tone,
      score: Math.round(row.share),
      color: profileAccent(row.archetype),
      display: `${Math.round(row.share)}%`,
    }));

  return {
    family: targetFamily,
    poolSize: pool.length,
    coverage: featureIds.length ? covered / featureIds.length : 0,
    estimatedProfile: profileScores[0]?.title ?? similar[0]?.profile ?? null,
    statScores,
    profileScores,
    sections,
    similar: similar.map(({ shares: _shares, ...hit }) => hit),
  };
}

export function familyLabel(family: PositionFamily): string {
  return FAMILY_LABEL[family] ?? family;
}
