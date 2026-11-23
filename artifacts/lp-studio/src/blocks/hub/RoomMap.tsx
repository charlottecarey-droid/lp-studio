/**
 * The Scorecard's map: every location as a pin, filled when it is live and
 * hollow when it is not, coloured by who looks after it (the regional manager,
 * or the region when the list has no managers).
 *
 * For the page owner's own team only: it shows which of the customer's
 * offices are not ordering. The server refuses anyone else.
 *
 * Self-contained on purpose: state outlines come from a small file shipped
 * with the app and pins are placed from ZIP codes on our server, so the page
 * makes no request to a map service and no address leaves the hub.
 *
 * Styles live in the room block's CSS string (`.prw-map*`).
 */
import { useRegionalsWord } from "./room-words";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import type { RoomMapData, RoomMapPoint, RoomStoreHandle } from "./room-client";
import { waveKey } from "./RoomTimeline";

/** Colours for up to eight groups, in a fixed order (checked for colour-blind separation). Anything beyond folds into "Other". */
export const MAP_GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;
export const MAP_OTHER_COLOR = "#8A948D";
const OTHER = "Other";
const NONE = "Unassigned";

const W = 760;
const H = 500;

export type MapMark = "live" | "progress" | "open";
/** How a pin is drawn: filled once the location is trained or live, a dot in a ring while it is being scheduled or trained, a ring before that. */
export function mapMark(stage: string): MapMark {
  if (stage === "live" || stage === "trained") return "live";
  if (stage === "scheduling" || stage === "training_booked") return "progress";
  return "open";
}

export interface MapGroup {
  name: string;
  color: string;
  total: number;
  live: number;
}

/**
 * Who the pins are coloured by: regional managers when any location has one,
 * otherwise regions. The eight largest get a colour each (largest first, then
 * by name, so a group keeps its colour while the list is the same); the rest
 * share "Other".
 */
export function mapGroups(points: RoomMapPoint[]): { by: "manager" | "region"; groups: MapGroup[]; of: (p: RoomMapPoint) => string } {
  const by = points.some((p) => (p.regionalManager ?? "").trim()) ? "manager" : "region";
  const raw = (p: RoomMapPoint) => ((by === "manager" ? p.regionalManager : p.region) ?? "").trim() || NONE;
  const tally = new Map<string, { total: number; live: number }>();
  for (const p of points) {
    const g = tally.get(raw(p)) ?? { total: 0, live: 0 };
    g.total++;
    if (mapMark(p.stage) === "live") g.live++;
    tally.set(raw(p), g);
  }
  const named = [...tally.entries()].filter(([n]) => n !== NONE).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
  const top = named.slice(0, MAP_GROUP_COLORS.length);
  const colored = new Set(top.map(([n]) => n));
  const groups: MapGroup[] = top.map(([name, v], i) => ({ name, color: MAP_GROUP_COLORS[i], ...v }));
  const fold = (name: string, from: [string, { total: number; live: number }][]) => {
    if (from.length === 0) return;
    groups.push({ name, color: MAP_OTHER_COLOR, total: from.reduce((n, [, v]) => n + v.total, 0), live: from.reduce((n, [, v]) => n + v.live, 0) });
  };
  fold(OTHER, named.slice(MAP_GROUP_COLORS.length));
  fold(NONE, [...tally.entries()].filter(([n]) => n === NONE));
  return { by, groups, of: (p) => (raw(p) === NONE ? NONE : colored.has(raw(p)) ? raw(p) : OTHER) };
}

/** Web Mercator, in degrees of longitude across and the matching scale down. */
const mx = (lng: number) => lng;
const my = (lat: number) => (-Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360)) * 180) / Math.PI;

export interface MapFit {
  /** Map degrees → drawing units. */
  x: (lng: number) => number;
  y: (lat: number) => number;
}

/**
 * Fit the placed pins into the drawing with room around them. One pin (or a
 * tight cluster) still shows about a state's worth of map, so it has context.
 */
