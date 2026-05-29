---
name: LP hero overlayOpacity is a 0-100 percent
description: overlayOpacity props on LP hero blocks are whole-number percents, not 0-1 fractions
---

LP Studio hero blocks that take an `overlayOpacity` prop (full-bleed-hero,
parallax-image-hero, and similar image-over-text heroes) expect a **0–100
percent** value. The renderer divides by 100 internally
(`(props.overlayOpacity ?? 50) / 100`).

**Why:** When the AI generate-page SYSTEM_PROMPT documented `overlayOpacity` as
`0.4–0.65`, the model emitted fractions like `0.5`, which became `0.005` opacity
— a nearly-invisible overlay and unreadable white hero text.

**How to apply:** Any prompt schema or default for an LP hero `overlayOpacity`
must use whole-number percents (e.g. `40–65`), never `0–1`. If you add a new
image-over-text hero, check whether its renderer divides by 100 before writing
the prompt schema.
