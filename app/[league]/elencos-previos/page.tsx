import { TimeSombraClient } from "@/app/time-sombra/TimeSombraClient";
import { getClubIndex, getSquadRows } from "@/lib/data.server";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";
import type { PlayerSearchRow } from "@/lib/types";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return leagueStaticParams();
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function ElencosPreviosPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  // Só a liga da página vai no payload — as demais chegam por /api/search-rows
  // sob demanda (ISR limita o corpo da página; todas as ligas passam de 20 MB).
  const playersByLeague: Partial<Record<LeagueId, PlayerSearchRow[]>> = { [league]: getSquadRows(league) };
  return <TimeSombraClient playersByLeague={playersByLeague} clubIndex={getClubIndex()} board="previos" />;
}
