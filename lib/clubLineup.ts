import { fieldSlots, type Formation, type FormationSlot } from "@/lib/formations";
import type { PositionFamily } from "@/lib/types";

export type LineupSource = {
  player_id: string;
  name: string;
  position: string;
  position_family: PositionFamily;
  minutes: number;
  rating: number;
};

export type SquadRole = "titular" | "reserva";

export type PositionEntry = {
  playerId: string;
  role: SquadRole;
  minutes: number;
  name: string;
};

export type PositionLine = {
  label: string;
  entries: PositionEntry[];
};

export type BuiltSquad = {
  assignments: Record<string, string | null>;
  reservesBySlot: Record<string, string[]>;
  lines: PositionLine[];
};

const FAMILY_LABELS: Record<PositionFamily, string[]> = {
  zagueiros: ["ZAG"],
  laterais: ["LE", "LD", "ALA", "ME", "MD"],
  "meio-campistas": ["VOL", "MC", "ME", "MD"],
  extremos: ["PE", "PD", "MEI", "ALA", "ME", "MD", "AT"],
  atacantes: ["AT"],
};

const LABEL_RANK: Record<string, number> = {
  GOL: 0,
  GK: 1,
  ZAG: 10,
  LE: 20,
  LD: 21,
  ALA: 22,
  VOL: 30,
  MC: 31,
  ME: 32,
  MD: 33,
  MEI: 40,
  PE: 41,
  PD: 42,
  AT: 50,
};

function preferenceLabels(player: LineupSource): string[] {
  switch (player.position) {
    case "Goleiro":
      return ["GOL", "GK"];
    case "Zagueiro":
      return ["ZAG"];
    case "Lateral Esquerdo":
      return ["LE", "ALA", "ME", "LD", "MD"];
    case "Lateral Direito":
      return ["LD", "ALA", "MD", "LE", "ME"];
    case "Meio-campista":
      return ["VOL", "MC", "ME", "MD"];
    case "Meia Ofensivo":
      return ["MEI", "PE", "PD", "MC", "AT"];
    case "Extremo Esquerdo":
      return ["PE", "MEI", "ALA", "ME", "PD", "AT"];
    case "Extremo Direito":
      return ["PD", "MEI", "ALA", "MD", "PE", "AT"];
    case "Atacante":
      return ["AT"];
    default:
      return FAMILY_LABELS[player.position_family] ?? [];
  }
}

function playerSide(position: string): "left" | "right" | "either" {
  if (position.includes("Esquerdo")) return "left";
  if (position.includes("Direito")) return "right";
  return "either";
}

function slotSide(slot: FormationSlot): "left" | "right" | "center" {
  if (slot.id.endsWith("-e") || slot.id === "le" || slot.id === "pe") return "left";
  if (slot.id.endsWith("-d") || slot.id === "ld" || slot.id === "pd") return "right";
  if (slot.x <= 36) return "left";
  if (slot.x >= 64) return "right";
  return "center";
}

function byUsage(a: LineupSource, b: LineupSource): number {
  return b.minutes - a.minutes || b.rating - a.rating || a.name.localeCompare(b.name, "pt");
}

function chooseSlot(slots: FormationSlot[], side: "left" | "right" | "either"): FormationSlot | null {
  if (!slots.length) return null;
  const score = (slot: FormationSlot) => {
    const facing = slotSide(slot);
    if (side === "either") return facing === "center" ? 0 : 1;
    if (facing === side) return 0;
    if (facing === "center") return 1;
    return 2;
  };
  return [...slots].sort((a, b) => {
    const diff = score(a) - score(b);
    if (diff) return diff;
    return side === "right" ? b.x - a.x : a.x - b.x;
  })[0];
}

function accepts(slot: FormationSlot, player: LineupSource): boolean {
  return slot.families.includes(player.position_family);
}

export function playerShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  const particles = new Set(["de", "da", "do", "dos", "das", "e"]);
  const significant = parts.filter((part) => !particles.has(part.toLowerCase()));
  const first = significant[0] ?? parts[0];
  const last = significant[significant.length - 1] ?? parts[parts.length - 1];
  if (first === last) return first;
  return `${first} ${last}`;
}

function toEntry(player: LineupSource, role: SquadRole): PositionEntry {
  return { playerId: player.player_id, role, minutes: player.minutes, name: player.name };
}

