import "server-only";

import { getFamilyPlayers } from "./data.server";
import { DEFAULT_LEAGUE, getLeague, isLeagueId } from "./leagues";
import { POSITION_FAMILIES } from "./positions";
import { BRASILEIRAO_SEASONS } from "./seasons";
import { letterFromPoolPercentile } from "./sectionGrades";
import type {
  AspectItem,
  AspectStat,
  AspectSubMetric,
  PlayerProfile,
  PositionCluster,
  PositionFamily,
} from "./types";

/** Mínimo de atletas acumulados nas temporadas para gerar um "Médio" de perfil. */
const MIN_PROFILE_POOL = 5;

const FAMILY_SINGULAR: Record<PositionFamily, string> = {
  zagueiros: "Zagueiro",
  laterais: "Lateral",
  "meio-campistas": "Meio-campista",
  extremos: "Meia Ofensivo",
  atacantes: "Atacante",
};

/** Share keys do cluster → rótulo do arquétipo (espelha archetypeClusterSlug). */
const ARCHETYPE_BY_SHARE_KEY: Record<PositionFamily, Record<string, string>> = {
  zagueiros: { defensor_area: "Defensor de Área", construtor: "Construtor", combativo: "Combativo" },
  laterais: { defensivo: "Defensivo", construtor: "Construtor", ofensivo: "Ofensivo" },
  "meio-campistas": { contencao: "Contenção", construtor: "Construtor", boxtobox: "Box-to-box" },
  extremos: { driblador: "Driblador", meia_ponta: "Meia Ponta", ruptura: "Ruptura" },
  atacantes: { finalizador: "Finalizador", alvo: "Alvo", movel: "Móvel" },
};

const ASPECT_KEYS: (keyof PlayerProfile["aspects"])[] = [
  "defensivos",
  "aereo",
  "construcao",
  "perfil_construcao",
  "perfil_defensivo",
  "ofensivos",
  "terco_final",
  "passes_finais",
  "conducao_drible",
  "finalizacao",
  "ofensividade",
];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mean(values: (number | null | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : undefined;
}

/** pt-BR "1,8" / "62%" → número. */
function parseDisplay(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/-?\d[\d.,]*/);
  if (!match) return null;
  let num = match[0];
  if (num.includes(",")) num = num.replace(/\./g, "").replace(",", ".");
  const value = Number(num);
  return Number.isFinite(value) ? value : null;
}

/** Média de display_value, mantendo casas decimais e sufixo (ex.: "%") do primeiro valor. */
function meanDisplay(values: (string | null | undefined)[]): string | undefined {
  const parsed = values
    .map((raw) => ({ raw, n: parseDisplay(raw) }))
    .filter((item): item is { raw: string; n: number } => item.n != null && item.raw != null);
  if (!parsed.length) return undefined;
  const sample = parsed[0].raw.trim();
  const suffix = sample.match(/[^\d.,\s-]+$/)?.[0] ?? "";
  const decimals = sample.match(/[.,](\d+)/)?.[1]?.length ?? 0;
  const avg = parsed.reduce((sum, item) => sum + item.n, 0) / parsed.length;
  return `${avg.toFixed(decimals).replace(".", ",")}${suffix}`;
}

function groupByLabel<T extends { label: string }>(lists: T[][]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const list of lists) {
    for (const item of list) {
      const bucket = groups.get(item.label) ?? [];
      bucket.push(item);
      groups.set(item.label, bucket);
    }
  }
  return groups;
}

function averageSubMetrics(items: AspectItem[]): AspectSubMetric[] | undefined {
  const groups = groupByLabel(items.map((item) => item.sub_metrics ?? []));
  if (!groups.size) return undefined;
  return [...groups.entries()].map(([label, rows]) => ({
    label,
    percentile: mean(rows.map((row) => row.percentile)) ?? 0,
    display_value: meanDisplay(rows.map((row) => row.display_value)),
    efficiency_pct: mean(rows.map((row) => row.efficiency_pct)),
    efficiency_value: meanDisplay(rows.map((row) => row.efficiency_value)) ?? null,
  }));
}

