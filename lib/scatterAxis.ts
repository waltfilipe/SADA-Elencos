import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import type { AspectItem, AspectSubMetric, PlayerProfile, PositionFamily } from "@/lib/types";

/**
 * Aspect `efficiency_pct` is a pool percentile. The success rate lives in
 * `efficiency_value` ("55%") or in a percent sub-metric. Volume `display_value`
 * is already per 90 except for the season totals listed below.
 */
const SEASON_TOTALS = new Set([
  "gols",
  "xg",
  "xa",
  "pré assistências",
  "pre assistências",
  "assistências",
  "assistencias",
  "erros totais",
]);

const PREFERRED_SUB: Record<string, string> = {
  Progressão: "Conduções Progressivas",
  "Pré Assistências e xA": "Pré Assistências",
  Distribuição: "Passes",
  Finalizações: "Finalizações",
  "Gols e xG": "Gols",
  Ofensividade: "Ações Ofensivas",
  "Ações Terminais": "Ações Ofensivas",
  Verticalidade: "Recepção de Passes Longos",
  Efetividade: "Finalizações certas / passe recebido",
  Cruzamentos: "Cruzamentos",
};

export type ScatterAxis = {
  value: number;
  label: string;
};

/** Display aliases for source sub-metric names. */
const SUB_LABEL_ALIASES: Record<string, string> = {
  "Assistências para remate": "Passes Chave",
};

function statLabel(label: string): string {
  return SUB_LABEL_ALIASES[label] ?? label;
}

/** Finds a numeric sub-metric by label (e.g. "Passes", "Rebatidas", "Toques na área"). */
function findSubMetric(items: AspectItem[], label: string): AspectSubMetric | undefined {
  const clean = label.replace(/\/90$/, "");
  for (const item of items) {
    for (const sub of item.sub_metrics ?? []) {
      if ((sub.label === clean || statLabel(sub.label) === clean) && parseNumber(sub.display_value) != null) return sub;
    }
  }
  return undefined;
}

/** Sub-metric carrying a rate ("Finalizações certas / passe recebido" → "11%"). */
function findRateSubMetric(items: AspectItem[], label: string): AspectSubMetric | undefined {
  for (const item of items) {
    for (const sub of item.sub_metrics ?? []) {
      if (sub.label === label && parseSuccessRate(sub.display_value) != null) return sub;
    }
  }
  return undefined;
}

/** Sub-metric carrying a signed value ("Gols - xG" → "+0,4"). */
function findSignedSubMetric(items: AspectItem[], label: string): AspectSubMetric | undefined {
  for (const item of items) {
    for (const sub of item.sub_metrics ?? []) {
      if (sub.label === label && parseSigned(sub.display_value) != null) return sub;
    }
  }
  return undefined;
}

function parseNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || text === "—" || text.includes("%") || /^[+\-−]/.test(text)) return null;
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseSigned(raw?: string | null): number | null {
  if (!raw) return null;
  const text = raw.trim().replace("−", "-").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseSuccessRate(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value / 100 : null;
}

function per90(value: number, label: string, minutes: number): number {
  if (!SEASON_TOTALS.has(label.trim().toLowerCase())) return value;
  const exposure = minutes / 90;
  if (exposure <= 0) return 0;
  return value / exposure;
}

function volumeLabel(label: string): string {
  if (label.includes("/") || label.includes("%") || /\/90$/.test(label)) return label;
  if (/^efici[eê]ncia/i.test(label)) return label;
  if (SEASON_TOTALS.has(label.trim().toLowerCase())) return label;
  return `${label}/90`;
}

/** Label de eixo para volumes de sucesso — "vencidos/certos" é subentendido. */
export function successAxisLabel(label: string): string {
  return volumeLabel(label);
}

function alreadyWon(label: string): boolean {
  return /vencid/i.test(label);
}

function successRate(item: AspectItem): number | null {
  const direct = parseSuccessRate(item.efficiency_value);
  if (direct != null) return direct;
  for (const sub of item.sub_metrics ?? []) {
    const rate = parseSuccessRate(sub.display_value);
    if (rate == null) continue;
    if (/efici|certa|sucesso|ganh|vencid/i.test(sub.label)) return rate;
  }
  return null;
}

function volumeSubs(item: AspectItem): AspectSubMetric[] {
  return (item.sub_metrics ?? []).filter((sub) => {
    if (parseSuccessRate(sub.display_value) != null) return false;
    if (/^efici/i.test(sub.label)) return false;
    return parseNumber(sub.display_value) != null;
  });
}

function chosenSub(item: AspectItem, subs: AspectSubMetric[]): AspectSubMetric | undefined {
  const preferred = PREFERRED_SUB[item.label];
  if (preferred) return subs.find((sub) => sub.label === preferred) ?? subs[0];
  return subs[0];
}

function volumeOnlyLabel(parent: string, subLabel: string): string {
  // Totais de temporada não levam sufixo /90 (o valor é o acumulado do ano).
  if (SEASON_TOTALS.has(subLabel.trim().toLowerCase())) return statLabel(subLabel);
  if (parent === "Progressão") return "Conduções Progressivas/90";
  if (parent === "Pré Assistências e xA") return "Pré Assistências/90";
  if (parent === "Distribuição") return "Passes/90";
  if (parent === "Gols e xG") return "Gols/90";
  if ((parent === "Ofensividade" || parent === "Ações Terminais") && /ações ofensivas/i.test(subLabel)) {
    return "Ações Ofensivas/90";
  }
  if (/toques na área/i.test(subLabel)) return "Toques na Área/90";
  if (parent === "Verticalidade") return "Recepção de Passes Longos/90";
  if (parent === "Finalizações") return "Finalizações/90";
  if (parent === "Efetividade") return subLabel;
  return volumeLabel(subLabel === parent ? parent : subLabel);
}

function sumPer90(subs: AspectSubMetric[], minutes: number): number {
  return subs.reduce((total, sub) => {
    const raw = parseNumber(sub.display_value) ?? 0;
    // Totais de temporada somam o acumulado; volumes já chegam em /90.
    return total + (SEASON_TOTALS.has(sub.label.trim().toLowerCase()) ? raw : per90(raw, sub.label, minutes));
  }, 0);
}

export function scatterAxis(player: PlayerProfile, key: string): ScatterAxis {
  const items = flattenAspects(player);
  const minutes = player.minutes ?? 0;

  // Eixo composto: "Stat A||Stat B" soma os valores resolvidos de cada parte.
  if (key.includes("||")) {
    const parts = key.split("||");
    const axes = parts.map((part) => scatterAxis(player, part));
    return {
      value: axes.reduce((sum, axis) => sum + axis.value, 0),
      label: axes.map((axis) => axis.label).join(" + "),
    };
  }

  // Assistências = total da temporada (fora dos aspectos).
  if (key === "Assistências") return { value: player.assists ?? 0, label: "Assistências" };

  // Meias ofensivos: total defensivo virtual = duelos + ações defensivas.
  if (key === "Ações Defensivas Totais") {
    const duels = findAspect(items, "Duelos Vencidos") ?? findAspect(items, "Duelos Defensivos");
    const actions = findAspect(items, "Ações Defensivas");
    const duelsVal = parseNumber(duels?.display_value);
    const subs = actions?.sub_metrics ?? [];
    const actionsVal = subs.length
      ? subs.reduce((sum, sub) => sum + (parseNumber(sub.display_value) ?? 0), 0)
      : parseNumber(actions?.display_value);
    if (duelsVal == null && actionsVal == null) return { value: 0, label: "Ações Defensivas/90" };
    return { value: (duelsVal ?? 0) + (actionsVal ?? 0), label: "Ações Defensivas/90" };
  }

  // Sub-metric axes resolve first so "Passes" hits Distribuição→Passes and not
  // the "Passes Progressivos" item via prefix match.
  const subHit = findSubMetric(items, key);
  if (subHit) {
    // Valor já vem na unidade do label: totais (xA, Gols…) exibem o acumulado,
    // volumes exibem a taxa por 90 — sem dividir pela exposição.
    const value = parseNumber(subHit.display_value)!;
    return { value, label: volumeLabel(statLabel(subHit.label)) };
  }

  const item = findAspect(items, key);
  if (!item) {
    // "Eficiência <aspecto>" → taxa de sucesso do aspecto (0–100).
    const effMatch = key.match(/^Eficiência (.+)$/);
    if (effMatch) {
      const effItem = findAspect(items, effMatch[1]);
      if (effItem) {
        const rate = successRate(effItem);
        if (rate != null) return { value: rate * 100, label: key };
      }
    }
    // Sub-métrica percentual ("Finalizações certas / passe recebido").
    const rateSub = findRateSubMetric(items, key);
    if (rateSub) return { value: parseSuccessRate(rateSub.display_value)! * 100, label: statLabel(rateSub.label) };
    // Sub-métrica assinada ("Gols - xG").
    const signedSub = findSignedSubMetric(items, key);
    if (signedSub) return { value: parseSigned(signedSub.display_value)!, label: statLabel(signedSub.label) };
    return { value: player.scatter[key] ?? 0, label: volumeLabel(key) };
  }

  if (item.kind === "def_efficiency_group" || item.label === "Eficiência Defensiva") {
    const score = item.sub_metrics?.find((sub) =>
      /efici[eê]ncia defensiva|[íi]ndice de efici[eê]ncia/i.test(sub.label),
    );
    return { value: parseSigned(score?.display_value) ?? 0, label: "Eficiência Defensiva" };
  }

  if (alreadyWon(item.label)) {
    const won = parseNumber(item.display_value);
    if (won != null) return { value: won, label: successAxisLabel(item.label) };
  }

  const rate = successRate(item);
  const subs = volumeSubs(item);

  if (!subs.length) {
    const raw = parseNumber(item.display_value) ?? item.certos_per90 ?? null;
    if (raw == null) return { value: 0, label: volumeLabel(item.label) };
    const base = raw;
    if (rate != null) return { value: base * rate, label: successAxisLabel(item.label) };
    return { value: base, label: volumeLabel(item.label) };
  }

  if (item.label.startsWith("Ações Defensivas")) {
    return { value: sumPer90(subs, minutes), label: volumeLabel(item.label) };
  }

  if (item.label === "Passes Chave e Área") {
    return { value: sumPer90(subs, minutes), label: "Passes Chave e Área/90" };
  }

  const sub = chosenSub(item, subs);
  if (!sub) return { value: 0, label: volumeLabel(item.label) };
  // Totais de temporada (label sem /90) mantêm o acumulado; volumes viram taxa por 90.
  const rawSub = parseNumber(sub.display_value) ?? 0;
  const base = SEASON_TOTALS.has(sub.label.trim().toLowerCase()) ? rawSub : per90(rawSub, sub.label, minutes);
  if (rate != null) return { value: base * rate, label: successAxisLabel(item.label) };
  return { value: base, label: volumeOnlyLabel(item.label, sub.label) };
}

export function scatterAxisLabel(players: PlayerProfile[], key: string): string {
  for (const player of players) {
    const axis = scatterAxis(player, key);
    if (/\/90$/.test(axis.label) && /vencid|sucesso|cert/i.test(axis.label)) return axis.label;
  }
  const sample = players.find((player) => findAspect(flattenAspects(player), key)) ?? players[0];
  return sample ? scatterAxis(sample, key).label : volumeLabel(key);
}

export type FamilyStat = {
  /** Chave resolvível por scatterAxis (label bruto do aspecto/sub ou chave virtual). */
  key: string;
  /** Rótulo exibido (auto-descritivo: "Passes Progressivos Certos/90", "Gols"). */
  label: string;
  value: number | null;
  kind: "stat" | "efficiency" | "score" | "total";
  /** Título da seção da página de posição (agrupa o picker do scatter). */
  section: string;
};

/**
 * Stats da posição: mesmas métricas que as seções da página de posição
 * (statSectionsForFamily), desagrupadas — volumes em certos/90 (via scatterAxis),
 * eficiências em 0–100, scores assinados e totais de temporada (Gols, xG, xA,
 * Assistências, Pré Assistências). Fonte única para sliders de filtros e eixos
 * do scatter — garante coerência página ↔ scatter ↔ filtros.
 */
export function familySectionStats(player: PlayerProfile, family: PositionFamily): FamilyStat[] {
  const items = flattenAspects(player);
  const stats: FamilyStat[] = [];
  const seen = new Set<string>();
  const push = (entry: FamilyStat) => {
    if (entry.value == null || seen.has(entry.key)) return;
    seen.add(entry.key);
    stats.push(entry);
  };
  const isExtremos = family === "extremos";

  for (const section of statSectionsForFamily(family)) {
    // Assistências vivem fora dos aspectos (total da temporada) — entram como
    // stat de criação nas famílias que exibem o bloco de passes finais.
    if (section.tone === "finais" || section.tone === "finalizacao") {
      push({
        key: "Assistências",
        label: "Assistências",
        value: player.assists ?? null,
        kind: "total",
        section: section.title,
      });
    }
    for (const label of section.labels) {
      const item = findAspect(items, label);
      if (!item) continue;

      // Meias ofensivos: "Ações Defensivas" vira o total (duelos + rebatidas +
      // interceptações + chutes bloqueados) — chave virtual resolvida em scatterAxis.
      if (isExtremos && section.tone === "defensivos" && item.label === "Ações Defensivas") {
        const axis = scatterAxis(player, "Ações Defensivas Totais");
        push({ key: "Ações Defensivas Totais", label: axis.label, value: axis.value, kind: "stat", section: section.title });
        continue;
      }

      // Meias ofensivos: duelos defensivos vencidos exibidos como "Duelos Defensivos".
      const displayLabel = isExtremos && item.label === "Duelos Vencidos" ? "Duelos Defensivos" : item.label;

      const isDefScore = item.kind === "def_efficiency_group" || item.label === "Eficiência Defensiva";
      const axis = scatterAxis(player, item.label);
      const isTotal = SEASON_TOTALS.has(item.label.trim().toLowerCase());
      push({
        key: item.label,
        label: isExtremos && item.label === "Duelos Vencidos" ? "Duelos Defensivos/90" : axis.label,
        value: axis.value,
        kind: isDefScore ? "score" : isTotal ? "total" : "stat",
        section: section.title,
      });

      const rate = successRate(item);
      if (rate != null && item.efficiency_pct != null && !isDefScore) {
        push({
          key: `Eficiência ${item.label}`,
          label: `Eficiência ${displayLabel}`,
          value: rate * 100,
          kind: "efficiency",
          section: section.title,
        });
      }

      for (const sub of item.sub_metrics ?? []) {
        const subRate = parseSuccessRate(sub.display_value);
        if (subRate != null) {
          push({ key: sub.label, label: statLabel(sub.label), value: subRate * 100, kind: "efficiency", section: section.title });
          continue;
        }
        const numeric = parseNumber(sub.display_value);
        if (numeric != null) {
          const subIsTotal = SEASON_TOTALS.has(sub.label.trim().toLowerCase());
          push({
            key: sub.label,
            label: subIsTotal ? statLabel(sub.label) : volumeLabel(statLabel(sub.label)),
            // Totais de temporada exibem o acumulado (label sem /90); os demais
            // subs já vêm como taxa por 90 — sem dividir pela exposição.
            value: numeric,
            kind: subIsTotal ? "total" : "stat",
            section: section.title,
          });
          continue;
        }
        const signed = parseSigned(sub.display_value);
        if (signed != null && /^[+\-−]/.test((sub.display_value ?? "").trim())) {
          push({ key: sub.label, label: statLabel(sub.label), value: signed, kind: "score", section: section.title });
        }
      }
    }
  }
  return stats;
}

/**
 * Flattens a profile's aspects into numeric stats for per-stat filtering.
 * Keys are self-describing: "Duelos Defensivos/90", "Eficiência Passes
 * Progressivos" (0–100), "Eficiência Defensiva" (signed score). Metric groups
 * emit each numeric sub-metric; %-subs roll up to the group's efficiency stat.
 */
export function aspectFilterStats(player: PlayerProfile): Record<string, number> {
  const out: Record<string, number> = {};

  const setOnce = (key: string, value: number) => {
    if (!(key in out)) out[key] = value;
  };

  for (const item of flattenAspects(player)) {
    if (item.kind === "construction_share") continue;

    if (item.kind === "def_efficiency_group" || item.label === "Eficiência Defensiva") {
      for (const sub of item.sub_metrics ?? []) {
        const numeric = parseNumber(sub.display_value);
        if (numeric != null) {
          setOnce(volumeLabel(sub.label), numeric);
          continue;
        }
        const signed = parseSigned(sub.display_value);
        if (signed != null && /^[+\-−]/.test((sub.display_value ?? "").trim())) {
          setOnce(sub.label, signed);
        }
      }
      continue;
    }

    const direct = parseNumber(item.display_value) ?? item.certos_per90 ?? null;
    if (direct != null) setOnce(volumeLabel(item.label), direct);

    const directRate =
      parseSuccessRate(item.efficiency_value) ?? parseSuccessRate(item.display_value);
    if (directRate != null) setOnce(`Eficiência ${item.label}`, directRate * 100);

    for (const sub of item.sub_metrics ?? []) {
      const subRate = parseSuccessRate(sub.display_value);
      if (subRate != null) {
        const key = /^%|^efici[eê]ncia/i.test(sub.label) ? sub.label : `Eficiência ${item.label}`;
        setOnce(key, subRate * 100);
        continue;
      }
      const numeric = parseNumber(sub.display_value);
      if (numeric != null) {
        setOnce(volumeLabel(statLabel(sub.label)), numeric);
        continue;
      }
      const signed = parseSigned(sub.display_value);
      if (signed != null && /^[+\-−]/.test((sub.display_value ?? "").trim())) {
        setOnce(statLabel(sub.label), signed);
      }
    }
  }

  return out;
}
