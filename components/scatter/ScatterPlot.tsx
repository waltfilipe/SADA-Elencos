"use client";

import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useLoading } from "@/components/LoadingProvider";

export type ScatterPoint = {
  player_id: string;
  label: string;
  name: string;
  club: string;
  href: string;
  x: number;
  y: number;
  minutes?: number;
};

export type ScatterHighlight = {
  id: string;
  tone: "a" | "b" | "c";
};

type Props = {
  points: ScatterPoint[];
  avgX: number;
  avgY: number;
  highlights: ScatterHighlight[];
  xLabel: string;
  yLabel: string;
  /** Fixed canvas size (print / thumbnails). Skips resize observer when set. */
  fixedSize?: { width: number; height: number };
  /** Unique id for SVG defs when multiple plots share one document. */
  instanceId?: string;
  /** When false, points are not clickable and tooltips are off. */
  interactive?: boolean;
  /** "print" renders a light palette for white PDF pages. */
  variant?: "screen" | "print";
};

const PAD = { top: 30, right: 24, bottom: 60, left: 88 };

const TONE_FILL = {
  a: "var(--side-a)",
  b: "var(--side-b)",
  c: "var(--side-c)",
} as const;

const TONE_FILL_PRINT = {
  a: "#059669",
  b: "#6d5ef0",
  c: "#0284c7",
} as const;

const toneFill = (tone: "a" | "b" | "c", light: boolean) =>
  light ? TONE_FILL_PRINT[tone] : TONE_FILL[tone];

