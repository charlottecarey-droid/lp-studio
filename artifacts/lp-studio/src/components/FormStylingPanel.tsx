import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, RotateCcw } from "lucide-react";
import {
  type FormStyling,
  FORM_STYLING_AVP_PRESET,
  hasFormStyling,
} from "@/lib/form-styling";

const LABEL_CLS =
  "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

export interface FormStylingPanelProps {
  styling: FormStyling | null;
  onChange: (s: FormStyling | null) => void;
  /**
   * Optional fallback shown as the placeholder for each empty token,
   * so editors can see the brand-default value they're overriding
   * (e.g. on the per-form Style tab, this is the brand's formStyling).
   */
  placeholderLayer?: FormStyling | null;
  /** Override the explanatory copy in the header card. */
  helpText?: string;
  /** Override the AVP preset button label. */
  presetLabel?: string;
}

/**
 * Shared form-styling editor. Used by:
 *   - Brand Settings → Form & Modal Styling (brand-default tokens)
 *   - Forms → per-form Style tab (per-form overrides; `placeholderLayer`
 *     surfaces the brand defaults as muted placeholders so operators
 *     see what they'd inherit if they leave a token blank).
 *
 * All tokens are independent — leaving any field blank lets the next
 * layer in the resolution chain win (see `mergeFormStyling`).
 */
export function FormStylingPanel({
  styling,
  onChange,
  placeholderLayer,
  helpText,
  presetLabel = "Inside Dandy / AVP",
}: FormStylingPanelProps) {
  const s = styling ?? {};
  const active = hasFormStyling(styling);
  const patch = (k: keyof FormStyling, v: string | undefined) => {
    const next: FormStyling = { ...s };
    if (v && v.trim()) (next as Record<string, string>)[k as string] = v;
    else delete (next as Record<string, unknown>)[k as string];
    onChange(hasFormStyling(next) ? next : null);
  };
  const applyAvp = () => onChange({ ...FORM_STYLING_AVP_PRESET });
  const clearAll = () => onChange(null);

  const colorRow = (key: keyof FormStyling, label: string, hint?: string) => {
    const val = (s[key] as string | undefined) ?? "";
    const placeholder = (placeholderLayer?.[key] as string | undefined) ?? "—";
    const isHex = /^#[0-9a-fA-F]{6}$/.test(val);
    return (
      <div
        key={key}
        className="grid grid-cols-[1fr_auto_72px] gap-2 items-center"
      >
        <div>
          <Label className={LABEL_CLS + " !mb-0.5"}>{label}</Label>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
        <Input
          value={val}
          onChange={(e) => patch(key, e.target.value)}
          placeholder={placeholder}
          className="text-xs font-mono h-8 w-44"
        />
        <input
          type="color"
          value={isHex ? val : "#000000"}
          onChange={(e) => patch(key, e.target.value)}
          className="h-8 w-full rounded cursor-pointer border border-border bg-transparent"
          title="Pick color (only writes hex)"
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Visual theme</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {helpText ??
                "Overrides the per-block colors on every form block that links to this form. Leave everything blank to fall back to each block's own styling."}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="default"
              className="gap-1"
              onClick={applyAvp}
            >
              <Sparkles className="w-3.5 h-3.5" /> {presetLabel}
            </Button>
            {active && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={clearAll}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Status:{" "}
          <span className={active ? "text-foreground font-semibold" : ""}>
            {active ? "Custom styling on" : "Using defaults"}
          </span>
        </p>
      </div>

      <div className="border rounded-lg p-3 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stage
        </p>
        {colorRow("background", "Section background", "Behind the card. CSS color or gradient.")}
        {colorRow("surface", "Card surface", "Inner panel holding the fields.")}
        {colorRow("border", "Card border", "1px outline on the card.")}
      </div>

      <div className="border rounded-lg p-3 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Typography colors
        </p>
        {colorRow("headlineColor", "Headline")}
        {colorRow("subheadlineColor", "Subheadline")}
        {colorRow("labelColor", "Field labels")}
      </div>

      <div className="border rounded-lg p-3 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </p>
        {colorRow("inputBg", "Input background")}
        {colorRow("inputBorder", "Input border")}
        {colorRow("inputText", "Input text")}
        {colorRow("accent", "Accent", "Focus ring + multi-step progress fill.")}
      </div>

      <div className="border rounded-lg p-3 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Submit button
        </p>
        {colorRow("buttonBg", "Background")}
        {colorRow("buttonText", "Text")}
      </div>

      <div className="border rounded-lg p-3 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fonts (optional)
        </p>
        <div>
          <Label className={LABEL_CLS}>Display font (CSS family)</Label>
          <Input
            value={s.fontDisplay ?? ""}
            onChange={(e) => patch("fontDisplay", e.target.value)}
            placeholder={placeholderLayer?.fontDisplay ?? "e.g. 'Bagoss Standard', Georgia, serif"}
            className="text-xs font-mono"
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Body font (CSS family)</Label>
          <Input
            value={s.fontBody ?? ""}
            onChange={(e) => patch("fontBody", e.target.value)}
            placeholder={placeholderLayer?.fontBody ?? "e.g. 'Inter', system-ui, sans-serif"}
            className="text-xs font-mono"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Leave blank to use the brand fonts on the rendered page.
        </p>
      </div>
    </div>
  );
}
