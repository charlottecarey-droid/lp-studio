/* ----------------------------------------------------------------------------
 * agenda-pdf — client-side "Export PDF" for the Sales Console agenda editor.
 *
 * Thin wrapper over the shared `generateEventAgendaPdf` generator
 * (lib/one-pager-types): fetches the tenant brand, assembles the same
 * BrandContext the one-pager pages build (Dandy → { isDandy: true } so the
 * bundled palette/Bagoss gates apply; non-Dandy → scrub tokens + tenant
 * colors + embedded fonts), loads the brand logo, and saves the doc.
 *
 * Import this module LAZILY (await import(...)) from UI code — it pulls in
 * jsPDF via the generators subpath.
 * -------------------------------------------------------------------------- */

import {
  generateEventAgendaPdf,
  type AgendaPdfContent,
  type AgendaPdfDay,
  type BrandContext,
} from "@workspace/one-pager-types/generators";
import {
  fetchBrandConfig,
  resolveBrandPdfFonts,
  resolveOnePagerAssets,
  resolveOnePagerColors,
} from "@/lib/brand-config";

export type { AgendaPdfDay };

// Same canvas rasterizer as sales-one-pager.tsx `loadImageAsBase64` (kept
// module-local there): handles dimension-less SVGs (0×0 canvas would throw)
// and upscales small SVGs so PDF logos stay crisp.
const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const isSvg = /\.svg(\?|#|$)/i.test(src) || src.startsWith("data:image/svg");
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) { w = 800; h = 320; }
      const scale = isSvg ? Math.max(1, Math.min(8, 800 / w)) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("canvas export failed"));
      }
    };
    img.onerror = reject;
    img.src = src;
  });

const fileToken = (v: string) =>
  v.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 40) || "agenda";

export interface AgendaPdfExportArgs {
  eventName: string;
  eventLocation?: string | null;
  /** Preformatted range label, e.g. "Mar 10–12, 2026". */
  eventDates?: string;
  accountName: string;
  personalNote?: string;
  days: AgendaPdfDay[];
}

/** Generate the agenda PDF with tenant branding and trigger the download. */
export async function exportAgendaPdf(args: AgendaPdfExportArgs): Promise<void> {
  const brand = await fetchBrandConfig();
  const isDandy = brand.isDandy === true;
  const label = (brand.brandName || "").trim();

  let brandCtx: BrandContext;
  if (isDandy) {
    // Dandy keeps the byte-identical default palette; the flag only unlocks
    // the bundled Bagoss for the header title (mirrors sales-one-pager.tsx).
    brandCtx = { isDandy: true };
  } else {
    const colors = resolveOnePagerColors(brand);
    const fonts = await resolveBrandPdfFonts(brand).catch(() => undefined);
    brandCtx = {
      wordmark: label.toLowerCase(),
      productName: label || "Our team",
      industryLabel: "Group",
      labName: label || "Our team",
      footerUrl:
        brand.defaultCtaUrl && brand.defaultCtaUrl !== "#"
          ? brand.defaultCtaUrl.replace(/^https?:\/\//, "")
          : "",
      primaryColor: (colors.primaryColor || "").trim(),
      accentColor: (colors.accentColor || "").trim(),
      fonts,
    };
  }

  const assets = resolveOnePagerAssets(brand);
  const logoPng = assets.logoUrl
    ? await loadImageAsBase64(assets.logoUrl).catch(() => null)
    : null;

  const content: AgendaPdfContent = {
    eventName: args.eventName,
    eventLocation: args.eventLocation ?? "",
    eventDates: args.eventDates ?? "",
    accountName: args.accountName,
    personalNote: args.personalNote ?? "",
    days: args.days,
  };

  const doc = await generateEventAgendaPdf(content, { logoPng, brand: brandCtx });
  doc.save(`${fileToken(args.accountName)}-${fileToken(args.eventName)}-agenda.pdf`);
}
