import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Users, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const API_BASE = "/api";

interface PageSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  leadCount: number;
}

interface Lead {
  id: number;
  pageId: number;
  variantId: number | null;
  variantName: string | null;
  fields: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

function usePageSummary() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/lp/leads/summary`)
      .then(r => r.json())
      .then((data: PageSummary[]) => setPages(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  return { pages, loading, reload: load };
}

interface PageLeadsViewProps {
  page: PageSummary;
  onBack: () => void;
}

function PageLeadsView({ page, onBack }: PageLeadsViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const LIMIT = 50;

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageId: String(page.id), page: String(currentPage), limit: String(LIMIT) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    fetch(`${API_BASE}/lp/leads?${params}`)
      .then(r => r.json())
      .then((data: { leads: Lead[] }) => setLeads(data.leads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page.id, currentPage, dateFrom]);

  const exportCsv = () => {
    const params = new URLSearchParams({ pageId: String(page.id) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    window.location.href = `${API_BASE}/lp/leads/export?${params}`;
  };

  const allFieldKeys = Array.from(new Set(leads.flatMap(l => Object.keys(l.fields).filter(k => !k.startsWith("_")))));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{page.title}</h1>
          <p className="text-sm text-muted-foreground">/lp/{page.slug}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">From date:</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="text-sm w-36"
          />
          {dateFrom && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setCurrentPage(1); }}>Clear</Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No leads yet</p>
          <p className="text-xs mt-1">Submissions from your live form will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Date</th>
                {allFieldKeys.map(k => (
                  <th key={k} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{k}</th>
                ))}
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Variant</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                  {allFieldKeys.map(k => (
                    <td key={k} className="px-4 py-2.5 max-w-xs truncate">
                      {String(lead.fields[k] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {lead.variantName ?? (lead.variantId ? `Variant ${lead.variantId}` : "Control")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {leads.length === LIMIT && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => p + 1)}
            className="gap-1.5"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  const { pages, loading, reload } = usePageSummary();
  const [selectedPage, setSelectedPage] = useState<PageSummary | null>(null);

  if (selectedPage) {
    return (
      <AppLayout>
        <PageLeadsView page={selectedPage} onBack={() => setSelectedPage(null)} />
      </AppLayout>
    );
  }

  const totalLeads = pages.reduce((sum, p) => sum + p.leadCount, 0);
  const pagesWithLeads = pages.filter(p => p.leadCount > 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">Form submissions from your live landing pages</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reload}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{totalLeads.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">Total leads captured</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{pagesWithLeads.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Pages with submissions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{pages.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Total pages</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-base">No pages yet</p>
            <p className="text-sm mt-1 mb-4">Create a page and add a Form block to start capturing leads.</p>
            <Link href="/pages">
              <Button variant="outline" size="sm">Go to Pages</Button>
            </Link>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {pages.map(page => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedPage(page)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{page.title}</div>
                      <div className="text-xs text-muted-foreground">/lp/{page.slug}</div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-bold">{page.leadCount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">leads</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
