import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily, type StatSectionTone } from "@/lib/aspectStatSections";
import type { LeagueId } from "@/lib/leagues";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

export type SimilarBlockScore = {
  title: string;
  tone: StatSectionTone;
  similarity: number;
};

export type SimilarPlayerHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  league?: LeagueId;
  photo?: string | null;
  /** Total similarity (0–100), same field as before for API consumers. */
  similarity: number;
  blocks: SimilarBlockScore[];
  debugInfo?: unknown;
};

const NEUTRAL_PERCENTILE = 50;

/**
 * Opt-in extra (toggle no modal): não é um card do dossiê, entra como bloco
 * próprio no modelo quando presente em `metricLabels`.
 */
export const PASS_DISTANCE_LABEL = "Distância de Passe";
const PASS_DISTANCE_BLOCK_TITLE = "Distância de passe";

function normName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSameAthlete(a: PlayerProfile, b: PlayerProfile): boolean {
  if (a.player_id === b.player_id) return true;
  if (normName(a.name) !== normName(b.name)) return false;
  if (a.birth_year == null || b.birth_year == null) return true;
  return Math.abs(a.birth_year - b.birth_year) <= 1;
}
/** Minimum players sharing the reference profile before profile weights kick in. */
const MIN_PROFILE_GROUP = 5;
/** Extra weight (on top of 1) for a metric where the profile sits 25 percentiles away from the median. */
const PROFILE_WEIGHT_SCALE = 1;

export function percentileInPool(value: number, pool: number[]): number {
  if (!pool.length) return NEUTRAL_PERCENTILE;
  const sorted = [...pool].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= value);
  if (idx === -1) return 100;
  return ((idx + 0.5) / sorted.length) * 100;
}

function parseDisplayNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, "");
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseEffPct(item: AspectItem): number | null {
  // efficiency_value is the success RATE ("59%") used for vencidos = vol x rate.
  // efficiency_pct is the rate's percentile within the league pool — using it
  // as a rate produces volume x percentile, a meaningless product that makes
  // dissimilar players look identical.
  const raw = item.efficiency_value?.replace("%", "").trim();
  return raw ? parseDisplayNumber(raw) : null;
}

/** Successful actions per 90 (certos / vencidos) from dossier cards. */
export function certosFeaturesForLabel(
  player: PlayerProfile,
  label: string,
): { key: string; value: number }[] {
  if (label === PASS_DISTANCE_LABEL) {
    return player.pass_distance_m != null ? [{ key: "m/passe", value: player.pass_distance_m }] : [];
  }
  const item = findAspect(flattenAspects(player), label);
  if (!item) return [];

  const subSkip = new Set(["Erros Totais", "Eficiência Defensiva", "Eficiência", "Eficiência de finalização"]);

  if (item.kind === "pass_certos" && item.certos_per90 != null) {
    return [{ key: "certos/90", value: item.certos_per90 }];
  }

  if (item.kind === "def_efficiency_group" || item.kind === "construction_share") {
    return [];
  }

  if (item.kind === "metric_group") {
    const features: { key: string; value: number }[] = [];
    const groupEff = parseEffPct(item);
    for (const sub of item.sub_metrics ?? []) {
      if (subSkip.has(sub.label) || sub.label.startsWith("Eficiência")) continue;
      const vol = parseDisplayNumber(sub.display_value);
      if (vol == null) continue;
      if (label === "Cruzamentos" && sub.label === "Cruzamentos" && groupEff != null) {
        features.push({ key: "certos/90", value: (vol * groupEff) / 100 });
      } else {
        features.push({ key: sub.label, value: vol });
      }
    }
    return features;
  }

  const duelLike = new Set([
    "Duelos Defensivos",
    "Duelos Aéreos",
    "Disputas com Bola",
    "Duelos Vencidos",
    "Aéreo",
    "1v1 - Ofensivo",
  ]);
  if (duelLike.has(label) || label.includes("Duelo")) {
    // O dossiê exibe DOIS percentis (volume e eficiência) — o modelo usa os
    // mesmos dois como features separadas; um produto vencidos/90 esconderia
    // divergências fortes (vol mediano × eficiência p10 ≈ vol alto × eff alta).
    const vol = parseDisplayNumber(item.display_value);
    const eff = parseEffPct(item);
    const features: { key: string; value: number }[] = [];
    if (vol != null) features.push({ key: "volume/90", value: vol });
    if (eff != null) features.push({ key: "eficiência", value: eff });
    return features;
  }

  if (item.certos_per90 != null) {
    return [{ key: "certos/90", value: item.certos_per90 }];
  }

  const vol = parseDisplayNumber(item.display_value);
  const eff = parseEffPct(item);
  if (vol != null && eff != null && label.includes("Criativ")) {
    return [{ key: "certos/90", value: (vol * eff) / 100 }];
  }

  if (vol != null) {
    return [{ key: "volume/90", value: vol }];
  }

  return [];
}

