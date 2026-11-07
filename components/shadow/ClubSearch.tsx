"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import type { LeagueId } from "@/lib/leagues";

export type ClubOption = {
  club: string;
  leagueId: LeagueId;
  leagueName: string;
  count: number;
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

type Props = {
  options: ClubOption[];
  value: ClubOption | null;
  onChange: (club: ClubOption | null) => void;
};

export function ClubSearch({ options, value, onChange }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(value?.club ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.club ?? "");
  }, [value]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return options
      .filter((option) => fold(option.club).includes(q))
      .slice(0, 12);
  }, [options, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function choose(option: ClubOption) {
    onChange(option);
    setQuery(option.club);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="shadow-club-search" ref={boxRef}>
      <span className="shadow-formation-label" id={`${listId}-label`}>
        Clube
      </span>
      <div className="shadow-club-search-row">
        <input
          className="shadow-slot-search shadow-club-input"
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-labelledby={`${listId}-label`}
          aria-autocomplete="list"
          placeholder="Buscar qualquer clube…"
          value={query}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (value && fold(next) !== fold(value.club)) onChange(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const exact = results.find((option) => fold(option.club) === fold(query.trim()));
              const pick = exact ?? results[active] ?? results[0];
              if (pick) choose(pick);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {value ? (
          <button type="button" className="shadow-link-btn shadow-club-clear" onClick={clear}>
            Limpar
          </button>
        ) : null}
      </div>
      {open && query.trim() && results.length ? (
        <ul className="shadow-club-results" id={listId} role="listbox">
          {results.map((option, index) => (
            <li key={`${option.leagueId}-${option.club}`}>
              <button
                type="button"
                role="option"
                aria-selected={value?.club === option.club && value.leagueId === option.leagueId}
                className={`shadow-club-option${index === active ? " active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <ClubLogo club={option.club} size={18} />
                <span className="shadow-club-option-copy">
                  <strong>{option.club}</strong>
                  <em>
                    {option.leagueName} · {option.count} atletas
                  </em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && !results.length ? (
        <p className="shadow-club-empty">Nenhum clube com esse nome.</p>
      ) : null}
    </div>
  );
}
