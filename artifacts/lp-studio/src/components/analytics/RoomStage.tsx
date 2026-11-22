import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Where a hub is in the partnership, for the team: Rollout (the first 90
 * days) or Expansion (after it). These names are INTERNAL. The customer's hub
 * only ever says "Partnership".
 *
 * A team member moves a hub on. When the rollout has run its length the
 * pop-up asks (`RoomStagePrompt`), and "Extend" puts the question off.
 * Mirrors the server's RoomStageInfo.
 */
export interface HubWave {
  key: string;
  name: string;
  start: string;
  target: string;
}
export interface HubStage {
  stage: "rollout" | "expansion";
  timelineView: "waves" | "practices";
  waves: HubWave[];
  stageSince: string | null;
  extendUntil: string | null;
  day: number | null;
  rolloutDays: number;
  prompt: boolean;
  /** The action plan as the move left it (set only on a save that changed it): the builder keeps its copy the same. */
  plan?: { planGroups: unknown[]; rolloutPlanGroups: unknown[] | null };
}

export const STAGE_LABEL: Record<HubStage["stage"], string> = { rollout: "Rollout", expansion: "Expansion" };

async function send(pageId: number, path: string, method: "PUT" | "POST", body: unknown): Promise<{ stage?: HubStage; error?: string }> {
  try {
    const r = await fetch(`/api/lp/partner-rooms/${pageId}/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { stage?: HubStage; error?: string; planGroups?: unknown[]; rolloutPlanGroups?: unknown[] | null };
    if (!r.ok || !j.stage) return { error: j.error ?? "Could not save" };
    return { stage: Array.isArray(j.planGroups) ? { ...j.stage, plan: { planGroups: j.planGroups, rolloutPlanGroups: j.rolloutPlanGroups ?? null } } : j.stage };
  } catch {
    return { error: "Could not save" };
  }
}

/** The rollout has run its length: ask the team to move the hub on, or to put it off. Shown on every tab of the pop-up. */
export function RoomStagePrompt({ pageId, stage, onSaved }: { pageId: number; stage: HubStage; onSaved: (stage: HubStage) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reviewing, setReviewing] = useState(false);
  if (!stage.prompt) return null;
  const run = async (what: "move" | "extend", decisions?: Record<string, ExpansionChoice>) => {
    setBusy(true);
    setErr("");
    const r = what === "move" ? await send(pageId, "stage", "PUT", { stage: "expansion", timelineView: stage.timelineView, waves: stage.waves, plan: { decisions } }) : await send(pageId, "stage/extend", "POST", { days: 30 });
    setBusy(false);
    if (r.stage) {
      setReviewing(false);
      await onSaved(r.stage);
    } else setErr(r.error ?? "Could not save");
  };
  if (reviewing) return <ExpansionReview pageId={pageId} busy={busy} error={err} onConfirm={(d) => void run("move", d)} onCancel={() => setReviewing(false)} />;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm" data-room-stage-prompt>
      <div className="min-w-0 flex-1">
        <span className="font-semibold">Day {stage.day} of {stage.rolloutDays}.</span> Move this hub to Expansion?
        {err && <span className="ml-2 text-destructive">{err}</span>}
      </div>
      <Button size="sm" variant="brand" disabled={busy} onClick={() => setReviewing(true)} data-room-stage-move>Move to Expansion</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("extend")} data-room-stage-extend>Extend 30 days</Button>
    </div>
  );
}

/** Settings: the stage, the timeline the Overview opens on, and the hub's waves. */
export function RoomStageSection({ pageId, stage, onSaved }: { pageId: number; stage: HubStage; onSaved: (stage: HubStage) => void | Promise<void> }) {
  const [draft, setDraft] = useState({ stage: stage.stage, timelineView: stage.timelineView, waves: stage.waves });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => setDraft({ stage: stage.stage, timelineView: stage.timelineView, waves: stage.waves }), [stage]);
  const changed = JSON.stringify(draft) !== JSON.stringify({ stage: stage.stage, timelineView: stage.timelineView, waves: stage.waves });
  const wave = (i: number, patch: Partial<HubWave>) => setDraft({ ...draft, waves: draft.waves.map((w, k) => (k === i ? { ...w, ...patch } : w)) });

  // Moving on changes the action plan, so the rep looks at what happens to the open steps first.
  const [reviewing, setReviewing] = useState(false);
  const movingOn = stage.stage === "rollout" && draft.stage === "expansion";
  const save = async (decisions?: Record<string, ExpansionChoice>) => {
    if (movingOn && !decisions) return setReviewing(true);
    setBusy(true);
    setErr("");
    setNote("");
    const r = await send(pageId, "stage", "PUT", { ...draft, plan: { decisions } });
    setBusy(false);
    if (r.stage) {
      setReviewing(false);
      setNote("Saved");
      await onSaved(r.stage);
    } else setErr(r.error ?? "Could not save");
  };

  return (
    <section className="space-y-3" data-room-stage-settings>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">Stage</span>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as HubStage["stage"] })} data-room-stage-select>
            <option value="rollout">Rollout</option>
            <option value="expansion">Expansion</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">Timeline the customer sees{draft.stage === "rollout" ? " (after rollout)" : ""}</span>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.timelineView} onChange={(e) => setDraft({ ...draft, timelineView: e.target.value as HubStage["timelineView"] })} disabled={draft.stage === "rollout"}>
            <option value="practices">All practices vs. the goal</option>
            <option value="waves">Wave by wave</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Only your team sees the stage name. The customer’s hub always says “Partnership”.
        {stage.stage === "expansion" && draft.stage === "rollout" && " Moving back brings the launch plan back as it was; changes made to the plan since are not kept."}
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium">Waves</p>
        {/* Column names once, not above every row. */}
        {draft.waves.length > 0 && (
          <div className="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_150px_150px_36px]" aria-hidden>
            <span>Name</span>
            <span title="What this wave is called in the practice list’s wave column, for example 1 or Phase A">Called this in your practice list</span>
            <span>Starts</span>
            <span>Target date</span>
            <span />
          </div>
        )}
        {draft.waves.map((w, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_150px_150px_36px]" data-room-wave-row>
            <Input aria-label="Wave name" value={w.name} onChange={(e) => wave(i, { name: e.target.value })} maxLength={60} />
            <Input aria-label="Wave column value in the practice list" value={w.key} onChange={(e) => wave(i, { key: e.target.value })} maxLength={60} />
            <Input aria-label="Starts" type="date" value={w.start} onChange={(e) => wave(i, { start: e.target.value })} />
            <Input aria-label="Target date" type="date" value={w.target} onChange={(e) => wave(i, { target: e.target.value })} />
            <Button size="sm" variant="ghost" className="text-muted-foreground" aria-label={`Remove ${w.name || "wave"}`} onClick={() => setDraft({ ...draft, waves: draft.waves.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, waves: [...draft.waves, { name: `Wave ${draft.waves.length + 1}`, key: String(draft.waves.length + 1), start: "", target: "" }] })} data-room-wave-add><Plus className="mr-1 h-4 w-4" /> Add a wave</Button>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="brand" disabled={busy || !changed || reviewing} onClick={() => void save()} data-room-stage-save>{movingOn ? "Review and move…" : "Save changes"}</Button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
      {reviewing && <ExpansionReview pageId={pageId} busy={busy} error={err} onConfirm={(d) => void save(d)} onCancel={() => setReviewing(false)} />}
    </section>
  );
}

export type ExpansionChoice = "keep" | "retire";
interface ExpansionPreview {
  open: { key: string; task: string; phase: string; suggested: ExpansionChoice; why: string }[];
  adds: { title: string; steps: number }[];
}

/**
 * Before a hub moves past its rollout: what happens to each step of the
 * launch plan still open (keep it, or retire it from the customer's view),
 * and what the plan gains. Finished steps are not listed: they stay as a
 * record either way.
 */
export function ExpansionReview({ pageId, busy, error, onConfirm, onCancel }: { pageId: number; busy: boolean; error?: string; onConfirm: (decisions: Record<string, ExpansionChoice>) => void; onCancel: () => void }) {
  const [data, setData] = useState<ExpansionPreview | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [choice, setChoice] = useState<Record<string, ExpansionChoice>>({});
  useEffect(() => {
    let off = false;
    void fetch(`/api/lp/partner-rooms/${pageId}/stage/expansion-preview`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Partial<ExpansionPreview> & { error?: string };
        if (off) return;
        if (!r.ok || !Array.isArray(j.open)) return setLoadErr(j.error ?? "Could not load the plan");
        setData({ open: j.open, adds: j.adds ?? [] });
        setChoice(Object.fromEntries(j.open.map((x) => [x.key, x.suggested])));
      })
      .catch(() => !off && setLoadErr("Could not load the plan"));
    return () => {
      off = true;
    };
  }, [pageId]);
  const kept = data ? data.open.filter((x) => choice[x.key] === "keep").length : 0;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm" data-room-expansion-review>
      <div>
        <h4 className="text-base font-semibold">Move this hub to Expansion</h4>
        <p className="mt-1 text-sm text-muted-foreground">The action plan changes from the launch checklist to the plan for the rest of the partnership. Finished steps stay as a record.</p>
      </div>
      {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
      {!data && !loadErr && <p className="text-sm text-muted-foreground">Loading the plan…</p>}
      {data && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {data.open.length ? `Steps still open · ${data.open.length}` : "Every launch step is done."}
              {data.open.length > 0 && <span className="font-normal text-muted-foreground"> · kept ones move to “Still to finish”</span>}
            </p>
            {data.open.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {data.open.map((x) => (
                  <li key={x.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5" data-room-expansion-step={x.key}>
                    <div className="min-w-0">
                      <p className="text-sm">{x.task}</p>
                      <p className="text-xs text-muted-foreground">{x.phase} · {x.why}</p>
                    </div>
                    <div className="flex shrink-0 rounded-md bg-muted p-0.5" role="radiogroup" aria-label={`What happens to ${x.task}`}>
                      {(["keep", "retire"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={choice[x.key] === v}
                          onClick={() => setChoice({ ...choice, [x.key]: v })}
                          className={`rounded px-2.5 py-1 text-xs font-medium ${choice[x.key] === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {v === "keep" ? "Keep" : "Retire"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.open.length > 0 && <p className="text-xs text-muted-foreground">Retired steps are hidden from the customer; your team still sees them under “Not done at rollout”.</p>}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Added to the plan</p>
            <ul className="flex flex-wrap gap-2">
              {kept > 0 && <li className="rounded-md bg-muted px-2.5 py-1 text-xs">Still to finish · {kept} {kept === 1 ? "step" : "steps"}</li>}
              {data.adds.map((a) => (
                <li key={a.title} className="rounded-md bg-muted px-2.5 py-1 text-xs">{a.title} · {a.steps} steps</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">Moving back to Rollout later brings the launch plan back as it was.</p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" disabled={busy || !data} onClick={() => onConfirm(choice)} data-room-expansion-confirm>{busy ? "Moving…" : "Move to Expansion"}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </section>
  );
}
