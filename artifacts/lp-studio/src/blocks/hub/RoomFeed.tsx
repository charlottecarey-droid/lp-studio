/**
 * The room's wins feed: share a win with photos, tag people with "@", add
 * emoji, react to a post, and comment. Styles live with the room block
 * (`.prw-*`); this file is the behaviour.
 *
 * Tagging: the page knows people by name and an opaque key only. Picking
 * someone writes "@Their Name" into the text and remembers the key; the
 * server works out who to email.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AtSign, ImagePlus, Loader2, MessageSquare, Smile, SmilePlus, X } from "lucide-react";
import type { RoomPersonRef, RoomReaction, RoomSnapshot, RoomStoreHandle, RoomWin } from "./room-client";

/** Reactions a post can get. Must match the server's list. */
export const FEED_REACTIONS = ["❤️", "👏", "🎉", "🔥", "🙌", "💪"];
/** Emoji offered while writing. */
export const FEED_EMOJI = ["🎉", "👏", "🙌", "🔥", "💪", "❤️", "😀", "😁", "😍", "🤩", "🥳", "😎", "🙏", "👍", "⭐", "🏆", "🚀", "💯", "✅", "📈", "💡", "🤝", "🦷", "👀"];
export const WIN_IMAGE_MAX = 4;
const IMAGE_EDGE = 1600;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const initials = (name: string) => {
  const w = (name ?? "").trim().split(/\s+/).filter((x) => /^[\p{L}\p{N}]/u.test(x));
  return w.length ? ((w[0][0] ?? "") + (w.length > 1 ? (w[w.length - 1][0] ?? "") : "")).toUpperCase() : "";
};

/* ── Pure helpers (unit-tested) ──────────────────────────────────────────── */

/** The "@…" being typed just before the caret, or null. Allows one space so full names can be typed. */
export function mentionQuery(text: string, caret: number): { from: number; q: string } | null {
  const m = /(^|[\s(])@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/.exec(text.slice(0, caret));
  return m ? { from: caret - m[2].length - 1, q: m[2].toLowerCase() } : null;
}

/** People whose name matches what's typed: names that start with it first. */
export function matchPeople(people: RoomPersonRef[], q: string, max = 6): RoomPersonRef[] {
  const hit = people.filter((p) => p.name.toLowerCase().includes(q));
  const starts = (p: RoomPersonRef) => (p.name.toLowerCase().startsWith(q) || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) ? 0 : 1);
  return hit.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name)).slice(0, max);
}

/** Keys of the picked people whose "@Name" is still in the text. */
export function mentionKeys(text: string, picked: RoomPersonRef[]): string[] {
  const lower = text.toLowerCase();
  return [...new Set(picked.filter((p) => lower.includes(`@${p.name.toLowerCase()}`)).map((p) => p.key))];
}

/** Split text into plain runs and tagged names, for highlighting. */
export function splitMentions(text: string, names: string[] | undefined): { text: string; tag: boolean }[] {
  const list = (names ?? []).filter(Boolean);
  if (list.length === 0 || !text) return text ? [{ text, tag: false }] : [];
  const esc = [...list].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text
    .split(new RegExp(`(@(?:${esc.join("|")}))`, "gi"))
    .map((part, i) => ({ text: part, tag: i % 2 === 1 }))
    .filter((p) => p.text);
}

/** Reactions to show: the server's list, or the old like count as hearts. */
export function reactionsOf(win: Pick<RoomWin, "reactions" | "likes" | "liked">): RoomReaction[] {
  if (Array.isArray(win.reactions)) return win.reactions;
  return win.likes > 0 ? [{ emoji: FEED_REACTIONS[0], count: win.likes, mine: win.liked }] : [];
}

/** Scale a picked photo down and re-encode it as JPEG so uploads stay small. Browser only. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    const scale = Math.min(1, IMAGE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ── Building blocks ─────────────────────────────────────────────────────── */

