import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Download, EyeOff, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnsavedSettings } from "./RoomAccountSettings";

/**
 * The hub's mutual action plan (MAP), in the hub's Settings: the phases and
 * steps the customer sees on the Action plan tab, edited here, and a way to
 * bring one in from a spreadsheet (the template shows the columns; "Download
 * this plan" gives the current plan in the same format to edit and upload).
 *
 * An upload never saves on its own: it fills this editor (replacing the plan,
 * or adding to it) for the rep to look over, and Save writes it. A step that
 * keeps its name keeps its key, so the customer's ticks and uploads stay.
 */

export type PlanStatus = "done" | "on-track" | "pending" | "blocking" | "not-started";
export interface PlanRow {
  key?: string;
  task: string;
  target?: string;
  ourOwner?: string;
  partnerOwner?: string;
  status?: PlanStatus;
  customerAction?: "check" | "upload";
  uploadLabel?: string;
  note?: string;
  hidden?: boolean;
  retired?: boolean;
}
export interface PlanGroup {
  title: string;
  checkpoint?: string;
  hidden?: boolean;
  rows: PlanRow[];
}
export interface HubPlan {
  groups: PlanGroup[];
  expansion: boolean;
}

const STATUS: { value: PlanStatus; label: string }[] = [
  { value: "not-started", label: "Not started" },
  { value: "on-track", label: "On track" },
  { value: "pending", label: "Pending" },
  { value: "blocking", label: "Overdue" },
  { value: "done", label: "Done" },
];
const ACTION: { value: "" | "check" | "upload"; label: string }[] = [
  { value: "", label: "View only" },
  { value: "check", label: "Mark complete" },
  { value: "upload", label: "Upload a file" },
];

