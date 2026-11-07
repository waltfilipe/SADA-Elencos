import {
  DEFAULT_FORMATION_ID,
  fieldSlots,
  formationById,
  remapAssignments,
  suggestSlotId,
  type Formation,
} from "@/lib/formations";
import type { LeagueId } from "@/lib/leagues";
import type { PositionFamily } from "@/lib/types";

export type ShadowScope = LeagueId | "todas" | "estaduais";

export function storageKey(scope: ShadowScope) {
  if (scope === "todas") return "all-competitions-scout:shadow-team-v1";
  return `${scope}-scout:shadow-team-v1`;
}

export function shadowChangeEvent(scope: ShadowScope) {
  if (scope === "todas") return "all-competitions-scout:shadow-change";
  return `${scope}-scout:shadow-change`;
}

/** @deprecated use storageKey(league) */
export const STORAGE_KEY = "serie-a-scout:shadow-team-v1";
/** @deprecated use shadowChangeEvent(league) */
export const SHADOW_CHANGE_EVENT = "serie-a-scout:shadow-change";

export type TeamBoard = "sombra" | "proprio";

export type ShadowTeamState = {
  formationId: string;
  /** Players in the shadow squad (may be on pitch or bench). */
  squadIds: string[];
  /** Observation list — independent from the shadow squad. */
  watchlistIds: string[];
  /** slotId → playerId (time sombra) */
  assignments: Record<string, string | null>;
  /** Reservas por posição, mostrados em miniatura no campo. */
  reserves: Record<string, string[]>;
  /** Time próprio — mesma formação, elenco separado. */
  ownSquadIds: string[];
  ownAssignments: Record<string, string | null>;
  ownReserves: Record<string, string[]>;
};

export const EMPTY_STATE: ShadowTeamState = {
  formationId: DEFAULT_FORMATION_ID,
  squadIds: [],
  watchlistIds: [],
  assignments: {},
  reserves: {},
  ownSquadIds: [],
  ownAssignments: {},
  ownReserves: {},
};

function emptyAssignments(formation: Formation): Record<string, string | null> {
  return Object.fromEntries(fieldSlots(formation).map((s) => [s.id, null]));
}

export function loadShadowTeamState(league: ShadowScope = "serie-a"): ShadowTeamState {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const raw = localStorage.getItem(storageKey(league));
    if (!raw) {
      const base = emptyAssignments(formationById(DEFAULT_FORMATION_ID));
      return { ...EMPTY_STATE, assignments: base, ownAssignments: { ...base } };
    }
    const parsed = JSON.parse(raw) as Partial<ShadowTeamState>;
    const formationId = parsed.formationId ?? DEFAULT_FORMATION_ID;
    const formation = formationById(formationId);
    const base = emptyAssignments(formation);
    return {
      formationId,
      squadIds: parsed.squadIds ?? [],
      watchlistIds: parsed.watchlistIds ?? [],
      assignments: { ...base, ...(parsed.assignments ?? {}) },
      reserves: parsed.reserves ?? {},
      ownSquadIds: parsed.ownSquadIds ?? [],
      ownAssignments: { ...base, ...(parsed.ownAssignments ?? {}) },
      ownReserves: parsed.ownReserves ?? {},
    };
  } catch {
    const base = emptyAssignments(formationById(DEFAULT_FORMATION_ID));
    return { ...EMPTY_STATE, assignments: base, ownAssignments: { ...base } };
  }
}

export function saveShadowTeamState(state: ShadowTeamState, league: ShadowScope = "serie-a"): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(league), JSON.stringify(state));
  window.dispatchEvent(new Event(shadowChangeEvent(league)));
}

function takenSlots(assignments: Record<string, string | null>): Set<string> {
  return new Set(Object.entries(assignments).filter(([, v]) => v).map(([k]) => k));
}

export function boardSquad(state: ShadowTeamState, board: TeamBoard): string[] {
  return board === "proprio" ? state.ownSquadIds : state.squadIds;
}

export function boardAssignments(state: ShadowTeamState, board: TeamBoard): Record<string, string | null> {
  return board === "proprio" ? state.ownAssignments : state.assignments;
}

export function boardReserves(state: ShadowTeamState, board: TeamBoard): Record<string, string[]> {
  return board === "proprio" ? state.ownReserves ?? {} : state.reserves ?? {};
}

function withoutReserve(reserves: Record<string, string[]>, playerId: string): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [slotId, ids] of Object.entries(reserves)) {
    const kept = ids.filter((id) => id !== playerId);
    if (kept.length) next[slotId] = kept;
  }
  return next;
}

function writeBoard(
  state: ShadowTeamState,
  board: TeamBoard,
  squadIds: string[],
  assignments: Record<string, string | null>,
  reserves?: Record<string, string[]>,
): ShadowTeamState {
  const nextReserves = reserves ?? boardReserves(state, board);
  if (board === "proprio") {
    return { ...state, ownSquadIds: squadIds, ownAssignments: assignments, ownReserves: nextReserves };
  }
  return { ...state, squadIds, assignments, reserves: nextReserves };
}

export function addToWatchlist(state: ShadowTeamState, playerId: string): ShadowTeamState {
  if (state.watchlistIds.includes(playerId)) return state;
  return { ...state, watchlistIds: [...state.watchlistIds, playerId] };
}

export function removeFromWatchlist(state: ShadowTeamState, playerId: string): ShadowTeamState {
  return { ...state, watchlistIds: state.watchlistIds.filter((id) => id !== playerId) };
}

