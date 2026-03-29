import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  Users,
  Mail,
  FileText,
  Globe,
  ArrowLeft,
  Activity,
  ExternalLink,
  Layout,
  Copy,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { ContentBriefModal } from "@/components/ContentBriefModal";

const API_BASE = "/api";

interface Account {
  id: number;
  name: string;
  domain: string | null;
  industry: string | null;
  segment: string | null;
  parentAccountId: number | null;
  status: string;
  owner: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  status: string;
  createdAt: string;
}

interface Microsite {
  pageId: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  hotlinkCount: number;
  firstToken: string | null;
}

interface PageBlock {
  type: string;
  [key: string]: unknown;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    qualified: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    churned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] ?? styles.prospect}`}>
      {status}
    </span>
  );
}

function PageStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

/* ─── Account List View ──────────────────────────────────────── */

function AccountListView() {
  const [, navigate] = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  // New account form state
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(() => {
    fetch(`${API_BASE}/sales/accounts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.domain ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (a.segment ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/sales/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          domain: newDomain.trim() || null,
          segment: newSegment.trim() || null,
          industry: newIndustry.trim() || null,
        }),
      });
      if (res.ok) {
        setNewName(""); setNewDomain(""); setNewSegment(""); setNewIndustry("");
        setShowNewForm(false);
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your target accounts and track engagement
            </p>
          </div>
          <Button
            onClick={() => setShowNewForm(!showNewForm)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Account
          </Button>
        </div>

        {/* New Account Form */}
        {showNewForm && (
          <Card className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">Create New Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name *</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Heartland Dental"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Domain</label>
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="e.g. heartland.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Segment</label>
                  <Input
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    placeholder="e.g. DSO, Independent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Industry</label>
                  <Input
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g. Dental"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving || !newName.trim()}>
                  {saving ? "Creating…" : "Create Account"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="pl-10"
          />
        </div>

        {/* Account List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {search ? "No accounts match your search" : "No accounts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {search ? "Try a different search term" : "Click 'New Account' to add your first target account"}
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((account) => (
              <div
                key={account.id}
                onClick={() => navigate(`/sales/accounts/${account.id}`)}
                className="group flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 hover:shadow-md transition-all duration-150 cursor-pointer"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{account.name}</span>
                    {account.segment && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                        {account.segment}
                      </span>
                    )}
                    <StatusBadge status={account.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {account.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {account.domain}
                      </span>
                    )}
                    {account.industry && <span>{account.industry}</span>}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span>{format(new Date(account.updatedAt), "MMM d")}</span>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}

/* ─── Account Detail View ────────────────────────────────────── */

function AccountDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Microsites
  const [microsites, setMicrosites] = useState<Microsite[]>([]);
  const [micrositesLoading, setMicrositesLoading] = useState(true);
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [generatingMicrosite, setGeneratingMicrosite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // New contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast, setContactLast] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/accounts/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/sales/accounts/${id}/contacts`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([acct, ctcts]) => {
        setAccount(acct);
        setContacts(ctcts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const fetchMicrosites = useCallback(() => {
    setMicrositesLoading(true);
    fetch(`${API_BASE}/sales/accounts/${id}/microsites`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMicrosites)
      .catch(() => setMicrosites([]))
      .finally(() => setMicrositesLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchMicrosites(); }, [fetchMicrosites]);

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactFirst.trim() || !contactLast.trim()) return;
    setSavingContact(true);
    try {
      const res = await fetch(`${API_BASE}/sales/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: Number(id),
          firstName: contactFirst.trim(),
          lastName: contactLast.trim(),
          email: contactEmail.trim() || null,
          title: contactTitle.trim() || null,
          role: contactRole.trim() || null,
        }),
      });
      if (res.ok) {
        setContactFirst(""); setContactLast(""); setContactEmail("");
        setContactTitle(""); setContactRole("");
        setShowContactForm(false);
        fetchData();
      }
    } finally {
      setSavingContact(false);
    }
  }

  async function handleGenerateMicrosite(prompt: string) {
    setGeneratingMicrosite(true);
    try {
      // 1. Generate page blocks from AI
      const genRes = await fetch(`${API_BASE}/lp/generate-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: "Generation failed" }));
        throw new Error((err as { error?: string }).error ?? "Generation failed");
      }
      const generated = await genRes.json() as { title: string; slug: string; blocks: PageBlock[] };

      // 2. Create the page
      const pageRes = await fetch(`${API_BASE}/lp/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: generated.title,
          slug: generated.slug,
          blocks: generated.blocks,
          status: "draft",
        }),
      });
      if (!pageRes.ok) {
        throw new Error("Failed to create page");
      }
      const page = await pageRes.json() as { id: number; title: string; slug: string };

      // 3. Auto-generate hotlinks for all contacts with email
      await fetch(`${API_BASE}/sales/accounts/${id}/microsites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id }),
      });

      // 4. Navigate to builder
      navigate(`/builder/${page.id}`);
    } finally {
      setGeneratingMicrosite(false);
    }
  }

  function handleCopyToken(token: string) {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/p/${token}`).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  if (loading) {
    return (
      <SalesLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-[200px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
      </SalesLayout>
    );
  }

  if (!account) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-lg font-semibold text-foreground">Account not found</p>
          <Button variant="outline" onClick={() => navigate("/sales/accounts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Accounts
          </Button>
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Back + Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg mt-1"
            onClick={() => navigate("/sales/accounts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-foreground truncate">
                {account.name}
              </h1>
              <StatusBadge status={account.status} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              {account.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {account.domain}
                </span>
              )}
              {account.segment && <span className="font-medium">{account.segment}</span>}
              {account.industry && <span>{account.industry}</span>}
            </div>
          </div>
          <Button
            onClick={() => setShowBriefModal(true)}
            disabled={generatingMicrosite}
            className="gap-2 shrink-0"
            size="sm"
          >
            {generatingMicrosite ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Microsite
              </>
            )}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Create Microsite", icon: <FileText className="w-4 h-4" />, href: "/sales/pages" },
            { label: "Send Email", icon: <Mail className="w-4 h-4" />, href: "/sales/outreach" },
            { label: "View Signals", icon: <Activity className="w-4 h-4" />, href: "/sales/signals" },
            { label: "Add Contact", icon: <Users className="w-4 h-4" />, onClick: () => setShowContactForm(true) },
          ].map((action) => (
            <Card
              key={action.label}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/60 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
              onClick={action.onClick ?? (() => {})}
            >
              {action.href ? (
                <Link href={action.href} className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </Link>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </>
              )}
            </Card>
          ))}
        </div>

        {/* Notes */}
        {account.notes && (
          <Card className="p-5 rounded-2xl border border-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{account.notes}</p>
          </Card>
        )}

        {/* Contacts */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-foreground">
              Contacts ({contacts.length})
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowContactForm(!showContactForm)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Contact
            </Button>
          </div>

          {/* New Contact Form */}
          {showContactForm && (
            <Card className="p-5 rounded-2xl border border-primary/30 bg-primary/5">
              <form onSubmit={handleCreateContact} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">Add Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
                    <Input value={contactFirst} onChange={(e) => setContactFirst(e.target.value)} placeholder="Jane" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
                    <Input value={contactLast} onChange={(e) => setContactLast(e.target.value)} placeholder="Smith" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@company.com" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Job Title</label>
                    <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="VP of Operations" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Buyer Role</label>
                    <Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Decision Maker" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={savingContact || !contactFirst.trim() || !contactLast.trim()}>
                    {savingContact ? "Adding…" : "Add Contact"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowContactForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {contacts.length === 0 ? (
            <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">No contacts yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add contacts to start sending personalized outreach
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-4 px-5 py-3 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.title && contact.email && <span>·</span>}
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                  </div>
                  {contact.role && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Microsites */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <Layout className="w-5 h-5 text-muted-foreground" />
              Microsites
              {!micrositesLoading && microsites.length > 0 && (
                <span className="text-base font-normal text-muted-foreground">({microsites.length})</span>
              )}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBriefModal(true)}
              disabled={generatingMicrosite}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Microsite
            </Button>
          </div>

          {micrositesLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : microsites.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-dashed border-border text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Layout className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">No microsites yet</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  Generate a personalized microsite for this account. Hotlinks will be auto-created for all contacts with an email.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-2 mt-1"
                onClick={() => setShowBriefModal(true)}
                disabled={generatingMicrosite}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Microsite
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {microsites.map((site) => (
                <div
                  key={site.pageId}
                  className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layout className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-foreground truncate">{site.title}</span>
                      <PageStatusBadge status={site.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{site.hotlinkCount} hotlink{site.hotlinkCount !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>Updated {format(new Date(site.updatedAt), "MMM d")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {site.firstToken && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-8 px-2.5 text-xs"
                        onClick={() => handleCopyToken(site.firstToken!)}
                      >
                        {copiedToken === site.firstToken ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Link
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 px-2.5 text-xs"
                      onClick={() => navigate(`/builder/${site.pageId}`)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Builder
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content Brief Modal */}
      <ContentBriefModal
        open={showBriefModal}
        onClose={() => setShowBriefModal(false)}
        onGeneratePage={handleGenerateMicrosite}
        initialCompany={account.name}
      />
    </SalesLayout>
  );
}

/* ─── Exported Route Handler ─────────────────────────────────── */

export default function SalesAccounts() {
  const [matchDetail, params] = useRoute("/sales/accounts/:id");

  if (matchDetail && params?.id) {
    return <AccountDetailView id={params.id} />;
  }

  return <AccountListView />;
}