const selectCls = "h-8 rounded-md border bg-background px-2 text-xs";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function download(pageId: number, current: boolean): Promise<string | null> {
  const r = await fetch(`/api/lp/partner-rooms/${pageId}/plan/template${current ? "?current=1" : ""}`);
  const j = (await r.json().catch(() => ({}))) as { fileName?: string; csv?: string; error?: string };
  if (!r.ok || !j.csv) return j.error ?? "Couldn't make the spreadsheet.";
  const url = URL.createObjectURL(new Blob([j.csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = j.fileName ?? "action-plan.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const GUIDE: { column: string; accepts: string; required?: boolean }[] = [
  { column: "Phase", accepts: "The phase the step belongs to. Leave blank to continue the phase above." },
  { column: "Checkpoint", accepts: "What done looks like for the phase (one per phase is enough)." },
  { column: "Step", required: true, accepts: "The step itself. Rows without one are skipped." },
  { column: "Target date", accepts: "A date (2026-12-15 or 12/15/2026) or words (Week 2, By kickoff)." },
  { column: "Our owner", accepts: "Who on your team owns it." },
  { column: "Customer owner", accepts: "Who on the customer's side owns it." },
  { column: "Status", accepts: "Not started, On track, Pending, Overdue or Done. Blank = Not started." },
  { column: "Customer can", accepts: "View only, Mark complete or Upload a file. Blank = View only." },
  { column: "Note", accepts: "Anything else the customer should know." },
];

export function RoomPlanSection({
  pageId,
  plan,
  people,
  onSaved,
}: {
  pageId: number;
  plan: HubPlan;
  /** Names on the hub's Team, offered as owners: ours, then the customer's. */
  people?: { ours: string[]; theirs: string[] };
  /** Called with what was saved (an open builder keeps its copy of the page in step). */
  onSaved: (groups: PlanGroup[]) => void | Promise<void>;
}) {
  const [groups, setGroups] = useState<PlanGroup[]>(plan.groups);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [imported, setImported] = useState<{ file: string; steps: number; phases: number; mode: "replace" | "add"; warnings: string[] } | null>(null);
  const [pickMode, setPickMode] = useState<"replace" | "add" | null>(null);
  const [guide, setGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(plan.groups.length <= 2 ? plan.groups.map((_, i) => i) : [0]));
  // Ticked steps ("phase:step"), to delete several at once. The deletion is part of the draft: Save writes it, Discard undoes it.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const pickKey = (gi: number, ri: number) => `${gi}:${ri}`;
  const togglePick = (ids: string[], on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  const deletePicked = () => {
    setGroups((gs) => gs.map((g, gi) => ({ ...g, rows: g.rows.filter((_, ri) => !picked.has(pickKey(gi, ri))) })));
    setPicked(new Set());
  };

  useEffect(() => {
    setGroups(plan.groups);
    setImported(null);
    setPicked(new Set());
  }, [plan.groups]);

  const changed = !same(groups, plan.groups);
  const report = useContext(UnsavedSettings);
  useEffect(() => {
    report?.("plan", changed);
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed, report]);

  const steps = useMemo(() => groups.reduce((n, g) => n + g.rows.length, 0), [groups]);
  const setGroup = (gi: number, patch: Partial<PlanGroup>) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setRow = (gi: number, ri: number, patch: Partial<PlanRow>) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, rows: g.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : g)));
  const move = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/plan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups }) });
      const j = (await r.json().catch(() => ({}))) as { plan?: HubPlan; error?: string };
      if (!r.ok || !j.plan) {
        setError(j.error ?? "Couldn't save the plan.");
        return;
      }
      setImported(null);
      setNote("Saved. The Action plan tab shows it now.");
      await onSaved(j.plan.groups);
    } catch {
      setError("Couldn't save the plan.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File, mode: "replace" | "add") => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/plan/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileBase64: await toBase64(file), mode }),
      });
      const j = (await r.json().catch(() => ({}))) as { groups?: PlanGroup[]; steps?: number; phases?: number; warnings?: string[]; error?: string };
      if (!r.ok || !j.groups) {
        setError(j.error ?? "Couldn't read that file.");
        return;
      }
      setGroups(j.groups);
      setOpen(new Set(j.groups.map((_, i) => i)));
      setImported({ file: file.name, steps: j.steps ?? 0, phases: j.phases ?? 0, mode, warnings: j.warnings ?? [] });
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy(false);
      setPickMode(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="space-y-4" data-room-plan>
      <p className="text-xs text-muted-foreground">
        {plan.expansion
          ? "The steps the customer sees on the Action plan tab now (the hub is in expansion; its rollout plan is kept as it was)."
          : "The steps the customer sees on the Action plan tab, with an owner on each side."}{" "}
        {steps} {steps === 1 ? "step" : "steps"} in {groups.length} {groups.length === 1 ? "phase" : "phases"}.
      </p>

      {/* Bring one in from a spreadsheet */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-room-plan-import>
        <div className="flex items-start gap-2">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Use your own MAP</p>
            <p className="text-xs text-muted-foreground">Fill in the template (or download this plan and edit it), then upload it as .csv or .xlsx. You look it over here before anything is saved.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-room-plan-template onClick={async () => setError((await download(pageId, false)) ?? "")}>
            <Download className="h-3.5 w-3.5" /> Download template
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={plan.groups.length === 0} data-room-plan-export onClick={async () => setError((await download(pageId, true)) ?? "")}>
            <Download className="h-3.5 w-3.5" /> Download this plan
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => setPickMode(pickMode ? null : groups.length ? "replace" : "replace")} aria-expanded={!!pickMode} data-room-plan-upload>
            <Upload className="h-3.5 w-3.5" /> Upload your MAP
          </Button>
        </div>
        {pickMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-2 text-xs" data-room-plan-mode>
            <span className="font-medium">The file’s steps should</span>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="plan-mode" checked={pickMode === "replace"} onChange={() => setPickMode("replace")} /> replace this plan
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="plan-mode" checked={pickMode === "add"} onChange={() => setPickMode("add")} disabled={groups.length === 0} /> be added to it
            </label>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={busy} data-room-plan-choose>
              {busy ? "Reading…" : "Choose file"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              data-room-plan-file
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f, pickMode);
              }}
            />
          </div>
        )}
        <button type="button" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setGuide((g) => !g)} aria-expanded={guide} data-room-plan-guide-toggle>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${guide ? "rotate-180" : ""}`} /> What goes in each column
        </button>
        {guide && (
          <table className="w-full text-left text-xs" data-room-plan-guide>
            <tbody>
              {GUIDE.map((c) => (
                <tr key={c.column} className="border-t align-top">
                  <td className="w-32 py-1.5 pr-3 font-medium">{c.column}{c.required && <span className="text-destructive"> *</span>}</td>
                  <td className="py-1.5 text-muted-foreground">{c.accepts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {imported && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status" data-room-plan-imported>
          <p className="font-medium">
            From {imported.file}: {imported.steps} {imported.steps === 1 ? "step" : "steps"} in {imported.phases} {imported.phases === 1 ? "phase" : "phases"}, {imported.mode === "replace" ? "replacing the plan" : "added to the plan"}. Look it over below, then Save.
          </p>
          {imported.warnings.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4" data-room-plan-warnings>
              {imported.warnings.slice(0, 12).map((w) => <li key={w}>{w}</li>)}
              {imported.warnings.length > 12 && <li>…and {imported.warnings.length - 12} more.</li>}
            </ul>
          )}
        </div>
      )}

      {picked.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 text-xs backdrop-blur" data-room-plan-picked>
          <b>{picked.size} {picked.size === 1 ? "step" : "steps"} selected</b>
          <span className="flex-1" />
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={deletePicked} data-room-plan-delete-picked>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}

      {/* The plan itself */}
      <div className="space-y-2" data-room-plan-editor>
        <datalist id="room-plan-ours">{(people?.ours ?? []).map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="room-plan-theirs">{(people?.theirs ?? []).map((n) => <option key={n} value={n} />)}</datalist>
        {groups.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">No steps yet. Add a phase, or upload your MAP.</p>}
        {groups.map((g, gi) => {
          const isOpen = open.has(gi);
          return (
            <div key={gi} className="rounded-lg border" data-room-plan-phase={g.title}>
              <div className="flex items-center gap-2 p-2">
                {g.rows.length > 0 && (() => {
                  const ids = g.rows.map((_, ri) => pickKey(gi, ri));
                  const all = ids.every((id) => picked.has(id));
                  const some = ids.some((id) => picked.has(id));
                  return (
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-foreground"
                      checked={all}
                      ref={(el) => {
                        if (el) el.indeterminate = some && !all;
                      }}
                      onChange={(e) => togglePick(ids, e.target.checked)}
                      aria-label={`Select every step in ${g.title}`}
                      data-room-plan-pick-phase
                    />
                  );
                })()}
                <button type="button" onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(gi)) n.delete(gi); else n.add(gi); return n; })} aria-expanded={isOpen} aria-label={isOpen ? `Collapse ${g.title}` : `Expand ${g.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                </button>
                <Input value={g.title} onChange={(e) => setGroup(gi, { title: e.target.value })} className="h-8 flex-1 text-sm font-semibold" placeholder="Phase (Days 1–30 · Foundation)" aria-label="Phase name" />
                <span className="shrink-0 text-xs text-muted-foreground">{g.rows.length} {g.rows.length === 1 ? "step" : "steps"}</span>
                <Button type="button" variant="ghost" size="sm" className={`h-8 w-8 p-0 ${g.hidden ? "text-amber-700" : "text-muted-foreground"}`} title={g.hidden ? "Hidden from the customer (show)" : "Hide from the customer"} aria-pressed={!!g.hidden} onClick={() => setGroup(gi, { hidden: !g.hidden })}><EyeOff className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={gi === 0} aria-label="Move phase up" onClick={() => { setPicked(new Set()); setGroups((gs) => move(gs, gi, -1)); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={gi === groups.length - 1} aria-label="Move phase down" onClick={() => { setPicked(new Set()); setGroups((gs) => move(gs, gi, 1)); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label={`Remove the phase ${g.title}`} onClick={() => { if (g.rows.length === 0 || window.confirm(`Remove “${g.title}” and its ${g.rows.length} steps?`)) { setPicked(new Set()); setGroups((gs) => gs.filter((_, i) => i !== gi)); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              {isOpen && (
                <div className="space-y-2 border-t p-2">
                  <Input value={g.checkpoint ?? ""} onChange={(e) => setGroup(gi, { checkpoint: e.target.value })} className="h-8 text-xs" placeholder="Checkpoint: what done looks like for this phase (optional)" aria-label="Checkpoint" />
                  {g.rows.map((r, ri) => (
                    <div key={ri} className={`space-y-1.5 rounded-md border p-2 ${r.hidden ? "bg-muted/40" : ""}`} data-room-plan-step={r.task}>
                      <div className="flex items-center gap-1.5">
                        <input type="checkbox" className="h-4 w-4 shrink-0 accent-foreground" checked={picked.has(pickKey(gi, ri))} onChange={(e) => togglePick([pickKey(gi, ri)], e.target.checked)} aria-label={`Select ${r.task || "this step"}`} data-room-plan-pick-step />
                        <Input value={r.task} onChange={(e) => setRow(gi, ri, { task: e.target.value })} className="h-8 flex-1 text-xs font-medium" placeholder="Step" aria-label="Step" />
                        <Button type="button" variant="ghost" size="sm" className={`h-8 w-8 p-0 ${r.hidden ? "text-amber-700" : "text-muted-foreground"}`} title={r.hidden ? "Hidden from the customer (show)" : "Hide from the customer"} aria-pressed={!!r.hidden} onClick={() => setRow(gi, ri, { hidden: !r.hidden })}><EyeOff className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={ri === 0} aria-label="Move step up" onClick={() => { setPicked(new Set()); setGroup(gi, { rows: move(g.rows, ri, -1) }); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={ri === g.rows.length - 1} aria-label="Move step down" onClick={() => { setPicked(new Set()); setGroup(gi, { rows: move(g.rows, ri, 1) }); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label={`Remove the step ${r.task}`} onClick={() => { setPicked(new Set()); setGroup(gi, { rows: g.rows.filter((_, j) => j !== ri) }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        <Input value={r.target ?? ""} onChange={(e) => setRow(gi, ri, { target: e.target.value })} className="h-8 text-xs" placeholder="Target (2026-12-15 or Week 2)" aria-label="Target date" />
                        <Input value={r.ourOwner ?? ""} onChange={(e) => setRow(gi, ri, { ourOwner: e.target.value })} className="h-8 text-xs" placeholder="Our owner" aria-label="Our owner" list="room-plan-ours" />
                        <Input value={r.partnerOwner ?? ""} onChange={(e) => setRow(gi, ri, { partnerOwner: e.target.value })} className="h-8 text-xs" placeholder="Customer owner" aria-label="Customer owner" list="room-plan-theirs" />
                      </div>
                      <div className={`grid grid-cols-1 gap-1.5 ${r.customerAction === "upload" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                        <select className={selectCls} value={r.status ?? "not-started"} onChange={(e) => setRow(gi, ri, { status: e.target.value as PlanStatus })} aria-label="Status">
                          {STATUS.map((s) => <option key={s.value} value={s.value}>Status: {s.label}</option>)}
                        </select>
                        <select className={selectCls} value={r.customerAction ?? ""} onChange={(e) => setRow(gi, ri, { customerAction: (e.target.value || undefined) as PlanRow["customerAction"] })} aria-label="What the customer can do">
                          {ACTION.map((a) => <option key={a.value} value={a.value}>Customer: {a.label.toLowerCase()}</option>)}
                        </select>
                        {r.customerAction === "upload" && <Input value={r.uploadLabel ?? ""} onChange={(e) => setRow(gi, ri, { uploadLabel: e.target.value })} className="h-8 text-xs" placeholder="Button label (Upload roster)" aria-label="Upload button label" />}
                      </div>
                      <Input value={r.note ?? ""} onChange={(e) => setRow(gi, ri, { note: e.target.value })} className="h-8 text-xs" placeholder="Note for the customer (optional)" aria-label="Note" />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setGroup(gi, { rows: [...g.rows, { task: "", status: "not-started" }] })} data-room-plan-add-step>
                    <Plus className="h-3 w-3" /> Add a step
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          data-room-plan-add-phase
          onClick={() => {
            setGroups((gs) => [...gs, { title: `Phase ${gs.length + 1}`, rows: [{ task: "", status: "not-started" }] }]);
            setOpen((o) => new Set(o).add(groups.length));
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Add a phase
        </Button>
      </div>

      {(changed || note || error) && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background/95 py-2 backdrop-blur" data-room-plan-savebar>
          {error && <span className="text-xs text-destructive" role="alert">{error}</span>}
          {!error && note && !changed && <span className="text-xs text-muted-foreground">{note}</span>}
          {changed && <span className="text-xs text-muted-foreground">Unsaved changes{groups.some((g) => g.rows.some((r) => !r.task.trim())) ? " (empty steps are left out)" : ""}.</span>}
          <span className="flex-1" />
          {changed && (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => { setGroups(plan.groups); setImported(null); setPicked(new Set()); }}>Discard</Button>
              <Button type="button" variant="brand" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => void save()} data-room-plan-save>{busy ? "Saving…" : "Save plan"}</Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
