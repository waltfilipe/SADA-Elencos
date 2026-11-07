import type { PositionFamily } from "@/lib/types";

export type StatSectionTone =
  | "defensivos"
  | "aereo"
  | "passes"
  | "dribles"
  | "finais"
  | "ofensividade"
  | "finalizacao";

export type StatSectionSpec = {
  title: string;
  labels: string[];
  tone: StatSectionTone;
};

const ZAG_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva"],
  },
  {
    title: "Aéreo",
    tone: "aereo",
    labels: ["Aéreo"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Disputas com Bola", "Conduções Progressivas"],
  },
];

const LAT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
  },
  {
    title: "Passes Finais",
    tone: "finais",
    labels: ["Cruzamentos", "Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Ofensividade",
    tone: "ofensividade",
    labels: ["Ofensividade"],
  },
];

const MC_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Defensivos", "Ações Defensivas e Recuperações", "Eficiência Defensiva", "Duelos Aéreos"],
  },
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Dribles e Condução",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Conduções Progressivas"],
  },
  {
    title: "Passes Finais",
    tone: "finais",
    labels: ["Passes Chave e Área", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Ofensividade",
    tone: "ofensividade",
    labels: ["Finalizações", "Ofensividade"],
  },
];

const EX_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Passes",
    tone: "passes",
    labels: ["Passes Progressivos", "Passes para Terço Final", "Passes Longos", "Distribuição"],
  },
  {
    title: "Passes Finais",
    tone: "finais",
    labels: ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Condução e Drible",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
  },
  {
    title: "Finalização",
    tone: "finalizacao",
    labels: ["Gols e xG", "Finalizações"],
  },
  {
    title: "Ofensividade",
    tone: "ofensividade",
    labels: ["Ações Terminais", "Verticalidade"],
  },
  {
    title: "Defensivos",
    tone: "defensivos",
    labels: ["Duelos Vencidos", "Ações Defensivas", "Recuperações"],
  },
];

const AT_STAT_SECTIONS: StatSectionSpec[] = [
  {
    title: "Finalização",
    tone: "finalizacao",
    labels: ["Gols e xG", "Finalizações", "Efetividade"],
  },
  {
    title: "Duelos Aéreos",
    tone: "aereo",
    labels: ["Duelos Aéreos"],
  },
  {
    title: "Passes Finais",
    tone: "finais",
    labels: ["Passes Chave e Área", "Cruzamentos", "Pré Assistências e xA", "Passes Criativos"],
  },
  {
    title: "Condução e Drible",
    tone: "dribles",
    labels: ["Disputas com Bola", "1v1 - Ofensivo", "Progressão"],
  },
];

export function statSectionsForFamily(family: PositionFamily): StatSectionSpec[] {
  if (family === "laterais") return LAT_STAT_SECTIONS;
  if (family === "meio-campistas") return MC_STAT_SECTIONS;
  if (family === "extremos") return EX_STAT_SECTIONS;
  if (family === "atacantes") return AT_STAT_SECTIONS;
  if (family === "zagueiros") return ZAG_STAT_SECTIONS;
  return ZAG_STAT_SECTIONS;
}

export function statSectionTone(title: string): StatSectionTone {
  const all = [...ZAG_STAT_SECTIONS, ...LAT_STAT_SECTIONS, ...MC_STAT_SECTIONS, ...EX_STAT_SECTIONS, ...AT_STAT_SECTIONS];
  return all.find((section) => section.title === title)?.tone ?? "defensivos";
}