function averageStats(items: AspectItem[]): AspectStat[] {
  const groups = groupByLabel(items.map((item) => item.stats ?? []));
  return [...groups.entries()].map(([label, rows]) => ({
    label,
    percentile: mean(rows.map((row) => row.percentile)) ?? 0,
  }));
}

function averageAspectItem(label: string, items: AspectItem[]): AspectItem {
  const first = items[0]!;
  const percentile = mean(items.map((item) => item.percentile));
  const pairs = items
    .map((item) => item.pair_badge)
    .filter((pair): pair is [number, number] => Array.isArray(pair) && pair.length === 2);
  return {
    label,
    kind: first.kind,
    grade: percentile != null ? letterFromPoolPercentile(percentile) : first.grade,
    stats: averageStats(items),
    certos_per90: mean(items.map((item) => item.certos_per90)),
    percentile,
    display_value: meanDisplay(items.map((item) => item.display_value)),
    share_pct: mean(items.map((item) => item.share_pct)),
    pool_avg_pct: mean(items.map((item) => item.pool_avg_pct)),
    scale_max_pct: mean(items.map((item) => item.scale_max_pct)),
    bar_key: first.bar_key,
    axis_left: first.axis_left,
    axis_right: first.axis_right,
    efficiency_pct: mean(items.map((item) => item.efficiency_pct)),
    efficiency_value: meanDisplay(items.map((item) => item.efficiency_value)) ?? null,
    sub_metrics: averageSubMetrics(items),
    pair_badge: pairs.length
      ? [mean(pairs.map((pair) => pair[0])) ?? 0, mean(pairs.map((pair) => pair[1])) ?? 0]
      : null,
  };
}

function averageAspects(players: PlayerProfile[]): PlayerProfile["aspects"] {
  const aspects: PlayerProfile["aspects"] = { construcao: [] };
  for (const key of ASPECT_KEYS) {
    const groups = groupByLabel(players.map((player) => player.aspects?.[key] ?? []));
    if (!groups.size) continue;
    aspects[key] = [...groups.entries()].map(([label, items]) => averageAspectItem(label, items));
  }
  return aspects;
}

function averageRecord(players: PlayerProfile[], pick: (player: PlayerProfile) => Record<string, number> | undefined) {
  const keys = new Set<string>();
  const records = players.map(pick).filter((record): record is Record<string, number> => record != null);
  for (const record of records) for (const key of Object.keys(record)) keys.add(key);
  const out: Record<string, number> = {};
  for (const key of keys) {
    const value = mean(records.map((record) => record[key]));
    if (value != null) out[key] = value;
  }
  return out;
}

function averageCluster(
  players: PlayerProfile[],
  family: PositionFamily,
  archetype: string,
): PositionCluster | undefined {
  const withCluster = players.filter((player) => player.cluster?.shares);
  if (!withCluster.length) return undefined;
  const shares = averageRecord(withCluster, (player) => player.cluster!.shares as Record<string, number>);
  const ratings = averageRecord(withCluster, (player) => player.cluster!.ratings as Record<string, number>);
  const labels = ARCHETYPE_BY_SHARE_KEY[family];
  const valid =
    Object.values(labels).includes(archetype) || (archetype === "Híbrido" && family !== "zagueiros")
      ? archetype
      : dominantArchetype(shares, labels);
  return { family, archetype: valid, archetype_label: valid, shares, ratings } as PositionCluster;
}

