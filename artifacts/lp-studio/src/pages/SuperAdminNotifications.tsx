import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Bell,
  Mail,
  Eye,
  Layers,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  GitBranch,
  Clock,
  Zap,
  Play,
} from "lucide-react";
import type { VariableDefinition } from "@workspace/notification-variables";
import {
  EmailTemplateEditor,
  type EmailTemplateValue,
  type VerifiedSendingDomains,
} from "@/components/EmailTemplateEditor";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Base64-wrap a JSON request body so the email HTML it carries never appears as
 * raw markup in the request stream. The production edge WAF (Cloudflare managed
 * rules) otherwise 403s payloads containing patterns like a template token
 * inside an href (`<a href="{{unsubscribeUrl}}">`), which broke every shell /
 * template preview + test-send. The server unwraps `{ __encoded }` back into
 * req.body before any route runs (see api-server/src/app.ts).
 */
function encodeRequestBody(jsonStr: string): string {
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return JSON.stringify({ __encoded: btoa(binary) });
}

async function apiFetch(path: string, opts?: RequestInit) {
  const body = typeof opts?.body === "string" ? encodeRequestBody(opts.body) : opts?.body;
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    body,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Platform email sender health banner
//
// Every system email (signup confirmation, password reset, invites) is sent
// from one platform address. If the provider key is missing or that sending
// domain isn't verified, every send is rejected — silently. This banner surfaces
// that state so a broken sender is caught quickly instead of failing invisibly.
// ---------------------------------------------------------------------------

interface PlatformEmailHealth {
  apiKeyConfigured: boolean;
  senderAddress: string;
  senderDomain: string | null;
  domainStatus: string;
  healthy: boolean;
  checkedAt: number;
}

function SenderHealthBanner() {
  const [health, setHealth] = useState<PlatformEmailHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const d = (await apiFetch("/api/admin/platform-email-health")) as PlatformEmailHealth;
      setHealth(d);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !health) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking platform email sender…
      </div>
    );
  }

  // Endpoint itself errored — don't imply the sender is broken.
  if (failed || !health) return null;

  if (health.healthy) {
    return (
      <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Platform email sender healthy — sending from{" "}
          <code className="font-mono">{health.senderAddress}</code>.
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 underline underline-offset-2 opacity-70 hover:opacity-100"
        >
          Recheck
        </button>
      </div>
    );
  }

  const reason = !health.apiKeyConfigured
    ? "The email provider API key is missing."
    : health.domainStatus === "not_found"
      ? "The sending domain isn't registered in the email provider account."
      : health.domainStatus === "api_unavailable"
        ? "Couldn't reach the email provider to confirm the sending domain."
        : `The sending domain isn't verified (status: ${health.domainStatus}).`;

  // "api_unavailable" (with a key present) means "couldn't verify" rather than
  // "definitely broken" — warn softer (amber) than a hard failure (red).
  const soft = health.apiKeyConfigured && health.domainStatus === "api_unavailable";
  const cls = soft
    ? "border-amber-500/40 bg-amber-500/5 text-amber-700"
    : "border-destructive/40 bg-destructive/5 text-destructive";

  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${cls}`}>
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium">
            {soft
              ? "Couldn't confirm the platform email sender."
              : "Platform email sender is not healthy — system emails may not be delivered."}
          </span>{" "}
          {reason} Sending from{" "}
          <code className="font-mono">{health.senderAddress}</code>.
        </span>
      </span>
      <button
        type="button"
        onClick={() => void load()}
        className="shrink-0 underline underline-offset-2 opacity-80 hover:opacity-100"
      >
        Recheck
      </button>
    </div>
  );
}

type Channel = "email" | "in_app";
type BodyMode = "wysiwyg" | "html";

interface Template {
  key: string;
  name: string;
  description: string;
  category: string;
  channels: Channel[];
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
  fromEmail: string | null;
  replyTo: string | null;
  preheaderText: string | null;
  inAppTitle: string;
  inAppBody: string;
  bodyHtml: string;
  bodyMode: BodyMode;
  wrapInShell: boolean;
  previewData: Record<string, string>;
  enabled: boolean;
}

interface Draft {
  enabled: boolean;
  channels: Channel[];
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
  fromEmail: string;
  replyTo: string;
  preheaderText: string;
  inAppTitle: string;
  inAppBody: string;
  bodyHtml: string;
  bodyMode: BodyMode;
  wrapInShell: boolean;
}

function envelopeOverrides(t: {
  fromEmail: string | null;
  replyTo: string | null;
  preheaderText: string | null;
}): { short: string; label: string }[] {
  const out: { short: string; label: string }[] = [];
  if (t.fromEmail && t.fromEmail.trim())
    out.push({ short: "From", label: "Custom sender" });
  if (t.replyTo && t.replyTo.trim())
    out.push({ short: "Reply", label: "Custom reply-to" });
  if (t.preheaderText && t.preheaderText.trim())
    out.push({ short: "Preview", label: "Custom preview text" });
  return out;
}

function toDraft(t: Template): Draft {
  return {
    enabled: t.enabled,
    channels: [...t.channels],
    emailSubject: t.emailSubject ?? "",
    emailIntro: t.emailIntro ?? "",
    emailCtaLabel: t.emailCtaLabel ?? "",
    fromEmail: t.fromEmail ?? "",
    replyTo: t.replyTo ?? "",
    preheaderText: t.preheaderText ?? "",
    inAppTitle: t.inAppTitle ?? "",
    inAppBody: t.inAppBody ?? "",
    bodyHtml: t.bodyHtml ?? "",
    bodyMode: t.bodyMode ?? "wysiwyg",
    wrapInShell: t.wrapInShell ?? true,
  };
}

// ---------------------------------------------------------------------------
// Template detail
// ---------------------------------------------------------------------------

function TemplateDetail({
  tpl,
  variables,
  verifiedDomains,
  onSaved,
}: {
  tpl: Template;
  variables: VariableDefinition[];
  verifiedDomains?: VerifiedSendingDomains;
  onSaved: (templates: Template[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(tpl));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(toDraft(tpl));
    setSavedAt(null);
    setErr(null);
  }, [tpl]);

  const hasEmail = tpl.channels.includes("email");
  const hasInApp = tpl.channels.includes("in_app");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const toggleChannel = (c: Channel, on: boolean) =>
    setDraft((d) => ({
      ...d,
      channels: on
        ? Array.from(new Set([...d.channels, c]))
        : d.channels.filter((x) => x !== c),
    }));

  const emailValue: EmailTemplateValue = {
    subject: draft.emailSubject,
    bodyHtml: draft.bodyHtml,
    bodyMode: draft.bodyMode,
    wrapInShell: draft.wrapInShell,
    fromEmail: draft.fromEmail,
    replyTo: draft.replyTo,
    preheaderText: draft.preheaderText,
  };

  const onEmailChange = (patch: Partial<EmailTemplateValue>) =>
    setDraft((d) => ({
      ...d,
      emailSubject: patch.subject ?? d.emailSubject,
      bodyHtml: patch.bodyHtml ?? d.bodyHtml,
      bodyMode: patch.bodyMode ?? d.bodyMode,
      wrapInShell: patch.wrapInShell ?? d.wrapInShell,
      fromEmail: patch.fromEmail ?? d.fromEmail,
      replyTo: patch.replyTo ?? d.replyTo,
      preheaderText: patch.preheaderText ?? d.preheaderText,
    }));

  const renderPreview = useCallback(
    async (v: EmailTemplateValue) => {
      const data = await apiFetch(
        `/api/admin/notification-templates/${tpl.key}/preview`,
        {
          method: "POST",
          body: JSON.stringify({
            bodyHtml: v.bodyHtml,
            wrapInShell: v.wrapInShell,
            emailSubject: v.subject,
            preheaderText: v.preheaderText,
          }),
        },
      );
      return { html: data.html as string, subject: data.subject as string };
    },
    [tpl.key],
  );

  const onTestSend = useCallback(
    async (v: EmailTemplateValue, to: string) => {
      await apiFetch(
        `/api/admin/notification-templates/${tpl.key}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            bodyHtml: v.bodyHtml,
            wrapInShell: v.wrapInShell,
            emailSubject: v.subject,
            fromEmail: v.fromEmail,
            replyTo: v.replyTo,
            preheaderText: v.preheaderText,
            ...(to ? { to } : {}),
          }),
        },
      );
    },
    [tpl.key],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const data = await apiFetch(
        `/api/admin/notification-templates/${tpl.key}`,
        {
          method: "PATCH",
          body: JSON.stringify(draft),
        },
      );
      onSaved(data.templates as Template[]);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, tpl.key, onSaved]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{tpl.name}</h3>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {tpl.key}
            </code>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label className="text-xs text-muted-foreground">
            {draft.enabled ? "Enabled" : "Off"}
          </Label>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(v) => set("enabled", v)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <span className="text-xs font-medium text-muted-foreground">Channels:</span>
        {hasInApp && (
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={draft.channels.includes("in_app")}
              onCheckedChange={(v) => toggleChannel("in_app", v)}
            />
            <Bell className="h-3 w-3" /> In-app
          </label>
        )}
        {hasEmail ? (
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={draft.channels.includes("email")}
              onCheckedChange={(v) => toggleChannel("email", v)}
            />
            <Mail className="h-3 w-3" /> Email
          </label>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Email handled in code
          </Badge>
        )}
      </div>

      {hasInApp && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-xs font-semibold text-muted-foreground">In-app message</p>
          <div>
            <Label className="text-[11px]">Title</Label>
            <Input
              value={draft.inAppTitle}
              onChange={(e) => set("inAppTitle", e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px]">Body</Label>
            <Textarea
              value={draft.inAppBody}
              onChange={(e) => set("inAppBody", e.target.value)}
              rows={3}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      )}

      {hasEmail && (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">Email</p>
          <EmailTemplateEditor
            value={emailValue}
            onChange={onEmailChange}
            variables={variables}
            renderPreview={renderPreview}
            onTestSend={onTestSend}
            verifiedDomains={verifiedDomains}
          />
        </div>
      )}

      <div className="flex items-center gap-3 border-t pt-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save changes
        </Button>
        {savedAt && !err && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {err && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {err}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell editor
// ---------------------------------------------------------------------------

interface ShellFields {
  shellHtml: string | null;
  logoHtml: string | null;
  headerBg: string | null;
  footerHtml: string | null;
  physicalAddress: string | null;
}

function ShellEditor() {
  const [overrides, setOverrides] = useState<ShellFields | null>(null);
  const [defaults, setDefaults] = useState<ShellFields | null>(null);
  const [draft, setDraft] = useState<ShellFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/email-shell");
      setOverrides(data.overrides as ShellFields);
      setDefaults(data.defaults as ShellFields);
      setDraft({
        shellHtml: data.overrides.shellHtml ?? null,
        logoHtml: data.overrides.logoHtml ?? null,
        headerBg: data.overrides.headerBg ?? null,
        footerHtml: data.overrides.footerHtml ?? null,
        physicalAddress: data.overrides.physicalAddress ?? null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load shell");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const field = (k: keyof ShellFields): string =>
    draft?.[k] ?? overrides?.[k] ?? defaults?.[k] ?? "";

  const usingDefault = (k: keyof ShellFields): boolean =>
    (draft?.[k] ?? null) === null;

  const setField = (k: keyof ShellFields, v: string) =>
    setDraft((d) => ({ ...(d as ShellFields), [k]: v }));

  const restoreField = (k: keyof ShellFields) =>
    setDraft((d) => ({ ...(d as ShellFields), [k]: null }));

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/email-shell", {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setOverrides(data.overrides as ShellFields);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const preview = useCallback(async () => {
    if (!draft) return;
    setPreviewing(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/email-shell/preview", {
        method: "POST",
        body: JSON.stringify({
          shellHtml: draft.shellHtml ?? undefined,
          logoHtml: draft.logoHtml ?? undefined,
          headerBg: draft.headerBg ?? undefined,
          footerHtml: draft.footerHtml ?? undefined,
          physicalAddress: draft.physicalAddress ?? undefined,
        }),
      });
      setPreviewHtml(data.html as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [draft]);

  if (loading && !draft) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const renderField = (
    k: keyof ShellFields,
    label: string,
    hint: string,
    rows: number,
  ) => (
    <div key={k}>
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-[11px]">{label}</Label>
        {usingDefault(k) ? (
          <Badge variant="secondary" className="text-[9px]">
            Using default
          </Badge>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => restoreField(k)}
          >
            <RotateCcw className="h-3 w-3" /> Restore default
          </button>
        )}
      </div>
      <Textarea
        value={field(k)}
        onChange={(e) => setField(k, e.target.value)}
        rows={rows}
        className="font-mono text-xs"
        spellCheck={false}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          <h3 className="text-base font-semibold">Branded email shell</h3>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The wrapper every shell-wrapped email renders into. Leave a field on
          "default" to keep the code default; an edit overrides only that piece.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3">
        {renderField(
          "headerBg",
          "Header background",
          "CSS color / gradient for the header band (e.g. #0f172a).",
          1,
        )}
        {renderField(
          "logoHtml",
          "Logo HTML",
          "HTML injected into the header logo slot ({{logoHtml}}).",
          3,
        )}
        {renderField(
          "footerHtml",
          "Footer HTML",
          "HTML injected into the footer slot ({{footerHtml}}).",
          4,
        )}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-[11px]">Mailing address</Label>
          </div>
          <Textarea
            value={draft?.physicalAddress ?? overrides?.physicalAddress ?? ""}
            onChange={(e) => setField("physicalAddress", e.target.value)}
            rows={2}
            className="font-mono text-xs"
            spellCheck={false}
            placeholder="123 Main St, Suite 100, San Francisco, CA 94105"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Postal address shown in platform email footers ({"{{physicalAddress}}"}) —
            auth, welcome, invite and superadmin emails. Leave blank to omit the line.
          </p>
        </div>
        {renderField(
          "shellHtml",
          "Full shell HTML (advanced)",
          "Raw frame with {{logoHtml}}, {{headerBg}}, {{headline}}, {{body}}, {{footerHtml}} slots. Restore to use the code default.",
          8,
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save shell
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void preview()}
          disabled={previewing}
        >
          {previewing ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="mr-1 h-3.5 w-3.5" />
          )}
          Preview
        </Button>
        {savedAt && !err && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {err && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {err}
          </span>
        )}
      </div>

      {previewHtml !== null && (
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Shell preview (sample email)
            </span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setPreviewHtml(null)}
            >
              Close
            </button>
          </div>
          <iframe
            title="Shell preview"
            sandbox=""
            srcDoc={previewHtml}
            className="h-[480px] w-full bg-white"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const SHELL_KEY = "__shell__";

// ---------------------------------------------------------------------------
// Workflow composer (Task #589)
// ---------------------------------------------------------------------------

type TriggerType = "event" | "scheduled" | "audience";

type AudienceRole = "everyone" | "superadmin" | "admin" | "member";
type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";
type Plan = "free" | "starter" | "growth" | "scale" | "enterprise";

const ROLE_LABELS: Record<AudienceRole, string> = {
  everyone: "Everyone",
  superadmin: "Superadmin",
  admin: "Workspace admins",
  member: "Workspace members",
};

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

/** The full audience filter the composer builds + previews. */
interface AudienceFilterState {
  role: AudienceRole;
  plan: Plan | "";
  tenantId: number | "";
  roleNames: string[];
}

interface AudienceOptions {
  plans: Plan[];
  tenants: { id: number; name: string; slug: string }[];
  roleNames: string[];
}

/** Build the wire config (omitting empty narrowing dimensions). */
function audienceFilterToConfig(f: AudienceFilterState): Record<string, unknown> {
  const cfg: Record<string, unknown> = { role: f.role };
  if (f.plan) cfg.plan = f.plan;
  if (f.tenantId !== "") cfg.tenantId = f.tenantId;
  if (f.roleNames.length > 0) cfg.role_names = f.roleNames;
  return cfg;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The browser's current IANA zone, used as the sensible default for new
// schedules so an admin's "9:00 daily" lands at 9:00 their local time.
const DEFAULT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

// Curated common zones plus the browser default. Stored as IANA names; the
// schedule math on the server resolves the wall-clock time (incl. DST) in this
// zone. "UTC" stays available for the prior behaviour.
const TIMEZONE_OPTIONS: string[] = Array.from(
  new Set([
    DEFAULT_TIMEZONE,
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
  ]),
);

interface Trigger {
  key: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
  event_key: string | null;
  config: Record<string, unknown>;
  is_system: boolean;
  enabled: boolean;
}

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/**
 * Human-readable one-line summary of a scheduled trigger's stored config, e.g.
 * "Daily · 09:00 · America/New_York" or "Weekly · Mon 09:00 · UTC". Returns
 * null if the config isn't a recognisable schedule (missing frequency/time), so
 * the caller falls back to just the trigger type.
 */
function scheduleSummary(config: Record<string, unknown> | null | undefined): string | null {
  if (!config || typeof config !== "object") return null;
  const frequency = config.frequency as ScheduleFrequency | undefined;
  const time = typeof config.time === "string" ? config.time : "";
  if (!frequency || !FREQUENCY_LABELS[frequency] || !time) return null;
  const timezone = typeof config.timezone === "string" && config.timezone ? config.timezone : "UTC";

  let when: string;
  if (frequency === "weekly") {
    const dow = Number(config.dayOfWeek);
    const day = Number.isInteger(dow) && dow >= 0 && dow <= 6 ? WEEKDAY_LABELS[dow] : "";
    when = day ? `${day} ${time}` : time;
  } else if (frequency === "monthly") {
    const dom = Number(config.dayOfMonth);
    const day = Number.isInteger(dom) && dom >= 1 && dom <= 31 ? `Day ${dom}` : "";
    when = day ? `${day} ${time}` : time;
  } else if (frequency === "once") {
    const date = typeof config.date === "string" && config.date ? config.date : "";
    when = date ? `${date} ${time}` : time;
  } else {
    when = time;
  }

  return `${FREQUENCY_LABELS[frequency]} · ${when} · ${timezone}`;
}

type ConditionType = "plan" | "read" | "not_read";

interface WfCondition {
  type: ConditionType;
  plan?: string;
  stepId?: string;
}

interface WfBranch {
  onTrue: string | null;
  onFalse: string | null;
}

interface WfStep {
  id: string;
  templateKey: string;
  channels: Channel[] | null;
  delayMs: number;
  condition: WfCondition | null;
  branch: WfBranch | null;
  next: string | null;
}

interface ComposerWorkflow {
  id: number;
  key: string;
  name: string;
  description: string;
  trigger_key: string;
  enabled: boolean;
  definition: { steps: WfStep[] };
  is_system: boolean;
  locked: boolean;
}

const MS_PER_MIN = 60_000;

function blankStep(existing: WfStep[]): WfStep {
  const ids = new Set(existing.map((s) => s.id));
  let n = existing.length + 1;
  let id = `s${n}`;
  while (ids.has(id)) {
    n += 1;
    id = `s${n}`;
  }
  return { id, templateKey: "", channels: null, delayMs: 0, condition: null, branch: null, next: null };
}

/** One step card in the workflow editor. */
function StepCard({
  step,
  index,
  steps,
  templates,
  disabled,
  onChange,
  onRemove,
}: {
  step: WfStep;
  index: number;
  steps: WfStep[];
  templates: Template[];
  disabled: boolean;
  onChange: (next: WfStep) => void;
  onRemove: () => void;
}) {
  const isBranch = step.templateKey === "";
  const earlierSends = steps.slice(0, index).filter((s) => s.templateKey !== "");
  const otherIds = steps.filter((s) => s.id !== step.id).map((s) => s.id);

  const set = (patch: Partial<WfStep>) => onChange({ ...step, ...patch });

  return (
    <div className="rounded-md border bg-muted/20 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          {isBranch ? <GitBranch className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
          Step {index + 1} · <code className="text-xs text-muted-foreground">{step.id}</code>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-destructive"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Step type</Label>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={isBranch ? "branch" : "send"}
            disabled={disabled}
            onChange={(e) =>
              e.target.value === "branch"
                ? set({
                    templateKey: "",
                    condition: step.condition ?? { type: "read", stepId: earlierSends[0]?.id ?? "" },
                    branch: step.branch ?? { onTrue: null, onFalse: null },
                  })
                : set({ templateKey: templates[0]?.key ?? "" })
            }
          >
            <option value="send">Send a template</option>
            <option value="branch">Branch (no send)</option>
          </select>
        </div>

        {!isBranch && (
          <div>
            <Label className="text-xs">Template</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={step.templateKey}
              disabled={disabled}
              onChange={(e) => set({ templateKey: e.target.value })}
            >
              <option value="">— pick a template —</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Delay before this step (minutes)
          </Label>
          <Input
            type="number"
            min={0}
            className="mt-1 h-8"
            value={Math.round(step.delayMs / MS_PER_MIN)}
            disabled={disabled}
            onChange={(e) => set({ delayMs: Math.max(0, Number(e.target.value) || 0) * MS_PER_MIN })}
          />
        </div>

        <div>
          <Label className="text-xs">Condition</Label>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={step.condition?.type ?? "none"}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "none") {
                set({ condition: null, branch: isBranch ? step.branch : null });
              } else if (v === "plan") {
                set({ condition: { type: "plan", plan: step.condition?.plan ?? "growth" } });
              } else {
                set({
                  condition: { type: v as ConditionType, stepId: step.condition?.stepId ?? earlierSends[0]?.id ?? "" },
                });
              }
            }}
          >
            <option value="none">No condition</option>
            <option value="plan">Recipient is on plan…</option>
            <option value="read">Earlier step WAS read</option>
            <option value="not_read">Earlier step was NOT read</option>
          </select>
        </div>

        {step.condition?.type === "plan" && (
          <div>
            <Label className="text-xs">Plan</Label>
            <Input
              className="mt-1 h-8"
              placeholder="e.g. growth, free, scale"
              value={step.condition.plan ?? ""}
              disabled={disabled}
              onChange={(e) => set({ condition: { type: "plan", plan: e.target.value } })}
            />
          </div>
        )}

        {(step.condition?.type === "read" || step.condition?.type === "not_read") && (
          <div>
            <Label className="text-xs">Which earlier step</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={step.condition.stepId ?? ""}
              disabled={disabled}
              onChange={(e) =>
                set({ condition: { type: step.condition!.type, stepId: e.target.value } })
              }
            >
              <option value="">— pick a step —</option>
              {earlierSends.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({templates.find((t) => t.key === s.templateKey)?.name ?? s.templateKey})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Routing */}
      {step.condition ? (
        <div className="mt-3 rounded-md border border-dashed p-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Routing on condition result</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-emerald-600">When TRUE →</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={step.branch?.onTrue ?? "__end__"}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    branch: {
                      onTrue: e.target.value === "__end__" ? null : e.target.value,
                      onFalse: step.branch?.onFalse ?? null,
                    },
                  })
                }
              >
                <option value="__end__">End workflow</option>
                {otherIds.map((id) => (
                  <option key={id} value={id}>
                    Go to {id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-rose-600">When FALSE →</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={step.branch?.onFalse ?? "__end__"}
                disabled={disabled}
                onChange={(e) =>
                  set({
                    branch: {
                      onTrue: step.branch?.onTrue ?? null,
                      onFalse: e.target.value === "__end__" ? null : e.target.value,
                    },
                  })
                }
              >
                <option value="__end__">End workflow</option>
                {otherIds.map((id) => (
                  <option key={id} value={id}>
                    Go to {id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!isBranch && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              This step sends only when the condition is TRUE, then routes as above.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <Label className="text-xs">Next step</Label>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm sm:w-1/2"
            value={step.next ?? "__seq__"}
            disabled={disabled}
            onChange={(e) => set({ next: e.target.value === "__seq__" ? null : e.target.value })}
          >
            <option value="__seq__">Continue in order</option>
            {otherIds.map((id) => (
              <option key={id} value={id}>
                Jump to {id}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Editor for a single (new or existing) workflow. */
function WorkflowEditor({
  workflow,
  triggers,
  templates,
  onSaved,
  onDeleted,
  onCancel,
}: {
  workflow: ComposerWorkflow | null;
  triggers: Trigger[];
  templates: Template[];
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const isNew = workflow === null;
  const locked = workflow?.locked ?? false;
  const [name, setName] = useState(workflow?.name ?? "");
  const [key, setKey] = useState(workflow?.key ?? "");
  const [triggerKey, setTriggerKey] = useState(workflow?.trigger_key ?? triggers[0]?.key ?? "");
  const [enabled, setEnabled] = useState(workflow?.enabled ?? false);
  const [steps, setSteps] = useState<WfStep[]>(workflow?.definition.steps ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateStep = (i: number, next: WfStep) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? next : s)));
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const addStep = () => setSteps((prev) => [...prev, { ...blankStep(prev), templateKey: templates[0]?.key ?? "" }]);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        name: name.trim(),
        triggerKey,
        enabled,
        definition: { steps },
      };
      if (isNew) {
        await apiFetch("/api/admin/email-workflows", {
          method: "POST",
          body: JSON.stringify({ ...body, key: key.trim().toLowerCase() }),
        });
      } else {
        await apiFetch(`/api/admin/email-workflows/${workflow!.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!workflow || !window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/email-workflows/${workflow.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{isNew ? "New workflow" : workflow!.name}</h3>
        <div className="flex items-center gap-2">
          {locked && <Badge variant="secondary">Locked</Badge>}
          {!isNew && workflow!.is_system && <Badge variant="outline">System</Badge>}
        </div>
      </div>

      {locked && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This workflow is locked (auth-critical) and cannot be edited.
        </p>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Name</Label>
          <Input className="mt-1 h-8" value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Key</Label>
          <Input
            className="mt-1 h-8 font-mono"
            value={key}
            placeholder="welcome_series"
            disabled={!isNew}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Trigger</Label>
          <select
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={triggerKey}
            disabled={locked}
            onChange={(e) => setTriggerKey(e.target.value)}
          >
            {triggers.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} {t.event_key ? `(${t.event_key})` : `(${t.trigger_type})`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Switch checked={enabled} disabled={locked} onCheckedChange={setEnabled} showStateLabel={false} />
          <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-semibold">Steps ({steps.length})</Label>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={addStep}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add step
          </Button>
        </div>
        {steps.length === 0 ? (
          <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            No steps yet. Add a step to send a template.
          </p>
        ) : (
          <div className="space-y-3">
            {steps.map((s, i) => (
              <StepCard
                key={s.id}
                step={s}
                index={i}
                steps={steps}
                templates={templates}
                disabled={locked}
                onChange={(next) => updateStep(i, next)}
                onRemove={() => removeStep(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={saving || locked} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {!isNew && !workflow!.is_system && !locked && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={saving} onClick={() => void remove()}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}

const AUDIENCE_ROLES: AudienceRole[] = ["everyone", "superadmin", "admin", "member"];

/** Reconstruct the audience filter from a trigger's stored wire config so the
 * list can describe a saved trigger with the same wording as the composer. */
function configToAudienceFilter(config: Record<string, unknown> | null | undefined): AudienceFilterState {
  const c = config ?? {};
  const role = AUDIENCE_ROLES.includes(c.role as AudienceRole) ? (c.role as AudienceRole) : "member";
  const plan = typeof c.plan === "string" && c.plan in PLAN_LABELS ? (c.plan as Plan) : "";
  const tenantId = typeof c.tenantId === "number" ? c.tenantId : "";
  const roleNames = Array.isArray(c.role_names)
    ? (c.role_names as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  return { role, plan, tenantId, roleNames };
}

/** A short human description of the audience a filter targets. */
function describeAudience(filter: AudienceFilterState, options: AudienceOptions | null): string {
  const parts: string[] = [ROLE_LABELS[filter.role].toLowerCase()];
  if (filter.plan) parts.push(`on ${PLAN_LABELS[filter.plan]}`);
  if (filter.tenantId !== "") {
    const t = options?.tenants.find((x) => x.id === filter.tenantId);
    parts.push(`in ${t ? t.name : `workspace #${filter.tenantId}`}`);
  }
  if (filter.roleNames.length > 0) {
    parts.push(`with role ${filter.roleNames.join(" / ")}`);
  }
  return parts.join(" ");
}

/** Live recipient-count preview for a scheduled/audience filter (Task #626, #661). */
function AudiencePreview({
  filter,
  options,
  onCount,
}: {
  filter: AudienceFilterState;
  options: AudienceOptions | null;
  onCount?: (count: number, overCap: boolean) => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; count: number; sample: { email: string }[]; cap: number; overCap: boolean }
    | { status: "error" }
  >({ status: "loading" });

  const who = describeAudience(filter, options);
  const body = JSON.stringify(audienceFilterToConfig(filter));

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch("/api/admin/email-workflow-audience/preview", {
      method: "POST",
      body,
    })
      .then((data) => {
        if (cancelled) return;
        const count = data.count ?? 0;
        const overCap = Boolean(data.overCap);
        setState({ status: "ready", count, sample: data.sample ?? [], cap: data.cap ?? 0, overCap });
        onCount?.(count, overCap);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [body, onCount]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Counting {who}…
      </p>
    );
  }
  if (state.status === "error") {
    return <p className="text-xs text-destructive">Couldn’t load recipient count.</p>;
  }
  if (state.overCap) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          <span className="font-semibold">{state.count.toLocaleString()}</span> {who} exceed the{" "}
          {state.cap.toLocaleString()} per-run cap — this trigger won’t enroll anyone until the audience is back under the
          cap.
        </span>
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{state.count.toLocaleString()}</span> {who} will receive this
      {state.sample.length > 0 && (
        <span className="text-muted-foreground/80"> · e.g. {state.sample.map((s) => s.email).join(", ")}</span>
      )}
    </p>
  );
}

/** Triggers manager + blank-template creator (compact panels). */
function TriggersPanel({
  triggers,
  onChanged,
}: {
  triggers: Trigger[];
  onChanged: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("event");
  const [eventKey, setEventKey] = useState("");
  const [role, setRole] = useState<AudienceRole>("member");
  const [plan, setPlan] = useState<Plan | "">("");
  const [tenantId, setTenantId] = useState<number | "">("");
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [date, setDate] = useState("");
  // Non-null when editing an existing trigger in place; the form then PATCHes
  // that key instead of POSTing a new trigger.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Latest live recipient count from the preview, so the save confirmation can
  // repeat it back ("Saved — N members will receive this").
  const lastPreview = useRef<{ count: number; overCap: boolean }>({ count: 0, overCap: false });
  const handleCount = useCallback((count: number, overCap: boolean) => {
    lastPreview.current = { count, overCap };
  }, []);

  // Picker data (plans / workspaces / role names) for the audience composer.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/email-workflow-audience/options")
      .then((data) => {
        if (!cancelled) setOptions(data as AudienceOptions);
      })
      .catch(() => {
        /* options are optional — composer still works with role only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filter: AudienceFilterState = { role, plan, tenantId, roleNames };

  const buildConfig = (): Record<string, unknown> | undefined => {
    if (triggerType === "audience") return audienceFilterToConfig(filter);
    if (triggerType === "scheduled") {
      const cfg: Record<string, unknown> = { ...audienceFilterToConfig(filter), frequency, time, timezone };
      if (frequency === "weekly") cfg.dayOfWeek = dayOfWeek;
      if (frequency === "monthly") cfg.dayOfMonth = dayOfMonth;
      if (frequency === "once") cfg.date = date;
      return cfg;
    }
    return undefined;
  };

  const resetForm = () => {
    setEditingKey(null);
    setKey("");
    setName("");
    setTriggerType("event");
    setEventKey("");
    setRole("member");
    setFrequency("daily");
    setTime("09:00");
    setTimezone(DEFAULT_TIMEZONE);
    setDayOfWeek(1);
    setDayOfMonth(1);
    setDate("");
  };

  // Load an existing trigger's config into the form for in-place editing.
  const startEdit = (t: Trigger) => {
    setErr(null);
    setSaved(null);
    setEditingKey(t.key);
    setKey(t.key);
    setName(t.name);
    setTriggerType(t.trigger_type);
    setEventKey(t.event_key ?? "");
    const c = (t.config ?? {}) as Record<string, unknown>;
    if (typeof c.role === "string") setRole(c.role as AudienceRole);
    if (typeof c.frequency === "string") setFrequency(c.frequency as ScheduleFrequency);
    if (typeof c.time === "string") setTime(c.time);
    setTimezone(typeof c.timezone === "string" && c.timezone ? c.timezone : "UTC");
    if (typeof c.dayOfWeek === "number") setDayOfWeek(c.dayOfWeek);
    if (typeof c.dayOfMonth === "number") setDayOfMonth(c.dayOfMonth);
    setDate(typeof c.date === "string" ? c.date : "");
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      const config = buildConfig();
      if (editingKey) {
        await apiFetch(`/api/admin/email-workflow-triggers/${encodeURIComponent(editingKey)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim() || editingKey,
            eventKey: triggerType === "event" ? eventKey.trim() : null,
            ...(config ? { config } : {}),
          }),
        });
      } else {
        await apiFetch("/api/admin/email-workflow-triggers", {
          method: "POST",
          body: JSON.stringify({
            key: key.trim().toLowerCase(),
            name: name.trim() || key.trim(),
            triggerType,
            eventKey: triggerType === "event" ? eventKey.trim() : null,
            ...(config ? { config } : {}),
          }),
        });
      }
      // Repeat the live recipient count back as a save confirmation.
      if (triggerType !== "event") {
        const { count, overCap } = lastPreview.current;
        const who = `${count.toLocaleString()} ${describeAudience(filter, options)}`;
        setSaved(
          overCap
            ? `Trigger saved, but ${who} exceed the per-run cap — it won’t enroll anyone until the audience is back under the cap.`
            : `Trigger saved — ${who} will receive this each time it runs.`,
        );
      } else {
        setSaved("Trigger saved.");
      }
      resetForm();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save trigger");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (k: string) => {
    if (!window.confirm(`Delete trigger "${k}"?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/admin/email-workflow-triggers/${encodeURIComponent(k)}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete trigger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Triggers</h3>
      {err && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {saved}
        </div>
      )}
      <div className="space-y-1.5">
        {triggers.map((t) => {
          const summary = t.trigger_type === "scheduled" ? scheduleSummary(t.config) : null;
          const audience =
            t.trigger_type === "scheduled" || t.trigger_type === "audience"
              ? describeAudience(configToAudienceFilter(t.config), options)
              : null;
          return (
          <div key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{t.name}</span>{" "}
              <code className="text-xs text-muted-foreground">{t.key}</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {summary ?? t.trigger_type}
                {t.event_key ? ` · ${t.event_key}` : ""}
              </span>
              {audience && <p className="mt-0.5 text-xs text-muted-foreground">To {audience}</p>}
            </div>
            <div className="flex items-center gap-2">
              {t.is_system ? (
                <Badge variant="outline">System</Badge>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={busy}
                    onClick={() => startEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    disabled={busy}
                    onClick={() => void remove(t.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <div className="rounded-md border bg-muted/20 p-3">
        <p className="mb-2 text-xs font-semibold">
          {editingKey ? `Edit trigger “${editingKey}”` : "New trigger"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            className="h-8 font-mono"
            placeholder="key"
            value={key}
            disabled={!!editingKey}
            onChange={(e) => setKey(e.target.value)}
          />
          <Input className="h-8" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
            value={triggerType}
            disabled={!!editingKey}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
          >
            <option value="event">Event</option>
            <option value="scheduled">Scheduled</option>
            <option value="audience">Audience</option>
          </select>
          {triggerType === "event" && (
            <Input
              className="h-8 font-mono"
              placeholder="event key (e.g. user.signup)"
              value={eventKey}
              onChange={(e) => setEventKey(e.target.value)}
            />
          )}
        </div>

        {triggerType !== "event" && (
          <div className="mt-2 space-y-2 rounded-md border bg-background/60 p-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                <span className="text-muted-foreground">Audience</span>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AudienceRole)}
                >
                  <option value="everyone">{ROLE_LABELS.everyone}</option>
                  <option value="superadmin">{ROLE_LABELS.superadmin}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                  <option value="member">{ROLE_LABELS.member}</option>
                </select>
              </label>
              {triggerType === "scheduled" && (
                <label className="text-xs">
                  <span className="text-muted-foreground">Frequency</span>
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
              )}
            </div>

            {triggerType === "scheduled" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  <span className="text-muted-foreground">Time</span>
                  <Input
                    type="time"
                    className="mt-1 h-8"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </label>
                <label className="text-xs">
                  <span className="text-muted-foreground">Timezone</span>
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {frequency === "weekly" && (
                  <label className="text-xs">
                    <span className="text-muted-foreground">Day of week</span>
                    <select
                      className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    >
                      {WEEKDAY_LABELS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {frequency === "monthly" && (
                  <label className="text-xs">
                    <span className="text-muted-foreground">Day of month</span>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="mt-1 h-8"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    />
                  </label>
                )}
                {frequency === "once" && (
                  <label className="text-xs">
                    <span className="text-muted-foreground">Date</span>
                    <Input
                      type="date"
                      className="mt-1 h-8"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Optional narrowing: plan tier, workspace, and specific role names.
                Each is AND-composed on top of the base audience above. */}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                <span className="text-muted-foreground">Plan (optional)</span>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Plan | "")}
                >
                  <option value="">Any plan</option>
                  {(options?.plans ?? []).map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p] ?? p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Workspace (optional)</span>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={tenantId === "" ? "" : String(tenantId)}
                  onChange={(e) => setTenantId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Any workspace</option>
                  {(options?.tenants ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {(options?.roleNames.length ?? 0) > 0 && (
              <label className="text-xs">
                <span className="text-muted-foreground">Specific role names (optional)</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {options!.roleNames.map((rn) => {
                    const active = roleNames.includes(rn);
                    return (
                      <button
                        key={rn}
                        type="button"
                        onClick={() =>
                          setRoleNames((prev) =>
                            prev.includes(rn) ? prev.filter((x) => x !== rn) : [...prev, rn],
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted"
                        }`}
                      >
                        {rn}
                      </button>
                    );
                  })}
                </div>
              </label>
            )}

            <AudiencePreview filter={filter} options={options} onCount={handleCount} />
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" disabled={busy || !key.trim()} onClick={() => void save()}>
            {editingKey ? (
              <>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Save changes
              </>
            ) : (
              <>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add trigger
              </>
            )}
          </Button>
          {editingKey && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Compact blank-slate template creator. */
function NewTemplatePanel({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/notification-templates", {
        method: "POST",
        body: JSON.stringify({
          key: key.trim().toLowerCase(),
          name: name.trim() || key.trim(),
          emailSubject: emailSubject.trim(),
          channels: ["email"],
        }),
      });
      setKey("");
      setName("");
      setEmailSubject("");
      setDone(true);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">New blank template</h3>
      <p className="text-xs text-muted-foreground">
        Creates a blank-slate lifecycle template you can author on the Templates tab and chain into a workflow.
      </p>
      {err && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}
      {done && !err && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Template created. Find it on the Templates tab.
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Key</Label>
          <Input className="mt-1 h-8 font-mono" placeholder="reengage_30d" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Name</Label>
          <Input className="mt-1 h-8" placeholder="Re-engagement" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Email subject</Label>
          <Input className="mt-1 h-8" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
        </div>
      </div>
      <Button type="button" size="sm" disabled={busy || !key.trim()} onClick={() => void create()}>
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
        Create template
      </Button>
    </div>
  );
}

type ComposerView =
  | { kind: "workflow"; id: number | null }
  | { kind: "triggers" }
  | { kind: "new-template" }
  | { kind: "failures" }
  | { kind: "empty" };

type SendFailure = {
  id: number;
  workflow_id: number;
  step_id: string;
  channel: "email" | "in_app";
  template_key: string;
  recipient_email: string | null;
  recipient_name: string | null;
  error: string | null;
  attempt_count: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Failed sends queue (Task #625). The recipient-failure safety-net: workflow
 * steps that failed to deliver to a recipient BEFORE any send are recorded here
 * so an operator can see and retry them. Retry reuses the original dedupe key,
 * so a recipient who already received the message is never sent a duplicate (the
 * attempt resolves as a deduped no-op).
 */
function FailedSendsPanel() {
  const [failures, setFailures] = useState<SendFailure[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch(
        `/api/admin/workflow-send-failures?resolved=${showResolved ? "true" : "false"}`,
      );
      setFailures((data.failures as SendFailure[]) ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load send failures");
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (id: number) => {
    setBusyId(id);
    setMsg(null);
    try {
      const r = await apiFetch(`/api/admin/workflow-send-failures/${id}/retry`, {
        method: "POST",
      });
      const outcome = r.outcome as string;
      setMsg(
        outcome === "sent"
          ? "Retry delivered — the recipient has been sent the message."
          : outcome === "deduped"
            ? "Already delivered — cleared without sending a duplicate."
            : "Retry still failed — the failure stays in the queue.",
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Failed sends</h2>
          <p className="text-xs text-muted-foreground">
            Workflow messages that couldn&rsquo;t be delivered to a recipient. Retry reuses the
            original send key, so an already-delivered recipient is never sent a duplicate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={showResolved} onCheckedChange={setShowResolved} />
            Show resolved
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{msg}</div>
      )}
      {err && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      {failures.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          {showResolved ? "No resolved failures." : "No failed sends — every recipient is up to date."}
        </div>
      ) : (
        <div className="space-y-2">
          {failures.map((f) => (
            <div
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {f.channel === "email" ? "email" : "in-app"}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{f.template_key}</span>
                  <span className="truncate text-sm font-medium">
                    {f.recipient_email ?? f.recipient_name ?? "(no recipient)"}
                  </span>
                  {f.attempt_count > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {f.attempt_count} attempts
                    </span>
                  )}
                </div>
                {f.error && (
                  <p className="mt-0.5 truncate text-xs text-destructive" title={f.error}>
                    {f.error}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  workflow #{f.workflow_id} · step {f.step_id} ·{" "}
                  {new Date(f.created_at).toLocaleString()}
                  {f.resolved_at && ` · resolved ${new Date(f.resolved_at).toLocaleString()}`}
                </p>
              </div>
              {!f.resolved_at && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={busyId === f.id}
                  onClick={() => void retry(f.id)}
                >
                  {busyId === f.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowComposer() {
  const [workflows, setWorkflows] = useState<ComposerWorkflow[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<ComposerView>({ kind: "empty" });
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/email-workflows");
      setWorkflows((data.workflows as ComposerWorkflow[]) ?? []);
      setTriggers((data.triggers as Trigger[]) ?? []);
      setTemplates((data.templates as Template[]) ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSweep = async () => {
    setSweepMsg(null);
    try {
      const r = await apiFetch("/api/admin/email-workflows/sweep", { method: "POST" });
      setSweepMsg(
        `Tick ran: scheduled ${r.scheduled ?? 0}, audience ${r.audience ?? 0}, ` +
          `claimed ${r.sweep?.claimed ?? 0}, processed ${r.sweep?.processed ?? 0}.`,
      );
    } catch (e) {
      setSweepMsg(e instanceof Error ? e.message : "Sweep failed");
    }
  };

  const deleteWorkflowById = async (w: ComposerWorkflow) => {
    if (!window.confirm(`Delete workflow "${w.name}"? This cannot be undone.`)) return;
    setErr(null);
    try {
      await apiFetch(`/api/admin/email-workflows/${w.id}`, { method: "DELETE" });
      if (view.kind === "workflow" && view.id === w.id) setView({ kind: "empty" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete workflow");
    }
  };

  const selectedWorkflow =
    view.kind === "workflow" && view.id !== null
      ? workflows.find((w) => w.id === view.id) ?? null
      : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Workflows</h2>
          <p className="text-xs text-muted-foreground">
            Chain templates into multi-step journeys with delays, conditions, and branching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void runSweep()}>
            <Play className="mr-1 h-3.5 w-3.5" /> Run sweep
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {sweepMsg && (
        <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{sweepMsg}</div>
      )}
      {err && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <nav className="space-y-2">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start"
            onClick={() => setView({ kind: "workflow", id: null })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> New workflow
          </Button>
          <div className="space-y-1">
            {workflows.map((w) => {
              const selected = view.kind === "workflow" && view.id === w.id;
              const canDelete = !w.is_system && !w.locked;
              return (
                <div
                  key={w.id}
                  className={`group flex items-center gap-1 rounded-md ${
                    selected ? "bg-primary/10" : "hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setView({ kind: "workflow", id: w.id })}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                      selected ? "font-medium text-primary" : ""
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {w.locked && <Badge variant="secondary" className="px-1 py-0 text-[9px]">lock</Badge>}
                      {!w.enabled && <span className="text-[9px] text-muted-foreground">off</span>}
                    </span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      aria-label={`Delete workflow ${w.name}`}
                      title="Delete workflow"
                      onClick={() => void deleteWorkflowById(w)}
                      className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {workflows.length === 0 && !loading && (
              <p className="px-1 py-2 text-xs text-muted-foreground">No workflows yet.</p>
            )}
          </div>
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setView({ kind: "triggers" })}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                view.kind === "triggers" ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
              }`}
            >
              <Zap className="h-3.5 w-3.5" /> Triggers
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "new-template" })}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                view.kind === "new-template" ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
              }`}
            >
              <Mail className="h-3.5 w-3.5" /> New template
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "failures" })}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                view.kind === "failures" ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Failed sends
            </button>
          </div>
        </nav>

        <div className="min-w-0 rounded-lg border bg-background p-4">
          {view.kind === "workflow" ? (
            <WorkflowEditor
              key={view.id ?? "new"}
              workflow={selectedWorkflow}
              triggers={triggers}
              templates={templates}
              onSaved={() => {
                setView({ kind: "empty" });
                void load();
              }}
              onDeleted={() => {
                setView({ kind: "empty" });
                void load();
              }}
              onCancel={() => setView({ kind: "empty" })}
            />
          ) : view.kind === "triggers" ? (
            <TriggersPanel triggers={triggers} onChanged={() => void load()} />
          ) : view.kind === "new-template" ? (
            <NewTemplatePanel onCreated={() => void load()} />
          ) : view.kind === "failures" ? (
            <FailedSendsPanel />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Select a workflow, or create a new one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminNotifications() {
  const [tab, setTab] = useState<"templates" | "workflows">("templates");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
  const [verifiedDomains, setVerifiedDomains] = useState<VerifiedSendingDomains | undefined>();
  const [selected, setSelected] = useState<string>(SHELL_KEY);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/notification-templates");
      const list = data.templates as Template[];
      setTemplates(list);
      setVariables((data.variables as VariableDefinition[]) ?? []);
      setSelected((prev) =>
        prev === SHELL_KEY || list.some((t) => t.key === prev)
          ? prev
          : list[0]?.key ?? SHELL_KEY,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Verified sending domains for the from-address warning. Best-effort: a
  // failure just leaves the warning suppressed (the save guard still enforces).
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/sending-domains")
      .then((d) => {
        if (!cancelled) setVerifiedDomains(d as VerifiedSendingDomains);
      })
      .catch(() => {
        /* ignore — warning stays suppressed */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const t of templates ?? []) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return Array.from(map.entries());
  }, [templates]);

  const selectedTpl = templates?.find((t) => t.key === selected) ?? null;

  return (
    <div className="py-4">
      <SenderHealthBanner />
      <div className="mb-4 flex gap-1 border-b">
        {(["templates", "workflows"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm capitalize ${
              tab === t
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "workflows" ? (
        <WorkflowComposer />
      ) : (
        <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Email & notifications</h2>
          <p className="text-xs text-muted-foreground">
            Author lifecycle emails and the branded shell. Changes go live within
            a minute.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {err && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      {!templates && loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      {templates && (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <nav className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected(SHELL_KEY)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                selected === SHELL_KEY
                  ? "border-primary bg-primary/5 font-medium"
                  : "hover:bg-accent"
              }`}
            >
              <Layers className="h-4 w-4" /> Branded shell
            </button>

            {grouped.map(([category, items]) => (
              <div key={category}>
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </p>
                <div className="space-y-1">
                  {items.map((t) => {
                    const overrides = envelopeOverrides(t);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setSelected(t.key)}
                        className={`flex w-full flex-col items-start gap-1 rounded-md px-3 py-1.5 text-left text-sm ${
                          selected === t.key
                            ? "bg-primary/10 font-medium text-primary"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{t.name}</span>
                          {!t.enabled && (
                            <span className="shrink-0 text-[9px] text-muted-foreground">
                              off
                            </span>
                          )}
                        </div>
                        {overrides.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {overrides.map((o) => (
                              <span
                                key={o.short}
                                title={o.label}
                                className="rounded bg-muted px-1 py-0 text-[8px] font-medium uppercase tracking-wide text-muted-foreground"
                              >
                                {o.short}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Detail */}
          <div className="min-w-0 rounded-lg border bg-background p-4">
            {selected === SHELL_KEY ? (
              <ShellEditor />
            ) : selectedTpl ? (
              <TemplateDetail
                key={selectedTpl.key}
                tpl={selectedTpl}
                variables={variables}
                verifiedDomains={verifiedDomains}
                onSaved={setTemplates}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Select a template.
              </p>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
