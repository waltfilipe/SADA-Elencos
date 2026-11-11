import "server-only";

import fs from "fs";
import path from "path";
import { getPlayers } from "./data.server";
import { LEAGUES } from "./leagues";

const CLUB_SEASONS = ["2022", "2023", "2024", "2025", "2026"];

/** Tokens de forma jurídica/afiliação comuns em nomes de clubes (TM e dataset). */
const CLUB_TOKENS = new Set([
  "fc", "ec", "sc", "ac", "fr", "saf", "cf", "cr", "clube", "cl", "ca", "aa",
  "esporte", "sport", "futebol", "futbol", "regatas", "associacao", "atletico",
  "atlético", "club", "do", "da", "de", "di", "dos", "das", "e", "se", "ser",
  "ge", "ce", "cd", "cn", "sv", "ss", "rb", "ad", "ao", "fec", "fbpa", "afc",
  "u20", "u21", "u23", "u19", "u18", "u17", "u16", "u15", "sub20", "sub-20",
  "ii", "iii", "b", "sa", "oficial", "ecfc", "fbc",
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

/** Grafias alternativas do TM para clubes brasileiros (não aparecem nas
 * linhas do dataset, então precisam de entrada explícita). */
const BR_EXTRA_CLUBS_RAW = [
  "goianiense", "ac goianiense", "operario ferroviario", "operario pr",
  "hercilio luz", "acec baraunas", "baraunas", "ge gloria", "gloria rs",
  "osasco sporting", "audax", "porto vitoria", "sd juazeirense",
  "serc brasil", "brasil de farroupilha", "uniao rondonopolis",
  "america fc", "america rn", "santos u20", "ypiranga fc",
  "atletico goianiense",
];

/**
 * Clubes brasileiros: linhas reais das ligas/temporadas locais + índice
 * estático gerado a partir do dataset completo (br-clubs.json — inclui
 * clubes de ligas que este app não carrega, como divisões estaduais).
 * Nomes estrangeiros podem constar nas linhas (Copinha convida gringos,
 * amistosos/Mundial entraram nas temporadas) — quem filtra é o veto de
 * FOREIGN_NON_EU_CLUBS / EUROPE_CLUBS na classificação, não este conjunto.
 */
export function brazilianClubs(): Set<string> {
  if (brazilianClubSet) return brazilianClubSet;
  const set = new Set<string>();
  const add = (club?: string | null) => {
    if (!club) return;
    const norm = normClub(club);
    if (norm.length >= 4) set.add(norm);
  };

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
    const staticList = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "cross-season", "br-clubs.json"), "utf-8"),
    ) as string[];
    for (const club of staticList) add(club);
  } catch {
    /* índice ausente — segue só com as linhas locais */
  }

  for (const club of BR_EXTRA_CLUBS_RAW) add(club);

  brazilianClubSet = set;
  return set;
}

/**
 * Match de clube: exato ou prefixo (≥6 chars). Prefixo cobre variantes do TM
 * ("operario" ⊂ "operariopr") sem o falso positivo de substring solta
 * ("napoli" ⊂ "anapolina", "inter" ⊂ "intermiami").
 */
function matchesClubSet(set: Set<string>, norm: string): boolean {
  if (set.has(norm)) return true;
  for (const known of set) {
    if (norm.length >= 6 && known.startsWith(norm)) return true;
    if (known.length >= 6 && norm.startsWith(known)) return true;
  }
  return false;
}

/**
 * Clubes estrangeiros fora da Europa que aparecem nas linhas dos dados
 * (Copinha/est-nv4 convida estrangeiros; mls-next-pro é liga dos EUA; amistosos
 * e Mundial de Clubes entraram em temporadas nacionais). Sem este veto, um
 * "Tigres UANL" presente numa linha vira "clube brasileiro" no conjunto.
 */
