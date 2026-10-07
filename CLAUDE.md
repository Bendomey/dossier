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
- Auth: `routes/_auth.tsx` runs `authMiddleware` (React Router v8 middleware) for every signed-in page; it redirects to `/login?return_to=…`. The session is a signed cookie (`SESSION_SECRET`)
- No backend yet: `app/api/*` call `~/lib/mock/db`. When the API lands, replace each fetcher body with a `fetchClient`/`fetchServer` call; hooks and components stay as they are
- Chat replies stream through `useReplyStream`, which writes `ChatStreamEvent`s into the query cache. The real endpoint should emit the same events (server-sent events)
- Documents that are processing are polled with `refetchInterval` until ready
- URL state for filters (`/knowledge?collection=…&view=templates&q=…`) and drawers (`/knowledge/:documentId`)
- Theme: `theme` cookie (`light` | `dark` | `system`), `data-theme` on `<html>`

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
- **CI/CD:** `.github/workflows/website.yml` and `.github/workflows/app.yml`. Pull requests run lint and type checks; every push to `main` runs the checks and, only if they pass, deploys. There is no staging environment or `prod` branch
- **Manual deploy:** `make deploy` from the app's folder (or run the workflow manually from the Actions tab)
- **Secrets:** runtime env vars (`GOOGLE_TRANSLATE_API_KEY`, `GOOGLE_ANALYTICS_ID`, `API_ADDRESS`) are set with `fly secrets set`, never committed. CI needs a `FLY_API_TOKEN` repository secret

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
