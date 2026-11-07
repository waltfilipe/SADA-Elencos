export type ReportLang = "pt" | "en";

/** Fixed copy of the PDF sheet. Data labels go through `translateLabel`. */
export const REPORT_COPY = {
  pt: {
    kicker: "Relatório do atleta",
    highlights: "Highlights no YouTube",
    profile: "Perfil",
    heatmap: "Mapa de calor",
    heatmapEmpty: "Mapa indisponível",
    minutes: "Minutos",
    minutesShare: (pct: number) => `${pct}% da competição`,
    goals: "Gols",
    assists: "Assistências",
    marketValue: "Valor de mercado",
    onLoan: (club: string) => `Empréstimo · ${club}`,
    contract: "Contrato",
    contractUntil: (date: string) => `até ${date}`,
    tendencies: "Tendências de passe",
    badges: "Selos",
    stats: "Estatísticas",
    value: "dado",
    percentile: "percentil",
    per90: "Por 90",
    efficiency: "Eficiência",
    transfermarkt: "Transfermarkt",
    sheet: "Ficha online",
    age: (years: number) => `${years} anos`,
    bioAge: "Idade",
    bioHeight: "Altura",
    bioFoot: "Pé",
    bioNationality: "Nacionalidade",
    bioYears: (years: number) => `${years} anos`,
    generated: (date: string) => `Gerado em ${date}`,
    legendTitle: "Como ler",
    legendPercentile: (pool: string) =>
      `Percentil de 0 a 100 contra ${pool}. Verde a partir de 70, laranja até 30.`,
    legendRates: "“Por 90” e “/90” são taxas por 90 minutos. Gols, assistências, xG, xA e erros somam a temporada.",
    legendBadge:
      "Badge é o selo de destaque: o atleta supera o percentil 50 da posição em volume e em eficiência daquele bloco.",
    legendProjection:
      "O número menor ao lado do dado e a fita dourada no percentil são a projeção ajustada por minutos (50% média dos titulares + 50% mesmo perfil na divisão).",
    pool: (family: string, league: string) => `${family.toLocaleLowerCase("pt-BR")} da ${league}`,
    longer: "Mais longo que a média",
    shorter: "Mais curto que a média",
    onAverage: "Na média da posição",
    longShare: (pct: number) => `${pct}% longos`,
    average: "média",
    shortPass: "Passe curto",
    progressivePass: "Passe progressivo",
    crosses: "Cruzamentos",
    gpsTitle: "Dados de GPS",
    gpsMeta: (competition: string, matches: number, minutes: number) =>
      `${competition} · ${matches} jogos · ${minutes.toLocaleString("pt-BR")} min`,
    gpsAvgTitle: (count: number) => `Dados de GPS · média de ${count} temporada${count > 1 ? "s" : ""}`,
    pdfTitle: "Exportar PDF",
    portuguese: "Português",
    english: "English",
    summaryKicker: "Resumo do atleta",
    tacticalProfile: "Perfil tático",
    rankOf: (rank: number, pool: number) => `${rank}º de ${pool}`,
    overview: "Leitura geral",
    summaryLine: (above: number, total: number, best: string, bestScore: number, worst: string, worstScore: number) =>
      `Acima da mediana da posição em ${above} de ${total} blocos. Melhor bloco: ${best} (${bestScore}). Ponto de atenção: ${worst} (${worstScore}).`,
    distAbove: (n: number) => `${n} acima de 70`,
    distMid: (n: number) => `${n} entre 30 e 70`,
    distBelow: (n: number) => `${n} até 30`,
    radar: "Perfil estatístico",
    radarHint: "Média dos percentis de cada bloco",
    blocks: "Desempenho por bloco",
    blocksHint: "Distância da mediana da posição (50)",
    medianKey: "Mediana da posição (50)",
    strengths: "Pontos fortes",
    strengthsHint: "Maiores percentis do atleta",
    weaknesses: "Pontos a desenvolver",
    weaknessesHint: "Menores percentis do atleta",
    noStrengths: "Nenhuma métrica acima da mediana da posição.",
    noWeaknesses: "Nenhuma métrica abaixo da mediana da posição.",
    page: (n: number, total: number) => `Página ${n} de ${total}`,
    seasonTag: "Temporada",
    seasonArchive: "Temporada",
    seasonArchiveSub: "Arquivo de temporada",
    multiKicker: "Resumo multi-temporada",
    multiTag: "Temporadas",
    multiSeasons: (n: number) => `${n} temporadas avaliadas`,
    coveredSeasons: "Temporadas incluídas",
    club: "Clube",
    avgCol: "Média",
    avgProfileTitle: "Perfil médio",
    avgProfileHint: "Média dos perfis ponderada por minutos",
    blocksPerSeasonTitle: "Blocos por temporada",
    blocksPerSeasonHint: "Média dos percentis de cada bloco",
    blocksRadarTitle: "Desempenho por bloco",
    blocksRadarHint: "Média ponderada pelos minutos de cada temporada",
    avgMetricsHint: "Média dos percentis entre as temporadas",
    avgTendenciesHint: "Média ponderada pelos minutos em campo",
    avgHeatmapTitle: "Mapa de calor médio",
    avgNote:
      "Percentis comparados ao pool da posição de cada temporada; médias ponderadas pelos minutos em campo.",
  },
  en: {
    kicker: "Player report",
    highlights: "YouTube highlights",
    profile: "Profile",
    heatmap: "Heatmap",
    heatmapEmpty: "Map unavailable",
    minutes: "Minutes",
    minutesShare: (pct: number) => `${pct}% of league minutes`,
    goals: "Goals",
    assists: "Assists",
    marketValue: "Market value",
    onLoan: (club: string) => `On loan from ${club}`,
    contract: "Contract",
    contractUntil: (date: string) => `until ${date}`,
    tendencies: "Passing tendencies",
    badges: "Badges",
    stats: "Statistics",
    value: "value",
    percentile: "percentile",
    per90: "Per 90",
    efficiency: "Efficiency",
    transfermarkt: "Transfermarkt",
    sheet: "Online profile",
    age: (years: number) => `Age ${years}`,
    bioAge: "Age",
    bioHeight: "Height",
    bioFoot: "Foot",
    bioNationality: "Nationality",
    bioYears: (years: number) => `${years} yrs`,
    generated: (date: string) => `Generated on ${date}`,
    legendTitle: "How to read",
    legendPercentile: (pool: string) => `Percentile from 0 to 100 against ${pool}. Green from 70, orange up to 30.`,
    legendRates: "“Per 90” and “/90” are rates per 90 minutes. Goals, assists, xG, xA and errors are season totals.",
    legendBadge:
      "A badge marks a strength: the player is above the 50th percentile for the position in both volume and efficiency of that block.",
    legendProjection:
      "The smaller figure beside a rate, and the gold ribbon on the percentile, are the minutes-adjusted projection (50% regulars mean + 50% same profile in the division).",
    pool: (family: string, league: string) => `${family.toLocaleLowerCase("en-GB")} in ${league}`,
    longer: "Longer than average",
    shorter: "Shorter than average",
    onAverage: "In line with the position",
    longShare: (pct: number) => `${pct}% long`,
    average: "avg",
    shortPass: "Short passing",
    progressivePass: "Progressive passing",
    crosses: "Crosses",
    gpsTitle: "GPS data",
    gpsMeta: (competition: string, matches: number, minutes: number) =>
      `${competition} · ${matches} matches · ${minutes.toLocaleString("en-US")} min`,
    gpsAvgTitle: (count: number) => `GPS data · ${count}-season average`,
    pdfTitle: "Export PDF",
    portuguese: "Português",
    english: "English",
    summaryKicker: "Player summary",
    tacticalProfile: "Tactical profile",
    rankOf: (rank: number, pool: number) => `${ordinal(rank, "en")} of ${pool}`,
    overview: "Overview",
    summaryLine: (above: number, total: number, best: string, bestScore: number, worst: string, worstScore: number) =>
      `Above the positional median in ${above} of ${total} blocks. Best block: ${best} (${bestScore}). Watch point: ${worst} (${worstScore}).`,
    distAbove: (n: number) => `${n} above 70`,
    distMid: (n: number) => `${n} between 30 and 70`,
    distBelow: (n: number) => `${n} at 30 or below`,
    radar: "Statistical profile",
    radarHint: "Average percentile of each block",
    blocks: "Performance by block",
    blocksHint: "Distance from the positional median (50)",
    medianKey: "Positional median (50)",
    strengths: "Strengths",
    strengthsHint: "Player's highest percentiles",
    weaknesses: "Areas to develop",
    weaknessesHint: "Player's lowest percentiles",
    noStrengths: "No metric above the positional median.",
    noWeaknesses: "No metric below the positional median.",
    page: (n: number, total: number) => `Page ${n} of ${total}`,
    seasonTag: "Season",
    seasonArchive: "Season",
    seasonArchiveSub: "Season archive",
    multiKicker: "Multi-season summary",
    multiTag: "Seasons",
    multiSeasons: (n: number) => `${n} seasons evaluated`,
    coveredSeasons: "Seasons included",
    club: "Club",
    avgCol: "Avg",
    avgProfileTitle: "Average profile",
    avgProfileHint: "Minutes-weighted average of profile shares",
    blocksPerSeasonTitle: "Blocks per season",
    blocksPerSeasonHint: "Average percentile of each block",
    blocksRadarTitle: "Performance by block",
    blocksRadarHint: "Average percentile weighted by minutes each season",
    avgMetricsHint: "Average percentile across seasons",
    avgTendenciesHint: "Minutes-weighted average",
    avgHeatmapTitle: "Average heatmap",
    avgNote:
      "Percentiles vs each season's positional pool; averages weighted by minutes played.",
  },
} as const;

