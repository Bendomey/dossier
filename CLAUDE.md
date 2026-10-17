# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **Never commit anything.** Do not run `git commit` under any circumstances — not for code, not for docs, not for specs. Leave all changes unstaged for the user to commit.

- **Comment sparingly.** Only write a comment when the code cannot carry the
  information itself — a non-obvious constraint, a subtle failure it guards
  against, or a decision whose reasoning is invisible from the code. Never
  restate what the code says, never narrate a change or its history, and never
  head a block with a label (`// Reset form`, `// Actions`). Prefer clearer
  names and smaller functions over an explanation. Default to none; one or two
  lines when it earns its place. This applies to test files too.

## Monorepo Structure

```
/apps
├── website/             Public marketing website (port 3000)
└── app/                 The product: workspace, knowledge, settings (port 3001)
/services
├── indexing-worker/     Cloudflare Worker: indexing queue consumer, DLQ, sweeps; runs the processor as a Container
└── document-processor/  Go service that extracts, chunks and embeds uploaded documents (port 8080)
```

## Common Commands

### Root Level
```bash
make run          # Run the website and the app
make run-website  # Website only
make run-app      # App only
```

### Website and app (apps/website, apps/app)
```bash
yarn dev          # Development server (port 3000)
yarn build        # Production build
yarn types:check  # TypeScript + React Router type generation
yarn lint         # ESLint check
yarn format       # Prettier formatting
```

## Website Architecture (apps/website)

**Tech Stack:** React Router v7 (SSR, file-based routes), React 19, TypeScript, TanStack Query v5, Tailwind CSS v4, Arc UI (`@uiarc`, shadcn registry), Shadcn UI (Radix)

**Structure:**
```
app/
├── api/           API integration layer (one folder per resource, client.ts / server.ts)
├── routes/        File-based routing (thin: loader, meta, default export from modules)
├── modules/       Page-level UI, one folder per page
├── components/
│   ├── arc/       Arc UI components (installed via shadcn CLI, do not edit internals)
│   ├── ui/        Shadcn/Radix primitives (only when Arc has no equivalent)
│   └── layout/    Header, footer, shared layout pieces
├── providers/     Context providers (React Query)
├── hooks/         Custom React hooks
├── lib/           Utilities and helpers (seo, transport, env)
└── types/         TypeScript definitions (global.d.ts at app root `types/`)
```

**Key Patterns:**
- Routes stay thin: export `loader`, `meta`, and the page component from `~/modules`
- API calls use TanStack Query; SSR data is passed down as `dehydratedState`
- Server env is validated with Zod in `app/lib/actions/env.server.ts`; only expose what the client needs through the root loader's `ENV`
- Form handling with React Hook Form + Zod validation

**UI components (Arc):**
- Prefer Arc components over shadcn/ui or hand-rolled UI. Install with `npx shadcn@latest add @uiarc/<name>`
- Browse components at https://uiarc.dev/llms.txt and read `https://uiarc.dev/components/<id>/markdown` before using one
- Arc components use CSS modules and the semantic tokens from `app/components/arc/foundation.css` (`--background`, `--surface`, `--foreground`, `--text-secondary`, `--border`, `--accent`, ...). Do not restyle their internals
- Motion presets live in `app/components/arc/lib/motion-tokens.ts`

