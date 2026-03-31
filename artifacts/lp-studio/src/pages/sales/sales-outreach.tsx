import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import {
  Mail,
  Send,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Check,
  Loader2,
  TrendingUp,
  AlignLeft,
  Type,
  Monitor,
  Smartphone,
  Search,
  Inbox,
  MousePointerClick,
  Eye,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SalesLayout } from "@/components/layout/sales-layout";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import { EmailWYSIWYGEditor, type EmailEditorHandle } from "@/components/EmailWYSIWYGEditor";

const API_BASE = "/api";

// ─── Email chrome constants (mirrored from DSO) ─────────────

const DANDY_BANNER_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-email-banner.png";
const DANDY_LOGO_DARK_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-logo-dark.png";
const DANDY_LOGO_WHITE_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-logo-white.png";

const ICON_FB = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_facebook.png";
const ICON_IG = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_instagram.png";
const ICON_TW = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_twitter.png";
const ICON_LI = "https://go.meetdandy.com/rs/103-HKO-179/images/flex_em_dandy_linkedin.png";

const EMAIL_HEADER = `<div style="background:#ffffff;padding:24px 48px;"><img src="${DANDY_LOGO_DARK_URL}" alt="Dandy" style="height:32px;display:block;" /></div>`;
const EMAIL_DIVIDER = `<hr style="border:none;border-top:1px solid #e8e8e8;margin:0;" />`;
const EMAIL_FOOTER =
  `<div style="background:#1a3a2a;padding:40px 48px;font-family:Arial,Helvetica,sans-serif;">` +
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr>` +
  `<td style="text-align:left;"><a href="https://www.facebook.com/meetdandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_FB}" alt="Facebook" style="width:28px;height:28px;" /></a><a href="https://www.instagram.com/meet.dandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_IG}" alt="Instagram" style="width:28px;height:28px;" /></a><a href="https://x.com/meet_dandy" style="display:inline-block;margin-right:10px;"><img src="${ICON_TW}" alt="Twitter" style="width:28px;height:28px;" /></a><a href="https://www.linkedin.com/company/dandyofficial/" style="display:inline-block;"><img src="${ICON_LI}" alt="LinkedIn" style="width:28px;height:28px;" /></a></td>` +
  `<td style="text-align:right;"><a href="#" style="color:#9ca89e;font-size:13px;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">Forward to a Friend</a></td>` +
  `</tr></table>` +
  `<div style="text-align:center;">` +
  `<img src="${DANDY_LOGO_WHITE_URL}" alt="Dandy" style="height:36px;display:inline-block;margin-bottom:20px;" />` +
  `<p style="font-size:13px;line-height:20px;color:#9ca89e;margin:0 0 2px;">22 Cortlandt Street, 30th Floor</p>` +
  `<p style="font-size:13px;line-height:20px;color:#9ca89e;margin:0 0 20px;">New York, NY 10007</p>` +
  `<p style="font-size:12px;line-height:18px;color:#9ca89e;margin:0 0 4px;">This email was sent to {{email}}, if you no longer want to receive emails,</p>` +
  `<p style="font-size:12px;line-height:18px;color:#9ca89e;margin:0 0 20px;"><a href="{{unsubscribe_url}}" style="color:#9ca89e;text-decoration:underline;">unsubscribe here</a>.</p>` +
  `<p style="font-size:12px;color:#9ca89e;margin:0;">&copy; ${new Date().getFullYear()} Dandy, Inc. All Rights Reserved.</p>` +
  `</div></div>`;
const EMAIL_CTA = (text: string, href = "{{microsite_url}}") =>
  `<div style="text-align:center;padding:8px 0 32px;"><a href="${href}" style="display:inline-block;background:#1a3a2a;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;padding:16px 32px;border-radius:4px;text-decoration:none;width:200px;text-align:center;font-family:Arial,Helvetica,sans-serif;">${text}</a></div>`;
const EMAIL_SIGNATURE = `${EMAIL_DIVIDER}<div style="padding:24px 48px;"><p style="font-size:16px;font-weight:bold;color:#1a1a1a;margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;">{{sender_name}}</p><p style="font-size:14px;color:#555555;margin:0;font-family:Arial,Helvetica,sans-serif;">Dandy DSO Partnerships</p></div>`;
const EMAIL_WRAP = (inner: string, previewText?: string) => {
  const preheader = previewText
    ? `<div style="display:none;font-size:1px;color:#f4f4f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}${"&zwnj;&nbsp;".repeat(80)}</div>`
    : "";
  return `<div style="background:#f4f4f4;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">${preheader}<div style="max-width:600px;margin:0 auto;background:#ffffff;">${inner}</div></div>`;
};

