"use client";

import { useMemo } from "react";

import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";
import {
  AT_ARCHETYPE_META,
  EX_ARCHETYPE_META,
  LAT_ARCHETYPE_META,
  MC_ARCHETYPE_META,
  ZAG_ARCHETYPE_META,
  archetypeTone,
  atArchetypeTone,
  exArchetypeTone,
  isAtCluster,
  isExCluster,
  isLatCluster,
  isMcCluster,
  latArchetypeTone,
  mcArchetypeTone,
  type AtArchetype,
  type ExArchetype,
  type LatArchetype,
  type McArchetype,
  type PositionCluster,
  type ZagArchetype,
} from "@/lib/clusterMeta";
import { ArchetypeTooltip } from "./ArchetypeTooltip";

type Props = {
  cluster: PositionCluster;
};

type MixRow = {
  key: string;
  label: string;
  tone: string;
  share: number;
  rating: number;
  tooltipArchetype?: ZagArchetype | LatArchetype | McArchetype | ExArchetype | AtArchetype;
};

function buildRows(cluster: PositionCluster): MixRow[] {
  if (isLatCluster(cluster)) {
    const shareMap: Record<LatArchetype, number | undefined> = {
      Defensivo: cluster.shares.defensivo,
      Construtor: cluster.shares.construtor,
      Ofensivo: cluster.shares.ofensivo,
      Híbrido: undefined,
    };
    const ratingMap: Record<Exclude<LatArchetype, "Híbrido">, number> = {
      Defensivo: cluster.ratings.defensivo,
      Construtor: cluster.ratings.construtor,
      Ofensivo: cluster.ratings.ofensivo,
    };
    return LAT_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      share: shareMap[item.archetype] ?? 0,
      rating: ratingMap[item.archetype as Exclude<LatArchetype, "Híbrido">],
      tooltipArchetype: item.archetype,
    }));
  }

  if (isMcCluster(cluster)) {
    const shareMap: Record<McArchetype, number | undefined> = {
      Contenção: cluster.shares.contencao,
      Construtor: cluster.shares.construtor,
      "Box-to-box": cluster.shares.boxtobox,
      Híbrido: undefined,
    };
    const ratingMap: Record<Exclude<McArchetype, "Híbrido">, number> = {
      Contenção: cluster.ratings.contencao,
      Construtor: cluster.ratings.construtor,
      "Box-to-box": cluster.ratings.boxtobox,
    };
    return MC_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: mcArchetypeTone(item.archetype),
      share: shareMap[item.archetype] ?? 0,
      rating: ratingMap[item.archetype as Exclude<McArchetype, "Híbrido">],
      tooltipArchetype: item.archetype,
    }));
  }

  if (isExCluster(cluster)) {
    const shareMap: Record<ExArchetype, number | undefined> = {
      Driblador: cluster.shares.driblador,
      "Meia Ponta": cluster.shares.meia_ponta,
      Ruptura: cluster.shares.ruptura,
      Híbrido: undefined,
    };
    const ratingMap: Record<Exclude<ExArchetype, "Híbrido">, number> = {
      Driblador: cluster.ratings.driblador,
      "Meia Ponta": cluster.ratings.meia_ponta,
      Ruptura: cluster.ratings.ruptura,
    };
    return EX_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: exArchetypeTone(item.archetype),
      share: shareMap[item.archetype] ?? 0,
      rating: ratingMap[item.archetype as Exclude<ExArchetype, "Híbrido">],
      tooltipArchetype: item.archetype,
    }));
  }

  if (isAtCluster(cluster)) {
    const shareMap: Record<AtArchetype, number | undefined> = {
      Finalizador: cluster.shares.finalizador,
      Alvo: cluster.shares.alvo,
      Móvel: cluster.shares.movel,
      Híbrido: undefined,
    };
    const ratingMap: Record<Exclude<AtArchetype, "Híbrido">, number> = {
      Finalizador: cluster.ratings.finalizador,
      Alvo: cluster.ratings.alvo,
      Móvel: cluster.ratings.movel,
    };
    return AT_ARCHETYPE_META.filter((item) => item.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: atArchetypeTone(item.archetype),
      share: shareMap[item.archetype] ?? 0,
      rating: ratingMap[item.archetype as Exclude<AtArchetype, "Híbrido">],
      tooltipArchetype: item.archetype,
    }));
  }

  const shareMap = {
    "Defensor de Área": cluster.shares.defensor_area,
    Construtor: cluster.shares.construtor,
    Combativo: cluster.shares.combativo,
  };
  const ratingMap = {
    "Defensor de Área": cluster.ratings.defensor_area,
    Construtor: cluster.ratings.construtor,
    Combativo: cluster.ratings.combativo,
  };
  return ZAG_ARCHETYPE_META.map((item) => ({
    key: item.archetype,
    label: item.archetype,
    tone: archetypeTone(item.archetype),
    share: shareMap[item.archetype],
    rating: ratingMap[item.archetype],
    tooltipArchetype: item.archetype,
  }));
}

