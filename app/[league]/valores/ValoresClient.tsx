"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { LEAGUES, type LeagueId } from "@/lib/leagues";
import { formatEur, type ValorPlayer, type ValorSide, type ValorSummary } from "@/lib/valores";

type SideFilter = "todos" | ValorSide;
type SortKey =
  | "name"
  | "position"
  | "age"
  | "rating"
  | "minutes"
  | "contract"
  | "caps"
  | "tm"
  | "sada"
  | "ratio"
  | "resale";

const SIDE_META: Record<ValorSide, { label: string; hint: string }> = {
  acima: { label: "Acima do valor", hint: "produção acima do que o mercado paga" },
  neutro: { label: "Em linha", hint: "preço de mercado condiz com a produção" },
  abaixo: { label: "Abaixo do valor", hint: "preço TM carrega prêmio de reputação/potencial" },
  sem_tm: { label: "Sem valor TM", hint: "estimativa SADA preenche o mercado" },
};

const SORT_DIR_DEFAULT: Record<SortKey, 1 | -1> = {
  name: 1,
  position: 1,
  age: 1,
  rating: -1,
  minutes: -1,
  contract: -1,
  caps: -1,
  tm: -1,
  sada: -1,
  ratio: -1,
  resale: -1,
};

function sortValue(player: ValorPlayer, key: SortKey): string | number {
  switch (key) {
    case "name":
      return player.name.toLowerCase();
    case "position":
      return player.position;
    case "age":
      return player.age ?? 999;
    case "rating":
      return player.rating;
    case "minutes":
      return player.minutes;
    case "contract":
      return player.contractYears ?? -1;
    case "caps":
      return player.caps ?? -1;
    case "tm":
      return player.marketValueEur ?? -1;
    case "sada":
      return player.sadaValue;
    case "ratio":
      return player.ratio ?? -1;
    case "resale":
      return player.resaleScore ?? -1;
  }
}

function factorChips(player: ValorPlayer): { label: string; value: number }[] {
  const f = player.factors;
  return [
    { label: "Liga", value: Math.exp(f.league) },
    { label: "Rating", value: Math.exp(f.rating) },
    { label: "Idade", value: Math.exp(f.age) },
    { label: "Minutos", value: Math.exp(f.minutes) / 2000 ** 0.296 },
    { label: "Posição", value: Math.exp(f.position) },
    { label: "Perfil", value: Math.exp(f.profile) },
    { label: "Contrato", value: Math.exp(f.contract) },
    { label: "Carreira", value: Math.exp(f.career) },
    { label: "Reputação", value: Math.exp(f.reputation) },
    { label: "Clube", value: Math.exp(f.club) },
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("todas");
  const [profile, setProfile] = useState("todos");
  const [side, setSide] = useState<SideFilter>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("sada");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [open, setOpen] = useState<string | null>(null);

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position))].sort(),
    [players],
  );
  const profiles = useMemo(
    () =>
      [
        ...new Set(
          players
            .filter((p) => position === "todas" || p.position === position)
            .map((p) => p.profile)
            .filter((s): s is string => Boolean(s)),
        ),
      ].sort(),
    [players, position],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(SORT_DIR_DEFAULT[key]);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          (!q || p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q)) &&
          (position === "todas" || p.position === position) &&
          (profile === "todos" || p.profile === profile) &&
          (side === "todos" || p.side === side),
      )
      .sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp =
          typeof va === "string"
            ? va.localeCompare(vb as string, "pt-BR")
            : va - (vb as number);
        return cmp * sortDir;
      });
  }, [players, query, position, profile, side, sortKey, sortDir]);

  function th(key: SortKey, label: string, numeric = true) {
    const active = sortKey === key;
    return (
      <th
        className={`valores-th ${numeric ? "num" : ""} ${active ? "sorted" : ""}`}
        onClick={() => toggleSort(key)}
        aria-sort={active ? (sortDir === 1 ? "ascending" : "descending") : undefined}
      >
        {label}
        <span className="valores-sort-arrow">{active ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
      </th>
    );
  }

  return (
    <div className="scout-root profile-page">
      <ScoutTopbar active="valores" />

      <div className="saltos-page valores-page">
        <header className="saltos-hero">
          <span className="saltos-eyebrow">{leagueName} · temporada 2026</span>
          <h1>Valores SADA</h1>
          <p>
            Modelo v4 espelho de mercado: rating, minutos, idade, posição, perfil medido por
            família, contrato, carreira, reputação e vitrine do clube. O valor Transfermarkt é a
            régua de comparação — quem produz acima dele é barganha. A coluna Revenda estima a
            chance de o atleta subir de divisão ou ir ao exterior na próxima temporada.
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
              placeholder="Nome ou clube…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Série</span>
            <select value={leagueId} onChange={(e) => router.push(`/${e.target.value}/valores`)}>
              {LEAGUES.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Posição</span>
            <select
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                setProfile("todos");
              }}
            >
              <option value="todas">Todas</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
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
                {th("name", "Atleta", false)}
                {th("position", "Posição · Perfil", false)}
                {th("age", "Idade")}
                {th("rating", "Rating")}
                {th("minutes", "Min")}
                {th("contract", "Contrato")}
                {th("caps", "Seleção")}
                {th("tm", "Valor TM")}
                <th
                  className={`valores-th num valores-sada-col ${sortKey === "sada" ? "sorted" : ""}`}
                  onClick={() => toggleSort("sada")}
                  aria-sort={sortKey === "sada" ? (sortDir === 1 ? "ascending" : "descending") : undefined}
                >
                  Valor SADA
                  <span className="valores-sort-arrow">
                    {sortKey === "sada" ? (sortDir === 1 ? "▲" : "▼") : "↕"}
                  </span>
                </th>
                {th("ratio", "Mercado")}
                {th("resale", "Revenda")}
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
                    <td className="num">
                      {p.resaleScore != null ? (
                        <span
                          className={`valores-resale ${p.resaleScore >= 25 ? "hot" : p.resaleScore >= 15 ? "warm" : ""}`}
                          title="Probabilidade de subir de divisão ou ir ao exterior na próxima temporada (modelo treinado em saltos 2022–2024)"
                        >
                          {p.resaleScore}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>,
                  isOpen ? (
                    <tr key={`${p.playerId}-detail`} className="valores-detail-row">
                      <td colSpan={11}>
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
