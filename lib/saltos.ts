import type { LeagueId } from "./leagues";
import type { PositionFamily } from "./types";

/**
 * Destino de um "salto": divisão superior no Brasil ou clube no exterior
 * (heurística sobre o clube atual no Transfermarkt — ver lib/saltos.server).
 */
export type SaltoDestination =
  | { kind: "league"; league: LeagueId; leagueName: string; club: string }
  | { kind: "exterior"; club: string | null };

export type SaltoPlayer = {
  /** player_id da linha de origem — âncora do /api/similar (from+season). */
  playerId: string;
  athleteId: string | null;
  name: string;
  club: string;
  position: string;
  positionFamily: PositionFamily | null;
  rating: number;
  minutes: number;
  birthYear: number | null;
  photo: string | null;
  to: SaltoDestination;
};

export type SaltoSeasonGroup = {
  /** Temporada de origem (2022–2025). */
  season: string;
  players: SaltoPlayer[];
};

/** Ligas com histórico no site (Série D e estaduais só têm a temporada atual). */
export const SALTO_LEAGUES = ["serie-c", "serie-b", "serie-a"] as const;
export type SaltoLeagueId = (typeof SALTO_LEAGUES)[number];
