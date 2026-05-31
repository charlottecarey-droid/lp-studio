---
name: Storage serve route CORP for sandboxed previews
description: Why the storage file-serve route must send Cross-Origin-Resource-Policy, or tenant logos vanish in sandboxed email-preview iframes.
---

# Storage serve route needs `Cross-Origin-Resource-Policy: cross-origin`

The email-shell editor renders its live preview inside a **sandboxed** iframe
(srcdoc / `sandbox` attr), which makes the iframe a *different (opaque) origin*
from the app. Any `<img>` the preview HTML points at — notably a tenant's logo
served from the API storage route — is then a cross-origin subresource. Browsers
block it under Cross-Origin-Resource-Policy unless the response explicitly opts in.

**Fix:** the storage file-serve route sets `Cross-Origin-Resource-Policy: cross-origin`
on served assets. Without it the logo silently fails to load (broken img) **only**
in the sandboxed preview — direct page loads and real email clients are unaffected,
so it looks like a logo-data bug when it is actually a header bug.

**How to apply:** when something renders user assets inside a sandboxed/opaque-origin
iframe (preview panes, srcdoc), confirm the asset's serve route emits CORP
`cross-origin` (and CORS if fetched, not just `<img>`-loaded). Test in the actual
sandboxed preview, not a normal page load — the normal load will mask the problem.
