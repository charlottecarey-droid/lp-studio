import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ROOM_MODULES, roomMarketingNames } from "@/blocks/BlockRoomWorkspace";

/**
 * How a Partner Hub is doing: who came, when, for how long, and which
 * sections they opened. The account team's own visits are never counted.
 * Section tracking starts the day it was switched on, so older visits only
 * show in the page-view total.
 */

interface PersonStat {
  email: string;
  name: string | null;
  visits: number;
  seconds: number;
  lastAt: string;
  modules: { module: string; opens: number; seconds: number }[];
}
interface Visit {
  email: string | null;
  name: string | null;
  startedAt: string;
  seconds: number;
  modules: string[];
}
export interface RoomPerformanceData {
  windowDays: number;
  visits: number;
  visitors: number;
  named: number;
  anonymous: number;
  seconds: number;
  lastAt: string | null;
  days: { date: string; visits: number; visitors: number }[];
  people: PersonStat[];
  modules: { module: string; opens: number; people: number; seconds: number }[];
  recent: Visit[];
  pageViews: number;
  pageVisitors: number;
  trackedSince: string | null;
}

const LABEL = new Map<string, string>([...ROOM_MODULES.map((m) => [m.key, m.label] as [string, string]), ["marketing", "Launch & marketing"]]);
/** A hub section by the name the customer sees. Past the rollout the launch sections are "Marketing". */
export const sectionLabel = (key: string, stage?: string) => (key === "marketing" || key === "kit" ? (key === "kit" ? roomMarketingNames(stage).kit : roomMarketingNames(stage).module) : (LABEL.get(key) ?? key));

/** "45 sec", "12 min", "1 hr 5 min". Under a few seconds reads as a glance. */
export function fmtDuration(seconds: number): string {
  if (seconds < 5) return "a glance";
  if (seconds < 60) return `${seconds} sec`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function fmtWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} hr ago`;
  const days = Math.round(mins / (24 * 60));
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

/** Visits per day as plain bars. One series, so no legend; the day and count are on each bar's title. */
function DayBars({ days }: { days: RoomPerformanceData["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.visits));
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`Visits per day over the last ${days.length} days`}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 items-end" title={`${label(d.date)}: ${d.visits} visit${d.visits === 1 ? "" : "s"}`}>
            <div className={`w-full rounded-sm ${d.visits ? "bg-foreground/70" : "bg-muted"}`} style={{ height: d.visits ? `${Math.max(8, (d.visits / max) * 100)}%` : 2 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label(days[0].date)}</span>
        <span>{label(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

function PersonRow({ p, stage }: { p: PersonStat; stage?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setOpen((v) => !v)} data-room-perf-person={p.email}>
        <td className="py-2 pr-3">
          <span className="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{p.name || p.email}</span>
              {p.name && <span className="block truncate text-xs text-muted-foreground">{p.email}</span>}
            </span>
          </span>
        </td>
        <td className="py-2 pr-3 tabular-nums">{p.visits}</td>
        <td className="py-2 pr-3 tabular-nums">{fmtDuration(p.seconds)}</td>
        <td className="py-2 text-muted-foreground">{fmtWhen(p.lastAt)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} className="pb-3 pl-5">
            <ul className="space-y-1 text-sm">
              {p.modules.map((m) => (
                <li key={m.module} className="flex justify-between gap-4 text-muted-foreground">
                  <span className="text-foreground">{sectionLabel(m.module, stage)}</span>
                  <span className="tabular-nums">
                    opened {m.opens} time{m.opens === 1 ? "" : "s"} · {fmtDuration(m.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

export function RoomPerformance({ pageId, stage }: { pageId: number; /** "expansion" once the hub is past its rollout: the launch sections are then called Marketing. */ stage?: string }) {
  const names = roomMarketingNames(stage);
  const { data, isLoading } = useQuery({
    queryKey: ["page-room-performance", pageId],
    queryFn: async () => {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/performance`);
      return r.ok ? ((await r.json()) as RoomPerformanceData) : null;
    },
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">Could not load how this hub is doing.</p>;
  const maxOpens = Math.max(1, ...data.modules.map((m) => m.opens));
  return (
    <div className="space-y-6" data-room-performance>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Visits" value={String(data.visits)} note={`Last ${data.windowDays} days`} />
        <Stat label="People" value={String(data.named)} note={data.anonymous ? `plus ${data.anonymous} not signed in` : "Signed in with their email"} />
        <Stat label="Time in the hub" value={data.seconds ? fmtDuration(data.seconds) : "0 min"} />
        <Stat label="Last visit" value={fmtWhen(data.lastAt)} />
      </div>

      {data.visits === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {data.trackedSince
            ? `Nobody from the customer has opened the hub in the last ${data.windowDays} days.`
            : data.pageViews
              ? `The page was opened ${data.pageViews} time${data.pageViews === 1 ? "" : "s"} in the last ${data.windowDays} days, before visits were recorded by person and section. New visits will show here.`
              : "Nobody from the customer has opened the hub yet. Visits show here as soon as they do. Your own team's visits are never counted."}
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Visits per day</h4>
            <DayBars days={data.days} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Who visited</h4>
              {data.people.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody has signed in with their email yet, so visitors can't be named.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-1 pr-3 font-normal">Person</th>
                      <th className="pb-1 pr-3 font-normal">Visits</th>
                      <th className="pb-1 pr-3 font-normal">Time</th>
                      <th className="pb-1 font-normal">Last visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((p) => (
                      <PersonRow key={p.email} p={p} stage={stage} />
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Sections opened</h4>
              <ul className="space-y-2">
                {data.modules.map((m) => (
                  <li key={m.module} className="text-sm" data-room-perf-section={m.module}>
                    <div className="flex justify-between gap-3">
                      <span>{sectionLabel(m.module, stage)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {m.opens} · {fmtDuration(m.seconds)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(m.opens / maxOpens) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Recent visits</h4>
            <ul className="divide-y rounded-md border text-sm">
              {data.recent.slice(0, 12).map((v, i) => (
                <li key={`${v.startedAt}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
                  <span className="font-medium">{v.name || v.email || "Someone not signed in"}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtWhen(v.startedAt)} · {fmtDuration(v.seconds)}
                  </span>
                  <span className="w-full text-xs text-muted-foreground">{v.modules.map((k) => sectionLabel(k, stage)).join(" → ")}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Files opened and downloaded are under {names.kit}. Uploads, completed tasks and requests are under Activity.
        {data.trackedSince ? ` Visits by person and section have been recorded since ${new Date(data.trackedSince).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.` : ""}
      </p>
    </div>
  );
}
