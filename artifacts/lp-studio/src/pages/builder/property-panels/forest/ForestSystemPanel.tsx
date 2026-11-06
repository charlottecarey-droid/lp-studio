import type { ForestSystemBlockProps, ForestSystemMetaStat, ForestSystemStep } from "@/blocks/BlockForestSystem";
import { FOREST_SYSTEM_MAX_META, FOREST_SYSTEM_MAX_STEPS } from "@/blocks/BlockForestSystem";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "./ForestPanelKit";

interface Props {
  props: ForestSystemBlockProps;
  onChange: (props: ForestSystemBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MIN_STEPS = 2;

export function ForestSystemPanel({ props, onChange }: Props) {
  const update = (patch: Partial<ForestSystemBlockProps>) => onChange({ ...props, ...patch });
  const steps = props.steps ?? [];
  const setSteps = (next: ForestSystemStep[]) => update({ steps: next });
  const patchStep = (i: number, patch: Partial<ForestSystemStep>) => setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  /** The meta grid edits `metaStats`; a legacy step (single statValue/statLabel) is lifted into it on first edit. */
  const metaOf = (s: ForestSystemStep): ForestSystemMetaStat[] => (s.metaStats?.length ? s.metaStats : s.statValue || s.statLabel ? [{ value: s.statValue ?? "", label: s.statLabel ?? "" }] : []);
  const setMeta = (i: number, next: ForestSystemMetaStat[]) => patchStep(i, { metaStats: next });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="forest-system"
        fields={["eyebrow", "headline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="The system" />
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("forest-system", "headline", props.headline ?? "", { eyebrow: props.eyebrow ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Header link (blank hides it)"><Input value={props.headerLinkText ?? ""} onChange={(e) => update({ headerLinkText: e.target.value })} placeholder="How it works" className="h-7 text-xs" /></Field>
          <Field label="Link URL"><Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="system" />
      </PanelSection>

      <PanelSection title={`Steps (${steps.length} of ${FOREST_SYSTEM_MAX_STEPS})`} defaultOpen hint="The active step is the one crossing the middle of the screen; its photo shows in the sticky frame on wide screens and under the text on phones">
        {steps.map((s, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={s.kicker || `Step ${i + 1}`} index={i} total={steps.length} onMove={(d) => setSteps(moveItem(steps, i, d))} onRemove={() => { if (steps.length > MIN_STEPS) setSteps(steps.filter((_, idx) => idx !== i)); }} />
            <Input value={s.kicker} onChange={(e) => patchStep(i, { kicker: e.target.value })} placeholder="Kicker (Adoption)" className="h-7 text-xs" />
            <Input value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} placeholder="Title" className="h-7 text-xs" />
            <Textarea value={s.body} onChange={(e) => patchStep(i, { body: e.target.value })} placeholder="Paragraph" rows={3} className="text-xs" />
            <Field label={`Numbers under the paragraph (${metaOf(s).length} of ${FOREST_SYSTEM_MAX_META})`}>
              <div className="space-y-1.5">
                {metaOf(s).map((m, j) => (
                  <div key={j} className="grid grid-cols-[72px_minmax(0,1fr)_auto] gap-1.5">
                    <Input value={m.value} onChange={(e) => setMeta(i, metaOf(s).map((x, idx) => (idx === j ? { ...x, value: e.target.value } : x)))} placeholder="70%" className="h-7 text-xs" />
                    <Input value={m.label} onChange={(e) => setMeta(i, metaOf(s).map((x, idx) => (idx === j ? { ...x, label: e.target.value } : x)))} placeholder="of practices activate on training day" className="h-7 text-xs" />
                    <button type="button" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setMeta(i, metaOf(s).filter((_, idx) => idx !== j))} aria-label="Remove number">×</button>
                  </div>
                ))}
                <AddButton label="Add number" disabled={metaOf(s).length >= FOREST_SYSTEM_MAX_META} onClick={() => setMeta(i, [...metaOf(s), { value: "", label: "" }])} />
              </div>
            </Field>
            <Field label="Photo">
              <ImagePicker value={s.imageUrl ?? ""} onChange={(v) => patchStep(i, { imageUrl: v })} placeholder="Upload or paste image URL" aiHint={s.frameTitle || s.title} />
            </Field>
            <Input value={s.imageAlt ?? ""} onChange={(e) => patchStep(i, { imageAlt: e.target.value })} placeholder="Alt text" className="h-7 text-xs" />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={s.frameTitle ?? ""} onChange={(e) => patchStep(i, { frameTitle: e.target.value })} placeholder="Frame caption" className="h-7 text-xs" />
              <Input value={s.frameSub ?? ""} onChange={(e) => patchStep(i, { frameSub: e.target.value })} placeholder="Caption sub-line" className="h-7 text-xs" />
            </div>
          </div>
        ))}
        <AddButton
          label="Add step"
          disabled={steps.length >= FOREST_SYSTEM_MAX_STEPS}
          onClick={() => setSteps([...steps, { kicker: "New part", title: "What this part does.", body: "", statValue: "", statLabel: "", metaStats: [], imageUrl: "", imageAlt: "", frameTitle: "", frameSub: "" }])}
        />
        {steps.length <= MIN_STEPS && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least two steps.</p>}
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#003A30" hint="Dark presets paint the forest band; the frame sits on the deeper tone" />
    </div>
  );
}
