import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Mail, Upload, X } from "lucide-react";
import { HUB_BODY, HUB_PILL_SM_CLASS, hubDisplayStyle, hubPillStyle, type HubPalette } from "@/lib/hub-theme";
import { ROOM_UPLOAD_ACCEPT, type RoomSnapshot, type RoomTaskState, useRoom } from "./room-client";

/* ----------------------------------------------------------------------------
 * Partner room controls for a hub-plan task the customer can act on:
 *   "check"  → a Mark done button (and Undo)
 *   "upload" → an Upload file button (and Replace); the file goes one way —
 *              the page only ever shows that it was received.
 * Acting needs a known visitor. Someone without a personal link is asked for
 * their work email once (RoomAccessDialog) and gets a link by email.
 * -------------------------------------------------------------------------- */

type RoomStore = NonNullable<ReturnType<typeof useRoom>["store"]>;

export function formatRoomDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The line under a completed task: what was received / who marked it, and when. */
export function roomTaskSummary(action: "check" | "upload", state: RoomTaskState | undefined): string {
  if (!state?.done) return "";
  const when = formatRoomDate(state.at);
  const parts = action === "upload" ? [state.fileName ? `Received ${state.fileName}` : "File received"] : ["Marked done"];
  if (state.by) parts.push(`by ${state.by}`);
  if (when) parts.push(when);
  return parts.join(" · ");
}

export function RoomTaskControls({
  action,
  taskKey,
  taskTitle,
  uploadLabel,
  palette,
  snapshot,
  store,
  isEditor,
}: {
  action: "check" | "upload";
  taskKey: string;
  taskTitle: string;
  uploadLabel?: string;
  palette: HubPalette;
  snapshot: RoomSnapshot;
  store: RoomStore | null;
  isEditor: boolean;
}) {
  const state = snapshot.tasks[taskKey];
  const done = !!state?.done;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [askEmail, setAskEmail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inert = isEditor || !store;

  const run = async (fn: (s: RoomStore) => Promise<{ ok: true } | { ok: false; error: string; identityRequired?: boolean }>) => {
    if (!store) return;
    setBusy(true);
    setError("");
    const r = await fn(store);
    setBusy(false);
    if (r.ok) return;
    if (r.identityRequired) setAskEmail(true);
    else setError(r.error);
  };

  const onPrimary = () => {
    if (inert || busy) return;
    if (!snapshot.viewer) {
      setAskEmail(true);
      return;
    }
    if (action === "upload") fileRef.current?.click();
    else void run((s) => s.setTaskDone(taskKey, !done));
  };

  const label =
    action === "upload" ? (done ? "Replace file" : (uploadLabel ?? "").trim() || "Upload file") : done ? "Undo" : "Mark done";
  const Icon = busy ? Loader2 : action === "upload" ? Upload : Check;
  const summary = roomTaskSummary(action, state);
  // After completion the button steps back: a quiet text link, visible only to a known visitor.
  const showButton = !done || !!snapshot.viewer || isEditor;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5" data-hub-task-action={action}>
      {summary && (
        <span className="text-[13px]" style={{ color: palette.muted }} data-hub-task-summary>
          {summary}
        </span>
      )}
      {showButton &&
        (done ? (
          <button type="button" onClick={onPrimary} disabled={busy} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium underline underline-offset-2" style={{ color: palette.accent, fontFamily: HUB_BODY }}>
            {busy ? "Working…" : label}
          </button>
        ) : (
          <button type="button" onClick={onPrimary} disabled={busy} className={`${HUB_PILL_SM_CLASS} cursor-pointer`} style={{ ...hubPillStyle(palette, "ghost", "sm"), fontFamily: HUB_BODY, opacity: busy ? 0.7 : 1 }}>
            <Icon className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
            {busy ? (action === "upload" ? "Uploading…" : "Saving…") : label}
          </button>
        ))}
      {action === "upload" && !inert && (
        <input
          ref={fileRef}
          type="file"
          accept={ROOM_UPLOAD_ACCEPT}
          className="hidden"
          aria-label={`Upload a file for ${taskTitle}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run((s) => s.upload(taskKey, file));
          }}
        />
      )}
      {error && (
        <span role="alert" className="basis-full text-[13px]" style={{ color: palette.isDark ? "#FCA5A5" : "#B42318" }}>
          {error}
        </span>
      )}
      {askEmail && store && <RoomAccessDialog store={store} palette={palette} onClose={() => setAskEmail(false)} />}
    </div>
  );
}

/** "Who are you?" — asks for a work email once and tells the visitor what happens next. */
export function RoomAccessDialog({ store, palette, onClose }: { store: RoomStore; palette: HubPalette; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"sent" | "requested" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await store.requestAccess(email.trim());
    setBusy(false);
    if (r.ok) setResult(r.status);
    else setError(r.error);
  };

  // The dialog is always a light card, whatever surface the section uses.
  const ink = "#0B0B0F";
  const soft = "#5B5F66";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: "rgba(8,12,10,0.55)", fontFamily: HUB_BODY }} onClick={onClose} data-hub-room-access>
      <div role="dialog" aria-modal="true" aria-labelledby="hub-room-access-title" className="relative w-full max-w-[440px] rounded-2xl bg-white p-7 shadow-2xl" style={{ color: ink }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent" style={{ color: soft }}>
          <X className="h-4 w-4" />
        </button>
        {result === null ? (
          <form onSubmit={submit}>
            <h3 id="hub-room-access-title" style={{ ...hubDisplayStyle(palette, "1.5rem"), color: ink }}>
              Confirm it’s you
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: soft }}>
              Enter your work email and we’ll send you a link. Open it once and this browser can upload files and mark tasks done.
            </p>
            <label className="mt-5 block text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: soft }} htmlFor="hub-room-access-email">
              Work email
            </label>
            <input
              id="hub-room-access-email"
              ref={inputRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1.5 w-full rounded-lg px-3.5 py-3 text-[15px] outline-none"
              style={{ border: "1px solid #D5D7DB", color: ink, background: "#fff" }}
            />
            {error && (
              <p role="alert" className="mt-2 text-[13px]" style={{ color: "#B42318" }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className={`${HUB_PILL_SM_CLASS} mt-5 w-full cursor-pointer`} style={{ ...hubPillStyle(palette, "solid", "sm"), minHeight: 46, opacity: busy ? 0.7 : 1 }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </form>
        ) : (
          <div>
            <h3 id="hub-room-access-title" style={{ ...hubDisplayStyle(palette, "1.5rem"), color: ink }}>
              {result === "sent" ? "Check your inbox" : "We’ve asked the team"}
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: soft }}>
              {result === "sent"
                ? `We sent a link to ${email.trim()}. Open it on this device and you’re set for the next 90 days.`
                : `${email.trim()} isn’t on this room’s list yet, so we’ve asked the team to add you. You’ll be able to request your link once they do.`}
            </p>
            <button type="button" onClick={onClose} className={`${HUB_PILL_SM_CLASS} mt-5 cursor-pointer`} style={{ ...hubPillStyle(palette, "solid", "sm"), minHeight: 44 }}>
              Got it
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
