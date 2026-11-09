"use client";

import { useMemo, useState } from "react";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import type { LeagueId } from "@/lib/leagues";
import { formatEur, type ValorPlayer, type ValorSide, type ValorSummary } from "@/lib/valores";

type SideFilter = "todos" | ValorSide;
type SortKey = "sada" | "tm" | "ratio" | "rating";

const SIDE_META: Record<ValorSide, { label: string; hint: string }> = {
  acima: { label: "Acima do valor", hint: "produção acima do que o mercado paga" },
  neutro: { label: "Em linha", hint: "preço de mercado condiz com a produção" },
  abaixo: { label: "Abaixo do valor", hint: "preço TM carrega prêmio de reputação/potencial" },
  sem_tm: { label: "Sem valor TM", hint: "estimativa SADA preenche o mercado" },
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "sada", label: "Valor SADA" },
  { value: "tm", label: "Valor TM" },
  { value: "ratio", label: "Diferença SADA×TM" },
  { value: "rating", label: "Rating" },
];

function factorChips(player: ValorPlayer): { label: string; value: number }[] {
  const f = player.factors;
  return [
    { label: "Liga", value: Math.exp(f.league) },
    { label: "Rating", value: Math.exp(f.rating) },
    { label: "Idade", value: Math.exp(f.age) },
    { label: "Minutos", value: Math.exp(f.minutes) / 2000 ** 0.321 },
    { label: "Posição", value: Math.exp(f.position) },
    { label: "Perfil", value: Math.exp(f.profile) },
    { label: "Contrato", value: Math.exp(f.contract) },
    { label: "Carreira", value: Math.exp(f.career) },
    { label: "Reputação", value: Math.exp(f.reputation) },
  ].filter((chip) => Math.abs(chip.value - 1) > 0.02);
}

