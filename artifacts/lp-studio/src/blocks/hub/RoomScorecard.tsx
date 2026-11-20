/**
 * The Scorecard module of a partner room: where the rollout stands, location
 * by location.
 *
 *   tiles     one number per stage, evenly spaced; click one to see only
 *             those locations (click again to clear)
 *   bar       the same split as one stacked bar
 *   trend     how the counts moved, one point per day the list refreshed
 *   goals     the room's location goals with a progress bar each
 *   regions   live share per region; click a region to filter
 *   table     search, filters, sortable columns, and a column chooser
 *
 * For the page owner's own team only: a call-out when what Salesforce lists
 * does not match the roster the customer uploaded (so the account hierarchy
 * can be fixed). A customer never sees it.
 *
 * Styles live in the room block's CSS string (`.prw-sc-*`).
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, Columns3, Download, List, Mail, Package, Map as MapIcon, Search, X } from "lucide-react";
import { RoomMap } from "./RoomMap";
import type { RoomKitResult, RoomPractice, RoomPracticePage, RoomPracticeSort, RoomPracticeStageFilter, RoomScorecardCheck, RoomSnapshot, RoomStoreHandle } from "./room-client";

export const SCORECARD_STAGE_LABEL: Record<string, string> = { not_started: "Not started", scheduling: "Scheduling", training_booked: "Training booked", trained: "Trained", live: "Live" };
const STAGE_ORDER = ["not_started", "scheduling", "training_booked", "trained", "live"] as const;

type Trend = NonNullable<RoomSnapshot["practices"]["trend"]>;

/** What a tile counts, from the stage counts. "trained" includes live ones (a live location was trained). */
export function tileCount(byStage: Record<string, number>, total: number, tile: RoomPracticeStageFilter | "all"): number {
  const n = (k: string) => byStage[k] ?? 0;
  if (tile === "all") return total;
  if (tile === "trained") return n("trained") + n("live");
  if (tile === "open") return n("not_started") + n("scheduling") + n("training_booked");
  return n(tile);
}

/**
 * How a tile moved against the newest point at least `days` old (so "this
 * week" compares with a week ago, not with this morning). Null with no point
 * that old.
 */
export function trendDelta(trend: Trend, tile: RoomPracticeStageFilter | "all", days = 7, today: string = new Date().toISOString().slice(0, 10)): number | null {
  if (trend.length === 0) return null;
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const limit = cutoff.toISOString().slice(0, 10);
  const then = [...trend].reverse().find((p) => p.day <= limit);
  const now = trend[trend.length - 1];
  if (!then || then === now) return null;
  return tileCount(now.byStage, now.total, tile) - tileCount(then.byStage, then.total, tile);
}

