import { useState, useEffect, useRef, useMemo } from "react";
import { Flame, MousePointer2, ArrowDownFromLine, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const API_BASE = "/api";

interface ClickBucket {
  xBucket: number;
  yBucket: number;
  count: number;
}

interface ScrollBucket {
  depthBucket: number;
  sessions: number;
}

interface BlockClick {
  blockId: string;
  elementTag: string;
  count: number;
}

interface HeatmapStats {
  totalClicks: number;
  totalScrollEvents: number;
  uniqueSessions: number;
  avgScrollDepth: number;
}

interface HeatmapData {
  clickData: ClickBucket[];
  scrollData: ScrollBucket[];
  blockClicks: BlockClick[];
  stats: HeatmapStats;
}

type ViewMode = "click" | "scroll";
type DeviceFilter = "all" | "desktop" | "tablet" | "mobile";

function getHeatColor(intensity: number): string {
  // 0 = blue (cold) → 0.5 = yellow → 1 = red (hot)
  if (intensity <= 0.5) {
    const t = intensity * 2;
    const r = Math.round(255 * t);
    const g = Math.round(255 * t);
    const b = Math.round(255 * (1 - t));
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  }
  const t = (intensity - 0.5) * 2;
  const r = 255;
  const g = Math.round(255 * (1 - t));
  return `rgba(${r}, ${g}, 0, 0.7)`;
}

function ClickHeatmapCanvas({ data, maxCount }: { data: ClickBucket[]; maxCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw radial gradient dots for each click bucket
    for (const bucket of data) {
      const x = (bucket.xBucket / 100) * w;
      const y = (bucket.yBucket / 100) * h;
      const intensity = maxCount > 0 ? bucket.count / maxCount : 0;
      const radius = 12 + intensity * 30;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = 0.15 + intensity * 0.55;
      if (intensity > 0.7) {
        gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(255, 128, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 255, 0, 0)`);
      } else if (intensity > 0.3) {
        gradient.addColorStop(0, `rgba(255, 200, 0, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 100, ${alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(100, 255, 100, 0)`);
      } else {
        gradient.addColorStop(0, `rgba(0, 100, 255, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(50, 150, 255, ${alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, [data, maxCount]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={2400}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: "multiply" }}
    />
  );
}

function ScrollDepthBar({ scrollData, totalSessions }: { scrollData: ScrollBucket[]; totalSessions: number }) {
  // Build 10 buckets from 0-10%, 10-20%, ... 90-100%
  const buckets = Array.from({ length: 10 }, (_, i) => {
    const pct = i * 10;
    const bucket = scrollData.find(d => d.depthBucket === pct);
    return {
      range: `${pct}–${pct + 10}%`,
      sessions: bucket?.sessions ?? 0,
      pct: totalSessions > 0 ? ((bucket?.sessions ?? 0) / totalSessions) * 100 : 0,
    };
  });

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600 mb-2">Scroll depth distribution</div>
      {buckets.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="w-16 text-right text-slate-500 tabular-nums">{b.range}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-all"
              style={{
                width: `${Math.max(b.pct, 1)}%`,
                backgroundColor: i < 3 ? "#22c55e" : i < 6 ? "#eab308" : i < 8 ? "#f97316" : "#ef4444",
              }}
            />
          </div>
          <span className="w-8 text-slate-500 tabular-nums">{b.sessions}</span>
        </div>
      ))}
    </div>
  );
}

export function HeatmapOverlay({ pageId }: { pageId: number }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("click");
  const [device, setDevice] = useState<DeviceFilter>("all");
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/lp/pages/${pageId}/heatmap?type=${viewMode}&device=${device}&days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pageId, viewMode, device, days]);

  const maxClickCount = useMemo(() => {
    if (!data?.clickData.length) return 1;
    return Math.max(...data.clickData.map(d => d.count));
  }, [data?.clickData]);

  const blockClickChart = useMemo(() => {
    if (!data?.blockClicks.length) return [];
    // Group by blockId, sum counts
    const byBlock = new Map<string, number>();
    for (const bc of data.blockClicks) {
      const key = bc.blockId ?? "unknown";
      byBlock.set(key, (byBlock.get(key) ?? 0) + bc.count);
    }
    return Array.from(byBlock.entries())
      .map(([id, count]) => ({ id: id.length > 20 ? id.slice(0, 18) + "…" : id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [data?.blockClicks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = data?.stats ?? { totalClicks: 0, totalScrollEvents: 0, uniqueSessions: 0, avgScrollDepth: 0 };
  const hasData = stats.uniqueSessions > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={viewMode === "click" ? "default" : "outline"}
            onClick={() => setViewMode("click")}
            className="h-7 text-xs gap-1"
          >
            <MousePointer2 className="w-3 h-3" /> Clicks
          </Button>
          <Button
            size="sm"
            variant={viewMode === "scroll" ? "default" : "outline"}
            onClick={() => setViewMode("scroll")}
            className="h-7 text-xs gap-1"
          >
            <ArrowDownFromLine className="w-3 h-3" /> Scroll
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "desktop", "tablet", "mobile"] as DeviceFilter[]).map(d => (
            <Button
              key={d}
              size="sm"
              variant={device === d ? "default" : "ghost"}
              onClick={() => setDevice(d)}
              className="h-7 text-xs px-2"
            >
              {d === "all" ? "All" : d === "desktop" ? <Monitor className="w-3 h-3" /> : d === "tablet" ? <Tablet className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
            </Button>
          ))}
        </div>
        <select
          className="text-xs border rounded px-2 py-1 bg-white"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Sessions", value: stats.uniqueSessions },
          { label: "Clicks", value: stats.totalClicks },
          { label: "Avg scroll", value: `${stats.avgScrollDepth ?? 0}%` },
          { label: "Clicks/session", value: stats.uniqueSessions > 0 ? (stats.totalClicks / stats.uniqueSessions).toFixed(1) : "0" },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-lg font-semibold text-slate-800">{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {!hasData && (
        <div className="text-center py-8 text-slate-400">
          <Flame className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No heatmap data yet</p>
          <p className="text-xs mt-1">Heatmap data will appear once visitors interact with this page.</p>
        </div>
      )}

      {hasData && viewMode === "click" && (
        <>
          {/* Click heatmap visualization */}
          <div className="relative bg-slate-100 rounded-lg overflow-hidden border" style={{ minHeight: 400, aspectRatio: "1/3" }}>
            <ClickHeatmapCanvas data={data!.clickData} maxCount={maxClickCount} />
            <div className="absolute bottom-2 right-2 flex gap-1 text-[9px] text-slate-500">
              <span className="px-1 rounded" style={{ background: "rgba(0,100,255,0.3)" }}>Low</span>
              <span className="px-1 rounded" style={{ background: "rgba(255,200,0,0.5)" }}>Med</span>
              <span className="px-1 rounded" style={{ background: "rgba(255,0,0,0.5)" }}>High</span>
            </div>
          </div>

          {/* Block click breakdown */}
          {blockClickChart.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">Clicks by block</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={blockClickChart} layout="vertical" margin={{ left: 60, right: 10, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="id" tick={{ fontSize: 10 }} width={55} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {blockClickChart.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#ef4444" : i < 3 ? "#f97316" : "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {hasData && viewMode === "scroll" && (
        <ScrollDepthBar scrollData={data!.scrollData} totalSessions={stats.uniqueSessions} />
      )}
    </div>
  );
}
