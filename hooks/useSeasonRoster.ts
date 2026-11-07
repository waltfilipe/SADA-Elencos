"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLeague } from "@/components/LeagueProvider";

type ArchiveRoster<T> = { key: string; players: T[]; failed: boolean };

const subscribeNoop = () => () => {};
const isClient = () => true;
const isServer = () => false;

type Options<T> = {
  /** Static page props always hold the current season. */
  initial: T[];
  /** Roster scope (ex.: "all" ou a família), para descartar arquivos velhos. */
  scope: string;
  /** Recurso da API que responde `{ players: T[] }` (ex.: "families/zagueiros"). */
  resource: string;
};

/**
 * Static pages ship the current season in props and cannot see ?temporada on the
 * server. In archive mode (?temporada=YYYY) the roster is fetched once per
 * league/scope/season from `/api/{resource}?league=&season=`, with one retry —
 * same pattern as PositionScoutPage.
 */
export function useSeasonRoster<T>({ initial, scope, resource }: Options<T>) {
  const { leagueId, season, isCurrentSeason } = useLeague();
  const hydrated = useSyncExternalStore(subscribeNoop, isClient, isServer);
  const seasonKey = `${leagueId}:${scope}:${season}`;
  const [archiveRoster, setArchiveRoster] = useState<ArchiveRoster<T> | null>(null);
  const archiveReady = archiveRoster?.key === seasonKey;
  const archiveFailed = Boolean(archiveReady && archiveRoster!.failed);
  const seasonLoading = !hydrated || (!isCurrentSeason && !archiveReady);

  const players = useMemo(() => {
    if (!hydrated) return [] as T[];
    if (isCurrentSeason) return initial;
    return archiveReady ? archiveRoster!.players : ([] as T[]);
  }, [hydrated, isCurrentSeason, initial, archiveReady, archiveRoster]);

  useEffect(() => {
    if (isCurrentSeason || archiveReady) return;
    let cancelled = false;
    const url = `/api/${resource}?league=${leagueId}&season=${season}`;
    const load = (attempt: number): Promise<T[]> =>
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`season_fetch_${res.status}`))))
        .then((payload: { players?: T[] }) => payload.players ?? [])
        .catch((error) => {
          if (cancelled || attempt >= 2) throw error;
          return new Promise<T[]>((resolve) => setTimeout(resolve, 800 * (attempt + 1))).then(() =>
            load(attempt + 1),
          );
        });
    load(0)
      .then((roster) => {
        if (!cancelled) setArchiveRoster({ key: seasonKey, players: roster, failed: false });
      })
      .catch(() => {
        if (!cancelled) setArchiveRoster({ key: seasonKey, players: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, season, seasonKey, resource, isCurrentSeason, archiveReady]);

  const retry = useCallback(() => setArchiveRoster(null), []);

  return { players, season, isCurrentSeason, seasonLoading, archiveFailed, retry };
}
