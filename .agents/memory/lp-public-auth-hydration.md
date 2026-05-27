---
name: LP_PUBLIC routes need optionalAuth to see req.authUser
description: Auth-conditional logic inside an LP_PUBLIC route is a silent no-op unless optionalAuth runs first.
---

Routes listed in `LP_PUBLIC` (see `artifacts/api-server/src/routes/index.ts`) bypass `requireAuth`. Express never populates `req.authUser` for them. Any handler that branches on `req.authUser?.userId`, `req.authUser?.tenantId`, etc. will see `undefined` for every caller — including logged-in ones — so the "authenticated" branch silently never runs.

**Why:** caught during a security fix where `/lp/brand?slug=` was gated on `req.authUser` and it accidentally locked out legitimate `/preview/:slug` viewers (who do have a session cookie). The route is public-allowlisted because anonymous landing-page visitors need to fetch brand colors, but the slug-fallback path needs to know if the caller is authed.

**How to apply:** when adding auth-conditional logic to an LP_PUBLIC route, attach `optionalAuth` from `middleware/requireAuth.ts` to that specific route (`router.get(path, optionalAuth, handler)`). It hydrates `req.authUser` when a valid session cookie is present and is a no-op otherwise, so anonymous flows keep working. Do NOT promote the route out of LP_PUBLIC — that breaks the anonymous case.
