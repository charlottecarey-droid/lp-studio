/**
 * Launch assets made for a partner room from what the room already knows:
 * the two brands, their logos and the cover photo.
 *
 *   social graphics  the "us × them" lockup on the brand's dark colour, as a
 *                    square and as a link-preview image with the cover photo
 *   one-pager        the existing "New partner" one-pager generator, with the
 *                    partner's name, logo and sign-up link
 *
 * Everything runs in the team member's browser (the one-pager generator is
 * browser-side already), is uploaded to the media library, then filed into the
 * room's launch kit by POST /lp/partner-rooms/:pageId/kit-asset.
 */
import type { BrandConfig } from "@/lib/brand-config";

export interface LaunchAssetInput {
  pageId: number;
  partnerName: string;
  partnerLogoUrl: string;
  heroImageUrl: string;
  signupUrl: string;
  brand: BrandConfig;
  /** The kit's written pieces and links, for the media kit document. */
  texts?: { title: string; description: string; body: string }[];
  links?: { title: string; url: string }[];
  /** Names of the files in the kit, listed in the media kit document. */
  files?: string[];
}

export type LaunchAssetKey = "partnership-one-pager" | "social-image-1" | "social-image-2" | "media-kit";
export const LAUNCH_ASSETS: { key: LaunchAssetKey; kind: "pdf" | "image"; title: string; description: string }[] = [
  { key: "partnership-one-pager", kind: "pdf", title: "Partnership one-pager", description: "For regional leaders and locations" },
  { key: "social-image-1", kind: "image", title: "Social graphic, link preview", description: "Co-branded social graphic · 1200 × 627" },
  { key: "social-image-2", kind: "image", title: "Social graphic, square", description: "Co-branded social graphic · 1080 × 1080" },
  { key: "media-kit", kind: "pdf", title: "Media kit", description: "Announcement copy, social posts and links in one document" },
];

