"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PositionFamilyTabs } from "@/components/PositionFamilyTabs";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { FICHA_ORIGEM_PARAM, FICHA_TEMPORADA_PARAM } from "@/lib/seasons";
import { BadgeFilterBox } from "@/components/filters/BadgeFilterBox";
import { PositionProfileView } from "@/components/position/profile/PositionProfileView";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { archetypesForFamily } from "@/lib/clusterMeta";
import { useLeague } from "@/components/LeagueProvider";
import { markFiltersReturn } from "@/lib/filterSession";
import { formatFoot } from "@/lib/feet";
import { familyBySlug } from "@/lib/positions";
import { playerInitials } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { badgeCatalogForFamily, playerStatBadges } from "@/lib/statBadges";
import {
  playerMatchesFlankSide,
  supportsFlankSideFilter,
  type FlankSide,
} from "@/lib/playerSideFilter";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();

const AGE_BANDS = [
  { value: "u21", label: "Até 21", min: 0, max: 21 },
  { value: "22-25", label: "22–25", min: 22, max: 25 },
  { value: "26-29", label: "26–29", min: 26, max: 29 },
  { value: "30+", label: "30+", min: 30, max: 200 },
];

const MINUTES_BANDS: { value: string; label: string; min?: number; max?: number }[] = [
  { value: "30", label: "Até 30%", max: 30 },
  { value: "50", label: "Até 50%", max: 50 },
  { value: "75", label: "Até 75%", max: 75 },
  { value: "75+", label: "75% ou mais", min: 75 },
];

function ageOf(player: PlayerProfile): number | null {
  return player.birth_year ? CURRENT_YEAR - player.birth_year : null;
}

type Props = {
  family: PositionFamily;
  players: PlayerProfile[];
  heatmapsEnabled?: boolean;
};

const NO_PLAYERS: PlayerProfile[] = [];

type ArchiveRoster = { key: string; players: PlayerProfile[]; failed: boolean };

const subscribeNoop = () => () => {};
const isClient = () => true;
const isServer = () => false;

