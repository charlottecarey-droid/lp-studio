import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ArrowLeft, ClipboardCopy, Check, GitBranch } from "lucide-react";
import type { FormStep, FormField, FormFieldType, StepCondition } from "@/lib/block-types";

const API_BASE = "/api";

interface GlobalForm {
  id: number;
  name: string;
  description: string | null;
  steps: FormStep[];
  multiStep: boolean;
  submitButtonText: string | null;
  successMessage: string | null;
  redirectUrl: string | null;
  backgroundStyle: string | null;
  emailRecipients: string[];
  webhookUrl: string | null;
  marketoConfig: MarketoConfig | null;
  salesforceConfig: SalesforceConfig | null;
  createdAt: string;
}

interface MarketoConfig {
  enabled?: boolean;
  fieldMappings: Record<string, string>;
}

interface SalesforceConfig {
  enabled?: boolean;
  fieldMappings: Record<string, string>;
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

function uid() { return `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const LABEL_CLS = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

const OPERATORS: { value: StepCondition["operator"]; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "any_of", label: "is any of" },
];

/** Collects all fields from all steps in the form for use in condition dropdowns */
function allFieldsFromSteps(steps: FormStep[]): { id: string; label: string }[] {
  return steps.flatMap(s => s.fields.map(f => ({ id: f.id, label: f.label })));
}

function ConditionEditor({ condition, onUpdate, onRemove, availableFields }: {
  condition: StepCondition | undefined;
  onUpdate: (c: StepCondition) => void;
  onRemove: () => void;
  availableFields: { id: string; label: string }[];
}) {
  if (!condition) {
    return (
      <button
        onClick={() => onUpdate({ fieldId: availableFields[0]?.id ?? "", operator: "equals", value: "" })}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <GitBranch className="w-3 h-3" /> Add condition
      </button>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-blue-300 bg-blue-50/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-700 flex items-center gap-1"><GitBranch className="w-3 h-3" /> Show when</span>
        <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
      </div>
      <div className="flex gap-1.5 items-center flex-wrap">
        <select
          value={condition.fieldId}
          onChange={e => onUpdate({ ...condition, fieldId: e.target.value })}
          className="text-xs border rounded px-1.5 py-1 bg-white max-w-[140px] truncate"
        >
          <option value="">Select field…</option>
          {availableFields.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <select
          value={condition.operator}
          onChange={e => onUpdate({ ...condition, operator: e.target.value as StepCondition["operator"] })}
          className="text-xs border rounded px-1.5 py-1 bg-white"
        >
          {OPERATORS.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
        <input
          value={condition.value}
          onChange={e => onUpdate({ ...condition, value: e.target.value })}
          placeholder={condition.operator === "any_of" ? "A | B | C" : "value"}
          className="text-xs border rounded px-1.5 py-1 bg-white flex-1 min-w-[80px]"
        />
      </div>
    </div>
  );
}

function FieldEditor({ field, onChange, onDelete, onMoveUp, onMoveDown, allFields }: {
  field: FormField; onChange: (f: FormField) => void; onDelete: () => void;
  onMoveUp?: () => void; onMoveDown?: () => void;
  allFields: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [optionsText, setOptionsText] = useState(() => (field.options ?? []).join("\n"));
  const set = <K extends keyof FormField>(k: K, v: FormField[K]) => onChange({ ...field, [k]: v });

  useEffect(() => {
    if (field.type !== "select") setOptionsText((field.options ?? []).join("\n"));
  }, [field.type]);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
          <button aria-label="Move up" disabled={!onMoveUp} onClick={() => onMoveUp?.()} className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button aria-label="Move down" disabled={!onMoveDown} onClick={() => onMoveDown?.()} className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30">
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
          <div><Label className={LABEL_CLS}>Label</Label><Input value={field.label} onChange={e => set("label", e.target.value)} className="text-sm" /></div>
          <div>
            <Label className={LABEL_CLS}>Type</Label>
            <Select value={field.type} onValueChange={v => set("type", v as FormFieldType)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
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
                {["{{utm_source}}", "{{utm_medium}}", "{{utm_campaign}}", "{{utm_content}}", "{{utm_term}}", "{{utm_ad_id}}", "{{gclid}}", "{{fbclid}}", "{{gbraid}}", "{{wbraid}}", "{{msclkid}}", "{{ga_client_id}}", "{{page_url}}", "{{page_title}}", "{{referrer}}"].map(v => (
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
              {field.type !== "checkbox" && <div><Label className={LABEL_CLS}>Placeholder</Label><Input value={field.placeholder ?? ""} onChange={e => set("placeholder", e.target.value)} className="text-sm" /></div>}
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
                placeholder={"Option A\nOption B\nOption C"}
              />
            </div>
          )}
          {field.type !== "hidden" && (
            <ConditionEditor
              condition={field.visibilityCondition}
              onUpdate={c => onChange({ ...field, visibilityCondition: c })}
              onRemove={() => { const { visibilityCondition: _, ...rest } = field; onChange(rest as FormField); }}
              availableFields={allFields.filter(f => f.id !== field.id)}
            />
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full gap-1.5 mt-1" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Remove Field
          </Button>
        </div>
      )}
    </div>
  );
}

function StepEditor({ step, stepIndex, onChange, onDelete, canDelete, allFields }: {
  step: FormStep; stepIndex: number; onChange: (s: FormStep) => void;
  onDelete: () => void; canDelete: boolean;
  allFields: { id: string; label: string }[];
}) {
  const setField = (i: number, f: FormField) => { const fs = [...step.fields]; fs[i] = f; onChange({ ...step, fields: fs }); };
  const removeField = (i: number) => onChange({ ...step, fields: step.fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const fs = [...step.fields]; const j = i + dir;
    if (j < 0 || j >= fs.length) return;
    [fs[i], fs[j]] = [fs[j], fs[i]]; onChange({ ...step, fields: fs });
  };
  const addField = () => onChange({ ...step, fields: [...step.fields, { id: uid(), type: "text", label: "New Field", required: false }] });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-semibold text-muted-foreground">Step {stepIndex + 1}</span>
          <Input value={step.title} onChange={e => onChange({ ...step, title: e.target.value })} className="text-sm h-7 border-none bg-transparent shadow-none px-1 focus-visible:ring-0" placeholder="Step title" />
        </div>
        {canDelete && <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>}
      </div>
      {/* Step-level condition: only show this step when a prior field matches */}
      {stepIndex > 0 && (
        <div className="px-3 pt-2">
          <ConditionEditor
            condition={step.condition}
            onUpdate={c => onChange({ ...step, condition: c })}
            onRemove={() => { const { condition: _, ...rest } = step; onChange(rest as FormStep); }}
            availableFields={allFields}
          />
        </div>
      )}
      <div className="p-3 space-y-2">
        {step.fields.map((field, i) => (
          <FieldEditor key={field.id} field={field} onChange={f => setField(i, f)} onDelete={() => removeField(i)}
            onMoveUp={i > 0 ? () => moveField(i, -1) : undefined}
            onMoveDown={i < step.fields.length - 1 ? () => moveField(i, 1) : undefined}
            allFields={allFields}
          />
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addField}><Plus className="w-3.5 h-3.5" /> Add Field</Button>
      </div>
    </div>
  );
}

function FormEditor({ form, onSaved, onDelete }: { form: GlobalForm; onSaved: (f: GlobalForm) => void; onDelete: () => void; }) {
  const [local, setLocal] = useState<GlobalForm>(form);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showMarketo, setShowMarketo] = useState(!!form.marketoConfig);
  const [showSalesforce, setShowSalesforce] = useState(!!form.salesforceConfig);
  const [copied, setCopied] = useState(false);

  const mappingsToText = (m: Record<string, string> | undefined) =>
    Object.entries(m ?? {}).map(([k, v]) => `${k}:${v}`).join("\n");
  const textToMappings = (text: string): Record<string, string> => {
    const m: Record<string, string> = {};
    text.split("\n").forEach(line => {
      const [k, ...rest] = line.split(":");
      if (k && rest.length) m[k.trim()] = rest.join(":").trim();
    });
    return m;
  };

  const [marketoText, setMarketoText] = useState(mappingsToText(form.marketoConfig?.fieldMappings));
  const [salesforceText, setSalesforceText] = useState(mappingsToText(form.salesforceConfig?.fieldMappings));

  useEffect(() => {
    setLocal(form);
    setShowMarketo(!!form.marketoConfig);
    setShowSalesforce(!!form.salesforceConfig);
    setMarketoText(mappingsToText(form.marketoConfig?.fieldMappings));
    setSalesforceText(mappingsToText(form.salesforceConfig?.fieldMappings));
  }, [form.id]);

  const set = <K extends keyof GlobalForm>(k: K, v: GlobalForm[K]) => setLocal(p => ({ ...p, [k]: v }));

  const setStep = (i: number, s: FormStep) => { const steps = [...local.steps]; steps[i] = s; set("steps", steps); };
  const addStep = () => set("steps", [...local.steps, { title: `Step ${local.steps.length + 1}`, fields: [{ id: uid(), type: "text", label: "New Field", required: false }] }]);
  const removeStep = (i: number) => set("steps", local.steps.filter((_, idx) => idx !== i));

  const setMarketoMappings = (m: Record<string, string>) =>
    set("marketoConfig", { ...(local.marketoConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m });
  const setSalesforceMappings = (m: Record<string, string>) =>
    set("salesforceConfig", { ...(local.salesforceConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m });
  const toggleMarketo = (on: boolean) =>
    set("marketoConfig", on ? { enabled: true, fieldMappings: local.marketoConfig?.fieldMappings ?? {} } : null);
  const toggleSalesforce = (on: boolean) =>
    set("salesforceConfig", on ? { enabled: true, fieldMappings: local.salesforceConfig?.fieldMappings ?? {} } : null);

  const addEmail = () => {
    const t = emailInput.trim();
    if (!t || local.emailRecipients.includes(t)) return;
    set("emailRecipients", [...local.emailRecipients, t]); setEmailInput("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/lp/forms/${form.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: local.name, description: local.description,
          steps: local.steps, multiStep: local.multiStep,
          submitButtonText: local.submitButtonText, successMessage: local.successMessage,
          redirectUrl: local.redirectUrl, backgroundStyle: local.backgroundStyle,
          emailRecipients: local.emailRecipients, webhookUrl: local.webhookUrl,
          marketoConfig: local.marketoConfig, salesforceConfig: local.salesforceConfig,
        }),
      });
      if (!r.ok) {
        const err = await r.text().catch(() => "");
        alert(`Save failed (${r.status}): ${err.slice(0, 300)}`);
        return;
      }
      const updated = await r.json() as GlobalForm;
      const safe: GlobalForm = {
        ...updated,
        steps: Array.isArray(updated.steps) ? updated.steps : local.steps,
        emailRecipients: Array.isArray(updated.emailRecipients) ? updated.emailRecipients : [],
      };
      onSaved(safe);
      setLocal(safe);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSaving(false); }
  };

  const copyId = () => {
    navigator.clipboard.writeText(String(form.id));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <Input value={local.name} onChange={e => set("name", e.target.value)} className="text-base font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent" placeholder="Form name" />
          {local.description !== null && (
            <Input value={local.description ?? ""} onChange={e => set("description", e.target.value)} className="text-xs text-muted-foreground border-none shadow-none px-0 h-auto focus-visible:ring-0 bg-transparent mt-0.5" placeholder="Add a description…" />
          )}
        </div>
        <button onClick={copyId} title={`Form ID: ${form.id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border rounded-md px-2 py-1">
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <ClipboardCopy className="w-3 h-3" />}
          ID: {form.id}
        </button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 gap-1" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "Saved!" : "Save"}</Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs defaultValue="fields">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 text-xs">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className={LABEL_CLS + " !mb-0"}>Multi-step Form</Label>
                <p className="text-xs text-muted-foreground">Split fields across multiple steps. Add conditions to create quiz-style branching.</p>
              </div>
              <Switch checked={local.multiStep} onCheckedChange={v => set("multiStep", v)} />
            </div>
            <div className="space-y-3">
              {local.steps.map((step, i) => (
                <StepEditor key={i} step={step} stepIndex={i} onChange={s => setStep(i, s)}
                  onDelete={() => removeStep(i)} canDelete={local.steps.length > 1}
                  allFields={allFieldsFromSteps(local.steps)} />
              ))}
              {local.multiStep && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addStep}><Plus className="w-3.5 h-3.5" /> Add Step</Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-0">
            <div>
              <Label className={LABEL_CLS}>Submit Button Text</Label>
              <Input value={local.submitButtonText ?? ""} onChange={e => set("submitButtonText", e.target.value)} className="text-sm" placeholder="Submit" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Success Message</Label>
              <Textarea value={local.successMessage ?? ""} onChange={e => set("successMessage", e.target.value)} className="text-sm" rows={2} placeholder="Thanks! We'll be in touch." />
            </div>
            <div>
              <Label className={LABEL_CLS}>Redirect URL (optional)</Label>
              <Input value={local.redirectUrl ?? ""} onChange={e => set("redirectUrl", e.target.value || null)} className="text-sm" placeholder="https://example.com/thank-you" />
              <p className="text-xs text-muted-foreground mt-1">Redirect the visitor here after submission.</p>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-0">
            <div>
              <Label className={LABEL_CLS}>Email Recipients</Label>
              <p className="text-xs text-muted-foreground mb-2">Get an email for each new submission.</p>
              <div className="flex gap-2">
                <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@example.com" className="text-sm"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
                <Button size="sm" variant="outline" onClick={addEmail}>Add</Button>
              </div>
              {local.emailRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {local.emailRecipients.map((email, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-1 rounded-full">
                      {email}
                      <button onClick={() => set("emailRecipients", local.emailRecipients.filter((_, idx) => idx !== i))} className="hover:text-destructive">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className={LABEL_CLS}>Webhook URL</Label>
              <p className="text-xs text-muted-foreground mb-2">POST the lead payload to this URL on each submission.</p>
              <Input value={local.webhookUrl ?? ""} onChange={e => set("webhookUrl", e.target.value || null)} placeholder="https://hooks.example.com/lead" className="text-sm" />
            </div>

            {/* Marketo */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
                <button className="flex items-center gap-2 text-sm font-medium flex-1 text-left hover:text-foreground transition-colors" onClick={() => setShowMarketo(s => !s)}>
                  {showMarketo ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  Marketo
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{local.marketoConfig ? "Sync on" : "Sync off"}</span>
                  <Switch checked={!!local.marketoConfig} onCheckedChange={toggleMarketo} />
                </div>
              </div>
              {showMarketo && (
                <div className="p-3 space-y-3">
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                    Credentials are configured in <a href="/integrations" className="underline font-medium text-foreground">Settings → Integrations</a>.
                  </p>
                  <div>
                    <Label className={LABEL_CLS}>Field Mappings</Label>
                    <p className="text-xs text-muted-foreground mb-2">Map form field labels to Marketo field names — one per line (Label:marketoFieldName)</p>
                    <Textarea rows={4} className="text-sm font-mono"
                      placeholder={"Full Name:firstName\nEmail Address:email\nPhone Number:phone"}
                      value={marketoText}
                      onChange={e => { setMarketoText(e.target.value); setMarketoMappings(textToMappings(e.target.value)); }}
                    />
                  </div>

                  <details className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-foreground select-none">
                      How to set up Marketo field mappings
                    </summary>
                    <div className="pt-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <div>
                        <p className="font-semibold text-foreground mb-1">How it works</p>
                        <p>The left side is your <strong>form field label</strong> (exactly as it appears on the form). The right side is the Marketo field's <strong>REST API name</strong> — not its display name. If a form field's label exactly matches a Marketo REST name, you can omit it and the value still flows through.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">Standard Marketo fields</p>
                        <pre className="bg-muted px-3 py-2 rounded text-[11px] font-mono whitespace-pre overflow-x-auto">{`Email Address:email           ← required (lookup key)
Full Name:firstName
Last Name:lastName
Company:company
Job Title:title
Phone:phone
Mobile:mobilePhone
Website:website
City:city
State:state
Country:country
Postal Code:postalCode
Industry:industry`}</pre>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">UTM tracking (auto-injected)</p>
                        <p className="mb-1.5">UTMs captured from the visitor's session are sent to Marketo on every submission — you don't need hidden form fields. By default they're sent under the literal names <code className="bg-muted px-1 rounded">utm_source</code>, <code className="bg-muted px-1 rounded">utm_medium</code>, <code className="bg-muted px-1 rounded">utm_campaign</code>, <code className="bg-muted px-1 rounded">utm_term</code>, <code className="bg-muted px-1 rounded">utm_content</code>. To route them to your custom fields, map them like any other field:</p>
                        <pre className="bg-muted px-3 py-2 rounded text-[11px] font-mono whitespace-pre overflow-x-auto">{`utm_source:uTMSource__c
utm_medium:uTMMedium__c
utm_campaign:uTMCampaign__c
utm_term:uTMTerm__c
utm_content:uTMContent__c`}</pre>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">Finding REST API names in Marketo</p>
                        <p>Marketo Admin → <strong>Field Management</strong>. The <strong>REST API Name</strong> column is what you paste here. Custom fields almost always end in <code className="bg-muted px-1 rounded">__c</code>. Names are case-sensitive.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">Gotchas</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li><strong>Email is required.</strong> Marketo uses email as the lookup key — submissions without an email are dropped.</li>
                          <li><strong>Custom fields must exist in Marketo first.</strong> Mapping to a non-existent field fails silently (the field is dropped, not errored).</li>
                          <li><strong>Hidden form UTMs win.</strong> If a form already has a hidden field named <code className="bg-muted px-1 rounded">utm_source</code>, that value is used instead of the auto-injected one.</li>
                        </ul>
                      </div>
                    </div>
                  </details>
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
                  <span className="text-xs text-muted-foreground">{local.salesforceConfig ? "Sync on" : "Sync off"}</span>
                  <Switch checked={!!local.salesforceConfig} onCheckedChange={toggleSalesforce} />
                </div>
              </div>
              {showSalesforce && (
                <div className="p-3 space-y-3">
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                    Credentials are configured in <a href="/integrations" className="underline font-medium text-foreground">Settings → Integrations</a>.
                  </p>
                  <div>
                    <Label className={LABEL_CLS}>Field Mappings</Label>
                    <p className="text-xs text-muted-foreground mb-2">Map form field labels to Salesforce field names — one per line (Label:SalesforceField)</p>
                    <Textarea rows={4} className="text-sm font-mono"
                      placeholder={"Full Name:LastName\nEmail Address:Email\nPhone Number:Phone"}
                      value={salesforceText}
                      onChange={e => { setSalesforceText(e.target.value); setSalesforceMappings(textToMappings(e.target.value)); }}
                    />
                  </div>

                  <details className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-foreground select-none">
                      How to set up Salesforce field mappings
                    </summary>
                    <div className="pt-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <div>
                        <p className="font-semibold text-foreground mb-1">How it works</p>
                        <p>The left side is your <strong>form field label</strong> (exactly as it appears on the form). The right side is the Salesforce <strong>API Name</strong> on the Lead object — case-sensitive. Custom fields end in <code className="bg-muted px-1 rounded">__c</code>.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">Standard Lead fields</p>
                        <pre className="bg-muted px-3 py-2 rounded text-[11px] font-mono whitespace-pre overflow-x-auto">{`Email Address:Email           ← required
First Name:FirstName
Last Name:LastName            ← required by Salesforce
Company:Company               ← required by Salesforce
Job Title:Title
Phone:Phone
Mobile:MobilePhone
Website:Website
City:City
State:State
Country:Country
Postal Code:PostalCode
Industry:Industry
Lead Source:LeadSource`}</pre>
                        <p className="mt-1.5"><strong>Tip:</strong> Salesforce requires <code className="bg-muted px-1 rounded">LastName</code> and <code className="bg-muted px-1 rounded">Company</code> on every Lead. If your form only collects a single name field, map it to <code className="bg-muted px-1 rounded">LastName</code>. If you don't collect a company, set a default in Salesforce or Lead creation will fail.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">Finding API names in Salesforce</p>
                        <p>Setup → <strong>Object Manager → Lead → Fields & Relationships</strong>. The <strong>Field Name</strong> column (not Label) is what you paste here.</p>
                      </div>

                      <div>
                        <p className="font-semibold text-foreground mb-1">UTM tracking</p>
                        <p>UTM auto-injection is currently Marketo-only. To send UTMs to Salesforce, add hidden form fields named <code className="bg-muted px-1 rounded">utm_source</code>, <code className="bg-muted px-1 rounded">utm_medium</code>, etc., then map them to your custom Lead fields here.</p>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function FormsContent() {
  const [forms, setForms] = useState<GlobalForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GlobalForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/lp/forms`).then(r => r.json()).then((data: GlobalForm[]) => setForms(data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createForm = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const r = await fetch(`${API_BASE}/lp/forms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
    const form = await r.json() as GlobalForm;
    setForms(prev => [form, ...prev]);
    setSelected(form);
    setNewName("");
    setCreating(false);
  };

  const handleSaved = (updated: GlobalForm) => {
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
    setSelected(updated);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete form "${selected.name}"? This cannot be undone.`)) return;
    await fetch(`${API_BASE}/lp/forms/${selected.id}`, { method: "DELETE" });
    setForms(prev => prev.filter(f => f.id !== selected.id));
    setSelected(null);
  };

  if (selected) {
    return (
      <div className="flex h-screen flex-col">
        <div className="px-6 py-3 border-b bg-background flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
            <ArrowLeft className="w-4 h-4" /> Forms
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FormEditor form={selected} onSaved={handleSaved} onDelete={handleDelete} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create global forms once, link them to any landing page block. Manage fields and integrations in one place.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Form name (e.g. Demo Request)"
          className="max-w-xs" onKeyDown={e => { if (e.key === "Enter") createForm(); }} />
        <Button onClick={createForm} disabled={creating || !newName.trim()} className="gap-1.5">
          <Plus className="w-4 h-4" /> Create Form
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="font-medium mb-1">No forms yet</p>
            <p className="text-xs">Create your first global form above, then link it to a Form block in the builder.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {forms.map(form => (
            <button key={form.id} onClick={() => setSelected(form)}
              className="w-full text-left border rounded-lg px-4 py-3 bg-background hover:bg-muted/40 transition-colors flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{form.name}</p>
                {form.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{form.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {form.steps.reduce((n, s) => n + s.fields.length, 0)} field{form.steps.reduce((n, s) => n + s.fields.length, 0) !== 1 ? "s" : ""}
                  {form.multiStep ? ` · ${form.steps.length} steps` : ""}
                  {(form.salesforceConfig || form.marketoConfig) ? " · CRM connected" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 font-mono">ID {form.id}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormsPage() {
  return (
    <AppLayout>
      <FormsContent />
    </AppLayout>
  );
}