export function fitMap(points: { lat: number; lng: number }[], width = W, height = H): MapFit {
  const xs = points.map((p) => mx(p.lng));
  const ys = points.map((p) => my(p.lat));
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (points.length === 0) [x0, x1, y0, y1] = [-125, -66.5, my(49.5), my(24.5)];
  const MIN = 3;
  if (x1 - x0 < MIN) [x0, x1] = [(x0 + x1) / 2 - MIN / 2, (x0 + x1) / 2 + MIN / 2];
  if (y1 - y0 < MIN) [y0, y1] = [(y0 + y1) / 2 - MIN / 2, (y0 + y1) / 2 + MIN / 2];
  const pad = 0.1;
  const k = Math.min((width * (1 - 2 * pad)) / (x1 - x0), (height * (1 - 2 * pad)) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: (lng) => width / 2 + (mx(lng) - cx) * k, y: (lat) => height / 2 + (my(lat) - cy) * k };
}

/** The zoom and offset that fill the drawing with one box (a state's outline), with room around it. */
export function zoomToBox(box: { x0: number; x1: number; y0: number; y1: number }, width = W, height = H, maxK = 12, minK = 1): { k: number; x: number; y: number } {
  const pad = 0.12;
  const w = Math.max(box.x1 - box.x0, 1), h = Math.max(box.y1 - box.y0, 1);
  const k = Math.max(minK, Math.min(maxK, (width * (1 - 2 * pad)) / w, (height * (1 - 2 * pad)) / h));
  return { k, x: width / 2 - ((box.x0 + box.x1) / 2) * k, y: height / 2 - ((box.y0 + box.y1) / 2) * k };
}

/**
 * What a click on a state zooms to: its pins when it has any (so a few offices in one corner of a big state fill the
 * view), else its outline. The pins' box is never smaller than a sixth of the drawing, so one office is not zoomed to a dot.
 */
export function stateBox(outline: { x0: number; x1: number; y0: number; y1: number }, pins: { x: number; y: number }[], width = W, height = H): { x0: number; x1: number; y0: number; y1: number } {
  if (pins.length === 0) return outline;
  let x0 = Math.min(...pins.map((p) => p.x)), x1 = Math.max(...pins.map((p) => p.x)), y0 = Math.min(...pins.map((p) => p.y)), y1 = Math.max(...pins.map((p) => p.y));
  const minW = width / 6, minH = height / 6;
  if (x1 - x0 < minW) [x0, x1] = [(x0 + x1) / 2 - minW / 2, (x0 + x1) / 2 + minW / 2];
  if (y1 - y0 < minH) [y0, y1] = [(y0 + y1) / 2 - minH / 2, (y0 + y1) / 2 + minH / 2];
  return { x0, x1, y0, y1 };
}

/**
 * Pins that land on the same spot (one ZIP code, several offices) are fanned
 * out in a small ring so each can be seen and pointed at. Offsets are in
 * screen pixels: the caller divides by the zoom.
 */
export function fanOut<T extends { x: number; y: number }>(pins: T[], gap = 11): (T & { dx: number; dy: number })[] {
  const at = new Map<string, T[]>();
  for (const p of pins) {
    const key = `${Math.round(p.x / 3)}|${Math.round(p.y / 3)}`;
    at.set(key, [...(at.get(key) ?? []), p]);
  }
  const out: (T & { dx: number; dy: number })[] = [];
  for (const group of at.values()) {
    const n = group.length;
    group.forEach((p, i) => {
      if (n === 1) {
        out.push({ ...p, dx: 0, dy: 0 });
        return;
      }
      const r = gap * Math.max(1, n / 5);
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ ...p, dx: Math.cos(a) * r, dy: Math.sin(a) * r });
    });
  }
  return out;
}

interface StateShape {
  id: string;
  name: string;
  /** Flat [lng, lat, lng, lat…] per outline. */
  rings: number[][];
}

