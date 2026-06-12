import type { CaseStudySpotlightFeatureBlockProps } from "@/lib/block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { ImagePicker } from "@/components/ImagePicker";

interface Props {
  props: CaseStudySpotlightFeatureBlockProps;
  onChange: (next: CaseStudySpotlightFeatureBlockProps) => void;
}

export function CaseStudySpotlightFeaturePanel({ props, onChange }: Props) {
  const update = (patch: Partial<CaseStudySpotlightFeatureBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</div>
        <BlockRefreshButton
          blockType="case-study-spotlight-feature"
          fields={["eyebrow", "company", "headline", "challenge", "solution", "result"]}
          values={{ eyebrow: props.eyebrow ?? "", company: props.company ?? "", headline: props.headline ?? "", challenge: props.challenge ?? "", solution: props.solution ?? "", result: props.result ?? "" }}
          onApply={(u) => onChange({ ...props, ...u })}
        />
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <AiTextField type="input" value={props.eyebrow ?? ""} onChange={(v) => update({ eyebrow: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-spotlight-feature", "eyebrow", props.eyebrow ?? "", { headline: props.headline ?? "" })} fieldLabel="Eyebrow" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Company</Label>
          <AiTextField type="input" value={props.company} onChange={(v) => update({ company: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "company", props.company ?? "", { headline: props.headline ?? "" })} fieldLabel="Company" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <AiTextField value={props.headline} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "headline", props.headline ?? "", { company: props.company ?? "" })} fieldLabel="Headline" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Pull-quote</Label>
          <AiTextField value={props.quote ?? ""} onChange={(v) => update({ quote: v })} rows={3} className="text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-spotlight-feature", "quote", props.quote ?? "", { company: props.company ?? "", headline: props.headline ?? "" })} fieldLabel="Pull-quote" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Story</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">The Challenge</Label>
          <AiTextField value={props.challenge} onChange={(v) => update({ challenge: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "challenge", props.challenge ?? "", { company: props.company ?? "" })} fieldLabel="Challenge" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">The Solution</Label>
          <AiTextField value={props.solution} onChange={(v) => update({ solution: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "solution", props.solution ?? "", { challenge: props.challenge ?? "" })} fieldLabel="Solution" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">The Result</Label>
          <AiTextField value={props.result} onChange={(v) => update({ result: v })} rows={3} className="text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "result", props.result ?? "", { solution: props.solution ?? "" })} fieldLabel="Result" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline metric</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Metric value</Label>
            <AiTextField type="input" value={props.metricValue} onChange={(v) => update({ metricValue: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "metricValue", props.metricValue ?? "", { metricLabel: props.metricLabel ?? "" })} fieldLabel="Metric value" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Metric label</Label>
            <AiTextField type="input" value={props.metricLabel} onChange={(v) => update({ metricLabel: v })} className="h-8 text-xs" onSuggest={() => suggestCopy("case-study-spotlight-feature", "metricLabel", props.metricLabel ?? "", { metricValue: props.metricValue ?? "" })} fieldLabel="Metric label" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</div>
        <ImagePicker value={props.imageUrl} onChange={(src) => update({ imageUrl: src })} label="Feature photo" aiHint={props.company ? `${props.company} team working` : "Customer team working"} />
        <Input value={props.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} placeholder="Image alt text (optional)" className="h-8 text-xs" />
        <ImagePicker value={props.logoUrl ?? ""} onChange={(src) => update({ logoUrl: src })} label="Customer logo badge (optional)" aiHint={props.company ? `${props.company} logo` : "Company logo"} />
        <Input value={props.logoAlt ?? ""} onChange={(e) => update({ logoAlt: e.target.value })} placeholder="Logo alt text (optional)" className="h-8 text-xs" />
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button label</Label>
          <AiTextField type="input" value={props.ctaLabel ?? ""} onChange={(v) => update({ ctaLabel: v })} className="h-8 text-xs" placeholder="Leave blank to hide" onSuggest={() => suggestCopy("case-study-spotlight-feature", "ctaLabel", props.ctaLabel ?? "", { headline: props.headline ?? "" })} fieldLabel="Button label" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Button URL</Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => update({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</div>
        <div className="grid grid-cols-2 gap-1">
          {([
            { value: false, label: "Plain" },
            { value: true, label: "Tinted panel" },
          ] as const).map((opt) => {
            const active = !!props.tintedPanel === opt.value;
            return (
              <Button
                key={String(opt.value)}
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => update({ tintedPanel: opt.value })}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Tinted panel wraps the spotlight in an accent-tinted rounded panel.</p>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#FFFFFF"
          onChange={(patch) => update(patch)}
        />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Card surface" value={props.surfaceColor ?? "#FFFFFF"} onChange={(v) => update({ surfaceColor: v })} />
          <ColorField label="Text" value={props.textColor ?? "#0F172A"} onChange={(v) => update({ textColor: v })} />
          <ColorField label="Accent" value={props.accentColor ?? "#4f46e5"} onChange={(v) => update({ accentColor: v })} />
        </div>
      </div>
    </div>
  );
}
