import type { LeagueId } from "@/lib/leagues";
import type { ScatterPoint } from "@/components/scatter/ScatterPlot";
import type { PositionFamily } from "@/lib/types";

export type SavedScatterChart = {
  id: string;
  xKey: string;
  yKey: string;
  /** Rótulos resolvidos no momento do save (com sufixo /90 quando aplicável). */
  xLabel?: string;
  yLabel?: string;
  /** Slot A / B / C — empty string when unset. */
  athleteIds: [string, string, string];
  savedAt: number;
  /**
   * Snapshot dos pontos renderizados no save — o PDF reproduz exatamente o
   * gráfico visto na tela (pool filtrado por minutos, projeção EB, média
   * ponderada multi-temporada). Gráficos salvos antes deste campo caem no
   * rebuild a partir do pool.
   */
  points?: ScatterPoint[];
  avgX?: number;
  avgY?: number;
};

const MAX_SAVED = 3;

function storageKey(league: LeagueId, family: PositionFamily) {
  return `${league}-scout:scatter-saved:${family}`;
}

export function readSavedScatterCharts(league: LeagueId, family: PositionFamily): SavedScatterChart[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(storageKey(league, family));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedScatterChart[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function writeSavedScatterCharts(
  league: LeagueId,
  family: PositionFamily,
  charts: SavedScatterChart[],
): SavedScatterChart[] {
  if (typeof window === "undefined") return charts;
  const next = charts.slice(0, MAX_SAVED);
  sessionStorage.setItem(storageKey(league, family), JSON.stringify(next));
  return next;
}

export function scatterSavedLimit() {
  return MAX_SAVED;
}

/** Same axes and highlighted athletes (order-independent). */
export function isDuplicateScatterSave(
  charts: SavedScatterChart[],
  xKey: string,
  yKey: string,
  athleteIds: [string, string, string],
): boolean {
  const norm = normalizeAthleteIds(athleteIds);
  return charts.some((chart) => chart.xKey === xKey && chart.yKey === yKey && normalizeAthleteIds(chart.athleteIds) === norm);
}

function normalizeAthleteIds(ids: [string, string, string]): string {
  return ids
    .filter(Boolean)
    .slice()
    .sort()
    .join("|");
}

export function highlightedAthleteIds(charts: SavedScatterChart[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chart of charts) {
    for (const id of chart.athleteIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function newSavedChartId(): string {
  return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
