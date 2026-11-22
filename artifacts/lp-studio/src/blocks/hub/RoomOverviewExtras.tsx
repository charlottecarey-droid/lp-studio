import type { ReactNode } from "react";
import { ExternalLink, Eye, EyeOff, FileText, Link2, PlayCircle } from "lucide-react";
import { extractWistiaId } from "@/lib/wistia";
import { isNativeVideoUrl } from "@/lib/video-utils";

/**
 * The team's own sections on a hub's Overview, beside the built-in ones
 * (progress, next steps, coming up…): a video, a list of resources, or a
 * short note. Each sits at the top (under the welcome) or the bottom, and
 * can be hidden from the customer without deleting it.
 */
export type RoomOverviewExtraKind = "video" | "resources" | "text";

export interface RoomOverviewResource {
  title: string;
  url: string;
  description?: string;
}

export interface RoomOverviewExtra {
  /** Stable id (for tracking and editing). */
  key: string;
  kind: RoomOverviewExtraKind;
  title: string;
  /** A sentence under the title (text sections: the text itself). */
  body?: string;
  /** Video: a YouTube, Vimeo, Loom or Wistia link, or a video file. */
  videoUrl?: string;
  /** Resources: links the customer can open. */
  items?: RoomOverviewResource[];
  /** Where on the Overview: under the welcome ("top") or after everything else (the default). */
  position?: "top" | "bottom";
  hidden?: boolean;
}

export const OVERVIEW_EXTRA_LABEL: Record<RoomOverviewExtraKind, string> = { video: "Video", resources: "Resources", text: "Text" };

/** A new section of this kind, ready to fill in. */
export function newOverviewExtra(kind: RoomOverviewExtraKind, existing: RoomOverviewExtra[] = []): RoomOverviewExtra {
  let n = existing.length + 1;
  while (existing.some((x) => x.key === `ov-${kind}-${n}`)) n += 1;
  const key = `ov-${kind}-${n}`;
  if (kind === "video") return { key, kind, title: "Watch: welcome from your Dandy team", videoUrl: "", position: "top" };
  if (kind === "resources") return { key, kind, title: "Resources", items: [{ title: "", url: "" }], position: "bottom" };
  return { key, kind, title: "A note from your team", body: "", position: "bottom" };
}

/**
 * How a video link plays inside the hub: a file plays in a <video>, the
 * usual hosts in their own player (YouTube, Vimeo, Loom, Wistia). Null when
 * the link is empty or not one we can show (it is then left out, not shown
 * broken).
 */
export function overviewVideoEmbed(raw: string | undefined): { kind: "file" | "iframe"; src: string } | null {
  const url = (raw ?? "").trim();
  // A video uploaded to the media library is served from our own storage ("/api/storage/objects/uploads/<id>"):
  // no file extension, and often no host. It plays as a file.
  if (/^\/api\/storage\//.test(url) || /^https?:\/\/[^/]+\/api\/storage\//i.test(url)) return { kind: "file", src: url };
  // The library's own videos live on this site ("/videos/dandy-broll.mp4"); one is a page of its own ("/dandy-lab-video-2/").
  if (/^\/(?!\/)/.test(url)) return /\/$|\.html?$/i.test(url.split("?")[0]) ? { kind: "iframe", src: url } : { kind: "file", src: url };
  // Wistia: a media page, an embed link, a ?wvideo= link, or the bare video id.
  const wistia = extractWistiaId(url);
  if (wistia) return { kind: "iframe", src: `https://fast.wistia.net/embed/iframe/${wistia}` };
  if (!/^https?:\/\//i.test(url)) return null;
  if (isNativeVideoUrl(url)) return { kind: "file", src: url };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };
  const vimeo = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  const loom = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/);
  if (loom) return { kind: "iframe", src: `https://www.loom.com/embed/${loom[1]}` };
  return null;
}

/** Only links a browser can open safely (no javascript: and the like). */
const openable = (url: string) => /^(https?:\/\/|mailto:)/i.test(url.trim());

/** Whether the section has anything to show yet (an empty one is left off the customer's page). */
export function overviewExtraHasContent(extra: RoomOverviewExtra): boolean {
  if (extra.kind === "video") return !!overviewVideoEmbed(extra.videoUrl);
  if (extra.kind === "resources") return (extra.items ?? []).some((i) => (i.title ?? "").trim() && openable(i.url ?? ""));
  return !!((extra.title ?? "").trim() || (extra.body ?? "").trim());
}

/** What still needs filling in, for the builder's placeholder. */
export function overviewExtraMissing(extra: RoomOverviewExtra): string {
  if (extra.kind === "video") return (extra.videoUrl ?? "").trim() ? "This link can’t be played here. Use a YouTube, Vimeo, Loom or Wistia link, or a video file." : "Add a video link in the panel on the right.";
  if (extra.kind === "resources") return "Add a resource (a name and a link) in the panel on the right.";
  return "Add the text in the panel on the right.";
}

