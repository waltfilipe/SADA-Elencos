import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import { LEAGUES } from "./leagues";

const DATA_DIR = path.join(process.cwd(), "data", "cross-season");
const CLUB_SEASONS = ["2022", "2023", "2024", "2025", "2026"];

/** Tokens de forma jurídica/afiliação comuns em nomes de clubes (TM e dataset). */
const CLUB_TOKENS = new Set([
  "fc", "ec", "sc", "ac", "fr", "saf", "cf", "cr", "clube", "cl", "ca", "aa",
  "esporte", "sport", "futebol", "futbol", "regatas", "associacao", "atletico",
  "atlético", "club", "do", "da", "de", "di", "dos", "das", "e", "se", "ser",
  "ge", "ce", "cd", "cn", "sv", "ss", "rb", "ad", "ao", "fec", "fbpa", "afc",
  "u20", "sub20", "sub-20", "b", "sa", "oficial", "ecfc", "fbc",
]);

export function normClub(name: string): string {
  const tokens = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (tokens.length > 1 && CLUB_TOKENS.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && CLUB_TOKENS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join("");
}

let brazilianClubSet: Set<string> | null = null;

/** Clubes vistos nos dados (ligas/temporadas + pessoas + transferências). */
export function brazilianClubs(): Set<string> {
  if (brazilianClubSet) return brazilianClubSet;
  const set = new Set<string>();
  const add = (club?: string | null) => {
    if (!club) return;
    const norm = normClub(club);
    if (norm.length >= 4) set.add(norm);
  };

  try {
    const people = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "people.json"), "utf-8")) as Record<
      string,
      { clubs?: string[] }
    >;
    for (const person of Object.values(people)) for (const club of person.clubs ?? []) add(club);
  } catch {
    /* people.json ausente — segue com os demais conjuntos */
  }

  for (const league of LEAGUES) {
    for (const season of CLUB_SEASONS) {
      try {
        for (const player of getPlayers(league.id, season)) add(player.club);
      } catch {
        /* liga/temporada sem arquivo */
      }
    }
  }

  try {
    const transfers = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "transfers.json"), "utf-8"),
    ) as Record<string, { legs?: { from_club?: string | null; to_club?: string | null }[] }>;
    for (const record of Object.values(transfers)) {
      for (const leg of record.legs ?? []) {
        add(leg.from_club);
        add(leg.to_club);
      }
    }
  } catch {
    /* transfers.json ausente */
  }

  brazilianClubSet = set;
  return set;
}

const tokenize = (value: string) => value.split(/\s+/).filter(Boolean);

export function isBrazilianClub(club: string): boolean {
  const norm = normClub(club);
  if (norm.length < 4) return true; // nome curto demais p/ decidir — não marca como exterior
  const set = brazilianClubs();
  if (set.has(norm)) return true;
  const normTokens = tokenize(norm);
  for (const known of set) {
    const knownTokens = tokenize(known);
    // Um dos lados com token único: exige token inteiro igual — senão
    // "napoli" casaria dentro de "anapolina" (substring ≠ palavra).
    if (normTokens.length === 1 || knownTokens.length === 1) {
      const single = normTokens.length === 1 ? normTokens[0] : knownTokens[0];
      const other = normTokens.length === 1 ? knownTokens : normTokens;
      if (other.includes(single)) return true;
      continue;
    }
    if (known.includes(norm) || norm.includes(known)) return true;
  }
  return false;
}

/**
 * Clubes de ligas europeias (nomes como aparecem no cache .com.br do TM,
 * normalizados por normClub). Cobre os destinos reais observados nas saídas
 * das séries A–C + os principais clubes da Europa.
 */
