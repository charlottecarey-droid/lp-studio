/**
 * Partner rooms — the weekly digest. Pure functions: turn a room's page
 * blocks + saved state into "what got done, what is waiting on you, what is
 * coming up", then render it as an email for the customer and a Slack post
 * for the team's account channel. No database access (see the routes and the
 * poller for loading and sending).
 *
 * The customer email only ever says things the customer can already see in
 * the room. The Slack version adds what the team needs to act on: blocking
 * items and decisions still open.
 */
import { planTaskKey } from "./partnerRoom";

export interface DigestState {
  /** Task keys the customer completed, with when and by whom. */
  tasks: { key: string; at: Date; by: string }[];
  requests: { subject: string; status: string; updatedAt: Date; createdAt: Date }[];
  choices: { key: string; value: string }[];
  wins: { body: string; headline: string | null; by: string; likes: number; createdAt: Date }[];
  practices: { total: number; byStage: Record<string, number> };
}

export interface DigestData {
  partnerName: string;
  day: number | null;
  totalDays: number;
  phase: string | null;
  planDone: number;
  planTotal: number;
  doneThisWeek: string[];
  waitingOnCustomer: string[];
  blocking: string[];
  undecided: string[];
  reviewRequests: string[];
  newRequests: number;
  topWin: { text: string; by: string } | null;
  practicesLive: number;
  practicesTotal: number;
  nextMilestone: string | null;
}

type Row = { key?: unknown; task?: unknown; status?: unknown; customerAction?: unknown; hidden?: unknown; note?: unknown; partnerOwner?: unknown };

function workspaceProps(blocks: unknown): Record<string, unknown> | null {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (b && typeof b === "object" && (b as { type?: unknown }).type === "room-workspace") return ((b as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>;
  }
  return null;
}

/** Day of the rollout (kickoff = day 1), or null without a valid kickoff date or before it. */
export function digestRolloutDay(kickoffDate: unknown, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof kickoffDate === "string" ? kickoffDate.trim() : "");
  if (!m) return null;
  const d = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86_400_000) + 1;
  return d >= 1 ? d : null;
}