function dominantArchetype(shares: Record<string, number>, labels: Record<string, string>): string {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of Object.entries(shares)) {
    if (value > bestValue && labels[key]) {
      bestValue = value;
      best = labels[key];
    }
  }
  return best ?? Object.values(labels)[0]!;
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] ?? "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function averagePlayer(
  pool: PlayerProfile[],
  family: PositionFamily,
  leagueId: string,
  leagueName: string,
  seasons: string[],
  profile: string | null,
): PlayerProfile {
  const familyName = FAMILY_SINGULAR[family];
  const name = `${familyName} Médio${profile ? ` ${profile}` : ""}`;
  const archetype = profile ?? mode(pool.map((player) => player.profile).filter(Boolean));
  return {
    player_id: `media-${leagueId}-${family}-${profile ? slugify(profile) : "todos"}`,
    name,
    club: leagueName,
    label: name,
    position: familyName,
    position_family: family,
    nationality: null,
    birth_year: null,
    height: null,
    foot: null,
    minutes: Math.round(mean(pool.map((player) => player.minutes)) ?? 0),
    minutes_pct: mean(pool.map((player) => player.minutes_pct)) ?? null,
    rating: mean(pool.map((player) => player.rating)) ?? 0,
    profile: archetype,
    hybrid_lean: null,
    cluster: averageCluster(pool, family, archetype),
    transfermarkt: null,
    media_seasons: seasons,
    goals: Math.round((mean(pool.map((player) => player.goals)) ?? 0) * 10) / 10,
    assists: Math.round((mean(pool.map((player) => player.assists)) ?? 0) * 10) / 10,
    ratings: averageRecord(pool, (player) => player.ratings) as PlayerProfile["ratings"],
    ranks: {} as PlayerProfile["ranks"],
    profile_shares: averageRecord(pool, (player) => player.profile_shares),
    tendencies: {
      construcao: mean(pool.map((player) => player.tendencies?.construcao)) ?? 0,
      ofensividade: mean(pool.map((player) => player.tendencies?.ofensividade)) ?? 0,
      def1v1: mean(pool.map((player) => player.tendencies?.def1v1)) ?? 0,
      contencao: mean(pool.map((player) => player.tendencies?.contencao)) ?? 0,
      duelo_aereo: mean(pool.map((player) => player.tendencies?.duelo_aereo)) ?? 0,
    },
    aspects: averageAspects(pool),
    profiles_available: [...new Set(pool.flatMap((player) => player.profiles_available ?? []))],
    scatter: averageRecord(pool, (player) => player.scatter),
  };
}

export type AveragePlayerPayload = {
  league: string;
  family: string;
  seasons: string[];
  players: PlayerProfile[];
};

/** Jogador médio da família acumulando todas as temporadas disponíveis da liga. */
export function getAveragePlayers(league: string | null, family: string | null): AveragePlayerPayload | null {
  const leagueId = league && isLeagueId(league) ? league : DEFAULT_LEAGUE;
  const familyMeta = POSITION_FAMILIES.find((item) => item.key === family);
  if (!familyMeta) return null;

  const pool: PlayerProfile[] = [];
  const seasons: string[] = [];
  for (const season of [...BRASILEIRAO_SEASONS].sort()) {
    const seasonPlayers = getFamilyPlayers(familyMeta.key, leagueId, season);
    if (!seasonPlayers.length) continue;
    pool.push(...seasonPlayers);
    seasons.push(season);
  }
  if (!pool.length) return { league: leagueId, family: familyMeta.key, seasons, players: [] };

  const leagueName = getLeague(leagueId)?.name ?? leagueId;
  const build = (profile: string | null, entries: PlayerProfile[]) =>
    averagePlayer(entries, familyMeta.key, leagueId, leagueName, seasons, profile);

  const players = [build(null, pool)];
  const byProfile = new Map<string, PlayerProfile[]>();
  for (const player of pool) {
    if (!player.profile) continue;
    const bucket = byProfile.get(player.profile) ?? [];
    bucket.push(player);
    byProfile.set(player.profile, bucket);
  }
  const variants = [...byProfile.entries()]
    .filter(([, entries]) => entries.length >= MIN_PROFILE_POOL)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [profile, entries] of variants) players.push(build(profile, entries));

  return { league: leagueId, family: familyMeta.key, seasons, players };
}
