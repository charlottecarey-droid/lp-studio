---
name: GenerationStageId dual union + data-driven stage rail
description: How the live-generation stage rail is wired across backend/frontend, and when to reuse an existing stage vs add a new id.
---

`GenerationStageId` is a CLOSED string-literal union DUPLICATED in two places that must stay in sync: backend `artifacts/api-server/src/lib/generationEmitter.ts` and frontend `artifacts/lp-studio/src/lib/generationStream.ts`. The emitter's `stage(id, status, label)` is stateless — it just writes the SSE event, so re-emitting the same id's "start" is safe and only updates the label client-side.

The stage rail (`components/generation/GenerationStageRail.tsx`) is purely presentational and DATA-DRIVEN: the caller passes `stageDefs` (order = display) + a `stageState` Record + `stageLabels`. The microsite caller is `components/sales/MicrositeGenerationLive.tsx` (its stageDefs = DEFAULT_STAGE_DEFS from liveBlocks; the marketing path is GenerationLiveView). An unknown stage id arriving over SSE is stored harmlessly in stageState but won't render unless it's in that caller's stageDefs.

**Rule:** Adding a NEW stage id is a cross-cutting change — backend union + frontend union + `liveBlocks` initialStageState + the relevant caller's stageDefs ALL need it, or the rail shows it stuck pending (and you get type errors).

**Why:** for a one-off "wait" step (e.g. inline account research in generate-microsite that runs BEFORE the first real stage), full new-stage wiring is disproportionate, and a stage that only fires on some paths sits forever-pending on the others (briefing-exists path skips research).

**How to apply:** to surface a pre-first-stage wait, reuse the EXISTING first stage ("context"): emit only `stage("context","start","<wait label>")`, do the work, then let the regular context stage below re-emit its own "start" (label update) and own the matching "done". Do NOT emit a premature "done". Only add a real new stage id when the rail genuinely needs a distinct persistent step on that path.
