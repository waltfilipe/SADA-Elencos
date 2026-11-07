import { notFound } from "next/navigation";
import { SeasonLeagueProvider } from "@/components/SeasonLeagueProvider";
import { isLeagueId } from "@/lib/leagues";
import { leagueStaticParams } from "@/lib/staticParams";

export function generateStaticParams() {
  return leagueStaticParams();
}

export const dynamicParams = false;

type Props = {
  children: React.ReactNode;
  params: Promise<{ league: string }>;
};

export default async function LeagueLayout({ children, params }: Props) {
  const { league } = await params;
  if (!isLeagueId(league)) notFound();
  return <SeasonLeagueProvider leagueId={league}>{children}</SeasonLeagueProvider>;
}
