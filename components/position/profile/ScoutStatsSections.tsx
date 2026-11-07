"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import { isProjectionEligible, realisticProjection } from "@/lib/minuteProjection";
import { statRowLabel } from "@/lib/seasonTotals";
import { STAT_TOOLTIPS } from "@/lib/statTooltips";
import { earnedStatBadges, statBadgeForMetric } from "@/lib/statBadges";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";
import { PlayerBadgesSection, StatBadgeChip, StatMedalCount, type TonedStatBadge } from "./StatBadgeStrip";

function metricValue(value?: string | null): string {
  return value ?? "—";
}

function volumeRowLabel(item: AspectItem): string {
  return statRowLabel(item.label);
}

export type StatEdge = "up" | "down" | null;

function StatEdgeMark({ edge }: { edge?: StatEdge }) {
  if (!edge) return null;
  const more = edge === "up";
  return (
    <i
      className={`fa-solid fa-arrow-${edge} stat-edge stat-edge-${edge}`}
      aria-label={more ? "Mais que o outro atleta" : "Menos que o outro atleta"}
    />
  );
}

function StatInfoTip({ label }: { label: string }) {
  const tip = STAT_TOOLTIPS[label];
  if (!tip) return null;
  return (
    <span className="stat-info" tabIndex={0} aria-label={tip}>
      <i className="fa-solid fa-circle-info" aria-hidden="true" />
      <span className="stat-info-bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

function StatMetricRow({
  label,
  value,
  percentile,
  edge,
}: {
  label: string;
  value?: string | null;
  percentile?: number | null;
  edge?: StatEdge;
}) {
  return (
    <div className="stat-metric-row">
      <div className="stat-metric-head">
        <span className="stat-metric-label">
          {label}
          <StatEdgeMark edge={edge} />
        </span>
        <span className="stat-metric-value tabular">{metricValue(value)}</span>
      </div>
      <MetricGradientBar score={percentile ?? null} scale="percent" />
    </div>
  );
}

function StatAspectBlock({
  item,
  groupTitle,
  tone,
  volumeEdge,
  efficiencyEdge,
  subEdges,
}: {
  item: AspectItem;
  groupTitle?: string;
  tone: StatSectionTone;
  volumeEdge?: StatEdge;
  efficiencyEdge?: StatEdge;
  subEdges?: Record<string, StatEdge>;
}) {
  const hasSubMetrics =
    (item.kind === "def_efficiency_group" || item.kind === "metric_group") &&
    Boolean(item.sub_metrics?.length);
  const title = groupTitle ?? item.label;
  const badge = statBadgeForMetric(item, title);
  const hasBadge = Boolean(badge);

  return (
    <div className={`stat-aspect-group${hasBadge ? " has-stat-badge" : ""}`}>
      <div className="stat-aspect-group-head">
        <span className="stat-aspect-group-title">
          {title}
          <StatInfoTip label={item.label} />
          <StatInfoTip label={title} />
          {badge ? <StatBadgeChip badge={badge} tone={tone} /> : null}
        </span>
      </div>
      <div className="stat-aspect-group-body">
        {hasSubMetrics ? (
          item.sub_metrics!.map((sub: AspectSubMetric) => (
            <StatMetricRow
              key={sub.label}
              label={statRowLabel(sub.label)}
              value={metricValue(sub.display_value)}
              percentile={sub.percentile}
              edge={subEdges?.[sub.label]}
            />
          ))
        ) : (
          <>
            <StatMetricRow
              label={volumeRowLabel(item)}
              value={metricValue(
                item.display_value ?? (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : undefined),
              )}
              percentile={item.percentile}
              edge={volumeEdge}
            />
            {item.efficiency_pct != null ? (
              <StatMetricRow
                label="Eficiência"
                value={item.efficiency_value}
                percentile={item.efficiency_pct}
                edge={efficiencyEdge}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

type SectionEntry = {
  title: string;
  tone: StatSectionTone;
  badges: ReturnType<typeof earnedStatBadges>;
  metrics: { item: AspectItem; groupTitle?: string }[];
};

function aspectNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Soma duelos + rebatidas + interceptações + chutes bloqueados de uma linha. */
function totalDefensiveActionsValue(all: AspectItem[]): number | null {
  const duels = findAspect(all, "Duelos Defensivos") ?? findAspect(all, "Duelos Vencidos");
  const actions = findAspect(all, "Ações Defensivas");
  const duelsVal = aspectNumber(duels?.display_value);
  const subs = actions?.sub_metrics ?? [];
  const actionsVal = subs.length
    ? subs.reduce((sum, sub) => sum + (aspectNumber(sub.display_value) ?? 0), 0)
    : aspectNumber(actions?.display_value);
  if (duelsVal == null && actionsVal == null) return null;
  return (duelsVal ?? 0) + (actionsVal ?? 0);
}

/** Percentil denso no pool (empates dividem a posição média). */
function densePoolPercentile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n <= 1) return 50;
  const less = sorted.filter((v) => v < value).length;
  const equal = sorted.filter((v) => v === value).length;
  return ((less + (equal - 1) / 2) / (n - 1)) * 100;
}

/**
 * Ações Defensivas Totais/90 = duelos defensivos + rebatidas + interceptações
 * + chutes bloqueados. Sintetizado por render — os aspectos só trazem as partes.
 */
function totalDefensiveActionsItem(all: AspectItem[], pool?: PlayerProfile[]): AspectItem | null {
  const total = totalDefensiveActionsValue(all);
  if (total == null) return null;
  const item: AspectItem = {
    label: "Ações Defensivas",
    grade: "",
    stats: [],
    display_value: String(Math.round(total * 10) / 10).replace(".", ","),
  };
  const poolTotals = pool
    ?.map((peer) => totalDefensiveActionsValue(flattenAspects(peer)))
    .filter((value): value is number => value != null);
  if (poolTotals && poolTotals.length > 1) {
    item.percentile = Math.round(densePoolPercentile(poolTotals, total) * 10) / 10;
  }
  return item;
}

function sectionEntries(player: PlayerProfile, family: PositionFamily, pool?: PlayerProfile[]): SectionEntry[] {
  const all = flattenAspects(player);
  const sections = statSectionsForFamily(family);
  const meiasOfensivos = family === "extremos";
  const list: SectionEntry[] = [];
  for (const section of sections) {
    const metrics: SectionEntry["metrics"] = [];
    const titleByItem = new Map<string, string>();
    for (const label of section.labels) {
      const item = findAspect(all, label);
      if (!item) continue;
      // Meias ofensivos: "Ações Defensivas" vira o total (inclui duelos).
      if (meiasOfensivos && section.tone === "defensivos" && item.label === "Ações Defensivas") continue;
      let displayItem = item;
      let groupTitle = label === "Conduções Progressivas" ? "Progressão" : undefined;
      // Meias ofensivos: o bloco defensivo mostra "Duelos Defensivos".
      if (meiasOfensivos && section.tone === "defensivos" && item.label === "Duelos Vencidos") {
        displayItem = { ...item, label: "Duelos Defensivos" };
      }
      if (groupTitle) titleByItem.set(item.label, groupTitle);
      metrics.push({ item: displayItem, groupTitle });
    }
    if (meiasOfensivos && section.tone === "defensivos") {
      const totalItem = totalDefensiveActionsItem(all, pool);
      const duelsIndex = metrics.findIndex((metric) => !/efici[eê]ncia/i.test(metric.item.label));
      const insertAt = duelsIndex >= 0 ? duelsIndex + 1 : metrics.length;
      if (totalItem) metrics.splice(insertAt, 0, { item: totalItem });
    }
    if (!metrics.length) continue;
    list.push({
      title: section.title,
      tone: section.tone,
      badges: earnedStatBadges(metrics.map((metric) => metric.item), titleByItem),
      metrics,
    });
  }
  return list;
}

export function StatWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <h3>{title}</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <div className="stat-window-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StatSectionPanel({
  player,
  family,
  title,
  peers = NO_PEERS,
  heading,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  title: string;
  peers?: PlayerProfile[];
  heading?: string;
}) {
  const entry = useMemo(
    () => sectionEntries(player, family, peers).find((item) => item.title === title) ?? null,
    [player, family, title, peers],
  );
  const peerAspects = useMemo(() => peers.map((peer) => flattenAspects(peer)), [peers]);

  if (!entry) return null;

  function peerValues(itemLabel: string, kind: "volume" | "efficiency", subLabel?: string): Array<number | null> {
    return peerAspects.map((aspects) => {
      const item = findAspect(aspects, itemLabel);
      if (!item) return null;
      if (subLabel) return item.sub_metrics?.find((sub) => sub.label === subLabel)?.percentile ?? null;
      if (kind === "efficiency") return item.efficiency_pct ?? null;
      return item.percentile ?? null;
    });
  }

  return (
    <section className="stat-window-column" aria-label={heading ?? player.name}>
      {heading ? <h4>{heading}</h4> : null}
      <div className="stat-cards-stack">
        {entry.metrics.map(({ item, groupTitle }) => {
          const subEdges: Record<string, StatEdge> = {};
          for (const sub of item.sub_metrics ?? []) {
            subEdges[sub.label] = edgeAgainst(sub.percentile, peerValues(item.label, "volume", sub.label));
          }
          return (
            <StatAspectBlock
              key={item.label}
              item={item}
              groupTitle={groupTitle}
              tone={entry.tone}
              volumeEdge={edgeAgainst(item.percentile, peerValues(item.label, "volume"))}
              efficiencyEdge={edgeAgainst(item.efficiency_pct, peerValues(item.label, "efficiency"))}
              subEdges={subEdges}
            />
          );
        })}
      </div>
    </section>
  );
}

const NO_PEERS: PlayerProfile[] = [];

function edgeAgainst(mine: number | null | undefined, others: Array<number | null | undefined>): StatEdge {
  const peers = others.filter((value): value is number => value != null);
  if (mine == null || !peers.length) return null;
  const highest = Math.max(...peers);
  const lowest = Math.min(...peers);
  if (mine > highest) return "up";
  if (mine < lowest) return "down";
  return null;
}

export function StatSectionsBoard({
  player,
  family,
  pool,
  showBadges = true,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  pool?: PlayerProfile[];
  showBadges?: boolean;
}) {
  const entries = useMemo(() => sectionEntries(player, family, pool), [player, family, pool]);
  const [openTitles, setOpenTitles] = useState<Set<string>>(() => new Set());
  const allBadges = useMemo<TonedStatBadge[]>(
    () => entries.flatMap((entry) => entry.badges.map((badge) => ({ ...badge, tone: entry.tone }))),
    [entries],
  );

  useEffect(() => {
    setOpenTitles(new Set());
  }, [player.player_id]);

  const toggle = (title: string) => {
    setOpenTitles((current) => (current.size === 1 && current.has(title) ? new Set() : new Set([title])));
  };

  return (
    <div className="projection-board">
      {showBadges ? <PlayerBadgesSection badges={allBadges} /> : null}
      <div className="projection-groups">
        {entries.map((entry) => {
          const open = openTitles.has(entry.title);
          return (
            <section key={entry.title} className={`projection-group${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="projection-group-toggle"
                aria-expanded={open}
                onClick={() => toggle(entry.title)}
              >
                <span className="projection-group-title">{entry.title}</span>
                <i className={`fa-solid fa-chevron-${open ? "up" : "down"}`} aria-hidden="true" />
              </button>
              {open ? (
                <div className="stat-cards-stack">
                  {entry.metrics.map(({ item, groupTitle }) => (
                    <StatAspectBlock
                      key={`${entry.title}-${item.label}`}
                      item={item}
                      groupTitle={groupTitle}
                      tone={entry.tone}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ScoutStatsSections({
  player,
  family,
  players,
  projectionSource,
  disableProjection = false,
  active: activeProp,
  onActiveChange,
  peers = NO_PEERS,
  radarView,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players?: PlayerProfile[];
  /** When set, a switch toggles between stats/badges and this radar. */
  radarView?: ReactNode;
  /** When set, projection M7 uses this player (2026 scout) while stats show `player`. */
  projectionSource?: PlayerProfile;
  disableProjection?: boolean;
  active?: string | null;
  onActiveChange?: (title: string | null) => void;
  peers?: PlayerProfile[];
}) {
  const [localActive, setLocalActive] = useState<string | null>(null);
  const [projectionOn, setProjectionOn] = useState(false);
  const [view, setView] = useState<"stats" | "radar">("stats");
  const showRadar = Boolean(radarView) && view === "radar";
  const active = onActiveChange ? (activeProp ?? null) : localActive;
  const setActive = (title: string | null) => {
    if (onActiveChange) onActiveChange(title);
    else setLocalActive(title);
  };
  const projectionSubject = projectionSource ?? player;
  const projection = useMemo(
    () =>
      !disableProjection && players && isProjectionEligible(projectionSubject)
        ? realisticProjection(projectionSubject, players)
        : null,
    [disableProjection, projectionSubject, players],
  );
  const shown = projectionOn && projection ? projection.profile : player;
  const entries = useMemo(() => sectionEntries(shown, family, players), [shown, family, players]);
  const allBadges = useMemo<TonedStatBadge[]>(
    () => entries.flatMap((entry) => entry.badges.map((badge) => ({ ...badge, tone: entry.tone }))),
    [entries],
  );
  const activeEntry = active ? entries.find((entry) => entry.title === active) ?? null : null;

  useEffect(() => {
    setProjectionOn(false);
  }, [player.player_id]);

  return (
    <div className={`stats-swap-panel${projectionOn ? " is-projection" : ""}`} key={`${player.player_id}-index`}>
      <div className="profile-card-head">
        <div className="stats-head-title">
          {radarView ? (
            <div className="stats-view-switch" role="tablist" aria-label="Visualização">
              <button
                type="button"
                role="tab"
                aria-selected={!showRadar}
                className={!showRadar ? "is-active" : undefined}
                onClick={() => setView("stats")}
              >
                Estatísticas e Selos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showRadar}
                className={showRadar ? "is-active" : undefined}
                onClick={() => setView("radar")}
              >
                Radar de Perfil Estatístico
              </button>
            </div>
          ) : (
            <h3 className="section-label">Estatísticas e selos</h3>
          )}
          {projection && !showRadar ? (
            <button
              type="button"
              className={`projection-mini${projectionOn ? " is-on" : ""}`}
              aria-pressed={projectionOn}
              onClick={() => {
                setProjectionOn((current) => !current);
                setActive(null);
              }}
            >
              <i className="fa-solid fa-forward" aria-hidden="true" />
              Projeção
            </button>
          ) : null}
        </div>
      </div>

      {showRadar ? (
        <div className="stats-radar-body">{radarView}</div>
      ) : (
      <div className="stats-and-badges-body">
        <PlayerBadgesSection badges={allBadges} />

        <section className="stats-subsection" aria-label="Estatísticas por grupo">
          <h4 className="stats-subsection-label">Estatísticas</h4>
          <div className="stats-nav-grid">
            {entries.map((entry) => {
              const open = active === entry.title;
              return (
                <button
                  key={entry.title}
                  type="button"
                  className={`stats-nav-row tone-${entry.tone}${open ? " is-open" : ""}`}
                  aria-expanded={open}
                  onClick={() => setActive(open ? null : entry.title)}
                >
                  <span className="stats-nav-row-title">{entry.title}</span>
                  <span className="stats-nav-row-meta">
                    <StatMedalCount count={entry.badges.length} />
                    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      )}

      {!onActiveChange && activeEntry ? (
        <StatWindow title={activeEntry.title} onClose={() => setActive(null)}>
          <StatSectionPanel player={shown} family={family} title={activeEntry.title} peers={peers} />
        </StatWindow>
      ) : null}
    </div>
  );
}
