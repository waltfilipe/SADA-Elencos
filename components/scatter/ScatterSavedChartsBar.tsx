"use client";

import { useMemo } from "react";
import { ScatterExportButton } from "@/components/scatter/ScatterExportButton";
import { buildScatterChartView } from "@/lib/scatterChartBuild";
import { useLeague } from "@/components/LeagueProvider";
import {
  isDuplicateScatterSave,
  scatterSavedLimit,
  type SavedScatterChart,
} from "@/lib/scatterSavedCharts";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  savedCharts: SavedScatterChart[];
  xKey: string;
  yKey: string;
  athleteIds: [string, string, string];
  /** Anos marcados em "Somar temporadas" — o modal de export só oferece esses. */
  pickedSeasons: string[];
  onSave: () => void;
  onRemove: (id: string) => void;
};

function slotSummary(chart: SavedScatterChart, players: PlayerProfile[], family: PositionFamily, href: (path: string) => string) {
  const built = buildScatterChartView(chart, players, family, href);
  const count = built.highlightCount;
  return {
    title: `${built.xLabel} × ${built.yLabel}`,
    meta: count ? `${count} atleta${count === 1 ? "" : "s"} em destaque` : "Sem destaque",
  };
}

export function ScatterSavedChartsBar({
  family,
  players,
  savedCharts,
  xKey,
  yKey,
  athleteIds,
  pickedSeasons,
  onSave,
  onRemove,
}: Props) {
  const { href } = useLeague();
  const limit = scatterSavedLimit();
  const atLimit = savedCharts.length >= limit;
  const isDuplicate = isDuplicateScatterSave(savedCharts, xKey, yKey, athleteIds);
  const canSave = !atLimit && !isDuplicate;

  const slots = useMemo(() => {
    const rows: ({ chart: SavedScatterChart; title: string; meta: string } | null)[] = savedCharts.map((chart) => ({
      chart,
      ...slotSummary(chart, players, family, href),
    }));
    while (rows.length < limit) rows.push(null);
    return rows;
  }, [savedCharts, players, family, href, limit]);

  let saveHint = "Salva eixos e atletas em destaque (até 3).";
  if (atLimit) saveHint = "Remova um gráfico salvo para liberar um slot.";
  else if (isDuplicate) saveHint = "Este gráfico já está salvo.";

  return (
    <section className="scatter-saved-bar" aria-label="Gráficos salvos">
      <div className="scatter-saved-bar-head">
        <div>
          <p className="sc-eyebrow">Exportação</p>
          <h2 className="scatter-saved-title">Gráficos salvos</h2>
        </div>
        <div className="scatter-saved-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!canSave} onClick={onSave} title={saveHint}>
            <i className="fa-solid fa-bookmark" aria-hidden="true" /> Salvar gráfico
          </button>
          <ScatterExportButton
            family={family}
            players={players}
            savedCharts={savedCharts}
            pickedSeasons={pickedSeasons}
          />
        </div>
      </div>
      <p className="scatter-saved-hint">{saveHint}</p>
      <ol className="scatter-saved-slots">
        {slots.map((slot, index) => (
          <li key={slot?.chart.id ?? `empty-${index}`} className={slot ? "is-filled" : "is-empty"}>
            {slot ? (
              <>
                <div className="scatter-saved-slot-copy">
                  <span className="scatter-saved-slot-index">{index + 1}</span>
                  <div>
                    <strong>{slot.title}</strong>
                    <em>{slot.meta}</em>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm scatter-saved-remove"
                  onClick={() => onRemove(slot.chart.id)}
                  aria-label={`Remover gráfico ${index + 1}`}
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </>
            ) : (
              <span className="scatter-saved-empty">Slot {index + 1} vazio</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
