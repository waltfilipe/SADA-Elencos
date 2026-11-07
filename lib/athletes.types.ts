import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile, PlayerSummary } from "@/lib/types";

export type AthleteSeasonRef = {
  season: string;
  league: LeagueId;
  label: string;
};

export type AthleteArchiveHighlights = {
  gols_90: number | null;
  assistencias_90: number | null;
  duelos_90: number | null;
  duelos_ganhos_pct: number | null;
  passes_90: number | null;
  passes_certos_pct: number | null;
  passes_progressivos_90: number | null;
  acoes_def_90: number | null;
  remates_90: number | null;
};

export type AthleteArchiveRecord = {
  archive_id: string;
  wyscout_id: string | null;
  season: string;
  league: LeagueId;
  name: string;
  club: string;
  position: string | null;
  age: number | null;
  nationality: string | null;
  foot: string | null;
  height: number | null;
  minutes: number;
  matches: number;
  goals: number;
  assists: number;
  xg: number | null;
  xa: number | null;
  market_value_eur: number | null;
  match_key: string;
  highlights: AthleteArchiveHighlights;
};

export type AthleteArchiveFile = {
  league: LeagueId;
  season: string;
  total: number;
  players: AthleteArchiveRecord[];
};

export type AthleteListItem = {
  athlete_id: string;
  name: string;
  club: string;
  position: string;
  position_family: PlayerSummary["position_family"] | null;
  photo: string | null;
  rating: number | null;
  minutes: number | null;
  seasons: AthleteSeasonRef[];
};

export type AthleteDetail = {
  athlete_id: string;
  name: string;
  club: string;
  position: string;
  photo: string | null;
  seasons: AthleteSeasonRef[];
  current?: {
    season: string;
    league: LeagueId;
    summary: PlayerSummary;
    profile: PlayerProfile | null;
  };
  archive2025?: AthleteArchiveRecord;
};
