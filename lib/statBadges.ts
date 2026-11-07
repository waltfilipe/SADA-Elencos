import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { aspectQualityPercentile, aspectQuantityPercentile } from "@/lib/aspectGrades";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

export const STAT_BADGE_THRESHOLD = 50;

export type StatMetricBadge = {
  key: string;
  label: string;
  icon: string;
  title: string;
};

export const METRIC_BADGE_CATALOG: Record<string, Omit<StatMetricBadge, "key">> = {
  "Duelos Defensivos": {
    label: "Duelos Defensivos",
    icon: "fa-shield-halved",
    title: "Duelos defensivos — volume e eficiência acima de P50",
  },
  "Ações Defensivas": {
    label: "Ações Defensivas",
    icon: "fa-shield",
    title: "Ações defensivas — rebatidas, interceptações e bloqueios acima de P50",
  },
  "Ações Defensivas e Recuperações": {
    label: "Ações Def. e Recuperações",
    icon: "fa-shield",
    title: "Ações defensivas e recuperações — rebatidas, interceptações, bloqueios e bolas recuperadas acima de P50",
  },
  "Recuperações": {
    label: "Recuperações",
    icon: "fa-rotate-left",
    title: "Bolas recuperadas por 90 acima de P50",
  },
  "Eficiência Defensiva": {
    label: "Eficiência Defensiva",
    icon: "fa-shield-virus",
    title: "Eficiência defensiva — erros e z-score vs pool acima de P50",
  },
  "Duelos Aéreos": {
    label: "Duelos Aéreos",
    icon: "fa-cloud",
    title: "Duelos aéreos — volume e eficiência acima de P50",
  },
  Aéreo: {
    label: "Aéreo",
    icon: "fa-feather-pointed",
    title: "Duelo aéreo — volume e eficiência acima de P50",
  },
  "Passes Progressivos": {
    label: "Passes Progressivos",
    icon: "fa-forward",
    title: "Passes progressivos — volume e eficiência acima de P50",
  },
  "Passes para Terço Final": {
    label: "Passes para Terço Final",
    icon: "fa-arrow-right-to-bracket",
    title: "Passes para terço final — volume e eficiência acima de P50",
  },
  "Passes Longos": {
    label: "Passes Longos",
    icon: "fa-arrows-left-right",
    title: "Passes longos — volume e eficiência acima de P50",
  },
  Distribuição: {
    label: "Distribuição",
    icon: "fa-share-nodes",
    title: "Distribuição de passe — ambas métricas acima de P50",
  },
  "Disputas com Bola": {
    label: "Disputas com Bola",
    icon: "fa-bolt",
    title: "Disputas com bola — volume e eficiência acima de P50",
  },
  "1v1 - Ofensivo": {
    label: "1v1 - Ofensivo",
    icon: "fa-person-running",
    title: "1v1 ofensivo — volume e eficiência acima de P50",
  },
  "Conduções Progressivas": {
    label: "Conduções Progressivas",
    icon: "fa-road",
    title: "Conduções progressivas — volume acima de P50",
  },
  Progressão: {
    label: "Progressão",
    icon: "fa-arrow-trend-up",
    title: "Progressão com bola — volume acima de P50",
  },
  Cruzamentos: {
    label: "Cruzamentos",
    icon: "fa-crosshairs",
    title: "Cruzamentos — ambas métricas acima de P50",
  },
  "Passes Chave e Área": {
    label: "Passes Chave e Área",
    icon: "fa-key",
    title: "Passes chave e área — ambas métricas acima de P50",
  },
  "Pré Assistências e xA": {
    label: "Pré Assistências e xA",
    icon: "fa-handshake",
    title: "Pré assistências e xA — ambas métricas acima de P50",
  },
  "Passes Criativos": {
    label: "Passes Criativos",
    icon: "fa-wand-magic-sparkles",
    title: "Passes criativos — volume e eficiência acima de P50",
  },
  "Gols e xG": {
    label: "Gols e xG",
    icon: "fa-futbol",
    title: "Gols e xG — ambas métricas acima de P50",
  },
  Finalizações: {
    label: "Finalizações",
    icon: "fa-bullseye",
    title: "Finalizações — ambas métricas acima de P50",
  },
  Efetividade: {
    label: "Efetividade",
    icon: "fa-percent",
    title: "Efetividade — finalizações certas por passe recebido e gols por toque na área acima de P50",
  },
  Ofensividade: {
    label: "Ofensividade",
    icon: "fa-fire",
    title: "Ofensividade — ambas métricas acima de P50",
  },
  "Ações Terminais": {
    label: "Ações Terminais",
    icon: "fa-burst",
    title: "Ações terminais — ambas métricas acima de P50",
  },
  Verticalidade: {
    label: "Verticalidade",
    icon: "fa-arrow-up",
    title: "Verticalidade — ambas métricas acima de P50",
  },
  "Duelos Vencidos": {
    label: "Duelos Vencidos",
    icon: "fa-hand-fist",
    title: "Duelos vencidos — volume e eficiência acima de P50",
  },
};

