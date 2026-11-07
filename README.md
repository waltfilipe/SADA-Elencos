# SADA Elencos

App de elencos do SADA (Sistema de Análise de Dados de Atletas), extraído do
[sada-test](https://github.com/waltfilipe/sada-test) apenas com as
funcionalidades de elenco:

- **Elenco** — escalação do clube por minutos, campinho editável (`/{liga}/elenco`)
- **Elencos Prévios** — elencos de temporadas anteriores (2022–2025) (`/{liga}/elencos-previos`)
- **Time Sombra** — times sombra por liga ou combinados (`/{liga}/time-sombra`)

Ligas: Série A–D do Brasileirão e Estaduais Nv1–Nv4.

## Rodar

```bash
npm install
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
```

Deploy: Vercel (framework Next.js, `vercel.json` incluído). Os dados vivem em
`data/` (JSONs por liga/temporada) e são servidos pelas rotas `/api/*` e
páginas estáticas.

## Mount nos apps SADA (`/elencos/*`)

O app roda com `basePath: "/elencos"` para ser montado no domínio de cada app
SADA (Brasileirão, Sulamérica, Europa…) via rewrite:

```ts
// next.config.ts do app scout
async rewrites() {
  return [{ source: "/elencos/:path*", destination: "https://sada-elencos.vercel.app/elencos/:path*" }];
}
```

## Sync do time sombra (nuvem)

O estado do time sombra é compartilhado entre os apps via
`GET/PUT /elencos/api/shadow/{scope}` (`scope` = id da liga, `todas`,
`estaduais`). Backend: Upstash Redis (REST, sem dependência extra).

**Ativar**: criar um store Upstash/Redis no projeto Vercel e definir:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Sem as vars, o endpoint responde `enabled:false` e cada app cai no
`localStorage` local (degradação silenciosa).
