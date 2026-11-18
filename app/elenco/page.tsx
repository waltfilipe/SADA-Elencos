import { TimeSombraClient } from "@/app/time-sombra/TimeSombraClient";
import { NeutralLeagueProvider } from "@/components/NeutralLeagueProvider";
import { getClubIndex, getSquadRows } from "@/lib/data.server";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerSearchRow } from "@/lib/types";

export const dynamic = "force-static";

export default function ElencoPage() {
  // Série A vai no payload como fonte padrão — as demais ligas chegam por
  // /api/search-rows sob demanda (o elenco não é de uma liga específica).
  const playersByLeague: Partial<Record<LeagueId, PlayerSearchRow[]>> = { "serie-a": getSquadRows("serie-a") };
  return (
    <NeutralLeagueProvider>
      <TimeSombraClient playersByLeague={playersByLeague} clubIndex={getClubIndex()} board="elenco" />
    </NeutralLeagueProvider>
  );
}
