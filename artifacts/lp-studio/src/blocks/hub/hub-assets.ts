/**
 * Content Hub — asset model + helpers shared by hub-featured and hub-library.
 *
 * An asset is ONE thing a visitor can open: a PDF, a video, or an external
 * link. Each kind has a preferred "home" (fileUrl / videoUrl / externalUrl);
 * when the home is empty the asset falls back to any other URL it carries, so
 * a library can go live pointing at an existing viewer (e.g. a Highspot share
 * link) and swap to an uploaded file later without touching the card.
 *
 * View / download tracking is a public beacon to POST /api/lp/track/asset,
 * keyed by a stable per-asset key so renames in the builder don't fragment
 * the counts: an explicit `key` wins, else a slug of the title.
 */
import { isNativeVideoUrl } from "@/lib/video-utils";
import { readHubUnlock } from "./hub-gate";

export type HubAssetKind = "pdf" | "video" | "link";

export interface HubAsset {
  /** Stable analytics key (optional — slug of the title when blank). */
  key?: string;
  kind: HubAssetKind;
  title: string;
  description?: string;
  /** Uploaded / hosted PDF (or any file) — opens in the in-page viewer. */
  fileUrl?: string;
  /** Native file or YouTube / Vimeo / Wistia / Loom link — opens in the in-page player. */
  videoUrl?: string;
  /** Anything else — opens in a new tab. Also the fallback when the kind's own URL is blank. */
  externalUrl?: string;
  /** Poster / thumbnail. Optional: cards render a designed placeholder without one. */
  thumbnailUrl?: string;
  /** Short meta ("6 pages", "3 min", "Help center"). */
  meta?: string;
  /** Offer a download button. Default true for pdf + native video files. */
  downloadable?: boolean;
}

/** seen = card scrolled into view · view = in-page viewer · open = new tab / external · download. */
export type HubAssetAction = "seen" | "view" | "download" | "open";

/** Where the asset "lives": the URL the primary action uses. */
export function resolveAssetHref(a: HubAsset): string {
  const file = (a.fileUrl ?? "").trim();
  const video = (a.videoUrl ?? "").trim();
  const ext = (a.externalUrl ?? "").trim();
  if (a.kind === "pdf") return file || ext || video;
  if (a.kind === "video") return video || ext || file;
  return ext || file || video;
}

/** True when the asset opens in the in-page viewer (its own file / player)
 *  rather than a new tab. */
export function opensInViewer(a: HubAsset): boolean {
  if (a.kind === "pdf") return !!(a.fileUrl ?? "").trim();
  if (a.kind === "video") return !!(a.videoUrl ?? "").trim();
  return false;
}

/** The URL a download button should point at (null = no download). Only
 *  files we actually host can be downloaded: a PDF fileUrl or a native video
 *  file. Embedded players (YouTube etc.) and external pages never offer one. */
export function resolveDownloadHref(a: HubAsset): string | null {
  if (a.downloadable === false) return null;
  if (a.kind === "pdf") {
    const file = (a.fileUrl ?? "").trim();
    return file || null;
  }
  if (a.kind === "video") {
    const video = (a.videoUrl ?? "").trim();
    return video && isNativeVideoUrl(video) ? video : null;
  }
  return null;
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url) || /\/api\/storage\//.test(url);
}

/** Stable analytics key: explicit key → slug of the title → kind. */
export function assetKey(a: HubAsset): string {
  const explicit = (a.key ?? "").trim();
  if (explicit) return explicit.slice(0, 120);
  const slug = (a.title ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
  return slug || a.kind;
}

export const ASSET_KIND_LABEL: Record<HubAssetKind, string> = { pdf: "PDF", video: "Video", link: "Link" };

/** The verb on the card's primary action. */
export function assetVerb(a: HubAsset, override?: string): string {
  if (override && override.trim()) return override.trim();
  if (a.kind === "video") return "Watch";
  if (a.kind === "link") return "Open";
  return "Read";
}

export interface HubTrackContext {
  pageId?: number;
  sessionId?: string;
  blockId?: string;
}

/** True when the current document is a builder / preview surface where
 *  engagement must never be recorded. */
export function isTrackingSuppressed(): boolean {
  if (typeof window === "undefined") return true;
  const path = window.location.pathname;
  if (path.startsWith("/preview/") || path.startsWith("/builder") || path.startsWith("/lp-builder")) return true;
  const q = window.location.search;
  return /[?&]previewVariantId=/.test(q);
}

export function buildAssetEventPayload(ctx: HubTrackContext, a: HubAsset, action: HubAssetAction) {
  if (!ctx.pageId || !ctx.sessionId) return null;
  // Gate attribution: the lead the visitor's unlock created (verified
  // server-side against the tenant before it is stamped on the row).
  const leadId = readHubUnlock()?.leadId;
  return {
    pageId: ctx.pageId,
    sessionId: ctx.sessionId,
    blockId: ctx.blockId ?? null,
    assetKey: assetKey(a),
    assetTitle: (a.title ?? "").slice(0, 200),
    assetKind: a.kind,
    action,
    ...(leadId ? { leadId } : {}),
  };
}

/** Fire-and-forget engagement beacon. Never throws; silently no-ops in the
 *  builder, in previews and when the page has no tracking context. */
export function trackHubAsset(ctx: HubTrackContext, a: HubAsset, action: HubAssetAction): void {
  if (isTrackingSuppressed()) return;
  const payload = buildAssetEventPayload(ctx, a, action);
  if (!payload) return;
  try {
    const body = JSON.stringify(payload);
    // Beacons survive the tab navigating away (downloads / new-tab opens).
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon("/api/lp/track/asset", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch("/api/lp/track/asset", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => {});
  } catch {
    /* tracking is best-effort */
  }
}
