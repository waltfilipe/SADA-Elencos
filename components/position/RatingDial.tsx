"use client";

import { useId } from "react";
import { formatRating, ratingTier, tierVars } from "@/lib/scoutTheme";

const SWEEP = 252;
const START = -SWEEP / 2;
const CX = 60;
const CY = 58;
const R = 45;

function polar(angleDeg: number, radius = R) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function arc(fromDeg: number, toDeg: number) {
  const start = polar(fromDeg);
  const end = polar(toDeg);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

type Props = {
  value: number;
  rank: number;
  poolSize: number;
  reference?: number;
  max?: number;
};

export function RatingDial({ value, rank, poolSize, reference, max = 10 }: Props) {
  const uid = useId().replace(/:/g, "");
  const token = ratingTier(value, max);
  const ratio = Math.max(0, Math.min(1, value / max));
  const valueAngle = START + SWEEP * ratio;

  const percentile = poolSize > 0 ? Math.round(((poolSize - rank) / poolSize) * 100) : 0;

  const refAngle =
    reference !== undefined ? START + SWEEP * Math.max(0, Math.min(1, reference / max)) : null;
  const refInner = refAngle !== null ? polar(refAngle, R - 9) : null;
  const refOuter = refAngle !== null ? polar(refAngle, R + 9) : null;

  return (
    <div className="rating-dial" style={tierVars(token)}>
      <svg viewBox="0 0 120 104" className="dial-svg" aria-hidden>
        <defs>
          <linearGradient id={`dial-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={token.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={token.color} />
          </linearGradient>
        </defs>

        <path d={arc(START, START + SWEEP)} className="dial-track" strokeWidth="9" strokeLinecap="round" />
        <path
          d={arc(START, valueAngle)}
          stroke={`url(#dial-${uid})`}
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />

        {refInner && refOuter && (
          <line
            x1={refInner.x}
            y1={refInner.y}
            x2={refOuter.x}
            y2={refOuter.y}
            className="dial-reference"
          />
        )}
      </svg>

      <div className="dial-center">
        <strong style={{ color: token.color }}>{formatRating(value)}</strong>
        <span>Rating</span>
      </div>

      <div className="dial-foot">
        <span className="dial-rank">
          #{rank}
          <em>de {poolSize}</em>
        </span>
        <span className="dial-pct" style={{ color: token.color }}>
          Top {Math.max(1, 100 - percentile)}%
        </span>
      </div>
    </div>
  );
}
