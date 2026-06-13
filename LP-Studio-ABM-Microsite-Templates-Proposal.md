# ABM Microsite Templates — Funnel-Stage Library (Proposal)

The microsite tool builds personalized pages for **ABM target accounts**. A rep should be
able to pick an all-in-one template matched to where the account is in the funnel (or
start from scratch). This maps the full library to the buyer journey and proposes the new
templates to build. **Nothing here is built yet — this is for your approval.**

## The funnel map

| Stage | Goal | Template(s) | Status |
|---|---|---|---|
| **1. Top of funnel** — earn the first meeting | Get a reply / book the intro | StoryBrand Journey · Exec Decision Brief (MEDDIC) · Challenger Insight | ✅ Built + just upgraded |
| **2. Mid / deal acceleration** — move the deal | Align stakeholders, build the business case, agree next steps | **Deal Room** | ➡️ Propose |
| **3. New customer** — onboarding | Fast, confident activation; reduce time-to-value | **Onboarding Hub** | ➡️ Propose |
| **4. Expansion & renewal** — grow / keep | Prove value, justify renewal, open expansion | **Value & Renewal Review** | ➡️ Propose |

Optional 5th (high-ABM-value, flag if you want it): **Executive Event / Roadshow Invite**
— a personalized invite microsite for a dinner/webinar/exec roundtable targeting an account.

Each existing TOF template stays a distinct *message* angle (story-led, data-led,
provocation-led) so reps choose by how they want to open the account.

---

## Proposed new template 1 — **Deal Room** (`deal-room`)
*Stage: deal acceleration. The single highest-value ABM template — this is where deals stall.*

**When a rep picks it:** after the first meeting, to give a champion a single link that
sells internally for them and keeps the deal moving.

**Section anatomy (all-in-one block):**
1. **Personalized hero** — "Acme × [Your Co]: the path to [outcome]" + account logo lockup,
   one-line deal thesis, primary CTA ("Book the next step").
2. **Mutual action plan / timeline** — the shared steps to go-live with owners + dates
   (the thing that actually accelerates deals); checkmark progress states.
3. **The business case** — ROI/impact for *this* account (reuses the MEDDIC economic-case
   treatment: investment vs. return, payback), editable per account.
4. **Stakeholder map** — who's involved + what each role gets (champion, economic buyer,
   technical, end users) — helps multi-thread.
5. **Proof for this buyer** — 1–2 case studies matched to the account's industry/size +
   a logo wall + a key quote.
6. **Resources / docs** — security, pricing, implementation one-pagers (links to real
   assets in the library; never fabricated).
7. **Objection handling / FAQ** — the deal-specific worries, answered.
8. **Clear close** — schedule the next meeting / e-sign / start pilot.

**Visual direction:** premium "shared workspace" feel — cream canvas, white cards,
indigo for actions, a dark deep-indigo "business case" chapter with aurora, mutual-plan
timeline with a connecting line, coral spark only on "next step"/"done" states. Animated
count-up on ROI. Account logo paired with LP Studio-tenant logo in the hero.

**Personalization inputs:** account name/logo/industry/size, deal thesis, the MAP steps,
ROI inputs, matched case studies, stakeholder roles, linked docs.

---

## Proposed new template 2 — **Onboarding Hub** (`onboarding-hub`)
*Stage: new customer. Reduces time-to-value and churn risk in the first 90 days.*

**When a rep/CSM picks it:** at handoff/kickoff, to give the new account a warm, organized
"start here" page.

**Section anatomy:**
1. **Welcome hero** — "Welcome, [Account]. Here's your path to [first win]." warm portrait
   or team photo, kickoff CTA.
2. **Your onboarding plan** — phased steps (kickoff → setup → first value → full rollout)
   with timeline + owners; progress states.
3. **Your team** — named CSM/implementation contacts with photos (warm grayscale portraits)
   + how to reach them.
4. **Getting started checklist** — the concrete first actions, checkable.
5. **Resources & training** — guides, videos, docs (real library links), grouped.
6. **What success looks like** — the outcomes/metrics they'll hit, to set expectations.
7. **Support & next check-in** — how to get help + book the next review.

**Visual direction:** warm, reassuring, human (leans on the brand's "warm paper" +
real-people photography). Sage/sand accents for a calmer, supportive feel; indigo for
actions; coral spark on completed steps. Gentle fade-ups, no aggressive motion.

**Personalization inputs:** account + named contacts/photos, onboarding phases, checklist
items, relevant resources, success metrics.

---

## Proposed new template 3 — **Value & Renewal Review** (`value-renewal-review`)
*Stage: expansion & renewal. Turns a QBR into a self-serving renewal/expansion asset.*

**When a rep/CSM picks it:** before a renewal or QBR, to recap value delivered and open
the expansion conversation.

**Section anatomy:**
1. **Hero** — "[Account]: your year with [Your Co]" + headline result.
2. **Value delivered** — the metrics/ROI realized this term (count-up stat band) — the
   renewal justification, in numbers.
3. **Usage & adoption story** — what they've used, milestones hit, momentum (browser-framed
   product UI as proof).
4. **Wins / proof** — internal quotes or outcomes from their own team if available;
   otherwise matched peer proof.
5. **What's next / expansion** — the modules/seats/use-cases to grow into, framed as
   their roadmap (not a hard upsell).
6. **The renewal** — terms recap + clear, low-friction renewal CTA.
7. **Your team & next steps** — contacts + book the renewal/expansion conversation.

**Visual direction:** confident, premium, "executive readout" — data-led like the MEDDIC
brief but warmer; a dark "the year in numbers" chapter with aurora + count-up; gold/sage
accents for a established-relationship feel; coral spark on growth/up-trend marks.

**Personalization inputs:** account, realized metrics, usage milestones, expansion
options, renewal terms, contacts.

---

## Build approach (once approved)
- Each new template = a new full-page **all-in-one block** (like exec-decision-brief),
  seeded as a **global microsite template** so reps see it in the create-microsite modal
  under a stage-grouped picker, **plus** intent keywords so "deal room", "onboarding",
  "renewal / QBR" route correctly in the AI path.
- All reuse the brand system (cream/ink/indigo, coral spark, DM Sans/Inter, mono markers,
  aurora on dark, count-up, reduced-motion safe) and the account-personalization the
  microsite generator already does. Reps can always start from scratch.
- I'd group the modal picker by funnel stage: **First meeting · Accelerate the deal ·
  Onboard · Expand & renew** so a rep picks by intent.

## What I need from you
1. Approve the 3 new templates (Deal Room, Onboarding Hub, Value & Renewal Review)?
2. Want the optional **Event/Roadshow Invite** template too?
3. Any section you'd add/cut on each — especially the **Deal Room** (the highest-leverage
   one), since the mutual action plan + stakeholder map are the ABM-specific differentiators.

I'll build them in priority order (Deal Room first) once you confirm.
