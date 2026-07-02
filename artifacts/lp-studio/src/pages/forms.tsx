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
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ArrowLeft, ClipboardCopy, Check, GitBranch, Copy, AlertTriangle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { FormStep, FormField, FormFieldType, StepCondition } from "@/lib/block-types";
import { type FormStyling } from "@/lib/form-styling";
import { FormStylingPanel } from "@/components/FormStylingPanel";
import { useBrandConfig } from "@/components/BrandSwatches";
import { mappingsToText, textToMappings } from "@/lib/field-map-text";
import { MarketoForm } from "@/components/MarketoForm";
import { FollowUpEmailSection } from "@/components/FollowUpEmailSection";

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
  sheetsConfig: SheetsOverrideConfig | null;
  chiliPiperConfig: ChiliPiperConfig | null;
  gtmDataLayerConfig: GtmDataLayerConfig | null;
  sendFollowUpToSubmitter: boolean;
  followUpTemplateId: number | null;
  enrollCampaignId: number | null;
  /** Per-form visual styling. NULL = use block-level styling on each
   *  rendered form block (legacy behavior). Set via the Style tab. */
  styling: FormStyling | null;
  createdAt: string;
}

interface MarketoConfig {
  enabled?: boolean;
  fieldMappings: Record<string, string>;
  /**
   * Optional Marketo Forms2 "ghost submit" config. When all three are set,
   * BlockForm fires a hidden Marketo Forms2 submission alongside the normal
   * server-side REST sync, so the lead lands in Marketo through the Forms2
   * path (Munchkin cookie association, Smart Campaign triggers, GA4 event).
   */
  forms2?: {
    baseUrl: string;
    munchkinId: string;
    formId: number;
  };
}

interface SalesforceConfig {
  enabled?: boolean;
  fieldMappings: Record<string, string>;
}

// Per-form Google Sheets override. When `enabled` is true and `sheetId`
// is set, this form's leads append to the override sheet/tab instead of
// the tenant's default Google Sheets integration target. Credentials
// always come from the tenant's integration (Settings → Integrations).
interface SheetsOverrideConfig {
  enabled?: boolean;
  sheetId?: string;
  tabName?: string;
}

interface ChiliPiperConfig {
  url: string;
  mode?: "modal" | "redirect";
  fieldMap?: Record<string, string>;
}

interface GtmDataLayerConfig {
  enabled?: boolean;
  event?: string;
  formName?: string;
}

// Mirror of DEFAULT_GTM_DATALAYER_CONFIG in
// artifacts/lp-studio/src/lib/gtm-datalayer.ts. Duplicated here so the
// editor can show the defaults as placeholder text without dragging the
// runtime helper (which touches `window`) into this admin page bundle.
const DEFAULT_GTM_EVENT = "Marketo Form Submission";
const DEFAULT_GTM_FORM_NAME = "Demo Form";

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
      <div className="flex gap-1.5 items-center flex-wrap sm:flex-nowrap">
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

/**
 * Per-form styling tab. Thin wrapper around the shared FormStylingPanel
 * that pipes the brand-level `formStyling` defaults in as muted
 * placeholders so editors can see which tokens they'd inherit if they
 * leave a field blank.
 */
function StylingPanel({ styling, onChange }: {
  styling: FormStyling | null;
  onChange: (s: FormStyling | null) => void;
}) {
  const brand = useBrandConfig();
  return (
    <FormStylingPanel
      styling={styling}
      onChange={onChange}
      placeholderLayer={brand?.formStyling ?? null}
      helpText="Overrides the per-block colors on every form block that links to this form. Empty fields fall back to your brand-default form styling, then to each block's own styling."
    />
  );
}

