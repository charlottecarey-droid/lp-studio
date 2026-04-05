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
- **Templates**: 5 pre-built page templates.
- **One-Pager Template Manager** (`/sales/one-pager-templates`): Admin console for managing one-pager templates with gallery card view, visibility toggles, clone/edit/delete, drag-and-drop field placement editor, field properties panel, and PDF generation. Stored in `sales_one_pager_templates` table with image upload via object storage.
- **Styling**: Uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop.

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