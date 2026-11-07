"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import { MetricGradientBar } from "@/components/ui/MetricGradientBar";
import type { PlayerPhysicalRun, PlayerProfile } from "@/lib/types";
import { StatWindow } from "./ScoutStatsSections";

type MetricDef = {
  key: keyof PlayerPhysicalRun["percentiles"];
  label: string;
  unit: string;
  format: (run: PlayerPhysicalRun) => string;
};

const METRICS: MetricDef[] = [
  {
    key: "kilometers_p90",
    label: "Distância total",
    unit: "km / 90",
    format: (run) => fmt(run.kilometers_p90, 2),
  },
  {
    key: "top_speed",
    label: "Velocidade máxima",
    unit: "km/h",
    format: (run) => fmt(run.top_speed, 1),
  },
  {
    key: "sprints_p90",
    label: "Sprints",
    unit: "/ 90",
    format: (run) => fmt(run.sprints_p90, 1),
  },
  {
    key: "running_km_p90",
    label: "Corrida",
    unit: "km / 90",
    format: (run) => fmt(run.running_km_p90, 2),
  },
  {
    key: "high_speed_km_p90",
    label: "Alta intensidade",
    unit: "km / 90",
    format: (run) => fmt(run.high_speed_km_p90, 2),
  },
  {
    key: "sprinting_km_p90",
    label: "Sprint (distância)",
    unit: "km / 90",
    format: (run) => fmt(run.sprinting_km_p90, 2),
  },
];

function fmt(value: number, digits: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function comparisonTooltip(run: PlayerPhysicalRun, key: MetricDef["key"], pct: number): string {
  const rank = run.ranks[key];
  const pool = run.position_pool_size;
  const parts = [`Percentil ${Math.round(pct)}`];
  if (rank && pool) parts.push(`${rank}º de ${pool}`);
  if (run.position_pool) parts.push(run.position_pool);
  return parts.join(" · ");
}

type Props = {
  player: PlayerProfile;
  onClose: () => void;
};

export function PlayerRunModal({ player, onClose }: Props) {
  const run = player.physical_run;
  if (!run) return null;

  return (
    <StatWindow title="Dados físicos (GPS)" onClose={onClose}>
      <div className="run-modal">
        <header className="run-modal-head">
          <div>
            <p className="run-modal-player">{player.name}</p>
            <p className="run-modal-meta">
              {run.competition ?? "Série A"} · {run.matches} jogos · {run.minutes.toLocaleString("pt-BR")} min
            </p>
          </div>
          <p className="run-modal-pool">
            Referência: atletas na mesma posição ({run.position_pool})
            {run.position_pool_size ? ` · n=${run.position_pool_size}` : null}
          </p>
        </header>

        <div className="run-metrics-grid">
          {METRICS.map((metric) => {
            const pct = run.percentiles[metric.key];
            const tip = pct != null ? comparisonTooltip(run, metric.key, pct) : null;
            return (
              <article key={metric.key} className="run-metric-card">
                <div className="run-metric-head">
                  <span className="run-metric-label">{metric.label}</span>
                  <span className="run-metric-value tabular">
                    {metric.format(run)}
                    <span className="run-metric-unit">{metric.unit}</span>
                  </span>
                </div>
                {pct != null && tip ? (
                  <Tooltip content={tip} block>
                    <div className="run-metric-bar-tip" aria-label={tip}>
                      <MetricGradientBar score={pct} scale="percent" />
                    </div>
                  </Tooltip>
                ) : (
                  <p className="run-metric-foot run-metric-foot-muted">
                    Amostra insuficiente na posição para percentil (mín. 270 min na coleta).
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <p className="run-modal-source">Dados de corrida da partida · valores por 90 min quando aplicável</p>
      </div>
    </StatWindow>
  );
}