/** "today, 9:14 PM" for the same day, otherwise "Nov 16, 9:14 PM", in the reader's own time. */
export function updatedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? `today, ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

/** Points for a small line chart: x across the days, y from 0 to the largest value. */
export function sparkPoints(values: number[], width: number, height: number, top?: number): string {
  if (values.length === 0) return "";
  const max = Math.max(1, top ?? 0, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
}

export interface ScorecardGoal {
  key: string;
  title: string;
  value: number;
  target: number;
  targetText?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  sort: RoomPracticeSort;
  /** Shown unless the viewer turns it off. */
  on: boolean;
  /** Only offered when the list has data for it. */
  has?: keyof NonNullable<RoomPracticePage["columns"]>;
  teamOnly?: boolean;
  cell: (p: RoomPractice) => React.ReactNode;
}

/**
 * A cell that may be a yes/no flag (Salesforce reports write true/false or
 * 1/0 for "scanner delivered"): a tick for yes, nothing for no, and any other
 * value (a date, a name) as written.
 */
export function flagOrText(value: string | null | undefined): { tick: boolean; text: string } {
  const v = (value ?? "").trim();
  if (/^(true|yes|y|1)$/i.test(v)) return { tick: true, text: "" };
  if (/^(false|no|n|0)$/i.test(v)) return { tick: false, text: "" };
  return { tick: false, text: v };
}
const Flag = ({ value }: { value: string | null | undefined }) => {
  const f = flagOrText(value);
  return f.tick ? <span className="prw-sc-yes" role="img" aria-label="Yes"><Check aria-hidden /></span> : <>{f.text}</>;
};

const COLUMNS: ColumnDef[] = [
  { key: "region", label: "Region", sort: "region", on: true, cell: (p) => p.region },
  { key: "state", label: "State", sort: "state", on: false, cell: (p) => p.state },
  { key: "manager", label: "Regional manager", sort: "regionalManager", on: true, has: "manager", cell: (p) => p.regionalManager },
  { key: "wave", label: "Wave", sort: "wave", on: true, has: "wave", cell: (p) => p.wave },
  {
    key: "address",
    label: "Address",
    sort: "state",
    on: true,
    has: "address",
    cell: (p) => (
      <>
        {p.address}
        {(p.address || p.zip) && <div className="m">{[p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>}
      </>
    ),
  },
  { key: "type", label: "Office type", sort: "officeType", on: true, has: "officeType", cell: (p) => p.officeType },
  { key: "office", label: "Office manager", sort: "officeManager", on: true, has: "office", cell: (p) => p.officeManager },
  {
    key: "doctors",
    label: "Doctors",
    sort: "doctors",
    on: true,
    has: "doctors",
    cell: (p) =>
      (p.doctors ?? []).length > 0 ? (
        <details className="prw-sc-docs" data-room-practice-doctors>
          <summary><span className="prw-num" style={{ color: "var(--ink)", fontWeight: 600, margin: 0, fontSize: "inherit" }}>{p.doctors!.length}</span><span>show</span></summary>
          <ul>{p.doctors!.map((d, i) => <li key={i}>{d.name}{d.role ? ` · ${d.role}` : ""}</li>)}</ul>
        </details>
      ) : null,
  },
  { key: "contract", label: "Contract signed", sort: "contractSigned", on: false, has: "contract", cell: (p) => <Flag value={p.contractSigned} /> },
  { key: "training", label: "Training", sort: "trainingDate", on: true, cell: (p) => p.trainingDate },
  { key: "live", label: "Live", sort: "liveDate", on: true, cell: (p) => p.liveDate },
  {
    key: "scanners",
    label: "Scanners",
    sort: "scannerCount",
    on: true,
    has: "scannerCount",
    cell: (p) => (
      <>
        {p.scannerCount != null && <span className="prw-num" style={{ color: "var(--ink)", fontWeight: 600 }}>{p.scannerCount}</span>}
        {p.scannerModels && <div className="m">{p.scannerModels}</div>}
      </>
    ),
  },
  { key: "brand", label: "Scanner brand", sort: "scannerBrand", on: false, has: "brand", cell: (p) => p.scannerBrand },
  { key: "sent", label: "Scanner sent", sort: "scannerSent", on: true, has: "scanner", cell: (p) => <Flag value={p.scannerSent} /> },
  { key: "activated", label: "Activated", sort: "scannerActivated", on: true, has: "scanner", cell: (p) => <Flag value={p.scannerActivated} /> },
  { key: "kit", label: "Welcome kit", sort: "kitSentAt", on: true, has: "kit", teamOnly: true, cell: (p) => (p.kitSentAt ? new Date(p.kitSentAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null) },
  { key: "owner", label: "Account owner", sort: "owner", on: false, has: "owner", teamOnly: true, cell: (p) => p.owner },
  { key: "activity", label: "Last activity", sort: "lastActivity", on: false, has: "activity", teamOnly: true, cell: (p) => p.lastActivity },
];

const COLS_KEY = "lp_room_scorecard_cols";
function savedColumns(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLS_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const TILES: { key: RoomPracticeStageFilter | "all"; label: string }[] = [
  { key: "all", label: "In the rollout" },
  { key: "not_started", label: "Not started" },
  { key: "scheduling", label: "Scheduling" },
  { key: "training_booked", label: "Training booked" },
  { key: "trained", label: "Trained" },
  { key: "live", label: "Live" },
];

export function ScorecardView({ snapshot, store, isEditor, noun, display, goals, onNeedEmail, mapShared = false }: { snapshot: RoomSnapshot; store: RoomStoreHandle | null; /** The hub shows its map to every visitor, not only the team. */ mapShared?: boolean; isEditor: boolean; noun: string; display: string; goals: ScorecardGoal[]; onNeedEmail: () => void }) {
  const pr = snapshot.practices;
  const trend = pr.trend ?? [];
  const byRegion = pr.byRegion ?? [];
  const waves = pr.waves ?? [];
  const isTeam = !!snapshot.viewer?.team;
  const one = noun.replace(/s$/, "");
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const [stage, setStage] = useState<RoomPracticeStageFilter | "">("");
  const [region, setRegion] = useState("");
  const [wave, setWave] = useState("");
  const [scanner, setScanner] = useState<"" | "yes" | "no">("");
  const [q, setQ] = useState("");
  const [pageNo, setPageNo] = useState(0);
  const [sort, setSort] = useState<{ key: RoomPracticeSort; dir: "asc" | "desc" } | null>(null);
  const [data, setData] = useState<RoomPracticePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [colsOpen, setColsOpen] = useState(false);
  const [allRegions, setAllRegions] = useState(false);
  const [check, setCheck] = useState<RoomScorecardCheck | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  // The map shows which offices are not ordering: it is for the team's own view unless the hub shares it.
  const [mode, setMode] = useState<"list" | "map">("list");
  // Team only: tick practices (the ticks last across pages and filters) and export them as a CSV.
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const tick = (ids: number[], on: boolean) =>
    setTicked((cur) => {
      const next = new Set(cur);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  const exportNow = async () => {
    if (!store || exporting) return;
    setExporting(true);
    setExportNote("");
    const file = await store.exportPractices(ticked.size ? [...ticked] : undefined);
    setExporting(false);
    if (!file) return setExportNote("Couldn't export.");
    const url = URL.createObjectURL(new Blob([file.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  // Welcome kits: ask first what would be sent (it puts practices on the direct-mail list), then send.
  const [kit, setKit] = useState<{ state: "asking" | "confirm" | "sending" | "done" | "error"; result?: RoomKitResult } | null>(null);
  const [reload, setReload] = useState(0);
  const askKit = async () => {
    if (!store || ticked.size === 0) return;
    setKit({ state: "asking" });
    const r = await store.welcomeKit([...ticked], true);
    setKit(r.ok ? { state: "confirm", result: r } : { state: "error", result: r });
  };
  const sendKit = async () => {
    if (!store || !kit?.result) return;
    setKit({ state: "sending", result: kit.result });
    const r = await store.welcomeKit([...ticked], false);
    setKit({ state: r.ok ? "done" : "error", result: r });
    if (r.ok) {
      setTicked(new Set());
      setReload((n) => n + 1);
    }
  };
  const canMap = isTeam || mapShared;
  const mapOn = canMap && mode === "map";

  useEffect(() => setPicked(savedColumns()), []);
  const viewerKey = snapshot.viewer?.email ?? "";
  useEffect(() => {
    if (!store || !viewerKey) return;
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      void store.loadPractices({ region, q, page: pageNo, ...(stage ? { stage } : {}), ...(wave ? { wave } : {}), ...(scanner ? { scanner } : {}), ...(sort ? { sort: sort.key, dir: sort.dir } : {}) }).then((r) => {
        if (cancelled) return;
        setLoading(false);
        if (r && r !== "identity") setData(r);
      });
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [store, viewerKey, region, q, pageNo, pr.total, sort, stage, wave, scanner, reload]);

  // Team only: does Salesforce match the customer's rosters? Asked once per visit.
  useEffect(() => {
    if (!store || !isTeam || pr.total === 0) return;
    let cancelled = false;
    void store.checkScorecard().then((r) => !cancelled && setCheck(r));
    return () => {
      cancelled = true;
    };
  }, [store, isTeam, pr.total]);

  const sortBy = (key: RoomPracticeSort) => {
    setPageNo(0);
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  };
  const pick = (tile: RoomPracticeStageFilter | "all") => {
    setPageNo(0);
    setStage((s) => (tile === "all" || s === tile ? "" : tile));
  };
  const has = data?.columns;
  const offered = useMemo(() => COLUMNS.filter((c) => (!c.teamOnly || isTeam) && (!c.has || !!has?.[c.has] || (!has && c.on && !c.teamOnly))), [has, isTeam]);
  const shown = offered.filter((c) => picked[c.key] ?? c.on);
  const toggleColumn = (key: string, on: boolean) => {
    const next = { ...picked, [key]: on };
    setPicked(next);
    try {
      window.localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {
      /* private window: the choice lasts for this visit */
    }
  };
  const colCount = shown.length + 2 + (isTeam ? 1 : 0);
  const pageIds = (data?.rows ?? []).map((p) => p.id);
  const pageAllTicked = pageIds.length > 0 && pageIds.every((id) => ticked.has(id));
  const filtered = !!(stage || region || wave || scanner || q);
  const clear = () => {
    setStage("");
    setRegion("");
    setWave("");
    setScanner("");
    setQ("");
    setPageNo(0);
  };

  const Th = ({ k, children, width }: { k: RoomPracticeSort; children: React.ReactNode; width?: string }) => (
    <th style={width ? { width } : undefined} aria-sort={sort?.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`prw-th${sort?.key === k ? " on" : ""}`} onClick={() => sortBy(k)} data-room-sort={k}>
        {children}
        {sort?.key === k ? sort.dir === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden /> : <ArrowUpDown aria-hidden />}
      </button>
    </th>
  );

  const liveSeries = trend.map((p) => p.byStage.live ?? 0);
  const trainedSeries = trend.map((p) => (p.byStage.trained ?? 0) + (p.byStage.live ?? 0));
  const regionsShown = allRegions ? byRegion : byRegion.slice(0, 6);
  const mismatch = check?.checked ? (check.missingCount ?? 0) + (check.notOnRosterCount ?? 0) : 0;

  return (
    <>
      <div className="prw-hd">
        <div>
          <h2 style={{ fontFamily: display }}>Scorecard</h2>
        </div>
        <div className="prw-sc-hd">
          {(pr.regions.length > 0 || pr.syncedAt) && (
            <div className="prw-meta">
              {pr.regions.length > 0 && <><b>{pr.total}</b> {noun} · <b>{pr.regions.length}</b> regions</>}
              {pr.syncedAt && <span className="prw-sc-sync" data-room-scorecard-synced title="The list refreshes from Salesforce about every hour">Updated {updatedLabel(pr.syncedAt)}</span>}
            </div>
          )}
          {canMap && pr.total > 0 && (
            <span className="prw-seg" role="group" aria-label="View" data-room-scorecard-mode={mode}>
              <button type="button" className={mode === "list" ? "on" : ""} aria-pressed={mode === "list"} onClick={() => setMode("list")}><List aria-hidden /> List</button>
              <button type="button" className={mode === "map" ? "on" : ""} aria-pressed={mode === "map"} onClick={() => setMode("map")} data-room-scorecard-map><MapIcon aria-hidden /> Map</button>
            </span>
          )}
        </div>
      </div>

      {isTeam && check?.checked && (
        <div className={`prw-sc-check${mismatch ? " warn" : ""}`} data-room-scorecard-check={mismatch ? "mismatch" : "match"}>
          <div className="hd">
            {mismatch ? <AlertTriangle aria-hidden /> : <CheckCircle2 aria-hidden />}
            <div>
              <b>{mismatch ? "Salesforce doesn't match the customer's roster" : "Salesforce matches the customer's roster"}</b>
              <span>
                {mismatch
                  ? `${check.matched ?? 0} of the ${check.onRoster ?? 0} ${noun} on “${check.fileName}” are in Salesforce. Fix the account hierarchy so the scorecard counts every ${one}.`
                  : `All ${check.onRoster ?? 0} ${noun} on “${check.fileName}” are in Salesforce.`}
                {check.doctors ? ` Their roster lists ${check.doctors} doctors${check.doctorsUnmatched ? `, ${check.doctorsUnmatched} of them at a practice that isn't in Salesforce` : ""}.` : ""}
                {check.enriched ? ` It added regional managers, office managers or addresses to ${check.enriched} ${noun}.` : ""}
                {check.added ? ` ${check.added} ${noun} from their roster were added to the hub.` : ""}
              </span>
            </div>
            <em>Only your team sees this</em>
          </div>
          {((check.likely ?? []).length > 0 || (check.issues ?? []).length > 0) && (
            <ul className="extra">
              {(check.likely ?? []).length > 0 && <li><b>{check.likely!.length}</b> matched by a close name, worth a look: {check.likely!.slice(0, 4).map((l) => `“${l.roster}” → “${l.ours}”`).join("; ")}{check.likely!.length > 4 ? "…" : ""}</li>}
              {(check.issues ?? []).map((i) => <li key={i}>In the file: {i}</li>)}
            </ul>
          )}
          {mismatch > 0 && (
            <>
              <div className="rows">
                {(check.missingCount ?? 0) > 0 && <div><b className="prw-num">{check.missingCount}</b> on their roster, not in Salesforce (child accounts to add or re-parent)</div>}
                {(check.notOnRosterCount ?? 0) > 0 && <div><b className="prw-num">{check.notOnRosterCount}</b> in Salesforce, not on their roster (wrong parent, closed, or missing from their list)</div>}
              </div>
              <button type="button" className="prw-btn" onClick={() => setCheckOpen((o) => !o)} data-room-scorecard-names>{checkOpen ? "Hide names" : "Show names"}</button>
              {checkOpen && (
                <div className="names">
                  {(check.missingFromSalesforce ?? []).length > 0 && (
                    <div>
                      <h5>Not in Salesforce</h5>
                      <ul>{(check.missingFromSalesforce ?? []).map((n) => <li key={n}>{n}</li>)}</ul>
                    </div>
                  )}
                  {(check.notOnRoster ?? []).length > 0 && (
                    <div>
                      <h5>Not on their roster</h5>
                      <ul>{(check.notOnRoster ?? []).map((n) => <li key={n}>{n}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="prw-sc-tiles" style={{ ["--n" as string]: TILES.length + (pr.scanners ? 1 : 0) + (pr.doctors ? 1 : 0) }} data-room-practice-summary>
        {TILES.map((t) => {
          const n = tileCount(pr.byStage, pr.total, t.key);
          const delta = trendDelta(trend, t.key);
          const active = t.key === "all" ? !stage : stage === t.key;
          return (
            <button key={t.key} type="button" className={`prw-sc-tile${active ? " on" : ""}`} aria-pressed={active} onClick={() => pick(t.key)} data-room-tile={t.key}>
              <b className="prw-num">{n}</b>
              <span>{t.label}</span>
              <small>
                {t.key !== "all" && pr.total > 0 ? `${Math.round((n / pr.total) * 100)}%` : " "}
                {/* More trained or live is good news; the other tiles just move as locations progress, so they stay neutral. */}
                {delta ? <i className={t.key === "trained" || t.key === "live" ? (delta > 0 ? "up" : "down") : ""}>{delta > 0 ? "+" : ""}{delta} this week</i> : null}
              </small>
            </button>
          );
        })}
        {pr.doctors && (
          <div className="prw-sc-tile" data-room-tile="doctors">
            <b className="prw-num">{pr.doctors.total}</b>
            <span>Doctors</span>
            <small>{pr.doctors.matched === pr.doctors.total ? "all at a listed practice" : `${pr.doctors.total - pr.doctors.matched} not placed yet`}</small>
          </div>
        )}
        {pr.scanners && (
          <button type="button" className={`prw-sc-tile${scanner === "yes" ? " on" : ""}`} aria-pressed={scanner === "yes"} onClick={() => { setPageNo(0); setScanner((s) => (s === "yes" ? "" : "yes")); }} data-room-tile="scanners">
            <b className="prw-num">{pr.scanners.practices}</b>
            <span>With scanners</span>
            <small>{pr.scanners.total} scanners</small>
          </button>
        )}
      </div>

      {mapOn && <RoomMap store={store} noun={noun} stage={stage} stageLabel={(s) => SCORECARD_STAGE_LABEL[s] ?? s} />}

      {!mapOn && pr.total > 0 && (
        <div className="prw-sc-bar" role="img" aria-label={STAGE_ORDER.map((s) => `${SCORECARD_STAGE_LABEL[s]}: ${pr.byStage[s] ?? 0}`).join(", ")}>
          {STAGE_ORDER.map((s) => ((pr.byStage[s] ?? 0) > 0 ? <span key={s} className={s} style={{ flexGrow: pr.byStage[s] }} title={`${SCORECARD_STAGE_LABEL[s]}: ${pr.byStage[s]}`} /> : null))}
        </div>
      )}

      {!mapOn && pr.total > 0 && (
        <div className="prw-sc-grid">
          <div className="prw-card prw-sc-panel" data-room-scorecard-trend>
            <h4>Trend</h4>
            {trend.length >= 2 ? (
              <>
                <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden>
                  <polyline className="trained" points={sparkPoints(trainedSeries, 300, 66)} transform="translate(0,2)" />
                  <polyline className="live" points={sparkPoints(liveSeries, 300, 66, Math.max(...trainedSeries))} transform="translate(0,2)" />
                </svg>
                <div className="key">
                  <span><i className="live" /> Live <b className="prw-num">{liveSeries[liveSeries.length - 1]}</b></span>
                  <span><i className="trained" /> Trained <b className="prw-num">{trainedSeries[trainedSeries.length - 1]}</b></span>
                  <span className="since">since {trend[0].day}</span>
                </div>
              </>
            ) : (
              <p className="none">Not enough history yet.</p>
            )}
          </div>
          <div className="prw-card prw-sc-panel" data-room-scorecard-goals>
            <h4>Goals</h4>
            {goals.length > 0 ? (
              goals.map((g) => {
                const pct = Math.max(0, Math.min(100, Math.round((g.value / g.target) * 100)));
                return (
                  <div className="goal" key={g.key}>
                    <div className="top"><span>{g.title}</span><b className="prw-num">{g.value} of {g.target}</b></div>
                    <div className="track"><span style={{ width: `${pct}%` }} /></div>
                    <div className="foot">{pct}%{g.targetText ? ` · target ${g.targetText}` : ""}</div>
                  </div>
                );
              })
            ) : (
              <p className="none">No goals with a number yet.</p>
            )}
          </div>
        </div>
      )}

      {!mapOn && byRegion.length > 1 && (
        <div className="prw-card prw-sc-regions" data-room-scorecard-regions>
          <div className="hd"><h4>By region</h4><span>Click a region to see its {noun}</span></div>
          {regionsShown.map((r) => {
            const pct = r.total ? Math.round((r.live / r.total) * 100) : 0;
            return (
              <button type="button" key={r.region} className={region === r.region ? "on" : ""} onClick={() => { setPageNo(0); setRegion((cur) => (cur === r.region ? "" : r.region)); }} data-room-region={r.region}>
                <span className="n">{r.region}</span>
                <span className="track"><span style={{ width: `${pct}%` }} /></span>
                <span className="v prw-num">{r.live} of {r.total} live</span>
              </button>
            );
          })}
          {byRegion.length > 6 && <button type="button" className="more" onClick={() => setAllRegions((a) => !a)}>{allRegions ? "Show fewer" : `Show all ${byRegion.length} regions`}</button>}
        </div>
      )}

      {mapOn ? null : pr.total === 0 ? (
        <div className="prw-card"><div className="prw-empty">No {noun} loaded yet.</div></div>
      ) : !snapshot.viewer && !isEditor ? (
        <div className="prw-card">
          <div className="prw-li">
            <div>
              <div className="t">Confirm your email to see each {one}</div>
            </div>
            <div className="a"><button type="button" className="prw-btn pri" onClick={onNeedEmail}><Mail aria-hidden /> Confirm email</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="prw-tools prw-sc-tools">
            <label className="prw-sc-search">
              <Search aria-hidden />
              <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} aria-label={`Search ${noun}`} />
            </label>
            <select value={region} onChange={(e) => { setRegion(e.target.value); setPageNo(0); }} aria-label="Region">
              <option value="">All regions</option>
              {pr.regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={stage} onChange={(e) => { setStage(e.target.value as RoomPracticeStageFilter | ""); setPageNo(0); }} aria-label="Status">
              <option value="">Any status</option>
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{s === "trained" ? "Trained (incl. live)" : SCORECARD_STAGE_LABEL[s]}</option>)}
              <option value="open">Not yet trained</option>
            </select>
            {waves.length > 0 && (
              <select value={wave} onChange={(e) => { setWave(e.target.value); setPageNo(0); }} aria-label="Wave">
                <option value="">All waves</option>
                {waves.map((w) => <option key={w} value={w}>Wave {w}</option>)}
              </select>
            )}
            {pr.scanners && (
              <select value={scanner} onChange={(e) => { setScanner(e.target.value as "" | "yes" | "no"); setPageNo(0); }} aria-label="Scanners">
                <option value="">Scanner or not</option>
                <option value="yes">Has a scanner</option>
                <option value="no">No scanner yet</option>
              </select>
            )}
            <div className="prw-sc-cols">
              <button type="button" className="prw-btn" aria-expanded={colsOpen} onClick={() => setColsOpen((o) => !o)} data-room-columns><Columns3 aria-hidden /> Columns</button>
              {colsOpen && (
                <div className="menu" role="group" aria-label="Columns">
                  {offered.map((c) => (
                    <label key={c.key}>
                      <input type="checkbox" checked={picked[c.key] ?? c.on} onChange={(e) => toggleColumn(c.key, e.target.checked)} data-room-column={c.key} />
                      {c.label}
                      {c.teamOnly && <em>team only</em>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {filtered && <button type="button" className="prw-btn" onClick={clear} data-room-clear><X aria-hidden /> Clear</button>}
          </div>
          {isTeam && (
            <div className="prw-sc-picked" data-room-picked={ticked.size}>
              <span className="prw-num">{ticked.size ? `${ticked.size} selected` : ""}</span>
              {ticked.size > 0 && <button type="button" className="prw-btn" onClick={() => setTicked(new Set())} data-room-unpick><X aria-hidden /> Clear</button>}
              <button type="button" className="prw-btn" disabled={exporting} onClick={() => void exportNow()} data-room-export><Download aria-hidden /> {ticked.size ? "Export" : "Export all"}</button>
              {ticked.size > 0 && <button type="button" className="prw-btn pri" disabled={kit?.state === "asking" || kit?.state === "sending"} onClick={() => void askKit()} data-room-kit><Package aria-hidden /> Send welcome kit</button>}
              {exportNote && <span role="status">{exportNote}</span>}
            </div>
          )}
          {isTeam && kit && kit.state !== "asking" && (
            <div className={`prw-sc-kit${kit.state === "error" ? " warn" : ""}`} role="status" data-room-kit-state={kit.state}>
              {kit.state === "error" && <p><b>{kit.result?.error ?? "That didn't work."}</b></p>}
              {(kit.state === "confirm" || kit.state === "sending") && (
                <p>
                  <b>{kit.result!.sent.length ? `Add ${kit.result!.sent.length} ${kit.result!.sent.length === 1 ? one : noun} to the welcome kit list?` : `None of these can be added.`}</b>
                </p>
              )}
              {kit.state === "done" && <p><b>{kit.result!.sent.length} added to the welcome kit list.</b>{kit.result!.sheetUrl ? <> <a href={kit.result!.sheetUrl} target="_blank" rel="noreferrer">Open the list</a></> : null}</p>}
              {kit.state !== "error" && (kit.result?.already.length ?? 0) > 0 && <p>{kit.result!.already.length} already on the list: {kit.result!.already.slice(0, 6).join(", ")}{kit.result!.already.length > 6 ? "…" : ""}</p>}
              {kit.state !== "error" && (kit.result?.noAddress.length ?? 0) > 0 && <p>{kit.result!.noAddress.length} with no full address: {kit.result!.noAddress.slice(0, 6).join(", ")}{kit.result!.noAddress.length > 6 ? "…" : ""}</p>}
              <div className="b">
                {(kit.state === "confirm" || kit.state === "sending") && kit.result!.sent.length > 0 && <button type="button" className="prw-btn pri" disabled={kit.state === "sending"} onClick={() => void sendKit()} data-room-kit-send><Package aria-hidden /> {kit.state === "sending" ? "Adding…" : "Add them"}</button>}
                <button type="button" className="prw-btn" onClick={() => setKit(null)} data-room-kit-close>{kit.state === "done" || kit.state === "error" ? "Close" : "Cancel"}</button>
              </div>
            </div>
          )}
          <div className="prw-scroll">
            <table style={{ minWidth: colCount > 6 ? 980 : undefined }}>
              <thead>
                <tr>
                  {isTeam && (
                    <th className="prw-sc-pick">
                      <input type="checkbox" checked={pageAllTicked} onChange={(e) => tick(pageIds, e.target.checked)} aria-label={`Select every ${one} on this page`} data-room-pick-page />
                    </th>
                  )}
                  <Th k="name" width={colCount > 6 ? "24%" : "34%"}>{Noun.replace(/s$/, "")}</Th>
                  {shown.map((c) => <Th key={c.key} k={c.sort}>{c.label}</Th>)}
                  <Th k="stage">Status</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((p) => (
                  <tr key={p.id} data-room-practice={p.stage} className={ticked.has(p.id) ? "picked" : undefined}>
                    {isTeam && (
                      <td className="prw-sc-pick">
                        <input type="checkbox" checked={ticked.has(p.id)} onChange={(e) => tick([p.id], e.target.checked)} aria-label={`Select ${p.name}`} data-room-pick={p.id} />
                      </td>
                    )}
                    <td>
                      <div className="t">{p.name}</div>
                      {(p.city || p.state) && <div className="m">{[p.city, p.state].filter(Boolean).join(", ")}</div>}
                    </td>
                    {shown.map((c) => <td key={c.key} className="c">{c.cell(p)}</td>)}
                    <td><span className={`prw-chip ${p.stage}`}>{SCORECARD_STAGE_LABEL[p.stage] ?? p.stage}</span></td>
                  </tr>
                ))}
                {data && data.rows.length === 0 && <tr><td colSpan={colCount} className="c">Nothing matches.</td></tr>}
                {!data && <tr><td colSpan={colCount} className="c">{loading ? "Loading…" : ""}</td></tr>}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="prw-pager">
              <span className="prw-num">
                {data.total === 0 ? "0" : `${pageNo * data.pageSize + 1}–${Math.min(data.total, (pageNo + 1) * data.pageSize)}`} of {data.total}
                {filtered ? ` (filtered from ${pr.total})` : ""}
              </span>
              {data.total > data.pageSize && (
                <span style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="prw-btn" disabled={pageNo === 0} onClick={() => setPageNo((n) => n - 1)}>Previous</button>
                  <button type="button" className="prw-btn" disabled={(pageNo + 1) * data.pageSize >= data.total} onClick={() => setPageNo((n) => n + 1)}>Next</button>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
