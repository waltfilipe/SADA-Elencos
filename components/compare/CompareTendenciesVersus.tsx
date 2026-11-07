"use client";

import { TENDENCY_META, clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  playerA: PlayerProfile;
  playerB: PlayerProfile;
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function TendencyDuelRow({
  label,
  hint,
  valueA,
  valueB,
}: {
  label: string;
  hint: string;
  valueA: number;
  valueB: number;
}) {
  const leads = valueA === valueB ? "tie" : valueA > valueB ? "a" : "b";
  const tokenA = percentileTier(valueA);
  const tokenB = percentileTier(valueB);

  return (
    <li className={`compare-tendency-row leads-${leads}`}>
      <div className="compare-tendency-side side-a" style={tierVars(tokenA)}>
        <span className="compare-tendency-score tabular">{Math.round(valueA)}</span>
        <span className="compare-tendency-track" aria-hidden="true">
          <i style={{ width: `${valueA}%` }} />
        </span>
      </div>

      <div className="compare-tendency-center">
        <span className="compare-tendency-label">{label}</span>
        <span className="compare-tendency-hint">{hint}</span>
      </div>

      <div className="compare-tendency-side side-b" style={tierVars(tokenB)}>
        <span className="compare-tendency-score tabular">{Math.round(valueB)}</span>
        <span className="compare-tendency-track" aria-hidden="true">
          <i style={{ width: `${valueB}%` }} />
        </span>
      </div>
    </li>
  );
}

export function CompareTendenciesVersus({ playerA, playerB }: Props) {
  return (
    <section className="player-card compare-tendencies-panel" aria-label="Tendências comparadas">
      <div className="profile-card-head">
        <h3 className="section-label">Tendências</h3>
        <span className="profile-card-head-hint">Percentil no pool da posição</span>
      </div>

      <div className="compare-tendencies-head">
        <span className="compare-tendencies-name side-a">{shortName(playerA.name)}</span>
        <span className="compare-tendencies-name side-b">{shortName(playerB.name)}</span>
      </div>

      <ul className="compare-tendency-list">
        {TENDENCY_META.map((item) => {
          const valueA = clampPercent(playerA.tendencies[item.key as keyof PlayerProfile["tendencies"]] ?? 0);
          const valueB = clampPercent(playerB.tendencies[item.key as keyof PlayerProfile["tendencies"]] ?? 0);
          return (
            <TendencyDuelRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              valueA={valueA}
              valueB={valueB}
            />
          );
        })}
      </ul>
    </section>
  );
}
