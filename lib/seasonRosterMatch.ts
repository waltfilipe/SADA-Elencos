type RosterEntry = { player_id: string; name: string; birth_year?: number | null };

/**
 * `a=`/`b=`/`c=` query params carry player_id values that are not stable across
 * seasons. When the id is missing from the active roster, fall back to the same
 * name|birth_year ±1 match PositionScoutPage uses for `atleta_nome`/`atleta_nasc`.
 * `reference` is the current-season roster, used to translate a stale id into a
 * name + birth year before matching.
 */
export function resolveSeasonPlayerId<T extends RosterEntry>(
  roster: T[],
  requestedId: string | undefined,
  options?: {
    name?: string | null;
    birthYear?: number | null;
    reference?: RosterEntry[];
  },
): string | undefined {
  if (requestedId && roster.some((player) => player.player_id === requestedId)) {
    return requestedId;
  }
  const ref = requestedId ? options?.reference?.find((player) => player.player_id === requestedId) : undefined;
  const name = options?.name ?? ref?.name;
  const nascRaw = options?.birthYear ?? ref?.birth_year;
  const nasc = typeof nascRaw === "number" && Number.isFinite(nascRaw) ? nascRaw : null;
  if (!name) return undefined;
  const candidates = roster.filter((player) => player.name === name);
  const match =
    candidates.find(
      (player) => player.birth_year == null || nasc == null || Math.abs(player.birth_year - nasc) <= 1,
    ) ?? (candidates.length === 1 ? candidates[0] : undefined);
  return match?.player_id;
}