let statesOnce: Promise<StateShape[]> | null = null;
function loadStates(): Promise<StateShape[]> {
  statesOnce ??= fetch("/room/us-states.json")
    .then((r) => (r.ok ? (r.json() as Promise<StateShape[]>) : []))
    .catch(() => []);
  return statesOnce;
}

const STAGE_GROUPS: Record<string, string[]> = { not_started: ["not_started"], scheduling: ["scheduling"], training_booked: ["training_booked"], trained: ["trained", "live"], live: ["live"], open: ["not_started", "scheduling", "training_booked"] };
const MARK_LABEL: Record<MapMark, string> = { live: "Live", progress: "In progress", open: "Not started" };

export function RoomMap({ store, noun, stage, wave = "", stageLabel }: { store: RoomStoreHandle | null; noun: string; stage: string; /** Show only this wave's pins (a wave key, or NO_WAVE for practices in none). */ wave?: string; stageLabel: (stage: string) => string }) {
  const rw = useRegionalsWord();
  const [data, setData] = useState<RoomMapData | null | "failed">(null);
  const [states, setStates] = useState<StateShape[]>([]);
  const [group, setGroup] = useState("");
  const [hover, setHover] = useState<{ p: RoomMapPoint; left: number; top: number } | null>(null);
  const [picked, setPicked] = useState<RoomMapPoint | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  /** True when the press that just ended was a pan, so the click that follows it is not taken as a pick. */
  const panned = useRef(false);
  const [zoomed, setZoomed] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store.loadPracticeMap().then((r) => !cancelled && setData(r ?? "failed"));
    void loadStates().then((s) => !cancelled && setStates(s));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const allPoints = data && data !== "failed" ? data.points : null;
  const points = useMemo(() => {
    const all = allPoints ?? [];
    if (!wave) return all;
    return wave === "__none" ? all.filter((p) => !(p.wave ?? "").trim()) : all.filter((p) => !!(p.wave ?? "").trim() && waveKey(p.wave!) === waveKey(wave));
  }, [allPoints, wave]);
  const placed = useMemo(() => points.filter((p): p is RoomMapPoint & { lat: number; lng: number } => p.lat != null && p.lng != null), [points]);
  const { by, groups, of } = useMemo(() => mapGroups(points), [points]);
  const colorOf = useMemo(() => new Map(groups.map((g) => [g.name, g.color])), [groups]);
  const fit = useMemo(() => fitMap(placed), [placed]);
  const pins = useMemo(() => fanOut(placed.map((p) => ({ p, x: fit.x(p.lng), y: fit.y(p.lat) }))), [placed, fit]);
  const outlines = useMemo(
    () =>
      states.map((s) => {
        let d = "";
        let big = { area: 0, cx: 0, cy: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
        for (const ring of s.rings) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (let i = 0; i < ring.length; i += 2) {
            const x = fit.x(ring[i]), y = fit.y(ring[i + 1]);
            d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
          d += "Z";
          const area = (x1 - x0) * (y1 - y0);
          if (area > big.area) big = { area, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x0, x1, y0, y1 };
        }
        return { id: s.id, name: s.name, d, cx: big.cx, cy: big.cy, box: { x0: big.x0, x1: big.x1, y0: big.y0, y1: big.y1 } };
      }),
    [states, fit],
  );

  /** States with at least one practice on the map. Only these can be clicked: an empty state has nothing to zoom to. */
  const filled = useMemo(() => new Set(pins.map((q) => (q.p.state ?? "").trim().toUpperCase()).filter(Boolean)), [pins]);
  const stages = stage ? STAGE_GROUPS[stage] : null;
  const shows = (p: RoomMapPoint) => (!group || of(p) === group) && (!stages || stages.includes(p.stage));
  const reset = () => {
    setZoomed("");
    setView({ k: 1, x: 0, y: 0 });
  };
  /** Picking a region or manager in the list shows only its pins and zooms to them; picking it again shows everything. */
  const pickGroup = (name: string) => {
    const next = group === name ? "" : name;
    setGroup(next);
    setZoomed("");
    const own = next ? pins.filter((q) => of(q.p) === next && (!stages || stages.includes(q.p.stage))) : [];
    const v = own.length ? zoomToBox(stateBox({ x0: 0, x1: W, y0: 0, y1: H }, own)) : null;
    // A group spread across the whole map has nothing to zoom to: stay on the full view.
    setView(v && v.k > 1.05 ? v : { k: 1, x: 0, y: 0 });
  };
  const zoom = (factor: number) =>
    setView((v) => {
      const k = Math.max(1, Math.min(12, v.k * factor));
      // Keep the middle of the map where it is while the scale changes.
      return k === 1 ? { k: 1, x: 0, y: 0 } : { k, x: W / 2 - ((W / 2 - v.x) / v.k) * k, y: H / 2 - ((H / 2 - v.y) / v.k) * k };
    });

  if (data === "failed") return <div className="prw-card"><div className="prw-empty">The map could not be loaded.</div></div>;
  if (!data) return <div className="prw-card prw-map-wait" aria-busy="true" />;
  if (placed.length === 0) return <div className="prw-card"><div className="prw-empty">No {noun} have a ZIP code yet.</div></div>;

  const r = 7.5 / view.k;
  const shownCount = placed.filter(shows).length;

  return (
    <div className="prw-card prw-map" data-room-map>
      <div
        className="prw-map-stage"
        ref={box}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          panned.current = false;
          drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId || view.k === 1) return;
          const scale = W / (box.current?.clientWidth || W);
          if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
          if (d.moved) setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx) * scale, y: d.oy + (e.clientY - d.sy) * scale }));
        }}
        onPointerUp={() => {
          panned.current = !!drag.current?.moved;
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
          setHover(null);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Map of ${placed.length} ${noun}`} className={view.k > 1 ? "pan" : ""} onDoubleClick={(e) => !(e.target as Element).closest?.("[data-room-map-state-filled]") && zoom(1.8)}>
          <g transform={`translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k})`}>
            {outlines.map((s) => (
              <path
                key={s.id}
                className={`st${filled.has(s.id) ? " has" : ""}${zoomed === s.id ? " on" : ""}`}
                d={s.d}
                data-room-map-state={s.id}
                data-room-map-state-filled={filled.has(s.id) ? "" : undefined}
                onClick={() => {
                  if (panned.current || !filled.has(s.id)) return;
                  setZoomed(s.id);
                  setView(zoomToBox(stateBox(s.box, pins.filter((q) => (q.p.state ?? "").trim().toUpperCase() === s.id)), W, H, 12, 1.25));
                }}
              >
                <title>{s.name}</title>
              </path>
            ))}
            {outlines.map((s) => <text key={s.id} className="sl" x={s.cx} y={s.cy} fontSize={11 / view.k}>{s.id}</text>)}
            {pins.map(({ p, x, y, dx, dy }) => {
              const color = colorOf.get(of(p)) ?? MAP_OTHER_COLOR;
              const mark = mapMark(p.stage);
              const cx = x + dx / view.k, cy = y + dy / view.k;
              const on = shows(p);
              return (
                <g
                  key={p.id}
                  className={`pin${on ? "" : " off"}${picked?.id === p.id ? " sel" : ""}`}
                  tabIndex={on ? 0 : -1}
                  role="button"
                  aria-label={`${p.name}, ${stageLabel(p.stage)}${p.regionalManager ? `, ${p.regionalManager}` : ""}`}
                  data-room-pin={mark}
                  onPointerEnter={(e) => {
                    const b = box.current?.getBoundingClientRect();
                    if (b) setHover({ p, left: e.clientX - b.left, top: e.clientY - b.top });
                  }}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setPicked(p)}
                  onClick={() => !panned.current && setPicked(p)}
                >
                  {/* A larger, invisible target so a small pin is easy to point at. */}
                  <circle cx={cx} cy={cy} r={r * 2} fill="transparent" />
                  <circle cx={cx} cy={cy} r={r} fill={mark === "live" ? color : "#fff"} stroke={mark === "live" ? "#fff" : color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  {mark === "progress" && <circle cx={cx} cy={cy} r={r * 0.4} fill={color} />}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="prw-map-zoom">
          <button type="button" onClick={() => zoom(1.6)} aria-label="Zoom in" data-room-map-zoom="in"><Plus aria-hidden /></button>
          <button type="button" onClick={() => { if (view.k / 1.6 <= 1) setZoomed(""); zoom(1 / 1.6); }} disabled={view.k === 1} aria-label="Zoom out"><Minus aria-hidden /></button>
          <button type="button" onClick={reset} disabled={view.k === 1} aria-label="Reset the map"><RotateCcw aria-hidden /></button>
        </div>
        {hover && (
          <div className="prw-map-tip" style={{ left: hover.left, top: hover.top }} role="status">
            <b>{hover.p.name}</b>
            <span>{[hover.p.city, hover.p.state].filter(Boolean).join(", ")}</span>
            <span>{[stageLabel(hover.p.stage), hover.p.regionalManager, hover.p.officeType].filter(Boolean).join(" · ")}</span>
          </div>
        )}
      </div>

      <div className="prw-map-side">
        {picked ? (
          <div className="prw-map-pick" data-room-map-picked>
            <button type="button" onClick={() => setPicked(null)} aria-label="Close"><X aria-hidden /></button>
            <b>{picked.name}</b>
            <span className={`prw-chip ${picked.stage}`}>{stageLabel(picked.stage)}</span>
            <dl>
              {picked.regionalManager && <><dt>{rw("Regional manager")}</dt><dd>{picked.regionalManager}</dd></>}
              {picked.officeType && <><dt>Office type</dt><dd>{picked.officeType}</dd></>}
              {(picked.address || picked.city) && <><dt>Address</dt><dd>{[picked.address, [picked.city, [picked.state, picked.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ")}</dd></>}
              {picked.phone && <><dt>Phone</dt><dd>{picked.phone}</dd></>}
              {picked.scannerCount != null && <><dt>Scanners</dt><dd>{picked.scannerCount}</dd></>}
            </dl>
          </div>
        ) : null}
        <h4>{by === "manager" ? rw("Regional managers") : "Regions"}</h4>
        <div className="prw-map-groups">
          {groups.map((g) => (
            <button type="button" key={g.name} className={group === g.name ? "on" : ""} aria-pressed={group === g.name} onClick={() => pickGroup(g.name)} data-room-map-group={g.name}>
              <i style={{ background: g.color }} />
              <span className="n">{g.name}</span>
              <span className="v prw-num">{g.live} of {g.total}</span>
              <span className="track"><span style={{ width: `${g.total ? Math.round((g.live / g.total) * 100) : 0}%`, background: g.color }} /></span>
            </button>
          ))}
        </div>
        <div className="prw-map-key">
          {(["live", "progress", "open"] as const).map((m) => (
            <span key={m}>
              <svg viewBox="0 0 16 16" aria-hidden>
                <circle cx="8" cy="8" r="5.5" fill={m === "live" ? "currentColor" : "#fff"} stroke="currentColor" strokeWidth="2" />
                {m === "progress" && <circle cx="8" cy="8" r="2.2" fill="currentColor" />}
              </svg>
              {MARK_LABEL[m]}
            </span>
          ))}
        </div>
        <p className="prw-map-note prw-num" data-room-map-count>
          {group || stages ? `${shownCount} of ${placed.length} shown` : `${placed.length} on the map`}
          {data.unplaced > 0 ? ` · ${data.unplaced} without a ZIP code` : ""}
        </p>
      </div>
    </div>
  );
}
