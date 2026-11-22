import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The hub's practices, on the rep's own page: find one, see where each stands,
 * move one along, and send welcome kits to a whole wave. This used to mean
 * opening the customer's hub and doing it from the Scorecard.
 */

export interface PracticeRow {
  id: number;
  name: string;
  region: string | null;
  city: string | null;
  state: string | null;
  wave: string | null;
  stage: string;
  trainingDate: string | null;
  liveDate: string | null;
  hasAddress: boolean;
  kitSentAt: string | null;
}

export const PRACTICE_STAGES: [string, string][] = [
  ["not_started", "Not started"],
  ["scheduling", "Scheduling"],
  ["training_booked", "Training booked"],
  ["trained", "Trained"],
  ["live", "Live"],
];

/** The practices a search and the two filters leave. */
export function filterPractices(rows: PracticeRow[], f: { q: string; wave: string; stage: string }): PracticeRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || [r.name, r.region, r.city, r.state].some((v) => (v ?? "").toLowerCase().includes(q))) &&
      (f.wave === "" || (f.wave === "none" ? !(r.wave ?? "").trim() : (r.wave ?? "").trim() === f.wave)) &&
      (f.stage === "" || r.stage === f.stage),
  );
}

/** The waves in the list, in the order a person would count them ("2" before "10"). */
export function wavesOf(rows: PracticeRow[]): string[] {
  return [...new Set(rows.map((r) => (r.wave ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** What the welcome kit column says for a practice. */
export function kitStatus(r: Pick<PracticeRow, "kitSentAt" | "hasAddress">): string {
  if (r.kitSentAt) return `Sent ${new Date(r.kitSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return r.hasAddress ? "Not sent" : "No address";
}

type KitResult = { ok?: boolean; error?: string; sent?: string[]; already?: string[]; noAddress?: string[] };

export function RoomPractices({ pageId, onChanged }: { pageId: number; /** A stage changed or kits went out: the numbers above the list are stale. */ onChanged: () => void | Promise<void> }) {
  const qc = useQueryClient();
  const key = ["page-room-practices", pageId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/practices`);
      return r.ok ? ((await r.json()) as { rows: PracticeRow[]; noDirectOutreach?: boolean }) : null;
    },
  });
  const [q, setQ] = useState("");
  const [wave, setWave] = useState("");
  const [stage, setStage] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const rows = data?.rows ?? [];
  const waves = useMemo(() => wavesOf(rows), [rows]);
  const shown = useMemo(() => filterPractices(rows, { q, wave, stage }), [rows, q, wave, stage]);
  const visible = all ? shown : shown.slice(0, 50);
  const shownIds = shown.map((r) => r.id);
  const everyShownPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));
  const pickedHere = shownIds.filter((id) => picked.has(id));

  const reload = async () => {
    await qc.invalidateQueries({ queryKey: key });
    await onChanged();
  };
  const setStageOf = async (r: PracticeRow, next: string) => {
    setNote(null);
    const res = await fetch(`/api/lp/partner-rooms/${pageId}/practices/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: next }) });
    if (!res.ok) setNote({ ok: false, text: `Couldn't update ${r.name}.` });
    await reload();
  };
  const sendKits = async () => {
    const ids = [...picked];
    if (ids.length === 0) return;
    setBusy(true);
    setNote(null);
    const call = async (dryRun: boolean) => {
      const res = await fetch(`/api/lp/partner-rooms/${pageId}/welcome-kits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, dryRun }) });
      return { ok: res.ok, json: (await res.json().catch(() => ({}))) as KitResult };
    };
    try {
      // First ask what would happen, so nothing goes to marketing by surprise.
      const plan = await call(true);
      const will = plan.json.sent?.length ?? 0;
      const skipped = [(plan.json.already?.length ?? 0) ? `${plan.json.already!.length} already sent` : "", (plan.json.noAddress?.length ?? 0) ? `${plan.json.noAddress!.length} with no address` : ""].filter(Boolean).join(", ");
      if (!plan.ok) return setNote({ ok: false, text: plan.json.error ?? "Couldn't check the welcome kit list." });
      if (will === 0) return setNote({ ok: false, text: `Nothing to send: ${skipped || "none of these can get a kit"}.` });
      if (!window.confirm(`Send welcome kits to ${will} ${will === 1 ? "practice" : "practices"}?${skipped ? `\n\nSkipped: ${skipped}.` : ""}\n\nThey go on the welcome kit list and marketing is asked to send them.`)) return;
      const done = await call(false);
      if (!done.ok) return setNote({ ok: false, text: done.json.error ?? "Couldn't send the welcome kits." });
      setNote({ ok: true, text: `${done.json.sent?.length ?? 0} added to the welcome kit list, and marketing has been asked to send them.${skipped ? ` Skipped: ${skipped}.` : ""}` });
      setPicked(new Set());
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">Couldn’t load the practices.</p>;
  if (rows.length === 0) return null;

  const select = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <section className="space-y-3" data-room-practice-list>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city or region" className="h-9 pl-8" aria-label="Search practices" />
        </div>
        {waves.length > 0 && (
          <select className={select} value={wave} onChange={(e) => setWave(e.target.value)} aria-label="Wave" data-room-practice-wave>
            <option value="">All waves</option>
            {waves.map((w) => <option key={w} value={w}>{/^\d+$/.test(w) ? `Wave ${w}` : w}</option>)}
            <option value="none">No wave</option>
          </select>
        )}
        <select className={select} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">Any stage</option>
          {PRACTICE_STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {shown.length === rows.length ? `${rows.length} practices` : `${shown.length} of ${rows.length} practices`}
          {picked.size > 0 && <span className="font-medium text-foreground"> · {picked.size} selected</span>}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {picked.size > 0 && <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setPicked(new Set())}>Clear</Button>}
          <Button size="sm" variant="brand" className="h-8" disabled={busy || picked.size === 0 || !!data.noDirectOutreach} onClick={sendKits} title={data.noDirectOutreach ? "This account doesn’t allow direct outreach to its practices" : picked.size === 0 ? "Tick the practices first. Pick a wave to tick a whole wave at once." : undefined} data-room-practice-kits>
            {busy ? "Working…" : picked.size ? `Send welcome kits to ${picked.size}` : "Send welcome kits"}
          </Button>
        </span>
      </div>
      {data.noDirectOutreach && <p className="text-xs text-muted-foreground">This account doesn’t allow direct outreach to its practices, so welcome kits can’t be sent. Change that under Settings.</p>}
      {note && <p role="status" className={`text-sm ${note.ok ? "text-emerald-700" : "text-destructive"}`}>{note.text}</p>}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={everyShownPicked}
                  ref={(el) => {
                    if (el) el.indeterminate = pickedHere.length > 0 && !everyShownPicked;
                  }}
                  onChange={(e) => setPicked((prev) => { const next = new Set(prev); for (const id of shownIds) { if (e.target.checked) next.add(id); else next.delete(id); } return next; })}
                  aria-label={`Select all ${shown.length} shown`}
                  data-room-practice-all
                />
              </th>
              <th className="px-3 py-2 font-normal">Practice</th>
              <th className="px-3 py-2 font-normal">Region</th>
              <th className="px-3 py-2 font-normal">Wave</th>
              <th className="px-3 py-2 font-normal">Stage</th>
              <th className="px-3 py-2 font-normal">Welcome kit</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b last:border-0" data-room-practice={r.id}>
                <td className="px-3 py-2">
                  <input type="checkbox" className="h-4 w-4" checked={picked.has(r.id)} onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(r.id); else next.delete(r.id); return next; })} aria-label={`Select ${r.name}`} />
                </td>
                <td className="px-3 py-2">
                  <span className="block font-medium">{r.name}</span>
                  {(r.city || r.state) && <span className="block text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ")}</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.region || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.wave || "—"}</td>
                <td className="px-3 py-2">
                  <select className="h-8 rounded-md border bg-background px-2 text-sm" value={r.stage} onChange={(e) => void setStageOf(r, e.target.value)} aria-label={`Stage of ${r.name}`}>
                    {PRACTICE_STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className={`px-3 py-2 text-xs ${r.kitSentAt ? "text-emerald-700" : r.hasAddress ? "text-muted-foreground" : "text-amber-700"}`}>{kitStatus(r)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No practices match. Clear the search or the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > 50 && (
        <button type="button" className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? "Show the first 50" : `Show all ${shown.length}`}
        </button>
      )}
    </section>
  );
}
