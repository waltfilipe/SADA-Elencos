import type { PositionFamily } from "./types";

export type ProfileMetaItem = {
  key: string;
  label: string;
  tone: string;
};

export const FAMILY_PROFILE_META: Record<PositionFamily, ProfileMetaItem[]> = {
  zagueiros: [
    { key: "perfil", label: "Nota do Perfil", tone: "hibrido" },
    { key: "construcao", label: "Construção", tone: "construtor" },
    { key: "defesa", label: "Defesa", tone: "defensivo" },
  ],
  laterais: [
    { key: "defensivo", label: "Defensivo", tone: "defensivo" },
    { key: "construtor", label: "Construtor", tone: "construtor" },
    { key: "vertical", label: "Vertical", tone: "vertical" },
    { key: "ofensivo", label: "Ofensivo", tone: "ofensivo" },
  ],
  "meio-campistas": [
    { key: "contencao", label: "Contenção", tone: "contencao" },
    { key: "construtor", label: "Construtor", tone: "construtor" },
    { key: "boxtobox", label: "Box-to-box", tone: "boxtobox" },
  ],
  extremos: [
    { key: "driblador", label: "Driblador", tone: "driblador" },
    { key: "meia_ponta", label: "Meia Ponta", tone: "meia-ponta" },
    { key: "ruptura", label: "Ruptura", tone: "ruptura" },
  ],
  atacantes: [
    { key: "finalizador", label: "Finalizador", tone: "finalizador" },
    { key: "alvo", label: "Alvo", tone: "alvo" },
    { key: "movel", label: "Móvel", tone: "movel" },
  ],
};

export function profileMetaForFamily(family: PositionFamily): ProfileMetaItem[] {
  return FAMILY_PROFILE_META[family];
}

/** Highlights the axis card that best matches the player's classified profile. */
export function dominantRatingKey(
  profile: string,
  family: PositionFamily,
  hybridLean?: string | null,
): string | null {
  if (family !== "zagueiros") {
    const match = FAMILY_PROFILE_META[family].find((item) => item.label === profile);
    return match?.key ?? null;
  }
  if (profile === "Construtor") return "construcao";
  if (profile === "Defensivo") return "defesa";
  if (profile === "Híbrido") {
    return hybridLean === "+ Construtor" ? "construcao" : "defesa";
  }
  return null;
}