/** One of the team's own sections, as the customer sees it. Nothing is drawn while it has nothing to show. */
export function OverviewExtraView({ extra, onOpen }: { extra: RoomOverviewExtra; /** A resource or the video was opened (engagement). */ onOpen?: (what: { key: string; title: string; url: string }) => void }) {
  const title = (extra.title ?? "").trim();
  const body = (extra.body ?? "").trim();
  if (extra.kind === "video") {
    const v = overviewVideoEmbed(extra.videoUrl);
    if (!v) return null;
    return (
      <div className="prw-card prw-sec prw-ovx" data-room-ov-extra={extra.key} data-kind="video">
        {title && <h3><span className="prw-ovx-t"><PlayCircle aria-hidden /> {title}</span></h3>}
        <div className="prw-ovx-body">
          {body && <p className="prw-ovx-lede">{body}</p>}
          <div className="prw-ovx-video">
            {v.kind === "file" ? (
              <video src={v.src} controls preload="metadata" playsInline onPlay={() => onOpen?.({ key: extra.key, title: title || "Video", url: v.src })} />
            ) : (
              <iframe src={v.src} title={title || "Video"} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
            )}
          </div>
        </div>
      </div>
    );
  }
  if (extra.kind === "resources") {
    const items = (extra.items ?? []).filter((i) => (i.title ?? "").trim() && openable(i.url ?? ""));
    if (items.length === 0) return null;
    return (
      <div className="prw-card prw-sec prw-ovx" data-room-ov-extra={extra.key} data-kind="resources">
        <h3><span className="prw-ovx-t"><Link2 aria-hidden /> {title || "Resources"}</span></h3>
        {body && <p className="prw-ovx-lede pad">{body}</p>}
        {items.map((i, n) => (
          <a key={`${i.url}-${n}`} className="prw-li prw-ovx-link" href={i.url.trim()} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.({ key: `${extra.key}:${n}`, title: i.title.trim(), url: i.url.trim() })}>
            <div>
              <div className="t">{i.title.trim()}</div>
              {(i.description ?? "").trim() && <div className="m">{i.description!.trim()}</div>}
            </div>
            <span className="a" aria-hidden><ExternalLink /></span>
          </a>
        ))}
      </div>
    );
  }
  if (!title && !body) return null;
  return (
    <div className="prw-card prw-sec prw-ovx" data-room-ov-extra={extra.key} data-kind="text">
      {title && <h3><span className="prw-ovx-t"><FileText aria-hidden /> {title}</span></h3>}
      {body && <div className="prw-ovx-body prw-ovx-text">{body}</div>}
    </div>
  );
}

/**
 * Builder only: a section of the Overview the customer sees, with a small
 * Hide button that appears on hover. Hidden sections are not drawn at all
 * (they collapse into the strip at the top, OverviewHiddenStrip).
 */
export function OverviewEditFrame({ label, onHide, children }: { label: string; onHide: () => void; children: ReactNode }) {
  return (
    <div className="prw-ovedit" data-room-ov-edit={label}>
      <button type="button" className="prw-ovedit-hide" onClick={onHide} title={`Hide “${label}” from the customer`} aria-label={`Hide ${label} on the Overview`}>
        <EyeOff aria-hidden /> Hide
      </button>
      {children}
    </div>
  );
}

/** Builder only: every section hidden from the customer, collapsed into one line of chips, each with Show. */
export function OverviewHiddenStrip({ items }: { items: { key: string; label: string; onShow: () => void }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="prw-ovhidden" role="group" aria-label="Sections hidden from the customer" data-room-ov-hidden>
      <span className="lbl"><EyeOff aria-hidden /> Hidden from the customer</span>
      {items.map((x) => (
        <button key={x.key} type="button" onClick={x.onShow} title={`Show “${x.label}” to the customer again`} aria-label={`Show ${x.label} on the Overview`}>
          {x.label} <span className="go"><Eye aria-hidden /> Show</span>
        </button>
      ))}
    </div>
  );
}

/** Styles for the sections above, added to the hub's own stylesheet. */
export const OVERVIEW_EXTRAS_CSS = `
.prw-ovx-t{display:inline-flex;align-items:center;gap:8px}
.prw-ovx-t svg{width:16px;height:16px;color:var(--body)}
.prw-ovx-body{padding:18px 24px 22px}
.prw-ovx-lede{margin:0 0 14px;font-size:13.5px;color:var(--body);line-height:1.55}
.prw-ovx-lede.pad{margin:0;padding:14px 24px 0}
.prw-ovx-text{font-size:14px;line-height:1.6;color:var(--ink);white-space:pre-line}
.prw-ovx-video{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#0E1A16}
.prw-ovx-video iframe,.prw-ovx-video video{position:absolute;inset:0;width:100%;height:100%;border:0}
.prw-ovx-link{text-decoration:none;color:inherit}
.prw-ovx-link:hover{background:color-mix(in srgb,var(--dark) 3%,transparent)}
.prw-ovx-link .a svg{width:15px;height:15px;color:var(--faint)}
.prw-ovedit{position:relative}
.prw-ovedit-hide{position:absolute;top:-13px;right:14px;z-index:3;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--body);background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 10px;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.06);opacity:0;transition:opacity .15s}
.prw-ovedit-hide svg{width:13px;height:13px}
.prw-ovedit:hover>.prw-ovedit-hide,.prw-ovedit-hide:focus-visible{opacity:1}
.prw-ovedit-hide:hover{color:var(--ink);border-color:color-mix(in srgb,var(--dark) 30%,transparent)}
.prw-ovedit:hover>:not(.prw-ovedit-hide){box-shadow:0 0 0 2px color-mix(in srgb,var(--dark) 14%,transparent);border-radius:12px}
.prw-ovhidden{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:20px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;background:#fff}
.prw-ovhidden .lbl{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--body);margin-right:4px}
.prw-ovhidden .lbl svg{width:14px;height:14px}
.prw-ovhidden button{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:4px 6px 4px 12px;cursor:pointer}
.prw-ovhidden button .go{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:#fff;background:var(--dark);border-radius:999px;padding:2px 8px}
.prw-ovhidden button .go svg{width:12px;height:12px}
.prw-ovhidden button:hover{border-color:color-mix(in srgb,var(--dark) 30%,transparent)}
.prw-ovedit-empty{border:1px dashed var(--line);border-radius:12px;padding:18px 24px;font-size:13px;color:var(--body);background:#fff}
`;
