import { notFound } from "next/navigation";
import { ValoresClient } from "./ValoresClient";
import { getValores } from "@/lib/valores.server";
import { getLeague, isLeagueId, LEAGUES } from "@/lib/leagues";

export function generateStaticParams() {
  return LEAGUES.map((league) => ({ league: league.id }));
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function ValoresPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  const info = getLeague(league)!;
  const { players, summary } = getValores(league);
  return (
    <ValoresClient leagueId={league} leagueName={info.name} players={players} summary={summary} />
  );
}