function formatAxis(value: number, digits = 1): string {
  const d = Math.abs(value) >= 10 ? Math.min(digits, 1) : digits;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Nome da métrica sem o sufixo "/90" — sempre completo, nunca cortado. */
function shortLabel(label: string): string {
  return label.split("/")[0]?.trim() || label;
}

/** Round "nice" ticks: step in {1,2,2.5,5}·10^k covering [lo,hi] with ~5-7 marks. */
function niceTicks(lo: number, hi: number, target = 5): { ticks: number[]; digits: number } {
  const span = hi - lo || 1;
  const rough = span / target;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  let step = base * 10;
  for (const mult of [1, 2, 2.5, 5, 10]) {
    step = base * mult;
    if (span / step <= target + 1.5) break;
  }
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  if (!ticks.length) ticks.push(0, step);
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return { ticks, digits };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

function bounds(values: number[], anchor: number, cap?: number) {
  const min = Math.min(...values, anchor);
  const rawMax = Math.max(...values, anchor);
  const max = cap != null && cap < rawMax ? cap : rawMax;
  const span = max - min || 1;
  const pad = span * 0.16;
  let lo = min - pad;
  const hi = max + pad;
  if (min >= 0) lo = Math.max(0, lo);
  return { min: lo, max: hi, truncated: cap != null && cap < rawMax };
}

type Tip = {
  name: string;
  club: string;
  x: number;
  y: number;
  xVal: number;
  yVal: number;
  pctX: number;
  pctY: number;
  minutes?: number;
  left: number;
  top: number;
};

export function ScatterPlot({
  points,
  avgX,
  avgY,
  highlights,
  xLabel,
  yLabel,
  fixedSize,
  instanceId = "main",
  interactive = true,
  variant = "screen",
}: Props) {
  const light = variant === "print";
  const router = useRouter();
  const { beginLoad } = useLoading();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => fixedSize ?? { width: 720, height: 640 });
  const [tip, setTip] = useState<Tip | null>(null);
  const [showAll, setShowAll] = useState(false);
  useLayoutEffect(() => {
    if (fixedSize) {
      setSize(fixedSize);
      return;
    }
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width < 80 || height < 80) return;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixedSize?.width, fixedSize?.height]);
  const width = size.width;
  const height = size.height;
  const toneById = useMemo(() => {
    const map = new Map<string, ScatterHighlight["tone"]>();
    for (const highlight of highlights) {
      if (highlight.id && !map.has(highlight.id)) map.set(highlight.id, highlight.tone);
    }
    return map;
  }, [highlights]);

  const sorted = useMemo(
    () => ({
      x: [...points.map((p) => p.x)].sort((a, b) => a - b),
      y: [...points.map((p) => p.y)].sort((a, b) => a - b),
    }),
    [points],
  );

  const pctOf = (value: number, axis: "x" | "y") => {
    const arr = sorted[axis];
    if (!arr.length) return 50;
    let n = 0;
    while (n < arr.length && arr[n]! <= value) n += 1;
    return Math.round((n / arr.length) * 100);
  };

  const chart = useMemo(() => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    // p98 cap keeps a single outlier from flattening the rest of the pool.
    const capX = !showAll && xs.length >= 8 ? percentile(xs, 98) : undefined;
    const capY = !showAll && ys.length >= 8 ? percentile(ys, 98) : undefined;
    const xb = bounds(xs.length ? xs : [0], avgX, capX);
    const yb = bounds(ys.length ? ys : [0], avgY, capY);

    const plotW = Math.max(48, width - PAD.left - PAD.right);
    const plotH = Math.max(48, height - PAD.top - PAD.bottom);

    const clampX = (value: number) => Math.max(xb.min, Math.min(xb.max, value));
    const clampY = (value: number) => Math.max(yb.min, Math.min(yb.max, value));
    const scaleX = (value: number) => PAD.left + ((clampX(value) - xb.min) / (xb.max - xb.min || 1)) * plotW;
    const scaleY = (value: number) => PAD.top + plotH - ((clampY(value) - yb.min) / (yb.max - yb.min || 1)) * plotH;

    const xt = niceTicks(xb.min, xb.max);
    const yt = niceTicks(yb.min, yb.max);

    const clipped = points.filter((p) => p.x > xb.max || p.y > yb.max).length;

    return { scaleX, scaleY, xTicks: xt, yTicks: yt, xb, yb, clipped };
  }, [points, avgX, avgY, width, height, showAll]);

  const { scaleX, scaleY, xTicks, yTicks, xb, yb, clipped } = chart;
  const plotLeft = PAD.left;
  const plotTop = PAD.top;
  const plotRight = width - PAD.right;
  const plotBottom = height - PAD.bottom;
  const avgLineX = scaleX(avgX);
  const avgLineY = scaleY(avgY);
  const quietPool = toneById.size > 0;
  const xShort = shortLabel(xLabel);
  const yShort = shortLabel(yLabel);

  const showTip = (event: MouseEvent, point: ScatterPoint) => {
    const boundsRect = wrapRef.current?.getBoundingClientRect();
    if (!boundsRect) return;
    setTip({
      name: point.name,
      club: point.club,
      xVal: point.x,
      yVal: point.y,
      pctX: pctOf(point.x, "x"),
      pctY: pctOf(point.y, "y"),
      minutes: point.minutes,
      x: 0,
      y: 0,
      left: event.clientX - boundsRect.left,
      top: event.clientY - boundsRect.top,
    });
  };

  const openPlayer = (point: ScatterPoint) => {
    if (!interactive) return;
    beginLoad();
    router.push(point.href);
  };

  /** Marker shape per athlete: 1 = losango, 2 = círculo, 3 = quadrado. Pool = bolinha pequena. */
  const Marker = ({ tone, cx, cy, size, fill, muted }: { tone?: "a" | "b" | "c"; cx: number; cy: number; size: number; fill: string; muted?: boolean }) => {
    const stroke = light
      ? "rgba(255,255,255,0.95)"
      : tone
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.15)";
    if (!tone) {
      return <circle cx={cx} cy={cy} r={size * 0.85} fill={fill} stroke={stroke} strokeWidth={muted ? 0.6 : 1} />;
    }
    if (tone === "b") {
      return <circle cx={cx} cy={cy} r={size} fill={fill} stroke={stroke} strokeWidth={1} />;
    }
    if (tone === "c") {
      return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} fill={fill} stroke={stroke} strokeWidth={1} />;
    }
    return (
      <rect
        x={cx - size}
        y={cy - size}
        width={size * 2}
        height={size * 2}
        transform={`rotate(45 ${cx} ${cy})`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
    );
  };

  // Label collision: greedy placement above → below → right → left of the point.
  const labelRects: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const overlaps = (r: { x1: number; y1: number; x2: number; y2: number }) =>
    labelRects.some((o) => r.x1 < o.x2 && r.x2 > o.x1 && r.y1 < o.y2 && r.y2 > o.y1);

  const renderPoint = (point: ScatterPoint) => {
    const tone = toneById.get(point.player_id);
    const highlighted = Boolean(tone);
    const out = point.x > xb.max || point.y > yb.max;
    const cx = scaleX(point.x);
    const cy = scaleY(point.y);
    const size = highlighted ? 8 : 4.5;
    const fill = tone
      ? toneFill(tone, light)
      : light
        ? "rgba(100, 116, 139, 0.9)"
        : "rgba(160, 176, 196, 0.95)";
    const opacity = highlighted ? 1 : out ? 0.25 : quietPool ? (light ? 0.55 : 0.42) : 0.85;

    let label = null as React.ReactNode;
    if (tone) {
      const text = point.label;
      const estW = Math.max(text.length * 7.2, 46);
      const estH = 24;
      const spots = [
        { dx: 0, dy: -(size + 16), anchor: "middle" as const },
        { dx: 0, dy: size + 30, anchor: "middle" as const },
        { dx: size + 10, dy: 2, anchor: "start" as const },
        { dx: -(size + 10), dy: 2, anchor: "end" as const },
      ];
      let chosen = spots[0]!;
      for (const spot of spots) {
        const lx = cx + spot.dx;
        const ly = cy + spot.dy;
        const rect =
          spot.anchor === "middle"
            ? { x1: lx - estW / 2, y1: ly - estH, x2: lx + estW / 2, y2: ly + 6 }
            : spot.anchor === "start"
              ? { x1: lx, y1: ly - 10, x2: lx + estW, y2: ly + estH - 10 }
              : { x1: lx - estW, y1: ly - 10, x2: lx, y2: ly + estH - 10 };
        const inside =
          rect.x1 >= plotLeft - 4 && rect.x2 <= plotRight + 4 && rect.y1 >= plotTop - 2 && rect.y2 <= plotBottom + 2;
        if (inside && !overlaps(rect)) {
          chosen = spot;
          labelRects.push(rect);
          break;
        }
      }
      const lx = cx + chosen.dx;
      const ly = cy + chosen.dy;
      label = (
        <g className={`scatter-tag tag-${tone}`}>
          {chosen.dy !== -(size + 16) && (
            <line x1={cx} y1={cy} x2={lx} y2={ly - (chosen.anchor === "middle" ? 8 : -2)} className="scatter-tag-line" />
          )}
          <text x={lx} y={ly} textAnchor={chosen.anchor}>
            <tspan x={lx} dy={chosen.anchor === "middle" ? -2 : 0}>
              {text}
            </tspan>
            <tspan x={lx} dy={13} className="scatter-tag-values">
              {formatAxis(point.x)} | {formatAxis(point.y)}
            </tspan>
          </text>
        </g>
      );
    }

    return (
      <g
        key={point.player_id}
        className={tone ? `pt-${tone} scatter-point` : "pt-pool scatter-point"}
        opacity={opacity}
        data-player-id={point.player_id}
        data-player-name={point.name}
        cursor="pointer"
        onMouseEnter={interactive ? (event) => showTip(event, point) : undefined}
        onMouseMove={interactive ? (event) => showTip(event, point) : undefined}
        onMouseLeave={interactive ? () => setTip(null) : undefined}
        onClick={() => openPlayer(point)}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPlayer(point);
                }
              }
            : undefined
        }
        role={interactive ? "link" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${point.name}, ${point.club}` : undefined}
      >
        <circle cx={cx} cy={cy} r={14} fill="transparent" />
        {highlighted && <circle cx={cx} cy={cy} r={size + 7} fill={fill} opacity={0.16} />}
        <Marker tone={tone} cx={cx} cy={cy} size={size} fill={fill} muted={!highlighted} />
        {label}
      </g>
    );
  };

  const pool = points.filter((point) => !toneById.has(point.player_id));
  const marked = points.filter((point) => toneById.has(point.player_id));

  // Rótulos nos cantos do gráfico, em duas linhas (X em cima, Y embaixo), com o nome completo.
  const quadrants = [
    { x: plotRight - 12, y: plotTop + 20, anchor: "end" as const, lines: [`↑ ${xShort}`, `↑ ${yShort}`] },
    { x: plotLeft + 12, y: plotTop + 20, anchor: "start" as const, lines: [`↓ ${xShort}`, `↑ ${yShort}`] },
    { x: plotRight - 12, y: plotBottom - 26, anchor: "end" as const, lines: [`↑ ${xShort}`, `↓ ${yShort}`] },
    { x: plotLeft + 12, y: plotBottom - 26, anchor: "start" as const, lines: [`↓ ${xShort}`, `↓ ${yShort}`] },
  ];

  return (
    <div className={`scatter-plot-wrap${light ? " scatter-plot--light" : ""}`} ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="scatter-plot"
        role="img"
        aria-label={`Dispersão: ${xLabel} vs ${yLabel}`}
        data-x-label={xLabel}
        data-y-label={yLabel}
      >
        <defs>
          <linearGradient id={`scatter-bg-${instanceId}`} x1="0" y1="0" x2="0" y2="1">
            {light ? (
              <>
                <stop offset="0%" stopColor="#fbfdff" />
                <stop offset="100%" stopColor="#eef2f7" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="rgba(20, 27, 38, 0.95)" />
                <stop offset="100%" stopColor="rgba(12, 17, 25, 0.98)" />
              </>
            )}
          </linearGradient>
        </defs>

        <rect
          x={plotLeft}
          y={plotTop}
          width={plotRight - plotLeft}
          height={plotBottom - plotTop}
          fill={`url(#scatter-bg-${instanceId})`}
          rx="14"
        />

        <rect x={avgLineX} y={plotTop} width={Math.max(0, plotRight - avgLineX)} height={Math.max(0, avgLineY - plotTop)} fill={light ? "rgba(5, 150, 105, 0.05)" : "rgba(52, 211, 153, 0.045)"} />
        <rect x={plotLeft} y={plotTop} width={Math.max(0, avgLineX - plotLeft)} height={Math.max(0, avgLineY - plotTop)} fill={light ? "rgba(109, 94, 240, 0.05)" : "rgba(167, 139, 250, 0.035)"} />
        <rect x={avgLineX} y={avgLineY} width={Math.max(0, plotRight - avgLineX)} height={Math.max(0, plotBottom - avgLineY)} fill={light ? "rgba(2, 132, 199, 0.05)" : "rgba(94, 234, 212, 0.035)"} />
        <rect x={plotLeft} y={avgLineY} width={Math.max(0, avgLineX - plotLeft)} height={Math.max(0, plotBottom - avgLineY)} fill={light ? "rgba(100, 116, 139, 0.04)" : "rgba(148, 163, 184, 0.025)"} />

        {xTicks.ticks.map((value) => (
          <line key={`gx-${value}`} x1={scaleX(value)} y1={plotTop} x2={scaleX(value)} y2={plotBottom} className="scatter-grid" />
        ))}
        {yTicks.ticks.map((value) => (
          <line key={`gy-${value}`} x1={plotLeft} y1={scaleY(value)} x2={plotRight} y2={scaleY(value)} className="scatter-grid" />
        ))}

        <line x1={avgLineX} y1={plotTop} x2={avgLineX} y2={plotBottom} className="scatter-avg-line" />
        <line x1={plotLeft} y1={avgLineY} x2={plotRight} y2={avgLineY} className="scatter-avg-line" />

        {plotRight - plotLeft >= 520 && quadrants.map((q) => (
          <text key={q.lines.join("|")} x={q.x} y={q.y} textAnchor={q.anchor} className="scatter-quad" aria-hidden>
            {q.lines.map((line, index) => (
              <tspan key={line} x={q.x} dy={index ? 14 : 0}>
                {line}
              </tspan>
            ))}
          </text>
        ))}

        {pool.map(renderPoint)}
        {marked.map(renderPoint)}

        {xTicks.ticks.map((value) => (
          <text key={`tx-${value}`} x={scaleX(value)} y={plotBottom + 22} textAnchor="middle" className="scatter-tick">
            {formatAxis(value, xTicks.digits)}
          </text>
        ))}
        {yTicks.ticks.map((value) => (
          <text key={`ty-${value}`} x={plotLeft - 14} y={scaleY(value) + 4} textAnchor="end" className="scatter-tick">
            {formatAxis(value, yTicks.digits)}
          </text>
        ))}

        <text x={(plotLeft + plotRight) / 2} y={height - 14} textAnchor="middle" className="scatter-axis-label">
          {xLabel}
        </text>
        <text
          x={18}
          y={(plotTop + plotBottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${(plotTop + plotBottom) / 2})`}
          className="scatter-axis-label"
        >
          {yLabel}
        </text>

        <text x={avgLineX + 6} y={plotTop + 13} className="scatter-avg-tag">
          média {formatAxis(avgX)}
        </text>
        <text x={plotRight - 6} y={avgLineY - 6} textAnchor="end" className="scatter-avg-tag">
          média {formatAxis(avgY)}
        </text>
      </svg>

      {interactive && !fixedSize ? (
        <div className="scatter-plot-legend" aria-hidden>
          <span className="lg-dot" /> pool · <span className="lg-line" /> média
        </div>
      ) : null}

      {interactive && !fixedSize && clipped > 0 ? (
        <button type="button" className="scatter-outlier-badge" onClick={() => setShowAll((v) => !v)}>
          {clipped} {clipped === 1 ? "atleta fora" : "atletas fora"} da escala · {showAll ? "reajustar" : "ver tudo"}
        </button>
      ) : null}

      {tip && (
        <div className="scatter-tooltip" style={{ left: tip.left, top: tip.top }} role="tooltip">
          <strong className="scatter-tip-name">{tip.name}</strong>
          {tip.club ? <span className="scatter-tip-club">{tip.club}</span> : null}
          <span className="scatter-tip-row">
            {xShort}: <b>{formatAxis(tip.xVal)}</b> · pct {tip.pctX}
          </span>
          <span className="scatter-tip-row">
            {yShort}: <b>{formatAxis(tip.yVal)}</b> · pct {tip.pctY}
          </span>
          {tip.minutes != null ? <span className="scatter-tip-club">{tip.minutes.toLocaleString("pt-BR")} min</span> : null}
        </div>
      )}
    </div>
  );
}
