---
name: Two distinct "featured templates" concepts
description: Naming-collision trap — superadmin marketing-homepage featured list vs per-tenant card-star featured templates are unrelated.
---

There are TWO unrelated "featured templates" systems. Searching "featured" hits both — don't conflate them.

1. **Superadmin marketing-homepage list** — schema `lib/db/src/schema/featuredTemplates.ts`. A superadmin-curated list of templates shown on the public marketing homepage. Global/platform-wide.

2. **Per-tenant card-star featured templates** — schema `lib/db/src/schema/lpTenantFeaturedTemplates.ts` (table `lp_tenant_featured_templates`). Each tenant stars templates via the star toggle on Template Marketplace cards; starred ones lead the marketplace under "Featured" and appear first in the create-page modal. Endpoint: `PUT /lp/templates/:id/featured` + `featured` boolean on `GET /lp/templates/enriched` (artifacts/api-server/src/routes/lp/templates.ts). Visibility-gated to own-or-global templates (404 otherwise) to block cross-tenant IDOR.

**Why:** the near-identical names invite editing the wrong table/route. The marketing one is platform-wide superadmin; the tenant one is per-tenant self-serve curation.