export function addToSquad(
  state: ShadowTeamState,
  playerId: string,
  family: PositionFamily,
  board: TeamBoard = "sombra",
): ShadowTeamState {
  const formation = formationById(state.formationId);
  let squadIds = boardSquad(state, board);
  if (!squadIds.includes(playerId)) {
    squadIds = [...squadIds, playerId];
  }

  const assignments = { ...boardAssignments(state, board) };
  const alreadyOnPitch = Object.values(assignments).includes(playerId);
  if (!alreadyOnPitch) {
    const taken = takenSlots(assignments);
    const slotId = suggestSlotId(formation, family, taken);
    if (slotId) assignments[slotId] = playerId;
  }

  const onPitch = Object.values(assignments).includes(playerId);
  return writeBoard(
    state,
    board,
    squadIds,
    assignments,
    onPitch ? withoutReserve(boardReserves(state, board), playerId) : boardReserves(state, board),
  );
}

/** Entra como reserva da posição e aparece em miniatura no campo. */
export function addReserve(
  state: ShadowTeamState,
  playerId: string,
  board: TeamBoard,
  slotId: string,
): ShadowTeamState {
  const assignments = boardAssignments(state, board);
  if (Object.values(assignments).includes(playerId)) return state;
  const squadIds = boardSquad(state, board);
  const nextSquad = squadIds.includes(playerId) ? squadIds : [...squadIds, playerId];
  const reserves = withoutReserve(boardReserves(state, board), playerId);
  reserves[slotId] = [...(reserves[slotId] ?? []), playerId];
  return writeBoard(state, board, nextSquad, assignments, reserves);
}

export function removeFromSquad(
  state: ShadowTeamState,
  playerId: string,
  board: TeamBoard = "sombra",
): ShadowTeamState {
  const assignments = { ...boardAssignments(state, board) };
  for (const key of Object.keys(assignments)) {
    if (assignments[key] === playerId) assignments[key] = null;
  }
  return writeBoard(
    state,
    board,
    boardSquad(state, board).filter((id) => id !== playerId),
    assignments,
    withoutReserve(boardReserves(state, board), playerId),
  );
}

export function assignPlayer(
  state: ShadowTeamState,
  slotId: string,
  playerId: string | null,
  board: TeamBoard = "sombra",
): ShadowTeamState {
  const assignments = { ...boardAssignments(state, board) };
  if (playerId) {
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === playerId) assignments[key] = null;
    }
    let squadIds = boardSquad(state, board);
    if (!squadIds.includes(playerId)) squadIds = [...squadIds, playerId];
    assignments[slotId] = playerId;
    return writeBoard(
      state,
      board,
      squadIds,
      assignments,
      withoutReserve(boardReserves(state, board), playerId),
    );
  }
  assignments[slotId] = null;
  return writeBoard(state, board, boardSquad(state, board), assignments);
}

export function swapSlots(
  state: ShadowTeamState,
  slotA: string,
  slotB: string,
  board: TeamBoard = "sombra",
): ShadowTeamState {
  const assignments = { ...boardAssignments(state, board) };
  const a = assignments[slotA] ?? null;
  const b = assignments[slotB] ?? null;
  assignments[slotA] = b;
  assignments[slotB] = a;
  return writeBoard(state, board, boardSquad(state, board), assignments);
}

/** Drag-and-drop: move or swap between slots; bench source has null sourceSlotId. */
export function dropPlayerOnSlot(
  state: ShadowTeamState,
  sourceSlotId: string | null,
  targetSlotId: string,
  playerId: string,
  board: TeamBoard = "sombra",
): ShadowTeamState {
  const assignments = { ...boardAssignments(state, board) };
  const occupant = assignments[targetSlotId] ?? null;

  let squadIds = boardSquad(state, board);
  if (!squadIds.includes(playerId)) squadIds = [...squadIds, playerId];
  const reserves = withoutReserve(boardReserves(state, board), playerId);

  if (sourceSlotId) {
    if (occupant && occupant !== playerId) {
      assignments[sourceSlotId] = occupant;
      assignments[targetSlotId] = playerId;
    } else {
      assignments[sourceSlotId] = null;
      for (const key of Object.keys(assignments)) {
        if (key !== targetSlotId && assignments[key] === playerId) assignments[key] = null;
      }
      assignments[targetSlotId] = playerId;
    }
  } else {
    for (const key of Object.keys(assignments)) {
      if (assignments[key] === playerId) assignments[key] = null;
    }
    if (occupant && occupant !== playerId) {
      assignments[targetSlotId] = playerId;
    } else {
      assignments[targetSlotId] = playerId;
    }
  }

  return writeBoard(state, board, squadIds, assignments, reserves);
}

export function setFormation(state: ShadowTeamState, formationId: string): ShadowTeamState {
  const from = formationById(state.formationId);
  const to = formationById(formationId);
  if (from.id === to.id) return state;
  return {
    ...state,
    formationId,
    assignments: remapAssignments(from, to, state.assignments),
    ownAssignments: remapAssignments(from, to, state.ownAssignments),
    reserves: remapReserves(from, to, state.reserves ?? {}),
    ownReserves: remapReserves(from, to, state.ownReserves ?? {}),
  };
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

export function benchPlayerIds(state: ShadowTeamState, board: TeamBoard = "sombra"): string[] {
  const assignments = boardAssignments(state, board);
  const onPitch = new Set(Object.values(assignments).filter(Boolean) as string[]);
  return boardSquad(state, board).filter((id) => !onPitch.has(id));
}
