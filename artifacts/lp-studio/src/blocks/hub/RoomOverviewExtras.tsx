import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode, type TouchEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, Columns2, ExternalLink, Eye, EyeOff, GripVertical, Link2, Pin, PlayCircle, Plus, RotateCcw, Square, StickyNote } from "lucide-react";
import { BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { extractWistiaId } from "@/lib/wistia";
import { isNativeVideoUrl } from "@/lib/video-utils";

/**
 * The team's own sections on a hub's Overview, beside the built-in ones
 * (progress, next steps, coming up…): a video (or several, as a carousel),
 * the hub's Important links, a list of resources (older hubs), or a pinned
 * note. Each can be placed anywhere on the Overview (roomOverviewLayout.ts),
 * set beside the section before it, and hidden from the customer without
 * deleting it.
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
  /** A picture for the "Up next" strip. Blank: taken from the video where the host allows (YouTube, Loom, a file). */
  thumbnailUrl?: string;
}

/** Who a pinned note is signed by, from the hub's Team. */
export interface OverviewSigner {
  name: string;
  role?: string;
  photoUrl?: string;
}

/** What a section needs from the hub around it. */
export interface OverviewViewCtx {
  /** The visitor's first name, or the customer's name when it isn't known (fills {first name}). */
  firstName: string;
  /** Who a pinned note is signed by, when anyone. */
  signerFor: (extra: RoomOverviewExtra) => OverviewSigner | null;
  /** Per-hub key for this visitor's own memory (which videos they have watched). */
  storageKey: string;
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
  /** Note: who signs it, by name from the hub's Team. Unset = the first person on the team (the account owner); empty = no one. */
  signedBy?: string;
  /** Note: when it was pinned or last changed (ISO), shown as "Pinned Nov 22". Unset = no date. */
  pinnedAt?: string;
  /** Note: leave the date off. */
  hideDate?: boolean;
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
  if (kind === "video") return { key, kind, title: "Welcome from your team", videos: [{ title: "Welcome from your team", url: "" }], position: "top" };
  if (kind === "links") return { key, kind, title: "Important links", position: "bottom" };
  if (kind === "resources") return { key, kind, title: "Resources", items: [{ title: "", url: "" }], position: "bottom" };
  return { key, kind, title: "A note from your team", body: "", eyebrow: OVERVIEW_NOTE_EYEBROW, items: [], pinnedAt: new Date().toISOString(), position: "top" };
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

/** Inline text editing, supplied by the hub in the builder (absent on the live page). */
export type OverviewTextEditor = (p: { item: object; field: string; multiline?: boolean; placeholder?: string; touch?: Record<string, unknown> }) => ReactNode;

/** Fill {first name} (any spacing or case, also {firstName}) with the visitor's first name. */
export function fillFirstName(text: string, firstName: string): string {
  return text.replace(/\{\s*first[\s_]*name\s*\}/gi, firstName);
}

/** "Pinned Nov 22" from an ISO date; empty when there is none. */
export function pinnedLabel(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return `Pinned ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * Split a note's message into paragraphs and, when the last one is a short
 * line that doesn't end a sentence ("Your Dandy Account Team"), its sign-off.
 */
export function splitNote(body: string): { paras: string[]; signoff?: string } {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paras[paras.length - 1] ?? "";
  const signoff = paras.length >= 2 && last.length <= 60 && !/[.?!:;]$/.test(last) ? paras.pop() : undefined;
  return { paras, signoff };
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** One of the team's own sections, as the customer sees it. Nothing is drawn while it has nothing to show. */
export function OverviewExtraView({
  extra,
  onOpen,
  ctx,
  T,
}: {
  extra: RoomOverviewExtra;
  /** A resource or a video was opened (engagement). */
  onOpen?: (what: { key: string; title: string; url: string }) => void;
  ctx?: OverviewViewCtx;
  /** Builder only: edit the note's words where they are. */
  T?: OverviewTextEditor;
}) {
  const title = (extra.title ?? "").trim();
  const body = (extra.body ?? "").trim();
  if (extra.kind === "video") return <OverviewVideos extra={extra} onOpen={onOpen} storageKey={ctx?.storageKey ?? ""} />;
  // The hub's Important links are drawn by the hub itself (the same rows as the Marketing tab).
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
  return <PinnedNote extra={extra} onOpen={onOpen} ctx={ctx} T={T} />;
}

/**
 * A pinned note from the team: a pin on the top edge, an eyebrow with the date,
 * the title, the message in paragraphs ({first name} filled in), the team's
 * links as buttons, and a sign-off with the signer's photo (or initials) and role.
 * In the builder the eyebrow, title and message are edited where they are.
 */
function PinnedNote({ extra, onOpen, ctx, T }: { extra: RoomOverviewExtra; onOpen?: (what: { key: string; title: string; url: string }) => void; ctx?: OverviewViewCtx; T?: OverviewTextEditor }) {
  const first = ctx?.firstName ?? "";
  const editing = !!T;
  const title = editing ? (extra.title ?? "") : fillFirstName((extra.title ?? "").trim(), first);
  const body = editing ? (extra.body ?? "") : fillFirstName((extra.body ?? "").trim(), first);
  const links = noteLinks(extra);
  const signer = ctx?.signerFor(extra) ?? null;
  if (!editing && !title && !body && links.length === 0) return null;
  const eyebrow = (extra.eyebrow ?? OVERVIEW_NOTE_EYEBROW).trim();
  const date = extra.hideDate ? "" : pinnedLabel(extra.pinnedAt);
  const { paras, signoff } = splitNote(body);
  // Any change made here moves the note's date on, as a change made in the panel does.
  const touch = { pinnedAt: new Date().toISOString() };
  return (
    <div className="prw-sec prw-note" data-room-ov-extra={extra.key} data-kind="text">
      <span className="prw-note-pin" aria-hidden><Pin /></span>
      {(eyebrow || date || editing) && (
        <div className="prw-note-eb">
          {editing ? (
            // Unset shows the default the customer sees (as a hint, typing replaces it); cleared means none.
            <span data-room-note-eyebrow>{T({ item: extra, field: "eyebrow", placeholder: extra.eyebrow === undefined ? OVERVIEW_NOTE_EYEBROW : "No eyebrow (click to add one)" })}</span>
          ) : (
            eyebrow && <span data-room-note-eyebrow>{eyebrow}</span>
          )}
          {date && <span className="d" data-room-note-date>{date}</span>}
        </div>
      )}
      {(title || editing) && <h3 className="prw-note-t" style={{ fontFamily: BRAND_DISPLAY_STACK }}>{editing ? T({ item: extra, field: "title", placeholder: "Title", touch }) : title}</h3>}
      {editing ? (
        <div className="prw-note-b"><p>{T({ item: extra, field: "body", multiline: true, placeholder: "Your message. Shift+Enter for a new line.", touch })}</p></div>
      ) : (
        paras.length > 0 && <div className="prw-note-b">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
      )}
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
      {signer ? (
        <div className="prw-note-sign who" data-room-note-signer={signer.name}>
          <span className="prw-note-av" aria-hidden>
            {signer.photoUrl ? <img src={signer.photoUrl} alt="" /> : initialsOf(signer.name)}
          </span>
          <span className="who-t">
            <b>{signer.name}</b>
            {(signer.role || (!editing && signoff)) && <span>{[signer.role, editing ? "" : signoff].filter(Boolean).join(" · ")}</span>}
          </span>
        </div>
      ) : (
        !editing && signoff && <p className="prw-note-sign" data-room-note-signoff>{signoff}</p>
      )}
    </div>
  );
}

/** Where a video's picture for the "Up next" strip comes from. */
export function overviewVideoThumb(v: RoomOverviewVideo): { kind: "img" | "video"; src: string } | null {
  const own = (v.thumbnailUrl ?? "").trim();
  if (own) return { kind: "img", src: own };
  const url = (v.url ?? "").trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { kind: "img", src: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  const loom = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/);
  if (loom) return { kind: "img", src: `https://cdn.loom.com/sessions/thumbnails/${loom[1]}-00001.jpg` };
  const e = overviewVideoEmbed(url);
  // A file shows its own first frames.
  if (e?.kind === "file") return { kind: "video", src: `${e.src}#t=1` };
  return null;
}

const WATCHED_PREFIX = "prw-watched:";
function readWatched(storageKey: string): Set<string> {
  if (!storageKey) return new Set();
  try {
    const raw = window.localStorage.getItem(WATCHED_PREFIX + storageKey);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function writeWatched(storageKey: string, ids: Set<string>) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(WATCHED_PREFIX + storageKey, JSON.stringify([...ids].slice(-200)));
  } catch {
    // Private window or storage blocked: the ticks just don't survive a reload.
  }
}

/**
 * A Video section. One video: a plain card ("Watch: name"). More than one: a
 * carousel — "Watch video (1 of 3): name" with a Next button in the header,
 * the player, and an "Up next" strip of pictures between back / forward
 * arrows, each ticked once this visitor has watched it (remembered in their
 * browser). Swiping left or right off the player changes video on a phone.
 * Only videos that can play here are counted or shown.
 *
 * Plays are counted for every player: a file when it starts, an embedded
 * player (YouTube, Vimeo, Loom, Wistia) when the visitor clicks into it.
 */
function OverviewVideos({ extra, onOpen, storageKey }: { extra: RoomOverviewExtra; onOpen?: (what: { key: string; title: string; url: string }) => void; storageKey: string }) {
  const list = overviewVideos(extra)
    .map((v, n) => ({ v, n, embed: overviewVideoEmbed(v.url) }))
    .filter((x): x is { v: RoomOverviewVideo; n: number; embed: { kind: "file" | "iframe"; src: string } } => !!x.embed);
  const [at, setAt] = useState(0);
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  const counted = useRef<Set<string>>(new Set());
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const memoryKey = storageKey ? `${storageKey}:${extra.key}` : "";
  const i = Math.min(at, Math.max(0, list.length - 1));
  const cur = list[i];
  const idOf = (x: { v: RoomOverviewVideo }) => (x.v.url ?? "").trim();

  // This visitor's ticks, read after mount (the server render has none).
  useEffect(() => setWatched(readWatched(memoryKey)), [memoryKey]);

  // Keep the current picture in view in the strip, without moving the page.
  useEffect(() => {
    const strip = stripRef.current;
    const item = strip?.querySelector<HTMLElement>(`[data-vc-i="${i}"]`);
    if (!strip || !item) return;
    const left = item.offsetLeft - (strip.clientWidth - item.clientWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [i]);

  const many = list.length > 1;
  const played = () => {
    if (!cur) return;
    const id = idOf(cur);
    const name = overviewVideoName(cur.v);
    if (!counted.current.has(id)) {
      counted.current.add(id);
      onOpen?.({ key: many ? `${extra.key}:${cur.n}` : extra.key, title: name, url: cur.embed.src });
    }
    if (!watched.has(id)) {
      const next = new Set(watched).add(id);
      setWatched(next);
      writeWatched(memoryKey, next);
    }
  };

  // An embedded player can't tell the page it started, but clicking into it moves focus to the frame: count that.
  useEffect(() => {
    if (!cur || cur.embed.kind !== "iframe") return;
    const onBlur = () => {
      window.setTimeout(() => {
        if (document.activeElement && document.activeElement === frameRef.current) played();
      }, 0);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- played reads the current video; re-arm per video.
  }, [cur?.embed.src, cur?.n]);

  if (!cur) return null;
  const { v, n, embed } = cur;
  const name = overviewVideoName(v);
  const body = (v.body ?? "").trim();
  const isLast = i === list.length - 1;
  const go = (to: number) => setAt(Math.max(0, Math.min(list.length - 1, to)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!many || !start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? i + 1 : i - 1);
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
      <div className="prw-ovx-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {body && <p className="prw-ovx-lede">{body}</p>}
        <div className="prw-ovx-video" key={`${n}-${embed.src}`}>
          {embed.kind === "file" ? (
            <video src={embed.src} controls preload="metadata" playsInline onPlay={played} />
          ) : (
            <iframe ref={frameRef} src={embed.src} title={name} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" />
          )}
        </div>
        {many && (
          <div className="prw-vc-nav" role="group" aria-label="Videos" onKeyDown={onKey} data-room-video-nav>
            <button type="button" className="prw-vc-arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous video">
              <ArrowLeft aria-hidden />
            </button>
            <div className="prw-vc-strip" ref={stripRef} data-room-video-strip>
              {list.map((x, k) => {
                const thumb = overviewVideoThumb(x.v);
                const seen = watched.has(idOf(x));
                const xName = overviewVideoName(x.v);
                return (
                  <button
                    key={x.n}
                    type="button"
                    data-vc-i={k}
                    className={`prw-vc-item${k === i ? " on" : ""}`}
                    onClick={() => go(k)}
                    aria-label={`Video ${k + 1} of ${list.length}: ${xName}${seen ? " (watched)" : ""}`}
                    aria-current={k === i ? "true" : undefined}
                    data-room-video-watched={seen ? "" : undefined}
                  >
                    <span className="th">
                      {thumb?.kind === "img" ? (
                        <img src={thumb.src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : thumb?.kind === "video" ? (
                        <video src={thumb.src} preload="metadata" muted playsInline tabIndex={-1} aria-hidden />
                      ) : null}
                      <span className="ph" aria-hidden><PlayCircle /></span>
                      {k === i ? <span className="now">Now playing</span> : seen ? <span className="seen" aria-hidden><Check /></span> : null}
                    </span>
                    <span className="nm"><span className="ix">{k + 1}</span>{xName}</span>
                  </button>
                );
              })}
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
 * Builder only: one section of the Overview as the customer sees it, with its
 * tools on hover — a drag handle, up / down, side by side, and Hide. Drop
 * another section on it to place that one above or below it.
 */
export function OverviewUnitFrame({
  unitKey,
  label,
  onHide,
  onUp,
  onDown,
  beside,
  onBeside,
  onDrop,
  children,
}: {
  unitKey: string;
  label: string;
  /** Absent for a unit hidden part by part (Next steps & coming up). */
  onHide?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** Whether it sits beside the section before it; absent when it can't. */
  beside?: boolean;
  onBeside?: () => void;
  onDrop: (dragged: string, where: "before" | "after") => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drop, setDrop] = useState<"before" | "after" | null>(null);
  const whereFor = (e: DragEvent) => {
    const r = ref.current?.getBoundingClientRect();
    return r && e.clientY > r.top + r.height / 2 ? "after" : "before";
  };
  return (
    <div
      ref={ref}
      className={`prw-ovedit${drop ? ` drop-${drop}` : ""}`}
      data-room-ov-edit={label}
      data-room-ov-unit={unitKey}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/x-prw-unit")) return;
        e.preventDefault();
        setDrop(whereFor(e));
      }}
      onDragLeave={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setDrop(null);
      }}
      onDrop={(e) => {
        const dragged = e.dataTransfer.getData("text/x-prw-unit");
        setDrop(null);
        if (!dragged || dragged === unitKey) return;
        e.preventDefault();
        onDrop(dragged, whereFor(e));
      }}
    >
      <div className="prw-ovtools" role="toolbar" aria-label={`${label}: arrange`}>
        <span
          className="grip"
          draggable
          title="Drag to move"
          aria-hidden
          onDragStart={(e) => {
            e.dataTransfer.setData("text/x-prw-unit", unitKey);
            e.dataTransfer.effectAllowed = "move";
            if (ref.current) e.dataTransfer.setDragImage(ref.current, 24, 16);
          }}
        >
          <GripVertical />
        </span>
        <button type="button" onClick={onUp} disabled={!onUp} title="Move up" aria-label={`Move ${label} up`}><ArrowUp aria-hidden /></button>
        <button type="button" onClick={onDown} disabled={!onDown} title="Move down" aria-label={`Move ${label} down`}><ArrowDown aria-hidden /></button>
        {onBeside && (
          <button type="button" onClick={onBeside} aria-pressed={!!beside} title={beside ? "Full width" : "Side by side with the section before"} aria-label={beside ? `Make ${label} full width` : `Put ${label} beside the section before`}>
            {beside ? <Square aria-hidden /> : <Columns2 aria-hidden />}
          </button>
        )}
        {onHide && (
          <button type="button" className="hide" onClick={onHide} title={`Hide “${label}” from the customer`} aria-label={`Hide ${label} on the Overview`}>
            <EyeOff aria-hidden /> Hide
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Kept for the parts inside Next steps & coming up, which hide one by one. */
export function OverviewEditFrame({ label, onHide, children }: { label: string; onHide: () => void; children: ReactNode }) {
  return (
    <div className="prw-ovedit prw-ovpart" data-room-ov-edit={label}>
      <button type="button" className="prw-ovedit-hide" onClick={onHide} title={`Hide “${label}” from the customer`} aria-label={`Hide ${label} on the Overview`}>
        <EyeOff aria-hidden /> Hide
      </button>
      {children}
    </div>
  );
}

const ADD_KIND_ICON: Record<"video" | "links" | "text", ReactNode> = { video: <PlayCircle aria-hidden />, links: <Link2 aria-hidden />, text: <StickyNote aria-hidden /> };
const ADD_KIND_HINT: Record<"video" | "links" | "text", string> = {
  video: "One video, or several as a carousel",
  links: "The same links as the Marketing tab",
  text: "A message from your team, with links",
};

/**
 * Builder only: "+ Add section" between two sections of the Overview. Opens a
 * short menu of what can go there; the new section lands right at that spot.
 */
export function OverviewAddBar({ kinds, onAdd, always }: { kinds: ("video" | "links" | "text")[]; onAdd: (kind: "video" | "links" | "text") => void; /** The last bar: always visible, not only on hover. */ always?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | globalThis.KeyboardEvent) => {
      if (e instanceof MouseEvent ? !ref.current?.contains(e.target as Node) : e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (kinds.length === 0) return null;
  return (
    <div ref={ref} className={`prw-ovadd${always || open ? " show" : ""}`} data-room-ov-add-bar>
      <button type="button" className="open" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus aria-hidden /> Add section
      </button>
      {open && (
        <div className="menu" role="menu">
          {kinds.map((k) => (
            <button key={k} type="button" role="menuitem" onClick={() => { setOpen(false); onAdd(k); }} data-room-ov-add-kind={k}>
              {ADD_KIND_ICON[k]}
              <span><b>{OVERVIEW_EXTRA_LABEL[k]}</b><span>{ADD_KIND_HINT[k]}</span></span>
            </button>
          ))}
        </div>
      )}
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
.prw-vc-arrow{flex:none}
.prw-vc-strip{flex:1;min-width:0;display:flex;justify-content:safe center;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px;scrollbar-width:thin}
.prw-vc-item{flex:0 0 136px;scroll-snap-align:center;display:flex;flex-direction:column;gap:6px;padding:0;border:0;background:none;text-align:left;cursor:pointer;color:var(--ink)}
.prw-vc-item .th{position:relative;display:block;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--dark) 10%,#fff);border:1px solid var(--line);transition:border-color .15s,box-shadow .15s}
.prw-vc-item .th img,.prw-vc-item .th video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.prw-vc-item .ph{position:absolute;inset:0;display:grid;place-items:center;color:color-mix(in srgb,var(--dark) 55%,transparent)}
.prw-vc-item .th img+.ph,.prw-vc-item .th video+.ph{color:#fff;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.35))}
.prw-vc-item .ph svg{width:22px;height:22px}
.prw-vc-item .now{position:absolute;left:6px;bottom:6px;font-size:10.5px;font-weight:600;color:#fff;background:var(--dark);border-radius:999px;padding:2px 8px}
.prw-vc-item .seen{position:absolute;right:6px;top:6px;display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:var(--green);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.prw-vc-item .seen svg{width:12px;height:12px;stroke-width:3}
.prw-vc-item .nm{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.35;font-weight:500;color:var(--body)}
.prw-vc-item .ix{font-variant-numeric:tabular-nums;font-weight:600;color:var(--faint);margin-right:6px}
.prw-vc-item.on .th{border-color:var(--dark);box-shadow:0 0 0 1px var(--dark)}
.prw-vc-item.on .nm{color:var(--ink);font-weight:600}
.prw-vc-item:hover:not(.on) .th{border-color:color-mix(in srgb,var(--dark) 35%,transparent)}
.prw-vc-arrow:focus-visible,.prw-vc-item:focus-visible,.prw-vc-next:focus-visible{outline:2px solid var(--dark);outline-offset:2px;border-radius:8px}
@media (prefers-reduced-motion:reduce){.prw-vc .prw-ovx-video{animation:none}.prw-vc-item .th,.prw-vc-next svg{transition:none}}
@media (max-width:640px){.prw-vc-next{padding:6px 10px}.prw-card>h3:has(.prw-vc-next){flex-wrap:wrap;gap:10px}.prw-vc-item{flex-basis:112px}.prw-vc-nav{gap:8px}.prw-vc-arrow{width:34px;height:34px}}
.prw-note{position:relative;margin-top:44px;padding:30px 32px 26px;border-radius:14px;border:1px solid color-mix(in srgb,var(--dark) 12%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--dark) 5%,#fff) 0,#fff 140px);box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -16px rgba(16,24,40,.18)}
.prw-note-pin{position:absolute;top:-16px;left:30px;display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--dark);color:#fff;box-shadow:0 0 0 4px var(--paper),0 4px 10px -2px rgba(16,24,40,.25)}
.prw-note-pin svg{width:15px;height:15px;transform:rotate(45deg)}
.prw-note-eb{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 8px;font-size:12.5px;font-weight:600;color:color-mix(in srgb,var(--dark) 72%,var(--body))}
.prw-note-eb .d{flex:none;font-size:12px;font-weight:500;color:var(--faint)}
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
.prw-note-sign.who{gap:12px}
.prw-note-av{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--dark) 10%,#fff);color:var(--dark);font-size:13.5px;font-weight:700;letter-spacing:.02em;box-shadow:0 0 0 2px #fff,0 0 0 3px color-mix(in srgb,var(--dark) 14%,transparent)}
.prw-note-av img{width:100%;height:100%;object-fit:cover}
.prw-note-sign .who-t{display:flex;flex-direction:column;gap:1px;min-width:0}
.prw-note-sign .who-t b{font-size:14px;font-weight:600;color:var(--ink)}
.prw-note-sign .who-t span{font-size:12.5px;font-weight:500;color:var(--body)}
@media (max-width:640px){.prw-note{padding:28px 20px 22px}.prw-note-pin{left:20px}.prw-note-t{font-size:21px}}
.prw-ovx-link{text-decoration:none;color:inherit}
.prw-ovx-link:hover{background:color-mix(in srgb,var(--dark) 3%,transparent)}
.prw-ovx-link .a svg{width:15px;height:15px;color:var(--faint)}
.prw-ovedit{position:relative}
.prw-ovedit-hide{position:absolute;top:-13px;right:14px;z-index:3;display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--body);background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 10px;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.06);opacity:0;transition:opacity .15s}
.prw-ovedit-hide svg{width:13px;height:13px}
.prw-ovpart:hover>.prw-ovedit-hide,.prw-ovedit-hide:focus-visible{opacity:1}
.prw-ovedit-hide:hover{color:var(--ink);border-color:color-mix(in srgb,var(--dark) 30%,transparent)}
.prw-ovpart:hover>:not(.prw-ovedit-hide){box-shadow:0 0 0 2px color-mix(in srgb,var(--dark) 14%,transparent);border-radius:12px}
.prw-ovtools{position:absolute;top:-15px;right:14px;z-index:4;display:inline-flex;align-items:center;gap:2px;padding:3px;background:#fff;border:1px solid var(--line);border-radius:999px;box-shadow:0 2px 8px -2px rgba(16,24,40,.14);opacity:0;transition:opacity .15s}
.prw-ovedit[data-room-ov-unit]:hover>.prw-ovtools,.prw-ovtools:focus-within{opacity:1}
.prw-ovtools button,.prw-ovtools .grip{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:26px;min-width:26px;padding:0 6px;border:0;border-radius:999px;background:none;color:var(--body);font-size:12px;font-weight:600;cursor:pointer}
.prw-ovtools .grip{cursor:grab}
.prw-ovtools svg{width:14px;height:14px}
.prw-ovtools button:hover:not(:disabled),.prw-ovtools .grip:hover{background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--ink)}
.prw-ovtools button:disabled{opacity:.35;cursor:default}
.prw-ovtools button[aria-pressed="true"]{color:var(--dark);background:color-mix(in srgb,var(--dark) 9%,#fff)}
.prw-ovtools .hide{border-left:1px solid var(--line);border-radius:0 999px 999px 0;padding:0 10px 0 8px}
.prw-ovedit[data-room-ov-unit]:hover>:not(.prw-ovtools){box-shadow:0 0 0 2px color-mix(in srgb,var(--dark) 14%,transparent);border-radius:12px}
.prw-ovedit.drop-before::before,.prw-ovedit.drop-after::after{content:"";position:absolute;left:0;right:0;height:3px;border-radius:3px;background:var(--dark);z-index:5}
.prw-ovedit.drop-before::before{top:-18px}
.prw-ovedit.drop-after::after{bottom:-18px}
.prw-ovrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start;margin-top:44px}
.prw-ovrow .prw-sec{margin-top:0}
@media (max-width:900px){.prw-ovrow{grid-template-columns:1fr;gap:44px}}
.prw-ovadd{position:relative;display:flex;justify-content:center;height:22px;margin:10px 0 -14px}
.prw-ovadd::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed color-mix(in srgb,var(--dark) 22%,transparent);opacity:0;transition:opacity .15s}
.prw-ovadd .open{position:relative;display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 10px;font-size:12px;font-weight:600;color:var(--dark);background:var(--paper);border:1px solid color-mix(in srgb,var(--dark) 22%,transparent);border-radius:999px;cursor:pointer;opacity:0;transition:opacity .15s}
.prw-ovadd .open svg{width:13px;height:13px}
.prw-ovadd:hover::before,.prw-ovadd.show::before,.prw-ovadd:hover .open,.prw-ovadd.show .open,.prw-ovadd .open:focus-visible{opacity:1}
.prw-ovadd.show{margin:28px 0 0}
.prw-ovadd .menu{position:absolute;top:28px;z-index:10;display:flex;flex-direction:column;min-width:280px;padding:6px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px -8px rgba(16,24,40,.22)}
.prw-ovadd .menu button{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border:0;border-radius:8px;background:none;text-align:left;cursor:pointer;color:var(--ink)}
.prw-ovadd .menu button:hover,.prw-ovadd .menu button:focus-visible{background:color-mix(in srgb,var(--dark) 6%,#fff);outline:none}
.prw-ovadd .menu svg{flex:none;width:16px;height:16px;margin-top:2px;color:var(--dark)}
.prw-ovadd .menu b{display:block;font-size:13px;font-weight:600}
.prw-ovadd .menu span>span{display:block;font-size:12px;color:var(--body)}
.prw-ovhidden{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:20px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;background:#fff}
.prw-ovhidden .lbl{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--body);margin-right:4px}
.prw-ovhidden .lbl svg{width:14px;height:14px}
.prw-ovhidden button{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:4px 6px 4px 12px;cursor:pointer}
.prw-ovhidden button .go{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:#fff;background:var(--dark);border-radius:999px;padding:2px 8px}
.prw-ovhidden button .go svg{width:12px;height:12px}
.prw-ovhidden button:hover{border-color:color-mix(in srgb,var(--dark) 30%,transparent)}
.prw-ovedit-empty{border:1px dashed var(--line);border-radius:12px;padding:18px 24px;font-size:13px;color:var(--body);background:#fff}
`;
