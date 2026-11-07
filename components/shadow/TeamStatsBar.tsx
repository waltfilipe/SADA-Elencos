"use client";

import { useMemo } from "react";
import { ratingToLetterGrade } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

type Props = {
  starters: PlayerSearchRow[];
  squad: PlayerSearchRow[];
};

export function TeamStatsBar({ starters, squad }: Props) {
  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const ages = starters
      .map((p) => (p.birth_year ? year - p.birth_year : null))
      .filter((v): v is number => v != null);
    const ratings = starters.map((p) => p.rating);
    const values = starters
      .map((p) => p.transfermarkt?.market_value_eur)
      .filter((v): v is number => v != null && v > 0);

    const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

    const profileCounts = new Map<string, number>();
    for (const p of starters) {
      profileCounts.set(p.profile, (profileCounts.get(p.profile) ?? 0) + 1);
    }

    return {
      starters: starters.length,
      squad: squad.length,
      avgAge: avg(ages),
      avgRating: avg(ratings),
      totalValue: values.reduce((s, v) => s + v, 0),
      avgValue: avg(values),
      topProfiles: [...profileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [starters, squad]);

  return (
    <div className="shadow-team-stats" aria-label="Estatísticas do time">
      <div className="shadow-stat">
        <span className="shadow-stat-label">Titulares</span>
        <strong className="shadow-stat-value tabular">{stats.starters}</strong>
      </div>
      <div className="shadow-stat">
        <span className="shadow-stat-label">Elenco</span>
        <strong className="shadow-stat-value tabular">{stats.squad}</strong>
      </div>
      <div className="shadow-stat">
        <span className="shadow-stat-label">Idade média</span>
        <strong className="shadow-stat-value tabular">
          {stats.avgAge != null ? `${stats.avgAge.toFixed(1).replace(".", ",")} anos` : "—"}
        </strong>
      </div>
      <div className="shadow-stat">
        <span className="shadow-stat-label">Letra média</span>
        <strong className="shadow-stat-value tabular">
          {stats.avgRating != null ? ratingToLetterGrade(stats.avgRating) : "—"}
        </strong>
      </div>
      <div className="shadow-stat">
        <span className="shadow-stat-label">Valor total</span>
        <strong className="shadow-stat-value tabular">
          {stats.totalValue > 0 ? formatEur(stats.totalValue) : "—"}
        </strong>
      </div>
      <div className="shadow-stat">
        <span className="shadow-stat-label">Valor médio</span>
        <strong className="shadow-stat-value tabular">
          {stats.avgValue != null ? formatEur(stats.avgValue) : "—"}
        </strong>
      </div>
      {stats.topProfiles.length > 0 ? (
        <div className="shadow-stat shadow-stat-wide">
          <span className="shadow-stat-label">Perfis no campo</span>
          <strong className="shadow-stat-profiles">
            {stats.topProfiles.map(([label, count]) => `${label} (${count})`).join(" · ")}
          </strong>
        </div>
      ) : null}
    </div>
  );
}
