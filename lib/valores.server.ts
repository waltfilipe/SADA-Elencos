import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import type { LeagueId } from "./leagues";
import { clubRegion, normClub } from "./clubGeo.server";
import {
  ABROAD_COEF,
  ABROAD_OTHER_COEF,
  CAPS_COEF,
  G12_CLUBS,
  G12_COEF,
  LEAGUE_COEF,
  PLAYED_A_COEF,
  POSITION_COEF,
  PROFILE_COEF,
  VALOR_BASE,
  ageTerm,
  contractTerm,
  type ResaleModel,
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
let resaleModel: ResaleModel | null = null;

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

function playedSerieA(personKey: string | null | undefined): boolean {
  if (!personKey) return false;
  const rows = peopleIndex()[personKey]?.rows ?? [];
  return rows.some((row) => row.league === "serie-a" && row.season !== "2026");
}

function abroadOrigin(tmId: string | null | undefined): { club: string; coef: number } | null {
  if (!tmId) return null;
  const from = tmProfiles()[tmId]?.move?.from_club;
  if (!from) return null;
  // Estrangeiro não-UE vence primeiro (ver clubRegion em clubGeo).
  const region = clubRegion(from);
  if (region === "europa") return { club: from, coef: ABROAD_COEF };
  if (region === "brasil") return null;
  return { club: from, coef: ABROAD_OTHER_COEF };
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
    rating: 0.171 * rd + 0.21 * rd * rd,
    age: ageTerm(age),
    minutes: 0.296 * Math.log(Math.max(player.minutes, MINUTES_FLOOR)),
    position: POSITION_COEF[player.position_family] ?? 0,
    profile: PROFILE_COEF[player.position_family]?.[player.profile ?? ""] ?? 0,
    contract: contractTerm(cYears),
    career: serieAExp ? PLAYED_A_COEF : 0,
    reputation: CAPS_COEF * Math.log1p(caps ?? 0) + (abroad?.coef ?? 0),
    club: G12_CLUBS.has(normClub(player.club ?? "")) ? G12_COEF : 0,
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
      factors.reputation +
      factors.club,
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
    resaleScore: resaleScore(player, league, age),
    factors,
  };
}

function tmProfileCacheSafe(tmId: string | null | undefined): TmProfile | null {
  if (!tmId) return null;
  return tmProfiles()[tmId] ?? null;
}

function resale(): ResaleModel | null {
  if (!resaleModel) {
    try {
      resaleModel = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, "resale-model.json"), "utf-8"),
      ) as ResaleModel;
    } catch {
      resaleModel = null;
    }
  }
  return resaleModel;
}

/**
 * Probabilidade de salto (divisão acima / exterior) na próxima temporada.
 * Mesma vetorização de train_resale_model.py — manter sincronizado.
 */
function resaleScore(player: PlayerSummary, league: LeagueId, age: number | null): number | null {
  const model = resale();
  const fam = player.position_family;
  if (!model || !fam || !player.profile) return null;
  const c = model.coef;
  const a = age ?? 26;
  const rd = Math.min(1.8, Math.max(-0.8, player.rating - 6.7));
  const up = new Set(model.upsider_profiles).has(`${fam}/${player.profile}`);
  const z =
    (c["intercepto"] ?? 0) +
    (c["idade-26"] ?? 0) * (a - 26) +
    (c["sub25"] ?? 0) * Math.max(0, 25 - a) +
    (c["mais28"] ?? 0) * Math.max(0, a - 28) +
    (c["rating"] ?? 0) * rd +
    (c["ln_min"] ?? 0) * Math.log(Math.max(player.minutes, 300)) +
    (c["serie-b"] ?? 0) * (league === "serie-b" ? 1 : 0) +
    (c["serie-c"] ?? 0) * (league === "serie-c" ? 1 : 0) +
    (c["laterais"] ?? 0) * (fam === "laterais" ? 1 : 0) +
    (c["meio-campistas"] ?? 0) * (fam === "meio-campistas" ? 1 : 0) +
    (c["extremos"] ?? 0) * (fam === "extremos" ? 1 : 0) +
    (c["atacantes"] ?? 0) * (fam === "atacantes" ? 1 : 0) +
    (c["perfil_upside"] ?? 0) * (up ? 1 : 0);
  return Math.round((1 / (1 + Math.exp(-z))) * 100);
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
