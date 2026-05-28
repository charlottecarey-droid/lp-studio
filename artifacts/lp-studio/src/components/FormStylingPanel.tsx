import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, RotateCcw } from "lucide-react";
import {
  type FormStyling,
  FORM_STYLING_AVP_PRESET,
  hasFormStyling,
  mergeFormStyling,
} from "@/lib/form-styling";

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
  /** Override the preset button label. */
  presetLabel?: string;
  /**
   * Optional preset to apply when the "preset" button is pressed. Falls
   * back to the hardcoded Inside-Dandy / AVP preset (used by the per-form
   * Style tab). Brand Settings passes a brand-aware Dark preset so other
   * tenants get their own primary/accent baked in.
   */
  presetValues?: FormStyling;
  /**
   * Additional one-click presets shown alongside the primary preset
   * button. Lets Brand Settings expose both a Light *and* Dark option
   * (driven by the tenant's brand colors) without changing the existing
   * single-preset call sites.
   */
  extraPresets?: Array<{ label: string; values: FormStyling }>;
  /** Render an inline live preview of the form using the resolved tokens. */
  showPreview?: boolean;
}

/**
 * Shared form-styling editor. Used by:
 *   - Brand Settings → Form & Modal Styling (brand-default tokens, with
 *     a live preview and a brand-aware Dark preset).
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
  presetValues,
  extraPresets,
  showPreview = false,
}: FormStylingPanelProps) {
  const s = styling ?? {};
  const active = hasFormStyling(styling);
  const patch = (k: keyof FormStyling, v: string | undefined) => {
    const next: FormStyling = { ...s };
    if (v && v.trim()) (next as Record<string, string>)[k as string] = v;
    else delete (next as Record<string, unknown>)[k as string];
    onChange(hasFormStyling(next) ? next : null);
  };
  const applyPreset = () => onChange({ ...(presetValues ?? FORM_STYLING_AVP_PRESET) });
  const clearAll = () => onChange(null);

  // Resolved styling for the live preview (brand defaults → current overrides).
  const resolved = mergeFormStyling(placeholderLayer, styling) ?? {};

  const colorRow = (key: keyof FormStyling, label: string, hint?: string) => {
    const val = (s[key] as string | undefined) ?? "";
    const placeholder = (placeholderLayer?.[key] as string | undefined) ?? "—";
    const isHex = /^#[0-9a-fA-F]{6}$/.test(val);
    const swatchColor = val || placeholder;
    return (
      <div key={key} className="flex items-center gap-2 py-1">
        {/* Swatch + native color picker stacked together */}
        <div className="relative shrink-0 rounded focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
          <div
            className="w-7 h-7 rounded border border-border shadow-sm"
            style={{ background: swatchColor && swatchColor !== "—" ? swatchColor : "transparent" }}
            aria-hidden
          />
          <input
            type="color"
            value={isHex ? val : "#000000"}
            onChange={(e) => patch(key, e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title={`Pick color: ${label}`}
            aria-label={`${label} color picker`}
          />
        </div>
        {/* Label + hint, tightly stacked */}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground leading-tight truncate">{label}</div>
          {hint && <div className="text-[10px] text-muted-foreground leading-tight truncate">{hint}</div>}
        </div>
        {/* Value */}
        <Input
          value={val}
          onChange={(e) => patch(key, e.target.value)}
          placeholder={placeholder}
          className="text-[11px] font-mono h-7 w-36 shrink-0"
        />
      </div>
    );
  };

  const sectionTitle = (title: string) => (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
      {title}
    </p>
  );

  const controls = (
    <div className="space-y-3">
      <div className="border rounded-lg p-3">
        {sectionTitle("Stage")}
        <div className="divide-y divide-border/40">
          {colorRow("background", "Section background", "Behind the card")}
          {colorRow("surface", "Card surface", "Inner panel")}
          {colorRow("border", "Card border", "1px outline")}
        </div>
      </div>

      <div className="border rounded-lg p-3">
        {sectionTitle("Typography colors")}
        <div className="divide-y divide-border/40">
          {colorRow("headlineColor", "Headline")}
          {colorRow("subheadlineColor", "Subheadline")}
          {colorRow("labelColor", "Field labels")}
        </div>
      </div>

      <div className="border rounded-lg p-3">
        {sectionTitle("Inputs")}
        <div className="divide-y divide-border/40">
          {colorRow("inputBg", "Input background")}
          {colorRow("inputBorder", "Input border")}
          {colorRow("inputText", "Input text")}
          {colorRow("accent", "Accent", "Focus ring + step progress")}
        </div>
      </div>

      <div className="border rounded-lg p-3">
        {sectionTitle("Submit button")}
        <div className="divide-y divide-border/40">
          {colorRow("buttonBg", "Background")}
          {colorRow("buttonText", "Text")}
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-2">
        {sectionTitle("Fonts (optional)")}
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-foreground w-24 shrink-0">Display</div>
          <Input
            value={s.fontDisplay ?? ""}
            onChange={(e) => patch("fontDisplay", e.target.value)}
            placeholder={placeholderLayer?.fontDisplay ?? "'Bagoss Standard', Georgia, serif"}
            className="text-[11px] font-mono h-7 flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-foreground w-24 shrink-0">Body</div>
          <Input
            value={s.fontBody ?? ""}
            onChange={(e) => patch("fontBody", e.target.value)}
            placeholder={placeholderLayer?.fontBody ?? "'Inter', system-ui, sans-serif"}
            className="text-[11px] font-mono h-7 flex-1"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Leave blank to use brand fonts.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Visual theme</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {active ? "Custom on" : "Defaults"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {helpText ?? "Overrides per-block form colors. Blank tokens fall through."}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0 flex-wrap">
            <Button size="sm" variant="default" className="gap-1 h-8" onClick={applyPreset}>
              <Sparkles className="w-3.5 h-3.5" /> {presetLabel}
            </Button>
            {extraPresets?.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                className="gap-1 h-8"
                onClick={() => onChange({ ...p.values })}
              >
                <Sparkles className="w-3.5 h-3.5" /> {p.label}
              </Button>
            ))}
            {active && (
              <Button size="sm" variant="outline" className="gap-1 h-8" onClick={clearAll}>
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {showPreview ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {controls}
          <div className="lg:sticky lg:top-4 self-start">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Live preview
            </p>
            <FormPreview styling={resolved} />
            <p className="text-[10px] text-muted-foreground mt-2">
              Reflects brand defaults + your overrides. Saved per-form and per-block overrides still win at render time.
            </p>
          </div>
        </div>
      ) : (
        controls
      )}
    </div>
  );
}