function buildFullEmailHTML(
  bodyContent: string,
  options: { showBanner?: boolean; ctaText?: string; ctaUrl?: string; showSignature?: boolean; previewText?: string },
) {
  const parts: string[] = [EMAIL_HEADER];
  if (options.showBanner) {
    parts.push(`<div style="font-size:0;line-height:0;"><img src="${DANDY_BANNER_URL}" alt="Dandy" style="width:100%;display:block;" /></div>`);
  }
  parts.push(EMAIL_DIVIDER);
  parts.push(`<div style="padding:40px 48px;">${bodyContent}</div>`);
  if (options.ctaText) {
    parts.push(EMAIL_CTA(options.ctaText, options.ctaUrl || "{{microsite_url}}"));
  }
  if (options.showSignature) parts.push(EMAIL_SIGNATURE);
  parts.push(EMAIL_FOOTER);
  return EMAIL_WRAP(parts.join(""), options.previewText);
}

// ─── Merge var chips ────────────────────────────────────────

const MERGE_VARS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{microsite_url}}"];

function MergeVarChips({ bodyRef, body, setBody }: { bodyRef: React.RefObject<HTMLTextAreaElement | null>; body: string; setBody: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {MERGE_VARS.map(v => (
        <button
          key={v}
          type="button"
          onClick={() => {
            const el = bodyRef.current;
            if (!el) return;
            const start = el.selectionStart ?? body.length;
            const end = el.selectionEnd ?? start;
            const next = body.slice(0, start) + v + body.slice(end);
            setBody(next);
            requestAnimationFrame(() => { el.focus(); const pos = start + v.length; el.setSelectionRange(pos, pos); });
          }}
          className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono hover:bg-primary/20 transition-colors"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ─── Format toggle ──────────────────────────────────────────

function FormatToggle({ value, onChange }: { value: "plain" | "styled"; onChange: (v: "plain" | "styled") => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Format:</span>
      <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/30">
        <button
          type="button"
          onClick={() => onChange("plain")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${value === "plain" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <AlignLeft className="w-3.5 h-3.5" /> Plain Text
        </button>
        <button
          type="button"
          onClick={() => onChange("styled")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${value === "styled" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Type className="w-3.5 h-3.5" /> Styled Email
        </button>
      </div>
    </div>
  );
}

// ─── Email chrome options (styled mode) ─────────────────────

function EmailChrome({
  showBanner, setShowBanner,
  ctaText, setCtaText,
  ctaUrl, setCtaUrl,
  showSignature, setShowSignature,
}: {
  showBanner: boolean; setShowBanner: (v: boolean) => void;
  ctaText: string; setCtaText: (v: string) => void;
  ctaUrl: string; setCtaUrl: (v: string) => void;
  showSignature: boolean; setShowSignature: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Layout</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showBanner} onChange={e => setShowBanner(e.target.checked)} className="rounded border-border" />
          <span className="text-foreground">Hero Banner</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showSignature} onChange={e => setShowSignature(e.target.checked)} className="rounded border-border" />
          <span className="text-foreground">Signature Block</span>
        </label>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Button Text <span className="text-muted-foreground/60">(leave empty to hide)</span></label>
        <Input placeholder="e.g. VIEW YOUR MICROSITE" value={ctaText} onChange={e => setCtaText(e.target.value)} className="text-sm h-8" />
      </div>
      {ctaText.trim() && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Button URL</label>
          <Input placeholder="{{microsite_url}}" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} className="text-sm h-8 font-mono" />
        </div>
      )}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────

interface Template {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  format: string;
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

type TabId = "send" | "campaigns" | "sent" | "templates" | "performance";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "send", label: "Single Send", icon: <Send className="w-3.5 h-3.5" /> },
  { id: "campaigns", label: "Campaigns", icon: <Mail className="w-3.5 h-3.5" /> },
  { id: "sent", label: "Sent Emails", icon: <Inbox className="w-3.5 h-3.5" /> },
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
  const [bodyText, setBodyText] = useState("");
  const [purpose, setPurpose] = useState("intro outreach");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [emailFormat, setEmailFormat] = useState<"plain" | "styled">("plain");

  // Sender & delivery fields
  const [senderName, setSenderName] = useState("Dandy Partnerships");
  const [senderEmail, setSenderEmail] = useState("partnerships");
  const [replyTo, setReplyTo] = useState("sales@meetdandy.com");
  const [previewText, setPreviewText] = useState("");

  // Styled chrome options
  const [showBanner, setShowBanner] = useState(true);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("{{microsite_url}}");
  const [showSignature, setShowSignature] = useState(true);

  const editorRef = useRef<EmailEditorHandle>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previewTextRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []).then(setAccounts);
  }, []);

  useEffect(() => {
    if (!selectedAccountId) { setContacts([]); return; }
    fetch(`${API_BASE}/sales/accounts/${selectedAccountId}/contacts`)
      .then(r => r.ok ? r.json() : [])
      .then(setContacts);
  }, [selectedAccountId]);

  function handleFormatChange(fmt: "plain" | "styled") {
    setEmailFormat(fmt);
    setBodyHtml("");
    setBodyText("");
    editorRef.current?.setContent("");
  }

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
        if (emailFormat === "styled") {
          const html = data.bodyHtml ?? "";
          setBodyHtml(html);
          editorRef.current?.setContent(html);
        } else {
          setBodyText(data.bodyText ?? data.bodyHtml?.replace(/<[^>]+>/g, "") ?? "");
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  const getFinalHtml = useCallback(() => {
    if (emailFormat === "styled") {
      const html = editorRef.current?.getHTML() || bodyHtml;
      return buildFullEmailHTML(html, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature, previewText: previewText.trim() || undefined });
    }
    return bodyText;
  }, [emailFormat, bodyHtml, bodyText, showBanner, ctaText, ctaUrl, showSignature, previewText]);

  async function handleSend() {
    const body = emailFormat === "styled" ? getFinalHtml() : bodyText;
    if (!selectedContactId || !subject || !body) return;
    setSending(true);
    setSendError(null);
    try {
      const payload = {
        contactId: Number(selectedContactId),
        subject,
        senderName: senderName.trim() || "Dandy Partnerships",
        senderEmail: senderEmail.trim() || "partnerships",
        replyTo: replyTo.trim() || "sales@meetdandy.com",
        ...(emailFormat === "styled" ? { bodyHtml: body } : { bodyText: body }),
      };
      const res = await fetch(`${API_BASE}/sales/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSent(true);
        setSendError(null);
        setTimeout(() => setSent(false), 3000);
      } else {
        const errData = await res.json().catch(() => ({ error: "Failed to send email" }));
        setSendError((errData as { error?: string }).error ?? "Failed to send email");
      }
    } catch {
      setSendError("Network error — could not reach the server");
    } finally {
      setSending(false);
    }
  }

  const selectedContact = contacts.find(c => String(c.id) === selectedContactId);
  const hasBody = emailFormat === "styled" ? !!bodyHtml : !!bodyText;

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

      {/* Sender & Delivery */}
      <Card className="p-6 rounded-2xl border border-border/60">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sender & Delivery</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sender Name</label>
            <Input
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="Dandy Partnerships"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sender Email</label>
            <div className="flex items-center">
              <Input
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                placeholder="partnerships"
                className="text-sm rounded-r-none border-r-0"
              />
              <span className="flex items-center h-10 px-3 rounded-r-md border border-input bg-muted text-xs text-muted-foreground whitespace-nowrap">
                @meetdandy-lp.com
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Reply-To</label>
            <Input
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              placeholder="sales@meetdandy.com"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Preview Text
              <span className="text-muted-foreground/60 ml-1 font-normal">(inbox snippet)</span>
            </label>
            <Input
              ref={previewTextRef}
              value={previewText}
              onChange={e => setPreviewText(e.target.value)}
              placeholder="e.g. A quick look at how Dandy can help {{company}}…"
              className="text-sm"
            />
          </div>
        </div>
      </Card>

      {/* AI Email Composer */}
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
          {/* Format toggle */}
          <FormatToggle value={emailFormat} onChange={handleFormatChange} />

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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Body</label>
            {emailFormat === "styled" ? (
              <EmailWYSIWYGEditor
                ref={editorRef}
                initialContent={bodyHtml}
                onChange={setBodyHtml}
                dandyBannerUrl={DANDY_BANNER_URL}
              />
            ) : (
              <>
                <MergeVarChips bodyRef={bodyRef} body={bodyText} setBody={setBodyText} />
                <Textarea
                  ref={bodyRef}
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  placeholder={`Write your email body here…\n\nUse merge variables like {{first_name}} to personalize.`}
                  className="min-h-[220px] text-sm font-mono"
                />
              </>
            )}
          </div>

          {/* Email chrome (styled only) */}
          {emailFormat === "styled" && (
            <EmailChrome
              showBanner={showBanner} setShowBanner={setShowBanner}
              ctaText={ctaText} setCtaText={setCtaText}
              ctaUrl={ctaUrl} setCtaUrl={setCtaUrl}
              showSignature={showSignature} setShowSignature={setShowSignature}
            />
          )}
        </div>
      </Card>

      {/* Preview + Send */}
      {(subject || hasBody) && (
        <Card className="p-6 rounded-2xl border border-border/60">
          <h3 className="text-sm font-semibold text-foreground mb-4">Preview</h3>
          <div className="rounded-lg border border-border bg-white p-6 mb-4 overflow-auto max-h-[500px]">
            <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
              <p>From: {senderName || "Dandy Partnerships"} &lt;{senderEmail || "partnerships"}@meetdandy-lp.com&gt;</p>
              <p>Reply-To: {replyTo || "sales@meetdandy.com"}</p>
              <p>To: {selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName} <${selectedContact.email}>` : "—"}</p>
              {previewText && <p className="italic">Preview: {previewText}</p>}
            </div>
            <p className="text-sm font-semibold text-foreground mb-3">
              {subject
                .replace(/\{\{first_name\}\}/g, selectedContact?.firstName ?? "Sarah")
                .replace(/\{\{last_name\}\}/g, selectedContact?.lastName ?? "Johnson")}
            </p>
            {emailFormat === "styled" ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: buildFullEmailHTML(bodyHtml, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature, previewText: previewText.trim() || undefined })
                    .replace(/\{\{first_name\}\}/g, selectedContact?.firstName ?? "Sarah")
                    .replace(/\{\{last_name\}\}/g, selectedContact?.lastName ?? "Johnson")
                    .replace(/\{\{company\}\}/g, accounts.find(a => String(a.id) === selectedAccountId)?.name ?? "Acme Dental")
                    .replace(/\{\{microsite_url\}\}/g, "https://example.com/p/abc12345")
                    .replace(/\{\{sender_name\}\}/g, senderName || "Dandy Partnerships"),
                }}
              />
            ) : (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                {bodyText
                  .replace(/\{\{first_name\}\}/g, selectedContact?.firstName ?? "Sarah")
                  .replace(/\{\{last_name\}\}/g, selectedContact?.lastName ?? "Johnson")
                  .replace(/\{\{company\}\}/g, accounts.find(a => String(a.id) === selectedAccountId)?.name ?? "Acme Dental")
                  .replace(/\{\{microsite_url\}\}/g, "https://example.com/p/abc12345")
                  .replace(/\{\{sender_name\}\}/g, senderName || "Dandy Partnerships")}
              </pre>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSend}
              disabled={sending || !selectedContactId || !subject || !hasBody}
              className="gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : sent ? "Sent!" : "Send Email"}
            </Button>
            {sent && <span className="text-xs text-emerald-600 font-medium">Email sent successfully</span>}
            {sendError && (
              <span className="text-xs text-red-600 font-medium max-w-xs leading-snug">{sendError}</span>
            )}
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

  const campaignsPag = usePagination(campaigns, 25);

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
          {campaignsPag.pageItems.map(c => (
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
          <PaginationBar
            page={campaignsPag.page} totalPages={campaignsPag.totalPages}
            from={campaignsPag.from} to={campaignsPag.to} total={campaignsPag.total}
            onPage={campaignsPag.setPage} label="campaigns"
          />
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
  const [bodyText, setBodyText] = useState("");
  const [category, setCategory] = useState("general");
  const [emailFormat, setEmailFormat] = useState<"plain" | "styled">("plain");
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Styled chrome options
  const [showBanner, setShowBanner] = useState(true);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("{{microsite_url}}");
  const [showSignature, setShowSignature] = useState(true);

  const editorRef = useRef<EmailEditorHandle>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const styledPreviewHTML = useMemo(() => {
    if (emailFormat !== "styled") return "";
    return buildFullEmailHTML(bodyHtml, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature });
  }, [emailFormat, bodyHtml, showBanner, ctaText, ctaUrl, showSignature]);

  const getFullStyledHTML = useCallback(() => {
    const html = editorRef.current?.getHTML() || bodyHtml;
    return buildFullEmailHTML(html, { showBanner, ctaText: ctaText.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, showSignature });
  }, [bodyHtml, showBanner, ctaText, ctaUrl, showSignature]);

  const fetchTemplates = useCallback(() => {
    fetch(`${API_BASE}/sales/templates`)
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function resetForm() {
    setName(""); setTplSubject(""); setBodyHtml(""); setBodyText("");
    setCategory("general"); setEmailFormat("plain"); setEditId(null);
    setShowBanner(true); setCtaText(""); setCtaUrl("{{microsite_url}}"); setShowSignature(true);
    setTimeout(() => editorRef.current?.setContent(""), 0);
  }

  function handleFormatChange(fmt: "plain" | "styled") {
    setEmailFormat(fmt);
    setBodyHtml("");
    setBodyText("");
    editorRef.current?.setContent("");
  }

  function startEdit(t: Template) {
    const fmt = (t.format === "styled" ? "styled" : "plain") as "plain" | "styled";
    setName(t.name);
    setTplSubject(t.subject);
    setCategory(t.category);
    setEmailFormat(fmt);
    setEditId(t.id);
    setShowCreate(true);
    if (fmt === "styled") {
      setBodyHtml(t.bodyHtml);
      setTimeout(() => editorRef.current?.setContent(t.bodyHtml), 50);
    } else {
      setBodyText(t.bodyText || t.bodyHtml);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !tplSubject) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, subject: tplSubject, category, format: emailFormat };
      if (emailFormat === "styled") {
        payload.bodyHtml = getFullStyledHTML();
        payload.bodyText = null;
      } else {
        payload.bodyText = bodyText;
        payload.bodyHtml = "";
      }
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
    if (editId === id) { resetForm(); setShowCreate(false); }
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
        if (emailFormat === "styled" && data.bodyHtml) {
          setBodyHtml(data.bodyHtml);
          editorRef.current?.setContent(data.bodyHtml);
        } else if (data.bodyText) {
          setBodyText(data.bodyText);
        } else if (data.bodyHtml) {
          setBodyText(data.bodyHtml.replace(/<[^>]+>/g, ""));
        }
      }
    } finally {
      setAiGenerating(false);
    }
  }

  const hasBody = emailFormat === "styled" ? !!bodyHtml : !!bodyText;

  const templatesPag = usePagination(templates, 25);

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
        <div className={`grid gap-6 ${emailFormat === "styled" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Editor form */}
          <Card className="p-6 rounded-2xl border border-primary/30 bg-primary/5">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {editId ? "Edit Template" : "New Template"}
                </h3>
                <div className="flex items-center gap-2">
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
                  <Button type="button" size="sm" variant="ghost" onClick={() => { resetForm(); setShowCreate(false); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Format toggle */}
              <FormatToggle value={emailFormat} onChange={handleFormatChange} />

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
                <Input
                  value={tplSubject}
                  onChange={e => setTplSubject(e.target.value)}
                  placeholder="e.g. {{first_name}}, see how Dandy saves {{company}} time"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Body</label>
                {emailFormat === "styled" ? (
                  <EmailWYSIWYGEditor
                    key={editId ?? "new"}
                    ref={editorRef}
                    initialContent={bodyHtml}
                    onChange={setBodyHtml}
                    dandyBannerUrl={DANDY_BANNER_URL}
                  />
                ) : (
                  <>
                    <MergeVarChips bodyRef={bodyRef} body={bodyText} setBody={setBodyText} />
                    <Textarea
                      ref={bodyRef}
                      value={bodyText}
                      onChange={e => setBodyText(e.target.value)}
                      placeholder={`Write your email body here…\n\nUse merge variables like {{first_name}} to personalize.`}
                      className="min-h-[300px] text-sm font-mono"
                    />
                  </>
                )}
              </div>

              {/* Email chrome (styled only) */}
              {emailFormat === "styled" && (
                <EmailChrome
                  showBanner={showBanner} setShowBanner={setShowBanner}
                  ctaText={ctaText} setCtaText={setCtaText}
                  ctaUrl={ctaUrl} setCtaUrl={setCtaUrl}
                  showSignature={showSignature} setShowSignature={setShowSignature}
                />
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !name || !tplSubject} className="flex-1">
                  {saving ? "Saving…" : editId ? "Update Template" : "Save Template"}
                </Button>
                {editId && (
                  <Button type="button" variant="secondary" onClick={resetForm} className="gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> New
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* Live preview panel (styled only) */}
          {emailFormat === "styled" && (
            <Card className="p-6 rounded-2xl border border-border/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
                <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`p-1.5 rounded transition-colors ${previewMode === "desktop" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title="Desktop"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`p-1.5 rounded transition-colors ${previewMode === "mobile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title="Mobile"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-4 min-h-[400px] overflow-auto max-h-[700px]">
                <div className={`mx-auto transition-all duration-300 ${previewMode === "mobile" ? "max-w-[375px]" : "max-w-[600px]"}`}>
                  {hasBody ? (
                    <div className="bg-card rounded-lg overflow-hidden shadow-lg">
                      <div
                        dangerouslySetInnerHTML={{ __html: styledPreviewHTML }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <Mail className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">Start typing to see preview</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">Create reusable templates to send consistent emails</p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {templatesPag.pageItems.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-4 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{t.name}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                    {t.category}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.format === "styled" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "bg-muted text-muted-foreground"}`}>
                    {t.format === "styled" ? <><Type className="w-2.5 h-2.5" /> Styled</> : <><AlignLeft className="w-2.5 h-2.5" /> Plain</>}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { startEdit(t); setShowCreate(true); }} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <PaginationBar
            page={templatesPag.page} totalPages={templatesPag.totalPages}
            from={templatesPag.from} to={templatesPag.to} total={templatesPag.total}
            onPage={templatesPag.setPage} label="templates"
          />
        </div>
      )}
    </div>
  );
}

