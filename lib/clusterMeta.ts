export type ZagArchetype = "Defensor de Área" | "Construtor" | "Combativo";

export type ConstrutorBadge = "Construtor Âncora" | "Construtor Nato";

export type ZagClusterShares = {
  defensor_area: number;
  construtor: number;
  combativo: number;
};

export type ZagArchetypeRatings = {
  defensor_area: number;
  construtor: number;
  combativo: number;
};

export type ZagCluster = {
  family?: "zagueiros";
  archetype: ZagArchetype;
  archetype_label: string;
  /** Hierarchical badge when archetype is Construtor. */
  construtor_badge?: ConstrutorBadge | null;
  construtor_badge_short?: string | null;
  shares: ZagClusterShares;
  ratings: ZagArchetypeRatings;
};

export type LatArchetype = "Defensivo" | "Construtor" | "Ofensivo" | "Híbrido";

export type LatHybridBadge = "Lateral Base" | "Lateral Moderno" | "Lateral Projetivo" | "Lateral Completo";

export type LatClusterShares = {
  defensivo: number;
  construtor: number;
  ofensivo: number;
};

export type LatArchetypeRatings = {
  defensivo: number;
  construtor: number;
  ofensivo: number;
};

export type LatCluster = {
  family: "laterais";
  archetype: LatArchetype;
  archetype_label: string;
  hybrid_badge?: LatHybridBadge | string | null;
  hybrid_badge_short?: string | null;
  shares: LatClusterShares;
  ratings: LatArchetypeRatings;
};

export type McArchetype = "Contenção" | "Construtor" | "Box-to-box" | "Híbrido";

export type McHybridBadge = "Volante Base" | "MC Combativo" | "MC Projetivo" | "MC Completo";

export type McClusterShares = {
  contencao: number;
  construtor: number;
  boxtobox: number;
};

export type McArchetypeRatings = {
  contencao: number;
  construtor: number;
  boxtobox: number;
};

export type McCluster = {
  family: "meio-campistas";
  archetype: McArchetype;
  archetype_label: string;
  hybrid_badge?: McHybridBadge | string | null;
  hybrid_badge_short?: string | null;
  shares: McClusterShares;
  ratings: McArchetypeRatings;
};

export type ExArchetype = "Driblador" | "Meia Ponta" | "Ruptura" | "Híbrido";

export type ExHybridBadge = "Ala Criativa" | "Ala Direta" | "Ala Projetiva" | "Ala Completa";

export type ExClusterShares = {
  driblador: number;
  meia_ponta: number;
  ruptura: number;
};

export type ExArchetypeRatings = {
  driblador: number;
  meia_ponta: number;
  ruptura: number;
};

export type ExCluster = {
  family: "extremos";
  archetype: ExArchetype;
  archetype_label: string;
  hybrid_badge?: ExHybridBadge | string | null;
  hybrid_badge_short?: string | null;
  shares: ExClusterShares;
  ratings: ExArchetypeRatings;
};

export type AtArchetype = "Finalizador" | "Alvo" | "Móvel" | "Híbrido";

export type AtClusterShares = {
  finalizador: number;
  alvo: number;
  movel: number;
};

export type AtArchetypeRatings = {
  finalizador: number;
  alvo: number;
  movel: number;
};

export type AtCluster = {
  family: "atacantes";
  archetype: AtArchetype;
  archetype_label: string;
  hybrid_badge?: string | null;
  hybrid_badge_short?: string | null;
  shares: AtClusterShares;
  ratings: AtArchetypeRatings;
};

export type PositionCluster = ZagCluster | LatCluster | McCluster | ExCluster | AtCluster;

export function isAtCluster(cluster: PositionCluster): cluster is AtCluster {
  return cluster.family === "atacantes" || "finalizador" in cluster.shares;
}

export function isLatCluster(cluster: PositionCluster): cluster is LatCluster {
  return cluster.family === "laterais" || ("defensivo" in cluster.shares && !("contencao" in cluster.shares) && !("driblador" in cluster.shares) && !("finalizador" in cluster.shares));
}

