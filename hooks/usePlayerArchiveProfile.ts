"use client";

import { BASE_PATH } from "@/lib/paths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeague } from "@/components/LeagueProvider";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import {
  BRASILEIRAO_SEASONS,
  CURRENT_SEASON,
  FICHA_ORIGEM_PARAM,
  FICHA_TEMPORADA_PARAM,
  parseFichaOrigemParam,
  parseFichaSeasonParam,
} from "@/lib/seasons";
import type { BrasileiraoSeason } from "@/lib/seasons";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

export function usePlayerArchiveProfile(basePlayer: PlayerProfile, _family: PositionFamily) {
  const { leagueId, isCurrentSeason } = useLeague();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fichaSeason = parseFichaSeasonParam(searchParams.get(FICHA_TEMPORADA_PARAM));
  const fichaOrigem = parseFichaOrigemParam(searchParams.get(FICHA_ORIGEM_PARAM));
  const [archivePlayer, setArchivePlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const archiveYears = useMemo((): BrasileiraoSeason[] => {
    if (!isCurrentSeason || !basePlayer.cross_season?.seasons?.length) return [];
    const years = new Set(basePlayer.cross_season.seasons.map((s) => s.year));
    return BRASILEIRAO_SEASONS.filter(
      (y): y is BrasileiraoSeason => y !== CURRENT_SEASON && years.has(y),
    );
  }, [basePlayer.cross_season, isCurrentSeason]);

  const showSlicer = isCurrentSeason && archiveYears.length > 0;

  const fichaLeague = useMemo((): LeagueId => {
    if (!fichaSeason) return leagueId;
    const row = basePlayer.cross_season?.seasons.find((s) => s.year === fichaSeason);
    return (row?.league && isLeagueId(row.league) ? row.league : leagueId) as LeagueId;
  }, [fichaSeason, basePlayer.cross_season, leagueId]);

  useEffect(() => {
    if (!fichaSeason || !isCurrentSeason) {
      setArchivePlayer(null);
      return;
    }
    const league = fichaLeague;
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({
      league,
      season: fichaSeason,
      name: basePlayer.name,
      birth_year: String(basePlayer.birth_year ?? ""),
    });
    // Identidade persistente resolve exatamente a linha da temporada alvo —
    // cobre divergências de ano de nascimento (±2) entre arquivos Wyscout.
    if (basePlayer.athlete_id) qs.set("athlete_id", basePlayer.athlete_id);
    if (basePlayer.person_key) qs.set("person_key", basePlayer.person_key);
    const expectedClub =
      basePlayer.cross_season?.seasons.find((s) => s.year === fichaSeason && s.league === league)?.club ??
      basePlayer.club;
    if (expectedClub) qs.set("club", expectedClub);
    fetch(`${BASE_PATH}/api/player-season?${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlayerProfile | null) => {
        if (cancelled) return;
        if (data && !data.transfermarkt?.photo && basePlayer.transfermarkt?.photo) {
          const base = basePlayer.transfermarkt;
          data.transfermarkt = {
            market_value: data.transfermarkt?.market_value ?? null,
            market_value_eur: data.transfermarkt?.market_value_eur ?? null,
            contract_until: data.transfermarkt?.contract_until ?? null,
            contract_remaining: data.transfermarkt?.contract_remaining ?? null,
            club: data.transfermarkt?.club ?? null,
            photo: base.photo,
            id: base.id ?? data.transfermarkt?.id ?? null,
            profile_url: base.profile_url ?? data.transfermarkt?.profile_url ?? null,
          };
        }
        setArchivePlayer(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fichaSeason, basePlayer, leagueId, isCurrentSeason, fichaLeague]);

  const isArchiveView = Boolean(fichaSeason && archivePlayer);
  const displayPlayer = isArchiveView ? archivePlayer! : basePlayer;

  const setFichaSeason = useCallback(
    (year: BrasileiraoSeason | typeof CURRENT_SEASON) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year === CURRENT_SEASON) {
        params.delete(FICHA_TEMPORADA_PARAM);
        params.delete(FICHA_ORIGEM_PARAM);
      } else {
        params.set(FICHA_TEMPORADA_PARAM, year);
        // First archive hop records where the athlete was being viewed; further
        // year switches keep the original return target.
        if (!params.has(FICHA_ORIGEM_PARAM)) {
          params.set(FICHA_ORIGEM_PARAM, fichaSeason ?? CURRENT_SEASON);
        }
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, fichaSeason],
  );

  const goBackFicha = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(FICHA_ORIGEM_PARAM);
    if (fichaOrigem === CURRENT_SEASON) params.delete(FICHA_TEMPORADA_PARAM);
    else params.set(FICHA_TEMPORADA_PARAM, fichaOrigem);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, fichaOrigem]);

  return {
    basePlayer,
    displayPlayer,
    isArchiveView,
    fichaSeason: fichaSeason ?? CURRENT_SEASON,
    fichaOrigem,
    fichaLeague,
    archiveYears,
    showSlicer,
    loading,
    setFichaSeason,
    goBackFicha,
  };
}
