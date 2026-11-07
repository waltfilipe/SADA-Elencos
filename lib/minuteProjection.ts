/**
 * Minute projection for scouts (empirical Bayes + cross-season ridge prior).
 *
 *   posterior = (y · n90 + μ · k) / (n90 + k),   k = σ² / τ²
 * σ² = per-90 sampling variance, τ² = between-athlete variance of the true level, both estimated
 * from the division pool (low-minute vs regular players). μ is the per-metric ridge prediction
 * (Wyscout 2022–2025, leave-one-out validated) when the athlete has history; otherwise
 * μ = 50% titulares + 50% mesmo perfil na divisão. With a ridge μ, τ² is the ridge LOO error
 * minus the sampling noise it contains, so k reflects how good the individual prior is.
 * role_change_flag caps effective n90 so short noisy samples regress to μ.
 * Pessimista / otimista are the 10% / 90% quantiles of the posterior of the true level:
 * log-normal for rates (never negative), logit-normal for percentages (stay in 0–100), normal for
 * signed z-scores.
 */
import { isSeasonTotalLabel } from "@/lib/seasonTotals";
import type { AspectItem, PlayerProfile } from "@/lib/types";

export type ProjectionScenario = "negativa" | "realista" | "positiva";

export type ProjectionPlacement = {
  /** Share of the estimate from the player's own sample, 0–1 (1 − pull toward μ). */
  weight: number;
  scenario: ProjectionScenario;
};

export type RealisticProjection = ProjectionPlacement & {
  profile: PlayerProfile;
};

/** How much the observed per-90 / % rates are trusted vs the mixed prior. */
export type ProjectionReliability = {
  /** Mean share of the estimate from the player's own minutes (0–1). */
  sampleWeight: number;
  /** Human label for scouts. */
  tier: "baixa" | "media" | "alta";
  /** Average % drop on volume/efficiency lines already above the mixed prior (hot streak). */
  hotStreakRegressionPct: number | null;
  /** Metrics where current season looks like noise vs prior seasons (low minutes). */
  roleChangeFlags: number;
  crossSeasonSeasons: number;
};

export type MinuteProjectionReport = {
  negativa: RealisticProjection;
  realista: RealisticProjection;
  positiva: RealisticProjection;
  reliability: ProjectionReliability;
};

const Z90 = 1.2815515655446004;
const MIN_GROUP = 8;
const MIN_METRICS = 3;
const FALLBACK_N0 = 4;
/** Prior strength k = σ²/τ² is kept inside this range of nineties. */
const K_FLOOR = 8;
/** Priors cap at ~20 games of evidence, so a regular's own season outweighs history. */
const K_MAX = 20;
const N0_FLOOR = 8;
const N0_MAX = 20;
/** The ridge prior can never claim to know the true level better than this share of its LOO variance. */
const TAU_CS_FLOOR_FRAC = 0.25;
const STARTER_MINUTES_PCT = 50;

/** Share bars (pass tendency) are pool percents, not per-90 rates — projection stays on volume/efficiency metrics. */
const SKIP_KINDS = new Set(["construction_share"]);

type Prior = {
  mu: number;
  /** Between-athlete variance of the true level around μ. */
  tau2: number;
  /** Per-90 sampling variance (variance of an observed rate is sigma2 / n90). */
  sigma2: number;
  n0: number;
  /** EB prior strength in nineties: σ² / τ². */
  kEb: number;
  refRates: number[];
  /** Mean nineties of the regulars. Used to write a predicted season count. */
  refExposure: number;
  /** Whether μ came from cross-season supervised model. */
  muFromCrossSeason?: boolean;
};

type MetricKind = "rate" | "percent";

type MetricFit = {
  key: string;
  y: number;
  prior: Prior;
  /** Observed rates of players with at least half the minutes, sorted. */
  referenceRates: number[];
  kind: MetricKind;
  rank: boolean;
  sample: string;
  adverse?: boolean;
  /** Signed z-score metric: interval stays symmetric. */
  signed?: boolean;
  seasonCount?: boolean;
  /** Low-minute 2026 diverges from stable cross-season history — trust anchor over spike. */
  roleChangeFlag?: boolean;
};

