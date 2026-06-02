---
name: EmailWYSIWYGEditor mergeVars contract
description: Why merge-var chips in the WYSIWYG editor must use bare names, and where the empty-{{}} bug comes from
---

The `EmailWYSIWYGEditor`'s `mergeVars` prop and `insertMergeVar(variable)` expect a
**bare** variable name (e.g. `first_name`). The editor itself renders the `{{…}}`
wrapper (its merge-variable node serializes to `{{${variable}}}`).

**Why:** passing a `{{first_name}}`-wrapped token yields `{{{{first_name}}}}`;
passing an empty/undefined value yields the empty `{{}}` brackets users have
reported. The classic cause is a caller mapping `{ label, variable: token }` where
`token` is already `{{…}}`-wrapped, or the field is missing entirely.

**How to apply:** when wiring the editor, pass `{ label, variable: "first_name" }`
(bare). Plain-text surfaces (a `<textarea>` insert) are the opposite — they insert
the literal `{{first_name}}` string, so keep a separate wrapped-token list for those.
On send, `toEmailHTML` (used by getHTML/onChange) converts the merge spans back to
clean `{{token}}` text, so backend `replaceVars` substitution works; `fromEmailHTML`
re-wraps `{{\w+}}` only in text nodes, never inside tag attributes (so an
`<a href="{{microsite_url}}">` stays a raw token and resolves to the tracking link).

Banner/campaign tools: the editor's `showCampaignTools` adds a Dandy-banner button
that falls back to the hardcoded Dandy banner URL. For multi-tenant sales surfaces,
prefer `showCampaignTools={false}` (as `EmailTemplateEditor` does) to avoid leaking
Dandy branding to other tenants; seed any microsite `<a href="{{microsite_url}}">`
into the default body instead.
