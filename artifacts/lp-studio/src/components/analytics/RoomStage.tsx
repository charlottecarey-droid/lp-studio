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
}

export const STAGE_LABEL: Record<HubStage["stage"], string> = { rollout: "Rollout", expansion: "Expansion" };

async function send(pageId: number, path: string, method: "PUT" | "POST", body: unknown): Promise<{ stage?: HubStage; error?: string }> {
  try {
    const r = await fetch(`/api/lp/partner-rooms/${pageId}/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { stage?: HubStage; error?: string };
    return r.ok && j.stage ? { stage: j.stage } : { error: j.error ?? "Could not save" };
  } catch {
    return { error: "Could not save" };
  }
}

/** The rollout has run its length: ask the team to move the hub on, or to put it off. Shown on every tab of the pop-up. */
export function RoomStagePrompt({ pageId, stage, onSaved }: { pageId: number; stage: HubStage; onSaved: (stage: HubStage) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!stage.prompt) return null;
  const run = async (what: "move" | "extend") => {
    setBusy(true);
    setErr("");
    const r = what === "move" ? await send(pageId, "stage", "PUT", { stage: "expansion", timelineView: stage.timelineView, waves: stage.waves }) : await send(pageId, "stage/extend", "POST", { days: 30 });
    setBusy(false);
    if (r.stage) await onSaved(r.stage);
    else setErr(r.error ?? "Could not save");
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm" data-room-stage-prompt>
      <div className="min-w-0 flex-1">
        <span className="font-semibold">Day {stage.day} of {stage.rolloutDays}.</span> Move this hub to Expansion?
        {err && <span className="ml-2 text-destructive">{err}</span>}
      </div>
      <Button size="sm" variant="brand" disabled={busy} onClick={() => void run("move")} data-room-stage-move>Move to Expansion</Button>
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

  const save = async () => {
    setBusy(true);
    setErr("");
    setNote("");
    const r = await send(pageId, "stage", "PUT", draft);
    setBusy(false);
    if (r.stage) {
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
      <p className="text-xs text-muted-foreground">Only your team sees the stage name. The customer’s hub always says “Partnership”.</p>
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
        <Button size="sm" variant="brand" disabled={busy || !changed} onClick={() => void save()} data-room-stage-save>Save changes</Button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </section>
  );
}