type BuiltModel = {
  exposure: number;
  metrics: MetricFit[];
  target: PlayerProfile;
};

type Sample = {
  key: string;
  value: number;
  kind: MetricKind;
  rank: boolean;
  sample: string;
  /** Lower is the generous reading. A short sample below the mean is pulled up. */
  adverse?: boolean;
  /** Observed value is a season count. The fit uses a per-90 rate and the display writes an integer total. */
  seasonCount?: boolean;
  signed?: boolean;
};

type PoolPoint = {
  e: number;
  value: number;
  low: boolean;
  profile: string | null;
};

const modelCache = new WeakMap<PlayerProfile[], Map<string, BuiltModel | null>>();

export function isProjectionEligible(player: { minutes?: number | null; minutes_pct?: number | null }): boolean {
  return (player.minutes ?? 0) > 0 && player.minutes_pct != null && player.minutes_pct < STARTER_MINUTES_PCT;
}

export function projectionPlacement(
  player: PlayerProfile,
  players: PlayerProfile[],
  scenario: ProjectionScenario,
): ProjectionPlacement | null {
  const model = modelFor(player, players);
  if (!model) return null;
  return placementFrom(model, scenario);
}

/** Realistic per-90 profile with minutes-based shrink toward division prior. Percentiles vs regulars (≥50% min). */
export function realisticProjection(player: PlayerProfile, players: PlayerProfile[]): RealisticProjection | null {
  return scenarioProjection(player, players, "realista");
}

/** Full scout readout: expected line plus 80% bands (pessimista / otimista) and a confidence summary. */
export function minuteProjectionReport(
  player: PlayerProfile,
  players: PlayerProfile[],
): MinuteProjectionReport | null {
  const model = modelFor(player, players);
  if (!model) return null;

  const negativa = buildScenario(model, player, "negativa");
  const realista = buildScenario(model, player, "realista");
  const positiva = buildScenario(model, player, "positiva");

  return {
    negativa,
    realista,
    positiva,
    reliability: reliabilityFrom(model, realista.weight),
  };
}

function scenarioProjection(
  player: PlayerProfile,
  players: PlayerProfile[],
  scenario: ProjectionScenario,
): RealisticProjection | null {
  const model = modelFor(player, players);
  if (!model) return null;
  return buildScenario(model, player, scenario);
}

function buildScenario(model: BuiltModel, player: PlayerProfile, scenario: ProjectionScenario): RealisticProjection {
  const placement = placementFrom(model, scenario);
  return {
    ...placement,
    profile: applyProjectedMetrics(player, projectedMetrics(model, scenario)),
  };
}

function modelFor(player: PlayerProfile, players: PlayerProfile[]): BuiltModel | null {
  if (!isProjectionEligible(player)) return null;
  let byPlayer = modelCache.get(players);
  if (!byPlayer) {
    byPlayer = new Map();
    modelCache.set(players, byPlayer);
  }
  const cached = byPlayer.get(player.player_id);
  if (cached !== undefined) return cached;
  const built = buildModel(player, players);
  byPlayer.set(player.player_id, built);
  return built;
}

function placementFrom(model: BuiltModel, scenario: ProjectionScenario): ProjectionPlacement {
  const projected = projectedMetrics(model, scenario);
  const weights: number[] = [];
  for (const metric of model.metrics) {
    if (!metric.rank) continue;
    const hit = projected.get(metric.key);
    if (hit) weights.push(hit.weight);
  }
  return {
    weight: weights.length ? mean(weights) : observationWeight(model.target.minutes_pct ?? 0),
    scenario,
  };
}

function projectedMetrics(model: BuiltModel, scenario: ProjectionScenario): Map<string, ProjectedMetric> {
  const projected = new Map<string, ProjectedMetric>();
  for (const metric of model.metrics) {
    const next = projectRate(metric.y, model.exposure, metric.prior, scenario, metric.kind, metric.signed, metric.roleChangeFlag);
    const value = metric.kind === "percent" ? clamp(next.value, 0, 100) : next.value;
    const standing = midrankPercentile(value, metric.referenceRates);
    projected.set(metric.key, {
      value,
      weight: next.weight,
      percentile: metric.adverse ? 100 - standing : standing,
      kind: metric.kind,
      sample: metric.sample,
      adverse: metric.adverse,
      seasonCount: metric.seasonCount,
      refExposure: metric.prior.refExposure,
    });
  }
  return projected;
}

