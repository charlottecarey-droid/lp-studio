import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

/**
 * What is waiting on the customer, and a way to nudge them without writing
 * an email by hand: pick who gets it, add a line if you like, send. The email
 * lists the next few things and links to the hub.
 */
export function RoomReminderSection({ pageId, waiting, people, lastAt, published, onSent }: { pageId: number; /** Open steps and undecided programs, as the customer reads them. */ waiting: string[]; /** Who has access or gets the digest. */ people: string[]; lastAt: string | null; published: boolean; onSent: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(people));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const key = people.join(",");
  useEffect(() => setPicked(new Set(key ? key.split(",") : [])), [key]);
  if (waiting.length === 0) return null;

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/remind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: [...picked], note }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: string[] };
      if (!r.ok) setMessage({ ok: false, text: j.error ?? "Could not send the reminder" });
      else {
        setMessage({ ok: true, text: `Reminder sent to ${j.sent?.length ?? 0} ${j.sent?.length === 1 ? "person" : "people"}.` });
        setOpen(false);
        setNote("");
        await onSent();
      }
    } catch {
      setMessage({ ok: false, text: "Could not send the reminder" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2" data-room-reminder>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Waiting on the customer <span className="font-normal text-muted-foreground">· {waiting.length}</span></h4>
          <p className="text-sm text-muted-foreground">
            {waiting.slice(0, 3).join(" · ")}
            {waiting.length > 3 ? ` · and ${waiting.length - 3} more` : ""}
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)} disabled={!published || people.length === 0} title={!published ? "Publish the hub first: the reminder links to it" : people.length === 0 ? "Nobody has access yet: invite the customer's team under Settings" : undefined} data-room-reminder-open>
            <BellRing className="h-3.5 w-3.5" /> Send a reminder
          </Button>
        )}
      </div>
      {lastAt && !open && <p className="text-xs text-muted-foreground">Last reminder sent {day(lastAt)}.</p>}
      {!open && (!published || people.length === 0) && <p className="text-xs text-muted-foreground">{!published ? "Publish the hub to send a reminder." : "Invite the customer’s team under Settings to send a reminder."}</p>}
      {open && (
        <div className="space-y-3 rounded-md border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Send it to</p>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {people.map((e) => (
                <label key={e} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={picked.has(e)} onChange={(ev) => setPicked((prev) => { const next = new Set(prev); if (ev.target.checked) next.add(e); else next.delete(e); return next; })} />
                  <span className="truncate">{e}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Add a line (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="e.g. We need the doctor roster by Friday to book training" /></label>
          <p className="text-xs text-muted-foreground">The email lists the next few things waiting on them and links to the hub.</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="brand" disabled={busy || picked.size === 0} onClick={send} data-room-reminder-send>{busy ? "Sending…" : `Send to ${picked.size} ${picked.size === 1 ? "person" : "people"}`}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {message && <p role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}
    </section>
  );
}
