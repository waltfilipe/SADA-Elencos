/** Normalized slug for static logo paths under `/public/clubs/`. */
export function clubSlug(club: string): string {
  return club
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Official Transfermarkt names that use a crest we already have. */
const LOGO_ALIASES: Record<string, string> = {
  "aa-maguary": "maguary-pe",
  "asa-de-arapiraca": "asa",
  "atletico-goianiense": "atletico-go",
  "atletico-mineiro-b": "atletico-mineiro",
  "avai-fc": "avai",
  "barra-fc": "barra",
  "botafogo-fc": "botafogo-sp",
  "botafogo-fr": "botafogo",
  "brusque-fc": "brusque",
  "cd-santa-clara": "santa-clara",
  "cianorte-fc": "cianorte",
  "clube-do-remo": "remo",
  "cr-flamengo": "flamengo",
  "cr-vasco-da-gama": "vasco-da-gama",
  "criciuma-ec": "criciuma",
  "cruzeiro-ec": "cruzeiro",
  "cuiaba-ec": "cuiaba",
  "ec-bahia": "bahia",
  "ec-juventude": "juventude",
  "ec-primavera": "primavera-sp",
  "ec-vitoria": "vitoria",
  "ec-vitoria-u20": "vitoria",
  "ec-xv-de-piracicaba": "xv-de-piracicaba",
  "fc-alverca": "alverca",
  "fc-porto": "porto",
  "ferroviario-ac": "ferroviario",
  "fluminense-fc": "fluminense",
  "fortaleza-ec": "fortaleza",
  "goias-ec": "goias",
  "gremio-fbpa": "gremio",
  "guarani-fc": "guarani",
  "ituano-fc-u20": "ituano",
  "londrina-ec": "londrina",
  "manauara-ec": "manauara",
  "maringa-fc": "maringa",
  "mirassol-fc": "mirassol",
  "operario-fec": "operario-pr",
  "rb-bragantino": "red-bull-bragantino",
  "rb-bragantino-u20": "red-bull-bragantino-u20",
  "santa-cruz-fc": "santa-cruz",
  "santos-fc": "santos",
  "sao-paulo-fc": "sao-paulo",
  "sc-corinthians": "corinthians",
  "sc-internacional": "internacional",
  "se-gama": "gama",
  "se-palmeiras": "palmeiras",
  "vila-nova-fc": "vila-nova",
  "volta-redonda-fc": "volta-redonda",
  "coritiba-fc": "coritiba",
  // MLS Next Pro youth sides and the former Quakes II name share a crest we have.
  "the-town": "quakes-ii",
  "chicago-fire-u15": "chicago-fire",
  "chicago-fire-u17": "chicago-fire",
  "columbus-crew-u17": "columbus-crew",
  "dallas-u17": "dallas",
  "inter-miami-u18": "inter-miami",
  "los-angeles-u17": "los-angeles-fc",
  "new-york-city-u15": "new-york-city",
};

export function clubLogoSrc(club: string): string {
  const slug = clubSlug(club);
  return `/clubs/${LOGO_ALIASES[slug] ?? slug}.png`;
}

export function clubInitials(club: string): string {
  const words = club.replace(/\s+U20$/i, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
