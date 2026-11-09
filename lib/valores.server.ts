import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import type { LeagueId } from "./leagues";
import { isBrazilianClub, isEuropeanClub } from "./clubGeo.server";
import {
  ABROAD_COEF,
  CAPS_COEF,
  CONTRACT_STEP,
  LEAGUE_COEF,
  PLAYED_A_COEF,
  POSITION_COEF,
  PROFILE_DISCOUNT,
  PROFILE_PREMIUM,
  VALOR_BASE,
  type ValorPlayer,
  type ValorSide,
  type ValorSummary,
} from "./valores";
import type { PlayerSummary } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "cross-season");

/** Data-base para contrato restante (meio da temporada 2026). */
const REF_DATE = new Date("2026-07-01T00:00:00Z").getTime();
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const MINUTES_FLOOR = 120;

type PeopleRecord = {
  clubs?: string[];
  rows?: { league?: string; season?: string }[];
};

type TmProfile = {
  caps?: number | null;
  caps_team?: string | null;
  move?: { from_club?: string | null } | null;
};

let peopleCache: Record<string, PeopleRecord> | null = null;
let tmProfileCache: Record<string, TmProfile> | null = null;

function peopleIndex(): Record<string, PeopleRecord> {
  if (!peopleCache) {
    try {
      peopleCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "people.json"), "utf-8"));
    } catch {
      peopleCache = {};
    }
  }
  return peopleCache!;
}

function tmProfiles(): Record<string, TmProfile> {
  if (!tmProfileCache) {
    try {
      tmProfileCache = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, "tm-profile-cache.json"), "utf-8"),
      );
    } catch {
      tmProfileCache = {};
    }
  }
  return tmProfileCache!;
}

/** "31/12/2029" (players.json) ou "2029-12-31" (tm-profile-cache) → anos restantes. */
function contractYears(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/) ?? raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [y, mo, d] =
    m[0].includes("-") && m[1].length === 4
      ? [Number(m[1]), Number(m[2]), Number(m[3])]
      : [Number(m[3]), Number(m[2]), Number(m[1])];
  const years = (Date.UTC(y, mo - 1, d) - REF_DATE) / YEAR_MS;
  return Number.isFinite(years) ? Math.max(0, years) : null;
}

function contractTerm(years: number | null): number {
  if (years == null) return 0.071; // sem registro — efeito quase neutro medido
  if (years < 1) return 0;
  if (years < 2) return CONTRACT_STEP;
  if (years < 3.5) return CONTRACT_STEP * 2;
  return CONTRACT_STEP * 3;
}

function playedSerieA(personKey: string | null | undefined): boolean {
  if (!personKey) return false;
  const rows = peopleIndex()[personKey]?.rows ?? [];
  return rows.some((row) => row.league === "serie-a" && row.season !== "2026");
}

function abroadOrigin(tmId: string | null | undefined): { club: string; coef: number } | null {
  if (!tmId) return null;
  const from = tmProfiles()[tmId]?.move?.from_club;
  if (!from || isBrazilianClub(from)) return null;
  return { club: from, coef: isEuropeanClub(from) ? ABROAD_COEF : ABROAD_COEF * 0.5 };
}

function sideFor(sada: number, tm: number | null): { side: ValorSide; ratio: number | null } {
  if (tm == null || tm <= 0) return { side: "sem_tm", ratio: null };
  const ratio = sada / tm;
  if (ratio >= 1.5) return { side: "acima", ratio };
  if (ratio <= 0.67) return { side: "abaixo", ratio };
  return { side: "neutro", ratio };
}

function valuePlayer(player: PlayerSummary, league: LeagueId): ValorPlayer {
  const tm = player.transfermarkt ?? null;
  const profile = tmProfileCacheSafe(tm?.id);

  const rd = Math.min(1.8, Math.max(-0.8, player.rating - 6.7));
  const age = player.birth_year ? 2026 - player.birth_year : null;
  const cYears = contractYears(tm?.contract_until ?? null);
  const abroad = abroadOrigin(tm?.id);
  const caps = profile?.caps ?? null;
  const serieAExp = league !== "serie-a" && playedSerieA(player.person_key);

  const factors = {
    league: LEAGUE_COEF[league] ?? -3.5,
    rating: 0.205 * rd + 0.425 * rd * rd,
    age: age == null ? 0 : age < 23 ? -0.003 * (23 - age) : age > 27 ? -0.176 * (age - 27) : 0,
    minutes: 0.321 * Math.log(Math.max(player.minutes, MINUTES_FLOOR)),
    position: POSITION_COEF[player.position_family] ?? -0.3,
    profile: PROFILE_PREMIUM[player.position_family]?.has(player.profile)
      ? 0.1
      : PROFILE_DISCOUNT[player.position_family]?.has(player.profile)
        ? -0.1
        : 0,
    contract: contractTerm(cYears),
    career: serieAExp ? PLAYED_A_COEF : 0,
    reputation: CAPS_COEF * Math.log1p(caps ?? 0) + (abroad?.coef ?? 0),
  };
  const sada = Math.exp(
    VALOR_BASE +
      factors.league +
      factors.rating +
      factors.age +
      factors.minutes +
      factors.position +
      factors.profile +
      factors.contract +
      factors.career +
      factors.reputation,
  );
  const market = tm?.market_value_eur ?? null;
  const { side, ratio } = sideFor(sada, market);

  return {
    playerId: player.player_id,
    athleteId: player.athlete_id ?? null,
    name: player.name,
    club: player.club,
    position: player.position,
    positionFamily: player.position_family ?? null,
    profile: player.profile ?? null,
    age,
    rating: player.rating,
    minutes: player.minutes,
    photo: tm?.photo ?? null,
    caps,
    capsTeam: profile?.caps_team ?? null,
    contractUntil: tm?.contract_until ?? null,
    contractYears: cYears,
    exAbroad: abroad?.club ?? null,
    playedSerieA: serieAExp,
    marketValueEur: market,
    sadaValue: sada,
    ratio,
    side,
    factors,
  };
}

function tmProfileCacheSafe(tmId: string | null | undefined): TmProfile | null {
  if (!tmId) return null;
  return tmProfiles()[tmId] ?? null;
}

const valoresCache = new Map<string, { players: ValorPlayer[]; summary: ValorSummary }>();

export function getValores(league: LeagueId): { players: ValorPlayer[]; summary: ValorSummary } {
  const cached = valoresCache.get(league);
  if (cached) return cached;

  const players = getPlayers(league)
    .map((player) => valuePlayer(player, league))
    .sort((a, b) => b.sadaValue - a.sadaValue);

  const comTm = players.filter((p) => p.marketValueEur != null);
  const sorted = [...players].sort((a, b) => a.sadaValue - b.sadaValue);
  const summary: ValorSummary = {
    total: players.length,
    comTm: comTm.length,
    acima: players.filter((p) => p.side === "acima").length,
    abaixo: players.filter((p) => p.side === "abaixo").length,
    medianSada: sorted.length ? sorted[Math.floor(sorted.length / 2)].sadaValue : 0,
  };

  const result = { players, summary };
  valoresCache.set(league, result);
  return result;
}