export function ValoresClient({
  leagueId,
  leagueName,
  players,
  summary,
}: {
  leagueId: LeagueId;
  leagueName: string;
  players: ValorPlayer[];
  summary: ValorSummary;
}) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("todas");
  const [profile, setProfile] = useState("todos");
  const [club, setClub] = useState("todos");
  const [side, setSide] = useState<SideFilter>("todos");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("sada");
  const [open, setOpen] = useState<string | null>(null);

  const families = useMemo(
    () =>
      [...new Set(players.map((p) => p.positionFamily).filter((f) => f != null))].sort() as string[],
    [players],
  );
  const profiles = useMemo(
    () =>
      [
        ...new Set(
          players
            .filter((p) => family === "todas" || p.positionFamily === family)
            .map((p) => p.profile)
            .filter((s): s is string => Boolean(s)),
        ),
      ].sort(),
    [players, family],
  );
  const clubs = useMemo(() => [...new Set(players.map((p) => p.club))].sort(), [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (family === "todas" || p.positionFamily === family) &&
        (profile === "todos" || p.profile === profile) &&
        (club === "todos" || p.club === club) &&
        (side === "todos" || p.side === side) &&
        p.rating >= minRating,
    );
    const by: Record<SortKey, (a: ValorPlayer, b: ValorPlayer) => number> = {
      sada: (a, b) => b.sadaValue - a.sadaValue,
      tm: (a, b) => (b.marketValueEur ?? -1) - (a.marketValueEur ?? -1),
      ratio: (a, b) => (b.ratio ?? -1) - (a.ratio ?? -1),
      rating: (a, b) => b.rating - a.rating || b.minutes - a.minutes,
    };
    return list.sort(by[sort]);
  }, [players, query, family, profile, club, side, minRating, sort]);

  return (
    <div className="scout-root profile-page">
      <ScoutTopbar active="valores" />

      <div className="saltos-page valores-page">
        <header className="saltos-hero">
          <span className="saltos-eyebrow">{leagueName} · temporada 2026</span>
          <h1>Valores SADA</h1>
          <p>
            Precificação própria por produção: rating, minutos, idade, perfil, contrato, carreira e
            reputação (seleção/exterior). O valor Transfermarkt é só a régua de comparação — quem
            produz acima dele é barganha; quem custa acima dele paga prêmio de reputação.
          </p>
        </header>

        <div className="valores-strip">
          <span>
            <strong>{summary.total}</strong> atletas
          </span>
          <span>
            <strong>{summary.comTm}</strong> com valor TM
          </span>
          <span className="valores-strip-acima">
            <strong>{summary.acima}</strong> acima do valor
          </span>
          <span className="valores-strip-abaixo">
            <strong>{summary.abaixo}</strong> abaixo do valor
          </span>
          <span>
            mediana <strong>{formatEur(summary.medianSada)}</strong>
          </span>
        </div>

        <div className="saltos-filters valores-filters">
          <label className="saltos-filter valores-filter-search">
            <span>Buscar</span>
            <input
              type="search"
              placeholder="Nome do atleta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Família</span>
            <select
              value={family}
              onChange={(e) => {
                setFamily(e.target.value);
                setProfile("todos");
              }}
            >
              <option value="todas">Todas</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Perfil</span>
            <select value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="todos">Todos</option>
              {profiles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Clube</span>
            <select value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="todos">Todos</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Ordenar</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter">
            <span>
              Rating mínimo <strong>{minRating.toFixed(1)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={7.2}
              step={0.1}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            />
          </label>
          <div className="saltos-filter saltos-filter-dest">
            <span>Mercado</span>
            <div className="saltos-seg">
              {(
                [
                  ["todos", "Todos"],
                  ["acima", "Acima"],
                  ["abaixo", "Abaixo"],
                  ["sem_tm", "Sem TM"],
                ] as [SideFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={side === value ? "active" : ""}
                  onClick={() => setSide(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className="saltos-count">{filtered.length} atletas</span>
        </div>

        <div className="valores-table-wrap">
          <table className="valores-table">
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Posição · Perfil</th>
                <th className="num">Idade</th>
                <th className="num">Rating</th>
                <th className="num">Min</th>
                <th className="num">Contrato</th>
                <th className="num">Seleção</th>
                <th className="num">Valor TM</th>
                <th className="num valores-sada-col">Valor SADA</th>
                <th className="num">Mercado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isOpen = open === p.playerId;
                return [
                  <tr
                    key={p.playerId}
                    className={`valores-row ${isOpen ? "open" : ""}`}
                    onClick={() => setOpen(isOpen ? null : p.playerId)}
                  >
                    <td>
                      <div className="valores-ath">
                        {p.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo} alt="" className="valores-photo" loading="lazy" />
                        ) : (
                          <div className="valores-photo valores-photo-empty" aria-hidden>
                            <i className="fa-solid fa-user" />
                          </div>
                        )}
                        <div>
                          <strong>{p.name}</strong>
                          <span className="valores-club">{p.club}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="valores-pos">
                        {p.position}
                        {p.profile ? <em> · {p.profile}</em> : null}
                      </span>
                    </td>
                    <td className="num">{p.age ?? "—"}</td>
                    <td className="num">{p.rating.toFixed(1)}</td>
                    <td className="num">{(p.minutes / 1000).toFixed(1).replace(".", ",")}k</td>
                    <td className="num">
                      {p.contractYears != null
                        ? p.contractYears < 1
                          ? "<1 ano"
                          : `${p.contractYears.toFixed(1).replace(".", ",")}a`
                        : "—"}
                    </td>
                    <td className="num">
                      {p.caps != null && p.caps > 0 ? (
                        <span className="valores-caps" title={p.capsTeam ?? "Seleção"}>
                          {p.caps} caps
                        </span>
                      ) : p.exAbroad ? (
                        <span className="valores-abroad" title={`Veio de ${p.exAbroad}`}>
                          ex-Ext
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num valores-tm">{formatEur(p.marketValueEur)}</td>
                    <td className="num valores-sada-col">
                      <strong>{formatEur(p.sadaValue)}</strong>
                    </td>
                    <td className="num">
                      <span className={`valores-badge valores-badge-${p.side}`} title={SIDE_META[p.side].hint}>
                        {p.side === "acima" && p.ratio != null
                          ? `▲ ${p.ratio.toFixed(1)}×`
                          : p.side === "abaixo" && p.ratio != null
                            ? `▼ ${(1 / p.ratio).toFixed(1)}×`
                            : SIDE_META[p.side].label}
                      </span>
                    </td>
                  </tr>,
                  isOpen ? (
                    <tr key={`${p.playerId}-detail`} className="valores-detail-row">
                      <td colSpan={10}>
                        <div className="valores-detail">
                          <div className="valores-factors">
                            {factorChips(p).map((chip) => (
                              <span
                                key={chip.label}
                                className={`valores-chip ${chip.value > 1 ? "up" : "down"}`}
                              >
                                {chip.label} ×{chip.value.toFixed(2).replace(".", ",")}
                              </span>
                            ))}
                          </div>
                          <div className="valores-detail-meta">
                            {p.capsTeam && p.caps != null && p.caps > 0
                              ? `Seleção ${p.capsTeam} · ${p.caps} jogos`
                              : null}
                            {p.exAbroad ? `Veio do exterior (${p.exAbroad})` : null}
                            {p.playedSerieA ? "Passagem prévia em Série A" : null}
                            {p.contractUntil ? `Contrato até ${p.contractUntil}` : "Contrato não registrado"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="scout-empty">Nenhum atleta com esses filtros.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
