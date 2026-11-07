"use client";

import { useEffect, useRef, useState } from "react";
import { ClubLogo } from "@/components/ClubLogo";

export type FilterOption = {
  value: string;
  label: string;
  /** Renders the club crest next to the label. */
  club?: string;
  count?: number;
};

type Props = {
  label: string;
  icon?: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  /** Single choice collapses the menu as soon as an option is picked. */
  single?: boolean;
  align?: "left" | "right";
};

export function PickerFilterMenu({
  label,
  icon,
  options,
  selected,
  onToggle,
  onClear,
  single = false,
  align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!options.length) return null;

  const activeCount = selected.length;
  const summary =
    activeCount === 1
      ? options.find((option) => option.value === selected[0])?.label ?? label
      : label;

  return (
    <div className="picker-filter" ref={wrapRef}>
      <button
        type="button"
        className={`picker-filter-trigger${activeCount ? " active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {icon ? <i className={`fa-solid ${icon}`} aria-hidden="true" /> : null}
        <span className="picker-filter-trigger-text">{summary}</span>
        {activeCount > 1 ? <span className="picker-filter-badge tabular">{activeCount}</span> : null}
        <i className="fa-solid fa-chevron-down picker-filter-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className={`picker-filter-menu picker-filter-menu-${align}`}
          role="listbox"
          aria-multiselectable={!single}
        >
          {activeCount ? (
            <button type="button" className="picker-filter-clear" onClick={onClear}>
              <i className="fa-solid fa-xmark" aria-hidden="true" /> Limpar seleção
            </button>
          ) : null}
          <ul>
            {options.map((option) => {
              const active = selected.includes(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "active" : ""}
                    onClick={() => {
                      onToggle(option.value);
                      if (single) setOpen(false);
                    }}
                  >
                    <span className="picker-filter-check" aria-hidden="true">
                      {active ? <i className="fa-solid fa-check" /> : null}
                    </span>
                    {option.club ? <ClubLogo club={option.club} size={14} /> : null}
                    <span className="picker-filter-option-label">{option.label}</span>
                    {option.count != null ? (
                      <span className="picker-filter-option-count tabular">{option.count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