export function isMcCluster(cluster: PositionCluster): cluster is McCluster {
  return cluster.family === "meio-campistas" || ("contencao" in cluster.shares && !("driblador" in cluster.shares) && !("finalizador" in cluster.shares));
}

export function isExCluster(cluster: PositionCluster): cluster is ExCluster {
  return cluster.family === "extremos" || ("driblador" in cluster.shares && !("finalizador" in cluster.shares));
}

export function isZagCluster(cluster: PositionCluster): cluster is ZagCluster {
  return !isLatCluster(cluster) && !isMcCluster(cluster) && !isExCluster(cluster) && !isAtCluster(cluster);
}

export type ArchetypeTrait = {
  label: string;
  direction: "up" | "down";
};

export const ZAG_ARCHETYPES: ZagArchetype[] = ["Defensor de Área", "Construtor", "Combativo"];

export const CONSTRUTOR_BADGES: ConstrutorBadge[] = ["Construtor Âncora", "Construtor Nato"];

export const CONSTRUTOR_BADGE_META: {
  badge: ConstrutorBadge;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    badge: "Construtor Âncora",
    short_label: "Âncora",
    description: "Constrói com tendência ao passe longo — distribui a partir da defesa.",
    traits: [
      { label: "Tendência Longo", direction: "up" },
      { label: "Passes Longos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Passes Progressivos", direction: "down" },
    ],
  },
  {
    badge: "Construtor Nato",
    short_label: "Nato",
    description: "Iniciador de jogo curto e progressivo, sem perfil de distribuidor longo.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Volume de Passe", direction: "up" },
      { label: "Tendência Longo", direction: "down" },
    ],
  },
];

export const ZAG_ARCHETYPE_META: {
  archetype: ZagArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Defensor de Área",
    tone: "defensor-area",
    description: "Referência defensiva: rebatidas, bloqueio e duelos aéreos e defensivos.",
    traits: [
      { label: "Rebatidas", direction: "up" },
      { label: "Duelos Aéreos", direction: "up" },
      { label: "Bloqueios", direction: "up" },
      { label: "Passes Progressivos", direction: "down" },
      { label: "PTF", direction: "down" },
    ],
  },
  {
    archetype: "Construtor",
    tone: "construtor",
    description: "Iniciador de jogo: volume de passe, PTF e progressividade.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Volume de Passe", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
  {
    archetype: "Combativo",
    tone: "combativo",
    description: "Leitura e contato: duelos defensivos, interceptações e envolvimento alto.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Interceptações", direction: "up" },
      { label: "Duelos Ofensivos", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
];

export function archetypeTone(archetype: ZagArchetype): string {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "construtor";
}

export function archetypeMetaFor(archetype: ZagArchetype) {
  return ZAG_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function construtorBadgeMetaFor(badge: ConstrutorBadge) {
  return CONSTRUTOR_BADGE_META.find((item) => item.badge === badge);
}

export function archetypeCounts(players: { cluster?: ZagCluster | null }[]) {
  const counts: Record<ZagArchetype, number> = {
    "Defensor de Área": 0,
    Construtor: 0,
    Combativo: 0,
  };
  const construtorBadges: Record<ConstrutorBadge, number> = {
    "Construtor Âncora": 0,
    "Construtor Nato": 0,
  };
  for (const player of players) {
    if (!player.cluster) continue;
    counts[player.cluster.archetype] = (counts[player.cluster.archetype] ?? 0) + 1;
    if (player.cluster.construtor_badge) {
      construtorBadges[player.cluster.construtor_badge] =
        (construtorBadges[player.cluster.construtor_badge] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const percents: Record<ZagArchetype, number> = {
    "Defensor de Área": total ? Math.round((counts["Defensor de Área"] / total) * 100) : 0,
    Construtor: total ? Math.round((counts.Construtor / total) * 100) : 0,
    Combativo: total ? Math.round((counts.Combativo / total) * 100) : 0,
  };
  return { counts, percents, construtorBadges, total };
}

export const LAT_ARCHETYPES: LatArchetype[] = ["Defensivo", "Construtor", "Ofensivo", "Híbrido"];

export const LAT_HYBRID_BADGE_META: {
  badge: LatHybridBadge;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    badge: "Lateral Base",
    short_label: "Base",
    description: "Combina solidez defensiva com construção — lateral de referência na fase defensiva e de saída.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Interceptações", direction: "up" },
      { label: "Toques na Área", direction: "down" },
    ],
  },
  {
    badge: "Lateral Moderno",
    short_label: "Moderno",
    description: "Defende com volume e projeta-se ofensivamente — perfil de ala completa no jogo moderno.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Corridas Progressivas", direction: "up" },
      { label: "Passes Longos", direction: "down" },
    ],
  },
  {
    badge: "Lateral Projetivo",
    short_label: "Projetivo",
    description: "Constrói e ataca — combina progressividade com presença no terço final.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Acelerações", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
  {
    badge: "Lateral Completo",
    short_label: "Completo",
    description: "Elite nas três frentes — defende, constrói e ataca em volume acima da média.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Cruzamentos", direction: "up" },
    ],
  },
];

