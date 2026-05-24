# Overview

This project is a pnpm workspace monorepo using TypeScript, designed to build a comprehensive A/B testing and visual drag-and-drop page builder platform called "Landing Page Studio." The platform aims to provide a robust solution for marketing and sales teams to create, test, and optimize landing pages with advanced features like AI-powered content generation, brand management, and multi-tenant capabilities. The core components include an Express API server, a React-based frontend for the studio, and shared libraries for database access, API specifications, and generated clients. The vision is to offer a powerful, integrated tool for conversion rate optimization and personalized customer experiences.

# User Preferences

I want iterative development. I prefer detailed explanations. Ask before making major changes.

# System Architecture

## Monorepo Structure and Technologies

The project utilizes a pnpm workspace monorepo with Node.js 24 and TypeScript 5.9.
- **API Framework**: Express 5 for the backend API server.
- **Database**: PostgreSQL with Drizzle ORM.
- **Validation**: Zod for schema validation, with `drizzle-zod` integration.
- **API Codegen**: Orval generates API clients and Zod schemas from an OpenAPI specification.
- **Build Tool**: esbuild for CJS bundling.
- **Frontend**: React with Vite for the Landing Page Studio UI.

## TypeScript & Composite Projects

All packages are TypeScript composite projects, extending `tsconfig.base.json`. Root `tsconfig.json` manages project references, enabling cross-package type checking via `tsc --build --emitDeclarationOnly`.

## Core Components

### API Server (`artifacts/api-server`)

- Express 5 server handling API requests.
- Routes are structured in `src/routes/` and use `@workspace/api-zod` for validation and `@workspace/db` for persistence.
- Handles authentication and authorization.

### Database Layer (`lib/db`)

- Drizzle ORM with PostgreSQL for all data persistence.
- Exports a Drizzle client instance and schema models.
- Migration management for development and production.

### API Specification and Codegen (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`)

- Manages the OpenAPI 3.1 specification (`openapi.yaml`).
- Orval generates:
    - React Query hooks and a fetch client (`lib/api-client-react`).
    - Zod schemas (`lib/api-zod`) for request/response validation.

### Landing Page Studio Frontend (`artifacts/lp-studio`)

A React + Vite application providing the user interface for the A/B testing platform and page builder.

- **Content Series Block**: Full-page content series landing page (podcast/webinar/video series) with:
  - Three hero layouts: full-bleed (immersive parallax bg), half-bleed (split text/image), text-only
  - Episode library with featured pinning, guest/host spotlight cards, about section, CTA section
  - Multi-step guest application form (FormStep/FormField pattern matching event-page RSVP form)
  - Theme system resolving from tenant brand config with per-block overrides (colors, fonts)
  - Full property panel (ContentSeriesPanel.tsx) with collapsible sections for all editable fields
  - Mobile responsive layout: CSS media queries stack grids, reduce padding, and reflow episode rows on screens ≤768px
  - Internal error boundary shows render errors visually instead of blank page
  - Excluded from ScrollReveal/Reveal wrappers (NO_REVEAL) since it has its own framer-motion animations
  - First use case: The Margin Line podcast
- **Dandy Product Hero Block** (`dandy-product-hero`): Email-capture hero with three layout variants:
  - `split` (default): solid bg with image bleeding off the right edge (original Crowns hero look)
  - `card`: light section bg with grey card behind copy + form on the left (matches the "Partner with Dandy. Get a Free Scanner." reference)
  - `gradient`: soft horizontal gradient between bg color and image side instead of a hard line
  - Two input styles (rounded pill / square corners), customizable button bg/hover/text colors, customizable left & right column widths (fr ratios), card bg + text color, and image-side bg color
