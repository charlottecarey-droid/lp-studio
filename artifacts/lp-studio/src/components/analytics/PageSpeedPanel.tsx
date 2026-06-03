import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Image,
  Code2,
  Layers,
  Play,
  Sparkles,
  Box,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = "/api";

interface PageIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  blockId?: string;
  blockType?: string;
}

export interface PageSpeedResult {
  pageId: number;
  name: string;
  slug: string;
  score: number;
  status: "passing" | "needs-work" | "failing";
  speedSource?: "measured" | "estimated";
  estimatedScore?: number;
  blockCount: number;
  imageCount: number;
  videoCount: number;
  formCount: number;
  customHtmlCount: number;
  animatedBlocks: number;
  parallaxImages: number;
  heavyBlocks: string[];
  estimatedDomNodes: number;
  issues: PageIssue[];
}

function getStatusColor(status: string) {
  if (status === "passing") return "bg-green-100 text-green-800";
  if (status === "needs-work") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getStatusLabel(status: string) {
  if (status === "passing") return "Passing";
  if (status === "needs-work") return "Needs Work";
  return "Failing";
}

function getScoreRingColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function getSeverityColor(severity: string) {
  if (severity === "critical") return "bg-red-100 text-red-800 border-red-200";
  if (severity === "warning") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function getSeverityIcon(severity: string) {
  if (severity === "critical") return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />;
  return <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />;
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreRingColor(score);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="transform rotate-90" style={{ transformOrigin: "center", fontSize: size * 0.3 }}
        fill={color} fontWeight="bold"
      >
        {score}
      </text>
    </svg>
  );
}

async function fetchPageSpeed(pageId: number): Promise<PageSpeedResult> {
  const r = await fetch(`${API_BASE}/lp/page-speed/${pageId}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PageSpeedResult>;
}

export function PageSpeedPanel({ pageId }: { pageId: number }) {
  const { data: selectedPage, isLoading, isError } = useQuery({
    queryKey: ["page-speed-detail", pageId],
    queryFn: () => fetchPageSpeed(pageId),
    enabled: Number.isFinite(pageId),
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-lg" />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Could not load page speed data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedPage) {
    return (
      <Card>
        <CardContent className="pt-8">
          <div className="text-center py-12">
            <Gauge className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No performance data available for this page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score + breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg truncate">{selectedPage.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <ScoreRing score={selectedPage.score} size={80} />
            <div>
              <div className="flex items-center gap-1.5">
                <Badge className={getStatusColor(selectedPage.status)}>
                  {getStatusLabel(selectedPage.status)}
                </Badge>
                {selectedPage.speedSource && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 font-normal ${
                      selectedPage.speedSource === "measured"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {selectedPage.speedSource === "measured" ? "measured" : "estimated"}
                  </Badge>
                )}
              </div>
              {selectedPage.speedSource === "measured" && typeof selectedPage.estimatedScore === "number" && (
                <p className="text-xs text-slate-500 mt-1">Structural estimate: {selectedPage.estimatedScore}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">~{selectedPage.estimatedDomNodes} DOM nodes</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Layers className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.blockCount}</p>
              <p className="text-xs text-slate-500">blocks</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Image className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.imageCount}</p>
              <p className="text-xs text-slate-500">images</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Play className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.videoCount}</p>
              <p className="text-xs text-slate-500">videos</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Code2 className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.customHtmlCount}</p>
              <p className="text-xs text-slate-500">custom HTML</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Sparkles className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.animatedBlocks}</p>
              <p className="text-xs text-slate-500">animated</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <Box className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-900">{selectedPage.formCount}</p>
              <p className="text-xs text-slate-500">forms</p>
            </div>
          </div>

          {selectedPage.heavyBlocks.length > 0 && (
            <div className="mt-3 p-2.5 bg-red-50 rounded-lg">
              <p className="text-xs font-medium text-red-800">
                Heavy blocks: {selectedPage.heavyBlocks.join(", ")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issues */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Issues ({selectedPage.issues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPage.issues.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No issues detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {selectedPage.issues
                .slice()
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, info: 2 };
                  return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                })
                .map((issue, idx) => (
                  <div key={idx} className={`flex gap-2 p-2.5 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                    {getSeverityIcon(issue.severity)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{issue.category}</p>
                      <p className="text-xs mt-0.5 opacity-80">{issue.message}</p>
                      {issue.blockType && (
                        <p className="text-xs mt-0.5 opacity-60">Block: {issue.blockType}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PageSpeedPanel;
