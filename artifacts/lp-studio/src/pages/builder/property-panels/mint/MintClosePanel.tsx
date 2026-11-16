import type { MintCloseBlockProps } from "@/blocks/BlockMintClose";
import type { ForestCloseMode, ForestPromise } from "@/blocks/BlockForestClose";
import { Input } from "@/components/ui/input";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestCloseFormSection, ForestCtaSection, ForestStyleSection, ItemHeader, ListField, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

const MAX_PROMISES = 4;

interface Props {
  props: MintCloseBlockProps;
  onChange: (props: MintCloseBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function MintClosePanel({ props, onChange, ctaSource }: Props) {
  const update = (patch: Partial<MintCloseBlockProps>) => onChange({ ...props, ...patch });
  const mode: ForestCloseMode = props.mode === "button" ? "button" : "form";
  const builtin = mode === "form" && props.formMode !== "marketo" && !props.formId;
  const clean = (list: string[]) => list.map((s) => s.replace(/\s+$/g, ""));
  const promises = props.promises ?? [];
  const setPromises = (next: ForestPromise[]) => update({ promises: next });
  const setPromise = (i: number, patch: Partial<ForestPromise>) => setPromises(promises.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-close"
        fields={["eyebrow", "headline", "lede", "submitText", "fineprint", "altText"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", lede: props.lede ?? "", submitText: props.submitText ?? "", fineprint: props.fineprint ?? "", altText: props.altText ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Talk to the enterprise team" />
        <Field label="Headline (one line per row)">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-close", "headline", props.headline ?? "", { lede: props.lede ?? "" })} />
        </Field>
        <Field label="Supporting line">
          <AiTextField value={props.lede ?? ""} onChange={(v) => update({ lede: v })} rows={3} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-close", "lede", props.lede ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <TextField label="Line under the grid (Prefer to call? …)" value={props.altText} onChange={(v) => update({ altText: v })} placeholder="Prefer to call? Enterprise team: 1-800-000-0000" />
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="talk" />
      </PanelSection>

      <PanelSection title={`Promises (${promises.length} of ${MAX_PROMISES})`} defaultOpen>
        {promises.map((x, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={x.title || `Promise ${i + 1}`} index={i} total={promises.length} onMove={(d) => setPromises(moveItem(promises, i, d))} onRemove={() => setPromises(promises.filter((_, idx) => idx !== i))} />
            <Field label="Lead-in (bold)">
              <Input value={x.title} onChange={(e) => setPromise(i, { title: e.target.value })} placeholder="A specialist replies within one business day." className="h-7 text-xs" />
            </Field>
            <Field label="Rest of the line">
              <Textarea value={x.body ?? ""} onChange={(e) => setPromise(i, { body: e.target.value })} rows={2} className="text-xs" placeholder="Not an automated cadence." />
            </Field>
          </div>
        ))}
        <AddButton label="Add promise" disabled={promises.length >= MAX_PROMISES} onClick={() => setPromises([...promises, { title: "New promise", body: "" }])} />
      </PanelSection>

      <ForestCloseFormSection value={props} onChange={update} />

      {mode === "form" && <PanelSection title="Card header" hint="Clear both to hide it">
        <TextField label="Title" value={props.formTitle} onChange={(v) => update({ formTitle: v })} placeholder="Working session request" />
        <TextField label="Meta" value={props.formMeta} onChange={(v) => update({ formMeta: v })} placeholder="30 min · routed by group size" />
      </PanelSection>}

      {builtin && <PanelSection title="Built-in fields" defaultOpen>
        <TextField label="Lead source label" value={props.source} onChange={(v) => update({ source: v })} placeholder="dso-page" />
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
        <Toggle label="Add a fourth select (what prompted this)" checked={props.askWhy ?? false} onChange={(v) => update({ askWhy: v })} />
        {(props.askWhy ?? false) && (
          <>
            <TextField label="Prompt label" value={props.whyLabel} onChange={(v) => update({ whyLabel: v })} placeholder="What prompted this" />
            <ListField label="Prompt options" value={props.whyOptions ?? []} onChange={(v) => update({ whyOptions: clean(v) })} />
          </>
        )}

        <TextField label="Submit button" value={props.submitText} onChange={(v) => update({ submitText: v })} placeholder="Book the working session" />
        <Field label="Fine print under the button">
          <Textarea value={props.fineprint ?? ""} onChange={(e) => update({ fineprint: e.target.value })} rows={2} className="text-xs" />
        </Field>
        <TextField label="Success headline" value={props.successHeadline} onChange={(v) => update({ successHeadline: v })} placeholder="Thank you." />
        <TextField label="Success line" value={props.successBody} onChange={(v) => update({ successBody: v })} placeholder="A specialist will reply within one business day." />
      </PanelSection>}

      <ForestCtaSection value={props} onChange={onChange} ctaSource={ctaSource} title={mode === "button" ? "Buttons" : "Button colors"} defaultOpen={mode === "button"} primaryPlaceholder="Book the working session" secondaryPlaceholder="See how it works" />

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" />
    </div>
  );
}
