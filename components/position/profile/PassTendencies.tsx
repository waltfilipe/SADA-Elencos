"use client";

import { useEffect, useMemo, useState } from "react";
import { ConstructionProfileBars, type TendencyBarEntry } from "@/components/position/ConstructionProfileBars";
import { useLoading } from "@/components/LoadingProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { flattenAspects } from "@/lib/aspectLookup";
import { crossingReading, formatPer90 } from "@/lib/crossingTendency";
import type { AspectItem, PlayerProfile } from "@/lib/types";
import { StatWindow } from "./ScoutStatsSections";

type BarSpec = {
  label: string;
  share: number;
  average: number;
};

function parseDisplay(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function exactItem(player: PlayerProfile, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === label);
  return parseDisplay(item?.display_value);
}

function exactSub(player: PlayerProfile, parent: string, label: string): number | null {
  const item = flattenAspects(player).find((row) => row.label === parent);
  const sub = item?.sub_metrics?.find((row) => row.label === label);
  return parseDisplay(sub?.display_value);
}

function storedShare(player: PlayerProfile, key: "pass_tendency" | "progressive_share"): AspectItem | null {
  return (player.aspects.perfil_construcao ?? []).find((item) => item.bar_key === key) ?? null;
}

function longPassShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "pass_tendency");
  if (stored?.share_pct != null) return stored.share_pct;
  const long = exactItem(player, "Passes Longos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (long == null || total == null || total <= 0) return null;
  return (long / total) * 100;
}

function progressiveShare(player: PlayerProfile): number | null {
  const stored = storedShare(player, "progressive_share");
  if (stored?.share_pct != null) return stored.share_pct;
  const progressive = exactItem(player, "Passes Progressivos");
  const total = exactSub(player, "Distribuição", "Passes");
  if (progressive == null || total == null || total <= 0) return null;
  return (progressive / total) * 100;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function barEntry(
  spec: BarSpec,
  tip: string,
  options?: { per90?: boolean; scale?: number; lengthSpectrum?: boolean },
): TendencyBarEntry {
  const per90 = options?.per90 === true;
  const scale = options?.scale ?? Math.max(40, spec.share, spec.average, 1);
  return {
    displayLabel: spec.label,
    infoTip: tip,
    valueScale: per90 ? "per90" : "percent",
    centerAverage: true,
    lengthSpectrum: options?.lengthSpectrum === true,
    item: {
      label: spec.label,
      grade: "",
      stats: [],
      share_pct: spec.share,
      pool_avg_pct: spec.average,
      scale_max_pct: scale,
      display_value: per90 ? formatPer90(spec.share) : formatPct(spec.share),
    },
  };
}

function passVerdict(share: number, average: number): string {
  const gap = share - average;
  if (gap >= 2) return "Passe mais longo que a média da posição.";
  if (gap <= -2) return "Passe mais curto que a média da posição.";
  return "Passe na média da posição, entre curto e longo.";
}

function deltaChip(value: number, average: number, unit: "pct" | "per90"): { label: string; tone: "up" | "down" | "neutral" } {
  const gap = value - average;
  const abs = Math.abs(gap);
  if (unit === "pct") {
    if (abs < 1.5) return { label: "Na média", tone: "neutral" };
    return gap > 0
      ? { label: `+${Math.round(abs)} p.p. vs pool`, tone: "up" }
      : { label: `−${Math.round(abs)} p.p. vs pool`, tone: "down" };
  }
  if (abs < 0.15) return { label: "Na média", tone: "neutral" };
  return gap > 0
    ? { label: `+${formatPer90(abs)} vs pool`, tone: "up" }
    : { label: `−${formatPer90(abs)} vs pool`, tone: "down" };
}

export function PassTendencies({ player, players }: { player: PlayerProfile; players: PlayerProfile[] }) {
  const [open, setOpen] = useState(false);
  const { beginLoad, endLoad } = useLoading();

  useEffect(() => {
    setOpen(false);
  }, [player.player_id]);

  const reading = useMemo(() => {
    const pool = players.length ? players : [player];
    const longStored = storedShare(player, "pass_tendency");
    const progStored = storedShare(player, "progressive_share");
    const long = longPassShare(player);
    const progressive = progressiveShare(player);
    const longAverage =
      longStored?.pool_avg_pct ??
      mean(pool.map(longPassShare).filter((value): value is number => value != null));
    const progressiveAverage =
      progStored?.pool_avg_pct ??
      mean(pool.map(progressiveShare).filter((value): value is number => value != null));

    const rows: TendencyBarEntry[] = [];
    const chips: { key: string; title: string; player: string; pool: string; chip: ReturnType<typeof deltaChip> }[] = [];

    if (long != null && longAverage != null) {
      rows.push(
        barEntry(
          { label: "Passe curto ↔ longo", share: long, average: longAverage },
          "Parcela de passes longos no total. O meio da barra é a média da posição: à esquerda o passe é mais curto, à direita mais longo.",
          { lengthSpectrum: true },
        ),
      );
      chips.push({
        key: "long",
        title: "Passe curto ↔ longo",
        player: formatPct(long),
        pool: formatPct(longAverage),
        chip: deltaChip(long, longAverage, "pct"),
      });
    }
    if (progressive != null && progressiveAverage != null) {
      rows.push(
        barEntry(
          { label: "Passes progressivos", share: progressive, average: progressiveAverage },
          "Parcela de passes progressivos no total de passes, comparada à média da posição.",
        ),
      );
      chips.push({
        key: "prog",
        title: "Passes progressivos",
        player: formatPct(progressive),
        pool: formatPct(progressiveAverage),
        chip: deltaChip(progressive, progressiveAverage, "pct"),
      });
    }
    const crossing = crossingReading(player, pool);
    if (crossing) {
      rows.push(
        barEntry(
          { label: "Cruzamentos", share: crossing.volume, average: crossing.average },
          "Volume de cruzamentos por 90 minutos. A marca central é a média da posição nesta série.",
          { per90: true, scale: crossing.scale },
        ),
      );
      chips.push({
        key: "cross",
        title: "Cruzamentos",
        player: formatPer90(crossing.volume),
        pool: formatPer90(crossing.average),
        chip: deltaChip(crossing.volume, crossing.average, "per90"),
      });
    }
    return {
      rows,
      chips,
      verdict: long != null && longAverage != null ? passVerdict(long, longAverage) : null,
    };
  }, [player, players]);

  const openModal = () => {
    beginLoad();
    setOpen(true);
    window.setTimeout(() => endLoad(), 120);
  };

  return (
    <>
      <Tooltip content="Passe curto/long, progressivos e cruzamentos comparados à média da posição.">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={openModal}
        >
          <i className="fa-solid fa-chart-line" aria-hidden="true" /> Tendências
        </button>
      </Tooltip>
      {open ? (
        <StatWindow title="Tendências de passe" onClose={() => setOpen(false)}>
          <div className="tendency-modal">

            {reading.rows.length ? (
              <ConstructionProfileBars entries={reading.rows} embedded />
            ) : (
              <p className="pass-tendencies-note">Sem amostra de passes para esta posição.</p>
            )}

            <p className="pass-tendencies-note tendency-footnote">
              A marca central de cada barra é a média da posição nesta série. O ponto colorido é o atleta.
            </p>
          </div>
        </StatWindow>
      ) : null}
    </>
  );
}
