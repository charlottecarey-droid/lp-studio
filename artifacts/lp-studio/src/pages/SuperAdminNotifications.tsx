import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Bell, Mail } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

type Channel = "email" | "in_app";

interface Template {
  key: string;
  name: string;
  description: string;
  category: string;
  channels: Channel[];
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
  inAppTitle: string;
  inAppBody: string;
  enabled: boolean;
}

interface Draft {
  enabled: boolean;
  channels: Channel[];
  emailSubject: string;
  emailIntro: string;
  emailCtaLabel: string;
  inAppTitle: string;
  inAppBody: string;
}

function toDraft(t: Template): Draft {
  return {
    enabled: t.enabled,
    channels: [...t.channels],
    emailSubject: t.emailSubject ?? "",
    emailIntro: t.emailIntro ?? "",
    emailCtaLabel: t.emailCtaLabel ?? "",
    inAppTitle: t.inAppTitle ?? "",
    inAppBody: t.inAppBody ?? "",
  };
}

function TemplateCard({
  tpl,
  onSaved,
}: {
  tpl: Template;
  onSaved: (templates: Template[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(tpl));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(toDraft(tpl));
  }, [tpl]);

  // welcome is in-app-only in code; only channels the code template declares
  // can be toggled (the server enforces this too).
  const hasEmail = tpl.channels.includes("email");
  const hasInApp = tpl.channels.includes("in_app");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const toggleChannel = (c: Channel, on: boolean) =>
    setDraft((d) => ({
      ...d,
      channels: on ? Array.from(new Set([...d.channels, c])) : d.channels.filter((x) => x !== c),
    }));

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const data = await apiFetch(`/api/admin/notification-templates/${tpl.key}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      onSaved(data.templates as Template[]);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, tpl.key, onSaved]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{tpl.name}</h3>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tpl.key}</code>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor={`enabled-${tpl.key}`} className="text-xs text-muted-foreground">
            {draft.enabled ? "Enabled" : "Off"}
          </Label>
          <Switch
            id={`enabled-${tpl.key}`}
            checked={draft.enabled}
            onCheckedChange={(v) => set("enabled", v)}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
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
          <Badge variant="secondary" className="text-[10px]">Email handled in code</Badge>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {hasInApp && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">In-app</p>
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Email</p>
            <div>
              <Label className="text-[11px]">Subject</Label>
              <Input
                value={draft.emailSubject}
                onChange={(e) => set("emailSubject", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px]">Intro paragraph</Label>
              <Textarea
                value={draft.emailIntro}
                onChange={(e) => set("emailIntro", e.target.value)}
                rows={3}
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-[11px]">CTA label</Label>
              <Input
                value={draft.emailCtaLabel}
                onChange={(e) => set("emailCtaLabel", e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Variables: <code>{"{{tenantName}}"}</code>, <code>{"{{daysRemaining}}"}</code>,{" "}
        <code>{"{{workspaceUrl}}"}</code>, <code>{"{{billingUrl}}"}</code>
      </p>

      <div className="mt-3 flex items-center gap-3 border-t pt-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Save
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

export default function SuperAdminNotifications() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/admin/notification-templates");
      setTemplates(data.templates as Template[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Notification templates</h2>
          <p className="text-xs text-muted-foreground">
            Edit copy, switch channels on/off, or disable a notification entirely. Changes go live within a minute.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      {!templates && loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      {templates && (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard key={t.key} tpl={t} onSaved={setTemplates} />
          ))}
        </div>
      )}
    </div>
  );
}
