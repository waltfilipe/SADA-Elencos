"use client";

import { createContext, useContext, useMemo } from "react";
import { getLeague, leaguePath, type LeagueId } from "@/lib/leagues";
import { CURRENT_SEASON } from "@/lib/seasons";

export type LeagueContextValue = {
  leagueId: LeagueId;
  href: (path: string) => string;
  heatmaps: boolean;
  name: string;
  season: string;
  brand: string;
  isCurrentSeason: boolean;
};

const LeagueContext = createContext<LeagueContextValue | null>(null);

type ProviderProps = {
  leagueId: LeagueId;
  children: React.ReactNode;
  value?: LeagueContextValue;
};

export function LeagueProvider({ leagueId, children, value }: ProviderProps) {
  const info = getLeague(leagueId)!;
  const resolved = useMemo(
    () =>
      value ?? {
        leagueId,
        href: (path: string) => leaguePath(leagueId, path),
        heatmaps: info.heatmaps,
        name: info.name,
        season: info.season,
        brand: info.brand,
        isCurrentSeason: info.season === CURRENT_SEASON,
      },
    [leagueId, info.brand, info.heatmaps, info.name, info.season, value],
  );
  return <LeagueContext.Provider value={resolved}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) {
    throw new Error("useLeague must be used within LeagueProvider");
  }
  return ctx;
}

export function useLeagueOptional(): LeagueContextValue | null {
  return useContext(LeagueContext);
}
