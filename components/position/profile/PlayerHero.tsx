"use client";

import Link from "next/link";
import { useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { formatFoot } from "@/lib/feet";
import type { LeagueId } from "@/lib/leagues";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { PlayerReportButton } from "@/components/position/profile/PlayerReport";
import { SimilarCrossLeagueModal } from "@/components/position/profile/SimilarCrossLeagueModal";
import { PlayerRunModal } from "@/components/position/profile/PlayerRunModal";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { DisciplineTendencies } from "./DisciplineTendencies";
import { PassTendencies } from "./PassTendencies";
import { PlayerSeasonSlicer } from "@/components/PlayerSeasonSlicer";
import { profileAccent } from "@/lib/profileShares";
import type { BrasileiraoSeason } from "@/lib/seasons";
import { CURRENT_SEASON } from "@/lib/seasons";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  /** Scout 2026 identity when ficha shows another year. */
  scoutPlayer?: PlayerProfile;
  isArchiveView?: boolean;
  fichaSeason?: string;
  similarSource?: { league: LeagueId; season: string };
  seasonSlicer?: {
    active: string;
    years: BrasileiraoSeason[];
    loading?: boolean;
    onSelect: (year: BrasileiraoSeason) => void;
  };
};

function monthsRemaining(iso?: string | null): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return null;
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  return Math.max(0, months);
}

function oneDecimal(value: string): string {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function metricDisplay(player: PlayerProfile, label: string): string {
  for (const item of flattenAspects(player)) {
    const value = item.sub_metrics?.find((row) => row.label === label)?.display_value?.trim();
    if (!value) continue;
    return label === "xG" || label === "xA" ? oneDecimal(value) : value;
  }
  return "—";
}

function departureDateLabel(departure: { date?: string | null; to_season?: string | null }): string {
  if (departure.date) {
    const d = new Date(`${departure.date}T12:00:00`);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }
  return `janela de ${departure.to_season ?? "—"}`;
}

function HeroFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hero-fact">
      <span className="hero-fact-label">{label}</span>
      <span className="hero-fact-value">{children}</span>
    </div>
  );
}

function contractEndLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month) return null;
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  return `até ${label.replace(".", "").replace(" de ", "/")}`;
}

function HeroStat({
  icon,
  label,
  tone,
  tooltip,
  value,
  foot,
}: {
  icon: string;
  label: string;
  tone?: "warn" | "danger";
  tooltip?: string;
  value: React.ReactNode;
  foot?: React.ReactNode;
}) {
  const cell = (
    <div className={`hero-stat${tone ? ` hero-stat-${tone}` : ""}`}>
      <span className="hero-stat-head">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
        <span>{label}</span>
      </span>
      <strong className="hero-stat-value tabular">{value}</strong>
      <span className="hero-stat-foot">{foot}</span>
    </div>
  );
  if (!tooltip) return cell;
  return (
    <Tooltip content={tooltip} block>
      {cell}
    </Tooltip>
  );
}

