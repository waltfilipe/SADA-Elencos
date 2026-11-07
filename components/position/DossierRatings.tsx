"use client";

import { profileMetaForFamily } from "@/lib/profileMeta";
import {
  clampPercent,
  formatRating,
  ratingGradientStyle,
  ratingTier,
  tierVars,
} from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { dominantRatingKey } from "@/lib/profileMeta";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

function secondaryAxes(family: PositionFamily) {
  if (
    family === "zagueiros" ||
    family === "laterais" ||
    family === "meio-campistas" ||
    family === "extremos" ||
    family === "atacantes"
  ) {
    return [];
  }

  return profileMetaForFamily(family)
    .filter((item) => item.key !== "perfil" && item.key !== "geral")
    .slice(0, 2);
}

type Props = {
  player: PlayerProfile;
  poolSize: number;
  family: PositionFamily;
};

export function DossierRatings({ player, poolSize, family }: Props) {
  const profileKey = dominantRatingKey(player.profile, family, player.hybrid_lean);
  const profileRating =
    (profileKey ? player.ratings[profileKey] : null) ??
    positionRating(player);
  const profileRank =
    (profileKey ? player.ranks[profileKey] : null) ?? player.ranks.geral ?? poolSize;
  const profileToken = ratingTier(profileRating);
  const percentile = poolSize > 0 ? Math.max(1, 100 - Math.round(((poolSize - profileRank) / poolSize) * 100)) : 0;
  const axes = secondaryAxes(family);
  const ratingStyle = ratingGradientStyle(profileRating);

  return (
    <div className={`dossier-ratings ${axes.length === 0 ? "dossier-ratings-solo" : ""}`}>
      <article
        className="dossier-rating-hero dossier-rating-hero-modern dossier-rating-gradient"
        style={{ ...tierVars(profileToken), ...ratingStyle }}
      >
        <div className="dossier-rating-ring" aria-hidden>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="dossier-rating-ring-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="dossier-rating-ring-fill"
              style={{
                strokeDasharray: `${clampPercent(profileRating * 10) * 3.27} 999`,
              }}
            />
          </svg>
          <div className="dossier-rating-ring-center">
            <strong className="dossier-rating-value">{formatRating(profileRating)}</strong>
            <span className="dossier-rating-label">{player.profile}</span>
          </div>
        </div>

        <div className="dossier-rating-side">
          <div className="dossier-rating-meta">
            <span className="dossier-rating-rank">#{profileRank}</span>
            <span>Top {percentile}%</span>
          </div>
        </div>
      </article>

      {axes.length > 0 ? (
        <div className="dossier-rating-cluster">
          {axes.map((axis) => {
            const value = player.ratings[axis.key] ?? 0;
            const rank = player.ranks[axis.key] ?? poolSize;
            const token = ratingTier(value);
            const axisStyle = ratingGradientStyle(value);

            return (
              <article
                key={axis.key}
                className={`dossier-rating-axis dossier-rating-gradient ${rank <= 5 ? "is-top5" : ""}`}
                style={{ ...tierVars(token), ...axisStyle }}
              >
                <div className="dossier-rating-axis-head">
                  <span className="dossier-rating-label">{axis.label}</span>
                  <em>#{rank}</em>
                </div>
                <strong className="dossier-rating-axis-value">{formatRating(value)}</strong>
                <div className="dossier-rating-meter meter meter-sm">
                  <i style={{ width: `${clampPercent(value * 10)}%`, background: axisStyle.color }} />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
