---
name: Fetch redirect SSRF
description: When fetching URLs sourced from scraped/user-supplied content, manual redirect handling is required; "follow" defeats public-host validation.
---

# Rule

Any backend fetch whose target URL came from untrusted input (scraped pages,
imported brand assets, webhook bodies, user-pasted links) must:

1. Validate the hostname resolves to a public IP **before** issuing the request
   (resolve via `dns.lookup({all:true})`, reject any private/reserved/multicast
   range, IPv4 and IPv6 — including `::ffff:` IPv4-mapped).
2. Set `redirect: "manual"` and follow redirects yourself, re-validating
   every hop's hostname. `redirect: "follow"` (the WHATWG fetch default)
   blindly chases `Location` headers, which lets a hostile public site
   bounce you to `169.254.169.254`, `127.0.0.1`, or RFC1918 space and
   defeats the initial check.
3. Cap hop count (≤3) and per-hop timeout.

**Why:** Without per-hop validation, an attacker controlling any imported
site can exfiltrate cloud metadata / internal service responses by
serving a 302 to an internal IP. The asset is then stored as a tenant
media row (typed `image/*`), giving the attacker a stable read primitive.

**How to apply:** Reach for this any time you see `fetch(externalUrl)` in
a backend route or job runner where `externalUrl` isn't a constant or
configured allow-listed origin. The pattern is duplicated (intentionally)
in `brand-import-from-url-stream.ts` and `brand-import/assets-uploader.ts`
— if a third call site appears, factor into a shared util.
