"use client";

import { useEffect, useState } from "react";
import { fetchFamily } from "@/lib/api";
import type { LeagueId } from "@/lib/leagues";
import { buildSectionGradeLookup, type SectionGradeLookup } from "@/lib/sectionGrades";
import type { PositionFamily } from "@/lib/types";

const cache = new Map<string, SectionGradeLookup>();

function cacheKey(family: PositionFamily, league?: LeagueId) {
  return `${league ?? "default"}:${family}`;
}

export function useFamilyGradeLookup(
  family: PositionFamily | undefined,
  enabled: boolean,
  league?: LeagueId,
) {
  const key = family ? cacheKey(family, league) : "";
  const [lookup, setLookup] = useState<SectionGradeLookup | null>(
    key && cache.has(key) ? cache.get(key)! : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !family) {
      setLookup(null);
      return;
    }
    const ck = cacheKey(family, league);
    if (cache.has(ck)) {
      setLookup(cache.get(ck)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchFamily(family, league)
      .then((data) => {
        const built = buildSectionGradeLookup(data.players ?? [], family);
        cache.set(ck, built);
        if (!cancelled) setLookup(built);
      })
      .catch(() => {
        if (!cancelled) setLookup(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [family, enabled, league]);

  return { lookup, loading };
}
