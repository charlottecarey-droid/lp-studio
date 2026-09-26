import type { InviteFormConfig, InviteFormField } from "@/blocks/invite/InviteLeadForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../glow/GlowPanelKit";

const ALL_FIELDS: Array<{ value: InviteFormField; label: string }> = [
  { value: "name", label: "Full name" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email (always on)" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "locations", label: "Number of locations (select)" },
  { value: "role", label: "Role (select)" },
  { value: "message", label: "Message (textarea)" },
];

/** Shared editor for the Invite family's lead-form config (hero inline form + reserve section). */
export function InviteFormFields({ value, onChange }: { value: InviteFormConfig; onChange: (patch: Partial<InviteFormConfig>) => void }) {
  const fields = value.fields ?? ["name", "email", "phone", "locations"];
  const toggle = (f: InviteFormField, on: boolean) => {
    if (f === "email") return;
    const next = on ? [...fields, f] : fields.filter((x) => x !== f);
    const order = ALL_FIELDS.map((x) => x.value);
    onChange({ fields: order.filter((x) => x === "email" || next.includes(x)) });
  };
  const source = value.formMode === "marketo" ? "marketo" : value.formId ? "global" : "native";

  return (
    <div className="space-y-3">
      <Field label="Form source">
        <Select value={source} onValueChange={(v) => onChange(v === "marketo" ? { formMode: "marketo" } : v === "global" ? { formMode: "native" } : { formMode: "native", formId: undefined })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="native" className="text-xs">Built-in fields</SelectItem>
            <SelectItem value="global" className="text-xs">Global form (by id)</SelectItem>
            <SelectItem value="marketo" className="text-xs">Marketo embed</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {source !== "marketo" && (
        <Field label="Global form id (blank = built-in fields)">
          <Input type="number" value={value.formId ?? ""} onChange={(e) => onChange({ formId: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-xs" />
        </Field>
      )}
      {source === "marketo" && (
        <div className="grid grid-cols-1 gap-2">
          <Input value={value.marketoBaseUrl ?? ""} onChange={(e) => onChange({ marketoBaseUrl: e.target.value })} placeholder="//app-xxx.marketo.com" className="h-8 text-xs" />
          <Input value={value.marketoMunchkinId ?? ""} onChange={(e) => onChange({ marketoMunchkinId: e.target.value })} placeholder="Munchkin ID" className="h-8 text-xs" />
          <Input type="number" value={value.marketoFormId ?? ""} onChange={(e) => onChange({ marketoFormId: e.target.value ? Number(e.target.value) : undefined })} placeholder="Marketo form id" className="h-8 text-xs" />
        </div>
      )}
      {source === "native" && (
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Fields (3–5 converts best)</Label>
          {ALL_FIELDS.map((f) => (
            <div key={f.value} className="flex items-center justify-between">
              <span className="text-xs">{f.label}</span>
              <Switch checked={f.value === "email" || fields.includes(f.value)} disabled={f.value === "email"} onCheckedChange={(c) => toggle(f.value, c)} />
            </div>
          ))}
          <Field label="Location options (comma-separated)">
            <Input value={(value.locationOptions ?? []).join(", ")} onChange={(e) => onChange({ locationOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-8 text-xs" />
          </Field>
          <Field label="Role options (comma-separated)">
            <Input value={(value.roleOptions ?? []).join(", ")} onChange={(e) => onChange({ roleOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-8 text-xs" />
          </Field>
        </div>
      )}
      <Field label="Button text"><Input value={value.ctaText ?? ""} onChange={(e) => onChange({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
      <Field label="Risk-reversal line"><Input value={value.riskLine ?? ""} onChange={(e) => onChange({ riskLine: e.target.value })} className="h-8 text-xs" placeholder="30 minutes. No commitment." /></Field>
      <Field label="Chili Piper booking URL (adds 'pick a time now')"><Input value={value.chilipiperUrl ?? ""} onChange={(e) => onChange({ chilipiperUrl: e.target.value })} className="h-8 text-xs" /></Field>
      <Field label="'Pick a time' link text"><Input value={value.pickTimeText ?? ""} onChange={(e) => onChange({ pickTimeText: e.target.value })} className="h-8 text-xs" /></Field>
      <Field label="Success headline"><Input value={value.successHeadline ?? ""} onChange={(e) => onChange({ successHeadline: e.target.value })} className="h-8 text-xs" /></Field>
      <Field label="Success message"><Textarea value={value.successMessage ?? ""} onChange={(e) => onChange({ successMessage: e.target.value })} rows={2} className="text-xs" /></Field>
      <Field label="Consent line"><Textarea value={value.consentText ?? ""} onChange={(e) => onChange({ consentText: e.target.value })} rows={2} className="text-xs" /></Field>
    </div>
  );
}

/** Colors shared by the family: surface, accent, text (blank = brand-derived). */
export { InviteColorFields } from "./InviteColorFields";
