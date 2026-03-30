import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Mail,
  Send,
  FileText,
  Plus,
  Search,
  ChevronRight,
  Trash2,
  Pencil,
  Sparkles,
  Copy,
  Check,
  Building2,
  Users,
  Eye,
  MousePointerClick,
  Loader2,
  TrendingUp,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";

const API_BASE = "/api";

// ─── Types ──────────────────────────────────────────────────

interface Template {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  id: number;
  name: string;
  templateId: number;
  accountId: number | null;
  status: string;
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
}

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
}

interface Account {
  id: number;
  name: string;
}

// ─── Tab types ──────────────────────────────────────────────

type TabId = "send" | "campaigns" | "templates" | "performance";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "send", label: "Single Send", icon: <Send className="w-3.5 h-3.5" /> },
  { id: "campaigns", label: "Campaigns", icon: <Mail className="w-3.5 h-3.5" /> },
  { id: "templates", label: "Templates", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "performance", label: "Performance", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

// ─── Single Send Tab ────────────────────────────────────────

function SingleSendTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [purpose, setPurpose] = useState("intro outreach");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []).then(setAccounts);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) { setContacts([]); return; }
    fetch(`${API_BASE}/sales/accounts/${selectedAccountId}/contacts`)
      .then(r => r.ok ? r.json() : [])
      .then(setContacts);
  }, [selectedAccountId]);

  async function handleGenerate() {
    if (!selectedContactId) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/sales/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: Number(selectedContactId),
          accountId: selectedAccountId ? Number(selectedAccountId) : null,
          purpose,
          includesMicrositeLink: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject ?? "");
        setBodyHtml(data.bodyHtml ?? "");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!selectedContactId || !subject || !bodyHtml) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/sales/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: Number(selectedContactId),
          subject,
          bodyHtml,
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    } finally {
      setSending(false);
    }
  }

  const selectedContact = contacts.find(c => String(c.id) === selectedContactId);

  return (
    <div className="flex flex-col gap-6">
      {/* Recipient selection */}
      <Card className="p-6 rounded-2xl border border-border/60">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recipient</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Account</label>
            <select
              value={selectedAccountId}
              onChange={e => { setSelectedAccountId(e.target.value); setSelectedContactId(""); }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select an account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Contact</label>
            <select
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={!selectedAccountId}
            >
              <option value="">Select a contact…</option>
              {contacts.filter(c => c.email).map(c => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* AI Generation */}
      <Card className="p-6 rounded-2xl border border-border/60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">AI Email Composer</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={!selectedContactId || generating}
            className="gap-1.5"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Generating…" : "Generate with AI"}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Purpose</label>
            <select
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="intro outreach">Intro Outreach</option>
              <option value="follow-up">Follow-Up</option>
              <option value="case study share">Case Study Share</option>
              <option value="meeting request">Meeting Request</option>
              <option value="re-engagement">Re-engagement</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Line</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Body (HTML)</label>
            <textarea
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              placeholder="Write your email here or use AI to generate…"
              rows={12}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Merge variables:</span>
            {["{{first_name}}", "{{last_name}}", "{{company}}", "{{microsite_url}}", "{{sender_name}}"].map(v => (
              <button
                key={v}
                onClick={() => setBodyHtml(prev => prev + v)}
                className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono hover:bg-blue-200 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Preview + Send */}
      {(subject || bodyHtml) && (
        <Card className="p-6 rounded-2xl border border-border/60">
          <h3 className="text-sm font-semibold text-foreground mb-4">Preview</h3>
          <div className="rounded-lg border border-border bg-white p-6 mb-4">
            <p className="text-xs text-muted-foreground mb-1">
              To: {selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName} <${selectedContact.email}>` : "—"}
            </p>
            <p className="text-sm font-semibold text-foreground mb-3">
              {subject
                .replace("{{first_name}}", selectedContact?.firstName ?? "Sarah")
                .replace("{{last_name}}", selectedContact?.lastName ?? "Johnson")}
            </p>
            <div
              className="text-sm text-foreground prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: bodyHtml
                  .replace(/\{\{first_name\}\}/g, selectedContact?.firstName ?? "Sarah")
                  .replace(/\{\{last_name\}\}/g, selectedContact?.lastName ?? "Johnson")
                  .replace(/\{\{company\}\}/g, accounts.find(a => String(a.id) === selectedAccountId)?.name ?? "Acme Dental")
                  .replace(/\{\{microsite_url\}\}/g, '<a href="#" class="text-primary underline">https://example.com/p/abc12345</a>')
                  .replace(/\{\{sender_name\}\}/g, "Dandy"),
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={sending || !selectedContactId || !subject || !bodyHtml}
              className="gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : sent ? "Sent!" : "Send Email"}
            </Button>
            {sent && <span className="text-xs text-emerald-600 font-medium">Email sent successfully</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Campaigns Tab ──────────────────────────────────────────

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/campaigns`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/templates`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([c, t, a]) => { setCampaigns(c); setTemplates(t); setAccounts(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !templateId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/sales/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          templateId: Number(templateId),
          accountId: accountId ? Number(accountId) : null,
        }),
      });
      if (res.ok) {
        setName(""); setTemplateId(""); setAccountId("");
        setShowCreate(false);
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCampaign(id: number) {
    try {
      await fetch(`${API_BASE}/sales/campaigns/${id}/send`, { method: "POST" });
      fetchData();
    } catch {}
  }

  function statusColor(status: string) {
    switch (status) {
      case "draft": return "bg-muted text-muted-foreground";
      case "sending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "sent": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default: return "bg-muted text-muted-foreground";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Send emails to all contacts in an account</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Campaign
        </Button>
      </div>

      {showCreate && (
        <Card className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">Create Campaign</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Q1 DSO Outreach" required />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template *</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select template…</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Account (all contacts)</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !name || !templateId}>
                {saving ? "Creating…" : "Create Draft"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <Mail className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">Create a template first, then build a campaign</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {campaigns.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm">{c.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.recipientCount > 0 && <span>{c.recipientCount} recipients</span>}
                  {c.sentAt && <span>Sent {format(new Date(c.sentAt), "MMM d, h:mm a")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => handleSendCampaign(c.id)} className="gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Templates Tab ──────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchTemplates = useCallback(() => {
    fetch(`${API_BASE}/sales/templates`)
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function resetForm() {
    setName(""); setTplSubject(""); setBodyHtml(""); setCategory("general"); setEditId(null);
  }

  function startEdit(t: Template) {
    setName(t.name);
    setTplSubject(t.subject);
    setBodyHtml(t.bodyHtml);
    setCategory(t.category);
    setEditId(t.id);
    setShowCreate(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !tplSubject) return;
    setSaving(true);
    try {
      const payload = { name, subject: tplSubject, bodyHtml, category };
      const url = editId ? `${API_BASE}/sales/templates/${editId}` : `${API_BASE}/sales/templates`;
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        resetForm();
        setShowCreate(false);
        fetchTemplates();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`${API_BASE}/sales/templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  }

  async function handleAiGenerate() {
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/sales/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: category === "follow-up" ? "follow-up" : "intro outreach", includesMicrositeLink: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subject) setTplSubject(data.subject);
        if (data.bodyHtml) setBodyHtml(data.bodyHtml);
      }
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Reusable email templates with merge variables</p>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(!showCreate); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Template
        </Button>
      </div>

      {showCreate && (
        <Card className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {editId ? "Edit Template" : "Create Template"}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                className="gap-1.5"
              >
                {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Generate
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Name *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Intro Outreach" required />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="general">General</option>
                  <option value="intro">Intro</option>
                  <option value="follow-up">Follow-Up</option>
                  <option value="case-study">Case Study</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Line *</label>
              <Input value={tplSubject} onChange={e => setTplSubject(e.target.value)} placeholder="Quick question about {{company}}" required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Body (HTML)</label>
              <textarea
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                placeholder="Hi {{first_name}}, ..."
                rows={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>Insert:</span>
              {["{{first_name}}", "{{last_name}}", "{{company}}", "{{microsite_url}}", "{{sender_name}}"].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBodyHtml(prev => prev + v)}
                  className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-mono hover:bg-blue-200 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !name || !tplSubject}>
                {saving ? "Saving…" : editId ? "Update Template" : "Create Template"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { resetForm(); setShowCreate(false); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">Create your first email template to use in outreach</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-700 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm">{t.name}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Performance Tab ────────────────────────────────────────

interface Signal {
  id: number;
  type: string;
  campaignId?: number;
}

interface CampaignPerformance {
  id: number;
  name: string;
  status: string;
  recipientCount: number;
  sentAt: string | null;
  opens: number;
  clicks: number;
  formSubmits: number;
}

function PerformanceTab() {
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/campaigns`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/signals?limit=500`).then(r => r.ok ? r.json() : []),
    ])
      .then(([campaignList, signals]) => {
        const campaignMap = new Map<number, CampaignPerformance>();

        campaignList.forEach((c: Campaign) => {
          campaignMap.set(c.id, {
            id: c.id,
            name: c.name,
            status: c.status,
            recipientCount: c.recipientCount,
            sentAt: c.sentAt,
            opens: 0,
            clicks: 0,
            formSubmits: 0,
          });
        });

        signals.forEach((s: Signal) => {
          if (s.campaignId && campaignMap.has(s.campaignId)) {
            const perf = campaignMap.get(s.campaignId)!;
            if (s.type === "email_open") perf.opens++;
            else if (s.type === "email_click") perf.clicks++;
            else if (s.type === "form_submit") perf.formSubmits++;
          }
        });

        setCampaigns(Array.from(campaignMap.values()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">Create and send campaigns to see performance analytics</p>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left font-semibold text-foreground px-4 py-3">Campaign Name</th>
                <th className="text-left font-semibold text-foreground px-4 py-3">Status</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Recipients</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Opens</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Open Rate</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Clicks</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Click Rate</th>
                <th className="text-right font-semibold text-foreground px-4 py-3">Sent Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const openRate = c.recipientCount > 0 ? ((c.opens / c.recipientCount) * 100).toFixed(1) : "—";
                const clickRate = c.recipientCount > 0 ? ((c.clicks / c.recipientCount) * 100).toFixed(1) : "—";

                return (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        c.status === "draft" ? "bg-muted text-muted-foreground" :
                        c.status === "sending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.recipientCount}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.opens}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{openRate}%</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.clicks}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{clickRate}%</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {c.sentAt ? format(new Date(c.sentAt), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Outreach Page ─────────────────────────────────────

export default function SalesOutreach() {
  const [activeTab, setActiveTab] = useState<TabId>("send");

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Outreach</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and send personalized emails with tracked microsites
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "send" && <SingleSendTab />}
        {activeTab === "campaigns" && <CampaignsTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "performance" && <PerformanceTab />}
      </div>
    </SalesLayout>
  );
}
