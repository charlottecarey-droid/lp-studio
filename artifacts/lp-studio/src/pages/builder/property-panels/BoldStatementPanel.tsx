import type { BoldStatementBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorField } from "./BlockSettingsPanel";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";

interface Props {
  props: BoldStatementBlockProps;
  onChange: (props: BoldStatementBlockProps) => void;
}

export function BoldStatementPanel({ props, onChange }: Props) {
  const update = (patch: Partial<BoldStatementBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="bold-statement"
        fields={["eyebrow", "statement"]}
        values={{ eyebrow: props.eyebrow ?? "", statement: props.statement }}
        onApply={(u) => update(u)}
      />
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={(e) => update({ eyebrow: e.target.value })}
            placeholder="MANIFESTO"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Statement</Label>
          <Textarea
            value={props.statement}
            onChange={(e) => update({ statement: e.target.value })}
            rows={4}
            className="text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            Wrap any word(s) in <code className="bg-muted px-1 rounded">&lt;em&gt;…&lt;/em&gt;</code> to
            render them in the accent color and italic. Example:
            <br />
            <code className="bg-muted px-1 rounded">Bold &lt;em&gt;moves&lt;/em&gt; win.</code>
          </p>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Footnote (optional)</Label>
          <Textarea
            value={props.footnote ?? ""}
            onChange={(e) => update({ footnote: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="Leave blank to hide"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Button text</Label>
            <Input
              value={props.ctaText ?? ""}
              onChange={(e) => update({ ctaText: e.target.value })}
              placeholder="Leave blank to hide"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Action</Label>
            <Select
              value={props.ctaAction ?? "url"}
              onValueChange={(v) => update({ ctaAction: v as BoldStatementBlockProps["ctaAction"] })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url" className="text-xs">Open URL</SelectItem>
                <SelectItem value="chilipiper" className="text-xs">Open Chili Piper</SelectItem>
                <SelectItem value="modal-form" className="text-xs">Open modal with form</SelectItem>
                <SelectItem value="modal-chilipiper" className="text-xs">Open modal → Chili Piper</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(props.ctaAction ?? "url") === "url" && (
          <div>
            <Label className="text-[11px] text-muted-foreground">URL</Label>
            <Input
              value={props.ctaUrl ?? ""}
              onChange={(e) => update({ ctaUrl: e.target.value })}
              placeholder="/signup"
              className="h-8 text-xs"
            />
          </div>
        )}
        {props.ctaAction === "chilipiper" && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
            <Input
              value={props.chilipiperUrl ?? ""}
              onChange={(e) => update({ chilipiperUrl: e.target.value })}
              placeholder="https://yourcompany.chilipiper.com/round-robin/..."
              className="h-8 text-xs font-mono"
            />
          </div>
        )}
        {(props.ctaAction === "modal-form" || props.ctaAction === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={props.ctaAction}
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={(v) => update({ bgColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={(v) => update({ textColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={(v) => update({ accentColor: v || undefined })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          The accent color is used for the eyebrow, the italicized words inside
          <code className="bg-muted px-1 rounded mx-0.5">&lt;em&gt;</code>,
          and the CTA button background.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scroll reveal</div>
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <Label className="text-xs">Light up text on scroll</Label>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Statement starts dim and brightens word-by-word as the visitor
              scrolls through the section (same effect as the AI feature
              block). Italic accent words still light up to the accent color.
            </p>
          </div>
          <Switch
            checked={!!props.scrollReveal}
            onCheckedChange={(v) => update({ scrollReveal: v })}
          />
        </div>
        {props.scrollReveal && (
          <div>
            <Label className="text-[11px] text-muted-foreground">Dim color (optional)</Label>
            <ColorField
              label=""
              value={props.dimColor ?? ""}
              onChange={(v) => update({ dimColor: v || undefined })}
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
              Leave blank to default to the text color at 20% opacity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
