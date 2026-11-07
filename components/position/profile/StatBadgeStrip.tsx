"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import type { StatSectionTone } from "@/lib/aspectStatSections";
import type { StatMetricBadge } from "@/lib/statBadges";

export type TonedStatBadge = StatMetricBadge & { tone: StatSectionTone };

type StripProps = {
  badges: StatMetricBadge[];
  tone: StatSectionTone;
  size?: "sm" | "md";
};

export function StatBadgeStrip({ badges, tone, size = "sm" }: StripProps) {
  if (!badges.length) {
    return <span className="stat-badge-strip stat-badge-strip-empty">Nenhum badge nesta seção</span>;
  }

  return (
    <div
      className={`stat-badge-strip tone-${tone}${size === "md" ? " stat-badge-strip-md" : ""}`}
      role="list"
      aria-label="Selos conquistados"
    >
      {badges.map((badge) => (
        <StatBadgeChip key={badge.key} badge={badge} tone={tone} />
      ))}
    </div>
  );
}

type ChipProps = {
  badge: StatMetricBadge;
  tone: StatSectionTone;
};

export function StatBadgeChip({ badge, tone }: ChipProps) {
  return (
    <Tooltip content={badge.title}>
      <span className={`stat-badge-chip tone-${tone}`} role="listitem" title={badge.title}>
        <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

type CatalogProps = {
  badges: TonedStatBadge[];
  hideLabel?: boolean;
};

export function PlayerBadgesSection({ badges, hideLabel = false }: CatalogProps) {
  return (
    <section className="player-badges-section" aria-label="Selos do atleta">
      {hideLabel ? null : <h4 className="stats-subsection-label">Selos</h4>}
      {badges.length === 0 ? (
        <p className="player-badges-empty">Nenhum badge conquistado</p>
      ) : (
        <div className="player-badges-catalog" role="list">
          {badges.map((badge) => (
            <Tooltip key={badge.key} content={badge.label}>
              <span className={`player-badge-item tone-${badge.tone}`} role="listitem" title={badge.label}>
                <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
              </span>
            </Tooltip>
          ))}
        </div>
      )}
    </section>
  );
}

type MedalCountProps = {
  count: number;
};

export function StatMedalCount({ count }: MedalCountProps) {
  if (count <= 0) return null;

  return (
    <span className="stat-medal-count" title={`${count} medalha${count === 1 ? "" : "s"}`}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className="fa-solid fa-medal" aria-hidden="true" />
      ))}
    </span>
  );
}
