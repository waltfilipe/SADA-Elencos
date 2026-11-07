import Link from "next/link";
import { ScoutTopbar } from "@/components/ScoutTopbar";
import { getMeta } from "@/lib/data.server";
import type { LeagueId } from "@/lib/leagues";
import { leaguePath } from "@/lib/leagues";
import { POSITION_FAMILIES } from "@/lib/positions";

const SECTIONS = [
  { path: "/posicao/zagueiros", kicker: "Dossiê", title: "Posições", text: "Perfil, heatmap e notas de cada atleta, organizados por posição." },
  { path: "/filtros", kicker: "Busca", title: "Filtros", text: "Cruze clube, idade, minutagem, pé e tendências para achar o perfil certo." },
  { path: "/comparar", kicker: "Duelo", title: "Comparar", text: "Coloque dois ou três atletas da mesma posição lado a lado." },
  { path: "/scatter", kicker: "Mapa", title: "Scatter", text: "Veja a posição inteira num gráfico e encontre quem se destaca." },
  { path: "/elenco", kicker: "Escalação", title: "Elenco", text: "Escale o elenco de qualquer clube por posição e minutos jogados." },
  { path: "/elencos-previos", kicker: "Histórico", title: "Elencos Prévios", text: "O time mais usado de cada clube em temporadas anteriores, com similares de hoje." },
  { path: "/time-sombra", kicker: "Alvos", title: "Time Sombra", text: "Monte o time dos seus sonhos com atletas de uma liga ou de todas." },
  { path: "/atletas", kicker: "Atletas", title: "Atletas", text: "Ficha resumida por jogador, com temporadas 2026 (scout) e 2025 (arquivo)." },
] as const;

export function LeagueHomeMain({ leagueId }: { leagueId: LeagueId }) {
  const meta = getMeta(leagueId);
  const counts = new Map(meta.families.map((family) => [family.key, family.count]));
  const href = (path: string) => leaguePath(leagueId, path);

  return (
    <div className="scout-root home-page">
      <ScoutTopbar active="inicio" />

      <main className="home-main">
        <section className="home-hero">
          <p className="home-kicker">
            {meta.league} · {meta.season}
          </p>
          <h1>Scouting da {meta.league} em um só lugar.</h1>
          <p className="home-lead">
            Ratings por perfil, comparações e um elenco com time sombra para acompanhar os atletas da temporada.
            {!meta.heatmaps_enabled ? " Mapas de calor não disponíveis nesta liga." : null}
          </p>
          <div className="home-hero-actions">
            <Link className="home-cta" href={href("/posicao/zagueiros")}>
              Explorar posições
            </Link>
            <Link className="home-cta home-cta-ghost" href={href("/elenco")}>
              Ver elencos
            </Link>
          </div>
          <dl className="home-stats">
            <div>
              <dt>Atletas</dt>
              <dd className="tabular">{meta.player_count}</dd>
            </div>
            <div>
              <dt>Clubes</dt>
              <dd className="tabular">{meta.clubs.length}</dd>
            </div>
            <div>
              <dt>Posições</dt>
              <dd className="tabular">{POSITION_FAMILIES.length}</dd>
            </div>
          </dl>
        </section>

        <section className="home-section" aria-labelledby="home-sections-title">
          <h2 id="home-sections-title">O que você pode fazer</h2>
          <div className="home-cards">
            {SECTIONS.map((section) => (
              <Link key={section.path} href={href(section.path)} className="home-card">
                <span className="home-card-kicker">{section.kicker}</span>
                <strong>{section.title}</strong>
                <p>{section.text}</p>
                <span className="home-card-go">Abrir</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="home-positions-title">
          <h2 id="home-positions-title">Entrar por posição</h2>
          <div className="home-positions">
            {POSITION_FAMILIES.map((family) => (
              <Link key={family.key} href={href(`/posicao/${family.slug}`)} className="home-position">
                <span className="home-position-short">{family.short}</span>
                <span className="home-position-copy">
                  <strong>{family.label}</strong>
                  <em className="tabular">{counts.get(family.key) ?? 0} atletas</em>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