const FOREIGN_NON_EU_CLUBS_RAW = [
  // México
  "tigres uanl", "monterrey", "atlas", "leon", "pachuca", "toluca", "pumas unam",
  "chivas", "guadalajara", "cruz azul", "necaxa", "queretaro",
  "tijuana", "juarez fc", "mazatlan", "puebla", "santos laguna", "atletico san luis",
  // EUA / Canadá
  "inter miami", "miami", "atlanta united", "columbus crew", "fc dallas", "dallas",
  "new york city", "nycfc", "toronto", "vancouver", "portland timbers",
  "seattle sounders", "houston dynamo", "austin fc", "charlotte fc",
  "chicago fire", "fc cincinnati", "cincinnati", "colorado rapids",
  "minnesota united", "nashville", "new england", "orlando city",
  "philadelphia union", "real salt lake", "san diego", "sporting kc",
  "st louis city", "los angeles galaxy", "la galaxy", "lafc", "los angeles fc",
  "cf montreal", "montreal", "detroit city", "huntsville city",
  "loudoun united", "nomme united", "muras united", "uncg spartans",
  "wake forest", "san diego toreros", "seattle redhawks",
  "portland hearts of pine", "dc united", "red bull new york",
  // Argentina
  "boca juniors", "river plate", "racing club", "rosario central",
  "estudiantes", "talleres", "belgrano", "newells", "old boys", "banfield",
  "huracan", "gimnasia", "lanus", "velez", "san lorenzo", "argentinos juniors",
  "platense", "defensa y justicia", "instituto", "barracas central", "riestra",
  "sarmiento", "union santa fe", "central cordoba", "atletico tucuman",
  "godoy cruz", "colon", "independiente", "independiente rivadavia",
  "arsenal sarandi", "tigre",
  // Resto da América do Sul
  "cerro porteno", "cerro", "olimpia", "club libertad", "libertad",
  "nacional asuncion", "sport boys", "universitario", "alianza lima",
  "sporting cristal", "universitario de vinto", "bolivar", "the strongest",
  "colo colo", "universidad catolica", "universidad de chile",
  "deportivo cali", "deportivo pasto", "millonarios", "america de cali",
  "junior barranquilla", "atletico nacional", "independiente del valle",
  "independiente juniors", "barcelona sc", "emelec", "ldu", "ldu quito",
  "caracas", "deportivo tachira", "rayo zuliano", "alajuelense",
  "nacional montevideo", "penarol", "defensor sporting",
  // Ásia / Oceania
  "kashima antlers", "v-varen nagasaki", "daegu", "gimpo", "gimhae city",
  "yokohama", "suwon", "johor", "bg pathum", "buriram", "rayong",
  "sisaket united", "rasi salai", "tochigi city", "jef united",
  "ho chi minh", "shenzhen", "henan", "guangdong", "shandong",
  "melbourne city", "bc rangers", "kawasaki", "urawa", "vissel kobe",
  "sanfrecce", "gamba osaka", "cerezo osaka", "fc tokyo", "ulsan",
  "jeonbuk", "pohang", "fc seoul",
  // Oriente Médio / África
  "al ahli", "al fayha", "al hilal", "al nassr", "al ittihad", "al shabab",
  "al ettifaq", "al taawoun", "maccabi netanya", "hapoel ramat gan",
  "esperance", "al ahly", "mamelodi", "wydad",
  // Outros convidados observados
  "hamrun spartans", "aljustrelense", "drogheda united",
];

let nonEuForeignClubSet: Set<string> | null = null;

function nonEuForeignClubs(): Set<string> {
  if (!nonEuForeignClubSet) {
    nonEuForeignClubSet = new Set(
      FOREIGN_NON_EU_CLUBS_RAW.map(normClub).filter((name) => name.length >= 4),
    );
  }
  return nonEuForeignClubSet;
}

/** Veto estrangeiro: exato apenas. Prefixo aqui é perigoso — "americadecali"
 * engoliria "america" (América-RN/MG brasileiros). */
function isNonEuForeignClub(norm: string): boolean {
  return nonEuForeignClubs().has(norm);
}

export function isBrazilianClub(club: string): boolean {
  const norm = normClub(club);
  if (norm.length < 4) return true; // nome curto demais p/ decidir — não marca como exterior
  if (isNonEuForeignClub(norm)) return false;
  return matchesClubSet(brazilianClubs(), norm);
}

/**
 * Região do clube para fins de "salto": estrangeiro fora da Europa vence
 * primeiro (evita que "Sporting Cristal" caia no prefixo de "sporting" da
 * lista europeia), depois Europa, depois Brasil, senão exterior desconhecido.
 */
export function clubRegion(club: string): "europa" | "brasil" | "exterior" {
  const norm = normClub(club);
  if (isNonEuForeignClub(norm)) return "exterior";
  if (isEuropeanClub(club)) return "europa";
  if (norm.length < 4) return "brasil";
  if (matchesClubSet(brazilianClubs(), norm)) return "brasil";
  return "exterior";
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
  "paris saint-germain", "psg", "olympique de marseille", "olympique marselha", "marseille", "marselha", "olympique lyonnais", "lyon",
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
  // Ligas menores UEFA / grafias TM vistas como destino
  "modena", "modena fc", "widzew lodz", "desportivo tondela",
  "clube desportivo tondela", "coimbra sports", "birkirkara",
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
  return matchesClubSet(europeanClubs(), norm);
}
