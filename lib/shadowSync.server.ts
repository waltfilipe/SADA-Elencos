import "server-only";

import type { ShadowScope, ShadowTeamState } from "./shadowTeamStorage";

/**
 * Estado do time sombra compartilhado entre os apps SADA (Brasileirão,
 * Sulamérica, Europa...) via Upstash Redis. Sem env vars configuradas o
 * sync fica desligado e cada app usa só o localStorage — comportamento
 * idêntico ao de antes.
 *
 * Vars na Vercel: KV_REST_API_URL e KV_REST_API_TOKEN (integração Upstash).
 */

const API_URL = process.env.KV_REST_API_URL;
const API_TOKEN = process.env.KV_REST_API_TOKEN;

const VALID_SCOPES = new Set(["todas", "estaduais"]);

function kvKey(scope: string): string {
  return `sada:shadow:${scope}`;
}

export function shadowSyncEnabled(): boolean {
  return Boolean(API_URL && API_TOKEN);
}

export function isShadowScope(value: string): value is ShadowScope {
  return VALID_SCOPES.has(value) || /^[a-z0-9-]+$/.test(value);
}

export async function readCloudShadow(scope: ShadowScope): Promise<ShadowTeamState | null> {
  if (!shadowSyncEnabled()) return null;
  try {
    const res = await fetch(`${API_URL}/get/${encodeURIComponent(kvKey(scope))}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    if (!data.result) return null;
    return JSON.parse(data.result) as ShadowTeamState;
  } catch {
    return null;
  }
}

export async function writeCloudShadow(scope: ShadowScope, state: ShadowTeamState): Promise<boolean> {
  if (!shadowSyncEnabled()) return false;
  try {
    const res = await fetch(`${API_URL}/set/${encodeURIComponent(kvKey(scope))}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch {
    return false;
  }
}
