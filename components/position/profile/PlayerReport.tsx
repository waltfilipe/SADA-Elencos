"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { useLeague } from "@/components/LeagueProvider";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { crossingReading, crossingVolumePer90, formatPer90 } from "@/lib/crossingTendency";
import { statRowLabel } from "@/lib/seasonTotals";
import { centeredTendencyPosition } from "@/lib/tendencyScale";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { formatFoot } from "@/lib/feet";
import { getLeague } from "@/lib/leagues";
import { familyBySlug } from "@/lib/positions";
import { profileMetaForFamily } from "@/lib/profileMeta";
import { activeProfileKeys, archetypeRank, profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import { isProjectionEligible, realisticProjection } from "@/lib/minuteProjection";
import { playerInitials, profileGradeFromRank } from "@/lib/scoutTheme";
import { badgeCatalogForFamily, playerStatBadges } from "@/lib/statBadges";
import {
  REPORT_COPY,
  localizeContract,
  localizeMarketValue,
  localizeValue,
  ordinal,
  reportLocale,
  translateLabel,
  translateNationality,
  translateSection,
  type ReportLang,
} from "@/lib/reportI18n";
import { useLoading } from "@/components/LoadingProvider";
import { PlayerHeatmap } from "./PlayerHeatmap";
import type { AspectItem, PlayerHeatmapData, PlayerPhysicalRun, PlayerProfile, PositionFamily } from "@/lib/types";

type ReportCopy = (typeof REPORT_COPY)[ReportLang];

type ReportLine = {
  label: string;
  value: string;
  percentile: number | null;
  sub?: boolean;
  projectionValue?: string;
  projectionPercentile?: number | null;
};

type ReportBlock = {
  title: string | null;
  lines: ReportLine[];
};

type ReportSection = {
  title: string;
  tone: string;
  blocks: ReportBlock[];
};

function percentileOf(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? Math.round(value) : null;
}

function blocksFor(item: AspectItem, title: string, lang: ReportLang): ReportBlock[] {
  const copy = REPORT_COPY[lang];
  const blockTitle = translateLabel(title, lang);
  const subs = item.sub_metrics ?? [];
  if (subs.length) {
    const lines = subs
      .map((sub) => ({
        label: translateLabel(statRowLabel(sub.label), lang),
        value: localizeValue(sub.display_value?.trim() || "—", lang),
        percentile: percentileOf(sub.percentile),
      }))
      .filter((line) => line.value !== "—" || line.percentile != null);
    return lines.length ? [{ title: blockTitle, lines }] : [];
  }

  const volumeValue = localizeValue(
    item.display_value?.trim() ||
      (item.certos_per90 != null ? item.certos_per90.toFixed(1).replace(".", ",") : "—"),
    lang,
  );
  const volumePercentile = percentileOf(item.percentile);
  const efficiency: ReportLine | null =
    item.efficiency_pct != null || item.efficiency_value
      ? {
          label: copy.efficiency,
          value: localizeValue(item.efficiency_value?.trim() || "—", lang),
          percentile: percentileOf(item.efficiency_pct),
          sub: true,
        }
      : null;

  if (!efficiency) {
    if (volumeValue === "—" && volumePercentile == null) return [];
    return [
      {
        title: null,
        lines: [{ label: translateLabel(statRowLabel(title), lang), value: volumeValue, percentile: volumePercentile }],
      },
    ];
  }
  return [
    {
      title: blockTitle,
      lines: [{ label: copy.per90, value: volumeValue, percentile: volumePercentile }, efficiency],
    },
  ];
}

function reportSections(player: PlayerProfile, lang: ReportLang): ReportSection[] {
  const all = flattenAspects(player);
  const sections: ReportSection[] = [];
  for (const section of statSectionsForFamily(player.position_family)) {
    const blocks: ReportBlock[] = [];
    for (const label of section.labels) {
      const item = findAspect(all, label);
      if (!item) continue;
      const title = label === "Conduções Progressivas" ? "Progressão" : label;
      blocks.push(...blocksFor(item, title, lang));
    }
    if (blocks.length) sections.push({ title: translateSection(section.title, lang), tone: section.tone, blocks });
  }
  return sections;
}

function lineKey(section: string, block: string | null, label: string): string {
  return `${section}::${block ?? ""}::${label}`;
}

/** Overlay starter-minute projection on the observed lines. Same label, lighter figure. */
function applyProjection(base: ReportSection[], projected: ReportSection[]): ReportSection[] {
  const lookup = new Map<string, ReportLine>();
  for (const section of projected) {
    for (const block of section.blocks) {
      for (const line of block.lines) lookup.set(lineKey(section.title, block.title, line.label), line);
    }
  }
  return base.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      lines: block.lines.map((line) => {
        const hit = lookup.get(lineKey(section.title, block.title, line.label));
        if (!hit) return line;
        if (hit.value === line.value && hit.percentile === line.percentile) return line;
        return {
          ...line,
          projectionValue: hit.value,
          projectionPercentile: hit.percentile,
        };
      }),
    })),
  }));
}

/** Rough printed height of a section, in table rows. */
function sectionWeight(section: ReportSection): number {
  return section.blocks.reduce(
    (total, block, index) => total + block.lines.length + (block.title ? 1.1 : 0) + (index === 0 ? 0.7 : 0.4),
    2.2,
  );
}

/** Masonry keeping reading order: each section goes to the shortest column. Light positions get two wider columns. */
function sectionColumns(sections: ReportSection[]): { columns: ReportSection[][]; density: string } {
  const total = sections.reduce((sum, section) => sum + sectionWeight(section), 0);
  const count = total < 42 ? 2 : 3;
  const columns: ReportSection[][] = Array.from({ length: count }, () => []);
  const heights = Array(count).fill(0);
  for (const section of sections) {
    const target = heights.indexOf(Math.min(...heights));
    columns[target].push(section);
    heights[target] += sectionWeight(section);
  }
  // Spare page height goes into row spacing; the thresholds are in table rows of the tallest column.
  const tallest = Math.max(...heights);
  const density = tallest <= 20 ? "is-roomy" : tallest <= 27 ? "is-comfy" : "";
  return { columns: columns.filter((column) => column.length), density };
}

function formatIso(iso: string | null | undefined, lang: ReportLang): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, day || 1).toLocaleDateString(reportLocale(lang));
}

