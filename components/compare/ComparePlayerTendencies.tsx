"use client";

import { TENDENCY_META, clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

export function ComparePlayerTendencies({ player }: { player: PlayerProfile }) {
  return (
    <section className="compare-col-block compare-col-tendencies" aria-label="Tendências">
      <header className="compare-col-block-head">
        <h3 className="section-label">Tendências</h3>
        <span className="profile-card-head-hint">Percentil no pool</span>
      </header>

      <ul className="compare-col-tendency-list">
        {TENDENCY_META.map((item) => {
          const value = clampPercent(player.tendencies[item.key as keyof PlayerProfile["tendencies"]] ?? 0);
          const token = percentileTier(value);
          return (
            <li key={item.key} className="compare-col-tendency-row" style={tierVars(token)}>
              <div className="compare-col-tendency-copy">
                <span className="compare-col-tendency-label">{item.label}</span>
                <span className="compare-col-tendency-hint">{item.hint}</span>
              </div>
              <span className="compare-col-tendency-score tabular">{Math.round(value)}</span>
              <span className="compare-col-tendency-track" aria-hidden="true">
                <i style={{ width: `${value}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
