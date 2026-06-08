---
name: Premium block decorative orb accent alpha
description: Why decorative glow orbs in LP section blocks must sometimes use element opacity instead of alpha-hex on the accent color.
---

When adding decorative radial-glow orbs to LP Studio section blocks, do NOT append an
alpha-hex suffix (e.g. `${accent}1a`) to an `accent` that may be a `var(...)` string —
some blocks default `accent` to `var(--brand-accent, #hex)`, and `var(...)1a` is INVALID
CSS, so the orb silently won't render.

**Rule:** prefer the universal pattern — element `opacity` (Tailwind `opacity-10`/`opacity-[0.08]`)
on the orb div plus a solid `radial-gradient(circle, ${accent}, transparent 70%)`. Alpha-hex
is only safe on blocks whose `accent` is guaranteed to be a real hex.
**Why:** mixing alpha-hex onto a `var()` string is a common silent failure when polishing blocks.
**How to apply:** use opacity-on-orb for any new decorative accent regardless of the block's
accent type, so you never have to audit whether `accent` is a hex or a `var()` token.
