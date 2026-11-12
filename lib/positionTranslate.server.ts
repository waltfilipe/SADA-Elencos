import "server-only";

import {
  buildCertosModel,
  certosFeaturesForLabel,
  percentileInPool,
  rankCrossLeagueSimilarity,
  rawCertos,
} from "@/lib/crossLeagueSimilarity";
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

export type PositionView = {
  family: PositionFamily;
  poolSize: number;
  /** Cobertura: fração das métricas da família alvo em que o atleta tem dado. */
  coverage: number;
  /** Perfil estimado dentro da família alvo (perfil do mais parecido). */
  estimatedProfile: string | null;
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

  // Percentil de cada feature do atleta dentro da pool alvo.
  const sections: PositionViewSection[] = [];
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
    // As mais fortes primeiro — é a "nova perspectiva" que interessa.
    items.sort((a, b) => b.percentile - a.percentile);
    if (items.length) sections.push({ title: section.title, items: items.slice(0, 4) });
  }

  const covered = featureIds.filter((fid) => rawCertos(source, fid) != null).length;
  const similar = rankCrossLeagueSimilarity(source, pool, {
    limit: 3,
    targetFamily,
    sourcePool: pool,
  }).map((hit) => ({
    name: hit.name,
    club: hit.club,
    profile: hit.profile,
    similarity: hit.similarity,
  }));

  return {
    family: targetFamily,
    poolSize: pool.length,
    coverage: featureIds.length ? covered / featureIds.length : 0,
    estimatedProfile: similar[0]?.profile ?? null,
    sections,
    similar,
  };
}

export function familyLabel(family: PositionFamily): string {
  return FAMILY_LABEL[family] ?? family;
}
