"use client";

import { MEDAL_META } from "@/lib/scoutTheme";
import type { AccuracyBadgeKind } from "@/lib/types";
import { MedalBadge } from "./MedalBadge";

const META: Record<AccuracyBadgeKind, { label: string; short: string; rank: string }> = {
  gold: {
    label: `${MEDAL_META.gold.label} · volume e eficiência`,
    short: "Elite",
    rank: "P90+",
  },
  silver: {
    label: `${MEDAL_META.silver.label} · volume e eficiência`,
    short: "Alto",
    rank: "P75+",
  },
  bronze: {
    label: `${MEDAL_META.bronze.label} · volume e eficiência`,
    short: "Sólido",
    rank: "P50+",
  },
};

type Props = {
  badge: AccuracyBadgeKind;
  size?: number;
  showLabel?: boolean;
};

export function AccuracyBadge({ badge, size = 16, showLabel = true }: Props) {
  const meta = META[badge];

  return (
    <span className={`accuracy-badge accuracy-badge-${badge}`} title={meta.label}>
      <MedalBadge medal={badge} size={size} title={meta.label} />
      {showLabel ? (
        <span className="accuracy-badge-label">
          {meta.short}
          <span className="accuracy-badge-rank">{meta.rank}</span>
        </span>
      ) : null}
    </span>
  );
}
