import { flattenAspects } from "@/lib/aspectLookup";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

/** Laterais, meio-campistas e a família rotulada Meias Ofensivos (`extremos`). */
const CROSSING_FAMILIES = new Set<PositionFamily>(["laterais", "meio-campistas", "extremos"]);

export function showsCrossingTendency(player: Pick<PlayerProfile, "position_family">): boolean {
  return CROSSING_FAMILIES.has(player.position_family);
}

function parseVolume(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("%")) return null;
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Cruzamentos per 90 already stored on the player aspect. */
export function crossingVolumePer90(player: PlayerProfile): number | null {
  const item = flattenAspects(player).find((row) => row.label === "Cruzamentos");
  const sub = item?.sub_metrics?.find((row) => row.label === "Cruzamentos");
  return parseVolume(sub?.display_value);
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatPer90(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Headroom similar to the pass-share bars, sized to this volume instead of a 40% floor. */
export function crossingScale(values: number[], playerValue: number, average: number): number {
  const sample = values.length ? values : [playerValue];
  const sorted = [...sample].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  const high = sorted[index] ?? playerValue;
  return Math.max(high * 1.15, average * 2, playerValue, average, 1);
}

export function crossingReading(player: PlayerProfile, players: PlayerProfile[]) {
  if (!showsCrossingTendency(player)) return null;
  const volume = crossingVolumePer90(player);
  if (volume == null) return null;
  const pool = (players.length ? players : [player]).filter((item) => item.position_family === player.position_family);
  const volumes = (pool.length ? pool : [player])
    .map(crossingVolumePer90)
    .filter((value): value is number => value != null);
  const average = mean(volumes);
  if (average == null) return null;
  return {
    volume,
    average,
    scale: crossingScale(volumes, volume, average),
  };
}
