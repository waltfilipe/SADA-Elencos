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
} from "@/lib/clusterMeta";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type ProfileShareRow = {
  key: string;
  label: string;
  tone: string;
  share: number;
  rating: number;
};

export function buildProfileShareRows(player: PlayerProfile): ProfileShareRow[] {
  if (!player.cluster) return [];
  if (isLatCluster(player.cluster)) {
    const cluster = player.cluster;
    return LAT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: latArchetypeTone(item.archetype),
      share:
        item.archetype === "Defensivo"
          ? cluster.shares.defensivo
          : item.archetype === "Construtor"
            ? cluster.shares.construtor
            : cluster.shares.ofensivo,
      rating:
        item.archetype === "Defensivo"
          ? cluster.ratings.defensivo
          : item.archetype === "Construtor"
            ? cluster.ratings.construtor
            : cluster.ratings.ofensivo,
    }));
  }
  if (isMcCluster(player.cluster)) {
    const cluster = player.cluster;
    return MC_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: mcArchetypeTone(item.archetype),
      share:
        item.archetype === "Contenção"
          ? cluster.shares.contencao
          : item.archetype === "Construtor"
            ? cluster.shares.construtor
            : cluster.shares.boxtobox,
      rating:
        item.archetype === "Contenção"
          ? cluster.ratings.contencao
          : item.archetype === "Construtor"
            ? cluster.ratings.construtor
            : cluster.ratings.boxtobox,
    }));
  }
  if (isExCluster(player.cluster)) {
    const cluster = player.cluster;
    return EX_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: exArchetypeTone(item.archetype),
      share:
        item.archetype === "Driblador"
          ? cluster.shares.driblador
          : item.archetype === "Meia Ponta"
            ? cluster.shares.meia_ponta
            : cluster.shares.ruptura,
      rating:
        item.archetype === "Driblador"
          ? cluster.ratings.driblador
          : item.archetype === "Meia Ponta"
            ? cluster.ratings.meia_ponta
            : cluster.ratings.ruptura,
    }));
  }
  if (isAtCluster(player.cluster)) {
    const cluster = player.cluster;
    return AT_ARCHETYPE_META.filter((m) => m.archetype !== "Híbrido").map((item) => ({
      key: item.archetype,
      label: item.archetype,
      tone: atArchetypeTone(item.archetype),
      share:
        item.archetype === "Finalizador"
          ? cluster.shares.finalizador
          : item.archetype === "Alvo"
            ? cluster.shares.alvo
            : cluster.shares.movel,
      rating:
        item.archetype === "Finalizador"
          ? cluster.ratings.finalizador
          : item.archetype === "Alvo"
            ? cluster.ratings.alvo
            : cluster.ratings.movel,
    }));
  }
  const cluster = player.cluster;
  return ZAG_ARCHETYPE_META.map((item) => ({
    key: item.archetype,
    label: item.archetype,
    tone: archetypeTone(item.archetype),
    share:
      item.archetype === "Defensor de Área"
        ? cluster.shares.defensor_area
        : item.archetype === "Construtor"
          ? cluster.shares.construtor
          : cluster.shares.combativo,
    rating:
      item.archetype === "Defensor de Área"
        ? cluster.ratings.defensor_area
        : item.archetype === "Construtor"
          ? cluster.ratings.construtor
          : cluster.ratings.combativo,
  }));
}

export function sortedProfileShareRows(player: PlayerProfile): ProfileShareRow[] {
  return [...buildProfileShareRows(player)].sort((a, b) => b.share - a.share);
}

/** Primary profile keys to highlight — for híbridos, the two largest shares. */
export function activeProfileKeys(player: PlayerProfile, shareRows: ProfileShareRow[]): Set<string> {
  if (!player.cluster) return new Set();
  if (player.cluster.archetype === "Híbrido") {
    return new Set(
      [...shareRows]
        .sort((a, b) => b.share - a.share)
        .slice(0, 2)
        .map((row) => row.key),
    );
  }
  return new Set([player.cluster.archetype]);
}

export function profileEmoji(label: string): string {
  const map: Record<string, string> = {
    "Defensor de Área": "🛡️",
    Construtor: "🎯",
    Combativo: "⚔️",
    Defensivo: "🛡️",
    Ofensivo: "⚡",
    Híbrido: "🔀",
    Contenção: "🛡️",
    "Box-to-box": "⚡",
    Driblador: "⚡",
    "Meia Ponta": "🎯",
    Ruptura: "🏃",
    Finalizador: "🎯",
    Alvo: "🦅",
    Móvel: "💨",
  };
  return map[label] ?? "📊";
}

export function profileAccent(label: string): string {
  const map: Record<string, string> = {
    "Defensor de Área": "#1be7ff",
    Construtor: "#8980f5",
    Combativo: "#fe4a49",
    Defensivo: "#1be7ff",
    Ofensivo: "#31e981",
    Híbrido: "#fed766",
    Contenção: "#1be7ff",
    "Box-to-box": "#31e981",
    Driblador: "#fed766",
    "Meia Ponta": "#8980f5",
    Ruptura: "#31e981",
    Finalizador: "#fe4a49",
    Alvo: "#fed766",
    Móvel: "#8980f5",
  };
  return map[label] ?? "#1be7ff";
}

export function archetypeClusterSlug(label: string): string | null {
  const map: Record<string, string> = {
    "Defensor de Área": "defensor_area",
    Construtor: "construtor",
    Combativo: "combativo",
    Defensivo: "defensivo",
    Ofensivo: "ofensivo",
    Contenção: "contencao",
    "Box-to-box": "boxtobox",
    Driblador: "driblador",
    "Meia Ponta": "meia_ponta",
    Ruptura: "ruptura",
    Finalizador: "finalizador",
    Alvo: "alvo",
    Móvel: "movel",
  };
  return map[label] ?? null;
}

export function archetypeRank(
  player: PlayerProfile,
  players: PlayerProfile[],
  label: string,
  family: PositionFamily,
): number | null {
  const slug = archetypeClusterSlug(label);
  if (!slug) return null;

  const storedRank = player.ranks?.[slug];
  if ((family === "laterais" || family === "meio-campistas" || family === "extremos" || family === "atacantes") && storedRank) return storedRank;

  const sorted = players
    .filter((entry) => {
      const ratings = entry.cluster?.ratings as Record<string, number> | undefined;
      return ratings != null && ratings[slug] != null;
    })
    .sort((a, b) => {
      const ratingA = (a.cluster!.ratings as Record<string, number>)[slug];
      const ratingB = (b.cluster!.ratings as Record<string, number>)[slug];
      return ratingB - ratingA;
    });

  const index = sorted.findIndex((entry) => entry.player_id === player.player_id);
  return index >= 0 ? index + 1 : null;
}
