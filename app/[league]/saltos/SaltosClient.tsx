"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { appPath } from "@/lib/paths";
import type { LeagueId } from "@/lib/leagues";
import type { SaltoPlayer, SaltoSeasonGroup } from "@/lib/saltos";

type SimilarHit = {
  player_id: string;
  name: string;
  club: string;
  profile: string;
  rating: number;
  league?: LeagueId;
  photo?: string | null;
  similarity: number;
};

type SimilarState = {
  player: SaltoPlayer;
  season: string;
  target: string;
  loading: boolean;
  error: string | null;
  matches: SimilarHit[];
};

type DestFilter = "todos" | "league" | "exterior";

const TARGET_OPTIONS = [
  { value: "serie-c", label: "Série C" },
  { value: "serie-b", label: "Série B" },
  { value: "serie-a", label: "Série A" },
  { value: "estaduais", label: "Estaduais" },
];

const SERIE_OPTIONS = [
  { value: "serie-c", label: "Série C" },
  { value: "serie-b", label: "Série B" },
  { value: "serie-a", label: "Série A" },
];

function destLabel(player: SaltoPlayer): string {
  if (player.to.kind === "league") return `${player.to.leagueName} · ${player.to.club}`;
  const prefix = player.to.region === "europa" ? "Europa" : "Exterior";
  return `${prefix}${player.to.club ? ` · ${player.to.club}` : ""}`;
}

