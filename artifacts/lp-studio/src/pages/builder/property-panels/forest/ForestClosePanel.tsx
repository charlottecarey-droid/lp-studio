import type { ForestCloseBlockProps, ForestCloseMode, ForestPromise } from "@/blocks/BlockForestClose";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCtaSection, ForestStyleSection, GlobalFormPicker, ItemHeader, ListField, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestCloseBlockProps;
  onChange: (props: ForestCloseBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_PROMISES = 4;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ForestClosePanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<ForestCloseBlockProps>) => onChange({ ...props, ...patch });
  const promises = props.promises ?? [];
  const setPromises = (next: ForestPromise[]) => update({ promises: next });
  const mode: ForestCloseMode = props.mode === "button" ? "button" : "form";
  const clean = (list: string[]) => list.map((s) => s.replace(/\s+$/g, ""));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-close"
        fields={["eyebrow", "headline", "lede", "submitText", "fineprint"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", lede: props.lede ?? "", submitText: props.submitText ?? "", fineprint: props.fineprint ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Talk to the enterprise team" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-close", "headline", props.headline ?? "", { lede: props.lede ?? "" })} />
        </Field>
        <Field label="Lede">
          <AiTextField value={props.lede ?? ""} onChange={(v) => update({ lede: v })} rows={3} className="text-xs" fieldLabel="Lede"
            onSuggest={() => suggestCopy("forest-close", "lede", props.lede ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="talk" />
      </PanelSection>

      <PanelSection title={`Promises (${promises.length} of ${MAX_PROMISES})`} hint="Check-marked rows under the lede: a bold lead-in, then the rest of the line">
        {promises.map((x, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={x.title || `Promise ${i + 1}`} index={i} total={promises.length} onMove={(d) => setPromises(moveItem(promises, i, d))} onRemove={() => setPromises(promises.filter((_, idx) => idx !== i))} />
            <Input value={x.title} onChange={(e) => setPromises(promises.map((y, idx) => idx === i ? { ...y, title: e.target.value } : y))} placeholder="A specialist replies within one business day." className="h-7 text-xs" />
            <Input value={x.body ?? ""} onChange={(e) => setPromises(promises.map((y, idx) => idx === i ? { ...y, body: e.target.value } : y))} placeholder="Not a BDR cadence." className="h-7 text-xs" />
          </div>
        ))}
        <AddButton label="Add promise" disabled={promises.length >= MAX_PROMISES} onClick={() => setPromises([...promises, { title: "", body: "" }])} />
      </PanelSection>

      <PanelSection title="Lead routing" defaultOpen>
        <Field label="Right column">
          <Select value={mode} onValueChange={(v) => update({ mode: v === "button" ? "button" : "form" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="form" className="text-xs">Inline form (the glass card)</SelectItem>
              <SelectItem value="button" className="text-xs">Buttons (open a form modal or Chili Piper)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <GlobalFormPicker value={props.formId} onChange={(id) => update({ formId: id })} />
        <TextField label="Lead source label" value={props.source} onChange={(v) => update({ source: v })} placeholder="dso-page" />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Inline-form leads land on this page's Leads tab with name, email, organization and the qualifying answers, plus the page's UTM attribution. With a global form linked, the submission is filed under that form's field names (a Message field gets the locations / lab strategy / prompt lines) and its redirect applies.
        </p>
      </PanelSection>

      <PanelSection title="Card header strip" hint="The strip across the top of the card: an uppercase title left, a muted meta right. Clear both to drop it.">
        <TextField label="Title" value={props.formTitle} onChange={(v) => update({ formTitle: v })} placeholder="Working session request" />
        <TextField label="Meta" value={props.formMeta} onChange={(v) => update({ formMeta: v })} placeholder="30 min · routed by group size" />
      </PanelSection>

      <PanelSection title="Form fields (form mode)" defaultOpen={mode === "form"}>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Name label" value={props.nameLabel} onChange={(v) => update({ nameLabel: v })} placeholder="Name" />
          <TextField label="Email label" value={props.emailLabel} onChange={(v) => update({ emailLabel: v })} placeholder="Work email" />
        </div>
        <TextField label="Organization label" value={props.orgLabel} onChange={(v) => update({ orgLabel: v })} placeholder="Organization" />

        <Toggle label="Ask for role" checked={props.askRole ?? true} onChange={(v) => update({ askRole: v })} />
        {(props.askRole ?? true) && (
          <>
            <TextField label="Role label" value={props.roleLabel} onChange={(v) => update({ roleLabel: v })} placeholder="Role" />
            <ListField label="Role options" value={props.roleOptions ?? []} onChange={(v) => update({ roleOptions: clean(v) })} />
          </>
        )}
        <Toggle label="Ask for locations" checked={props.askLocations ?? true} onChange={(v) => update({ askLocations: v })} />
        {(props.askLocations ?? true) && (
          <>
            <TextField label="Locations label" value={props.locationsLabel} onChange={(v) => update({ locationsLabel: v })} placeholder="Locations" />
            <ListField label="Location options" value={props.locationOptions ?? []} onChange={(v) => update({ locationOptions: clean(v) })} />
          </>
        )}
        <Toggle label="Ask about lab strategy" checked={props.askStage ?? true} onChange={(v) => update({ askStage: v })} />
        {(props.askStage ?? true) && (
          <>
            <TextField label="Lab strategy label" value={props.stageLabel} onChange={(v) => update({ stageLabel: v })} placeholder="Lab strategy today" />
            <ListField label="Lab strategy options" value={props.stageOptions ?? []} onChange={(v) => update({ stageOptions: clean(v) })} />
          </>
        )}
        <Toggle label="Ask what prompted this" checked={props.askWhy ?? true} onChange={(v) => update({ askWhy: v })} />
        {(props.askWhy ?? true) && (
          <>
            <TextField label="Prompt label" value={props.whyLabel} onChange={(v) => update({ whyLabel: v })} placeholder="What prompted this" />
            <ListField label="Prompt options" value={props.whyOptions ?? []} onChange={(v) => update({ whyOptions: clean(v) })} />
          </>
        )}

        <TextField label="Submit button" value={props.submitText} onChange={(v) => update({ submitText: v })} placeholder="Book the working session" />
        <Field label="Fine print under the button">
          <Textarea value={props.fineprint ?? ""} onChange={(e) => update({ fineprint: e.target.value })} rows={2} className="text-xs" />
        </Field>
        <Field label="Success headline">
          <Textarea value={props.successHeadline ?? ""} onChange={(e) => update({ successHeadline: e.target.value })} rows={2} className="text-xs" />
        </Field>
        <TextField label="Success line" value={props.successBody} onChange={(v) => update({ successBody: v })} placeholder="Check your inbox for a calendar link." />
      </PanelSection>

      <PanelSection title="Button card (button mode)" defaultOpen={mode === "button"}>
        <Field label="Card headline">
          <AiTextField value={props.buttonHeadline ?? ""} onChange={(v) => update({ buttonHeadline: v })} rows={2} className="text-xs" fieldLabel="Card headline"
            onSuggest={() => suggestCopy("forest-close", "buttonHeadline", props.buttonHeadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <TextField label="Card line" value={props.buttonBody} onChange={(v) => update({ buttonBody: v })} rows={2} />
      </PanelSection>

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} title="Buttons (button mode)" defaultOpen={mode === "button"} primaryPlaceholder="Book the working session" secondaryPlaceholder="See how it works">
        <p className="text-[10px] leading-relaxed text-muted-foreground">Used when the right column is set to Buttons. The primary button's colour also paints the inline form's submit button.</p>
      </ForestCtaSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the deep forest band with the drifting orbs" />
    </div>
  );
}
