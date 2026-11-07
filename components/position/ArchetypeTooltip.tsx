"use client";

import type { ReactNode } from "react";
import {
  archetypeMetaFor,
  atArchetypeMetaFor,
  exArchetypeMetaFor,
  isAtCluster,
  isExCluster,
  isLatCluster,
  isMcCluster,
  latArchetypeMetaFor,
  mcArchetypeMetaFor,
  type AtArchetype,
  type ExArchetype,
  type LatArchetype,
  type McArchetype,
  type PositionCluster,
  type ZagArchetype,
} from "@/lib/clusterMeta";

type Props = {
  archetype: ZagArchetype | LatArchetype | McArchetype | ExArchetype | AtArchetype;
  cluster?: PositionCluster;
  children: ReactNode;
  className?: string;
  block?: boolean;
};

function TraitArrow({ direction }: { direction: "up" | "down" }) {
  if (direction === "up") {
    return (
      <svg viewBox="0 0 12 12" aria-hidden className="archetype-tip-arrow archetype-tip-arrow-up">
        <path d="M6 2.5v7M6 2.5 3.5 5.5M6 2.5l2.5 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 12 12" aria-hidden className="archetype-tip-arrow archetype-tip-arrow-down">
      <path d="M6 9.5v-7M6 9.5 3.5 6.5M6 9.5l2.5-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArchetypeTooltip({ archetype, cluster, children, className = "", block = false }: Props) {
  const meta =
    cluster && isLatCluster(cluster)
      ? latArchetypeMetaFor(archetype as LatArchetype)
      : cluster && isMcCluster(cluster)
        ? mcArchetypeMetaFor(archetype as McArchetype)
        : cluster && isExCluster(cluster)
          ? exArchetypeMetaFor(archetype as ExArchetype)
          : cluster && isAtCluster(cluster)
            ? atArchetypeMetaFor(archetype as AtArchetype)
            : archetypeMetaFor(archetype as ZagArchetype);
  if (!meta) return <>{children}</>;

  const wrapClass = ["archetype-tip-wrap", block ? "is-block" : "", className].filter(Boolean).join(" ");

  return (
    <span className={wrapClass}>
      {children}
      <span className={`archetype-tip cluster-${meta.tone}`} role="tooltip">
        <span className="archetype-tip-title">{archetype}</span>
        <ul className="archetype-tip-traits">
          {meta.traits.map((trait) => (
            <li key={trait.label} className={`archetype-tip-trait is-${trait.direction}`}>
              <TraitArrow direction={trait.direction} />
              <span>{trait.label}</span>
            </li>
          ))}
        </ul>
      </span>
    </span>
  );
}
