import "server-only";

import fs from "fs";
import path from "path";
import { CURRENT_SEASON } from "@/lib/seasons";
import type { LeagueId } from "@/lib/leagues";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PlayerProfile, PlayerSummary, TransfermarktInfo } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const BR_LEAGUES: LeagueId[] = ["serie-a", "serie-b", "serie-c"];

function normName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normClub(club: string): string {
  return normName(club);
}

function athleteKey(name: string, birthYear: number | null | undefined): string {
  return `${normName(name)}|${birthYear ?? 0}`;
}

type PhotoIndex = {
  byAthlete: Map<string, PhotoCandidate[]>;
  byTmId: Map<string, TransfermarktInfo>;
  byNameClub: Map<string, TransfermarktInfo>;
  byName: Map<string, PhotoCandidate[]>;
  /** person_key → Transfermarkt of the 2026 row of the same person. */
  byPerson: Map<string, TransfermarktInfo>;
  /** "league/season/player_id" → person_key (from cross-season persons.json). */
  rowPerson: Map<string, string>;
  /** normalized name → distinct person_keys — the homonym guard. */
  personsByName: Map<string, Set<string>>;
};

type PhotoCandidate = {
  tm: TransfermarktInfo;
  club: string;
};

/** Normalized club comparison — Wyscout and Transfermarkt spell names differently. */
function clubCompatible(a: string, b: string): boolean {
  const na = normClub(a);
  const nb = normClub(b);
  if (!na || !nb) return true;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  return [...ta].some((t) => tb.has(t));
}

let indexCache: PhotoIndex | null = null;

function pickRicher(a: TransfermarktInfo | undefined, b: TransfermarktInfo): TransfermarktInfo {
  if (!a?.photo) return b;
  if (!b?.photo) return a;
  return b;
}

function remember(
  maps: PhotoIndex,
  tm: TransfermarktInfo,
  name: string,
  club: string,
  birthYear: number | null | undefined,
) {
  if (!tm?.photo) return;
  const athlete = athleteKey(name, birthYear);
  const cand: PhotoCandidate = { tm, club: club || tm.club || "" };
  const athleteList = maps.byAthlete.get(athlete) ?? [];
  if (!athleteList.some((c) => c.tm?.photo === tm.photo)) athleteList.push(cand);
  maps.byAthlete.set(athlete, athleteList);
  if (tm.id) maps.byTmId.set(String(tm.id), pickRicher(maps.byTmId.get(String(tm.id)), tm));
  if (club) {
    const nc = `${normName(name)}::${normClub(club)}`;
    maps.byNameClub.set(nc, pickRicher(maps.byNameClub.get(nc), tm));
  }
  const n = normName(name);
  const nameList = maps.byName.get(n) ?? [];
  if (!nameList.some((c) => c.tm?.photo === tm.photo)) nameList.push(cand);
  maps.byName.set(n, nameList);
}

function loadPersonsMap(maps: PhotoIndex): Map<string, string[]> {
  /** Reads persons.json; returns person_key → ["league/player_id"] of 2026 rows. */
  const currentByKey = new Map<string, string[]>();
  const file = path.join(DATA_DIR, "cross-season", "persons.json");
  if (!fs.existsSync(file)) return currentByKey;
  const persons = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  for (const [league, seasons] of Object.entries(persons)) {
    for (const [season, rows] of Object.entries(seasons)) {
      for (const [playerId, key] of Object.entries(rows)) {
        maps.rowPerson.set(`${league}/${season}/${playerId}`, key);
        if (key.startsWith("name:")) {
          const namePart = key.slice(5).split("|")[0];
          const set = maps.personsByName.get(namePart) ?? new Set<string>();
          set.add(key);
          maps.personsByName.set(namePart, set);
        }
        if (season === CURRENT_SEASON) {
          const list = currentByKey.get(key) ?? [];
          list.push(`${league}/${playerId}`);
          currentByKey.set(key, list);
        }
      }
    }
  }
  return currentByKey;
}

/** Canonical identity layer: person_key → verified TM record (people.json). */
function loadPeople(maps: PhotoIndex) {
  const file = path.join(DATA_DIR, "cross-season", "people.json");
  if (!fs.existsSync(file)) return;
  const people = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    { tm_id?: string | null; photo?: string | null; tm_club?: string | null; profile_url?: string | null }
  >;
  for (const [key, rec] of Object.entries(people)) {
    if (!rec?.photo) continue;
    const tm: TransfermarktInfo = {
      id: rec.tm_id ?? null,
      photo: rec.photo,
      market_value: null,
      market_value_eur: null,
      contract_until: null,
      contract_remaining: null,
      club: rec.tm_club ?? null,
      profile_url: rec.profile_url ?? null,
    };
    maps.byPerson.set(key, pickRicher(maps.byPerson.get(key), tm));
    if (tm.id) maps.byTmId.set(String(tm.id), pickRicher(maps.byTmId.get(String(tm.id)), tm));
  }
}

function loadCurrentSeasonProfiles(maps: PhotoIndex) {
  for (const league of BR_LEAGUES) {
    const base = path.join(DATA_DIR, league);
    for (const family of POSITION_FAMILIES) {
      const file = path.join(base, `family-${family.key}.json`);
      if (!fs.existsSync(file)) continue;
      const payload = JSON.parse(fs.readFileSync(file, "utf-8")) as { players: PlayerProfile[] };
      for (const player of payload.players ?? []) {
        const personKey = maps.rowPerson.get(`${league}/${CURRENT_SEASON}/${player.player_id}`);
        if (personKey && player.transfermarkt?.photo) {
          maps.byPerson.set(personKey, pickRicher(maps.byPerson.get(personKey), player.transfermarkt));
        }
        if (player.transfermarkt?.photo) {
          remember(maps, player.transfermarkt, player.name, player.club, player.birth_year);
        }
      }
    }
  }
}

