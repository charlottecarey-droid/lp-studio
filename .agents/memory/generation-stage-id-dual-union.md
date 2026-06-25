---
name: GenerationStageId dual union + data-driven stage rail
description: How the live-generation stage rail is wired across backend/frontend, and how to add a step that only some callers/paths show.
---

`GenerationStageId` is a CLOSED string-literal union DUPLICATED in two places that must stay in sync: backend `artifacts/api-server/src/lib/generationEmitter.ts` and frontend `artifacts/lp-studio/src/lib/generationStream.ts`. The emitter's `stage(id, status, label)` is stateless — it just writes the SSE event, so re-emitting an id's "start" is safe and only updates the label client-side.

The stage rail (`components/generation/GenerationStageRail.tsx`) is purely presentational and DATA-DRIVEN: the caller passes `stageDefs` (order = display) + a TOTAL `stageState` Record (every id, from `liveBlocks` `initialStageState`) + `stageLabels`. An unknown id arriving over SSE is stored harmlessly in stageState but won't render unless it's in that caller's stageDefs. There are TWO callers with DIFFERENT rails: the marketing path `GenerationLiveView` (uses the shared `DEFAULT_STAGE_DEFS`) and the sales microsite `components/sales/MicrositeGenerationLive.tsx` (its own `MICROSITE_STAGE_DEFS`).

**Rule:** Adding a NEW stage id touches: backend union + frontend union + `liveBlocks` `initialStageState` (keep it total) + the relevant caller's stageDefs. Miss the union → type error; miss initialStageState → out-of-order event indexes a missing key; miss the caller's stageDefs → it never renders.

**Caller-scoping a per-path step (the key gotcha):** a step that only some paths run (e.g. the microsite's inline account research) must go in ONLY that caller's stageDefs (`MICROSITE_STAGE_DEFS`), NEVER the shared `DEFAULT_STAGE_DEFS` — the marketing rail reuses that array and would show a step that never fires (forever-pending). And on the path within that caller where the work is SKIPPED (e.g. a brief already exists), still emit `start`+`done` quickly so the rail never has a step with no work behind it.

**Why "reuse context" was wrong here:** an earlier note said to surface a pre-first-stage wait by reusing `stage("context","start",...)` instead of adding an id. That hid the real bug: in `generate-microsite.ts` the SSE emitter was being created AFTER the 30-90s research block, so the emit hit the NOOP emitter and the rail sat all-pending/blank regardless of which id was used. The durable fix is structural, not cosmetic: **open the SSE emitter BEFORE the slow work** (after the plain-JSON 404/400/503 validations, which must precede SSE headers), then wrap the work in a dedicated, caller-scoped stage. A distinct multi-second wait deserves its own honest step, not a borrowed label.

**How to apply:** order the route as — plain-JSON validations → open emitter → `stage("<step>","start",…)` → work (fail-open) → abort check → `stage("<step>","done",<honest label>)` → next stage. Add the id to both unions + initialStageState + the one caller's stageDefs.