const EN_SECTIONS: Record<string, string> = {
  Defensivos: "Defending",
  Aéreo: "Aerial",
  Passes: "Passing",
  "Dribles e Condução": "Dribbling & Carrying",
  "Condução e Drible": "Carrying & Dribbling",
  "Passes Finais": "Final Passes",
  Ofensividade: "Attacking Threat",
  Finalização: "Finishing",
  "Duelos Aéreos": "Aerial Duels",
};

const EN_LABELS: Record<string, string> = {
  // Stat blocks and badges
  "1v1 - Ofensivo": "Attacking 1v1",
  "Ações Defensivas": "Defensive Actions",
  "Ações Defensivas e Recuperações": "Defensive Actions & Recoveries",
  "Recuperações": "Recoveries",
  "Ações sem Bola/90": "Off-Ball Actions/90",
  "Índice de Eficiência": "Efficiency Index",
  "Ações Terminais": "Final Actions",
  Aéreo: "Aerial",
  "Conduções Progressivas": "Progressive Carries",
  Cruzamentos: "Crosses",
  "Disciplina defensiva": "Defensive Discipline",
  "Disputas com Bola": "Offensive Duels",
  Distribuição: "Distribution",
  "Duelos Aéreos": "Aerial Duels",
  "Duelos Defensivos": "Defensive Duels",
  "Duelos Vencidos": "Duels Won",
  Efetividade: "Effectiveness",
  "Eficiência Defensiva": "Defensive Efficiency",
  "Estilo de defesa": "Defending Style",
  Finalizações: "Shots",
  "Gols e xG": "Goals & xG",
  Ofensividade: "Attacking Threat",
  "Passes Chave e Área": "Key & Box Passes",
  "Passes Criativos": "Creative Passes",
  "Passes Longos": "Long Passes",
  "Passes Progressivos": "Progressive Passes",
  "Passes para Terço Final": "Passes to Final Third",
  Progressão: "Progression",
  "Pré Assistências e xA": "Pre-assists & xA",
  "Tendência de Passe": "Passing Tendency",
  Verticalidade: "Verticality",

  // Sub-metrics
  "% Toque na Área": "% Touches in Box",
  Acelerações: "Accelerations",
  "Ações Ofensivas": "Attacking Actions",
  "Chutes Bloqueados": "Shots Blocked",
  Eficiência: "Efficiency",
  "Eficiência de finalização": "Finishing Efficiency",
  "Erros Totais": "Total Errors",
  "Finalizações certas": "Shots on Target",
  "Finalizações certas / passe recebido": "Shots on Target / Pass Received",
  Gols: "Goals",
  "Gols / toques na área": "Goals / Box Touches",
  Interceptações: "Interceptions",
  "Passes Chave": "Key Passes",
  "Assistências para remate": "Shot assists",
  "Passes Recebidos": "Passes Received",
  "Passes para Área": "Passes to Box",
  "Pré Assistências": "Pre-assists",
  Rebatidas: "Clearances",
  "Recepção de Passes Longos": "Long Passes Received",
  "Toques na Área": "Touches in Box",

  // Positions and families
  Atacante: "Striker",
  "Extremo Direito": "Right Winger",
  "Extremo Esquerdo": "Left Winger",
  "Lateral Direito": "Right-back",
  "Lateral Esquerdo": "Left-back",
  "Meia Ofensivo": "Attacking Midfielder",
  "Meio-campista": "Central Midfielder",
  Zagueiro: "Centre-back",
  Zagueiros: "Centre-backs",
  Laterais: "Full-backs",
  "Meio-campistas": "Central Midfielders",
  "Meias Ofensivos": "Attacking Midfielders",
  Atacantes: "Strikers",

  // Profiles
  "Ala Completa": "Complete Winger",
  "Ala Criativa": "Creative Winger",
  "Ala Direta": "Direct Winger",
  "Ala Projetiva": "Advancing Winger",
  Alvo: "Target Forward",
  "Box-to-box": "Box-to-box",
  Combativo: "Combative",
  Construtor: "Ball-player",
  "Construtor Nato": "Natural Ball-player",
  "Construtor Âncora": "Anchor Ball-player",
  Contenção: "Holding",
  Defensivo: "Defensive",
  "Defensor de Área": "Box Defender",
  Driblador: "Dribbler",
  Finalizador: "Finisher",
  Híbrido: "Hybrid",
  "Lateral Base": "Base Full-back",
  "Lateral Completo": "Complete Full-back",
  "Lateral Moderno": "Modern Full-back",
  "Lateral Projetivo": "Attacking Full-back",
  "MC Combativo": "Combative CM",
  "MC Completo": "Complete CM",
  "MC Projetivo": "Advancing CM",
  "Meia Ponta": "Playmaking Winger",
  Móvel: "Mobile Forward",
  Ofensivo: "Attacking",
  Ruptura: "Runner in Behind",
  "Volante Base": "Base Holding Midfielder",
  "Nota do Perfil": "Profile Score",
  Construção: "Build-up",
  Defesa: "Defending",
  Vertical: "Vertical",

  // Tendency axes
  Agressivo: "Aggressive",
  Alto: "High",
  Baixo: "Low",
  Cobertura: "Cover",
  Curto: "Short",
  Disciplinado: "Disciplined",
  Faltoso: "Foul-prone",
  Longo: "Long",

  // Foot
  Destro: "Right-footed",
  Canhoto: "Left-footed",
  Ambidestro: "Two-footed",
};