type BlockModel = {
  blocks: { title: string; tone: StatSectionTone; featureIds: string[] }[];
  featureIds: string[];
};

export function buildCertosModel(
  family: PositionFamily,
  pool: PlayerProfile[],
  metricLabels?: ReadonlySet<string>,
): BlockModel {
  const sections = statSectionsForFamily(family);
  const blocks: BlockModel["blocks"] = [];
  const featureIds: string[] = [];

  if (metricLabels) {
    // Seleção manual: um bloco por stat, com o próprio nome — o usuário quer
    // a % daquele stat, não uma média do bloco inteiro.
    for (const section of sections) {
      for (const label of section.labels) {
        if (label === "Eficiência Defensiva") continue;
        if (!metricLabels.has(label)) continue;
        const collected = new Set<string>();
        for (const player of pool) {
          for (const f of certosFeaturesForLabel(player, label)) {
            collected.add(`${label} · ${f.key}`);
          }
        }
        if (!collected.size) continue;
        const ids = [...collected].sort();
        blocks.push({ title: label, tone: section.tone, featureIds: ids });
        featureIds.push(...ids);
      }
    }
  } else {
    for (const section of sections) {
      const collected = new Set<string>();
      for (const label of section.labels) {
        if (label === "Eficiência Defensiva") continue;
        for (const player of pool) {
          for (const f of certosFeaturesForLabel(player, label)) {
            collected.add(`${label} · ${f.key}`);
          }
        }
      }
      if (!collected.size) continue;
      const ids = [...collected].sort();
      blocks.push({ title: section.title, tone: section.tone, featureIds: ids });
      featureIds.push(...ids);
    }
  }

  if (metricLabels?.has(PASS_DISTANCE_LABEL)) {
    const passFeatures = new Set<string>();
    for (const player of pool) {
      for (const f of certosFeaturesForLabel(player, PASS_DISTANCE_LABEL)) {
        passFeatures.add(`${PASS_DISTANCE_LABEL} · ${f.key}`);
      }
    }
    if (passFeatures.size) {
      const ids = [...passFeatures].sort();
      blocks.push({ title: PASS_DISTANCE_BLOCK_TITLE, tone: "passes", featureIds: ids });
      featureIds.push(...ids);
    }
  }
  return { blocks, featureIds: [...new Set(featureIds)] };
}

export function rawCertos(player: PlayerProfile, featureId: string): number | null {
  const sep = featureId.indexOf(" · ");
  const label = featureId.slice(0, sep);
  const subKey = featureId.slice(sep + 3);
  for (const f of certosFeaturesForLabel(player, label)) {
    if (`${label} · ${f.key}` === featureId) return f.value;
  }
  void subKey;
  return null;
}

type FeatureRow = { vec: number[]; mask: boolean[] };

function featureVector(
  player: PlayerProfile,
  pool: PlayerProfile[],
  featureIds: string[],
): FeatureRow {
  const vec = new Array<number>(featureIds.length);
  const mask = new Array<boolean>(featureIds.length);
  for (let i = 0; i < featureIds.length; i++) {
    const fid = featureIds[i]!;
    const values = pool
      .map((p) => rawCertos(p, fid))
      .filter((value): value is number => value != null);
    const raw = rawCertos(player, fid);
    if (raw != null && values.length >= 3) {
      vec[i] = Math.max(0, Math.min(1, percentileInPool(raw, values) / 100));
      mask[i] = true;
    } else {
      vec[i] = NEUTRAL_PERCENTILE / 100;
      mask[i] = false;
    }
  }
  return { vec, mask };
}

