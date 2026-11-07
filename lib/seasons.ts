import type { LeagueId } from "@/lib/leagues";

export const BRASILEIRAO_SEASONS = ["2026", "2025", "2024", "2023", "2022"] as const;
export type BrasileiraoSeason = (typeof BRASILEIRAO_SEASONS)[number];

export const CURRENT_SEASON: BrasileiraoSeason = "2026";

export function isBrasileiraoLeague(league: LeagueId): boolean {
  return league === "serie-a" || league === "serie-b" || league === "serie-c";
}

export function parseSeasonParam(value: string | null | undefined): BrasileiraoSeason {
  if (value && (BRASILEIRAO_SEASONS as readonly string[]).includes(value)) {
    return value as BrasileiraoSeason;
  }
  return CURRENT_SEASON;
}

export function seasonQuery(season: string): string {
  return season === CURRENT_SEASON ? "" : `temporada=${season}`;
}

export function withSeasonQuery(path: string, season: string): string {
  if (season === CURRENT_SEASON) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}temporada=${season}`;
}

/** Per-player archive slice while hub season stays 2026. */
export const FICHA_TEMPORADA_PARAM = "ficha_temporada";

/** Season the athlete ficha was viewed at before opening an archive year. */
export const FICHA_ORIGEM_PARAM = "ficha_origem";

export function parseFichaSeasonParam(value: string | null | undefined): BrasileiraoSeason | null {
  if (value && (BRASILEIRAO_SEASONS as readonly string[]).includes(value) && value !== CURRENT_SEASON) {
    return value as BrasileiraoSeason;
  }
  return null;
}

export function parseFichaOrigemParam(value: string | null | undefined): BrasileiraoSeason {
  if (value && (BRASILEIRAO_SEASONS as readonly string[]).includes(value)) {
    return value as BrasileiraoSeason;
  }
  return CURRENT_SEASON;
}

export const HUB_SEASON_STORAGE_KEY = "sada-hub-season";
/** Marca da sessão: o splash da capa aparece uma vez por sessão do navegador. */
export const INTRO_STORAGE_KEY = "sada-intro-seen";
