---
name: Dandy microsite CF edge cutover (DNS)
description: How partners/lp.meetdandy.com are cut from direct-to-Replit/GCP onto the Cloudflare edge worker, and why the per-host replit-verify TXT must go.
---

# Dandy microsite → Cloudflare edge cutover

Both Dandy microsite hostnames (`partners.meetdandy.com`, `lp.meetdandy.com`)
are cut over to the Cloudflare edge by making them a **`CNAME → lpstudio.ai`**
in the `meetdandy.com` zone (Google Cloud DNS). They are NOT pointed at
Cloudflare anycast IPs via A records — the CNAME to the proxied apex is the
proven-good template.

Pre-cutover each host is a direct Replit custom domain:
`A 34.111.179.208` (GCP/Google Frontend) + its own `replit-verify=<token>` TXT.

The cutover record change:
- REMOVE `A 34.111.179.208`
- REMOVE the per-host `replit-verify=<token>` TXT
- ADD `CNAME lpstudio.ai.`

**Why the replit-verify TXT must be removed:** a CNAME cannot coexist with any
other record at the same name (DNS rule), so the A and TXT have to go to add the
CNAME. This is not optional.

**Why that's safe:** the same `replit-verify` token still lives on the
`lpstudio.ai` apex (shared across the whole deployment). Post-cutover traffic is
`Dandy DNS → CNAME lpstudio.ai → Cloudflare (proxied) → tenant-host-router
worker (matches <host>/* route) → forwards to canonical *.replit.app origin with
X-Original-Host`. The worker handles Host translation, so the microsite host no
longer needs to be an independently-verified Replit custom domain — same model
as `*.lpstudio.ai` tenants.

**No orange-cloud toggle** on the Google Cloud DNS record — it's a plain CNAME.
Proxying happens because `lpstudio.ai` (in Cloudflare's own zone) is itself
orange-clouded.

## Verifying without/around a flip
- DNS egress on port 53 is blocked in the agent sandbox; `dig` returns empty.
  Query over DNS-over-HTTPS instead: `curl https://dns.google/resolve?name=<h>&type=<A|CNAME|TXT>`.
- CF-side readiness BEFORE flipping DNS: `curl --resolve <host>:443:104.21.53.47
  https://<host>/` — if the Custom Hostname + cert + worker route are ready it
  returns `200` with `server: cloudflare`, `cf-ray`, `x-lp-source: r2-tenant-shell`.
- Post-cutover pass criteria: `server: cloudflare` + `cf-ray` + `x-lp-source: r2…`
  (pre-cutover direct path shows `server: Google Frontend` / `via: 1.1 google`).

## Rollback
Delete the CNAME, re-add `A 34.111.179.208` (and the `replit-verify` TXT if you
want the direct Replit custom-domain registration to re-verify). TTL 300s →
propagates < 5 min. partners and lp roll back independently.

**Where the runbook lives:** `docs/phase3-prerequisites.md` (prereq gate +
rollback snapshots). Exact Google Cloud DNS click flow is in the project task
referenced there, not in the repo.
