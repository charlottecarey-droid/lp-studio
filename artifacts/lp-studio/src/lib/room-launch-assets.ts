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

/**
 * The room's written launch pieces in one document: a cover with both names,
 * then each piece (announcement email, social posts, approved description)
 * ready to copy, the files in the kit, and the links. Built from the kit
 * itself, so it always says what the room says.
 */
export async function buildMediaKit(input: LaunchAssetInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  const surface = graphicSurface(input.brand);
  const [sr, sg, sb] = [1, 3, 5].map((i) => parseInt(surface.slice(i, i + 2), 16));
  const brandName = (input.brand.brandName || "").trim();
  const pair = brandName ? `${brandName} × ${input.partnerName}` : input.partnerName;

  // Cover band
  doc.setFillColor(sr, sg, sb);
  doc.rect(0, 0, W, 250, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PARTNERSHIP MEDIA KIT", M, 78, { charSpace: 1.5 });
  doc.setFontSize(30);
  doc.text(doc.splitTextToSize(pair, W - M * 2) as string[], M, 122);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.text(doc.splitTextToSize("Approved copy, graphics and links for announcing the partnership. Everything here is ready to use as written.", W - M * 2) as string[], M, 196);

  let y = 292;
  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 148, 143);
    doc.text(pair, M, H - 30);
    doc.text(String(doc.getNumberOfPages()), W - M, H - 30, { align: "right" });
  };
  const room = (needed: number) => {
    if (y + needed <= H - 56) return;
    footer();
    doc.addPage();
    y = 64;
  };
  const heading = (text: string) => {
    room(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(sr, sg, sb);
    doc.text(text.toUpperCase(), M, y, { charSpace: 1.2 });
    doc.setDrawColor(222, 226, 220);
    doc.line(M, y + 8, W - M, y + 8);
    y += 30;
  };

  for (const t of input.texts ?? []) {
    room(90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(sr, sg, sb);
    doc.text(t.title, M, y);
    y += 16;
    if (t.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110, 120, 114);
      doc.text(doc.splitTextToSize(t.description, W - M * 2) as string[], M, y);
      y += 16;
    }
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(28, 36, 32);
    // The copy itself, on a rule so it reads as a block to lift out.
    for (const para of t.body.split(/\n/)) {
      const lines = para.trim() ? (doc.splitTextToSize(para, W - M * 2 - 16) as string[]) : [""];
      for (const line of lines) {
        room(15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(28, 36, 32);
        doc.setDrawColor(sr, sg, sb);
        doc.setLineWidth(1.5);
        doc.line(M, y - 9, M, y + 5);
        doc.setLineWidth(0.5);
        doc.text(line, M + 16, y);
        y += 15;
      }
    }
    y += 22;
  }

  if ((input.files ?? []).length) {
    heading("Files in this kit");
    for (const f of input.files ?? []) {
      room(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(28, 36, 32);
      doc.text(`•  ${f}`, M, y);
      y += 16;
    }
    doc.setFontSize(9.5);
    doc.setTextColor(110, 120, 114);
    room(18);
    doc.text("Download each file from the launch kit in your partner room.", M, y + 2);
    y += 28;
  }

  if ((input.links ?? []).length) {
    heading("Links");
    for (const l of input.links ?? []) {
      room(32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(28, 36, 32);
      doc.text(l.title, M, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(34, 78, 160);
      doc.textWithLink((doc.splitTextToSize(l.url, W - M * 2) as string[])[0], M, y + 14, { url: l.url });
      y += 34;
    }
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
