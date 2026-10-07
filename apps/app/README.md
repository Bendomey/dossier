# Dossier app

The product: workspace chat, company knowledge and settings. React Router v7
(SSR), TanStack Query, Tailwind CSS v4 and Arc UI.

```bash
yarn dev          # http://localhost:3001
yarn build && yarn start
yarn types:check
yarn lint
```

There is no backend yet. `app/lib/mock/db.ts` stands in for the API and the
`app/api/*` modules call it; any well-formed email signs in.