const EUROPE_CLUBS_RAW = [
  // Portugal
  "fc porto", "sl benfica", "sporting cp", "sporting", "sc braga", "vitoria guimaraes", "vitória guimarães",
  "boavista", "estoril", "famalicao", "casa pia", "arouca", "moreirense", "cd nacional", "santa clara",
  "rio ave", "gil vicente", "sc farense", "estrela amadora", "avs futebol", "cd tondela", "pacos ferreira",
  "portimonense", "fc vizela", "gd chaves", "cs maritimo", "fc alverca", "gil vicente fc",
  // Espanha
  "real madrid", "real madrid cf", "fc barcelona", "atletico de madrid", "atlético de madrid", "sevilla",
  "villarreal", "valencia", "athletic bilbao", "real sociedad", "real betis", "getafe", "girona",
  "celta vigo", "osasuna", "rcd mallorca", "mallorca", "rcd espanyol", "espanyol", "deportivo alaves",
  "alaves", "rayo vallecano", "elche", "levante", "granada", "cadiz", "ud almeria", "almeria",
  "cd leganes", "leganes", "real valladolid", "valladolid", "ud las palmas", "las palmas",
  // Inglaterra
  "chelsea", "arsenal", "liverpool", "manchester united", "manchester city", "tottenham", "newcastle",
  "aston villa", "west ham", "everton", "brighton", "wolverhampton", "wolves", "leicester",
  "southampton", "nottingham forest", "fulham", "crystal palace", "bournemouth", "brentford",
  "leeds united", "burnley", "sheffield united", "ipswich", "luton", "watford", "sunderland",
  "middlesbrough", "norwich", "west bromwich", "stoke city", "hull city", "qpr", "blackburn",
  "coventry", "birmingham city", "cardiff city", "swansea", "derby county",
  // Itália
  "inter de milao", "inter de milão", "inter milan", "inter", "ac milan", "milan", "juventus",
  "as roma", "roma", "napoli", "lazio", "atalanta", "fiorentina", "torino", "bologna", "genoa",
  "sampdoria", "udinese", "sassuolo", "empoli", "ac monza", "monza", "lecce", "cagliari",
  "hellas verona", "parma", "como", "venezia", "salernitana", "frosinone", "spezia", "pisa",
  // Alemanha
  "bayern munique", "bayern", "borussia dortmund", "dortmund", "rb leipzig", "bayer leverkusen",
  "leverkusen", "vfb stuttgart", "stuttgart", "wolfsburg", "eintracht frankfurt", "frankfurt",
  "borussia monchengladbach", "gladbach", "sc freiburg", "freiburg", "tsg 1899 hoffenheim",
  "hoffenheim", "mainz", "union berlin", "fc augsburg", "augsburg", "werder bremen",
  "fc koln", "koln", "hertha berlin", "schalke", "hamburg", "vfl bochum", "heidenheim",
  // França
  "paris saint-germain", "psg", "olympique de marseille", "marseille", "olympique lyonnais", "lyon",
  "as monaco", "monaco", "losc lille", "lille", "ogc nice", "nice", "stade rennais", "rennes",
  "rc lens", "lens", "rc strasbourg", "strasbourg", "fc nantes", "nantes", "montpellier",
  "toulouse", "stade de reims", "reims", "stade brestois", "brest", "auxerre", "angers",
  "saint-etienne", "lorient", "fc metz", "le havre", "clermont",
  // Holanda
  "ajax", "psv eindhoven", "psv", "feyenoord", "az alkmaar", "fc twente", "twente", "utrecht",
  "vitesse", "heerenveen", "sparta rotterdam", "nec nijmegen", "fortuna sittard", "go ahead eagles",
  // Rússia / Ucrânia
  "zenit sao petersburgo", "zenit são petersburgo", "zenit", "dinamo moscou", "dínamo moscou",
  "dynamo moscow", "cska moscou", "cska moscow", "spartak moscou", "spartak moscow", "lokomotiv",
  "fk krasnodar", "krasnodar", "rostov", "rubin kazan", "pfk sochi", "shakhtar donetsk",
  "dynamo kyiv", "dinamo kiev", "karpaty lviv", "dnipro", "zorya luhansk", "oleksandriya",
  // Turquia
  "galatasaray", "fenerbahce", "besiktas", "trabzonspor", "basaksehir", "goztepe", "samsunspor",
  "antalyaspor", "adana demirspor", "konyaspor", "kayserispor", "rizespor", "alanyaspor",
  "sivasspor", "kasimpasa", "hatayspor", "istanbulspor", "pendikspor", "fatih karagumruk",
  // Bélgica / Suíça / Áustria
  "club brugge", "rsc anderlecht", "anderlecht", "krc genk", "genk", "standard liege",
  "royal antwerp", "antwerp", "kaa gent", "gent", "union saint-gilloise", "charleroi",
  "cercle brugge", "fc basel", "bsc young boys", "young boys", "fc zurich", "fc lugano",
  "servette", "fc st gallen", "fc luzern", "rb salzburg", "red bull salzburg", "sturm graz",
  "rapid wien", "austria wien", "lask",
  // Dinamarca / Escócia / Grécia / resto da UEFA
  "fc copenhague", "fc copenhagen", "midtjylland", "brondby", "fc nordsjaelland", "agf aarhus",
  "celtic", "rangers", "olympiacos", "olympiakos", "panathinaikos", "aek atenas", "aek athens",
  "paok", "aris salonica", "estrela vermelha", "red star belgrade", "crvena zvezda", "partizan",
  "dinamo zagreb", "hajduk split", "cska sofia", "ludogorets", "levski sofia", "legia warszawa",
  "legia", "lech poznan", "rakow", "slavia praga", "slavia praha", "sparta praga", "sparta praha",
  "viktoria plzen", "apoel", "omonia", "pafos fc", "aek larnaca", "hapoel tel aviv",
  "maccabi tel aviv", "maccabi haifa", "bodo glimt", "molde", "rosenborg", "brann", "viking fk",
  "malmo", "djurgarden", "hammarby", "aik", "ifk goteborg", "elfsborg", "bk hacken", "riga fc",
  "fcsb", "steaua", "cfr cluj", "dinamo bucuresti", "ferencvaros", "slovan bratislava",
  "olimpija ljubljana", "fk astana", "kairat", "qarabag", "sheriff tiraspol", "hjk helsinki",
  "zalgiris", "shamrock rovers", "sabah fk", "dinamo tbilisi",
];

let europeanClubSet: Set<string> | null = null;

export function europeanClubs(): Set<string> {
  if (!europeanClubSet) {
    europeanClubSet = new Set(
      EUROPE_CLUBS_RAW.map(normClub).filter((name) => name.length >= 4),
    );
  }
  return europeanClubSet;
}

export function isEuropeanClub(club: string): boolean {
  const norm = normClub(club);
  if (norm.length < 4) return false;
  const set = europeanClubs();
  if (set.has(norm)) return true;
  for (const known of set) {
    if (known.includes(norm) || norm.includes(known)) return true;
  }
  return false;
}