export function PlayerHero({
  player,
  family,
  players,
  scoutPlayer,
  isArchiveView = false,
  fichaSeason,
  similarSource,
  seasonSlicer,
}: Props) {
  const { href, leagueId, season: hubSeason } = useLeague();
  const scout = scoutPlayer ?? player;
  const source = similarSource ?? { league: leagueId, season: hubSeason };
  const [similarOpen, setSimilarOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const showRun = Boolean(scout.physical_run) && !isArchiveView;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const tm = player.transfermarkt;

  const months = monthsRemaining(tm?.contract_until);
  const onLoanFrom = tm?.on_loan_from ?? null;
  const contractTone: "warn" | "danger" | undefined =
    months != null && months < 6 ? "danger" : months != null && months < 12 ? "warn" : undefined;
  const contractTooltip =
    months != null && months < 6
      ? "Contrato termina em menos de 6 meses."
      : months != null && months < 12
        ? "Contrato termina em menos de 1 ano."
        : "Tempo restante de contrato.";
  const departure = player.departure ?? null;
  const displayClub = player.display_club ?? player.club;
  const heroAccent = profileAccent((player.profile ?? "").split("+").pop()!.trim());
  return (
    <section
      className="player-hero player-card"
      aria-label={`Perfil de ${player.name}`}
      style={{ "--hero-accent": heroAccent } as React.CSSProperties}
    >
      <div className="player-hero-main">
        <div className="player-hero-photo">
          <div className="player-hero-photo-frame">
            <PlayerPhoto
              src={tm?.photo}
              alt={player.name}
              fallback={<span className="player-hero-photo-fallback">{playerInitials(player.name)}</span>}
            />
          </div>
          <div className="player-hero-add">
            <Tooltip content="Adiciona ao elenco ou à lista de observação." block>
              <span className="hero-action-slot">
                <AddToShadowMenu playerId={scout.player_id} family={family} />
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="player-hero-copy">
          <div className="player-hero-title-wrap">
            <div className="player-hero-name-row">
              <h2 className="player-hero-name">{player.name}</h2>
              {seasonSlicer ? (
                <PlayerSeasonSlicer
                  inline
                  active={seasonSlicer.active}
                  years={seasonSlicer.years}
                  loading={seasonSlicer.loading}
                  onSelect={seasonSlicer.onSelect}
                />
              ) : null}
            </div>
            {(player.position || player.profile) ? (
              <p className="player-hero-posline">
                <span className="hero-pos-card">
                  {player.position}
                  {player.position && player.profile ? <span className="hero-pos-sep" aria-hidden="true">|</span> : null}
                  {player.profile ? <span className="hero-pos-profile">{player.profile}</span> : null}
                </span>
              </p>
            ) : null}
            <p className="player-hero-club">
              <ClubLogo club={displayClub} size={28} />
              <span className="player-hero-club-name">{displayClub}</span>
              {departure ? (
                <span
                  className="hero-depart-chip"
                  title={
                    departure.date
                      ? "Saiu da competição para este clube. Data e valor conforme o Transfermarkt."
                      : "Saiu da competição para este clube; data exata indisponível."
                  }
                >
                  <i className="fa-solid fa-arrow-right hero-depart-chip-arrow" aria-hidden="true" />
                  <ClubLogo club={departure.to_club} size={15} />
                  <span className="hero-depart-chip-club">{departure.to_club}</span>
                  <span className="hero-depart-chip-date">
                    {departureDateLabel(departure)}
                    {departure.fee ? ` · ${departure.fee}` : ""}
                  </span>
                </span>
              ) : null}
            </p>
          </div>

          <div className="hero-bio-block">
            <dl className="player-hero-facts">
              {age != null ? <HeroFact label="Idade">{age}</HeroFact> : null}
              {player.height ? <HeroFact label="Altura">{player.height} cm</HeroFact> : null}
              {formatFoot(player.foot) ? <HeroFact label="Pé">{formatFoot(player.foot)}</HeroFact> : null}
              {player.nationality ? <HeroFact label="País">{player.nationality}</HeroFact> : null}
            </dl>
            <div className="hero-output" aria-label="Produção ofensiva">
              <div>
                <span>Gols</span>
                <strong className="tabular">{player.goals.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>xG</span>
                <strong className="tabular">{metricDisplay(player, "xG")}</strong>
              </div>
              <div>
                <span>Assistências</span>
                <strong className="tabular">{player.assists.toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <span>xA</span>
                <strong className="tabular">{metricDisplay(player, "xA")}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="hero-side" aria-label="Minutos, contrato e ações">
        <div className="hero-stats" role="group" aria-label="Minutos, valor de mercado e contrato">
          <HeroStat
            icon="fa-clock"
            label="Minutos"
            tooltip={
              player.minutes_pct != null
                ? `${player.minutes.toLocaleString("pt-BR")} minutos, ${Math.round(player.minutes_pct)}% do líder da temporada.`
                : "Minutos jogados na temporada."
            }
            value={player.minutes.toLocaleString("pt-BR")}
            foot={
              player.minutes_pct != null ? (
                <span className="hero-stat-minutes">
                  <span
                    className="identity-minutes-track identity-minutes-track-wide"
                    role="img"
                    aria-label={`${Math.round(player.minutes_pct)}% dos minutos do líder`}
                  >
                    <span
                      className="identity-minutes-cover"
                      style={{ left: `${Math.max(0, Math.min(100, player.minutes_pct))}%` }}
                    />
                  </span>
                  <span className="hero-stat-minutes-pct tabular">{Math.round(player.minutes_pct)}%</span>
                </span>
              ) : (
                "na temporada"
              )
            }
          />
          <HeroStat
            icon="fa-coins"
            label="Valor de mercado"
            tooltip="Estimativa de valor no Transfermarkt."
            value={tm?.market_value ?? "—"}
            foot="Transfermarkt"
          />
          <HeroStat
            icon={onLoanFrom ? "fa-right-left" : "fa-file-signature"}
            label={onLoanFrom ? "Empréstimo" : "Contrato"}
            tone={contractTone}
            tooltip={onLoanFrom ? `Emprestado por ${onLoanFrom}. ${contractTooltip}` : contractTooltip}
            value={months != null ? `${months} ${months === 1 ? "mês" : "meses"}` : "—"}
            foot={
              onLoanFrom ? (
                <span className="hero-stat-loan">
                  <ClubLogo club={onLoanFrom} size={13} />
                  <span>de {onLoanFrom}</span>
                </span>
              ) : (
                contractEndLabel(tm?.contract_until) ?? "sem data"
              )
            }
          />
        </div>

        <div className="hero-action-grid">
          <div className="hero-action-cell hero-action-tendencies">
            <PassTendencies player={player} players={players} />
          </div>
          <div className="hero-action-cell hero-action-compare">
            <Tooltip content="Abre o comparador já com este atleta.">
              <Link className="btn btn-ghost btn-sm" href={href(`/comparar/${family}?a=${player.player_id}`)}>
                <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Comparar
              </Link>
            </Tooltip>
          </div>
          <div className="hero-action-cell hero-action-run">
            <Tooltip
              content={
                showRun
                  ? "Distância, velocidade e sprints vs. atletas na mesma posição."
                  : "Sem dados de GPS para este atleta nesta competição."
              }
            >
              <span className="hero-action-slot">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={showRun ? () => setRunOpen(true) : undefined}
                  disabled={!showRun}
                  aria-disabled={!showRun}
                >
                  <i className="fa-solid fa-person-running" aria-hidden="true" /> GPS
                </button>
              </span>
            </Tooltip>
          </div>
          <div className="hero-action-cell hero-action-discipline">
            {player.discipline ? (
              <DisciplineTendencies player={player} />
            ) : (
              <Tooltip content="Sem dados de disciplina para este atleta nesta competição.">
                <span className="hero-action-slot">
                  <button type="button" className="btn btn-ghost btn-sm" disabled aria-disabled>
                    <i className="fa-solid fa-flag" aria-hidden="true" /> Disciplina
                  </button>
                </span>
              </Tooltip>
            )}
          </div>
          <div className="hero-action-cell hero-action-similar">
            <Tooltip content="Escolha a competição e veja o top 5 por estilo de jogo.">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSimilarOpen(true)}>
                <i className="fa-solid fa-shuffle" aria-hidden="true" /> Similares
              </button>
            </Tooltip>
          </div>
          <div className="hero-action-cell hero-action-transfermarkt">
            <Tooltip content={tm?.profile_url ? "Abre o perfil no Transfermarkt." : "Perfil no Transfermarkt indisponível."}>
              <span className="hero-action-slot">
                {tm?.profile_url ? (
                  <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                  </a>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" disabled aria-disabled>
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                  </button>
                )}
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="hero-report-cta">
          <PlayerReportButton
            player={player}
            scoutPlayer={scout}
            family={family}
            players={players}
            primaryArchiveLabel={fichaSeason}
            cta
          />
        </div>
      </aside>

      {similarOpen ? (
        <SimilarCrossLeagueModal
          player={player}
          family={family}
          currentLeagueId={leagueId}
          sourceLeague={source.league}
          sourceSeason={source.season}
          players={players}
          onClose={() => setSimilarOpen(false)}
        />
      ) : null}
      {runOpen && scout.physical_run ? (
        <PlayerRunModal player={scout} onClose={() => setRunOpen(false)} />
      ) : null}
    </section>
  );
}
