"use client";

import { useId } from "react";

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format?: (value: number) => string;
  suffix?: string;
};

export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
  suffix,
}: Props) {
  const uid = useId();
  const span = max - min || 1;
  const [low, high] = value;

  const display = (n: number) => (format ? format(n) : String(Math.round(n)));
  const pct = (n: number) => ((n - min) / span) * 100;

  const isDirty = low > min || high < max;

  return (
    <div className={`range-slider ${isDirty ? "is-dirty" : ""}`}>
      <div className="range-slider-head">
        <span id={`${uid}-label`}>{label}</span>
        <output>
          {display(low)} – {display(high)}
          {suffix && <em>{suffix}</em>}
        </output>
      </div>

      <div className="range-slider-rail">
        <span className="range-rail" />
        <span
          className="range-fill"
          style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-labelledby={`${uid}-label`}
          aria-valuetext={`mínimo ${display(low)}`}
          onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-labelledby={`${uid}-label`}
          aria-valuetext={`máximo ${display(high)}`}
          onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
        />
      </div>
    </div>
  );
}