function buildModel(player: PlayerProfile, players: PlayerProfile[]): BuiltModel | null {
  const samplesById = new Map<string, Sample[]>();
  const samplesOfId = (candidate: PlayerProfile) => {
    let samples = samplesById.get(candidate.player_id);
    if (!samples) {
      samples = samplesOf(candidate);
      samplesById.set(candidate.player_id, samples);
    }
    return samples;
  };

  const target = samplesOfId(player);
  const rankedTarget = target.filter((sample) => sample.rank);
  if (rankedTarget.length < MIN_METRICS) return null;

  const observations = new Map<string, PoolPoint[]>();
  for (const sample of target) observations.set(sample.key, []);

  for (const candidate of players) {
    const minutes = candidate.minutes ?? 0;
    if (minutes <= 0 || candidate.minutes_pct == null) continue;
    const exposure = minutes / 90;
    const low = candidate.minutes_pct < STARTER_MINUTES_PCT;
    const byKey = new Map(samplesOfId(candidate).map((sample) => [sample.key, sample]));
    for (const sample of target) {
      const found = byKey.get(sample.key);
      if (!found) continue;
      observations.get(sample.key)!.push({
        e: exposure,
        value: found.value,
        low,
        profile: candidate.profile ?? null,
      });
    }
  }

  const metrics: MetricFit[] = [];
  for (const sample of target) {
    const points = observations.get(sample.key) ?? [];
    const basePrior = fitPrior(points, player.profile ?? null);
    if (!basePrior) continue;
    const resolved = resolveM7Prior(basePrior, player, sample.key);
    metrics.push({
      key: sample.key,
      y: sample.value,
      prior: resolved.prior,
      referenceRates: [...resolved.prior.refRates].sort((a, b) => a - b),
      kind: sample.kind,
      rank: sample.rank,
      sample: sample.sample,
      adverse: sample.adverse,
      signed: sample.signed,
      seasonCount: sample.seasonCount,
      roleChangeFlag: resolved.roleChangeFlag,
    });
  }
  if (metrics.filter((metric) => metric.rank).length < MIN_METRICS) return null;

  return {
    exposure: player.minutes / 90,
    metrics,
    target: player,
  };
}

/** Share kept from the player's sample; pull toward μ is 1 − this (linear in minutes to 50% of team total). */
export function observationWeight(minutesPct: number): number {
  if (minutesPct >= STARTER_MINUTES_PCT) return 1;
  if (minutesPct <= 0) return 0;
  return clamp(minutesPct / STARTER_MINUTES_PCT, 0, 1);
}

/** Fraction of the gap (observed → μ) applied; equals minutes missing to 50%, divided by 50. */
export function pullTowardPrior(minutesPct: number): number {
  return 1 - observationWeight(minutesPct);
}

function profilesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function samplesOf(player: PlayerProfile): Sample[] {
  const exposure = (player.minutes ?? 0) / 90;
  const samples: Sample[] = [];
  for (const items of Object.values(player.aspects ?? {})) {
    if (!items) continue;
    for (const item of items) samples.push(...samplesFromAspect(item, exposure));
  }
  return samples;
}

function samplesFromAspect(item: AspectItem, exposure: number): Sample[] {
  if (item.kind === "def_efficiency_group") {
    const out: Sample[] = [];
    for (const sub of item.sub_metrics ?? []) {
      if (/erro/i.test(sub.label)) {
        const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure);
        if (sample) out.push(sample);
        continue;
      }
      if (/efici[eê]ncia/i.test(sub.label)) {
        const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure, { zScore: true });
        if (sample) out.push({ ...sample, rank: true });
      }
    }
    return out;
  }
  if (SKIP_KINDS.has(item.kind ?? "")) return [];
  const samples: Sample[] = [];
  const subs = item.sub_metrics ?? [];
  if (subs.length) {
    for (const sub of subs) {
      const sample = sampleFrom(item.label, sub.label, sub.display_value, exposure);
      if (sample) samples.push(sample);
    }
  } else {
    const sample = sampleFrom(null, item.label, item.display_value, exposure);
    if (sample) samples.push(sample);
  }
  if (item.efficiency_value) {
    const sample = sampleFrom(item.label, "Eficiência", item.efficiency_value, exposure);
    if (sample) samples.push({ ...sample, rank: true });
  }
  return samples;
}

