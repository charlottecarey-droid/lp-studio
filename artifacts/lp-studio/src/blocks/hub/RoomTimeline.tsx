/**
 * The Overview's timeline once a hub is past its rollout. Two ways to read
 * where the partnership stands:
 *
 *   waves      one segment per wave, in order, with the wave in progress
 *              marked: how many of its locations are live and its target date
 *   practices  every location as one bar: how many are live, and the goal
 *
 * A hub with no waves shows the second only. (Spend against a target is the
 * same shape and slots in here once the hub can read it.)
 *
 * Styles live in the room block's CSS string (`.prw-tl*`).
 */
import { useState } from "react";

export interface TimelineWaveDef {
  key: string;
  name: string;
  start?: string;
  target?: string;
}

export interface TimelineWave {
  key: string;
  name: string;
  start: string;
  target: string;
  total: number;
  live: number;
  state: "done" | "current" | "upcoming";
}

/** "Wave 1", "wave 1" and "1" are the same wave (matches the server's `waveKey`). */
export const waveKey = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/^wave\s*/, "").replace(/\s+/g, " ");

/**
 * The hub's waves in order: the ones the team named (with their dates), then
 * any other wave the practice list uses. A wave is done once every one of its
 * locations is live; the first that isn't is the one in progress.
 */
export function timelineWaves(defs: TimelineWaveDef[] | undefined, byWave: { wave: string; total: number; live: number }[] | undefined): TimelineWave[] {
  const counts = new Map<string, { total: number; live: number }>();
  for (const w of byWave ?? []) {
    const k = waveKey(w.wave);
    const c = counts.get(k) ?? { total: 0, live: 0 };
    counts.set(k, { total: c.total + w.total, live: c.live + w.live });
  }
  const out: Omit<TimelineWave, "state">[] = [];
  const seen = new Set<string>();
  for (const d of defs ?? []) {
    const k = waveKey(d.key || d.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ key: d.key || d.name, name: d.name || d.key, start: d.start ?? "", target: d.target ?? "", ...(counts.get(k) ?? { total: 0, live: 0 }) });
  }
  for (const w of [...(byWave ?? [])].sort((a, b) => a.wave.localeCompare(b.wave, undefined, { numeric: true }))) {
    const k = waveKey(w.wave);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ key: w.wave, name: /^\d+$/.test(k) ? `Wave ${k}` : w.wave, start: "", target: "", ...counts.get(k)! });
  }
  let current = false;
  return out.map((w) => {
    if (w.total > 0 && w.live >= w.total) return { ...w, state: "done" as const };
    if (!current) {
      current = true;
      return { ...w, state: "current" as const };
    }
    return { ...w, state: "upcoming" as const };
  });
}

const STATE_LABEL = { done: "Complete", current: "In progress", upcoming: "Upcoming" } as const;
const pctOf = (n: number, of: number) => (of > 0 ? Math.max(0, Math.min(100, Math.round((n / of) * 100))) : 0);

export function PartnershipTimeline({ waves, total, live, goal, defaultView, noun, fmtDate, onOpen }: { /** Clicking the bars opens the Scorecard. The Waves / Practices switch above them keeps working. */ onOpen?: () => void; waves: TimelineWave[]; total: number; live: number; goal: { target: number; text?: string } | null; defaultView: "waves" | "practices"; noun: string; fmtDate: (iso: string) => string }) {
  const [picked, setPicked] = useState<"waves" | "practices" | null>(null);
  const view = waves.length === 0 ? "practices" : (picked ?? defaultView);
  const goalPct = goal ? pctOf(goal.target, Math.max(total, goal.target)) : 0;
  const scale = Math.max(total, goal?.target ?? 0);
  const open = onOpen
    ? { role: "link" as const, tabIndex: 0, "aria-label": "Open the Scorecard", onClick: onOpen, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } }
    : {};
  return (
    <div className="prw-tl" data-room-timeline={view}>
      {waves.length > 0 && (
        <div className="prw-tl-hd">
          <span className="prw-seg" role="group" aria-label="Timeline">
            <button type="button" className={view === "waves" ? "on" : ""} aria-pressed={view === "waves"} onClick={() => setPicked("waves")} data-room-timeline-view="waves">Waves</button>
            <button type="button" className={view === "practices" ? "on" : ""} aria-pressed={view === "practices"} onClick={() => setPicked("practices")} data-room-timeline-view="practices">{noun.charAt(0).toUpperCase() + noun.slice(1)}</button>
          </span>
        </div>
      )}
      {view === "waves" ? (
        <div className={`prw-tl-waves${onOpen ? " prw-tl-open" : ""}`} style={{ ["--cols" as string]: Math.min(waves.length, 6) }} {...open}>
          {waves.map((w) => (
            <div className="prw-tl-wave" key={w.key} data-room-wave={w.state}>
              <div className="d">
                {w.name} · <span className={`prw-st ${w.state}`}>{STATE_LABEL[w.state]}</span>
              </div>
              <b className="prw-num">{w.live}<i>/{w.total}</i></b>
              <span className="track"><span style={{ width: `${pctOf(w.live, w.total)}%` }} /></span>
              <div className="m">{w.target ? `Target ${fmtDate(w.target)}` : w.start ? `Starts ${fmtDate(w.start)}` : " "}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`prw-tl-all${onOpen ? " prw-tl-open" : ""}`} data-room-timeline-goal={goal ? goal.target : ""} {...open}>
          <div className="top">
            <b className="prw-num">{live}<i>/{total}</i></b>
            <span>{noun} live</span>
          </div>
          <div className="bar">
            <span className="track"><span style={{ width: `${pctOf(live, scale)}%` }} /></span>
            {goal && (
              <>
                <b style={{ left: `${goalPct}%` }} />
                <em style={{ left: `${Math.max(6, Math.min(94, goalPct))}%` }}>Goal {goal.target}</em>
              </>
            )}
          </div>
          {goal?.text && <div className="m">{goal.text}</div>}
        </div>
      )}
    </div>
  );
}
