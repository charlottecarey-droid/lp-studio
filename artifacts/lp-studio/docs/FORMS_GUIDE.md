# LP Studio Forms — Configuration Guide

A practical walkthrough for marketers and ops on how to add forms to a landing page, wire them up to Marketo / Chili Piper / GTM, and find the leads afterwards.

---

## 1. Picking the right form block

The page builder ships seven blocks that can capture a lead. Pick based on where on the page the form lives and how the visitor gets to it.

| Block | Best for | Typical placement |
|---|---|---|
| **BlockForm** | Standard, fully-configurable form. Multi-step, custom fields, Marketo, Chili Piper — everything is on by default. **This is the one to use unless you have a specific reason.** | Anywhere on the page — section, sidebar, bottom CTA |
| **BlockDandyHeroV7S3** | Hero with a single email field and submit button | Top of page |
| **BlockDandyFormRightAlt** | Split-screen hero — pitch on the left, form on the right | Top of page, "Request a Demo" style |
| **BlockDsoCtaCapture** | Mid/bottom-of-page CTA with email capture + Chili Piper handoff | After the value-prop sections |
| **BlockPopup** | Modal that opens on CTA click or exit intent | Triggered, not in page flow |
| **BlockEventPage** | Webinar / event RSVP with date and time context | Event landing pages |
| **BlockContentSeries** | Gated content (video, PDF) revealed after submit | Resource / content series pages |

**Rule of thumb:** if you're not sure, use `BlockForm`. Everything below uses `BlockForm` as the example — the other blocks share most of the same configuration.

---

## 2. Adding a form block

1. Open the landing page in the **Page Builder**.
2. Click **Add Block** where you want the form to live.
3. Search for **"Form"** and pick **BlockForm**.
4. The block appears with a sample form. Click it once to select — the **Form Panel** opens on the right.

---

## 3. Local form vs. Global form

The first decision in the Form Panel is whether this form is **local** or **global**.

- **Local form** — fields and notification settings live on this page only. Best for one-off forms.
- **Global form** — defined once in the **Forms Library** (`/forms` in the admin) and reused across many pages. Best for your "Request a Demo" form that runs on a dozen landing pages — change it once, every page updates.

To use a global form: in the Form Panel, click **"Link Global Form"** and pick from the dropdown. To go back to local, click **"Unlink"**.

---

## 4. Configuring fields

Each form is a list of fields. For each field you set:

- **Label** — what the visitor sees above the input ("Work Email")
- **Type** — see the table below
- **Placeholder** — greyed-out text inside the input
- **Required** — toggle on to block submit when empty

### Field types

| Type | Notes |
|---|---|
| **text** | Standard one-line input. If you label it "Website" or "URL" it auto-strips `https://` and `www.` on blur. |
| **email** | Validates the address shape (`name@domain.tld`) before submit |
| **phone** | Live-formats as `(555) 123-4567` for US numbers or `+44 …` for international |
| **textarea** | Multi-line input — use for "Tell us about your needs" |
| **select** | Dropdown. Enter options one per line in the editor. |
| **checkbox** | Single toggle — best for opt-in / consent |
| **hidden** | Not shown to the visitor. Used for attribution — see next section. |

### Hidden fields and attribution tokens

