/** Grade colors and bar helpers — brand scale: D vermelho → C amarelo → B verde claro → A+ verde escuro. */

/** Stronger tones so the badge text can always stay white. */
export const LETTER_GRADE_PILL_COLORS: Record<string, string> = {
  "A+": "#0a5c31",
  A: "#0e7a40",
  "A-": "#12944a",
  "B+": "#17ad57",
  B: "#21bf66",
  "B-": "#5ea62f",
  "C+": "#98931d",
  C: "#c09a16",
  "C-": "#d0662a",
  D: "#d63c3b",
};

const LETTER_GRADE_COLOR_SCORES: Record<string, number> = {
  "A+": 8.8,
  A: 8.4,
  "A-": 8.0,
  "B+": 7.6,
  B: 7.2,
  "B-": 6.8,
  "C+": 6.45,
  C: 6.1,
  "C-": 5.9,
  D: 4.2,
};

const PASS_GRADE_STOPS: [number, [number, number, number]][] = [
  [0, [0xfe, 0x4a, 0x49]],
  [28, [0xfe, 0x9b, 0x52]],
  [46, [0xfe, 0xd7, 0x66]],
  [64, [0xaa, 0xee, 0x8c]],
  [82, [0x31, 0xe9, 0x81]],
  [100, [0x0b, 0x7a, 0x3e]],
];

const PASS_GRADE_DISPLAY_FLOOR = 4.875;
const PASS_GRADE_DISPLAY_SPAN = 3.625;

export function passGradePct(displayScore: number): number {
  return Math.max(
    0,
    Math.min(100, ((displayScore - PASS_GRADE_DISPLAY_FLOOR) / PASS_GRADE_DISPLAY_SPAN) * 100),
  );
}

export function passGradeGradientColor(pct: number): string {
  const position = Math.max(0, Math.min(100, pct));
  for (let i = 0; i < PASS_GRADE_STOPS.length - 1; i++) {
    const [startPct, startRgb] = PASS_GRADE_STOPS[i];
    const [endPct, endRgb] = PASS_GRADE_STOPS[i + 1];
    if (position <= endPct) {
      const span = endPct - startPct;
      const t = span <= 0 ? 0 : (position - startPct) / span;
      const rgb = startRgb.map((ch, idx) =>
        Math.round(ch + (endRgb[idx] - ch) * t),
      ) as [number, number, number];
      return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return "#0b7a3e";
}

export function barPosition(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.max(2, Math.min(98, passGradePct(score)));
}

export function percentBarPosition(pct: number | null | undefined): number {
  if (pct == null) return 0;
  return Math.max(2, Math.min(98, pct));
}

export function letterGradePillColor(
  letter: string | null | undefined,
  displayScore?: number | null,
): string {
  if (!letter || letter === "—") {
    if (displayScore != null) return passGradeGradientColor(passGradePct(displayScore));
    return "#334155";
  }
  const key = letter.toUpperCase();
  if (LETTER_GRADE_PILL_COLORS[key]) return LETTER_GRADE_PILL_COLORS[key];
  const score = LETTER_GRADE_COLOR_SCORES[key];
  if (score != null) return passGradeGradientColor(passGradePct(score));
  if (displayScore != null) return passGradeGradientColor(passGradePct(displayScore));
  return "#334155";
}

export function badgeTextColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 168 ? "#0d1b2a" : "#f8fafc";
}

export function gradeTier(score: number): string {
  if (score >= 8.2) return "Elite";
  if (score >= 7) return "Muito bom";
  if (score >= 6) return "Bom";
  if (score >= 5) return "Médio";
  return "Abaixo da média";
}