function sampleFrom(
  parent: string | null,
  label: string,
  display: string | null | undefined,
  exposure: number,
  options?: { zScore?: boolean },
): Sample | null {
  const raw = (display ?? "").trim();
  if (!raw) return null;
  const key = parent ? `${parent}::${label}` : label;
  const normalized = label.trim().toLowerCase();
  if (!options?.zScore && raw.startsWith("+")) return null;
  const adverse = /erro/.test(normalized);
  const seasonCount = isSeasonTotalLabel(label);

  if (raw.includes("%")) {
    const value = parsePercent(raw);
    if (value == null) return null;
    return { key, value, kind: "percent", rank: true, sample: raw };
  }

  const parsed = options?.zScore ? parseSignedRate(raw) : parseRate(raw);
  if (parsed == null) return null;
  if (seasonCount || adverse) {
    if (exposure <= 0) return null;
    return { key, value: parsed / exposure, kind: "rate", rank: false, sample: raw, adverse, seasonCount };
  }
  if (options?.zScore) {
    return { key, value: parsed, kind: "rate", rank: true, sample: raw, signed: true };
  }
  if (!isVolumeLabel(label)) return null;
  return { key, value: parsed, kind: "rate", rank: true, sample: raw };
}

type ProjectedMetric = {
  value: number;
  weight: number;
  percentile: number;
  kind: MetricKind;
  sample: string;
  adverse?: boolean;
  seasonCount?: boolean;
  refExposure?: number;
};

function applyProjectedMetrics(player: PlayerProfile, projected: Map<string, ProjectedMetric>): PlayerProfile {
  const clone = structuredClone(player);
  for (const items of Object.values(clone.aspects ?? {})) {
    if (!items) continue;
    for (const item of items) {
      const own = projected.get(item.label);
      if (own && !item.sub_metrics?.length) {
        item.display_value = formatProjected(own);
        item.percentile = round1(own.percentile);
      }
      const efficiency = projected.get(`${item.label}::Eficiência`);
      if (efficiency && item.efficiency_value) {
        item.efficiency_value = formatProjected(efficiency);
        item.efficiency_pct = round1(efficiency.percentile);
      }
      for (const sub of item.sub_metrics ?? []) {
        const hit = projected.get(`${item.label}::${sub.label}`);
        if (!hit) continue;
        sub.display_value = formatProjected(hit);
        sub.percentile = round1(hit.percentile);
      }
    }
  }
  return clone;
}

function formatProjected(metric: ProjectedMetric): string {
  if (metric.kind === "percent") return `${Math.round(metric.value)}%`;
  if (metric.adverse || metric.seasonCount) {
    const count = metric.value * (metric.refExposure || 1);
    const rounded = Math.round(count);
    return String(metric.adverse ? rounded : Math.max(0, rounded));
  }
  const fraction = metric.sample.split(",")[1];
  const decimals = fraction ? Math.min(2, Math.max(1, fraction.length)) : 1;
  const formatted = metric.value.toFixed(decimals).replace(".", ",");
  if (metric.sample.trim().startsWith("-") || metric.sample.trim().startsWith("−")) {
    return metric.value < 0 ? formatted : `-${formatted}`;
  }
  return formatted;
}

function ebShrink(rate: number, n90: number, mu: number, k: number): number {
  const denom = n90 + k;
  if (denom <= 0) return mu;
  return (rate * n90 + mu * k) / denom;
}

