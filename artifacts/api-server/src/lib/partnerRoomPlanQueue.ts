/**
 * Partner Hub: the marketing plan queue. Pure functions, no database.
 *
 * When a customer says yes to a program in the hub's marketing plan, nothing
 * used to happen beyond a Slack line. Now every yes lands in a queue the
 * account team sees in the hub's manage pop-up. A rep ticks the ones that are
 * ready and sends them to marketing's request intake as ONE request, so
 * marketing gets a single brief for the account rather than a task per tick.
 *
 * What was sent is remembered on the request itself (`asset_key` =
 * "mk-plan:<key>,<key>"), so the queue needs no table of its own: a program
 * is "sent" when a request names it, and back in the queue when the customer
 * has changed their choice since.
 */

export const PLAN_REQUEST_PREFIX = "mk-plan:";

/** Mirrors the hub block's isDeclineOption: an answer that means "leave this one out". */
export const isDeclineChoice = (value: string): boolean => /^(not now|no|no thanks|skip|pass|not for us|decline|later)$/i.test(value.trim());

/** The program keys a request carries, or [] for any other request. */
export function planRequestKeys(assetKey: string | null | undefined): string[] {
  const v = (assetKey ?? "").trim();
  return v.startsWith(PLAN_REQUEST_PREFIX) ? v.slice(PLAN_REQUEST_PREFIX.length).split(",").map((k) => k.trim()).filter(Boolean) : [];
}

export interface PlanProgram {
  key: string;
  title: string;
  description?: string;
  audience?: string;
  when?: string;
}

export type PlanQueueState = "undecided" | "declined" | "queued" | "sent";

export interface PlanQueueItem extends PlanProgram {
  value: string | null;
  chosenBy: string | null;
  chosenAt: string | null;
  state: PlanQueueState;
  /** Queued again because the customer changed their answer after it was sent. */
  changed: boolean;
  /** The request it went to marketing in (the latest one, when it was sent more than once). */
  request: { id: number; status: string; asanaTaskGid: string | null; sentAt: string } | null;
}

/** Every program in the plan, in the plan's order, with where it stands: undecided, declined, waiting in the queue, or sent. */
export function buildPlanQueue(
  programs: PlanProgram[],
  choices: { key: string; value: string; by: string; at: Date }[],
  requests: { id: number; assetKey: string | null; status: string; asanaTaskGid: string | null; createdAt: Date }[],
): PlanQueueItem[] {
  const byKey = new Map(choices.map((c) => [c.key, c]));
  const sent = requests.filter((r) => planRequestKeys(r.assetKey).length > 0).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return programs.map((p) => {
    const c = byKey.get(p.key);
    const req = sent.find((r) => planRequestKeys(r.assetKey).includes(p.key)) ?? null;
    const request = req ? { id: req.id, status: req.status, asanaTaskGid: req.asanaTaskGid, sentAt: req.createdAt.toISOString() } : null;
    const base = { ...p, value: c?.value ?? null, chosenBy: c?.by ?? null, chosenAt: c?.at.toISOString() ?? null };
    if (!c) return { ...base, state: "undecided" as const, changed: false, request };
    if (isDeclineChoice(c.value)) return { ...base, state: "declined" as const, changed: false, request };
    const changed = !!req && c.at.getTime() > req.createdAt.getTime();
    return { ...base, state: req && !changed ? ("sent" as const) : ("queued" as const), changed, request };
  });
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** One request for marketing covering every program the rep ticked: the subject, what the customer sees, and the brief for the intake task. */
export function planRequest(customer: string, items: PlanQueueItem[], by: string, date: string, hubUrl: string, note: string): { subject: string; details: string; notes: string; assetKey: string } {
  const subject = items.length === 1 ? `Marketing plan: ${items[0].title}` : `Marketing plan: ${items.length} programs`;
  const line = (i: PlanQueueItem) => `${i.title}${i.value && !/^(include|yes)$/i.test(i.value) ? ` (${i.value})` : ""}`;
  const brief = items.map((i, n) =>
    [
      `${n + 1}. ${i.title}`,
      `   Choice: ${i.value ?? ""}${i.changed ? " (changed since it was last sent)" : ""}`,
      i.chosenBy ? `   Chosen by: ${i.chosenBy}${i.chosenAt ? ` on ${day(i.chosenAt)}` : ""}` : "",
      i.description ? `   What it is: ${i.description}` : "",
      i.audience ? `   Who it reaches: ${i.audience}` : "",
      i.when ? `   When: ${i.when}` : "",
    ].filter(Boolean).join("\n"),
  );
  return {
    subject,
    // What the customer reads under Requests: the programs, no internals.
    details: items.map(line).join("\n"),
    notes: [`${customer} said yes to ${items.length === 1 ? "this program" : `these ${items.length} programs`} in their Partner Hub's marketing plan.`, `Sent by: ${by}`, `Sent: ${date}`, "", ...brief, ...(note.trim() ? ["", `Note from ${by}: ${note.trim()}`] : []), ...(hubUrl ? ["", `Hub: ${hubUrl}`] : [])].join("\n"),
    assetKey: `${PLAN_REQUEST_PREFIX}${items.map((i) => i.key).join(",")}`,
  };
}
