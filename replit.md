# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/lp-studio` (`@workspace/lp-studio`)

Landing Page Studio — A/B testing platform + visual drag-and-drop page builder. Built with React + Vite.

- **Admin dashboard** at `/lp-studio/` — manage tests, configure variants, view results with statistical significance
- **Pages gallery** at `/lp-studio/pages` — list, create, edit, delete builder pages; "New Page" modal with template picker
- **Builder editor** at `/lp-studio/builder/:pageId` — three-panel DnD builder (block library, live canvas, property panel)
- **Landing page viewer** at `/lp-studio/lp/:slug` — serves A/B test variants OR builder pages (pageType: "builder")
- **Review shell** at `/lp-studio/review/:pageId?token=xxx` — standalone read-only review page with approve/request changes workflow (no auth required)
- **API routes** under `/api/lp/` — tests CRUD, variants CRUD, event tracking, page config, stats, AND pages CRUD
- **Collaboration API routes**: `/api/lp/pages/:pageId/comments`, `/api/lp/pages/:pageId/reviews`, `/api/lp/review/:token`, `/api/lp/pages/:pageId/presence`
- **DB schema**: `lp_tests`, `lp_variants`, `lp_sessions`, `lp_events`, `lp_pages`, `lp_page_comments`, `lp_page_reviews`, `lp_page_presence` tables
- **Stats engine**: Z-test for significance, p-value calculation, relative uplift vs control
- **Block system**: 16 block types (hero, trust-bar, pas-section, comparison, stat-callout, benefits-grid, testimonial, how-it-works, product-grid, photo-strip, bottom-cta, video-section, case-studies, resources, rich-text, custom-html) with property panels
- **Inline editing**: Click to select a block, then use the pencil icon or double-click to edit text inline on the canvas for hero, pas-section, stat-callout, testimonial, bottom-cta, comparison, how-it-works, benefits-grid blocks. Rich Text blocks render a Tiptap WYSIWYG editor inline when selected.
- **Tiptap WYSIWYG**: `@tiptap/react` installed with StarterKit, Link, Underline, TextAlign, Placeholder extensions. Used in the Rich Text block canvas inline editor and property panel.
- **Builder ↔ A/B Test connection**: Variants can link to a builder page via `builderPageId` (nullable FK column on `lp_variants` → `lp_pages`). The tracking route fetches the linked page and returns `linkedPage` in the variant. The landing page viewer detects `linkedPage` and renders builder blocks instead of the legacy config.
- **DnD**: `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop block reordering
- **Templates**: 5 pre-built templates (video-hero, clean-conversion, social-proof-heavy, comparison-focused, minimal-cta)
- **Collaboration features**: Comment Mode toggle with per-variant comment threads, Share for Review links with approval workflow, presence strip showing other active viewers
- The Dandy video (`/dandy-lab-video-2/`) is embedded as an iframe hero component in landing pages
- Uses generated React Query hooks from `@workspace/api-client-react`
- New collaboration hooks in `src/hooks/use-collaboration.ts` use direct `/api/...` fetch calls (not the generated client)

#### Block System Files
- `src/lib/block-types.ts` — `BLOCK_REGISTRY` with all block type definitions + default props
- `src/lib/templates.ts` — `LP_TEMPLATES` with 5 pre-built page templates
- `src/blocks/BlockRenderer.tsx` — dispatches rendering to individual block components
- `src/blocks/*.tsx` — individual block components (Hero, TrustBar, PasSection, etc.)
- `src/pages/builder/BuilderEditor.tsx` — full-screen three-panel builder UI
- `src/pages/builder/property-panels/` — per-block property editor panels
- `src/pages/pages-gallery.tsx` — pages list + create modal

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