export function SaltosClient({
  leagueId,
  leagueName,
  groups,
}: {
  leagueId: LeagueId;
  leagueName: string;
  groups: SaltoSeasonGroup[];
}) {
  const router = useRouter();
  const [season, setSeason] = useState("todas");
  const [minRating, setMinRating] = useState(7);
  const [minMinutes, setMinMinutes] = useState(600);
  const [dest, setDest] = useState<DestFilter>("todos");
  const [similar, setSimilar] = useState<SimilarState | null>(null);

  const filtered = useMemo(
    () =>
      groups
        .filter((group) => season === "todas" || group.season === season)
        .map((group) => ({
          ...group,
          players: group.players.filter(
            (player) =>
              player.rating >= minRating &&
              player.minutes >= minMinutes &&
              (dest === "todos" || player.to.kind === dest),
          ),
        }))
        .filter((group) => group.players.length > 0),
    [groups, season, minRating, minMinutes, dest],
  );

  const total = filtered.reduce((sum, group) => sum + group.players.length, 0);

  async function loadSimilar(player: SaltoPlayer, season: string, target: string) {
    setSimilar({ player, season, target, loading: true, error: null, matches: [] });
    try {
      const res = await fetch(
        appPath(
          `/api/similar?from=${leagueId}&to=${target}&playerId=${encodeURIComponent(player.playerId)}&season=${season}&limit=8`,
        ),
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { matches?: SimilarHit[] };
      setSimilar({ player, season, target, loading: false, error: null, matches: data.matches ?? [] });
    } catch {
      setSimilar({ player, season, target, loading: false, error: "Falha ao buscar similares.", matches: [] });
    }
  }

  const modalOpen = similar != null;
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSimilar(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  return (
    <div className="scout-root profile-page">
      <ScoutTopbar active="saltos" />

      <div className="saltos-page">
        <header className="saltos-hero">
          <span className="saltos-eyebrow">{leagueName} · temporadas 2022–2025</span>
          <h1>Atletas que deram salto</h1>
          <p>
            {leagueId === "serie-a"
              ? "Boas temporadas na Série A que renderam uma transferência para a Europa. Compare cada atleta com quem joga a temporada atual."
              : `Boas temporadas na ${leagueName} que renderam um contrato numa divisão superior — ou fora
            do país. Compare cada atleta com quem joga a temporada atual e encontre o próximo salto.`}
          </p>
        </header>

        <div className="saltos-filters">
          <label className="saltos-filter saltos-filter-select">
            <span>Série</span>
            <select value={leagueId} onChange={(event) => router.push(`/${event.target.value}/saltos`)}>
              {SERIE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="saltos-filter saltos-filter-select">
            <span>Ano</span>
            <select value={season} onChange={(event) => setSeason(event.target.value)}>
              <option value="todas">Todas</option>
              {groups.map((group) => (
                <option key={group.season} value={group.season}>
                  {group.season}
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
              min={6.8}
              max={7.6}
              step={0.1}
              value={minRating}
              onChange={(event) => setMinRating(Number(event.target.value))}
            />
          </label>
          <label className="saltos-filter">
            <span>
              Minutos mínimos <strong>{minMinutes}</strong>
            </span>
            <input
              type="range"
              min={400}
              max={2000}
              step={100}
              value={minMinutes}
              onChange={(event) => setMinMinutes(Number(event.target.value))}
            />
          </label>
          <div className="saltos-filter saltos-filter-dest">
            <span>Destino</span>
            <div className="saltos-seg">
              {(
                [
                  ["todos", "Todos"],
                  ["league", "Subiu de divisão"],
                  ["exterior", "Exterior"],
                ] as [DestFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={dest === value ? "active" : ""}
                  onClick={() => setDest(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className="saltos-count">{total} atletas</span>
        </div>

        {filtered.length === 0 ? (
          <div className="scout-empty">Nenhum atleta com esses filtros — afrouxe o corte de rating ou minutos.</div>
        ) : (
          filtered.map((group) => (
            <section key={group.season} className="saltos-season">
              <header className="saltos-season-head">
                <h2>
                  {leagueName} {group.season}
                </h2>
                <span>{group.players.length} saltos</span>
              </header>
              <div className="saltos-grid">
                {group.players.map((player) => (
                  <article key={`${group.season}-${player.playerId}`} className="salto-card">
                    <div className="salto-card-top">
                      {player.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.photo} alt="" className="salto-photo" loading="lazy" />
                      ) : (
                        <div className="salto-photo salto-photo-empty" aria-hidden>
                          <i className="fa-solid fa-user" />
                        </div>
                      )}
                      <div className="salto-id">
                        <strong>{player.name}</strong>
                        <span>
                          {player.position}
                          {player.birthYear ? ` · ${player.birthYear}` : ""}
                        </span>
                        <span className="salto-club">{player.club}</span>
                      </div>
                      <span className="salto-rating">{player.rating.toFixed(1)}</span>
                    </div>
                    <div className="salto-move">
                      <i
                        className={`fa-solid ${player.to.kind === "league" ? "fa-arrow-trend-up" : "fa-plane-departure"}`}
                        aria-hidden
                      />
                      <span>{destLabel(player)}</span>
                    </div>
                    <div className="salto-card-foot">
                      <span>{player.minutes.toLocaleString("pt-BR")} min</span>
                      <button
                        type="button"
                        className="salto-similar-btn"
                        onClick={() => loadSimilar(player, group.season, leagueId)}
                      >
                        Similares 2026 <i className="fa-solid fa-wand-magic-sparkles" aria-hidden />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {similar ? (
        <div className="salto-modal-overlay" onClick={() => setSimilar(null)}>
          <div className="salto-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="salto-modal-head">
              <div>
                <h3>Similares a {similar.player.name}</h3>
                <p>
                  Referência: {leagueName} {similar.season} · rating {similar.player.rating.toFixed(1)}
                </p>
              </div>
              <div className="salto-modal-actions">
                <select
                  value={similar.target}
                  onChange={(event) => loadSimilar(similar.player, similar.season, event.target.value)}
                  aria-label="Liga alvo da comparação"
                >
                  {TARGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="salto-modal-close" onClick={() => setSimilar(null)} aria-label="Fechar">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </header>
            {similar.loading ? (
              <div className="scout-empty">Buscando similares…</div>
            ) : similar.error ? (
              <div className="scout-empty">{similar.error}</div>
            ) : similar.matches.length === 0 ? (
              <div className="scout-empty">Nenhum similar encontrado nesta liga.</div>
            ) : (
              <div className="salto-similar-grid">
                {similar.matches.map((hit) => (
                  <div key={hit.player_id} className="salto-hit">
                    {hit.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.photo} alt="" className="salto-photo" loading="lazy" />
                    ) : (
                      <div className="salto-photo salto-photo-empty" aria-hidden>
                        <i className="fa-solid fa-user" />
                      </div>
                    )}
                    <div className="salto-id">
                      <strong>{hit.name}</strong>
                      <span>
                        {hit.club} · {hit.profile}
                      </span>
                    </div>
                    <span className="salto-sim-score" title="Similaridade">
                      {Math.round(hit.similarity)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
