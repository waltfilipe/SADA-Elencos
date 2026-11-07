/**
 * O app roda com basePath "/elencos" para ser montado sob o domínio do
 * sada-test (rewrite /elencos/* → este deploy). Links/redirects do Next
 * recebem o prefixo automaticamente; fetch() e <img src> não — daí este
 * helper para URLs de API e assets estáticos.
 */
export const BASE_PATH = "/elencos";

export function appPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
