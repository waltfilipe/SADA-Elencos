import { clampPercent } from "@/lib/scoutTheme";

type Props = {
  minutes: number;
  minutesPct?: number | null;
  variant?: "prominent" | "compact" | "inline";
  className?: string;
};

export function MinutesStat({ minutes, minutesPct, variant = "compact", className = "" }: Props) {
  const pctLabel =
    minutesPct != null
      ? `${minutesPct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
      : null;

  if (variant === "inline") {
    return (
      <span className={`minutes-stat is-inline ${className}`.trim()}>
        <strong>{minutes.toLocaleString("pt-BR")}</strong>
        {pctLabel ? <em>{pctLabel} do total</em> : null}
      </span>
    );
  }

  return (
    <div className={`minutes-stat is-${variant} ${className}`.trim()}>
      <span className="minutes-label">Minutos jogados</span>
      <strong className="minutes-value">{minutes.toLocaleString("pt-BR")}</strong>
      {pctLabel ? (
        <div className="minutes-meta">
          <span className="minutes-pct">
            <b>{pctLabel}</b> do total da competição
          </span>
          <div className="minutes-track" aria-hidden>
            <i style={{ width: `${clampPercent(minutesPct ?? 0)}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
