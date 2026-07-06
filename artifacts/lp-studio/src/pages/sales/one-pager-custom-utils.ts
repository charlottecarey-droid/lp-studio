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
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type jsPDF from "jspdf";

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

// ── Forking a built-in into a custom template ──────────────────────────
// Shared by the templates gallery ("Clone" on a built-in card — default
// state) and the template editor's "Save as Custom Template" (current
// knob/content state). Both render the built-in to PDF, rasterize page 1 as
// the template background, and seed the standard overlay fields on top.

/** Brand inputs for the seeded overlay fields, threaded from the live tenant
 *  brand so cloned overlays never hardcode "Dandy"/"DSO"/meetdandy.com for
 *  non-Dandy tenants. Dandy passes its own values so its defaults are
 *  unchanged. */
export interface BrandFieldDefaults {
  /** Wordmark used in prefixes/labels (e.g. "Dandy" or the tenant brand). */
  brandLabel: string;
  /** Industry/segment label used in labels (e.g. "DSO" or "Group"). */
  industryLabel: string;
  /** Default URL for QR/link fields — the tenant CTA URL, or "" (never meetdandy.com). */
  ctaDefault: string;
}

export const cloneFieldsForBuiltin = (id: BuiltinOnePagerId, brand: BrandFieldDefaults): OverlayField[] => {
  const mk = (f: Omit<OverlayField, "id">): OverlayField => ({ ...f, id: crypto.randomUUID() });
  const { brandLabel, industryLabel, ctaDefault } = brand;
  // The logo field reads "Brand Logo" for every tenant (the enum value stays
  // `dandy_logo` for backward compatibility).
  const logoLabel = "Brand Logo";
  const nameLabel = `${brandLabel} & ${industryLabel} Name`;
  const namePrefix = `${brandLabel} & `;
  const base: Omit<OverlayField, "id"> = { label: `${industryLabel} Name`, type: "dso_name", x: 10, y: 10, fontSize: 24, fontFamily: "helvetica", color: "#FFFFFF", bold: true, italic: false, defaultValue: "" };
  if (id === "roi") return [
    mk({ ...base, label: logoLabel, type: "dandy_logo", x: 7.8, y: 4.5, fontSize: 18, logoScale: 13 }),
    mk({ ...base, label: `& ${industryLabel} Name`, type: "dso_name", x: 7.8, y: 11.6, fontSize: 22, bold: false, prefix: "& " }),
  ];
  if (id === "pilot") return [
    mk({ ...base, label: logoLabel, type: "dandy_logo", x: 7.8, y: 6.3, fontSize: 18, logoScale: 13 }),
    mk({ ...base, label: nameLabel, type: "dso_name", x: 24.5, y: 8.8, fontSize: 14, bold: false, italic: true, prefix: namePrefix, suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 10, bold: false }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 24.5, y: 7.6, fontSize: 12, bold: false, logoScale: 16, logoWidth: 135, logoHeight: 36 }),
  ];
  if (id === "comparison") return [
    mk({ ...base, label: logoLabel, type: "dandy_logo", x: 7.8, y: 2.8, fontSize: 18, logoScale: 11.4 }),
    mk({ ...base, label: nameLabel, type: "dso_name", x: 22.5, y: 5, fontSize: 12, bold: false, italic: true, prefix: namePrefix, suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 50, y: 96, fontSize: 8, bold: false }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 22.5, y: 4.3, fontSize: 12, bold: false, logoScale: 14, logoWidth: 135, logoHeight: 30 }),
  ];
  // Agreement Summary is procedurally rendered (text edited in dialog), so a
  // clone gets the rendered defaults as a background with no overlays — the
  // user can then drop their own logo, name, etc. on top if they want.
  if (id === "agreement-summary") return [];
  return [
    mk({ ...base, label: logoLabel, type: "dandy_logo", x: 7.8, y: 3.8, fontSize: 18, logoScale: 11.4 }),
    mk({ ...base, label: nameLabel, type: "dso_name", x: 7.8, y: 12.6, fontSize: 16, bold: false, italic: true, prefix: namePrefix, suffix: ":" }),
    mk({ ...base, label: "Phone Number", type: "phone", x: 66, y: 95.4, fontSize: 9, bold: false }),
    mk({ ...base, label: "QR Code", type: "qr_code", x: 80.2, y: 66.5, fontSize: 12, color: "#000000", bold: false, defaultValue: ctaDefault, qrSize: 9.5 }),
    mk({ ...base, label: "Prospect Logo", type: "logo", x: 88, y: 5.3, fontSize: 12, bold: false, logoScale: 11, logoWidth: 70, logoHeight: 26 }),
  ];
};

// Letter-page pt dimensions the built-in generators render at.
export const ONE_PAGER_PAGE_W_PT = 612;
export const ONE_PAGER_PAGE_H_PT = 792;

