import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Layout,
  Plus,
  Building2,
  Check,
  Copy,
  Link2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Search,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface HotlinkEntry {
  hotlinkId: number;
  token: string;
  contactId: number;
  contactName: string;
}

interface PageEntry {
  pageId: number;
  pageTitle: string;
  pageSlug: string;
  pageStatus: string;
  pageUpdatedAt: string;
  hotlinks: HotlinkEntry[];
}

interface AccountEntry {
  accountId: number;
  accountName: string;
  pages: PageEntry[];
}

interface Account {
  id: number;
  name: string;
}

function PageStatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Draft
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function SalesPages() {
  const [overview, setOverview] = useState<AccountEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/sales/microsites/overview`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([ov, accts]) => { setOverview(ov); setAccounts(accts); })
      .catch((err) => console.error("Failed to load microsites:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  function toggleCollapse(accountId: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  const q = search.toLowerCase();
  const filteredOverview = search
    ? overview.filter(acct =>
        acct.accountName.toLowerCase().includes(q) ||
        acct.pages.some(p => p.pageTitle.toLowerCase().includes(q)) ||
        acct.pages.some(p => p.hotlinks.some(hl => hl.contactName.toLowerCase().includes(q)))
      )
    : overview;

  // Accounts that don't yet have a microsite
  const accountsWithMicrosites = new Set(overview.map(a => a.accountId));
  const accountsWithout = accounts.filter(a => !accountsWithMicrosites.has(a.id));

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Microsites</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated pages for your accounts, with per-contact personalized links
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Search */}
        {overview.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts, pages, or contacts…"
              className="pl-10"
            />
          </div>
        )}

        {/* Create for an account */}
        {!loading && accountsWithout.length > 0 && (
          <Card className="p-4 rounded-xl border border-dashed border-border/80">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Create a microsite for an account</p>
                <p className="text-xs text-muted-foreground">
                  Go to the account, then tap "Generate Microsite" to create a personalized page.
                </p>
              </div>
              {accountsWithout.length <= 6 ? (
                <div className="flex flex-wrap gap-2">
                  {accountsWithout.slice(0, 5).map(a => (
                    <Link key={a.id} href={`/sales/accounts/${a.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Building2 className="w-3 h-3" />
                        {a.name}
                      </Button>
                    </Link>
                  ))}
                  {accountsWithout.length > 5 && (
                    <Link href="/sales/accounts">
                      <Button variant="outline" size="sm" className="text-xs text-muted-foreground">
                        +{accountsWithout.length - 5} more
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <Link href="/sales/accounts">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    View accounts
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* Account microsites list */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : filteredOverview.length === 0 && !search ? (
          <Card className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl border border-dashed border-border text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Layout className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-display font-bold text-foreground mb-1">No microsites yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Go to an account and tap "Generate Microsite" — the AI will build a personalized page
              and create unique links for every contact.
            </p>
            <Link href="/sales/accounts" className="mt-5">
              <Button className="gap-2">
                <Building2 className="w-4 h-4" />
                Go to Accounts
              </Button>
            </Link>
          </Card>
        ) : filteredOverview.length === 0 && search ? (
          <Card className="flex flex-col items-center justify-center py-12 px-8 rounded-2xl border border-dashed border-border text-center">
            <Search className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="text-base font-display font-bold text-foreground mb-1">No results for "{search}"</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Try a different search term or clear the search.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {search ? `${filteredOverview.length} of ${overview.length}` : overview.length} account{(search ? filteredOverview.length : overview.length) !== 1 ? "s" : ""}
            </p>
            {filteredOverview.map(acct => (
              <Card key={acct.accountId} className="rounded-2xl border border-border/60 overflow-hidden">
                {/* Account header */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/30 border-b border-border/50">
                  <button
                    onClick={() => toggleCollapse(acct.accountId)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    title={collapsed.has(acct.accountId) ? "Expand" : "Collapse"}
                  >
                    {collapsed.has(acct.accountId)
                      ? <ChevronRight className="w-3.5 h-3.5 text-primary" />
                      : <ChevronDown className="w-3.5 h-3.5 text-primary" />}
                  </button>
                  <Link href={`/sales/accounts/${acct.accountId}`} className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground hover:text-primary transition-colors cursor-pointer">{acct.accountName}</span>
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {acct.pages.length} microsite{acct.pages.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Pages (collapsible) */}
                {!collapsed.has(acct.accountId) && <div className="divide-y divide-border/40">
                  {acct.pages.map(page => (
                    <div key={page.pageId} className="px-5 py-4">
                      {/* Page title row */}
                      <div className="flex items-center gap-2 mb-3">
                        <Layout className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                          {page.pageTitle}
                        </span>
                        <PageStatusBadge status={page.pageStatus} />
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {format(new Date(page.pageUpdatedAt), "MMM d")}
                        </span>
                        <a
                          href={`/lp/${page.pageSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Preview page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Link href={`/builder/${page.pageId}`}>
                          <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                            Edit
                          </button>
                        </Link>
                      </div>

                      {/* Hotlinks per contact */}
                      <div className="flex flex-col gap-1.5 pl-5">
                        {page.hotlinks.map(hl => (
                          <div
                            key={hl.hotlinkId}
                            className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                              {initials(hl.contactName)}
                            </div>
                            <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                              {hl.contactName}
                            </span>
                            <button
                              onClick={() => copyLink(hl.token)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                              title={`Copy ${hl.contactName}'s personalized link`}
                            >
                              {copiedToken === hl.token ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                  <span className="text-green-500 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Link2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Copy link</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}
