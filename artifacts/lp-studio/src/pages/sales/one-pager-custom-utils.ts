export type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";
export { TEMPLATE_VISIBILITY_KEY, DELETED_BUILTINS_KEY } from "@workspace/one-pager-types";
import { isDandyGatedBuiltin } from "@workspace/one-pager-types";
export { svgToPng, hexToRgb, loadImg, generateCustomTemplatePdf } from "@workspace/one-pager-types/pdf";
export type { CustomTemplatePdfBrandOpts } from "@workspace/one-pager-types/pdf";
import type { OverlayField, CustomTemplate } from "@workspace/one-pager-types";
import type { CustomTemplatePdfBrandOpts } from "@workspace/one-pager-types/pdf";
import type { BrandConfig } from "@/lib/brand-config";
import { resolveOnePagerColors } from "@/lib/brand-config";
import dandyLogoWhiteUrl from "@/assets/dandy-logo-white.svg?url";

const API_BASE = "/api";

// ── Built-in one-pagers: single source of truth ────────────────────────
// The rep generate page (sales-one-pager.tsx), the marketing template editor
// (sales-one-pager-editor.tsx), and the templates gallery
// (sales-one-pager-templates.tsx) MUST show the same set of built-ins in the
// same order. They used to hand-maintain three separate lists, which drifted:
// a phantom "partner2" (a pure duplicate of new-partner) lived only on the rep
// page + gallery, and template order/labels diverged. Derive all three from
// this list via `visibleBuiltinOnePagers` so they can never drift again.
//
// `id` doubles as the templateVisibility / deletedBuiltins storage key. The
// editor's internal tab id for new-partner is the legacy "partner"; it maps at
// its call site (id === "new-partner" ? "partner" : id).
export type BuiltinOnePagerId =
  | "pilot"
  | "comparison"
  | "new-partner"
  | "roi"
  | "agreement-summary";

export interface BuiltinOnePager {
  id: BuiltinOnePagerId;
  /** Label shown to Dandy tenants (keeps Dandy's established wording). */
  labelDandy: string;
  /** Label shown to every other tenant (neutral, non-dental). */
  labelNeutral: string;
  /** Gallery card blurb. */
  description: string;
}

export const BUILTIN_ONE_PAGERS: readonly BuiltinOnePager[] = [
  { id: "pilot",             labelDandy: "90-Day Pilot",      labelNeutral: "90-Day Pilot",      description: "Pilot program overview" },
  { id: "comparison",        labelDandy: "Dandy Evolution",   labelNeutral: "Before / After",    description: "Before / after comparison" },
  { id: "new-partner",       labelDandy: "Partner Practices", labelNeutral: "New Partner",       description: "Partner onboarding" },
  { id: "roi",               labelDandy: "ROI One-Pager",     labelNeutral: "ROI One-Pager",     description: "Financial ROI summary" },
  { id: "agreement-summary", labelDandy: "Agreement Summary", labelNeutral: "Agreement Summary", description: "Summary of agreement terms" },
] as const;

/** Label for a built-in, honoring the tenant's Dandy-vs-neutral wording. */
export function builtinOnePagerLabel(b: BuiltinOnePager, isDandy: boolean): string {
  return isDandy ? b.labelDandy : b.labelNeutral;
}

/**
 * The built-ins a tenant can currently see, in canonical order — the ONE
 * predicate every picker uses. Applies the Dandy gate (roi is Dandy-only) plus
 * the gallery's per-tenant hide (`templateVisibility[id] === false`) and delete
 * (`deletedBuiltins[id]`) flags.
 */
export function visibleBuiltinOnePagers(opts: {
  isDandy: boolean;
  templateVisibility: Record<string, boolean>;
  deletedBuiltins: Record<string, boolean>;
}): BuiltinOnePager[] {
  const { isDandy, templateVisibility, deletedBuiltins } = opts;
  return BUILTIN_ONE_PAGERS.filter((b) => {
    if (!isDandy && isDandyGatedBuiltin(b.id)) return false;
    return !deletedBuiltins[b.id] && templateVisibility[b.id] !== false;
  });
}

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

// ── Remembered per-rep one-pager color override ───────────────────────
// A rep's last-used per-one-pager color override is remembered in the browser
// so a co-branded piece doesn't have to be re-entered every session. It is
// scoped by tenant id so it can NEVER leak across tenants on a shared browser
// (e.g. an operator impersonating multiple workspaces, or two reps sharing a
// machine). Reset clears it back to Brand Settings. A null/undefined tenantId
// (session not yet hydrated) is a no-op so we never read/write an unscoped key.
function rememberedOverrideKey(tenantId: number): string {
  return `lp_studio_one_pager_color_override_t${tenantId}`;
}

export function loadRememberedColorOverride(
  tenantId: number | null | undefined,
): OnePagerColorOverride | null {
  if (tenantId === null || tenantId === undefined) return null;
  try {
    const raw = localStorage.getItem(rememberedOverrideKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnePagerColorOverride;
    if (!parsed || typeof parsed !== "object") return null;
    const primaryColor = (parsed.primaryColor || "").trim();
    const accentColor = (parsed.accentColor || "").trim();
    if (!primaryColor && !accentColor) return null;
    return { primaryColor, accentColor };
  } catch {
    return null;
  }
}

export function saveRememberedColorOverride(
  tenantId: number | null | undefined,
  override: OnePagerColorOverride,
): void {
  if (tenantId === null || tenantId === undefined) return;
  const primaryColor = (override.primaryColor || "").trim();
  const accentColor = (override.accentColor || "").trim();
  try {
    // Empty override → forget it (equivalent to Reset → fall back to Brand Settings).
    if (!primaryColor && !accentColor) {
      localStorage.removeItem(rememberedOverrideKey(tenantId));
      return;
    }
    localStorage.setItem(
      rememberedOverrideKey(tenantId),
      JSON.stringify({ primaryColor, accentColor }),
    );
  } catch {}
}

export function clearRememberedColorOverride(tenantId: number | null | undefined): void {
  if (tenantId === null || tenantId === undefined) return;
  try { localStorage.removeItem(rememberedOverrideKey(tenantId)); } catch {}
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
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
  } catch {}
}

export async function fetchCustomTemplates(): Promise<CustomTemplate[]> {
  const res = await fetch(`${API_BASE}/sales/one-pager-templates`, { credentials: "include" });
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
  const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
  const res = await fetch(`${API_BASE}/sales/one-pager-templates/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Delete failed");
}
