"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteLogo } from "@/components/SiteLogo";
import { useLeagueOptional } from "@/components/LeagueProvider";
import { getLeague, leaguePath, LEAGUES, type LeagueInfo } from "@/lib/leagues";
import { isBrasileiraoLeague, withSeasonQuery } from "@/lib/seasons";

const NAV_SCOUT = [
  { key: "inicio", path: "/", label: "Início", global: true },
] as const;

const NAV_SQUAD = [
  { key: "elenco", path: "/elenco", label: "Elenco", global: false, anywhere: true },
  { key: "elencos-previos", path: "/elencos-previos", label: "Elencos Prévios", global: false, anywhere: true },
  { key: "time-sombra", path: "/time-sombra", label: "Time Sombra", global: false, anywhere: true },
] as const;

export type ScoutSection =
  | (typeof NAV_SCOUT)[number]["key"]
  | (typeof NAV_SQUAD)[number]["key"]
  | "posicoes"
  | "filtros"
  | "comparar"
  | "scatter";

type Props = {
  active: ScoutSection;
  subnav?: ReactNode;
  /** Hub global (/) — links de scout exigem liga no contexto. */
  hubMode?: boolean;
};

export function ScoutTopbar({ active, subnav, hubMode = false }: Props) {
  const league = useLeagueOptional();
  const pathname = usePathname() ?? "/";
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leagueMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!contextRef.current?.contains(event.target as Node)) setLeagueMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLeagueMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [leagueMenuOpen]);

  function switchHref(target: LeagueInfo) {
    const rest = pathname.replace(/^\/[^/]+/, "") || "/";
    const base = leaguePath(target.id, rest);
    return isBrasileiraoLeague(target.id) ? withSeasonQuery(base, league?.season ?? "2026") : base;
  }

  function navHref(item: { path: string; global: boolean; anywhere?: boolean }) {
    if (item.global) return item.path;
    if (hubMode || !league) return item.anywhere ? item.path : "/";
    return league.href(item.path);
  }

  function renderLinks(
    items: readonly { key: string; path: string; label: string; global: boolean; anywhere?: boolean }[],
  ) {
    return items.map((item) => {
      const disabled = !item.global && !item.anywhere && (hubMode || !league);
      const isActive = item.key === active;
      return (
        <Link
          key={item.key}
          href={disabled ? "#" : navHref(item)}
          onClick={disabled ? (event) => event.preventDefault() : undefined}
          className={[isActive ? "active" : "", disabled ? "topbar-link-muted" : ""].filter(Boolean).join(" ")}
          aria-current={isActive ? "page" : undefined}
          aria-disabled={disabled ? true : undefined}
          title={disabled ? "Escolha uma competição no início" : undefined}
        >
          {item.label}
        </Link>
      );
    });
  }

  const leagueInfo = league ? getLeague(league.leagueId) : undefined;
  const showContext = !hubMode && league != null;
  const contextLogo =
    league != null && isBrasileiraoLeague(league.leagueId) ? leagueInfo?.logo : undefined;
  // Outras séries da mesma temporada: arquivo só existe para as séries do
  // Brasileirão A/B/C; na temporada atual valem todas as ligas.
  const switchOptions = league
    ? LEAGUES.filter(
        (item) =>
          item.id !== league.leagueId &&
          (league.isCurrentSeason || item.id === "serie-a" || item.id === "serie-b" || item.id === "serie-c"),
      )
    : [];

  return (
    <div className="scout-topbar-wrap">
      <header className="scout-topbar scout-topbar-compact">
        <Link href="/" className="scout-brand" aria-label="SADA | Elencos — início">
          <SiteLogo variant="stacked" className="scout-header-logo scout-header-logo-stacked" height={40} />
        </Link>

        <nav className="topbar-links topbar-links-primary" aria-label="Seções de scout">
          {renderLinks(NAV_SCOUT)}
        </nav>

        <nav className="topbar-links topbar-links-squad" aria-label="Elencos e times sombra">
          {renderLinks(NAV_SQUAD)}
        </nav>

        {showContext ? (
          <div
            ref={contextRef}
            className={["topbar-context", league!.isCurrentSeason ? "" : "topbar-context-archive"].filter(Boolean).join(" ")}
            title={
              league!.isCurrentSeason
                ? `${league!.name} — temporada ${league!.season}`
                : `Arquivo ${league!.season}`
            }
          >
            {contextLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contextLogo} alt="" className="topbar-context-logo" />
            ) : (
              <span className="topbar-context-brand" aria-hidden="true">
                {league!.brand}
              </span>
            )}
            <span className="topbar-context-text">
              <span className="topbar-context-name">{league!.name}</span>
              <span className="topbar-context-season">
                {league!.isCurrentSeason ? `Temporada ${league!.season}` : `Arquivo ${league!.season}`}
              </span>
            </span>
            {switchOptions.length ? (
              <button
                type="button"
                className="topbar-context-arrow"
                aria-label="Trocar de série mantendo a temporada"
                aria-expanded={leagueMenuOpen}
                onClick={() => setLeagueMenuOpen((open) => !open)}
              >
                <i className={`fa-solid fa-chevron-${leagueMenuOpen ? "up" : "down"}`} aria-hidden="true" />
              </button>
            ) : null}
            {leagueMenuOpen ? (
              <div className="topbar-context-menu" role="menu" aria-label="Outras séries">
                {switchOptions.map((item) => (
                  <Link
                    key={item.id}
                    href={switchHref(item)}
                    className="topbar-context-menu-item"
                    role="menuitem"
                    onClick={() => setLeagueMenuOpen(false)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.logo} alt="" className="topbar-context-logo" />
                    <span className="topbar-context-menu-name">{item.name}</span>
                    <span className="topbar-context-menu-season">
                      {league!.isCurrentSeason ? league!.season : `Arquivo ${league!.season}`}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {subnav ? <div className="scout-subnav">{subnav}</div> : null}
    </div>
  );
}