- **Admin Dashboard**: Manages tests, variants, and results.
- **Pages Gallery**: CRUD operations for builder pages with template selection.
- **Builder Editor**: A three-panel drag-and-drop interface for designing landing pages with block library, live canvas, and property panels. Supports inline editing with Tiptap WYSIWYG.
- **Landing Page Viewer**: Serves A/B test variants or builder pages.
- **Review Shell**: Standalone read-only review page with approval workflow.
- **Block System**: 16+ predefined block types (e.g., Hero, Testimonial, Rich Text, Content Series) with customizable properties. The `content-series` block is a premium full-page block for recurring content series (podcasts, webinars, thought leadership) with hero/featured episode, episode library with sort/pin, guest/speaker cards, about section, and flexible CTAs. Default props are pre-filled for The Margin Line podcast.
- **Collaboration Features**: Comment mode, share for review, and presence indicators.
- **Templates**: Per-tenant templates plus an industry-scoped global template library managed by superadmin (Templates tab in `/superadmin`). `lp_pages` carries `is_global` (boolean) and `industry` (text, nullable — null means "universal"). `GET /lp/templates(/enriched)` and the page-clone endpoint union the caller tenant's templates with global templates whose industry matches (or is null). Admin endpoints: `GET /api/admin/lp/templates`, `PUT /api/admin/lp/templates/:id`. Three generic-SaaS starters (landing, lead-gen, pricing) are seeded idempotently at boot via `seeds/globalTemplates.ts` (marker `global_templates_v1`).
- **One-Pager Template Manager** (`/sales/one-pager-templates`): Admin console for managing one-pager templates with gallery card view, visibility toggles, clone/edit/delete, drag-and-drop field placement editor, field properties panel, and PDF generation. Stored in `sales_one_pager_templates` table with image upload via object storage.
- **Styling**: Uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop.
- **Marketing site (apex domain)**: lp-studio also serves the public marketing site for the `lpstudio.ai` apex (and `www.lpstudio.ai`). Source lives in `src/marketing/` (pages, components, hooks, marketing.css). `App.tsx` checks `isMarketingHost()` at the top of `App()` and, when true, renders a lazy-loaded `MarketingApp` (separate JS+CSS chunk) wrapped in `WouterRouter` + `Suspense` *before* `QueryClientProvider`/`AuthProvider` mount — so apex visitors never trigger SaaS auth bootstrap or domain-context fetches. SaaS subdomain (`app.lpstudio.ai`) and tenant subdomains (`*.lpstudio.ai`) bypass the marketing branch and continue to use the existing `domainContext` host routing. A `?preview=marketing` query override is gated to `import.meta.env.DEV` only so production SaaS hosts cannot be flipped into marketing mode. The standalone `artifacts/lpstudio-site` artifact is preserved as a dev-only preview workspace.

## Key Features

### AI Content Briefs

- **Content Brief Modal**: Allows users to generate AI content briefs based on company, objective, and brand context.
- **Brief API**: Integrates with OpenAI to produce structured briefs including buyer personas, headlines, value propositions, and tone guidance.
- **Brand-Aware Briefs**: Injects brand configuration into AI prompts for consistent messaging.
- **Apply to Page**: Brief context is applied to AI copy generation within the builder.

### Brand System

- **BrandConfig**: Defines comprehensive brand guidelines including color roles, typography, button styling, voice & messaging, product lines, and audience segments.
- **Brand Settings UI**: Provides an interface for configuring and managing brand settings, including AI-powered import functionality.
- **Block Typography Integration**: All blocks inherit brand typography defaults.
- **Brand-driven Fonts**: `BrandConfig.displayFont`/`bodyFont` (+ optional `displayFontUrl`/`bodyFontUrl`) flow into `--brand-font-display` / `--brand-font-body` CSS variables on `[data-lp-page]` wrappers. `BrandFontLoader` injects Google Fonts CSS for non-self-hosted families. Catalog lives in `lib/font-catalog.ts`; Brand Settings exposes a curated picker with custom-URL escape hatch.

### Multi-tenant Identity & Authorization

- **Schema**: Five tables (`tenants`, `app_users`, `app_sessions`, `tenant_roles`, `tenant_members`) manage organizations, users, sessions, roles, and memberships.
- **Permissions**: Granular permissions (e.g., `pages`, `tests`, `analytics`, `brand`) control access to features.

### Authentication (Google OAuth)

- **Backend Integration**: Handles Google OAuth flow, user upsertion, session creation, and logout.
- **Middleware**: `requireAuth` and `requirePermission` middleware enforce access control.
- **Admin Routes**: API endpoints for provisioning new tenants and managing members/roles.

### Domain-Aware Multi-Tenant Routing

- **Dynamic Routing**: The application serves multiple tenants based on custom domains.
- **Domain Context API**: `GET /api/auth/domain-context` determines the operating mode (`tenant-locked`, `microsite-only`, `open`) based on the hostname.
- **Frontend Logic**: `AuthGate` component adapts UI and access based on `domainContext`, handling sign-in, "Access Pending," or "Create workspace" flows.
- **Tenant Provisioning**: Supports programmatic provisioning of new tenants and future self-serve signup.

