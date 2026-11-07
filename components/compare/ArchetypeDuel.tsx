"use client";

import { useMemo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { archetypeMetaFor, exArchetypeMetaFor, latArchetypeMetaFor, mcArchetypeMetaFor } from "@/lib/clusterMeta";
import { buildProfileShareRows, profileAccent, type ProfileShareRow } from "@/lib/profileShares";
import { clampPercent, formatRating } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  a: PlayerProfile;
  b: PlayerProfile;
  family: PositionFamily;
};

function metaFor(label: string, family: PositionFamily) {
  if (family === "laterais") {
    return latArchetypeMetaFor(label as "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido");
  }
  if (family === "meio-campistas") {
    return mcArchetypeMetaFor(label as "Contenção" | "Construtor" | "Box-to-box" | "Híbrido");
  }
  if (family === "extremos") {
    return exArchetypeMetaFor(label as "Driblador" | "Meia Ponta" | "Ruptura" | "Híbrido");
  }
  if (family === "zagueiros") {
    return archetypeMetaFor(label as "Defensor de Área" | "Construtor" | "Combativo");
  }
  return undefined;
}

function DuelRowSide({
  side,
  row,
  active,
  winner,
  accent,
}: {
  side: "a" | "b";
  row?: ProfileShareRow;
  active: boolean;
  winner: boolean;
  accent: string;
}) {
  const share = clampPercent(row?.share ?? 0);
  return (
    <div
      className={`archetype-duel-side side-${side}${winner ? " is-winner" : ""}${active ? " is-active" : ""}`}
      style={{ "--archetype-accent": accent } as React.CSSProperties}
    >
      <span className="archetype-duel-values tabular">
        <strong>{row ? formatRating(row.rating) : "—"}</strong>
        <em>{row ? `${Math.round(row.share)}%` : ""}</em>
      </span>
      <span className="archetype-duel-track" aria-hidden="true">
        <span className="archetype-duel-fill" style={{ width: `${Math.max(share, 2)}%` }} />
      </span>
      {active ? (
        <span className="archetype-duel-active-dot" title="Arquétipo primário">
          <i className="fa-solid fa-location-dot" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

export function ArchetypeDuel({ a, b, family }: Props) {
  const rowsA = useMemo(() => buildProfileShareRows(a), [a]);
  const rowsB = useMemo(() => buildProfileShareRows(b), [b]);

  const labels = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of [...rowsA, ...rowsB]) {
      if (!seen.has(row.label)) {
        seen.add(row.label);
        ordered.push(row.label);
      }
    }
    return ordered;
  }, [rowsA, rowsB]);

  if (!labels.length) return null;

  const activeA = a.cluster?.archetype === "Híbrido" ? null : a.cluster?.archetype;
  const activeB = b.cluster?.archetype === "Híbrido" ? null : b.cluster?.archetype;

  return (
    <div className="player-card archetype-duel-card">
      <div className="profile-card-head">
        <h3 className="section-label">Perfil</h3>
        <span className="profile-card-head-hint">Afinidade % · rating por arquétipo</span>
      </div>

      <ul className="archetype-duel-list">
        {labels.map((label) => {
          const rowA = rowsA.find((row) => row.label === label);
          const rowB = rowsB.find((row) => row.label === label);
          const accent = profileAccent(label);
          const meta = metaFor(label, family);
          const ratingA = rowA?.rating ?? 0;
          const ratingB = rowB?.rating ?? 0;
          const winner = ratingA === ratingB ? null : ratingA > ratingB ? "a" : "b";

          return (
            <li key={label} className="archetype-duel-row">
              <DuelRowSide
                side="a"
                row={rowA}
                active={activeA === label}
                winner={winner === "a"}
                accent={accent}
              />

              <Tooltip
                content={
                  <div className="archetype-duel-tip">
                    <strong>{label}</strong>
                    {meta?.description ? <p>{meta.description}</p> : null}
                  </div>
                }
              >
                <span className="archetype-duel-label" style={{ "--archetype-accent": accent } as React.CSSProperties}>
                  {label}
                </span>
              </Tooltip>

              <DuelRowSide
                side="b"
                row={rowB}
                active={activeB === label}
                winner={winner === "b"}
                accent={accent}
              />
            </li>
          );
        })}
      </ul>

      <p className="archetype-duel-foot">
        <i className="fa-solid fa-location-dot" aria-hidden="true" /> arquétipo primário do atleta
      </p>
    </div>
  );
}
