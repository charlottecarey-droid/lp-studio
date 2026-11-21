/**
 * The Outstanding module of a partner room: one list of everything still
 * open, wherever it came from, grouped by whose move it is.
 *
 * A room has several kinds of to-do, each living in its own module:
 *   setup steps        (Overview)        the customer's first three things
 *   plan milestones    (Action plan)     the ones the customer completes, and anything overdue
 *   marketing choices  (Marketing plan)  programs waiting on a yes or no
 *   goals              (Goals)           waiting to be agreed
 *   requests           (here)            what the customer asked us for
 *   meeting actions    (Meetings)        action items from minutes
 *
 * This module gathers the open ones so nobody has to visit six tabs to know
 * what is waiting. The layout is deliberately plain: a heading per side, one
 * line per item, and the whole line is the button. A meeting action is
 * ticked in place; a setup step or a plan step carries its own button
 * (Upload, Complete, Add); a request shows its status (and Approve, when it
 * is ready for the customer); everything else opens the module where it is done.
 * Finished requests fold away at the bottom.
 *
 * Styles live in the room block's CSS string (`.prw-o-*`).
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronRight, PencilLine } from "lucide-react";

export type OutstandingSide = "you" | "us" | "both";
export type OutstandingSource = "Setup" | "Action plan" | "Marketing plan" | "Goals" | "Request" | "Meeting";

export interface OutstandingRequest {
  id: number;
  status: string;
  owner: string | null;
  due: string | null;
}

export interface OutstandingItem {
  id: string;
  title: string;
  source: OutstandingSource;
  /** Where it came from in words ("Weekly sync · Nov 10"). */
  from?: string;
  owner?: string;
  due?: string;
  side: OutstandingSide;
  overdue?: boolean;
  /** The module that holds it. */
  module: string;
  /** A task that can be ticked off right here (meeting action items). */
  taskKey?: string;
  /** A request ready for the customer's review: can be approved right here. */
  approveRequestId?: number;
  /** The request behind a "Request" item: its status shows on the line, and the team can edit it. */
  request?: OutstandingRequest;
  /** The item's own button (Upload, Complete, Add…), so it is done right here instead of sending the reader to another tab to look for it. */
  action?: ReactNode;
}

export interface DoneRequest {
  id: number;
  subject: string;
  by: string;
  when: string;
}