/* ── Colour ──────────────────────────────────────────────────────────────── */

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Mix a colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const to = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  return `#${rgb(hex).map((v) => Math.round(v + (to - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
/** The dark surface the graphics sit on: the brand's primary when it is dark enough for white logos, else a neutral ink. */
export function graphicSurface(brand: Pick<BrandConfig, "primaryColor">): string {
  const p = (brand.primaryColor ?? "").trim();
  return HEX.test(p) && luminance(p) < 0.2 ? p : "#0F1F1B";
}

/* ── Layout (pure, so it can be tested without a canvas) ─────────────────── */

export interface Box { x: number; y: number; w: number; h: number }

/** Fit an image of `iw × ih` inside `box`, centred, keeping its proportions. */
export function containBox(iw: number, ih: number, box: Box): Box {
  if (!(iw > 0) || !(ih > 0)) return box;
  const scale = Math.min(box.w / iw, box.h / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export interface SocialLayout {
  w: number;
  h: number;
  /** Where the photo goes (wide variant only). */
  photo: Box | null;
  /** Centre line of the lockup. */
  cx: number;
  brandLogo: Box;
  cross: { cx: number; cy: number; r: number };
  partnerLogo: Box;
}

export function socialLayout(variant: "wide" | "square"): SocialLayout {
  if (variant === "square") {
    const w = 1080, h = 1080, cx = w / 2;
    return { w, h, photo: null, cx, brandLogo: { x: cx - 220, y: 330, w: 440, h: 150 }, cross: { cx, cy: 558, r: 30 }, partnerLogo: { x: cx - 320, y: 630, w: 640, h: 130 } };
  }
  const w = 1200, h = 627, cx = 898;
  return { w, h, photo: { x: 0, y: 0, w: 700, h }, cx, brandLogo: { x: cx - 150, y: 166, w: 300, h: 100 }, cross: { cx, cy: 312, r: 20 }, partnerLogo: { x: cx - 200, y: 356, w: 400, h: 84 } };
}

/* ── Drawing ─────────────────────────────────────────────────────────────── */

interface Drawable { image: CanvasImageSource; w: number; h: number }

async function loadImage(url: string): Promise<Drawable | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth > 0 ? { image: img, w: img.naturalWidth, h: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawLogoOrName(ctx: CanvasRenderingContext2D, logo: Drawable | null, name: string, box: Box, font: string): void {
  if (logo) {
    const b = containBox(logo.w, logo.h, box);
    ctx.drawImage(logo.image, b.x, b.y, b.w, b.h);
    return;
  }
  // No usable logo: set the name in the display face, sized to fit the box.
  let size = Math.round(box.h * 0.72);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  do {
    ctx.font = `600 ${size}px ${font}`;
    size -= 2;
  } while (ctx.measureText(name).width > box.w && size > 14);
  ctx.fillText(name, box.x + box.w / 2, box.y + box.h / 2);
}

export interface SocialGraphicParts {
  surface: string;
  brandLogo: Drawable | null;
  partnerLogo: Drawable | null;
  photo: Drawable | null;
  brandName: string;
  partnerName: string;
  font: string;
}

export function drawSocialGraphic(ctx: CanvasRenderingContext2D, variant: "wide" | "square", parts: SocialGraphicParts): void {
  const L = socialLayout(variant);
  const { surface } = parts;
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, L.w, L.h);

  if (L.photo && parts.photo) {
    // Cover-fit the photo into its side, then fade it into the surface.
    const { photo } = parts;
    const scale = Math.max(L.photo.w / photo.w, L.photo.h / photo.h);
    const w = photo.w * scale, h = photo.h * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.photo.x, L.photo.y, L.photo.w, L.photo.h);
    ctx.clip();
    ctx.drawImage(photo.image, L.photo.x + (L.photo.w - w) / 2, L.photo.y + (L.photo.h - h) / 2, w, h);
    ctx.restore();
    const fade = ctx.createLinearGradient(L.photo.w * 0.42, 0, L.photo.w, 0);
    fade.addColorStop(0, `${surface}00`);
    fade.addColorStop(1, surface);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, L.photo.w + 2, L.h);
  }

  // Light and depth are laid over everything as transparent washes, so the photo's edge never shows a seam.
  const reach = Math.max(L.w, L.h);
  const glow = ctx.createRadialGradient(L.cx, L.h * 0.42, 0, L.cx, L.h * 0.42, reach * 0.55);
  glow.addColorStop(0, "rgba(255,255,255,0.07)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, L.w, L.h);
  const vignette = ctx.createRadialGradient(L.cx, L.h * 0.45, reach * 0.3, L.cx, L.h * 0.45, reach * 0.95);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, L.w, L.h);
  if (variant === "square") {
    // The large soft disc from the designed original.
    ctx.beginPath();
    ctx.arc(L.cx, L.h * 1.02, L.w * 0.86, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fill();
  }

  drawLogoOrName(ctx, parts.brandLogo, parts.brandName, L.brandLogo, parts.font);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = variant === "square" ? 3 : 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(L.cross.cx - L.cross.r, L.cross.cy - L.cross.r);
  ctx.lineTo(L.cross.cx + L.cross.r, L.cross.cy + L.cross.r);
  ctx.moveTo(L.cross.cx + L.cross.r, L.cross.cy - L.cross.r);
  ctx.lineTo(L.cross.cx - L.cross.r, L.cross.cy + L.cross.r);
  ctx.stroke();
  drawLogoOrName(ctx, parts.partnerLogo, parts.partnerName, L.partnerLogo, parts.font);
}

const DISPLAY_FONT = `"Bagoss Standard", "Bagoss", Inter, system-ui, sans-serif`;

export async function buildSocialGraphic(variant: "wide" | "square", input: LaunchAssetInput): Promise<Blob> {
  const L = socialLayout(variant);
  const canvas = document.createElement("canvas");
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the graphic.");
  const { brand } = input;
  const [brandLogo, partnerLogo, photo] = await Promise.all([
    loadImage((brand.logoUrlDark ?? "").trim() || (brand.logoUrl ?? "").trim()),
    loadImage(input.partnerLogoUrl),
    variant === "wide" ? loadImage(input.heroImageUrl) : Promise.resolve(null),
  ]);
  await document.fonts?.ready.catch(() => undefined);
  const parts: SocialGraphicParts = { surface: graphicSurface(brand), brandLogo, partnerLogo, photo, brandName: brand.brandName || "", partnerName: input.partnerName, font: DISPLAY_FONT };
  drawSocialGraphic(ctx, variant, parts);
  const toBlob = () => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  let blob: Blob | null = null;
  try {
    blob = await toBlob();
  } catch {
    blob = null;
  }
  if (!blob) {
    // An image from another site can't be read back out of a canvas. Redraw with names in place of those logos.
    const ctx2 = canvas.getContext("2d")!;
    canvas.width = L.w; // resets the canvas, clearing the taint
    drawSocialGraphic(ctx2, variant, { ...parts, brandLogo: null, partnerLogo: null, photo: null });
    blob = await toBlob();
  }
  if (!blob) throw new Error("Couldn't create the graphic.");
  return blob;
}

/* ── One-pager ───────────────────────────────────────────────────────────── */

async function imageAsDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  const img = await loadImage(url);
  if (!img) return null;
  try {
    // Rasterise at a generous size so a small or vector logo stays crisp in the PDF.
    const scale = Math.max(1, Math.min(4, 800 / img.w));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.w * scale);
    canvas.height = Math.round(img.h * scale);
    canvas.getContext("2d")!.drawImage(img.image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), w: img.w, h: img.h };
  } catch {
    return null;
  }
}

export async function buildPartnerOnePager(input: LaunchAssetInput): Promise<Blob> {
  const { brand } = input;
  // The generator and its brand plumbing live with the one-pager screen; load them only when needed.
  const [{ generateNewPartnerOnePager }, { resolveOnePagerAssets, resolveOnePagerColors, resolveBrandPdfFonts }] = await Promise.all([import("@/pages/sales/sales-one-pager"), import("@/lib/brand-config")]);
  const isHome = brand.isDandy === true;
  const label = (brand.brandName || "").trim();
  const site = brand.defaultCtaUrl && brand.defaultCtaUrl !== "#" ? brand.defaultCtaUrl : "";
  const colors = resolveOnePagerColors(brand);
  // Same brand context the one-pager screen builds: the home brand keeps its built-in look, everyone else gets theirs.
  const context = isHome
    ? { isDandy: true }
    : {
        wordmark: label.toLowerCase(),
        productName: label || "Our team",
        industryLabel: "Group",
        labName: label || "Our team",
        footerUrl: site.replace(/^https?:\/\//, ""),
        qrFallbackUrl: site,
        agreementName: `${label || "Partner"} Agreement`,
        agreementUrl: site,
        primaryColor: (colors.primaryColor || "").trim(),
        accentColor: (colors.accentColor || "").trim(),
        fonts: await resolveBrandPdfFonts(brand),
      };
  const logo = await imageAsDataUrl(input.partnerLogoUrl);
  const link = input.signupUrl || site || (isHome ? "https://meetdandy.com" : "");
  const doc = await generateNewPartnerOnePager(input.partnerName, logo?.data ?? null, logo ? { w: logo.w, h: logo.h } : { w: 200, h: 100 }, link, [], "", undefined, input.signupUrl || undefined, undefined, undefined, context as never, resolveOnePagerAssets(brand));
  return doc.output("blob");
}

/* ── Media kit document ──────────────────────────────────────────────────── */

type KitLine =
  | { kind: "text"; text: string; bold?: boolean; indent?: number; gap?: number }
  | { kind: "bullet"; label: string; text: string; first: boolean; gap?: number }
  | { kind: "subject"; text: string };

/**
 * Break a written piece into lines the document can set: a "Subject:" line
 * becomes a labelled header, "•" / "-" lines become bullets with a hanging
 * indent (a "Label: rest" bullet gets a bold label), blank lines become space.
 * `wrap` splits one paragraph to a width; it is passed in so this stays pure.
 */
export function layoutKitCopy(body: string, width: number, wrap: (text: string, width: number, bold?: boolean) => string[]): KitLine[] {
  const out: KitLine[] = [];
  let gap = 0;
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      gap = Math.max(gap, 9);
      continue;
    }
    const subject = /^subject:\s*(.+)$/i.exec(line);
    if (subject && out.length === 0) {
      out.push({ kind: "subject", text: subject[1] });
      gap = 12;
      continue;
    }
    const bullet = /^[•\-–*]\s+(.+)$/.exec(line);
    if (bullet) {
      const m = /^([^:]{2,60}):\s+(.+)$/.exec(bullet[1]);
      const label = m ? `${m[1]}: ` : "";
      const rest = m ? m[2] : bullet[1];
      // The label sits on the first line in bold; the rest wraps under the text, not under the dot.
      const lines = wrap(`${label}${rest}`, width - 14);
      lines.forEach((text, i) => out.push({ kind: "bullet", label: i === 0 ? label : "", text: i === 0 ? text.slice(label.length) : text, first: i === 0, gap: i === 0 ? Math.max(gap, 5) : 0 }));
      gap = 0;
      continue;
    }
    wrap(line, width).forEach((text, i) => out.push({ kind: "text", text, gap: i === 0 ? gap : 0 }));
    gap = 0;
  }
  return out;
}

/**
 * The room's written launch pieces in one document: a cover with both logos
 * and names, each piece (announcement email, social posts, approved
 * description) set as a clean block ready to copy, the logos, the files in the
 * kit and the links. Built from the kit itself, so it says what the room says.
 */
export async function buildMediaKit(input: LaunchAssetInput): Promise<Blob> {
  const [{ jsPDF }, { headlineFontFor }, { resolveBrandPdfFonts }] = await Promise.all([import("jspdf"), import("@workspace/one-pager-types/generators"), import("@/lib/brand-config")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const { brand } = input;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  const CW = W - M * 2;
  const surface = graphicSurface(brand);
  const tone = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const DARK = tone(surface);
  const accentHex = /^#[0-9a-f]{6}$/i.test((brand.accentColor ?? "").trim()) ? brand.accentColor!.trim() : "#C7E738";
  const ACCENT = tone(accentHex);
  const INK: [number, number, number] = [24, 32, 28];
  const MUTE: [number, number, number] = [104, 114, 108];
  const brandName = (brand.brandName || "").trim();
  const pair = brandName ? `${brandName} × ${input.partnerName}` : input.partnerName;
  // Headlines in the brand's display face (Bagoss for Dandy); body in the built-in face.
  const head = headlineFontFor(doc, brand.isDandy === true ? ({ isDandy: true } as never) : ({ fonts: await resolveBrandPdfFonts(brand) } as never));
  const setHead = (size: number, color: [number, number, number]) => {
    doc.setFont(head.font, head.style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const setBody = (size: number, color: [number, number, number], bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const [brandLight, brandDark, partnerLogo] = await Promise.all([imageAsDataUrl((brand.logoUrlDark ?? "").trim() || ""), imageAsDataUrl((brand.logoUrl ?? "").trim() || ""), imageAsDataUrl(input.partnerLogoUrl)]);
  /** Draw an image fitted inside a box, left-aligned (or centred), and return the width used. */
  const place = (img: { data: string; w: number; h: number }, x: number, y: number, maxW: number, maxH: number, centre = false): number => {
    const b = containBox(img.w, img.h, { x, y, w: maxW, h: maxH });
    const w = b.w;
    doc.addImage(img.data, "PNG", centre ? b.x : x, b.y, w, b.h);
    return w;
  };

  /* Cover */
  const COVER_H = 318;
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, COVER_H, "F");
  // Both logos, as on the social graphics; a name stands in for a logo that isn't uploaded.
  let x = M;
  const logoY = 50;
  const brandMark = brandLight ?? null;
  if (brandMark) x += place(brandMark, x, logoY, 120, 26);
  else {
    setHead(18, [255, 255, 255]);
    doc.text(brandName || " ", x, logoY + 20);
    x += doc.getTextWidth(brandName || " ");
  }
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1);
  doc.line(x + 14, logoY + 8, x + 24, logoY + 18);
  doc.line(x + 24, logoY + 8, x + 14, logoY + 18);
  x += 38;
  if (partnerLogo) place(partnerLogo, x, logoY - 1, 170, 28);
  else {
    setHead(18, [255, 255, 255]);
    doc.text(input.partnerName, x, logoY + 20);
  }
  setBody(9, ACCENT, true);
  doc.text("PARTNERSHIP MEDIA KIT", M, 150, { charSpace: 1.6 });
  setHead(36, [255, 255, 255]);
  const title = doc.splitTextToSize(pair, CW) as string[];
  doc.text(title, M, 192, { lineHeightFactor: 1.12 });
  const afterTitle = 192 + (title.length - 1) * 40;
  setBody(12, [226, 234, 229]);
  doc.text(doc.splitTextToSize("Approved copy, logos, graphics and links for announcing the partnership. Everything here is ready to use as written.", CW * 0.78) as string[], M, afterTitle + 34, { lineHeightFactor: 1.4 });

  let y = COVER_H + 44;
  const footer = () => {
    setBody(8.5, [146, 154, 149]);
    doc.text(pair, M, H - 32);
    doc.text(String(doc.getNumberOfPages()), W - M, H - 32, { align: "right" });
  };
  const newPage = () => {
    footer();
    doc.addPage();
    y = 68;
  };
  const room = (needed: number) => {
    if (y + needed > H - 62) newPage();
  };

  /* In this kit */
  const contents = [...(input.texts ?? []).map((t) => t.title), ...(brandLight || brandDark || partnerLogo ? ["Logos"] : []), ...((input.files ?? []).length ? ["Files"] : []), ...((input.links ?? []).length ? ["Links"] : [])];
  if (contents.length) {
    setBody(9, DARK, true);
    doc.text("IN THIS KIT", M, y, { charSpace: 1.4 });
    y += 20;
    contents.forEach((c, i) => {
      const col = i % 2;
      setBody(11, INK);
      doc.text(c, M + col * (CW / 2), y);
      if (col === 1 || i === contents.length - 1) y += 19;
    });
    y += 18;
  }

  const sectionTitle = (text: string, sub?: string) => {
    room(96);
    setHead(20, DARK);
    doc.text(text, M, y);
    y += 8;
    if (sub) {
      setBody(10, MUTE);
      const lines = doc.splitTextToSize(sub, CW) as string[];
      doc.text(lines, M, y + 9);
      y += lines.length * 13;
    }
    y += 14;
  };

  /* Written pieces: each in a pale block, with real paragraphs and bullets */
  const PAD = 20;
  const LEAD = 15.5;
  const wrap = (text: string, width: number) => {
    setBody(10.5, INK);
    return doc.splitTextToSize(text, width) as string[];
  };
  const heightOf = (l: KitLine) => (l.kind === "subject" ? 34 : LEAD + (l.gap ?? 0));
  for (const piece of input.texts ?? []) {
    sectionTitle(piece.title, piece.description);
    const lines = layoutKitCopy(piece.body, CW - PAD * 2, wrap);
    let i = 0;
    while (i < lines.length) {
      // Take as many lines as fit on this page, and draw the block behind them first.
      const avail = H - 62 - y - PAD * 2;
      let used = 0;
      let j = i;
      while (j < lines.length && used + heightOf(lines[j]) <= avail) used += heightOf(lines[j++]);
      // Never leave one or two lines of a piece stranded at the foot of a page.
      if (j === i || (j < lines.length && j - i < 3)) {
        newPage();
        continue;
      }
      doc.setFillColor(246, 247, 243);
      doc.roundedRect(M, y, CW, used + PAD * 2 - 4, 8, 8, "F");
      let ty = y + PAD + 9;
      for (const l of lines.slice(i, j)) {
        if (l.kind === "subject") {
          setBody(8, MUTE, true);
          doc.text("SUBJECT", M + PAD, ty - 2, { charSpace: 1.2 });
          setBody(11, INK, true);
          doc.text((doc.splitTextToSize(l.text, CW - PAD * 2) as string[])[0], M + PAD, ty + 12);
          doc.setDrawColor(224, 228, 221);
          doc.setLineWidth(0.6);
          doc.line(M + PAD, ty + 22, M + CW - PAD, ty + 22);
          ty += 34;
          continue;
        }
        ty += l.gap ?? 0;
        if (l.kind === "bullet") {
          if (l.first) {
            doc.setFillColor(...DARK);
            doc.circle(M + PAD + 3, ty - 3.4, 1.7, "F");
          }
          let bx = M + PAD + 14;
          if (l.label) {
            setBody(10.5, INK, true);
            doc.text(l.label.trimEnd(), bx, ty);
            bx += doc.getTextWidth(l.label.trimEnd()) + 3;
          }
          setBody(10.5, INK);
          doc.text(l.text, bx, ty);
        } else {
          setBody(10.5, INK, l.bold);
          doc.text(l.text, M + PAD, ty);
        }
        ty += LEAD;
      }
      y += used + PAD * 2 - 4;
      i = j;
      if (i < lines.length) newPage();
    }
    y += 34;
  }

  /* Logos: on the surface each is made for */
  if (brandLight || brandDark || partnerLogo) {
    sectionTitle("Logos", "Use the logos as supplied: do not recolour, stretch or crop them.");
    const tileH = 104;
    const gap = 16;
    const tiles: { img: { data: string; w: number; h: number }; dark: boolean; label: string }[] = [
      ...(brandLight ? [{ img: brandLight, dark: true, label: `${brandName || "Our"} logo, for dark backgrounds` }] : []),
      ...(brandDark && brandDark.data !== brandLight?.data ? [{ img: brandDark, dark: false, label: `${brandName || "Our"} logo, for light backgrounds` }] : []),
      ...(partnerLogo ? [{ img: partnerLogo, dark: true, label: `${input.partnerName} logo` }] : []),
    ];
    const tw = (CW - gap) / 2;
    tiles.forEach((t, i) => {
      const col = i % 2;
      if (col === 0) room(tileH + 34);
      const tx = M + col * (tw + gap);
      if (t.dark) doc.setFillColor(...DARK);
      else doc.setFillColor(246, 247, 243);
      doc.roundedRect(tx, y, tw, tileH, 8, 8, "F");
      place(t.img, tx + 34, y + 30, tw - 68, tileH - 60, true);
      setBody(9.5, MUTE);
      doc.text(t.label, tx, y + tileH + 15);
      if (col === 1 || i === tiles.length - 1) y += tileH + 34;
    });
    y += 10;
  }

  const rows = (items: { title: string; sub?: string; url?: string }[]) => {
    for (const it of items) {
      room(it.sub ? 40 : 28);
      setBody(11, INK, true);
      doc.text(it.title, M, y);
      if (it.sub) {
        setBody(9.5, [34, 78, 160]);
        const shown = (doc.splitTextToSize(it.sub, CW) as string[])[0];
        if (it.url) doc.textWithLink(shown, M, y + 14, { url: it.url });
        else doc.text(shown, M, y + 14);
      }
      y += it.sub ? 26 : 14;
      doc.setDrawColor(228, 231, 224);
      doc.setLineWidth(0.6);
      doc.line(M, y, W - M, y);
      y += 16;
    }
  };
  if ((input.files ?? []).length) {
    sectionTitle("Files", "Download each one from the launch kit in your partner room.");
    rows((input.files ?? []).map((f) => ({ title: f })));
    y += 16;
  }
  if ((input.links ?? []).length) {
    sectionTitle("Links");
    rows((input.links ?? []).map((l) => ({ title: l.title, sub: l.url, url: l.url })));
  }
  footer();
  return doc.output("blob");
}

/* ── Upload + file into the room ─────────────────────────────────────────── */

const fileSlug = (s: string) => s.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "partner";

async function upload(blob: Blob, name: string, kind: "pdf" | "image"): Promise<string> {
  if (kind === "pdf") {
    // The same path as the builder's PDF upload, so the file gets its preview and library entry.
    const { uploadPdf } = await import("@/components/PdfUploadButton");
    return (await uploadPdf(new File([blob], name, { type: "application/pdf" }))).url;
  }
  const form = new FormData();
  form.append("file", new File([blob], name, { type: "image/png" }));
  const res = await fetch("/api/lp/upload", { method: "POST", body: form, credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url.startsWith("/api/storage") ? json.url : `/api/storage${json.url}`;
}

/** Make one launch asset, upload it and file it into the room's kit. */
export async function createLaunchAsset(key: LaunchAssetKey, input: LaunchAssetInput): Promise<string> {
  const spec = LAUNCH_ASSETS.find((a) => a.key === key)!;
  const base = `${fileSlug(input.brand.brandName || "")}-x-${fileSlug(input.partnerName)}`;
  const blob = key === "partnership-one-pager" ? await buildPartnerOnePager(input) : key === "media-kit" ? await buildMediaKit(input) : await buildSocialGraphic(key === "social-image-1" ? "wide" : "square", input);
  const fileUrl = await upload(blob, key === "partnership-one-pager" ? `${base}-one-pager.pdf` : key === "media-kit" ? `${base}-media-kit.pdf` : `${base}-social-${key === "social-image-1" ? "wide" : "square"}.png`, spec.kind);
  const res = await fetch(`/api/lp/partner-rooms/${input.pageId}/kit-asset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, kind: spec.kind, title: spec.title, description: spec.description, fileUrl }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not add it to the launch kit");
  return fileUrl;
}
