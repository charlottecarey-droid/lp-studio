import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Eye,
  Layers,
  RotateCcw,
  Mail,
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

type BodyMode = "wysiwyg" | "html";

interface Template {
  key: string;
  name: string;
  description: string;
  category: string;
  emailSubject: string;
  bodyHtml: string;
  bodyMode: BodyMode;
  wrapInShell: boolean;
  previewData: Record<string, string>;
  enabled: boolean;
}

interface Draft {
  emailSubject: string;
  bodyHtml: string;
  bodyMode: BodyMode;
  wrapInShell: boolean;
}

function toDraft(t: Template): Draft {
  return {
    emailSubject: t.emailSubject ?? "",
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

  const emailValue: EmailTemplateValue = {
    subject: draft.emailSubject,
    bodyHtml: draft.bodyHtml,
    bodyMode: draft.bodyMode,
    wrapInShell: draft.wrapInShell,
  };

  const onEmailChange = (patch: Partial<EmailTemplateValue>) =>
    setDraft((d) => ({
      ...d,
      emailSubject: patch.subject ?? d.emailSubject,
      bodyHtml: patch.bodyHtml ?? d.bodyHtml,
      bodyMode: patch.bodyMode ?? d.bodyMode,
      wrapInShell: patch.wrapInShell ?? d.wrapInShell,
    }));

  const renderPreview = useCallback(
    async (v: EmailTemplateValue) => {
      const data = await apiFetch(
        `/api/tenant/notification-templates/${tpl.key}/preview`,
        {
          method: "POST",
          body: JSON.stringify({
            bodyHtml: v.bodyHtml,
            wrapInShell: v.wrapInShell,
            emailSubject: v.subject,
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
        `/api/tenant/notification-templates/${tpl.key}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            bodyHtml: v.bodyHtml,
            wrapInShell: v.wrapInShell,
            emailSubject: v.subject,
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
        `/api/tenant/notification-templates/${tpl.key}`,
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
      </div>

      <div className="rounded-lg border bg-card p-3">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Mail className="h-3 w-3" /> Email
        </p>
        <EmailTemplateEditor
          value={emailValue}
          onChange={onEmailChange}
          variables={variables}
          renderPreview={renderPreview}
          onTestSend={onTestSend}
        />
      </div>

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
      const data = await apiFetch("/api/tenant/email-shell");
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
      const data = await apiFetch("/api/tenant/email-shell", {
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
      const data = await apiFetch("/api/tenant/email-shell/preview", {
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
        <span className="text-[11px] font-medium">{label}</span>
        {usingDefault(k) ? (
          <Badge variant="secondary" className="text-[9px]">
            Using brand default
          </Badge>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => restoreField(k)}
          >
            <RotateCcw className="h-3 w-3" /> Restore brand default
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
          its brand default to keep the look derived from your brand settings; an
          edit overrides only that piece.
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
          "Raw frame with {{logoHtml}}, {{headerBg}}, {{headline}}, {{body}}, {{footerHtml}} slots. Restore to use the brand-derived default.",
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

export default function EmailPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [variables, setVariables] = useState<VariableDefinition[]>([]);
  const [selected, setSelected] = useState<string>(SHELL_KEY);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/tenant/notification-templates");
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Email templates</h2>
          <p className="text-xs text-muted-foreground">
            Author the emails your workspace sends (lead alerts, comments,
            reviews, form follow-ups) and the branded shell wrapping them.
            Changes go live within a minute.
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
    </div>
  );
}
