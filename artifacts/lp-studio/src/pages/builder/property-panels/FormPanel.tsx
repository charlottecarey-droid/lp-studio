import { useState, useEffect } from "react";
import { BG_OPTIONS } from "@/lib/bg-styles";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, Link2, Link2Off, X } from "lucide-react";
import type { FormBlockProps, FormField, FormFieldType, FormStep } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const API_BASE = "/api";

interface NotificationConfig {
  emailRecipients: string[];
  webhookUrl: string | null;
  marketoConfig: {
    enabled?: boolean;
    fieldMappings: Record<string, string>;
  } | null;
  salesforceConfig: {
    enabled?: boolean;
    fieldMappings: Record<string, string>;
  } | null;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "hidden", label: "Hidden" },
];

function uid() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const LABEL_CLS = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

interface FieldEditorProps {
  field: FormField;
  onChange: (f: FormField) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function FieldEditor({ field, onChange, onDelete, onMoveUp, onMoveDown }: FieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [optionsText, setOptionsText] = useState(() => (field.options ?? []).join("\n"));
  const set = <K extends keyof FormField>(k: K, v: FormField[K]) => onChange({ ...field, [k]: v });

  useEffect(() => {
    if (field.type !== "select") setOptionsText((field.options ?? []).join("\n"));
  }, [field.type]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
          <button
            aria-label="Move field up"
            className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!onMoveUp}
            onClick={() => onMoveUp?.()}
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            aria-label="Move field down"
            className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!onMoveDown}
            onClick={() => onMoveDown?.()}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <span className="text-sm font-medium flex-1 truncate">{field.label || "Untitled field"}</span>
        <span className="text-xs text-muted-foreground capitalize">{field.type}</span>
        {field.required && <span className="text-xs text-red-500">*</span>}
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
      </div>
      {open && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          <div>
            <Label className={LABEL_CLS}>Label</Label>
            <Input value={field.label} onChange={e => set("label", e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className={LABEL_CLS}>Type</Label>
            <Select value={field.type} onValueChange={v => set("type", v as FormFieldType)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(ft => (
                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field.type === "hidden" ? (
            <>
              <div>
                <Label className={LABEL_CLS}>Value</Label>
                <Input value={field.defaultValue ?? ""} onChange={e => set("defaultValue", e.target.value)} className="text-sm font-mono" placeholder="Website" />
                <p className="text-[11px] text-muted-foreground mt-1">Static text or a template variable. Click a variable to insert it.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["{{utm_source}}", "{{utm_medium}}", "{{utm_campaign}}", "{{utm_content}}", "{{utm_term}}", "{{page_url}}", "{{page_title}}", "{{referrer}}"].map(v => (
                  <button key={v} type="button"
                    className="text-[11px] font-mono bg-muted hover:bg-muted/70 border border-border rounded px-2 py-0.5 transition-colors"
                    onClick={() => set("defaultValue", (field.defaultValue ?? "") + v)}>
                    {v}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {field.type !== "checkbox" && (
                <div>
                  <Label className={LABEL_CLS}>Placeholder</Label>
                  <Input value={field.placeholder ?? ""} onChange={e => set("placeholder", e.target.value)} className="text-sm" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className={LABEL_CLS + " !mb-0"}>Required</Label>
                <Switch checked={field.required} onCheckedChange={v => set("required", v)} />
              </div>
            </>
          )}
          {field.type === "select" && (
            <div>
              <Label className={LABEL_CLS}>Options (one per line)</Label>
              <Textarea
                value={optionsText}
                onChange={e => setOptionsText(e.target.value)}
                onBlur={() => set("options", optionsText.split("\n").filter(Boolean))}
                rows={4}
                className="text-sm"
                placeholder="Option A&#10;Option B&#10;Option C"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive w-full gap-1.5 mt-1"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Field
          </Button>
        </div>
      )}
    </div>
  );
}

interface StepEditorProps {
  step: FormStep;
  stepIndex: number;
  onChange: (s: FormStep) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function StepEditor({ step, stepIndex, onChange, onDelete, canDelete }: StepEditorProps) {
  const setField = (i: number, f: FormField) => {
    const fields = [...step.fields];
    fields[i] = f;
    onChange({ ...step, fields });
  };
  const removeField = (i: number) => {
    const fields = step.fields.filter((_, idx) => idx !== i);
    onChange({ ...step, fields });
  };
  const moveField = (i: number, dir: -1 | 1) => {
    const fields = [...step.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    onChange({ ...step, fields });
  };
  const addField = () => {
    onChange({
      ...step,
      fields: [...step.fields, { id: uid(), type: "text", label: "New Field", required: false }],
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-semibold text-muted-foreground">Step {stepIndex + 1}</span>
          <Input
            value={step.title}
            onChange={e => onChange({ ...step, title: e.target.value })}
            className="text-sm h-7 border-none bg-transparent shadow-none px-1 focus-visible:ring-0"
            placeholder="Step title"
          />
        </div>
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="p-3 space-y-2">
        {step.fields.map((field, i) => (
          <FieldEditor
            key={field.id}
            field={field}
            onChange={f => setField(i, f)}
            onDelete={() => removeField(i)}
            onMoveUp={i > 0 ? () => moveField(i, -1) : undefined}
            onMoveDown={i < step.fields.length - 1 ? () => moveField(i, 1) : undefined}
          />
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addField}>
          <Plus className="w-3.5 h-3.5" /> Add Field
        </Button>
      </div>
    </div>
  );
}

interface NotificationsTabProps {
  pageId: number;
}

function NotificationsTab({ pageId }: NotificationsTabProps) {
  const [config, setConfig] = useState<NotificationConfig>({
    emailRecipients: [],
    webhookUrl: null,
    marketoConfig: null,
    salesforceConfig: null,
  });
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMarketo, setShowMarketo] = useState(false);
  const [showSalesforce, setShowSalesforce] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/lp/pages/${pageId}/notifications`)
      .then(r => r.json())
      .then((data: NotificationConfig) => {
        setConfig(data);
        setShowMarketo(!!data.marketoConfig);
        setShowSalesforce(!!data.salesforceConfig);
      })
      .catch(() => {});
  }, [pageId]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/lp/pages/${pageId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || config.emailRecipients.includes(trimmed)) return;
    setConfig(c => ({ ...c, emailRecipients: [...c.emailRecipients, trimmed] }));
    setEmailInput("");
  };

  const removeEmail = (i: number) => {
    setConfig(c => ({ ...c, emailRecipients: c.emailRecipients.filter((_, idx) => idx !== i) }));
  };

  const setMarketoMappings = (m: Record<string, string>) => {
    setConfig(c => ({ ...c, marketoConfig: { ...(c.marketoConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m } }));
  };
  const setSalesforceMappings = (m: Record<string, string>) => {
    setConfig(c => ({ ...c, salesforceConfig: { ...(c.salesforceConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m } }));
  };
  const toggleMarketo = (on: boolean) => {
    setConfig(c => ({ ...c, marketoConfig: on ? { enabled: true, fieldMappings: c.marketoConfig?.fieldMappings ?? {} } : null }));
    if (on) setShowMarketo(true);
  };
  const toggleSalesforce = (on: boolean) => {
    setConfig(c => ({ ...c, salesforceConfig: on ? { enabled: true, fieldMappings: c.salesforceConfig?.fieldMappings ?? {} } : null }));
    if (on) setShowSalesforce(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className={LABEL_CLS}>Email Recipients</Label>
        <p className="text-xs text-muted-foreground mb-2">Get an email for each new submission.</p>
        <div className="flex gap-2">
          <Input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="email@example.com"
            className="text-sm"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
          />
          <Button size="sm" variant="outline" onClick={addEmail}>Add</Button>
        </div>
        {config.emailRecipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {config.emailRecipients.map((email, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-1 rounded-full">
                {email}
                <button onClick={() => removeEmail(i)} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className={LABEL_CLS}>Webhook URL</Label>
        <p className="text-xs text-muted-foreground mb-2">POST the lead payload to this URL on each submission.</p>
        <Input
          value={config.webhookUrl ?? ""}
          onChange={e => setConfig(c => ({ ...c, webhookUrl: e.target.value || null }))}
          placeholder="https://hooks.example.com/lead"
          className="text-sm"
        />
      </div>

      {/* Marketo */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
          <button className="flex items-center gap-2 text-sm font-medium flex-1 text-left hover:text-foreground transition-colors" onClick={() => setShowMarketo(s => !s)}>
            {showMarketo ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
            Marketo
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{config.marketoConfig ? "On" : "Off"}</span>
            <Switch checked={!!config.marketoConfig} onCheckedChange={toggleMarketo} />
          </div>
        </div>
        {showMarketo && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              Credentials are configured in <a href="/integrations" className="underline font-medium text-foreground">Settings → Integrations</a>.
            </p>
            <div>
              <Label className={LABEL_CLS}>Field Mappings (form field → Marketo field)</Label>
              <p className="text-xs text-muted-foreground mb-2">One per line: Label:marketoFieldName</p>
              <Textarea
                rows={4}
                className="text-sm font-mono"
                placeholder={"Full Name:firstName\nEmail Address:email\nPhone Number:phone"}
                value={Object.entries(config.marketoConfig?.fieldMappings ?? {}).map(([k, v]) => `${k}:${v}`).join("\n")}
                onChange={e => {
                  const mappings: Record<string, string> = {};
                  e.target.value.split("\n").forEach(line => {
                    const [k, ...rest] = line.split(":");
                    if (k && rest.length) mappings[k.trim()] = rest.join(":").trim();
                  });
                  setMarketoMappings(mappings);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Salesforce */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
          <button className="flex items-center gap-2 text-sm font-medium flex-1 text-left hover:text-foreground transition-colors" onClick={() => setShowSalesforce(s => !s)}>
            {showSalesforce ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
            Salesforce
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{config.salesforceConfig ? "On" : "Off"}</span>
            <Switch checked={!!config.salesforceConfig} onCheckedChange={toggleSalesforce} />
          </div>
        </div>
        {showSalesforce && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              Credentials are configured in <a href="/integrations" className="underline font-medium text-foreground">Settings → Integrations</a>.
            </p>
            <div>
              <Label className={LABEL_CLS}>Field Mappings (form field → Salesforce field)</Label>
              <p className="text-xs text-muted-foreground mb-2">One per line: Label:SalesforceField</p>
              <Textarea
                rows={4}
                className="text-sm font-mono"
                placeholder={"Full Name:LastName\nEmail Address:Email\nPhone Number:Phone"}
                value={Object.entries(config.salesforceConfig?.fieldMappings ?? {}).map(([k, v]) => `${k}:${v}`).join("\n")}
                onChange={e => {
                  const mappings: Record<string, string> = {};
                  e.target.value.split("\n").forEach(line => {
                    const [k, ...rest] = line.split(":");
                    if (k && rest.length) mappings[k.trim()] = rest.join(":").trim();
                  });
                  setSalesforceMappings(mappings);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved!" : "Save Notification Settings"}
      </Button>
    </div>
  );
}

interface GlobalFormSummary {
  id: number;
  name: string;
}

interface Props {
  props: FormBlockProps;
  onChange: (props: FormBlockProps) => void;
  pageId?: number;
}

export function FormPanel({ props, onChange, pageId }: Props) {
  const set = <K extends keyof FormBlockProps>(k: K, v: FormBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/lp/forms`).then(r => r.json()).then((data: GlobalFormSummary[]) => setGlobalForms(data)).catch(() => {});
  }, []);

  const linkedForm = globalForms.find(f => f.id === props.formId);

  const setStep = (i: number, step: FormStep) => {
    const steps = [...props.steps];
    steps[i] = step;
    onChange({ ...props, steps });
  };

  const addStep = () => {
    onChange({
      ...props,
      steps: [...props.steps, { title: `Step ${props.steps.length + 1}`, fields: [{ id: uid(), type: "text", label: "New Field", required: false }] }],
    });
  };

  const removeStep = (i: number) => {
    onChange({ ...props, steps: props.steps.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className={LABEL_CLS}>Global Form</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Link to a globally-managed form. Fields, steps, and integrations are defined in the Forms library.
        </p>
        <div className="flex gap-2">
          <Select
            value={props.formId != null ? String(props.formId) : "__local__"}
            onValueChange={v => set("formId", v === "__local__" ? undefined : parseInt(v, 10))}
          >
            <SelectTrigger className="text-sm flex-1">
              <SelectValue placeholder="Use local fields" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__local__">
                <span className="flex items-center gap-1.5"><Link2Off className="w-3.5 h-3.5" />Use local fields</span>
              </SelectItem>
              {globalForms.map(f => (
                <SelectItem key={f.id} value={String(f.id)}>
                  <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a href="/forms" target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button size="sm" variant="outline" type="button">Manage</Button>
          </a>
        </div>
        {linkedForm && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Linked to "{linkedForm.name}" — fields and notifications managed globally.
          </p>
        )}
      </div>

      <Tabs defaultValue="fields">
      <TabsList className="w-full mb-4">
        <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
        <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
        <TabsTrigger value="notifications" className="flex-1 text-xs">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="fields" className="space-y-4 mt-0">
        <div>
          <Label className={LABEL_CLS}>Headline</Label>
          <Input value={props.headline} onChange={e => set("headline", e.target.value)} className="text-sm" />
        </div>
        <div>
          <Label className={LABEL_CLS}>Subheadline</Label>
          <Input value={props.subheadline} onChange={e => set("subheadline", e.target.value)} className="text-sm" />
        </div>

        {linkedForm ? (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Fields, steps, and settings are managed in the{" "}
            <a href="/forms" target="_blank" className="underline font-medium text-foreground">Forms library</a>{" "}
            under "{linkedForm.name}".
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className={LABEL_CLS + " !mb-0"}>Multi-step Form</Label>
                <p className="text-xs text-muted-foreground">Split fields across multiple steps</p>
              </div>
              <Switch checked={props.multiStep} onCheckedChange={v => set("multiStep", v)} />
            </div>

            <div className="space-y-3">
              {props.steps.map((step, i) => (
                <StepEditor
                  key={i}
                  step={step}
                  stepIndex={i}
                  onChange={s => setStep(i, s)}
                  onDelete={() => removeStep(i)}
                  canDelete={props.steps.length > 1}
                />
              ))}
              {props.multiStep && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addStep}>
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </Button>
              )}
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="settings" className="space-y-4 mt-0">
        <div>
          <Label className={LABEL_CLS}>Background Style</Label>
          <Select value={props.backgroundStyle} onValueChange={v => set("backgroundStyle", v as FormBlockProps["backgroundStyle"])}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={LABEL_CLS}>Submit Button Text</Label>
          <Input value={props.submitButtonText} onChange={e => set("submitButtonText", e.target.value)} className="text-sm" />
        </div>
        <div>
          <Label className={LABEL_CLS}>Button Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.submitButtonColor || "#C7E738"}
              onChange={e => set("submitButtonColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background shrink-0"
            />
            <Input
              value={props.submitButtonColor ?? ""}
              onChange={e => set("submitButtonColor", e.target.value || undefined)}
              placeholder="e.g. #C7E738"
              className="h-8 text-xs font-mono flex-1"
              maxLength={7}
            />
            {props.submitButtonColor && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => set("submitButtonColor", undefined)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Defaults to brand accent color. Clear to reset.</p>
        </div>
        <div>
          <Label className={LABEL_CLS}>Button Text Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={props.submitButtonTextColor || "#003A30"}
              onChange={e => set("submitButtonTextColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background shrink-0"
            />
            <Input
              value={props.submitButtonTextColor ?? ""}
              onChange={e => set("submitButtonTextColor", e.target.value || undefined)}
              placeholder="e.g. #ffffff"
              className="h-8 text-xs font-mono flex-1"
              maxLength={7}
            />
            {props.submitButtonTextColor && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => set("submitButtonTextColor", undefined)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Defaults to dark on light backgrounds, near-black on dark. Clear to reset.</p>
        </div>
        <div>
          <Label className={LABEL_CLS}>Success Message</Label>
          <Textarea
            value={props.successMessage}
            onChange={e => set("successMessage", e.target.value)}
            className="text-sm"
            rows={2}
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Redirect URL (optional)</Label>
          <Input
            value={props.redirectUrl}
            onChange={e => set("redirectUrl", e.target.value)}
            className="text-sm"
            placeholder="https://example.com/thank-you"
          />
          <p className="text-xs text-muted-foreground mt-1">If set, the visitor is redirected after submission.</p>
        </div>
      </TabsContent>

      <TabsContent value="notifications" className="mt-0">
        {linkedForm ? (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Notifications are managed in the <a href="/forms" target="_blank" className="underline font-medium text-foreground">Forms library</a> under "{linkedForm.name}".
          </div>
        ) : pageId != null ? (
          <NotificationsTab pageId={pageId} />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Save the page first to configure notifications.
          </p>
        )}
      </TabsContent>
    </Tabs>
    </div>
  );
}
