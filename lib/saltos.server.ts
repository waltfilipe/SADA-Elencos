import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import { getLeague, isLeagueId, type LeagueId } from "./leagues";
import { isBrazilianClub, isEuropeanClub, normClub } from "./clubGeo.server";
import { SALTO_LEAGUES, type SaltoPlayer, type SaltoSeasonGroup } from "./saltos";
import type { PlayerSummary } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "cross-season");

/** Nível de divisão — só A/B/C têm temporadas arquivadas. */
const LEVEL: Record<string, number> = { "serie-c": 1, "serie-b": 2, "serie-a": 3 };
const ORIGIN_SEASONS = ["2022", "2023", "2024", "2025"];

/** Cortes largos na geração — a página filtra rating/minutos no client. */
const CANDIDATE_MIN_RATING = 6.8;
const CANDIDATE_MIN_MINUTES = 400;

const IGNORED_TM_CLUBS = new Set(["fim de carreira", "sem clube", "sem contrato", "aposentado"]);
type PeopleRecord = { tm_club?: string | null; clubs?: string[] };

let peopleCache: Record<string, PeopleRecord> | null = null;

function peopleIndex(): Record<string, PeopleRecord> {
  if (!peopleCache) {
    peopleCache = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "people.json"), "utf-8"),
    ) as Record<string, PeopleRecord>;
  }
  return peopleCache;
}

function normName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

let tmClubByName: Map<string, string> | null = null;

/** Cache TM (chave "nome::clube") → clube atual do perfil. Recupera o destino
 * de quem perdeu a âncora em people.json mas teve match registrado no cache. */
function tmClubIndex(): Map<string, string> {
  if (!tmClubByName) {
    tmClubByName = new Map();
    try {
      const cache = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "data", "transfermarkt-cache.json"), "utf-8"),
      ) as Record<string, { club?: string | null }>;
      for (const [key, entry] of Object.entries(cache)) {
        const name = key.split("::")[0];
        const club = entry?.club ?? null;
        if (!name || !club) continue;
        const prev = tmClubByName.get(name);
        // Prefere clube estrangeiro se houver entradas divergentes.
        if (!prev || (isBrazilianClub(prev) && !isBrazilianClub(club))) {
          tmClubByName.set(name, club);
        }
      }
    } catch {
      /* cache ausente — fallback segue limitado */
    }
  }
  return tmClubByName;
}

function identityKeys(player: PlayerSummary): string[] {
  return [player.athlete_id, player.person_key].filter((key): key is string => Boolean(key));
}

/** athlete_id/person_key → melhor linha (mais minutos) da liga na temporada. */
function seasonIndex(league: LeagueId, season: string): Map<string, PlayerSummary> {
  const index = new Map<string, PlayerSummary>();
  let players: PlayerSummary[];
  try {
    players = getPlayers(league, season);
  } catch {
    return index;
  }
  for (const player of players) {
    for (const key of identityKeys(player)) {
      const current = index.get(key);
      if (!current || (player.minutes ?? 0) > (current.minutes ?? 0)) index.set(key, player);
    }
  }
  return index;
}

function nextSeasonIndexes(season: string): Map<LeagueId, Map<string, PlayerSummary>> {
  const next = String(Number(season) + 1);
  const map = new Map<LeagueId, Map<string, PlayerSummary>>();
  for (const league of SALTO_LEAGUES) {
    map.set(league, seasonIndex(league, next));
  }
  return map;
}

const saltosCache = new Map<string, SaltoSeasonGroup[]>();

/**
 * Atletas com boa temporada na liga/ano de origem que no ano seguinte subiram
 * de divisão (A–C) ou deixaram as séries nacionais com clube provável no
 * exterior (tm_club fora do conjunto de clubes brasileiros conhecidos).
 */
export function getSaltos(league: LeagueId): SaltoSeasonGroup[] {
  if (!(league in LEVEL)) return [];
  const cached = saltosCache.get(league);
  if (cached) return cached;

  const fromLevel = LEVEL[league];
  const groups: SaltoSeasonGroup[] = [];

  for (const season of ORIGIN_SEASONS) {
    let players: PlayerSummary[];
    try {
      players = getPlayers(league, season);
    } catch {
      continue;
    }
    const nextIndexes = nextSeasonIndexes(season);
    const leagueName = getLeague(league)?.name ?? league;
    const out: SaltoPlayer[] = [];

    // Melhor linha por identidade (transferência na mesma janela duplica a pessoa).
    const best = new Map<string, PlayerSummary>();
    for (const player of players) {
      if ((player.rating ?? 0) < CANDIDATE_MIN_RATING || (player.minutes ?? 0) < CANDIDATE_MIN_MINUTES)
        continue;
      const key = identityKeys(player)[0] ?? player.player_id;
      const current = best.get(key);
      if (!current || (player.minutes ?? 0) > (current.minutes ?? 0)) best.set(key, player);
    }

    for (const player of best.values()) {
      const keys = identityKeys(player);
      let destination: SaltoPlayer["to"] | null = null;

      for (const [targetLeague, index] of nextIndexes) {
        if (!isLeagueId(targetLeague) || (LEVEL[targetLeague] ?? 0) <= fromLevel) continue;
        const hit = keys.map((key) => index.get(key)).find(Boolean);
        if (hit) {
          const a = normClub(player.club);
          const b = normClub(hit.club);
          const sameClub =
            a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
          // Subiu junto com o clube (mesmo time promovido) e ficou no banco:
          // ignora este hit — pode ainda haver venda real para divisão acima.
          if (sameClub && (hit.minutes_pct ?? 0) < 50) continue;
          destination = {
            kind: "league",
            league: targetLeague,
            leagueName: getLeague(targetLeague)?.name ?? targetLeague,
            club: hit.club,
          };
          break;
        }
      }

      if (!destination) {
        const inAnyNext = [...nextIndexes.values()].some((index) =>
          keys.some((key) => index.has(key)),
        );
        if (!inAnyNext) {
          // Clube atual no TM: âncora da pessoa, bloco TM da própria linha ou
          // qualquer match registrado no cache — nessa ordem de confiança.
          const tmClub =
            (player.person_key ? (peopleIndex()[player.person_key]?.tm_club ?? null) : null) ??
            player.transfermarkt?.club ??
            tmClubIndex().get(normName(player.name)) ??
            null;
          if (tmClub && !IGNORED_TM_CLUBS.has(tmClub.toLowerCase())) {
            // Lista europeia primeiro — match exato e confiável; sem ela o
            // match frouxo de clubes BR engoliria "Napoli" (⊂ "Anapolina").
            const region = isEuropeanClub(tmClub)
              ? "europa"
              : isBrazilianClub(tmClub)
                ? null
                : "outras";
            // Série A não tem divisão acima: salto só conta se foi para a Europa.
            if (region && (league !== "serie-a" || region === "europa")) {
              destination = { kind: "exterior", club: tmClub, region };
            }
          }
        }
      }

      if (!destination) continue;
      out.push({
        playerId: player.player_id,
        athleteId: player.athlete_id ?? null,
        name: player.name,
        club: player.club,
        position: player.position,
        positionFamily: player.position_family ?? null,
        rating: player.rating,
        minutes: player.minutes,
        birthYear: player.birth_year,
        photo: player.transfermarkt?.photo ?? null,
        to: destination,
      });
    }

    out.sort((a, b) => b.rating - a.rating || b.minutes - a.minutes);
    groups.push({ season, players: out });
  }

  groups.sort((a, b) => Number(b.season) - Number(a.season));
  saltosCache.set(league, groups);
  return groups;
}
