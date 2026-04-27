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

- **Admin Dashboard**: Manages tests, variants, and results.
- **Pages Gallery**: CRUD operations for builder pages with template selection.
- **Builder Editor**: A three-panel drag-and-drop interface for designing landing pages with block library, live canvas, and property panels. Supports inline editing with Tiptap WYSIWYG.
- **Landing Page Viewer**: Serves A/B test variants or builder pages.
- **Review Shell**: Standalone read-only review page with approval workflow.
- **Block System**: 16 predefined block types (e.g., Hero, Testimonial, Rich Text) with customizable properties.
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
