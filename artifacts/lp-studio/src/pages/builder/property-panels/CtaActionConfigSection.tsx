import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import type { CtaSource, CtaActionMode } from "@/lib/cta/ctaConfig";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

/** Every action the suite can edit, with its dropdown label. Order is the
 *  display order. Panels can narrow this list via `allowedActions` when their
 *  block can't render a given action (e.g. a block whose renderer only handles
 *  url/chilipiper/modal-*, or a content-video block that reuses `videoUrl`). */
const ACTION_OPTIONS: ReadonlyArray<{ value: CtaActionMode; label: string }> = [
  { value: "url", label: "Link to URL" },
  { value: "chilipiper", label: "Chili Piper popup" },
  { value: "modal-form", label: "Open form modal" },
  { value: "modal-chilipiper", label: "Open email → Chili Piper modal" },
  { value: "video-modal", label: "Play video in modal" },
];

interface Props {
  value: CtaSuiteFields;
  onChange: (next: CtaSuiteFields) => void;
  /**
   * Restrict the action dropdown to this set (in this order). Omit to show all
   * actions (the default — preserves every panel migrated before this prop
   * existed). Use it so a block never offers an action its renderer can't honor.
   */
  allowedActions?: ReadonlyArray<CtaActionMode>;
  /**
   * Suppress the inline modal-config sub-section. Used by dual-CTA panels where
   * a SINGLE shared CtaButtonModalConfigSection is rendered once for whichever of
   * the primary/secondary CTAs opens a modal (the block has one CtaModalConfig).
   */
  hideModalConfig?: boolean;
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
  /**
   * True when this block's PRIMARY button currently FOLLOWS the Page CTA. When
   * set, the editor shows a notice and disables the primary-CTA fields, because
   * any edit is overridden at render time until the block opts out via the
   * "Use a custom button here" toggle (Style tab). Secondary CTAs are unaffected.
   */
  followingPageCta?: boolean;
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
export function CtaActionConfigSection({ value, onChange, source, hasOwnOverride, onOverride, onResetToInherit, allowedActions, hideModalConfig, followingPageCta }: Props) {
  const action = value.ctaAction ?? "url";
  const set = (patch: Partial<CtaSuiteFields>) => onChange({ ...value, ...patch });
  const inheriting = source != null && source !== "block";
  const actionOptions = allowedActions
    ? ACTION_OPTIONS.filter((o) => allowedActions.includes(o.value))
    : ACTION_OPTIONS;

  if (followingPageCta) {
    return (
      <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
        This button follows the <span className="font-semibold">Page CTA</span>.
        To set a different button here, turn on{" "}
        <span className="font-semibold">"Use a custom button here"</span> in the
        Style tab.
      </div>
    );
  }

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
            {actionOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
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

      {!hideModalConfig && (action === "modal-form" || action === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={action}
          value={value}
          onChange={(cfg) => onChange({ ...value, ...cfg })}
        />
      )}
    </div>
  );
}
