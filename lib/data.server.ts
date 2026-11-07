import "server-only";

import fs from "fs";
import path from "path";
import { formatFoot } from "./feet";
import { CURRENT_SEASON, parseSeasonParam } from "./seasons";
import { DEFAULT_LEAGUE, isLeagueId, LEAGUES, type LeagueId } from "./leagues";
import { POSITION_FAMILIES } from "./positions";
import { playerStatBadges } from "./statBadges";
import { familySectionStats } from "./scatterAxis";
import { withResolvedSeasonPhoto, withResolvedSeasonPhotos } from "./playerPhotoLookup.server";
import { withPlayersDepartures } from "./transfersLookup.server";
import type { PlayerHeatmapData, PlayerProfile, PlayerSearchRow, PlayerSummary, PositionFamily, SiteMeta } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function leagueDir(league: LeagueId, season?: string): string {
  const resolved = parseSeasonParam(season);
  if (resolved === CURRENT_SEASON) return path.join(DATA_DIR, league);
  return path.join(DATA_DIR, league, "seasons", resolved);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

const metaCache = new Map<string, SiteMeta>();
const playersCache = new Map<string, { players: PlayerSummary[]; total: number }>();
const profileIndexCache = new Map<string, Map<string, PlayerProfile>>();
const searchRowsCache = new Map<string, PlayerSearchRow[]>();
const familyCache = new Map<string, PlayerProfile[]>();

function cacheKey(league: LeagueId, season?: string): string {
  return `${league}:${parseSeasonParam(season)}`;
}

/** Coarser touch cloud for list and compare cards. Counts stay, so hotspots do not flatten. */
export function compactHeatmap(heatmap: PlayerProfile["heatmap"]): PlayerProfile["heatmap"] {
  const points = heatmap?.points;
  if (!points?.length || points.length <= 90) return heatmap;
  const bins = new Map<string, { x: number; y: number; w: number }>();
  for (const point of points) {
    const x = Math.round(point.x / 8) * 8;
    const y = Math.round(point.y / 8) * 8;
    const key = `${x}:${y}`;
    const weight = point.w ?? 1;
    const prev = bins.get(key);
    if (prev) prev.w += weight;
    else bins.set(key, { x, y, w: weight });
  }
  return { ...heatmap, points: [...bins.values()] };
}

function resolveLeague(league?: string): LeagueId {
  if (league && isLeagueId(league)) return league;
  return DEFAULT_LEAGUE;
}

export function getMeta(league?: string, season?: string): SiteMeta {
  const id = resolveLeague(league);
  const key = cacheKey(id, season);
  if (!metaCache.has(key)) {
    const file = path.join(leagueDir(id, season), "meta.json");
    if (!fs.existsSync(file)) {
      throw new Error(`Missing meta for league ${id} season ${parseSeasonParam(season)}. Run scripts/build_site_data.py`);
    }
    metaCache.set(key, readJson(file));
  }
  return metaCache.get(key)!;
}

const standingsFile = { data: null as Record<string, Record<string, string[]>> | null };
const standingsCache = new Map<string, string[]>();

/** Ordem final da tabela por liga/temporada (fonte: classificação oficial). */
export function getStandings(league?: string, season?: string): string[] {
  const id = resolveLeague(league);
  const key = cacheKey(id, season);
  if (!standingsCache.has(key)) {
    if (!standingsFile.data) {
      const file = path.join(DATA_DIR, "cross-season", "standings.json");
      standingsFile.data = fs.existsSync(file)
        ? readJson<Record<string, Record<string, string[]>>>(file)
        : {};
    }
    standingsCache.set(key, standingsFile.data[id]?.[parseSeasonParam(season)] ?? []);
  }
  return standingsCache.get(key)!;
}

export function getPlayers(league?: string, season?: string): PlayerSummary[] {
  const id = resolveLeague(league);
  const key = cacheKey(id, season);
  if (!playersCache.has(key)) {
    const file = path.join(leagueDir(id, season), "players.json");
    const payload = readJson<{ players: PlayerSummary[]; total: number }>(file);
    const resolved =
      parseSeasonParam(season) === CURRENT_SEASON
        ? payload.players
        : withResolvedSeasonPhotos(id, season ?? CURRENT_SEASON, payload.players);
    playersCache.set(key, { ...payload, players: resolved });
  }
  return playersCache.get(key)!.players;
}

export function getSearchRows(league?: string, season?: string): PlayerSearchRow[] {
  const id = resolveLeague(league);
  const key = cacheKey(id, season);
  if (!searchRowsCache.has(key)) {
    const meta = getMeta(id, season);
    searchRowsCache.set(
      key,
      getPlayers(id, season).map((player) => {
        const profile = getPlayerProfile(player.player_id, id, season);
        const heatmap = meta.heatmaps_enabled ? profile?.heatmap : undefined;
        return {
          ...player,
          transfermarkt: player.transfermarkt ?? profile?.transfermarkt ?? null,
          goals: profile?.goals ?? 0,
          assists: profile?.assists ?? 0,
          tendencies: profile?.tendencies ?? {
            construcao: 0,
            ofensividade: 0,
            def1v1: 0,
            contencao: 0,
            duelo_aereo: 0,
          },
          badges: profile ? playerStatBadges(profile).map((badge) => badge.key) : [],
          scatter: profile?.scatter,
          stats: profile
            ? Object.fromEntries(
                familySectionStats(profile, player.position_family)
                  .filter((stat) => stat.value != null)
                  .map((stat) => [stat.label, stat.value as number]),
              )
            : {},
          heatmap: compactHeatmap(heatmap),
        };
      }),
    );
  }
  return searchRowsCache.get(key)!;
}

/** Campos que os quadros de escalação (elenco/prévios/time sombra) não consomem. */
const SQUAD_ROW_OMIT = new Set([
  "stats",
  "scatter",
  "heatmap",
  "cluster",
  "discipline",
  "hybrid_lean",
  "minutes_pct",
  "athlete_id",
  "person_key",
]);

/** Search rows enxutos para os boards — sem aspectos achatados nem clusters. */
export function getSquadRows(league?: string, season?: string): PlayerSearchRow[] {
  return getSearchRows(league, season).map(
    (row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => !SQUAD_ROW_OMIT.has(key))) as PlayerSearchRow,
  );
}

