import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/** One program in the hub's marketing plan and where it stands. Mirrors the server's PlanQueueItem. */
export interface PlanQueueItem {
  key: string;
  title: string;
  value: string | null;
  chosenBy: string | null;
  chosenAt: string | null;
  state: "undecided" | "declined" | "queued" | "sent";
  changed: boolean;
  request: { id: number; status: string; asanaTaskGid: string | null; sentAt: string } | null;
}

const STATUS: Record<string, string> = { new: "Received", in_progress: "In progress", review: "Ready for their review", done: "Done" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

/**
 * The marketing plan as a queue. What the customer said yes to waits here
 * until a rep sends it to marketing's request intake; several ticked at once
 * go as ONE request, so marketing gets a single brief for the account.
 */
export function RoomPlanQueueSection({ pageId, queue, onSent }: { pageId: number; queue: PlanQueueItem[]; onSent: () => void | Promise<void> }) {
  const waiting = queue.filter((i) => i.state === "queued");
  const sent = queue.filter((i) => i.state === "sent");
  const undecided = queue.filter((i) => i.state === "undecided");
  const declined = queue.filter((i) => i.state === "declined");
  const [picked, setPicked] = useState<Set<string>>(new Set(waiting.map((i) => i.key)));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Anything new in the queue starts ticked: the usual send is "everything that is waiting".
  const waitingKeys = waiting.map((i) => i.key).join(",");
  useEffect(() => {
    setPicked(new Set(waitingKeys ? waitingKeys.split(",") : []));
  }, [waitingKeys]);

  const toSend = waiting.filter((i) => picked.has(i.key));
  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/plan-queue/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: toSend.map((i) => i.key), note }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; sent?: string[]; warning?: string | null };
      if (!r.ok) setMessage({ ok: false, text: j.error ?? "Could not send to marketing" });
      else {
        const n = j.sent?.length ?? toSend.length;
        setMessage({ ok: true, text: `Sent to marketing as one request (${n} program${n === 1 ? "" : "s"}).${j.warning ? ` ${j.warning}` : ""}` });
        setNote("");
        await onSent();
      }
    } catch {
      setMessage({ ok: false, text: "Could not send to marketing" });
    } finally {
      setBusy(false);
    }
  };

  if (queue.length === 0) return null;
  return (
    <section className="space-y-2" data-room-plan-queue>
      <div>
        <h4 className="text-sm font-semibold">
          Marketing plan
          {waiting.length > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">{waiting.length} to send</span>}
        </h4>
        <p className="text-sm text-muted-foreground">What the customer said yes to waits here until you send it to marketing. Everything you tick goes as one request.</p>
      </div>

      {waiting.length > 0 ? (
        <div className="space-y-3 rounded-md border p-3" data-room-plan-waiting>
          <div className="divide-y rounded-md border">
            {waiting.map((i) => (
              <label key={i.key} className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <input type="checkbox" className="h-4 w-4" checked={picked.has(i.key)} onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(i.key); else next.delete(i.key); return next; })} data-room-plan-pick={i.key} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[i.chosenBy, day(i.chosenAt)].filter(Boolean).join(" · ")}
                    {i.changed ? " · changed since it was last sent" : ""}
                  </span>
                </span>
                <Badge variant="secondary">{i.value}</Badge>
              </label>
            ))}
          </div>
          <label className="block space-y-1 text-xs"><span className="font-medium text-muted-foreground">Note for marketing (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Dates, priorities, anything they should know" /></label>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="brand" className="gap-1" disabled={busy || toSend.length === 0} onClick={send} data-room-plan-send>
              <Send className="h-3.5 w-3.5" /> {busy ? "Sending…" : `Send ${toSend.length || ""} to marketing`.replace(/\s+/g, " ")}
            </Button>
            <span className="text-xs text-muted-foreground">Creates one task in marketing’s request intake and one request the customer can follow.</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing is waiting to be sent.</p>
      )}
      {message && <p role="status" className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}

      {sent.length > 0 && (
        <div className="divide-y rounded-md border" data-room-plan-sent>
          {sent.map((i) => (
            <div key={i.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 text-sm">
                {i.title} {i.value && <span className="text-xs text-muted-foreground">· {i.value}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                Sent {day(i.request?.sentAt ?? null)} · {STATUS[i.request?.status ?? ""] ?? "Received"}
                {i.request?.asanaTaskGid && !i.request.asanaTaskGid.startsWith("fake-") && (
                  <>
                    {" · "}
                    <a className="underline" href={`https://app.asana.com/0/0/${i.request.asanaTaskGid}`} target="_blank" rel="noreferrer">In Asana</a>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {(undecided.length > 0 || declined.length > 0) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {[undecided.length ? `${undecided.length} not decided yet` : "", declined.length ? `${declined.length} declined` : ""].filter(Boolean).join(" · ")}
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {undecided.map((i) => <li key={i.key}>{i.title} <span className="text-xs">· no decision yet</span></li>)}
            {declined.map((i) => <li key={i.key}>{i.title} <span className="text-xs">· {i.value}{i.chosenBy ? ` (${i.chosenBy})` : ""}</span></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