export function positionLines<T extends LineupSource>(
  formation: Formation,
  assignments: Record<string, string | null>,
  reservesBySlot: Record<string, string[]>,
  looseIds: string[],
  playersById: Map<string, T>,
): PositionLine[] {
  const slots = fieldSlots(formation);
  const byLabel = new Map<string, FormationSlot[]>();
  const appearance = new Map<string, number>();
  slots.forEach((slot, index) => {
    byLabel.set(slot.label, [...(byLabel.get(slot.label) ?? []), slot]);
    if (!appearance.has(slot.label)) appearance.set(slot.label, index);
  });

  const labels = [...byLabel.keys()].sort(
    (a, b) => (LABEL_RANK[a] ?? 80) - (LABEL_RANK[b] ?? 80) || (appearance.get(a) ?? 0) - (appearance.get(b) ?? 0),
  );

  const seen = new Set<string>();
  const lines: PositionLine[] = labels.map((label) => {
    const group = byLabel.get(label) ?? [];
    const starters: LineupSource[] = [];
    const reserves: LineupSource[] = [];
    for (const slot of group) {
      const id = assignments[slot.id];
      const player = id ? playersById.get(id) : undefined;
      if (!player || seen.has(player.player_id)) continue;
      starters.push(player);
      seen.add(player.player_id);
    }
    for (const slot of group) {
      for (const id of reservesBySlot[slot.id] ?? []) {
        const player = playersById.get(id);
        if (!player || seen.has(player.player_id)) continue;
        reserves.push(player);
        seen.add(player.player_id);
      }
    }
    starters.sort(byUsage);
    reserves.sort(byUsage);
    return {
      label,
      entries: [
        ...starters.map((player) => toEntry(player, "titular")),
        ...reserves.map((player) => toEntry(player, "reserva")),
      ],
    };
  });

  const homeless: LineupSource[] = [];
  const loose: LineupSource[] = [];
  for (const id of looseIds) {
    const player = playersById.get(id);
    if (!player || seen.has(player.player_id)) continue;
    loose.push(player);
  }
  loose.sort(byUsage);

  for (const player of loose) {
    const label = preferenceLabels(player).find((item) => lines.some((line) => line.label === item));
    const line = lines.find((item) => item.label === label);
    if (!line) {
      homeless.push(player);
      continue;
    }
    line.entries.push(toEntry(player, "reserva"));
    seen.add(player.player_id);
  }

  for (const line of lines) {
    const starters = line.entries.filter((entry) => entry.role === "titular").sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "pt"));
    const reserves = line.entries.filter((entry) => entry.role === "reserva").sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "pt"));
    line.entries = [...starters, ...reserves];
  }

  const keepers = homeless.filter((player) => /goleiro/i.test(player.position));
  const others = homeless.filter((player) => !/goleiro/i.test(player.position));
  if (keepers.length) {
    lines.unshift({
      label: "GOL",
      entries: [...keepers].sort(byUsage).map((player) => toEntry(player, "reserva")),
    });
  }
  if (others.length) {
    lines.push({
      label: "OUT",
      entries: [...others].sort(byUsage).map((player) => toEntry(player, "reserva")),
    });
  }

  return lines;
}

function reserveHome(player: LineupSource, slots: FormationSlot[]): string | null {
  for (const label of preferenceLabels(player)) {
    const match = slots.find((slot) => slot.label === label && accepts(slot, player));
    if (match) return match.id;
  }
  const primary = slots.find((slot) => accepts(slot, player) && slot.families[0] === player.position_family);
  if (primary) return primary.id;
  return slots.find((slot) => accepts(slot, player))?.id ?? null;
}

function bestOpenSlot(player: LineupSource, slots: FormationSlot[], assignments: Record<string, string | null>): FormationSlot | null {
  const open = slots.filter((slot) => assignments[slot.id] == null && accepts(slot, player));
  if (!open.length) return null;
  const side = playerSide(player.position);
  for (const label of preferenceLabels(player)) {
    const match = chooseSlot(
      open.filter((slot) => slot.label === label),
      side,
    );
    if (match) return match;
  }
  return chooseSlot(open, side);
}

/** Most-used player in each position starts. Everyone else from the club is a reserve. */
export function buildClubLineup(players: LineupSource[], formation: Formation): BuiltSquad {
  const slots = fieldSlots(formation);
  const assignments: Record<string, string | null> = Object.fromEntries(slots.map((slot) => [slot.id, null]));
  const byId = new Map(players.map((player) => [player.player_id, player]));
  const sorted = [...byId.values()].sort(byUsage);
  const used = new Set<string>();

  for (const player of sorted) {
    const slot = bestOpenSlot(player, slots, assignments);
    if (!slot) continue;
    assignments[slot.id] = player.player_id;
    used.add(player.player_id);
  }

  const reservesBySlot: Record<string, string[]> = {};
  const loose: string[] = [];
  for (const player of sorted) {
    if (used.has(player.player_id)) continue;
    const slotId = reserveHome(player, slots);
    if (!slotId) {
      loose.push(player.player_id);
      continue;
    }
    reservesBySlot[slotId] = [...(reservesBySlot[slotId] ?? []), player.player_id];
  }

  return {
    assignments,
    reservesBySlot,
    lines: positionLines(formation, assignments, reservesBySlot, loose, byId),
  };
}
