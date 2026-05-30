import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { OverlayField, CustomTemplate } from "./index.js";

export const svgToPng = (svgSrc: string, w: number, h: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w * 2, h * 2);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject; img.src = svgSrc;
  });

export const hexToRgb = (hex: string): [number, number, number] => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
};

export const loadImg = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0); resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject; img.src = src;
  });

// Draw a circle clipped image (or initials fallback) for a team member photo.
async function drawTeamPhoto(
  doc: jsPDF,
  photoUrl: string | undefined,
  initials: string,
  cx: number, cy: number, radius: number,
  bgColor: [number, number, number],
) {
  // Draw circle background
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.circle(cx, cy, radius, "F");

  if (photoUrl) {
    try {
      const imgData = await loadImg(photoUrl);
      // jsPDF doesn't natively clip to circle — draw square image then overlay
      // Use a canvas to produce a circular PNG
      const sz = Math.round(radius * 2 * 4); // 4× for quality
      const canvas = document.createElement("canvas");
      canvas.width = sz; canvas.height = sz;
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = imgData; });
      ctx.drawImage(img, 0, 0, sz, sz);
      const circleData = canvas.toDataURL("image/png");
      doc.addImage(circleData, "PNG", cx - radius, cy - radius, radius * 2, radius * 2);
      return;
    } catch { /* fall through to initials */ }
  }

  // Initials fallback
  const fontSize = Math.max(8, radius * 0.9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(255, 255, 255);
  const tw = doc.getTextWidth(initials);
  doc.text(initials, cx - tw / 2, cy + fontSize * 0.35);
}

/**
 * Brand context for the custom-template PDF generator. Threaded in by each
 * caller (resolved from the tenant's BrandConfig) so the generator never
 * hardcodes Dandy assets/URLs. Every field is optional and empty values mean
 * "skip / render nothing" — the generator must NEVER fall back to a Dandy
 * default (logo, wordmark, or QR URL).
 */
export interface CustomTemplatePdfBrandOpts {
  /** SVG (or image) URL for the brand wordmark rendered in a legacy
   *  `dandy_logo` field. When omitted/empty, the generator falls back to
   *  `brandWordmark` text; when that is also empty it renders nothing. */
  brandLogoSvgUrl?: string;
  /** Plain-text wordmark drawn when no `brandLogoSvgUrl` is available (or it
   *  fails to load). When this is also empty, nothing is rendered — never a
   *  hardcoded Dandy wordmark. */
  brandWordmark?: string;
  /** Fallback URL encoded into a blank `qr_code` field. When empty, the QR is
   *  skipped entirely — never defaults to a Dandy URL. */
  qrFallbackUrl?: string;
  /** Tenant brand PRIMARY color (hex). Used for brand-tinted surfaces such as
   *  the team-photo initials circle. When empty, Dandy's hard-coded green is
   *  kept so Dandy output is unchanged. */
  primaryColor?: string;
  /** Tenant brand ACCENT color (hex). Reserved for accent-tinted custom-template
   *  surfaces. When empty, Dandy defaults are kept. */
  accentColor?: string;
}

/**
 * Generate a PDF from a custom template by drawing field overlays on top of the background image.
 */
