const DRAG_MIME = "application/x-shadow-player";

type DragPayload = { playerId: string; sourceSlotId: string | null };

export function writeShadowDrag(data: DataTransfer, playerId: string, sourceSlotId: string | null) {
  const payload: DragPayload = { playerId, sourceSlotId };
  data.setData(DRAG_MIME, JSON.stringify(payload));
  data.effectAllowed = "move";
}

export function parseShadowDrag(data: DataTransfer): DragPayload | null {
  const raw = data.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