/** Prior for one metric: ridge μ + its own τ² when the athlete has history, else the division prior. */
function resolveM7Prior(
  base: Prior,
  player: PlayerProfile,
  sampleKey: string,
): { prior: Prior; roleChangeFlag?: boolean } {
  const cross = player.cross_season?.metrics?.[sampleKey];
  if (!cross || !Number.isFinite(cross.predicted)) return { prior: base };
  const prior: Prior = { ...base, mu: cross.predicted, muFromCrossSeason: true };
  const resid = cross.resid_sd;
  const trainN90 = cross.train_n90;
  if (resid != null && resid > 0 && trainN90 != null && trainN90 > 0) {
    const looVar = resid * resid;
    const tau2 = Math.max(looVar - base.sigma2 / trainN90, looVar * TAU_CS_FLOOR_FRAC);
    prior.tau2 = tau2;
    prior.kEb = clamp(base.sigma2 / tau2, K_FLOOR, K_MAX);
  }
  return { prior, roleChangeFlag: cross.role_change_flag === true };
}

function fitPrior(points: PoolPoint[], targetProfile: string | null): Prior | null {
  const pool = points.filter((point) => point.e > 0);
  if (pool.length < MIN_GROUP) return null;

  const ref = pool.filter((point) => !point.low);
  const refPool = ref.length >= MIN_GROUP ? ref : pool;
  const refRates = refPool.map((point) => point.value);
  const refExposure = mean(refPool.map((point) => point.e));

  const muMean = weightedMean(
    refPool.map((point) => point.value),
    refPool.map((point) => point.e),
  );

  let peerPool = pool.filter((point) => profilesMatch(point.profile, targetProfile));
  if (peerPool.length < MIN_GROUP) {
    peerPool = refPool;
  }
  const muPeer = weightedMean(
    peerPool.map((point) => point.value),
    peerPool.map((point) => point.e),
  );

  const mu = 0.5 * muMean + 0.5 * muPeer;

  const msdRef = meanSquare(refRates);
  const invRef = weightedMean(
    refPool.map((point) => 1 / point.e),
    refPool.map((point) => point.e),
  );

  let tau2 = 0;
  let n0 = FALLBACK_N0;
  let sigma2Est = 0;

  const low = pool.filter((point) => point.low);
  if (low.length >= MIN_GROUP && msdRef > 0) {
    const msdLow = meanSquare(low.map((point) => point.value));
    const invLow = weightedMean(
      low.map((point) => 1 / point.e),
      low.map((point) => point.e),
    );
    const denom = invLow - invRef;
    const sigma2 = denom > 1e-6 ? (msdLow - msdRef) / denom : -1;
    if (sigma2 > 0) {
      const tau = msdRef - sigma2 * invRef;
      if (tau > 1e-8) {
        tau2 = tau;
        sigma2Est = sigma2;
        n0 = clamp(sigma2 / tau2, N0_FLOOR, N0_MAX);
      }
    }
  }

  if (!(tau2 > 0)) {
    n0 = FALLBACK_N0;
    const factor = weightedMean(
      refPool.map((point) => (point.e + n0) / point.e),
      refPool.map((point) => point.e),
    );
    tau2 = msdRef > 0 && factor > 0 ? msdRef / factor : 0;
  }
  if (!(tau2 > 0) || !Number.isFinite(mu)) return null;

  const k = clamp(n0, N0_FLOOR, N0_MAX);
  return {
    mu,
    tau2,
    sigma2: sigma2Est > 0 ? sigma2Est : k * tau2,
    n0: k,
    kEb: k,
    refRates,
    refExposure,
  };
}

function projectRate(
  y: number,
  exposure: number,
  prior: Prior,
  scenario: ProjectionScenario,
  kind: MetricKind = "rate",
  signed = false,
  roleChangeFlag = false,
): { value: number; weight: number } {
  const k = prior.kEb;
  let n90 = Math.max(exposure, 0);
  if (roleChangeFlag) n90 = Math.max(n90 * 0.5, 0.35);
  const posteriorMean = ebShrink(y, n90, prior.mu, k);
  const weight = n90 / (n90 + k);
  if (scenario === "realista") return { value: posteriorMean, weight };
  const sd = Math.sqrt(Math.max(prior.tau2 * (1 - weight), 0));
  return { value: posteriorQuantile(posteriorMean, sd, scenario === "negativa" ? -Z90 : Z90, kind, signed), weight };
}

