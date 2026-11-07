import "server-only";

import fs from "fs";
import path from "path";
import { CURRENT_SEASON } from "@/lib/seasons";
import type { PlayerDeparture, PlayerProfile, TransferLeg } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Um clube é considerado membro real da liga/temporada quando tem um elenco
 * completo no arquivo (>= MIN_CLUB_ROWS atletas). Linhas "artefato" (1-8
 * atletas) são clubes de fora da competição que o export do Wyscout grava na
 * linha de atletas que saíram no meio da temporada — ex.: "Grêmio" na Série B
 * 2026, "América" (México) na Série A 2026.
 */
const MIN_CLUB_ROWS = 10;

type TransferStint = { club: string; league: string; season: string };

type TransferEntry = {
  current_club: string;
  last?: { club: string; season: string; league: string } | null;
  joined?: string | null;
  legs: TransferLeg[];
  stints?: TransferStint[];
};

type TransfersFile = Record<string, TransferEntry>;

let transfers: TransfersFile | undefined;
let rowPerson: Map<string, string> | undefined;
const memberCache = new Map<string, Set<string>>();

function transfersFile(): TransfersFile {
  if (transfers === undefined) {
    const file = path.join(DATA_DIR, "cross-season", "transfers.json");
    transfers = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as TransfersFile) : {};
  }
  return transfers;
}

function personIndex(): Map<string, string> {
  if (rowPerson) return rowPerson;
  rowPerson = new Map();
  const file = path.join(DATA_DIR, "cross-season", "persons.json");
  if (!fs.existsSync(file)) return rowPerson;
  const persons = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  for (const [league, seasons] of Object.entries(persons)) {
    for (const [season, rows] of Object.entries(seasons)) {
      for (const [playerId, key] of Object.entries(rows)) {
        rowPerson.set(`${league}/${season}/${playerId}`, key);
      }
    }
  }
  return rowPerson;
}

