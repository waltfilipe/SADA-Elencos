"use client";

import { BASE_PATH } from "@/lib/paths";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/components/LeagueProvider";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { AddToShadowMenu } from "@/components/shadow/AddToShadowMenu";
import { ClubSearch, type ClubOption } from "@/components/shadow/ClubSearch";
import { PitchView } from "@/components/shadow/PitchView";
import { PositionAnalysis } from "@/components/shadow/PositionAnalysis";
import { PositionViewCard } from "@/components/shadow/PositionViewCard";
import { ReserveBench } from "@/components/shadow/ReserveBench";
import { formatDominantFoot } from "@/components/shadow/ShadowPlayerMiniReport";
import { ClubLogo } from "@/components/ClubLogo";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { ShadowPlayerRow } from "@/components/shadow/ShadowPlayerChip";
import { TeamProfileMap } from "@/components/shadow/TeamProfileMap";
import { TeamStatsBar } from "@/components/shadow/TeamStatsBar";
import { useShadowTeam } from "@/hooks/useShadowTeam";
import { buildClubLineup, positionLines, type PositionLine } from "@/lib/clubLineup";
import { FORMATIONS, fieldSlots, formationById, type FormationSlot } from "@/lib/formations";
import {
  clearElencoOverrides,
  elencoOverrideKey,
  loadElencoOverrides,
  loadLegacyElencoOverrides,
  remapElencoOverrides,
  saveElencoOverrides,
  type ElencoOverrides,
} from "@/lib/elencoOverrides";
import { LEAGUES, BRASILEIRAO_LEAGUES, isLeagueId, leaguePath, type LeagueId } from "@/lib/leagues";
import { BRASILEIRAO_SEASONS, CURRENT_SEASON, isBrasileiraoLeague } from "@/lib/seasons";
import { ESTADUAIS_LEAGUE_IDS } from "@/lib/estaduaisHub";
import { benchPlayerIds, boardAssignments, boardReserves, boardSquad, type ElencoSaved, type ShadowScope, type TeamBoard } from "@/lib/shadowTeamStorage";
import { athleteRowKey, dedupeAthleteRows, dedupeClubOptions } from "@/lib/athleteDedupe";
import { gradeTier, playerInitials, ratingToLetterGrade, tierVars } from "@/lib/scoutTheme";
import type { SimilarPlayerHit } from "@/lib/crossLeagueSimilarity";
import type { PlayerSearchRow } from "@/lib/types";

type SquadSource = "elenco" | "sombra" | "sombra-todas";
type SquadPlayer = PlayerSearchRow & { sourceLeague: LeagueId };

const SOURCE_KEY = "scout:elenco-source";
const SOMBRA_LEAGUE_KEY = "scout:elenco-sombra-league";
const CLUB_KEY = "scout:elenco-club";

