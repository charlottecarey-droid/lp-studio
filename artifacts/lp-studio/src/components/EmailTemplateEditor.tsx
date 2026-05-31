import { useCallback, useRef, useState } from "react";
import { Eye, Send, Loader2, Code2, Type, Layers } from "lucide-react";
import type { VariableDefinition } from "@workspace/notification-variables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CampaignVarInserter, type VarInserterItem } from "@/components/CampaignVarInserter";
import {
  EmailWYSIWYGEditor,
  type EmailEditorHandle,
} from "@/components/EmailWYSIWYGEditor";

export type EmailBodyMode = "wysiwyg" | "html";

export interface EmailTemplateValue {
  subject: string;
  bodyHtml: string;
  bodyMode: EmailBodyMode;
  wrapInShell: boolean;
}

interface Props {
  value: EmailTemplateValue;
  onChange: (patch: Partial<EmailTemplateValue>) => void;
  variables: VariableDefinition[];
  /** Render the (unsaved) email to full HTML via the server's real pipeline. */
  renderPreview?: (value: EmailTemplateValue) => Promise<{ html: string; subject?: string }>;
  /** Send a test email to the signed-in superadmin. */
  onTestSend?: (value: EmailTemplateValue) => Promise<void>;
}

function toInserterItems(vars: VariableDefinition[]): VarInserterItem[] {
  return vars.map((v) => ({
    token: `{{${v.token}}}`,
    label: v.label,
    description: v.description,
  }));
}

export function EmailTemplateEditor({
  value,
  onChange,
  variables,
  renderPreview,
  onTestSend,
}: Props) {
  const wysiwygRef = useRef<EmailEditorHandle>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  const items = toInserterItems(variables);
  const mergeVars = variables.map((v) => ({ label: v.label, variable: v.token }));

  const insertIntoSubject = useCallback(
    (token: string) => {
      const el = subjectRef.current;
      if (!el) {
        onChange({ subject: value.subject + token });
        return;
      }
      const start = el.selectionStart ?? value.subject.length;
      const end = el.selectionEnd ?? value.subject.length;
      const next = value.subject.slice(0, start) + token + value.subject.slice(end);
      onChange({ subject: next });
    },
    [onChange, value.subject],
  );

  const insertIntoHtml = useCallback(
    (token: string) => onChange({ bodyHtml: value.bodyHtml + token }),
    [onChange, value.bodyHtml],
  );

  const handlePreview = useCallback(async () => {
    if (!renderPreview) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await renderPreview(value);
      setPreviewHtml(res.html);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [renderPreview, value]);

  const handleTestSend = useCallback(async () => {
    if (!onTestSend) return;
    setSending(true);
    setError(null);
    setSentOk(false);
    try {
      await onTestSend(value);
      setSentOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setSending(false);
    }
  }, [onTestSend, value]);

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-[11px]">Subject</Label>
          <CampaignVarInserter
            onInsert={insertIntoSubject}
            variables={items}
            title="Variables"
            footnote=""
          />
        </div>
        <Input
          ref={subjectRef}
          value={value.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          className="h-8 text-sm"
          placeholder="Email subject line"
        />
      </div>

      {/* Body mode + shell toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={value.bodyMode === "wysiwyg" ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => onChange({ bodyMode: "wysiwyg" })}
          >
            <Type className="h-3.5 w-3.5" /> Visual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value.bodyMode === "html" ? "default" : "ghost"}
            className="h-7 gap-1 text-xs"
            onClick={() => onChange({ bodyMode: "html" })}
          >
            <Code2 className="h-3.5 w-3.5" /> HTML
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Wrap in branded shell</span>
          <Switch
            checked={value.wrapInShell}
            onCheckedChange={(v) => onChange({ wrapInShell: v })}
          />
        </label>
      </div>

      {!value.wrapInShell && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
          Shell bypass is on — this body is sent as the entire email with no
          header, branding, or footer. Provide complete standalone HTML.
        </p>
      )}

      {/* Body editor */}
      <div>
        <Label className="mb-1 block text-[11px]">Email body</Label>
        {value.bodyMode === "wysiwyg" ? (
          <EmailWYSIWYGEditor
            key="wysiwyg"
            ref={wysiwygRef}
            initialContent={value.bodyHtml}
            onChange={(html) => onChange({ bodyHtml: html })}
            mergeVars={mergeVars}
            showCampaignTools={false}
          />
        ) : (
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Raw HTML
              </span>
              <CampaignVarInserter
                onInsert={insertIntoHtml}
                variables={items}
                title="Variables"
                footnote=""
              />
            </div>
            <textarea
              value={value.bodyHtml}
              onChange={(e) => onChange({ bodyHtml: e.target.value })}
              className="min-h-[320px] w-full resize-y bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
              spellCheck={false}
              placeholder="<p>Your email HTML…</p>"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {renderPreview && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handlePreview()}
            disabled={previewing}
          >
            {previewing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="mr-1 h-3.5 w-3.5" />
            )}
            Preview
          </Button>
        )}
        {onTestSend && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleTestSend()}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1 h-3.5 w-3.5" />
            )}
            Send test to me
          </Button>
        )}
        {sentOk && <span className="text-xs text-emerald-600">Test sent ✓</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {/* Preview */}
      {previewHtml !== null && (
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview (sample data)
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
            title="Email preview"
            sandbox=""
            srcDoc={previewHtml}
            className="h-[480px] w-full bg-white"
          />
        </div>
      )}
    </div>
  );
}
