---
name: Marketing-config URL → href allowlist
description: Superadmin-editable URLs rendered into public <a href> need an http(s) allowlist server-side + a render guard, not just client trust.
---

Any superadmin-editable config value that ends up in an `<a href>` (or `src`) on a
PUBLIC marketing surface is a stored-XSS sink, even though only superadmins can
edit it. A `javascript:`/`data:` URL would execute for every public visitor.

**Rule:** validate the URL with an http(s)-only allowlist in the PUT handler (400
on violation; empty string is allowed = won't render) AND add a defensive render
guard in the component (suppress the element + clear any layout CSS var when the
URL isn't http(s)). Never rely on the client check alone.

**Why:** the announcement-banner feature (mirrors the marketing_homepage_og config
pattern) initially piped a raw superadmin string straight into `<a href>`; code
review flagged it as a public stored-XSS gap.

**How to apply:** when adding any new marketing-config field (homepage_og,
announcement_banner, etc.) whose value becomes a URL attribute on a public page,
add both guards. Parse via `new URL(...)` and accept only `http:`/`https:`.
