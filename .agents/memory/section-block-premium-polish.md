---
name: Section-block premium polish convention
description: How features/benefits/how-it-works section blocks apply premium-toolkit visual polish without breaking the builder canvas or sticky/scroll layouts.
---

The features/benefits/how-it-works section block family (BlockFeatures*, BlockBenefits*,
BlockHowItWorks*) shares one premium-polish pattern built on `@/lib/premium-toolkit`.

**Rule:** every section-block animation/decoration must gate off the builder via
`const isBuilder = !!onFieldChange;`
- Section: `relative overflow-hidden` + `<SectionDecor accent={accent} isDark={surface.isDark} disabled={isBuilder} />` as the first child; inner container `relative z-10`.
- Cards: `motion.div` with `initial={isBuilder ? false : {opacity:0,y:20}}`, `whileInView={isBuilder ? undefined : {...}}`, `viewport={{once:true,amount:0.2}}`, staggered `delay: i*0.06`.
- Icon tiles: `linear-gradient(135deg, ${accent}26, ${accent}0d)` + `color:accent` + `boxShadow: inset 0 0 0 1px ${accent}1f`, group-hover scale.

**Why:** scroll-reveal `whileInView`/transform wrappers and decorative orbs break
the live builder canvas (elements stay hidden, transforms fight sticky/contain). Gating
on `isBuilder` keeps the builder static and stable while published pages animate.

**How to apply:**
- NO_REVEAL blocks (e.g. BlockHowItWorksHorizontalStepper — it's in BlockRenderer's NO_REVEAL set; see no-reveal-sticky-blocks.md): only wrap the header in `<Reveal isBuilder>`; never wrap the overflow-x/snap/sticky container.
- Connectors (steppers/timelines): animate the rail via `scaleX`/`scaleY` with `origin-left`/`origin-top` gradient, not by re-laying-out.
- Benefits Grid + Benefits Bento: decor + card stagger ONLY — do NOT change their background (they have a bg option that must be preserved).
- Toolkit lives in `artifacts/lp-studio/src/lib/premium-toolkit.tsx`: `Reveal({isBuilder?})`, `GlowOrbs({blend?})`, `SectionDecor({accent,isDark,disabled,grid})`.
- Typecheck lp-studio via the validation skill (`tc-lp`), never raw bash (tsc >12min).
