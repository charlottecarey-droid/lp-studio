import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  FileText,
  Plus,
  Search,
  ExternalLink,
  Link2,
  Building2,
  Loader2,
  Check,
  Copy,
  Eye,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Page {
  id: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
}

interface Account {
  id: number;
  name: string;
}

interface Hotlink {
  id: number;
  token: string;
  contactId: number;
  pageId: number;
  createdAt: string;
}

interface Signal {
  id: number;
  accountId: number | null;
  contactId: number | null;
  type: string;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
}

export default function SalesPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Hotlink generation
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [hotlinkResult, setHotlinkResult] = useState<{ pageId: number; count: number } | null>(null);

  // Performance tracking
  const [signals, setSignals] = useState<Signal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showPerformance, setShowPerformance] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/lp/pages`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/signals?limit=100`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/contacts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([p, a, sigs, cts]) => { setPages(p); setAccounts(a); setSignals(sigs); setContacts(cts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const published = pages.filter(p => p.status === "published");
  const filtered = published.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  async function handleGenerateHotlinks(pageId: number) {
    if (!selectedAccountId) return;
    setGeneratingFor(pageId);
    try {
      const res = await fetch(`${API_BASE}/sales/hotlinks/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: Number(selectedAccountId), pageId }),
      });
      if (res.ok) {
        const data = await res.json();
        setHotlinkResult({ pageId, count: data.length });
        setTimeout(() => setHotlinkResult(null), 3000);
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  function getPagePerformance(pageId: number) {
    const pageSignals = signals.filter(s => {
      if (!s.source) return false;
      return s.source.includes(`/${pages.find(p => p.id === pageId)?.slug}`);
    });

    const totalViews = pageSignals.filter(s => s.type === "page_view").length;
    const uniqueContacts = new Set(pageSignals.filter(s => s.contactId).map(s => s.contactId)).size;
    const formSubmits = pageSignals.filter(s => s.type === "form_submit").length;
    const recent = pageSignals.slice(0, 5).map(s => {
      const contact = contacts.find(c => c.id === s.contactId);
      return { contact, signal: s };
    });

    return { totalViews, uniqueContacts, formSubmits, recent };
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Microsites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Published pages you can use as tracked microsites for sales outreach
            </p>
          </div>
          <Link href="/pages/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Page
            </Button>
          </Link>
        </div>

        {/* Account selector for hotlink generation */}
        <Card className="p-4 rounded-xl border border-border/60 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Generate tracked links for:</span>
          </div>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select account…</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            This creates a unique tracked link per contact for the selected account
          </p>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search published pages…"
            className="pl-10"
          />
        </div>

        {/* Page list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">
              {search ? "No pages match your search" : "No published pages yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {search
                ? "Try a different search term"
                : "Create and publish a page in the page builder, then use it here as a microsite for outreach."}
            </p>
            {!search && (
              <Link href="/pages/new" className="mt-4">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Page
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map(page => {
              const isGenerating = generatingFor === page.id;
              const justGenerated = hotlinkResult?.pageId === page.id;
              const isShowingPerf = showPerformance === page.id;
              const perf = getPagePerformance(page.id);

              return (
                <div key={page.id} className="flex flex-col">
                  <div
                    className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 transition-all"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground text-sm">{page.title}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Published
                        </span>
                      </div>
                      <code className="text-xs text-muted-foreground font-mono">/{page.slug}</code>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span>{format(new Date(page.updatedAt), "MMM d")}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {perf.totalViews > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowPerformance(isShowingPerf ? null : page.id)}
                          className="gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {perf.totalViews} views
                        </Button>
                      )}
                      {selectedAccountId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateHotlinks(page.id)}
                          disabled={isGenerating}
                          className="gap-1.5"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : justGenerated ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                          {isGenerating ? "Generating…" : justGenerated ? `${hotlinkResult.count} links created` : "Generate Links"}
                        </Button>
                      )}
                      <Link href={`/builder/${page.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit page">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {isShowingPerf && perf.totalViews > 0 && (
                    <div className="mt-2 ml-14 p-4 bg-muted/30 rounded-xl border border-border/40">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Total Views</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{perf.totalViews}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Unique Contacts</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{perf.uniqueContacts}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Form Submits</p>
                          <p className="text-2xl font-bold text-emerald-600 mt-1">{perf.formSubmits}</p>
                        </div>
                      </div>
                      {perf.recent.length > 0 && (
                        <div className="pt-4 border-t border-border/40">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Recent Engagement</p>
                          <div className="flex flex-col gap-2">
                            {perf.recent.map((item, i) => (
                              <div key={i} className="text-xs text-muted-foreground">
                                {item.contact ? (
                                  <span>{item.contact.firstName} {item.contact.lastName}</span>
                                ) : (
                                  <span>Unknown contact</span>
                                )}
                                {" "}<span className="text-muted-foreground/60">— {item.signal.type === "page_view" ? "viewed" : item.signal.type === "form_submit" ? "submitted form" : "interacted"} {format(new Date(item.signal.createdAt), "h:mm a")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}
