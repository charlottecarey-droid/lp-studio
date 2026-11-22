import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ExternalLink, Eye, EyeOff, Link2, Pin, PlayCircle, RotateCcw } from "lucide-react";
import { BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { extractWistiaId } from "@/lib/wistia";
import { isNativeVideoUrl } from "@/lib/video-utils";

/**
 * The team's own sections on a hub's Overview, beside the built-in ones
 * (progress, next steps, coming up…): a video, the hub's Important links,
 * a list of resources (older hubs), or a short note. Each sits at the top (under the welcome) or the bottom, and
 * can be hidden from the customer without deleting it.
 */
/**
 * "links" is the hub's own Important links (props.links), the very section the
 * Marketing tab shows: it has no items of its own, so a link added once shows
 * in both places. "resources" is the older stand-alone list, still drawn for
 * hubs that have one but no longer offered.
 */
export type RoomOverviewExtraKind = "video" | "links" | "resources" | "text";

/** The kinds a rep can add from the builder, in button order. */
export const OVERVIEW_EXTRA_ADDABLE: RoomOverviewExtraKind[] = ["video", "links", "text"];

export interface RoomOverviewResource {
  title: string;
  url: string;
  description?: string;
}

/** One video in a Video section. A section with more than one plays them as a carousel. */
export interface RoomOverviewVideo {
  /** The video's name, shown as "Watch video (1 of 3): name". */
  title: string;
  /** A YouTube, Vimeo, Loom or Wistia link, or a video file. */
  url: string;
  /** A sentence about this video, above the player (optional). */
  body?: string;
}

export interface RoomOverviewExtra {
  /** Stable id (for tracking and editing). */
  key: string;
  kind: RoomOverviewExtraKind;
  title: string;
  /** A sentence under the title (text sections: the text itself). */
  body?: string;
  /** Video (older sections, one video): a YouTube, Vimeo, Loom or Wistia link, or a video file. Read through overviewVideos. */
  videoUrl?: string;
  /** Video: the videos, in order. When set it wins over videoUrl/title/body. */
  videos?: RoomOverviewVideo[];
  /** Resources: links the customer can open. Note: the team's links, shown as buttons under the message. */
  items?: RoomOverviewResource[];
  /** Note: the small line above the title. Unset = "From your account team"; empty = none. */
  eyebrow?: string;
  /** Where on the Overview: under the welcome ("top") or after everything else (the default). */
  position?: "top" | "bottom";
  hidden?: boolean;
}

/** A note's eyebrow when the team has not set one. */
export const OVERVIEW_NOTE_EYEBROW = "From your account team";

export const OVERVIEW_EXTRA_LABEL: Record<RoomOverviewExtraKind, string> = { video: "Video", links: "Important links", resources: "Resources", text: "Pinned note" };

/** A new section of this kind, ready to fill in. */
export function newOverviewExtra(kind: RoomOverviewExtraKind, existing: RoomOverviewExtra[] = []): RoomOverviewExtra {
  let n = existing.length + 1;
  while (existing.some((x) => x.key === `ov-${kind}-${n}`)) n += 1;
  const key = `ov-${kind}-${n}`;
  if (kind === "video") return { key, kind, title: "Welcome from your Dandy team", videos: [{ title: "Welcome from your Dandy team", url: "" }], position: "top" };
  if (kind === "links") return { key, kind, title: "Important links", position: "bottom" };
  if (kind === "resources") return { key, kind, title: "Resources", items: [{ title: "", url: "" }], position: "bottom" };
  return { key, kind, title: "A note from your team", body: "", eyebrow: OVERVIEW_NOTE_EYEBROW, items: [], position: "top" };
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

/**
 * A Video section's videos. Sections saved before the carousel hold one video in
 * title / videoUrl / body; they read as a list of one, so nothing needs migrating.
 */
export function overviewVideos(extra: RoomOverviewExtra): RoomOverviewVideo[] {
  if (Array.isArray(extra.videos)) return extra.videos;
  return [{ title: extra.title ?? "", url: extra.videoUrl ?? "", body: extra.body }];
}

/** A video's name as shown in the header: an old "Watch: …" title loses its "Watch:". */
export function overviewVideoName(v: RoomOverviewVideo): string {
  return (v.title ?? "").trim().replace(/^watch(\s+video)?\s*:\s*/i, "") || "Video";
}

/** Only links a browser can open safely (no javascript: and the like). */
const openable = (url: string) => /^(https?:\/\/|mailto:)/i.test(url.trim());

/**
 * Whether the section has anything to show yet (an empty one is left off the customer's page).
 * `hubLinks`: how many Important links the hub shows (an Important links section has none of its own).
 */
export function overviewExtraHasContent(extra: RoomOverviewExtra, hubLinks = 0): boolean {
  if (extra.kind === "video") return overviewVideos(extra).some((v) => !!overviewVideoEmbed(v.url));
  if (extra.kind === "links") return hubLinks > 0;
  if (extra.kind === "resources") return (extra.items ?? []).some((i) => (i.title ?? "").trim() && openable(i.url ?? ""));
  return !!((extra.title ?? "").trim() || (extra.body ?? "").trim() || noteLinks(extra).length > 0);
}

/** A note's links that can be shown: a name and a link a browser can open safely. */
function noteLinks(extra: RoomOverviewExtra): RoomOverviewResource[] {
  return (extra.items ?? []).filter((i) => (i.title ?? "").trim() && openable(i.url ?? ""));
}

/** What still needs filling in, for the builder's placeholder. */
export function overviewExtraMissing(extra: RoomOverviewExtra): string {
  if (extra.kind === "video") return overviewVideos(extra).some((v) => (v.url ?? "").trim()) ? "This link can’t be played here. Use a YouTube, Vimeo, Loom or Wistia link, or a video file." : "Add a video link in the panel on the right.";
  if (extra.kind === "links") return "This hub has no Important links yet. Add them under Marketing → Links.";
  if (extra.kind === "resources") return "Add a resource (a name and a link) in the panel on the right.";
  return "Add the text in the panel on the right.";
}

/** One of the team's own sections, as the customer sees it. Nothing is drawn while it has nothing to show. */
export function OverviewExtraView({ extra, onOpen }: { extra: RoomOverviewExtra; /** A resource or the video was opened (engagement). */ onOpen?: (what: { key: string; title: string; url: string }) => void }) {
  const title = (extra.title ?? "").trim();
  const body = (extra.body ?? "").trim();
  if (extra.kind === "video") return <OverviewVideos extra={extra} onOpen={onOpen} />;
  // The hub's Important links are drawn by the hub itself (the same section as the Marketing tab).
  if (extra.kind === "links") return null;
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
  const links = noteLinks(extra);
  if (!title && !body && links.length === 0) return null;
  // A pinned note from the team: an eyebrow, the title, the message in paragraphs, the team's links as buttons,
  // and a short last line set as the sign-off.
  const eyebrow = (extra.eyebrow ?? OVERVIEW_NOTE_EYEBROW).trim();
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paras[paras.length - 1] ?? "";
  const signoff = paras.length >= 2 && last.length <= 60 && !/[.?!:;]$/.test(last) ? paras.pop() : undefined;
  return (
    <div className="prw-sec prw-note" data-room-ov-extra={extra.key} data-kind="text">
      <span className="prw-note-pin" aria-hidden><Pin /></span>
      {eyebrow && <div className="prw-note-eb" data-room-note-eyebrow>{eyebrow}</div>}
      {title && <h3 className="prw-note-t" style={{ fontFamily: BRAND_DISPLAY_STACK }}>{title}</h3>}
      {paras.length > 0 && <div className="prw-note-b">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>}
      {links.length > 0 && (
        <div className="prw-note-links" data-room-note-links>
          {links.map((l, n) => (
            <a
              key={`${l.url}-${n}`}
              className="prw-note-link"
              href={l.url.trim()}
              target="_blank"
              rel="noopener noreferrer"
              title={(l.description ?? "").trim() || undefined}
              onClick={() => onOpen?.({ key: `${extra.key}:${n}`, title: l.title.trim(), url: l.url.trim() })}
            >
              {l.title.trim()} <ArrowUpRight aria-hidden />
            </a>
          ))}
        </div>
      )}
      {signoff && <p className="prw-note-sign" data-room-note-signoff>{signoff}</p>}
    </div>
  );
}

/**
 * A Video section. One video: a plain card ("Watch: name"). More than one: a
 * carousel — "Watch video (1 of 3): name" with a Next button in the header,
 * and back / forward arrows with a dot per video under the player. Only
 * videos that can play here are counted or shown.
 */
function OverviewVideos({ extra, onOpen }: { extra: RoomOverviewExtra; onOpen?: (what: { key: string; title: string; url: string }) => void }) {
  const list = overviewVideos(extra)
    .map((v, n) => ({ v, n, embed: overviewVideoEmbed(v.url) }))
    .filter((x): x is { v: RoomOverviewVideo; n: number; embed: { kind: "file" | "iframe"; src: string } } => !!x.embed);
  const [at, setAt] = useState(0);
  if (list.length === 0) return null;
  const i = Math.min(at, list.length - 1);
  const { v, n, embed } = list[i];
  const name = overviewVideoName(v);
  const body = (v.body ?? "").trim();
  const many = list.length > 1;
  const isLast = i === list.length - 1;
  const go = (to: number) => setAt(Math.max(0, Math.min(list.length - 1, to)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  return (
    <div className={`prw-card prw-sec prw-ovx${many ? " prw-vc" : ""}`} data-room-ov-extra={extra.key} data-kind="video" data-room-video-count={list.length}>
      <h3>
        <span className="prw-ovx-t" aria-live="polite">
          <PlayCircle aria-hidden />
          {many ? (
            <span data-room-video-heading>Watch video <span className="prw-vc-of">({i + 1} of {list.length})</span>: <b>{name}</b></span>
          ) : (
            <span data-room-video-heading>Watch: <b>{name}</b></span>
          )}
        </span>
        {many && (
          <button
            type="button"
            className="prw-vc-next"
            onClick={() => go(isLast ? 0 : i + 1)}
            title={isLast ? `Back to: ${overviewVideoName(list[0].v)}` : `Up next: ${overviewVideoName(list[i + 1].v)}`}
            data-room-video-next
          >
            {isLast ? <>Start again <RotateCcw aria-hidden /></> : <>Next video <ArrowRight aria-hidden /></>}
          </button>
        )}
      </h3>
      <div className="prw-ovx-body">
        {body && <p className="prw-ovx-lede">{body}</p>}
        <div className="prw-ovx-video" key={`${n}-${embed.src}`}>
          {embed.kind === "file" ? (
            <video src={embed.src} controls preload="metadata" playsInline onPlay={() => onOpen?.({ key: many ? `${extra.key}:${n}` : extra.key, title: name, url: embed.src })} />
          ) : (
            <iframe src={embed.src} title={name} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
          )}
        </div>
        {many && (
          <div className="prw-vc-nav" role="group" aria-label="Videos" onKeyDown={onKey} data-room-video-nav>
            <button type="button" className="prw-vc-arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous video">
              <ArrowLeft aria-hidden />
            </button>
            <div className="prw-vc-dots">
              {list.map((x, k) => (
                <button
                  key={x.n}
                  type="button"
                  className={`prw-vc-dot${k === i ? " on" : ""}`}
                  onClick={() => go(k)}
                  aria-label={`Video ${k + 1} of ${list.length}: ${overviewVideoName(x.v)}`}
                  aria-current={k === i ? "true" : undefined}
                  title={overviewVideoName(x.v)}
                />
              ))}
            </div>
            <button type="button" className="prw-vc-arrow" onClick={() => go(i + 1)} disabled={isLast} aria-label="Next video">
              <ArrowRight aria-hidden />
            </button>
          </div>
        )}
      </div>
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
.prw-ovx-t b{font-weight:600}
.prw-vc-of{font-weight:500;color:var(--body);font-variant-numeric:tabular-nums}
.prw-vc-next{flex:none;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--dark);background:#fff;border:1px solid #D4D8D0;border-radius:999px;padding:6px 12px 6px 14px;cursor:pointer;transition:border-color .15s,background .15s}
.prw-card>h3 .prw-vc-next{font-size:12.5px;font-weight:600;color:var(--dark);background:#fff;border:1px solid #D4D8D0;padding:6px 12px 6px 14px}
.prw-vc-next svg{width:14px;height:14px;transition:transform .15s}
.prw-card>h3 .prw-vc-next:hover{border-color:color-mix(in srgb,var(--dark) 40%,transparent);background:color-mix(in srgb,var(--dark) 3%,#fff)}
.prw-vc-next:hover svg{transform:translateX(2px)}
.prw-vc .prw-ovx-video{animation:prw-vc-in .35s ease}
@keyframes prw-vc-in{from{opacity:0}to{opacity:1}}
.prw-vc-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px}
.prw-vc-arrow{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:999px;border:1px solid #D4D8D0;background:#fff;color:var(--dark);padding:0;cursor:pointer;transition:border-color .15s,background .15s,opacity .15s}
.prw-vc-arrow svg{width:16px;height:16px}
.prw-vc-arrow:hover:not(:disabled){border-color:color-mix(in srgb,var(--dark) 40%,transparent);background:color-mix(in srgb,var(--dark) 3%,#fff)}
.prw-vc-arrow:disabled{opacity:.35;cursor:default}
.prw-vc-dots{display:flex;align-items:center;gap:8px}
.prw-vc-dot{width:8px;height:8px;border-radius:999px;border:0;padding:0;background:color-mix(in srgb,var(--dark) 22%,transparent);cursor:pointer;transition:width .25s ease,background .25s ease}
.prw-vc-dot.on{width:26px;background:var(--dark)}
.prw-vc-dot:hover:not(.on){background:color-mix(in srgb,var(--dark) 45%,transparent)}
.prw-vc-arrow:focus-visible,.prw-vc-dot:focus-visible,.prw-vc-next:focus-visible{outline:2px solid var(--dark);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.prw-vc .prw-ovx-video{animation:none}.prw-vc-dot,.prw-vc-next svg{transition:none}}
@media (max-width:640px){.prw-vc-next{padding:6px 10px}.prw-card>h3:has(.prw-vc-next){flex-wrap:wrap;gap:10px}}
.prw-note{position:relative;margin-top:44px;padding:30px 32px 26px;border-radius:14px;border:1px solid color-mix(in srgb,var(--dark) 12%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--dark) 5%,#fff) 0,#fff 140px);box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -16px rgba(16,24,40,.18)}
.prw-note-pin{position:absolute;top:-16px;left:30px;display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--dark);color:#fff;box-shadow:0 0 0 4px var(--paper),0 4px 10px -2px rgba(16,24,40,.25)}
.prw-note-pin svg{width:15px;height:15px;transform:rotate(45deg)}
.prw-note-eb{margin:0 0 8px;font-size:12.5px;font-weight:600;color:color-mix(in srgb,var(--dark) 72%,var(--body))}
.prw-note-t{margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.015em;color:var(--dark)}
.prw-note-b p{margin:0 0 12px;font-size:15px;line-height:1.7;color:var(--ink);max-width:68ch;white-space:pre-line}
.prw-note-b p:last-child{margin-bottom:0}
.prw-note-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.prw-note-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--dark);text-decoration:none;background:color-mix(in srgb,var(--dark) 5%,#fff);border:1px solid color-mix(in srgb,var(--dark) 16%,transparent);border-radius:999px;padding:7px 12px 7px 14px;transition:background .15s,border-color .15s}
.prw-note-link svg{width:14px;height:14px;transition:transform .15s}
.prw-note-link:hover{background:color-mix(in srgb,var(--dark) 9%,#fff);border-color:color-mix(in srgb,var(--dark) 32%,transparent)}
.prw-note-link:hover svg{transform:translate(1px,-1px)}
.prw-note-link:focus-visible{outline:2px solid var(--dark);outline-offset:2px}
.prw-note-sign{display:flex;align-items:center;gap:10px;margin:22px 0 0;padding-top:16px;border-top:1px solid var(--line);font-size:14px;font-weight:600;color:var(--dark);white-space:pre-line}
@media (max-width:640px){.prw-note{padding:28px 20px 22px}.prw-note-pin{left:20px}.prw-note-t{font-size:21px}}
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
