---
name: Marketing banner + navbar fixed-position scroll coordination
description: Invariants for keeping the marketing announcement banner and navbar coordinated so no gap opens on scroll.
---

The marketing site (lp-studio `src/marketing`) top chrome is TWO independent
`position: fixed` bars: the announcement banner (home page only) and the navbar
(every marketing page). The banner publishes its pixel height to the
`--lp-banner-h` CSS var; the navbar offsets itself below it via that var, and the
home page reserves the same space with a top padding read from that var.

**The gap bug:** if the banner disappears/scrolls away but the navbar keeps its
banner-height top offset, an empty strip opens between the top of the screen and
the navbar where page content shows through while scrolling — looks buggy.

**Invariants when touching either bar's position/visibility:**
- Banner and navbar must hide/reposition off the SAME scroll threshold so they
  move in lockstep (no transient gap).
- Use EQUAL transition durations on the banner's slide and the navbar's offset
  move, or scroll-up shows a brief flicker/overlap phase.
- Do NOT change `--lp-banner-h` on scroll — the page padding reads it, so zeroing
  it mid-scroll reflows/jumps content. Only reset it on dismiss. Slide the banner
  out visually (transform) instead.

**Why:** Charlotte reported the banner leaving a visible gap under the nav while
scrolling. Keeping the var stable avoids content jump; a shared threshold + equal
durations keep the two fixed bars synchronized so no gap ever appears.