/** YouTube search for match clips. No API key — just an encoded public query. */
function youtubeHighlightsHref(player: PlayerProfile): string {
  const query = [player.name, player.club, player.position.toLocaleLowerCase("pt-BR"), "highlights"]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function percentileTone(value: number | null): string {
  if (value == null) return "is-empty";
  if (value >= 70) return "is-high";
  if (value <= 30) return "is-low";
  return "is-mid";
}

type ReportMix = {
  key: string;
  label: string;
  share: number;
  active: boolean;
  grade: string | null;
  rank: number | null;
};

type ReportTendency = {
  key: string;
  label: string;
  detail: string;
  fill: number;
  averageFill: number | null;
  left: string;
  right: string;
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Profile name as the site classifies it (same macro label as ClusterTag). */
function reportProfileName(player: PlayerProfile): string {
  return player.cluster?.archetype_label ?? player.profile;
}

type BioItem = { icon: string; label: string; value: string };

function reportBio(player: PlayerProfile, lang: ReportLang): BioItem[] {
  const copy = REPORT_COPY[lang];
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const foot = formatFoot(player.foot);
  const nationality = translateNationality(player.nationality, lang);
  const items: (BioItem | null)[] = [
    age != null ? { icon: "fa-user", label: copy.bioAge, value: copy.bioYears(age) } : null,
    player.height ? { icon: "fa-arrows-up-down", label: copy.bioHeight, value: `${player.height} cm` } : null,
    foot ? { icon: "fa-shoe-prints", label: copy.bioFoot, value: translateLabel(foot, lang) } : null,
    nationality ? { icon: "fa-flag", label: copy.bioNationality, value: nationality } : null,
  ];
  return items.filter((item): item is BioItem => Boolean(item));
}

function reportMix(player: PlayerProfile, family: PositionFamily, players: PlayerProfile[]): ReportMix[] {
  const shareRows = sortedProfileShareRows(player);
  if (shareRows.length) {
    const active = activeProfileKeys(player, shareRows);
    const pool = players.length ? players : [player];
    return shareRows.map((row) => {
      const rank = archetypeRank(player, pool, row.label, family);
      return {
        key: row.key,
        label: row.label,
        share: row.share,
        active: active.has(row.key),
        rank,
        grade: rank ? profileGradeFromRank(rank, pool.length) : null,
      };
    });
  }

  return profileMetaForFamily(family)
    .filter((item) => item.key !== "perfil" && item.key !== "geral")
    .map((item) => ({
      key: item.key,
      label: item.label,
      share: player.profile_shares?.[item.key] ?? 0,
      active: false,
      grade: null,
      rank: null,
    }))
    .filter((item) => item.share > 0)
    .sort((a, b) => b.share - a.share);
}

function reportTendencies(player: PlayerProfile, players: PlayerProfile[], lang: ReportLang): ReportTendency[] {
  const copy = REPORT_COPY[lang];
  const per90 = (value: number) => localizeValue(formatPer90(value), lang);
  const items = player.aspects.perfil_construcao ?? [];
  const longo = items.find((item) => item.bar_key === "pass_tendency");
  const progressivo = items.find((item) => item.bar_key === "progressive_share");
  const rows: ReportTendency[] = [];

  if (longo?.share_pct != null) {
    const share = longo.share_pct;
    const average = longo.pool_avg_pct ?? null;
    const scale = Math.max(longo.scale_max_pct ?? 40, share, average ?? 0, 1);
    const gap = average == null ? null : share - average;
    const verdict = gap == null ? null : gap >= 2 ? copy.longer : gap <= -2 ? copy.shorter : copy.onAverage;
    const bits = [
      verdict,
      copy.longShare(Math.round(share)),
      average == null ? null : `${copy.average} ${Math.round(average)}%`,
    ].filter((bit): bit is string => Boolean(bit));
    rows.push({
      key: "curto",
      label: copy.shortPass,
      detail: bits.join(" · "),
      fill: average == null ? clampPct((share / scale) * 100) : clampPct(centeredTendencyPosition(share, average, scale)),
      averageFill: average == null ? null : 50,
      left: translateLabel(longo.axis_left || "Curto", lang),
      right: translateLabel(longo.axis_right || "Longo", lang),
    });
  }

  if (progressivo?.share_pct != null) {
    const share = progressivo.share_pct;
    const average = progressivo.pool_avg_pct ?? null;
    const scale = Math.max(progressivo.scale_max_pct ?? 40, share, average ?? 0, 1);
    rows.push({
      key: "progressivo",
      label: copy.progressivePass,
      detail:
        average == null ? `${Math.round(share)}%` : `${Math.round(share)}% · ${copy.average} ${Math.round(average)}%`,
      fill: average == null ? clampPct((share / scale) * 100) : clampPct(centeredTendencyPosition(share, average, scale)),
      averageFill: average == null ? null : 50,
      left: translateLabel(progressivo.axis_left || "Baixo", lang),
      right: translateLabel(progressivo.axis_right || "Alto", lang),
    });
  }

  const crossing = crossingReading(player, players);
  if (crossing) {
    rows.push({
      key: "cruzamentos",
      label: copy.crosses,
      detail: `${per90(crossing.volume)}/90 · ${copy.average} ${per90(crossing.average)}/90`,
      fill: clampPct(centeredTendencyPosition(crossing.volume, crossing.average, crossing.scale)),
      averageFill: 50,
      left: translateLabel("Baixo", lang),
      right: translateLabel("Alto", lang),
    });
  }

  return rows;
}

type RunMetricKey =
  | "kilometers_p90"
  | "top_speed"
  | "sprints_p90"
  | "running_km_p90"
  | "high_speed_km_p90"
  | "sprinting_km_p90";

const RUN_METRICS: { key: RunMetricKey; pt: string; en: string; unit: string; digits: number }[] = [
  { key: "kilometers_p90", pt: "Distância total", en: "Distance", unit: "km/90", digits: 2 },
  { key: "top_speed", pt: "Velocidade máxima", en: "Top speed", unit: "km/h", digits: 1 },
  { key: "sprints_p90", pt: "Sprints", en: "Sprints", unit: "/90", digits: 1 },
  { key: "running_km_p90", pt: "Corrida", en: "Running", unit: "km/90", digits: 2 },
  { key: "high_speed_km_p90", pt: "Alta intensidade", en: "High intensity", unit: "km/90", digits: 2 },
  { key: "sprinting_km_p90", pt: "Sprint (distância)", en: "Sprint distance", unit: "km/90", digits: 2 },
];

function reportRunRows(run: PlayerPhysicalRun, lang: ReportLang) {
  return RUN_METRICS.map((metric) => {
    const value = run[metric.key];
    return {
      key: metric.key,
      label: lang === "en" ? metric.en : metric.pt,
      value: `${localizeValue(value.toFixed(metric.digits).replace(".", ","), lang)} ${metric.unit}`,
      pct: run.percentiles?.[metric.key] ?? null,
    };
  });
}

/** Média ponderada por minutos de GPS entre temporadas (resumo multi-ano). */
function averagePhysicalRun(rows: SummarySheetRow[]): PlayerPhysicalRun | null {
  const entries = rows
    .map((row) => row.player.physical_run)
    .filter((run): run is PlayerPhysicalRun => Boolean(run?.minutes));
  if (!entries.length) return null;
  const weightSum = entries.reduce((sum, run) => sum + run.minutes, 0) || 1;
  const avg = (key: RunMetricKey) =>
    entries.reduce((sum, run) => sum + (run[key] ?? 0) * run.minutes, 0) / weightSum;
  const avgPct = (key: RunMetricKey) => {
    const parts = entries
      .map((run) => ({ value: run.percentiles?.[key], weight: run.minutes }))
      .filter((part): part is { value: number; weight: number } => part.value != null);
    if (!parts.length) return undefined;
    const w = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
    return parts.reduce((sum, part) => sum + part.value * part.weight, 0) / w;
  };
  const first = entries[0];
  const percentiles = Object.fromEntries(
    RUN_METRICS.map((metric) => [metric.key, avgPct(metric.key)]).filter(([, v]) => v != null),
  ) as PlayerPhysicalRun["percentiles"];
  return {
    ...first,
    matches: entries.reduce((sum, run) => sum + run.matches, 0),
    minutes: Math.round(weightSum),
    kilometers_p90: avg("kilometers_p90"),
    top_speed: avg("top_speed"),
    sprints_p90: avg("sprints_p90"),
    running_km_p90: avg("running_km_p90"),
    high_speed_km_p90: avg("high_speed_km_p90"),
    sprinting_km_p90: avg("sprinting_km_p90"),
    percentiles,
    ranks: {},
  };
}

/** Brighter block colors for the dark on-screen radar. */
const SCREEN_TONE_COLORS: Record<string, string> = {
  defensivos: "#2dd4bf",
  aereo: "#38bdf8",
  passes: "#60a5fa",
  dribles: "#a78bfa",
  finais: "#e879f9",
  ofensividade: "#fb923c",
  finalizacao: "#fb7185",
};

const TONE_COLORS: Record<string, string> = {
  defensivos: "#0f766e",
  aereo: "#0369a1",
  passes: "#1d4ed8",
  dribles: "#6d28d9",
  finais: "#a21caf",
  ofensividade: "#c2410c",
  finalizacao: "#be123c",
};

type ReportMetric = {
  name: string;
  context: string;
  value: string;
  percentile: number;
  tone: string;
};

export type SectionScore = {
  title: string;
  tone: string;
  score: number;
  /** Overrides the tone color (e.g. profile accent). */
  color?: string;
  /** Text under the axis label; defaults to the score. */
  display?: string;
};

/** Volume and efficiency rows read as "Block · Per 90"; sub-metric rows keep their own label. */
function reportMetrics(sections: ReportSection[], copy: ReportCopy): ReportMetric[] {
  const metrics: ReportMetric[] = [];
  for (const section of sections) {
    for (const block of section.blocks) {
      for (const line of block.lines) {
        if (line.percentile == null) continue;
        const generic = line.label === copy.per90 || line.label === copy.efficiency;
        metrics.push({
          name: generic && block.title ? block.title : line.label,
          context: generic && block.title ? line.label : block.title ?? section.title,
          value: line.value,
          percentile: line.percentile,
          tone: section.tone,
        });
      }
    }
  }
  return metrics;
}

function sectionScores(sections: ReportSection[]): SectionScore[] {
  return sections.flatMap((section) => {
    const values = section.blocks.flatMap((block) =>
      block.lines.map((line) => line.percentile).filter((value): value is number => value != null),
    );
    if (!values.length) return [];
    const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return [{ title: section.title, tone: section.tone, score }];
  });
}

function gradeTone(grade: string | null): string {
  const letter = grade?.[0];
  if (letter === "A") return "is-a";
  if (letter === "B") return "is-b";
  if (letter === "C") return "is-c";
  return "is-d";
}

function PercentileCell({ value, ribbon }: { value: number | null; ribbon?: number | null }) {
  return (
    <span className={`player-report-pct ${percentileTone(value)}`}>
      <span className="player-report-pct-track" aria-hidden="true">
        <span style={{ width: `${value ?? 0}%` }} />
        {ribbon != null ? (
          <i className="player-report-pct-ribbon" style={{ left: `${Math.max(0, Math.min(100, ribbon))}%` }} />
        ) : null}
      </span>
      <b>{value ?? "—"}</b>
    </span>
  );
}

function ReportBanner({
  kicker,
  league,
  family,
  season,
  seasonTag,
  seasonSub,
}: {
  kicker: string;
  league: string;
  family: string;
  /** Big label identifying what is evaluated on this page (e.g. "2024" or "3 temporadas"). */
  season: string;
  seasonTag: string;
  seasonSub?: string;
}) {
  return (
    <header className="player-report-banner">
      <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
      <p className="player-report-kicker">{kicker}</p>
      <p className="player-report-league">
        {league}
        <span>{family}</span>
      </p>
      <p className="player-report-season">
        <b>{season}</b>
        <span>
          {seasonTag}
          {seasonSub ? ` · ${seasonSub}` : ""}
        </span>
      </p>
    </header>
  );
}

function ReportColophon({ generated, page }: { generated: string; page: string }) {
  return (
    <p className="player-report-colophon">
      <span>SADA | Scout</span>
      <span>{generated}</span>
      <span>{page}</span>
    </p>
  );
}

/** Section averages on a 0–100 radar. The dashed ring is the positional median. */
/** Breaks long block names in two lines for the narrow on-screen card. */
function radarLabelLines(title: string, wrap: boolean): string[] {
  if (!wrap || title.length <= 10 || !title.includes(" ")) return [title];
  const words = title.split(" ");
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export function SectionRadar({
  scores,
  variant = "print",
  shape: shapeStyle = "polygon",
}: {
  scores: SectionScore[];
  variant?: "print" | "screen";
  /** "sectors" draws one wedge per axis (on-screen profile radar). */
  shape?: "polygon" | "sectors";
}) {
  const screen = variant === "screen";
  const sectors = screen && shapeStyle === "sectors";
  const width = screen ? 300 : 340;
  const height = screen ? 290 : 270;
  const cx = width / 2;
  const cy = height / 2;
  const radius = screen ? 90 : 92;
  const count = scores.length;
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (radius * value) / 100;
    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) =>
    scores.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  const shape = scores.map((item, index) => point(index, Math.max(4, item.score)).map((n) => n.toFixed(1)).join(",")).join(" ");
  const colorOf = (item: SectionScore) =>
    item.color ?? (screen ? SCREEN_TONE_COLORS[item.tone] : TONE_COLORS[item.tone]) ?? "#0e7490";
  /** Wedge from the center spanning this axis' share of the circle. */
  const sector = (index: number, value: number) => {
    const half = Math.PI / count - 0.06;
    const r = (radius * value) / 100;
    const a0 = angle(index) - half;
    const a1 = angle(index) + half;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = half * 2 > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
  };

  return (
    <svg className={`player-report-radar${sectors ? " is-sectors" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {sectors ? (
        <>
          {[25, 75, 100].map((value) => (
            <circle key={value} cx={cx} cy={cy} r={(radius * value) / 100} className="radar-ring" />
          ))}
          <circle cx={cx} cy={cy} r={radius / 2} className="radar-ring is-median" />
          {scores.map((item, index) => (
            <path key={`bg-${item.title}`} d={sector(index, 100)} fill={colorOf(item)} opacity={0.07} />
          ))}
          {scores.map((item, index) => (
            <path
              key={item.title}
              d={sector(index, Math.max(6, item.score))}
              fill={colorOf(item)}
              fillOpacity={0.55}
              stroke={colorOf(item)}
              strokeWidth={1.5}
              className="radar-sector"
            />
          ))}
          <circle cx={cx} cy={cy} r={3} className="radar-center" />
        </>
      ) : (
        <>
          {[25, 75, 100].map((value) => (
            <polygon key={value} points={ring(value)} className="radar-ring" />
          ))}
          <polygon points={ring(50)} className="radar-ring is-median" />
          {scores.map((item, index) => {
            const [x, y] = point(index, 100);
            return <line key={item.title} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
          })}
          <polygon points={shape} className="radar-shape" />
          {scores.map((item, index) => {
            const [x, y] = point(index, Math.max(4, item.score));
            return <circle key={item.title} cx={x} cy={y} r={3.4} fill={colorOf(item)} className="radar-dot" />;
          })}
        </>
      )}
      {scores.map((item, index) => {
        const a = angle(index);
        const x = cx + (radius + 14) * Math.cos(a);
        const y = cy + (radius + 14) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const lines = radarLabelLines(item.title, screen);
        const lineHeight = screen ? 13 : 11;
        const lift = (lines.length - 1) * lineHeight;
        const dy = Math.sin(a) < -0.5 ? -4 - lift : Math.sin(a) > 0.5 ? 10 : -lift / 2;
        return (
          <text key={item.title} x={x} y={y + dy} textAnchor={anchor} className="radar-label">
            {lines.map((line, lineIndex) => (
              <tspan key={line} x={x} dy={lineIndex ? lineHeight : 0}>
                {line}
              </tspan>
            ))}
            <tspan x={x} dy={lineHeight + (screen ? 1 : 0)} className="radar-score" fill={colorOf(item)}>
              {item.display ?? item.score}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/** Radar de blocos multi-temporada: um único polígono — a média ponderada. */
function SeasonBlocksRadar({
  titles,
  average,
}: {
  titles: string[];
  average: (number | null)[];
}) {
  const width = 340;
  const height = 250;
  const cx = width / 2;
  const cy = height / 2 - 2;
  const radius = 82;
  const count = titles.length;
  const angle = (index: number) => -Math.PI / 2 + (index / count) * Math.PI * 2;
  const point = (index: number, value: number) => {
    const r = (radius * value) / 100;
    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))] as const;
  };
  const ring = (value: number) =>
    titles.map((_, index) => point(index, value).map((n) => n.toFixed(1)).join(",")).join(" ");
  /** Polígono só nos eixos disponíveis — temporada sem o bloco não é puxada ao centro. */
  const shape = (values: (number | null)[]) =>
    titles
      .flatMap((_, index) => {
        const value = values[index];
        return value == null ? [] : [point(index, Math.max(4, value)).map((n) => n.toFixed(1)).join(",")];
      })
      .join(" ");

  return (
    <svg className="player-report-radar player-report-radar-seasons" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      {[25, 75, 100].map((value) => (
        <polygon key={value} points={ring(value)} className="radar-ring" />
      ))}
      <polygon points={ring(50)} className="radar-ring is-median" />
      {titles.map((title, index) => {
        const [x, y] = point(index, 100);
        return <line key={title} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
      })}
      {average.some((value) => value != null) ? <polygon points={shape(average)} className="radar-shape" /> : null}
      {titles.map((title, index) => {
        const a = angle(index);
        const x = cx + (radius + 13) * Math.cos(a);
        const y = cy + (radius + 13) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        const dy = Math.sin(a) < -0.5 ? -4 : Math.sin(a) > 0.5 ? 10 : 0;
        const avg = average[index];
        return (
          <text key={title} x={x} y={y + dy} textAnchor={anchor} className="radar-label">
            {title}
            {avg != null ? (
              <tspan x={x} dy={11} className="radar-score">
                {Math.round(avg)}
              </tspan>
            ) : null}
          </text>
        );
      })}
    </svg>
  );
}

/** Scores (0–100, média dos percentis por bloco) do radar "Perfil estatístico". */
export function statProfileScores(player: PlayerProfile): SectionScore[] {
  return sectionScores(reportSections(player, "pt"));
}

/** Screen version of the PDF "Perfil estatístico" radar for the position page. */
export function StatProfileRadarCard({ player, bare = false }: { player: PlayerProfile; bare?: boolean }) {
  const copy: ReportCopy = REPORT_COPY.pt;
  const scores = useMemo(() => sectionScores(reportSections(player, "pt")), [player]);
  if (!scores.length) return null;
  return (
    <div className={bare ? "stat-radar-card stat-radar-bare" : "player-card profile-perfil-card stat-radar-card"}>
      {bare ? null : (
        <div className="profile-card-head">
          <span className="section-label">{copy.radar}</span>
        </div>
      )}
      <div className="stat-radar-figure">
        <SectionRadar scores={scores} variant="screen" />
      </div>
      <p className="player-report-chart-key">
        <span className="is-player">{player.name}</span>
        <span className="is-median">{copy.medianKey}</span>
      </p>
      <p className="stat-radar-hint">{copy.radarHint}</p>
    </div>
  );
}

function MetricList({
  title,
  hint,
  metrics,
  empty,
  tone,
}: {
  title: string;
  hint: string;
  metrics: ReportMetric[];
  empty: string;
  tone: "is-strong" | "is-weak";
}) {
  return (
    <section className={`player-report-card player-report-metrics ${tone}`}>
      <header className="player-report-card-head">
        <h2>
          <i className={`fa-solid ${tone === "is-strong" ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}`} aria-hidden="true" />
          {title}
        </h2>
        <span>{hint}</span>
      </header>
      {metrics.length ? (
        <ol>
          {metrics.map((metric) => (
            <li key={`${metric.name}-${metric.context}`}>
              <span className="player-report-metric-name">
                <i style={{ background: TONE_COLORS[metric.tone] }} aria-hidden="true" />
                <span>
                  <strong>{metric.name}</strong>
                  <small>{metric.context}</small>
                </span>
              </span>
              <span className="player-report-metric-value">{metric.value}</span>
              <span className={`player-report-metric-bar ${percentileTone(metric.percentile)}`} aria-hidden="true">
                <span style={{ width: `${Math.max(2, metric.percentile)}%` }} />
                <i />
              </span>
              <b className={percentileTone(metric.percentile)}>{metric.percentile}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="player-report-empty">{empty}</p>
      )}
    </section>
  );
}

export function ReportSheet({
  player,
  family,
  players,
  lang,
  sheetUrl,
  pageOffset = 0,
  totalPages = 2,
  archiveSeasonLabel,
  leagueName,
  skipProjection = false,
}: {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  lang: ReportLang;
  sheetUrl: string;
  /** First player-report page number in the full export (e.g. after scatter pages). */
  pageOffset?: number;
  totalPages?: number;
  archiveSeasonLabel?: string;
  /** League of the evaluated season (archive sheets may come from another division). */
  leagueName?: string;
  skipProjection?: boolean;
}) {
  const league = useLeague();
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const sections = useMemo(() => {
    const observed = reportSections(player, lang);
    if (skipProjection || !isProjectionEligible(player)) return observed;
    const projection = realisticProjection(player, players);
    if (!projection) return observed;
    return applyProjection(observed, reportSections(projection.profile, lang));
  }, [player, players, lang, skipProjection]);
  const { columns, density } = useMemo(() => sectionColumns(sections), [sections]);
  const scores = useMemo(() => sectionScores(sections), [sections]);
  const metrics = useMemo(() => reportMetrics(sections, copy), [sections, copy]);
  const badges = useMemo(() => playerStatBadges(player), [player]);
  const toneByBadge = useMemo(() => {
    const tones = new Map<string, string>();
    for (const option of badgeCatalogForFamily(family)) tones.set(option.key, option.tone);
    return tones;
  }, [family]);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const tm = player.transfermarkt;
  const contractDate = formatIso(tm?.contract_until, lang);
  const profileLabel = translateLabel(reportProfileName(player), lang);
  const mix = reportMix(player, family, players);
  const poolSize = players.length || 1;
  const tendencies = reportTendencies(player, players, lang);
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );
  const highlightsHref = youtubeHighlightsHref(player);
  const xg = localizeValue(metricDisplay(player, "xG"), lang);
  const xa = localizeValue(metricDisplay(player, "xA"), lang);
  const sheetLeague = leagueName ?? league.name;
  const sheetSeason = archiveSeasonLabel ?? league.season;
  const leagueLabel = `${sheetLeague} ${sheetSeason}`;
  const leagueBanner = sheetLeague;

  const bio = reportBio(player, lang);

  const run = player.physical_run;
  const errosLabel = translateLabel("Erros Totais", lang);
  const ranked = [...metrics].sort((a, b) => b.percentile - a.percentile);
  // Erros Totais pode aparecer em pontos a desenvolver, nunca em pontos fortes.
  const strengths = ranked
    .filter((metric) => metric.percentile >= 50 && metric.name !== errosLabel)
    .slice(0, 6);
  const weaknesses = [...ranked]
    .reverse()
    .filter((metric) => metric.percentile < 50)
    .slice(0, 6);

  const facts = [
    {
      key: "minutes",
      icon: "fa-stopwatch",
      label: copy.minutes,
      value: player.minutes.toLocaleString(locale),
      sub: player.minutes_pct != null ? copy.minutesShare(Math.round(player.minutes_pct)) : null,
    },
    { key: "goals", icon: "fa-futbol", label: copy.goals, value: player.goals.toLocaleString(locale), sub: `xG ${xg}` },
    {
      key: "assists",
      icon: "fa-shoe-prints",
      label: copy.assists,
      value: player.assists.toLocaleString(locale),
      sub: `xA ${xa}`,
    },
    {
      key: "market",
      icon: "fa-euro-sign",
      label: copy.marketValue,
      value: localizeMarketValue(tm?.market_value, lang),
      sub: tm?.on_loan_from ? copy.onLoan(tm.on_loan_from) : null,
    },
    {
      key: "contract",
      icon: "fa-file-signature",
      label: copy.contract,
      value: localizeContract(tm?.contract_remaining, lang),
      sub: contractDate ? copy.contractUntil(contractDate) : null,
    },
  ];

  return (
    <article className="player-report" lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="player-report-page">
        <ReportBanner
          kicker={copy.kicker}
          league={leagueBanner}
          family={familyLabel}
          season={sheetSeason}
          seasonTag={archiveSeasonLabel ? copy.seasonArchive : copy.seasonTag}
          seasonSub={archiveSeasonLabel ? copy.seasonArchiveSub : undefined}
        />

        <div className="player-report-body">
          <section className="player-report-identity">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-photo"
              fallback={<span className="player-report-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
            />
            <div className="player-report-who">
              <p className="player-report-eyebrow">{translateLabel(player.position, lang)}</p>
              <h1>{player.name}</h1>
              <p className="player-report-club">
                <ClubLogo club={player.display_club ?? player.club} size={16} />
                <span>{player.display_club ?? player.club}</span>
              </p>
              {bio.length ? (
                <ul className="player-report-bio">
                  {bio.map((item) => (
                    <li key={item.label}>
                      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                      <span className="player-report-bio-text">
                        <span className="player-report-bio-label">{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="player-report-highlights">
                <a href={highlightsHref} target="_blank" rel="noopener noreferrer">
                  <i className="fa-brands fa-youtube" aria-hidden="true" /> {copy.highlights}
                </a>
              </p>
            </div>
            <div className="player-report-heat">
              <p className="player-report-label">{copy.heatmap}</p>
              {(player.heatmap?.points?.length ?? 0) > 0 ? (
                <PlayerHeatmap playerName={player.name} heatmap={player.heatmap} fixed={{ width: 196, height: 127 }} />
              ) : (
                <p className="player-report-heat-empty">{copy.heatmapEmpty}</p>
              )}
            </div>
          </section>

          <dl className="player-report-facts">
            {facts.map((fact) => (
              <div key={fact.key}>
                <dt>
                  <i className={`fa-solid ${fact.icon}`} aria-hidden="true" />
                  {fact.label}
                </dt>
                <dd>
                  {fact.value}
                  {fact.sub ? <small>{fact.sub}</small> : null}
                </dd>
              </div>
            ))}
          </dl>

          <section className="player-report-card player-report-profile" aria-label={copy.tacticalProfile}>
            <div className="player-report-profile-main">
              <p className="player-report-label">{copy.tacticalProfile}</p>
              <strong>{profileLabel}</strong>
              <span>
                {familyLabel} · {leagueLabel}
              </span>
            </div>
            {mix.length ? (
              <ul className="player-report-archetypes" style={{ gridTemplateColumns: `repeat(${Math.min(mix.length, 4)}, minmax(0, 1fr))` }}>
                {mix.slice(0, 4).map((item) => (
                  <li key={item.key} className={item.active ? "is-active" : undefined}>
                    <p className="player-report-archetype-name">
                      <i style={{ background: profileAccent(item.label) }} aria-hidden="true" />
                      <span>{translateLabel(item.label, lang)}</span>
                      {item.grade ? <b className={`player-report-grade ${gradeTone(item.grade)}`}>{item.grade}</b> : null}
                    </p>
                    <p className="player-report-archetype-share">
                      <strong>{Math.round(item.share)}%</strong>
                      {item.rank ? <small>{copy.rankOf(item.rank, poolSize)}</small> : null}
                    </p>
                    <span className="player-report-archetype-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(3, Math.round(item.share))}%`, background: profileAccent(item.label) }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="player-report-stats-wrap" aria-label={copy.stats}>
            <h2 className="player-report-heading">{copy.stats}</h2>
            <div
              className={`player-report-stats ${columns.length === 2 ? "is-wide" : ""} ${density}`.trim()}
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {columns.map((column, columnIndex) => (
                <div key={columnIndex} className="player-report-stats-col">
                  {column.map((section) => (
                    <section key={section.title} className={`player-report-section tone-${section.tone}`}>
                      <h3>{section.title}</h3>
                      <p className="player-report-row player-report-cols" aria-hidden="true">
                        <span />
                        <span>{copy.value}</span>
                        <span>{copy.percentile}</span>
                      </p>
                      {section.blocks.map((block, index) => (
                        <div key={`${section.title}-${block.title ?? index}`} className="player-report-block">
                          {block.title ? <p className="player-report-block-title">{block.title}</p> : null}
                          {block.lines.map((line, lineIndex) => (
                            <div
                              key={`${line.label}-${lineIndex}`}
                              className={`player-report-row player-report-line${line.sub ? " is-sub" : ""}`}
                            >
                              <span className="player-report-line-label">{line.label}</span>
                              <span className="player-report-value">
                                {line.value}
                                {line.projectionValue ? (
                                  <small className="player-report-projection">{line.projectionValue}</small>
                                ) : null}
                              </span>
                              <PercentileCell value={line.percentile} ribbon={line.projectionPercentile} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <footer className="player-report-foot">
            <div className="player-report-legend">
              <p className="player-report-label">{copy.legendTitle}</p>
              <ul>
                <li>
                  <span className="player-report-legend-key is-pct" aria-hidden="true" />
                  {copy.legendPercentile(copy.pool(familyLabel, leagueLabel))}
                </li>
                <li>
                  <span className="player-report-legend-key is-rate" aria-hidden="true">
                    90
                  </span>
                  {copy.legendRates}
                </li>
                <li>
                  <span className="player-report-legend-key is-badge" aria-hidden="true">
                    <i className="fa-solid fa-star" />
                  </span>
                  {copy.legendBadge}
                </li>
                {isProjectionEligible(player) ? (
                  <li>
                    <span className="player-report-legend-key is-projection" aria-hidden="true" />
                    {copy.legendProjection}
                  </li>
                ) : null}
              </ul>
            </div>
            <ReportColophon generated={generated} page={copy.page(1 + pageOffset, totalPages)} />
          </footer>
        </div>
      </div>

      <div className="player-report-page">
        <ReportBanner
          kicker={copy.summaryKicker}
          league={leagueBanner}
          family={familyLabel}
          season={sheetSeason}
          seasonTag={archiveSeasonLabel ? copy.seasonArchive : copy.seasonTag}
          seasonSub={archiveSeasonLabel ? copy.seasonArchiveSub : undefined}
        />

        <div className="player-report-body">
          <section className="player-report-mini">
            <PlayerPhoto
              src={tm?.photo}
              alt=""
              className="player-report-mini-photo"
              fallback={<span className="player-report-mini-photo player-report-photo-fallback">{playerInitials(player.name)}</span>}
            />
            <div>
              <h1>{player.name}</h1>
              <p>
                <ClubLogo club={player.display_club ?? player.club} size={14} />
                <span>{player.display_club ?? player.club}</span>
                <span className="player-report-dot">·</span>
                <span>{translateLabel(player.position, lang)}</span>
                <span className="player-report-dot">·</span>
                <span>{profileLabel}</span>
              </p>
            </div>
          </section>

          {scores.length ? (
            <div className="player-report-charts">
              <section className="player-report-card">
                <header className="player-report-card-head">
                  <h2>{copy.radar}</h2>
                  <span>{copy.radarHint}</span>
                </header>
                <SectionRadar scores={scores} />
                <p className="player-report-chart-key">
                  <span className="is-player">{player.name}</span>
                  <span className="is-median">{copy.medianKey}</span>
                </p>
              </section>
              <section className="player-report-card">
                <header className="player-report-card-head">
                  <h2>{copy.blocks}</h2>
                  <span>{copy.blocksHint}</span>
                </header>
                <ul className="player-report-diverging">
                  {scores.map((item) => {
                    const delta = item.score - 50;
                    return (
                      <li key={item.title}>
                        <span className="player-report-diverging-name">
                          <i style={{ background: TONE_COLORS[item.tone] }} aria-hidden="true" />
                          {item.title}
                        </span>
                        <span className="player-report-diverging-track" aria-hidden="true">
                          <span
                            className={delta >= 0 ? "is-up" : "is-down"}
                            style={delta >= 0 ? { left: "50%", width: `${delta}%` } : { right: "50%", width: `${-delta}%` }}
                          />
                          <i />
                        </span>
                        <b className={percentileTone(item.score)}>{item.score}</b>
                      </li>
                    );
                  })}
                </ul>
                <p className="player-report-diverging-axis" aria-hidden="true">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </p>
              </section>
            </div>
          ) : null}

          <div className="player-report-split">
            <MetricList
              title={copy.strengths}
              hint={copy.strengthsHint}
              metrics={strengths}
              empty={copy.noStrengths}
              tone="is-strong"
            />
            <MetricList
              title={copy.weaknesses}
              hint={copy.weaknessesHint}
              metrics={weaknesses}
              empty={copy.noWeaknesses}
              tone="is-weak"
            />
          </div>

          {run ? (
            <section className="player-report-card" aria-label={copy.gpsTitle}>
              <header className="player-report-card-head">
                <h2>{copy.gpsTitle}</h2>
                <span>{copy.gpsMeta(run.competition ?? "", run.matches, run.minutes)}</span>
              </header>
              <ul className="player-report-run-grid">
                {reportRunRows(run, lang).map((metric) => (
                  <li key={metric.key}>
                    <span className="player-report-run-label">{metric.label}</span>
                    <strong className="player-report-run-value">{metric.value}</strong>
                    {metric.pct != null ? (
                      <span className="player-report-run-bar" aria-hidden="true">
                        <i style={{ width: `${clampPct(metric.pct)}%` }} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tendencies.length || badges.length ? (
            <div className="player-report-extras">
              {tendencies.length ? (
                <section className="player-report-tendencies" aria-label={copy.tendencies}>
                  <h2 className="player-report-heading">{copy.tendencies}</h2>
                  <div className="player-report-tendency-grid">
                    {tendencies.map((item) => (
                      <div key={item.key} className={`player-report-tendency${item.key === "curto" ? " is-length" : ""}`}>
                        <p className="player-report-label">{item.label}</p>
                        <strong>{item.detail}</strong>
                        <div className="player-report-tendency-bar">
                          <div className="player-report-tendency-track">
                            <span style={{ width: `${item.fill}%` }} />
                          </div>
                          {item.averageFill != null ? (
                            <i className="player-report-tendency-avg" style={{ left: `${item.averageFill}%` }} />
                          ) : null}
                        </div>
                        <div className="player-report-axis">
                          <span>{item.left}</span>
                          <span>{item.right}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {badges.length ? (
                <section className="player-report-badges" aria-label={copy.badges}>
                  <h2 className="player-report-heading">{copy.badges}</h2>
                  <ul>
                    {badges.map((badge) => (
                      <li key={badge.key} className={`tone-${toneByBadge.get(badge.key) ?? "passes"}`}>
                        <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
                        <span>{translateLabel(badge.label, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          <footer className="player-report-foot">
            <div className="player-report-links">
              {tm?.profile_url ? (
                <p>
                  <span className="player-report-label">{copy.transfermarkt}</span>
                  <a href={tm.profile_url}>{tm.profile_url.replace(/^https?:\/\/(www\.)?/, "")}</a>
                </p>
              ) : null}
              {sheetUrl ? (
                <p>
                  <span className="player-report-label">{copy.sheet}</span>
                  <a href={sheetUrl}>{sheetUrl.replace(/^https?:\/\//, "")}</a>
                </p>
              ) : null}
            </div>
            <ReportColophon generated={generated} page={copy.page(2 + pageOffset, totalPages)} />
          </footer>
        </div>
      </div>
    </article>
  );
}

type SummarySheetRow = {
  player: PlayerProfile;
  /** Season year shown in the sheet (e.g. "2024"). */
  year: string;
  leagueName: string;
};

function weightedMean(values: { value: number; weight: number }[]): number | null {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
}

type SummaryDetail = {
  row: SummarySheetRow;
  weight: number;
};

/** One heatmap per picked season merged into a minute-weighted "average" map. */
function mergedSummaryHeatmap(rows: SummarySheetRow[]): PlayerHeatmapData | null {
  const mapped = rows.map((row) => ({
    minutes: Math.max(0, row.player.minutes ?? 0),
    points: row.player.heatmap?.points ?? [],
  }));
  const total = mapped.reduce((sum, item) => sum + (item.points.length ? item.minutes : 0), 0);
  if (!total) return null;
  const points: { x: number; y: number; w: number }[] = [];
  for (const item of mapped) {
    if (!item.points.length) continue;
    const share = item.minutes / total;
    for (const pt of item.points) {
      points.push({ x: pt.x, y: pt.y, w: (pt.w ?? 1) * share });
    }
  }
  return points.length ? { points } : null;
}

const SUMMARY_CROSSING_FAMILIES = new Set<PositionFamily>(["laterais", "meio-campistas", "extremos"]);

/** Minutes-weighted pass tendencies across the picked seasons (short↔long and progressive share). */
function summaryTendencies(detail: SummaryDetail[], lang: ReportLang, family: PositionFamily): ReportTendency[] {
  const copy = REPORT_COPY[lang];
  const per90 = (value: number) => localizeValue(formatPer90(value), lang);
  const rows: ReportTendency[] = [];

  const aggregate = (barKey: "pass_tendency" | "progressive_share") => {
    const entries = detail.map((item) => ({
      weight: item.weight,
      aspect: (item.row.player.aspects.perfil_construcao ?? []).find((aspect) => aspect.bar_key === barKey),
    }));
    const share = weightedMean(
      entries.flatMap((entry) =>
        entry.aspect?.share_pct != null ? [{ value: entry.aspect.share_pct, weight: entry.weight }] : [],
      ),
    );
    const average = weightedMean(
      entries.flatMap((entry) =>
        entry.aspect?.pool_avg_pct != null ? [{ value: entry.aspect.pool_avg_pct, weight: entry.weight }] : [],
      ),
    );
    const scale = Math.max(
      ...entries.map((entry) => entry.aspect?.scale_max_pct ?? 0),
      share ?? 0,
      average ?? 0,
      1,
    );
    const left = entries.find((entry) => entry.aspect?.axis_left)?.aspect?.axis_left ?? null;
    const right = entries.find((entry) => entry.aspect?.axis_right)?.aspect?.axis_right ?? null;
    return { share, average, scale, left, right };
  };

  const longo = aggregate("pass_tendency");
  if (longo.share != null) {
    const gap = longo.average == null ? null : longo.share - longo.average;
    const verdict = gap == null ? null : gap >= 2 ? copy.longer : gap <= -2 ? copy.shorter : copy.onAverage;
    const bits = [
      verdict,
      copy.longShare(Math.round(longo.share)),
      longo.average == null ? null : `${copy.average} ${Math.round(longo.average)}%`,
    ].filter((bit): bit is string => Boolean(bit));
    rows.push({
      key: "curto",
      label: copy.shortPass,
      detail: bits.join(" · "),
      fill:
        longo.average == null
          ? clampPct((longo.share / longo.scale) * 100)
          : clampPct(centeredTendencyPosition(longo.share, longo.average, longo.scale)),
      averageFill: longo.average == null ? null : 50,
      left: translateLabel(longo.left || "Curto", lang),
      right: translateLabel(longo.right || "Longo", lang),
    });
  }

  const progressivo = aggregate("progressive_share");
  if (progressivo.share != null) {
    rows.push({
      key: "progressivo",
      label: copy.progressivePass,
      detail:
        progressivo.average == null
          ? `${Math.round(progressivo.share)}%`
          : `${Math.round(progressivo.share)}% · ${copy.average} ${Math.round(progressivo.average)}%`,
      fill:
        progressivo.average == null
          ? clampPct((progressivo.share / progressivo.scale) * 100)
          : clampPct(centeredTendencyPosition(progressivo.share, progressivo.average, progressivo.scale)),
      averageFill: progressivo.average == null ? null : 50,
      left: translateLabel(progressivo.left || "Baixo", lang),
      right: translateLabel(progressivo.right || "Alto", lang),
    });
  }

  // Média de tendência a cruzamentos entre as temporadas (lat/mc/extremos).
  if (SUMMARY_CROSSING_FAMILIES.has(family)) {
    const volumes = detail
      .map((item) => ({ value: crossingVolumePer90(item.row.player), weight: item.weight }))
      .filter((entry): entry is { value: number; weight: number } => entry.value != null);
    const volume = weightedMean(volumes);
    if (volume != null) {
      const peak = Math.max(volume, ...volumes.map((entry) => entry.value), 1);
      rows.push({
        key: "cruzamentos",
        label: copy.crosses,
        detail: `${per90(volume)}/90`,
        fill: clampPct((volume / (peak * 1.15)) * 100),
        averageFill: null,
        left: translateLabel("Baixo", lang),
        right: translateLabel("Alto", lang),
      });
    }
  }

  return rows;
}

/** Last page of a multi-season export: the athlete's "average profile" across the picked years. */
export function SeasonSummarySheet({
  rows,
  family,
  lang,
  pageNumber,
  totalPages,
}: {
  rows: SummarySheetRow[];
  family: PositionFamily;
  lang: ReportLang;
  pageNumber: number;
  totalPages: number;
}) {
  const copy: ReportCopy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const familyLabel = translateLabel(familyBySlug(family).label, lang);
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );

  const main = rows[0].player;
  const ordered = useMemo(() => [...rows].sort((a, b) => a.year.localeCompare(b.year)), [rows]);

  const detail = useMemo(() => {
    const minutes = ordered.map((row) => Math.max(0, row.player.minutes ?? 0));
    const sum = minutes.reduce((a, b) => a + b, 0);
    return ordered.map((row, index) => ({
      row,
      weight: sum ? minutes[index] : 1,
      scores: sectionScores(reportSections(row.player, lang)),
      metrics: reportMetrics(reportSections(row.player, lang), copy),
      mix: sortedProfileShareRows(row.player),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, lang]);

  const weightTotal = detail.reduce((sum, item) => sum + item.weight, 0) || 1;

  /** Profile shares averaged across seasons, minutes-weighted. */
  const avgMix = useMemo(() => {
    const sums = new Map<string, number>();
    for (const item of detail) {
      for (const row of item.mix) sums.set(row.label, (sums.get(row.label) ?? 0) + row.share * item.weight);
    }
    return [...sums.entries()]
      .map(([label, share]) => ({ label, share: share / weightTotal }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 4);
  }, [detail, weightTotal]);

  const dominant = avgMix[0] ?? null;

  /** Section score matrix: one column per season plus the weighted average. */
  const matrix = useMemo(() => {
    const titles: { title: string; tone: string }[] = [];
    for (const item of detail) {
      for (const score of item.scores) {
        if (!titles.some((entry) => entry.title === score.title)) titles.push({ title: score.title, tone: score.tone });
      }
    }
    return titles
      .map((entry) => {
        const cells = detail.map((item) => item.scores.find((score) => score.title === entry.title)?.score ?? null);
        const avg = weightedMean(
          cells
            .map((value, index) => ({ value, weight: detail[index].weight }))
            .filter((cell): cell is { value: number; weight: number } => cell.value != null),
        );
        return { ...entry, cells, avg };
      })
      .filter((entry) => entry.avg != null);
  }, [detail]);

  /** Radar de blocos: um único polígono — a média ponderada entre temporadas. */
  const blockRadar = useMemo(() => {
    if (!matrix.length) return null;
    return {
      titles: matrix.map((entry) => entry.title),
      average: matrix.map((entry) => entry.avg),
    };
  }, [matrix]);

  /** Metrics averaged across seasons for the strengths/areas lists. */
  const avgMetrics = useMemo(() => {
    type Agg = ReportMetric & { weighted: number; weight: number; per: (number | null)[] };
    const map = new Map<string, Agg>();
    detail.forEach((item, seasonIndex) => {
      for (const metric of item.metrics) {
        const key = `${metric.name}::${metric.context}`;
        const agg = map.get(key) ?? { ...metric, weighted: 0, weight: 0, per: Array(detail.length).fill(null) };
        agg.weighted += metric.percentile * item.weight;
        agg.weight += item.weight;
        agg.per[seasonIndex] = metric.percentile;
        map.set(key, agg);
      }
    });
    return [...map.values()].map((agg) => ({
      name: agg.name,
      context: agg.context,
      tone: agg.tone,
      percentile: Math.round(agg.weighted / agg.weight),
      value: agg.per.map((value) => (value == null ? "—" : value)).join(" · "),
    }));
  }, [detail]);

  const errosLabel = translateLabel("Erros Totais", lang);
  const ranked = [...avgMetrics].sort((a, b) => b.percentile - a.percentile);
  const strengths = ranked
    .filter((metric) => metric.percentile >= 50 && metric.name !== errosLabel)
    .slice(0, 6);
  const weaknesses = [...ranked]
    .reverse()
    .filter((metric) => metric.percentile < 50)
    .slice(0, 6);

  const tendencies = useMemo(() => summaryTendencies(detail, lang, family), [detail, lang, family]);
  const bio = useMemo(() => reportBio(main, lang), [main, lang]);
  const heatmap = useMemo(() => mergedSummaryHeatmap(ordered), [ordered]);
  const avgRun = useMemo(() => averagePhysicalRun(ordered), [ordered]);

  return (
    <article className="player-report player-report-summary" lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="player-report-page">
        <ReportBanner
        kicker={copy.multiKicker}
        league={familyLabel}
        family={copy.multiSeasons(ordered.length)}
        season={
          ordered.length > 1
            ? `${ordered[0].year}–${ordered[ordered.length - 1].year}`
            : ordered[0].year
        }
        seasonTag={copy.multiTag}
      />

      <div className="player-report-body">
        <section className="player-report-mini player-report-hero">
          <PlayerPhoto
            src={main.transfermarkt?.photo}
            alt=""
            className="player-report-hero-photo"
            fallback={<span className="player-report-hero-photo player-report-photo-fallback">{playerInitials(main.name)}</span>}
          />
          <div>
            <h1>{main.name}</h1>
            <p>
              <span>{translateLabel(main.position, lang)}</span>
              <span className="player-report-dot">·</span>
              <span>{familyLabel}</span>
              {dominant ? (
                <>
                  <span className="player-report-dot">·</span>
                  <span>
                    {copy.avgProfileTitle}: {translateLabel(dominant.label, lang)}
                  </span>
                </>
              ) : null}
            </p>
            {bio.length ? (
              <ul className="player-report-bio player-report-bio-mini">
                {bio.map((item) => (
                  <li key={item.label}>
                    <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                    <span className="player-report-bio-text">
                      <span className="player-report-bio-label">{item.label}</span>
                      <strong>{item.value}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {heatmap ? (
            <div className="player-report-heat player-report-heat-summary">
              <p className="player-report-label">{copy.avgHeatmapTitle}</p>
              <PlayerHeatmap playerName={main.name} heatmap={heatmap} fixed={{ width: 200, height: 130 }} />
            </div>
          ) : null}
        </section>

        <section className="player-report-card player-report-seasons-card" aria-label={copy.coveredSeasons}>
          <header className="player-report-card-head">
            <h2>{copy.coveredSeasons}</h2>
            <span>{copy.multiSeasons(ordered.length)}</span>
          </header>
          <table className="player-report-seasons">
            <thead>
              <tr>
                <th>{copy.seasonTag}</th>
                <th>{REPORT_COPY[lang].profile}</th>
                <th>{copy.club}</th>
                <th>{copy.minutes}</th>
                <th>{copy.goals}</th>
                <th>{copy.assists}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={`${item.year}-${item.leagueName}`}>
                  <th scope="row">
                    {item.year}
                    <small>{item.leagueName}</small>
                  </th>
                  <td>{translateLabel(reportProfileName(item.player), lang)}</td>
                  <td>{item.player.club}</td>
                  <td className="tabular">{item.player.minutes.toLocaleString(locale)}</td>
                  <td className="tabular">{item.player.goals}</td>
                  <td className="tabular">{item.player.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="player-report-charts player-report-summary-charts">
          {blockRadar ? (
            <section className="player-report-card">
              <header className="player-report-card-head">
                <h2>{copy.blocksRadarTitle}</h2>
                <span>{copy.blocksRadarHint}</span>
              </header>
              <SeasonBlocksRadar titles={blockRadar.titles} average={blockRadar.average} />
            </section>
          ) : null}

          {matrix.length ? (
            <section className="player-report-card">
              <header className="player-report-card-head">
                <h2>{copy.blocksPerSeasonTitle}</h2>
                <span>{copy.blocksPerSeasonHint}</span>
              </header>
              <table className="player-report-matrix">
                <thead>
                  <tr>
                    <th>{copy.blocks}</th>
                    {ordered.map((item) => (
                      <th key={`${item.year}-${item.leagueName}`} className="tabular">
                        {item.year}
                      </th>
                    ))}
                    <th className="tabular is-avg">{copy.avgCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((entry) => (
                    <tr key={entry.title}>
                      <th scope="row">
                        <i style={{ background: TONE_COLORS[entry.tone] }} aria-hidden="true" />
                        {entry.title}
                      </th>
                      {entry.cells.map((value, index) => (
                        <td key={`${entry.title}-${index}`} className={`tabular ${percentileTone(value)}`}>
                          {value ?? "—"}
                        </td>
                      ))}
                      <td className={`tabular is-avg ${percentileTone(entry.avg != null ? Math.round(entry.avg) : null)}`}>
                        {entry.avg != null ? Math.round(entry.avg) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>

        <footer className="player-report-foot">
          <p className="player-report-avg-note">{copy.avgNote}</p>
          <ReportColophon generated={generated} page={copy.page(pageNumber, totalPages)} />
        </footer>
      </div>
      </div>

      <div className="player-report-page">
        <ReportBanner
        kicker={copy.multiKicker}
        league={familyLabel}
        family={copy.multiSeasons(ordered.length)}
        season={
          ordered.length > 1
            ? `${ordered[0].year}–${ordered[ordered.length - 1].year}`
            : ordered[0].year
        }
        seasonTag={copy.multiTag}
      />

      <div className="player-report-body">
        <header className="player-report-cont">
          <strong>{main.name}</strong>
          <span>
            {familyLabel}
            {ordered.length > 1 ? ` · ${ordered[0].year}–${ordered[ordered.length - 1].year}` : ` · ${ordered[0].year}`}
          </span>
        </header>

        {avgMix.length ? (
          <section className="player-report-card">
            <header className="player-report-card-head">
              <h2>{copy.avgProfileTitle}</h2>
              <span>{copy.avgProfileHint}</span>
            </header>
            <ul className="player-report-archetypes player-report-avg-mix">
              {avgMix.map((item, index) => (
                <li key={item.label} className={index === 0 ? "is-active" : undefined}>
                  <p className="player-report-archetype-name">
                    <i style={{ background: profileAccent(item.label) }} aria-hidden="true" />
                    <span>{translateLabel(item.label, lang)}</span>
                  </p>
                  <p className="player-report-archetype-share">
                    <strong>{Math.round(item.share)}%</strong>
                  </p>
                  <span className="player-report-archetype-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(3, Math.round(item.share))}%`, background: profileAccent(item.label) }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tendencies.length ? (
          <section className="player-report-tendencies player-report-summary-tendencies" aria-label={copy.tendencies}>
            <h2 className="player-report-heading">
              {copy.tendencies}
              <span className="player-report-tend-hint">{copy.avgTendenciesHint}</span>
            </h2>
            <div className="player-report-tendency-grid">
              {tendencies.map((item) => (
                <div key={item.key} className={`player-report-tendency${item.key === "curto" ? " is-length" : ""}`}>
                  <p className="player-report-label">{item.label}</p>
                  <strong>{item.detail}</strong>
                  <div className="player-report-tendency-bar">
                    <div className="player-report-tendency-track">
                      <span style={{ width: `${item.fill}%` }} />
                    </div>
                    {item.averageFill != null ? (
                      <i className="player-report-tendency-avg" style={{ left: `${item.averageFill}%` }} />
                    ) : null}
                  </div>
                  <div className="player-report-axis">
                    <span>{item.left}</span>
                    <span>{item.right}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {avgRun ? (
          <section className="player-report-card" aria-label={copy.gpsAvgTitle(ordered.length)}>
            <header className="player-report-card-head">
              <h2>{copy.gpsAvgTitle(ordered.length)}</h2>
              <span>{copy.avgTendenciesHint}</span>
            </header>
            <ul className="player-report-run-grid">
              {reportRunRows(avgRun, lang).map((metric) => (
                <li key={metric.key}>
                  <span className="player-report-run-label">{metric.label}</span>
                  <strong className="player-report-run-value">{metric.value}</strong>
                  {metric.pct != null ? (
                    <span className="player-report-run-bar" aria-hidden="true">
                      <i style={{ width: `${clampPct(metric.pct)}%` }} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="player-report-split">
          <MetricList
            title={copy.strengths}
            hint={copy.avgMetricsHint}
            metrics={strengths}
            empty={copy.noStrengths}
            tone="is-strong"
          />
          <MetricList
            title={copy.weaknesses}
            hint={copy.avgMetricsHint}
            metrics={weaknesses}
            empty={copy.noWeaknesses}
            tone="is-weak"
          />
        </div>

        <footer className="player-report-foot">
          <p className="player-report-avg-note">{copy.avgNote}</p>
          <ReportColophon generated={generated} page={copy.page(pageNumber + 1, totalPages)} />
        </footer>
      </div>
      </div>
    </article>
  );
}

type ReportSheetSpec = {
  player: PlayerProfile;
  /** Season year evaluated on this sheet (for the summary page and the banner). */
  seasonYear: string;
  leagueName: string;
  archiveSeasonLabel?: string;
  skipProjection?: boolean;
};

export function PlayerReportButton({
  player,
  scoutPlayer,
  family,
  players,
  primaryArchiveLabel,
  cta,
}: {
  player: PlayerProfile;
  scoutPlayer?: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  primaryArchiveLabel?: string;
  cta?: boolean;
}) {
  const { leagueId, name: currentLeagueName, season: currentSeason } = useLeague();
  const scout = scoutPlayer ?? player;
  const { beginLoad, endLoad } = useLoading();
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [lang, setLang] = useState<ReportLang>("pt");
  const [menuOpen, setMenuOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState(0);
  const [reportSheets, setReportSheets] = useState<ReportSheetSpec[]>([
    { player, seasonYear: "", leagueName: "", skipProjection: false },
  ]);
  const [includeArchive, setIncludeArchive] = useState<Record<string, boolean>>({});
  const [registryRows, setRegistryRows] = useState<{ league: string; season: string }[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Registro de identidade dá TODOS os anos disponíveis (cross_season está
  // vazio em linhas de arquivo e não cobre quem saiu da base corrente).
  useEffect(() => {
    // Sempre resolve a linha: identidade carimbada quando existe, senão
    // liga+temporada+player_id cai no persons.json e cobre qualquer linha.
    const qs = new URLSearchParams();
    if (scout.athlete_id) qs.set("athlete_id", scout.athlete_id);
    if (scout.person_key) qs.set("person_key", scout.person_key);
    qs.set("league", leagueId);
    qs.set("season", primaryArchiveLabel ?? currentSeason);
    qs.set("player_id", scout.player_id);
    let cancelled = false;
    fetch(`/api/athlete-rows?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rows?: { league: string; season: string }[] } | null) => {
        if (!cancelled) setRegistryRows(data?.rows ?? null);
      })
      .catch(() => {
        if (!cancelled) setRegistryRows(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scout.athlete_id, scout.person_key, scout.player_id, leagueId, primaryArchiveLabel, currentSeason]);

  const archiveYears = useMemo(() => {
    const viewedYear = primaryArchiveLabel ?? currentSeason;
    const years = new Set<string>();
    for (const row of registryRows ?? []) if (row.season) years.add(row.season);
    for (const row of scout.cross_season?.seasons ?? []) years.add(row.year);
    return [...years].filter((year) => year !== viewedYear).sort((a, b) => b.localeCompare(a));
  }, [registryRows, scout.cross_season, primaryArchiveLabel, currentSeason]);

  useEffect(() => {
    setMounted(true);
    setSheetUrl(window.location.href);
  }, [player.player_id]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Print only after the sheet re-rendered in the chosen language.
  useEffect(() => {
    if (!printRequest) return;
    beginLoad();
    const previousTitle = document.title;
    document.title = lang === "en" ? `${player.name} - SADA Scout Report` : `${player.name} - Relatório SADA Scout`;
    document.body.classList.add("exporting-player-report");
    const cleanup = () => {
      document.body.classList.remove("exporting-player-report");
      document.title = previousTitle;
      endLoad();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => endLoad(), 400);
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printRequest]);

  function leagueNameFor(rowLeague?: string): string {
    if (!rowLeague || rowLeague === leagueId) return currentLeagueName;
    return getLeague(rowLeague)?.name ?? rowLeague;
  }

  async function fetchArchiveProfile(year: string): Promise<{ profile: PlayerProfile; league: string } | null> {
    const league =
      registryRows?.find((row) => row.season === year)?.league ??
      scout.cross_season?.seasons.find((s) => s.year === year)?.league ??
      leagueId;
    const qs = new URLSearchParams({
      league,
      season: year,
      name: scout.name,
      birth_year: String(scout.birth_year ?? ""),
    });
    if (scout.athlete_id) qs.set("athlete_id", scout.athlete_id);
    if (scout.person_key) qs.set("person_key", scout.person_key);
    const res = await fetch(`/api/player-season?${qs}`);
    if (!res.ok) return null;
    return { profile: (await res.json()) as PlayerProfile, league };
  }

  async function exportPdf(next: ReportLang) {
    setMenuOpen(false);
    setLang(next);
    beginLoad();
    const primaryRow = scout.cross_season?.seasons.find((s) => s.year === primaryArchiveLabel);
    const sheets: ReportSheetSpec[] = [
      {
        player,
        skipProjection: player.player_id !== scout.player_id,
        archiveSeasonLabel: primaryArchiveLabel,
        seasonYear: primaryArchiveLabel ?? currentSeason,
        leagueName: leagueNameFor(primaryRow?.league),
      },
    ];
    const covered = new Set(primaryArchiveLabel ? [primaryArchiveLabel] : []);
    for (const year of archiveYears) {
      if (!includeArchive[year] || covered.has(year)) continue;
      const found = await fetchArchiveProfile(year);
      if (found) {
        sheets.push({
          player: found.profile,
          archiveSeasonLabel: year,
          seasonYear: year,
          leagueName: leagueNameFor(found.league),
          skipProjection: true,
        });
        covered.add(year);
      }
    }
    setReportSheets(sheets);
    endLoad();
    setPrintRequest((value) => value + 1);
  }

  const copy = REPORT_COPY[lang];

  return (
    <>
      <div className="shadow-add-menu player-report-menu" ref={rootRef}>
        <button
          type="button"
          className={`btn btn-ghost ${cta ? "hero-report-cta-btn" : "btn-sm"}${menuOpen ? " active" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={copy.pdfTitle}
        >
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> {cta ? "Gerar Relatório PDF" : "PDF"}
        </button>
        {menuOpen ? (
          <div className="shadow-add-dropdown" role="menu">
            {archiveYears.length ? (
              <div className="player-report-archive-picks" role="group" aria-label="Temporadas no PDF">
                <p className="player-report-archive-picks-title">Incluir fichas de arquivo</p>
                {archiveYears.map((year) => (
                  <label key={year} className="player-report-archive-pick">
                    <input
                      type="checkbox"
                      checked={Boolean(includeArchive[year])}
                      onChange={(event) =>
                        setIncludeArchive((current) => ({ ...current, [year]: event.target.checked }))
                      }
                    />
                    <span>
                      Temporada {year}
                      {registryRows?.find((row) => row.season === year)?.league
                        ? ` · ${leagueNameFor(registryRows.find((row) => row.season === year)!.league)}`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            <button type="button" role="menuitem" data-report-lang="pt" onClick={() => void exportPdf("pt")}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
              <span>
                <strong>{REPORT_COPY.pt.portuguese}</strong>
                <em>Relatório em português</em>
              </span>
            </button>
            <button type="button" role="menuitem" data-report-lang="en" onClick={() => void exportPdf("en")}>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" />
              <span>
                <strong>{REPORT_COPY.en.english}</strong>
                <em>Report in English</em>
              </span>
            </button>
          </div>
        ) : null}
      </div>
      {mounted
        ? createPortal(
            <>
              {reportSheets.map((sheet, index) => (
                <ReportSheet
                  key={sheet.archiveSeasonLabel ?? `main-${sheet.player.player_id}`}
                  player={sheet.player}
                  family={family}
                  players={players}
                  lang={lang}
                  sheetUrl={sheetUrl}
                  archiveSeasonLabel={sheet.archiveSeasonLabel}
                  leagueName={sheet.leagueName}
                  skipProjection={sheet.skipProjection}
                  pageOffset={index * 2}
                  totalPages={reportSheets.length * 2 + (reportSheets.length > 1 ? 2 : 0)}
                />
              ))}
              {reportSheets.length > 1 ? (
                <SeasonSummarySheet
                  rows={reportSheets.map((sheet) => ({
                    player: sheet.player,
                    year: sheet.seasonYear,
                    leagueName: sheet.leagueName,
                  }))}
                  family={family}
                  lang={lang}
                  pageNumber={reportSheets.length * 2 + 1}
                  totalPages={reportSheets.length * 2 + 2}
                />
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (value) return value;
  }
  return "—";
}
