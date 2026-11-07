"use client";

import { useEffect, useMemo, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import type { AspectItem, DisciplineInfo, PlayerProfile } from "@/lib/types";
import { ConstructionProfileBars, type TendencyBarEntry } from "../ConstructionProfileBars";
import { StatWindow } from "./ScoutStatsSections";

type MetricKey = "fouls" | "yellow" | "red";
type Tone = "good" | "even" | "bad";

type Metric = {
  key: MetricKey;
  label: string;
  total: number | null;
  per90: number | null;
  avg: number | null;
  decimals: number;
};

/** Below this pool average a ratio is meaningless (red cards ≈ 0,01/90). */
const MIN_RATIO_AVG = 0.05;

function fmt(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Menos é melhor: abaixo da média é bom, acima é ruim. */
function toneFor(value: number, avg: number): Tone {
  if (avg < MIN_RATIO_AVG) {
    const gap = value - avg;
    return gap > 0.03 ? "bad" : gap < -0.03 ? "good" : "even";
  }
  const ratio = value / avg;
  return ratio <= 0.85 ? "good" : ratio >= 1.15 ? "bad" : "even";
}

function deltaLabel(value: number, avg: number, decimals: number): string {
  if (avg < MIN_RATIO_AVG) {
    const gap = value - avg;
    if (Math.abs(gap) < 0.005) return "na média";
    return `${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap), decimals)} /90`;
  }
  const pct = Math.round(((value - avg) / avg) * 100);
  if (pct === 0) return "na média";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs média`;
}

function buildMetrics(disc: DisciplineInfo): Metric[] {
  const pool = disc.pool ?? {};
  return [
    {
      key: "fouls",
      label: "Faltas cometidas",
      total: disc.fouls_total,
      per90: disc.fouls_per90,
      avg: pool.fouls_per90 ?? null,
      decimals: 1,
    },
    {
      key: "yellow",
      label: "Cartões amarelos",
      total: disc.yellow_total,
      per90: disc.yellow_per90,
      avg: pool.yellow_per90 ?? null,
      decimals: 2,
    },
    {
      key: "red",
      label: "Cartões vermelhos",
      total: disc.red_total,
      per90: disc.red_per90,
      avg: pool.red_per90 ?? null,
      decimals: 2,
    },
  ];
}

/** Veredito: faltas e amarelos pesam igual; vermelho entra só quando aparece. */
function verdict(metrics: Metric[]): { tone: Tone; title: string; detail: string } | null {
  const scored = metrics.filter(
    (m): m is Metric & { per90: number; avg: number } =>
      m.per90 != null && m.avg != null && m.avg >= MIN_RATIO_AVG,
  );
  if (!scored.length) return null;
  const ratio = scored.reduce((sum, m) => sum + m.per90 / m.avg, 0) / scored.length;
  const reds = metrics.find((m) => m.key === "red")?.total ?? 0;
  const redNote = reds > 0 ? ` · ${reds} ${reds === 1 ? "expulsão" : "expulsões"} na temporada` : "";
  if (ratio <= 0.85) {
    return { tone: "good", title: "Mais disciplinado que a média", detail: `Comete menos faltas e leva menos cartões que a posição${redNote}.` };
  }
  if (ratio >= 1.15) {
    return { tone: "bad", title: "Acima da média em faltas e cartões", detail: `Perfil mais faltoso que o da posição${redNote}.` };
  }
  return { tone: "even", title: "Na média da posição", detail: `Faltas e cartões em linha com atletas da mesma função${redNote}.` };
}

function MetricIcon({ metric }: { metric: MetricKey }) {
  if (metric === "fouls") {
    return (
      <span className="disc-icon disc-icon-foul" aria-hidden="true">
        <i className="fa-solid fa-person-falling-burst" />
      </span>
    );
  }
  return <span className={`disc-card disc-card-${metric}`} aria-hidden="true" />;
}

/** Cartõezinhos empilhados: um por cartão recebido, até 8, depois "+n". */
function CardStack({ kind, count }: { kind: "yellow" | "red"; count: number }) {
  if (count <= 0) return <span className="disc-stack-empty">Nenhum</span>;
  const shown = Math.min(count, 8);
  return (
    <span className="disc-stack" aria-label={`${count} ${kind === "yellow" ? "amarelos" : "vermelhos"}`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`disc-card disc-card-mini disc-card-${kind}`} />
      ))}
      {count > shown ? <span className="disc-stack-more">+{count - shown}</span> : null}
    </span>
  );
}

function SummaryTile({ metric }: { metric: Metric }) {
  const tone = metric.per90 != null && metric.avg != null ? toneFor(metric.per90, metric.avg) : "even";
  return (
    <div className={`disc-tile disc-tile-${metric.key}`}>
      <div className="disc-tile-head">
        <MetricIcon metric={metric.key} />
        <span className="disc-tile-label">{metric.label}</span>
      </div>
      <div className="disc-tile-body">
        <strong className="disc-tile-total tabular">{metric.total ?? "—"}</strong>
        <span className="disc-tile-unit">na temporada</span>
      </div>
      <div className="disc-tile-foot">
        {metric.key === "fouls" ? (
          <span className="disc-tile-rate tabular">
            {metric.per90 != null ? fmt(metric.per90, 1) : "—"} <em>/90</em>
          </span>
        ) : (
          <CardStack kind={metric.key} count={metric.total ?? 0} />
        )}
        {metric.per90 != null && metric.avg != null ? (
          <span className={`disc-chip disc-chip-${tone}`}>{deltaLabel(metric.per90, metric.avg, metric.decimals)}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Converte a métrica de disciplina em entrada da barra clássica do site (/90). */
function compareEntry(metric: Metric & { per90: number; avg: number }): TendencyBarEntry {
  const scale = Math.max(metric.per90, metric.avg, metric.key === "fouls" ? 0.5 : 0.05) * 1.6;
  const item: AspectItem = {
    label: metric.label,
    grade: "",
    stats: [],
    share_pct: metric.per90,
    pool_avg_pct: metric.avg,
    scale_max_pct: scale,
    display_value: fmt(metric.per90, metric.decimals),
  };
  return { item, displayLabel: metric.label, valueScale: "per90" };
}

export function DisciplineTendencies({ player }: { player: PlayerProfile }) {
  const [open, setOpen] = useState(false);
  const { beginLoad, endLoad } = useLoading();

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const disc = player.discipline;
  const metrics = useMemo(() => (disc ? buildMetrics(disc) : []), [disc]);
  const reading = useMemo(() => verdict(metrics), [metrics]);

  if (!disc) return null;

  const comparable = metrics.filter(
    (m): m is Metric & { per90: number; avg: number } => m.per90 != null && m.avg != null,
  );
  const totalsText = `${disc.fouls_total ?? "—"} faltas · ${disc.yellow_total} amarelos · ${disc.red_total} vermelhos`;

  const openModal = () => {
    beginLoad();
    setOpen(true);
    window.setTimeout(() => endLoad(), 120);
  };

  return (
    <>
      <Tooltip content={`Disciplina — ${totalsText} na temporada.`}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-flag" aria-hidden="true" /> Disciplina
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Disciplina" onClose={() => setOpen(false)}>
          <div className="disc-modal">
            {reading ? (
              <div className={`disc-verdict disc-verdict-${reading.tone}`}>
                <span className="disc-verdict-icon" aria-hidden="true">
                  <i
                    className={`fa-solid ${
                      reading.tone === "good" ? "fa-shield-halved" : reading.tone === "bad" ? "fa-triangle-exclamation" : "fa-scale-balanced"
                    }`}
                  />
                </span>
                <span className="disc-verdict-copy">
                  <strong>{reading.title}</strong>
                  <span>{reading.detail}</span>
                </span>
              </div>
            ) : null}

            <div className="disc-tiles">
              {metrics.map((metric) => (
                <SummaryTile key={metric.key} metric={metric} />
              ))}
            </div>

            {comparable.length ? (
              <section className="disc-compare" aria-label="Comparação com a posição">
                <h4 className="disc-section-title">Por 90 minutos vs média da posição</h4>
                <ConstructionProfileBars entries={comparable.map(compareEntry)} embedded />
              </section>
            ) : null}

            <p className="disc-footnote">
              <i className="fa-solid fa-circle-info" aria-hidden="true" /> Comparado com atletas da mesma posição nesta
              série. Menos é melhor — barra verde indica disciplina acima da média.
            </p>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
