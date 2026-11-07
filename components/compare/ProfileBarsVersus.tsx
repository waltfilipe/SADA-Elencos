"use client";

import { clampPercent } from "@/lib/scoutTheme";
import type { AspectItem, PlayerProfile } from "@/lib/types";

function formatPct(value: number, decimals = 0): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function ShareBarRow({ label, itemA, itemB }: { label: string; itemA?: AspectItem; itemB?: AspectItem }) {
  const shareA = itemA?.share_pct ?? 0;
  const shareB = itemB?.share_pct ?? 0;
  const avgA = itemA?.pool_avg_pct ?? 0;
  const avgB = itemB?.pool_avg_pct ?? 0;
  const scale = Math.max(
    itemA?.scale_max_pct ?? itemB?.scale_max_pct ?? 40,
    shareA,
    shareB,
    avgA,
    avgB,
    1,
  );
  const posA = clampPercent((shareA / scale) * 100);
  const posB = clampPercent((shareB / scale) * 100);
  const avgPosA = clampPercent((avgA / scale) * 100);
  const avgPosB = clampPercent((avgB / scale) * 100);
  const leads = shareA === shareB ? "tie" : shareA > shareB ? "a" : "b";

  return (
    <div className={`profile-bar-versus-row leads-${leads}`}>
      <div className="profile-bar-versus-side side-a">
        <span className="profile-bar-versus-value">{itemA?.display_value ?? formatPct(shareA)}</span>
        <div className="profile-bar-versus-track" aria-hidden>
          <span className="profile-bar-versus-rail" />
          <span className="profile-bar-versus-center" style={{ left: `${avgPosA}%` }} />
          <span className="profile-bar-versus-dot" style={{ left: `${posA}%` }} />
        </div>
      </div>

      <span className="profile-bar-versus-label">{label}</span>

      <div className="profile-bar-versus-side side-b">
        <span className="profile-bar-versus-value">{itemB?.display_value ?? formatPct(shareB)}</span>
        <div className="profile-bar-versus-track" aria-hidden>
          <span className="profile-bar-versus-rail" />
          <span className="profile-bar-versus-center" style={{ left: `${avgPosB}%` }} />
          <span className="profile-bar-versus-dot" style={{ left: `${posB}%` }} />
        </div>
      </div>
    </div>
  );
}

function SpectrumBarRow({ label, itemA, itemB }: { label: string; itemA?: AspectItem; itemB?: AspectItem }) {
  const shareA = itemA?.share_pct ?? 0;
  const shareB = itemB?.share_pct ?? 0;
  const scale = Math.max(itemA?.scale_max_pct ?? itemB?.scale_max_pct ?? 100, 1);
  const fillA = clampPercent((shareA / scale) * 100);
  const fillB = clampPercent((shareB / scale) * 100);
  const leads = shareA === shareB ? "tie" : shareA > shareB ? "a" : "b";
  const leftLabel = itemA?.axis_left ?? itemB?.axis_left ?? "";
  const rightLabel = itemA?.axis_right ?? itemB?.axis_right ?? "";

  return (
    <div className={`profile-bar-versus-row spectrum leads-${leads}`}>
      <div className="profile-bar-versus-side side-a">
        <div className="spectrum-fill-wrap" aria-hidden>
          <div className="spectrum-fill-track">
            <span className="spectrum-fill-progress side-a-fill" style={{ width: `${fillA}%` }} />
          </div>
        </div>
        <div className="spectrum-fill-foot">
          <span className={fillA < 50 ? "is-active" : ""}>{leftLabel}</span>
          <span className={fillA >= 50 ? "is-active" : ""}>{rightLabel}</span>
        </div>
      </div>

      <span className="profile-bar-versus-label">{label}</span>

      <div className="profile-bar-versus-side side-b">
        <div className="spectrum-fill-wrap" aria-hidden>
          <div className="spectrum-fill-track">
            <span className="spectrum-fill-progress side-b-fill" style={{ width: `${fillB}%` }} />
          </div>
        </div>
        <div className="spectrum-fill-foot">
          <span className={fillB < 50 ? "is-active" : ""}>{leftLabel}</span>
          <span className={fillB >= 50 ? "is-active" : ""}>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

function matchByLabel(itemsA: AspectItem[] | undefined, itemsB: AspectItem[] | undefined) {
  const mapB = new Map((itemsB ?? []).map((item) => [item.label, item]));
  const labels = new Set([...(itemsA ?? []).map((item) => item.label), ...(itemsB ?? []).map((item) => item.label)]);

  return [...labels].map((label) => ({
    label,
    itemA: (itemsA ?? []).find((item) => item.label === label),
    itemB: mapB.get(label),
  }));
}

type Props = {
  title: string;
  a: PlayerProfile;
  b: PlayerProfile;
  aspectKey: "perfil_construcao" | "perfil_defensivo";
};

export function ProfileBarsVersus({ title, a, b, aspectKey }: Props) {
  const rows = matchByLabel(a.aspects[aspectKey], b.aspects[aspectKey]);
  if (!rows.length) return null;

  return (
    <article className="profile-bars-versus-group">
      <h3>{title}</h3>
      <div className="profile-bars-versus-stack">
        {rows.map(({ label, itemA, itemB }) =>
          itemA?.bar_key || itemB?.bar_key ? (
            <SpectrumBarRow key={label} label={label} itemA={itemA} itemB={itemB} />
          ) : (
            <ShareBarRow key={label} label={label} itemA={itemA} itemB={itemB} />
          ),
        )}
      </div>
    </article>
  );
}
