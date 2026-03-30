import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Loader2, MousePointer2, ArrowDownFromLine, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { scorePageSeoGeo, type ScoreResult } from "@/lib/seo-scoring";
import type { PageBlock } from "@/lib/block-types";

const API_BASE = "/api";

interface PerformanceData {
  metrics: {
    cvr: number;
    impressions: number;
    conversions: number;
    totalVisits: number;
    avgScrollDepth: number;
    clicksPerSession: number;
  };
  scores: {
    cvr: number;
    scroll: number;
    engagement: number;
  };
}

function ScoreRing({ score, size = 56, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

function MetricRow({ icon: Icon, label, value, score, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className={cn("w-3.5 h-3.5", color)} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-slate-600">{label}</div>
        <div className="text-xs font-medium text-slate-800">{value}</div>
      </div>
      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${score}%`,
            backgroundColor: score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444",
          }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{score}</span>
    </div>
  );
}

export function PerformanceScorePanel({
  pageId,
  blocks,
  meta,
}: {
  pageId: number;
  blocks: PageBlock[];
  meta: { metaTitle?: string; metaDescription?: string; ogImage?: string; slug?: string };
}) {
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/lp/pages/${pageId}/performance`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setPerfData(d ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pageId]);

  const seoScore = useMemo(() => {
    if (blocks.length === 0) return null;
    return scorePageSeoGeo(blocks, meta);
  }, [blocks, meta]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  const seoScoreValue = seoScore?.overallScore ?? 0;
  const cvrScore = perfData?.scores.cvr ?? 0;
  const scrollScore = perfData?.scores.scroll ?? 0;
  const engagementScore = perfData?.scores.engagement ?? 0;

  // Composite: CVR 40%, Scroll 20%, Engagement 20%, SEO 20%
  const composite = Math.round(
    cvrScore * 0.40 +
    scrollScore * 0.20 +
    engagementScore * 0.20 +
    seoScoreValue * 0.20
  );

  const hasTraffic = (perfData?.metrics.totalVisits ?? 0) > 0;

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance Score</p>
      </div>

      {/* Composite ring */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <div className="relative">
          <ScoreRing score={composite} size={64} strokeWidth={6} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-slate-800">{composite}</span>
          </div>
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold text-slate-800">
            {composite >= 80 ? "Excellent" : composite >= 60 ? "Good" : composite >= 40 ? "Needs work" : "Poor"}
          </div>
          <div className="text-[10px] text-slate-500">
            {hasTraffic
              ? `${perfData!.metrics.totalVisits} visits · ${perfData!.metrics.cvr}% CVR`
              : "No traffic data yet"
            }
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="border-t pt-2 space-y-0.5">
        <MetricRow
          icon={Target}
          label="Conversion rate"
          value={hasTraffic ? `${perfData!.metrics.cvr}%` : "—"}
          score={cvrScore}
          color="text-blue-500"
        />
        <MetricRow
          icon={ArrowDownFromLine}
          label="Scroll depth"
          value={hasTraffic ? `${perfData!.metrics.avgScrollDepth}% avg` : "—"}
          score={scrollScore}
          color="text-purple-500"
        />
        <MetricRow
          icon={MousePointer2}
          label="Click engagement"
          value={hasTraffic ? `${perfData!.metrics.clicksPerSession} clicks/visit` : "—"}
          score={engagementScore}
          color="text-orange-500"
        />
        <MetricRow
          icon={TrendingUp}
          label="SEO/GEO score"
          value={seoScore ? `${seoScore.grade} grade` : "—"}
          score={seoScoreValue}
          color="text-green-500"
        />
      </div>
    </div>
  );
}
