"use client";

import Link from "next/link";
import { ClubLogo } from "@/components/ClubLogo";
import { formatFoot } from "@/lib/feet";
import { familyBySlug } from "@/lib/positions";
import { playerInitials } from "@/lib/scoutTheme";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { DossierRatings } from "./DossierRatings";
import { ClusterTag, clusterTagProps } from "./ClusterTag";
import { ProfileTag, profileTagProps } from "./ProfileTag";

type Props = {
  player: PlayerProfile;
  poolSize: number;
  family: PositionFamily;
};

export function DossierHeader({ player, poolSize, family }: Props) {
  const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null;
  const positionLabel = player.position || familyBySlug(family).label;
  const tm = player.transfermarkt;
  const clusterProps = clusterTagProps(player);

  const contract =
    tm?.contract_remaining ?? (tm?.contract_until ? `até ${formatDate(tm.contract_until)}` : null);

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: formatFoot(player.foot) ?? "—" },
    { label: "País", value: player.nationality ?? "—" },
  ];

  return (
    <section className="dossier-card">
      <div className="dossier-portrait">
        {tm?.photo ? (
          <PlayerPhoto src={tm.photo} alt={player.name} />
        ) : (
          <span className="portrait-fallback">{playerInitials(player.name)}</span>
        )}
      </div>

      <div className="dossier-identity">
        <p className="dossier-eyebrow">
          <span>{positionLabel}</span>
          <i aria-hidden />
          {clusterProps ? <ClusterTag {...clusterProps} /> : <ProfileTag {...profileTagProps(player)} />}
        </p>

        <h1>{player.name}</h1>
        <p className="dossier-club">
          <ClubLogo club={player.display_club ?? player.club} size={20} />
          {player.display_club ?? player.club}
        </p>

        <dl className="dossier-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                {fact.unit && <em>{fact.unit}</em>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="dossier-dial">
        <DossierRatings player={player} poolSize={poolSize} family={family} />
      </div>

      <footer className="dossier-bar">
        <div className="bar-group bar-market">
          <div className="bar-item">
            <span>Valor de mercado</span>
            <strong>{tm?.market_value ?? "—"}</strong>
          </div>
          <div className="bar-item">
            <span>Contrato</span>
            <strong>{contract ?? "—"}</strong>
          </div>
        </div>

        <div className="bar-group bar-output">
          <div className="bar-item">
            <span>Gols</span>
            <strong>{player.goals}</strong>
          </div>
          <div className="bar-item">
            <span>Assistências</span>
            <strong>{player.assists}</strong>
          </div>
          <div className="bar-item bar-item-minutes">
            <span>Minutos</span>
            <strong>{player.minutes.toLocaleString("pt-BR")}</strong>
            {player.minutes_pct != null ? (
              <div className="dossier-bar-minutes-track" aria-hidden>
                <i style={{ width: `${Math.max(0, Math.min(100, player.minutes_pct))}%` }} />
              </div>
            ) : null}
            {player.minutes_pct != null ? (
              <em className="bar-minutes-pct">
                {player.minutes_pct.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                % da temporada
              </em>
            ) : null}
          </div>
        </div>

        <div className="bar-actions">
          <Link className="bar-compare" href={`/comparar/${family}?a=${player.player_id}`}>
            <svg viewBox="0 0 14 14" aria-hidden>
              <path
                d="M5.5 3.5 2.5 7l3 3.5M8.5 3.5 11.5 7l-3 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Comparar
          </Link>

          {tm?.profile_url && (
            <a className="bar-source" href={tm.profile_url} target="_blank" rel="noreferrer">
              Transfermarkt
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M4 2h6v6M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}
