import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Megaphone,
  Plus,
  Search,
  ExternalLink,
  Loader2,
  Rocket,
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronRight,
  Variable,
  Eye,
  Sparkles,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

const AVAILABLE_VARS = [
  { tag: "{{company}}", label: "Company name", example: "Pacific Dental Alliance" },
  { tag: "{{first_name}}", label: "First name", example: "Sarah" },
  { tag: "{{last_name}}", label: "Last name", example: "Johnson" },
  { tag: "{{microsite_url}}", label: "Personalized link URL", example: "https://…/p/abc123" },
  { tag: "{{sender_name}}", label: "Sender name", example: "Alex at Dandy" },
];

interface Page {
  id: number;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
}

interface EligibleContact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  accountName: string | null;
}

interface LaunchResult {
  sent: number;
  failed: number;
  total: number;
  hotlinksCreated: number;
}

const DEFAULT_SUBJECT = "We built something for {{company}}";
const DEFAULT_BODY = `<p>Hi {{first_name}},</p>

<p>I put together a personalized page specifically for {{company}} — it shows exactly how Dandy can help your team save time and increase case acceptance.</p>

<p><a href="{{microsite_url}}">View your personalized page →</a></p>

<p>Happy to walk through it together if that would be helpful.</p>

<p>Best,<br>{{sender_name}}</p>`;

function VariableTag({ tag, onClick }: { tag: string; onClick: (tag: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tag)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-mono hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors cursor-pointer"
      title="Click to copy"
    >
      {tag}
    </button>
  );
}

