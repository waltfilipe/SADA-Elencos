import type { PositionFamily } from "./types";

export const POSITION_FAMILIES: {
  key: PositionFamily;
  slug: PositionFamily;
  label: string;
  short: string;
}[] = [
  { key: "zagueiros", slug: "zagueiros", label: "Zagueiros", short: "ZAG" },
  { key: "laterais", slug: "laterais", label: "Laterais", short: "LAT" },
  { key: "meio-campistas", slug: "meio-campistas", label: "Meio-campistas", short: "MC" },
  { key: "extremos", slug: "extremos", label: "Meias Ofensivos", short: "MO" },
  { key: "atacantes", slug: "atacantes", label: "Atacantes", short: "AT" },
];

const FAMILY_SLUG_ALIASES: Record<string, PositionFamily> = {
  "meias-ofensivos": "extremos",
};

export function familyBySlug(slug: string) {
  const key = (FAMILY_SLUG_ALIASES[slug] ?? slug) as PositionFamily;
  return POSITION_FAMILIES.find((f) => f.key === key) ?? POSITION_FAMILIES[0];
}

export function ratingColor(value: number): string {
  if (value >= 7.5) return "var(--rating-high)";
  if (value >= 6.5) return "var(--rating-mid)";
  return "var(--rating-low)";
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace(".", ",");
}
