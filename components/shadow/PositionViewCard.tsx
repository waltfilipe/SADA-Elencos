"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/paths";
import type { LeagueId } from "@/lib/leagues";
import type { PositionFamily } from "@/lib/types";

type Metric = { label: string; value: number; percentile: number };
type View = {
  family: PositionFamily;
  poolSize: number;
  coverage: number;
  estimatedProfile: string | null;
  sections: { title: string; items: Metric[] }[];
  similar: { name: string; club: string; profile: string; similarity: number }[];
};

function pctClass(pct: number): string {
  if (pct >= 75) return "posview-pct strong";
  if (pct <= 25) return "posview-pct weak";
  return "posview-pct";
}

/**
 * "Como {slot}": percentis do atleta medidos dentro da pool da família do
 * slot na própria liga dele — a nova perspectiva quando jogado fora de
 * posição (ex.: lateral escalado na ponta).
 */
export function PositionViewCard({
  playerId,
  league,
  family,
  slotLabel,
}: {
  playerId: string;
  league: LeagueId | undefined;
  family: PositionFamily;
  slotLabel: string;
}) {
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setFailed(false);
    fetch(
      `${BASE_PATH}/api/position-view?playerId=${encodeURIComponent(playerId)}&family=${family}${league ? `&league=${league}` : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("position_view_failed"))))
      .then((data: View) => {
        if (!cancelled) setView(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, league, family]);

  if (failed || !view) {
    return failed ? null : <p className="posview-loading">Calculando como {slotLabel}…</p>;
  }

  return (
    <div className="posview">
      <div className="posview-head">
        <span className="posview-title">Como {slotLabel}</span>
        {view.estimatedProfile ? (
          <span className="posview-profile">{view.estimatedProfile}</span>
        ) : null}
      </div>
      <ul className="posview-sections">
        {view.sections.map((section) => (
          <li key={section.title} className="posview-section">
            <span className="posview-section-title">{section.title}</span>
            <ul>
              {section.items.map((item) => (
                <li key={item.label} className="posview-metric">
                  <span className="posview-metric-label" title={item.label}>
                    {item.label}
                  </span>
                  <span className="posview-metric-track" aria-hidden="true">
                    <span style={{ width: `${item.percentile}%` }} />
                  </span>
                  <span className={pctClass(item.percentile)}>P{item.percentile}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {view.similar.length ? (
        <p className="posview-similar">
          Parecido com{" "}
          {view.similar
            .slice(0, 2)
            .map((hit) => `${hit.name} (${hit.club})`)
            .join(" e ")}
        </p>
      ) : null}
      <p className="posview-note">
        {Math.round(view.coverage * 100)}% das métricas da posição medidas · pool de{" "}
        {view.poolSize} na liga dele
      </p>
    </div>
  );
}
