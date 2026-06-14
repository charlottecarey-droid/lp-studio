import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CtaSecondaryFields } from "@/lib/cta-modal";
import type { CtaActionMode } from "@/lib/cta/ctaConfig";

/**
 * Shared editor for a block's SECONDARY CTA (label + action + destination),
 * writing the canonical secondary keys (ctaSecondaryText / ctaSecondaryAction /
 * ctaSecondaryUrl / secondaryChilipiperUrl / secondaryVideoUrl) so every block
 * configures its secondary CTA identically — the counterpart to the shared
 * CtaActionConfigSection for primaries.
 *
 * The secondary CTA reuses the block's single CtaModalConfig (shared with the
 * primary), so a modal action ("modal-form" / "modal-chilipiper") renders no
 * config here — the panel renders ONE CtaButtonModalConfigSection for whichever
 * CTA opens a modal. Pass `allowedActions` to match what the block's renderer
 * supports (e.g. omit "video-modal" until the renderer plays a secondary video).
 */

const ACTION_OPTIONS: ReadonlyArray<{ value: CtaActionMode; label: string }> = [
  { value: "url", label: "Link to URL" },
  { value: "chilipiper", label: "Chili Piper popup" },
  { value: "modal-form", label: "Open form modal" },
  { value: "modal-chilipiper", label: "Open email → Chili Piper modal" },
  { value: "video-modal", label: "Play video in modal" },
];

const DEFAULT_ACTIONS: ReadonlyArray<CtaActionMode> = ["url", "chilipiper", "video-modal"];

interface Props {
  value: CtaSecondaryFields;
  onChange: (next: CtaSecondaryFields) => void;
  /** Restrict the action dropdown. Defaults to url / chilipiper / video-modal. */
  allowedActions?: ReadonlyArray<CtaActionMode>;
  /** Label for the section header. Defaults to "Secondary CTA". */
  heading?: string;
  /** Placeholder for the button-label input. */
  labelPlaceholder?: string;
}

export function CtaSecondaryConfigSection({ value, onChange, allowedActions, heading, labelPlaceholder }: Props) {
  const action = (value.ctaSecondaryAction ?? "url") as CtaActionMode;
  const set = (patch: Partial<CtaSecondaryFields>) => onChange({ ...value, ...patch });
  const options = ACTION_OPTIONS.filter((o) => (allowedActions ?? DEFAULT_ACTIONS).includes(o.value));

  return (
    <div className="space-y-2 border rounded-md p-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{heading ?? "Secondary CTA"}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Text</Label>
          <Input
            value={value.ctaSecondaryText ?? ""}
            onChange={(e) => set({ ctaSecondaryText: e.target.value })}
            placeholder={labelPlaceholder ?? "Leave blank to hide"}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Action</Label>
          <Select
            value={action}
            onValueChange={(v) => set({ ctaSecondaryAction: v as CtaSecondaryFields["ctaSecondaryAction"] })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {action === "url" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">URL</Label>
          <Input
            value={value.ctaSecondaryUrl ?? ""}
            onChange={(e) => set({ ctaSecondaryUrl: e.target.value })}
            placeholder="#"
            className="h-8 text-xs font-mono"
          />
        </div>
      )}

      {action === "chilipiper" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
          <Input
            value={value.secondaryChilipiperUrl ?? ""}
            onChange={(e) => set({ secondaryChilipiperUrl: e.target.value })}
            placeholder="https://yourcompany.chilipiper.com/..."
            className="h-8 text-xs font-mono"
          />
        </div>
      )}

      {action === "video-modal" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Video URL</Label>
          <Input
            value={value.secondaryVideoUrl ?? ""}
            onChange={(e) => set({ secondaryVideoUrl: e.target.value })}
            placeholder="https://… .mp4 or YouTube/Vimeo"
            className="h-8 text-xs font-mono"
          />
        </div>
      )}

      {/* modal-form / modal-chilipiper: the shared block-level modal config (one
          per block) is rendered by the panel, not here. */}
    </div>
  );
}
