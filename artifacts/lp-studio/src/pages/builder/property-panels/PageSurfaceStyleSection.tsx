/**
 * Page Settings → "Sections & images" — hand-authored page-level surface
 * styling, the sibling of the Buttons editor. Same storage
 * (lp_pages.style_overrides), same server whitelist, same PATCH route.
 *
 * These three tokens already applied page-wide via getBrandSurfaceCss — they
 * remap the Tailwind radius/shadow/gap utilities every block uses (and, for
 * radius, images that opt into rounding). They were only writable by the URL
 * importer; this exposes them.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API_BASE = "/api";

/** Keys this editor owns — the reset clears exactly these. */
const OWNED_KEYS = ["cardRadius", "cardShadow", "layoutDensity"] as const;

const CONTROLS: {
  key: (typeof OWNED_KEYS)[number];
  label: string;
  hint: string;
  fallback: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "cardRadius",
    label: "Corner radius",
    hint: "Applies to cards, sections and any image that's rounded.",
    fallback: "rounded",
    options: [
      { value: "square", label: "Square — no rounding" },
      { value: "slight", label: "Slight" },
      { value: "rounded", label: "Rounded (brand default)" },
      { value: "soft", label: "Soft — extra round" },
    ],
  },
  {
    key: "cardShadow",
    label: "Shadow",
    hint: "Depth on cards and raised surfaces.",
    fallback: "md",
    options: [
      { value: "none", label: "None — flat" },
      { value: "sm", label: "Subtle" },
      { value: "md", label: "Medium (brand default)" },
      { value: "lg", label: "Pronounced" },
    ],
  },
  {
    key: "layoutDensity",
    label: "Spacing",
    hint: "Gaps between items in grids and stacks.",
    fallback: "regular",
    options: [
      { value: "compact", label: "Compact" },
      { value: "regular", label: "Regular (brand default)" },
      { value: "spacious", label: "Spacious" },
    ],
  },
];

export interface PageSurfaceStyleSectionProps {
  pageId: number;
  value: Record<string, unknown> | null;
  onSaved: (overrides: Record<string, unknown> | null) => void;
}

export function PageSurfaceStyleSection({ pageId, value, onSaved }: PageSurfaceStyleSectionProps) {
  const stored = value ?? {};
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSeeded = useRef<unknown>(value);
  useEffect(() => { lastSeeded.current = value; }, [value]);

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
      onSaved(body?.styleOverrides ?? null);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(null);
    }
  };

  const touched = OWNED_KEYS.some((k) => stored[k] !== undefined);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Square className="w-3.5 h-3.5" aria-hidden />
        Sections &amp; images
      </Label>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Shape and spacing for this page only — your brand settings stay as they are.
      </p>

      {CONTROLS.map((c) => (
        <div key={c.key} className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">{c.label}</Label>
          <Select
            value={(stored[c.key] as string) ?? c.fallback}
            onValueChange={(v) => void patch({ [c.key]: v }, "save")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {c.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">{c.hint}</p>
        </div>
      ))}

      {touched && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 w-full"
          onClick={() => void patch(Object.fromEntries(OWNED_KEYS.map((k) => [k, null])), "reset")}
          disabled={busy !== null}
        >
          {busy === "reset" ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <X className="w-3 h-3" aria-hidden />}
          Reset to my brand
        </Button>
      )}
      {busy === "save" && <p className="text-[11px] text-muted-foreground">Saving…</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
