import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import { isLeagueId } from "./leagues";
import type { PositionFamily } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "cross-season");

type RegistryRow = { league?: string; season?: string; player_id?: string; club?: string };
type AthleteRecord = {
  person_key?: string;
  person_keys?: string[];
  rows?: RegistryRow[];
};

let athletesCache: Record<string, AthleteRecord> | null = null;
let personsCache: Record<string, Record<string, Record<string, string>>> | null = null;

function athletesRegistry(): Record<string, AthleteRecord> {
  if (!athletesCache) {
    const payload = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "athletes.json"), "utf-8"),
    ) as { athletes?: Record<string, AthleteRecord> };
    athletesCache = payload.athletes ?? {};
  }
  return athletesCache;
}

function personsMap(): Record<string, Record<string, Record<string, string>>> {
  if (!personsCache) {
    personsCache = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "persons.json"), "utf-8"),
    ) as Record<string, Record<string, Record<string, string>>>;
  }
  return personsCache;
}

export type AthleteSeasonRow = {
  league: string;
  season: string;
  player_id: string;
  family: PositionFamily | null;
  club: string;
  minutes: number;
};

/**
 * Resolves an athlete's registry rows to rows that actually exist in the data
 * files. `athletes.json` can carry a stale player_id (generated before a later
 * club fix), so the persons map — built from the files themselves — wins.
 */
export function athleteSeasonRows(identity: {
  athleteId?: string | null;
  personKey?: string | null;
  league?: string | null;
  season?: string | null;
  playerId?: string | null;
}): AthleteSeasonRow[] {
  const registry = athletesRegistry();
  // Linhas sem athlete_id carimbado: a própria linha resolve a pessoa via
  // persons.json (liga+temporada+player_id -> person_key).
  const personKey =
    identity.personKey ??
    (identity.league && identity.season && identity.playerId
      ? personsMap()[identity.league]?.[identity.season]?.[identity.playerId] ?? null
      : null);
  let record = identity.athleteId ? registry[identity.athleteId] : undefined;
  if (!record && personKey) {
    record = Object.values(registry).find(
      (item) => item.person_key === personKey || item.person_keys?.includes(personKey),
    );
  }
  if (!record?.rows?.length) return [];

  const keys = new Set(
    [record.person_key, ...(record.person_keys ?? [])].filter((key): key is string => Boolean(key)),
  );

  const out: AthleteSeasonRow[] = [];
  for (const row of record.rows) {
    if (!row.league || !row.season || !isLeagueId(row.league)) continue;
    try {
      const players = getPlayers(row.league, row.season);
      const byId = new Map(players.map((player) => [player.player_id, player]));

      let target = row.player_id ? byId.get(row.player_id) : undefined;
      if (!target) {
        const map = personsMap()[row.league]?.[row.season] ?? {};
        for (const [pid, key] of Object.entries(map)) {
          if (keys.has(key)) {
            target = byId.get(pid);
            break;
          }
        }
      }
      if (!target) continue;

      out.push({
        league: row.league,
        season: row.season,
        player_id: target.player_id,
        family: target.position_family ?? null,
        club: target.club,
        minutes: target.minutes ?? 0,
      });
    } catch {
      // Liga/temporada sem arquivo (ex.: estadual sem histórico).
    }
  }

  // Uma entrada por liga+temporada — transferências na mesma janela ficam com a
  // linha de maior minutagem.
  const best = new Map<string, AthleteSeasonRow>();
  for (const row of out) {
    const key = `${row.league}:${row.season}`;
    const current = best.get(key);
    if (!current || row.minutes > current.minutes) best.set(key, row);
  }
  return [...best.values()];
}
