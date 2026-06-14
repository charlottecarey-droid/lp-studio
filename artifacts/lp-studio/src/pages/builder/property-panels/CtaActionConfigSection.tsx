import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type { CtaSource } from "@/lib/cta/ctaConfig";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  value: CtaSuiteFields;
  onChange: (next: CtaSuiteFields) => void;
  /**
   * Unified CTA architecture (Phase 1) — source indicator. When provided, shows
   * which hierarchy layer is supplying this block's EFFECTIVE CTA:
   *   "tenant" → "Using tenant default", "page" → "Using page override",
   *   "block"  → "Using block override", "none" → no CTA configured anywhere.
   * Optional + additive: panels that don't pass it render exactly as before.
   */
  source?: CtaSource;
  /** True when this block has its OWN CTA (overrides the inherited one). */
  hasOwnOverride?: boolean;
  /** "Override for this block" — start a block-level CTA (copies the inherited
   *  effective config into the block so the editor below becomes live). */
  onOverride?: () => void;
  /** "Reset to inherit" — clear the block-level CTA so it inherits page/tenant. */
  onResetToInherit?: () => void;
}

const SOURCE_LABEL: Record<CtaSource, string> = {
  tenant: "Using tenant default",
  page: "Using page override",
  block: "Using block override",
  none: "No CTA configured",
};

/**
 * Shared editor for the full CTA-button action suite (action mode + per-action
 * destination + modal config). Reused by every CTA-bearing block panel. The
 * button LABEL is owned by the parent panel (labels differ across blocks).
 */
export function CtaActionConfigSection({ value, onChange, source, hasOwnOverride, onOverride, onResetToInherit }: Props) {
  const action = value.ctaAction ?? "url";
  const set = (patch: Partial<CtaSuiteFields>) => onChange({ ...value, ...patch });
  const inheriting = source != null && source !== "block";

  return (
    <div className="space-y-3">
      {source != null && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
          <span
            className={
              "text-[10px] font-medium " +
              (source === "block" ? "text-primary" : source === "none" ? "text-muted-foreground" : "text-amber-600")
            }
          >
            {SOURCE_LABEL[source]}
          </span>
          {inheriting && onOverride && (
            <button
              type="button"
              onClick={onOverride}
              className="text-[10px] text-primary hover:underline"
            >
              Override for this block
            </button>
          )}
          {hasOwnOverride && onResetToInherit && (
            <button
              type="button"
              onClick={onResetToInherit}
              className="text-[10px] text-muted-foreground hover:text-destructive hover:underline"
            >
              Reset to inherit
            </button>
          )}
        </div>
      )}
      <div>
        <Label className="text-[11px] text-muted-foreground">Button action</Label>
        <Select value={action} onValueChange={(v) => set({ ctaAction: v as CtaSuiteFields["ctaAction"] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url" className="text-xs">Link to URL</SelectItem>
            <SelectItem value="chilipiper" className="text-xs">Chili Piper popup</SelectItem>
            <SelectItem value="modal-form" className="text-xs">Open form modal</SelectItem>
            <SelectItem value="modal-chilipiper" className="text-xs">Open email → Chili Piper modal</SelectItem>
            <SelectItem value="video-modal" className="text-xs">Open video modal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action === "url" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Destination URL</Label>
          <Input value={value.ctaUrl ?? ""} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="#" className="h-8 text-xs font-mono" />
        </div>
      )}

      {action === "chilipiper" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
          <Input value={value.chilipiperUrl ?? ""} onChange={(e) => set({ chilipiperUrl: e.target.value })} placeholder="https://yourcompany.chilipiper.com/router/your-router" className="h-8 text-xs font-mono" />
        </div>
      )}

      {action === "video-modal" && (
        <div className="space-y-2">
          <VideoPicker label="Video" value={value.videoUrl ?? ""} onChange={(v) => set({ videoUrl: v })} />
          <ImagePicker label="Video poster (optional)" value={value.videoPosterUrl ?? ""} onChange={(v) => set({ videoPosterUrl: v })} aiHint="video poster frame" />
        </div>
      )}

      {(action === "modal-form" || action === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={action}
          value={value}
          onChange={(cfg) => onChange({ ...value, ...cfg })}
        />
      )}
    </div>
  );
}
