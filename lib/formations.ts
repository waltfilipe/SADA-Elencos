import type { PositionFamily } from "@/lib/types";

export type FormationSlot = {
  id: string;
  label: string;
  /** 0–100 from left sideline to right. */
  x: number;
  /** 0–100 from attack line (top) to goal line (bottom). */
  y: number;
  families: PositionFamily[];
};

export type Formation = {
  id: string;
  label: string;
  slots: FormationSlot[];
};

const F = {
  zag: ["zagueiros"] as PositionFamily[],
  lat: ["laterais"] as PositionFamily[],
  mc: ["meio-campistas"] as PositionFamily[],
  /** Pontas: extremos primeiro, mas atacantes que jogam abertos também entram. */
  ex: ["extremos", "atacantes"] as PositionFamily[],
  at: ["atacantes"] as PositionFamily[],
  wing: ["extremos", "laterais"] as PositionFamily[],
  wide: ["extremos", "laterais", "meio-campistas"] as PositionFamily[],
  mid: ["meio-campistas", "extremos"] as PositionFamily[],
  atk: ["atacantes", "extremos"] as PositionFamily[],
};

export const FORMATIONS: Formation[] = [
  {
    id: "4-3-3",
    label: "4-3-3",
    slots: [
      { id: "ld", label: "LD", x: 86, y: 72, families: F.lat },
      { id: "zag-e", label: "ZAG", x: 36, y: 74, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 64, y: 74, families: F.zag },
      { id: "le", label: "LE", x: 14, y: 72, families: F.lat },
      { id: "mc-e", label: "MC", x: 28, y: 52, families: F.mid },
      { id: "vol", label: "VOL", x: 50, y: 56, families: F.mc },
      { id: "mc-d", label: "MC", x: 72, y: 52, families: F.mid },
      { id: "pe", label: "PE", x: 16, y: 26, families: F.ex },
      { id: "at", label: "AT", x: 50, y: 14, families: F.atk },
      { id: "pd", label: "PD", x: 84, y: 26, families: F.ex },
    ],
  },
  {
    id: "4-4-2",
    label: "4-4-2",
    slots: [
      { id: "ld", label: "LD", x: 86, y: 72, families: F.lat },
      { id: "zag-e", label: "ZAG", x: 36, y: 74, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 64, y: 74, families: F.zag },
      { id: "le", label: "LE", x: 14, y: 72, families: F.lat },
      { id: "md-e", label: "ME", x: 18, y: 48, families: F.wide },
      { id: "mc-e", label: "MC", x: 38, y: 52, families: F.mid },
      { id: "mc-d", label: "MC", x: 62, y: 52, families: F.mid },
      { id: "md-d", label: "MD", x: 82, y: 48, families: F.wide },
      { id: "at-e", label: "AT", x: 38, y: 18, families: F.atk },
      { id: "at-d", label: "AT", x: 62, y: 18, families: F.atk },
    ],
  },
  {
    id: "4-2-3-1",
    label: "4-2-3-1",
    slots: [
      { id: "ld", label: "LD", x: 86, y: 72, families: F.lat },
      { id: "zag-e", label: "ZAG", x: 36, y: 74, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 64, y: 74, families: F.zag },
      { id: "le", label: "LE", x: 14, y: 72, families: F.lat },
      { id: "vol-e", label: "VOL", x: 38, y: 56, families: F.mc },
      { id: "vol-d", label: "VOL", x: 62, y: 56, families: F.mc },
      { id: "meia-e", label: "MEI", x: 20, y: 36, families: F.ex },
      { id: "meia", label: "MEI", x: 50, y: 32, families: F.ex },
      { id: "meia-d", label: "MEI", x: 80, y: 36, families: F.ex },
      { id: "at", label: "AT", x: 50, y: 14, families: F.atk },
    ],
  },
  {
    id: "3-5-2",
    label: "3-5-2",
    slots: [
      { id: "zag-e", label: "ZAG", x: 26, y: 74, families: F.zag },
      { id: "zag", label: "ZAG", x: 50, y: 76, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 74, y: 74, families: F.zag },
      { id: "ala-e", label: "ALA", x: 10, y: 50, families: F.wing },
      { id: "mc-e", label: "MC", x: 32, y: 54, families: F.mid },
      { id: "vol", label: "VOL", x: 50, y: 58, families: F.mc },
      { id: "mc-d", label: "MC", x: 68, y: 54, families: F.mid },
      { id: "ala-d", label: "ALA", x: 90, y: 50, families: F.wing },
      { id: "at-e", label: "AT", x: 38, y: 18, families: F.atk },
      { id: "at-d", label: "AT", x: 62, y: 18, families: F.atk },
    ],
  },
  {
    id: "3-4-3",
    label: "3-4-3",
    slots: [
      { id: "zag-e", label: "ZAG", x: 26, y: 74, families: F.zag },
      { id: "zag", label: "ZAG", x: 50, y: 76, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 74, y: 74, families: F.zag },
      { id: "ala-e", label: "ALA", x: 14, y: 50, families: F.wing },
      { id: "mc-e", label: "MC", x: 38, y: 54, families: F.mid },
      { id: "mc-d", label: "MC", x: 62, y: 54, families: F.mid },
      { id: "ala-d", label: "ALA", x: 86, y: 50, families: F.wing },
      { id: "pe", label: "PE", x: 20, y: 24, families: F.ex },
      { id: "at", label: "AT", x: 50, y: 14, families: F.atk },
      { id: "pd", label: "PD", x: 80, y: 24, families: F.ex },
    ],
  },
  {
    id: "5-3-2",
    label: "5-3-2",
    slots: [
      { id: "ala-e", label: "ALA", x: 8, y: 66, families: F.wing },
      { id: "zag-e", label: "ZAG", x: 28, y: 74, families: F.zag },
      { id: "zag", label: "ZAG", x: 50, y: 76, families: F.zag },
      { id: "zag-d", label: "ZAG", x: 72, y: 74, families: F.zag },
      { id: "ala-d", label: "ALA", x: 92, y: 66, families: F.wing },
      { id: "mc-e", label: "MC", x: 30, y: 50, families: F.mid },
      { id: "vol", label: "VOL", x: 50, y: 54, families: F.mc },
      { id: "mc-d", label: "MC", x: 70, y: 50, families: F.mid },
      { id: "at-e", label: "AT", x: 38, y: 18, families: F.atk },
      { id: "at-d", label: "AT", x: 62, y: 18, families: F.atk },
    ],
  },
];

