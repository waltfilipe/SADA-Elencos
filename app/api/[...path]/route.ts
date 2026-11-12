import { NextResponse } from "next/server";
import {
  filterPlayers,
  getFamilyPlayers,
  getMeta,
  getPlayerProfile,
  getPlayers,
  getSearchRows,
  getSquadRows,
  getStandings,
} from "@/lib/data.server";
import { getAveragePlayers } from "@/lib/avgPlayer.server";
import { positionViewFor } from "@/lib/positionTranslate.server";
import { athleteSeasonRows } from "@/lib/athleteRows.server";
import { findPlayerInSeason } from "@/lib/playerSeasonMatch.server";
import { rankCrossLeagueSimilarity } from "@/lib/crossLeagueSimilarity";
import { isLeagueId, type LeagueId } from "@/lib/leagues";
import { isShadowScope, readCloudShadow, shadowSyncEnabled, writeCloudShadow } from "@/lib/shadowSync.server";
import type { ShadowTeamState } from "@/lib/shadowTeamStorage";
import { ESTADUAIS_LEAGUE_IDS } from "@/lib/estaduaisHub";
import { CURRENT_SEASON, parseSeasonParam } from "@/lib/seasons";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

type Params = { params: Promise<{ path: string[] }> };

/** Past seasons only change on deploy (which purges the CDN), so let Vercel's edge cache them. */
function archiveCacheHeaders(season: string | null | undefined): HeadersInit | undefined {
  if (parseSeasonParam(season) === CURRENT_SEASON) return undefined;
  return { "Cache-Control": "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400" };
}

/**
 * One route handler for every JSON API. Each `route.ts` is its own serverless
 * function when the traced bundle cannot be shared, and Hobby allows 12.
 */
