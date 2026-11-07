import { formatFoot } from "@/lib/feet";
import type { PlayerProfile } from "@/lib/types";

export type FlankSide = "esquerdo" | "direito";

/** Laterais e meias ofensivos: filtro por lado do campo. */
export function playerMatchesFlankSide(player: PlayerProfile, side: FlankSide): boolean {
  const position = player.position ?? "";
  if (position.includes("Esquerdo")) return side === "esquerdo";
  if (position.includes("Direito")) return side === "direito";

  if (position === "Meia Ofensivo") {
    const foot = formatFoot(player.foot);
    if (side === "esquerdo") return foot === "Canhoto";
    return foot === "Destro";
  }

  return false;
}

export function supportsFlankSideFilter(positionFamily: string): boolean {
  return positionFamily === "laterais" || positionFamily === "extremos";
}