/** Índice clube → contagem de atletas por liga (alimenta o picker sem serializar linhas). */
export function getClubIndex(): { leagueId: LeagueId; club: string; count: number }[] {
  const index: { leagueId: LeagueId; club: string; count: number }[] = [];
  for (const league of LEAGUES) {
    let players: PlayerSummary[];
    try {
      players = getPlayers(league.id);
    } catch {
      continue;
    }
    const counts = new Map<string, number>();
    for (const player of players) {
      if (!player.club) continue;
      counts.set(player.club, (counts.get(player.club) ?? 0) + 1);
    }
    for (const [club, count] of counts) {
      index.push({ leagueId: league.id, club, count });
    }
  }
  return index;
}

/**
 * Profiles live inside each `family-*.json`. Reading `profiles/*.json` as well
 * traced a second copy (~110 MB) into every serverless function and pushed each
 * route over Vercel's bundling budget, so Hobby created one function per route.
 */
function profileIndex(league: LeagueId, season?: string): Map<string, PlayerProfile> {
  const key = cacheKey(league, season);
  const cached = profileIndexCache.get(key);
  if (cached) return cached;
  const index = new Map<string, PlayerProfile>();
  for (const family of POSITION_FAMILIES) {
    for (const player of getFamilyPlayers(family.key, league, season)) {
      index.set(player.player_id, player);
    }
  }
  profileIndexCache.set(key, index);
  return index;
}

export function getPlayerProfile(playerId: string, league?: string, season?: string): PlayerProfile | null {
  const player = profileIndex(resolveLeague(league), season).get(playerId) ?? null;
  if (!player) return null;
  return parseSeasonParam(season) === CURRENT_SEASON
    ? player
    : (withResolvedSeasonPhoto(resolveLeague(league), season ?? CURRENT_SEASON, player) as PlayerProfile);
}

export function getFamilyPlayers(family: PositionFamily, league?: string, season?: string): PlayerProfile[] {
  const id = resolveLeague(league);
  const key = `${cacheKey(id, season)}:${family}`;
  const cached = familyCache.get(key);
  if (cached) return cached;
  const filePath = path.join(leagueDir(id, season), `family-${family}.json`);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson<{ players: PlayerProfile[] }>(filePath);
  const resolved =
    parseSeasonParam(season) === CURRENT_SEASON
      ? payload.players
      : withResolvedSeasonPhotos(id, season ?? CURRENT_SEASON, payload.players);
  const withTransfers = withPlayersDepartures(id, parseSeasonParam(season), resolved);
  familyCache.set(key, withTransfers);
  return withTransfers;
}

export function filterPlayers(
  players: PlayerSummary[],
  filters: {
    family?: PositionFamily;
    club?: string;
    nationality?: string;
    foot?: string;
    profiles?: string[];
    height?: [number, number];
    minutes?: [number, number];
    birthYear?: [number, number];
    rating?: [number, number];
    tendencies?: Partial<Record<keyof PlayerProfile["tendencies"], [number, number]>>;
    search?: string;
  },
  league?: string,
  season?: string,
): PlayerSummary[] {
  return players.filter((player) => {
    if (filters.family && player.position_family !== filters.family) return false;
    if (filters.club && filters.club !== "all" && player.club !== filters.club) return false;
    if (filters.nationality && filters.nationality !== "all" && player.nationality !== filters.nationality) return false;
    if (filters.foot && filters.foot !== "all" && formatFoot(player.foot) !== filters.foot) return false;
    if (filters.profiles?.length && !filters.profiles.includes(player.profile)) return false;
    if (filters.height && player.height != null) {
      if (player.height < filters.height[0] || player.height > filters.height[1]) return false;
    }
    if (filters.minutes) {
      if (player.minutes < filters.minutes[0] || player.minutes > filters.minutes[1]) return false;
    }
    if (filters.birthYear && player.birth_year != null) {
      if (player.birth_year < filters.birthYear[0] || player.birth_year > filters.birthYear[1]) return false;
    }
    if (filters.rating) {
      if (player.rating < filters.rating[0] || player.rating > filters.rating[1]) return false;
    }
    if (filters.tendencies) {
      const profile = getPlayerProfile(player.player_id, league, season);
      if (!profile) return false;
      for (const [key, range] of Object.entries(filters.tendencies) as [
        keyof PlayerProfile["tendencies"],
        [number, number],
      ][]) {
        const value = profile.tendencies[key];
        if (value < range[0] || value > range[1]) return false;
      }
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${player.name} ${player.club} ${player.position}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