/**
 * Minimal live-preview of a form rendered with the supplied tokens.
 * Mirrors the structure BlockForm produces (stage → card → headline,
 * subhead, labelled inputs, submit) so editors can see brand-default
 * styling changes before saving.
 */
function FormPreview({ styling }: { styling: FormStyling }) {
  const bg = styling.background || "#f8fafc";
  const surface = styling.surface || "#ffffff";
  const border = styling.border || "rgba(15,23,42,0.08)";
  const headlineColor = styling.headlineColor || "#0f172a";
  const subheadlineColor = styling.subheadlineColor || "rgba(15,23,42,0.6)";
  const labelColor = styling.labelColor || "rgba(15,23,42,0.7)";
  const inputBg = styling.inputBg || "#ffffff";
  const inputBorder = styling.inputBorder || "rgba(15,23,42,0.15)";
  const inputText = styling.inputText || "#0f172a";
  const buttonBg = styling.buttonBg || "#0f172a";
  const buttonText = styling.buttonText || "#ffffff";
  const accent = styling.accent || buttonBg;
  const fontDisplay = styling.fontDisplay;
  const fontBody = styling.fontBody;

  return (
    <div
      className="rounded-lg overflow-hidden border border-border"
      style={{ background: bg, fontFamily: fontBody }}
    >
      <div className="p-5">
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: surface, border: `1px solid ${border}` }}
        >
          <div>
            <div
              className="text-base font-bold leading-tight"
              style={{ color: headlineColor, fontFamily: fontDisplay }}
            >
              Get a free demo
            </div>
            <div className="text-[11px] mt-1" style={{ color: subheadlineColor }}>
              See it in action — 15-minute walkthrough.
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <div
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: labelColor }}
              >
                Full name
              </div>
              <div
                className="h-7 rounded px-2 flex items-center text-[11px]"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: inputText,
                }}
              >
                Jane Doe
              </div>
            </div>
            <div className="space-y-1">
              <div
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: labelColor }}
              >
                Work email
              </div>
              <div
                className="h-7 rounded px-2 flex items-center text-[11px]"
                style={{
                  background: inputBg,
                  border: `1px solid ${accent}`,
                  boxShadow: `0 0 0 2px ${accent}33`,
                  color: inputText,
                }}
              >
                jane@example.com
              </div>
            </div>
          </div>

          <button
            type="button"
            className="w-full h-8 rounded text-[11px] font-semibold tracking-wide"
            style={{
              background: buttonBg,
              color: buttonText,
              fontFamily: fontDisplay,
            }}
          >
            Request demo
          </button>
        </div>
      </div>
    </div>
  );
}