function readSource(): SquadSource {
  if (typeof window === "undefined") return "elenco";
  const value = sessionStorage.getItem(SOURCE_KEY);
  if (value === "sombra" || value === "sombra-todas" || value === "elenco") return value;
  return "elenco";
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function readSombraLeague(fallback: LeagueId | "estaduais"): LeagueId | "estaduais" {
  if (typeof window === "undefined") return fallback;
  const value = sessionStorage.getItem(SOMBRA_LEAGUE_KEY) ?? "";
  if (value === "estaduais") return value;
  return isLeagueId(value) ? value : fallback;
}

type Props = {
  /** Só a liga da página vem no payload — as demais chegam por /api/search-rows sob demanda. */
  playersByLeague: Partial<Record<LeagueId, PlayerSearchRow[]>>;
  /** Índice clube → contagem por liga: alimenta o picker sem serializar todas as linhas. */
  clubIndex: { leagueId: LeagueId; club: string; count: number }[];
  /** elenco = escalacao do clube real | previos = elencos de temporadas anteriores | sombra = times sombra. */
  board: "elenco" | "sombra" | "previos";
};

export function TimeSombraClient({ playersByLeague, clubIndex, board: viewBoard }: Props) {
  const { href, leagueId } = useLeague();
  const isPrevios = viewBoard === "previos";
  const [savedMode, setSavedMode] = useState<SquadSource>("elenco");
  const [sombraLeague, setSombraLeague] = useState<LeagueId | "estaduais">(leagueId);
  const [prevLeague, setPrevLeague] = useState<LeagueId>(() =>
    leagueId === "serie-d" || isBrasileiraoLeague(leagueId) ? leagueId : "serie-a",
  );
  const [prevSeason, setPrevSeason] = useState<string>(CURRENT_SEASON);
  const [prevRows, setPrevRows] = useState<SquadPlayer[] | null>(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevFailed, setPrevFailed] = useState(false);
  const [prevClubKey, setPrevClubKey] = useState<string | null>(null);
  const [prevStandings, setPrevStandings] = useState<string[] | null>(null);

  useEffect(() => {
    setSavedMode(readSource());
    setSombraLeague(readSombraLeague(leagueId));
    setClubKey(sessionStorage.getItem(CLUB_KEY));
    setPrevLeague(leagueId === "serie-d" || isBrasileiraoLeague(leagueId) ? leagueId : "serie-a");
  }, [leagueId]);
  // A rota fixa o quadro: /elenco e /elencos-previos mostram escalação por
  // minutos; /time-sombra ignora um modo "elenco" salvo e cai no time sombra.
  const mode: SquadSource = viewBoard === "sombra" ? (savedMode === "elenco" ? "sombra" : savedMode) : "elenco";
  const scope: ShadowScope = mode === "sombra-todas" ? "todas" : mode === "sombra" ? sombraLeague : leagueId;
  const board: TeamBoard = mode === "elenco" ? "proprio" : "sombra";
  const { state, ready, changeFormation, assign, dropOnSlot, reserve, removeFromSquad, removeFromWatchlist, saveElencoOverride } =
    useShadowTeam(scope);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [clubKey, setClubKey] = useState<string | null>(null);
  const [placementPlayerId, setPlacementPlayerId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"squad" | "watch">("squad");
  const [slotQuery, setSlotQuery] = useState("");
  const [elencoHidden, setElencoHidden] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<{ slot: FormationSlot; mode: "starter" | "reserve" } | null>(null);
  const [elencoOverride, setElencoOverride] = useState<ElencoOverrides | null>(null);
  const [elencoDirty, setElencoDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  // Marca que o usuário mexeu no campo nesta sessão — só assim a escala
  // "segue" a troca de clube; quem só navega entre elencos não carrega nada.
  const elencoEditedRef = useRef(false);

  // Ligas fora da página chegam por fetch único (/api/search-rows?slim=1) —
  // o corpo ISR ficaria acima de 20 MB com todas serializadas.
  const [remoteLeagues, setRemoteLeagues] = useState<Partial<Record<LeagueId, PlayerSearchRow[]>>>({});
  const requestedRef = useRef(new Set<LeagueId>());
  const retryRef = useRef(new Map<LeagueId, number>());
  const [pendingCount, setPendingCount] = useState(0);

  const ensureLeague = useCallback(
    (id: LeagueId) => {
      if (playersByLeague[id] || requestedRef.current.has(id)) return;
      requestedRef.current.add(id);
      setPendingCount((n) => n + 1);
      fetch(`${BASE_PATH}/api/search-rows?league=${id}&slim=1`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("squad_rows_failed"))))
        .then((data: { players?: PlayerSearchRow[] }) => {
          setRemoteLeagues((prev) => ({ ...prev, [id]: data.players ?? [] }));
        })
        .catch(() => {
          requestedRef.current.delete(id);
          const tries = (retryRef.current.get(id) ?? 0) + 1;
          retryRef.current.set(id, tries);
          if (tries <= 3) setTimeout(() => ensureLeague(id), 700 * tries);
        })
        .finally(() => setPendingCount((n) => Math.max(0, n - 1)));
    },
    [playersByLeague],
  );

  const mergedByLeague = useMemo<Partial<Record<LeagueId, PlayerSearchRow[]>>>(
    () => ({ ...remoteLeagues, ...playersByLeague }),
    [remoteLeagues, playersByLeague],
  );

  const taggedPlayers = useMemo(() => {
    const rows: SquadPlayer[] = [];
    for (const league of LEAGUES) {
      for (const player of mergedByLeague[league.id] ?? []) {
        rows.push({ ...player, sourceLeague: league.id });
      }
    }
    return rows;
  }, [mergedByLeague]);

  const pickerPool = useMemo(() => {
    if (mode === "sombra-todas") return taggedPlayers;
    if (mode === "sombra" && sombraLeague === "estaduais") {
      return taggedPlayers.filter((player) =>
        (ESTADUAIS_LEAGUE_IDS as readonly string[]).includes(player.sourceLeague),
      );
    }
    const series = mode === "elenco" ? leagueId : sombraLeague;
    return taggedPlayers.filter((player) => player.sourceLeague === series);
  }, [taggedPlayers, mode, leagueId, sombraLeague]);

  const playersById = useMemo(() => new Map(taggedPlayers.map((player) => [player.player_id, player])), [taggedPlayers]);

  // Elencos prévios: a temporada atual vem de props; as antigas chegam por fetch
  // uma vez por série/ano, no mesmo formato dos rows atuais.
  useEffect(() => {
    if (!isPrevios || prevSeason === CURRENT_SEASON) {
      setPrevRows(null);
      setPrevFailed(false);
      return;
    }
    let cancelled = false;
    setPrevRows(null);
    setPrevLoading(true);
    setPrevFailed(false);
    fetch(`${BASE_PATH}/api/search-rows?league=${prevLeague}&season=${prevSeason}&slim=1`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("previos_fetch_failed"))))
      .then((data: { players?: PlayerSearchRow[] }) => {
        if (cancelled) return;
        setPrevRows((data.players ?? []).map((row) => ({ ...row, sourceLeague: prevLeague })));
        setPrevLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPrevRows([]);
        setPrevFailed(true);
        setPrevLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrevios, prevLeague, prevSeason]);

  // Tabela da competição para ordenar a lista de clubes.
  useEffect(() => {
    if (!isPrevios) return;
    let cancelled = false;
    setPrevStandings(null);
    fetch(`${BASE_PATH}/api/standings?league=${prevLeague}&season=${prevSeason}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("standings_fetch_failed"))))
      .then((data: { clubs?: string[] }) => {
        if (!cancelled) setPrevStandings(data.clubs ?? []);
      })
      .catch(() => {
        if (!cancelled) setPrevStandings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrevios, prevLeague, prevSeason]);

  const prevPool = useMemo<SquadPlayer[]>(() => {
    if (!isPrevios) return [];
    if (prevSeason === CURRENT_SEASON) {
      return taggedPlayers.filter((player) => player.sourceLeague === prevLeague);
    }
    return prevRows ?? [];
  }, [isPrevios, prevSeason, prevLeague, taggedPlayers, prevRows]);

  // O caminho de escalação por clube usa este pool: atual no /elenco, temporada
  // escolhida no /elencos-previos. Quadros sombra seguem nos pools próprios.
  const elencoPool = isPrevios ? prevPool : taggedPlayers;
  const elencoById = useMemo(
    () => new Map(elencoPool.map((player) => [player.player_id, player])),
    [elencoPool],
  );
  const lookupById = isPrevios ? elencoById : playersById;

  // Um clube por nome: entrada da competição nacional sempre; estadual só
  // para quem não disputa A/B/C (Série D também conta como "só estadual").
  const indexOptions = useMemo<ClubOption[]>(
    () =>
      dedupeClubOptions(
        clubIndex.map((entry) => ({
          ...entry,
          leagueName: LEAGUES.find((league) => league.id === entry.leagueId)?.name ?? entry.leagueId,
        })),
      ).sort((a, b) => a.club.localeCompare(b.club, "pt")),
    [clubIndex],
  );

  // Elenco atual cobre todas as ligas via índice (linhas sob demanda). Prévios
  // de temporada antiga seguem contando dos rows baixados por fetch.
  const clubOptions = useMemo<ClubOption[]>(() => {
    if (!isPrevios) return indexOptions;
    if (prevSeason === CURRENT_SEASON) {
      return indexOptions.filter((option) => option.leagueId === prevLeague);
    }
    const counts = new Map<string, ClubOption>();
    for (const player of prevPool) {
      if (!player.club) continue;
      const key = `${player.sourceLeague}::${player.club}`;
      const current = counts.get(key);
      if (current) current.count += 1;
      else {
        counts.set(key, {
          club: player.club,
          leagueId: player.sourceLeague,
          leagueName: LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? player.sourceLeague,
          count: 1,
        });
      }
    }
    return [...counts.values()].sort(
      (a, b) => a.leagueId.localeCompare(b.leagueId) || a.club.localeCompare(b.club, "pt"),
    );
  }, [isPrevios, prevSeason, prevLeague, indexOptions, prevPool]);

  const activeClubKey = isPrevios ? prevClubKey : clubKey;
  const selectedClub = clubOptions.find((option) => `${option.leagueId}::${option.club}` === activeClubKey) ?? null;

  // Busca do picker varre toda a base (qualquer liga/posição) — dispara carga
  // de todas as ligas sob demanda.
  const searching = Boolean(picker) && fold(slotQuery.trim()).length >= 2;

  // Linhas de ligas fora da página chegam por fetch sob demanda: clube
  // escolhido, série do sombra, "todas" e a busca global do picker.
  useEffect(() => {
    const needed: LeagueId[] = [];
    if (searching || mode === "sombra-todas") {
      needed.push(...LEAGUES.map((league) => league.id));
    } else if (isPrevios) {
      if (prevSeason === CURRENT_SEASON) needed.push(prevLeague);
    } else if (mode === "sombra") {
      needed.push(...(sombraLeague === "estaduais" ? [...ESTADUAIS_LEAGUE_IDS] : [sombraLeague]));
    } else if (selectedClub) {
      needed.push(selectedClub.leagueId);
    }
    needed.forEach(ensureLeague);
  }, [searching, mode, isPrevios, prevSeason, prevLeague, sombraLeague, selectedClub, ensureLeague]);

  // Elencos prévios: só clubes que disputaram a competição. Com tabela oficial,
  // filtra pelos participantes (remove artefatos de saída no meio da temporada);
  // sem tabela (Série D), mantém só elencos reais (>=10 atletas).
  const prevClubOptions = useMemo(() => {
    if (!isPrevios) return clubOptions;
    if (!prevStandings?.length) return clubOptions.filter((option) => option.count >= 10);
    const rank = new Map(prevStandings.map((club, index) => [club, index]));
    return clubOptions
      .filter((option) => rank.has(option.club))
      .sort(
        (a, b) =>
          (rank.get(a.club) ?? 0) - (rank.get(b.club) ?? 0) || a.club.localeCompare(b.club, "pt"),
      );
  }, [isPrevios, clubOptions, prevStandings]);

  const clubPlayers = useMemo(() => {
    if (!selectedClub) return [];
    return elencoPool.filter(
      (player) => player.sourceLeague === selectedClub.leagueId && player.club === selectedClub.club,
    );
  }, [elencoPool, selectedClub]);

  useEffect(() => {
    setElencoHidden(new Set());
  }, [activeClubKey]);

  // Overrides manuais do campo automático (elenco e prévios): por quadro,
  // série, temporada e clube — a formação vai dentro do payload e é remapeada
  // ao trocar de esquema, então a escala não some mais. Rascunho fica no
  // localStorage na hora; o botão Salvar grava no estado sincronizado (nuvem).
  const overrideKey = elencoOverrideKey(
    viewBoard,
    isPrevios ? prevLeague : leagueId,
    isPrevios ? prevSeason : CURRENT_SEASON,
    activeClubKey ?? "sem-clube",
  );
  const overrideLeague = isPrevios ? prevLeague : leagueId;
  const overrideSeason = isPrevios ? prevSeason : CURRENT_SEASON;
  const overrideClub = activeClubKey ?? "sem-clube";
  useEffect(() => {
    if (!overrideKey) {
      setElencoOverride(null);
      return;
    }
    const formation = state?.formationId ?? "4-3-3";
    const draft =
      loadElencoOverrides(overrideKey) ??
      loadLegacyElencoOverrides(viewBoard, overrideLeague, overrideSeason, overrideClub);
    const saved = state?.elencoOverrides?.[overrideKey] ?? null;
    const base = draft ?? saved;
    if (!base) {
      setElencoOverride(null);
      setElencoDirty(false);
      return;
    }
    // Remapeia posições se o override foi escrito noutra formação.
    const normalized = remapElencoOverrides(base, formation);
    setElencoOverride(normalized);
    setElencoDirty(draft != null);
    if (draft) saveElencoOverrides(overrideKey, normalized);
  }, [overrideKey, state?.formationId, state?.elencoOverrides]);

  // Atleta de outra competição salvo na escalação: carrega a liga dele (via
  // mapa playerLeague gravado no save) para a linha resolver — sem isso o
  // campo abre vazio e o atleta só "volta" quando uma busca carrega a liga.
  useEffect(() => {
    if (!elencoOverride) return;
    const ids = [
      ...Object.values(elencoOverride.assignments).filter((id): id is string => Boolean(id)),
      ...Object.values(elencoOverride.reservesBySlot ?? {}).flat(),
    ];
    const missing = ids.filter((id) => !lookupById.has(id));
    if (!missing.length) return;
    const map = elencoOverride.playerLeague ?? {};
    const known = new Set<LeagueId>();
    for (const id of missing) {
      const lg = map[id];
      if (lg) known.add(lg);
    }
    if (known.size) {
      known.forEach(ensureLeague);
    } else {
      // Override antigo sem mapa — varre as ligas uma vez (requestedRef dedup).
      LEAGUES.forEach((league) => ensureLeague(league.id));
    }
  }, [elencoOverride, lookupById, ensureLeague]);

  const visibleClubPlayers = useMemo(
    () => clubPlayers.filter((player) => !elencoHidden.has(player.player_id)),
    [clubPlayers, elencoHidden],
  );

  const clubLineup = useMemo(() => {
    if (mode !== "elenco" || !selectedClub) return null;
    return buildClubLineup(visibleClubPlayers, formationById(state?.formationId ?? "4-3-3"));
  }, [mode, selectedClub, visibleClubPlayers, state?.formationId]);

  const slotCandidates = useMemo(() => {
    if (!state || !picker) return [];
    const elencoPicking = mode === "elenco";
    const assignments = elencoPicking
      ? { ...(elencoOverride?.assignments ?? clubLineup?.assignments ?? {}) }
      : boardAssignments(state, board);
    const reservesOn = elencoPicking
      ? new Set(Object.values(elencoOverride?.reservesBySlot ?? clubLineup?.reservesBySlot ?? {}).flat())
      : new Set(boardSquad(state, board));
    // Slot ocupado também mostra candidatos — "Substituir" joga o titular
    // atual para a reserva (elencoAssign já trata o deslocamento).
    const query = fold(slotQuery.trim());
    // Com texto digitado, a busca varre toda a base do site (todas as séries e posições).
    const takenIds =
      picker.mode === "starter"
        ? (Object.values(assignments).filter((id): id is string => Boolean(id)))
        : [
            ...Object.values(assignments).filter((id): id is string => Boolean(id)),
            ...reservesOn,
          ];
    // Compara por identidade (athlete_id/person_key): o mesmo atleta pode
    // estar escalado pela linha de outra competição — ele não pode entrar
    // de novo pela segunda linha.
    const taken = new Set(
      takenIds.map((id) => athleteRowKey(lookupById.get(id) ?? { player_id: id })),
    );
    const families = picker.slot.families;
    const familyRank = (player: SquadPlayer) => {
      const index = families.indexOf(player.position_family);
      return index < 0 ? families.length : index;
    };
    const candidatePool = searching ? elencoPool : elencoPicking ? visibleClubPlayers : pickerPool;
    // Resumo do atleta: uma linha só por pessoa — a da competição nacional
    // (mais minutos em empate), com `alsoIn` anotando as outras no card.
    const dedupedPool = dedupeAthleteRows(candidatePool);
    const matches = dedupedPool
      .filter((player) => {
        if (taken.has(athleteRowKey(player))) return false;
        if (!searching) return families.includes(player.position_family);
        const leagueName = LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? "";
        return fold(player.name).includes(query) || fold(player.club).includes(query) || fold(leagueName).includes(query);
      })
      .sort((a, b) => familyRank(a) - familyRank(b) || b.rating - a.rating);
    return searching ? matches.slice(0, 120) : matches;
  }, [pickerPool, visibleClubPlayers, elencoPool, state, picker, slotQuery, board, mode, elencoOverride, clubLineup, lookupById, searching]);

  if (!ready || !state) {
    return (
      <div className="scout-root profile-page">
        <ScoutTopbar
          active={
            viewBoard === "elenco" ? "elenco" : viewBoard === "previos" ? "elencos-previos" : "time-sombra"
          }
        />
        <div className="scout-empty">Carregando elenco…</div>
      </div>
    );
  }

  const formation = formationById(state.formationId);
  const storedAssignments = boardAssignments(state, board);
  const reservesBySlot = boardReserves(state, board);
  const benchIds = benchPlayerIds(state, board);
  const slottedReserveIds = new Set(Object.values(reservesBySlot).flat());
  const looseReserveIds = benchIds.filter((id) => !slottedReserveIds.has(id));
  const emptyAssignments = Object.fromEntries(fieldSlots(formation).map((slot) => [slot.id, null]));
  const elencoBaseAssignments = elencoOverride?.assignments ?? clubLineup?.assignments ?? emptyAssignments;
  const elencoBaseReserves = elencoOverride?.reservesBySlot ?? clubLineup?.reservesBySlot ?? {};
  const viewAssignments =
    mode === "elenco"
      ? Object.fromEntries(
          Object.entries(elencoBaseAssignments).map(([slotId, id]) => [
            slotId,
            id && elencoHidden.has(id) ? null : id,
          ]),
        )
      : storedAssignments;
  const viewReserves =
    mode === "elenco"
      ? Object.fromEntries(
          Object.entries(elencoBaseReserves).map(([slotId, ids]) => [
            slotId,
            ids.filter((id) => !elencoHidden.has(id)),
          ]),
        )
      : reservesBySlot;
  const viewLoose = mode === "elenco" ? [] : looseReserveIds;
  const lines: PositionLine[] =
    mode === "elenco"
      ? elencoOverride
        ? positionLines(formation, viewAssignments, viewReserves, viewLoose, lookupById)
        : (clubLineup?.lines ?? [])
      : positionLines(formation, viewAssignments, viewReserves, viewLoose, lookupById);
  const reserveIds = lines.flatMap((line) => line.entries.filter((entry) => entry.role === "reserva").map((entry) => entry.playerId));
  const reserveLabels = new Map(lines.flatMap((line) => line.entries.filter((entry) => entry.role === "reserva").map((entry) => [entry.playerId, line.label] as const)));
  const selectedPlayerId = detailPlayerId ?? (selectedSlotId ? viewAssignments[selectedSlotId] : null);
  const selectedPlayer = selectedPlayerId ? lookupById.get(selectedPlayerId) : null;
  const activeSquadIds = mode === "elenco" ? clubPlayers.map((player) => player.player_id) : boardSquad(state, board);

  const squadPlayers = (
    mode === "elenco"
      ? [
          ...fieldSlots(formation)
            .map((slot) => viewAssignments[slot.id])
            .filter((id): id is string => Boolean(id)),
          ...reserveIds,
        ]
      : activeSquadIds
  )
    .map((id) => lookupById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));
  const watchPlayers = state.watchlistIds
    .map((id) => playersById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));

  const starters = Object.values(viewAssignments)
    .filter((id): id is string => Boolean(id))
    .map((id) => lookupById.get(id))
    .filter((p): p is SquadPlayer => Boolean(p));
  // Titulares na ordem das linhas (GOL -> AT) para o card de similares.
  const orderedStarters = lines.flatMap((line) =>
    line.entries
      .filter((entry) => entry.role === "titular")
      .map((entry) => ({ player: lookupById.get(entry.playerId), slot: line.label }))
      .filter((item): item is { player: SquadPlayer; slot: string } => Boolean(item.player)),
  );
  const editable = true;
  const usingAutoElenco = mode === "elenco";

  const applyElencoOverride = (produce: (current: ElencoOverrides) => ElencoOverrides) => {
    if (!overrideKey) return;
    setElencoOverride((current) => {
      const base = current ?? {
        formationId: state.formationId,
        assignments: clubLineup?.assignments ?? emptyAssignments,
        reservesBySlot: clubLineup?.reservesBySlot ?? {},
      };
      const next = { ...produce(base), formationId: state.formationId };
      // Liga de cada atleta escalado — sem ela, a linha de outra competição
      // fica sem resolução ao recarregar e o atleta "some" do campo.
      const ids = [
        ...Object.values(next.assignments).filter((id): id is string => Boolean(id)),
        ...Object.values(next.reservesBySlot).flat(),
      ];
      const playerLeague: Record<string, LeagueId> = {};
      for (const id of ids) {
        const src = lookupById.get(id)?.sourceLeague;
        if (src) playerLeague[id] = src;
      }
      next.playerLeague = playerLeague;
      // Rascunho salvo na hora — não some na busca nem ao navegar; o botão
      // Salvar é quem publica para a nuvem.
      saveElencoOverrides(overrideKey, next);
      return next;
    });
    setElencoDirty(true);
    elencoEditedRef.current = true;
    setSaveState("idle");
  };

  // Botão Salvar: publica o rascunho no estado do time sombra (que já
  // sincroniza localStorage + nuvem) e confirma o envio imediato.
  const saveElenco = () => {
    if (!overrideKey || !elencoOverride || saveState === "saving") return;
    setSaveState("saving");
    const saved: ElencoSaved = {
      formationId: state.formationId,
      assignments: elencoOverride.assignments,
      reservesBySlot: elencoOverride.reservesBySlot,
      playerLeague: elencoOverride.playerLeague,
    };
    void saveElencoOverride(overrideKey, saved).then(() => {
      // Mesmo se a nuvem falhar, o estado local já está gravado.
      clearElencoOverrides(overrideKey);
      setElencoDirty(false);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2500);
    });
  };

  const stripFromReserves = (reserves: Record<string, string[]>, playerId: string) => {
    const next: Record<string, string[]> = {};
    for (const [slotId, ids] of Object.entries(reserves)) {
      const kept = ids.filter((id) => id !== playerId);
      if (kept.length) next[slotId] = kept;
    }
    return next;
  };

  // Espelha dropPlayerOnSlot: slot↔slot troca, banco→slot desloca o titular
  // para a reserva daquela posição. O limpar volta o atleta ao banco.
  const elencoDrop = (sourceSlotId: string | null, targetSlotId: string, playerId: string) => {
    applyElencoOverride((current) => {
      const assignments = { ...current.assignments };
      const reservesBySlot = stripFromReserves(current.reservesBySlot, playerId);
      const occupant = assignments[targetSlotId] ?? null;
      if (sourceSlotId) {
        for (const key of Object.keys(assignments)) {
          if (key !== targetSlotId && assignments[key] === playerId) assignments[key] = null;
        }
        assignments[sourceSlotId] = occupant && occupant !== playerId ? occupant : null;
        assignments[targetSlotId] = playerId;
      } else {
        for (const key of Object.keys(assignments)) {
          if (assignments[key] === playerId) assignments[key] = null;
        }
        assignments[targetSlotId] = playerId;
        if (occupant && occupant !== playerId) {
          reservesBySlot[targetSlotId] = [...(reservesBySlot[targetSlotId] ?? []), occupant];
        }
      }
      return { assignments, reservesBySlot };
    });
  };

  const elencoAssign = (slotId: string, playerId: string | null) => {
    applyElencoOverride((current) => {
      const assignments = { ...current.assignments };
      const reservesBySlot = { ...current.reservesBySlot };
      const cleared = assignments[slotId] ?? null;
      assignments[slotId] = playerId;
      let reserves = reservesBySlot;
      if (cleared && cleared !== playerId) {
        reserves = { ...reserves, [slotId]: [...(reserves[slotId] ?? []), cleared] };
      }
      if (playerId) {
        for (const key of Object.keys(assignments)) {
          if (key !== slotId && assignments[key] === playerId) assignments[key] = null;
        }
        reserves = stripFromReserves(reserves, playerId);
      }
      return { assignments, reservesBySlot: reserves };
    });
  };

  const elencoReserveAdd = (slotId: string, playerId: string) => {
    applyElencoOverride((current) => {
      const assignments = { ...current.assignments };
      for (const key of Object.keys(assignments)) {
        if (assignments[key] === playerId) assignments[key] = null;
      }
      const reservesBySlot = stripFromReserves(current.reservesBySlot, playerId);
      reservesBySlot[slotId] = [...(reservesBySlot[slotId] ?? []), playerId];
      return { assignments, reservesBySlot };
    });
  };

  const excludeCandidates = (() => {
    const query = slotQuery.trim();
    if (!query || !picker) return [] as SquadPlayer[];
    const q = fold(query);
    const pool =
      mode === "elenco" && selectedClub
        ? squadPlayers.filter((player) => !elencoHidden.has(player.player_id))
        : editable
          ? squadPlayers
          : [];
    return pool.filter((player) => {
      const leagueName = LEAGUES.find((league) => league.id === player.sourceLeague)?.name ?? "";
      return fold(player.name).includes(q) || fold(player.club).includes(q) || fold(leagueName).includes(q);
    });
  })();

  const avgLetter =
    starters.length > 0
      ? ratingToLetterGrade(starters.reduce((sum, p) => sum + p.rating, 0) / starters.length)
      : null;

  function setSource(next: SquadSource) {
    setSavedMode(next);
    sessionStorage.setItem(SOURCE_KEY, next);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function chooseSombraLeague(next: LeagueId | "estaduais") {
    setSombraLeague(next);
    sessionStorage.setItem(SOMBRA_LEAGUE_KEY, next);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function chooseClub(option: ClubOption | null) {
    const key = option ? `${option.leagueId}::${option.club}` : null;
    if (isPrevios) {
      setPrevClubKey(key);
    } else {
      // Campo em edição acompanha a troca de clube: atleta colocado fica
      // até ser removido. O rascunho é regravado sob a chave do novo clube
      // (o efeito de carga lê de lá e mantém a mesma escala).
      if (
        mode === "elenco" &&
        !isPrevios &&
        elencoOverride &&
        (elencoDirty || elencoEditedRef.current) &&
        key !== clubKey
      ) {
        const nextKey = elencoOverrideKey(
          viewBoard,
          leagueId,
          CURRENT_SEASON,
          key ?? "sem-clube",
        );
        saveElencoOverrides(nextKey, elencoOverride);
      }
      setClubKey(key);
      if (key) sessionStorage.setItem(CLUB_KEY, key);
      else sessionStorage.removeItem(CLUB_KEY);
    }
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function choosePrevLeague(next: LeagueId) {
    setPrevLeague(next);
    setPrevClubKey(null);
    if (next === "serie-d") setPrevSeason(CURRENT_SEASON);
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  function choosePrevSeason(next: string) {
    setPrevSeason(next);
    setPrevClubKey(null);
    if (next !== CURRENT_SEASON && prevLeague === "serie-d") setPrevLeague("serie-a");
    setSelectedSlotId(null);
    setDetailPlayerId(null);
    setPlacementPlayerId(null);
    setPicker(null);
    setSlotQuery("");
  }

  const sourceLabel =
    mode === "elenco"
      ? selectedClub
        ? isPrevios
          ? `Elenco ${prevSeason} · ${selectedClub.club}`
          : `Elenco atual · ${selectedClub.club}`
        : isPrevios
          ? "Elencos prévios"
          : "Elenco atual"
      : mode === "sombra-todas"
        ? "Time sombra · todas as competições"
        : `Time sombra · ${sombraLeague === "estaduais" ? "Estaduais" : (LEAGUES.find((league) => league.id === sombraLeague)?.name ?? "")}`;
  const rosterLabel = mode === "elenco" ? "Elenco" : mode === "sombra-todas" ? "Todas" : "Time sombra";

  return (
    <div className="scout-root profile-page shadow-page">
      <ScoutTopbar
        active={
          viewBoard === "elenco" ? "elenco" : viewBoard === "previos" ? "elencos-previos" : "time-sombra"
        }
      />

      <div className="shadow-page-body">
        <header className="shadow-page-header">
          <div className="shadow-page-heading">
            <h1 className="shadow-page-title">
              {viewBoard === "elenco" ? "Elenco" : viewBoard === "previos" ? "Elencos Prévios" : "Time Sombra"}
            </h1>
            <p className="shadow-page-sub">
              {sourceLabel} · {starters.length} titulares · {reserveIds.length} reservas
              {avgLetter != null ? ` · letra ${avgLetter}` : ""}
            </p>
          </div>

          <div className="shadow-page-controls">
            {mode === "elenco" ? (
              <button
                type="button"
                className={`elenco-save-btn${elencoDirty ? " dirty" : ""}${saveState === "saved" ? " saved" : ""}`}
                disabled={saveState === "saving" || (!elencoDirty && !elencoOverride)}
                title={
                  elencoDirty
                    ? "Publica a escalação editada (sincroniza com a nuvem)"
                    : "Escalação salva — edite o campo para alterar"
                }
                onClick={saveElenco}
              >
                <i
                  className={saveState === "saved" ? "fa-solid fa-check" : "fa-solid fa-floppy-disk"}
                  aria-hidden="true"
                />
                {saveState === "saving"
                  ? "Salvando…"
                  : saveState === "saved"
                    ? "Salvo"
                    : elencoDirty
                      ? "Salvar ●"
                      : "Salvar"}
              </button>
            ) : null}
            {viewBoard === "sombra" ? (
              <div className="shadow-board-switch" role="tablist" aria-label="Fonte do time sombra">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sombra"}
                  className={`shadow-board-tab${mode === "sombra" ? " active" : ""}`}
                  onClick={() => setSource("sombra")}
                >
                  Time sombra
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "sombra-todas"}
                  className={`shadow-board-tab${mode === "sombra-todas" ? " active" : ""}`}
                  onClick={() => setSource("sombra-todas")}
                >
                  Todas as competições
                </button>
              </div>
            ) : null}

            {isPrevios ? (
              <>
                <div className="shadow-formation-picker">
                  <span className="shadow-formation-label">Série</span>
                  <div className="shadow-formation-chips" role="group" aria-label="Competição do elenco">
                    {BRASILEIRAO_LEAGUES.map((league) => (
                      <button
                        key={league.id}
                        type="button"
                        className={`shadow-formation-chip${league.id === prevLeague ? " active" : ""}`}
                        aria-pressed={league.id === prevLeague}
                        disabled={league.id === "serie-d" && prevSeason !== CURRENT_SEASON}
                        title={league.id === "serie-d" ? "Série D só tem a temporada atual" : undefined}
                        onClick={() => choosePrevLeague(league.id)}
                      >
                        {league.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="shadow-formation-picker">
                  <span className="shadow-formation-label">Ano</span>
                  <div className="shadow-formation-chips" role="group" aria-label="Temporada do elenco">
                    {BRASILEIRAO_SEASONS.map((season) => (
                      <button
                        key={season}
                        type="button"
                        className={`shadow-formation-chip${season === prevSeason ? " active" : ""}`}
                        aria-pressed={season === prevSeason}
                        disabled={prevLeague === "serie-d" && season !== CURRENT_SEASON}
                        onClick={() => choosePrevSeason(season)}
                      >
                        {season}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : mode === "elenco" ? (
              <ClubSearch options={clubOptions} value={selectedClub} onChange={chooseClub} />
            ) : null}

            {mode === "sombra" ? (
              <div className="shadow-formation-picker">
              <span className="shadow-formation-label">Série</span>
              <div className="shadow-formation-chips" role="group" aria-label="Competição do time sombra">
                {BRASILEIRAO_LEAGUES.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    className={`shadow-formation-chip${league.id === sombraLeague ? " active" : ""}`}
                    aria-pressed={league.id === sombraLeague}
                    onClick={() => chooseSombraLeague(league.id)}
                  >
                    {league.name}
                  </button>
                ))}
                <button
                  type="button"
                  className={`shadow-formation-chip${sombraLeague === "estaduais" ? " active" : ""}`}
                  aria-pressed={sombraLeague === "estaduais"}
                  onClick={() => chooseSombraLeague("estaduais")}
                >
                  Estaduais
                </button>
              </div>
              </div>
            ) : null}

            <div className="shadow-formation-picker" role="group" aria-label="Formação tática">
              <span className="shadow-formation-label">Formação</span>
              <div className="shadow-formation-chips">
                {FORMATIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`shadow-formation-chip${state.formationId === f.id ? " active" : ""}`}
                    onClick={() => {
                      changeFormation(f.id);
                      setSelectedSlotId(null);
                      setPlacementPlayerId(null);
                      setPicker(null);
                    }}
                    aria-pressed={state.formationId === f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <TeamStatsBar starters={starters} squad={squadPlayers} />

        <div className="shadow-layout">
          <section className="shadow-main player-card" aria-label="Campo e reservas">
            {isPrevios ? (
              <div className="previos-clubs">
                <div className="previos-clubs-head">
                  <h3 className="section-label">Clubes</h3>
                  <span className="previos-similar-note">
                    {prevStandings?.length
                      ? `ordem da tabela · ${LEAGUES.find((l) => l.id === prevLeague)?.name ?? ""} ${prevSeason}`
                      : "ordem alfabética"}
                  </span>
                </div>
                {prevLoading ? (
                  <p className="previos-similar-hint">Carregando clubes de {prevSeason}…</p>
                ) : (
                  <div className="previos-club-grid">
                    {prevClubOptions.map((option) => {
                      const pos = prevStandings?.indexOf(option.club) ?? -1;
                      const active =
                        selectedClub?.club === option.club && selectedClub.leagueId === option.leagueId;
                      return (
                        <button
                          key={`${option.leagueId}-${option.club}`}
                          type="button"
                          className={`previos-club${active ? " active" : ""}`}
                          aria-pressed={active}
                          onClick={() => chooseClub(active ? null : option)}
                        >
                          {prevStandings?.length ? (
                            <span className="previos-club-pos tabular">{pos >= 0 ? `${pos + 1}º` : "—"}</span>
                          ) : null}
                          <ClubLogo club={option.club} size={16} />
                          <span className="previos-club-name">{option.club}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            <div className="shadow-pitch-stage">
              <div className="shadow-stage-pitch">
                {mode === "elenco" && elencoOverride ? (
                  <button
                    type="button"
                    className="shadow-pitch-reset"
                    title="Volta à escalação automática por minutos"
                    onClick={() => {
                      if (overrideKey) {
                        clearElencoOverrides(overrideKey);
                        void saveElencoOverride(overrideKey, null);
                      }
                      setElencoOverride(null);
                      setElencoDirty(false);
                      setSaveState("idle");
                    }}
                  >
                    <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Por minutos
                  </button>
                ) : null}
                {mode === "elenco" && !selectedClub ? (
                  <p className="shadow-club-prompt">
                    {isPrevios
                      ? prevLoading
                        ? `Carregando elencos de ${prevSeason}…`
                        : prevFailed
                          ? "Não foi possível carregar essa temporada. Troque a série ou o ano."
                          : "Escolha a série, o ano e o clube para escalar o elenco da temporada, por minutos e por posição."
                      : "Busque um clube para escalar o elenco inteiro, por minutos e por posição."}
                  </p>
                ) : null}
                <PitchView
                  formationId={state.formationId}
                  assignments={viewAssignments}
                  compareAssignments={mode === "elenco" && !isPrevios ? state.assignments : null}
                  playersById={lookupById}
                  selectedSlotId={selectedSlotId}
                  placementPlayerId={editable ? placementPlayerId : null}
                  editable={editable}
                  onSelectSlot={(id) => {
                    setPlacementPlayerId(null);
                    setSlotQuery("");
                    setDetailPlayerId(null);
                    if (!id) {
                      setSelectedSlotId(null);
                      setPicker(null);
                      return;
                    }
                    const slot = formation.slots.find((item) => item.id === id);
                    const occupied = Boolean(viewAssignments[id]);
                    setSelectedSlotId(occupied ? id : null);
                    if (editable && slot && !occupied) setPicker({ slot, mode: "starter" });
                    else setPicker(null);
                  }}
                  onAssign={(slotId, playerId) => {
                    if (!editable) return;
                    if (usingAutoElenco) elencoAssign(slotId, playerId);
                    else assign(slotId, playerId, board);
                    setPlacementPlayerId(null);
                    setDetailPlayerId(null);
                    setPicker(null);
                    setSelectedSlotId(playerId ? slotId : null);
                  }}
                  onDrop={(sourceSlotId, targetSlotId, playerId) => {
                    if (!editable) return;
                    if (usingAutoElenco) elencoDrop(sourceSlotId, targetSlotId, playerId);
                    else dropOnSlot(sourceSlotId, targetSlotId, playerId, board);
                    setPlacementPlayerId(null);
                    setDetailPlayerId(null);
                    setPicker(null);
                    setSelectedSlotId(targetSlotId);
                  }}
                  onAddReserve={(slot) => {
                    if (!editable) return;
                    setSelectedSlotId(slot.id);
                    setDetailPlayerId(null);
                    setPlacementPlayerId(null);
                    setSlotQuery("");
                    // Slot vazio: "+" escala titular; ocupado: "+" adiciona reserva.
                    setPicker({ slot, mode: viewAssignments[slot.id] ? "reserve" : "starter" });
                  }}
                />
              </div>

              <TeamProfileMap
                formationId={state.formationId}
                assignments={viewAssignments}
                playersById={lookupById}
              />
            </div>

            {(
              <ReserveBench
                playerIds={reserveIds}
                playersById={lookupById}
                labels={reserveLabels}
                placementPlayerId={editable ? placementPlayerId : null}
                editable={editable}
                onPlace={(playerId) => {
                  setPicker(null);
                  setDetailPlayerId(null);
                  setPlacementPlayerId((current) => (current === playerId ? null : playerId));
                }}
                onSelect={(playerId) => {
                  setSelectedSlotId(null);
                  setPicker(null);
                  setDetailPlayerId(playerId);
                }}
              />
            )}

            {mode === "elenco" && !selectedClub ? null : <PositionAnalysis lines={lines} />}

            {isPrevios && selectedClub && orderedStarters.length ? (
              <PreviosSimilarSection league={prevLeague} season={prevSeason} starters={orderedStarters} />
            ) : null}
          </section>

          <aside className="shadow-side">
            {picker ? (
              <article className="player-card shadow-slot-picker">
                <div className="profile-card-head">
                  <h3 className="section-label">
                    {picker.mode === "reserve" ? "Reserva" : "Titular"} · {picker.slot.label}
                  </h3>
                  <button
                    type="button"
                    className="shadow-link-btn"
                    onClick={() => {
                      setPicker(null);
                      setSelectedSlotId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <input
                  className="shadow-slot-search"
                  type="search"
                  value={slotQuery}
                  placeholder="Buscar em toda a base: nome, clube ou série…"
                  aria-label="Buscar atleta em toda a base do site"
                  autoFocus
                  onChange={(event) => setSlotQuery(event.target.value)}
                />
                {excludeCandidates.length ? (
                  <ul className="shadow-slot-picker-remove">
                    {excludeCandidates.map((player) => (
                      <li key={`remove-${player.player_id}`}>
                        <button
                          type="button"
                          className="shadow-slot-picker-remove-item"
                          onClick={() => {
                            if (mode === "elenco") {
                              setElencoHidden((prev) => new Set(prev).add(player.player_id));
                            } else {
                              removeFromSquad(player.player_id, board);
                            }
                            setSlotQuery("");
                            setPicker(null);
                            setSelectedSlotId(null);
                          }}
                        >
                          <span>
                            <strong>Remover {player.name}</strong>
                            <em>
                              {mode === "elenco"
                                ? "Oculta do elenco escalado desta sessão"
                                : "Tira do time sombra"}
                            </em>
                          </span>
                          <i className="fa-solid fa-user-minus" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="shadow-slot-picker-hint">
                  {slotQuery.trim().length >= 2
                    ? `${slotCandidates.length >= 120 ? "120+" : slotCandidates.length} resultado(s) em toda a base`
                    : `Sugestões para ${picker.slot.label} · digite para buscar em toda a base`}
                </p>
                {slotCandidates.length ? (
                  <ul className="shadow-slot-picker-list">
                    {slotCandidates.map((player) => (
                      <li key={player.player_id}>
                        <button
                          type="button"
                          className="shadow-slot-picker-item"
                          onClick={() => {
                            if (picker.mode === "reserve") {
                              if (usingAutoElenco) elencoReserveAdd(picker.slot.id, player.player_id);
                              else reserve(player.player_id, board, picker.slot.id);
                            } else if (usingAutoElenco) {
                              elencoAssign(picker.slot.id, player.player_id);
                            } else {
                              assign(picker.slot.id, player.player_id, board);
                            }
                            setPicker(null);
                            setSelectedSlotId(picker.slot.id);
                          }}
                        >
                          <ClubLogo club={player.club} size={16} />
                          <span className="shadow-slot-picker-copy">
                            <strong>{player.name}</strong>
                            <em>
                              {player.club} · {LEAGUES.find((league) => league.id === player.sourceLeague)?.name} ·{" "}
                              {player.position} · {player.profile}
                              {player.alsoIn?.length
                                ? ` · +${player.alsoIn
                                    .map((row) => LEAGUES.find((league) => league.id === row.league)?.name ?? row.league)
                                    .join(", ")}`
                                : ""}
                            </em>
                          </span>
                          <span className="shadow-slot-picker-rating tabular">
                            {ratingToLetterGrade(player.rating)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="shadow-roster-empty">
                    {pendingCount > 0
                      ? "Carregando base de atletas…"
                      : slotQuery.trim().length >= 2
                        ? "Nenhum atleta encontrado na base."
                        : "Nenhum atleta disponível para esta posição."}
                  </p>
                )}
              </article>
            ) : selectedPlayer ? (
              <article className="player-card shadow-slot-detail">
                <div className="profile-card-head">
                  <h3 className="section-label">
                    {formation.slots.find((s) => s.id === selectedSlotId)?.label ??
                      reserveLabels.get(selectedPlayer.player_id) ??
                      "Atleta"}
                  </h3>
                  <button
                    type="button"
                    className="shadow-link-btn"
                    onClick={() => {
                      setSelectedSlotId(null);
                      setDetailPlayerId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <div className="shadow-slot-detail-body">
                  <PlayerPhoto
                    className="shadow-slot-detail-photo"
                    src={selectedPlayer.transfermarkt?.photo}
                    alt=""
                  />
                  <div className="shadow-slot-detail-copy">
                  <h4>{selectedPlayer.name}</h4>
                  <p className="shadow-slot-detail-meta">
                    {selectedPlayer.club} · {selectedPlayer.position}
                  </p>
                  <p className="shadow-slot-detail-profile">{selectedPlayer.profile}</p>
                  <p className="shadow-slot-detail-meta">Pé {formatDominantFoot(selectedPlayer.foot)}</p>
                  <span
                    className="shadow-slot-detail-rating tabular"
                    style={tierVars(gradeTier(ratingToLetterGrade(selectedPlayer.rating)))}
                  >
                    {ratingToLetterGrade(selectedPlayer.rating)}
                  </span>
                  <div className="shadow-slot-detail-actions">
                    <Link
                      className="btn btn-ghost btn-sm"
                      href={`/${selectedPlayer.sourceLeague}/posicao/${selectedPlayer.position_family}?atleta=${selectedPlayer.player_id}${
                        isPrevios && prevSeason !== CURRENT_SEASON ? `&temporada=${prevSeason}` : ""
                      }`}
                    >
                      Ver perfil
                    </Link>
                    {isPrevios ? null : (
                      <AddToShadowMenu
                        playerId={selectedPlayer.player_id}
                        family={selectedPlayer.position_family}
                        compact
                      />
                    )}
                    {mode === "elenco" && selectedSlotId ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const slot = formation.slots.find((item) => item.id === selectedSlotId);
                            if (!slot) return;
                            setSlotQuery("");
                            setDetailPlayerId(null);
                            setPicker({ slot, mode: "starter" });
                          }}
                        >
                          Substituir
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            elencoAssign(selectedSlotId, null);
                            setSelectedSlotId(null);
                            setDetailPlayerId(null);
                          }}
                        >
                          Remover
                        </button>
                      </>
                    ) : null}
                  </div>
                  {(() => {
                    // Atleta fora da família primária do slot (ex.: lateral na
                    // ponta, atacante aberto): percentis recalculados na pool
                    // da família-alvo da liga — a nova perspectiva dele.
                    const slot = selectedSlotId
                      ? formation.slots.find((item) => item.id === selectedSlotId)
                      : null;
                    const target = slot?.families[0];
                    if (!slot || !target || target === selectedPlayer.position_family) return null;
                    return (
                      <PositionViewCard
                        playerId={selectedPlayer.player_id}
                        league={selectedPlayer.sourceLeague}
                        family={target}
                        slotLabel={slot.label}
                      />
                    );
                  })()}
                  </div>
                </div>
              </article>
            ) : null}

            <article className="player-card shadow-roster-card">
              <div className="shadow-roster-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === "squad"}
                  className={panelTab === "squad" ? "active" : ""}
                  onClick={() => setPanelTab("squad")}
                >
                  {rosterLabel} ({squadPlayers.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === "watch"}
                  className={panelTab === "watch" ? "active" : ""}
                  onClick={() => setPanelTab("watch")}
                >
                  Observação ({watchPlayers.length})
                </button>
              </div>

              <div className="shadow-roster-body">
                {panelTab === "squad" ? (
                  squadPlayers.length ? (
                    <ul className="shadow-roster-list">
                      {squadPlayers.map((player) => (
                        <li key={player.player_id}>
                          <ShadowPlayerRow
                            player={player}
                            profileLabel={player.profile}
                            draggable={editable}
                            onRemove={
                              editable
                                ? mode === "elenco"
                                  ? () => setElencoHidden((prev) => new Set(prev).add(player.player_id))
                                  : () => removeFromSquad(player.player_id, board)
                                : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="shadow-roster-empty">
                      {pendingCount > 0
                        ? "Carregando atletas…"
                        : mode === "elenco"
                          ? "Busque um clube para ver o elenco completo, já escalado por posição."
                        : (
                          <>
                            Nenhum atleta neste time. Clique numa vaga do campo ou abra{" "}
                            <Link href={href("/posicao/zagueiros")}>Posições</Link> e{" "}
                            <Link href={href("/filtros")}>Filtros</Link> para adicionar pelo perfil.
                          </>
                        )}
                    </p>
                  )
                ) : watchPlayers.length ? (
                  <ul className="shadow-roster-list">
                    {watchPlayers.map((player) => (
                      <li key={player.player_id}>
                        <ShadowPlayerRow
                          player={player}
                          profileLabel={player.profile}
                          onRemove={() => removeFromWatchlist(player.player_id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="shadow-roster-empty">
                    Lista vazia. Adicione atletas para acompanhar sem escalar.
                  </p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </div>
    </div>
  );
}

type SimilarTarget = LeagueId | "estaduais";

const SIMILAR_TARGETS: { id: SimilarTarget; name: string }[] = [
  ...BRASILEIRAO_LEAGUES.map((league) => ({ id: league.id as SimilarTarget, name: league.name })),
  { id: "estaduais", name: "Estaduais" },
];

/** Card duplo dos Elencos Prévios: escolhe a competição e lista o top 5 similar de cada titular. */
function PreviosSimilarSection({
  league,
  season,
  starters,
}: {
  league: LeagueId;
  season: string;
  starters: { player: SquadPlayer; slot: string }[];
}) {
  const [target, setTarget] = useState<SimilarTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<Record<string, SimilarPlayerHit[]>>({});
  const reqRef = useRef(0);

  async function choose(to: SimilarTarget) {
    setTarget(to);
    setLoading(true);
    setFailed(false);
    const req = ++reqRef.current;
    try {
      const entries = await Promise.all(
        starters.map(async ({ player }) => {
          const params = new URLSearchParams({
            from: league,
            to,
            playerId: player.player_id,
            family: player.position_family,
            limit: "5",
          });
          if (season !== CURRENT_SEASON) params.set("season", season);
          const res = await fetch(`${BASE_PATH}/api/similar?${params.toString()}`);
          if (!res.ok) return [player.player_id, []] as const;
          const data = (await res.json()) as { matches?: SimilarPlayerHit[] };
          return [player.player_id, data.matches ?? []] as const;
        }),
      );
      if (reqRef.current !== req) return;
      setResults(Object.fromEntries(entries));
    } catch {
      if (reqRef.current === req) setFailed(true);
    } finally {
      if (reqRef.current === req) setLoading(false);
    }
  }

  const targetName =
    target === "estaduais" ? "Estaduais" : (LEAGUES.find((item) => item.id === target)?.name ?? "");

  return (
    <>
      <article className="player-card previos-similar-pick">
        <div className="profile-card-head">
          <h3 className="section-label">Atletas similares</h3>
          <span className="previos-similar-note">top 5 por titular</span>
        </div>
        <p className="previos-similar-hint">
          Em qual competição buscar atletas parecidos com os titulares de {season}?
        </p>
        <div className="shadow-formation-chips previos-similar-leagues">
          {SIMILAR_TARGETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`shadow-formation-chip${target === option.id ? " active" : ""}`}
              aria-pressed={target === option.id}
              onClick={() => void choose(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      </article>

      {target ? (
        <article className="player-card previos-similar-results" aria-live="polite">
          <div className="profile-card-head">
            <h3 className="section-label">Top 5 por titular · {targetName}</h3>
            <span className="previos-similar-note">percentis de ações certas por 90</span>
          </div>
          {loading ? (
            <p className="previos-similar-hint">Calculando similares em {targetName}…</p>
          ) : failed ? (
            <p className="previos-similar-hint">
              Não foi possível calcular agora — toque na competição para tentar de novo.
            </p>
          ) : (
            <div className="previos-similar-groups">
              {starters.map(({ player, slot }) => {
                const hits = results[player.player_id] ?? [];
                return (
                  <section key={player.player_id} className="previos-similar-group">
                    <header className="previos-similar-starter">
                      <span className="previos-similar-slot">{slot}</span>
                      <div className="previos-similar-starter-copy">
                        <strong>{player.name}</strong>
                        <em>
                          {player.club} · {player.position} · {player.profile}
                        </em>
                      </div>
                    </header>
                    {hits.length ? (
                      <ul className="previos-similar-hits">
                        {hits.map((hit, index) => (
                          <li key={hit.player_id}>
                            <Link
                              className="previos-similar-hit"
                              href={leaguePath(
                                hit.league ?? (target === "estaduais" ? "est-nv1" : target),
                                `/posicao/${player.position_family}?atleta=${encodeURIComponent(hit.player_id)}`,
                              )}
                            >
                              <span className="previos-similar-rank tabular">{index + 1}</span>
                              <PlayerPhoto
                                className="previos-similar-photo"
                                src={hit.photo}
                                alt=""
                                fallback={
                                  <span className="previos-similar-photo previos-similar-fallback">
                                    {playerInitials(hit.name)}
                                  </span>
                                }
                              />
                              <span className="previos-similar-copy">
                                <strong>{hit.name}</strong>
                                <em>
                                  <ClubLogo club={hit.club} size={13} /> {hit.club} · {hit.profile}
                                </em>
                              </span>
                              <span className="previos-similar-score tabular">{hit.similarity}%</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="previos-similar-empty">Sem atletas com minutos suficientes nessa posição.</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </article>
      ) : null}
    </>
  );
}
