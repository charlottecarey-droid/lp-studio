import { useState, useEffect, useCallback } from "react";
import { Link2, Plus, Copy, Check, Clock, Eye, MousePointerClick, Mail, Bell, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface PersonalizedLink {
  id: number;
  page_id: number;
  contact_name: string;
  company: string | null;
  email: string | null;
  token: string;
  created_at: string;
  visit_count: number;
  last_visited_at: string | null;
  max_scroll_depth: number | null;
  total_cta_clicks: number;
}

interface AlertEmail {
  id: number;
  email: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function PersonalizedLinkRow({
  link,
  onDelete,
}: {
  link: PersonalizedLink;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { domainContext } = useAuth();

  const handleCopy = async () => {
    const base = domainContext?.micrositeDomain
      ? `https://${domainContext.micrositeDomain}`
      : window.location.origin;
    const url = `${base}/p/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copied!", description: `Personalized link for ${link.contact_name} copied to clipboard.` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{link.contact_name}</span>
          {link.company && (
            <span className="text-xs text-muted-foreground truncate">· {link.company}</span>
          )}
          {link.visit_count > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
              <Eye className="w-3 h-3" />
              {link.visit_count} visit{link.visit_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="font-mono text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">{link.token}</span>
          {link.last_visited_at ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last seen {formatDate(link.last_visited_at)}
            </span>
          ) : (
            <span className="text-muted-foreground/50">Not yet visited</span>
          )}
          {link.max_scroll_depth != null && (
            <span className="flex items-center gap-1">
              <ChevronDown className="w-3 h-3" />
              {Math.round(link.max_scroll_depth)}% scroll
            </span>
          )}
          {link.total_cta_clicks > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <MousePointerClick className="w-3 h-3" />
              {link.total_cta_clicks} CTA
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete link"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

interface PersonalizedLinksPanelProps {
  pageId: number;
  pageSlug: string;
  pageTitle: string;
  onClose: () => void;
}

export default function PersonalizedLinksPanel({ pageId, pageSlug: _pageSlug, pageTitle, onClose }: PersonalizedLinksPanelProps) {
  const { toast } = useToast();
  const { domainContext } = useAuth();
  const [links, setLinks] = useState<PersonalizedLink[]>([]);
  const [alertEmails, setAlertEmails] = useState<AlertEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [alertEmailInput, setAlertEmailInput] = useState("");
  const [addingAlertEmail, setAddingAlertEmail] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [linksRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/lp/personalized-links?pageId=${pageId}`),
        fetch(`${API_BASE}/lp/page-alert-emails?pageId=${pageId}`),
      ]);
      const [linksData, alertsData] = await Promise.all([linksRes.json(), alertsRes.json()]);
      setLinks(Array.isArray(linksData) ? linksData : []);
      setAlertEmails(Array.isArray(alertsData) ? alertsData : []);
    } catch {
      setLinks([]);
      setAlertEmails([]);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateLink = async () => {
    if (!contactName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/lp/personalized-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          contactName: contactName.trim(),
          company: company.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create link");
      const newLink = await res.json() as PersonalizedLink;
      const base = domainContext?.micrositeDomain
        ? `https://${domainContext.micrositeDomain}`
        : window.location.origin;
      const url = `${base}/p/${newLink.token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link created & copied!", description: `Personalized link for ${contactName.trim()} is ready.` });
      setContactName("");
      setCompany("");
      setEmail("");
      await loadData();
    } catch {
      toast({ title: "Failed to create link", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    try {
      await fetch(`${API_BASE}/lp/personalized-links/${linkId}`, { method: "DELETE" });
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast({ title: "Link deleted" });
    } catch {
      toast({ title: "Failed to delete link", variant: "destructive" });
    }
  };

  const handleAddAlertEmail = async () => {
    if (!alertEmailInput.trim() || !alertEmailInput.includes("@")) return;
    setAddingAlertEmail(true);
    try {
      const res = await fetch(`${API_BASE}/lp/page-alert-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, email: alertEmailInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setAlertEmailInput("");
      await loadData();
      toast({ title: "Alert email added" });
    } catch {
      toast({ title: "Failed to add alert email", variant: "destructive" });
    } finally {
      setAddingAlertEmail(false);
    }
  };

  const handleRemoveAlertEmail = async (id: number) => {
    try {
      await fetch(`${API_BASE}/lp/page-alert-emails/${id}`, { method: "DELETE" });
      setAlertEmails(prev => prev.filter(a => a.id !== id));
    } catch {
      toast({ title: "Failed to remove alert email", variant: "destructive" });
    }
  };

  const visitedLinks = links.filter(l => l.visit_count > 0);
  const unvisitedLinks = links.filter(l => l.visit_count === 0);

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-background border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Personalized Links</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[280px]">{pageTitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Create link form */}
        <div className="px-5 py-4 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Generate Link</p>
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-medium">Contact Name *</Label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="e.g. John Smith"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateLink()}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Company</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  placeholder="Apex Dental"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleCreateLink}
              disabled={creating || !contactName.trim()}
            >
              {creating ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {creating ? "Creating..." : "Create & Copy Link"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Generates a unique URL like <span className="font-mono">/p/x8kQp3mN</span> that attributes page visits to this contact.
          </p>
        </div>

        {/* Alert emails */}
        <div className="px-5 py-3 border-b border-border">
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <Bell className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
              Visit Alerts {alertEmails.length > 0 && `(${alertEmails.length})`}
            </span>
            {showAlerts ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground rotate-180" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {showAlerts && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-muted-foreground">Get emailed when a personalized link is visited.</p>
              <div className="flex gap-2">
                <Input
                  className="h-7 text-xs flex-1"
                  type="email"
                  placeholder="your@email.com"
                  value={alertEmailInput}
                  onChange={e => setAlertEmailInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddAlertEmail()}
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handleAddAlertEmail}
                  disabled={addingAlertEmail || !alertEmailInput.trim()}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
              {alertEmails.length > 0 && (
                <div className="space-y-1">
                  {alertEmails.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        {a.email}
                      </span>
                      <button
                        onClick={() => handleRemoveAlertEmail(a.id)}
                        className="p-0.5 hover:text-destructive transition-colors rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Links list */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Who Visited
            {visitedLinks.length > 0 && (
              <span className="ml-1 text-green-600">· {visitedLinks.length} contact{visitedLinks.length !== 1 ? "s" : ""}</span>
            )}
          </p>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No personalized links yet.</p>
              <p className="text-xs mt-1">Create one above to start tracking named visitors.</p>
            </div>
          ) : (
            <div>
              {visitedLinks.length > 0 && (
                <div className="mb-2">
                  {visitedLinks.map(link => (
                    <PersonalizedLinkRow
                      key={link.id}
                      link={link}
                      onDelete={() => handleDeleteLink(link.id)}
                    />
                  ))}
                </div>
              )}

              {unvisitedLinks.length > 0 && (
                <div>
                  {visitedLinks.length > 0 && (
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2 mt-4 pt-2 border-t border-border/50">
                      Pending ({unvisitedLinks.length})
                    </p>
                  )}
                  {unvisitedLinks.map(link => (
                    <PersonalizedLinkRow
                      key={link.id}
                      link={link}
                      onDelete={() => handleDeleteLink(link.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
