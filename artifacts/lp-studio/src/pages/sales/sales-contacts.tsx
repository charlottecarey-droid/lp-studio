import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { format } from "date-fns";
import {
  Users,
  Search,
  Building2,
  Mail,
  ArrowLeft,
  Activity,
  Eye,
  MousePointerClick,
  FileText,
  Globe,
  Phone,
  Pencil,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
  accountName?: string;
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

interface Hotlink {
  id: number;
  token: string;
  contactId: number;
  pageId: number;
  isActive: boolean;
  createdAt: string;
}

const signalConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  page_view: { icon: Eye, label: "Viewed Page", color: "text-blue-500" },
  email_open: { icon: Mail, label: "Opened Email", color: "text-amber-500" },
  email_click: { icon: MousePointerClick, label: "Clicked Link", color: "text-emerald-500" },
  form_submit: { icon: FileText, label: "Submitted Form", color: "text-purple-500" },
};

function getEngagementScore(signals: Signal[]): { label: string; color: string; score: number } {
  if (signals.length === 0) return { label: "No activity", color: "text-muted-foreground bg-muted/50", score: 0 };

  // Score based on recency and frequency
  const now = Date.now();
  const recentSignals = signals.filter(s => now - new Date(s.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000); // last 7 days
  const formSubmits = signals.filter(s => s.type === "form_submit").length;
  const emailClicks = signals.filter(s => s.type === "email_click").length;

  // Weighted score: form submits worth 5, clicks worth 3, opens worth 2, views worth 1
  const score = signals.reduce((sum, s) => {
    if (s.type === "form_submit") return sum + 5;
    if (s.type === "email_click") return sum + 3;
    if (s.type === "email_open") return sum + 2;
    return sum + 1;
  }, 0);

  // Boost for recent activity
  const recencyBoost = recentSignals.length > 0 ? 1.5 : 1;
  const finalScore = Math.round(score * recencyBoost);

  if (finalScore >= 15 || formSubmits > 0) return { label: "Hot", color: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50", score: finalScore };
  if (finalScore >= 8 || emailClicks > 0) return { label: "Warm", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50", score: finalScore };
  if (finalScore >= 3) return { label: "Cool", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50", score: finalScore };
  return { label: "Cold", color: "text-slate-500 bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-900/50", score: finalScore };
}

/* ─── Contact List View ──────────────────────────────────────── */

function ContactListView() {
  const [, navigate] = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contactSignals, setContactSignals] = useState<Record<number, Signal[]>>({});

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/contacts`)
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/sales/signals?limit=500`)
        .then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([contacts, signals]) => {
        setContacts(contacts);
        // Group signals by contact
        const grouped: Record<number, Signal[]> = {};
        (signals || []).forEach((sig: Signal) => {
          if (sig.contactId) {
            if (!grouped[sig.contactId]) grouped[sig.contactId] = [];
            grouped[sig.contactId].push(sig);
          }
        });
        setContactSignals(grouped);
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/sales/contacts`, { method: "DELETE" });
      setContacts([]);
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = contacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All contacts across your accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {deleteConfirm ? (
              <>
                <span className="text-sm text-muted-foreground">Delete all {contacts.length} contacts?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDeleteAll}
                  className="gap-1.5"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? "Deleting…" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <>
                {contacts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                    className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </Button>
                )}
                <Button onClick={() => setShowImport(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="pl-10"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {search ? "No contacts match your search" : "No contacts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {search ? "Try a different search term" : "Import a CSV or add contacts from an account page"}
              </p>
            </div>
            {!search && (
              <Button onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((contact) => {
              const engagementScore = getEngagementScore(contactSignals[contact.id] || []);
              const indicatorColor = engagementScore.label === "Hot" ? "bg-red-500" :
                                    engagementScore.label === "Warm" ? "bg-amber-500" :
                                    engagementScore.label === "Cool" ? "bg-blue-500" :
                                    "bg-slate-300";
              return (
                <div
                  key={contact.id}
                  onClick={() => navigate(`/sales/contacts/${contact.id}`)}
                  className="group flex items-center gap-4 px-5 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all cursor-pointer"
                >
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full ${indicatorColor}`} />
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  {contact.role && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.role}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(contact.createdAt), "MMM d")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchContacts}
      />
    </SalesLayout>
  );
}

/* ─── Contact Detail View ────────────────────────────────────── */

function ContactDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [hotlinks, setHotlinks] = useState<Hotlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState<string>("");

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/contacts/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/sales/signals?contactId=${id}&limit=30`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(async ([ct, sigs]) => {
        setContact(ct);
        setSignals(sigs ?? []);
        // Fetch account name
        if (ct?.accountId) {
          try {
            const acct = await fetch(`${API_BASE}/sales/accounts/${ct.accountId}`).then((r) => r.ok ? r.json() : null);
            if (acct) setAccountName(acct.name);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (!contact) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-lg font-semibold text-foreground">Contact not found</p>
          <Button variant="outline" onClick={() => navigate("/sales/contacts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => navigate("/sales/contacts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary uppercase">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-display font-bold text-foreground">
                    {contact.firstName} {contact.lastName}
                  </h1>
                  {(() => {
                    const engagementScore = getEngagementScore(signals);
                    return (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${engagementScore.color}`}>
                        {engagementScore.label === "No activity" ? engagementScore.label : `${engagementScore.label} (${engagementScore.score})`}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                  {contact.title && <span>{contact.title}</span>}
                  {contact.role && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info Card */}
        <Card className="p-5 rounded-2xl border border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{contact.email}</p>
                </div>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Phone</p>
                  <p className="text-sm text-foreground">{contact.phone}</p>
                </div>
              </div>
            )}
            {accountName && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Account</p>
                  <Link
                    href={`/sales/accounts/${contact.accountId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {accountName}
                  </Link>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Status</p>
                <p className="text-sm text-foreground capitalize">{contact.status}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Engagement Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Page Views", count: signals.filter(s => s.type === "page_view").length, color: "text-blue-500" },
            { label: "Email Opens", count: signals.filter(s => s.type === "email_open").length, color: "text-amber-500" },
            { label: "Email Clicks", count: signals.filter(s => s.type === "email_click").length, color: "text-emerald-500" },
            { label: "Form Submits", count: signals.filter(s => s.type === "form_submit").length, color: "text-purple-500" },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 rounded-xl border border-border/60">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.count}</p>
            </Card>
          ))}
        </div>

        {/* Engagement History */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-display font-bold text-foreground">Engagement History</h2>
          {signals.length === 0 ? (
            <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">No engagement yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signals will appear here when this contact interacts with microsites and emails
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {signals.map((signal) => {
                const config = signalConfig[signal.type] ?? { icon: Activity, label: signal.type, color: "text-muted-foreground" };
                const Icon = config.icon;
                return (
                  <div key={signal.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border/60 rounded-xl">
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{config.label}</p>
                      {signal.source && (
                        <p className="text-xs text-muted-foreground mt-0.5">{signal.source}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SalesLayout>
  );
}

/* ─── Route Handler ──────────────────────────────────────────── */

export default function SalesContacts() {
  const [matchDetail, params] = useRoute("/sales/contacts/:id");

  if (matchDetail && params?.id) {
    return <ContactDetailView id={params.id} />;
  }

  return <ContactListView />;
}
