"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { AT_ARCHETYPE_META, EX_ARCHETYPE_META, LAT_ARCHETYPE_META, MC_ARCHETYPE_META, ZAG_ARCHETYPE_META } from "@/lib/clusterMeta";
import { formatFoot } from "@/lib/feet";
import { playerInitials, profileGradeFromRank } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import { archetypeRank, sortedProfileShareRows } from "@/lib/profileShares";
import { playerMatchesClusterFilter } from "../ArchetypeMixCard";
import { PickerFilterMenu, type FilterOption } from "./PickerFilterMenu";
import type { PlayerProfile, PositionFamily } from "@/lib/types";

const CURRENT_YEAR = new Date().getFullYear();
const TODOS_PROFILE = "__todos__";

const AGE_BANDS: { value: string; label: string; min: number; max: number }[] = [
  { value: "u21", label: "Até 21 anos", min: 0, max: 21 },
  { value: "22-25", label: "22 a 25 anos", min: 22, max: 25 },
  { value: "26-29", label: "26 a 29 anos", min: 26, max: 29 },
  { value: "30+", label: "30 anos ou mais", min: 30, max: 200 },
];

const MINUTES_BANDS: { value: string; label: string; min: number }[] = [
  { value: "600", label: "600+ minutos", min: 600 },
  { value: "900", label: "900+ minutos", min: 900 },
  { value: "1200", label: "1.200+ minutos", min: 1200 },
  { value: "1500", label: "1.500+ minutos", min: 1500 },
];

