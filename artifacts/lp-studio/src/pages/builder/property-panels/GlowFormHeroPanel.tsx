import type { GlowFormHeroBlockProps, GlowFormField } from "@/blocks/BlockGlowFormHero";
import type { SocialProofLogo } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { IconPicker } from "@/components/IconPicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { Field, GlowColorFields, ItemHeader, PanelSection, moveItem } from "./glow/GlowPanelKit";
import { Plus, Trash2 } from "lucide-react";

const ALL_FIELDS: Array<{ value: GlowFormField; label: string }> = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Work email (always required)" },
  { value: "company", label: "Company" },
  { value: "locations", label: "Number of locations (select)" },
  { value: "role", label: "Role (select)" },
  { value: "phone", label: "Phone" },
];

interface Props {
  props: GlowFormHeroBlockProps;
  onChange: (props: GlowFormHeroBlockProps) => void;
}

export function GlowFormHeroPanel({ props, onChange }: Props) {
  const update = (patch: Partial<GlowFormHeroBlockProps>) => onChange({ ...props, ...patch });
  const bullets = props.bullets ?? [];
  const logos = props.logos ?? [];
  const fields = props.fields ?? ["firstName", "lastName", "email", "company", "locations"];
  const setLogos = (next: SocialProofLogo[]) => update({ logos: next });
  const toggleField = (f: GlowFormField, on: boolean) => {
    if (f === "email") return;
    const next = on ? (fields.includes(f) ? fields : [...fields, f]) : fields.filter((x) => x !== f);
    // Keep email present and the canonical order.
    const order = ALL_FIELDS.map((x) => x.value);
    update({ fields: order.filter((x) => next.includes(x) || x === "email") });
  };

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="glow-form-hero"
        fields={["eyebrow", "headline", "subheadline", "ctaText", "riskLine"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "", ctaText: props.ctaText ?? "", riskLine: props.riskLine ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Eyebrow"><Input value={props.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className="h-8 text-xs" /></Field>
        <IconPicker label="Eyebrow icon" value={props.eyebrowIcon ?? ""} onChange={(v) => update({ eyebrowIcon: v })} aiHint="Calendar icon" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("glow-form-hero", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} fieldLabel="Headline" />
        </Field>
        <Field label="Subheadline"><Textarea value={props.subheadline ?? ""} onChange={(e) => update({ subheadline: e.target.value })} rows={3} className="text-xs" /></Field>
        <Field label="What they get (one per line)">
          <Textarea value={bullets.join("\n")} onChange={(e) => update({ bullets: e.target.value.split("\n").filter((l) => l.trim().length > 0) })} rows={3} className="text-xs" placeholder="A baseline of where you stand today" />
        </Field>
      </PanelSection>

      <PanelSection title="Proof beside the copy" hint="Label + wordmarks / logos">
        <Field label="Proof text"><Input value={props.proofText ?? ""} onChange={(e) => update({ proofText: e.target.value })} className="h-8 text-xs" placeholder="Trusted by teams at" /></Field>
        <div className="space-y-2">
          {logos.map((logo, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <ItemHeader label={logo.name || `Logo ${i + 1}`} index={i} total={logos.length} onMove={(dir) => setLogos(moveItem(logos, i, dir))} onRemove={() => setLogos(logos.filter((_, idx) => idx !== i))} />
              <Input value={logo.name} onChange={(e) => setLogos(logos.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)))} placeholder="Company name" className="h-8 text-xs" />
              <ImagePicker value={logo.imageUrl ?? ""} onChange={(url) => setLogos(logos.map((l, idx) => (idx === i ? { ...l, imageUrl: url || undefined } : l)))} placeholder="Logo image (optional)" />
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setLogos([...logos, { name: "New logo" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add logo
        </Button>
      </PanelSection>

      <PanelSection title="Form" defaultOpen>
        <Field label="Card title"><Input value={props.formTitle ?? ""} onChange={(e) => update({ formTitle: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Card subtitle"><Input value={props.formSubtitle ?? ""} onChange={(e) => update({ formSubtitle: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Incentive chip (optional)"><Input value={props.incentiveText ?? ""} onChange={(e) => update({ incentiveText: e.target.value })} className="h-8 text-xs" placeholder="$250 gift card after your demo" /></Field>
        <Field label="Form source">
          <Select value={props.formMode === "marketo" ? "marketo" : props.formId ? "global" : "native"} onValueChange={(v) => update(v === "marketo" ? { formMode: "marketo" } : v === "global" ? { formMode: "native" } : { formMode: "native", formId: undefined })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="native" className="text-xs">Built-in fields (below)</SelectItem>
              <SelectItem value="global" className="text-xs">Global form (by id)</SelectItem>
              <SelectItem value="marketo" className="text-xs">Marketo embed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {props.formMode !== "marketo" && (
          <Field label="Global form id (blank = built-in fields)">
            <Input type="number" value={props.formId ?? ""} onChange={(e) => update({ formId: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-xs" />
          </Field>
        )}
        {props.formMode === "marketo" && (
          <div className="grid grid-cols-1 gap-2">
            <Input value={props.marketoBaseUrl ?? ""} onChange={(e) => update({ marketoBaseUrl: e.target.value })} placeholder="//app-xxx.marketo.com" className="h-8 text-xs" />
            <Input value={props.marketoMunchkinId ?? ""} onChange={(e) => update({ marketoMunchkinId: e.target.value })} placeholder="Munchkin ID" className="h-8 text-xs" />
            <Input type="number" value={props.marketoFormId ?? ""} onChange={(e) => update({ marketoFormId: e.target.value ? Number(e.target.value) : undefined })} placeholder="Marketo form id" className="h-8 text-xs" />
          </div>
        )}
        {props.formMode !== "marketo" && !props.formId && (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Built-in fields (3–5 converts best)</Label>
            {ALL_FIELDS.map((f) => (
              <div key={f.value} className="flex items-center justify-between">
                <span className="text-xs">{f.label}</span>
                <Switch checked={f.value === "email" || fields.includes(f.value)} disabled={f.value === "email"} onCheckedChange={(c) => toggleField(f.value, c)} />
              </div>
            ))}
            <Field label="Location options (comma-separated)">
              <Input value={(props.locationOptions ?? []).join(", ")} onChange={(e) => update({ locationOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-8 text-xs" />
            </Field>
            <Field label="Role options (comma-separated)">
              <Input value={(props.roleOptions ?? []).join(", ")} onChange={(e) => update({ roleOptions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-8 text-xs" />
            </Field>
          </div>
        )}
        <Field label="Button text"><Input value={props.ctaText ?? ""} onChange={(e) => update({ ctaText: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Risk-reversal line under the button"><Input value={props.riskLine ?? ""} onChange={(e) => update({ riskLine: e.target.value })} className="h-8 text-xs" placeholder="30 minutes. No commitment." /></Field>
        <Field label="Chili Piper booking URL (adds 'pick a time now' + post-submit booking)"><Input value={props.chilipiperUrl ?? ""} onChange={(e) => update({ chilipiperUrl: e.target.value })} className="h-8 text-xs" placeholder="https://…chilipiper.com/…" /></Field>
        <Field label="'Pick a time' link text"><Input value={props.pickTimeText ?? ""} onChange={(e) => update({ pickTimeText: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Success headline"><Input value={props.successHeadline ?? ""} onChange={(e) => update({ successHeadline: e.target.value })} className="h-8 text-xs" /></Field>
        <Field label="Success message"><Textarea value={props.successMessage ?? ""} onChange={(e) => update({ successMessage: e.target.value })} rows={2} className="text-xs" /></Field>
        <Field label="Consent line"><Textarea value={props.consentText ?? ""} onChange={(e) => update({ consentText: e.target.value })} rows={2} className="text-xs" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Button color" value={props.ctaButtonColor ?? ""} onChange={(v) => update({ ctaButtonColor: v || undefined })} />
          <ColorField label="Button text" value={props.ctaButtonTextColor ?? ""} onChange={(v) => update({ ctaButtonTextColor: v || undefined })} />
        </div>
      </PanelSection>

      <PanelSection title="Colors">
        <GlowColorFields value={props} onChange={(p) => update(p)} />
      </PanelSection>

      {bullets.length === 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Trash2 className="w-3 h-3" /> No checklist items — the copy column shows headline and subheadline only.</p>
      )}
    </div>
  );
}