function LaunchModal({
  page,
  contactCount,
  onClose,
  onLaunch,
}: {
  page: Page;
  contactCount: number;
  onClose: () => void;
  onLaunch: (opts: {
    emailSubject: string;
    emailBodyHtml: string;
    senderName: string;
    senderEmail: string;
    sendEmails: boolean;
  }) => Promise<void>;
}) {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [senderName, setSenderName] = useState("Dandy");
  const [senderEmail, setSenderEmail] = useState("partnerships");
  const [sendEmails, setSendEmails] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  function insertVar(tag: string) {
    navigator.clipboard.writeText(tag).then(() => {
      setCopiedVar(tag);
      setTimeout(() => setCopiedVar(null), 1500);
    });
  }

  async function handleLaunch() {
    setLaunching(true);
    setError(null);
    try {
      await onLaunch({ emailSubject: subject, emailBodyHtml: body, senderName, senderEmail, sendEmails });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <Card className="w-full max-w-md p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Campaign Launched!</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your personalized campaign for <strong>{page.title}</strong> is live.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-muted/40 rounded-xl p-3">
              <div className="text-2xl font-bold text-foreground">{result.total}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Contacts</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.sent}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sent</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
              <div className="text-2xl font-bold text-red-500">{result.failed}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Failed</div>
            </div>
          </div>
          <Button onClick={onClose} className="w-full">Done</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-display font-bold">Launch Campaign</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sending <strong>{page.title}</strong> to{" "}
              <strong>{contactCount} eligible contacts</strong> across all accounts
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Variable reference */}
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
            <Variable className="w-3.5 h-3.5" />
            Available variables — click to copy
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_VARS.map(v => (
              <button
                key={v.tag}
                type="button"
                onClick={() => insertVar(v.tag)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-mono hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                title={`${v.label} — e.g. "${v.example}"`}
              >
                {copiedVar === v.tag ? <Check className="w-3 h-3" /> : null}
                {v.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Send emails toggle */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
          <input
            type="checkbox"
            id="sendEmails"
            checked={sendEmails}
            onChange={e => setSendEmails(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <label htmlFor="sendEmails" className="text-sm font-medium cursor-pointer">
            Send emails to contacts
          </label>
          <span className="text-xs text-muted-foreground ml-auto">
            Uncheck to create personalized links only (no email)
          </span>
        </div>

        {sendEmails && (
          <>
            {/* Sender */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sender name</label>
                <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Dandy" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  From address
                </label>
                <div className="flex items-center rounded-md border border-input overflow-hidden">
                  <Input
                    value={senderEmail}
                    onChange={e => setSenderEmail(e.target.value)}
                    placeholder="partnerships"
                    className="border-0 rounded-none flex-1"
                  />
                  <span className="px-3 text-xs text-muted-foreground bg-muted border-l border-input h-full flex items-center">
                    @meetdandy-lp.com
                  </span>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject line</label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="We built something for {{company}}"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email body (HTML)</label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Hi {{first_name}}, …"
                className="min-h-[160px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Use HTML or plain text. The personalized page link{" "}
                <code className="bg-muted px-1 rounded text-[11px]">{"{{microsite_url}}"}</code> must be included.
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={launching}
            className="flex-1 gap-2"
          >
            {launching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                {sendEmails ? `Send to ${contactCount} contacts` : `Create ${contactCount} links`}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function SalesCampaignPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [eligibleContacts, setEligibleContacts] = useState<EligibleContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [launchingPage, setLaunchingPage] = useState<Page | null>(null);
  const [launchResults, setLaunchResults] = useState<Record<number, LaunchResult>>({});

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/lp/pages`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/campaign-pages/eligible-contacts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([p, c]) => { setPages(p); setEligibleContacts(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = pages.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const contactCount = eligibleContacts.length;
  const accountCount = new Set(eligibleContacts.map(c => c.accountName).filter(Boolean)).size;

  async function handleLaunch(opts: {
    emailSubject: string;
    emailBodyHtml: string;
    senderName: string;
    senderEmail: string;
    sendEmails: boolean;
  }) {
    if (!launchingPage) return;

    const res = await fetch(`${API_BASE}/sales/campaign-pages/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId: launchingPage.id, ...opts }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to launch campaign");
    }

    const result = await res.json() as LaunchResult;
    setLaunchResults(prev => ({ ...prev, [launchingPage.id]: result }));
    return result;
  }

  return (
    <SalesLayout>
      {launchingPage && (
        <LaunchModal
          page={launchingPage}
          contactCount={contactCount}
          onClose={() => setLaunchingPage(null)}
          onLaunch={async (opts) => {
            const result = await handleLaunch(opts);
            if (result) {
              setLaunchResults(prev => ({ ...prev, [launchingPage.id]: result }));
            }
          }}
        />
      )}

      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Campaign Pages</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Send one page to all accounts with company names auto-filled in every version
            </p>
          </div>
          <Link href="/pages/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Page
            </Button>
          </Link>
        </div>

        {/* How it works */}
        <Card className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/70 to-background dark:from-violet-950/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
              <Variable className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">How Campaign Pages work</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Build one page with merge variables like <code className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">{"{{company}}"}</code> in headings, body text, and CTAs. When a contact visits their personalized link, those variables are automatically replaced with their real company name, first name, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARS.map(v => (
                  <span key={v.tag} className="inline-flex items-center gap-1.5 text-xs">
                    <code className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-mono">{v.tag}</code>
                    <span className="text-muted-foreground">{v.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Reach summary */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 rounded-xl border border-border/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{contactCount}</div>
                <div className="text-xs text-muted-foreground">Eligible contacts</div>
              </div>
            </Card>
            <Card className="p-4 rounded-xl border border-border/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold">{accountCount}</div>
                <div className="text-xs text-muted-foreground">Accounts covered</div>
              </div>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pages…"
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
              <Megaphone className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">
              {search ? "No pages match your search" : "No pages yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {search
                ? "Try a different search term"
                : "Create a page in the builder, add {{company}} or {{first_name}} anywhere in the content, then launch it here."}
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
              const result = launchResults[page.id];

              return (
                <div
                  key={page.id}
                  className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-2xl hover:border-primary/25 transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground text-sm">{page.title}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        page.status === "published"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {page.status}
                      </span>
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">/{page.slug}</code>
                    {result && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ {result.sent} sent, {result.failed} failed
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/lp/${page.slug}?_v_company=Acme+Dental&_v_first_name=Sarah`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview with sample vars">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Link href={`/builder/${page.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                        Edit
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => setLaunchingPage(page)}
                      className="gap-1.5"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      Launch
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SalesLayout>
  );
}
