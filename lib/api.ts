import type { PlayerProfile } from "./types";

export async function fetchMeta() {
  const res = await fetch("/api/meta", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar metadados");
  return res.json();
}

export async function fetchPlayers(params?: URLSearchParams) {
  const query = params?.toString();
  const res = await fetch(`/api/players${query ? `?${query}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar jogadores");
  return res.json();
}

export async function fetchPlayer(playerId: string, league?: string): Promise<PlayerProfile> {
  const query = league ? `?league=${encodeURIComponent(league)}` : "";
  const res = await fetch(`/api/players/${playerId}${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Jogador não encontrado");
  return res.json();
}

export async function fetchFamily(family: string, league?: string) {
  const query = league ? `?league=${encodeURIComponent(league)}` : "";
  const res = await fetch(`/api/families/${family}${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar posição");
  return res.json();
}

export async function fetchScatter(family: string, x: string, y: string, a?: string, b?: string) {
  const params = new URLSearchParams({ x, y });
  if (a) params.set("a", a);
  if (b) params.set("b", b);
  const res = await fetch(`/api/scatter/${family}?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar scatter");
  return res.json();
}
