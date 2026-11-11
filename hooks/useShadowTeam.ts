"use client";

import { useCallback, useEffect, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import {
  addReserve,
  addToSquad,
  addToWatchlist,
  assignPlayer,
  flushShadowToCloud,
  hydrateShadowFromCloud,
  loadShadowTeamState,
  removeFromSquad,
  removeFromWatchlist,
  saveShadowTeamState,
  setFormation,
  shadowChangeEvent,
  storageKey,
  dropPlayerOnSlot,
  swapSlots,
  type ElencoSaved,
  type ShadowScope,
  type ShadowTeamState,
  type TeamBoard,
} from "@/lib/shadowTeamStorage";
import type { PositionFamily } from "@/lib/types";

export function useShadowTeam(scope?: ShadowScope) {
  const { leagueId } = useLeague();
  const active: ShadowScope = scope ?? leagueId;
  const [state, setState] = useState<ShadowTeamState | null>(null);

  useEffect(() => {
    setState(loadShadowTeamState(active));
    // Nuvem (se habilitada) sobrescreve o local — dispara o change event.
    hydrateShadowFromCloud(active);

    const key = storageKey(active);
    const changeEvent = shadowChangeEvent(active);

    function onStorage(event: StorageEvent) {
      if (event.key === key) setState(loadShadowTeamState(active));
    }
    function onLocalChange() {
      setState(loadShadowTeamState(active));
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(changeEvent, onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changeEvent, onLocalChange);
    };
  }, [active]);

  const persist = useCallback(
    (next: ShadowTeamState) => {
      setState(next);
      saveShadowTeamState(next, active);
    },
    [active],
  );

  const toggleWatchlist = useCallback(
    (playerId: string) => {
      if (!state) return;
      const next = state.watchlistIds.includes(playerId)
        ? removeFromWatchlist(state, playerId)
        : addToWatchlist(state, playerId);
      persist(next);
    },
    [state, persist],
  );

  const toggleSquad = useCallback(
    (playerId: string, family: PositionFamily) => {
      if (!state) return;
      const next = state.squadIds.includes(playerId)
        ? removeFromSquad(state, playerId)
        : addToSquad(state, playerId, family);
      persist(next);
    },
    [state, persist],
  );

  const assign = useCallback(
    (slotId: string, playerId: string | null, board: TeamBoard = "sombra") => {
      if (!state) return;
      persist(assignPlayer(state, slotId, playerId, board));
    },
    [state, persist],
  );

  const swap = useCallback(
    (slotA: string, slotB: string, board: TeamBoard = "sombra") => {
      if (!state) return;
      persist(swapSlots(state, slotA, slotB, board));
    },
    [state, persist],
  );

  const dropOnSlot = useCallback(
    (sourceSlotId: string | null, targetSlotId: string, playerId: string, board: TeamBoard = "sombra") => {
      if (!state) return;
      persist(dropPlayerOnSlot(state, sourceSlotId, targetSlotId, playerId, board));
    },
    [state, persist],
  );

  const reserve = useCallback(
    (playerId: string, board: TeamBoard, slotId: string) => {
      if (!state) return;
      persist(addReserve(state, playerId, board, slotId));
    },
    [state, persist],
  );

  const changeFormation = useCallback(
    (formationId: string) => {
      if (!state) return;
      persist(setFormation(state, formationId));
    },
    [state, persist],
  );

  /**
   * Botão Salvar do Elenco: grava a escala no estado sincronizado (ou apaga
   * com null) e sobe para a nuvem na hora — resolve `true` se o PUT foi ok.
   */
  const saveElencoOverride = useCallback(
    (key: string, saved: ElencoSaved | null): Promise<boolean> => {
      if (!state) return Promise.resolve(false);
      const elencoOverrides = { ...(state.elencoOverrides ?? {}) };
      if (saved) elencoOverrides[key] = saved;
      else delete elencoOverrides[key];
      const next = { ...state, elencoOverrides };
      persist(next);
      return flushShadowToCloud(active, next);
    },
    [state, persist, active],
  );

  const isWatchlisted = useCallback(
    (playerId: string) => Boolean(state?.watchlistIds.includes(playerId)),
    [state],
  );

  const isInSquad = useCallback(
    (playerId: string) => Boolean(state?.squadIds.includes(playerId)),
    [state],
  );

  return {
    state,
    ready: state != null,
    toggleWatchlist,
    toggleSquad,
    assign,
    swap,
    dropOnSlot,
    reserve,
    changeFormation,
    saveElencoOverride,
    isWatchlisted,
    isInSquad,
    removeFromSquad: (playerId: string, board: TeamBoard = "sombra") =>
      state && persist(removeFromSquad(state, playerId, board)),
    removeFromWatchlist: (playerId: string) => state && persist(removeFromWatchlist(state, playerId)),
  };
}
