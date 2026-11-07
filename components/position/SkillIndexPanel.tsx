"use client";

import { familyBySlug } from "@/lib/positions";
import { TENDENCY_META, clampPercent, percentileTier, tierVars } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
};

export function SkillIndexPanel({ player, family }: Props) {
  const familyLabel = familyBySlug(family).label.toLowerCase();

  return (
    <section className="sc-panel skill-index">
      <header className="sc-panel-head">
        <div>
          <p className="sc-eyebrow">Índices normalizados</p>
          <h2>Skill index</h2>
        </div>
        <p className="sc-note">Percentil no pool de {familyLabel}</p>
      </header>

      <div className="skill-rows">
        {TENDENCY_META.map((item) => {
          const raw = player.tendencies[item.key as keyof PlayerProfile["tendencies"]] ?? 0;
          const value = clampPercent(raw);
          const token = percentileTier(value);

          return (
            <article key={item.key} className="skill-row" style={tierVars(token)}>
              <div className="skill-label">
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </div>

              <div className="skill-meter">
                <div className="skill-track">
                  <i style={{ width: `${value}%` }} />
                </div>
                <span className="skill-mid" aria-hidden />
              </div>

              <div className="skill-score">
                <strong>{Math.round(value)}</strong>
                <em>{token.label}</em>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="skill-foot">
        <span className="skill-foot-mark" aria-hidden />
        Linha tracejada indica a mediana do pool (percentil 50)
      </footer>
    </section>
  );
}