const PT_NATIONALITIES: Record<string, string> = {
  "Antigua and Barbuda": "Antígua e Barbuda",
  Australia: "Austrália",
  Belgium: "Bélgica",
  Brazil: "Brasil",
  Cameroon: "Camarões",
  Canada: "Canadá",
  "Congo DR": "RD Congo",
  Croatia: "Croácia",
  "Côte d'Ivoire": "Costa do Marfim",
  Denmark: "Dinamarca",
  Ecuador: "Equador",
  England: "Inglaterra",
  Finland: "Finlândia",
  France: "França",
  Germany: "Alemanha",
  Ghana: "Gana",
  Guinea: "Guiné",
  Hungary: "Hungria",
  Italy: "Itália",
  Jamaica: "Jamaica",
  Japan: "Japão",
  Liberia: "Libéria",
  Libya: "Líbia",
  Mexico: "México",
  Netherlands: "Holanda",
  "New Zealand": "Nova Zelândia",
  Nigeria: "Nigéria",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguai",
  "Puerto Rico": "Porto Rico",
  Romania: "Romênia",
  Scotland: "Escócia",
  Serbia: "Sérvia",
  Spain: "Espanha",
  "St. Lucia": "Santa Lúcia",
  "St. Vincent and the Grenadines": "São Vicente e Granadinas",
  Sweden: "Suécia",
  Switzerland: "Suíça",
  "Trinidad and Tobago": "Trinidad e Tobago",
  Uganda: "Uganda",
  "United States": "Estados Unidos",
  Uruguay: "Uruguai",
  Wales: "País de Gales",
};

