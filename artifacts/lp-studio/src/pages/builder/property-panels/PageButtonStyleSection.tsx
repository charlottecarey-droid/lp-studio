/**
 * Page Settings → "Buttons" — hand-authored page-level button overrides.
 *
 * The sibling of "Match style from URL": same storage (lp_pages.style_overrides,
 * same server whitelist), but authored by hand instead of scraped. Everything
 * here overrides the tenant brand ON THIS PAGE ONLY.
 *
 * Two fill modes:
 *  - Solid   → writes ctaBackground / ctaText, the tokens every block already
 *              resolves its button colours from (JS-side, contrast-guarded).
 *  - Gradient→ writes buttonStyleRaw (the "exact primary-button CSS" channel)
 *              which paints primary CTAs via the .lp-brand-btn/.lp-cta-filled
 *              stylesheet, AND ctaBackground = the first stop so the handful of
 *              buttons that can't render a gradient stay coordinated.
 *
 * Shape/shadow/padding/weight/case are brand tokens that already apply
 * page-wide (getButtonClasses + getBrandButtonShapeCss).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, SquareMousePointer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_BUTTON_GRADIENT,
  gradientButtonStyleRaw,
  gradientFromOverrides,
  gradientToCss,
  isValidGradient,
  type ButtonGradient,
} from "@/lib/button-gradient";

const API_BASE = "/api";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Keys this editor owns — "Reset buttons" clears exactly these, leaving a
 *  URL-matched font/colour palette on the page untouched. */
const OWNED_KEYS = [
  "ctaBackground", "ctaText", "buttonStyleRaw", "buttonRadius", "buttonShadow",
  "buttonPaddingX", "buttonPaddingY", "buttonFontWeight", "buttonTextCase",
] as const;

const TOKEN_CONTROLS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  { key: "buttonRadius", label: "Shape", options: [
    { value: "pill", label: "Pill" }, { value: "rounded", label: "Rounded" },
    { value: "slight", label: "Slight" }, { value: "square", label: "Square" },
  ] },
  { key: "buttonShadow", label: "Shadow", options: [
    { value: "none", label: "None" }, { value: "sm", label: "Small" },
    { value: "md", label: "Medium" }, { value: "lg", label: "Large" },
  ] },
  { key: "buttonPaddingX", label: "Width", options: [
    { value: "compact", label: "Compact" }, { value: "regular", label: "Regular" },
    { value: "spacious", label: "Spacious" },
  ] },
  { key: "buttonPaddingY", label: "Height", options: [
    { value: "compact", label: "Compact" }, { value: "regular", label: "Regular" },
    { value: "spacious", label: "Spacious" },
  ] },
  { key: "buttonFontWeight", label: "Weight", options: [
    { value: "normal", label: "Normal" }, { value: "medium", label: "Medium" },
    { value: "semibold", label: "Semibold" }, { value: "bold", label: "Bold" },
  ] },
  { key: "buttonTextCase", label: "Text case", options: [
    { value: "normal", label: "Normal" }, { value: "capitalize", label: "Capitalize" },
    { value: "uppercase", label: "Uppercase" },
  ] },
];

export interface PageButtonStyleSectionProps {
  pageId: number;
  /** The page's current style overrides (null = none). */
  value: Record<string, unknown> | null;
  /** Fired with the server's stored overrides after every successful save. */
  onSaved: (overrides: Record<string, unknown> | null) => void;
}

function ColorField({
  label, value, fallback, onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const swatch = HEX_RE.test(value) ? value : fallback;
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 p-0.5 cursor-pointer shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="h-7 text-xs font-mono flex-1 min-w-0"
        />
      </div>
    </div>
  );
}

