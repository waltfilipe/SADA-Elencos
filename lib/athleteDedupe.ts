/**
 * "Resumo" do atleta na temporada: o mesmo atleta pode ter linha em duas
 * competições (ex.: Paulistão + Série A) com player_ids distintos. Na busca
 * global e na lista de clubes, mostramos uma entrada só por pessoa —
 * valorizando a competição nacional e, em empate, os minutos jogados.
 *
 * Clubes seguem a mesma ideia: sempre pela competição nacional; a entrada
 * estadual só aparece para quem não tem liga nacional A/B/C (Série D e
 * estaduais contam como "só estadual" para o clube).
 */

import type { LeagueId } from "./leagues";
import type { PlayerSearchRow } from "./types";

/** Ordem para o ATLETA: nacional primeiro (inclui a D), depois estaduais. */
export const PLAYER_LEAGUE_RANK: Record<LeagueId, number> = {
  "serie-a": 0,
  "serie-b": 1,
  "serie-c": 2,
  "serie-d": 3,
  "est-nv1": 4,
  "est-nv2": 5,
  "est-nv3": 6,
  "est-nv4": 7,
};

/**
 * Ordem para o CLUBE: A/B/C sempre; estadual para quem só joga estadual ou
 * Série D (a D fica por último — o clube aparece pelo estadual quando tem).
 */
export const CLUB_LEAGUE_RANK: Record<LeagueId, number> = {
  "serie-a": 0,
  "serie-b": 1,
  "serie-c": 2,
  "est-nv1": 3,
  "est-nv2": 4,
  "est-nv3": 5,
  "est-nv4": 6,
  "serie-d": 7,
};

type RowIdentity = Pick<PlayerSearchRow, "player_id"> &
  Partial<Pick<PlayerSearchRow, "athlete_id" | "person_key" | "minutes" | "sourceLeague">>;

/** Chave canônica da pessoa — athlete_id primeiro, person_key/row como fallback. */
export function athleteRowKey(row: RowIdentity): string {
  return row.athlete_id ?? row.person_key ?? row.player_id;
}

export type DedupedRow<T> = T & {
  /** Outras competições em que o atleta tem linha (para o hint da UI). */
  alsoIn?: { league: LeagueId; minutes: number }[];
};

function rowRank(row: RowIdentity): number {
  return row.sourceLeague ? (PLAYER_LEAGUE_RANK[row.sourceLeague] ?? 50) : 50;
}

/**
 * Dedupe por pessoa: linha canônica = melhor competição nacional; empate por
 * minutos. Anexa `alsoIn` com as outras competições para o resumo visual.
 */
export function dedupeAthleteRows<T extends RowIdentity>(rows: T[]): DedupedRow<T>[] {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = athleteRowKey(row);
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }
  const out: DedupedRow<T>[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => rowRank(a) - rowRank(b) || (b.minutes ?? 0) - (a.minutes ?? 0),
    );
    const best = sorted[0]!;
    out.push({
      ...best,
      alsoIn: sorted.slice(1).map((row) => ({
        league: row.sourceLeague!,
        minutes: row.minutes ?? 0,
      })),
    });
  }
  return out;
}

type ClubOptionLike = { club: string; leagueId: LeagueId; count: number };

/**
 * Dedupe de clubes por nome: a melhor entrada nacional vence; estadual fica
 * só para quem não disputa A/B/C (Série D conta como "só estadual").
 */
export function dedupeClubOptions<T extends ClubOptionLike>(options: T[]): T[] {
  const fold = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const best = new Map<string, T>();
  for (const option of options) {
    const key = fold(option.club);
    const current = best.get(key);
    if (!current) {
      best.set(key, option);
      continue;
    }
    const rank = (CLUB_LEAGUE_RANK[option.leagueId] ?? 50) - (CLUB_LEAGUE_RANK[current.leagueId] ?? 50);
    if (rank < 0 || (rank === 0 && option.count > current.count)) best.set(key, option);
  }
  return [...best.values()];
}