function FormEditor({ form, onSaved, onDelete }: { form: GlobalForm; onSaved: (f: GlobalForm) => void; onDelete: () => void; }) {
  const [local, setLocal] = useState<GlobalForm>(form);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showMarketo, setShowMarketo] = useState(!!form.marketoConfig);
  const [showSalesforce, setShowSalesforce] = useState(!!form.salesforceConfig);
  const [showChiliPiper, setShowChiliPiper] = useState(!!form.chiliPiperConfig);
  const [copied, setCopied] = useState(false);

  const [marketoText, setMarketoText] = useState(mappingsToText(form.marketoConfig?.fieldMappings));
  const [salesforceText, setSalesforceText] = useState(mappingsToText(form.salesforceConfig?.fieldMappings));

  // Marketo Forms2 ghost-submit test harness. We mount a hidden <MarketoForm>
  // with `submitOnReady` whenever `testStatus === "sending"`, then resolve to
  // "sent" / "error" via the component's onSuccess / onLoadError callbacks.
  // `testKey` is bumped on every click so a follow-up test re-mounts the form
  // (the component is one-shot per (config, prefill) pair).
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [testKey, setTestKey] = useState(0);

  // Timeout fallback: a Forms2 submit that gets past the loader but never
  // fires `onSuccess` (e.g. Marketo silently dropped the request, the form's
  // own validators rejected the payload) would otherwise leave the test
  // pinned at "sending" forever. After 15s, surface a generic failure so
  // editors get a terminal state to react to.
  useEffect(() => {
    if (testStatus !== "sending") return;
    const t = setTimeout(() => {
      setTestStatus(prev => {
        if (prev !== "sending") return prev;
        setTestError("Marketo did not confirm the test submission within 15s. Check the Marketo activity log to see whether it landed.");
        return "error";
      });
    }, 15000);
    return () => clearTimeout(t);
  }, [testStatus, testKey]);

  const [chiliPiperFieldMapText, setChiliPiperFieldMapText] = useState(mappingsToText(form.chiliPiperConfig?.fieldMap));

  useEffect(() => {
    setLocal(form);
    setShowMarketo(!!form.marketoConfig);
    setShowSalesforce(!!form.salesforceConfig);
    setShowChiliPiper(!!form.chiliPiperConfig);
    setMarketoText(mappingsToText(form.marketoConfig?.fieldMappings));
    setSalesforceText(mappingsToText(form.salesforceConfig?.fieldMappings));
    setChiliPiperFieldMapText(mappingsToText(form.chiliPiperConfig?.fieldMap));
    setTestStatus("idle");
    setTestError(null);
  }, [form.id]);

  const set = <K extends keyof GlobalForm>(k: K, v: GlobalForm[K]) => setLocal(p => ({ ...p, [k]: v }));

  const setStep = (i: number, s: FormStep) => { const steps = [...local.steps]; steps[i] = s; set("steps", steps); };
  const addStep = () => set("steps", [...local.steps, { title: `Step ${local.steps.length + 1}`, fields: [{ id: uid(), type: "text", label: "New Field", required: false }] }]);
  const removeStep = (i: number) => set("steps", local.steps.filter((_, idx) => idx !== i));

  const setMarketoMappings = (m: Record<string, string>) =>
    set("marketoConfig", { ...(local.marketoConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m });
  const setMarketoForms2 = (patch: Partial<NonNullable<MarketoConfig["forms2"]>>) => {
    const base = local.marketoConfig ?? { enabled: true, fieldMappings: {} };
    const current = base.forms2 ?? { baseUrl: "", munchkinId: "", formId: 0 };
    const next = { ...current, ...patch };
    // If the operator clears all three, drop the forms2 sub-object entirely
    // so the ghost-submit code path stays inert (no half-configured fires).
    const cleared = !next.baseUrl && !next.munchkinId && !next.formId;
    set("marketoConfig", { ...base, forms2: cleared ? undefined : next });
  };
  const setSalesforceMappings = (m: Record<string, string>) =>
    set("salesforceConfig", { ...(local.salesforceConfig ?? { enabled: true, fieldMappings: {} }), fieldMappings: m });
  const toggleMarketo = (on: boolean) =>
    set("marketoConfig", on ? { enabled: true, fieldMappings: local.marketoConfig?.fieldMappings ?? {} } : null);
  const toggleSalesforce = (on: boolean) =>
    set("salesforceConfig", on ? { enabled: true, fieldMappings: local.salesforceConfig?.fieldMappings ?? {} } : null);
  const toggleChiliPiper = (on: boolean) =>
    set("chiliPiperConfig", on ? { url: local.chiliPiperConfig?.url ?? "", mode: local.chiliPiperConfig?.mode ?? "modal", fieldMap: local.chiliPiperConfig?.fieldMap ?? {} } : null);
  const setChiliPiperUrl = (url: string) =>
    set("chiliPiperConfig", { ...(local.chiliPiperConfig ?? { url: "", mode: "modal", fieldMap: {} }), url });
  const setChiliPiperMode = (mode: "modal" | "redirect") =>
    set("chiliPiperConfig", { ...(local.chiliPiperConfig ?? { url: "", mode: "modal", fieldMap: {} }), mode });
  const setChiliPiperFieldMap = (m: Record<string, string>) =>
    set("chiliPiperConfig", { ...(local.chiliPiperConfig ?? { url: "", mode: "modal", fieldMap: {} }), fieldMap: m });

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
          sheetsConfig: local.sheetsConfig,
          chiliPiperConfig: local.chiliPiperConfig,
          gtmDataLayerConfig: local.gtmDataLayerConfig,
          sendFollowUpToSubmitter: local.sendFollowUpToSubmitter,
          followUpTemplateId: local.followUpTemplateId,
          enrollCampaignId: local.enrollCampaignId,
          styling: local.styling,
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
            <TabsTrigger value="style" className="flex-1 text-xs">Style</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 text-xs">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="style" className="space-y-4 mt-0">
            <StylingPanel
              styling={local.styling}
              onChange={s => set("styling", s)}
            />
          </TabsContent>

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

            {/* Google Sheets override — by default leads land in the tenant's
                global sheet (Settings → Integrations). Toggle on to redirect
                THIS form's leads to a different sheet / tab using the same
                service-account credentials. */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">Google Sheets — Separate Sheet</div>
                  <p className="text-[11px] text-muted-foreground">
                    {local.sheetsConfig?.enabled
                      ? "Leads from this form go to the sheet below (instead of the tenant default)."
                      : "Leads go to the tenant's default sheet configured in Settings → Integrations."}
                  </p>
                </div>
                <Switch
                  checked={!!local.sheetsConfig?.enabled}
                  onCheckedChange={v =>
                    set("sheetsConfig", v
                      ? { ...(local.sheetsConfig ?? {}), enabled: true }
                      : (local.sheetsConfig ? { ...local.sheetsConfig, enabled: false } : null))
                  }
                />
              </div>
              {local.sheetsConfig?.enabled && (
                <div className="p-3 space-y-3">
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                    Make sure the sheet is shared with the service account email from <a href="/integrations" className="underline font-medium text-foreground">Settings → Integrations</a> (Editor access).
                  </p>
                  <div>
                    <Label className={LABEL_CLS}>Sheet ID</Label>
                    <Input
                      className="text-sm font-mono"
                      placeholder="16SdT0lUbGLMjYkz11yFWBaYgWdEoo5Su1XqFFR4iGGw"
                      value={local.sheetsConfig?.sheetId ?? ""}
                      onChange={e => set("sheetsConfig", { ...(local.sheetsConfig ?? { enabled: true }), sheetId: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Found in the spreadsheet URL: <code>…/spreadsheets/d/<strong>ID</strong>/edit</code></p>
                  </div>
                  <div>
                    <Label className={LABEL_CLS}>Tab / Sheet name</Label>
                    <Input
                      className="text-sm"
                      placeholder="Spatial Tour Leads"
                      value={local.sheetsConfig?.tabName ?? ""}
                      onChange={e => set("sheetsConfig", { ...(local.sheetsConfig ?? { enabled: true }), tabName: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">The tab is created automatically if it doesn't exist. Defaults to "Leads" if blank.</p>
                  </div>
                </div>
              )}
            </div>

            <FollowUpEmailSection
              enabled={!!local.sendFollowUpToSubmitter}
              templateId={local.followUpTemplateId ?? null}
              onEnabledChange={v => set("sendFollowUpToSubmitter", v)}
              onTemplateIdChange={v => set("followUpTemplateId", v)}
              enrollCampaignId={local.enrollCampaignId ?? null}
              onEnrollCampaignChange={v => set("enrollCampaignId", v)}
            />

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
                  <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                    <div>
                      <Label className={LABEL_CLS}>Forms2 "Ghost" Submit (optional)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        When all three are set, every submit on this form also fires a hidden Marketo Forms2 submission so the lead is associated with the visitor's Munchkin cookie and triggers any Smart Campaigns wired to the form.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Base URL</Label>
                        <Input
                          className="text-sm font-mono"
                          placeholder="//go.example.com"
                          value={local.marketoConfig?.forms2?.baseUrl ?? ""}
                          onChange={e => setMarketoForms2({ baseUrl: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Munchkin ID</Label>
                        <Input
                          className="text-sm font-mono"
                          placeholder="103-HKO-179"
                          value={local.marketoConfig?.forms2?.munchkinId ?? ""}
                          onChange={e => setMarketoForms2({ munchkinId: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Form ID</Label>
                        <Input
                          type="number"
                          className="text-sm font-mono"
                          placeholder="3006"
                          value={local.marketoConfig?.forms2?.formId || ""}
                          onChange={e => setMarketoForms2({ formId: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    {(() => {
                      const f2 = local.marketoConfig?.forms2;
                      const hasAny = !!(f2?.baseUrl || f2?.munchkinId || f2?.formId);
                      const hasAll = !!(f2?.baseUrl && f2?.munchkinId && f2?.formId);
                      const partial = hasAny && !hasAll;
                      const mappingValues = Object.values(local.marketoConfig?.fieldMappings ?? {}).map(v => v.trim().toLowerCase());
                      const formLabels = local.steps.flatMap(s => s.fields.map(f => (f.label ?? "").trim().toLowerCase()));
                      // Mirrors BlockForm's ghost-submit logic: a field with an
                      // explicit mapping to "email" works, and so does an
                      // unmapped field whose label is literally "email".
                      const hasEmailMapping = mappingValues.includes("email") || formLabels.includes("email");
                      if (!partial && hasEmailMapping) return null;
                      return (
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 space-y-1.5">
                          {partial && (
                            <div className="flex items-start gap-2 text-[12px] text-amber-900">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Forms2 ghost submit needs <strong>all three</strong> of Base URL, Munchkin ID and Form ID to fire. Until you fill the missing ones, submits skip the Forms2 path entirely.</span>
                            </div>
                          )}
                          {!hasEmailMapping && (
                            <div className="flex items-start gap-2 text-[12px] text-amber-900">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>No field maps to <code className="bg-amber-100 px-1 rounded">email</code>. Marketo uses email as the lead lookup key — submissions without it are dropped silently. Add a mapping like <code className="bg-amber-100 px-1 rounded">Email Address:email</code> below.</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {(() => {
                      const f2 = local.marketoConfig?.forms2;
                      const hasAll = !!(f2?.baseUrl && f2?.munchkinId && f2?.formId);
                      const sendTest = () => {
                        setTestError(null);
                        setTestStatus("sending");
                        setTestKey(k => k + 1);
                      };
                      // Build a sample payload from the current mappings (so
                      // editors test against fields they have actually wired
                      // up). Intentionally NOT auto-injecting an email when no
                      // mapping resolves to one — that would mask the
                      // "no email mapping" warning above and let a broken
                      // form pass the test.
                      const samples: Record<string, string> = {
                        email: "test@example.com",
                        firstName: "Test",
                        lastName: "Submission",
                        company: "Sample Co.",
                        phone: "+15555550123",
                      };
                      const prefill: Record<string, string> = {};
                      const mapped = Object.values(local.marketoConfig?.fieldMappings ?? {});
                      for (const key of mapped) {
                        if (!key) continue;
                        prefill[key] = samples[key.toLowerCase()] ?? `test ${key}`;
                      }
                      const sampleEmail = Object.entries(prefill).find(([, v]) => v.includes("@"))?.[1] ?? samples.email;
                      return (
                        <div className="pt-2 border-t border-dashed border-border space-y-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              disabled={!hasAll || testStatus === "sending"}
                              onClick={sendTest}
                            >
                              <Send className="w-3.5 h-3.5" />
                              {testStatus === "sending" ? "Sending…" : "Send test submission"}
                            </Button>
                            {testStatus === "sent" && (
                              <span className="text-xs text-green-700 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Marketo accepted the test lead.</span>
                            )}
                            {testStatus === "error" && (
                              <span className="text-xs text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {testError ?? "Test failed."}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Posts a sample payload through the same hidden Forms2 path as live submits. Look for the lead under <code className="bg-muted px-1 rounded">{sampleEmail}</code> in Marketo's lead activity log.
                          </p>
                          {testStatus === "sending" && hasAll && (
                            <div style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                              <MarketoForm
                                key={testKey}
                                baseUrl={f2!.baseUrl}
                                munchkinId={f2!.munchkinId}
                                formId={f2!.formId}
                                prefill={prefill}
                                submitOnReady
                                onSuccess={() => setTestStatus("sent")}
                                onLoadError={msg => { setTestError(msg); setTestStatus("error"); }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
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

            {/* GTM dataLayer — per-form override for the
                `Marketo Form Submission` event push. Defaults match the
                SMB trios5 / form 6 hardcoded payload so every form fires
                the historical { event: "Marketo Form Submission",
                formName: "Demo Form" } out of the box. */}
            {(() => {
              const cfg = local.gtmDataLayerConfig;
              // NULL config → defaults (enabled). Only an explicit
              // `enabled: false` disables the push.
              const enabled = cfg?.enabled !== false;
              const eventVal = cfg?.event ?? "";
              const formNameVal = cfg?.formName ?? "";
              const setGtm = (patch: Partial<GtmDataLayerConfig>) => {
                const base: GtmDataLayerConfig = cfg ?? {};
                const next: GtmDataLayerConfig = { ...base, ...patch };
                // Collapse back to NULL when the config is equivalent to
                // the defaults — keeps the DB row clean and lets a future
                // default change propagate to forms that never customized.
                const isDefault =
                  (next.enabled === true || next.enabled === undefined) &&
                  !next.event?.trim() &&
                  !next.formName?.trim();
                set("gtmDataLayerConfig", isDefault ? null : next);
              };
              return (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
                    <div className="text-sm font-medium">GTM dataLayer push</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</span>
                      <Switch checked={enabled} onCheckedChange={v => setGtm({ enabled: v })} showStateLabel={false} />
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                      Fires a <code className="bg-muted px-1 rounded">window.dataLayer.push</code> on every successful submission so marketing's GTM container can fan out to ads-conversion / GA4 tags. Leave the fields blank to use the defaults (the exact payload the SMB trios5 page has fired since launch).
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className={LABEL_CLS}>Event name</Label>
                        <Input
                          className="text-sm font-mono"
                          placeholder={DEFAULT_GTM_EVENT}
                          value={eventVal}
                          onChange={e => setGtm({ event: e.target.value })}
                          disabled={!enabled}
                        />
                      </div>
                      <div>
                        <Label className={LABEL_CLS}>Form name</Label>
                        <Input
                          className="text-sm font-mono"
                          placeholder={DEFAULT_GTM_FORM_NAME}
                          value={formNameVal}
                          onChange={e => setGtm({ formName: e.target.value })}
                          disabled={!enabled}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Default payload: <code className="bg-muted px-1 rounded">{`{ event: "${DEFAULT_GTM_EVENT}", formName: "${DEFAULT_GTM_FORM_NAME}" }`}</code>
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Chili Piper handoff — picks up the form's submitted values and
                forwards them to the configured scheduler URL. The handoff is
                wired into the Marketo submit path (BlockForm's MarketoForm
                onSuccess), so we only show this section when the form is in
                Marketo mode to avoid offering a setting that can't fire. */}
            {local.marketoConfig && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
                <button className="flex items-center gap-2 text-sm font-medium flex-1 text-left hover:text-foreground transition-colors" onClick={() => setShowChiliPiper(s => !s)}>
                  {showChiliPiper ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  Chili Piper handoff
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{local.chiliPiperConfig ? "On" : "Off"}</span>
                  <Switch checked={!!local.chiliPiperConfig} onCheckedChange={toggleChiliPiper} showStateLabel={false} />
                </div>
              </div>
              {showChiliPiper && (
                <div className="p-3 space-y-3">
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                    On submit, hand the visitor off to a Chili Piper scheduler URL with their submitted identity prefilled (email, first/last name, phone, company). Marketo's own form action still runs first, so the lead lands in Marketo too.
                  </p>
                  <div>
                    <Label className={LABEL_CLS}>Scheduler URL</Label>
                    <Input
                      value={local.chiliPiperConfig?.url ?? ""}
                      onChange={e => setChiliPiperUrl(e.target.value)}
                      placeholder="https://yourcompany.chilipiper.com/router/your-router"
                      className="text-sm font-mono"
                      disabled={!local.chiliPiperConfig}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Paste the concierge / router link from your Chili Piper admin.</p>
                  </div>
                  <div>
                    <Label className={LABEL_CLS}>Open as</Label>
                    <Select
                      value={local.chiliPiperConfig?.mode ?? "modal"}
                      onValueChange={v => setChiliPiperMode(v as "modal" | "redirect")}
                      disabled={!local.chiliPiperConfig}
                    >
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modal">Modal (recommended) — opens the scheduler in an overlay on the same page</SelectItem>
                        <SelectItem value="redirect">Redirect — sends the visitor to the scheduler URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={LABEL_CLS}>Field map (optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">Map submitted field names to Chili Piper query params — one per line (SubmittedFieldName:cpParam). Defaults handle the standard Marketo casings (Email/email, FirstName, LastName, Phone, Company).</p>
                    <Textarea
                      rows={4}
                      className="text-sm font-mono"
                      placeholder={"Email:email\nFirstName:firstName\nLastName:lastName\nPhone:phone\nCompany:company"}
                      value={chiliPiperFieldMapText}
                      onChange={e => { setChiliPiperFieldMapText(e.target.value); setChiliPiperFieldMap(textToMappings(e.target.value)); }}
                      disabled={!local.chiliPiperConfig}
                    />
                  </div>
                </div>
              )}
            </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function FormsContent() {
  const { toast } = useToast();
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

  const duplicateForm = async (e: React.MouseEvent, form: GlobalForm) => {
    e.stopPropagation();
    const r = await fetch(`${API_BASE}/lp/forms/${form.id}/duplicate`, { method: "POST" });
    if (!r.ok) {
      toast({ title: "Couldn't duplicate form", variant: "destructive" });
      return;
    }
    const copy = await r.json() as GlobalForm;
    setForms(prev => [copy, ...prev]);
    toast({ title: "Form duplicated", description: `Created "${copy.name}"` });
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-form-id="${copy.id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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
    <div className="max-w-3xl mx-auto">
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
              <div className="flex items-center gap-2 shrink-0" data-form-id={form.id}>
                <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5 font-mono">ID {form.id}</span>
                <button
                  onClick={(e) => duplicateForm(e, form)}
                  title="Duplicate form"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create global forms once, link them to any landing page block. Manage fields and integrations in one place.
          </p>
        </div>
        <FormsContent />
      </div>
    </AppLayout>
  );
}