/**
 * Empirical-Bayes-style shrinkage: percentiles from small samples regress
 * toward the pool median so a 300-minute player's noisy extremes don't
 * dominate the distance. Full strength at ~900+ minutes.
 */
const SHRINK_FULL_MINUTES = 900;
const SHRINK_FLOOR = 0.35;

function shrinkFactor(minutes: number): number {
  return Math.min(1, Math.max(SHRINK_FLOOR, minutes / SHRINK_FULL_MINUTES));
}

function shrinkVector(vec: number[], minutes: number): number[] {
  const s = shrinkFactor(minutes);
  return vec.map((v) => 0.5 + (v - 0.5) * s);
}

/**
 * Posterior uncertainty of a shrunken percentile estimate, per feature.
 * A 300-minute player's regressed value is a point estimate over a wide
 * band — the distance must price that band, otherwise the shrunken mean
 * can coincide with the reference and fake a near-perfect match.
 */
function uncertaintyVec(minutes: number, sigma: number[]): number[] {
  const u = 1 - shrinkFactor(minutes);
  return sigma.map((s) => u * s);
}

/**
 * Whitened (Mahalanobis) distance on percentile vectors. Metrics in Wyscout
 * dossiers are heavily correlated — pass volume, progression and possession
 * features move together — so a plain |Δ percentile| double-counts the same
 * signal. The pool covariance de-correlates features, the standard approach
 * in club similarity engines (equivalent to kNN in a PCA-whitened space).
 */
type Matrix = number[][];

/** Ridge-regularized sample covariance of the given columns. */
function sampleCovariance(rows: number[][], indices: number[]): Matrix {
  const d = indices.length;
  const n = rows.length;
  const mean = new Array<number>(d).fill(0);
  for (const r of rows) for (let i = 0; i < d; i++) mean[i] += r[indices[i]!];
  for (let i = 0; i < d; i++) mean[i] /= n;
  const cov: Matrix = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (const r of rows) {
    for (let i = 0; i < d; i++) {
      const di = r[indices[i]!]! - mean[i]!;
      for (let j = i; j < d; j++) {
        cov[i]![j]! += di * (r[indices[j]!]! - mean[j]!);
      }
    }
  }
  let meanDiag = 0;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      cov[i]![j]! = cov[j]![i]! = cov[i]![j]! / Math.max(1, n - 1);
    }
    meanDiag += cov[i]![i]!;
  }
  meanDiag = meanDiag / d || 1;
  for (let i = 0; i < d; i++) cov[i]![i]! += meanDiag * 0.2;
  return cov;
}

/** Gauss-Jordan inverse with partial pivoting; null when singular. */
function invertMatrix(m: Matrix): Matrix | null {
  const d = m.length;
  const aug = m.map((row, i) => {
    const out = [...row];
    for (let j = 0; j < d; j++) out.push(i === j ? 1 : 0);
    return out;
  });
  for (let col = 0; col < d; col++) {
    let pivot = col;
    for (let r = col + 1; r < d; r++) {
      if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(aug[pivot]![col]!) < 1e-9) return null;
    [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
    const inv = 1 / aug[col]![col]!;
    for (let j = 0; j < 2 * d; j++) aug[col]![j]! *= inv;
    for (let r = 0; r < d; r++) {
      if (r === col) continue;
      const factor = aug[r]![col]!;
      if (!factor) continue;
      for (let j = 0; j < 2 * d; j++) aug[r]![j]! -= factor * aug[col]![j]!;
    }
  }
  return aug.map((row) => row.slice(d));
}

/**
 * Squared whitened distance restricted to `indices`, with per-feature
 * profile weights applied to the difference vector. Falls back to plain
 * weighted Euclidean (on pooled variances) when inversion fails.
 */
function whitenedDistance2(
  a: number[],
  b: number[],
  weights: number[],
  inv: Matrix | null,
  indices: number[],
  diagVar: number[],
  unc2?: number[],
  srcMask?: boolean[],
  candMask?: boolean[],
): number {
  const wDiff = indices.map((i) => weights[i]! * (a[i]! - b[i]!));
  let s: number;
  if (!inv) {
    s = 0;
    for (let k = 0; k < indices.length; k++) {
      s += (wDiff[k]! * wDiff[k]!) / Math.max(diagVar[k]!, 1e-4);
    }
  } else {
    s = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = 0; j < indices.length; j++) {
        s += wDiff[i]! * inv[i]![j]! * wDiff[j]!;
      }
    }
    s = Math.max(0, s);
  }
  // tr(Σ⁻¹ · Σ_unc): distância esperada sob a incerteza da amostra encolhida.
  if (unc2) {
    for (let k = 0; k < indices.length; k++) {
      const fid = indices[k]!;
      if (!srcMask?.[fid] && !candMask?.[fid]) continue;
      const u2 = weights[fid]! * weights[fid]! * unc2[fid]!;
      s += inv ? u2 * inv[k]![k]! : u2 / Math.max(diagVar[k]!, 1e-4);
    }
  }
  return s;
}

