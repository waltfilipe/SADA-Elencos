"use client";

import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ClubLogo } from "@/components/ClubLogo";
import { ClusterTag, clusterTagProps } from "@/components/position/ClusterTag";
import { ProfileTag, profileTagProps } from "@/components/position/ProfileTag";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { PlayerHeatmap } from "@/components/position/profile/PlayerHeatmap";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatFoot } from "@/lib/feet";
import { playerInitials } from "@/lib/scoutTheme";
import type { FamilyBadgeOption } from "@/lib/statBadges";
import type { PlayerSearchRow } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

export function PlayerResultRow({
  player,
  catalog,
}: {
  player: PlayerSearchRow;
  catalog: FamilyBadgeOption[];
}) {
  const { href, heatmaps } = useLeague();
  const age = player.birth_year ? CURRENT_YEAR - player.birth_year : null;
  const tm = player.transfermarkt;
  const earned = catalog.filter((badge) => player.badges.includes(badge.key));

  const facts = [
    { label: "Idade", value: age ? `${age}` : "—", unit: age ? "anos" : undefined },
    { label: "Altura", value: player.height ? `${player.height}` : "—", unit: player.height ? "cm" : undefined },
    { label: "Pé", value: formatFoot(player.foot) ?? "—" },
    { label: "Minutos", value: player.minutes.toLocaleString("pt-BR") },
    { label: "Valor", value: tm?.market_value ?? "—" },
    { label: "Contrato", value: tm?.contract_remaining ?? "—" },
  ];

  const profileHref = href(
    `/posicao/${player.position_family}?atleta=${player.player_id}&origem=filtros`,
  );

  return (
    <article className="result-row">
      <Link href={profileHref} className="row-photo" aria-label={player.name}>
        {tm?.photo ? (
          <PlayerPhoto src={tm.photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </Link>

      <div className="row-identity">
        <Link href={profileHref} className="row-identity-link">
          <div className="row-name">
            <h3>{player.name}</h3>
            {clusterTagProps(player) ? (
              <ClusterTag {...clusterTagProps(player)!} />
            ) : (
              <ProfileTag {...profileTagProps(player)} />
            )}
          </div>
          <p className="row-club">
            <ClubLogo club={player.club} size={16} />
            {player.club}
            <i aria-hidden>·</i>
            <span>{player.position}</span>
          </p>

        </Link>

        {earned.length ? (
          <ul className="row-badges" aria-label="Selos">
            {earned.map((badge) => (
              <li key={badge.key}>
                <Tooltip content={`${badge.label}. ${badge.title}`}>
                  <span className={`row-badge-icon tone-${badge.tone}`} aria-label={badge.label}>
                    <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
                  </span>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="row-badges-empty">Sem badges nesta posição</p>
        )}

        <div className="row-stat-strip">
          {facts.map((fact) => (
            <div key={fact.label} className="row-stat-chip">
              <span>{fact.label}</span>
              <strong>
                {fact.value}
                {fact.unit ? <em>{fact.unit}</em> : null}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {heatmaps ? (
        <div className="row-mini-heatmap">
          <PlayerHeatmap compact heatmap={player.heatmap} playerName={player.name} />
        </div>
      ) : null}

      <div className="row-actions">
          {tm?.profile_url ? (
            <a className="btn btn-ghost btn-sm row-action" href={tm.profile_url} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
              Transfermarkt
            </a>
          ) : null}
          <AddToShadowMenu playerId={player.player_id} family={player.position_family} />
      </div>
    </article>
  );
}
