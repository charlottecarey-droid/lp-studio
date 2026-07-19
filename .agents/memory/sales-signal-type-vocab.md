---
name: Sales signal type vocabulary
description: What happens when the backend emits a sales_signals row with a new type string
---

# Sales signal type vocabulary

`sales_signals.type` is free text in the DB, but the UI vocabulary lives in lp-studio `src/lib/signal-types.tsx` (SIGNAL_TYPES + SIGNAL_CONFIG + SIGNAL_WEIGHTS).

- Unknown types still render everywhere: `getSignalLabel` falls back to `type.replace(/_/g, " ")` and a default icon, and they appear in unfiltered lists/timelines.
- BUT an unknown type gets NO filter chip (not in SIGNAL_TYPES), NO custom icon/color, and 0 engagement-score weight (SIGNAL_WEIGHTS lookup).

**Why:** a backend-only signal type (e.g. `microsite_requested` from the SFDC button poller) works fine as timeline activity without touching the frontend, so don't block on UI edits — but if it should influence engagement scoring or be filterable, the frontend vocab must be extended too.

**How to apply:** emitting a new signal type from the backend is safe as-is; add it to SIGNAL_TYPES/SIGNAL_CONFIG/SIGNAL_WEIGHTS only when scoring or filtering matters.
