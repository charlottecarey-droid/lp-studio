import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  Send,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Mail,
  Users,
  FileText,
  Eye,
  Search,
  FlaskConical,
  X,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

const API_BASE = "/api";

interface Template {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  format: string;
  category?: string;
}

interface Account {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  accountId: number | null;
  accountName: string | null;
  status: string | null;
}

interface Audience {
  id: number;
  name: string;
  description: string | null;
  contact_count: number | null;
}

interface PreviewResult {
  subject: string;
  html: string;
  contact: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    company: string;
    hasHotlink: boolean;
  } | null;
  unresolvedTokens: string[];
  emptyTokens: string[];
  isSample: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (campaignId: number) => void;
}

const MERGE_VARS = [
  { label: "First name", token: "{{first_name}}" },
  { label: "Last name", token: "{{last_name}}" },
  { label: "Company", token: "{{company}}" },
  { label: "Sender name", token: "{{sender_name}}" },
  { label: "Microsite link", token: "{{microsite_url}}" },
];

type Step = 1 | 2 | 3 | 4;

export function QuickCampaignWizard({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — basics
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState<string>("");

  // Step 2 — audience
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("");
  const [applyingAudience, setApplyingAudience] = useState(false);

  // Step 3 — content
  const [templates, setTemplates] = useState<Template[]>([]);
  const [composeMode, setComposeMode] = useState<"template" | "quick">("template");
  const [templateId, setTemplateId] = useState<string>("");
  // Quick-compose
  const [quickSubject, setQuickSubject] = useState("");
  const [quickBody, setQuickBody] = useState("");

  // Step 4 — preview & send
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContactId, setPreviewContactId] = useState<string>("");
  const [sentTest, setSentTest] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [confirmedUnresolved, setConfirmedUnresolved] = useState(false);

  // Sender (kept simple — defaults match existing behaviour)
  const [senderName, setSenderName] = useState("Dandy");
  const [senderEmail] = useState("partnerships");
  const [replyTo] = useState("sales@meetdandy.com");

  // Accounts list for filter
  const [accounts, setAccounts] = useState<Account[]>([]);

  // ─── Reset when re-opened ────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(1);
      setError(null);
      setName("");
      setAccountId("");
      setSelectedContactIds(new Set());
      setSelectedAudienceId("");
      setContactSearch("");
      setComposeMode("template");
      setTemplateId("");
      setQuickSubject("");
      setQuickBody("");
      setPreview(null);
      setPreviewContactId("");
      setSentTest(false);
      setConfirmedUnresolved(false);
      setDraftId(null); // ensure a fresh draft each time the wizard opens
      if (user?.name) setSenderName(user.name.split(" ")[0] || "Dandy");
    }
  }, [open, user]);

  // ─── Load templates + accounts on first open ─────────────
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`${API_BASE}/sales/templates`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/audiences`).then(r => r.ok ? r.json() : []),
    ]).then(([t, a, au]) => {
      setTemplates(Array.isArray(t) ? t : []);
      setAccounts(Array.isArray(a) ? a : []);
      setAudiences(Array.isArray(au) ? au : []);
    }).catch(() => {});
  }, [open]);

  // ─── Load contacts when entering step 2 ──────────────────
  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const url = accountId
        ? `${API_BASE}/sales/contacts?accountId=${accountId}`
        : `${API_BASE}/sales/contacts`;
      const r = await fetch(url);
      const data = r.ok ? await r.json() : [];
      const arr: Contact[] = Array.isArray(data) ? data : (data.data ?? []);
      setContacts(arr.filter(c => c.email && (!c.status || c.status === "active")));
    } finally {
      setContactsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (open && step === 2) loadContacts();
  }, [open, step, loadContacts]);

  const filteredContacts = useMemo(() => {
    const s = contactSearch.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter(c => {
      const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
      return name.includes(s)
        || (c.email ?? "").toLowerCase().includes(s)
        || (c.accountName ?? "").toLowerCase().includes(s);
    });
  }, [contacts, contactSearch]);

  // Apply a saved audience: fetch its contacts, merge into the contact list,
  // and pre-select them. User can still tweak the selection afterwards.
  async function applyAudience(audienceIdStr: string) {
    setSelectedAudienceId(audienceIdStr);
    if (!audienceIdStr) return;
    setApplyingAudience(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/sales/audiences/${audienceIdStr}/contacts`);
      if (!r.ok) throw new Error("Failed to load audience contacts");
      const data = await r.json();
      const audContacts: Contact[] = (Array.isArray(data) ? data : []).map((c: any) => ({
        id: c.id,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        email: c.email ?? null,
        accountId: c.accountId ?? null,
        accountName: c.accountName ?? null,
        status: c.status ?? "active",
      })).filter(c => c.email);

      // Merge so audience contacts always appear in the list, even if they
      // weren't in the current account filter.
      setContacts(prev => {
        const seen = new Set(prev.map(c => c.id));
        const merged = [...prev];
        for (const c of audContacts) if (!seen.has(c.id)) merged.push(c);
        return merged;
      });
      setSelectedContactIds(new Set(audContacts.map(c => c.id)));
    } catch (e: any) {
      setError(e.message ?? "Couldn't apply audience");
    } finally {
      setApplyingAudience(false);
    }
  }

  function toggleContact(id: number) {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedContactIds(next);
  }

  function toggleAllVisible() {
    const visibleIds = filteredContacts.map(c => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedContactIds.has(id));
    const next = new Set(selectedContactIds);
    if (allSelected) {
      visibleIds.forEach(id => next.delete(id));
    } else {
      visibleIds.forEach(id => next.add(id));
    }
    setSelectedContactIds(next);
  }

  function insertToken(token: string) {
    setQuickBody(b => b + (b && !b.endsWith(" ") && !b.endsWith("\n") ? " " : "") + token + " ");
  }

  // ─── Validation per step ────────────────────────────────
  function canAdvance(): boolean {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return selectedContactIds.size > 0;
    if (step === 3) {
      if (composeMode === "template") return !!templateId;
      return quickSubject.trim().length > 0 && quickBody.trim().length > 0;
    }
    if (step === 4) {
      if (!preview) return false;
      if (preview.unresolvedTokens.length > 0 && !confirmedUnresolved) return false;
      return true;
    }
    return false;
  }

  // ─── Step 4: build draft, fetch preview ─────────────────
  // We create the campaign as a draft when entering preview, so the existing
  // preview endpoint can render it. If a draft already exists from a previous
  // preview, we update it instead.
  const [draftId, setDraftId] = useState<number | null>(null);

  async function ensureDraft(): Promise<number | null> {
    setError(null);
    try {
      let effectiveTemplateId: number | null = null;

      if (composeMode === "template") {
        effectiveTemplateId = Number(templateId);
      } else {
        // Quick compose — create (or update) a hidden template for this campaign
        const tplName = `[Quick Campaign] ${name}`;
        const tplPayload = {
          name: tplName,
          subject: quickSubject.trim(),
          bodyText: quickBody,
          bodyHtml: "",
          format: "plain",
          category: "quick_campaign",
        };
        if (draftId) {
          // Reuse: find existing template via current draft & PATCH it
          const r = await fetch(`${API_BASE}/sales/campaigns/${draftId}`);
          const draft = r.ok ? await r.json() : null;
          if (draft?.template?.id) {
            await fetch(`${API_BASE}/sales/templates/${draft.template.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(tplPayload),
            });
            effectiveTemplateId = draft.template.id;
          }
        }
        if (!effectiveTemplateId) {
          const r = await fetch(`${API_BASE}/sales/templates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tplPayload),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error ?? "Failed to create template");
          }
          const t = await r.json();
          effectiveTemplateId = t.id;
        }
      }

      const meta = {
        contactIds: Array.from(selectedContactIds),
        senderName: senderName.trim() || "Dandy",
        senderEmail,
        replyTo,
      };

      if (draftId) {
        const r = await fetch(`${API_BASE}/sales/campaigns/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            templateId: effectiveTemplateId,
            accountId: accountId ? Number(accountId) : null,
            metadata: meta,
          }),
        });
        if (!r.ok) throw new Error("Failed to update draft");
        return draftId;
      }

      const r = await fetch(`${API_BASE}/sales/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          templateId: effectiveTemplateId,
          accountId: accountId ? Number(accountId) : null,
          status: "draft",
          metadata: meta,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create campaign");
      }
      const c = await r.json();
      setDraftId(c.id);
      return c.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
      return null;
    }
  }

  async function refreshPreview(id: number, contactId?: string) {
    setPreviewLoading(true);
    try {
      const r = await fetch(`${API_BASE}/sales/campaigns/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactId ? { contactId: Number(contactId) } : {}),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load preview");
      }
      const data: PreviewResult = await r.json();
      setPreview(data);
      if (data.contact && !contactId) setPreviewContactId(String(data.contact.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleNext() {
    setError(null);
    if (step < 4) {
      // Entering step 4 — create draft + load preview
      if (step === 3) {
        setSubmitting(true);
        const id = await ensureDraft();
        setSubmitting(false);
        if (!id) return;
        setStep(4);
        refreshPreview(id);
        return;
      }
      setStep((step + 1) as Step);
    }
  }

  function handleBack() {
    setError(null);
    setConfirmedUnresolved(false);
    if (step > 1) setStep((step - 1) as Step);
  }

  async function handleSendTest() {
    if (!preview) return;
    const to = user?.email;
    if (!to) { setError("Sign in to send a test email"); return; }
    setSendingTest(true);
    try {
      const tpl = composeMode === "template"
        ? templates.find(t => String(t.id) === templateId)
        : null;
      const subject = tpl?.subject ?? quickSubject;
      const bodyPayload = tpl
        ? (tpl.format === "plain" ? { bodyText: tpl.bodyText ?? "" } : { bodyHtml: tpl.bodyHtml })
        : { bodyText: quickBody };
      const r = await fetch(`${API_BASE}/sales/send-test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          senderName,
          senderEmail,
          replyTo,
          contactId: previewContactId ? Number(previewContactId) : undefined,
          ...bodyPayload,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send test");
      }
      setSentTest(true);
      setTimeout(() => setSentTest(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send test");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendNow() {
    if (!draftId) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/sales/campaigns/${draftId}/send`, {
        method: "POST",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send campaign");
      }
      const result = await r.json();
      onCreated?.(draftId);
      onClose();
      // Reset draft so the next wizard run creates a fresh campaign
      setDraftId(null);
      if (typeof window !== "undefined") {
        alert(`Campaign sent! ${result.sent} delivered${result.failed > 0 ? `, ${result.failed} failed` : ""}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send campaign");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setSubmitting(true);
    const id = draftId ?? (await ensureDraft());
    setSubmitting(false);
    if (id) {
      onCreated?.(id);
      setDraftId(null);
      onClose();
    }
  }

  // ─── Render ─────────────────────────────────────────────
  const steps: { n: Step; label: string; icon: typeof Mail }[] = [
    { n: 1, label: "Basics", icon: Mail },
    { n: 2, label: "Recipients", icon: Users },
    { n: 3, label: "Email", icon: FileText },
    { n: 4, label: "Preview & Send", icon: Eye },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-primary" />
            New Campaign
          </DialogTitle>
          {/* Stepper */}
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s, i) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <div key={s.n} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 ${active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                      active ? "border-primary bg-primary/10 text-primary"
                        : done ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted"
                    }`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : s.n}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-px mx-2 ${done ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1 — Basics */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Campaign name *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Q2 DSO outreach"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">Only visible to your team. Recipients won't see this.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Filter recipients by account (optional)</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All accounts — choose contacts manually</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1.5">You'll pick the exact contacts in the next step.</p>
              </div>
            </div>
          )}

          {/* Step 2 — Recipients */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {audiences.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Start from a saved audience</span>
                    <span className="text-[11px] text-muted-foreground">(optional — you can still edit the list below)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAudienceId}
                      onChange={e => applyAudience(e.target.value)}
                      disabled={applyingAudience}
                      className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm"
                    >
                      <option value="">Choose an audience…</option>
                      {audiences.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.contact_count != null ? ` (${a.contact_count})` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedAudienceId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSelectedAudienceId(""); setSelectedContactIds(new Set()); }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {applyingAudience && (
                    <div className="text-[11px] text-muted-foreground mt-2">Loading audience…</div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Search name, email, or company…"
                    className="pl-9"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={toggleAllVisible}>
                  {filteredContacts.length > 0 && filteredContacts.every(c => selectedContactIds.has(c.id))
                    ? "Deselect all" : "Select all visible"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedContactIds.size}</span> selected
                {" · "}{filteredContacts.length} shown
                {selectedContactIds.size === 0 && <span className="text-amber-600 ml-2">— pick at least one</span>}
              </div>
              <div className="border border-border rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                {contactsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No contacts {contactSearch ? "match your search" : "found"}.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredContacts.map(c => {
                      const selected = selectedContactIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleContact(c.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-primary bg-primary" : "border-border bg-background"
                          }`}>
                            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {c.email}{c.accountName ? ` · ${c.accountName}` : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Content */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
                <button
                  onClick={() => setComposeMode("template")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    composeMode === "template" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Use a saved template
                </button>
                <button
                  onClick={() => setComposeMode("quick")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    composeMode === "quick" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quick compose
                </button>
              </div>

              {composeMode === "template" ? (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Template *</label>
                  {templates.length === 0 ? (
                    <Card className="p-6 text-center text-sm text-muted-foreground rounded-xl border-dashed">
                      No templates yet. Use <span className="font-medium text-foreground">Quick compose</span> instead,
                      or create one in the Templates tab.
                    </Card>
                  ) : (
                    <div className="grid gap-2 max-h-[360px] overflow-y-auto">
                      {templates.map(t => {
                        const selected = String(t.id) === templateId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTemplateId(String(t.id))}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/30 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm text-foreground truncate">{t.name}</div>
                              {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.subject}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Subject *</label>
                    <Input
                      value={quickSubject}
                      onChange={e => setQuickSubject(e.target.value)}
                      placeholder="e.g. Quick idea for {{company}}"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">Message *</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {MERGE_VARS.map(mv => (
                          <button
                            key={mv.token}
                            type="button"
                            onClick={() => insertToken(mv.token)}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors"
                            title={`Insert ${mv.token}`}
                          >
                            + {mv.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={quickBody}
                      onChange={e => setQuickBody(e.target.value)}
                      placeholder={"Hi {{first_name}},\n\nSaw {{company}} is exploring…"}
                      rows={10}
                      className="font-mono text-sm leading-relaxed"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Click a chip above to insert a merge variable. We'll show you exactly what each recipient sees in the next step.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Preview & Send */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {/* Sample-recipient selector + test */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[11px] font-semibold text-muted-foreground mb-1 block uppercase tracking-wider">
                    Previewing as
                  </label>
                  <select
                    value={previewContactId}
                    onChange={e => {
                      setPreviewContactId(e.target.value);
                      if (draftId) refreshPreview(draftId, e.target.value);
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {contacts
                      .filter(c => selectedContactIds.has(c.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                          {c.accountName ? ` · ${c.accountName}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendTest}
                  disabled={sendingTest || !user?.email}
                  className="gap-1.5 mt-5"
                >
                  {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : sentTest ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                    : <FlaskConical className="w-3.5 h-3.5" />}
                  {sendingTest ? "Sending…" : sentTest ? "Test sent" : "Send test to me"}
                </Button>
              </div>

              {/* Warnings */}
              {preview && preview.unresolvedTokens.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs leading-relaxed">
                    <div className="font-semibold text-amber-900 mb-1">
                      {preview.unresolvedTokens.length} unknown {preview.unresolvedTokens.length === 1 ? "tag" : "tags"} in your email
                    </div>
                    <div className="text-amber-800">
                      We don't recognise: {preview.unresolvedTokens.map(t => (
                        <code key={t} className="px-1 py-0.5 mx-0.5 bg-white border border-amber-200 rounded font-mono">
                          {`{{${t}}}`}
                        </code>
                      ))}
                      . These will be <strong>removed</strong> from the email before sending (recipients won't see the raw tags).
                    </div>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmedUnresolved}
                        onChange={e => setConfirmedUnresolved(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-amber-900 font-medium">I understand — send anyway</span>
                    </label>
                  </div>
                </div>
              )}

              {preview && preview.emptyTokens.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-sky-300 bg-sky-50 text-xs">
                  <AlertTriangle className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sky-900 leading-relaxed">
                    Heads up: <strong>{preview.contact?.firstName || preview.contact?.email}</strong> is missing data for{" "}
                    {preview.emptyTokens.map(t => (
                      <code key={t} className="px-1 py-0.5 mx-0.5 bg-white border border-sky-200 rounded font-mono">{t}</code>
                    ))}
                    . The tag will be blank in their email. Other recipients may have this data.
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Subject</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {previewLoading ? <Skeleton className="h-4 w-72" /> : preview?.subject || "—"}
                  </div>
                </div>
                <div className="bg-white p-2 max-h-[360px] overflow-y-auto">
                  {previewLoading ? (
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : preview ? (
                    <iframe
                      title="Email preview"
                      srcDoc={preview.html}
                      className="w-full h-[320px] border-0"
                      sandbox=""
                    />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground text-center">No preview yet.</div>
                  )}
                </div>
              </div>

              {/* Recipient summary */}
              <div className="text-xs text-muted-foreground">
                Sending to <span className="font-semibold text-foreground">{selectedContactIds.size}</span> {selectedContactIds.size === 1 ? "person" : "people"}
                {" "}from <span className="font-semibold text-foreground">{senderName}</span> &lt;{senderEmail}@ent.meetdandy.com&gt;
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack} disabled={submitting} className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
            {step === 4 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={submitting}
              >
                Save as draft
              </Button>
            )}
            {step < 4 ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canAdvance() || submitting}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Next <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSendNow}
                disabled={!canAdvance() || submitting || previewLoading}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send now ({selectedContactIds.size})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