/** Translates a data label, keeping a trailing "/90" or ", %" suffix. */
export function translateLabel(label: string, lang: ReportLang): string {
  if (lang === "pt" || !label) return label;
  const direct = EN_LABELS[label];
  if (direct) return direct;
  const suffix = label.match(/(\/90|\/ 90)$/)?.[0];
  if (suffix) {
    const base = label.slice(0, -suffix.length).trim();
    return `${EN_LABELS[base] ?? base}/90`;
  }
  return label;
}

export function translateSection(title: string, lang: ReportLang): string {
  if (lang === "pt") return title;
  return EN_SECTIONS[title] ?? translateLabel(title, lang);
}

/** Transfermarkt sends nationalities in English. */
export function translateNationality(name: string | null | undefined, lang: ReportLang): string | null {
  if (!name) return null;
  return lang === "pt" ? PT_NATIONALITIES[name] ?? name : name;
}

/** Decimal comma to decimal point for stat values like "39,1" or "+1,0". */
export function localizeValue(value: string, lang: ReportLang): string {
  if (lang === "pt") return value;
  return value.replace(/(\d),(\d)/g, "$1.$2");
}

/** Transfermarkt values arrive as "€ 1.50 mi." or "€ 300 mil". */
export function localizeMarketValue(value: string | null | undefined, lang: ReportLang): string {
  const raw = value?.trim();
  if (!raw || raw === "-") return "—";
  const match = raw.match(/^€\s*([\d.,]+)\s*(mi\.?|mil)?$/i);
  if (!match) return raw;
  const [, amount, unit] = match;
  const isMillions = unit?.toLowerCase().startsWith("mi") && unit.toLowerCase() !== "mil";
  if (lang === "en") return `€${amount}${isMillions ? "m" : unit ? "k" : ""}`;
  const pt = amount.replace(".", ",");
  return `€ ${pt}${isMillions ? " mi" : unit ? " mil" : ""}`;
}

/** Contract length from Transfermarkt, e.g. "3 anos e 4 meses". */
export function localizeContract(value: string | null | undefined, lang: ReportLang): string {
  const raw = value?.trim();
  if (!raw) return "—";
  if (lang === "pt") return raw;
  if (raw === "Contrato vencido") return "Expired";
  return raw
    .replace(/(\d+)\s*anos?/g, (_, n) => `${n} ${n === "1" ? "year" : "years"}`)
    .replace(/(\d+)\s*(meses|mes)/g, (_, n) => `${n} ${n === "1" ? "month" : "months"}`)
    .replace(/(\d+)\s*dia\(s\)/g, (_, n) => `${n} ${n === "1" ? "day" : "days"}`)
    .replace(/\s+e\s+/g, " ");
}

export function reportLocale(lang: ReportLang): string {
  return lang === "en" ? "en-GB" : "pt-BR";
}

export function ordinal(rank: number, lang: ReportLang): string {
  if (lang === "pt") return `${rank}º`;
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th";
  return `${rank}${suffix}`;
}
