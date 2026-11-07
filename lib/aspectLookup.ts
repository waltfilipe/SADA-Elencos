import type { AspectItem, PlayerProfile } from "@/lib/types";

export function flattenAspects(player: PlayerProfile): AspectItem[] {
  const groups = player.aspects;
  return [
    ...(groups.defensivos ?? []),
    ...(groups.construcao ?? []),
    ...(groups.ofensivos ?? []),
    ...(groups.aereo ?? []),
    ...(groups.terco_final ?? []),
    ...(groups.passes_finais ?? []),
    ...(groups.conducao_drible ?? []),
    ...(groups.finalizacao ?? []),
    ...(groups.ofensividade ?? []),
  ];
}

export function findAspect(items: AspectItem[], label: string): AspectItem | undefined {
  const aliases: Record<string, string[]> = {
    "Passes Chave e Área": ["Passes Chave e Área", "Passes Finas"],
    Progressão: ["Progressão", "Conduções Progressivas"],
    "Passes Chave": ["Passes Chave", "Assistências para remate", "Passes Finas"],
    "Assistências para remate": ["Assistências para remate", "Passes Chave"],
    "Disputas com Bola": ["Disputas com Bola", "Duelos Ofensivos"],
    "1v1 - Ofensivo": ["1v1 - Ofensivo", "Dribles"],
    "Pré Assistências e xA": ["Pré Assistências e xA", "Assistências e xA"],
    Aéreo: ["Aéreo", "Duelos Aéreos"],
    "Ações Defensivas e Recuperações": ["Ações Defensivas e Recuperações", "Ações Defensivas"],
  };
  const candidates = aliases[label] ?? [label];
  return items.find((item) => candidates.some((c) => item.label === c || item.label.startsWith(c)));
}
