---
name: Scheduled-workflow "once" date must be calendar-validated
description: Why a regex + Date.parse check is NOT fail-closed for date strings, and how to validate them.
---

A `YYYY-MM-DD` string that passes a format regex is NOT necessarily a real
calendar date. `Date.parse("2026-02-31T00:00:00Z")` does NOT return NaN — JS
silently normalises impossible dates (2026-02-31 → 2026-03-03, 2025-02-29 →
2025-03-01). So `!Number.isNaN(Date.parse(...))` accepts garbage and a
scheduled `once` trigger would fire on an unintended day.

**Rule:** validate a date string by round-tripping its components:
`new Date(Date.UTC(y, m-1, d))` then assert `getUTCFullYear/Month/Date` equal
the inputs. If they differ, the date was normalised → reject (return null).

**Why:** the whole scheduled/audience config layer is fail-closed — a malformed
row must never execute against a guessed time/audience. The format-regex +
Date.parse pair looks fail-closed but isn't.

**How to apply:** any new date-string sanitizer (not just `parseScheduledConfig`)
must use the round-trip check, never rely on Date.parse non-NaN. Leap years are
covered for free (2024-02-29 valid, 2025-02-29 rejected).
