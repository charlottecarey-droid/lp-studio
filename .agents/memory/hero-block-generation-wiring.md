---
name: New hero block → generate-page wiring checklist
description: The fixed set of callsites to wire a new hero-class block into AI page generation (image fill + prompt rules + nav classification).
---

Wiring a new hero-class block into `generate-page.ts` is a fixed checklist —
missing any item degrades silently (wrong image grade, double navs, or the AI
never picks the block):

1. **Image fill (3 callsites)** — add the type to `collectImageSlots`'s
   `heroScalar` list, `fillEmptyImages`'s hero `imageUrl` branch (else the
   generic branch fills a feature-grade `lp-feature` photo that pixelates in a
   full-width band), and `aiFillEmptyImages`'s `isHero` (16:9 vs 4:3 gen).
2. **Prompt (4 spots)** — an AVAILABLE BLOCK TYPES bullet (format matters: the
   recipe-vocab guide parses `- "type":` bullets), rule 4 hero-class list,
   rule 14 nav list (pick the correct side: renders-own-nav vs needs
   nav-header-first), rule 15 SHOWCASE list.
3. **Nav classification** — `SELF_NAV_TYPES` in `lib/nav-dedup.ts` ONLY if the
   block renders its own nav; if not, leave it out and the deterministic nav
   injector adds a nav-header. Rule 14 wording must agree with this set.
4. **Video-slot heroes** — if the block has a `backgroundVideoUrl`, the bullet
   must say "set ONLY with a REAL provided URL"; for Dandy, extend the
   DANDY-INTERNAL VIDEO ASSETS line so the model knows it may use the internal
   video there.

**Why:** each of these passes/lists enumerates hero types explicitly; there is
no shared registry, so a new hero participates in none of them by default.

**How to apply:** whenever graduating/wiring a hero-class block (renderer-side
graduation callsites are a separate checklist — see
block-type-graduation-callsites.md). Verify with the recipe-vocab + images
vitest files in routes/lp.
