---
name: Inline text color popover (floating toolbar) gotchas
description: Two non-obvious traps in the InlineText floating toolbar's color picker — brand-var resolution scope and selectionchange teardown.
---

# Inline text color popover (InlineText.tsx + InlineColorPopover.tsx)

This is the floating WYSIWYG toolbar shown when editing block text on the canvas
(distinct from the builder property-panel ColorRow — see
builder-color-input-var-resolution.md). Two traps:

## 1. Brand swatches must be resolved against the contentEditable, not the popover
The whole toolbar is `createPortal(..., document.body)`, i.e. OUTSIDE the
brand-scoped wrapper that sets `--brand-*` CSS vars. So passing
`var(--brand-primary)` swatches resolves to nothing there (renders empty/checker).
Resolve to real hex by reading `getComputedStyle(editableRef.current)` — the
contentEditable element IS inside brand scope and inherits the vars. Do it when
the picker opens and pass concrete hex to InlineColorPopover.

**Why:** InlineColorPopover's own `resolveSwatchValue` probes against its
PopoverTrigger, but the trigger is in the body-portaled toolbar too, so it can't
help. The only element in brand scope is the editable.

## 2. selectionchange tears down the toolbar when focus enters a popover input
The floating toolbar's visibility is driven by `toolbarPos`, recomputed on every
`selectionchange` via `updateToolbarFromSelection`. Clicking into the color
picker's hex `<input>` moves focus out of the contentEditable → its selection
collapses → `setToolbarPos(null)` → toolbar (and the open popover) unmounts. So
the picker "closes the moment you click the hex field."

**Fix/contract:** swatch buttons avoid this with `onMouseDown preventDefault`
(keeps focus in editor), but a text input MUST take focus to be typeable. So
`updateToolbarFromSelection` bails early (keeps current toolbarPos) when
`document.activeElement` is inside `[data-inline-toolbar]` or
`[data-radix-popper-content-wrapper]`. Any new focusable control in a toolbar
popover relies on that guard.
