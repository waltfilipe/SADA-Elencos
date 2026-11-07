import type { LeagueId } from "./leagues";

export type PositionFamily =
  | "zagueiros"
  | "laterais"
  | "meio-campistas"
  | "extremos"
  | "atacantes";

export type AspectStat = {
  label: string;
  percentile: number;
};

export type AccuracyBadgeKind = "gold" | "silver" | "bronze";

export type AspectSubMetric = {
  label: string;
  percentile: number;
  display_value?: string;
  efficiency_pct?: number;
  efficiency_value?: string | null;
};

export type AspectItem = {
  label: string;
  grade: string;
  stats: AspectStat[];
  /** Expandable metric card. */
  kind?: "default" | "pass_certos" | "metric" | "metric_group" | "def_efficiency_group" | "construction_share";
  certos_per90?: number;
  percentile?: number;
  display_value?: string;
  /** Player share % for construction profile bars. */
  share_pct?: number;
  /** Position pool average share % (bar center). */
  pool_avg_pct?: number;
  /** Max % shown on the construction bar scale. */
  scale_max_pct?: number;
  /** Gradient bar variant for perfil de construção. */
  bar_key?: "pass_tendency" | "progressive_share" | "def_contact_style" | "def_foul_style";
  axis_left?: string;
  axis_right?: string;
  efficiency_pct?: number;
  efficiency_value?: string | null;
  /** @deprecated computed in UI from volume + efficiency percentiles */
  accuracy_badge?: AccuracyBadgeKind | null;
  /** Nested rows for Eficiência Defensiva group. */
  sub_metrics?: AspectSubMetric[];
  /** Header badge pair: ações c/ êxito × eficiência def. */
  pair_badge?: number[] | null;
};

export type TransfermarktInfo = {
  id: string | null;
  photo: string | null;
  market_value: string | null;
  market_value_eur: number | null;
  contract_until: string | null;
  contract_remaining: string | null;
  on_loan_from?: string | null;
  club: string | null;
  profile_url: string | null;
} | null;

import type { PositionCluster, ZagArchetype, ZagCluster, ZagClusterShares, ZagArchetypeRatings } from "@/lib/clusterMeta";

export type { PositionCluster, ZagArchetype, ZagCluster, ZagClusterShares, ZagArchetypeRatings };

export type PlayerSummary = {
  player_id: string;
  /** Id estável do registro cross-temporada (ath-XXXXXX) — join canônico entre ligas/anos. */
  athlete_id?: string | null;
  /** Chave derivada da resolução de identidade (debug/rastreio). */
  person_key?: string | null;
  name: string;
  club: string;
  label: string;
  position: string;
  position_family: PositionFamily;
  nationality: string | null;
  birth_year: number | null;
  height: number | null;
  foot: string | null;
  minutes: number;
  /** Share of competition minutes relative to the season leader in the pool (0–100). */
  minutes_pct?: number | null;
  rating: number;
  profile: string;
  hybrid_lean?: string | null;
  cluster?: PositionCluster | null;
  transfermarkt?: TransfermarktInfo;
};

export type Tendencies = {
  construcao: number;
  ofensividade: number;
  def1v1: number;
  contencao: number;
  duelo_aereo: number;
};

/** Summary enriched with the fields the advanced search needs to filter on. */
export type PlayerSearchRow = PlayerSummary & {
  /** Set on cross-league views (ex.: elenco / time sombra). */
  sourceLeague?: LeagueId;
  goals: number;
  assists: number;
  tendencies: Tendencies;
  /** Stat badges earned on the position page. */
  badges: string[];
  /** Numeric axes already used by scatter, so filters can sort without the full profile. */
  scatter?: Record<string, number>;
  /** Flat aspect stats for per-stat filtering ("Duelos Defensivos/90", "Eficiência X" 0–100, signed scores). */
  stats?: Record<string, number>;
  /** Downsampled touch map for the filter-card preview. */
  heatmap?: PlayerHeatmapData;
};

export type PlayerHeatmapData = {
  tournament_id?: number;
  season_id?: number;
  scope?: string;
  competition?: string | null;
  point_count?: number;
  points: { x: number; y: number; w?: number }[];
  image_url?: string | null;
};

export type PlayerPhysicalRun = {
  source?: string;
  competition?: string;
  position_pool: string;
  position_pool_size: number;
  matches: number;
  minutes: number;
  kilometers_p90: number;
  top_speed: number;
  sprints_p90: number;
  running_km_p90: number;
  high_speed_km_p90: number;
  sprinting_km_p90: number;
  percentiles: Partial<
    Record<
      | "kilometers_p90"
      | "top_speed"
      | "sprints_p90"
      | "running_km_p90"
      | "high_speed_km_p90"
      | "sprinting_km_p90",
      number
    >
  >;
  ranks: Partial<
    Record<
      | "kilometers_p90"
      | "top_speed"
      | "sprints_p90"
      | "running_km_p90"
      | "high_speed_km_p90"
      | "sprinting_km_p90",
      number
    >
  >;
};

