import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/components/EmailTemplateEditor";

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
  onSaved,
}: {
  tpl: Template;
  variables: VariableDefinition[];
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
          <Switch checked={enabled} disabled={locked} onCheckedChange={setEnabled} />
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/api/admin/email-workflow-triggers", {
        method: "POST",
        body: JSON.stringify({
          key: key.trim().toLowerCase(),
          name: name.trim() || key.trim(),
          triggerType,
          eventKey: triggerType === "event" ? eventKey.trim() : null,
        }),
      });
      setKey("");
      setName("");
      setEventKey("");
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
      <div className="space-y-1.5">
        {triggers.map((t) => (
          <div key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{t.name}</span>{" "}
              <code className="text-xs text-muted-foreground">{t.key}</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {t.trigger_type}
                {t.event_key ? ` · ${t.event_key}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {t.is_system ? (
                <Badge variant="outline">System</Badge>
              ) : (
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
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-muted/20 p-3">
        <p className="mb-2 text-xs font-semibold">New trigger</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input className="h-8 font-mono" placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
          <Input className="h-8" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={triggerType}
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
        <Button type="button" size="sm" className="mt-2" disabled={busy || !key.trim()} onClick={() => void create()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add trigger
        </Button>
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
  | { kind: "empty" };

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
      setSweepMsg(`Sweep ran: claimed ${r.claimed ?? 0}, processed ${r.processed ?? 0}.`);
    } catch (e) {
      setSweepMsg(e instanceof Error ? e.message : "Sweep failed");
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
            {workflows.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setView({ kind: "workflow", id: w.id })}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                  view.kind === "workflow" && view.id === w.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-accent"
                }`}
              >
                <span className="truncate">{w.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {w.locked && <Badge variant="secondary" className="px-1 py-0 text-[9px]">lock</Badge>}
                  {!w.enabled && <span className="text-[9px] text-muted-foreground">off</span>}
                </span>
              </button>
            ))}
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
                  {items.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelected(t.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                        selected === t.key
                          ? "bg-primary/10 font-medium text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      {!t.enabled && (
                        <span className="shrink-0 text-[9px] text-muted-foreground">
                          off
                        </span>
                      )}
                    </button>
                  ))}
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
