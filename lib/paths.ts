/**
 * O app roda no domínio próprio, sem basePath. O helper fica centralizado
 * para o caso de um dia ser montado sob um prefixo de novo.
 */
export const BASE_PATH = "";

export function appPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
