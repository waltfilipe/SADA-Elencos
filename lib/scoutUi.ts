import type { PlayerProfile } from "@/lib/types";
import { dominantRatingKey } from "./profileMeta";
import { archetypeClusterSlug } from "./profileShares";

/** Maps a profile name to the CSS tone class used for its accent colour. */
export function profileTone(profile: string): string {
  switch (profile) {
    case "Combativo":
      return "combativo";
    case "Defensor de Área":
      return "defensor-area";
    case "Construtor":
      return "construtor";
    case "Posicional":
      return "posicional";
    case "Defensivo":
      return "defensivo";
    case "Híbrido":
      return "hibrido";
    case "Híbrido + Construtor":
      return "hibrido-construtor";
    case "Híbrido + Defensivo":
      return "hibrido-defensivo";
    case "Vertical":
    case "Ruptura":
      return "vertical";
    case "Ofensivo":
      return "ofensivo";
    case "Contenção":
      return "contencao";
    case "Box-to-box":
    case "Box to Box":
      return "boxtobox";
    case "Criador":
    case "Driblador":
      return "criador";
    case "Meia Ponta":
      return "meia-ponta";
    case "Armador":
    case "Meia Armador":
      return "armador";
    case "Finalizador":
    case "Meia Atacante":
      return "finalizador";
    case "Alvo":
      return "alvo";
    case "Móvel":
      return "movel";
    default:
      return "hibrido";
  }
}

export function sortPlayers(players: PlayerProfile[], sort: "rating" | "name" | "minutes") {
  const copy = [...players];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (sort === "minutes") return copy.sort((a, b) => b.minutes - a.minutes);
  return copy.sort((a, b) => positionRating(b) - positionRating(a));
}

/** Highest position-scoped rating in the pool (same order as the athlete strip). */
export function topRatedPlayerId(players: PlayerProfile[]): string {
  if (!players.length) return "";
  return sortPlayers(players, "rating")[0]!.player_id;
}

/** Rating do perfil classificado do atleta (não usa rating geral). */
export function positionRating(
  player: Pick<PlayerProfile, "profile" | "position_family" | "rating"> &
    Partial<Pick<PlayerProfile, "ratings" | "hybrid_lean" | "cluster">>,
): number {
  const key = dominantRatingKey(player.profile, player.position_family, player.hybrid_lean);
  if (key && player.ratings?.[key] != null) return player.ratings[key];

  if (player.cluster?.ratings) {
    const slug = archetypeClusterSlug(player.cluster.archetype);
    if (slug) {
      const value = (player.cluster.ratings as Record<string, number>)[slug];
      if (value != null) return value;
    }
  }

  const profileRatings = player.ratings
    ? Object.entries(player.ratings)
        .filter(([ratingKey]) => ratingKey !== "geral")
        .map(([, value]) => value)
    : [];
  if (profileRatings.length) return Math.max(...profileRatings);
  return player.rating;
}
