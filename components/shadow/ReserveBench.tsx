"use client";

import { PlayerPhoto } from "@/components/PlayerPhoto";
import { writeShadowDrag } from "@/components/shadow/PitchView";
import { playerShortName } from "@/lib/clubLineup";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

type Props = {
  playerIds: string[];
  playersById: Map<string, PlayerSearchRow>;
  labels: Map<string, string>;
  placementPlayerId: string | null;
  editable: boolean;
  onPlace: (playerId: string) => void;
  onSelect: (playerId: string) => void;
};

export function ReserveBench({
  playerIds,
  playersById,
  labels,
  placementPlayerId,
  editable,
  onPlace,
  onSelect,
}: Props) {
  const players = playerIds
    .map((id) => playersById.get(id))
    .filter((player): player is PlayerSearchRow => Boolean(player));

  return (
    <section className="shadow-reserve-bench" aria-label="Banco de reservas">
      <header className="shadow-bench-head">
        <h3 className="section-label">Banco de reservas</h3>
        <span className="shadow-bench-count">{players.length}</span>
      </header>
      {players.length ? (
        <ul className="shadow-bench-grid">
          {players.map((player) => {
            const placing = placementPlayerId === player.player_id;
            const label = labels.get(player.player_id);
            return (
              <li key={player.player_id}>
                <button
                  type="button"
                  className={`shadow-bench-player${placing ? " is-placing" : ""}`}
                  title={`${player.name} · ${player.minutes} min · reserva`}
                  draggable={editable}
                  onDragStart={(event) => {
                    if (!editable) return;
                    writeShadowDrag(event.dataTransfer, player.player_id, null);
                  }}
                  onClick={() => {
                    if (editable) onPlace(player.player_id);
                    else onSelect(player.player_id);
                  }}
                >
                  <span className="shadow-bench-photo">
                    <PlayerPhoto
                      src={player.transfermarkt?.photo}
                      alt=""
                      fallback={<span>{playerInitials(player.name)}</span>}
                    />
                  </span>
                  <span className="shadow-bench-name">{playerShortName(player.name)}</span>
                  {label ? <span className="shadow-bench-pos">{label}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="shadow-bench-empty">
          {editable
            ? "Nenhum reserva. O + em posição ocupada manda o atleta para o banco."
            : "Nenhum reserva neste elenco."}
        </p>
      )}
    </section>
  );
}