### Wildcard Tenant Subdomains via Cloudflare Worker

Replit's deployment edge only honours the `Host` header for hostnames explicitly registered as custom domains. To unlock self-serve `*.lpstudio.ai` subdomains without per-tenant Replit registration:

- **Cloudflare Worker** (`cloudflare/tenant-host-router`) sits in front of `*.lpstudio.ai`, forwards requests to the canonical Replit deployment URL (which Replit accepts), and passes the real visitor hostname in `X-Original-Host` along with a shared-secret `X-Worker-Secret` header.
- **Host resolver** (`artifacts/api-server/src/lib/requestHost.ts`) — `getRequestHost(req)` is the single source of truth for the request's effective tenant host. It honours `X-Original-Host` only when `X-Worker-Secret` matches the `WORKER_HOST_SECRET` env var, then falls through to `X-Forwarded-Host` and finally `Host`. This is wired into `auth.ts`, `requireAuth.ts`, and `lp/tracking.ts`.
- **Required secret**: `WORKER_HOST_SECRET` must be set on both the Replit deployment and the Cloudflare Worker (same value).
- **Passthrough hosts**: `lpstudio.ai`, `www.lpstudio.ai`, and `app.lpstudio.ai` bypass the worker (already registered as Replit custom domains).
- See `cloudflare/tenant-host-router/README.md` for deploy + DNS steps.

## LP-Studio prerender ops (task #364)

Published LP-Studio landing pages are rendered to static HTML and served
from Cloudflare R2 by the `tenant-host-router` worker
(`cloudflare/tenant-host-router/`). Visitor reads make ZERO api-server
calls — that's the whole point of the R2 cache.

### Required production env vars

| Env var | Required where | Why |
|---|---|---|
| `LP_STUDIO_RENDER_BASE_URL` | api-server (prod) | Base URL Playwright loads to snapshot a published page. **MUST be set** to the canonical SPA host, e.g. `https://render.lpstudio.ai`. If unset, `prerenderLpPage.resolveLpStudioBaseUrl()` falls through to `REPLIT_DEV_DOMAIN` (wrong DB context in a deploy) or `127.0.0.1:3000` (nothing listening), and every publish silently produces empty HTML. The api-server emits a loud Sentry error (`prerender_config_missing_render_base_url`) and `console.error` at boot if this is unset in production — do not ignore it. |
| `R2_*` (account id, bucket, access key, secret) | api-server (prod) | Per-host R2 writes from `triggerPublishedRender`. |
| `LP_STUDIO_PUBLIC_HOST` | api-server (optional) | Used only as a fallback host for tenants with no registered hosts. Normal tenants get their hosts from `getActiveHostsForTenant`. |

`render.lpstudio.ai` is a dedicated render-only subdomain (DNS record
under the existing `lpstudio.ai` Cloudflare zone, no Custom Hostname
needed). Using a dedicated subdomain — instead of reusing
`app.lpstudio.ai` — keeps Playwright prerender traffic greppable in
logs and independently rate-limitable.

### Onboarding a new custom domain (two-step)

Custom Hostnames on Cloudflare SaaS do **NOT** inherit zone-level Worker
routes — this is silent and was discovered the hard way during phase 2.
Adding a new tenant domain requires BOTH:

1. Cloudflare SaaS Custom Hostname for `<domain>` (TLS + edge routing).
2. Explicit Worker Route `<domain>/*` on the `lpstudio.ai` zone bound to
   the `tenant-host-router` worker. Codified in
   `cloudflare/tenant-host-router/wrangler.toml`; redeploy after adding.

Skip step 2 and visitors silently passthrough to the origin (api-server
SSR fallback) with no `x-lp-source: r2` header. Verify with:

```
curl -sI --resolve <domain>:443:<cf-ip> "https://<domain>/<slug>" | grep -i x-lp-source
```

### Backfill / repair

`artifacts/api-server/scripts/backfill-published-html.ts` re-renders
published pages and writes them to R2. Use after onboarding a new
tenant, after a render outage, or to verify the pipeline end-to-end.

```
cd artifacts/api-server && env DATABASE_URL=$NEON_DATABASE_URL \
  LP_STUDIO_RENDER_BASE_URL=https://render.lpstudio.ai \
  pnpm --filter @workspace/api-server exec tsx \
  scripts/backfill-published-html.ts --tenant=<id> --only-missing
```

