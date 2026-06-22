---
name: jsdom strips background-image url() in render tests
description: Why block render tests can't assert an image URL in markup, and what to assert instead.
---

In lp-studio `*.render.test.tsx` (jsdom env), a React block that sets its
background via `getImageBgSectionStyle(url)` (which emits `backgroundImage:
url(<url>)` — UNQUOTED) will NOT have that URL anywhere in `container.innerHTML`.
jsdom's CSSOM silently drops the unquoted `url(...)` background-image value.

**Why:** jsdom's `cssstyle` parser rejects/strips bare `url(https://…)` (no
quotes), so the style attribute serializes without it. This is a test-env quirk
only — real browsers render the image fine.

**How to apply:** Don't assert the image URL in markup for an image-bg block.
Instead assert the *conditional overlay element* the renderer mounts alongside
the bg image (e.g. webinar-hub's `heroBackgroundImageUrl && <div opacity=…>`):
scan `container.querySelectorAll('div')` for the expected inline `style.opacity`
(the whole-percent overlay ÷ 100). That proves the image branch was taken
without depending on CSSOM keeping the URL.
