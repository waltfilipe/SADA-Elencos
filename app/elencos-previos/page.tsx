import { TimeSombraClient } from "@/app/time-sombra/TimeSombraClient";
import { NeutralLeagueProvider } from "@/components/NeutralLeagueProvider";
import { getClubIndex, getSquadRows } from "@/lib/data.server";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerSearchRow } from "@/lib/types";

export const dynamic = "force-static";

export default function ElencosPreviosPage() {
  const playersByLeague: Partial<Record<LeagueId, PlayerSearchRow[]>> = { "serie-a": getSquadRows("serie-a") };
  return (
    <NeutralLeagueProvider>
      <TimeSombraClient playersByLeague={playersByLeague} clubIndex={getClubIndex()} board="previos" />
    </NeutralLeagueProvider>
  );
}
