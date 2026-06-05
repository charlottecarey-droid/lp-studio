---
name: dso-success-stories approved-only
description: The dso-success-stories block (builder + both AI generators) must only ever use the tenant's AI-approved Content Library case studies — never hardcoded/invented stories.
---

# dso-success-stories must use approved Content Library case studies only

The `dso-success-stories` block's customer stories must come exclusively from the
tenant's **AI-approved** Content Library case studies (`case_study` type, where
`approved_for_ai !== false`). It must never surface hardcoded/illustrative or
AI-invented companies, stats, quotes, or authors.

**Why:** The block registry default ships illustrative placeholder stories
(APEX/Smile Brands/Tend). Loading those onto a real tenant page — or letting the
AI invent stories — puts fabricated customer outcomes in front of prospects.

**How to apply:**
- Builder "Load defaults" (PropertyPanel, DSO Success Stories panel): fetch
  `/api/lp/library/case_study`, keep `approved_for_ai !== false`, map to cases
  (`name`=title, blank stat/quote/author, `label`=categories, `image` from
  content). Fall back to the registry default **only when the library is
  genuinely empty or the request fails** — a non-empty library with zero approved
  items loads an empty set, NOT the hardcoded default.
- AI generators: enforcement is shared and **always-on** (decoupled from strict
  mode). `generate-page.ts` exports `fetchApprovedCaseStudies` /
  `enforceApprovedCaseStudies` / `enforceDsoSuccessStoriesApproved`. Both
  generate-page paths and `generate-microsite.ts` must (1) inject an APPROVED
  CASE STUDIES section into the prompt, and (2) call
  `enforceDsoSuccessStoriesApproved(blocks, tenantId)` after sanitize/normalize
  (no-op when the block is absent; placeholder cases when the pool is empty).
- The registry default itself is intentionally kept illustrative (not tenant
  names) — enforcement happens at the callsites, not by editing the default.
