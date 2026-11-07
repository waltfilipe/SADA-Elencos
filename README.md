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