Hidden fields can capture context automatically using these tokens (just put the token in the field's default value):

| Token | What it captures |
|---|---|
| `{{utm_source}}` | The `utm_source` URL param |
| `{{utm_medium}}` | The `utm_medium` URL param |
| `{{utm_campaign}}` | The `utm_campaign` URL param |
| `{{utm_content}}` | The `utm_content` URL param |
| `{{utm_term}}` | The `utm_term` URL param |
| `{{gclid}}` | Google Ads click ID |
| `{{fbclid}}` | Facebook Ads click ID |
| `{{ga_client_id}}` | The visitor's GA4 client ID cookie |
| `{{page_url}}` | The full URL the form was submitted from |
| `{{page_title}}` | The page's `<title>` |
| `{{referrer}}` | The previous page (where they came from) |

Common setup: add five hidden fields named `utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `page_url` with the matching tokens as their default values. They'll flow through to Marketo and the leads dashboard with no extra work.

---

## 5. Multi-step forms

In the Form Panel, toggle **"Multi-step"** to split fields across multiple screens.

- Drag fields between steps in the editor.
- Each step gets its own **Next** button; the last step shows the **Submit** button.
- Validation runs per step — the visitor can't advance until the current step's required fields are filled.
- Step labels (optional) appear as a progress indicator at the top of the form.

Best practice: keep step 1 to email + name only. Higher friction fields (company size, job title) go on later steps so you still capture the lead even if they drop off.

---

## 6. Wiring up Marketo

Marketo runs at two levels — set up the brand level **once**, then per-form mappings as needed.

### A. Brand-level (one-time setup)

In the admin go to **Settings → Integrations** (`/integrations`) and fill in:

- **Munchkin ID** — found in Marketo under Admin → Munchkin (e.g. `123-ABC-456`)
- **REST API Client ID** — created under Admin → LaunchPoint
- **REST API Client Secret** — same place
- **REST API Endpoint** — the host portion of your Marketo URL

Once these are in, every form on every page in this brand can sync to Marketo. You only redo this if the tenant rotates credentials.

### B. Per-form setup

In the Form Panel → **Notifications** tab:

1. Toggle **"Send to Marketo"** on.
2. Enter the **Marketo Form ID** (a number — find it in Marketo under the form's Embed Code, e.g. `3006`).
3. Fill in **Field Mappings** — one per line in the format `Field Label:marketoFieldName`. Example:
   ```
   Work Email:Email
   First Name:FirstName
   Last Name:LastName
   Company:Company
   Phone:Phone
   ```
   The label on the left must match the form field's label exactly. The name on the right is Marketo's internal API name (find it in Marketo under Admin → Field Management).

### How submissions actually reach Marketo

Two things happen on every successful submit:

1. **Server-side sync** — the API server posts the lead to Marketo's REST API. Reliable, always runs.
2. **Ghost-submit** (currently **disabled** behind a flag) — would have invisibly mounted a real Marketo form in the page, populated it from the visitor's data, and submitted it to associate the visitor's Munchkin cookie. This is what triggers Marketo Smart Campaigns and behavior-based scoring. **Currently off** while we sort out the Forms2 reliability issues — ask the engineering team before flipping the flag.

---

## 7. Wiring up Chili Piper handoff

If you want visitors to book a meeting immediately after submitting:

In the Form Panel → **Settings** tab:

1. Toggle **"Chili Piper Handoff"** on.
2. Paste the **Chili Piper Router URL** (from your Chili Piper admin → Router → Embed code, e.g. `https://meetdandy.chilipiper.com/router/inbound-router`).
3. (Optional) Map form fields to Chili Piper parameters — e.g. `Work Email:email`, `First Name:firstName`. Most routers pick up `email` automatically, so you usually only need to map that one.

**What the visitor sees:** form → fills out → hits submit → form fades out → Chili Piper calendar appears in its place, prefilled with their email. They never re-type anything.

If the router is offline or the meeting UUID is wrong, the form still submits to Marketo / our DB — only the calendar step fails. Check the Chili Piper admin if visitors report a blank scheduler.

---

## 8. GTM "Marketo Form Submission" event

Every form across the site (all 7 block types) fires a single GTM dataLayer event on successful submit. This is what your ad pixels (Google Ads, LinkedIn, GA4) should trigger off.

### Event details

- **Event name:** `Marketo Form Submission`
- **Payload:** `{ event: "Marketo Form Submission", formName: "Demo Form" }`
- **De-dupes per page load** — if a visitor submits two forms on the same page, only the first one fires (prevents double-counting conversions).
- **Fires after** the lead is successfully written to our database.

### How to use it in GTM

1. In GTM → **Triggers** → New → **Custom Event**.
2. Event name: `Marketo Form Submission` (exact match).
3. Save the trigger and attach it to your conversion tags (LinkedIn Insight conversion, Google Ads conversion, GA4 event, etc.).

### Verifying it's working

1. Open the page in Chrome with DevTools open (Console tab).
2. Submit the form.
3. Look for: `[lp-studio] dataLayer push fired: { formName: "...", event: "Marketo Form Submission", gtm.uniqueEventId: ... }`
4. To double-check, run in the console:
   ```js
   window.dataLayer.filter(e => e.event === "Marketo Form Submission")
   ```
   It should return a populated array.

If you see `[lp-studio] dataLayer push skipped: window.dataLayer not present (GTM not loaded?)`, GTM isn't installed on that page — fix the GTM snippet first.

---

## 9. Where the leads end up

Every successful submission is written to the `lp_leads` table and is visible in the admin at **`/leads`**.

### Summary view (`/leads`)

- One row per landing page with total lead count, time-range filters
- Click a row to drill into that page's submissions

### Detail view (`/leads/:pageId`)

For each submission you see:
- All field values (including hidden attribution fields)
- Date / time
- IP address
- Variant ID (if the page is part of an A/B test)
- Source block (e.g. `popup-chilipiper`, `dso-cta-capture`, `dandy-hero-v7-s3`)

### Export

Click **Export CSV** to download a date-ranged dump for your CRM / ops team.

---

## 10. Notification emails

In the Form Panel → **Notifications** tab there's also an **Email Notifications** section:

- **Recipients** — comma-separated list of emails to notify on every submission
- **Subject template** — supports field tokens like `New lead from {{email}} at {{company}}`
- **Reply-To** — usually the lead's own email so your sales team can hit reply

Notifications go out via Resend. If they stop arriving, check the Resend dashboard for bounces — most issues are recipient inboxes blocking the sending domain, not the form.

---

## 11. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Form shows "Loading form…" forever | Visible Marketo embed failed | Wait 10s — the watchdog will hide it. Then check the Marketo form ID, domain whitelist, and approval status. |
| Submissions don't appear in Marketo | Bad form ID or field mappings | Check Marketo form ID is a number, mappings use exact Marketo API names |
| Submissions don't appear in `/leads` | Page not saved / wrong tenant | Confirm the page is published and you're viewing the right brand |
| GTM event never fires | GTM not on the page, or already fired once | Hard-refresh the page, open Console, submit again, look for the `[lp-studio]` log |
| Chili Piper shows 404 / blank | Bad router URL or deleted meeting | Check the router URL in Chili Piper admin — meeting UUID changed |
| Hidden UTM fields are empty | Visitor came in without UTM params | Expected — only fills when the URL actually has them |

---

## 12. Engineering reference

For developers maintaining this system:

- Form blocks: `artifacts/lp-studio/src/blocks/Block*.tsx`
- Form Panel UI: `artifacts/lp-studio/src/pages/builder/property-panels/FormPanel.tsx`
- Field types: `artifacts/lp-studio/src/lib/block-types/common.ts`
- GTM helper: `artifacts/lp-studio/src/lib/gtm-datalayer.ts`
- Marketo embed: `artifacts/lp-studio/src/components/MarketoForm.tsx`
- Chili Piper iframe + booking tracking: `artifacts/lp-studio/src/blocks/ChiliPiperModal.tsx`
- Lead capture endpoint: `artifacts/api-server/src/routes/index.ts` (`POST /lp/leads`)
- Marketo REST sync: `artifacts/api-server/src/integrations/marketo/*`
- Ghost-submit kill switch: `GHOST_SUBMIT_ENABLED` constant in `BlockForm.tsx`
