"use client";

import { BASE_PATH } from "@/lib/paths";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeague } from "@/components/LeagueProvider";
import { usePlayerArchiveProfile } from "@/hooks/usePlayerArchiveProfile";
import type { AthleteSeasonRow } from "@/lib/athleteRows.server";
import type { PlayerProfile, PositionFamily } from "@/lib/types";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  FICHA_ORIGEM_PARAM,
  FICHA_TEMPORADA_PARAM,
  type BrasileiraoSeason,
} from "@/lib/seasons";
import { PlayerHero } from "./PlayerHero";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { StatProfileRadarCard } from "./PlayerReport";
import { ProfileRadarCard } from "./ProfileCard";
import { ScoutStatsSections } from "./ScoutStatsSections";

type Props = {
  player: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  currentPlayers?: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

export function PositionProfileView({ player, family, players, currentPlayers, heatmapsEnabled = true }: Props) {
  const { leagueId, isCurrentSeason, season: hubSeason } = useLeague();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const archive = usePlayerArchiveProfile(player, family);
  const { displayPlayer, isArchiveView, loading, setFichaSeason, goBackFicha, fichaSeason, fichaOrigem, basePlayer, archiveYears } =
    archive;

  // Linhas do atleta no registro de identidade — cobre temporadas em outras
  // ligas e atletas sem linha na temporada corrente (o fallback por
  // equivalente em currentPlayers não enxerga nenhum dos dois casos).
  const [athleteRows, setAthleteRows] = useState<AthleteSeasonRow[] | null>(null);
  useEffect(() => {
    if (isCurrentSeason || (!player.athlete_id && !player.person_key)) {
      setAthleteRows(null);
      return;
    }
    const qs = new URLSearchParams();
    if (player.athlete_id) qs.set("athlete_id", player.athlete_id);
    else qs.set("person_key", player.person_key!);
    let cancelled = false;
    fetch(`${BASE_PATH}/api/athlete-rows?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rows?: AthleteSeasonRow[] } | null) => {
        if (!cancelled) setAthleteRows(data?.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setAthleteRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isCurrentSeason, player.athlete_id, player.person_key]);

  const archiveHubSlicer = useMemo(() => {
    if (isCurrentSeason) return undefined;

    if (athleteRows?.length) {
      const rowFor = (year: string) =>
        athleteRows.find((row) => row.season === year && row.league === leagueId) ??
        athleteRows.find((row) => row.season === year);
      const years = BRASILEIRAO_SEASONS.filter((year) => rowFor(year));
      if (years.length) {
        return {
          active: hubSeason as string,
          years,
          onSelect: (year: BrasileiraoSeason) => {
            if (year === hubSeason) return;
            const row = rowFor(year);
            if (!row) return;
            const qs = row.season === CURRENT_SEASON ? "" : `&temporada=${row.season}`;
            router.push(
              `/${row.league}/posicao/${row.family ?? family}?atleta=${row.player_id}${qs}`,
            );
          },
        };
      }
    }

    const counterpart = currentPlayers?.find(
      (item) =>
        item.name === player.name &&
        (item.birth_year == null ||
          player.birth_year == null ||
          Math.abs(item.birth_year - player.birth_year) <= 1),
    );
    if (!counterpart) {
      return { active: hubSeason as string, years: [hubSeason] as BrasileiraoSeason[], onSelect: () => {} };
    }
    const years = BRASILEIRAO_SEASONS.filter(
      (year) =>
        year === CURRENT_SEASON ||
        year === hubSeason ||
        (counterpart.cross_season?.seasons.some((s) => s.year === year && s.league === leagueId) ?? false),
    );
    return {
      active: hubSeason as string,
      years,
      onSelect: (year: BrasileiraoSeason) => {
        if (year === hubSeason) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("atleta");
        params.delete(FICHA_TEMPORADA_PARAM);
        params.delete(FICHA_ORIGEM_PARAM);
        params.set("atleta_nome", player.name);
        params.set("atleta_nasc", String(player.birth_year ?? ""));
        const targetClub =
          counterpart.cross_season?.seasons.find((s) => s.year === year && s.league === leagueId)?.club ??
          player.club;
        if (targetClub) params.set("atleta_clube", targetClub);
        if (year === CURRENT_SEASON) params.delete("temporada");
        else params.set("temporada", year);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      },
    };
  }, [isCurrentSeason, currentPlayers, player, hubSeason, leagueId, searchParams, pathname, router, athleteRows, family]);

  const showHeatmap =
    heatmapsEnabled && ((isCurrentSeason && !isArchiveView) || Boolean(displayPlayer?.heatmap));

  return (
    <div
      className={[
        "profile-view-shell",
        isArchiveView ? "profile-view-shell-archive-ficha" : "",
        !isCurrentSeason ? "profile-view-shell-archive-hub" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isArchiveView ? (
        <div className="profile-archive-banner" role="status">
          <span>
            Temporada {fichaSeason} · dados históricos (não é o scout {CURRENT_SEASON})
          </span>
          <button type="button" className="profile-archive-back" onClick={goBackFicha}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar para {fichaOrigem}
          </button>
        </div>
      ) : null}
      {!isCurrentSeason ? (
        <p className="profile-archive-banner profile-archive-banner-hub" role="status">
          Hub em arquivo {hubSeason} · elenco e stats desta temporada
        </p>
      ) : null}

      <PlayerHero
        player={displayPlayer}
        family={family}
        players={players}
        scoutPlayer={basePlayer}
        isArchiveView={isArchiveView}
        fichaSeason={isArchiveView ? fichaSeason : undefined}
        similarSource={
          isArchiveView
            ? { league: archive.fichaLeague, season: fichaSeason }
            : { league: leagueId, season: hubSeason }
        }
        seasonSlicer={
          isCurrentSeason
            ? {
                active: fichaSeason,
                years: [CURRENT_SEASON, ...archiveYears],
                loading,
                onSelect: (year) => setFichaSeason(year),
              }
            : archiveHubSlicer
        }
      />

      <div className={`profile-content-grid${showHeatmap ? "" : " profile-content-grid-no-heatmap"}`}>
        {showHeatmap ? (
          <div className="profile-content-col profile-col-heatmap">
            <div className="player-card heatmap-card profile-perfil-card-score">
              <div className="profile-card-head">
                <h3 className="section-label">Mapa de calor</h3>
              </div>
              <PlayerHeatmap upright heatmap={displayPlayer.heatmap} playerName={displayPlayer.name} />
            </div>
          </div>
        ) : null}

        <div className="profile-content-col profile-col-middle">
          <ProfileRadarCard player={displayPlayer} family={family} players={players} />
        </div>

        <div className="profile-content-col profile-col-stats">
          <div className="player-card pass-scores-shell">
            <ScoutStatsSections
              player={displayPlayer}
              family={family}
              players={players}
              projectionSource={isArchiveView ? undefined : basePlayer}
              disableProjection={isArchiveView || !isCurrentSeason}
              radarView={<StatProfileRadarCard player={displayPlayer} bare />}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