/** Shift the header-cluster overlay fields (brand logo, DSO name, prospect
 *  logo) of a freshly seeded clone by the current logo-group offsets, so the
 *  overlays land on the background's (possibly nudged) header cluster when a
 *  built-in is forked from the editor. Field x/y are % of the page; the
 *  offsets are pt. Footer fields (phone/QR) are untouched. Pure — returns new
 *  field objects. */
export function shiftClonedHeaderFields(
  fields: OverlayField[],
  logoGroupOffsetXPt: number,
  logoGroupOffsetYPt: number,
): OverlayField[] {
  if (!logoGroupOffsetXPt && !logoGroupOffsetYPt) return fields;
  const dxPct = (logoGroupOffsetXPt / ONE_PAGER_PAGE_W_PT) * 100;
  const dyPct = (logoGroupOffsetYPt / ONE_PAGER_PAGE_H_PT) * 100;
  const headerTypes = new Set<OverlayField["type"]>(["dandy_logo", "dso_name", "logo"]);
  return fields.map(f => headerTypes.has(f.type)
    ? { ...f, x: Math.max(0, Math.min(100, f.x + dxPct)), y: Math.max(0, Math.min(100, f.y + dyPct)) }
    : f);
}

/** Rasterizes page 1 of a generated one-pager to a PNG blob (2× scale). */
export async function rasterizeOnePagerDoc(doc: jsPDF): Promise<{ imgBlob: Blob; dataUrl: string }> {
  const pdfBlob = doc.output("blob");
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buf = await pdfBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
  const imgBlob: Blob = await new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/png"));
  return { imgBlob, dataUrl: canvas.toDataURL("image/png") };
}

/** Uploads a template background image; returns its persistent URL, or null
 *  on failure (caller falls back to the data URL). */
export async function uploadTemplateBg(imgBlob: Blob, filename: string, scope: TemplateScope = "tenant"): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", new File([imgBlob], filename, { type: "image/png" }));
    const res = await fetch(`${customTemplatesBase(scope)}/upload-bg`, { method: "POST", body: fd, credentials: "include" });
    if (res.ok) return (await res.json()).url as string;
  } catch { /* fall through */ }
  return null;
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

/** Which layer of sales_one_pager_templates the CRUD helpers target:
 *  "tenant" (default) — the tenant's own templates via /sales/one-pager-templates
 *  (list responses also include read-only GLOBAL rows, tenantId === null);
 *  "global" — the superadmin-authored tenant_id-NULL rows every tenant sees,
 *  via /admin/superadmin/one-pager-templates. Both endpoints share one row
 *  shape, so callers are scope-agnostic. */
export type TemplateScope = "tenant" | "global";

export function customTemplatesBase(scope: TemplateScope): string {
  return scope === "global"
    ? `${API_BASE}/admin/superadmin/one-pager-templates`
    : `${API_BASE}/sales/one-pager-templates`;
}

function mapTemplateRow(t: Record<string, unknown>): CustomTemplate {
  return {
    ...(t as object),
    tenantId: (t.tenantId as number | null | undefined) ?? (t.tenant_id as number | null | undefined) ?? null,
    background_url: (t.backgroundUrl as string) ?? (t.background_url as string) ?? "",
    headerHeight: (t.headerHeight as number) ?? (t.header_height as number) ?? 30,
    headerImageUrl: (t.headerImageUrl as string | undefined) ?? (t.header_image_url as string | undefined),
    isDeleted: (t.isDeleted as boolean) ?? (t.is_deleted as boolean) ?? false,
    fields: Array.isArray(t.fields) ? (t.fields as OverlayField[]) : [],
  } as CustomTemplate;
}

export async function fetchCustomTemplates(scope: TemplateScope = "tenant"): Promise<CustomTemplate[]> {
  const res = await fetch(customTemplatesBase(scope), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load templates");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapTemplateRow);
}

export async function saveCustomTemplate(tpl: CustomTemplate, scope: TemplateScope = "tenant"): Promise<CustomTemplate> {
  const payload = {
    name: tpl.name,
    background_url: tpl.background_url,
    orientation: tpl.orientation,
    fields: tpl.fields,
    headerHeight: tpl.headerHeight ?? 30,
    headerImageUrl: tpl.headerImageUrl ?? null,
    isDeleted: tpl.isDeleted ?? false,
  };
  const url = tpl.id ? `${customTemplatesBase(scope)}/${tpl.id}` : customTemplatesBase(scope);
  const method = tpl.id ? "PATCH" : "POST";
  const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Save failed");
  const d = await res.json() as Record<string, unknown>;
  return mapTemplateRow(d);
}

export async function deleteCustomTemplate(id: number, scope: TemplateScope = "tenant"): Promise<void> {
  const res = await fetch(`${customTemplatesBase(scope)}/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Delete failed");
}