export function PageButtonStyleSection({ pageId, value, onSaved }: PageButtonStyleSectionProps) {
  const stored = value ?? {};
  const storedGradient = useMemo(() => gradientFromOverrides(stored), [stored]);

  const [mode, setMode] = useState<"solid" | "gradient">(storedGradient ? "gradient" : "solid");
  const [fill, setFill] = useState<string>((stored.ctaBackground as string) ?? "");
  const [labelColor, setLabelColor] = useState<string>((stored.ctaText as string) ?? "");
  const [gradient, setGradient] = useState<ButtonGradient>(storedGradient ?? DEFAULT_BUTTON_GRADIENT);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the page's overrides change underneath us (URL match, reset).
  const lastSeeded = useRef<unknown>(value);
  useEffect(() => {
    if (lastSeeded.current === value) return;
    lastSeeded.current = value;
    const g = gradientFromOverrides(value ?? {});
    setMode(g ? "gradient" : "solid");
    setGradient(g ?? DEFAULT_BUTTON_GRADIENT);
    setFill(((value ?? {}).ctaBackground as string) ?? "");
    setLabelColor(((value ?? {}).ctaText as string) ?? "");
  }, [value]);

  const patch = async (overrides: Record<string, unknown>, kind: "save" | "reset") => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/lp/pages/${pageId}/style-overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ overrides }),
      });
      const body = (await res.json().catch(() => null)) as
        | { styleOverrides?: Record<string, unknown> | null; error?: string }
        | null;
      if (!res.ok) {
        setError(body?.error ?? `Save failed (${res.status})`);
        return;
      }
      lastSeeded.current = body?.styleOverrides ?? null;
      onSaved(body?.styleOverrides ?? null);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  const applyFill = () => {
    if (mode === "gradient") {
      if (!isValidGradient(gradient)) { setError("Pick two valid colours"); return; }
      void patch({
        buttonStyleRaw: gradientButtonStyleRaw(gradient, HEX_RE.test(labelColor) ? labelColor : "#ffffff"),
        // Buttons that resolve their fill in JS can't render a gradient — keep
        // them on the first stop so the page stays coordinated.
        ctaBackground: gradient.from,
        ...(HEX_RE.test(labelColor) ? { ctaText: labelColor } : {}),
      }, "save");
      return;
    }
    if (!HEX_RE.test(fill)) { setError("Enter a valid hex fill, e.g. #4B47E5"); return; }
    void patch({
      ctaBackground: fill,
      ...(HEX_RE.test(labelColor) ? { ctaText: labelColor } : {}),
      // Leaving gradient mode drops the gradient stylesheet.
      buttonStyleRaw: null,
    }, "save");
  };

  const setToken = (key: string, v: string) => void patch({ [key]: v }, "save");
  const resetButtons = () =>
    void patch(Object.fromEntries(OWNED_KEYS.map((k) => [k, null])), "reset");

  const touched = OWNED_KEYS.some((k) => stored[k] !== undefined);
  const previewBg = mode === "gradient" && isValidGradient(gradient)
    ? gradientToCss(gradient)
    : (HEX_RE.test(fill) ? fill : "#4B47E5");
  const previewFg = HEX_RE.test(labelColor) ? labelColor : "#ffffff";

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <SquareMousePointer className="w-3.5 h-3.5" aria-hidden />
        Buttons
      </Label>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Override your brand's button styling on this page only.
      </p>

      {/* live preview */}
      <div className="rounded-md border border-border bg-muted/30 p-3 flex justify-center">
        <span
          className="inline-flex items-center px-6 py-2.5 text-sm font-semibold"
          style={{
            background: previewBg,
            color: previewFg,
            borderRadius:
              (stored.buttonRadius as string) === "square" ? 0
                : (stored.buttonRadius as string) === "slight" ? "0.5rem"
                : (stored.buttonRadius as string) === "rounded" ? "0.75rem"
                : "9999px",
            textTransform: (stored.buttonTextCase as "uppercase" | "capitalize" | undefined) ?? undefined,
          }}
        >
          Book a demo
        </span>
      </div>

      {/* fill mode */}
      <div className="flex gap-1.5">
        {(["solid", "gradient"] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={mode === m ? "default" : "outline"}
            className="h-7 text-xs flex-1 capitalize"
            onClick={() => setMode(m)}
          >
            {m}
          </Button>
        ))}
      </div>

      {mode === "solid" ? (
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Fill" value={fill} fallback="#4B47E5" onChange={setFill} />
          <ColorField label="Label" value={labelColor} fallback="#ffffff" onChange={setLabelColor} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="From" value={gradient.from} fallback="#4B47E5" onChange={(v) => setGradient((g) => ({ ...g, from: v }))} />
            <ColorField label="To" value={gradient.to} fallback="#8B5CF6" onChange={(v) => setGradient((g) => ({ ...g, to: v }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Direction — {Math.round(gradient.angle)}°</Label>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={gradient.angle}
              onChange={(e) => setGradient((g) => ({ ...g, angle: parseInt(e.target.value, 10) }))}
              className="w-full"
            />
          </div>
          <ColorField label="Label" value={labelColor} fallback="#ffffff" onChange={setLabelColor} />
        </div>
      )}

      <Button size="sm" className="h-7 text-xs w-full" onClick={applyFill} disabled={busy !== null}>
        {busy === "save" ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : "Apply fill"}
      </Button>

      {/* shape tokens — saved immediately, they're single-choice */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {TOKEN_CONTROLS.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{c.label}</Label>
            <Select
              value={(stored[c.key] as string) ?? ""}
              onValueChange={(v) => setToken(c.key, v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Brand default" />
              </SelectTrigger>
              <SelectContent>
                {c.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {touched && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 w-full"
          onClick={resetButtons}
          disabled={busy !== null}
        >
          {busy === "reset" ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <X className="w-3 h-3" aria-hidden />}
          Reset buttons to my brand
        </Button>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
