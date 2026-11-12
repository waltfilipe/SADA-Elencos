"use client";

import { useMemo, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ShadowPlayerChip } from "@/components/shadow/ShadowPlayerChip";
import { ShadowPlayerTooltip } from "@/components/shadow/ShadowPlayerMiniReport";
import { parseShadowDrag, writeShadowDrag } from "@/components/shadow/drag";
import { fieldSlots, formationById, type FormationSlot } from "@/lib/formations";
import { playerInitials } from "@/lib/scoutTheme";
import type { PlayerSearchRow } from "@/lib/types";

export { writeShadowDrag };

function PitchToken({ player }: { player: PlayerSearchRow }) {
  const initials = <span className="shadow-pitch-token-initials">{playerInitials(player.name)}</span>;
  return (
    <div className="shadow-pitch-token">
      <span className="shadow-pitch-token-photo">
        <PlayerPhoto src={player.transfermarkt?.photo} alt="" loading="lazy" fallback={initials} />
      </span>
      <span className="shadow-pitch-token-name" title={player.name}>
        {player.name}
      </span>
    </div>
  );
}

type Props = {
  formationId: string;
  assignments: Record<string, string | null>;
  /** Titulares do time sombra, para mini comparação no time próprio. */
  compareAssignments?: Record<string, string | null> | null;
  playersById: Map<string, PlayerSearchRow>;
  selectedSlotId: string | null;
  placementPlayerId: string | null;
  /** Time sombra monta na mão. Elenco atual só consulta o time já escalado. */
  editable?: boolean;
  onSelectSlot: (slotId: string | null) => void;
  onAssign: (slotId: string, playerId: string | null) => void;
  onDrop: (sourceSlotId: string | null, targetSlotId: string, playerId: string) => void;
  onAddReserve: (slot: FormationSlot) => void;
};