export const LAT_ARCHETYPE_META: {
  archetype: LatArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Defensivo",
    tone: "defensivo",
    description: "Prioridade na fase defensiva: duelos, interceptações e rebatidas.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Rebatidas", direction: "up" },
      { label: "Interceptações", direction: "up" },
      { label: "Toques na Área", direction: "down" },
    ],
  },
  {
    archetype: "Construtor",
    tone: "construtor",
    description: "Iniciador de jogo: passes progressivos, PTF e envolvimento na construção.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Passes Recebidos", direction: "up" },
      { label: "Cruzamentos", direction: "down" },
    ],
  },
  {
    archetype: "Ofensivo",
    tone: "ofensivo",
    description: "Projeção ofensiva: conduções, acelerações e presença no terço final.",
    traits: [
      { label: "Toques na Área", direction: "up" },
      { label: "Corridas Progressivas", direction: "up" },
      { label: "Acelerações", direction: "up" },
      { label: "Rebatidas", direction: "down" },
    ],
  },
  {
    archetype: "Híbrido",
    tone: "hibrido",
    description: "Dois eixos fortes — perfil dual com identidade em mais de uma frente.",
    traits: [
      { label: "Versatilidade", direction: "up" },
      { label: "Volume Defensivo", direction: "up" },
      { label: "Projeção Ofensiva", direction: "up" },
      { label: "Especialização", direction: "down" },
    ],
  },
];

export function latArchetypeTone(archetype: LatArchetype): string {
  return LAT_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "construtor";
}

export function latArchetypeMetaFor(archetype: LatArchetype) {
  return LAT_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function latHybridBadgeMetaFor(badge: string) {
  return LAT_HYBRID_BADGE_META.find((item) => item.badge === badge);
}

export const MC_ARCHETYPES: McArchetype[] = ["Contenção", "Construtor", "Box-to-box", "Híbrido"];

export const MC_HYBRID_BADGE_META: {
  badge: McHybridBadge;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    badge: "Volante Base",
    short_label: "Base",
    description: "Combina contenção e construção — volante de referência na fase defensiva e de saída.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Interceptações", direction: "up" },
      { label: "Finalizações", direction: "down" },
    ],
  },
  {
    badge: "MC Combativo",
    short_label: "Combativo",
    description: "Contém e chega à área — perfil de meio completo no jogo moderno.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Finalizações", direction: "up" },
      { label: "Ofensividade", direction: "up" },
      { label: "Passes Longos", direction: "down" },
    ],
  },
  {
    badge: "MC Projetivo",
    short_label: "Projetivo",
    description: "Constrói e avança — combina distribuição com presença ofensiva.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "Finalizações", direction: "up" },
      { label: "Ofensividade", direction: "up" },
      { label: "Duelos Aéreos", direction: "down" },
    ],
  },
  {
    badge: "MC Completo",
    short_label: "Completo",
    description: "Elite nas três frentes — contém, constrói e chega ao ataque em volume acima da média.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Finalizações", direction: "up" },
      { label: "Interceptações", direction: "up" },
    ],
  },
];

