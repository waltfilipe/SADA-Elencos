"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { PlayerHeatmap } from "@/components/position/profile/PlayerHeatmap";
import { ProfileRadarCard } from "@/components/position/profile/ProfileCard";
import { StatProfileRadarCard } from "@/components/position/profile/PlayerReport";
import { ScoutStatsSections } from "@/components/position/profile/ScoutStatsSections";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { playerInitials } from "@/lib/scoutTheme";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export type CompareSide = "a" | "b" | "c";

type Props = {
  side: CompareSide;
  label: string;
  player: PlayerProfile;
  players: PlayerProfile[];
  /** Variantes do jogador médio (/api/avg-player) exibidas no grupo "Médios". */
  mediaPlayers?: PlayerProfile[];
  family: PositionFamily;
  pool: PlayerProfile[];
  excludeIds: Set<string>;
  onChange: (id: string) => void;
  activeSection: string | null;
  onSectionChange: (title: string | null) => void;
  peers: PlayerProfile[];
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function monthsRemaining(iso?: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return "—";
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  if (months < 0) return "Expirado";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function ComparePlayerColumn({
  side,
  label,
  player,
  players,
  mediaPlayers = [],
  family,
  pool,
  excludeIds,
  onChange,
  activeSection,
  onSectionChange,
  peers,
  heatmapsEnabled = true,
}: Props & { heatmapsEnabled?: boolean }) {
  const { href } = useLeague();
  const tm = player.transfermarkt;
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const isMedia = player.player_id.startsWith("media-");
  const mediaRange = useMemo(() => {
    const seasons = player.media_seasons ?? [];
    if (!seasons.length) return null;
    const sorted = [...seasons].sort();
    return sorted.length === 1 ? sorted[0] : `${sorted[0]}–${sorted[sorted.length - 1]}`;
  }, [player.media_seasons]);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    return players.filter((option) => {
      if (excludeIds.has(option.player_id) && option.player_id !== player.player_id) return false;
      if (!q) return true;
      return fold(option.name).includes(q) || fold(option.club).includes(q);
    });
  }, [players, query, excludeIds, player.player_id]);

  const mediaMatches = useMemo(() => {
    const q = fold(query.trim());
    return mediaPlayers.filter((option) => {
      if (excludeIds.has(option.player_id) && option.player_id !== player.player_id) return false;
      if (!q) return true;
      return fold(option.name).includes(q);
    });
  }, [mediaPlayers, query, excludeIds, player.player_id]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    if (!excludeIds.has(id) || id === player.player_id) onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <article className={`compare-player-column side-${side}`} aria-label={`Coluna ${label}: ${player.name}`}>
      <header className={`compare-identity-card player-card side-${side}`}>
        <div className="compare-col-picker">
          <span>{label}</span>
          <div className="compare-col-search" ref={searchRef}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder="Buscar atleta ou clube"
              aria-label={`Buscar atleta da coluna ${label}`}
              aria-expanded={open}
              aria-controls={`compare-results-${side}`}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {open ? (
              <ul className="compare-col-results" id={`compare-results-${side}`} role="listbox">
                {mediaMatches.length ? (
                  <>
                    <li className="compare-col-results-group" aria-hidden="true">Médios</li>
                    {mediaMatches.map((option) => (
                      <li key={option.player_id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={option.player_id === player.player_id}
                          className={option.player_id === player.player_id ? "is-current" : ""}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            pick(option.player_id);
                          }}
                        >
                          <strong>{option.name}</strong>
                          <em>{option.club}</em>
                        </button>
                      </li>
                    ))}
                  </>
                ) : null}
                {matches.length ? (
                  matches.slice(0, 30).map((option) => (
                    <li key={option.player_id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={option.player_id === player.player_id}
                        className={option.player_id === player.player_id ? "is-current" : ""}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          pick(option.player_id);
                        }}
                      >
                        <strong>{option.name}</strong>
                        <em>{option.club}</em>
                      </button>
                    </li>
                  ))
                ) : mediaMatches.length ? null : (
                  <li className="compare-col-results-empty">Nenhum atleta com esse nome.</li>
                )}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="compare-head-top">
          <div className="compare-col-photo">
            <PlayerPhoto
              src={tm?.photo}
              alt={player.name}
              fallback={<span className="compare-col-photo-fallback">{playerInitials(player.name)}</span>}
            />
          </div>

          <div className="compare-col-side">
            <div className="compare-col-identity">
              <h2 className="compare-col-name">{player.name}</h2>
              {isMedia ? (
                <p className="compare-col-club">
                  <i className="fa-solid fa-layer-group" aria-hidden="true" />
                  <span>
                    Média {mediaRange} · {player.club}
                  </span>
                </p>
              ) : (
                <p className="compare-col-club">
                  <ClubLogo club={player.display_club ?? player.club} size={16} />
                  <span>{player.display_club ?? player.club}</span>
                  <span aria-hidden="true">·</span>
                  <span className="compare-col-position">{player.position}</span>
                </p>
              )}
              <div className="compare-col-tag-row">
                <ProfileTag {...profileTagProps(player)} />
              </div>
            </div>

            <div className="compare-col-actions">
              {isMedia ? null : (
                <>
                  <Link className="btn btn-ghost btn-sm" href={href(`/posicao/${family}?atleta=${player.player_id}`)}>
                    <i className="fa-solid fa-user" aria-hidden="true" /> Ver perfil
                  </Link>
                  {tm?.profile_url ? (
                    <a className="btn btn-ghost btn-sm" href={tm.profile_url} target="_blank" rel="noreferrer">
                      <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Transfermarkt
                    </a>
                  ) : null}
                  <AddToShadowMenu playerId={player.player_id} family={family} />
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`compare-head-bottom${heatmapsEnabled ? "" : " compare-head-bottom-no-heatmap"}`}>
          {heatmapsEnabled ? (
            <div className="compare-col-pitch">
              <PlayerHeatmap compact heatmap={player.heatmap} playerName={player.name} />
            </div>
          ) : null}
          <dl className="compare-fact-grid">
            <div>
              <dt>Valor</dt>
              <dd>{tm?.market_value ?? "—"}</dd>
            </div>
            <div>
              <dt>Contrato</dt>
              <dd>{monthsRemaining(tm?.contract_until)}</dd>
            </div>
            <div>
              <dt>Minutos</dt>
              <dd className="tabular">
                {player.minutes.toLocaleString("pt-BR")}
                {player.minutes_pct != null ? <em>{Math.round(player.minutes_pct)}%</em> : null}
              </dd>
            </div>
            <div>
              <dt>Idade</dt>
              <dd>{age ?? "—"}</dd>
            </div>
            <div>
              <dt>Gols</dt>
              <dd className="tabular">{player.goals}</dd>
            </div>
            <div>
              <dt>Assistências</dt>
              <dd className="tabular">{player.assists}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="compare-col-stack">
        <div className="compare-col-profile">
          <ProfileRadarCard player={player} family={family} players={pool} />
        </div>

        <div className="player-card compare-col-radar">
          <StatProfileRadarCard player={player} bare />
        </div>

        <div className="player-card compare-col-stats">
          <ScoutStatsSections
            player={player}
            family={family}
            active={activeSection}
            onActiveChange={onSectionChange}
            peers={peers}
          />
        </div>
      </div>
    </article>
  );
}
