import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { useToast } from "@/hooks/use-toast";
import { toastUndoableDelete } from "@/lib/undo-delete";
import { leadName, leadEmail } from "@workspace/lead-utils";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Download, Users, RefreshCw, Trash2, Search, FlaskConical } from "lucide-react";

const API_BASE = "/api";
const LIMIT = 50;

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
  pageTitle?: string | null;
  pageSlug?: string | null;
  variantId: number | null;
  variantName: string | null;
  fields: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  isTest?: boolean;
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

interface LeadDeleteResult {
  deleted: number;
  restore: { leads: unknown[] };
}

async function bulkDeleteLeads(ids: number[]): Promise<LeadDeleteResult> {
  const res = await fetch(`${API_BASE}/lp/leads`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to delete leads");
  const data = await res.json();
  return { deleted: data.deleted ?? 0, restore: data.restore ?? { leads: [] } };
}

async function deleteAllTestLeads(): Promise<LeadDeleteResult> {
  const res = await fetch(`${API_BASE}/lp/leads/test`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete test leads");
  const data = await res.json();
  return { deleted: data.deleted ?? 0, restore: data.restore ?? { leads: [] } };
}

// Shared selection + bulk-delete toolbar used by both the master and per-page
// leads tables. Renders the "select all" + count, the show-test toggle, and
// the destructive actions.
interface LeadsToolbarProps {
  total: number;
  selectedCount: number;
  showTest: boolean;
  onToggleShowTest: (v: boolean) => void;
  onDeleteSelected: () => void;
  onDeleteAllTest?: () => void;
}

function LeadsToolbar({ total, selectedCount, showTest, onToggleShowTest, onDeleteSelected, onDeleteAllTest }: LeadsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Switch id="show-test" checked={showTest} onCheckedChange={onToggleShowTest} />
        <Label htmlFor="show-test" className="text-sm cursor-pointer flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> Show test leads
        </Label>
      </div>
      <div className="flex-1" />
      {selectedCount > 0 && (
        <Button variant="destructive" size="sm" className="gap-1.5" onClick={onDeleteSelected}>
          <Trash2 className="w-4 h-4" /> Delete selected ({selectedCount})
        </Button>
      )}
      {showTest && onDeleteAllTest && (
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDeleteAllTest}>
          <Trash2 className="w-4 h-4" /> Delete all test leads
        </Button>
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap">{total.toLocaleString()} {total === 1 ? "lead" : "leads"}</span>
    </div>
  );
}

interface MasterLeadsViewProps {
  onBack: () => void;
  onChanged: () => void;
  initialPageId?: number | null;
}

function MasterLeadsView({ onBack, onChanged, initialPageId }: MasterLeadsViewProps) {
  const { toast } = useToast();
  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTestOpen, setConfirmTestOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(currentPage), limit: String(LIMIT) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (showTest) params.set("includeTest", "1");
    if (initialPageId != null) params.set("pageId", String(initialPageId));
    fetch(`${API_BASE}/lp/leads/all?${params}`)
      .then(r => r.json())
      .then((data: { leads: Lead[]; total: number }) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); setSelected(new Set()); }, [currentPage, debouncedSearch, showTest, initialPageId]);

  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
  const someSelected = leads.some(l => selected.has(l.id));

  const toggleAll = () => {
    setSelected(prev => {
      if (leads.every(l => prev.has(l.id))) {
        const next = new Set(prev);
        leads.forEach(l => next.delete(l.id));
        return next;
      }
      const next = new Set(prev);
      leads.forEach(l => next.add(l.id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doDeleteSelected = async () => {
    setDeleting(true);
    try {
      const { deleted: n, restore } = await bulkDeleteLeads(Array.from(selected));
      setSelected(new Set());
      setConfirmOpen(false);
      load();
      onChanged();
      if (n === 0) {
        toast({ title: "No leads deleted" });
      } else {
        toastUndoableDelete({
          message: `Deleted ${n} ${n === 1 ? "lead" : "leads"}`,
          restorePath: "/lp/leads/restore",
          restorePayload: restore,
          onRestored: () => { load(); onChanged(); },
        });
      }
    } catch {
      toast({ title: "Couldn't delete leads", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const doDeleteAllTest = async () => {
    setDeleting(true);
    try {
      const { deleted: n, restore } = await deleteAllTestLeads();
      setSelected(new Set());
      setConfirmTestOpen(false);
      load();
      onChanged();
      if (n === 0) {
        toast({ title: "No test leads to delete" });
      } else {
        toastUndoableDelete({
          message: `Deleted ${n} test ${n === 1 ? "lead" : "leads"}`,
          restorePath: "/lp/leads/restore",
          restorePayload: restore,
          onRestored: () => { load(); onChanged(); },
        });
      }
    } catch {
      toast({ title: "Couldn't delete test leads", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">All Leads</h1>
          <p className="text-sm text-muted-foreground">Every submission across your pages</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or page…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <LeadsToolbar
        total={total}
        selectedCount={selected.size}
        showTest={showTest}
        onToggleShowTest={setShowTest}
        onDeleteSelected={() => setConfirmOpen(true)}
        onDeleteAllTest={() => setConfirmTestOpen(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{debouncedSearch ? "No matching leads" : "No leads yet"}</p>
          <p className="text-xs mt-1">Submissions from your live forms will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg border-x-0 sm:border-x border-y">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Email</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Page</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const name = leadName(lead.fields) ?? "—";
                const email = leadEmail(lead.fields) || "—";
                return (
                  <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors" data-state={selected.has(lead.id) ? "selected" : undefined}>
                    <td className="px-4 py-2.5">
                      <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} aria-label="Select lead" />
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate">
                      <span className="inline-flex items-center gap-2">
                        {name}
                        {lead.isTest && <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-600 border-amber-300">test</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-muted-foreground">{email}</td>
                    <td className="px-4 py-2.5 max-w-[14rem] truncate">
                      {lead.pageSlug ? (
                        <Link href={`/pages`} className="hover:underline">{lead.pageTitle ?? (micrositeDomain ? `/${lead.pageSlug}` : `/lp/${lead.pageSlug}`)}</Link>
                      ) : (lead.pageTitle ?? "—")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        from={total === 0 ? 0 : (currentPage - 1) * LIMIT + 1}
        to={Math.min(currentPage * LIMIT, total)}
        total={total}
        onPage={setCurrentPage}
        label="leads"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selected.size} ${selected.size === 1 ? "lead" : "leads"}?`}
        description="This permanently removes the selected submissions. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={doDeleteSelected}
      />
      <ConfirmDialog
        open={confirmTestOpen}
        onOpenChange={setConfirmTestOpen}
        title="Delete all test leads?"
        description="This permanently removes every suspected test/junk lead across all your pages. This can't be undone."
        confirmLabel="Delete test leads"
        destructive
        loading={deleting}
        onConfirm={doDeleteAllTest}
      />
    </div>
  );
}

interface PageLeadsViewProps {
  page: PageSummary;
  onBack: () => void;
  onChanged: () => void;
}

function PageLeadsView({ page, onBack, onChanged }: PageLeadsViewProps) {
  const { toast } = useToast();
  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ pageId: String(page.id), page: String(currentPage), limit: String(LIMIT) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (showTest) params.set("includeTest", "1");
    fetch(`${API_BASE}/lp/leads?${params}`)
      .then(r => r.json())
      .then((data: { leads: Lead[]; total: number }) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); setSelected(new Set()); }, [page.id, currentPage, dateFrom, showTest]);

  const exportCsv = () => {
    const params = new URLSearchParams({ pageId: String(page.id) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    window.location.href = `${API_BASE}/lp/leads/export?${params}`;
  };

  const allFieldKeys = useMemo(
    () => Array.from(new Set(leads.flatMap(l => Object.keys(l.fields).filter(k => !k.startsWith("_"))))),
    [leads],
  );

  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
  const someSelected = leads.some(l => selected.has(l.id));

  const toggleAll = () => {
    setSelected(prev => {
      if (leads.every(l => prev.has(l.id))) {
        const next = new Set(prev);
        leads.forEach(l => next.delete(l.id));
        return next;
      }
      const next = new Set(prev);
      leads.forEach(l => next.add(l.id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doDeleteSelected = async () => {
    setDeleting(true);
    try {
      const { deleted: n, restore } = await bulkDeleteLeads(Array.from(selected));
      setSelected(new Set());
      setConfirmOpen(false);
      load();
      onChanged();
      if (n === 0) {
        toast({ title: "No leads deleted" });
      } else {
        toastUndoableDelete({
          message: `Deleted ${n} ${n === 1 ? "lead" : "leads"}`,
          restorePath: "/lp/leads/restore",
          restorePayload: restore,
          onRestored: () => { load(); onChanged(); },
        });
      }
    } catch {
      toast({ title: "Couldn't delete leads", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{page.title}</h1>
          <p className="text-sm text-muted-foreground">{micrositeDomain ? `/${page.slug}` : `/lp/${page.slug}`}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
          <label className="text-sm font-medium shrink-0">From date:</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
            className="text-base sm:text-sm w-full sm:w-36 h-10 sm:h-9"
          />
          {dateFrom && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setCurrentPage(1); }}>Clear</Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <LeadsToolbar
        total={total}
        selectedCount={selected.size}
        showTest={showTest}
        onToggleShowTest={setShowTest}
        onDeleteSelected={() => setConfirmOpen(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No leads yet</p>
          <p className="text-xs mt-1">Submissions from your live form will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg border-x-0 sm:border-x border-y">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Date</th>
                {allFieldKeys.map(k => (
                  <th key={k} className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{k}</th>
                ))}
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Variant</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b hover:bg-muted/20 transition-colors" data-state={selected.has(lead.id) ? "selected" : undefined}>
                  <td className="px-4 py-2.5">
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} aria-label="Select lead" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {new Date(lead.createdAt).toLocaleString()}
                      {lead.isTest && <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-600 border-amber-300">test</Badge>}
                    </span>
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

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        from={total === 0 ? 0 : (currentPage - 1) * LIMIT + 1}
        to={Math.min(currentPage * LIMIT, total)}
        total={total}
        onPage={setCurrentPage}
        label="leads"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selected.size} ${selected.size === 1 ? "lead" : "leads"}?`}
        description="This permanently removes the selected submissions. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={doDeleteSelected}
      />
    </div>
  );
}

export function LeadsContent() {
  const { domainContext } = useAuth();
  const micrositeDomain = domainContext?.micrositeDomain ?? null;
  const { pages, loading, reload } = usePageSummary();
  const [selectedPage, setSelectedPage] = useState<PageSummary | null>(null);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [onlyWithLeads, setOnlyWithLeads] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);

  if (showAllLeads) {
    return <MasterLeadsView onBack={() => { setShowAllLeads(false); reload(); }} onChanged={reload} />;
  }

  if (selectedPage) {
    return <PageLeadsView page={selectedPage} onBack={() => { setSelectedPage(null); reload(); }} onChanged={reload} />;
  }

  const totalLeads = pages.reduce((sum, p) => sum + p.leadCount, 0);
  const pagesWithLeads = pages.filter(p => p.leadCount > 0);
  const visiblePages = onlyWithLeads ? pagesWithLeads : pages;

  const showPagesWithSubmissions = () => {
    setOnlyWithLeads(true);
    setTimeout(() => pagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={reload}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button type="button" onClick={() => setShowAllLeads(true)} className="text-left">
          <Card className="cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/40 h-full">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{totalLeads.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground mt-1">Total leads captured</p>
            </CardContent>
          </Card>
        </button>
        <button type="button" onClick={showPagesWithSubmissions} className="text-left">
          <Card className="cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/40 h-full">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{pagesWithLeads.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Pages with submissions</p>
            </CardContent>
          </Card>
        </button>
        <Link href="/pages" className="block">
          <Card className="cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/40 h-full">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{pages.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Total pages</p>
            </CardContent>
          </Card>
        </Link>
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
        <Card ref={pagesRef}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Pages</CardTitle>
            {onlyWithLeads && (
              <Button variant="ghost" size="sm" onClick={() => setOnlyWithLeads(false)}>
                Show all pages
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {visiblePages.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">No pages with submissions yet.</div>
              ) : visiblePages.map(page => (
                <div
                  key={page.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedPage(page)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{page.title}</div>
                    <div className="text-xs text-muted-foreground">{micrositeDomain ? `/${page.slug}` : `/lp/${page.slug}`}</div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-right">
                      <div className="text-sm font-bold">{page.leadCount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">leads</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Form submissions from your live landing pages</p>
        </div>
        <LeadsContent />
      </div>
    </AppLayout>
  );
}