export function PositionScoutPage({ family, players: initialPlayers, heatmapsEnabled = true }: Props) {
  const { leagueId, href, season, isCurrentSeason, name: leagueName } = useLeague();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Static page props always hold the current season, and the server render cannot see
  // ?temporada. The roster is therefore only shown after hydration: the current season
  // uses the static props, past seasons are fetched once per league/family/season and are
  // not reset when a navigation re-sends the static props.
  const hydrated = useSyncExternalStore(subscribeNoop, isClient, isServer);
  const seasonKey = `${leagueId}:${family}:${season}`;
  const [archiveRoster, setArchiveRoster] = useState<ArchiveRoster | null>(null);
  const archiveReady = archiveRoster?.key === seasonKey;
  const archiveFailed = archiveReady && archiveRoster!.failed;
  const seasonLoading = !hydrated || (!isCurrentSeason && !archiveReady);
  const players = useMemo(() => {
    if (!hydrated) return NO_PLAYERS;
    if (isCurrentSeason) return initialPlayers;
    return archiveReady ? archiveRoster!.players : NO_PLAYERS;
  }, [hydrated, isCurrentSeason, initialPlayers, archiveReady, archiveRoster]);

  useEffect(() => {
    if (isCurrentSeason || archiveReady) return;
    let cancelled = false;
    const url = `/api/families/${family}?league=${leagueId}&season=${season}`;
    const load = (attempt: number): Promise<PlayerProfile[]> =>
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`season_fetch_${res.status}`))))
        .then((payload: { players?: PlayerProfile[] }) => payload.players ?? [])
        .catch((error) => {
          if (cancelled || attempt >= 2) throw error;
          return new Promise<PlayerProfile[]>((resolve) => setTimeout(resolve, 800 * (attempt + 1))).then(() =>
            load(attempt + 1),
          );
        });
    load(0)
      .then((roster) => {
        if (!cancelled) setArchiveRoster({ key: seasonKey, players: roster, failed: false });
      })
      .catch(() => {
        if (!cancelled) setArchiveRoster({ key: seasonKey, players: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [family, leagueId, season, seasonKey, isCurrentSeason, archiveReady]);
  const requestedId = useMemo(() => {
    const id = searchParams.get("atleta");
    if (id && players.some((player) => player.player_id === id)) return id;
    const name = searchParams.get("atleta_nome");
    if (name) {
      const nasc = Number(searchParams.get("atleta_nasc"));
      const expectedClub = searchParams.get("atleta_clube");
      const candidates = players.filter((player) => player.name === name);
      const pool = expectedClub ? candidates.filter((p) => p.club === expectedClub) : [];
      const match =
        pool[0] ??
        candidates.find(
          (player) =>
            player.birth_year == null || !Number.isFinite(nasc) || Math.abs(player.birth_year - nasc) <= 1,
        ) ??
        (candidates.length === 1 ? candidates[0] : undefined);
      if (match) return match.player_id;
    }
    return id;
  }, [searchParams, players]);
  const fromFilters = searchParams.get("origem") === "filtros";
  const familyMeta = familyBySlug(family);
  const archetypes = useMemo(() => archetypesForFamily(family), [family]);

  const badgeOptions = useMemo(() => badgeCatalogForFamily(family), [family]);
  const badgesById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const player of players) {
      map.set(player.player_id, playerStatBadges(player).map((badge) => badge.key));
    }
    return map;
  }, [players]);

  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [minutesBand, setMinutesBand] = useState<string | null>(null);
  const [foot, setFoot] = useState<string | null>(null);
  const [origin, setOrigin] = useState<"br" | "out" | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [flankSide, setFlankSide] = useState<FlankSide | null>(null);
  const showFlankFilter = supportsFlankSideFilter(family);
  const [selectedId, setSelectedId] = useState(
    () => (requestedId && players.some((player) => player.player_id === requestedId) ? requestedId : ""),
  );

  const clubs = useMemo(() => {
    const set = new Set(players.map((player) => player.club));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [players]);

  const feet = useMemo(() => {
    const set = new Set<string>();
    for (const player of players) {
      const value = formatFoot(player.foot);
      if (value) set.add(value);
    }
    return [...set];
  }, [players]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const age = AGE_BANDS.find((band) => band.value === ageBand);
    const minutes = MINUTES_BANDS.find((band) => band.value === minutesBand);

    return players
      .filter((player) => {
        if (profile && player.profile !== profile && player.cluster?.archetype !== profile) return false;
        if (badges.length) {
          const earned = badgesById.get(player.player_id) ?? [];
          if (!badges.every((key) => earned.includes(key))) return false;
        }
        if (club && player.club !== club) return false;
        if (foot && formatFoot(player.foot) !== foot) return false;
        if (flankSide && !playerMatchesFlankSide(player, flankSide)) return false;
        if (origin === "br" && player.nationality !== "Brazil") return false;
        if (origin === "out" && player.nationality === "Brazil") return false;
        if (age) {
          const years = ageOf(player);
          if (years == null || years < age.min || years > age.max) return false;
        }
        if (minutes) {
          const share = player.minutes_pct;
          if (share == null) return false;
          if (minutes.max != null && share > minutes.max) return false;
          if (minutes.min != null && share < minutes.min) return false;
        }
        if (!q) return true;
        return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
      })
      .sort((a, b) => positionRating(b) - positionRating(a));
  }, [players, profile, badges, badgesById, club, foot, flankSide, origin, ageBand, minutesBand, query]);

  const filterKey = `${profile ?? ""}|${badges.join(",")}|${club ?? ""}|${foot ?? ""}|${flankSide ?? ""}|${origin ?? ""}|${ageBand ?? ""}|${minutesBand ?? ""}`;
  const initialFilter = useRef(true);

  useEffect(() => {
    if (initialFilter.current) {
      initialFilter.current = false;
      if (requestedId && visible.some((player) => player.player_id === requestedId)) return;
    }
    if (!visible.length) return;
    setSelectedId(visible[0]!.player_id);
    // Search typing should not jump the selection; filters do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    if (requestedId && players.some((player) => player.player_id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [requestedId, players]);

  useEffect(() => {
    if (!visible.length) return;
    if (visible.some((player) => player.player_id === selectedId)) return;
    const requested = requestedId && visible.some((player) => player.player_id === requestedId);
    setSelectedId(requested ? requestedId : visible[0]!.player_id);
  }, [visible, selectedId, requestedId]);

  // After a season/ficha hop the requested athlete may be hidden by the active
  // filters — drop the filters so the athlete stays selected instead of
  // resetting to the first filtered row. The flag waits for the roster to
  // settle (archive rosters load async) and resolves against the fresh
  // requestedId so the target season's player_id is the one checked.
  const fichaSeasonParam = searchParams.get(FICHA_TEMPORADA_PARAM);
  const navSig = `${season}|${fichaSeasonParam ?? ""}`;
  const [lastNavSig, setLastNavSig] = useState(navSig);
  const pendingNav = useRef(false);
  useEffect(() => {
    if (navSig === lastNavSig) return;
    setLastNavSig(navSig);
    pendingNav.current = true;
  }, [navSig, lastNavSig]);

  useEffect(() => {
    if (!pendingNav.current || !players.length) return;
    pendingNav.current = false;
    if (!requestedId || !players.some((player) => player.player_id === requestedId)) return;
    if (visible.some((player) => player.player_id === requestedId)) return;
    clearAll();
    setSelectedId(requestedId);
  }, [players, visible, requestedId, navSig]);

  const selected = players.find((player) => player.player_id === selectedId) ?? visible[0] ?? null;

  function toggleBadge(key: string) {
    setBadges((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function clearAll() {
    setQuery("");
    setProfile(null);
    setBadges([]);
    setAgeBand(null);
    setMinutesBand(null);
    setFoot(null);
    setOrigin(null);
    setClub(null);
    setFlankSide(null);
  }

  useEffect(() => {
    if (!showFlankFilter) setFlankSide(null);
  }, [showFlankFilter, family]);

  const panelCount =
    (profile ? 1 : 0) +
    badges.length +
    (ageBand ? 1 : 0) +
    (minutesBand ? 1 : 0) +
    (foot ? 1 : 0) +
    (origin ? 1 : 0) +
    (club ? 1 : 0) +
    (flankSide ? 1 : 0);
  const activeCount = panelCount + (query.trim() ? 1 : 0);

  return (
    <div
      className={[
        leagueId === "serie-a" ? "scout-root zag-v2" : `scout-root zag-v2 league-${leagueId}`,
        !isCurrentSeason ? "zag-v2-hub-archive" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ScoutTopbar
        active="posicoes"
        subnav={<PositionFamilyTabs active={family} hrefFor={(slug) => href(`/posicao/${slug}`)} />}
      />

      <div className="zag-v2-frame">
        <header className="zag-v2-title-card">
          <div>
            <p className="zag-v2-kicker">
              {leagueName} · {season}
              {seasonLoading ? " · carregando…" : ""}
            </p>
            <h1>
              {familyMeta.label}
              {!seasonLoading ? <span className="zag-v2-title-count tabular">{players.length} atletas</span> : null}
            </h1>
            {!isCurrentSeason ? (
              <p className="zag-v2-archive-notice">
                Arquivo {season} · {leagueName}. Volte ao hub para scout {season === "2026" ? "" : "2026"}.
              </p>
            ) : null}
          </div>
          <div className="zag-v2-title-actions">
            {fromFilters ? (
              <button
                type="button"
                onClick={() => {
                  markFiltersReturn(leagueId);
                  router.push(href("/filtros"));
                }}
              >
                Voltar aos filtros
              </button>
            ) : null}
            <button type="button" onClick={clearAll} disabled={!activeCount}>
              Limpar filtros
            </button>
          </div>
        </header>
        <div className="zag-v2-shell">
          <aside className="zag-v2-rail">
            <label className="zag-v2-search">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder="Nome ou clube"
                aria-label="Buscar atleta"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <details className="zag-v2-filters">
              <summary>
                <span>
                  <i className="fa-solid fa-sliders" aria-hidden="true" />
                  Filtros
                  {panelCount ? <em className="zag-v2-filters-count">{panelCount}</em> : null}
                </span>
                <i className="fa-solid fa-chevron-down zag-v2-filters-chevron" aria-hidden="true" />
              </summary>
              <div className="zag-v2-filters-body">
                <section>
                  <h2>Perfil</h2>
                  <div className="zag-v2-chips">
                    <button type="button" className={!profile ? "active" : ""} onClick={() => setProfile(null)}>
                      Todos
                    </button>
                    {archetypes.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={profile === item ? "active" : ""}
                        onClick={() => setProfile(profile === item ? null : item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h2>Selos</h2>
                  <BadgeFilterBox inline options={badgeOptions} selected={badges} onToggle={toggleBadge} />
                  <p className="zag-v2-note">Quem tem todos os badges marcados.</p>
                </section>

                <div className="zag-v2-pairs">
                  <section>
                    <h2>Idade</h2>
                    <div className="zag-v2-chips">
                      {AGE_BANDS.map((band) => (
                        <button
                          key={band.value}
                          type="button"
                          className={ageBand === band.value ? "active" : ""}
                          onClick={() => setAgeBand(ageBand === band.value ? null : band.value)}
                        >
                          {band.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h2>Minutagem</h2>
                    <div className="zag-v2-chips">
                      {MINUTES_BANDS.map((band) => (
                        <button
                          key={band.value}
                          type="button"
                          className={minutesBand === band.value ? "active" : ""}
                          onClick={() => setMinutesBand(minutesBand === band.value ? null : band.value)}
                        >
                          {band.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>

                {showFlankFilter ? (
                  <section>
                    <h2>Lado</h2>
                    <div className="zag-v2-chips">
                      <button type="button" className={!flankSide ? "active" : ""} onClick={() => setFlankSide(null)}>
                        Ambos
                      </button>
                      <button
                        type="button"
                        className={flankSide === "esquerdo" ? "active" : ""}
                        onClick={() => setFlankSide(flankSide === "esquerdo" ? null : "esquerdo")}
                      >
                        Esquerdo
                      </button>
                      <button
                        type="button"
                        className={flankSide === "direito" ? "active" : ""}
                        onClick={() => setFlankSide(flankSide === "direito" ? null : "direito")}
                      >
                        Direito
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="zag-v2-selects">
                  <label>
                    Pé
                    <select value={foot ?? ""} onChange={(event) => setFoot(event.target.value || null)}>
                      <option value="">Todos</option>
                      {feet.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Origem
                    <select
                      value={origin ?? ""}
                      onChange={(event) => setOrigin((event.target.value || null) as "br" | "out" | null)}
                    >
                      <option value="">Todas</option>
                      <option value="br">Brasileiros</option>
                      <option value="out">Estrangeiros</option>
                    </select>
                  </label>
                  <label>
                    Clube
                    <select value={club ?? ""} onChange={(event) => setClub(event.target.value || null)}>
                      <option value="">Todos</option>
                      {clubs.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              </div>
            </details>

            <p className="zag-v2-count tabular">
              <strong>{visible.length}</strong> de {players.length}
            </p>

            <ul className="zag-v2-list">
              {visible.map((player, index) => {
                const photo = player.transfermarkt?.photo;
                const active = player.player_id === selected?.player_id;
                return (
                  <li key={player.player_id}>
                    <button
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => {
                        setSelectedId(player.player_id);
                        if (!searchParams.has(FICHA_TEMPORADA_PARAM)) return;
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete(FICHA_TEMPORADA_PARAM);
                        params.delete(FICHA_ORIGEM_PARAM);
                        const qs = params.toString();
                        router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, {
                          scroll: false,
                        });
                      }}
                    >
                      <span className="zag-v2-rank tabular">{index + 1}</span>
                      <span className="zag-v2-photo">
                        {photo ? (
                          <PlayerPhoto src={photo} alt="" />
                        ) : (
                          <span>{playerInitials(player.name)}</span>
                        )}
                      </span>
                      <span className="zag-v2-copy">
                        <strong>{player.name}</strong>
                        <em>
                          {player.display_club ?? player.club}
                          {player.profile ? ` · ${player.profile}` : ""}
                        </em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {seasonLoading ? (
              <p className="zag-v2-empty">
                Carregando atletas{!isCurrentSeason ? ` da temporada ${season}` : ""}…
              </p>
            ) : archiveFailed ? (
              <p className="zag-v2-empty">
                Não foi possível carregar os atletas de {season}.{" "}
                <button type="button" className="zag-v2-retry" onClick={() => setArchiveRoster(null)}>
                  Tentar de novo
                </button>
              </p>
            ) : !visible.length ? (
              <p className="zag-v2-empty">Nenhum atleta com esses filtros.</p>
            ) : null}
          </aside>

          <main className="zag-v2-detail">
            {selected ? (
              <PositionProfileView
                key={selected.player_id}
                player={selected}
                family={family}
                players={players}
                currentPlayers={initialPlayers}
                heatmapsEnabled={heatmapsEnabled}
              />
            ) : seasonLoading ? null : (
              <p className="zag-v2-empty">Escolha um atleta na lista.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
