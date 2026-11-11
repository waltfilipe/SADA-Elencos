/** Manual overrides for the auto club lineup (Elenco / Elencos Prévios).
 * Rascunho fica no localStorage; o botão Salvar grava no estado do time sombra
 * (state.elencoOverrides) que já sincroniza com a nuvem (/api/shadow/{scope}).
 * A chave não inclui formação — a formação vai dentro do payload e as posições
 * são remapeadas ao trocar de esquema, então a escalação nunca "some". */

import { fieldSlots, formationById, remapAssignments, type Formation } from "@/lib/formations";

export type ElencoOverrides = {
  /** Formação em que as posições foram escritas — remapeada na leitura. */
  formationId?: string;
  assignments: Record<string, string | null>;
  reservesBySlot: Record<string, string[]>;
};

export function elencoOverrideKey(
  board: string,
  leagueId: string,
  season: string,
  clubKey: string,
): string {
  return `sada-elenco-v2:${board}:${leagueId}:${season}:${clubKey}`;
}

export function loadElencoOverrides(key: string): ElencoOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ElencoOverrides>;
    if (!parsed.assignments) return null;
    return {
      formationId: parsed.formationId,
      assignments: parsed.assignments,
      reservesBySlot: parsed.reservesBySlot ?? {},
    };
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

/**
 * Chaves v1 tinham a formação no sufixo (`…:{clube}:{formação}`) — ao migrar,
 * a formação sai da chave e entra no payload para o remap funcionar depois.
 */
export function loadLegacyElencoOverrides(
  board: string,
  leagueId: string,
  season: string,
  clubKey: string,
): ElencoOverrides | null {
  if (typeof window === "undefined") return null;
  const prefix = `sada-elenco-override-v1:${board}:${leagueId}:${season}:${clubKey}:`;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const formationId = key.slice(prefix.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<ElencoOverrides>;
      if (!parsed.assignments) continue;
      return {
        formationId,
        assignments: parsed.assignments,
        reservesBySlot: parsed.reservesBySlot ?? {},
      };
    }
  } catch {
    /* chave legada corrompida — ignora */
  }
  return null;
}

function remapReserves(
  from: Formation,
  to: Formation,
  reserves: Record<string, string[]>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const slot of fieldSlots(from)) {
    const ids = reserves[slot.id];
    if (!ids?.length) continue;
    const dest = fieldSlots(to).find((item) => item.label === slot.label);
    if (!dest) continue;
    next[dest.id] = [...(next[dest.id] ?? []), ...ids];
  }
  return next;
}

/** Reescreve as posições do override para a formação atual (mesma regra do sombra). */
export function remapElencoOverrides(
  overrides: ElencoOverrides,
  targetFormationId: string,
): ElencoOverrides {
  const fromId = overrides.formationId ?? targetFormationId;
  if (fromId === targetFormationId) return { ...overrides, formationId: targetFormationId };
  const from = formationById(fromId);
  const to = formationById(targetFormationId);
  return {
    formationId: targetFormationId,
    assignments: remapAssignments(from, to, overrides.assignments),
    reservesBySlot: remapReserves(from, to, overrides.reservesBySlot ?? {}),
  };
}