function num(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function aboveThreshold(value: number | undefined): boolean {
  return value != null && value > STAT_BADGE_THRESHOLD;
}

/** Miniblock badge: every sub-metric percentile must be above P50. */
function metricGroupEarnsBadge(item: AspectItem): boolean {
  const subs = item.sub_metrics ?? [];
  if (subs.length < 2) return false;
  return subs.every((sub) => aboveThreshold(num(sub.percentile)));
}

/** Player earns a stat badge when quantity and efficiency (when available) are both > P50. */
export function metricEarnsStatBadge(item: AspectItem, displayLabel?: string): boolean {
  if (item.kind === "metric_group") {
    return metricGroupEarnsBadge(item);
  }

  const qty = aspectQuantityPercentile(item);
  if (!aboveThreshold(qty)) return false;

  const qual = aspectQualityPercentile(item);
  if (qual == null) {
    return aboveThreshold(qty);
  }
  return aboveThreshold(qual);
}

export function statBadgeForMetric(item: AspectItem, displayLabel?: string): StatMetricBadge | null {
  const label = displayLabel ?? item.label;
  const meta = METRIC_BADGE_CATALOG[label] ?? METRIC_BADGE_CATALOG[item.label];
  if (!meta || !metricEarnsStatBadge(item, label)) return null;
  return { key: label, ...meta };
}

export function earnedStatBadges(items: AspectItem[], groupTitleByItem?: Map<string, string>): StatMetricBadge[] {
  const badges: StatMetricBadge[] = [];
  const seenKeys = new Set<string>();
  const seenIcons = new Set<string>();

  for (const item of items) {
    const displayLabel = groupTitleByItem?.get(item.label) ?? item.label;
    const badge = statBadgeForMetric(item, displayLabel);
    if (!badge || seenKeys.has(badge.key) || seenIcons.has(badge.icon)) continue;
    seenKeys.add(badge.key);
    seenIcons.add(badge.icon);
    badges.push(badge);
  }

  return badges;
}

export type FamilyBadgeOption = StatMetricBadge & { tone: StatSectionTone };

/** Badges that can appear for a position, in the same order as the profile stats. */
export function badgeCatalogForFamily(family: PositionFamily): FamilyBadgeOption[] {
  const options: FamilyBadgeOption[] = [];
  const seenLabels = new Set<string>();
  const seenIcons = new Set<string>();
  for (const section of statSectionsForFamily(family)) {
    for (const label of section.labels) {
      const meta = METRIC_BADGE_CATALOG[label];
      if (!meta || seenLabels.has(label) || seenIcons.has(meta.icon)) continue;
      seenLabels.add(label);
      seenIcons.add(meta.icon);
      options.push({ key: label, tone: section.tone, ...meta });
    }
  }
  return options;
}

/** Badges this athlete actually earned, using the position-page sections. */
export function playerStatBadges(player: PlayerProfile): StatMetricBadge[] {
  const all = flattenAspects(player);
  const badges: StatMetricBadge[] = [];
  const seenLabels = new Set<string>();
  const seenIcons = new Set<string>();
  for (const section of statSectionsForFamily(player.position_family)) {
    for (const label of section.labels) {
      const item = findAspect(all, label);
      if (!item || seenLabels.has(label)) continue;
      const badge = statBadgeForMetric(item, label);
      if (!badge || seenIcons.has(badge.icon)) continue;
      seenLabels.add(label);
      seenIcons.add(badge.icon);
      badges.push(badge);
    }
  }
  return badges;
}