export type CrossSeasonMetricPrior = {
  /** Ridge prediction of the athlete's per-90 level (or % rate). */
  predicted: number;
  /** Leave-one-out RMSE of the ridge model for this metric (out-of-sample error of `predicted`). */
  resid_sd?: number;
  /** Mean nineties of the seasons used to train the model (observation noise inside resid_sd). */
  train_n90?: number;
  role_change_flag?: boolean;
};

export type CrossSeasonProjection = {
  seasons: { year: string; league: string; minutes: number; club?: string }[];
  metrics: Record<string, CrossSeasonMetricPrior>;
};

/** Uma mudança de clube do atleta entre passagens consecutivas (person_key). */
export type TransferLeg = {
  from_club: string;
  from_league?: string | null;
  from_season?: string | null;
  to_club: string;
  to_league?: string | null;
  to_season?: string | null;
  /** ISO date from Transfermarkt; null = janela da temporada apenas. */
  date?: string | null;
  fee?: string | null;
  kind?: "permanent" | "loan" | "free" | "return";
};

/**
 * Saída do atleta do clube exibido nesta linha — ele deixou a competição/clube
 * (transferência durante ou após a temporada, inclusive para o exterior).
 */
export type PlayerDeparture = {
  to_club: string;
  to_league?: string | null;
  to_season?: string | null;
  date?: string | null;
  fee?: string | null;
  kind?: "permanent" | "loan" | "free" | "return";
};

export type SeasonMetaProfile = {
  label: string;
  share: number;
  rank: number | null;
  grade: string | null;
};

export type SeasonMeta = {
  pool_size: number;
  profiles: SeasonMetaProfile[];
};

export type DisciplineInfo = {
  fouls_per90: number | null;
  fouls_total: number | null;
  yellow_per90: number;
  yellow_total: number;
  red_per90: number;
  red_total: number;
  pool?: {
    fouls_per90?: number;
    yellow_per90?: number;
    red_per90?: number;
  };
};

export type PlayerProfile = PlayerSummary & {
  cross_season?: CrossSeasonProjection;
  /** Comprimento médio de passes (m) — entrada opcional de similaridade, fora dos cards do dossiê. */
  pass_distance_m?: number | null;
  /** Clube real do atleta nesta liga quando a linha usa clube-artefato do export (ex.: "Grêmio" na B-2026 → exibe CRB). */
  display_club?: string | null;
  /** Presente quando esta linha é a última passagem do atleta pelo clube (ele saiu). */
  departure?: PlayerDeparture | null;
  /** Filled by /api/player-season for the peek popup. */
  season_meta?: SeasonMeta;
  /** Jogador médio sintético (/api/avg-player) — temporadas combinadas na média. */
  media_seasons?: string[];
  goals: number;
  assists: number;
  heatmap?: PlayerHeatmapData;
  physical_run?: PlayerPhysicalRun;
  ratings: {
    geral: number;
    [profileKey: string]: number;
  };
  ranks: {
    geral: number;
    [profileKey: string]: number;
  };
  profile_shares: Record<string, number>;
  tendencies: Tendencies;
  aspects: {
    defensivos?: AspectItem[];
    aereo?: AspectItem[];
    construcao: AspectItem[];
    perfil_construcao?: AspectItem[];
    perfil_defensivo?: AspectItem[];
    ofensivos?: AspectItem[];
    terco_final?: AspectItem[];
    passes_finais?: AspectItem[];
    conducao_drible?: AspectItem[];
    finalizacao?: AspectItem[];
    ofensividade?: AspectItem[];
  };
  profiles_available: string[];
  scatter: Record<string, number>;
  discipline?: DisciplineInfo;
};

export type SiteMeta = {
  league_id?: string;
  league: string;
  season: string;
  source: string;
  heatmaps_enabled?: boolean;
  physical_run_enabled?: boolean;
  player_count: number;
  families: {
    key: PositionFamily;
    label: string;
    positions: string[];
    profiles: string[];
    count: number;
  }[];
  clubs: string[];
  nationalities: string[];
  filters: {
    height: [number, number];
    minutes: [number, number];
    birth_year: [number, number];
    rating: [number, number];
  };
  scatter_metrics: Record<PositionFamily, { key: string; label: string; field: string }[]>;
};
