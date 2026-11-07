"use client";

import { CURRENT_SEASON, type BrasileiraoSeason } from "@/lib/seasons";

type Props = {
  active: string;
  /** Anos exibidos, na ordem. Inclui a temporada atual quando ela existe para o atleta. */
  years: BrasileiraoSeason[];
  loading?: boolean;
  onSelect: (year: BrasileiraoSeason) => void;
  /** Ao lado do nome no hero (sem rótulo “Ficha”). */
  inline?: boolean;
};

export function PlayerSeasonSlicer({ active, years, loading, onSelect, inline = false }: Props) {
  if (!years.length) return null;
  const viewingArchive = active !== CURRENT_SEASON;
  return (
    <div
      className={[
        "player-season-slicer",
        inline ? "player-season-slicer-inline" : "",
        viewingArchive ? "player-season-slicer-archive-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Temporada do atleta"
    >
      {inline ? null : <span className="player-season-slicer-label">Ficha</span>}
      <div className="player-season-slicer-tabs" role="tablist">
        {years.map((year) => (
          <button
            key={year}
            type="button"
            role="tab"
            aria-selected={active === year}
            className={active === year ? "is-active" : ""}
            disabled={loading && active !== year}
            onClick={() => onSelect(year)}
          >
            {year}
          </button>
        ))}
      </div>
      {loading ? <span className="player-season-slicer-loading">Carregando…</span> : null}
    </div>
  );
}
