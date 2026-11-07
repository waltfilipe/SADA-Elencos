"use client";

import { RangeSlider } from "@/components/filters/RangeSlider";

export type StatFilterSpec = {
  key: string;
  min: number;
  max: number;
};

type Props = {
  stats: StatFilterSpec[];
  /** Only non-default ranges are stored. */
  ranges: Record<string, [number, number]>;
  onChange: (key: string, value: [number, number] | null) => void;
};

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function StatFilterBox({ stats, ranges, onChange }: Props) {
  const activeCount = stats.filter((stat) => ranges[stat.key]).length;

  return (
    <details className="stat-filter-box">
      <summary>
        <span>Estatísticas</span>
        <em>
          {activeCount
            ? `${activeCount} ativo${activeCount > 1 ? "s" : ""}`
            : `${stats.length} stats`}
        </em>
      </summary>
      <div className="stat-filter-list">
        {stats.map((stat) => {
          const raw = ranges[stat.key] ?? ([stat.min, stat.max] as [number, number]);
          const value: [number, number] = [
            Math.max(stat.min, Math.min(raw[0], stat.max)),
            Math.min(stat.max, Math.max(raw[1], stat.min)),
          ];
          return (
            <RangeSlider
              key={stat.key}
              label={stat.key}
              min={stat.min}
              max={stat.max}
              step={(stat.max - stat.min) / 100}
              value={value}
              format={(n) => fmt.format(n)}
              onChange={(next) =>
                onChange(
                  stat.key,
                  next[0] === stat.min && next[1] === stat.max ? null : next,
                )
              }
            />
          );
        })}
      </div>
    </details>
  );
}
