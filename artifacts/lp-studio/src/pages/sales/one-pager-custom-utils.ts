export type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";
export { TEMPLATE_VISIBILITY_KEY, DELETED_BUILTINS_KEY } from "@workspace/one-pager-types";
export { svgToPng, hexToRgb, loadImg, generateCustomTemplatePdf } from "@workspace/one-pager-types/pdf";
export type { CustomTemplatePdfBrandOpts } from "@workspace/one-pager-types/pdf";
import type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";
import type { CustomTemplatePdfBrandOpts } from "@workspace/one-pager-types/pdf";
import type { BrandConfig } from "@/lib/brand-config";
import { resolveOnePagerColors } from "@/lib/brand-config";
import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";

const API_BASE = "/api";

// ── Per-one-pager brand color override ─────────────────────────────────
// Sales reps can override the tenant's Brand Settings colors for a single
// one-pager (e.g. a co-branded piece) WITHOUT changing global Brand Settings.
// The override is stashed in the custom-template `customFieldValues` record
// under these reserved keys (the `__` prefix can never collide with a real
// template field id). Empty / absent → fall back to Brand Settings, then to
// the Dandy palette.
export const ONE_PAGER_PRIMARY_OVERRIDE_KEY = "__brandPrimaryOverride";
export const ONE_PAGER_ACCENT_OVERRIDE_KEY = "__brandAccentOverride";

/** A per-one-pager color override resolved from the sales form. */
export interface OnePagerColorOverride {
  primaryColor?: string;
  accentColor?: string;
}

// ── Brand context for the custom-template PDF generator ────────────────
// Resolves the third arg of `generateCustomTemplatePdf` from the tenant's
// BrandConfig. For protected Dandy tenants (`brand.isDandy === true`) this
// yields the exact legacy Dandy values so their output stays byte-identical:
// the Dandy white wordmark SVG, the lowercase "dandy" wordmark fallback, and
// the meetdandy.com QR/link fallback. For every other tenant it returns the
// tenant's own brand-config values, leaving fields empty (→ skip / render
// nothing) so no Dandy asset can ever leak. Detection uses the
// server-authoritative `isDandy` flag (resolved from the immutable slug),
// never the spoofable `brandName`.
//
// `override` is an optional per-one-pager color override (from the sales
// form). When a color is provided it wins over Brand Settings; when empty it
// falls back to Brand Settings (non-Dandy) or stays empty (Dandy → hard-coded
// green). Contrast-safe derivation downstream is unchanged.
export function buildCustomTemplateBrandOpts(
  brand: BrandConfig,
  override?: OnePagerColorOverride,
): CustomTemplatePdfBrandOpts {
  const overridePrimary = (override?.primaryColor || "").trim();
  const overrideAccent = (override?.accentColor || "").trim();
  if (brand.isDandy === true) {
    return {
      brandLogoSvgUrl: dandyLogoWhiteUrl,
      brandWordmark: "dandy",
      qrFallbackUrl: "https://meetdandy.com",
      // Dandy keeps its hard-coded green UNLESS the rep explicitly overrides
      // it for this one-pager. Empty override → empty here → Dandy palette
      // preserved (byte-identical output).
      primaryColor: overridePrimary,
      accentColor: overrideAccent,
    };
  }
  const cta = brand.defaultCtaUrl && brand.defaultCtaUrl !== "#" ? brand.defaultCtaUrl : "";
  // Honor one-pager color overrides so custom-template surfaces track the same
  // colors as the web one-pager. Falls back to base brand colors when unset.
  const onePagerColors = resolveOnePagerColors(brand);
  return {
    brandLogoSvgUrl: brand.logoUrl || "",
    brandWordmark: (brand.brandName || "").trim().toLowerCase(),
    qrFallbackUrl: cta,
    // Brand-tinted custom-template surfaces (e.g. team-photo circle). Override
    // wins, then the resolved one-pager colors (Brand Settings + one-pager
    // overrides), then empty (→ Dandy default green).
    primaryColor: overridePrimary || (onePagerColors.primaryColor || "").trim(),
    accentColor: overrideAccent || (onePagerColors.accentColor || "").trim(),
  };
}

// ── API helpers ───────────────────────────────────────────────────────

export async function apiLoadLayoutDefault(key: string): Promise<Record<string, unknown> | null> {
  // The API is the source of truth — bypass HTTP cache and only fall back to
  // localStorage on real network errors. See sales-one-pager.tsx for rationale.
  try {
    const res = await fetch(
      `${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`,
      { cache: "no-store", credentials: "include" },
    );
    if (res.ok) {
      const d = await res.json();
      if (d && typeof d === "object") {
        try { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(d)); } catch {}
        return d as Record<string, unknown>;
      }
      try { localStorage.removeItem(`lp_studio_${key}`); } catch {}
      return null;
    }
    return null;
  } catch {
    try { const r = localStorage.getItem(`lp_studio_${key}`); return r ? JSON.parse(r) : null; } catch { return null; }
  }
}

export async function apiSaveLayoutDefault(key: string, config: Record<string, unknown>): Promise<void> {
  try { localStorage.setItem(`lp_studio_${key}`, JSON.stringify(config)); } catch {}
  try {
    await fetch(`${API_BASE}/sales/layout-defaults/${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
  } catch {}
}

export async function fetchCustomTemplates(): Promise<CustomTemplate[]> {
  const res = await fetch(`${API_BASE}/sales/one-pager-templates`);
  if (!res.ok) throw new Error("Failed to load templates");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(t => ({
    ...(t as object),
    background_url: (t.backgroundUrl as string) ?? (t.background_url as string) ?? "",
    headerHeight: (t.headerHeight as number) ?? (t.header_height as number) ?? 30,
    headerImageUrl: (t.headerImageUrl as string | undefined) ?? (t.header_image_url as string | undefined),
    isDeleted: (t.isDeleted as boolean) ?? (t.is_deleted as boolean) ?? false,
    fields: Array.isArray(t.fields) ? (t.fields as OverlayField[]) : [],
  } as CustomTemplate));
}

export async function saveCustomTemplate(tpl: CustomTemplate): Promise<CustomTemplate> {
  const payload = {
    name: tpl.name,
    background_url: tpl.background_url,
    orientation: tpl.orientation,
    fields: tpl.fields,
    headerHeight: tpl.headerHeight ?? 30,
    headerImageUrl: tpl.headerImageUrl ?? null,
    isDeleted: tpl.isDeleted ?? false,
  };
  const url = tpl.id
    ? `${API_BASE}/sales/one-pager-templates/${tpl.id}`
    : `${API_BASE}/sales/one-pager-templates`;
  const method = tpl.id ? "PATCH" : "POST";
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Save failed");
  const d = await res.json() as Record<string, unknown>;
  return {
    ...(d as object),
    background_url: (d.backgroundUrl as string) ?? (d.background_url as string) ?? "",
    headerHeight: (d.headerHeight as number) ?? (d.header_height as number) ?? 30,
    headerImageUrl: (d.headerImageUrl as string | undefined) ?? (d.header_image_url as string | undefined),
    fields: Array.isArray(d.fields) ? (d.fields as OverlayField[]) : [],
  } as CustomTemplate;
}

export async function deleteCustomTemplate(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/sales/one-pager-templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}
