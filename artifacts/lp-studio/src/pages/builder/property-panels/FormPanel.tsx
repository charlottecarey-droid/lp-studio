import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
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
    munchkinId: string;
    clientId: string;
    clientSecret: string;
    fieldMappings: Record<string, string>;
  } | null;
  salesforceConfig: {
    clientId: string;
    clientSecret: string;
    instanceUrl: string;
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
  const set = <K extends keyof FormField>(k: K, v: FormField[K]) => onChange({ ...field, [k]: v });

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
          {field.type === "select" && (
            <div>
              <Label className={LABEL_CLS}>Options (one per line)</Label>
              <Textarea
                value={(field.options ?? []).join("\n")}
                onChange={e => set("options", e.target.value.split("\n").filter(Boolean))}
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

  const setMarketo = (key: string, val: string | Record<string, string>) => {
    setConfig(c => ({
      ...c,
      marketoConfig: {
        munchkinId: "",
        clientId: "",
        clientSecret: "",
        fieldMappings: {},
        ...(c.marketoConfig ?? {}),
        [key]: val,
      },
    }));
  };

  const setSalesforce = (key: string, val: string | Record<string, string>) => {
    setConfig(c => ({
      ...c,
      salesforceConfig: {
        clientId: "",
        clientSecret: "",
        instanceUrl: "",
        fieldMappings: {},
        ...(c.salesforceConfig ?? {}),
        [key]: val,
      },
    }));
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

      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() => {
            setShowMarketo(s => {
              if (s && config.marketoConfig) setConfig(c => ({ ...c, marketoConfig: null }));
              return !s;
            });
          }}
        >
          <span>Marketo Integration</span>
          {showMarketo ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showMarketo && (
          <div className="p-3 space-y-3">
            <div>
              <Label className={LABEL_CLS}>Munchkin ID</Label>
              <Input value={config.marketoConfig?.munchkinId ?? ""} onChange={e => setMarketo("munchkinId", e.target.value)} className="text-sm" placeholder="123-ABC-456" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Client ID</Label>
              <Input value={config.marketoConfig?.clientId ?? ""} onChange={e => setMarketo("clientId", e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Client Secret</Label>
              <Input type="password" value={config.marketoConfig?.clientSecret ?? ""} onChange={e => setMarketo("clientSecret", e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Field Mappings (form field → Marketo field)</Label>
              <p className="text-xs text-muted-foreground mb-2">Format: "Form Label:marketoFieldName" — one per line</p>
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
                  setMarketo("fieldMappings", mappings);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() => {
            setShowSalesforce(s => {
              if (s && config.salesforceConfig) setConfig(c => ({ ...c, salesforceConfig: null }));
              return !s;
            });
          }}
        >
          <span>Salesforce Integration</span>
          {showSalesforce ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showSalesforce && (
          <div className="p-3 space-y-3">
            <div>
              <Label className={LABEL_CLS}>Instance URL</Label>
              <Input value={config.salesforceConfig?.instanceUrl ?? ""} onChange={e => setSalesforce("instanceUrl", e.target.value)} className="text-sm" placeholder="https://yourorg.my.salesforce.com" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Client ID</Label>
              <Input value={config.salesforceConfig?.clientId ?? ""} onChange={e => setSalesforce("clientId", e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Client Secret</Label>
              <Input type="password" value={config.salesforceConfig?.clientSecret ?? ""} onChange={e => setSalesforce("clientSecret", e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Field Mappings (form field → Salesforce field)</Label>
              <p className="text-xs text-muted-foreground mb-2">Format: "Form Label:SalesforceField" — one per line</p>
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
                  setSalesforce("fieldMappings", mappings);
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

interface Props {
  props: FormBlockProps;
  onChange: (props: FormBlockProps) => void;
  pageId?: number;
}

export function FormPanel({ props, onChange, pageId }: Props) {
  const set = <K extends keyof FormBlockProps>(k: K, v: FormBlockProps[K]) =>
    onChange({ ...props, [k]: v });

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
      </TabsContent>

      <TabsContent value="settings" className="space-y-4 mt-0">
        <div>
          <Label className={LABEL_CLS}>Background Style</Label>
          <Select value={props.backgroundStyle} onValueChange={v => set("backgroundStyle", v as FormBlockProps["backgroundStyle"])}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="white">White</SelectItem>
              <SelectItem value="light-gray">Light Gray</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={LABEL_CLS}>Submit Button Text</Label>
          <Input value={props.submitButtonText} onChange={e => set("submitButtonText", e.target.value)} className="text-sm" />
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
        {pageId != null ? (
          <NotificationsTab pageId={pageId} />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Save the page first to configure notifications.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
