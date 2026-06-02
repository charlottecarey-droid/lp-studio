---
name: Quick Campaign page attach contract
description: How LP Studio attaches a landing page to a quick campaign and generates per-contact tracking links
---

The LP Studio "Personalized Pages / Quick Campaigns" tab uses ONE flow: the QuickCampaignWizard. Both header "New Campaign" and each row's "Launch" open it (Launch passes `initialPage` so the page is seeded + locked).

**The single source of truth for personalized-link sends is `campaign.metadata.pageId`.** The wizard writes it in `ensureDraft` (on both POST `/sales/campaigns` and PATCH). The backend `/campaigns/:id/send` and `/campaigns/:id/preview` read `metadata.pageId`, call `ensureHotlinkForContact` per recipient, and resolve `{{microsite_url}}` = `{host}/p/{token}` — that token IS the per-contact tracking link.

**Why:** there used to be a duplicate `LaunchModal` → `/campaign-pages/launch` path that "sent but unreliably" and couldn't pick a page from the wizard. It was removed. Do NOT reintroduce a second send path or route this UI back through `/campaign-pages/launch`.

**How to apply:** any new "attach a page to an email blast" feature must set `metadata.pageId` and rely on the existing send/preview hotlink logic, not a new endpoint. Page picker lists only `status === "published"` pages (recipients can't visit a draft). The wizard still allows "No page — send email only" for the generic New Campaign case; per-row Launch always has a page.
