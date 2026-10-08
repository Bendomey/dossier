# Dossier app

The product: workspace chat, company knowledge and settings. React Router v7
(SSR), TanStack Query, Tailwind CSS v4 and Arc UI.

```bash
yarn dev          # http://localhost:3001
yarn build && yarn start
yarn types:check
yarn lint
```

Sign-in uses Supabase Auth and the database is Supabase Postgres via Prisma (see
the root CLAUDE.md). Most data screens still read `app/lib/mock/db.ts` until
their modules move onto Prisma.
