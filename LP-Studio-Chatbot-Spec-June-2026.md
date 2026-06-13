# LP Studio — Conversational AI Spec (3 bots + roadmap)

The three bots you named are the same engine pointed at different goals. The strategic move is
to build ONE conversation service and configure it three ways, not three separate features.

## The shared engine (build once)

A `ConversationEngine`: streaming chat (reuse the SSE infra from the live-build work) +
a per-mode config object defining:
- **persona / system prompt** — who the bot is and its goal
- **grounding source** — what it's allowed to know (and, critically, what facts it may assert)
- **goal action** — what a successful conversation produces (a saved lead, a builder edit, a resolved ticket)
- **surface** — where it renders (builder panel, published page, superadmin console)
- **guardrails** — refusal rules, PII handling, escalation

Two cross-cutting principles bind all three:
1. **Strict-facts grounding.** The bots must only state approved facts from Brand Settings /
   proof points — the exact approved-fact pool the strict-facts system already governs. A lead
   bot that invents "we guarantee 99% uptime" is a liability. This is a major synergy: the work
   already done on fact approval directly powers safe bots.
2. **One conversations table** (`conversations` + `messages`, tenant-scoped, mode-tagged) so
   transcripts, analytics, and lead/ticket linkage are uniform.

---

## Bot 1 — Builder Copilot (recommends as you build)

**Goal:** keep users in flow and make the product feel magical; drives activation + retention.
**Surface:** a panel in the builder (`/builder/:id`).
**Grounding:** the current page's blocks + the tenant's Brand Settings + the block catalog +
the recipe/template knowledge already encoded server-side.
**What it does:** "Your hero is strong but there's no social proof above the fold — want me to
add a testimonial-wall after it?" / "This page has two CTAs back to back — shall I add an FAQ
between them?" / "Your brand voice is set to 'warm' but this copy reads corporate — rewrite it?"
Each suggestion is an **executable action**: it can apply the edit (insert a block, rewrite copy,
swap an image, fix the contrast issue) on confirmation, reusing the generation + critique
pipelines and the per-block edit mutations the builder already has.
**Why it's the lowest-risk build:** internal surface, no public abuse vector, no spam, no PII
from strangers; it reuses generation, critique, image-fit flags, and the recipe system you
already shipped. It's mostly a new panel + an "actions" layer over existing mutations.
**Risk:** scope creep (it can do anything) — constrain v1 to a fixed menu of action types.

## Bot 2 — Lead-Capture Bot (published pages)

**Goal:** convert visitors who would never fill a static form; the revenue story.
**Surface:** a launcher bubble + panel on published landing pages (a new `chat-capture` block,
tenant-toggled per page; optional proactive triggers — exit intent, scroll depth, time on page).
**Grounding:** the published page's own content + Brand Settings + approved facts, so it can
actually answer "do you offer X?", "how much?", "do you work with clinics my size?".
**Goal action:** it qualifies conversationally, then **writes the captured fields into the exact
same `lib/lead-utils` pipeline the forms use** — so leads land in the same place, with Marketo /
Chili Piper routing intact, and can even **book a meeting mid-conversation** via the existing
Chili Piper hand-off. Optional inline qualification scoring (BANT/MEDDIC-lite — ties to the
frameworks just built) attached to the lead.
**Why it matters:** this is the genuine differentiator over a form and the strongest Product Hunt
beat ("your landing page talks back and books the meeting").
**Risk:** highest-stakes — public, unauthenticated, cost + abuse exposure (needs the rate-limit
infra you just added), strict-facts grounding is non-negotiable, GDPR consent (banner exists),
and a hard "I don't know — here's the form" fallback so it never bluffs.

## Bot 3 — Support Bot (superadmin + tenant)

**Goal:** deflect tickets, capture support requests; operational, not revenue.
**Two instances of one config:**
- **Platform support (for you, superadmin):** grounded in LP Studio's own help content /
  docs / runbooks; answers "how do I publish to a custom domain?", captures bug reports + feature
  requests into a queue you triage. Doubles as a **product-gap radar** — clustering what tenants
  ask reveals where the product confuses people.
- **Tenant support (for their end-customers):** grounded in the tenant's brand/help content;
  routes unresolved questions to the tenant.
**Surface:** superadmin console + (later) an opt-in mode of the published-page bot.
**Why it's lowest urgency:** valuable but not launch-critical; technically the simplest
(retrieval over a doc set + ticket creation), so it's a fast follow.

---

## Prioritization

**1st — Builder Copilot.** Best effort-to-impact: lowest risk, highest reuse of what's shipped,
huge "wow" in a demo, and it improves the core generate-and-edit loop everyone touches. Ship a
constrained v1 (fixed action menu: add block, rewrite copy, fix contrast, suggest next section).

**2nd — Lead-Capture Bot.** The revenue/differentiation story and the marquee launch feature,
but it's the heaviest lift (public surface, abuse/cost/PII, strict grounding, consent, Chili
Piper booking). Worth doing right, not rushed — likely just-after-launch rather than blocking it.

**3rd — Support Bot.** Fast follow once the engine exists; start with the superadmin/platform
instance since it helps you most immediately and needs no public surface.

---

## Opportunities you're missing

- **Conversational form-fill** — the lead bot fills the page's actual form fields through
  conversation (hybrid of bot + form), so the same lead schema/routing is reused and the visitor
  never sees a wall of inputs.
- **"Review my page" copilot mode** — point the builder bot at the finished page for a critique
  pass surfaced as chat ("3 things I'd change before you publish"), wiring the image-fit and
  critique flags you already generate but currently drop in the UI.
- **Visitor-question analytics** — what people ask the lead bot is pure demand/objection data.
  Cluster and surface it to the tenant ("12 visitors asked about pricing you don't show") and to
  you as cross-tenant product signal. This may be the most undervalued asset here.
- **Strict-facts as a selling point** — "our AI chat can't make up claims about your business"
  is a real trust differentiator vs generic site chatbots; lean on the approved-fact grounding.
- **Auto-grounding, zero training** — bots derive their knowledge from the page + Brand Settings
  automatically; "no training required" is a strong onboarding story.
- **Mid-chat meeting booking + human handoff** — close the loop inside the conversation via the
  existing Chili Piper integration; escalate to a human/inbox when the bot is stuck.
- **Embeddable beyond LP Studio** — a script-snippet version of the lead bot for tenants' main
  sites (bigger surface area, later).
- **A/B testing the bot** — bot-on vs bot-off, or different opening lines, through the A/B engine
  you already have; proves the conversion lift with data.
- **Multilingual** — the model handles it for near-free; meaningful for some tenants.

## Recommended sequencing

1. Build the shared `ConversationEngine` + `conversations`/`messages` schema + strict-facts grounding adapter.
2. Builder Copilot v1 (constrained actions) on top of it.
3. Lead-Capture `chat-capture` block (grounding + lead pipeline + Chili Piper + consent + rate limits) — launch-adjacent.
4. Visitor-question analytics surface (cheap once transcripts exist; high value).
5. Support Bot (superadmin first), then tenant support mode.
