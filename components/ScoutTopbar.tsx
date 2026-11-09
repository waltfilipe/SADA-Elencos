"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/SiteLogo";
import { useLeagueOptional } from "@/components/LeagueProvider";

const NAV_SQUAD = [
  { key: "elenco", path: "/elenco", label: "Elenco", icon: "fa-shirt" },
  { key: "elencos-previos", path: "/elencos-previos", label: "Elencos Prévios", icon: "fa-clock-rotate-left" },
  { key: "time-sombra", path: "/time-sombra", label: "Time Sombra", icon: "fa-chess-board" },
] as const;

export type ScoutSection =
  | (typeof NAV_SQUAD)[number]["key"]
  | "inicio"
  | "posicoes"
  | "filtros"
  | "comparar"
  | "scatter";

type Props = {
  active: ScoutSection;
  subnav?: ReactNode;
  hubMode?: boolean;
};

export function ScoutTopbar({ active, subnav }: Props) {
  const league = useLeagueOptional();

  return (
    <div className="scout-topbar-wrap">
      <header className="scout-topbar scout-topbar-compact">
        <Link href={league ? league.href("/elenco") : "/"} className="scout-brand" aria-label="SADA | Elencos — início">
          <SiteLogo variant="stacked" className="scout-header-logo scout-header-logo-stacked" height={40} />
          <span className="scout-brand-app">Elencos</span>
        </Link>

        <nav className="topbar-links topbar-links-squad" aria-label="Seções de elenco">
          {NAV_SQUAD.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={league ? league.href(item.path) : item.path}
                className={isActive ? "active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {subnav ? <div className="scout-subnav">{subnav}</div> : null}
    </div>
  );
}
