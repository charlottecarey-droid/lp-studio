---
name: Lifecycle email CTA is baked into free-form body_html
description: Why authored lifecycle/trial emails always render a CTA block and the byte-identity invariant's exact boundary
---

Lifecycle notification emails (trial_day_7/11/13, etc.) are now authored as
free-form `body_html` rendered through the single `renderEmail` pipeline. The
default body comes from `buildDefaultBodyHtml(intro, ctaLabel)`, which ALWAYS
emits the CTA `<a href="{{ctaUrl}}">` table.

**Rule:** the legacy dispatcher's conditional "omit the CTA block when ctaUrl is
null" behavior is intentionally GONE. A free-form authorable body cannot carry
per-send conditional markup, so the CTA is always present and `{{ctaUrl}}` is
interpolated (empty string when absent).

**Why:** Phase 1 made the whole body operator-editable. Keeping a hidden
conditional in static HTML would defeat that and surprise authors.

**Byte-identity boundary:** the "trial emails MUST render byte-identical to the
pre-refactor frame" invariant holds **only when ctaUrl is non-null** — which is
the real production path: `trialLifecycle.ts` derives `workspaceUrl` from
`tenant.domain` or a `<slug>.<baseHost>` fallback, so as long as `baseHost`
(env) is configured, every trial send has a URL. The only divergence (an
empty-href button) requires `baseHost` unset AND tenant has no domain — a
misconfiguration, not a normal send. The regression test (`emailRender.test.ts`)
asserts identity across present-URL contexts only, by design.

**How to apply:** don't try to re-add conditional CTA logic to match legacy null
behavior; if a no-CTA lifecycle email is ever wanted, author a separate
`body_html` for it rather than reintroducing render-time conditionals.