export function PitchView({
  formationId,
  assignments,
  playersById,
  selectedSlotId,
  placementPlayerId,
  onSelectSlot,
  onAssign,
  onDrop,
  compareAssignments,
  onAddReserve,
  editable = true,
}: Props) {
  const formation = useMemo(() => formationById(formationId), [formationId]);
  const slots = useMemo(() => fieldSlots(formation), [formation]);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  function handleSlotClick(slot: FormationSlot) {
    if (editable && placementPlayerId) {
      onDrop(null, slot.id, placementPlayerId);
      return;
    }
    onSelectSlot(selectedSlotId === slot.id ? null : slot.id);
  }

  function handleDragStart(e: React.DragEvent, playerId: string, sourceSlotId: string | null) {
    if (!editable) return;
    writeShadowDrag(e.dataTransfer, playerId, sourceSlotId);
  }

  function handleDragOver(e: React.DragEvent, slotId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlotId(slotId);
  }

  function handleDrop(e: React.DragEvent, slot: FormationSlot) {
    e.preventDefault();
    setDragOverSlotId(null);
    if (!editable) return;
    const payload = parseShadowDrag(e.dataTransfer);
    if (!payload) return;
    onDrop(payload.sourceSlotId, slot.id, payload.playerId);
  }

  return (
    <div className="shadow-pitch-wrap">
      <p className="shadow-pitch-axis">
        <span>Ataque</span>
        <span>Direita do time à direita · esquerda à esquerda</span>
        <span>Defesa</span>
      </p>
      <div className="shadow-pitch" aria-label="Campo tático, ataque para cima">
        <div className="shadow-pitch-lines" aria-hidden="true">
          <span className="shadow-pitch-mid" />
          <span className="shadow-pitch-circle" />
          <span className="shadow-pitch-box shadow-pitch-box-top" />
          <span className="shadow-pitch-box shadow-pitch-box-bottom" />
        </div>

        {slots.map((slot) => {
          const playerId = assignments[slot.id];
          const player = playerId ? playersById.get(playerId) : undefined;
          const isSelected = selectedSlotId === slot.id;
          const isDragOver = dragOverSlotId === slot.id;
          const isPlacementTarget = Boolean(placementPlayerId);
          const compareId = compareAssignments?.[slot.id];
          const comparePlayer = compareId ? playersById.get(compareId) ?? null : compareAssignments ? null : undefined;

          return (
            <div
              key={slot.id}
              className={`shadow-pitch-slot${isSelected ? " selected" : ""}${isDragOver ? " drag-over" : ""}${isPlacementTarget ? " placement-mode" : ""}${player ? " filled" : " empty"}`}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                zIndex: isSelected || isDragOver ? 40 : Math.round(slot.y),
              }}
              onDragOver={(e) => handleDragOver(e, slot.id)}
              onDragLeave={() => setDragOverSlotId((id) => (id === slot.id ? null : id))}
              onDrop={(e) => handleDrop(e, slot)}
            >
              <span className="shadow-slot-label">{slot.label}</span>
              {player ? (
                <div
                  className="shadow-slot-draggable"
                  draggable={editable}
                  onDragStart={(e) => handleDragStart(e, player.player_id, slot.id)}
                  onClick={() => handleSlotClick(slot)}
                >
                  <ShadowPlayerTooltip
                    player={player}
                    compareWith={comparePlayer}
                    profileLeague={player.sourceLeague}
                    viewAs={slot.families[0]}
                    viewAsLabel={slot.label}
                    block
                  >
                    <PitchToken player={player} />
                  </ShadowPlayerTooltip>
                </div>
              ) : (
                <button
                  type="button"
                  className="shadow-slot-hit"
                  aria-label={editable ? `Escalar titular em ${slot.label}` : slot.label}
                  onClick={() => handleSlotClick(slot)}
                >
                  <span className="shadow-slot-empty" />
                </button>
              )}
              {editable ? (
                <button
                  type="button"
                  className="shadow-slot-plus"
                  aria-label={player ? `Adicionar reserva em ${slot.label}` : `Escalar titular em ${slot.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddReserve(slot);
                  }}
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" />
                </button>
              ) : null}
              {editable && player && isSelected ? (
                <button
                  type="button"
                  className="shadow-slot-clear"
                  aria-label={`Remover ${player.name} da posição`}
                  onClick={() => onAssign(slot.id, null)}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {editable && placementPlayerId ? (
        <p className="shadow-pitch-hint">
          <i className="fa-solid fa-location-dot" aria-hidden="true" /> Clique na posição para escalar o reserva
        </p>
      ) : editable ? (
        <p className="shadow-pitch-hint">
          Arraste entre posições · + escala titular ou adiciona reserva
        </p>
      ) : (
        <p className="shadow-pitch-hint">
          Titulares pelos minutos em cada posição · reservas no banco
        </p>
      )}
    </div>
  );
}

export function BenchStrip({
  playerIds,
  playersById,
  placementPlayerId,
  onPlace,
  onRemove,
  onDropStart,
}: {
  playerIds: string[];
  playersById: Map<string, PlayerSearchRow>;
  placementPlayerId: string | null;
  onPlace: (playerId: string | null) => void;
  onRemove: (playerId: string) => void;
  onDropStart?: (playerId: string) => void;
}) {
  if (!playerIds.length) {
    return <p className="shadow-bench-empty">Nenhum reserva — adicione atletas pelo botão + no perfil.</p>;
  }

  return (
    <ul className="shadow-bench-list">
      {playerIds.map((id) => {
        const player = playersById.get(id);
        if (!player) return null;
        const placing = placementPlayerId === id;
        return (
          <li key={id}>
            <div
              className="shadow-bench-draggable"
              draggable
              onDragStart={(e) => {
                writeShadowDrag(e.dataTransfer, id, null);
                onDropStart?.(id);
              }}
            >
              <ShadowPlayerTooltip player={player} profileLeague={player.sourceLeague} block>
                <ShadowPlayerChip
                  player={player}
                  size="md"
                  selected={placing}
                  onClick={() => onPlace(placing ? null : id)}
                  onRemove={() => onRemove(id)}
                />
              </ShadowPlayerTooltip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
