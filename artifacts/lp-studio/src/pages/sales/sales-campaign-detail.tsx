import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  MousePointerClick,
  Clock,
  Trash2,
  Copy,
  Pencil,
  Calendar,
  MoreVertical,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  Play,
  Pause,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { StatusBadge } from "@/components/ui/status-badge";

const API_BASE = "/api";

// ─── Types ──────────────────────────────────────────────────

interface SendRecord {
  id: number;
  contactId: number;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  contactFirst: string | null;
  contactLast: string | null;
  accountName: string | null;
}

interface Template {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  format: string;
  category: string;
}

interface Account {
  id: number;
  name: string;
}

interface CampaignDetail {
  id: number;
  name: string;
  templateId: number;
  accountId: number | null;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  template: Template | null;
  sends: SendRecord[];
  account: Account | null;
}

// ─── Status helpers ─────────────────────────────────────────

function statusIcon(status: string) {
  switch (status) {
    case "sent":
    case "delivered":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case "opened":
      return <Eye className="w-3.5 h-3.5 text-blue-500" />;
    case "clicked":
      return <MousePointerClick className="w-3.5 h-3.5 text-violet-500" />;
    case "bounced":
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "queued":
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    default:
      return <Mail className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function campaignStatusColor(status: string) {
  switch (status) {
    case "draft": return "bg-muted text-muted-foreground";
    case "scheduled": return "bg-blue-100 text-blue-700";
    case "sending": return "bg-amber-100 text-amber-700";
    case "sent": return "bg-emerald-100 text-emerald-700";
    case "paused": return "bg-orange-100 text-orange-700";
    default: return "bg-muted text-muted-foreground";
  }
}

// ─── Component ──────────────────────────────────────────────

export default function SalesCampaignDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/sales/campaigns/:id");
  const campaignId = params?.id ? Number(params.id) : null;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAccountId, setEditAccountId] = useState<string>("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Actions
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);

  // Scheduling
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // Available accounts/templates for editing
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return;
    try {
      const res = await fetch(`${API_BASE}/sales/campaigns/${campaignId}`);
      if (!res.ok) throw new Error("Campaign not found");
      const data = await res.json();
      setCampaign(data);
      setEditName(data.name);
      setEditAccountId(data.accountId ? String(data.accountId) : "");
      if (data.scheduledAt) {
        const d = new Date(data.scheduledAt);
        setEditScheduledAt(d.toISOString().slice(0, 16));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
    // Also load accounts and templates for edit mode
    Promise.all([
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/templates`).then(r => r.ok ? r.json() : []),
    ]).then(([a, t]) => { setAccounts(a); setTemplates(t); });
  }, [fetchCampaign]);

  // ─── Actions ────────────────────────────────────────────────

  async function handleSave() {
    if (!campaign) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { name: editName };
      if (editAccountId) updates.accountId = Number(editAccountId);
      else updates.accountId = null;
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      setEditing(false);
      fetchCampaign();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, { method: "DELETE" });
      navigate("/sales/campaigns");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClone() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sales/campaigns/${campaign.id}/clone`, { method: "POST" });
      if (res.ok) {
        const clone = await res.json();
        navigate(`/sales/campaigns/${clone.id}`);
      }
    } finally {
      setActionLoading(false);
      setMenuOpen(false);
    }
  }

  async function handleSend() {
    if (!campaign) return;
    setSendingCampaign(true);
    try {
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}/send`, { method: "POST" });
      fetchCampaign();
    } finally {
      setSendingCampaign(false);
    }
  }

  async function handleSaveAsDraft() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", sentAt: null }),
      });
      fetchCampaign();
    } finally {
      setActionLoading(false);
      setMenuOpen(false);
    }
  }

  async function handleSchedule() {
    if (!campaign || !scheduleDate || !scheduleTime) return;
    setActionLoading(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled", scheduledAt }),
      });
      setShowSchedule(false);
      fetchCampaign();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelSchedule() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", scheduledAt: null }),
      });
      fetchCampaign();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChangeTemplate(templateId: number) {
    if (!campaign) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      fetchCampaign();
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  if (!match) return null;

  if (loading) {
    return (
      <SalesLayout>
        <div className="flex flex-col gap-6 pb-12">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </SalesLayout>
    );
  }

  if (error || !campaign) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{error ?? "Campaign not found"}</h2>
          <Button variant="outline" className="gap-1.5" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales/campaigns")}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </div>
      </SalesLayout>
    );
  }

  // Send stats — sends may be undefined if server hasn't been restarted
  const sends = campaign.sends ?? [];
  const totalSends = sends.length;
  const sentCount = sends.filter(s => ["sent", "delivered", "opened", "clicked"].includes(s.status)).length;
  const openedCount = sends.filter(s => s.openedAt).length;
  const clickedCount = sends.filter(s => s.clickedAt).length;
  const failedCount = sends.filter(s => ["bounced", "failed"].includes(s.status)).length;
  const openRate = totalSends > 0 ? Math.round((openedCount / totalSends) * 100) : 0;
  const clickRate = totalSends > 0 ? Math.round((clickedCount / totalSends) * 100) : 0;

  const isDraft = campaign.status === "draft";
  const isScheduled = campaign.status === "scheduled";
  const isSent = campaign.status === "sent";

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        {/* Back + Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button className="mt-1 p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/sales/campaigns")}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="text-lg font-bold h-9 max-w-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                    <Save className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditName(campaign.name); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-display font-bold text-foreground">{campaign.name}</h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${campaignStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                  {isDraft && (
                    <button onClick={() => setEditing(true)} className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {campaign.account && (
                  <Link href={`/sales/accounts/${campaign.account.id}`}>
                    <span className="hover:text-primary cursor-pointer">{campaign.account.name}</span>
                  </Link>
                )}
                {campaign.template && <span>Template: {campaign.template.name}</span>}
                <span>Created {format(new Date(campaign.createdAt), "MMM d, yyyy")}</span>
                {campaign.sentAt && <span>Sent {format(new Date(campaign.sentAt), "MMM d 'at' h:mm a")}</span>}
                {campaign.scheduledAt && isScheduled && (
                  <span className="text-blue-600 font-medium">
                    Scheduled for {format(new Date(campaign.scheduledAt), "MMM d 'at' h:mm a")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDraft && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)} className="gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule
                </Button>
                <Button size="sm" onClick={handleSend} disabled={sendingCampaign} className="gap-1.5">
                  {sendingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sendingCampaign ? "Sending…" : "Send Now"}
                </Button>
              </>
            )}
            {isScheduled && (
              <Button size="sm" variant="outline" onClick={handleCancelSchedule} disabled={actionLoading} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                Cancel Schedule
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => fetchCampaign()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>

            {/* More actions dropdown */}
            <div className="relative">
              <Button size="sm" variant="outline" onClick={() => setMenuOpen(!menuOpen)}>
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border bg-card shadow-lg py-1">
                  <button
                    onClick={handleClone}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Clone Campaign
                  </button>
                  {isSent && (
                    <button
                      onClick={handleSaveAsDraft}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Revert to Draft
                    </button>
                  )}
                  {confirmDelete ? (
                    <div className="px-3 py-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Delete this campaign and all sends?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleDelete}
                          disabled={actionLoading}
                          className="flex-1 text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                        >
                          {actionLoading ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => { setConfirmDelete(false); setMenuOpen(false); }}
                          className="flex-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule Modal */}
        {showSchedule && (
          <Card className="p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/30">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-3">Schedule Campaign</h3>
                <div className="flex items-end gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-40"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Time</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button size="sm" onClick={handleSchedule} disabled={!scheduleDate || actionLoading} className="gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {actionLoading ? "Scheduling…" : "Schedule"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSchedule(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Performance Stats */}
        {totalSends > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-foreground">{totalSends}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Sent</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-emerald-600">{sentCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Delivered</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-blue-600">{openedCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Opened ({openRate}%)</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-violet-600">{clickedCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Clicked ({clickRate}%)</div>
            </Card>
            <Card className="p-4 rounded-xl text-center">
              <div className="text-2xl font-bold text-red-500">{failedCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Failed</div>
            </Card>
          </div>
        )}

        {/* Campaign Settings (editable for drafts) */}
        {isDraft && (
          <Card className="p-5 rounded-2xl">
            <h3 className="text-sm font-semibold text-foreground mb-4">Campaign Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Target Account</Label>
                <select
                  value={editAccountId}
                  onChange={e => {
                    setEditAccountId(e.target.value);
                    fetch(`${API_BASE}/sales/campaigns/${campaign.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ accountId: e.target.value ? Number(e.target.value) : null }),
                    }).then(() => fetchCampaign());
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Email Template</Label>
                <select
                  value={campaign.templateId}
                  onChange={e => handleChangeTemplate(Number(e.target.value))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Email Preview */}
        {campaign.template && (
          <Card className="p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Email Content</h3>
              {isDraft && campaign.template && (
                <Link href="/sales/campaigns">
                  <Button size="sm" variant="ghost" className="text-xs gap-1">
                    <Pencil className="w-3 h-3" /> Edit Template
                  </Button>
                </Link>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                <p className="text-sm text-foreground mt-0.5">{campaign.template.subject}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Body:</span>
                <div
                  className="mt-1 text-sm text-foreground border border-border/50 rounded-lg p-4 bg-muted/20 max-h-60 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: campaign.template.bodyHtml }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Recipients / Send Results */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {totalSends > 0 ? `Recipients (${totalSends})` : "Recipients"}
            </h3>
          </div>

          {totalSends === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No sends yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {isDraft
                  ? "Click \"Send Now\" to deliver this campaign to all contacts in the selected account."
                  : "This campaign has no send records."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_120px_120px_120px_100px] gap-2 px-5 py-2.5 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Contact</span>
                <span>Email</span>
                <span>Status</span>
                <span>Sent</span>
                <span>Opened</span>
                <span>Clicked</span>
              </div>
              {sends.map(send => (
                <div key={send.id} className="grid grid-cols-[1fr_1fr_120px_120px_120px_100px] gap-2 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <span className="text-sm text-foreground font-medium truncate block">
                      {send.contactFirst} {send.contactLast}
                    </span>
                    {send.accountName && (
                      <span className="text-xs text-muted-foreground truncate block">{send.accountName}</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{send.email}</span>
                  <div className="flex items-center gap-1.5">
                    {statusIcon(send.status)}
                    <span className="text-xs font-medium">{statusLabel(send.status)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {send.sentAt ? format(new Date(send.sentAt), "MMM d, h:mm a") : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {send.openedAt ? format(new Date(send.openedAt), "MMM d, h:mm a") : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {send.clickedAt ? format(new Date(send.clickedAt), "MMM d, h:mm a") : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </SalesLayout>
  );
}