export async function GET(request: Request, { params }: Params) {
  const { path } = await params;
  const url = new URL(request.url);
  const [resource, id] = path;

  if (resource === "shadow" && path.length === 2) {
    // Time sombra compartilhado entre os apps SADA (ver lib/shadowSync.server).
    if (!isShadowScope(id)) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
    const state = await readCloudShadow(id);
    return NextResponse.json(
      { enabled: shadowSyncEnabled(), state },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (resource === "meta" && path.length === 1) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    return NextResponse.json(getMeta(league, season));
  }

  if (resource === "players" && path.length === 1) {
    return NextResponse.json(listPlayers(url));
  }

  if (resource === "players" && path.length === 2) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    const profile = getPlayerProfile(id, league, season);
    if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(profile);
  }

  if (resource === "families" && path.length === 2) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    const players = getFamilyPlayers(id as PositionFamily, league, season);
    return NextResponse.json(
      { family: id, players, total: players.length },
      { headers: archiveCacheHeaders(season) },
    );
  }

  if (resource === "search-rows" && path.length === 1) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    try {
      const players = url.searchParams.get("slim") ? getSquadRows(league, season) : getSearchRows(league, season);
      return NextResponse.json(
        { players, total: players.length },
        { headers: archiveCacheHeaders(season) },
      );
    } catch {
      // Missing archive slice (ex.: liga sem a temporada) — same contract as `families`.
      return NextResponse.json({ players: [], total: 0 });
    }
  }

  if (resource === "standings" && path.length === 1) {
    const league = url.searchParams.get("league") ?? undefined;
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada") ?? undefined;
    return NextResponse.json(
      { clubs: getStandings(league, season) },
      { headers: archiveCacheHeaders(season) },
    );
  }

  if (resource === "avg-player" && path.length === 1) {
    const league = url.searchParams.get("league");
    const family = url.searchParams.get("family");
    const profile = url.searchParams.get("profile");
    const payload = getAveragePlayers(league, family);
    if (!payload) return NextResponse.json({ error: "invalid_family" }, { status: 400 });
    // O médio acumula todas as temporadas — estático por deploy, como os arquivos.
    const headers = {
      "Cache-Control": "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400",
    };
    if (profile) {
      const variants = payload.players.filter((item) => !item.player_id.endsWith("-todos"));
      const player = variants.find(
        (item) =>
          item.profile.toLowerCase() === profile.toLowerCase() ||
          item.player_id === `media-${payload.league}-${payload.family}-${profile}`,
      );
      if (!player) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ player }, { headers });
    }
    return NextResponse.json(payload, { headers });
  }

  if (resource === "scatter" && path.length === 2) {
    return NextResponse.json(scatterPayload(url, id));
  }

  if (resource === "similar" && path.length === 1) {
    return similarPayload(url);
  }

  if (resource === "position-view" && path.length === 1) {
    // "Tradução de posição": percentis do atleta dentro da pool de outra
    // família posicional da mesma liga (ex.: lateral escalado de ponta).
    const league = url.searchParams.get("league") ?? undefined;
    const playerId = url.searchParams.get("playerId");
    const family = url.searchParams.get("family") as PositionFamily | null;
    if (!playerId || !family) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }
    const view = positionViewFor(playerId, league as LeagueId | undefined, family);
    if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(view);
  }

  if (resource === "player-season" && path.length === 1) {
    const league = url.searchParams.get("league");
    const season = url.searchParams.get("season") ?? url.searchParams.get("temporada");
    const name = url.searchParams.get("name");
    const birthRaw = url.searchParams.get("birth_year");
    if (!league || !season || !name || !isLeagueId(league)) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }
    const birth = birthRaw ? Number(birthRaw) : null;
    const hit = findPlayerInSeason(
      league,
      season,
      name,
      Number.isFinite(birth) ? birth : null,
      url.searchParams.get("club"),
      {
        athleteId: url.searchParams.get("athlete_id"),
        personKey: url.searchParams.get("person_key"),
      },
    );
    if (!hit) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(hit, { headers: archiveCacheHeaders(season) });
  }

  if (resource === "athlete-rows" && path.length === 1) {
    const athleteId = url.searchParams.get("athlete_id");
    const personKey = url.searchParams.get("person_key");
    const league = url.searchParams.get("league");
    const season = url.searchParams.get("season");
    const playerId = url.searchParams.get("player_id");
    if (!athleteId && !personKey && !(league && season && playerId)) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }
    const rows = athleteSeasonRows({ athleteId, personKey, league, season, playerId });
    return NextResponse.json({ rows });
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** PUT /api/shadow/{scope} — grava o estado do time sombra compartilhado. */
export async function PUT(request: Request, { params }: Params) {
  const { path } = await params;
  const [resource, id] = path;

  if (resource !== "shadow" || path.length !== 2 || !isShadowScope(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!shadowSyncEnabled()) {
    return NextResponse.json({ enabled: false, saved: false }, { status: 503 });
  }
  let state: ShadowTeamState;
  try {
    state = (await request.json()) as ShadowTeamState;
    if (!state || typeof state.formationId !== "string" || !Array.isArray(state.squadIds)) {
      return NextResponse.json({ error: "invalid_state" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const saved = await writeCloudShadow(id, state);
  return NextResponse.json({ enabled: true, saved });
}

function listPlayers(url: URL) {
  const params = url.searchParams;
  const league = params.get("league") ?? undefined;
  const season = params.get("season") ?? params.get("temporada") ?? undefined;
  const family = params.get("family") as PositionFamily | null;
  const players = filterPlayers(
    getPlayers(league, season),
    {
      family: family ?? undefined,
      club: params.get("club") ?? undefined,
      nationality: params.get("nationality") ?? undefined,
      foot: params.get("foot") ?? undefined,
      search: params.get("search") ?? undefined,
      height: readRange(params, "height"),
      minutes: readRange(params, "minutes"),
      birthYear: readRange(params, "birth"),
      rating: readRange(params, "rating"),
    },
    league,
    season,
  );
  return { players, total: players.length };
}

function scatterPayload(url: URL, family: string) {
  const xKey = url.searchParams.get("x") ?? "intervencoes";
  const yKey = url.searchParams.get("y") ?? "confrontos_of";
  const playerA = url.searchParams.get("a");
  const playerB = url.searchParams.get("b");
  const players = getFamilyPlayers(family as PositionFamily);
  const points = players.map((player) => ({
    player_id: player.player_id,
    label: player.label,
    x: player.scatter[xKey] ?? 0,
    y: player.scatter[yKey] ?? 0,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const avgX = xs.reduce((sum, value) => sum + value, 0) / (xs.length || 1);
  const avgY = ys.reduce((sum, value) => sum + value, 0) / (ys.length || 1);
  return {
    family,
    xKey,
    yKey,
    avgX,
    avgY,
    points,
    highlightA: playerA,
    highlightB: playerB,
  };
}

function similarPayload(url: URL) {
  const fromLeague = url.searchParams.get("from");
  const toLeague = url.searchParams.get("to");
  const playerId = url.searchParams.get("playerId");
  const family = url.searchParams.get("family") as PositionFamily | null;
  const limitRaw = url.searchParams.get("limit");
  const season = url.searchParams.get("season") ?? url.searchParams.get("temporada");

  if (!fromLeague || !toLeague || !playerId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!isLeagueId(fromLeague) || (toLeague !== "estaduais" && !isLeagueId(toLeague))) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 });
  }

  const source = getPlayerProfile(playerId, fromLeague, season ? parseSeasonParam(season) : undefined);
  if (!source) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const positionFamily = family ?? source.position_family;
  const targets: LeagueId[] = toLeague === "estaduais" ? [...ESTADUAIS_LEAGUE_IDS] : [toLeague as LeagueId];
  const leagueByPlayer = new Map<PlayerProfile, LeagueId>();
  const targetPool: PlayerProfile[] = [];
  for (const league of targets) {
    for (const pooled of getFamilyPlayers(positionFamily, league)) {
      leagueByPlayer.set(pooled, league);
      targetPool.push(pooled);
    }
  }
  const limit = limitRaw ? Math.min(20, Math.max(1, Number(limitRaw))) : 5;
  const metricLabels = url.searchParams
    .get("metrics")
    ?.split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  const matches = rankCrossLeagueSimilarity(source, targetPool, {
    limit,
    targetFamily: positionFamily,
    leagueOf: (p) => leagueByPlayer.get(p),
    sourcePool: getFamilyPlayers(positionFamily, fromLeague, parseSeasonParam(season)),
    debug: url.searchParams.get("debug") === "1",
    metricLabels: metricLabels?.length ? metricLabels : undefined,
  }).map((hit) => ({
    ...hit,
    photo:
      getPlayerProfile(hit.player_id, hit.league ?? (toLeague === "estaduais" ? undefined : toLeague))
        ?.transfermarkt?.photo ?? null,
  }));

  return NextResponse.json({
    from: fromLeague,
    to: toLeague,
    player_id: playerId,
    family: positionFamily,
    matches,
  });
}

function readRange(params: URLSearchParams, prefix: string): [number, number] | undefined {
  const min = params.get(`${prefix}_min`);
  const max = params.get(`${prefix}_max`);
  if (min == null || max == null) return undefined;
  return [Number(min), Number(max)];
}
