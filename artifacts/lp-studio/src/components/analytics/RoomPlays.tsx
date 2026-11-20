import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Package, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Recommended plays for the account team: what to do next for this account,
 * with the numbers behind each one. They come from rules over the hub's own
 * data, named as the Expansion Playbook names them. The customer never sees
 * this. Mirrors the server's Play.
 */
interface Play {
  key: string;
  title: string;
  why: string;
  source: string | null;
  score: number;
  action: { kind: "kit"; practiceIds: number[] } | { kind: "request" } | { kind: "none" };
  practices: string[];
}

type KitAnswer = { ok?: boolean; error?: string; sent?: string[]; already?: string[]; noAddress?: string[] };

async function post(url: string, method: "POST" | "PUT", body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: { error: "Couldn't reach the server." } };
  }
}

export function RoomPlays({ pageId }: { pageId: number }) {
  const base = `/api/lp/partner-rooms/${pageId}/plays`;
  const [data, setData] = useState<{ plays: Play[]; quiet: number; noDirectOutreach: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, { text: string; bad?: boolean }>>({});
  const [confirmKit, setConfirmKit] = useState<{ key: string; answer: KitAnswer } | null>(null);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(base);
      if (!r.ok) throw new Error("plays");
      setData((await r.json()) as { plays: Play[]; quiet: number; noDirectOutreach: boolean });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [base]);
  useEffect(() => void load(), [load]);

  const act = async (play: Play, action: "request" | "dismiss" | "done") => {
    setBusy(play.key);
    const r = await post(`${base}/act`, "POST", { key: play.key, action });
    setBusy(null);
    if (!r.ok) return setNote((n) => ({ ...n, [play.key]: { text: String(r.json.error ?? "That didn't work."), bad: true } }));
    await load();
  };
  // Welcome kits: ask first what would be added (it puts practices on the direct-mail list), then add.
  const kit = async (play: Play, dryRun: boolean) => {
    if (play.action.kind !== "kit") return;
    setBusy(play.key);
    const r = await post("/api/lp/room/welcome-kit", "POST", { pageId, ids: play.action.practiceIds, dryRun });
    setBusy(null);
    const answer = r.json as KitAnswer;
    if (!r.ok) return setNote((n) => ({ ...n, [play.key]: { text: answer.error ?? "That didn't work.", bad: true } }));
    if (dryRun) return setConfirmKit({ key: play.key, answer });
    setConfirmKit(null);
    await post(`${base}/act`, "POST", { key: play.key, action: "done" });
    await load();
  };

  if (failed) return <p className="text-sm text-muted-foreground">The plays couldn't be worked out.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const shown = all ? data.plays : data.plays.slice(0, 3);

  return (
    <section className="space-y-3" data-room-plays={data.plays.length}>
      {data.plays.length === 0 && <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No plays to recommend right now.</p>}
      {shown.map((p) => {
        const isOpen = open === p.key;
        const waiting = busy === p.key;
        return (
          <article key={p.key} className="rounded-lg border bg-card p-4" data-room-play={p.key}>
            <h4 className="text-sm font-semibold">{p.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{p.why}</p>
            {p.source && <p className="mt-1 text-xs text-muted-foreground">{p.source}</p>}
            {p.practices.length > 0 && (
              <>
                <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.key)}>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} /> {p.practices.length} {p.practices.length === 1 ? "practice" : "practices"}
                </button>
                {isOpen && <ul className="mt-2 columns-2 gap-6 text-xs text-muted-foreground">{p.practices.map((n) => <li key={n} className="break-inside-avoid py-0.5">{n}</li>)}</ul>}
              </>
            )}
            {confirmKit?.key === p.key && (
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm" data-room-play-kit-confirm>
                <p className="font-medium">{confirmKit.answer.sent?.length ? `Add ${confirmKit.answer.sent.length} to the welcome kit list?` : "None of these can be added."}</p>
                {(confirmKit.answer.already?.length ?? 0) > 0 && <p className="text-muted-foreground">{confirmKit.answer.already!.length} already on the list.</p>}
                {(confirmKit.answer.noAddress?.length ?? 0) > 0 && <p className="text-muted-foreground">{confirmKit.answer.noAddress!.length} with no full address.</p>}
                <div className="mt-2 flex gap-2">
                  {(confirmKit.answer.sent?.length ?? 0) > 0 && <Button size="sm" variant="brand" disabled={waiting} onClick={() => void kit(p, false)}>Add them</Button>}
                  <Button size="sm" variant="outline" onClick={() => setConfirmKit(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.action.kind === "kit" && confirmKit?.key !== p.key && <Button size="sm" variant="brand" disabled={waiting} onClick={() => void kit(p, true)} data-room-play-kit><Package className="mr-1 h-4 w-4" /> Send welcome kits</Button>}
              {p.action.kind === "request" && <Button size="sm" variant="brand" disabled={waiting} onClick={() => void act(p, "request")} data-room-play-request><Send className="mr-1 h-4 w-4" /> Ask marketing</Button>}
              <Button size="sm" variant="outline" disabled={waiting} onClick={() => void act(p, "done")} data-room-play-done><Check className="mr-1 h-4 w-4" /> Done</Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={waiting} onClick={() => void act(p, "dismiss")} data-room-play-dismiss><X className="mr-1 h-4 w-4" /> Not now</Button>
              {note[p.key] && <span className={`text-sm ${note[p.key].bad ? "text-destructive" : "text-muted-foreground"}`}>{note[p.key].text}</span>}
            </div>
          </article>
        );
      })}
      {data.plays.length > 3 && <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${data.plays.length}`}</Button>}
      {data.quiet > 0 && <p className="text-xs text-muted-foreground">{data.quiet} more {data.quiet === 1 ? "is" : "are"} quiet for 30 days after being asked for, done or set aside.</p>}
      <label className="flex items-center gap-2 border-t pt-3 text-sm">
        <input
          type="checkbox"
          checked={data.noDirectOutreach}
          onChange={async (e) => {
            await post(`${base}/settings`, "PUT", { noDirectOutreach: e.target.checked });
            await load();
          }}
          data-room-no-outreach
        />
        This account doesn't allow direct outreach to its practices
      </label>
    </section>
  );
}
