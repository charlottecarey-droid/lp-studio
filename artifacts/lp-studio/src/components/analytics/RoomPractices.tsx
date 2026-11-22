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

/** The slice of a list one page shows, and how many pages there are. A page past the end falls back to the last one. */
export function pageOf<T>(rows: T[], page: number, size: number): { rows: T[]; page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const at = Math.min(Math.max(0, page), pages - 1);
  const from = at * size;
  return { rows: rows.slice(from, from + size), page: at, pages, from: rows.length ? from + 1 : 0, to: Math.min(rows.length, from + size) };
}

/** The waves a practice can be put in: the hub's own waves first, then any other the list already uses. */
export function waveChoices(hubWaves: { key: string; name: string }[], inList: string[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const w of hubWaves) if (w.key.trim() && !out.some((o) => o.value === w.key.trim())) out.push({ value: w.key.trim(), label: w.name.trim() || `Wave ${w.key.trim()}` });
  for (const w of inList) if (!out.some((o) => o.value === w)) out.push({ value: w, label: /^\d+$/.test(w) ? `Wave ${w}` : w });
  return out;
}

const PAGE_SIZES = [25, 50, 100] as const;

export function RoomPractices({ pageId, onChanged, hubWaves = [] }: { pageId: number; /** A stage changed or kits went out: the numbers above the list are stale. */ onChanged: () => void | Promise<void>; /** The waves set up under Settings, so practices can be put in them here. */ hubWaves?: { key: string; name: string }[] }) {
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
  const [size, setSize] = useState<number>(25);
  const [page, setPage] = useState(0);
  const [toWave, setToWave] = useState("");
  const [newWave, setNewWave] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const rows = data?.rows ?? [];
  const waves = useMemo(() => wavesOf(rows), [rows]);
  const shown = useMemo(() => filterPractices(rows, { q, wave, stage }), [rows, q, wave, stage]);
  const paged = pageOf(shown, page, size);
  const visible = paged.rows;
  const choices = waveChoices(hubWaves, waves);
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
  /** Put everything ticked into a wave ("" takes them out of one). */
  const moveToWave = async () => {
    const target = toWave === "__new" ? newWave.trim() : toWave === "__none" ? "" : toWave;
    if (toWave === "" || (toWave === "__new" && !target)) return;
    const ids = [...picked];
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/lp/partner-rooms/${pageId}/practices/wave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, wave: target }) });
      const j = (await res.json().catch(() => ({}))) as { moved?: number; error?: string };
      if (!res.ok) return setNote({ ok: false, text: j.error ?? "Couldn’t move the practices." });
      const label = target ? (choices.find((c) => c.value === target)?.label ?? (/^\d+$/.test(target) ? `Wave ${target}` : target)) : "";
      setNote({ ok: true, text: target ? `${j.moved ?? ids.length} ${(j.moved ?? ids.length) === 1 ? "practice is" : "practices are"} now in ${label}.` : `${j.moved ?? ids.length} taken out of their wave.` });
      setPicked(new Set());
      setToWave("");
      setNewWave("");
      await reload();
    } finally {
      setBusy(false);
    }
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
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search by name, city or region" className="h-9 pl-8" aria-label="Search practices" />
        </div>
        {waves.length > 0 && (
          <select className={select} value={wave} onChange={(e) => { setWave(e.target.value); setPage(0); }} aria-label="Wave" data-room-practice-wave>
            <option value="">All waves</option>
            {waves.map((w) => <option key={w} value={w}>{/^\d+$/.test(w) ? `Wave ${w}` : w}</option>)}
            <option value="none">No wave</option>
          </select>
        )}
        <select className={select} value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }} aria-label="Stage">
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
          {picked.size > 0 && (
            <span className="flex flex-wrap items-center gap-1.5" data-room-practice-move>
              <select className="h-8 rounded-md border bg-background px-2 text-sm" value={toWave} onChange={(e) => setToWave(e.target.value)} aria-label="Move the selected practices to a wave">
                <option value="">Move to a wave…</option>
                {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                <option value="__new">A new wave…</option>
                <option value="__none">No wave</option>
              </select>
              {toWave === "__new" && <Input value={newWave} onChange={(e) => setNewWave(e.target.value)} placeholder="e.g. 4" className="h-8 w-24" aria-label="New wave" maxLength={60} />}
              {toWave !== "" && (
                <Button size="sm" variant="outline" className="h-8" disabled={busy || (toWave === "__new" && !newWave.trim())} onClick={moveToWave} data-room-practice-move-go>
                  Move {picked.size}
                </Button>
              )}
            </span>
          )}
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
                  aria-label={`Select all ${shown.length}`}
                  title={shown.length > visible.length ? `Selects all ${shown.length}, on every page` : undefined}
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" data-room-practice-pages>
        <span>
          {shown.length ? `Showing ${paged.from}–${paged.to} of ${shown.length}` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            Show
            <select className="h-7 rounded-md border bg-background px-1.5 text-xs" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} aria-label="Practices on a page" data-room-practice-size>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            a page
          </label>
          {paged.pages > 1 && (
            <span className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={paged.page === 0} onClick={() => setPage(paged.page - 1)} aria-label="Previous page">Previous</Button>
              <span className="px-1 tabular-nums">Page {paged.page + 1} of {paged.pages}</span>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={paged.page >= paged.pages - 1} onClick={() => setPage(paged.page + 1)} aria-label="Next page">Next</Button>
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
