"use client";

import { Suspense, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { LeagueProvider, useLeague } from "@/components/LeagueProvider";
import { getLeague, leaguePath, type LeagueId } from "@/lib/leagues";
import { CURRENT_SEASON, isBrasileiraoLeague, parseSeasonParam, withSeasonQuery } from "@/lib/seasons";

type Props = {
  leagueId: LeagueId;
  children: React.ReactNode;
};

const subscribeNoop = () => () => {};
const isClient = () => true;
const isServer = () => false;

function SeasonLeagueProviderInner({ leagueId, children }: Props) {
  const searchParams = useSearchParams();
  // League pages are prerendered without ?temporada, so hydrate as the current season
  // (matching the static HTML) and switch to the requested season right after.
  const hydrated = useSyncExternalStore(subscribeNoop, isClient, isServer);
  const season = hydrated ? parseSeasonParam(searchParams.get("temporada")) : CURRENT_SEASON;
  const info = getLeague(leagueId)!;

  const value = useMemo(
    () => ({
      leagueId,
      href: (path: string) => {
        const base = leaguePath(leagueId, path);
        if (!isBrasileiraoLeague(leagueId)) return base;
        return withSeasonQuery(base, season);
      },
      heatmaps: info.heatmaps && season === CURRENT_SEASON,
      name: info.name,
      season,
      brand: info.brand,
      isCurrentSeason: season === CURRENT_SEASON,
    }),
    [leagueId, info.brand, info.heatmaps, info.name, season],
  );

  return (
    <LeagueProvider leagueId={leagueId} value={value}>
      {children}
    </LeagueProvider>
  );
}

export function SeasonLeagueProvider(props: Props) {
  return (
    <Suspense fallback={<LeagueProvider leagueId={props.leagueId}>{props.children}</LeagueProvider>}>
      <SeasonLeagueProviderInner {...props} />
    </Suspense>
  );
}
