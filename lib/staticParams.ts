import { LEAGUES } from "./leagues";
import { POSITION_FAMILIES } from "./positions";

export function leagueStaticParams() {
  return LEAGUES.map((league) => ({ league: league.id }));
}

export function leagueFamilyStaticParams() {
  return LEAGUES.flatMap((league) =>
    POSITION_FAMILIES.map((family) => ({ league: league.id, family: family.slug })),
  );
}

export function leaguePositionStaticParams() {
  return LEAGUES.flatMap((league) =>
    POSITION_FAMILIES.map((family) => ({ league: league.id, slug: family.slug })),
  );
}

export function positionStaticParams() {
  return POSITION_FAMILIES.map((family) => ({ slug: family.slug }));
}
