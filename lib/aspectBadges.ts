import type { AccuracyBadgeKind } from "@/lib/types";

/**
 * Pool percentile cutoffs aligned with scouting convention:
 * P90 (top 10%), P75 (top quartile), P50 (above median).
 */
const P90 = 90;
const P75 = 75;
const P50 = 50;

/** Badge when volume AND efficiency both exceed pool thresholds. */
export function dualMetricBadge(volumePct: number, efficiencyPct?: number | null): AccuracyBadgeKind | null {
  if (efficiencyPct == null) return null;
  const floor = Math.min(volumePct, efficiencyPct);
  if (floor > P90) return "gold";
  if (floor > P75) return "silver";
  if (floor > P50) return "bronze";
  return null;
}

export function pairBadge(a: number, b: number): AccuracyBadgeKind | null {
  return dualMetricBadge(a, b);
}

/** Single-metric badge (e.g. conduções progressivas / volume-only stats). */
export function volumeBadge(volumePct: number): AccuracyBadgeKind | null {
  if (volumePct > P90) return "gold";
  if (volumePct > P75) return "silver";
  if (volumePct > P50) return "bronze";
  return null;
}

function metricGroupBadge(item: {
  sub_metrics?: { label: string; percentile: number }[];
  pair_badge?: number[] | null;
}): AccuracyBadgeKind | null {
  if (item.pair_badge) {
    return pairBadge(item.pair_badge[0], item.pair_badge[1]);
  }
  const subs = item.sub_metrics;
  if (!subs?.length) return null;

  const qualSub = subs.find(
    (s) => s.label === "Eficiência" || s.label === "Eficiência Defensiva" || s.label === "xG",
  );
  if (qualSub) {
    const volSub = subs.find((s) => s !== qualSub);
    if (volSub) return dualMetricBadge(volSub.percentile, qualSub.percentile);
  }
  if (subs.length === 2) {
    return pairBadge(subs[0].percentile, subs[1].percentile);
  }
  return null;
}

export function resolveAspectBadge(item: {
  label: string;
  kind?: string;
  percentile?: number;
  efficiency_pct?: number;
  pair_badge?: number[] | null;
  sub_metrics?: { label: string; percentile: number }[];
}): AccuracyBadgeKind | null {
  if (item.kind === "def_efficiency_group" && item.pair_badge?.length) {
    // Eficiência Defensiva: selo só quando TODOS os componentes (erros,
    // ações sem bola e índice) ficam acima da mediana do pool.
    const parts = item.pair_badge;
    if (parts.some((p) => p <= P50)) return null;
    const floor = Math.min(...parts);
    if (floor > P90) return "gold";
    if (floor > P75) return "silver";
    return "bronze";
  }
  if (item.kind === "metric_group") {
    const groupBadge = metricGroupBadge(item);
    if (groupBadge) return groupBadge;
  }
  if (item.efficiency_pct != null && item.percentile != null) {
    return dualMetricBadge(item.percentile, item.efficiency_pct);
  }
  if (item.label === "Conduções Progressivas" && item.percentile != null) {
    return volumeBadge(item.percentile);
  }
  return null;
}
