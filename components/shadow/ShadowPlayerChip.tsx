"use client";

import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ShadowPlayerTooltip } from "@/components/shadow/ShadowPlayerMiniReport";
import { writeShadowDrag } from "@/components/shadow/drag";
import { gradeTier, playerInitials, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

type Props = {
  player: PlayerSearchRow;
  size?: "sm" | "md";
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
};

export function ShadowPlayerChip({ player, size = "md", onRemove, onClick, selected }: Props) {
  const letter = ratingToLetterGrade(player.rating);
  const token = gradeTier(letter);
  const photo = player.transfermarkt?.photo;

  const inner = (
    <>
      <span className={`shadow-chip-photo shadow-chip-photo-${size}`}>
        {photo ? (
          <PlayerPhoto src={photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="shadow-chip-copy">
        <strong title={player.name}>{player.name}</strong>
        <em>
          <ClubLogo club={player.club} size={12} />
          {player.position}
        </em>
      </span>
      <span className="shadow-chip-rating shadow-chip-letter tabular" style={tierVars(token)}>
        {letter}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="shadow-chip-remove"
          aria-label={`Remover ${player.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      ) : null}
    </>
  );

  const className = `shadow-player-chip shadow-player-chip-${size}${selected ? " selected" : ""}${onClick ? " is-clickable" : ""}`;

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function ShadowPlayerRow({
  player,
  profileLabel,
  onRemove,
  draggable = false,
}: {
  player: PlayerSearchRow;
  profileLabel?: string | null;
  onRemove?: () => void;
  /** Permite arrastar o atleta para um slot do campo. */
  draggable?: boolean;
}) {
  const { href } = useLeague();
  const letter = ratingToLetterGrade(player.rating);
  const token = gradeTier(letter);
  const photo = player.transfermarkt?.photo;

  return (
    <div
      className="shadow-player-row"
      draggable={draggable}
      onDragStart={draggable ? (event) => writeShadowDrag(event.dataTransfer, player.player_id, null) : undefined}
    >
      <ShadowPlayerTooltip player={player} profileLeague={player.sourceLeague} block>
        <Link
          href={
            player.sourceLeague
              ? `/${player.sourceLeague}/posicao/${player.position_family}?atleta=${player.player_id}`
              : href(`/posicao/${player.position_family}?atleta=${player.player_id}`)
          }
          className="shadow-player-row-link"
        >
          <span className="shadow-player-row-photo">
            {photo ? (
              <PlayerPhoto src={photo} alt="" loading="lazy" />
            ) : (
              <span>{playerInitials(player.name)}</span>
            )}
          </span>
          <span className="shadow-player-row-copy">
            <strong>{player.name}</strong>
            <em>
              <ClubLogo club={player.club} size={13} />
              {player.position}
              {profileLabel ? ` · ${profileLabel}` : ""}
            </em>
          </span>
          <span className="shadow-player-row-rating shadow-chip-letter tabular" style={tierVars(token)}>
            {letter}
          </span>
        </Link>
      </ShadowPlayerTooltip>
      {onRemove ? (
        <button type="button" className="shadow-player-row-remove" aria-label={`Remover ${player.name}`} onClick={onRemove}>
          <i className="fa-solid fa-trash-can" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
