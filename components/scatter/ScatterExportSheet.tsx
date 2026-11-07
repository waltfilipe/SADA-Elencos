"use client";

import { useMemo } from "react";
import { ScatterPlot } from "@/components/scatter/ScatterPlot";
import { ReportSheet, SeasonSummarySheet } from "@/components/position/profile/PlayerReport";
import { useLeague } from "@/components/LeagueProvider";
import { buildScatterChartView } from "@/lib/scatterChartBuild";
import { familyBySlug } from "@/lib/positions";
import { REPORT_COPY, reportLocale, type ReportLang } from "@/lib/reportI18n";
import type { SavedScatterChart } from "@/lib/scatterSavedCharts";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type ScatterExtraSheet = { player: PlayerProfile; year: string; leagueName: string };

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  savedCharts: SavedScatterChart[];
  focusPlayer: PlayerProfile;
  extraSheets?: ScatterExtraSheet[];
  lang: ReportLang;
  sheetUrl: string;
};

/** One chart per landscape A4 page. */
const CHARTS_PER_PAGE = 1;
const PLOT_SIZE = { width: 1040, height: 560 };

export function ScatterExportSheet({ family, players, savedCharts, focusPlayer, extraSheets, lang, sheetUrl }: Props) {
  const league = useLeague();
  const { href } = league;
  const copy = REPORT_COPY[lang];
  const locale = reportLocale(lang);
  const familyLabel = familyBySlug(family).label;
  const generated = copy.generated(
    new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
  );

  const built = useMemo(
    () => savedCharts.map((saved) => buildScatterChartView(saved, players, family, href)),
    [savedCharts, players, family, href],
  );

  const chartPages = useMemo(() => {
    const pages: typeof built[] = [];
    for (let index = 0; index < built.length; index += CHARTS_PER_PAGE) {
      pages.push(built.slice(index, index + CHARTS_PER_PAGE));
    }
    return pages;
  }, [built]);

  const extras = extraSheets ?? [];
  const dossierPages = 2 + extras.length * 2;
  // Resumo multi-temporada vem antes dos mapas de dispersão (2 páginas).
  const summaryPages = extras.length ? 2 : 0;
  const totalPages = dossierPages + summaryPages + chartPages.length;

  return (
    <div className="scout-print-export" lang={lang === "en" ? "en" : "pt-BR"}>
      <ReportSheet
        player={focusPlayer}
        family={family}
        players={players}
        lang={lang}
        sheetUrl={sheetUrl}
        totalPages={totalPages}
      />
      {extras.map((extra, index) => (
        <ReportSheet
          key={`extra-${extra.year}`}
          player={extra.player}
          family={family}
          players={players}
          lang={lang}
          sheetUrl={sheetUrl}
          archiveSeasonLabel={extra.year}
          leagueName={extra.leagueName}
          skipProjection
          pageOffset={2 * (index + 1)}
          totalPages={totalPages}
        />
      ))}
      {extras.length ? (
        <SeasonSummarySheet
          rows={[
            { player: focusPlayer, year: league.season, leagueName: league.name },
            ...extras.map((extra) => ({ player: extra.player, year: extra.year, leagueName: extra.leagueName })),
          ]}
          family={family}
          lang={lang}
          pageNumber={dossierPages + 1}
          totalPages={totalPages}
        />
      ) : null}
      {chartPages.map((charts, pageIndex) => (
        <div key={pageIndex} className="player-report-page scatter-report-page scatter-report-landscape">
          <header className="player-report-banner">
            <img src="/brand/sada-wordmark.png" alt="SADA — Sistema de Análise de Dados de Atletas" className="player-report-logo" />
            <p className="player-report-kicker">{copy.summaryKicker}</p>
            <p className="player-report-league">
              {league.name}
              <span>{familyLabel}</span>
            </p>
            <p className="player-report-season">
              <b>{league.season}</b>
              <span>{copy.seasonTag}</span>
            </p>
          </header>
          <div className="player-report-body scatter-report-body">
            <h2 className="player-report-heading">Mapas de dispersão</h2>
            <div className="scatter-report-stack">
              {charts.map((chart, index) => {
                const globalIndex = pageIndex * CHARTS_PER_PAGE + index;
                return (
                  <section key={savedCharts[globalIndex]?.id ?? globalIndex} className="scatter-report-card">
                    <p className="player-report-label">
                      {chart.xLabel} × {chart.yLabel}
                      {chart.highlightCount ? ` · ${chart.highlightCount} em destaque` : ""}
                    </p>
                    <div className="scatter-report-plot">
                      <ScatterPlot
                        instanceId={`print-${savedCharts[globalIndex]?.id ?? globalIndex}`}
                        fixedSize={PLOT_SIZE}
                        interactive={false}
                        variant="print"
                        points={chart.points}
                        avgX={chart.avgX}
                        avgY={chart.avgY}
                        highlights={chart.highlights}
                        xLabel={chart.xLabel}
                        yLabel={chart.yLabel}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
            <ul className="scatter-report-legend" aria-label="Legenda">
              <li>
                <i className="lg lg-a" aria-hidden="true" /> Atleta 1
              </li>
              <li>
                <i className="lg lg-b" aria-hidden="true" /> Atleta 2
              </li>
              <li>
                <i className="lg lg-c" aria-hidden="true" /> Atleta 3
              </li>
              <li>
                <i className="lg lg-pool" aria-hidden="true" /> Pool da posição
              </li>
              <li>
                <i className="lg lg-avg" aria-hidden="true" /> Média do grupo
              </li>
            </ul>
            <footer className="player-report-foot">
              <p className="player-report-colophon">
                <span>SADA | Scout</span>
                <span>{generated}</span>
                <span>{copy.page(dossierPages + summaryPages + 1 + pageIndex, totalPages)}</span>
              </p>
            </footer>
          </div>
        </div>
      ))}
    </div>
  );
}
