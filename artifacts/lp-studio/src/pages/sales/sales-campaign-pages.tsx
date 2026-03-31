import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
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
  ChevronDown,
  Variable,
  Eye,
  Sparkles,
  Link2,
  Filter,
  Pencil,
  Trash2,
  AlertCircle,
  Star,
  Building2,
  FileText,
  X,
} from "lucide-react";
import AudienceBuilderModal, { type Audience } from "@/components/AudienceBuilderModal";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import { MICROSITE_TEMPLATES } from "@/lib/microsite-templates";
import { cn } from "@/lib/utils";

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

interface HotlinkEntry {
  id: number;
  token: string;
  url: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  accountName: string | null;
  accountId: number | null;
  isActive: boolean;
  createdAt: string;
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
  audiences,
  onClose,
  onLaunch,
  onCreateAudience,
}: {
  page: Page;
  audiences: Audience[];
  onClose: () => void;
  onLaunch: (opts: {
    audienceId: number;
    emailSubject: string;
    emailBodyHtml: string;
    senderName: string;
    senderEmail: string;
    sendEmails: boolean;
  }) => Promise<void>;
  onCreateAudience: () => void;
}) {
  const [selectedAudienceId, setSelectedAudienceId] = useState<number | null>(
    audiences.length === 1 ? audiences[0].id : null
  );
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [senderName, setSenderName] = useState("Dandy");
  const [senderEmail, setSenderEmail] = useState("partnerships");
  const [sendEmails, setSendEmails] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const selectedAudience = audiences.find(a => a.id === selectedAudienceId);

  function insertVar(tag: string) {
    navigator.clipboard.writeText(tag).then(() => {
      setCopiedVar(tag);
      setTimeout(() => setCopiedVar(null), 1500);
    });
  }

  async function handleLaunch() {
    if (!selectedAudienceId) {
      setError("Please select an audience before launching.");
      return;
    }
    setLaunching(true);
    setError(null);
    try {
      await onLaunch({ audienceId: selectedAudienceId, emailSubject: subject, emailBodyHtml: body, senderName, senderEmail, sendEmails });
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
              Sending <strong>{page.title}</strong> to the selected audience
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Audience selector */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Target Audience *
            </label>
            <button
              type="button"
              onClick={onCreateAudience}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              New audience
            </button>
          </div>
          {audiences.length === 0 ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No audiences yet</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Create an audience first to define who will receive this campaign.
                </p>
                <button
                  type="button"
                  onClick={onCreateAudience}
                  className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline"
                >
                  Create audience →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {audiences.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAudienceId(a.id)}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    selectedAudienceId === a.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/40 bg-background"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedAudienceId === a.id ? "border-primary" : "border-muted-foreground/40"
                  }`}>
                    {selectedAudienceId === a.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{a.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {a.contact_count} contacts
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
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
            disabled={launching || !selectedAudienceId || audiences.length === 0}
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
                {!selectedAudienceId
                  ? "Select an audience first"
                  : sendEmails
                    ? `Send to ${selectedAudience?.contact_count ?? "?"} contacts`
                    : `Create ${selectedAudience?.contact_count ?? "?"} links`
                }
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface MarketingTemplate {
  id: number;
  title: string;
  templateLabel: string | null;
  templateDescription: string | null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TemplatePicker({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [marketingTemplates, setMarketingTemplates] = useState<MarketingTemplate[]>([]);
  const [selected, setSelected] = useState<{ type: "marketing"; id: number; label: string } | { type: "builtin"; id: string; label: string } | { type: "blank" } | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lp/templates`)
      .then(r => r.json())
      .then((data: MarketingTemplate[]) => setMarketingTemplates(data))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(slugify(v));
  };

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim() || !selected) return;
    setCreating(true);
    setError(null);
    try {
      let blocks: unknown[] = [];
      let fromTemplateId: number | undefined;

      if (selected.type === "marketing") {
        fromTemplateId = selected.id;
      } else if (selected.type === "builtin") {
        const tpl = MICROSITE_TEMPLATES.find(t => t.id === selected.id);
        blocks = tpl ? tpl.buildBlocks() : [];
      }

      const body: Record<string, unknown> = {
        title: title.trim(),
        slug: slug.trim(),
        blocks,
        status: "draft",
      };
      if (fromTemplateId !== undefined) body.fromTemplateId = fromTemplateId;

      const res = await fetch(`${API_BASE}/lp/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error((err as { error?: string }).error ?? "Failed to create page");
      }
      const page = await res.json() as { id: number };
      onClose();
      navigate(`/builder/${page.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setCreating(false);
    }
  };

  const hasSelection = selected !== null;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            New Microsite
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* Page name + slug — shown once a template is picked */}
          {hasSelection && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Page Name</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. Pacific Dental Campaign"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-sm font-medium">URL Slug</Label>
                <div className="flex items-center mt-1.5 gap-0 border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <span className="px-2 py-2 text-xs text-muted-foreground bg-muted border-r border-input shrink-0">/lp/</span>
                  <input
                    className="flex-1 px-2 py-2 text-sm bg-transparent focus:outline-none font-mono"
                    placeholder="page-slug"
                    value={slug}
                    onChange={e => setSlug(slugify(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Start Blank */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Start</p>
            <button
              onClick={() => setSelected({ type: "blank" })}
              className={cn(
                "w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center gap-3",
                selected?.type === "blank"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/30 hover:bg-muted/50"
              )}
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-xs text-foreground">Blank Canvas</p>
                <p className="text-[11px] text-muted-foreground">Start from scratch in the page builder</p>
              </div>
            </button>
          </div>

          {/* Marketing-owned templates */}
          {(loadingTemplates || marketingTemplates.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Marketing Templates</p>
              </div>
              {loadingTemplates ? (
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {marketingTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelected({ type: "marketing", id: t.id, label: t.templateLabel ?? t.title })}
                      className={cn(
                        "text-left p-3 rounded-xl border text-sm transition-all",
                        selected?.type === "marketing" && selected.id === t.id
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-400"
                          : "border-border hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/10"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-xs text-foreground">{t.templateLabel ?? t.title}</p>
                          {t.templateDescription && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.templateDescription}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Built-in templates (hardcoded skins) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Built-in Skins</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MICROSITE_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected({ type: "builtin", id: t.id, label: t.name })}
                  className={cn(
                    "text-left p-3 rounded-xl border text-sm transition-all relative overflow-hidden",
                    selected?.type === "builtin" && selected.id === t.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <div
                    className="absolute top-0 right-0 w-6 h-6 rounded-bl-lg opacity-70"
                    style={{ background: t.accentColor }}
                  />
                  <p className="font-medium text-xs text-foreground pr-5">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!hasSelection || !title.trim() || !slug.trim() || creating}
            className="gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? "Creating…" : "Create & Edit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesCampaignPages() {
  const [pages, setPages] = useState<Page[]>([]);
  const [eligibleContacts, setEligibleContacts] = useState<EligibleContact[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [launchingPage, setLaunchingPage] = useState<Page | null>(null);
  const [launchResults, setLaunchResults] = useState<Record<number, LaunchResult>>({});
  const [expandedPageId, setExpandedPageId] = useState<number | null>(null);
  const [pageLinks, setPageLinks] = useState<Record<number, HotlinkEntry[]>>({});
  const [linksLoading, setLinksLoading] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [audienceBuilderOpen, setAudienceBuilderOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState<Audience | null>(null);
  const [deletingAudienceId, setDeletingAudienceId] = useState<number | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/lp/pages`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/campaign-pages/eligible-contacts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/audiences`).then(r => r.ok ? r.json() : []),
    ])
      .then(([p, c, a]) => { setPages(p); setEligibleContacts(c); setAudiences(Array.isArray(a) ? a : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = pages
    .filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const campPagesPag = usePagination(filtered, 15);

  const contactCount = eligibleContacts.length;
  const accountCount = new Set(eligibleContacts.map(c => c.accountName).filter(Boolean)).size;

  async function deleteAudience(id: number) {
    setDeletingAudienceId(id);
    try {
      await fetch(`${API_BASE}/sales/audiences/${id}`, { method: "DELETE" });
      setAudiences(prev => prev.filter(a => a.id !== id));
    } catch {} finally { setDeletingAudienceId(null); }
  }

  async function handleLaunch(opts: {
    audienceId: number;
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
    // Refresh links panel if it was open for this page
    if (expandedPageId === launchingPage.id) {
      setPageLinks(prev => { const next = { ...prev }; delete next[launchingPage.id]; return next; });
    }
    return result;
  }

  async function toggleLinks(pageId: number) {
    if (expandedPageId === pageId) {
      setExpandedPageId(null);
      return;
    }
    setExpandedPageId(pageId);
    if (pageLinks[pageId]) return; // already loaded
    setLinksLoading(pageId);
    try {
      const res = await fetch(`${API_BASE}/sales/campaign-pages/links/${pageId}`);
      const data: HotlinkEntry[] = await res.json();
      setPageLinks(prev => ({ ...prev, [pageId]: data }));
    } catch {}
    finally { setLinksLoading(null); }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  }

  return (
    <SalesLayout>
      {/* Audience Builder Modal */}
      {(audienceBuilderOpen || editingAudience) && (
        <AudienceBuilderModal
          audience={editingAudience}
          onClose={() => { setAudienceBuilderOpen(false); setEditingAudience(null); }}
          onSaved={(saved) => {
            setAudiences(prev => {
              const exists = prev.find(a => a.id === saved.id);
              return exists
                ? prev.map(a => a.id === saved.id ? saved : a)
                : [saved, ...prev];
            });
            setAudienceBuilderOpen(false);
            setEditingAudience(null);
          }}
        />
      )}

      {launchingPage && (
        <LaunchModal
          page={launchingPage}
          audiences={audiences}
          onClose={() => setLaunchingPage(null)}
          onCreateAudience={() => { setLaunchingPage(null); setAudienceBuilderOpen(true); }}
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
          <Button className="gap-2" onClick={() => setShowTemplatePicker(true)}>
            <Plus className="w-4 h-4" />
            New Page
          </Button>
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

        {/* Audiences section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Audiences</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {audiences.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => { setEditingAudience(null); setAudienceBuilderOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Audience
            </Button>
          </div>

          {loading ? (
            <div className="flex gap-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 flex-1 rounded-xl" />)}
            </div>
          ) : audiences.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl px-5 py-6 text-center">
              <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">No audiences yet</p>
              <p className="text-xs text-muted-foreground mb-3">
                Create a saved audience to target specific accounts, titles, or departments in your campaigns.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { setEditingAudience(null); setAudienceBuilderOpen(true); }}
              >
                <Plus className="w-3.5 h-3.5" />
                Create your first audience
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {audiences.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 bg-card border border-border/60 rounded-xl px-4 py-3 hover:border-primary/25 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{a.name}</span>
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {a.contact_count} contacts
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Edit audience"
                      onClick={() => { setEditingAudience(a); setAudienceBuilderOpen(false); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete audience"
                      disabled={deletingAudienceId === a.id}
                      onClick={() => deleteAudience(a.id)}
                    >
                      {deletingAudienceId === a.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
              <Button className="mt-4" onClick={() => setShowTemplatePicker(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create a Page
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {campPagesPag.pageItems.map(page => {
              const result = launchResults[page.id];
              const isExpanded = expandedPageId === page.id;
              const links = pageLinks[page.id];
              const isLoadingLinks = linksLoading === page.id;

              return (
                <div
                  key={page.id}
                  className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/25 transition-all"
                >
                  {/* Page row */}
                  <div className="flex items-center gap-4 px-5 py-4">
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ {result.sent} sent, {result.failed} failed
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLinks(page.id)}
                        className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isLoadingLinks ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        Links
                        {isExpanded
                          ? <ChevronDown className="w-3 h-3" />
                          : <ChevronRight className="w-3 h-3" />
                        }
                      </Button>
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

                  {/* Links panel */}
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-muted/30 px-5 py-3">
                      {isLoadingLinks ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading links…
                        </div>
                      ) : !links || links.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No links generated yet. Use <strong>Launch</strong> to create personalized links for all contacts.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              {links.length} personalized link{links.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex flex-col divide-y divide-border/50">
                            {links.map(link => (
                              <div key={link.id} className="flex items-center gap-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">
                                      {[link.firstName, link.lastName].filter(Boolean).join(" ") || "Unknown contact"}
                                    </span>
                                    {link.accountName && (
                                      <span className="text-xs text-muted-foreground">· {link.accountName}</span>
                                    )}
                                  </div>
                                  {link.email && (
                                    <span className="text-xs text-muted-foreground">{link.email}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <code className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded hidden sm:block">
                                    /p/{link.token}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Copy link"
                                    onClick={() => copyUrl(link.url)}
                                  >
                                    {copiedUrl === link.url
                                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      : <Copy className="w-3.5 h-3.5" />
                                    }
                                  </Button>
                                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Open link">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </Button>
                                  </a>
                                </div>
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
            <PaginationBar
              page={campPagesPag.page} totalPages={campPagesPag.totalPages}
              from={campPagesPag.from} to={campPagesPag.to} total={campPagesPag.total}
              onPage={campPagesPag.setPage} label="pages"
            />
          </div>
        )}
      </div>

      {showTemplatePicker && (
        <TemplatePicker onClose={() => setShowTemplatePicker(false)} />
      )}
    </SalesLayout>
  );
}