/** Grade floors reuse the A+ → D scale shown in the Perfil card. */
const GRADE_BANDS: { value: string; label: string; allowed: string[] }[] = [
  { value: "a", label: "A- ou melhor", allowed: ["A+", "A", "A-"] },
  { value: "b", label: "B- ou melhor", allowed: ["A+", "A", "A-", "B+", "B", "B-"] },
  { value: "c", label: "C- ou melhor", allowed: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-"] },
];

const ORIGIN_OPTIONS: FilterOption[] = [
  { value: "br", label: "Brasileiros" },
  { value: "out", label: "Estrangeiros" },
];

function playerAge(player: PlayerProfile): number | null {
  return player.birth_year ? CURRENT_YEAR - player.birth_year : null;
}

type Props = {
  players: PlayerProfile[];
  family: PositionFamily;
  selectedId: string;
  onSelect: (id: string) => void;
  clusterMode?: boolean;
  clusterFilters?: string[];
  profileFilter?: string | null;
  onProfileFilterChange?: (profile: string | null) => void;
  onToggleClusterFilter?: (key: string) => void;
  onClearClusterFilters?: () => void;
  profilesAvailable?: string[];
};

export function PositionPlayerPicker({
  players,
  family,
  selectedId,
  onSelect,
  clusterMode = false,
  clusterFilters = [],
  profileFilter = null,
  onProfileFilterChange,
  onToggleClusterFilter,
  onClearClusterFilters,
  profilesAvailable = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [clubFilter, setClubFilter] = useState<string[]>([]);
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [footFilter, setFootFilter] = useState<string[]>([]);
  const [ageFilter, setAgeFilter] = useState<string[]>([]);
  const [minutesFilter, setMinutesFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  const gradeById = useMemo(() => {
    const map = new Map<string, { grade: string; label: string }>();
    for (const player of players) {
      const label = sortedProfileShareRows(player)[0]?.label;
      if (!label) continue;
      const rank = archetypeRank(player, players, label, family);
      const grade = rank ? profileGradeFromRank(rank, players.length) : null;
      if (grade) map.set(player.player_id, { grade, label });
    }
    return map;
  }, [players, family]);

  const clubOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(player.club, (counts.get(player.club) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([club, count]) => ({ value: club, label: club, club, count }));
  }, [players]);

  const positionOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
    if (counts.size < 2) return [];
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([position, count]) => ({ value: position, label: position, count }));
  }, [players]);

  const footOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const player of players) {
      const foot = formatFoot(player.foot);
      if (!foot) continue;
      counts.set(foot, (counts.get(foot) ?? 0) + 1);
    }
    if (counts.size < 2) return [];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([foot, count]) => ({ value: foot, label: foot, count }));
  }, [players]);

  const ageOptions = useMemo<FilterOption[]>(() => {
    return AGE_BANDS.map((band) => ({
      value: band.value,
      label: band.label,
      count: players.filter((player) => {
        const age = playerAge(player);
        return age != null && age >= band.min && age <= band.max;
      }).length,
    })).filter((option) => (option.count ?? 0) > 0);
  }, [players]);

  const profileFilterActive = clusterMode ? clusterFilters.length > 0 : profileFilter != null;

  const activeFilterCount =
    clubFilter.length +
    positionFilter.length +
    footFilter.length +
    ageFilter.length +
    minutesFilter.length +
    gradeFilter.length +
    originFilter.length +
    (profileFilterActive ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minMinutes = minutesFilter.length
      ? Math.min(...minutesFilter.map((value) => Number(value)))
      : 0;
    const allowedGrades = gradeFilter.length
      ? new Set(
          gradeFilter.flatMap(
            (value) => GRADE_BANDS.find((band) => band.value === value)?.allowed ?? [],
          ),
        )
      : null;

    const filtered = players.filter((player) => {
      if (clusterMode) {
        if (clusterFilters.length && !playerMatchesClusterFilter(player, clusterFilters)) return false;
      } else if (profileFilter != null && player.profile !== profileFilter) {
        return false;
      }
      if (clubFilter.length && !clubFilter.includes(player.club)) return false;
      if (positionFilter.length && !positionFilter.includes(player.position)) return false;
      if (footFilter.length && !footFilter.includes(formatFoot(player.foot) ?? "")) {
        return false;
      }
      if (ageFilter.length) {
        const age = playerAge(player);
        const inBand = ageFilter.some((value) => {
          const band = AGE_BANDS.find((item) => item.value === value);
          return band && age != null && age >= band.min && age <= band.max;
        });
        if (!inBand) return false;
      }
      if (minMinutes && player.minutes < minMinutes) return false;
      if (allowedGrades) {
        const grade = gradeById.get(player.player_id)?.grade;
        if (!grade || !allowedGrades.has(grade)) return false;
      }
      if (originFilter.length) {
        const isBrazilian = player.nationality === "Brazil";
        const matches = originFilter.some((value) =>
          value === "br" ? isBrazilian : !isBrazilian,
        );
        if (!matches) return false;
      }
      if (!q) return true;
      return player.name.toLowerCase().includes(q) || player.club.toLowerCase().includes(q);
    });

    return [...filtered].sort((a, b) => positionRating(b) - positionRating(a));
  }, [
    players,
    clusterMode,
    clusterFilters,
    profileFilter,
    clubFilter,
    positionFilter,
    footFilter,
    ageFilter,
    minutesFilter,
    gradeFilter,
    originFilter,
    gradeById,
    query,
  ]);

  /** Clicks on Perfil / Filtros (not search typing) → show top-rated athlete in the new set. */
  const pickerFilterKey = useMemo(
    () =>
      JSON.stringify({
        clusterMode,
        clusterFilters,
        profileFilter,
        clubFilter,
        positionFilter,
        footFilter,
        ageFilter,
        minutesFilter,
        gradeFilter,
        originFilter,
      }),
    [
      clusterMode,
      clusterFilters,
      profileFilter,
      clubFilter,
      positionFilter,
      footFilter,
      ageFilter,
      minutesFilter,
      gradeFilter,
      originFilter,
    ],
  );

  useEffect(() => {
    if (!visible.length) return;
    onSelect(visible[0]!.player_id);
    // visible is derived from pickerFilterKey (search query excluded)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick top rating after filter clicks
  }, [pickerFilterKey, onSelect]);

  useEffect(() => {
    if (!visible.length) return;
    if (visible.some((player) => player.player_id === selectedId)) return;
    onSelect(visible[0]!.player_id);
  }, [query, visible, selectedId, onSelect]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const card = grid.querySelector<HTMLElement>(`[data-player-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedId]);

  function toggleIn(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
    single = false,
  ) {
    setter((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      return single ? [value] : [...current, value];
    });
  }

  function clearAll() {
    setQuery("");
    setClubFilter([]);
    setPositionFilter([]);
    setFootFilter([]);
    setAgeFilter([]);
    setMinutesFilter([]);
    setGradeFilter([]);
    setOriginFilter([]);
    if (clusterMode) {
      onClearClusterFilters?.();
    } else {
      onProfileFilterChange?.(null);
    }
  }

  function scrollStrip(direction: -1 | 1) {
    const grid = gridRef.current;
    if (!grid) return;
    const step = Math.max(200, Math.round(grid.clientWidth * 0.65));
    grid.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  const archetypeFilters =
    family === "laterais"
      ? LAT_ARCHETYPE_META
      : family === "meio-campistas"
        ? MC_ARCHETYPE_META
        : family === "extremos"
          ? EX_ARCHETYPE_META
          : family === "atacantes"
            ? AT_ARCHETYPE_META
            : family === "zagueiros"
              ? ZAG_ARCHETYPE_META
              : null;

  const profileChipKeys = clusterMode && archetypeFilters
    ? archetypeFilters.map((item) => item.archetype)
    : profilesAvailable;

  const profileChips = [
    {
      key: TODOS_PROFILE,
      label: "Todos",
      active: !profileFilterActive,
      onToggle: () => {
        if (clusterMode) onClearClusterFilters?.();
        else onProfileFilterChange?.(null);
      },
    },
    ...profileChipKeys.map((key) => ({
      key,
      label: key,
      active: clusterMode ? clusterFilters.includes(key) : profileFilter === key,
      onToggle: () => {
        if (clusterMode) {
          onToggleClusterFilter?.(key);
        } else if (profileFilter === key) {
          onProfileFilterChange?.(null);
        } else {
          onProfileFilterChange?.(key);
        }
      },
    })),
  ];

  const activePills: { key: string; label: string; onRemove: () => void }[] = [
    ...(clusterMode
      ? clusterFilters.map((key) => ({
          key: `perfil-${key}`,
          label: key,
          onRemove: () => onToggleClusterFilter?.(key),
        }))
      : profileFilter
        ? [
            {
              key: `perfil-${profileFilter}`,
              label: profileFilter,
              onRemove: () => onProfileFilterChange?.(null),
            },
          ]
        : []),
    ...positionFilter.map((value) => ({
      key: `pos-${value}`,
      label: value,
      onRemove: () => toggleIn(setPositionFilter, value),
    })),
    ...footFilter.map((value) => ({
      key: `foot-${value}`,
      label: `Pé ${value.toLowerCase()}`,
      onRemove: () => toggleIn(setFootFilter, value),
    })),
    ...ageFilter.map((value) => ({
      key: `age-${value}`,
      label: AGE_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setAgeFilter, value),
    })),
    ...minutesFilter.map((value) => ({
      key: `min-${value}`,
      label: MINUTES_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setMinutesFilter, value),
    })),
    ...gradeFilter.map((value) => ({
      key: `grade-${value}`,
      label: GRADE_BANDS.find((band) => band.value === value)?.label ?? value,
      onRemove: () => toggleIn(setGradeFilter, value),
    })),
    ...originFilter.map((value) => ({
      key: `origin-${value}`,
      label: ORIGIN_OPTIONS.find((option) => option.value === value)?.label ?? value,
      onRemove: () => toggleIn(setOriginFilter, value),
    })),
    ...clubFilter.map((value) => ({
      key: `club-${value}`,
      label: value,
      onRemove: () => toggleIn(setClubFilter, value),
    })),
  ];

  return (
    <div className="player-strip player-card player-strip-expanded player-strip-slim">
      <header className="picker-head">
        <div className="picker-head-title">
          <h3 className="picker-title">Atletas</h3>
          <span className="picker-count tabular">
            <strong>{visible.length}</strong> de {players.length}
          </span>
        </div>

        <div className="picker-head-actions">
          <div className="picker-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar atleta ou clube…"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar atleta"
            />
          </div>
          <button
            type="button"
            className="picker-reset"
            onClick={clearAll}
            disabled={!activeFilterCount}
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
            Limpar
          </button>
        </div>
      </header>

      <div className="picker-toolbar">
        {profileChips.length > 1 ? (
          <div className="picker-group">
            <span className="picker-group-label">Perfil</span>
            <div className="picker-group-chips">
              {profileChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`picker-chip${chip.active ? " active" : ""}`}
                  onClick={chip.onToggle}
                  aria-pressed={chip.active}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="picker-group">
          <span className="picker-group-label">Filtros</span>
          <div className="picker-group-chips">
            {positionOptions.length ? (
              <PickerFilterMenu
                label="Posição"
                icon="fa-location-crosshairs"
                options={positionOptions}
                selected={positionFilter}
                onToggle={(value) => toggleIn(setPositionFilter, value)}
                onClear={() => setPositionFilter([])}
              />
            ) : null}
            <PickerFilterMenu
              label="Classificação"
              icon="fa-award"
              options={GRADE_BANDS.map((band) => ({ value: band.value, label: band.label }))}
              selected={gradeFilter}
              onToggle={(value) => toggleIn(setGradeFilter, value, true)}
              onClear={() => setGradeFilter([])}
              single
            />
            <PickerFilterMenu
              label="Idade"
              icon="fa-cake-candles"
              options={ageOptions}
              selected={ageFilter}
              onToggle={(value) => toggleIn(setAgeFilter, value)}
              onClear={() => setAgeFilter([])}
            />
            <PickerFilterMenu
              label="Minutagem"
              icon="fa-stopwatch"
              options={MINUTES_BANDS.map((band) => ({ value: band.value, label: band.label }))}
              selected={minutesFilter}
              onToggle={(value) => toggleIn(setMinutesFilter, value, true)}
              onClear={() => setMinutesFilter([])}
              single
            />
            {footOptions.length ? (
              <PickerFilterMenu
                label="Pé"
                icon="fa-shoe-prints"
                options={footOptions}
                selected={footFilter}
                onToggle={(value) => toggleIn(setFootFilter, value)}
                onClear={() => setFootFilter([])}
              />
            ) : null}
            <PickerFilterMenu
              label="Origem"
              icon="fa-globe"
              options={ORIGIN_OPTIONS}
              selected={originFilter}
              onToggle={(value) => toggleIn(setOriginFilter, value, true)}
              onClear={() => setOriginFilter([])}
              single
            />
            <PickerFilterMenu
              label="Clube"
              icon="fa-shield-halved"
              options={clubOptions}
              selected={clubFilter}
              onToggle={(value) => toggleIn(setClubFilter, value)}
              onClear={() => setClubFilter([])}
              align="right"
            />
          </div>
        </div>
      </div>

      {activePills.length ? (
        <div className="picker-active" aria-label="Filtros ativos">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className="picker-active-pill"
              onClick={pill.onRemove}
              aria-label={`Remover filtro ${pill.label}`}
            >
              {pill.label}
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="player-strip-body">
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(-1)}
          aria-label="Atletas anteriores"
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
        <div className="player-strip-grid-wrap">
          <div className="player-strip-rail" ref={gridRef}>
            {visible.length ? (
              visible.map((player) => (
                <PlayerStripCard
                  key={player.player_id}
                  player={player}
                  selected={player.player_id === selectedId}
                  onSelect={() => onSelect(player.player_id)}
                />
              ))
            ) : (
              <div className="player-strip-empty">
                <i className="fa-solid fa-user-slash" aria-hidden="true" />
                <p>Nenhum atleta encontrado com os filtros atuais.</p>
                <button type="button" className="picker-reset" onClick={clearAll}>
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="player-strip-arrow"
          onClick={() => scrollStrip(1)}
          aria-label="Próximos atletas"
        >
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PlayerStripCard({
  player,
  selected,
  onSelect,
}: {
  player: PlayerProfile;
  selected: boolean;
  onSelect: () => void;
}) {
  const photo = player.transfermarkt?.photo;

  return (
    <button
      type="button"
      data-player-id={player.player_id}
      className={`player-strip-card player-strip-card-slim${selected ? " selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      title={player.name}
    >
      <span className="player-strip-card-photo">
        {photo ? (
          <PlayerPhoto src={photo} alt="" loading="lazy" />
        ) : (
          <span>{playerInitials(player.name)}</span>
        )}
      </span>
      <span className="player-strip-card-name">{player.name}</span>
    </button>
  );
}