export async function generateCustomTemplatePdf(
  tpl: CustomTemplate,
  values: Record<string, string>,
  brandOpts: CustomTemplatePdfBrandOpts = {},
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: tpl.orientation === "landscape" ? "landscape" : "portrait", unit: "pt", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  if (tpl.background_url) {
    try {
      const imgData = await loadImg(tpl.background_url);
      doc.addImage(imgData, "PNG", 0, 0, w, h);
    } catch {
      doc.setFillColor(240, 240, 240); doc.rect(0, 0, w, h, "F");
    }
  } else {
    doc.setFillColor(240, 240, 240); doc.rect(0, 0, w, h, "F");
  }

  // Resolve a value for a field. Lookup order:
  //   1. values[field.id]  (per-field-id, used by the auto-generated sales form)
  //   2. legacy type-keyed key (values.dso_name / values.phone / values.qr_url)
  //   3. field.defaultValue
  //   4. ""
  // This keeps existing callers (which pass {dso_name, phone, qr_url}) working
  // while letting the new sales form key per-field by id for templates that
  // expose heading/custom_text/footer/link/etc. fields.
  const resolveValue = (field: OverlayField): string => {
    if (values[field.id] !== undefined && values[field.id] !== "") return values[field.id];
    if (field.type === "dso_name" && values.dso_name) return values.dso_name;
    if (field.type === "phone" && values.phone) return values.phone;
    if (field.type === "qr_code" && values.qr_url) return values.qr_url;
    if (field.type === "logo" && values.logo_url) return values.logo_url;
    // Logo fields don't have a meaningful defaultValue (logoUrl lives separately),
    // so fall through with "" rather than returning the label/empty defaultValue.
    if (field.type === "logo") return "";
    return field.defaultValue || "";
  };

  for (const field of tpl.fields) {
    const fx = w * (field.x / 100);
    const fy = h * (field.y / 100);

    // ── QR Code ───────────────────────────────────────────────────────
    if (field.type === "qr_code") {
      // Use the per-field value, else the brand fallback. NEVER default to a
      // Dandy URL — when there is no URL at all, skip drawing entirely.
      const url = resolveValue(field) || brandOpts.qrFallbackUrl || "";
      if (!url) {
        console.info("[one-pager-pdf] qr_no_url: blank QR field with no brand fallback — skipping");
        continue;
      }
      try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
        const sz = w * ((field.qrSize || 12) / 100);
        doc.addImage(qrDataUrl, "PNG", fx, fy, sz, sz);
      } catch { /* skip */ }
      continue;
    }

    // ── Brand Logo (legacy `dandy_logo` field type — now brand-agnostic) ──
    // The enum name `dandy_logo` is retained so existing saved templates keep
    // working, but the asset rendered is the tenant's OWN brand logo/wordmark
    // (or nothing). It must never emit a Dandy logo or a hardcoded Dandy
    // wordmark for a non-Dandy tenant.
    if (field.type === "dandy_logo") {
      if (brandOpts.brandLogoSvgUrl) {
        try {
          const logoPng = await svgToPng(brandOpts.brandLogoSvgUrl, 206, 74);
          const scale = field.logoScale || 11.4;
          const lw = w * (scale / 100); const lh = lw * (74 / 206);
          doc.addImage(logoPng, "PNG", fx, fy, lw, lh);
          continue;
        } catch {
          console.info("[one-pager-pdf] logo_load_failed: brand logo failed to load — falling back to wordmark text");
        }
      }
      const wordmark = (brandOpts.brandWordmark || "").trim();
      if (wordmark) {
        const rgb = hexToRgb(field.color || "#FFFFFF");
        doc.setFont("helvetica", "bold"); doc.setFontSize(field.fontSize || 18); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(wordmark, fx, fy + (field.fontSize || 18));
      } else {
        console.info("[one-pager-pdf] wordmark_empty: no brand logo or wordmark — skipping logo field");
      }
      continue;
    }

    // ── Logo (prospect) ───────────────────────────────────────────────
    if (field.type === "logo") {
      // resolveValue() honors values[field.id] first (per-field-id from the
      // auto-generated sales form), then falls back to legacy values.logo_url.
      // If both are empty, fall back to the field's stored logoUrl.
      const logoUrl = resolveValue(field) || field.logoUrl;
      if (logoUrl) {
        try {
          const imgData = await loadImg(logoUrl);
          const scale = field.logoScale || 15; const lw = w * (scale / 100);
          const img = new Image(); img.src = imgData;
          await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); });
          const lh = img.height > 0 ? lw * (img.height / img.width) : lw * 0.4;
          doc.addImage(imgData, "PNG", fx, fy, lw, lh);
        } catch { /* skip */ }
      }
      continue;
    }

    // ── Divider ───────────────────────────────────────────────────────
    if (field.type === "divider") {
      const rgb = hexToRgb(field.color || "#CCCCCC");
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(field.lineThickness || 0.75);
      const lineW = w * ((field.width ?? 80) / 100);
      doc.line(fx, fy, fx + lineW, fy);
      continue;
    }

    // ── Meet The Team ─────────────────────────────────────────────────
    if (field.type === "meet_the_team") {
      const members = field.teamMembers ?? [];
      if (members.length === 0) continue;

      const sectionTitle = field.sectionTitle || "Meet The Team";
      const blockW = w * ((field.width ?? 80) / 100);
      const titleFontSize = field.fontSize || 14;
      const nameFontSize = Math.max(8, titleFontSize - 2);
      const subtitleFontSize = Math.max(6, titleFontSize - 4);
      const photoRadius = w * ((field.photoSize ?? 5) / 100);
      const cardW = blockW / members.length;
      const sectionRgb = hexToRgb(field.color || "#FFFFFF");

      // Section heading
      doc.setFont(field.fontFamily || "helvetica", "bold");
      doc.setFontSize(titleFontSize);
      doc.setTextColor(sectionRgb[0], sectionRgb[1], sectionRgb[2]);
      doc.text(sectionTitle, fx, fy);

      const cardsY = fy + titleFontSize * 1.5;

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const cardX = fx + i * cardW + cardW / 2; // center of card
        const initials = m.name.split(" ").map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2);

        // Photo circle — use a muted dark green for the bg
        const teamPhotoBg: [number, number, number] = (brandOpts.primaryColor || "").trim()
          ? hexToRgb(brandOpts.primaryColor!.trim())
          : [30, 80, 60];
        await drawTeamPhoto(doc, m.photoUrl, initials, cardX, cardsY + photoRadius, photoRadius, teamPhotoBg);

        // Name
        doc.setFont(field.fontFamily || "helvetica", "bold");
        doc.setFontSize(nameFontSize);
        doc.setTextColor(sectionRgb[0], sectionRgb[1], sectionRgb[2]);
        const nameW = doc.getTextWidth(m.name);
        doc.text(m.name, cardX - nameW / 2, cardsY + photoRadius * 2 + nameFontSize * 1.4);

        // Title
        doc.setFont(field.fontFamily || "helvetica", "normal");
        doc.setFontSize(subtitleFontSize);
        const titleRgb: [number, number, number] = [
          Math.min(255, sectionRgb[0] + 40),
          Math.min(255, sectionRgb[1] + 40),
          Math.min(255, sectionRgb[2] + 40),
        ];
        doc.setTextColor(titleRgb[0], titleRgb[1], titleRgb[2]);
        const titleW = doc.getTextWidth(m.title);
        doc.text(m.title, cardX - titleW / 2, cardsY + photoRadius * 2 + nameFontSize * 1.4 + subtitleFontSize * 1.3);
      }
      continue;
    }

    // ── Text-based fields (heading / footer / link / custom_text / dso_name / phone) ──
    const rgb = hexToRgb(field.color || "#000000");
    const fontStyle = field.bold && field.italic ? "bolditalic" : field.bold ? "bold" : field.italic ? "italic" : "normal";
    doc.setFont(field.fontFamily || "helvetica", fontStyle);
    doc.setFontSize(field.fontSize || 12);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    let text = "";
    if (field.type === "dso_name") {
      const inner = resolveValue(field);
      text = `${field.prefix || ""}${inner}${field.suffix || ""}`;
    } else if (field.type === "heading" || field.type === "footer" || field.type === "custom_text") {
      // For these, fall back to label when no defaultValue+value, so empty
      // marketing-only fields still show something in the PDF.
      text = resolveValue(field) || field.label || "";
    } else {
      // phone, link
      text = resolveValue(field);
    }

    if (text) {
      doc.text(text, fx, fy, { lineHeightFactor: field.lineHeight ?? 1.15 });
      // Underline for links
      if (field.type === "link" && field.underline !== false) {
        const tw = doc.getTextWidth(text);
        const lineY = fy + 1.5;
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        doc.setLineWidth(0.5);
        doc.line(fx, lineY, fx + tw, lineY);
      }
    }
  }

  return doc;
}
