"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlayer } from "@/lib/api";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile } from "@/lib/types";

const cache = new Map<string, PlayerProfile>();

function profileCacheKey(playerId: string, league?: LeagueId, season?: string) {
  // player_id é posicional por temporada — a chave precisa da season, senão
  // o perfil de um ano colide com o de outro.
  return `${league ?? ""}:${season ?? ""}:${playerId}`;
}

export function usePlayerProfile(
  playerId: string | undefined,
  enabled: boolean,
  league?: LeagueId,
  season?: string,
) {
  const cacheKey = playerId ? profileCacheKey(playerId, league, season) : "";
  const [profile, setProfile] = useState<PlayerProfile | null>(
    cacheKey && cache.has(cacheKey) ? cache.get(cacheKey)! : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !playerId) {
      setProfile(null);
      return;
    }
    if (cache.has(cacheKey)) {
      setProfile(cache.get(cacheKey)!);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlayer(playerId, league, season)
      .then((data) => {
        cache.set(cacheKey, data);
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, enabled, league, season, cacheKey]);

  const prefetch = useCallback((id: string, leagueId?: LeagueId, seasonId?: string) => {
    const key = profileCacheKey(id, leagueId, seasonId);
    if (cache.has(key)) return;
    fetchPlayer(id, leagueId, seasonId).then((data) => cache.set(key, data)).catch(() => {});
  }, []);

  return { profile, loading, prefetch };
}
