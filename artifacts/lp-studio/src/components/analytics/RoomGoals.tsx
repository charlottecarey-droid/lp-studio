/**
 * The hub's goals, in the manage pop-up: what success looks like for this
 * customer, where each goal stands today, and whether the customer has agreed.
 * Goals live on the hub page itself (its Goals section shows them), so a save
 * here changes what the customer sees straight away.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type HubGoalMetric = "manual" | "practices_live" | "practices_trained" | "plan_complete";
export type HubGoalStatus = "on-track" | "pending" | "done";
export interface HubGoal {
  key: string;
  title: string;
  detail?: string;
  target?: string;
  targetValue?: number;
  metric: HubGoalMetric;
  current?: string;
  currentValue?: number;
  source?: string;
  status: HubGoalStatus;
  owner?: string;
  hidden?: boolean;
}
export interface HubGoals {
  intro: string;
  askAgreement: boolean;
  moduleHidden: boolean;
  items: HubGoal[];
}

const METRIC_LABEL: Record<HubGoalMetric, string> = {
  manual: "We type the number",
  practices_live: "Counted: practices live",
  practices_trained: "Counted: practices trained",
  plan_complete: "Counted: action plan items done",
};
const STATUS_LABEL: Record<HubGoalStatus, string> = { "on-track": "On track", pending: "Needs attention", done: "Achieved" };
const STATUS_TONE: Record<HubGoalStatus, string> = { "on-track": "text-blue-700", pending: "text-amber-700", done: "text-emerald-700" };

/** How a goal's value today reads in the list. Counted goals come from the hub's own practice list. */
export function goalTodayText(goal: HubGoal, byStage: Record<string, number> | undefined): string {
  if (goal.metric === "practices_live") return byStage ? String(byStage.live ?? 0) : "Counted in the hub";
  if (goal.metric === "practices_trained") return byStage ? String((byStage.trained ?? 0) + (byStage.live ?? 0)) : "Counted in the hub";
  if (goal.metric === "plan_complete") return "Counted in the hub";
  return goal.current || (typeof goal.currentValue === "number" ? String(goal.currentValue) : "");
}

const numberOrBlank = (text: string): number | undefined => (text.trim() === "" || !Number.isFinite(Number(text)) ? undefined : Number(text));

