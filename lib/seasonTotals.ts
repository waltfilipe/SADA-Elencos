/** Counts stored for the whole season, not as a per-90 rate. */
const SEASON_TOTALS = new Set([
  "gols",
  "xg",
  "xa",
  "pré assistências",
  "pre assistências",
  "assistências",
  "assistencias",
  "erros totais",
]);

const PLAIN_LABELS = new Set([
  "eficiência",
  "eficiência defensiva",
  "índice de eficiência",
  "erros totais",
  "eficiência de finalização",
]);

export function isSeasonTotalLabel(label: string): boolean {
  return SEASON_TOTALS.has(label.trim().toLowerCase());
}

/** Volume rows are per 90. Season totals and efficiency lines keep their own name. */
export function statRowLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "aéreo" || normalized === "aereo") return "Duelos Aéreos/90";
  if (PLAIN_LABELS.has(normalized) || isSeasonTotalLabel(label)) return label;
  if (label.includes("%") || label.includes(" / ") || label.includes("/90") || label.includes("/ 90")) return label;
  return `${label}/90`;
}
