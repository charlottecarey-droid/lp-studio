import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import {
  legacyBlockPropsToCtaConfig,
  ctaConfigToBlockProps,
  type CtaConfig,
} from "@/lib/cta/ctaConfig";

/**
 * Page Settings → "Page CTA". Define a SINGLE default CTA for the whole page
 * (primary + secondary label/action/destination, button style, form behavior,
 * Chili Piper / external URL / anchor). It sits BETWEEN the tenant default and
 * each block override in the resolver hierarchy (tenant < page < block): blocks
 * with no CTA of their own inherit it; blocks that set their own keep winning.
 *
 * The editor reuses the SHARED CtaActionConfigSection (the same suite ~77 block
 * panels edit) so the action vocabulary + modal config are identical everywhere.
 * The page CTA is stored as a normalized {@link CtaConfig}; we bridge to the
 * suite shape via the shim's full prop surface so the shared editor can be
 * reused verbatim with zero changes.
 */

// A block-like prop bag that declares every CTA key the suite editor edits, so
// the shim writes/reads every field (no "only declared keys" pruning loss when
// authoring a fresh page CTA from scratch).
const PAGE_CTA_PROP_TEMPLATE = {
  ctaText: "",
  ctaAction: "url",
  ctaUrl: "",
  chilipiperUrl: "",
  videoUrl: "",
  videoPosterUrl: "",
  ctaButtonColor: "",
  ctaButtonTextColor: "",
  ctaSecondaryText: "",
  ctaSecondaryAction: "url",
  ctaSecondaryUrl: "",
  secondaryChilipiperUrl: "",
  secondaryVideoUrl: "",
  modalChilipiperUrl: undefined,
  modalFormSource: undefined,
  modalFormId: undefined,
  modalMarketoBaseUrl: undefined,
  modalMarketoMunchkinId: undefined,
  modalMarketoFormId: undefined,
  modalChiliPiperHandoffUrl: undefined,
  modalChiliPiperHandoffMode: undefined,
  modalChiliPiperHandoffFieldMap: undefined,
  modalHeadline: undefined,
  modalSubheadline: undefined,
  modalSubmitText: undefined,
  modalSuccessMessage: undefined,
  modalDisclaimer: undefined,
  modalShowFirstName: undefined,
  modalShowLastName: undefined,
  modalShowPhone: undefined,
  modalShowCompany: undefined,
} as const;

interface Props {
  value: CtaConfig | null;
  onChange: (next: CtaConfig | null) => void;
}

export function PageCtaSection({ value, onChange }: Props) {
  const enabled = value != null;

  // Bridge CtaConfig ⇄ the suite editor's CtaSuiteFields via the shim. The
  // template guarantees every key is "declared" so authoring is lossless.
  const cfg = value ?? {};
  const props = ctaConfigToBlockProps("__page-cta", cfg, { ...PAGE_CTA_PROP_TEMPLATE });
  const suite: CtaSuiteFields = {
    ctaAction: props.ctaAction as CtaSuiteFields["ctaAction"],
    ctaUrl: props.ctaUrl as string | undefined,
    chilipiperUrl: props.chilipiperUrl as string | undefined,
    videoUrl: props.videoUrl as string | undefined,
    videoPosterUrl: props.videoPosterUrl as string | undefined,
    ...props,
  } as CtaSuiteFields;

  const writeFromProps = (nextProps: Record<string, unknown>) => {
    onChange(legacyBlockPropsToCtaConfig("__page-cta", nextProps));
  };

  const setLabel = (label: string) =>
    onChange({ ...(value ?? {}), label });

  const setSuite = (next: CtaSuiteFields) => {
    // Merge the edited suite fields back onto the full prop bag, then shim to
    // CtaConfig — preserving the label (owned outside the suite editor).
    const merged = { ...props, ...next };
    const back = legacyBlockPropsToCtaConfig("__page-cta", merged);
    onChange({ ...back, label: value?.label });
  };

  const setSecondary = (patch: Partial<NonNullable<CtaConfig["secondary"]>>) => {
    const base = value ?? {};
    onChange({ ...base, secondary: { ...(base.secondary ?? {}), ...patch } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium text-foreground">Page CTA</Label>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            One default CTA for the whole page. Sections without their own CTA inherit it.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => onChange(on ? { action: "url", url: "" } : null)}
          aria-label="Enable page-level CTA"
        />
      </div>

      {enabled && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Primary button label</Label>
            <Input
              value={value?.label ?? ""}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Book a meeting"
              className="h-8 text-xs"
            />
          </div>

          {/* Shared CTA action + modal suite (action mode, destinations, form/
              Chili Piper modal). Identical to every block's CTA editor. */}
          <CtaActionConfigSection value={suite} onChange={setSuite} />

          {/* Per-CTA button colors (optional overrides over the brand fill). */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Button fill</Label>
              <Input
                type="text"
                value={value?.buttonColor ?? ""}
                onChange={(e) => onChange({ ...(value ?? {}), buttonColor: e.target.value })}
                placeholder="#4B47E5"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Button text</Label>
              <Input
                type="text"
                value={value?.buttonTextColor ?? ""}
                onChange={(e) => onChange({ ...(value ?? {}), buttonTextColor: e.target.value })}
                placeholder="#FFFFFF"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Optional secondary CTA. */}
          <div className="border-t border-border pt-2 space-y-2">
            <Label className="text-[11px] text-muted-foreground">Secondary button (optional)</Label>
            <Input
              value={value?.secondary?.label ?? ""}
              onChange={(e) => setSecondary({ label: e.target.value })}
              placeholder="Watch the film"
              className="h-8 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={value?.secondary?.action ?? "url"}
                onValueChange={(v) => setSecondary({ action: v as NonNullable<CtaConfig["secondary"]>["action"] })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url" className="text-xs">Link to URL</SelectItem>
                  <SelectItem value="chilipiper" className="text-xs">Chili Piper popup</SelectItem>
                  <SelectItem value="video-modal" className="text-xs">Video modal</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={value?.secondary?.url ?? ""}
                onChange={(e) => setSecondary({ url: e.target.value })}
                placeholder="#"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => writeFromProps({ ...PAGE_CTA_PROP_TEMPLATE })}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Reset page CTA fields
          </button>
        </div>
      )}
    </div>
  );
}
