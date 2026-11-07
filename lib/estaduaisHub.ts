import type { LeagueId } from "./leagues";

export type ChampionshipMark = {
  id: string;
  name: string;
  logo: string;
};

export type EstadualLevel = {
  id: LeagueId;
  name: string;
  hint: string;
  logo: string;
  members: ChampionshipMark[];
};

export const ESTADUAIS_LEVELS: EstadualLevel[] = [
  {
    id: "est-nv1",
    name: "Estaduais Nv1",
    hint: "Notas calculadas só entre Paulista, Gaúcho, Mineiro e Carioca.",
    logo: "/competitions/serie-a.svg",
    members: [
      { id: "paulista", name: "Paulista", logo: "/competitions/paulista.png" },
      { id: "gaucho", name: "Gaúcho", logo: "/competitions/gaucho.png" },
      { id: "mineiro", name: "Mineiro", logo: "/competitions/mineiro.svg" },
      { id: "carioca", name: "Carioca", logo: "/competitions/carioca.svg" },
    ],
  },
  {
    id: "est-nv2",
    name: "Estaduais Nv2",
    hint: "Notas calculadas só entre Paranaense, Catarinense, Paulista A2 e Baiano.",
    logo: "/competitions/serie-b.svg",
    members: [
      { id: "paranaense", name: "Paranaense", logo: "/competitions/paranaense.png" },
      { id: "catarinense", name: "Catarinense", logo: "/competitions/catarinense.jpg" },
      { id: "paulista-a2", name: "Paulista A2", logo: "/competitions/paulista-a2.png" },
      { id: "baiano", name: "Baiano", logo: "/competitions/baiano.svg" },
    ],
  },
  {
    id: "est-nv3",
    name: "Estaduais Nv3",
    hint: "Notas calculadas só entre Cearense, Pernambucano, Paulista A3 e Goiano.",
    logo: "/competitions/serie-c.svg",
    members: [
      { id: "cearense", name: "Cearense", logo: "/competitions/cearense.svg" },
      { id: "pernambucano", name: "Pernambucano", logo: "/competitions/pernambucano.svg" },
      { id: "paulista-a3", name: "Paulista A3", logo: "/competitions/paulista-a3.png" },
      { id: "goiano", name: "Goiano", logo: "/competitions/goiano.svg" },
    ],
  },
  {
    id: "est-nv4",
    name: "Estaduais Nv4",
    hint: "Notas calculadas só entre Paraense, Alagoano, Potiguar e Paulista A4.",
    logo: "/competitions/outros.svg",
    members: [
      { id: "paraense", name: "Paraense", logo: "/competitions/paraense.svg" },
      { id: "alagoano", name: "Alagoano", logo: "/competitions/alagoano.svg" },
      { id: "potiguar", name: "Potiguar", logo: "/competitions/potiguar.svg" },
      { id: "paulista-a4", name: "Paulista A4", logo: "/competitions/paulista-a4.svg" },
    ],
  },
];

export const ESTADUAIS_LEAGUE_IDS = ["est-nv1", "est-nv2", "est-nv3", "est-nv4"] as const;

export type EstadualLeagueId = (typeof ESTADUAIS_LEAGUE_IDS)[number];
