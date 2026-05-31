---
name: Scheduled trigger timezone math
description: How per-trigger timezone resolution works for scheduled email-workflow sends, and the fail-closed/back-compat rules.
---
Scheduled email-workflow triggers (workflowTypes.ts ScheduledTriggerConfig) carry an optional IANA `timezone`. `dueOccurrenceId` (workflowSchedule.ts) resolves the calendar day/weekday/day-of-month AND the fire instant in that zone via Intl.DateTimeFormat; DST handled by reading the zone offset at the candidate instant and refining once across a transition. The occurrence id is the LOCAL calendar date, so dedupe stays stable per local period.

**Why:** UTC-only schedules fired "9:00 daily" at 9:00 UTC, confusing for non-UTC admins. Resolving in-zone makes it fire at 9:00 local even across DST.

**How to apply:**
- Missing/empty timezone → "UTC" (back-compat: legacy rows behave exactly as before; for UTC the math reduces to plain Date.UTC and occurrence ids are byte-identical to the pre-timezone version).
- Present-but-invalid zone → parseScheduledConfig returns null (fail closed, same as the other schedule sanitizers / impossible-date rule). Validate via `new Intl.DateTimeFormat("en-US",{timeZone})` in a try/catch.
- parseScheduledConfig now ALWAYS emits `timezone` — any `.toEqual` test on its output must include it.
- Producer (workflowProducers.ts) needs no timezone-specific code; the parsed config flows straight into dueOccurrenceId.