const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The saved-state key of one meeting action item. Meetings typed into the
 * page: "ma-<meeting>-<what>" (the server's `meetingActionKey`). Minutes
 * published from a synced meeting ("sync-<id>"): "ev-<id>-<what>".
 */
export function roomMeetingActionKey(meetingKey: string, text: string): string {
  const synced = /^sync-(\d+)$/.exec(meetingKey);
  if (synced) return `ev-${synced[1]}-${slug(text).slice(0, 48).replace(/-+$/, "")}`;
  return `ma-${slug(meetingKey).slice(0, 24)}-${slug(text).slice(0, 48)}`.replace(/-+$/, "");
}

/**
 * Whose move an item with a free-text owner is: ours when the owner is one
 * of our people (or our company's name), the customer's when it is one of
 * theirs, otherwise both sides see it.
 */
export function ownerSide(owner: string | undefined, ours: string[], theirs: string[]): OutstandingSide {
  const o = (owner ?? "").trim().toLowerCase();
  if (!o || o === "—" || o === "-") return "both";
  const hit = (names: string[]) => names.some((n) => n.trim() && (o === n.trim().toLowerCase() || o.includes(n.trim().toLowerCase())));
  const mine = hit(ours);
  const yours = hit(theirs);
  return mine === yours ? "both" : mine ? "us" : "you";
}

/** Overdue first, then the customer's, then ours; otherwise the order they were gathered in. */
export function sortOutstanding(items: OutstandingItem[]): OutstandingItem[] {
  const rank = (i: OutstandingItem) => (i.overdue ? 0 : 1) * 10 + (i.side === "you" ? 0 : i.side === "both" ? 1 : 2);
  return items.map((item, at) => ({ item, at })).sort((a, b) => rank(a.item) - rank(b.item) || a.at - b.at).map((x) => x.item);
}

const REQUEST_STATUS: Record<string, string> = { new: "Received", in_progress: "In progress", review: "Ready for review", done: "Done" };
/** How many lines a group shows before "Show all". */
const FOLD = 6;

export function OutstandingView({
  items,
  doneRequests = [],
  ourName,
  theirName,
  isTeam,
  canAct,
  people = [],
  onOpen,
  onTick,
  onApprove,
  onEditRequest,
}: {
  items: OutstandingItem[];
  doneRequests?: DoneRequest[];
  ourName: string;
  theirName: string;
  /** The page owner's own team is looking: "you" would be wrong, so the customer is named. */
  isTeam: boolean;
  canAct: boolean;
  /** Our people, for assigning a request. */
  people?: string[];
  onOpen: (module: string) => void;
  onTick: (taskKey: string) => Promise<string | null>;
  onApprove: (requestId: number) => Promise<string | null>;
  /** Set for the account team on the live page: they can move a request along. */
  onEditRequest?: (requestId: number, patch: { status?: string; owner?: string; due?: string }) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = sortOutstanding(items);
  const groups: { key: OutstandingSide; title: string; items: OutstandingItem[] }[] = [
    { key: "you" as const, title: `Waiting on ${isTeam ? theirName : "you"}`, items: sorted.filter((i) => i.side === "you") },
    { key: "us" as const, title: `Waiting on ${ourName}`, items: sorted.filter((i) => i.side === "us") },
    { key: "both" as const, title: "Shared between us", items: sorted.filter((i) => i.side === "both") },
  ].filter((g) => g.items.length > 0);
  const run = async (id: string, fn: () => Promise<string | null>) => {
    setBusy(id);
    setError("");
    const err = await fn();
    setBusy("");
    if (err) setError(err);
  };

  const line = (i: OutstandingItem) => {
    const meta = [i.source === "Request" ? "" : i.source, i.from, i.owner, i.due ? `due ${i.due}` : ""].filter(Boolean).join(" · ");
    const body = (
      <>
        <span className="t">{i.title}</span>
        {meta && <span className="m">{meta}</span>}
      </>
    );
    const tickable = !!i.taskKey && canAct;
    return (
      <div className={`prw-o-row${i.overdue ? " late" : ""}`} key={i.id} data-room-outstanding-item={i.source}>
        {tickable ? (
          <button type="button" className="prw-o-tick" disabled={busy === i.id} onClick={() => run(i.id, () => onTick(i.taskKey!))} aria-label={`Mark done: ${i.title}`} title="Mark done" data-room-outstanding-done>
            <Check aria-hidden />
          </button>
        ) : (
          <span className="prw-o-dot" aria-hidden />
        )}
        {i.request || tickable || (i.action && i.source === "Setup") ? (
          <div className="prw-o-main">{body}</div>
        ) : (
          <button type="button" className="prw-o-main" onClick={() => onOpen(i.module)}>{body}</button>
        )}
        <span className="prw-o-end">
          {i.overdue && <span className="prw-o-late">Overdue</span>}
          {i.request && <span className={`prw-chip ${i.request.status}`}>{REQUEST_STATUS[i.request.status] ?? i.request.status}</span>}
          {i.approveRequestId && canAct && !isTeam && (
            <button type="button" className="prw-btn pri" disabled={busy === i.id} onClick={() => run(i.id, () => onApprove(i.approveRequestId!))} data-room-outstanding-approve><Check aria-hidden /> Approve</button>
          )}
          {i.request && onEditRequest && (
            <button type="button" className={`prw-ib${editing === i.id ? " on" : ""}`} title="Edit this request" aria-label={`Edit: ${i.title}`} aria-expanded={editing === i.id} onClick={() => setEditing((k) => (k === i.id ? null : i.id))} data-room-edit-request>
              <PencilLine aria-hidden />
            </button>
          )}
          {i.action}
          {!i.request && !tickable && !i.action && <ChevronRight className="go" aria-hidden />}
        </span>
        {i.request && onEditRequest && editing === i.id && <RequestEditor request={i.request} people={people} onClose={() => setEditing(null)} onSave={(patch) => onEditRequest(i.request!.id, patch)} />}
      </div>
    );
  };

  return (
    <div className="prw-o" data-room-outstanding>
      {error && <div className="prw-err" role="alert">{error}</div>}
      {groups.length === 0 && <div className="prw-card"><div className="prw-empty">Nothing is outstanding.</div></div>}
      {groups.map((g) => {
        const all = open[g.key] || g.items.length <= FOLD + 1;
        return (
          <section key={g.key} data-room-outstanding-group={g.key}>
            <h3>{g.title}<span className="prw-num">{g.items.length}</span></h3>
            <div className="prw-card">
              {(all ? g.items : g.items.slice(0, FOLD)).map(line)}
              {!all && <button type="button" className="prw-o-more" onClick={() => setOpen((o) => ({ ...o, [g.key]: true }))}>Show all {g.items.length}</button>}
            </div>
          </section>
        );
      })}
      {doneRequests.length > 0 && (
        <details className="prw-o-done" data-room-requests-done>
          <summary>Completed requests <span className="prw-num">{doneRequests.length}</span></summary>
          <ul>
            {doneRequests.map((q) => <li key={q.id}><span>{q.subject}</span><em>{[q.by, q.when].filter(Boolean).join(" · ")}</em></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

/** A request's status, owner and due date, in a strip under its line, saved together. */
function RequestEditor({ request, people, onSave, onClose }: { request: OutstandingRequest; people: string[]; onSave: (patch: { status?: string; owner?: string; due?: string }) => Promise<string | null>; onClose: () => void }) {
  const [status, setStatus] = useState(request.status);
  const [owner, setOwner] = useState(request.owner ?? "");
  const [due, setDue] = useState(request.due ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const owners = [...new Set([...(request.owner ? [request.owner] : []), ...people])];
  const save = async () => {
    const patch: { status?: string; owner?: string; due?: string } = {};
    if (status !== request.status) patch.status = status;
    if (owner !== (request.owner ?? "")) patch.owner = owner;
    if (due.trim() !== (request.due ?? "")) patch.due = due.trim();
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError("");
    const err = await onSave(patch);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };
  return (
    <div className="prw-edit" data-room-request-editor>
      <div className="f">
        <label>
          <span>Status</span>
          <select className="prw-pick" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" data-room-request-status>
            {Object.entries(REQUEST_STATUS).map(([k, label]) => <option key={k} value={k}>{k === "review" ? "Ready for their review" : label}</option>)}
          </select>
        </label>
        <label>
          <span>Owner</span>
          <select className="prw-pick" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="">—</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label>
          <span>Due</span>
          <input className="prw-pick" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" />
        </label>
        <span className="b">
          <button type="button" className="prw-btn pri" disabled={busy} onClick={save} data-room-request-save>{busy ? "Saving" : "Save"}</button>
          <button type="button" className="prw-btn" disabled={busy} onClick={onClose}>Cancel</button>
        </span>
      </div>
      {error && <div className="prw-err" role="alert">{error}</div>}
    </div>
  );
}
