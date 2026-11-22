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
  manual: "I’ll type it in",
  practices_live: "Count the practices that are live",
  practices_trained: "Count the practices trained",
  plan_complete: "Count the action plan items done",
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

/**
 * The number a line of text STARTS with: "25 practices" → 25, "60%" → 60,
 * "$1,200 a month" → 1200. Only a leading number counts, so "All milestones
 * by Day 90" is not read as 90. The editor asks for a target and a value today
 * ONCE, as the customer will read it; the Scorecard's number is read from that.
 */
export function numberInText(text: string): number | undefined {
  const m = text.match(/^\s*[~≈≥>$£€]*\s*(-?\d[\d,]*(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** What one text box shows for a stored (text, number) pair. */
const asText = (text: string | undefined, value: number | undefined) => text || (value === undefined ? "" : String(value));
/** Back to the stored pair. An untouched box keeps what was stored, so opening and saving a goal never changes its numbers. */
const fromText = (typed: string, text: string | undefined, value: number | undefined): { text?: string; value?: number } =>
  typed === asText(text, value) ? { text, value } : { text: typed.trim() || undefined, value: numberInText(typed) };

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
        <p className="text-sm text-muted-foreground">The customer sees these in the hub. Goals with a number also show on the Scorecard.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {state.moduleHidden && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>The customer can’t see these yet: Goals is switched off in this hub.</span>
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

      {items.length === 0 && !draft && <p className="text-sm text-muted-foreground">No goals yet.</p>}

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

      <div className="space-y-2 border-t pt-3">
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
  const [target, setTarget] = useState(asText(goal.target, goal.targetValue));
  const [today, setToday] = useState(asText(goal.current, goal.currentValue));
  const set = (patch: Partial<HubGoal>) => setG((prev) => ({ ...prev, ...patch }));
  const manual = g.metric === "manual";
  const field = "block space-y-1 text-xs font-medium text-muted-foreground";
  const input = "h-9 text-sm text-foreground";
  // Read live, so the line under the fields always says what the Scorecard will use.
  const t = fromText(target, goal.target, goal.targetValue);
  const c = fromText(today, goal.current, goal.currentValue);
  const targetNumber = t.value;
  const todayNumber = c.value;
  const submit = () => {
    onSave({ ...g, title: g.title.trim(), target: t.text, targetValue: t.value, current: c.text, currentValue: c.value });
  };
  return (
    <div className="space-y-3 border-t bg-muted/30 px-3 py-3" data-room-goal-editor={goal.key}>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className={field}>
          Goal
          <Input autoFocus={isNew} value={g.title} onChange={(e) => set({ title: e.target.value })} maxLength={160} className={input} placeholder="e.g. Practices live and sending cases" />
        </label>
        <label className={field}>
          Owner
          <Input value={g.owner ?? ""} onChange={(e) => set({ owner: e.target.value })} maxLength={120} className={input} placeholder="e.g. Operations" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>
          Target
          <Input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={80} className={input} placeholder="e.g. 25 practices, or 60%" data-room-goal-target />
        </label>
        <label className={field}>
          Status
          <select className={`${selectClass} text-foreground`} value={g.status} onChange={(e) => set({ status: e.target.value as HubGoalStatus })}>
            {(Object.keys(STATUS_LABEL) as HubGoalStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className={field}>
          Where we are today
          <select className={`${selectClass} text-foreground`} value={g.metric} onChange={(e) => set({ metric: e.target.value as HubGoalMetric })}>
            {(Object.keys(METRIC_LABEL) as HubGoalMetric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
          </select>
        </label>
        {manual ? (
          <label className={field}>
            Today
            <Input value={today} onChange={(e) => setToday(e.target.value)} maxLength={80} className={input} placeholder="e.g. 9 practices, or 42%" data-room-goal-today />
          </label>
        ) : (
          <p className="self-end pb-2 text-xs text-muted-foreground">
            Updates by itself from the hub{g.metric === "plan_complete" ? "’s action plan" : "’s practice list"}
            {g.metric !== "plan_complete" && byStage ? ` (today: ${goalTodayText(g, byStage)})` : ""}.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-room-goal-number-hint>
        {targetNumber === undefined
          ? "Start the target with a number (like 25 or 60%) to show progress on the Scorecard."
          : `The Scorecard tracks progress to ${targetNumber}${manual && todayNumber !== undefined ? `, from ${todayNumber} today` : ""}.`}
      </p>
      <details className="text-xs" open={!!(goal.detail || goal.source || goal.hidden) || undefined}>
        <summary className="cursor-pointer font-medium text-muted-foreground">More: detail, source, hide</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {manual && (
            <label className={`${field} sm:col-span-2`}>
              Where today’s number came from
              <Input value={g.source ?? ""} onChange={(e) => set({ source: e.target.value })} maxLength={160} className={input} placeholder="e.g. Salesforce, Nov 20" />
            </label>
          )}
          <label className={`${field} sm:col-span-2`}>
            Detail
            <Input value={g.detail ?? ""} onChange={(e) => set({ detail: e.target.value })} maxLength={300} className={input} placeholder="A line of context under the goal" />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" checked={!!g.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
            Hide this goal from the customer
          </label>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="brand" className="h-8" disabled={busy || !g.title.trim()} onClick={submit} data-room-goal-save>
          {isNew ? "Add goal" : "Save changes"}
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