~10s/page. Splits cleanly per-tenant if Playwright cold-start makes a
single run exceed your shell timeout.

### Sentry alerting surface

Every fire-and-forget failure path in `triggerPublishedRender` /
`triggerPublishedDelete` emits a structured Sentry message. Benign
races (page deleted mid-render, concurrent edit superseded the render,
publish→draft toggle during render) are intentionally silent — they're
correct behavior, not failures. Everything else alerts:

| Sentry message | Level | When |
|---|---|---|
| `prerender_config_missing_render_base_url` | error | api-server boot, prod, env unset |
| `prerender_uncaught` | error | Unhandled throw escapes `renderAndStore` |
| `prerender_no_hosts_to_write` | error | Tenant has no domains/microsite/wildcards (broken config) |
| `prerender_render_failed` | error | Playwright threw — the May 2026 regression shape |
| `prerender_r2_write_failed` | error | R2 PUT failed; OS not written; visitor cache stale |
| `prerender_os_write_failed_benign` | warning | OS write failed AFTER R2 succeeded; debug endpoint lags, visitors fine |
| `prerender_delete_uncaught` | error | Unhandled throw in delete path |
| `prerender_r2_delete_failed` | error | R2 DELETE failed; OS not deleted; visitors still see page |
| `prerender_os_delete_failed_benign` | warning | OS delete failed AFTER R2 succeeded |

# External Dependencies

- **pnpm**: Monorepo package manager.
- **Node.js**: Runtime environment (v24).
- **TypeScript**: Programming language (v5.9).
- **Express**: Web application framework (v5).
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Zod**: Schema declaration and validation library.
- **Orval**: OpenAPI code generator.
- **esbuild**: JavaScript bundler.
- **React**: Frontend JavaScript library.
- **Vite**: Frontend build tool.
- **@dnd-kit/core**, **@dnd-kit/sortable**: Drag-and-drop functionality.
- **@tiptap/react**, **@tiptap/starter-kit**: WYSIWYG editor for rich text.
- **OpenAI API**: For AI content brief generation and brand import (via Replit AI Integrations).
- **Google OAuth**: For user authentication.
- **`pg`**: PostgreSQL client library.
- **`jspdf`**: PDF generation library.
- **`qrcode`**: QR code generation library.

# Shared Libraries

## `@workspace/one-pager-types` (`lib/one-pager-types`)

Shared library used by both LP Studio and Dandy DSO for one-pager PDF generation. Exports:
- **`src/index.ts`**: Core types (`OverlayField`, `CustomTemplate`, `TEMPLATE_VISIBILITY_KEY`)
- **`src/pdf.ts`**: `generateCustomTemplatePdf` — renders custom template fields onto a jsPDF document
- **`src/generators.ts`**: Canonical PDF generators for all 4 built-in templates:
  - `generatePilotOnePager` — 90-day pilot one-pager (audience-specific, with team contacts, prospect logo)
  - `generateComparisonOnePager` — Dandy then/now comparison table with stats
  - `generateNewPartnerOnePager` — Partner announcement with 2×2 feature cards, stats, QR code
  - `generateROIOnePager` — 2-page ROI document with case studies, ROI breakdown, Dandy difference table
  - All accept pre-loaded image data (`logoPng`, `headerImgData`) and layout overrides via `opts`

DSO imports shared generators and wraps them with asset pre-loading (SVG→PNG conversion, image loading) and layout override fetching from `loadLayoutDefault`.
## Marketo → Chili Piper handoff

Per-tenant `lp_forms.chili_piper_config` jsonb column drives an opt-in handoff from a Marketo "global form" submission to a Chili Piper concierge router. The scheduler URL is **only** ever read from this row — never hardcoded in app code.

### Configure a tenant
Run the seed script against the target Postgres (Neon for prod):

```bash
NEON_DATABASE_URL=... node scripts/seed-smb-chilipiper.cjs \
  --tenant=<tenant-slug> \
  --form="<form name>" \
  --cp-url="https://<tenant>.chilipiper.com/concierge-router/link/<router>" \
  --mode=modal
```

The script uses `--name=value` style — space-separated values won't parse.

The script is idempotent — re-running it just overwrites the row's `chili_piper_config`.