export function RoomGoalsSection({
  pageId,
  goals,
  byStage,
  agreement,
  onSaved,
}: {
  pageId: number;
  goals: HubGoals;
  /** Practices by rollout stage, for the counted goals. */
  byStage?: Record<string, number>;
  /** The customer's answer to "Do these goals look right?". */
  agreement?: { done: boolean; by: string | null; at: string | null } | null;
  /** Called with what was saved (the builder keeps its own copy of the page in step). */
  onSaved: (goals: HubGoals) => void | Promise<void>;
}) {
  const [state, setState] = useState<HubGoals>(goals);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setState(goals);
  }, [goals]);

  const save = async (next: HubGoals): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/goals`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const j = (await r.json().catch(() => ({}))) as { goals?: HubGoals; error?: string };
      if (!r.ok || !j.goals) {
        setError(j.error ?? "Could not save the goals");
        return false;
      }
      setState(j.goals);
      await onSaved(j.goals);
      return true;
    } catch {
      setError("Could not save the goals");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const items = state.items;
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    void save({ ...state, items: next });
  };
  const [draft, setDraft] = useState<HubGoal | null>(null);
  const addGoal = () => {
    const key = `goal-${Date.now().toString(36)}`;
    setDraft({ key, title: "", metric: "manual", status: "on-track" });
    setEditing(key);
  };
  const closeEditor = () => {
    setEditing(null);
    setDraft(null);
  };

  return (
    <section className="space-y-4" data-room-goals>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Goals</h4>
        <p className="text-sm text-muted-foreground">What success looks like for this customer. They see these in the hub’s Goals section, and any goal with a number also shows on the Scorecard.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {state.moduleHidden && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>The Goals section is switched off in this hub, so the customer can’t see these yet.</span>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => save({ ...state, moduleHidden: false })} data-room-goals-show>Show it in the hub</Button>
        </div>
      )}

      {state.askAgreement && items.length > 0 && (
        <div className="text-sm" data-room-goals-agreed={agreement?.done ? "yes" : "no"}>
          {agreement?.done ? (
            <>
              <Badge variant="secondary">Agreed</Badge>{" "}
              <span className="text-muted-foreground">{[agreement.by, agreement.at ? new Date(agreement.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            <>
              <Badge variant="outline">Not agreed yet</Badge> <span className="text-muted-foreground">The customer is asked to agree in the hub.</span>
            </>
          )}
        </div>
      )}

      {items.length === 0 && !draft && <p className="text-sm text-muted-foreground">No goals yet. Add the first one below.</p>}

      {(items.length > 0 || draft) && (
        <div className="divide-y rounded-md border">
          {items.map((g, i) => (
            <div key={g.key} data-room-goal={g.key}>
              <div className={`flex items-center gap-3 px-3 py-2.5 ${g.hidden ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {g.title}
                    {g.hidden && <span className="ml-2 text-xs font-normal text-muted-foreground">Hidden from the customer</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[g.target ? `Target: ${g.target}` : "", goalTodayText(g, byStage) ? `Today: ${goalTodayText(g, byStage)}` : "", g.owner ? `Owner: ${g.owner}` : ""].filter(Boolean).join(" · ") || "No target set"}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${STATUS_TONE[g.status]}`}>{STATUS_LABEL[g.status]}</span>
                <span className="flex shrink-0 items-center">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${g.title} up`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${g.title} down`}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => (editing === g.key ? closeEditor() : (setDraft(null), setEditing(g.key)))} aria-label={`Edit ${g.title}`} data-room-goal-edit={g.key}><Pencil className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
              {editing === g.key && (
                <GoalEditor
                  goal={g}
                  busy={busy}
                  byStage={byStage}
                  onCancel={closeEditor}
                  onSave={async (next) => {
                    if (await save({ ...state, items: items.map((x) => (x.key === g.key ? next : x)) })) closeEditor();
                  }}
                  onRemove={async () => {
                    if (await save({ ...state, items: items.filter((x) => x.key !== g.key) })) closeEditor();
                  }}
                />
              )}
            </div>
          ))}
          {draft && editing === draft.key && (
            <GoalEditor
              goal={draft}
              busy={busy}
              byStage={byStage}
              isNew
              onCancel={closeEditor}
              onSave={async (next) => {
                if (await save({ ...state, items: [...items, next] })) closeEditor();
              }}
            />
          )}
        </div>
      )}

      {!draft && (
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addGoal} disabled={busy || items.length >= 20} data-room-goal-add>
          <Plus className="h-3.5 w-3.5" /> Add goal
        </Button>
      )}

      <div className="space-y-3 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.askAgreement} disabled={busy} onChange={(e) => save({ ...state, askAgreement: e.target.checked })} />
          Ask the customer to agree to these goals
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!state.moduleHidden} disabled={busy} onChange={(e) => save({ ...state, moduleHidden: !e.target.checked })} />
          Show the Goals section in the hub
        </label>
      </div>
    </section>
  );
}

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function GoalEditor({ goal, busy, byStage, isNew = false, onSave, onCancel, onRemove }: { goal: HubGoal; busy: boolean; byStage?: Record<string, number>; isNew?: boolean; onSave: (goal: HubGoal) => void; onCancel: () => void; onRemove?: () => void }) {
  const [g, setG] = useState<HubGoal>(goal);
  const [targetValue, setTargetValue] = useState(goal.targetValue === undefined ? "" : String(goal.targetValue));
  const [currentValue, setCurrentValue] = useState(goal.currentValue === undefined ? "" : String(goal.currentValue));
  const set = (patch: Partial<HubGoal>) => setG((prev) => ({ ...prev, ...patch }));
  const manual = g.metric === "manual";
  const field = "block space-y-1 text-xs font-medium text-muted-foreground";
  return (
    <div className="space-y-3 border-t bg-muted/30 px-3 py-3" data-room-goal-editor={goal.key}>
      <label className={field}>
        Goal
        <Input autoFocus={isNew} value={g.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} className="h-9 text-sm text-foreground" />
      </label>
      <label className={field}>
        Detail (optional)
        <Input value={g.detail ?? ""} onChange={(e) => set({ detail: e.target.value })} maxLength={300} className="h-9 text-sm text-foreground" />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className={field}>
          Target, as it reads
          <Input value={g.target ?? ""} onChange={(e) => set({ target: e.target.value })} maxLength={80} className="h-9 text-sm text-foreground" />
        </label>
        <label className={field}>
          Target as a number
          <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="h-9 text-sm text-foreground" />
        </label>
      </div>
      <label className={field}>
        Where today’s number comes from
        <select className={`${selectClass} text-foreground`} value={g.metric} onChange={(e) => set({ metric: e.target.value as HubGoalMetric })}>
          {(Object.keys(METRIC_LABEL) as HubGoalMetric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
        </select>
      </label>
      {manual ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className={field}>
            Today, as it reads
            <Input value={g.current ?? ""} onChange={(e) => set({ current: e.target.value })} maxLength={80} className="h-9 text-sm text-foreground" />
          </label>
          <label className={field}>
            Today as a number
            <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="h-9 text-sm text-foreground" />
          </label>
          <label className={`${field} sm:col-span-2`}>
            Where the number came from, and when
            <Input value={g.source ?? ""} onChange={(e) => set({ source: e.target.value })} maxLength={160} className="h-9 text-sm text-foreground" />
          </label>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This number updates by itself from the hub{g.metric === "plan_complete" ? "’s action plan" : "’s practice list"}
          {g.metric !== "plan_complete" && byStage ? ` (today: ${goalTodayText(g, byStage)})` : ""}.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>
          Status
          <select className={`${selectClass} text-foreground`} value={g.status} onChange={(e) => set({ status: e.target.value as HubGoalStatus })}>
            {(Object.keys(STATUS_LABEL) as HubGoalStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className={field}>
          Owner
          <Input value={g.owner ?? ""} onChange={(e) => set({ owner: e.target.value })} maxLength={120} className="h-9 text-sm text-foreground" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!g.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
        Hide this goal from the customer
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="brand" className="h-8" disabled={busy || !g.title.trim()} onClick={() => onSave({ ...g, title: g.title.trim(), targetValue: numberOrBlank(targetValue), currentValue: numberOrBlank(currentValue) })} data-room-goal-save>
          {isNew ? "Add goal" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onCancel}>Cancel</Button>
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 gap-1 text-destructive hover:text-destructive" disabled={busy} onClick={onRemove} data-room-goal-remove>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
