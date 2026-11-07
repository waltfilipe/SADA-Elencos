import type { PlayerProfile } from "./types";

export type AspectGroupKey = keyof PlayerProfile["aspects"];

export const ASPECT_GROUP_META: Record<AspectGroupKey, { title: string; order: number }> = {
  defensivos: { title: "Defensivos", order: 1 },
  aereo: { title: "Aéreo", order: 1.5 },
  construcao: { title: "Construção", order: 2 },
  perfil_construcao: { title: "Perfil de construção", order: 3 },
  perfil_defensivo: { title: "Perfil defensivo", order: 4 },
  ofensivos: { title: "Ofensivos", order: 5 },
  terco_final: { title: "Terço final", order: 6 },
  passes_finais: { title: "Passes Finais", order: 7 },
  conducao_drible: { title: "Condução e Drible", order: 8 },
  finalizacao: { title: "Finalização", order: 9 },
  ofensividade: { title: "Ofensividade", order: 10 },
};

export function aspectGroupsForPlayers(a: PlayerProfile, b: PlayerProfile) {
  const keys = new Set<AspectGroupKey>([
    ...(Object.keys(a.aspects) as AspectGroupKey[]),
    ...(Object.keys(b.aspects) as AspectGroupKey[]),
  ]);

  return [...keys]
    .filter((key) => {
      const rowsA = a.aspects[key];
      const rowsB = b.aspects[key];
      return (rowsA?.length ?? 0) > 0 || (rowsB?.length ?? 0) > 0;
    })
    .sort((left, right) => ASPECT_GROUP_META[left].order - ASPECT_GROUP_META[right].order)
    .map((key) => ({ key, title: ASPECT_GROUP_META[key].title }));
}
