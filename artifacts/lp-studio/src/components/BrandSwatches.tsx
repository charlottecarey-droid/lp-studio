import { useEffect, useState } from "react";
import { fetchBrandConfig, type BrandConfig } from "@/lib/brand-config";

export interface BrandSwatch {
  label: string;
  hex: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

let cached: BrandConfig | null = null;
let inFlight: Promise<BrandConfig> | null = null;
const subscribers = new Set<(b: BrandConfig) => void>();

async function loadOnce(): Promise<BrandConfig> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = fetchBrandConfig().then((b) => {
      cached = b;
      inFlight = null;
      subscribers.forEach((fn) => fn(b));
      return b;
    });
  }
  return inFlight;
}

/** Allow callers (e.g. brand settings page after a save) to invalidate the
 *  module-level cache so freshly-saved colors show up without a hard refresh. */
export function invalidateBrandCache() {
  cached = null;
  inFlight = null;
}

/** React hook returning the brand config from a shared module-level cache.
 *  All color-picker swatches across the builder share a single fetch. */
export function useBrandConfig(): BrandConfig | null {
  const [brand, setBrand] = useState<BrandConfig | null>(cached);
  useEffect(() => {
    let alive = true;
    if (!cached) {
      loadOnce().then((b) => {
        if (alive) setBrand(b);
      });
    }
    const sub = (b: BrandConfig) => {
      if (alive) setBrand(b);
    };
    subscribers.add(sub);
    return () => {
      alive = false;
      subscribers.delete(sub);
    };
  }, []);
  return brand;
}

/** Flatten a BrandConfig into the labelled swatch list shown in the cheat
 *  sheet. Order matches the visual hierarchy in the brand-settings page so
 *  reps can find the color they remember from the guidelines. Empty/invalid
 *  values are filtered out. Duplicate hex values are de-duplicated by hex
 *  (keeping the first/most-meaningful label). */
export function brandConfigToSwatches(brand: BrandConfig | null): BrandSwatch[] {
  if (!brand) return [];
  const candidates: BrandSwatch[] = [
    { label: "Primary", hex: brand.primaryColor },
    { label: "Accent", hex: brand.accentColor },
    { label: "CTA bg", hex: brand.ctaBackground },
    { label: "CTA text", hex: brand.ctaText },
    { label: "Text", hex: brand.textColor },
    { label: "Page bg", hex: brand.pageBackground },
    { label: "Card bg", hex: brand.cardBackground },
    { label: "Nav bg", hex: brand.navBgColor },
    { label: "Nav text", hex: brand.navText },
    { label: "Border", hex: brand.borderColor },
    { label: "Secondary 1", hex: brand.secondary1 },
    { label: "Secondary 2", hex: brand.secondary2 },
    { label: "Secondary 3", hex: brand.secondary3 },
    { label: "Secondary 4", hex: brand.secondary4 },
    { label: "Secondary 5", hex: brand.secondary5 },
  ];
  const seen = new Set<string>();
  const out: BrandSwatch[] = [];
  for (const c of candidates) {
    if (!c.hex || !HEX_RE.test(c.hex)) continue;
    const key = c.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

interface Props {
  /** Called with the chosen hex when the rep clicks a swatch. */
  onPick: (hex: string) => void;
  /** Optional currently-selected hex — that swatch is highlighted with a
   *  ring so the rep can see which brand color the field is set to. */
  current?: string;
  /** When true, the swatch row is hidden if the brand has no valid colors
   *  configured (rather than rendering an empty strip). Defaults to true. */
  hideWhenEmpty?: boolean;
  className?: string;
}

/** Compact horizontal cheat-sheet of brand colors that drops in next to any
 *  color picker. Each swatch is a clickable square that calls `onPick` with
 *  the hex; hovering shows the label and hex code. */
export function BrandSwatches({ onPick, current, hideWhenEmpty = true, className = "" }: Props) {
  const brand = useBrandConfig();
  const swatches = brandConfigToSwatches(brand);
  if (swatches.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <p className={`text-[10px] text-muted-foreground ${className}`}>
        No brand colors configured yet.
      </p>
    );
  }
  const currentLower = current?.toLowerCase();
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <span className="text-[10px] text-muted-foreground mr-0.5">Brand:</span>
      {swatches.map((s) => {
        const isActive = currentLower === s.hex.toLowerCase();
        return (
          <button
            key={`${s.label}-${s.hex}`}
            type="button"
            onClick={() => onPick(s.hex)}
            title={`${s.label} · ${s.hex}`}
            aria-label={`${s.label} ${s.hex}`}
            className={`w-4 h-4 rounded border transition-shadow ${
              isActive
                ? "border-foreground ring-2 ring-offset-1 ring-foreground/40"
                : "border-border hover:ring-1 hover:ring-foreground/30"
            }`}
            style={{ backgroundColor: s.hex }}
          />
        );
      })}
    </div>
  );
}
