import type { LeagueId } from "@/lib/leagues";

export type ContractFilter = "all" | "lt6" | "lt12" | "gte12" | "none";
export type MarketFilter = "all" | "lt500k" | "500k-2m" | "2m-6m" | "gte6m" | "none";

export type SavedFilters = {
  family: string;
  query: string;
  club: string;
  origin: "all" | "br" | "out";
  foot: string;
  profiles: string[];
  badges: string[];
  sort: string;
  age: [number, number];
  height: [number, number];
  minutes: [number, number];
  contract?: ContractFilter;
  market?: MarketFilter;
  /** Active per-stat ranges ("Duelos Defensivos/90" → [min, max]). */
  stats?: Record<string, [number, number]>;
};

const CONTRACT_FILTERS: ContractFilter[] = ["all", "lt6", "lt12", "gte12", "none"];
const MARKET_FILTERS: MarketFilter[] = ["all", "lt500k", "500k-2m", "2m-6m", "gte6m", "none"];

export function isContractFilter(value: unknown): value is ContractFilter {
  return typeof value === "string" && CONTRACT_FILTERS.includes(value as ContractFilter);
}

export function isMarketFilter(value: unknown): value is MarketFilter {
  return typeof value === "string" && MARKET_FILTERS.includes(value as MarketFilter);
}

function keys(league: LeagueId) {
  return {
    state: `${league}-scout:filters-state`,
    restore: `${league}-scout:filters-restore`,
  };
}

export function saveFilters(league: LeagueId, state: SavedFilters) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(keys(league).state, JSON.stringify(state));
}

export function markFiltersReturn(league: LeagueId) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(keys(league).restore, "1");
}

export function takeFiltersReturn(league: LeagueId): SavedFilters | null {
  if (typeof window === "undefined") return null;
  const { state, restore } = keys(league);
  if (sessionStorage.getItem(restore) !== "1") return null;
  sessionStorage.removeItem(restore);
  const raw = sessionStorage.getItem(state);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedFilters;
  } catch {
    return null;
  }
}
