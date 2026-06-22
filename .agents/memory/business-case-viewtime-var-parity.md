---
name: Business-case microsite var parity (generation vs view-time)
description: Why {{company_name}}/{{practice_count}} render literally on /p/:token pages and how to keep both fill paths in sync
---

Business-case sales-microsite template pages carry the tokens `{{company_name}}`
and `{{practice_count}}`. There are TWO independent moments those tokens get
filled, and they must agree:

1. **Generation-time bake** (`generate-microsite.ts`): substitutes the tokens
   into the saved page props when the single-block business-case page is created.
2. **View-time resolve** (`/api/sales/resolve/:token` in `hotlinks.ts` → client
   `personalized-link-resolver.tsx` → `deepApplyVars` in `landing-page-viewer.tsx`):
   fills tokens live per-contact when a hotlink is opened.

**Bug class:** a page can keep LITERAL tokens (not baked at generation), so the
view-time path is the only thing that fills them. If the resolver emits a
DIFFERENT token vocabulary than the page uses (it historically emitted only
`{{company}}`/`{{first_name}}`/`{{last_name}}`), the business-case tokens render
as raw `{{company_name}}` text on the live page.

**Rule:** both paths must derive these values through the shared helper
`api-server/src/lib/businessCaseVars.ts` (`deriveCompanyName`,
`derivePracticeCount`) so a literal-token page and a baked page show identical
values. practiceCount source order = briefing `sizeAndLocations.locationCount`
→ account `numLocations` → `"multiple"`. companyName = `displayName ?? name`,
trimmed.

**How to apply:** when you add a new business-case template token, add it to the
shared helper AND to the resolve route's JSON AND to the client resolver's var
map AND to `substituteAccountVars`'s replace list — missing any one re-introduces
the literal-token bug on either the baked or the live path.

**Closed-set trap (the bigger gotcha):** the supported personalization vocabulary
is a CLOSED set (`{{company_name}}` + `{{practice_count}}`). There is NO
unknown-token stripper on either path — any other `{{…}}` you put in a new
template/block's DEFAULT props (e.g. `{{industry}}`, `{{company_size}}`,
`{{first_name}}`) ships verbatim and renders as literal text on /p/:token pages.
So a new full-page sales template (e.g. `account-microsite`) must either (a) use
ONLY the two supported tokens in its seed + block defaults, or (b) extend ALL four
fill points above first. Default to (a); deeper per-field personalization is its
own task. Also narrow any property-panel helper copy from generic "supports
{{tokens}}" to the actual supported token, or operators type leaking tokens.
