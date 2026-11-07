import "server-only";

import fs from "fs";
import path from "path";
import { getPlayerProfile, getPlayers } from "@/lib/data.server";
import type { LeagueId } from "@/lib/leagues";
import type {
  AthleteArchiveFile,
  AthleteArchiveRecord,
  AthleteDetail,
  AthleteListItem,
  AthleteSeasonRef,
} from "@/lib/athletes.types";
import type { PlayerSummary } from "@/lib/types";

const ATHLETES_DIR = path.join(process.cwd(), "data", "athletes");

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function normKey(name: string, club: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(name)}|${norm(club)}`;
}

function loadArchive(league: LeagueId): AthleteArchiveRecord[] {
  const payload = readJson<AthleteArchiveFile>(path.join(ATHLETES_DIR, `archive-${league}-2025.json`));
  return payload?.players ?? [];
}

export function getAthleteList(league: LeagueId): AthleteListItem[] {
  const current = getPlayers(league);
  const archive = loadArchive(league);
  const archiveByKey = new Map(archive.map((row) => [row.match_key, row]));
  const usedArchive = new Set<string>();

  const items: AthleteListItem[] = [];

  for (const player of current) {
    const key = normKey(player.name, player.club);
    const archived = archiveByKey.get(key);
    if (archived) usedArchive.add(archived.archive_id);

    const seasons: AthleteSeasonRef[] = [
      { season: "2026", league, label: `${league.toUpperCase()} 2026` },
    ];
    if (archived) {
      seasons.push({ season: "2025", league, label: `${league.toUpperCase()} 2025` });
    }

    const profile = getPlayerProfile(player.player_id, league);
    items.push({
      athlete_id: player.player_id,
      name: player.name,
      club: player.club,
      position: player.position,
      position_family: player.position_family,
      photo: profile?.transfermarkt?.photo ?? null,
      rating: player.rating,
      minutes: player.minutes,
      seasons,
    });
  }

  for (const row of archive) {
    if (usedArchive.has(row.archive_id)) continue;
    items.push({
      athlete_id: row.archive_id,
      name: row.name,
      club: row.club,
      position: row.position ?? "—",
      position_family: null,
      photo: null,
      rating: null,
      minutes: row.minutes,
      seasons: [{ season: "2025", league, label: `${league.toUpperCase()} 2025` }],
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return items;
}

export function getAthleteDetail(league: LeagueId, athleteId: string): AthleteDetail | null {
  const list = getAthleteList(league);
  const card = list.find((item) => item.athlete_id === athleteId);
  if (!card) return null;

  let current: AthleteDetail["current"];
  let archive2025: AthleteArchiveRecord | undefined;

  if (!athleteId.startsWith("archive-")) {
    const summary = getPlayers(league).find((p) => p.player_id === athleteId);
    if (summary) {
      current = {
        season: "2026",
        league,
        summary,
        profile: getPlayerProfile(athleteId, league),
      };
    }
    const key = normKey(card.name, card.club);
    archive2025 = loadArchive(league).find((row) => row.match_key === key);
  } else {
    archive2025 = loadArchive(league).find((row) => row.archive_id === athleteId);
  }

  return {
    athlete_id: card.athlete_id,
    name: card.name,
    club: card.club,
    position: card.position,
    photo: card.photo ?? current?.profile?.transfermarkt?.photo ?? null,
    seasons: card.seasons,
    current,
    archive2025,
  };
}

export function athleteStaticIds(league: LeagueId): string[] {
  return getAthleteList(league).map((item) => item.athlete_id);
}