export const MC_ARCHETYPE_META: {
  archetype: McArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Contenção",
    tone: "contencao",
    description: "Prioridade na fase defensiva: duelos, interceptações e jogo aéreo.",
    traits: [
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Rebatidas", direction: "up" },
      { label: "Duelos Aéreos", direction: "up" },
      { label: "Finalizações", direction: "down" },
    ],
  },
  {
    archetype: "Construtor",
    tone: "construtor",
    description: "Iniciador de jogo: passes progressivos, PTF e distribuição.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Passes Recebidos", direction: "up" },
      { label: "Finalizações", direction: "down" },
    ],
  },
  {
    archetype: "Box-to-box",
    tone: "boxtobox",
    description: "Meio completo: ofensividade, duelos defensivos, interceptações e finalizações.",
    traits: [
      { label: "Finalizações", direction: "up" },
      { label: "Ofensividade", direction: "up" },
      { label: "Duelos Defensivos", direction: "up" },
      { label: "Interceptações", direction: "up" },
    ],
  },
  {
    archetype: "Híbrido",
    tone: "hibrido",
    description: "Dois eixos fortes — perfil dual com identidade em mais de uma frente.",
    traits: [
      { label: "Versatilidade", direction: "up" },
      { label: "Volume Defensivo", direction: "up" },
      { label: "Projeção Ofensiva", direction: "up" },
      { label: "Especialização", direction: "down" },
    ],
  },
];

export function mcArchetypeTone(archetype: McArchetype): string {
  return MC_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "construtor";
}

export function mcArchetypeMetaFor(archetype: McArchetype) {
  return MC_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function mcHybridBadgeMetaFor(badge: string) {
  return MC_HYBRID_BADGE_META.find((item) => item.badge === badge);
}

export const EX_ARCHETYPES: ExArchetype[] = ["Driblador", "Meia Ponta", "Ruptura", "Híbrido"];

export const EX_HYBRID_BADGE_META: {
  badge: ExHybridBadge;
  short_label: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    badge: "Ala Criativa",
    short_label: "Criativa",
    description: "Combina drible e distribuição — cria a partir da condução e do passe.",
    traits: [
      { label: "Dribles", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Distribuição", direction: "up" },
      { label: "Toques na Área", direction: "down" },
    ],
  },
  {
    badge: "Ala Direta",
    short_label: "Direta",
    description: "Dribla e rompe linhas — perfil de ponta vertical no terço final.",
    traits: [
      { label: "Dribles", direction: "up" },
      { label: "Conduções Progressivas", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Passes Longos", direction: "down" },
    ],
  },
  {
    badge: "Ala Projetiva",
    short_label: "Projetiva",
    description: "Distribui e ataca espaços — combina passe e ruptura.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Recepção Longa", direction: "up" },
      { label: "Dribles", direction: "down" },
    ],
  },
  {
    badge: "Ala Completa",
    short_label: "Completa",
    description: "Elite nas três frentes — drible, passe e ruptura acima da média.",
    traits: [
      { label: "Dribles", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "xA", direction: "up" },
    ],
  },
];

