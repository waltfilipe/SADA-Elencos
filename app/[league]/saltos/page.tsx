import { notFound } from "next/navigation";
import { SaltosClient } from "./SaltosClient";
import { getSaltos } from "@/lib/saltos.server";
import { getLeague, isLeagueId } from "@/lib/leagues";
import { SALTO_LEAGUES } from "@/lib/saltos";

export function generateStaticParams() {
  return SALTO_LEAGUES.map((league) => ({ league }));
}

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ league: string }> };

export default async function SaltosPage({ params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league) || !(SALTO_LEAGUES as readonly string[]).includes(league)) notFound();
  const info = getLeague(league)!;
  return <SaltosClient leagueId={league} leagueName={info.name} groups={getSaltos(league)} />;
}