function loadTransfermarktCache(maps: PhotoIndex) {
  const file = path.join(DATA_DIR, "transfermarkt-cache.json");
  if (!fs.existsSync(file)) return;
  const cache = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, TransfermarktInfo>;
  for (const [key, tm] of Object.entries(cache)) {
    if (!tm?.photo) continue;
    const [namePart, clubPart] = key.split("::");
    if (namePart && clubPart) {
      remember(maps, tm, namePart, clubPart, null);
    } else if (tm.id) {
      maps.byTmId.set(String(tm.id), pickRicher(maps.byTmId.get(String(tm.id)), tm));
    }
  }
}

function loadPhotoManifest(maps: PhotoIndex) {
  const file = path.join(process.cwd(), "photos", "photos", "manifest.json");
  if (!fs.existsSync(file)) return;
  const manifest = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
    string,
    { name?: string; file?: string; photo_url?: string }
  >;
  for (const row of Object.values(manifest)) {
    if (!row.file || !row.name) continue;
    const tm: TransfermarktInfo = {
      id: null,
      photo: `/photos/${row.file}`,
      market_value: null,
      market_value_eur: null,
      contract_until: null,
      contract_remaining: null,
      club: null,
      profile_url: null,
    };
    remember(maps, tm, row.name, "", null);
  }
}

function buildPhotoIndex(): PhotoIndex {
  const maps: PhotoIndex = {
    byAthlete: new Map(),
    byTmId: new Map(),
    byNameClub: new Map(),
    byName: new Map(),
    byPerson: new Map(),
    rowPerson: new Map(),
    personsByName: new Map(),
  };
  loadPersonsMap(maps);
  loadPeople(maps);
  loadCurrentSeasonProfiles(maps);
  loadTransfermarktCache(maps);
  loadPhotoManifest(maps);
  return maps;
}

function photoIndex(): PhotoIndex {
  if (!indexCache) indexCache = buildPhotoIndex();
  return indexCache;
}

export function resetPhotoIndexCache() {
  indexCache = null;
}

function lookupTransfermarkt(
  player: Pick<PlayerSummary, "name" | "club" | "birth_year" | "transfermarkt">,
): TransfermarktInfo | null {
  if (player.transfermarkt?.photo) return player.transfermarkt;
  const maps = photoIndex();
  const tmId = player.transfermarkt?.id;
  if (tmId) {
    const fromId = maps.byTmId.get(String(tmId));
    if (fromId?.photo) return fromId;
  }
  const fromNc = maps.byNameClub.get(`${normName(player.name)}::${normClub(player.club)}`);
  if (fromNc?.photo) return fromNc;
  // When the name maps to a single identity, any candidate is that athlete.
  // When shared (homonyms), only a club-verified candidate may apply — no
  // photo is better than a wrong one.
  const uniquePerson = (maps.personsByName.get(normName(player.name))?.size ?? 0) <= 1;
  const resolve = (candidates: PhotoCandidate[] | undefined): TransfermarktInfo | null => {
    if (!candidates?.length) return null;
    const clubHit = candidates.find((c) => c.club && clubCompatible(c.club, player.club));
    if (clubHit) return clubHit.tm;
    return uniquePerson ? candidates[0].tm : null;
  };
  const fromAthlete = resolve(maps.byAthlete.get(athleteKey(player.name, player.birth_year)));
  if (fromAthlete?.photo) return fromAthlete;
  const fromName = resolve(maps.byName.get(normName(player.name)));
  if (fromName?.photo) return fromName;
  return player.transfermarkt ?? null;
}

function mergeTm<T extends PlayerSummary>(player: T, tm: NonNullable<TransfermarktInfo>): T {
  return {
    ...player,
    transfermarkt: {
      ...player.transfermarkt,
      ...tm,
      photo: tm.photo,
      id: tm.id ?? player.transfermarkt?.id ?? null,
      club: tm.club ?? player.transfermarkt?.club ?? null,
      profile_url: tm.profile_url ?? player.transfermarkt?.profile_url ?? null,
    },
  };
}

export function withResolvedPlayerPhoto<T extends PlayerSummary>(player: T): T {
  if (player.transfermarkt?.photo) return player;
  const tm = lookupTransfermarkt(player);
  if (!tm?.photo) return player;
  return mergeTm(player, tm);
}

export function withResolvedPlayerPhotos<T extends PlayerSummary>(players: T[]): T[] {
  return players.map((player) => withResolvedPlayerPhoto(player));
}

/**
 * Archive-season photo resolution. The row's person_key (same identity graph as
 * cross_season) points to that athlete's 2026 Transfermarkt — the photo follows
 * the person, never the name. Falls back to the legacy lookups when the archive
 * player has no 2026 counterpart (left/retired).
 */
export function withResolvedSeasonPhoto<T extends PlayerSummary>(
  league: string,
  season: string,
  player: T,
): T {
  if (player.transfermarkt?.photo) return player;
  const maps = photoIndex();
  const key = maps.rowPerson.get(`${league}/${season}/${player.player_id}`);
  const tm = key ? maps.byPerson.get(key) : undefined;
  if (tm?.photo) return mergeTm(player, tm);
  return withResolvedPlayerPhoto(player);
}

export function withResolvedSeasonPhotos<T extends PlayerSummary>(
  league: string,
  season: string,
  players: T[],
): T[] {
  return players.map((player) => withResolvedSeasonPhoto(league, season, player));
}
