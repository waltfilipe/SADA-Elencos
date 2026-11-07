"use client";

import { useEffect, useRef } from "react";
import type { PlayerHeatmapData } from "@/lib/types";

type Props = {
  heatmap?: PlayerHeatmapData | null;
  playerName: string;
  compact?: boolean;
  /** Goal-to-goal axis runs upward, so the pitch card is tall. */
  upright?: boolean;
  /** Paint immediately at this size. Used by the print report, which is hidden on screen. */
  fixed?: { width: number; height: number };
};

type Point = { x: number; y: number; w?: number };

/** Real pitch proportions in metres — data is normalised 0–100 on both axes. */
const PITCH_L = 105;
const PITCH_W = 68;
const PITCH_RATIO = PITCH_L / PITCH_W;

/** One density cell per metre keeps the gaussian smooth after upscaling. */
const GRID_W = 105;
const GRID_H = 68;
const SIGMA = 4.6;

/** Broadcast-style density: cool and quiet until the real hotspots. */
const RAMP: { stop: number; rgba: [number, number, number, number] }[] = [
  { stop: 0.0, rgba: [20, 90, 160, 0] },
  { stop: 0.28, rgba: [32, 140, 190, 0.05] },
  { stop: 0.48, rgba: [40, 170, 120, 0.22] },
  { stop: 0.66, rgba: [232, 196, 48, 0.5] },
  { stop: 0.82, rgba: [230, 110, 28, 0.68] },
  { stop: 1.0, rgba: [176, 28, 36, 0.82] },
];

function rampColor(t: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i += 1) {
    const hi = RAMP[i];
    if (v > hi.stop && i < RAMP.length - 1) continue;
    const lo = RAMP[i - 1];
    const span = hi.stop - lo.stop || 1;
    const k = (v - lo.stop) / span;
    return [
      lo.rgba[0] + (hi.rgba[0] - lo.rgba[0]) * k,
      lo.rgba[1] + (hi.rgba[1] - lo.rgba[1]) * k,
      lo.rgba[2] + (hi.rgba[2] - lo.rgba[2]) * k,
      lo.rgba[3] + (hi.rgba[3] - lo.rgba[3]) * k,
    ];
  }
  return RAMP[RAMP.length - 1].rgba;
}

function buildDensity(points: Point[]): Float32Array {
  const grid = new Float32Array(GRID_W * GRID_H);
  const radius = Math.ceil(SIGMA * 3);
  const denom = 2 * SIGMA * SIGMA;

  for (const pt of points) {
    // x runs goal to goal (attack to the right), y is the width of the pitch.
    const weight = pt.w ?? 1;
    const cx = Math.round((pt.x / 100) * (GRID_W - 1));
    const cy = Math.round(((100 - pt.y) / 100) * (GRID_H - 1));

    for (let dy = -radius; dy <= radius; dy += 1) {
      const gy = cy + dy;
      if (gy < 0 || gy >= GRID_H) continue;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const gx = cx + dx;
        if (gx < 0 || gx >= GRID_W) continue;
        grid[gy * GRID_W + gx] += weight * Math.exp(-(dx * dx + dy * dy) / denom);
      }
    }
  }

  let max = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] > max) max = grid[i];
  }
  if (max > 0) {
    for (let i = 0; i < grid.length; i += 1) {
      // Slight gamma above 1 keeps low-traffic zones clear and hotspots tight.
      grid[i] = Math.pow(grid[i] / max, 1.45);
    }
  }
  return grid;
}

type Rect = { x: number; y: number; w: number; h: number };

function pitchRect(w: number, h: number, compact = false, evenPad = false): Rect {
  const padX = evenPad ? Math.max(6, w * 0.035) : compact ? Math.max(2, w * 0.025) : Math.max(8, w * 0.04);
  const padTop = evenPad ? Math.max(6, h * 0.04) : compact ? Math.max(2, h * 0.04) : Math.max(6, h * 0.03);
  const padBottom = evenPad ? padTop : compact ? Math.max(2, h * 0.04) : Math.max(18, h * 0.09);
  const availW = Math.max(0, w - padX * 2);
  const availH = Math.max(0, h - padTop - padBottom);
  let pw = availW;
  let ph = pw / PITCH_RATIO;
  if (ph > availH) {
    ph = availH;
    pw = ph * PITCH_RATIO;
  }
  return { x: (w - pw) / 2, y: padTop + (availH - ph) / 2, w: pw, h: ph };
}

function roundedPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.moveTo(r.x + radius, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius);
  ctx.closePath();
}

