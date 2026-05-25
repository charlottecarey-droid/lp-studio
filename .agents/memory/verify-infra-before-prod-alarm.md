---
name: Verify infra before declaring a prod regression
description: When an external URL returns unexpected content, confirm which infrastructure is actually in the request path before escalating to the user as a production outage.
---

**Rule:** Before telling the user "production is broken" based on what an external URL returns, verify which system is actually serving that URL right now. Hostnames during a phased cutover, staging fallbacks, and stale DNS can all make a healthy system look broken from the outside.

**Why:** Misfired during the partners.meetdandy.com investigation. Curled `/bc3`, `/onepager-bdg`, `/max-car-wash`, and a deliberately-fake path — all returned the LP Studio marketing homepage. Concluded the new CF Worker → R2 pipeline was misrouting and escalated to the user. Actually: Dandy's DNS hadn't been cut over to the new edge yet (there is an explicit gating task tracking the 6 DNS records Dandy must add). The hostname was still on the pre-cutover path, and what I was seeing had nothing to do with the new pipeline. A 30-second "is the DNS even flipped?" check would have caught it.

**How to apply:**
- Before alarming on an external-URL observation, ask: which origin / edge / worker is *actually* in the request path for this hostname right now? Resolve the DNS, check headers (`cf-ray`, `server`, custom source headers), and cross-reference any active cutover tasks.
- During a phased cutover, treat "every URL returns the same fallback" as a DNS / cutover-state signal first, infrastructure-bug signal second.
- If a recent task in `.local/tasks/` is gated on customer DNS or any third-party action, that task is part of the diagnostic — read it before concluding the deployed pipeline is at fault.
