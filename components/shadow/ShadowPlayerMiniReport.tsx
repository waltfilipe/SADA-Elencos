"use client";

import { useEffect, useMemo, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { Tooltip } from "@/components/ui/Tooltip";
import { SectionRadar, statProfileScores, type SectionScore } from "@/components/position/profile/PlayerReport";
import { usePlayerProfile } from "@/hooks/usePlayerProfileCache";
import { formatFoot } from "@/lib/feet";
import { BASE_PATH } from "@/lib/paths";
import { profileAccent, sortedProfileShareRows } from "@/lib/profileShares";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerSearchRow, PositionFamily } from "@/lib/types";

type PositionViewPayload = {
  statScores: SectionScore[];
  profileScores: SectionScore[];
  estimatedProfile: string | null;
  coverage: number;
};

const numberFormat = new Intl.NumberFormat("pt-BR");

function monthsRemaining(iso?: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month) return "—";
  const end = new Date(year, month - 1, day || 1);
  const now = new Date();
  let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end.getDate() < now.getDate()) months -= 1;
  if (months < 0) return "Expirado";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function formatDominantFoot(foot: string | null | undefined): string {
  return formatFoot(foot) ?? "—";
}

function CompareColumn({ title, player }: { title: string; player: PlayerSearchRow | null }) {
  return (
    <div className="shadow-mini-compare-col">
      <span className="shadow-mini-report-section-label">{title}</span>
      {player ? (
        <>
          <strong className="shadow-mini-compare-name">{player.name}</strong>
          <span className="shadow-mini-compare-meta">{player.profile}</span>
          <span className="shadow-mini-compare-foot">
            {numberFormat.format(player.minutes)} min · Pé {formatDominantFoot(player.foot)}
          </span>
        </>
      ) : (
        <span className="shadow-mini-compare-empty">Sem titular nesta vaga</span>
      )}
    </div>
  );
}

/** Tooltip do atleta no campinho: infos gerais + radar de perfil e radar estatístico (sem notas/letras). */
export function ShadowPlayerMiniReport({
  player,
  compareWith,
  compareLabel = "Time sombra",
  profileLeague,
  viewAs,
  viewAsLabel,
}: {
  player: PlayerSearchRow;
  /** Titular do outro time na mesma vaga (usado no time próprio). */
  compareWith?: PlayerSearchRow | null;
  compareLabel?: string;
  profileLeague?: LeagueId;
  /** Família primária do slot — diferente da do atleta, os radares são
   *  recalculados na pool dela ("como ponta" para um lateral, por ex.). */
  viewAs?: PositionFamily;
  viewAsLabel?: string;
}) {
  const league = profileLeague ?? player.sourceLeague;
  const { profile, loading } = usePlayerProfile(player.player_id, true, league);
  const tm = player.transfermarkt ?? profile?.transfermarkt;

  const translated = Boolean(viewAs && viewAs !== player.position_family);
  const [view, setView] = useState<PositionViewPayload | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  useEffect(() => {
    if (!translated || !viewAs) {
      setView(null);
      setViewLoading(false);
      return;
    }
    let cancelled = false;
    setView(null);
    setViewLoading(true);
    fetch(
      `${BASE_PATH}/api/position-view?playerId=${encodeURIComponent(player.player_id)}&family=${viewAs}${league ? `&league=${league}` : ""}`,
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("position_view_failed"))))
      .then((data: PositionViewPayload) => {
        if (!cancelled) {
          setView(data);
          setViewLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setViewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [translated, viewAs, player.player_id, league]);

  const profileScores = useMemo<SectionScore[]>(() => {
    if (translated) return view?.profileScores ?? [];
    if (!profile) return [];
    return sortedProfileShareRows(profile).map((row) => ({
      title: row.label,
      tone: row.tone,
      score: Math.round(row.share),
      color: profileAccent(row.label),
      display: `${Math.round(row.share)}%`,
    }));
  }, [translated, view, profile]);
  const statScores = useMemo<SectionScore[]>(
    () => (translated ? (view?.statScores ?? []) : profile ? statProfileScores(profile) : []),
    [translated, view, profile],
  );

  const birthYear = player.birth_year ?? profile?.birth_year;
  const height = player.height ?? profile?.height;
  const facts = [
    { label: "Minutos", value: numberFormat.format(player.minutes) },
    { label: "Idade", value: birthYear ? `${new Date().getFullYear() - birthYear} anos` : "—" },
    { label: "Altura", value: height ? `${(height / 100).toFixed(2).replace(".", ",")} m` : "—" },
    { label: "Pé", value: formatDominantFoot(player.foot ?? profile?.foot) },
    { label: "Contrato", value: monthsRemaining(tm?.contract_until) },
    { label: "Valor", value: tm?.market_value ?? "—" },
  ];

  return (
    <div className="shadow-mini-report">
      <div className="shadow-mini-report-head">
        <strong>{player.name}</strong>
        <span className="shadow-mini-report-club">
          <ClubLogo club={player.club} size={14} />
          {player.club} · {player.position}
          {player.profile ? <em> · {player.profile}</em> : null}
        </span>
      </div>

      <dl className="shadow-mini-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {profileScores.length >= 3 || statScores.length >= 3 ? (
        <div className="shadow-mini-radars stat-radar-card">
          {profileScores.length >= 3 ? (
            <figure>
              <figcaption className="shadow-mini-report-section-label">
                Perfil{translated && viewAsLabel ? ` · como ${viewAsLabel}` : ""}
              </figcaption>
              <SectionRadar scores={profileScores} variant="screen" shape="sectors" />
            </figure>
          ) : null}
          {statScores.length >= 3 ? (
            <figure>
              <figcaption className="shadow-mini-report-section-label">
                Perfil estatístico{translated && viewAsLabel ? ` · como ${viewAsLabel}` : ""}
              </figcaption>
              <SectionRadar scores={statScores} variant="screen" />
            </figure>
          ) : null}
        </div>
      ) : null}

      {compareWith !== undefined ? (
        <div className="shadow-mini-compare">
          <CompareColumn title="Time próprio" player={player} />
          <CompareColumn title={compareLabel} player={compareWith} />
        </div>
      ) : null}

      {loading || viewLoading ? (
        <p className="shadow-mini-report-loading">Carregando radares…</p>
      ) : null}
    </div>
  );
}

export function ShadowPlayerTooltip({
  player,
  children,
  block,
  compareWith,
  profileLeague,
  viewAs,
  viewAsLabel,
}: {
  player: PlayerSearchRow;
  children: React.ReactNode;
  block?: boolean;
  compareWith?: PlayerSearchRow | null;
  profileLeague?: LeagueId;
  viewAs?: PositionFamily;
  viewAsLabel?: string;
}) {
  return (
    <Tooltip
      content={
        <ShadowPlayerMiniReport
          player={player}
          compareWith={compareWith}
          profileLeague={profileLeague}
          viewAs={viewAs}
          viewAsLabel={viewAsLabel}
        />
      }
      block={block}
    >
      {children}
    </Tooltip>
  );
}
