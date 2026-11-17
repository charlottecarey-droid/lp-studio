/**
 * The Outstanding module of a partner room: one list of everything still
 * open, wherever it came from, and who has it.
 *
 * A room has several kinds of to-do, each living in its own module:
 *   setup steps        (Overview)        the customer's first three things
 *   plan milestones    (Action plan)     the ones the customer completes, and anything overdue
 *   marketing choices  (Marketing plan)  programs waiting on a yes or no
 *   goals              (Goals)           waiting to be agreed
 *   requests           (here)            what the customer asked us for
 *   meeting actions    (Meetings)        action items from minutes
 *
 * This module gathers the open ones into a single list split by whose move
 * it is, so nobody has to visit six tabs to know what is waiting. Each row
 * either acts in place (tick a meeting action, approve a request) or opens
 * the module where it is done.
 *
 * Styles live in the room block's CSS string (`.prw-out-*`).
 */
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export type OutstandingSide = "you" | "us" | "both";
export type OutstandingSource = "Setup" | "Action plan" | "Marketing plan" | "Goals" | "Request" | "Meeting";

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

export function OutstandingView({
  items,
  ourName,
  theirName,
  isTeam,
  canAct,
  onOpen,
  onTick,
  onApprove,
}: {
  items: OutstandingItem[];
  ourName: string;
  theirName: string;
  /** The page owner's own team is looking: "you" would be wrong, so the customer is named. */
  isTeam: boolean;
  canAct: boolean;
  onOpen: (module: string) => void;
  onTick: (taskKey: string) => Promise<string | null>;
  onApprove: (requestId: number) => Promise<string | null>;
}) {
  const [show, setShow] = useState<"all" | "you" | "us">("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const you = isTeam ? theirName : "you";
  const yours = items.filter((i) => i.side !== "us");
  const ours = items.filter((i) => i.side !== "you");
  const overdue = items.filter((i) => i.overdue);
  const shown = sortOutstanding(show === "you" ? yours : show === "us" ? ours : items);
  const run = async (id: string, fn: () => Promise<string | null>) => {
    setBusy(id);
    setError("");
    const err = await fn();
    setBusy("");
    if (err) setError(err);
  };
  return (
    <>
      <div className="prw-sum prw-out-sum" data-room-outstanding-summary>
        <div><b className="prw-num">{yours.length}</b>waiting on {you}</div>
        <div><b className="prw-num">{ours.length}</b>waiting on {ourName}</div>
        {overdue.length > 0 && <div className="late"><b className="prw-num">{overdue.length}</b>overdue</div>}
      </div>
      <div className="prw-out-bar">
        <div className="prw-seg" role="group" aria-label="Whose">
          <button type="button" className={show === "all" ? "on" : ""} onClick={() => setShow("all")}>All</button>
          <button type="button" className={show === "you" ? "on" : ""} onClick={() => setShow("you")} data-room-outstanding-filter="you">{isTeam ? theirName : "Yours"}</button>
          <button type="button" className={show === "us" ? "on" : ""} onClick={() => setShow("us")} data-room-outstanding-filter="us">{ourName}</button>
        </div>
        {error && <span className="prw-err" role="alert">{error}</span>}
      </div>
      <div className="prw-card prw-out" data-room-outstanding>
        {shown.length === 0 && <div className="prw-empty">{items.length === 0 ? "Nothing is outstanding. Everything open on both sides shows up here." : "Nothing here."}</div>}
        {shown.map((i) => (
          <div className="prw-li" key={i.id} data-room-outstanding-item={i.source}>
            <div>
              <div className="t">{i.title}</div>
              <div className="m">
                <span className="src">{i.source}</span>
                {[i.from, i.owner ? `Owner: ${i.owner}` : "", i.due ? `Due ${i.due}` : ""].filter(Boolean).map((x) => ` · ${x}`).join("")}
                {i.overdue && <span className="late"> · Overdue</span>}
              </div>
            </div>
            <div className="a">
              <span className={`who ${i.side}`}>{i.side === "you" ? (isTeam ? theirName : "You") : i.side === "us" ? ourName : "Both"}</span>
              {i.taskKey && canAct ? (
                <button type="button" className="prw-btn" disabled={busy === i.id} onClick={() => run(i.id, () => onTick(i.taskKey!))} data-room-outstanding-done><Check aria-hidden /> Done</button>
              ) : i.approveRequestId && canAct && !isTeam ? (
                <button type="button" className="prw-btn pri" disabled={busy === i.id} onClick={() => run(i.id, () => onApprove(i.approveRequestId!))} data-room-outstanding-approve><Check aria-hidden /> Approve</button>
              ) : (
                <button type="button" className="prw-btn" onClick={() => onOpen(i.module)}>Open <ArrowRight aria-hidden /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