export function ArchetypeMixCard({ cluster }: Props) {
  const rows = useMemo(() => buildRows(cluster), [cluster]);
  const activeKey = cluster.archetype === "Híbrido" ? null : cluster.archetype;

  const orderedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.key === activeKey) return -1;
        if (b.key === activeKey) return 1;
        return b.share - a.share;
      }),
    [rows, activeKey],
  );

  return (
    <article className="archetype-mix-card" aria-label="Perfil do atleta">
      <header className="archetype-mix-head">
        <h3>Perfil do Atleta</h3>
      </header>

      <ul className="archetype-mix-rows">
        {orderedRows.map((item) => {
          const active = item.key === activeKey;
          const token = ratingTier(item.rating);

          return (
            <li key={item.key} className="archetype-mix-item">
              <ArchetypeTooltip archetype={item.tooltipArchetype!} cluster={cluster} block>
                <div
                  className={`archetype-mix-row cluster-${item.tone} ${active ? "active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <span className={`archetype-mix-name cluster-${item.tone}`}>{item.label}</span>
                  <span className="archetype-mix-share">{Math.round(item.share)}%</span>
                  <span className="archetype-mix-rating" style={tierVars(token)}>
                    Rating <strong>{formatRating(item.rating)}</strong>
                  </span>
                </div>
              </ArchetypeTooltip>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const ZAG_ARCHETYPES = new Set<string>(["Defensor de Área", "Construtor", "Combativo"]);
const LAT_ARCHETYPES = new Set<string>(["Defensivo", "Construtor", "Ofensivo", "Híbrido"]);
const MC_ARCHETYPES = new Set<string>(["Contenção", "Construtor", "Box-to-box", "Híbrido"]);
const LAT_HYBRID_BADGES = new Set<string>(["Lateral Base", "Lateral Moderno", "Lateral Projetivo", "Lateral Completo"]);
const MC_HYBRID_BADGES = new Set<string>(["Volante Base", "MC Combativo", "MC Projetivo", "MC Completo"]);
const EX_ARCHETYPES = new Set<string>(["Driblador", "Meia Ponta", "Ruptura", "Híbrido"]);
const EX_HYBRID_BADGES = new Set<string>(["Ala Criativa", "Ala Direta", "Ala Projetiva", "Ala Completa"]);
const AT_ARCHETYPES = new Set<string>(["Finalizador", "Alvo", "Móvel", "Híbrido"]);

export function playerMatchesClusterFilter(
  player: { cluster?: PositionCluster | null },
  filters: string[],
): boolean {
  if (!filters.length) return true;
  if (!player.cluster) return false;

  if (isLatCluster(player.cluster)) {
    const badgeFilters = filters.filter((key) => LAT_HYBRID_BADGES.has(key));
    const archetypeFilters = filters.filter((key) => LAT_ARCHETYPES.has(key));
    if (badgeFilters.length) return badgeFilters.includes(player.cluster.hybrid_badge ?? "");
    if (archetypeFilters.length) {
      if (player.cluster.archetype === "Híbrido") return archetypeFilters.includes("Híbrido");
      return archetypeFilters.includes(player.cluster.archetype);
    }
    return true;
  }

  if (isMcCluster(player.cluster)) {
    const badgeFilters = filters.filter((key) => MC_HYBRID_BADGES.has(key));
    const archetypeFilters = filters.filter((key) => MC_ARCHETYPES.has(key));
    if (badgeFilters.length) return badgeFilters.includes(player.cluster.hybrid_badge ?? "");
    if (archetypeFilters.length) {
      if (player.cluster.archetype === "Híbrido") return archetypeFilters.includes("Híbrido");
      return archetypeFilters.includes(player.cluster.archetype);
    }
    return true;
  }

  if (isExCluster(player.cluster)) {
    const badgeFilters = filters.filter((key) => EX_HYBRID_BADGES.has(key));
    const archetypeFilters = filters.filter((key) => EX_ARCHETYPES.has(key));
    if (badgeFilters.length) return badgeFilters.includes(player.cluster.hybrid_badge ?? "");
    if (archetypeFilters.length) {
      if (player.cluster.archetype === "Híbrido") return archetypeFilters.includes("Híbrido");
      return archetypeFilters.includes(player.cluster.archetype);
    }
    return true;
  }

  if (isAtCluster(player.cluster)) {
    const archetypeFilters = filters.filter((key) => AT_ARCHETYPES.has(key));
    if (archetypeFilters.length) {
      if (player.cluster.archetype === "Híbrido") return archetypeFilters.includes("Híbrido");
      return archetypeFilters.includes(player.cluster.archetype);
    }
    return true;
  }

  const archetypeFilters = filters.filter((key) => ZAG_ARCHETYPES.has(key));
  if (archetypeFilters.length) return archetypeFilters.includes(player.cluster.archetype);
  return true;
}
