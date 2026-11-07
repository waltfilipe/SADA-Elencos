"use client";

import { useEffect, useRef, useState } from "react";
import { useShadowTeam } from "@/hooks/useShadowTeam";
import type { PositionFamily } from "@/lib/types";

type Props = {
  playerId: string;
  family: PositionFamily;
  compact?: boolean;
};

export function AddToShadowMenu({ playerId, family, compact = false }: Props) {
  const { ready, toggleWatchlist, toggleSquad, isWatchlisted, isInSquad } = useShadowTeam();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return null;

  const watch = isWatchlisted(playerId);
  const squad = isInSquad(playerId);

  return (
    <div className="shadow-add-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm shadow-add-trigger${open ? " active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <i className="fa-solid fa-plus" aria-hidden="true" />
        {!compact ? <span>Adicionar</span> : null}
      </button>

      {open ? (
        <div className="shadow-add-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className={squad ? "is-active" : ""}
            onClick={() => {
              toggleSquad(playerId, family);
              setOpen(false);
            }}
          >
            <i className={`fa-solid ${squad ? "fa-check" : "fa-shirt"}`} aria-hidden="true" />
            <span>
              <strong>{squad ? "Remover do Time Sombra" : "Time Sombra"}</strong>
              <em>Escalar no campo tático</em>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={watch ? "is-active" : ""}
            onClick={() => {
              toggleWatchlist(playerId);
              setOpen(false);
            }}
          >
            <i className={`fa-solid ${watch ? "fa-check" : "fa-eye"}`} aria-hidden="true" />
            <span>
              <strong>{watch ? "Remover da observação" : "Lista de observação"}</strong>
              <em>Acompanhar sem escalar</em>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