**Dark Mode:**
- Theme is set with `data-theme="dark"` on `<html>` (Arc's convention). Tailwind's `dark:` variant is wired to the same attribute in `app/app.css`
- All UI changes MUST support both dark and light modes
- Prefer semantic tokens over hardcoded colors

## Translations (Website)

- All user-facing copy lives in `app/lib/i18n/messages.ts` (English). Never hardcode copy in components: add a key and read it with `const { t } = useTranslation()`; in a route `meta` function use `getMetaMessages(matches)`
- The visitor's language is stored in the `lang` cookie (set by `routes/api.language.ts`) and read in the root loader
- Other languages are generated server-side from the English dictionary with the Google Cloud Translation API (`app/lib/i18n/translate.server.ts`), cached in memory per language. Without `GOOGLE_TRANSLATE_API_KEY` the site serves English
- Brand terms that must not be translated go in `PROTECTED_TERMS`. Plan names and numbers stay as literals outside the dictionary

## App Architecture (apps/app)

Follows the rentloop property-manager conventions.

**Structure:**
```
app/
├── api/<resource>/   Fetchers + TanStack Query hooks (useGetX, useCreateX). Mutations invalidate what they change
├── routes/           Thin route files: loader/action, meta, handle.title, default export from ~/modules
├── modules/          Page UI (auth, workspace, knowledge, settings, error)
├── components/arc/   Arc UI (installed via shadcn, do not edit internals)
├── components/       Shared app components (layout shell, form controls, toggle chip)
├── lib/actions/      Server-only: env, cookie session, auth middleware, theme cookie
├── lib/mock/         In-browser stand-in for the API (seed data, scripted replies, store)
└── providers/        React Query, Auth
types/                Global domain types (*.d.ts)
```

**Key patterns:**
- Auth is Supabase Auth via `@supabase/ssr`, entirely server-side (loaders/actions). `createSupabaseServerClient(request)` (`~/lib/supabase.server`) returns the client plus `headers`: every response built in that request must carry those headers, or refreshed/cleared session cookies are lost. `routes/_auth.tsx` runs `authMiddleware`, which verifies the session with `getClaims()`, loads the person's membership with Prisma (`api/workspaces/server.ts`) and redirects to `/login?return_to=…` or, without a workspace, `/onboarding`
- Sign-up stores `full_name` and `company` in user metadata; the workspace (organization, Owner role, Everyone group, audit entry) is created by `/onboarding` once there is a session, so unconfirmed sign-ups leave nothing behind. `/auth/callback` completes Google sign-ins and email links (`code` or `token_hash`). Sign-out is a POST to `/logout`. Password reset: `/forgot-password` emails a recovery link (same neutral reply whether or not the account exists), `/auth/callback` signs the person in, and `/reset-password` sets the new password and signs out their other sessions
- Build OAuth and email redirect URLs with `getRequestOrigin(request)`: behind Fly's proxy `request.url` is plain HTTP
- Session data: the middleware loads one `Session` per request (user with role and permission keys, plus the organization summary). Components read it with `useSession()` (`~/providers/session-provider`), which also exposes `can('organization.update')`. Loaders and actions under `_auth` use `requireSession(context)` and `requirePermission(session, key)` (`~/lib/actions/session.server`); always check permissions on the server, hiding a control is not enough
- Workspaces: a person can belong to several organizations. The `workspace` cookie remembers the one they opened (`~/lib/actions/workspace.server`); `getSession` checks it against their active memberships and falls back to the oldest. The sidebar badge (`components/layout/workspace-switcher.tsx`) becomes a switcher once there is another workspace or a pending invitation; switching, accepting and declining post to `/workspaces`, which is also the full-page list. `/onboarding?new=1` creates an additional workspace
- Invitations (Settings, People): `createInvitation` saves the invitation with its role and groups, then `sendInvitationEmail` emails it through Supabase's admin API (`SUPABASE_SECRET_KEY`, server-only via `~/lib/supabase-admin.server`): Supabase's invite email for new addresses, a set-password (recovery) link for accounts an earlier invite created but nobody used, nothing for people who have signed in before (they see it in the switcher). Supabase's default emails put the session after `#` in the URL, which the server never sees: those links land on `/login`, whose `useEmailLinkSession` posts the tokens to `/auth/session` (same-origin only). Links with `code` or `token_hash` go through `/auth/callback`. Both use `landingAfterSignIn` (newcomers join their invitations; people with a workspace choose on `/workspaces`) and `emailLinkDestination` (invite and recovery links go to `/reset-password` to set a password). Expired invitations stay listed on People with Resend, which extends them 7 days and emails again. `profiles.email` mirrors `auth.users.email` through triggers so lists never read the auth schema
- Audit log: every write records an `audit_logs` row (`action` like `member.invited`, details in `metadata`). `describeAuditEvent` in `api/audit-events/server.ts` words each action for the page and CSV; add a case there when you add a new action. Filters map action prefixes to categories (Documents, AI work, Members, Workspace). Times are shown in GMT (UTC), local time in Ghana and Liberia
- Knowledge: real workspaces use `modules/knowledge/workspace.tsx` (loader + action in `routes/_auth.knowledge.tsx`, server code in `api/collections/server.ts`); `/demo/knowledge` keeps `DemoKnowledgeModule` on the mock store (uploads, processing, drawer). Members only see collections shared with one of their groups (`visibleCollections`); owners and admins see all. Collections are managed in a bottom sheet (name, description, icon, groups; `collections.manage`); a collection with documents can't be deleted. Uploads go straight to R2: `/api/uploads` (`initiate`) checks permission and presigns a PUT to `staging/{org}/{upload_id}` plus a signed upload token; the browser PUTs the file; `complete` verifies size and file signature, copies it to `org/{org}/uploads/{upload_id}/source.{ext}` and creates the document, version, `indexing_jobs` row, `outbox_events` row and audit entry in one transaction, then dispatches the event (`api/indexing/server.ts`: Cloudflare Queues in production, a POST to `PROCESSOR_URL` in development). Nothing touches the database before the file is verified. A document's status (Queued, Processing, Ready, Failed) comes from `documentIndexingState` (active version + newest version's latest job); `documents.current_version_id` only moves when the processor activates a version. Retry inserts a new job; the drawer (`routes/_auth.knowledge.$documentId.tsx`) lists versions with Download, Retry, Upload new version and Remove (soft delete). Every environment uses the same R2 bucket and real keys. The Upload button needs `UPLOADS_ENABLED=true` and R2 credentials (see `docs/runbooks/r2-bucket.md`)
- Removing people (`members.remove`, Owner and Admin): deletes the membership with its roles, groups and chat access; what they created stays. The owner can't be removed and nobody removes themselves
- Screens backed by Prisma read in the route `loader` and write in the route `action` (forms or `useFetcher`), not TanStack Query; React Router revalidates after each action, so session-wide data such as the sidebar refreshes on its own. Demo routes under `/demo` keep their own loader/action with sample data
- Data: on Prisma so far: auth, workspaces, Settings (Organization, People, Groups, Audit log, Your account), Knowledge (collections, direct-to-R2 uploads, the document list and the document drawer), chats (Ask). Billing and the rest of `app/api/*` not listed above still call `~/lib/mock/db`. Move each module onto Prisma server code as it is built; hooks and components stay as they are
- Chat replies stream through `useReplyStream`, which writes `ChatStreamEvent`s into the query cache. Hooks in `api/chats/index.ts` call the real endpoints, or the mock under `/demo` (`useAppBase().demo`)
- AI chat (Ask): chats are private to their creator and live in Prisma (`api/chats/server.ts`); the endpoints are `_auth.api.chats.*` resource routes. A send inserts the question and a `PENDING` reply in one transaction (an `Idempotency-Key` header makes repeats return the same pair) and `startReply` (`lib/ai/orchestrator.server.ts`) runs the reply detached from the request; the browser follows it with `GET /api/chats/:id/stream`, which attaches to the in-process reply or polls the row, so reloads and other Fly machines resume it. The operation is the composer's mode, else the chat's last one, else an intent call; only ASK runs so far: outside `/demo` the other mode cards show "Soon" and are disabled, and requests routed to them reply "coming soon". Ask (`lib/ai/operations/ask.server.ts`) searches the person's readable collections (recomputed every turn, narrowed by `chat_collections`) with exact pgvector plus `search_vector` full-text (kept by a trigger) over current, indexed versions, merges them by reciprocal rank, and streams Gemini's answer; the model only sees `S1…Sn` keys and `CitationRewriter` turns valid ones into `[n]` and drops the rest. Every model call is an `ai_runs` row (counts and IDs only, never content). Replies without a heartbeat for 2 minutes are swept to `FAILED`/`STALLED`. `AI_ENABLED`, `GEMINI_API_KEY` and `EMBEDDING_MODEL` (must match the processor's) are required; `/demo` keeps the mock
- Documents that are queued or processing: the Knowledge page revalidates every 10 seconds through `useIndexingPoll` until none are; the demo keeps `refetchInterval`
- URL state for filters (`/knowledge?collection=…&view=templates&q=…`) and drawers (`/knowledge/:documentId`)
- Theme: `theme` cookie (`light` | `dark` | `system`), `data-theme` on `<html>`
- Public demo: `/demo/*` re-exports the real page routes inside `routes/demo.tsx` (sample owner, no auth, light theme). The website embeds it in its product demo; only the website may frame it (`frame-ancestors` in `entry.server.tsx`). `?play=ask|review|draft|compare` auto-types and sends that task's first example
- Never hard-code in-app paths: use `useAppBase().path('/knowledge')` so links work both in the app and under `/demo`

## Document processor (services/document-processor)

Go service (`net/http`, `pgx`, AWS S3 SDK for R2, Poppler CLIs, Gemini REST). Gemini calls go to `GEMINI_BASE_URL`: Google directly in development, Cloudflare AI Gateway (`dossier`, payload logging and caching off, `AI_GATEWAY_TOKEN`) in production. `POST /jobs` takes the indexing message, claims the job, extracts, chunks, embeds and activates the version; one job at a time, 12-minute deadline, heartbeat every 30 s, every write fenced on the job's `attempts`. It connects as the `indexing_processor` role through Supabase's session pooler and only uses that role's grants. Run with `make run` (needs `.env`, see `.env.example`); look at extraction with `make inspect FILE=…` (`CHUNKS=1` for chunks); `make check` is the verification (no automated tests). A processor killed mid-job leaves the job Processing: recover it with `make enqueue JOB=<id>` once 2 minutes have passed. Development shares the Supabase database with production, so once the Worker is deployed its 5-minute sweep also requeues a stalled development job and runs it in the production container. Ctrl-C waits up to 13 minutes for the running job; press it twice to quit at once. Scanned PDF pages (an image and no usable text layer) are rendered with `pdftoppm` and transcribed by `OCR_MODEL` (`gemini-3.1-flash-lite`), one page at a time, cached per page in R2 and counted against the organization's monthly `ocr_usage` quota (`OCR_MONTHLY_PAGE_LIMIT`) before sending; `make inspect FILE=… OCR=1` tries it without the database. In production it runs as a Cloudflare Container behind services/indexing-worker (queue consumer, DLQ, 5-minute sweep for stuck outbox rows and stalled jobs, daily R2 orphan sweep); setup is in docs/runbooks/indexing-launch.md.

## Database (apps/app)

Supabase Postgres, accessed only from server code (loaders, actions, `*.server.ts`) through Prisma 7.10. Supabase Auth owns users; `profiles.id` is `auth.users.id`.

**Files:** `prisma/schema.prisma` (schema), `prisma/migrations/` (history), `prisma7.config.ts` (CLI config: Prisma 7.10 names it this to avoid clashing with Prisma 8), `prisma/seed.ts` (dev data), `app/lib/db.server.ts` (the client: `db().document.findMany(...)`). The client is generated into `app/generated/prisma` (gitignored); `build` and `types:check` regenerate it.

**Commands (apps/app):**
```bash
yarn db:migrate --name <change>   # create + apply a migration (local DB only)
yarn db:generate                  # regenerate the client (migrate no longer does this in Prisma 7)
yarn db:seed                      # reset and load the Asante & Co. sample data (refuses NODE_ENV=production)
yarn db:deploy                    # apply pending migrations to Supabase
yarn db:studio
```

**Rules:**
- Every tenant table has `organization_id`; children reference parents with a composite `(organization_id, <parent>_id)` foreign key so cross-organization links are impossible. Keep this for new tables, and add `@@unique([organizationId, id])` to anything that will be referenced
- In nested Prisma creates, omit `organizationId` on children: Prisma takes it from the parent through the composite key
- IDs and `updated_at` are set by Postgres (`gen_random_uuid()`, `now()` plus the `set_updated_at` trigger) so services writing outside Prisma stay correct. New tables with `updated_at` need the trigger line
- Every new table needs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in its migration: without it Supabase's REST API exposes the table to the anon key. Membership-based RLS policies are still to be written
- Hand-written SQL (check constraints, partial indexes, triggers, data) goes in a `--create-only` migration. Prisma cannot declare HNSW indexes and drops any it finds, so the embedding index is deferred (see the `defer_embedding_index` migration)
- `migrate dev` runs only against the local database. Supabase gets `migrate deploy` from CI (see Deployment); runtime uses `DATABASE_URL` (transaction pooler, port 6543)
- Migrations run before the new code is deployed, so the running (old) code must keep working on the migrated schema: add columns and tables first, and remove or rename them in a later release once no deployed code uses them
- System roles (Owner, Admin, Member, Viewer) and the permission catalogue are migration data, not seed data
- The indexing Worker and Go processor connect as the `indexing_worker` and `indexing_processor` roles (created `NOLOGIN` by the `document_ingestion` migration; set `LOGIN` and passwords by hand in Supabase). They have column-level grants and `FOR ALL TO <role>` RLS policies on only the tables they use; give a new table a policy and grant before either service touches it
- Development runs against the remote infrastructure: the app's `DATABASE_URL` (in the git-ignored `.envrc`) is Supabase, and uploads use the real R2 bucket. Migrations are created and tried locally first: the git-ignored `apps/app/.env` sets only `DIRECT_URL` to a local Postgres.app database (`dossier_test`), which the Prisma CLI prefers, so `yarn db:migrate` never touches Supabase. Supabase gets migrations from CI (`migrate deploy`). The Supabase-only parts (auth.users link, profile-on-signup trigger) skip themselves on the local database
- Outside production, indexing requests go straight to a local processor (`INDEXING_DISPATCH` defaults to `direct`, posting to `PROCESSOR_URL`, `http://localhost:8080/jobs`); production publishes to Cloudflare Queues, consumed by `services/indexing-worker`
- `yarn db:seed` deletes all data first, so it refuses any non-local database (override with `ALLOW_REMOTE_SEED=true` only for a disposable one). `yarn db:reset` asks for confirmation
- A new Supabase project needs pgvector enabled in the `extensions` schema before the first deploy (`create extension if not exists vector with schema extensions;`, or Database > Extensions in the dashboard); otherwise the init migration installs it into `public`, which Supabase's security advisor flags
- Comparing schema.prisma directly against Supabase (`migrate diff --from-config-datasource`, `db pull`) fails with P4002 because `profiles` references `auth.users` across schemas. That is expected; CI's migrations check proves migrations match the schema, and `migrate status` shows what Supabase has applied

## Links Between the Website and the App

- Every link from one app to the other MUST carry UTM parameters. Build it with `useAppUrl()` (website, `~/lib/use-app-url`) or `useWebsiteUrl()` (app, `~/lib/use-website-url`), passing a `placement` that names the link (e.g. `header_sign_in`). Server code uses `crossAppUrl()` from `~/lib/utm` with `resolveUtm()` from `~/lib/utm.server`
- Both apps remember incoming campaign parameters in a 30-day `utm` cookie. Source, medium, campaign and term pass through; `utm_content` is always the clicked link; missing values default to `dossier_website` / `dossier_app` and `cross_app`
- Never leave personal data in a URL: the website hands the sign-up email over as `?email=`, and the app's `/signup` loader moves it into a one-time flash and redirects to a clean URL
- Hosts live in `APP_URL` (website constants) and `WEBSITE_URL` (app constants): currently https://dossier-africa.fly.dev and https://dossier.fly.dev

## Website Versioning

**Always bump the `version` field in `apps/website/package.json` whenever any changes are made to the website** (`apps/website/`). Use semantic versioning:
- Patch (`1.0.x`) — copy tweaks, image swaps, bug fixes
- Minor (`1.x.0`) — new sections, new pages, significant UI changes
- Major (`x.0.0`) — full redesigns or breaking changes

## Adding New Public Pages (Website)

When adding a new publicly accessible page to `apps/website`:

1. **Sitemap** — Register the route in `apps/website/app/routes/sitemap[.]xml.tsx`
   - Public marketing pages: `priority: '0.8'`, `changefreq: 'monthly'`
   - Legal/static pages: `priority: '0.3'`, `changefreq: 'yearly'`
   - Skip routes that require authentication or are not meant for search engines

2. **SEO meta** — The route file must export a `meta` function that calls `getSocialMetas()` from `~/lib/seo` with a page-specific `title` and `description`

3. **robots.txt** — No changes needed for public pages; `apps/website/public/robots.txt` already allows all paths except `/api/`

## Deployment

- **Platform:** Fly.io, one environment per app: `apps/website/fly.toml` (app `dossier`), `apps/app/fly.toml` (app `dossier-africa`)
- **CI/CD:** `.github/workflows/website.yml` checks and deploys the website on every push to `main`. `.github/workflows/app.yml` only checks the app (lint, types) and runs its database migrations; the app is deployed by hand (see Manual deploy). There is no staging environment or `prod` branch
- **App database migrations:** when a push to `main` changes `apps/app/prisma`, `app.yml` runs `prisma migrate deploy` against Supabase after the checks. Pull requests that change `apps/app/prisma` first apply all migrations to an empty pgvector Postgres, check they match `schema.prisma` and run the seed. A failed migration is not retried by later pushes that leave `prisma/` untouched: re-run it with "Run workflow" on the App workflow (manual runs always migrate). Because the app is deployed by hand, apply pending migrations (`yarn db:deploy`) before deploying code that needs them
- **Manual deploy:** the app is deployed from a local checkout with `make deploy` in `apps/app` (`fly deploy --remote-only`). The website can also be deployed this way or from the Actions tab
- **Indexing worker:** deployed by hand with `yarn deploy` in `services/indexing-worker` (builds the Go processor image; Docker must be running). Its secrets are set with `wrangler secret put` (see docs/runbooks/indexing-launch.md).
- **Secrets:** runtime env vars (`GOOGLE_TRANSLATE_API_KEY`, `GOOGLE_ANALYTICS_ID`, `SESSION_SECRET`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `INDEXING_QUEUE_ID`, `INDEXING_DISPATCH`, `UPLOADS_ENABLED`, `AI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `AI_GATEWAY_TOKEN`, and optionally `ASK_MODEL`, `INTENT_MODEL`, `EMBEDDING_MODEL`, `RETRIEVAL_MIN_SIMILARITY`) are set with `fly secrets set`, never committed. GitHub needs `FLY_API_TOKEN` (website deploys) and, for app migrations, `DIRECT_URL` (or `DATABASE_URL`): Supabase's session pooler string (port 5432 on the pooler host). Not the transaction pooler (port 6543), which cannot run migrations, and not the direct `db.<ref>.supabase.co` host, which is IPv6-only and unreachable from GitHub's runners. The migrate job fails if the secret is missing or points at port 6543

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
