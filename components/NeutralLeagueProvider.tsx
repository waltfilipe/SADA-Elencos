"use client";

import { LeagueProvider, type LeagueContextValue } from "@/components/LeagueProvider";
import { getLeague } from "@/lib/leagues";
import { CURRENT_SEASON } from "@/lib/seasons";

/**
 * O app de elencos é da comissão — um elenco, um time sombra, sem "Elencos
 * de Série A". "serie-a" entra só como fonte de dados padrão (payload
 * inicial, defaults de busca); href() devolve paths neutros, então a
 * navegação interna nunca expõe /serie-a/* na URL.
 */
export function NeutralLeagueProvider({ children }: { children: React.ReactNode }) {
  const info = getLeague("serie-a")!;
  const value: LeagueContextValue = {
    leagueId: "serie-a",
    href: (path: string) => (path.startsWith("/") ? path : `/${path}`),
    heatmaps: info.heatmaps,
    name: info.name,
    season: CURRENT_SEASON,
    brand: info.brand,
    isCurrentSeason: true,
  };
  return (
    <LeagueProvider leagueId="serie-a" value={value}>
      {children}
    </LeagueProvider>
  );
}