/**
 * Gaussian kernel on the whitened distance: for a random pair the expected
 * squared distance is ~2·nFeatures, so bandwidth 2·nf maps a median pair to
 * ~37 and close stylistic matches to 80+.
 */
function distanceToSimilarity(d2: number, nFeatures: number): number {
  if (!nFeatures) return 0;
  return Math.max(0, Math.min(100, 100 * Math.exp(-d2 / (2 * nFeatures))));
}

/**
 * Metrics that define the reference profile weigh more: for players of the same profile
 * in the pool, how far their average percentile sits from the median (50).
 */
function profileWeights(source: PlayerProfile, vectors: Map<string, number[]>, pool: PlayerProfile[], size: number): number[] {
  const group = pool.filter((p) => p.profile && p.profile === source.profile && p.player_id !== source.player_id);
  if (group.length < MIN_PROFILE_GROUP) return Array(size).fill(1);
  return Array.from({ length: size }, (_, i) => {
    const mean = group.reduce((sum, p) => sum + (vectors.get(p.player_id)?.[i] ?? 0.5), 0) / group.length;
    return 1 + (PROFILE_WEIGHT_SCALE * Math.abs(mean - 0.5)) / 0.25;
  });
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Similarity from **successful actions per 90** (certos / vencidos) as percentiles in the
 * target pool, grouped by dossier stat blocks. Distances use a whitened (Mahalanobis)
 * metric over the pool covariance so correlated metrics don't double-count; vectors are
 * shrunk toward the median by minutes played and the distance adds the posterior
 * variance of that shrinkage (tr Σ⁻¹Σ_unc), so thin samples can't fake agreement —
 * the score is a Gaussian kernel on the squared distance (profile-defining metrics
 * weigh more, coverage-scaled).
 */
export function rankCrossLeagueSimilarity(
  source: PlayerProfile,
  targetPool: PlayerProfile[],
  options: {
    limit?: number;
    minMinutes?: number;
    leagueOf?: (p: PlayerProfile) => LeagueId | undefined;
    /** Pool da liga do atleta de referência — percentis do source são
     *  calculados no próprio contexto dele (mesma régua do dossiê), não na
     *  pool alvo; sem isso, ligas com níveis diferentes fabricam concordância. */
    sourcePool?: PlayerProfile[];
    debug?: boolean;
    /** Restrict the distance model to these dossier aspect labels (e.g. "Duelos Defensivos"). */
    metricLabels?: string[];
    /**
     * Família do pool/modelo: por padrão a do atleta. Passando outra família
     * (ex.: lateral → extremos) o source é pontuado contra a pool alvo —
     * base da "tradução de posição".
     */
    targetFamily?: PositionFamily;
  } = {},
): SimilarPlayerHit[] {
  const limit = options.limit ?? 5;
  const minMinutes = options.minMinutes ?? 300;
  const debug = options.debug === true;
  const family = options.targetFamily ?? source.position_family;

  const sameFamily = targetPool.filter(
    (p) => p.position_family === family && p.minutes >= minMinutes,
  );
  if (!sameFamily.length) return [];

  const metricFilter = options.metricLabels?.length ? new Set(options.metricLabels) : undefined;
  const { blocks, featureIds } = buildCertosModel(family, sameFamily, metricFilter);
  if (!featureIds.length) return [];

  const allIdx = featureIds.map((_, i) => i);
  const blockRanges = blocks.map((block) => ({
    title: block.title,
    tone: block.tone,
    indices: block.featureIds
      .map((id) => featureIds.indexOf(id))
      .filter((index) => index >= 0),
  }));

  // Percentis na liga de origem de cada atleta — a régua que o dossiê mostra.
  // Candidatos agrupados por liga (pool único ⇒ uma liga só).
  const poolByLeague = new Map<LeagueId | undefined, PlayerProfile[]>();
  for (const p of sameFamily) {
    const lg = options.leagueOf?.(p);
    const arr = poolByLeague.get(lg) ?? [];
    arr.push(p);
    poolByLeague.set(lg, arr);
  }
  const ownPool = (p: PlayerProfile): PlayerProfile[] =>
    poolByLeague.get(options.leagueOf?.(p)) ?? sameFamily;
  const sourcePool = options.sourcePool?.length ? options.sourcePool : sameFamily;

  const sourceRaw = featureVector(source, sourcePool, featureIds);
  const sourceVec = shrinkVector(sourceRaw.vec, source.minutes);
  const rawRows = new Map(sameFamily.map((p) => [p.player_id, featureVector(p, ownPool(p), featureIds)]));
  const vectors = new Map(
    sameFamily.map((p) => [p.player_id, shrinkVector(rawRows.get(p.player_id)!.vec, p.minutes)]),
  );
  const vecMapForWeights = new Map(sameFamily.map((p) => [p.player_id, vectors.get(p.player_id)!]));
  const weights = profileWeights(source, vecMapForWeights, sameFamily, featureIds.length);

  const allRows = [...vectors.values()];
  const globalCov = sampleCovariance(allRows, allIdx);
  const globalInv = invertMatrix(globalCov);
  const globalDiag = allIdx.map((i) => globalCov[i]![i]!);
  const blockInv = blockRanges.map(({ indices }) =>
    indices.length ? invertMatrix(sampleCovariance(allRows, indices)) : null,
  );

  const sigma = allIdx.map((i) => Math.sqrt(Math.max(globalCov[i]![i]!, 1e-6)));
  const srcUnc = uncertaintyVec(source.minutes, sigma);

  const scored: SimilarPlayerHit[] = [];

  for (const candidate of sameFamily) {
    if (isSameAthlete(candidate, source)) continue;

    const candVec = vectors.get(candidate.player_id)!;
    const candMask = rawRows.get(candidate.player_id)!.mask;
    const covered = allIdx.filter((i) => sourceRaw.mask[i] || candMask[i]);
    const candUnc = uncertaintyVec(candidate.minutes, sigma);
    const unc2 = allIdx.map((i) => srcUnc[i]! * srcUnc[i]! + candUnc[i]! * candUnc[i]!);
    const totalD2 = whitenedDistance2(
      sourceVec,
      candVec,
      weights,
      globalInv,
      allIdx,
      globalDiag,
      unc2,
      sourceRaw.mask,
      candMask,
    );
    const total = distanceToSimilarity(totalD2, Math.max(1, covered.length));

    const blockScores: SimilarBlockScore[] = blockRanges.map(({ title, tone, indices }, bi) => {
      const blockCovered = indices.filter((i) => sourceRaw.mask[i] || candMask[i]);
      if (!indices.length || !blockCovered.length) return { title, tone, similarity: NEUTRAL_PERCENTILE };
      const blockDiag = indices.map((i) => globalCov[i]![i]!);
      const d2 = whitenedDistance2(
        sourceVec,
        candVec,
        weights,
        blockInv[bi]!,
        indices,
        blockDiag,
        unc2,
        sourceRaw.mask,
        candMask,
      );
      return { title, tone, similarity: round1(distanceToSimilarity(d2, blockCovered.length)) };
    });

    scored.push({
      player_id: candidate.player_id,
      name: candidate.name,
      club: candidate.club,
      profile: candidate.profile,
      rating: candidate.rating,
      league: options.leagueOf?.(candidate),
      similarity: round1(total),
      blocks: blockScores,
      debugInfo: debug
        ? {
            featureIds,
            sourceVec,
            sourceMask: sourceRaw.mask,
            candVec,
            candMask,
            weights,
            covered,
            totalD2,
            blockDiag: blockRanges.map(({ indices }) => indices.map((i) => globalCov[i]![i]!)),
            raws: Object.fromEntries(
              featureIds.map((fid) => [fid, { s: rawCertos(source, fid), c: rawCertos(candidate, fid) }]),
            ),
          }
        : undefined,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);
  return scored.slice(0, limit);
}
