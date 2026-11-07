"use client";

import { useId, useState } from "react";

import { resolveAspectBadge } from "@/lib/aspectBadges";
import { clampPercent, percentileBarFillStyle, statValueStyle } from "@/lib/scoutTheme";
import { STAT_TOOLTIPS } from "@/lib/statTooltips";
import type { AspectItem } from "@/lib/types";
import { AccuracyBadge } from "./AccuracyBadge";

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="aspect-chevron">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MetricBar({
  label,
  pct,
  value,
  muted = false,
}: {
  label: string;
  pct: number;
  value?: string;
  muted?: boolean;
}) {
  return (
    <div className={`aspect-bar-row ${muted ? "aspect-bar-row-muted" : ""}`}>
      <div className="aspect-bar-head">
        <span className="aspect-bar-label">{label}</span>
        <span className="aspect-bar-value" style={statValueStyle(pct)}>
          {value ?? "—"}
        </span>
      </div>
      <div className="aspect-stat-bar aspect-metric-bar aspect-stat-bar-gradient" aria-hidden>
        <i style={percentileBarFillStyle(pct)} />
      </div>
    </div>
  );
}

function HeaderBadge({ item }: { item: AspectItem }) {
  const badge = resolveAspectBadge(item);
  if (!badge) return null;
  return <AccuracyBadge badge={badge} size={15} showLabel={false} />;
}

function volumeLabel(item: AspectItem): string {
  if (item.kind === "pass_certos") {
    return item.label;
  }
  return item.label;
}

function ExpandableBody({ item }: { item: AspectItem }) {
  if ((item.kind === "def_efficiency_group" || item.kind === "metric_group") && item.sub_metrics?.length) {
    return (
      <div className="aspect-expand-body">
        {item.sub_metrics.map((sub) => (
          <MetricBar
            key={sub.label}
            label={sub.label}
            pct={sub.percentile}
            value={sub.display_value}
            muted={item.kind === "def_efficiency_group" && sub.label !== "Eficiência Defensiva"}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="aspect-expand-body">
      <MetricBar label={volumeLabel(item)} pct={item.percentile ?? 0} value={displayValue(item)} />
      {item.efficiency_pct != null ? (
        <MetricBar
          label="Eficiência"
          pct={item.efficiency_pct}
          value={item.efficiency_value ?? undefined}
        />
      ) : null}
    </div>
  );
}

function displayValue(item: AspectItem): string {
  if (item.display_value) return item.display_value;
  if (item.certos_per90 != null) return item.certos_per90.toFixed(1).replace(".", ",");
  return "—";
}

export function ExpandableAspectCard({ item, defaultOpen = false }: { item: AspectItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const badge = resolveAspectBadge(item);

  return (
    <li
      className={[
        "aspect-row aspect-row-expand",
        open ? "is-open" : "",
        badge ? `has-medal has-medal-${badge}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="aspect-row-trigger aspect-row-expand-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="aspect-name">
          {item.label}
          {STAT_TOOLTIPS[item.label] ? (
            <span
              className="stat-info"
              tabIndex={0}
              role="button"
              aria-label={STAT_TOOLTIPS[item.label]}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <span className="stat-info-bubble" role="tooltip">
                {STAT_TOOLTIPS[item.label]}
              </span>
            </span>
          ) : null}
        </span>
        <span className="aspect-row-end">
          <HeaderBadge item={item} />
          <Chevron />
        </span>
      </button>

      {open ? (
        <div id={panelId} className="aspect-expand-panel">
          <ExpandableBody item={item} />
        </div>
      ) : null}
    </li>
  );
}

export function ExpandableAspectCardList({
  items,
  defaultOpenIndex = -1,
}: {
  items: AspectItem[];
  defaultOpenIndex?: number;
}) {
  return (
    <>
      {items.map((item, index) => (
        <ExpandableAspectCard key={item.label} item={item} defaultOpen={index === defaultOpenIndex} />
      ))}
    </>
  );
}