/**
 * Quantile of the posterior of the true level. The posterior is skewed and bounded, so the interval
 * is built on a transformed scale: log for non-negative rates, logit for percentages.
 */
function posteriorQuantile(mean: number, sd: number, z: number, kind: MetricKind, signed: boolean): number {
  if (!(sd > 0)) return mean;
  if (kind === "percent") {
    const p = clamp(mean, 0.5, 99.5) / 100;
    const sdLogit = sd / (100 * p * (1 - p));
    const logit = Math.log(p / (1 - p)) + z * sdLogit;
    return 100 / (1 + Math.exp(-logit));
  }
  if (signed) return mean + z * sd;
  if (mean <= 1e-9) return Math.max(0, mean + z * sd);
  const sdLog = Math.sqrt(Math.log(1 + (sd / mean) ** 2));
  return mean * Math.exp(z * sdLog - (sdLog * sdLog) / 2);
}

function reliabilityFrom(model: BuiltModel, sampleWeight: number): ProjectionReliability {
  let hotSum = 0;
  let hotN = 0;
  for (const metric of model.metrics) {
    if (metric.adverse || metric.seasonCount || !metric.rank) continue;
    if (metric.y <= metric.prior.mu + 1e-9) continue;
    const n90 = model.exposure;
    const k = metric.prior.kEb;
    const projected = ebShrink(metric.y, n90, metric.prior.mu, k);
    hotSum += (metric.y - projected) / metric.y;
    hotN += 1;
  }

  const roleChangeFlags = model.metrics.filter((metric) => metric.roleChangeFlag).length;
  const crossSeasonSeasons = model.target.cross_season?.seasons?.length ?? 0;

  return {
    sampleWeight,
    tier: confidenceTier(sampleWeight),
    hotStreakRegressionPct: hotN ? (hotSum / hotN) * 100 : null,
    roleChangeFlags,
    crossSeasonSeasons,
  };
}

export function confidenceTier(sampleWeight: number): ProjectionReliability["tier"] {
  if (sampleWeight >= 0.45) return "alta";
  if (sampleWeight >= 0.25) return "media";
  return "baixa";
}

export function confidenceTierLabel(tier: ProjectionReliability["tier"]): string {
  if (tier === "alta") return "Confiança alta na amostra";
  if (tier === "media") return "Confiança média — a regressão ainda puxa para o prior histórico/divisão";
  return "Confiança baixa — poucos minutos; a leitura é dominada pelo prior (histórico de temporadas quando houver)";
}

function isVolumeLabel(label: string | undefined): boolean {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized || normalized.includes("%") || normalized.includes("/")) return false;
  if (/erro|efici[eê]ncia/.test(normalized)) return false;
  return !isSeasonTotalLabel(label ?? "");
}

function parseRate(display: string): number | null {
  const normalized = display.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseSignedRate(display: string): number | null {
  const normalized = display.replace(/\s/g, "").replace("−", "-").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parsePercent(display: string): number | null {
  return parseRate(display.replace("%", ""));
}

function midrankPercentile(value: number, sorted: number[]): number {
  const count = sorted.length;
  if (!count) return 50;
  let below = 0;
  let high = count;
  while (below < high) {
    const mid = (below + high) >> 1;
    if (sorted[mid] < value) below = mid + 1;
    else high = mid;
  }
  let end = below;
  high = count;
  while (end < high) {
    const mid = (end + high) >> 1;
    if (sorted[mid] <= value) end = mid + 1;
    else high = mid;
  }
  return ((below + 0.5 * (end - below)) / count) * 100;
}

function mean(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function weightedMean(values: number[], weights: number[]): number {
  let total = 0;
  let mass = 0;
  for (let i = 0; i < values.length; i += 1) {
    const w = weights[i] ?? 0;
    total += values[i] * w;
    mass += w;
  }
  return mass > 0 ? total / mass : mean(values);
}

function meanSquare(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  let total = 0;
  for (const value of values) {
    const delta = value - center;
    total += delta * delta;
  }
  return total / (values.length - 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
