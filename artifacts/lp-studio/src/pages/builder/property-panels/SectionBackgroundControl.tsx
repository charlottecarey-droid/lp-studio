import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorField } from "./BlockSettingsPanel";
import {
  BACKGROUND_STYLE_KEYS,
  BACKGROUND_PRESET_DISPLAY_NAMES,
  type BackgroundStyle,
} from "@/lib/bg-styles";

/** Sentinel select value for the legacy custom-hex mode (no preset chosen). */
const CUSTOM = "__custom__";

export interface SectionBackgroundControlProps {
  /** The block's current `backgroundStyle` preset (undefined → custom color). */
  backgroundStyle?: string;
  /** The block's current custom `bgColor` hex. */
  bgColor?: string;
  /** Seed color shown in the picker when no custom color is set yet. */
  defaultBgColor?: string;
  /** Patch callback — merge the returned partial into the block props. Switching
   *  to a preset clears nothing else; switching to "Custom color" clears the
   *  preset so the block falls back to `bgColor`. */
  onChange: (patch: { backgroundStyle?: BackgroundStyle; bgColor?: string }) => void;
  /** Override the field label (defaults to "Background"). */
  label?: string;
}

/**
 * Shared editor control for a section block's background. Offers the full
 * brand-aware preset list (White / Light gray / Muted / Dark / Brand color /
 * Black / **Gradient**) plus a "Custom color" mode that reveals the legacy
 * `ColorField`. Wired through the shared bg-styles preset system; the renderer
 * resolves the chosen value via `resolveSectionSurface`.
 */
export function SectionBackgroundControl({
  backgroundStyle,
  bgColor,
  defaultBgColor = "#FFFFFF",
  onChange,
  label = "Background",
}: SectionBackgroundControlProps) {
  const isPreset =
    !!backgroundStyle && BACKGROUND_STYLE_KEYS.includes(backgroundStyle as BackgroundStyle);
  const mode = isPreset ? (backgroundStyle as string) : CUSTOM;

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
        <Select
          value={mode}
          onValueChange={(v) =>
            v === CUSTOM
              ? onChange({ backgroundStyle: undefined })
              : onChange({ backgroundStyle: v as BackgroundStyle })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CUSTOM}>Custom color</SelectItem>
            {BACKGROUND_STYLE_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {BACKGROUND_PRESET_DISPLAY_NAMES[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mode === CUSTOM && (
        <ColorField
          label="Background color"
          value={bgColor ?? defaultBgColor}
          onChange={(v) => onChange({ bgColor: v })}
        />
      )}
    </div>
  );
}
