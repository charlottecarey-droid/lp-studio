/**
 * Report reader engagement → Content Hub asset events.
 *
 * A report is tracked as one Content Hub resource (asset kind "report") on the
 * same public beacon as hub-library / hub-featured, so it shows up in
 * Analytics → Resources next to every other resource, with the same gate /
 * form-session attribution to identified people. On top of the usual
 * view / download events it records what was actually read:
 *
 *   page        value = seconds on that page, detail = "07|Page title"
 *   progress    value = furthest milestone reached (25 / 50 / 75 / 100 %)
 *   section     detail = contents entry jumped to
 *   share       detail = page a share link was copied for
 *   play        detail = video opened from the report
 *   assessment  value = score, detail = result title
 *   cta         detail = CTA label clicked inside the report
 *   fullscreen  entered full-screen reading
 *   gate        email gate shown / clicked (detail = "shown" | "clicked" | "next" | "contents" | "download")
 *   unlock      the visitor passed the gate (sent by the parent after the form)
 *
 * The frame only ever sends `{ a, v?, d? }`; everything identifying (page id,
 * session, lead) is added here, in the parent, and the server re-validates.
 */
import { isTrackingSuppressed, sendHubBeacon, type HubTrackContext } from "@/blocks/hub/hub-assets";
import { readHubUnlock } from "@/blocks/hub/hub-gate";

export const REPORT_EVENT_ACTIONS = [
  "view",
  "download",
  "page",
  "progress",
  "section",
  "share",
  "play",
  "assessment",
  "cta",
  "fullscreen",
  "gate",
  "unlock",
] as const;
export type ReportEventAction = (typeof REPORT_EVENT_ACTIONS)[number];

export interface ReportEvent {
  action: ReportEventAction;
  value?: number;
  detail?: string;
}

const ACTIONS = new Set<string>(REPORT_EVENT_ACTIONS);

/** Validate a `{ __lpReportEvent: { a, v?, d? } }` message from the frame. */
export function parseReportEventMessage(data: unknown): ReportEvent | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).__lpReportEvent;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const action = typeof r.a === "string" ? r.a : "";
  // "view" and "unlock" are the parent's to send, never the frame's.
  if (!ACTIONS.has(action) || action === "view" || action === "unlock") return null;
  const out: ReportEvent = { action: action as ReportEventAction };
  if (typeof r.v === "number" && Number.isFinite(r.v) && r.v >= 0) out.value = Math.min(Math.round(r.v), 86_400);
  if (typeof r.d === "string" && r.d.trim()) out.detail = r.d.trim().slice(0, 200);
  return out;
}

/** Stable analytics key for a report: explicit key → slug of the title → slug of the file name. */
export function reportAssetKey(opts: { trackingKey?: string; title?: string; src?: string }): string {
  const explicit = (opts.trackingKey ?? "").trim();
  if (explicit) return explicit.slice(0, 120);
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);
  const fromTitle = slug(opts.title ?? "");
  if (fromTitle) return fromTitle;
  const file = (opts.src ?? "").split(/[?#]/)[0].split("/").filter(Boolean).slice(-2).join("-");
  return slug(file.replace(/\.(html?|pdf)$/i, "")) || "report";
}

export function buildReportEventPayload(
  ctx: HubTrackContext,
  report: { key: string; title: string },
  ev: ReportEvent,
): Record<string, unknown> | null {
  if (!ctx.pageId || !ctx.sessionId) return null;
  const leadId = readHubUnlock()?.leadId;
  return {
    pageId: ctx.pageId,
    sessionId: ctx.sessionId,
    blockId: ctx.blockId ?? null,
    assetKey: report.key,
    assetTitle: (report.title || report.key).slice(0, 200),
    assetKind: "report",
    action: ev.action,
    ...(leadId ? { leadId } : {}),
    ...(typeof ev.value === "number" ? { value: ev.value } : {}),
    ...(ev.detail ? { detail: ev.detail } : {}),
  };
}

/** Fire-and-forget; silent in the builder / previews and without a tracking context. */
export function trackReportEvent(ctx: HubTrackContext, report: { key: string; title: string }, ev: ReportEvent): void {
  if (isTrackingSuppressed()) return;
  sendHubBeacon(buildReportEventPayload(ctx, report, ev));
}
