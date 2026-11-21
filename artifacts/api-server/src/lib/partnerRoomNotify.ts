/**
 * Partner Hub, for the account team: what needs a rep across a hub, the email
 * that tells the account owner about activity (for hubs set to email instead
 * of, or as well as, Slack), and the reminder a rep sends the customer. Pure
 * functions: no database, no sending.
 */

/** What is waiting on the account team in one hub. */
export interface HubNeeds {
  /** People asking to be let in. */
  access: number;
  /** Programs the customer said yes to that have not gone to marketing. */
  marketing: number;
  /** Customer requests nobody has picked up. */
  requests: number;
  /** Meeting minutes drafted and waiting for a read before the customer sees them. */
  minutes: number;
}

export const needsTotal = (n: HubNeeds): number => n.access + n.marketing + n.requests + n.minutes;
/** The part of it that lives on the pop-up's To do tab (minutes are reviewed under Calendar). */
export const needsTodo = (n: HubNeeds): number => n.access + n.marketing + n.requests;

const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : "");
/** "2 asking for access · 3 programs to send · 1 new request". */
export function needsLine(n: HubNeeds): string {
  return [count(n.access, "person asking for access", "people asking for access"), count(n.marketing, "program to send to marketing", "programs to send to marketing"), count(n.requests, "new request", "new requests"), count(n.minutes, "set of minutes to review", "sets of minutes to review")].filter(Boolean).join(" · ");
}

export type NotifyVia = "slack" | "email" | "both";
export const parseNotifyVia = (v: unknown): NotifyVia => (v === "email" || v === "both" ? v : "slack");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A line written for Slack ("*Dana* chose *Include*", "• item") as plain HTML: bold kept, the rest escaped. */
export function slackLineToHtml(line: string): string {
  return esc(line).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}
/** A Slack headline without its leading emoji, for an email subject. */
export const plainHeadline = (headline: string): string => headline.replace(/^[^\p{L}\p{N}]+/u, "").trim();

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const shell = (color: string, eyebrow: string, title: string, body: string, footer: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F3F4EF;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4EF"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:${FONT}">
<tr><td style="background:${color};padding:26px 32px;color:#ffffff"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.7">${esc(eyebrow)}</div><div style="font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-.01em;margin-top:8px">${esc(title)}</div></td></tr>
${body}
<tr><td style="padding:20px 32px 24px;background:#FAFAF7;border-top:1px solid #E7E7E0;font-size:12px;line-height:1.6;color:#5C6B61">${footer}</td></tr>
</table></td></tr></table></body></html>`;
const button = (color: string, url: string, label: string) => `<a href="${esc(url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1;padding:15px 28px;border-radius:12px">${esc(label)}</a>`;
const hex = (c: string | undefined) => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? (c as string) : "#0E1A16");

/** The email the account owner gets when something happens in a hub: the same words the Slack post carries. */
export function teamNotifyEmail(input: { hubTitle: string; headline: string; lines: string[]; hubUrl?: string; brandColor?: string }): { subject: string; html: string } {
  const color = hex(input.brandColor);
  const head = plainHeadline(input.headline);
  const body = `<tr><td style="padding:28px 32px 0;font-size:15px;line-height:1.6;color:#0E1A16">${input.lines.filter((l) => l.trim()).map((l) => `<div style="margin:0 0 10px">${slackLineToHtml(l)}</div>`).join("")}</td></tr>${input.hubUrl ? `<tr><td style="padding:18px 32px 32px">${button(color, input.hubUrl, "Open the hub")}</td></tr>` : `<tr><td style="padding:0 0 28px"></td></tr>`}`;
  return {
    subject: `${input.hubTitle}: ${head}`,
    html: shell(color, "Partner Hub", head, body, `You're getting this because you own this account and the hub is set to email you about activity. Change it in the hub's Settings, under Notifications. To act on it, open Partner Hubs in the Sales Console.`),
  };
}

/** The reminder a rep sends the customer: the next few things waiting on them, and one button. Never a wall of chores. */
export function reminderEmail(input: { partnerName: string; senderName: string; by: string; items: string[]; hubUrl: string; note?: string; brandColor?: string }): { subject: string; html: string } {
  const color = hex(input.brandColor);
  const shown = input.items.slice(0, 5);
  const more = input.items.length - shown.length;
  const rows = shown.map((x) => `<tr><td style="padding:0 0 8px"><a href="${esc(input.hubUrl)}" style="display:block;text-decoration:none;color:#0E1A16"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E7E7E0;border-radius:10px"><tr><td style="padding:13px 16px;font-size:15px;line-height:1.4;color:#0E1A16">${esc(x)}</td><td width="34" align="right" style="padding:13px 16px 13px 0;font-size:16px;color:#5C6B61">&rarr;</td></tr></table></a></td></tr>`).join("");
  const note = (input.note ?? "").trim();
  const body = `${note ? `<tr><td style="padding:28px 32px 0;font-size:15px;line-height:1.6;color:#0E1A16">${esc(note).replace(/\n/g, "<br>")}<div style="margin-top:6px;font-size:13px;color:#5C6B61">${esc(input.by)}</div></td></tr>` : ""}
<tr><td style="padding:${note ? 22 : 28}px 32px 0;font-size:15px;line-height:1.6;color:#0E1A16">${shown.length === 1 ? "One thing is" : `${input.items.length} things are`} waiting on you in your Partner Hub. Each takes a minute or two.</td></tr>
<tr><td style="padding:14px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more > 0 ? `<div style="margin-top:4px;font-size:14px;color:#5C6B61">and ${more} more</div>` : ""}</td></tr>
<tr><td align="center" style="padding:26px 32px 34px">${button(color, input.hubUrl, "Open your Partner Hub")}</td></tr>`;
  return {
    subject: `${input.partnerName} × ${input.senderName}: ${input.items.length === 1 ? "one thing is" : `${input.items.length} things are`} waiting on you`,
    html: shell(color, `${input.partnerName} × ${input.senderName}`, "A quick reminder", body, `Sent by ${esc(input.by)} as part of the ${esc(input.partnerName)} and ${esc(input.senderName)} partnership. Reply to this email to reach them.`),
  };
}
