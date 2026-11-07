"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import type { FamilyBadgeOption } from "@/lib/statBadges";

type Props = {
  options: FamilyBadgeOption[];
  selected: string[];
  onToggle: (key: string) => void;
  /** Renders the icons directly, for use inside another expandable card. */
  inline?: boolean;
};

export function BadgeFilterBox({ options, selected, onToggle, inline = false }: Props) {
  const icons = (
    <div className={`badge-filter-icons${inline ? " is-inline" : ""}`} role="group" aria-label="Selos">
      {options.map((badge) => {
        const active = selected.includes(badge.key);
        return (
          <Tooltip key={badge.key} content={`${badge.label}. ${badge.title}`}>
            <button
              type="button"
              className={`badge-filter-icon tone-${badge.tone}${active ? " active" : ""}`}
              aria-pressed={active}
              aria-label={badge.label}
              onClick={() => onToggle(badge.key)}
            >
              <i className={`fa-solid ${badge.icon}`} aria-hidden="true" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );

  if (inline) return icons;

  return (
    <details className="badge-filter-box">
      <summary>
        <span>Selos</span>
        <em>{selected.length ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}` : "Filtrar"}</em>
      </summary>
      {icons}
    </details>
  );
}
