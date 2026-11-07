"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { ConstructionProfileBars } from "../ConstructionProfileBars";

type TendencyEntry = {
  item: AspectItem;
  displayLabel: string;
  infoTip: string;
};

const CONSTRUCTION_TIPS: Record<string, string> = {
  pass_tendency:
    "Proporção de passes longos em relação ao total de passes do atleta, posicionando-o entre construção curta e longa.",
  progressive_share:
    "Participação de passes progressivos no volume total de passes, indicando tendência de conduzir o jogo para frente (baixo → alto).",
};

const DEFENSIVE_TIPS: Record<string, string> = {
  def_contact_style:
    "Equilíbrio entre ações de cobertura de espaço e intervenções agressivas (duelos, contatos) na defesa.",
  def_foul_style:
    "Relação entre faltas cometidas e volume defensivo — indica quão disciplinado o jogador é nas ações defensivas.",
};

function mapConstructionItems(items: AspectItem[]): TendencyEntry[] {
  const progressive = items.find(
    (item) => item.bar_key === "progressive_share" || item.label === "Passes Progressivos",
  );
  const passStyle = items.find(
    (item) => item.bar_key === "pass_tendency" || item.label === "Tendência de Passe",
  );

  const mapped: TendencyEntry[] = [];

  if (progressive) {
    mapped.push({
      item: progressive,
      displayLabel: "Tendência de Passe",
      infoTip:
        CONSTRUCTION_TIPS.progressive_share ??
        "Tendência de passes progressivos por 90 minutos comparada ao pool da posição.",
    });
  }

  if (passStyle) {
    mapped.push({
      item: passStyle,
      displayLabel: "Tipo de Construção",
      infoTip:
        CONSTRUCTION_TIPS.pass_tendency ??
        "Preferência entre passes curtos e longos no perfil de construção do atleta.",
    });
  }

  if (!mapped.length) {
    return items.map((item) => ({
      item,
      displayLabel: item.label,
      infoTip: "",
    }));
  }

  return mapped;
}

function mapDefensiveItems(items: AspectItem[]): TendencyEntry[] {
  return items.map((item) => ({
    item,
    displayLabel: item.label,
    infoTip: (item.bar_key && DEFENSIVE_TIPS[item.bar_key]) || "",
  }));
}

export function TendenciesButton({ player }: { player: PlayerProfile }) {
  const constr = player.aspects.perfil_construcao ?? [];
  const def = player.aspects.perfil_defensivo ?? [];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const constructionEntries = useMemo(() => mapConstructionItems(constr), [constr]);
  const defensiveEntries = useMemo(() => mapDefensiveItems(def), [def]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!constructionEntries.length && !defensiveEntries.length) return null;

  return (
    <div className="tendencies-pop-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm tendencies-pop-btn${open ? " open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências de jogo
        <i className="fa-solid fa-chevron-down tendencies-pop-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="tendencies-pop-panel tendencies-pop-panel-right" role="dialog" aria-label="Tendências de jogo">
          <div className="tendencies-pop-head">
            <span className="section-label">Tendências de jogo</span>
            <button
              type="button"
              className="tendencies-pop-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>

          {constructionEntries.length ? (
            <div className="tendencies-pop-section">
              <ConstructionProfileBars entries={constructionEntries} embedded />
            </div>
          ) : null}

          {defensiveEntries.length ? (
            <div className="tendencies-pop-section">
              <span className="tendencies-pop-section-title">
                <i className="fa-solid fa-shield-halved" aria-hidden="true" /> Perfil defensivo
              </span>
              <ConstructionProfileBars entries={defensiveEntries} embedded />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
