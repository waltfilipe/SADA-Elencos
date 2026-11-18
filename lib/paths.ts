/**
 * O app roda no domínio próprio, sem basePath. O helper fica centralizado
 * para o caso de um dia ser montado sob um prefixo de novo.
 */
export const BASE_PATH = "";

export function appPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * App de scouting (dossiês de atleta, posições, filtros) — vive no domínio
 * próprio. Links de perfil no Elencos apontam para lá em nova aba, espelho
 * do botão "Elencos" que o sada-test expõe na direção contrária.
 */
export const SCOUT_APP_URL = "https://sada-test-v2.vercel.app";

export function scoutPath(path: string): string {
  return `${SCOUT_APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
