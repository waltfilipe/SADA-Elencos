/** Manual overrides for the auto club lineup (Elenco / Elencos Prévios).
 * Persisted per league + season + club + formation so drag/swap edits stick. */

export type ElencoOverrides = {
  assignments: Record<string, string | null>;
  reservesBySlot: Record<string, string[]>;
};

export function elencoOverrideKey(
  board: string,
  leagueId: string,
  season: string,
  clubKey: string,
  formationId: string,
): string {
  return `sada-elenco-override-v1:${board}:${leagueId}:${season}:${clubKey}:${formationId}`;
}

export function loadElencoOverrides(key: string): ElencoOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ElencoOverrides>;
    if (!parsed.assignments) return null;
    return { assignments: parsed.assignments, reservesBySlot: parsed.reservesBySlot ?? {} };
  } catch {
    return null;
  }
}

export function saveElencoOverrides(key: string, overrides: ElencoOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(overrides));
}

export function clearElencoOverrides(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