function RichText({ text, mentions }: { text: string; mentions?: string[] }) {
  return (
    <>
      {splitMentions(text, mentions).map((p, i) =>
        p.tag ? (
          <span className="prw-at" key={i} data-room-mention>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** Closes a popover on an outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function EmojiButton({ emoji, label, icon, onPick, className, disabled }: { emoji: string[]; label: string; icon: "write" | "react"; onPick: (e: string) => void; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <span className="prw-pop" ref={ref}>
      <button type="button" className={className} aria-label={label} title={label} aria-expanded={open} disabled={disabled} onClick={() => setOpen((v) => !v)} data-room-emoji={icon}>
        {icon === "react" ? <SmilePlus aria-hidden /> : <Smile aria-hidden />}
      </button>
      {open && (
        <span className={`prw-emoji ${icon}`} role="menu" aria-label={label}>
          {emoji.map((e) => (
            <button
              type="button"
              key={e}
              role="menuitem"
              aria-label={e}
              onClick={() => {
                setOpen(false);
                onPick(e);
              }}
            >
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

interface FeedFieldHandle {
  insert: (text: string) => void;
  startMention: () => void;
}

/** A text field that suggests people after "@". The parent keeps the text and the picked people. */
const FeedField = forwardRef<
  FeedFieldHandle,
  { value: string; onChange: (v: string) => void; people: RoomPersonRef[]; onPick: (p: RoomPersonRef) => void; multiline?: boolean; placeholder?: string; label: string; max: number; autoFocus?: boolean; onSubmit?: () => void }
>(function FeedField({ value, onChange, people, onPick, multiline, placeholder, label, max, autoFocus, onSubmit }, handle) {
  const el = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [query, setQuery] = useState<{ from: number; q: string } | null>(null);
  const [hi, setHi] = useState(0);
  const matches = query ? matchPeople(people, query.q) : [];

  const write = (next: string, caret: number) => {
    const v = next.slice(0, max);
    onChange(v);
    const at = Math.min(caret, v.length);
    setQuery(mentionQuery(v, at));
    setHi(0);
    requestAnimationFrame(() => {
      el.current?.focus();
      el.current?.setSelectionRange(at, at);
    });
  };
  const caretNow = () => el.current?.selectionStart ?? value.length;
  const insert = (text: string) => {
    const c = caretNow();
    write(value.slice(0, c) + text + value.slice(el.current?.selectionEnd ?? c), c + text.length);
  };
  useImperativeHandle(handle, () => ({
    insert,
    startMention: () => {
      const c = caretNow();
      insert(c > 0 && !/\s/.test(value[c - 1]) ? " @" : "@");
    },
  }));
  const choose = (p: RoomPersonRef) => {
    if (!query) return;
    const c = caretNow();
    const text = `@${p.name} `;
    onPick(p);
    write(value.slice(0, query.from) + text + value.slice(c), query.from + text.length);
    setQuery(null);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (matches.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => (h + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(matches[Math.min(hi, matches.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    // Cmd/Ctrl + Enter posts from the big box.
    if (multiline && e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };
  const common = {
    value,
    placeholder,
    maxLength: max,
    "aria-label": label,
    autoFocus,
    onKeyDown,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
      setQuery(mentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
      setHi(0);
    },
    onBlur: () => window.setTimeout(() => setQuery(null), 150),
  };
  return (
    <span className="prw-field">
      {multiline ? <textarea rows={3} ref={(n) => void (el.current = n)} {...common} /> : <input ref={(n) => void (el.current = n)} {...common} />}
      {matches.length > 0 && (
        <span className="prw-people" role="listbox" aria-label="People to mention" data-room-people>
          {matches.map((p, i) => (
            <button type="button" role="option" aria-selected={i === hi} className={i === hi ? "on" : ""} key={p.key} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(p)} onMouseEnter={() => setHi(i)}>
              <i aria-hidden>{initials(p.name) || "·"}</i>
              {p.name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
});

function Photos({ images, onOpen }: { images: string[]; onOpen: (src: string) => void }) {
  if (images.length === 0) return null;
  return (
    <div className={`prw-photos n${Math.min(images.length, 4)}`} data-room-photos={images.length}>
      {images.slice(0, WIN_IMAGE_MAX).map((src) => (
        <button type="button" key={src} onClick={() => onOpen(src)} aria-label="Open photo">
          <img src={src} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="prw-light" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose} data-room-lightbox>
      <button type="button" aria-label="Close" onClick={onClose}>
        <X aria-hidden />
      </button>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/* ── The feed ────────────────────────────────────────────────────────────── */

type Result = { ok: true } | { ok: false; error: string; identityRequired?: boolean };
interface FeedProps {
  snapshot: RoomSnapshot;
  store: RoomStoreHandle | null;
  isEditor: boolean;
  onNeedEmail: () => void;
}

export function WinsView({ snapshot, store, isEditor, onNeedEmail, display }: FeedProps & { display: string }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<RoomPersonRef[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = useRef<FeedFieldHandle>(null);
  const file = useRef<HTMLInputElement>(null);
  const known = !!store && !!snapshot.viewer;
  /** Tools need a known visitor; in the builder they do nothing. */
  const guard = (fn: () => void) => () => {
    if (isEditor) return;
    if (!known) return onNeedEmail();
    fn();
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || !store) return;
    const room = WIN_IMAGE_MAX - images.length;
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (list.length === 0) return;
    setAdding(true);
    setError(files.length > room ? `A post can have up to ${WIN_IMAGE_MAX} photos.` : "");
    for (const f of list) {
      let data: string;
      try {
        data = await shrinkImage(f);
      } catch {
        setError("Couldn't read that photo. Try a JPEG or PNG.");
        continue;
      }
      const r = await store.uploadWinImage(`${f.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`, data);
      if (r.ok) setImages((cur) => (cur.length < WIN_IMAGE_MAX ? [...cur, r.url] : cur));
      else if (r.identityRequired) {
        onNeedEmail();
        break;
      } else setError(r.error);
    }
    setAdding(false);
  };

  const post = async () => {
    const body = text.trim();
    if (isEditor || busy || adding || (!body && images.length === 0)) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    setBusy(true);
    setError("");
    const r = await store.postWin({ body, images, mentions: mentionKeys(body, picked) });
    setBusy(false);
    if (r.ok) {
      setText("");
      setImages([]);
      setPicked([]);
    } else if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };

  return (
    <>
      <div className="prw-hd">
        <div>
          <h2 style={{ fontFamily: display }}>Feed</h2>
        </div>
      </div>
      <form
        className="prw-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void post();
        }}
        data-room-win-compose
      >
        <div className="prw-compose-label">Share an update</div>
        <FeedField ref={field} multiline value={text} onChange={setText} people={snapshot.people ?? []} onPick={(p) => setPicked((cur) => [...cur, p])} label="Share an update" max={1500} onSubmit={() => void post()} />
        {(images.length > 0 || adding) && (
          <div className="prw-pics" data-room-thumbs>
            {images.map((src) => (
              <span key={src}>
                <img src={src} alt="" />
                <button type="button" aria-label="Remove photo" onClick={() => setImages((cur) => cur.filter((s) => s !== src))}>
                  <X aria-hidden />
                </button>
              </span>
            ))}
            {adding && (
              <span className="wait" aria-label="Adding photo">
                <Loader2 aria-hidden />
              </span>
            )}
          </div>
        )}
        <div className="prw-ctools">
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          <button type="button" className="tool" aria-label="Add photos" title="Add photos" disabled={adding || images.length >= WIN_IMAGE_MAX} onClick={guard(() => file.current?.click())} data-room-add-photo>
            <ImagePlus aria-hidden />
            <span>Photo</span>
          </button>
          <EmojiButton emoji={FEED_EMOJI} label="Add an emoji" icon="write" className="tool" onPick={(e) => field.current?.insert(e)} />
          <button type="button" className="tool" aria-label="Mention someone" title="Mention someone" onClick={guard(() => field.current?.startMention())} data-room-add-mention>
            <AtSign aria-hidden />
          </button>
          <span className="sp" />
          <button type="submit" className="prw-btn pri" disabled={busy || adding || (!text.trim() && images.length === 0)}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
      {error && (
        <div className="prw-err" role="alert">
          {error}
        </div>
      )}
      {snapshot.wins.length === 0 && (
        <div className="prw-card" style={{ marginTop: 16 }}>
          <div className="prw-empty">No posts yet.</div>
        </div>
      )}
      {snapshot.wins.map((w) => (
        <WinCard key={w.id} win={w} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={onNeedEmail} />
      ))}
    </>
  );
}

function WinCard({ win, snapshot, store, isEditor, onNeedEmail }: FeedProps & { win: RoomWin }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<RoomPersonRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const field = useRef<FeedFieldHandle>(null);
  const act = async (fn: (s: RoomStoreHandle) => Promise<Result>): Promise<boolean> => {
    if (isEditor || busy) return false;
    if (!store || !snapshot.viewer) {
      onNeedEmail();
      return false;
    }
    setBusy(true);
    const r = await fn(store);
    setBusy(false);
    if (!r.ok && r.identityRequired) onNeedEmail();
    return r.ok;
  };
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (await act((s) => s.commentWin(win.id, body, mentionKeys(body, picked)))) {
      setText("");
      setPicked([]);
    }
  };
  const reactions = reactionsOf(win);
  const images = win.images ?? [];
  return (
    <div className="prw-win" data-room-win={win.side}>
      <div className="wt">
        <span className={`wa ${win.side === "team" ? "team" : ""}`}>{initials(win.by) || "·"}</span>
        <div className="ww">
          <b>{win.by}</b>
          <span>
            {fmtDate(win.createdAt)}
            {win.region ? ` · ${win.region}` : ""}
          </span>
        </div>
      </div>
      {(win.headline || win.body) && (
        <div className="wb">
          {win.headline && <span className="big">{win.headline}</span>}
          <RichText text={win.body} mentions={win.mentions} />
        </div>
      )}
      <Photos images={images} onOpen={setZoom} />
      <div className="wx">
        {reactions.map((r) => (
          <button type="button" key={r.emoji} className={`rx${r.mine ? " on" : ""}`} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}${r.mine ? ", remove yours" : ""}`} onClick={() => void act((s) => s.likeWin(win.id, r.emoji))} data-room-reaction={r.emoji}>
            <span aria-hidden>{r.emoji}</span> {r.count}
          </button>
        ))}
        <EmojiButton emoji={FEED_REACTIONS} label="React" icon="react" onPick={(e) => void act((s) => s.likeWin(win.id, e))} />
        <button type="button" onClick={() => setCommenting((v) => !v)} aria-label="Comment" aria-expanded={commenting}>
          <MessageSquare aria-hidden /> {win.comments.length}
        </button>
      </div>
      {win.comments.map((c) => (
        <div className="wc" key={c.id}>
          <b>{c.by}</b> · <RichText text={c.body} mentions={c.mentions} />
        </div>
      ))}
      {commenting && (
        <form
          className="prw-cbox"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <FeedField ref={field} value={text} onChange={setText} people={snapshot.people ?? []} onPick={(p) => setPicked((cur) => [...cur, p])} label="Write a comment" max={1000} autoFocus />
          <EmojiButton emoji={FEED_EMOJI} label="Add an emoji" icon="write" className="tool" onPick={(e) => field.current?.insert(e)} />
          <button type="submit" className="prw-btn" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
