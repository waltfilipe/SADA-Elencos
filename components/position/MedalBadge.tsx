"use client";

import { MEDAL_META, type MedalKind } from "@/lib/scoutTheme";

/** Flat medal palette — matches reference artwork (no gradients). */
const FLAT: Record<
  MedalKind,
  { ribbon: string; face: string; ring: string; star: string }
> = {
  gold: {
    ribbon: "#EBC55B",
    face: "#EBC55B",
    ring: "#F5DC8A",
    star: "#C9A23F",
  },
  bronze: {
    ribbon: "#D68F6C",
    face: "#D68F6C",
    ring: "#E8B09A",
    star: "#B87355",
  },
  silver: {
    ribbon: "#C5CAD3",
    face: "#C5CAD3",
    ring: "#E2E6EE",
    star: "#9AA3B2",
  },
};

type IconProps = {
  medal: MedalKind;
  size?: number;
  title?: string;
  className?: string;
};

/** Ribbon + disc + four-point star (flat SVG). */
export function MedalIcon({ medal, size = 18, title, className = "" }: IconProps) {
  const p = FLAT[medal];
  const meta = MEDAL_META[medal];
  const label = title ?? `${meta.tone} · ${meta.label}`;

  return (
    <svg
      viewBox="0 0 32 36"
      width={size}
      height={Math.round(size * (36 / 32))}
      role="img"
      aria-label={label}
      className={`sc-medal-svg ${className}`.trim()}
    >
      <title>{label}</title>
      {/* Ribbon */}
      <path d="M8.5 0 L13.5 11.5 L11.2 12.8 L6.2 2.2 Z" fill={p.ribbon} />
      <path d="M23.5 0 L18.5 11.5 L20.8 12.8 L25.8 2.2 Z" fill={p.ribbon} />
      {/* Medal disc */}
      <circle cx="16" cy="23.5" r="10.2" fill={p.face} />
      <circle cx="16" cy="23.5" r="7.4" fill="none" stroke={p.ring} strokeWidth="1.35" />
      {/* Four-point star */}
      <path
        d="M16 17.8 L17.35 21.9 L21.5 22.5 L18.2 25.2 L19.1 29.3 L16 27.2 L12.9 29.3 L13.8 25.2 L10.5 22.5 L14.65 21.9 Z"
        fill={p.star}
      />
    </svg>
  );
}

type Props = {
  medal: MedalKind;
  withLabel?: boolean;
  size?: number;
  title?: string;
  className?: string;
};

export function MedalBadge({ medal, withLabel = false, size = 20, title, className = "" }: Props) {
  const meta = MEDAL_META[medal];

  return (
    <span
      className={`sc-medal sc-medal-${medal} ${className}`.trim()}
      title={title ?? `${meta.tone} · ${meta.label} do pool`}
    >
      <MedalIcon medal={medal} size={size} title={title} />
      {withLabel ? <span className="sc-medal-caption">{meta.short}</span> : null}
    </span>
  );
}

export type { MedalKind };