// ─── Sent Emails Tab ────────────────────────────────────────

interface EmailSend {
  id: number;
  campaignId: number | null;
  contactId: number;
  email: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  createdAt: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  accountId: number | null;
  accountName: string | null;
  campaignName: string | null;
}

type SendFilter = "all" | "campaign" | "individual";

function initials(first: string | null, last: string | null, email: string): string {
  if (first || last) {
    return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

function sendStatusConfig(send: EmailSend) {
  if (send.clickedAt) return { label: "Clicked", color: "bg-violet-100 text-violet-700", icon: <MousePointerClick className="w-3 h-3" /> };
  if (send.openedAt) return { label: "Opened", color: "bg-sky-100 text-sky-700", icon: <Eye className="w-3 h-3" /> };
  if (send.status === "failed" || send.bouncedAt) return { label: "Failed", color: "bg-red-100 text-red-700", icon: null };
  if (send.status === "sent" || send.sentAt) return { label: "Sent", color: "bg-emerald-100 text-emerald-700", icon: <Check className="w-3 h-3" /> };
  return { label: send.status, color: "bg-muted text-muted-foreground", icon: null };
}

function SentTab() {
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SendFilter>("all");

  useEffect(() => {
    fetch(`${API_BASE}/sales/sends?limit=300`)
      .then(r => r.ok ? r.json() : [])
      .then(setSends)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = sends;
    if (filter === "campaign") list = list.filter(s => s.campaignId !== null);
    if (filter === "individual") list = list.filter(s => s.campaignId === null);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.email.toLowerCase().includes(q) ||
        (s.contactFirstName ?? "").toLowerCase().includes(q) ||
        (s.contactLastName ?? "").toLowerCase().includes(q) ||
        (s.accountName ?? "").toLowerCase().includes(q) ||
        (s.campaignName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sends, filter, query]);

  const counts = useMemo(() => ({
    all: sends.length,
    campaign: sends.filter(s => s.campaignId !== null).length,
    individual: sends.filter(s => s.campaignId === null).length,
  }), [sends]);

  const FILTER_OPTIONS: { id: SendFilter; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "campaign", label: `Campaign (${counts.campaign})` },
    { id: "individual", label: `Individual (${counts.individual})` },
  ];

  const sendsPag = usePagination(filtered, 25);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, account…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === opt.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[60px] rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex items-center gap-4 p-6 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No sent emails{query ? " matching your search" : ""}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {query ? "Try a different search term" : "Emails will appear here after you send them"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sendsPag.pageItems.map(send => {
            const status = sendStatusConfig(send);
            const name = [send.contactFirstName, send.contactLastName].filter(Boolean).join(" ") || send.email;
            const avatar = initials(send.contactFirstName, send.contactLastName, send.email);
            const dateStr = send.sentAt ?? send.createdAt;

            return (
              <div
                key={send.id}
                className="flex items-center gap-4 px-4 py-3 bg-card border border-border/60 rounded-xl hover:border-primary/20 transition-colors"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {avatar}
                </div>

                {/* Contact + account */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                    {send.accountName && (
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <span className="text-xs text-muted-foreground truncate">{send.accountName}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{send.email}</div>
                </div>

                {/* Campaign or individual */}
                <div className="hidden sm:block w-40 flex-shrink-0">
                  {send.campaignName ? (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{send.campaignName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">Individual</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </span>
                </div>

                {/* Date */}
                <div className="hidden md:block flex-shrink-0 text-xs text-muted-foreground text-right w-28">
                  {dateStr ? format(new Date(dateStr), "MMM d, h:mm a") : "—"}
                </div>
              </div>
            );
          })}
          <PaginationBar
            page={sendsPag.page} totalPages={sendsPag.totalPages}
            from={sendsPag.from} to={sendsPag.to} total={sendsPag.total}
            onPage={sendsPag.setPage} label="sends"
          />
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
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Email Outreach</h1>
          <p className="text-sm text-muted-foreground mt-1">Send personalized emails and manage templates</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
        {activeTab === "sent" && <SentTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "performance" && <PerformanceTab />}
      </div>
    </SalesLayout>
  );
}
