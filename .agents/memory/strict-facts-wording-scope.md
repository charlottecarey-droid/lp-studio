---
name: Strict Facts wording must scope to figures + attributed proof only
description: Why STRICT_FACTS_INSTRUCTION must restrict ONLY specific numbers/named-proof, never "claims" — and where its mirrors live.
---

`STRICT_FACTS_INSTRUCTION` is appended to AI page/section prompts whenever a
brand has Strict Facts Mode on — and it is **OPT-IN, default OFF** (June 2026
flip from default-ON; now read as `aiStrictFactsMode === true`, unset = OFF). It
was flipped because users complained it stamped "X" placeholders / "Add a quote
in brand settings" onto everything. So its wording only shapes copy for the
tenants who explicitly turned it on.

**Rule:** the restriction must apply ONLY to *specific figures and attributed
proof* — exact statistics, percentages, customer counts, dollar amounts, named
case studies, and customer quotes. It must NOT use the broad word **"claims"**
and must NOT end with **"Write nothing else in those slots."** It must also
explicitly tell the model to write full, substantive, persuasive copy for
EVERYTHING ELSE (headlines, value props, benefits, explanations, body).

**Why:** a user reported page copy that was short and lacked substance — "the
AI won't say anything unless it's literally in the brand guidelines." Root cause
was the old wording: "Use ONLY the statistics… **claims**… listed in this brief…
Write nothing else in those slots." The model generalized "claims"/"nothing
else" to all prose and went silent on anything not spelled out in brand settings.
The anti-fabrication intent only ever needed to cover hard numbers + attributed
proof, not persuasive prose.

**How to apply:**
- The instruction is MIRRORED in THREE spots that must stay in sync (the comments
  say so): `api-server/routes/lp/generate-page.ts`,
  `api-server/routes/lp/custom-blocks-generate.ts`, and the client
  `lp-studio/src/lib/brand-config.ts`. generate-page additionally appends a
  page-specific testimonial-card exception (omit cards, never placeholder them).
- `api-server/routes/lp/copy-generate.ts` is the GOOD pattern and already correct
  — it restricts ONLY numeric stat/`value` fields and explicitly allows
  rewriting labels/descriptions in brand voice. Don't broaden it.
- Load-bearing literals to preserve when rewording: the `"STRICT FACTS MODE"`
  prefix (asserted by `lp-studio/tests/strict-facts-mode*.spec.ts`), the `"X"`
  stat placeholder, and `"Add a quote in brand settings"` (== `CASE_STUDY_PLACEHOLDER`,
  matched by downstream stat/testimonial sanitizers like stripPlaceholderTestimonials).
- Do NOT "fix" thin copy by softening the separate anti-leak controls
  (segment hierarchy, avoidPhrases, approved-pool gating) — see the segment-hierarchy
  and brand-voice-anchor memories; those are different axes and documented
  regression sources when churned.
