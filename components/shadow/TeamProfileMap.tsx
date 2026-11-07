"use client";

import { useMemo } from "react";
import { formationById, slotLines } from "@/lib/formations";
import type { PlayerSearchRow } from "@/lib/types";

const LINE_LABELS = ["Defesa", "Meio", "Ataque", "Segunda linha"];

type Props = {
  formationId: string;
  assignments: Record<string, string | null>;
  playersById: Map<string, PlayerSearchRow>;
};

export function TeamProfileMap({ formationId, assignments, playersById }: Props) {
  const formation = useMemo(() => formationById(formationId), [formationId]);
  const lines = useMemo(() => slotLines(formation), [formation]);
  const linesDefenseFirst = useMemo(() => [...lines].reverse(), [lines]);

  return (
    <aside className="shadow-profile-map" aria-label="Mapa de perfis do time">
      <header className="shadow-profile-map-head">
        <h3 className="section-label">Perfis por linha</h3>
        <span className="shadow-profile-map-formation">{formation.label}</span>
      </header>

      <div className="shadow-profile-map-lines">
        {linesDefenseFirst.map((line, lineIdx) => {
          const label = LINE_LABELS[lineIdx] ?? `Linha ${lineIdx + 1}`;
          return (
            <section key={lineIdx} className="shadow-profile-map-section">
              <h4 className="shadow-profile-map-section-label">{label}</h4>
              <ul className="shadow-profile-map-list">
                {line.map((slot) => {
                  const playerId = assignments[slot.id];
                  const player = playerId ? playersById.get(playerId) : undefined;
                  return (
                    <li key={slot.id} className={player ? "filled" : "empty"}>
                      <span className="shadow-profile-list-pos">{slot.label}</span>
                      <span className="shadow-profile-list-prof">{player?.profile ?? "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
