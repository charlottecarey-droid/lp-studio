---
name: Merge-field single source (sales/landing)
description: Where sales/landing merge-field ({{token}}) definitions live and which surfaces may offer landing-page vars.
---

# Sales/landing merge-field catalog = single source

Sales contact + landing-page merge fields are defined ONCE in
`lib/notification-variables/src/index.ts`:
- `SALES_CONTACT_VARIABLES` — snake_case `first_name,last_name,company,microsite_url,sender_name` (group "Contact").
- `LANDING_PAGE_VARIABLES` — `company_name,practice_count` (group "Landing page").
- `SALES_VARIABLES` = both combined. `CAMPAIGN_VARIABLES` is a deprecated alias of SALES_CONTACT.

The shared inserter `CampaignVarInserter` and `EmailWYSIWYGEditor.MERGE_VARS`
SOURCE from this catalog (don't re-hardcode). It's a composite TS project, so after
editing run `tsc -b lib/notification-variables --force` for consumer typechecks.

**Why:** three lists had drifted (a dead camelCase catalog + two snake_case UI lists),
and the send path (api-server campaigns.ts) substitutes the snake_case tokens
literally (with case/space normalization). Snake_case is canonical.

**How to apply:**
- Token names MUST be the snake_case forms the send path fills in — never invent
  a token the substitution map won't resolve, or it ships literally.
- Landing-page vars (`company_name`/`practice_count`) resolve on the PAGE at hotlink
  view time (businessCaseVars.ts), NOT inside an email body. So they belong only in
  PAGE editors (builder property panels via the default inserter). Email-body editors
  must offer contact vars only. Today this holds because the only email-context
  inserter (superadmin `EmailTemplateEditor`) passes its own `variables=`, and the
  sales composer's `EmailWYSIWYGEditor` buttons use `SALES_CONTACT_VARIABLES` only.
