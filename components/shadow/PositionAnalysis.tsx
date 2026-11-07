"use client";

import { playerShortName, type PositionLine } from "@/lib/clubLineup";

type Props = {
  lines: PositionLine[];
};

export function PositionAnalysis({ lines }: Props) {
  if (!lines.length) return null;

  return (
    <section className="shadow-position-analysis" aria-label="Análise por posição">
      <h3 className="section-label">Análise por posição</h3>
      <ul className="shadow-analysis-list">
        {lines.map((line) => (
          <li key={line.label} className="shadow-analysis-line">
            <span className="shadow-analysis-pos">{line.label}</span>
            <span className="shadow-analysis-dash" aria-hidden="true">
              —
            </span>
            {line.entries.length ? (
              <span className="shadow-analysis-players">
                {line.entries.map((entry) => (
                  <span key={`${line.label}-${entry.playerId}`} className={`shadow-analysis-player is-${entry.role}`}>
                    <strong>{playerShortName(entry.name)}</strong>
                    <em>{entry.role}</em>
                  </span>
                ))}
              </span>
            ) : (
              <span className="shadow-analysis-empty">vaga</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
