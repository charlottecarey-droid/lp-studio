---
name: R2 bucket layout (lp-studio)
description: One R2 bucket holds two distinct things; underscore-prefix is reserved for system folders.
---

The `dandy-lp-prerendered` R2 bucket holds:

1. **Prerendered LP HTML**, keyed `<encodedHost>/<encodedSlug>.html`.
   Written by `artifacts/api-server/src/lib/triggerPublishedRender.ts`.
2. **Immutable studio assets**, keyed `_studio-assets/assets/<basename>`.
   Written by `artifacts/lp-studio/scripts/upload-assets-to-r2.mjs` on
   every lp-studio build.

**Convention:** any underscore-prefixed top-level "folder" is a
system-managed namespace. Tenant hosts can't collide with one because
encoded hostnames don't legally begin with `_`. The GC job
(`artifacts/api-server/src/lib/assetsGc.ts`) relies on this to tell
HTML objects from asset objects.

**How to apply:** if you add a new bucket-resident object class,
prefix it with `_` and update the GC's HTML-detection filter
(`!key.startsWith("_") && key.endsWith(".html")`) so the new class
isn't accidentally swept.
