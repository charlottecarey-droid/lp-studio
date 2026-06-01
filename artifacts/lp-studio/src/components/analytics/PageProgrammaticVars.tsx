import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";

const API_BASE = "/api";

interface DTRRule {
  variable: string;
  defaultValue: string;
  source: string;
  inBlocks: boolean;
}

export interface DTRRulesResponse {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  rules: DTRRule[];
  tokenCount: number;
}

async function fetchDtrRules(pageId: number): Promise<DTRRulesResponse> {
  const r = await fetch(`${API_BASE}/lp/programmatic/dtr-rules/${pageId}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<DTRRulesResponse>;
}

function getSourceBadge(source: string) {
  if (source === "page_variable") return <Badge className="bg-blue-100 text-blue-800">Declared</Badge>;
  if (source === "detected_in_blocks") return <Badge className="bg-yellow-100 text-yellow-800">Detected</Badge>;
  return <Badge className="bg-gray-100 text-gray-800">{source}</Badge>;
}

export function PageProgrammaticVars({ pageId }: { pageId: number }) {
  const { data: dtrData, isLoading, isError } = useQuery({
    queryKey: ["page-programmatic-vars", pageId],
    queryFn: () => fetchDtrRules(pageId),
    enabled: Number.isFinite(pageId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Could not load programmatic variables.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dtrData || dtrData.rules.length === 0) {
    return (
      <div className="text-center py-8">
        <Wand2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 mb-1">No variables yet</p>
        <p className="text-xs text-slate-400">
          {`Add {{tokens}} to your page content in the builder to enable dynamic text replacement.`}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="font-semibold px-3 py-2">Variable</th>
            <th className="font-semibold px-3 py-2">Default</th>
            <th className="font-semibold px-3 py-2">Status</th>
            <th className="font-semibold px-3 py-2">In Blocks</th>
          </tr>
        </thead>
        <tbody>
          {dtrData.rules.map((rule, idx) => (
            <tr key={idx} className="border-b hover:bg-slate-50 transition-colors">
              <td className="px-3 py-3">
                <code className="font-mono font-semibold bg-slate-100 px-2 py-1 rounded text-sm">
                  {`{{${rule.variable}}}`}
                </code>
              </td>
              <td className="px-3 py-3 text-slate-600">
                {rule.defaultValue || <span className="italic text-slate-400">none</span>}
              </td>
              <td className="px-3 py-3">{getSourceBadge(rule.source)}</td>
              <td className="px-3 py-3">
                {rule.inBlocks
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <span className="text-slate-400 text-xs">unused</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PageProgrammaticVars;