/** Null when the page has no workspace block. `now` and a 7-day window decide "this week". */
export function collectDigest(blocks: unknown, state: DigestState, now: Date): DigestData | null {
  const props = workspaceProps(blocks);
  if (!props) return null;
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const doneKeys = new Map(state.tasks.map((t) => [t.key, t]));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const rows: Row[] = [];
  for (const g of Array.isArray(props.planGroups) ? (props.planGroups as { hidden?: unknown; rows?: unknown }[]) : []) {
    if (!g || g.hidden || !Array.isArray(g.rows)) continue;
    for (const r of g.rows as Row[]) if (r && !r.hidden) rows.push(r);
  }
  const isDone = (r: Row) => doneKeys.has(planTaskKey(r)) || r.status === "done";
  const customerOpen = rows.filter((r) => (r.customerAction === "check" || r.customerAction === "upload") && !isDone(r));

  const onboarding = props.onboarding as { hidden?: unknown; steps?: unknown } | undefined;
  const steps = !onboarding || onboarding.hidden || !Array.isArray(onboarding.steps) ? [] : (onboarding.steps as { key?: unknown; title?: unknown; done?: unknown; hidden?: unknown }[]).filter((x) => x && !x.hidden);
  const stepsOpen = steps.filter((x) => !x.done && !doneKeys.has(planTaskKey({ key: x.key, task: x.title })));

  const chosen = new Set(state.choices.map((c) => c.key));
  const undecided: string[] = [];
  const marketing = props.marketing as { groups?: unknown } | undefined;
  for (const g of Array.isArray(marketing?.groups) ? (marketing!.groups as { hidden?: unknown; programs?: unknown }[]) : []) {
    if (!g || g.hidden || !Array.isArray(g.programs)) continue;
    for (const p of g.programs as { key?: unknown; title?: unknown; options?: unknown; hidden?: unknown }[]) {
      if (!p || p.hidden || !Array.isArray(p.options) || p.options.length < 2) continue;
      if (!chosen.has(planTaskKey({ key: p.key, task: p.title }))) undecided.push(str(p.title));
    }
  }

  // Titles of everything the customer completed this week (plan rows and onboarding steps).
  const titleByKey = new Map<string, string>();
  for (const r of rows) titleByKey.set(planTaskKey(r), str(r.task));
  for (const x of steps) titleByKey.set(planTaskKey({ key: x.key, task: x.title }), str(x.title));
  const doneThisWeek = state.tasks.filter((t) => t.at.getTime() >= weekAgo && titleByKey.has(t.key)).map((t) => titleByKey.get(t.key) as string);
  for (const q of state.requests) if (q.status === "done" && q.updatedAt.getTime() >= weekAgo) doneThisWeek.push(`Request completed: ${q.subject}`);

  const totalDays = typeof props.rolloutDays === "number" && props.rolloutDays > 0 ? props.rolloutDays : 90;
  const day = digestRolloutDay(props.kickoffDate, now);
  let phase: string | null = null;
  if (day !== null) {
    for (const p of Array.isArray(props.phases) ? (props.phases as { title?: unknown; endDay?: unknown }[]) : []) {
      if (typeof p?.endDay !== "number" || day <= p.endDay) {
        phase = str(p?.title) || null;
        break;
      }
    }
  }

  const recentWins = state.wins.filter((w) => w.createdAt.getTime() >= weekAgo).sort((a, b) => b.likes - a.likes || b.createdAt.getTime() - a.createdAt.getTime());
  const top = recentWins[0];
  const nextLabel = str(props.nextMilestoneLabel);
  const nextDate = str(props.nextMilestoneDate);

  return {
    partnerName: str(props.partnerName) || "your team",
    day: day === null ? null : Math.min(day, totalDays),
    totalDays,
    phase,
    planDone: rows.filter(isDone).length,
    planTotal: rows.length,
    doneThisWeek,
    waitingOnCustomer: [...stepsOpen.map((x) => str(x.title)), ...customerOpen.map((r) => str(r.task))].filter(Boolean),
    blocking: rows.filter((r) => r.status === "blocking" && !isDone(r)).map((r) => [str(r.task), str(r.note)].filter(Boolean).join(" · ")),
    undecided: undecided.filter(Boolean),
    reviewRequests: state.requests.filter((q) => q.status === "review").map((q) => q.subject),
    newRequests: state.requests.filter((q) => q.createdAt.getTime() >= weekAgo).length,
    topWin: top ? { text: [top.headline, top.body].filter(Boolean).join(". "), by: top.by } : null,
    practicesLive: state.practices.byStage.live ?? 0,
    practicesTotal: state.practices.total,
    nextMilestone: nextLabel ? (nextDate ? `${nextLabel} · ${nextDate}` : nextLabel) : null,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** True when there is nothing worth emailing about (no progress, nothing waiting, no win). */
export function digestIsEmpty(d: DigestData): boolean {
  return d.doneThisWeek.length === 0 && d.waitingOnCustomer.length === 0 && d.undecided.length === 0 && d.reviewRequests.length === 0 && !d.topWin;
}

/** The customer email. `brandColor` is a hex for the header band; `senderName` is who it is from ("Dandy"). */
export function renderDigestEmail(d: DigestData, opts: { roomUrl: string; senderName: string; brandColor?: string }): { subject: string; html: string } {
  const color = /^#[0-9a-f]{6}$/i.test(opts.brandColor ?? "") ? (opts.brandColor as string) : "#0E1A16";
  const list = (items: string[], max = 6) =>
    `<ul style="margin:8px 0 0;padding:0 0 0 18px;color:#0E1A16;font-size:14px;line-height:1.6">${items.slice(0, max).map((i) => `<li>${esc(i)}</li>`).join("")}${items.length > max ? `<li style="color:#5C6B61">and ${items.length - max} more</li>` : ""}</ul>`;
  const section = (title: string, body: string) => `<tr><td style="padding:18px 28px 0"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1AA35A">${esc(title)}</div>${body}</td></tr>`;
  const waiting = [...d.waitingOnCustomer, ...d.undecided.map((u) => `Decide: ${u}`), ...d.reviewRequests.map((r) => `Review: ${r}`)];
  const stats = [d.day !== null ? `Day ${d.day} of ${d.totalDays}${d.phase ? ` · ${d.phase}` : ""}` : null, d.planTotal ? `${d.planDone} of ${d.planTotal} plan items complete` : null, d.practicesTotal ? `${d.practicesLive} of ${d.practicesTotal} practices live` : null].filter(Boolean) as string[];
  const html = `<!doctype html><html><body style="margin:0;background:#F3F4EF;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4EF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E7E7E0;border-radius:12px;overflow:hidden">
<tr><td style="background:${color};padding:24px 28px;color:#ffffff">
<div style="font-size:12px;opacity:.75">${esc(d.partnerName)} × ${esc(opts.senderName)}</div>
<div style="font-size:24px;font-weight:700;letter-spacing:-.02em;margin-top:4px">Your weekly update</div>
${stats.length ? `<div style="font-size:13px;opacity:.85;margin-top:8px">${stats.map(esc).join(" &nbsp;·&nbsp; ")}</div>` : ""}
</td></tr>
${d.doneThisWeek.length ? section("Done this week", list(d.doneThisWeek)) : ""}
${waiting.length ? section("Waiting on you", list(waiting)) : ""}
${d.nextMilestone ? section("Coming up", `<div style="margin-top:8px;font-size:14px;color:#0E1A16">${esc(d.nextMilestone)}</div>`) : ""}
${d.topWin ? section("Win of the week", `<div style="margin-top:8px;font-size:14px;line-height:1.6;color:#0E1A16">${esc(d.topWin.text)}<div style="color:#5C6B61;font-size:12.5px;margin-top:2px">${esc(d.topWin.by)}</div></div>`) : ""}
<tr><td style="padding:24px 28px 28px"><a href="${esc(opts.roomUrl)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px">Open the workspace</a></td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #E7E7E0;font-size:12px;color:#5C6B61">You're receiving this weekly update as part of the ${esc(d.partnerName)} and ${esc(opts.senderName)} partnership. Reply to this email to change who receives it.</td></tr>
</table></td></tr></table></body></html>`;
  const subject = `${d.partnerName} × ${opts.senderName}: weekly update${waiting.length ? ` (${waiting.length} waiting on you)` : ""}`;
  return { subject, html };
}

/** The team's Slack post for the account channel. */
export function renderDigestSlack(d: DigestData, roomUrl: string): { text: string; blocks: unknown[] } {
  const m = (s: string) => s.replace(/[<>&*_~`]/g, " ");
  const bullets = (items: string[], max = 6) => items.slice(0, max).map((i) => `• ${m(i)}`).join("\n") + (items.length > max ? `\n• and ${items.length - max} more` : "");
  const lines: string[] = [];
  lines.push([d.day !== null ? `Day ${d.day} of ${d.totalDays}${d.phase ? ` (${m(d.phase)})` : ""}` : null, `${d.planDone}/${d.planTotal} plan items done`, d.practicesTotal ? `${d.practicesLive}/${d.practicesTotal} practices live` : null].filter(Boolean).join(" · "));
  if (d.blocking.length) lines.push(`*Blocking (${d.blocking.length})*\n${bullets(d.blocking)}`);
  if (d.waitingOnCustomer.length) lines.push(`*Waiting on ${m(d.partnerName)} (${d.waitingOnCustomer.length})*\n${bullets(d.waitingOnCustomer)}`);
  if (d.undecided.length) lines.push(`*Marketing decisions still open (${d.undecided.length})*\n${bullets(d.undecided)}`);
  if (d.reviewRequests.length) lines.push(`*Requests waiting on their review (${d.reviewRequests.length})*\n${bullets(d.reviewRequests)}`);
  if (d.doneThisWeek.length) lines.push(`*Done this week (${d.doneThisWeek.length})*\n${bullets(d.doneThisWeek)}`);
  if (d.newRequests) lines.push(`${d.newRequests} new request${d.newRequests === 1 ? "" : "s"} this week.`);
  if (d.topWin) lines.push(`*Win of the week*\n${m(d.topWin.text)} — ${m(d.topWin.by)}`);
  const text = `Weekly digest: ${d.partnerName}`;
  return {
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `📬 Weekly digest · ${d.partnerName}`.slice(0, 150), emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n\n").slice(0, 2900) } },
      { type: "context", elements: [{ type: "mrkdwn", text: `<${roomUrl}|Open the room>` }] },
    ],
  };
}

/** Monday between 14:00 and 20:00 UTC (morning across US time zones). */
export function isDigestWindow(now: Date): boolean {
  return now.getUTCDay() === 1 && now.getUTCHours() >= 14 && now.getUTCHours() < 20;
}
