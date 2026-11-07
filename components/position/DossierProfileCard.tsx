"use client";

import { ArchetypeMixCard } from "./ArchetypeMixCard";
import { ConstructionProfileBars } from "./ConstructionProfileBars";
import { DefensiveProfileBars } from "./DefensiveProfileBars";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  player: PlayerProfile;
};

export function DossierProfileCard({ player }: Props) {
  if (!player.cluster) return null;

  return (
    <section className="dossier-profile-row" aria-label="Perfil tático">
      <ArchetypeMixCard cluster={player.cluster} />
      <ConstructionProfileBars items={player.aspects.perfil_construcao} />
      {player.aspects.perfil_defensivo?.length ? (
        <DefensiveProfileBars items={player.aspects.perfil_defensivo} />
      ) : null}
    </section>
  );
}