export const DEFAULT_FORMATION_ID = "4-3-3";

export function fieldSlots(formation: Formation): FormationSlot[] {
  return formation.slots.filter((s) => s.families.length > 0);
}

export function formationById(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

/** Pick the best empty slot for a player given their position family. */
export function suggestSlotId(formation: Formation, family: PositionFamily, taken: Set<string>): string | null {
  const empty = fieldSlots(formation).filter((s) => !taken.has(s.id));
  const exact = empty.find((s) => s.families.includes(family));
  if (exact) return exact.id;
  const loose = empty.find((s) => s.families.length > 1);
  return loose?.id ?? empty[0]?.id ?? null;
}

/** When switching formation, remap assignments by slot label then family. */
export function remapAssignments(
  from: Formation,
  to: Formation,
  assignments: Record<string, string | null>,
): Record<string, string | null> {
  const next: Record<string, string | null> = {};
  for (const slot of fieldSlots(to)) next[slot.id] = null;

  const players: { playerId: string; label: string }[] = [];
  for (const slot of fieldSlots(from)) {
    const pid = assignments[slot.id];
    if (pid) players.push({ playerId: pid, label: slot.label });
  }

  const used = new Set<string>();
  for (const entry of players) {
    const byLabel = fieldSlots(to).find((s) => s.label === entry.label && !next[s.id] && !used.has(s.id));
    if (byLabel) {
      next[byLabel.id] = entry.playerId;
      used.add(byLabel.id);
      continue;
    }
    const open = fieldSlots(to).find((s) => !next[s.id] && !used.has(s.id));
    if (open) {
      next[open.id] = entry.playerId;
      used.add(open.id);
    }
  }

  return next;
}

/** Group slots into lines for the profile map (attack → defense). */
export function slotLines(formation: Formation): FormationSlot[][] {
  const slots = [...fieldSlots(formation)].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: FormationSlot[][] = [];
  let current: FormationSlot[] = [];
  let lastY = -1;

  for (const slot of slots) {
    if (current.length && Math.abs(slot.y - lastY) > 8) {
      lines.push(current);
      current = [];
    }
    current.push(slot);
    lastY = slot.y;
  }
  if (current.length) lines.push(current);
  return lines;
}
