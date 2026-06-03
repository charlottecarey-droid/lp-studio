---
name: One Pager mobile paddingX scaling
description: Why/how the One Pager's fixed block side-padding is made responsive without affecting other landing pages
---

The One Pager intentionally bakes a fixed horizontal padding onto its content blocks so they line up with the hero band's text inset on desktop. That inset is an inline style, so it cannot be made responsive on its own and is too wide on phones.

**Rule:** make the inset responsive at the render/CSS layer only — never by changing the block's stored paddingX or the API defaults. The mechanism: blocks carry an inert marker attribute, and the One Pager frame injects a scoped mobile media rule (`!important`, because it must override an inline style) that shrinks the inset on phones. Keep the marker and the scoped rule in sync.

**Why:** inline styles can't hold media queries; and the override must be scoped to the One Pager sheet so ordinary landing pages (which also set paddingX via the editor/AI) and the PDF generators are untouched. A global change to the padding scale would shift every LP.

**How to apply:** when adding new full-page-sheet layouts or changing the desktop padding scale, re-derive the phone inset so hero and sections still align, and verify a real phone width (~390px) since this is pure CSS with no automated guard.