function normClub(club?: string | null): string {
  return (club ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CLUB_STOP = new Set(["de", "da", "do", "e", "fc", "sc", "ec", "ac", "ca", "se", "sp", "clube", "futebol"]);

function sameClub(a?: string | null, b?: string | null): boolean {
  const na = normClub(a);
  const nb = normClub(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set([...na.split(" ")].filter((t) => !CLUB_STOP.has(t)));
  const tb = new Set([...nb.split(" ")].filter((t) => !CLUB_STOP.has(t)));
  return [...ta].some((t) => tb.has(t));
}

function leagueSeasonFile(league: string, season: string): string {
  return season === CURRENT_SEASON
    ? path.join(DATA_DIR, league, "players.json")
    : path.join(DATA_DIR, league, "seasons", season, "players.json");
}

/** Clubes com elenco completo na liga/temporada (nomes normalizados). */
function memberClubs(league: string, season: string): Set<string> {
  const key = `${league}|${season}`;
  const cached = memberCache.get(key);
  if (cached) return cached;
  const set = new Set<string>();
  const file = leagueSeasonFile(league, season);
  if (fs.existsSync(file)) {
    const payload = JSON.parse(fs.readFileSync(file, "utf-8")) as { players?: { club?: string }[] };
    const rows = payload.players ?? [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const n = normClub(row?.club);
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    for (const [club, count] of counts) if (count >= MIN_CLUB_ROWS) set.add(club);
  }
  memberCache.set(key, set);
  return set;
}

const leagueAllMembersCache = new Map<string, Set<string>>();

/** União dos clubes-membro da liga em todas as temporadas disponíveis. */
function leagueAllMembers(league: string): Set<string> {
  const cached = leagueAllMembersCache.get(league);
  if (cached) return cached;
  const set = new Set<string>();
  const seasons = new Set<string>([CURRENT_SEASON]);
  const seasonsDir = path.join(DATA_DIR, league, "seasons");
  if (fs.existsSync(seasonsDir)) {
    for (const entry of fs.readdirSync(seasonsDir)) seasons.add(entry);
  }
  for (const season of seasons) {
    for (const club of memberClubs(league, season)) set.add(club);
  }
  leagueAllMembersCache.set(league, set);
  return set;
}

/**
 * O destino está fora da competição exibida? Verdadeiro quando a perna troca de
 * liga (B -> A) ou quando o clube destino não é membro real da liga (clube
 * estrangeiro gravado dentro do arquivo, ex.: América MX na Série A).
 */
function isCrossCompetition(
  league: string,
  toLeague: string | null | undefined,
  toClub: string,
  toSeason: string | null | undefined,
): boolean {
  if (toLeague && toLeague !== league) return true;
  if (!toLeague) return !leagueAllMembers(league).has(normClub(toClub));
  const members = memberClubs(league, toSeason ?? CURRENT_SEASON);
  return members.size > 0 ? !members.has(normClub(toClub)) : false;
}

/**
 * Resolve a exibição da linha: `displayClub` substitui o clube gravado quando a
 * linha usa um clube-artefato (o export marca o clube para onde ele foi), e
 * `departure` é o destino da saída — apenas quando o atleta saiu da competição
 * (outra liga, exterior ou clube estrangeiro dentro do arquivo).
 */
export function playerTransferInfo(
  league: string,
  season: string,
  player: Pick<PlayerProfile, "player_id" | "club">,
): { displayClub: string | null; departure: PlayerDeparture | null } {
  const membersHere = memberClubs(league, season);
  const artifactRow = membersHere.size > 0 && !membersHere.has(normClub(player.club));
  const key = personIndex().get(`${league}/${season}/${player.player_id}`);
  const entry = key ? transfersFile()[key] : undefined;
  if (!entry) return { displayClub: null, departure: null };

  if (artifactRow) {
    // Linha marcada com o clube de destino: recupera a última passagem real
    // do atleta por esta liga (ex.: Wallace "Grêmio" na B-2026 -> CRB 2025).
    const realStint = [...(entry.stints ?? [])]
      .filter((s) => s.league === league && memberClubs(league, s.season).has(normClub(s.club)))
      .sort((a, b) => a.season.localeCompare(b.season))
      .pop();
    if (!realStint || sameClub(realStint.club, player.club)) {
      return { displayClub: null, departure: null };
    }
    const leg = entry.legs.find((l) => sameClub(l.to_club, player.club));
    return {
      displayClub: realStint.club,
      departure: {
        to_club: player.club,
        to_league: leg?.to_league ?? null,
        to_season: leg?.to_season ?? null,
        date: leg?.date ?? entry.joined ?? null,
        fee: leg?.fee ?? null,
        kind: leg?.kind ?? "permanent",
      },
    };
  }

  // Linha normal: perna que sai desta passagem para outra competição.
  const leg = entry.legs.find(
    (l) =>
      l.from_season === season &&
      sameClub(l.from_club, player.club) &&
      isCrossCompetition(league, l.to_league, l.to_club, l.to_season),
  );
  if (leg) {
    return {
      displayClub: null,
      departure: {
        to_club: leg.to_club,
        to_league: leg.to_league ?? null,
        to_season: leg.to_season ?? null,
        date: leg.date ?? null,
        fee: leg.fee ?? null,
        kind: leg.kind ?? "permanent",
      },
    };
  }

  // Sem perna registrada: clube atual do Transfermarkt fora desta competição.
  const last = entry.last;
  if (
    last &&
    last.league === league &&
    last.season === season &&
    sameClub(last.club, player.club) &&
    entry.current_club &&
    !sameClub(entry.current_club, player.club) &&
    !leagueAllMembers(league).has(normClub(entry.current_club))
  ) {
    return {
      displayClub: null,
      departure: {
        to_club: entry.current_club,
        to_league: null,
        date: entry.joined ?? null,
        fee: null,
        kind: "permanent",
      },
    };
  }
  return { displayClub: null, departure: null };
}

export function withPlayerDeparture<T extends PlayerProfile>(
  league: string,
  season: string,
  player: T,
): T {
  const info = playerTransferInfo(league, season, player);
  if (!info.departure && !info.displayClub) return player;
  return {
    ...player,
    ...(info.displayClub ? { display_club: info.displayClub } : {}),
    ...(info.departure ? { departure: info.departure } : {}),
  };
}

export function withPlayersDepartures<T extends PlayerProfile>(
  league: string,
  season: string,
  players: T[],
): T[] {
  return players.map((player) => withPlayerDeparture(league, season, player));
}
