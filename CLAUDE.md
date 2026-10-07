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
└── website/             Public marketing website (port 3000)
```

## Common Commands

### Root Level
```bash
make run          # Run the website and open the browser
make run-website  # Website only
```

### Website (apps/website)
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

- **Platform:** Fly.io, one environment (`apps/website/fly.toml`, app `dossier`)
- **CI/CD:** `.github/workflows/website.yml`. Pull requests run lint and type checks; every push to `main` runs the checks and, only if they pass, deploys. There is no staging environment or `prod` branch
- **Manual deploy:** `make deploy` from `apps/website` (or run the workflow manually from the Actions tab)
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
