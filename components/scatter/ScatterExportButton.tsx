"use client";

import { BASE_PATH } from "@/lib/paths";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLoading } from "@/components/LoadingProvider";
import { useLeague } from "@/components/LeagueProvider";
import { ScatterExportModal, type ExportSeasonPick } from "@/components/scatter/ScatterExportModal";
import { ScatterExportSheet, type ScatterExtraSheet } from "@/components/scatter/ScatterExportSheet";
import { getLeague } from "@/lib/leagues";
import { highlightedAthleteIds, type SavedScatterChart } from "@/lib/scatterSavedCharts";
import { REPORT_COPY, type ReportLang } from "@/lib/reportI18n";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  savedCharts: SavedScatterChart[];
  /** Anos marcados em "Somar temporadas" — o modal só oferece fichas desses anos. */
  pickedSeasons: string[];
};

export function ScatterExportButton({ family, players, savedCharts, pickedSeasons }: Props) {
  const { beginLoad, endLoad } = useLoading();
  const { leagueId, season: viewedSeason } = useLeague();
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [exportPlayerId, setExportPlayerId] = useState<string | null>(null);
  const [lang, setLang] = useState<ReportLang>("pt");
  const [printRequest, setPrintRequest] = useState(0);
  // Perfil completo via API — a página remove heatmap do payload; as fichas de
  // arquivo marcam temporadas extras do registro.
  const [mainProfile, setMainProfile] = useState<PlayerProfile | null>(null);
  const [extraSheets, setExtraSheets] = useState<ScatterExtraSheet[]>([]);

  const athleteIds = useMemo(() => highlightedAthleteIds(savedCharts), [savedCharts]);
  const exportAthletes = useMemo(
    () =>
      athleteIds
        .map((id) => players.find((player) => player.player_id === id))
        .filter((player): player is PlayerProfile => Boolean(player)),
    [athleteIds, players],
  );
  const focusPlayer = useMemo(() => {
    const base = exportPlayerId ? players.find((player) => player.player_id === exportPlayerId) : null;
    return mainProfile ?? base;
  }, [exportPlayerId, players, mainProfile]);

  useEffect(() => {
    setMounted(true);
    setSheetUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!printRequest || !focusPlayer) return;
    beginLoad();
    const previousTitle = document.title;
    document.title =
      lang === "en" ? `${focusPlayer.name} - SADA Scout Report` : `${focusPlayer.name} - Relatório SADA Scout`;
    document.body.classList.add("exporting-scout-print");
    const cleanup = () => {
      document.body.classList.remove("exporting-scout-print");
      document.title = previousTitle;
      endLoad();
      setExportPlayerId(null);
      setMainProfile(null);
      setExtraSheets([]);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => endLoad(), 400);
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printRequest, focusPlayer, lang, beginLoad, endLoad]);

  async function startExport(playerId: string, nextLang: ReportLang, seasons: ExportSeasonPick[]) {
    setModalOpen(false);
    setLang(nextLang);
    beginLoad();
    const target = players.find((player) => player.player_id === playerId) ?? null;
    const fetchSeason = async (league: string, season: string): Promise<PlayerProfile | null> => {
      if (!target) return null;
      const qs = new URLSearchParams({
        league,
        season,
        name: target.name,
        birth_year: String(target.birth_year ?? ""),
      });
      if (target.athlete_id) qs.set("athlete_id", target.athlete_id);
      if (target.person_key) qs.set("person_key", target.person_key);
      const res = await fetch(`${BASE_PATH}/api/player-season?${qs}`).catch(() => null);
      return res?.ok ? ((await res.json()) as PlayerProfile) : null;
    };
    const [main, ...extras] = await Promise.all([
      fetchSeason(leagueId, viewedSeason),
      ...seasons.map(async (row) => {
        const profile = await fetchSeason(row.league, row.season);
        return profile
          ? { player: profile, year: row.season, leagueName: getLeague(row.league)?.name ?? row.league }
          : null;
      }),
    ]);
    setMainProfile(main);
    setExtraSheets(extras.filter((item): item is ScatterExtraSheet => Boolean(item)));
    setExportPlayerId(playerId);
    setPrintRequest((value) => value + 1);
    endLoad();
  }

  if (!savedCharts.length) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setModalOpen(true)}
        disabled={!exportAthletes.length}
        aria-label={REPORT_COPY.pt.pdfTitle}
      >
        <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Exportar PDF
      </button>
      {modalOpen ? (
        <ScatterExportModal
          athletes={exportAthletes}
          pickedSeasons={pickedSeasons}
          onClose={() => setModalOpen(false)}
          onExport={startExport}
        />
      ) : null}
      {mounted && focusPlayer && exportPlayerId
        ? createPortal(
            <ScatterExportSheet
              family={family}
              players={players}
              savedCharts={savedCharts}
              focusPlayer={focusPlayer}
              extraSheets={extraSheets}
              lang={lang}
              sheetUrl={sheetUrl}
            />,
            document.body,
          )
        : null}
    </>
  );
}