function drawGrass(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  const base = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  base.addColorStop(0, "#1c7a45");
  base.addColorStop(0.45, "#176b3c");
  base.addColorStop(1, "#145c34");

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const bands = 10;
  const bandW = r.w / bands;
  for (let i = 0; i < bands; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    ctx.fillRect(r.x + i * bandW, r.y, bandW, r.h);
  }

  const shade = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  shade.addColorStop(0, "rgba(255, 255, 255, 0.07)");
  shade.addColorStop(0.45, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  ctx.fillStyle = shade;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawHeat(ctx: CanvasRenderingContext2D, r: Rect, radius: number, points: Point[], compact = false) {
  const density = buildDensity(points);

  const off = document.createElement("canvas");
  off.width = GRID_W;
  off.height = GRID_H;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;

  const img = offCtx.createImageData(GRID_W, GRID_H);
  for (let i = 0; i < density.length; i += 1) {
    const [cr, cg, cb, ca] = rampColor(density[i]);
    const o = i * 4;
    img.data[o] = cr;
    img.data[o + 1] = cg;
    img.data[o + 2] = cb;
    img.data[o + 3] = Math.round(ca * 255);
  }
  offCtx.putImageData(img, 0, 0);

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Bilinear upscale plus a light blur removes the per-cell grid entirely.
  ctx.filter = compact ? `blur(${Math.max(0.55, r.w * 0.008)}px)` : `blur(${Math.max(1.4, r.w * 0.012)}px)`;
  ctx.drawImage(off, r.x, r.y, r.w, r.h);
  ctx.filter = "none";
  ctx.restore();
}

function drawLines(ctx: CanvasRenderingContext2D, r: Rect, radius: number, compact = false) {
  const mx = (m: number) => r.x + (m / PITCH_L) * r.w;
  const my = (m: number) => r.y + (m / PITCH_W) * r.h;
  const scale = r.w / PITCH_L;

  ctx.save();
  roundedPath(ctx, r, radius);
  ctx.clip();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = compact ? Math.max(0.65, r.w * 0.004) : Math.max(1.1, r.w * 0.0022);
  ctx.lineJoin = "round";

  ctx.strokeRect(r.x, r.y, r.w, r.h);

  ctx.beginPath();
  ctx.moveTo(mx(PITCH_L / 2), r.y);
  ctx.lineTo(mx(PITCH_L / 2), r.y + r.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mx(PITCH_L / 2), my(PITCH_W / 2), 9.15 * scale, 0, Math.PI * 2);
  ctx.stroke();

  const boxDepth = 16.5;
  const boxHalf = 20.16;
  const sixDepth = 5.5;
  const sixHalf = 9.16;

  for (const side of [0, 1]) {
    const dir = side === 0 ? 1 : -1;
    const goalLine = side === 0 ? 0 : PITCH_L;

    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? 0 : -boxDepth)),
      my(PITCH_W / 2 - boxHalf),
      boxDepth * scale,
      boxHalf * 2 * scale,
    );

    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? 0 : -sixDepth)),
      my(PITCH_W / 2 - sixHalf),
      sixDepth * scale,
      sixHalf * 2 * scale,
    );

    const spotX = mx(goalLine + dir * 11);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(spotX, my(PITCH_W / 2), Math.max(1.2, r.w * 0.0032), 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      mx(goalLine + dir * boxDepth),
      r.y,
      (PITCH_L - boxDepth) * scale * dir,
      r.h,
    );
    ctx.clip();
    ctx.beginPath();
    ctx.arc(spotX, my(PITCH_W / 2), 9.15 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const goalDepth = 1.6;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeRect(
      mx(goalLine + (dir === 1 ? -goalDepth : 0)),
      my(PITCH_W / 2 - 3.66),
      goalDepth * scale,
      7.32 * scale,
    );
    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  }

  const cornerR = 1 * scale;
  const corners: [number, number, number][] = [
    [r.x, r.y, 0],
    [r.x + r.w, r.y, Math.PI / 2],
    [r.x + r.w, r.y + r.h, Math.PI],
    [r.x, r.y + r.h, -Math.PI / 2],
  ];
  for (const [cx, cy, start] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, start, start + Math.PI / 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAttackHint(ctx: CanvasRenderingContext2D, r: Rect) {
  const y = r.y + r.h + Math.max(12, r.h * 0.07);
  ctx.save();
  ctx.fillStyle = "rgba(226, 232, 240, 0.72)";
  ctx.font = `600 ${Math.max(9, r.h * 0.045)}px "TASA Orbiter Variable", system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Ataque  →", r.x + r.w, y);
  ctx.restore();
}

function paintPitch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: Point[],
  compact: boolean,
  evenPad: boolean,
) {
  const rect = pitchRect(width, height, compact, evenPad);
  if (rect.w <= 0 || rect.h <= 0) return null;
  const radius = Math.max(2, Math.min(6, rect.h * 0.02));
  drawGrass(ctx, rect, radius);
  if (points.length) drawHeat(ctx, rect, radius, points, compact);
  drawLines(ctx, rect, radius, compact);
  return rect;
}

/** Landscape render, rotated so the attacking goal sits at the top. */
function renderUpright(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: Point[],
  dpr: number,
) {
  const labelH = 16;
  const boxW = width;
  const boxH = Math.max(1, height - labelH);
  const bw = boxH;
  const bh = boxW;

  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(bw * dpr));
  off.height = Math.max(1, Math.floor(bh * dpr));
  const offCtx = off.getContext("2d");
  if (!offCtx) return;
  offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintPitch(offCtx, bw, bh, points, false, true);

  ctx.save();
  ctx.translate(boxW / 2, labelH + boxH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(off, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(226, 232, 240, 0.72)";
  ctx.font = `600 11px "TASA Orbiter Variable", system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Ataque  ↑", width - 2, labelH / 2);
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, points: Point[], compact = false, upright = false) {
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const width = Math.floor(wrap.clientWidth);
  const height = Math.floor(wrap.clientHeight);
  // The observer also fires while the card is collapsed, where no pitch fits.
  if (compact) {
    if (width < 48 || height < 32) return;
  } else if (upright) {
    if (width < 72 || height < 120) return;
  } else if (width < 80 || height < 60) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (upright) {
    renderUpright(ctx, width, height, points, dpr);
    return;
  }

  const rect = paintPitch(ctx, width, height, points, compact, false);
  if (rect && !compact) drawAttackHint(ctx, rect);
}

export function PlayerHeatmap({ heatmap, playerName, compact = false, upright = false, fixed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const points = heatmap?.points ?? [];
  const hasPoints = points.length > 0;

  useEffect(() => {
    if (!fixed) return;
    const canvas = canvasRef.current;
    if (!canvas || !hasPoints) return;
    const { width, height } = fixed;
    const dpr = 2;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    paintPitch(ctx, width, height, points, true, true);
    // The point list lives on the heatmap object. A fresh empty array must not retrigger the paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed?.width, fixed?.height, hasPoints, heatmap]);

  useEffect(() => {
    if (fixed) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !hasPoints) return;

    let seen = false;
    const paint = () => {
      if (seen) render(canvas, points, compact, upright);
    };
    const onScreen = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      seen = true;
      render(canvas, points, compact, upright);
    }, { rootMargin: "240px" });
    onScreen.observe(wrap);

    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => {
      onScreen.disconnect();
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap, hasPoints, compact, upright]);

  if (!hasPoints && !heatmap?.image_url) {
    if (compact) return <div className="heatmap-compact-empty" aria-hidden="true" />;
    return (
      <div className="heatmap-empty">
        <span className="heatmap-empty-icon" aria-hidden="true">
          <i className="fa-solid fa-map-location-dot" />
        </span>
        <p className="heatmap-placeholder-copy">Mapa de calor indisponível para este atleta.</p>
      </div>
    );
  }

  const meta = [
    heatmap?.competition,
    heatmap?.scope && heatmap.scope !== "overall" ? heatmap.scope : null,
    heatmap?.point_count ? `${heatmap.point_count} zonas` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ariaLabel = `Mapa de calor de ${playerName}${meta ? ` — ${meta}` : ""}`;

  if (fixed && hasPoints) {
    return (
      <div className="heatmap-body heatmap-fixed" style={{ width: fixed.width, height: fixed.height }}>
        <canvas ref={canvasRef} className="heatmap-pitch-canvas" role="img" aria-label={ariaLabel} />
      </div>
    );
  }

  return (
    <div className={`heatmap-body heatmap-body-live${compact ? " heatmap-compact" : ""}${upright ? " heatmap-upright" : ""}`}>
      {hasPoints ? (
        <div ref={wrapRef} className="heatmap-pitch-wrap">
          <canvas ref={canvasRef} className="heatmap-pitch-canvas" role="img" aria-label={ariaLabel} />
        </div>
      ) : heatmap?.image_url ? (
        <img src={heatmap.image_url} alt={ariaLabel} className="heatmap-img" />
      ) : null}
      {meta && !compact ? <p className="heatmap-meta">{meta}</p> : null}
    </div>
  );
}
