"use client";

import { BASE_PATH } from "@/lib/paths";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PASS_DISTANCE_LABEL,
  rankCrossLeagueSimilarity,
  type SimilarPlayerHit,
} from "@/lib/crossLeagueSimilarity";
import { BRASILEIRAO_LEAGUES, LEAGUES, leaguePath, type LeagueId } from "@/lib/leagues";
import { ESTADUAIS_LEAGUE_IDS } from "@/lib/estaduaisHub";
import { CURRENT_SEASON } from "@/lib/seasons";
import { useLeague } from "@/components/LeagueProvider";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";

type Step = "config" | "loading" | "results" | "error";

type SimilarTarget = LeagueId | "estaduais";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  currentLeagueId: LeagueId;
  sourceLeague: LeagueId;
  sourceSeason: string;
  players: PlayerProfile[];
  onClose: () => void;
};

function withPhotos(hits: SimilarPlayerHit[], pool: PlayerProfile[]): SimilarPlayerHit[] {
  const byId = new Map(pool.map((p) => [p.player_id, p]));
  return hits.map((hit) => ({
    ...hit,
    photo: byId.get(hit.player_id)?.transfermarkt?.photo ?? hit.photo ?? null,
  }));
}

function SimilarResultsList({
  matches,
  target,
  family,
  onClose,
}: {
  matches: SimilarPlayerHit[];
  target: SimilarTarget;
  family: PositionFamily;
  onClose: () => void;
}) {
  if (!matches.length) {
    return <p className="similar-cross-hint">Nenhum atleta com minutos suficientes nessa posição.</p>;
  }
  return (
    <ul className="similar-results-list">
      {matches.map((hit, index) => (
        <li key={`${hit.league}:${hit.player_id}`}>
          <Link
            href={leaguePath(
              hit.league ?? (target === "estaduais" ? "est-nv1" : target),
              `/posicao/${family}?atleta=${encodeURIComponent(hit.player_id)}`,
            )}
            className="similar-result-card"
            onClick={onClose}
          >
            <div className="similar-result-top">
              <span className="similar-result-rank">{index + 1}</span>
              <div className="similar-result-identity">
                <span className="similar-result-photo">
                  <PlayerPhoto
                    src={hit.photo}
                    alt=""
                    fallback={
                      <span className="similar-result-photo similar-cross-photo-fallback">
                        {playerInitials(hit.name)}
                      </span>
                    }
                  />
                </span>
                <div className="similar-result-headline">
                  <span className="similar-result-name">{hit.name}</span>
                  <span className="similar-result-meta">
                    <ClubLogo club={hit.club} size={14} />
                    {hit.club} · {hit.profile}
                  </span>
                </div>
              </div>
              <span className="similar-result-total tabular">
                <span className="similar-result-total-label">Total</span>
                {hit.similarity}%
              </span>
            </div>
            {hit.blocks.length ? (
              <div className="similar-result-blocks">
                {hit.blocks.map((block) => (
                  <div key={block.title} className={`similar-result-block tone-${block.tone}`}>
                    <span className="similar-result-block-title">{block.title}</span>
                    <span className="similar-result-block-pct tabular">{block.similarity}%</span>
                    <span className="similar-result-block-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, block.similarity)}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SimilarCrossLeagueModal({
  player,
  family,
  currentLeagueId,
  sourceLeague,
  sourceSeason,
  players,
  onClose,
}: Props) {
  const { isCurrentSeason } = useLeague();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("config");
  const [targetLeague, setTargetLeague] = useState<SimilarTarget | null>(null);
  const [matches, setMatches] = useState<SimilarPlayerHit[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const referencePhoto = player.transfermarkt?.photo;
  const positionSections = useMemo(() => statSectionsForFamily(family), [family]);
  // "Eficiência Defensiva" never enters the distance model (z-score, not per-90 volume).
  const allMetricLabels = useMemo(
    () => positionSections.flatMap((section) => section.labels).filter((label) => label !== "Eficiência Defensiva"),
    [positionSections],
  );
  const [pickedMetrics, setPickedMetrics] = useState<ReadonlySet<string>>(() => new Set(allMetricLabels));
  /** Opt-in: comprimento médio de passes entra como bloco extra no modelo. */
  const [usePassDistance, setUsePassDistance] = useState(false);
  const allPicked = pickedMetrics.size === allMetricLabels.length;
  const toggleMetric = useCallback(
    (label: string) => {
      setPickedMetrics((prev) => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        return next;
      });
    },
    [setPickedMetrics],
  );
  const toggleAllMetrics = useCallback(() => {
    setPickedMetrics((prev) => (prev.size === allMetricLabels.length ? new Set() : new Set(allMetricLabels)));
  }, [allMetricLabels]);
  const leagueOptions = useMemo(() => {
    const isEstadual = (ESTADUAIS_LEAGUE_IDS as readonly string[]).includes(currentLeagueId);
    const options = [
      ...BRASILEIRAO_LEAGUES.map((league) => ({
        key: league.id as SimilarTarget,
        brand: league.brand,
        name: league.name,
        season: league.season,
        isCurrent: league.id === currentLeagueId,
      })),
      {
        key: "estaduais" as SimilarTarget,
        brand: "E",
        name: "Estaduais",
        season: "2026",
        isCurrent: isEstadual,
      },
    ];
    return [...options.filter((option) => option.isCurrent), ...options.filter((option) => !option.isCurrent)];
  }, [currentLeagueId]);

  const fetchSimilar = useCallback(
    async (to: SimilarTarget, metricLabels?: string[]) => {
      setStep("loading");
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          from: sourceLeague,
          to,
          playerId: player.player_id,
          family,
          limit: "5",
        });
        if (sourceSeason !== CURRENT_SEASON) params.set("season", sourceSeason);
        if (metricLabels?.length) params.set("metrics", metricLabels.join("|"));
        const res = await fetch(`${BASE_PATH}/api/similar?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "request_failed");
        }
        setMatches(data.matches ?? []);
        setStep("results");
      } catch {
        setErrorMessage("Não foi possível calcular similares. Tente de novo.");
        setStep("error");
      }
    },
    [sourceLeague, sourceSeason, family, player.player_id],
  );

  const computeSimilar = useCallback(
    (to: SimilarTarget) => {
      const metricLabels =
        pickedMetrics.size === allMetricLabels.length && !usePassDistance
          ? undefined
          : [...pickedMetrics, ...(usePassDistance ? [PASS_DISTANCE_LABEL] : [])];
      if (to === currentLeagueId && sourceSeason === CURRENT_SEASON && isCurrentSeason) {
        setMatches(
          withPhotos(
            rankCrossLeagueSimilarity(player, players, { limit: 5, metricLabels }).map((hit) => ({
              ...hit,
              league: currentLeagueId,
            })),
            players,
          ),
        );
        setStep("results");
        return;
      }
      void fetchSimilar(to, metricLabels);
    },
    [currentLeagueId, sourceSeason, isCurrentSeason, fetchSimilar, player, players, pickedMetrics, allMetricLabels.length, usePassDistance],
  );

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
        className="stat-window similar-cross-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Atletas similares a ${player.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stat-window-head">
          <h3>Atletas similares</h3>
          <button type="button" className="stat-window-close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="stat-window-body">
          <div className="similar-cross-ref">
            <span className="similar-cross-ref-photo">
              <PlayerPhoto
                src={referencePhoto}
                alt=""
                fallback={
                  <span className="similar-cross-ref-photo similar-cross-photo-fallback">
                    {playerInitials(player.name)}
                  </span>
                }
              />
            </span>
            <div className="similar-cross-ref-copy">
              <p className="similar-cross-ref-name">{player.name}</p>
              <p className="similar-cross-ref-meta">
                {player.club} · {player.profile}
              </p>
              <p className="similar-cross-intro-note">
                100% = mesmos percentis de ações certas por 90 · métricas do perfil pesam mais ·{" "}
                {allPicked
                  ? `total e por bloco (${positionSections.map((s) => s.title).join(" · ")})`
                  : "total e por stat selecionado"}
              </p>
            </div>
          </div>

          {step === "config" ? (
            <div className="similar-league-pick">
              <p className="similar-cross-hint">Em qual competição buscar atletas parecidos?</p>
              {sourceSeason !== CURRENT_SEASON ? (
                <p className="similar-cross-hint">{`Ficha ${sourceSeason} comparada com atletas de ${CURRENT_SEASON}.`}</p>
              ) : null}
              <div className="similar-league-buttons">
                {leagueOptions.map((league) => (
                  <button
                    key={league.key}
                    type="button"
                    className={`btn similar-league-btn${league.isCurrent ? " is-current" : ""}${
                      targetLeague === league.key ? " is-selected" : ""
                    }`}
                    onClick={() => setTargetLeague(league.key)}
                  >
                    <span className="similar-league-brand">{league.brand}</span>
                    <span>
                      {league.name}
                      <span className="similar-league-season">
                        {league.isCurrent ? `Competição atual · ${league.season}` : league.season}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="similar-metrics">
                <div className="similar-metrics-head">
                  <p className="similar-cross-hint">Quais stats entram no cálculo?</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAllMetrics}>
                    {allPicked ? "Limpar seleção" : "Todos os stats"}
                  </button>
                </div>
                <div className="similar-metric-groups">
                  {positionSections.map((section) => {
                    const labels = section.labels.filter((label) => label !== "Eficiência Defensiva");
                    if (!labels.length) return null;
                    return (
                      <div key={section.title} className={`similar-metric-group tone-${section.tone}`}>
                        <span className="similar-metric-group-title">{section.title}</span>
                        <div className="similar-metric-chips">
                          {labels.map((label) => (
                            <button
                              key={label}
                              type="button"
                              className={`similar-metric-chip${pickedMetrics.has(label) ? " is-on" : ""}`}
                              aria-pressed={pickedMetrics.has(label)}
                              onClick={() => toggleMetric(label)}
                            >
                              <i className={`fa-solid ${pickedMetrics.has(label) ? "fa-square-check" : "fa-square"}`} aria-hidden />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="similar-metric-extra">
                  <button
                    type="button"
                    className={`similar-metric-chip${usePassDistance ? " is-on" : ""}`}
                    aria-pressed={usePassDistance}
                    onClick={() => setUsePassDistance((value) => !value)}
                  >
                    <i
                      className={`fa-solid ${usePassDistance ? "fa-square-check" : "fa-square"}`}
                      aria-hidden
                    />
                    Distância de passe
                  </button>
                  <span className="similar-metric-extra-hint">
                    opcional · compara o comprimento médio dos passes (m)
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary similar-calc-btn"
                disabled={!targetLeague || pickedMetrics.size === 0}
                onClick={() => targetLeague && computeSimilar(targetLeague)}
              >
                {allPicked ? "Calcular com todos os stats" : `Calcular com ${pickedMetrics.size} stats`}
                {usePassDistance ? " + dist. passe" : ""}
                <i className="fa-solid fa-circle-chevron-right" aria-hidden />
              </button>
            </div>
          ) : null}

          {step === "loading" ? (
            <p className="similar-cross-hint" aria-live="polite">
              Calculando top 5 em{" "}
              {targetLeague === "estaduais"
                ? "Estaduais"
                : LEAGUES.find((l) => l.id === targetLeague)?.name ?? "…"}
              …
            </p>
          ) : null}

          {step === "error" ? (
            <div className="similar-cross-error">
              <p>{errorMessage}</p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("config")}>
                Voltar
              </button>
            </div>
          ) : null}

          {step === "results" && targetLeague ? (
            <>
              <div className="similar-results-head">
                <span>
                  Top 5 ·{" "}
                  {targetLeague === "estaduais"
                    ? "Estaduais"
                    : LEAGUES.find((l) => l.id === targetLeague)?.name}
                  {" · "}
                  {allPicked ? "todos os stats" : `${pickedMetrics.size} stats`}
                  {usePassDistance ? " + dist. passe" : ""}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("config")}>
                  Ajustar busca
                </button>
              </div>
              <SimilarResultsList matches={matches} target={targetLeague} family={family} onClose={onClose} />
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
