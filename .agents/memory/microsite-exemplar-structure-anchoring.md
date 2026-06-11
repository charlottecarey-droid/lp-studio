---
name: Microsite exemplar structure-anchoring
description: Why sales microsites came out with identical block lineups across accounts, and how exemplar framing + temperature drive structural variance.
---

# Microsite exemplar structure-anchoring

Sales microsites (generate-microsite.ts) for a Dandy DSO segment run the
"DSO-freeform" path: the model composes its OWN block lineup, and the footer
already says "Vary BOTH the selection AND the order across accounts." Yet every
account's microsite came out with the SAME blocks.

**Root cause:** the shared EXEMPLARS section (`formatExemplarsSection` in
microsite-exemplars.ts) is injected into the system prompt for ALL paths and
emitted the single per-audience exemplar's FULL page JSON with the instruction
"Match this register, this level of specificity, **this structure**." There is
exactly ONE built-in exemplar per audience (PDS/DCA/Smilist), so the same
exemplar + the same "match this structure" command anchors every account in a
segment to one block sequence — overriding the freeform footer's "vary"
instruction. A concrete full-JSON example with "match this structure" beats an
abstract "vary it" rule every time.

**Why rotation doesn't help:** `pickExemplars` filters by `e.audience ===
segmentId`; with one exemplar per audience there is nothing to rotate.

**How to apply / the fix that worked:**
- Reword the exemplar intro so exemplars are framed as QUALITY references
  (voice, register, specificity, density). Explicitly state their block
  selection+order are "just ONE example, NOT a layout to reproduce" and to NOT
  copy their structure. Keep emitting the exemplar JSON (valuable for copy
  quality). This removes the contradiction WITHOUT forcing reordering on the
  fixed-template/curated paths, whose own "use only these, in this order" /
  "EXACTLY these blocks in EXACTLY this order" directives stay authoritative.
- Make the OpenAI temperature path-dependent at the single call site:
  `(useFreeform || useDsoFreeform) ? 0.85 : 0.7`. Freeform paths get more
  structural diversity; fixed-template/curated keep 0.7 for copy fidelity.
- `useFreeform`/`useDsoFreeform` are in scope at the completion call site.

LP block variance is a SEPARATE pipeline (generate-page brand-match role
selection); microsite variance is driven by exemplar framing + temperature, not
by that LP mechanism.
