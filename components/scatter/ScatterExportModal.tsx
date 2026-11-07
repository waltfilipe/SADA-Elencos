"use client";

import { BASE_PATH } from "@/lib/paths";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLeague } from "@/components/LeagueProvider";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { getLeague } from "@/lib/leagues";
import { REPORT_COPY, type ReportLang } from "@/lib/reportI18n";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile } from "@/lib/types";

export type ExportSeasonPick = { league: string; season: string };

type Props = {
  athletes: PlayerProfile[];
  /** Anos marcados em "Somar temporadas" no scatter — limita as fichas de arquivo. */
  pickedSeasons: string[];
  onClose: () => void;
  onExport: (playerId: string, lang: ReportLang, seasons: ExportSeasonPick[]) => void;
};

export function ScatterExportModal({ athletes, pickedSeasons, onClose, onExport }: Props) {
  const { leagueId, season: viewedSeason } = useLeague();
  const [mounted, setMounted] = useState(false);
  const [pickedId, setPickedId] = useState(athletes[0]?.player_id ?? "");
  const [rowsById, setRowsById] = useState<Record<string, ExportSeasonPick[]>>({});
  const [pickedSeasonsSet, setPickedSeasonsSet] = useState<Set<string>>(new Set());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Anos disponíveis do atleta no registro (cross-liga) para fichas extras no PDF.
  useEffect(() => {
    const player = athletes.find((item) => item.player_id === pickedId);
    if (!player || rowsById[pickedId]) return;
    const qs = new URLSearchParams();
    if (player.athlete_id) qs.set("athlete_id", player.athlete_id);
    if (player.person_key) qs.set("person_key", player.person_key);
    qs.set("league", leagueId);
    qs.set("season", viewedSeason);
    qs.set("player_id", player.player_id);
    let cancelled = false;
    fetch(`${BASE_PATH}/api/athlete-rows?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rows?: ExportSeasonPick[] } | null) => {
        if (!cancelled && data?.rows) setRowsById((map) => ({ ...map, [pickedId]: data.rows! }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pickedId, athletes, rowsById, leagueId, viewedSeason]);

  // Só oferece fichas dos anos marcados no scatter (a atual já é a ficha principal).
  const scatterYears = new Set(pickedSeasons);
  const otherSeasons = (rowsById[pickedId] ?? []).filter(
    (row) => row.season !== viewedSeason && scatterYears.has(row.season),
  );
  const picked = otherSeasons.filter((row) => pickedSeasonsSet.has(row.season));

  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="stat-window-backdrop" onClick={onClose}>
      <div
        className="stat-window scatter-export-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Exportar PDF com gráficos salvos"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <div>
            <p className="sc-eyebrow">PDF</p>
            <h2>Exportar dossiê + scatter</h2>
          </div>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <p className="scatter-export-modal-lead">
          Escolha o atleta do dossiê. O PDF inclui os gráficos salvos e o relatório completo da posição (mesmo layout
          da ficha).
        </p>

        <fieldset className="scatter-export-pick">
          <legend>Atleta do dossiê</legend>
          <ul>
            {athletes.map((player) => (
              <li key={player.player_id}>
                <label className={pickedId === player.player_id ? "is-active" : undefined}>
                  <input
                    type="radio"
                    name="scatter-export-player"
                    value={player.player_id}
                    checked={pickedId === player.player_id}
                    onChange={() => setPickedId(player.player_id)}
                  />
                  <PlayerPhoto
                    src={player.transfermarkt?.photo}
                    alt=""
                    className="scatter-export-photo"
                    fallback={
                      <span className="scatter-export-photo scatter-export-photo-fallback">{playerInitials(player.name)}</span>
                    }
                  />
                  <span className="scatter-export-pick-copy">
                    <strong>{player.name}</strong>
                    <em>{player.club}</em>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {otherSeasons.length ? (
          <fieldset className="scatter-export-pick">
            <legend>Incluir fichas de arquivo</legend>
            <div className="player-report-archive-picks" role="group" aria-label="Temporadas no PDF">
              {otherSeasons.map((row) => (
                <label key={row.season} className="player-report-archive-pick">
                  <input
                    type="checkbox"
                    checked={pickedSeasonsSet.has(row.season)}
                    onChange={(event) =>
                      setPickedSeasonsSet((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(row.season);
                        else next.delete(row.season);
                        return next;
                      })
                    }
                  />
                  <span>
                    Temporada {row.season} · {getLeague(row.league)?.name ?? row.league}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="scatter-export-lang">
          <p className="scatter-export-lang-label">Idioma do relatório</p>
          <div className="scatter-export-lang-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!pickedId}
              onClick={() => pickedId && onExport(pickedId, "pt", picked)}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {REPORT_COPY.pt.portuguese}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!pickedId}
              onClick={() => pickedId && onExport(pickedId, "en", picked)}
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {REPORT_COPY.en.english}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
