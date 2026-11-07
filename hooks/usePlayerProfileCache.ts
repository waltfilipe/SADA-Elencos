"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlayer } from "@/lib/api";
import type { LeagueId } from "@/lib/leagues";
import type { PlayerProfile } from "@/lib/types";

const cache = new Map<string, PlayerProfile>();

function profileCacheKey(playerId: string, league?: LeagueId) {
  return league ? `${league}:${playerId}` : playerId;
}

export function usePlayerProfile(playerId: string | undefined, enabled: boolean, league?: LeagueId) {
  const cacheKey = playerId ? profileCacheKey(playerId, league) : "";
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
    fetchPlayer(playerId, league)
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
  }, [playerId, enabled, league, cacheKey]);

  const prefetch = useCallback((id: string, leagueId?: LeagueId) => {
    const key = profileCacheKey(id, leagueId);
    if (cache.has(key)) return;
    fetchPlayer(id, leagueId).then((data) => cache.set(key, data)).catch(() => {});
  }, []);

  return { profile, loading, prefetch };
}