export const EX_ARCHETYPE_META: {
  archetype: ExArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Driblador",
    tone: "driblador",
    description: "Referência em condução: dribles e duelos ofensivos.",
    traits: [
      { label: "Dribles", direction: "up" },
      { label: "Duelos Ofensivos", direction: "up" },
      { label: "Conduções Progressivas", direction: "up" },
      { label: "Passes Longos", direction: "down" },
    ],
  },
  {
    archetype: "Meia Ponta",
    tone: "meia-ponta",
    description: "Criador de jogo: passes, PTF e distribuição.",
    traits: [
      { label: "Passes Progressivos", direction: "up" },
      { label: "PTF", direction: "up" },
      { label: "Distribuição", direction: "up" },
      { label: "Dribles", direction: "down" },
    ],
  },
  {
    archetype: "Ruptura",
    tone: "ruptura",
    description: "Rompe linhas: condução progressiva, toques na área e recepção de passes longos.",
    traits: [
      { label: "Conduções Progressivas", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Recepção Longa", direction: "up" },
      { label: "Cruzamentos", direction: "down" },
    ],
  },
  {
    archetype: "Híbrido",
    tone: "hibrido",
    description: "Dois eixos fortes — perfil dual com identidade em mais de uma frente.",
    traits: [
      { label: "Versatilidade", direction: "up" },
      { label: "Drible", direction: "up" },
      { label: "Passe", direction: "up" },
      { label: "Especialização", direction: "down" },
    ],
  },
];

export function exArchetypeTone(archetype: ExArchetype): string {
  return EX_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "driblador";
}

export function exArchetypeMetaFor(archetype: ExArchetype) {
  return EX_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function exHybridBadgeMetaFor(badge: string) {
  return EX_HYBRID_BADGE_META.find((item) => item.badge === badge);
}

export const AT_ARCHETYPES: AtArchetype[] = ["Finalizador", "Alvo", "Móvel", "Híbrido"];

export const AT_ARCHETYPE_META: {
  archetype: AtArchetype;
  tone: string;
  description: string;
  traits: ArchetypeTrait[];
}[] = [
  {
    archetype: "Alvo",
    tone: "alvo",
    description: "Referência aérea: duelos de cabeça e presença na área.",
    traits: [
      { label: "Duelos Aéreos", direction: "up" },
      { label: "Gols de Cabeça", direction: "up" },
      { label: "Toques na Área", direction: "up" },
      { label: "Dribles", direction: "down" },
    ],
  },
  {
    archetype: "Finalizador",
    tone: "finalizador",
    description: "Referência em finalização: volume de chutes e xG.",
    traits: [
      { label: "Finalizações", direction: "up" },
      { label: "xG", direction: "up" },
      { label: "Gols", direction: "up" },
      { label: "Passes Criativos", direction: "down" },
    ],
  },
  {
    archetype: "Móvel",
    tone: "movel",
    description: "Atacante de movimento: dribles, conduções progressivas e passes.",
    traits: [
      { label: "Dribles", direction: "up" },
      { label: "Conduções Progressivas", direction: "up" },
      { label: "Passes Progressivos", direction: "up" },
      { label: "Duelos Aéreos", direction: "down" },
    ],
  },
  {
    archetype: "Híbrido",
    tone: "hibrido",
    description: "Dois eixos fortes — perfil dual com identidade em mais de uma frente.",
    traits: [
      { label: "Versatilidade", direction: "up" },
      { label: "Finalização", direction: "up" },
      { label: "Mobilidade", direction: "up" },
      { label: "Especialização", direction: "down" },
    ],
  },
];

export function atArchetypeTone(archetype: AtArchetype): string {
  return AT_ARCHETYPE_META.find((item) => item.archetype === archetype)?.tone ?? "finalizador";
}

export function atArchetypeMetaFor(archetype: AtArchetype) {
  return AT_ARCHETYPE_META.find((item) => item.archetype === archetype);
}

export function archetypesForFamily(family: "zagueiros" | "laterais" | "meio-campistas" | "extremos" | "atacantes"): string[] {
  if (family === "laterais") return LAT_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "meio-campistas") return MC_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "extremos") return EX_ARCHETYPE_META.map((item) => item.archetype);
  if (family === "atacantes") return AT_ARCHETYPE_META.map((item) => item.archetype);
  return ZAG_ARCHETYPE_META.map((item) => item.archetype);
}

/** @deprecated use archetypeCounts */
export function clusterCounts(players: { cluster?: ZagCluster | null }[]) {
  const { counts } = archetypeCounts(players);
  return { macros: counts, micros: counts };
}
