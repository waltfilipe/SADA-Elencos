"use client";

import { useMemo } from "react";
import { StatBadgeStrip, StatMedalCount } from "@/components/position/profile/StatBadgeStrip";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { findAspect, flattenAspects } from "@/lib/aspectLookup";
import { statSectionsForFamily } from "@/lib/aspectStatSections";
import { earnedStatBadges } from "@/lib/statBadges";
import { buildSectionGradeLookup, getPlayerSectionGrade, playerSectionScore } from "@/lib/sectionGrades";
import { formatRating } from "@/lib/scoutTheme";
import { positionRating } from "@/lib/scoutUi";
import type { AspectItem, PlayerProfile, PositionFamily } from "@/lib/types";

type Props = {
  playerA: PlayerProfile;
  playerB: PlayerProfile;
  family: PositionFamily;
  players: PlayerProfile[];
  verdict: { winsA: number; winsB: number; total: number } | null;
};

type SectionSnapshot = {
  title: string;
  tone: ReturnType<typeof statSectionsForFamily>[number]["tone"];
  badgesA: ReturnType<typeof earnedStatBadges>;
  badgesB: ReturnType<typeof earnedStatBadges>;
  scoreA: number | null;
  scoreB: number | null;
  gradeA: string | null;
  gradeB: string | null;
  leader: "a" | "b" | "tie";
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function CompareOverview({ playerA, playerB, family, players, verdict }: Props) {
  const aspectsA = useMemo(() => flattenAspects(playerA), [playerA]);
  const aspectsB = useMemo(() => flattenAspects(playerB), [playerB]);
  const gradeLookup = useMemo(() => buildSectionGradeLookup(players, family), [players, family]);

  const sections = useMemo<SectionSnapshot[]>(() => {
    const list: SectionSnapshot[] = [];
    for (const section of statSectionsForFamily(family)) {
      const scoreA = playerSectionScore(playerA, family, section.title);
      const scoreB = playerSectionScore(playerB, family, section.title);
      if (scoreA == null && scoreB == null) continue;

      const titleByItem = new Map<string, string>();
      const itemsA: AspectItem[] = [];
      const itemsB: AspectItem[] = [];

      for (const label of section.labels) {
        const itemA = findAspect(aspectsA, label);
        const itemB = findAspect(aspectsB, label);
        if (!itemA && !itemB) continue;
        const groupTitle = label === "Conduções Progressivas" ? "Progressão" : undefined;
        if (itemA) {
          if (groupTitle) titleByItem.set(itemA.label, groupTitle);
          itemsA.push(itemA);
        }
        if (itemB) {
          if (groupTitle) titleByItem.set(itemB.label, groupTitle);
          itemsB.push(itemB);
        }
      }

      if (!itemsA.length && !itemsB.length) continue;

      const leader =
        scoreA != null && scoreB != null
          ? scoreA === scoreB
            ? "tie"
            : scoreA > scoreB
              ? "a"
              : "b"
          : "tie";

      list.push({
        title: section.title,
        tone: section.tone,
        badgesA: earnedStatBadges(itemsA, titleByItem),
        badgesB: earnedStatBadges(itemsB, titleByItem),
        scoreA: scoreA ?? null,
        scoreB: scoreB ?? null,
        gradeA: getPlayerSectionGrade(gradeLookup, playerA.player_id, section.title) ?? null,
        gradeB: getPlayerSectionGrade(gradeLookup, playerB.player_id, section.title) ?? null,
        leader,
      });
    }
    return list;
  }, [family, playerA, playerB, aspectsA, aspectsB, gradeLookup]);

  const ratingDelta = positionRating(playerA) - positionRating(playerB);
  const ratingLeader = ratingDelta === 0 ? "tie" : ratingDelta > 0 ? "a" : "b";

  return (
    <section className="compare-overview" aria-label="Resumo da comparação">
      <div className="compare-overview-head">
        <div className="compare-overview-player side-a">
          <span className="compare-overview-name">{shortName(playerA.name)}</span>
          <strong className="compare-overview-rating compare-overview-evaluation">
            {formatRating(positionRating(playerA))}
          </strong>
        </div>

        <div className="compare-overview-center">
          {verdict ? (
            <p className="compare-overview-score tabular">
              <b className="side-a">{verdict.winsA}</b>
              <span>–</span>
              <b className="side-b">{verdict.winsB}</b>
            </p>
          ) : null}
          <span className="compare-overview-caption">indicadores vencidos</span>
          <span
            className={`compare-overview-rating-delta tabular leader-${ratingLeader}`}
            title="Diferença de avaliação"
          >
            {ratingDelta > 0 ? "+" : ""}
            {ratingDelta.toFixed(1)} pts
          </span>
        </div>

        <div className="compare-overview-player side-b">
          <span className="compare-overview-name">{shortName(playerB.name)}</span>
          <strong className="compare-overview-rating compare-overview-evaluation">
            {formatRating(positionRating(playerB))}
          </strong>
        </div>
      </div>

      <div className="compare-overview-sections">
        {sections.map((section) => (
          <article
            key={section.title}
            className={`compare-overview-chip leader-${section.leader}`}
            title={
              section.scoreA != null && section.scoreB != null
                ? `${section.title}: ${section.scoreA.toFixed(0)} vs ${section.scoreB.toFixed(0)} (score composto)`
                : section.title
            }
          >
            <span className="compare-overview-chip-title">{section.title}</span>
            <span className="compare-overview-chip-grades">
              <GradeBadge letter={section.gradeA} size="sm" />
              <span className="compare-overview-chip-vs">vs</span>
              <GradeBadge letter={section.gradeB} size="sm" />
            </span>
            <span className="compare-overview-chip-badges">
              <StatBadgeStrip badges={section.badgesA} tone={section.tone} />
              <span className="compare-overview-chip-vs">vs</span>
              <StatBadgeStrip badges={section.badgesB} tone={section.tone} />
            </span>
            <span className="compare-overview-chip-medals">
              <StatMedalCount count={section.badgesA.length} />
              <span className="compare-overview-chip-vs">vs</span>
              <StatMedalCount count={section.badgesB.length} />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
