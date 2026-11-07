"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeague } from "@/components/LeagueProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  confidenceTierLabel,
  minuteProjectionReport,
  type ProjectionScenario,
} from "@/lib/minuteProjection";
import { familyBySlug } from "@/lib/positions";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import { StatSectionsBoard, StatWindow } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
};

const SCENARIO_TABS: { key: ProjectionScenario; label: string; hint: string }[] = [
  {
    key: "negativa",
    label: "Pessimista",
    hint: "Percentil 10 do nível real do atleta: números ainda plausíveis se a fase quente não se sustenta.",
  },
  {
    key: "realista",
    label: "Esperado",
    hint: "Regressão Bayesiana com k = variância de amostragem ÷ variância entre atletas; μ = previsão ridge por métrica (temporadas 2022–25, validada leave-one-out) quando existir, senão titulares + perfil.",
  },
  {
    key: "positiva",
    label: "Otimista",
    hint: "Percentil 90 do nível real do atleta: se a forma atual se mantivesse como titular.",
  },
];

export function MinuteProjection({ player, family, players }: Props) {
  const league = useLeague();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<ProjectionScenario>("realista");
  const familyLabel = familyBySlug(family).label.toLocaleLowerCase("pt-BR");

  useEffect(() => {
    setOpen(false);
    setScenario("realista");
  }, [player.player_id]);

  const report = useMemo(() => minuteProjectionReport(player, players), [player, players]);
  const active = report ? report[scenario] : null;
  const rel = report?.reliability;

  return (
    <>
      <Tooltip content="Regressão empírica Bayesiana em direção ao patamar previsto entre temporadas (ridge por métrica, histórico de temporadas). Não projeta ‘resto de 2026’.">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <i className="fa-solid fa-forward" aria-hidden="true" /> Projeção
        </button>
      </Tooltip>

      {open ? (
        <StatWindow title="Projeção · histórico de temporadas" onClose={() => setOpen(false)}>
          {report && active && rel ? (
            <div className="projection-modal-copy">
              <p className="projection-reliability">
                {confidenceTierLabel(rel.tier)} ·{" "}
                <span>{Math.round(rel.sampleWeight * 100)}% da leitura vem da amostra 2026 (peso EB n90/(n90+k))</span>
                {rel.hotStreakRegressionPct != null && rel.hotStreakRegressionPct > 2 ? (
                  <>
                    {" "}
                    · métricas quentes tendem a cair ~{Math.round(rel.hotStreakRegressionPct)}% em direção ao
                    grupo
                  </>
                ) : null}
                {rel.crossSeasonSeasons > 0 ? (
                  <>
                    {" "}
                    · histórico ({rel.crossSeasonSeasons}{" "}
                    {rel.crossSeasonSeasons === 1 ? "temporada" : "temporadas"})
                  </>
                ) : null}
                {rel.roleChangeFlags > 0 ? (
                  <> · {rel.roleChangeFlags} métrica(s) com possível mudança de papel ou ruído de amostra</>
                ) : null}
              </p>
              <div className="projection-scenario-tabs" role="tablist" aria-label="Cenário de projeção">
                {SCENARIO_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={scenario === tab.key}
                    className={scenario === tab.key ? "is-active" : ""}
                    title={tab.hint}
                    onClick={() => setScenario(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <p className="projection-rank-meta">
                {familyLabel} · {league.name} · cenário{" "}
                {SCENARIO_TABS.find((t) => t.key === scenario)?.label.toLowerCase()}
              </p>
              <StatSectionsBoard player={active.profile} family={family} />
            </div>
          ) : (
            <p className="projection-empty">Amostra da posição ainda é curta para projetar.</p>
          )}
        </StatWindow>
      ) : null}
    </>
  );
}
