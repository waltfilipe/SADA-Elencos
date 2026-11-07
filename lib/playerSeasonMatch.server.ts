import "server-only";

import { withResolvedSeasonPhoto } from "@/lib/playerPhotoLookup.server";
import { POSITION_FAMILIES } from "@/lib/positions";
import { archetypeRank, sortedProfileShareRows } from "@/lib/profileShares";
import { profileGradeFromRank } from "@/lib/scoutTheme";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { getFamilyPlayers } from "@/lib/data.server";

export function normPlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withSeasonMeta(
  league: LeagueId,
  season: string,
  player: PlayerProfile,
  pool: PlayerProfile[],
  family: PositionFamily,
): PlayerProfile {
  const resolved = withResolvedSeasonPhoto(league, season, player) as PlayerProfile;
  const profiles = sortedProfileShareRows(resolved).map((row) => {
    const rank = archetypeRank(resolved, pool, row.label, family);
    return { label: row.label, share: row.share, rank, grade: rank ? profileGradeFromRank(rank, pool.length) : null };
  });
  resolved.season_meta = { pool_size: pool.length, profiles };
  return resolved;
}

/**
 * Wyscout archives report birth years inconsistently (±1 vs the current season),
 * so an exact name|birth match misses most athletes. Try exact first, then fall
 * back to a unique-name match within ±1 year (tie-broken by the expected club).
 */
export function findPlayerInSeason(
  league: LeagueId,
  season: string,
  name: string,
  birthYear: number | null | undefined,
  club?: string | null,
  identity?: { athleteId?: string | null; personKey?: string | null },
): PlayerProfile | null {
  const norm = normPlayerName(name);
  let best: { player: PlayerProfile; pool: PlayerProfile[]; family: PositionFamily; score: number } | null = null;
  for (const family of POSITION_FAMILIES) {
    const pool = getFamilyPlayers(family.key, league, season) as PlayerProfile[];
    for (const player of pool) {
      // athlete_id/person_key identificam a pessoa diretamente — resolve exato
      // mesmo com divergência de ano de nascimento entre arquivos Wyscout.
      if (identity?.athleteId && player.athlete_id === identity.athleteId) {
        return withSeasonMeta(league, season, player, pool, family.key);
      }
      if (identity?.personKey && player.person_key === identity.personKey) {
        return withSeasonMeta(league, season, player, pool, family.key);
      }
      if (normPlayerName(player.name) !== norm) continue;
      const pb = player.birth_year ?? null;
      if (birthYear == null || pb == null) continue;
      const diff = Math.abs(pb - birthYear);
      if (diff > 1) continue;
      const clubHit = club != null && player.club === club;
      const score = (club ? (clubHit ? 0 : 2) : diff === 0 ? 0 : 1) * 10 + diff;
      if (!best || score < best.score) {
        best = { player, pool, family: family.key, score };
      }
    }
  }
  return best ? withSeasonMeta(league, season, best.player, best.pool, best.family) : null;
}
