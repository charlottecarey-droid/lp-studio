import jsPDF from "jspdf";
import { BAGOSS_REGULAR_BASE64 } from "./fonts/bagoss-regular.js";

// ── Shared constants ───────────────────────────────────────────────────
const darkGreen: [number, number, number] = [0, 40, 32];
const midGreen: [number, number, number] = [0, 55, 45];
const lime: [number, number, number] = [163, 190, 60];
const white: [number, number, number] = [255, 255, 255];
const offWhite: [number, number, number] = [248, 248, 244];
const textDark: [number, number, number] = [30, 40, 35];
const textMuted: [number, number, number] = [90, 100, 95];
const subtleText: [number, number, number] = [140, 150, 145];
const lineColor: [number, number, number] = [200, 205, 200];

// Register Bagoss Standard (Regular weight) into a jsPDF doc once. Safe to
// call multiple times — `addFileToVFS` and `addFont` are idempotent within a
// single doc, but we still guard to skip work if already registered.
function ensureBagoss(doc: jsPDF): boolean {
  try {
    const list = doc.getFontList?.() ?? {};
    if (list["Bagoss"]) return true;
    doc.addFileToVFS("Bagoss-Regular.ttf", BAGOSS_REGULAR_BASE64);
    doc.addFont("Bagoss-Regular.ttf", "Bagoss", "normal");
    return true;
  } catch {
    return false;
  }
}

// True only when the base64 decodes to bytes whose signature is a real
// SFNT/OpenType font (TrueType 0x00010000, 'OTTO', 'true', or 'ttcf'). jsPDF's
// addFont does NOT throw on malformed bytes — it logs via its PubSub and leaves
// the face registered but metric-less, which crashes the next getTextWidth().
// So we must reject non-font bytes up front; a failed check just keeps the
// built-in face for that style (the per-style fallback).
function isEmbeddableFont(b64?: string): b64 is string {
  if (!b64) return false;
  try {
    const head = b64.replace(/\s/g, "").slice(0, 16);
    const bin =
      typeof atob === "function"
        ? atob(head)
        : Buffer.from(head, "base64").toString("binary");
    if (bin.length < 4) return false;
    const sig = bin.slice(0, 4);
    const c0 = sig.charCodeAt(0);
    return (
      (c0 === 0x00 && sig.charCodeAt(1) === 0x01 && sig.charCodeAt(2) === 0x00 && sig.charCodeAt(3) === 0x00) ||
      sig === "OTTO" ||
      sig === "true" ||
      sig === "ttcf"
    );
  } catch {
    return false;
  }
}

// Override one jsPDF font face (by built-in name + style) with embedded base64
// TTF bytes. Only styles actually supplied are overridden, so a missing
// italic/bold keeps the built-in face. Any malformed/non-font base64 is swallowed
// per-face — embedding a brand font must never block PDF generation.
function overrideFontFace(doc: jsPDF, name: string, faces?: EmbeddedFontFaces): void {
  if (!faces) return;
  const reg = (style: string, b64?: string) => {
    if (!isEmbeddableFont(b64)) return;
    try {
      const file = `${name}-brand-${style}.ttf`;
      doc.addFileToVFS(file, b64);
      doc.addFont(file, name, style);
    } catch {
      /* leave the built-in face in place for this style */
    }
  };
  reg("normal", faces.normal);
  reg("bold", faces.bold);
  reg("italic", faces.italic);
  reg("bolditalic", faces.bolditalic);
}

// Register the tenant's embedded brand fonts onto a doc by overriding jsPDF's
// built-in faces: BODY font → "helvetica" (the bulk of one-pager text), DISPLAY
// font → "Bagoss" (headlines). No-op when the brand carries no embedded fonts,
// so Dandy and tenants without resolvable Google fonts keep the built-ins.
function registerBrandFonts(doc: jsPDF, brand?: BrandContext): void {
  const fonts = brand?.fonts;
  if (!fonts) return;
  overrideFontFace(doc, "helvetica", fonts.body);
  if (fonts.heading) {
    // Ensure the "Bagoss" name exists, then override its faces with the brand
    // display font so headlines (which select the "Bagoss" face) render in it.
    ensureBagoss(doc);
    overrideFontFace(doc, "Bagoss", fonts.heading);
  }
}

function drawSep(doc: jsPDF, x: number, y: number, len: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + len, y);
}

async function cropImage(
  src: string,
  targetW: number,
  targetH: number,
  anchor: "top" | "center" | "bottom" = "center",
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const srcAspect = img.naturalWidth / img.naturalHeight;
      const dstAspect = targetW / targetH;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcAspect > dstAspect) {
        sw = Math.round(img.naturalHeight * dstAspect);
        sx = Math.round((img.naturalWidth - sw) / 2);
      } else {
        sh = Math.round(img.naturalWidth / dstAspect);
        if (anchor === "top") sy = 0;
        else if (anchor === "bottom") sy = img.naturalHeight - sh;
        else sy = Math.round((img.naturalHeight - sh) / 2);
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(targetW * 2);
      canvas.height = Math.round(targetH * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// ── Embedded brand fonts ───────────────────────────────────────────────
// jsPDF can only embed TrueType/OpenType bytes. The client resolves a brand
// font's faces to base64 TTF (via the /sales/brand-font resolver) and passes
// them here so the generators can override jsPDF's built-in faces with the
// tenant's actual brand font. Any style that isn't supplied falls back to the
// built-in face, so a partial embed degrades gracefully.
export interface EmbeddedFontFaces {
  /** Family name (informational; jsPDF overrides key off the built-in name). */
  family: string;
  /** base64 TTF for the regular (400, upright) face. */
  normal?: string;
  /** base64 TTF for the bold (700, upright) face. */
  bold?: string;
  /** base64 TTF for the italic (400, italic) face. */
  italic?: string;
  /** base64 TTF for the bold-italic (700, italic) face. */
  bolditalic?: string;
}

export interface BrandPdfFonts {
  /** Brand BODY font — overrides the built-in "helvetica" used for body copy. */
  body?: EmbeddedFontFaces;
  /** Brand DISPLAY font — overrides the "Bagoss" face used for headlines. */
  heading?: EmbeddedFontFaces;
}

// ── Brand context ──────────────────────────────────────────────────────
// Per-tenant overrides for everything that used to be hard-coded "Dandy".
// All fields are optional; resolveBrand() merges with Dandy defaults so the
// generators remain backwards-compatible when no brand is supplied.
export interface BrandContext {
  /** Lowercase wordmark text fallback when no logo PNG is provided (e.g. "dandy"). */
  wordmark?: string;
  /** Product name used in copy (e.g. "Dandy"). */
  productName?: string;
  /** Industry segment label (e.g. "DSO"). */
  industryLabel?: string;
  /** Lab/business name used in testimonials etc. (e.g. "Dandy Dental Lab"). */
  labName?: string;
  /** Plain-text footer URL (e.g. "www.meetdandy.com/dso"). Empty string hides it. */
  footerUrl?: string;
  /** Default URL embedded in QR codes when none is set (e.g. "https://meetdandy.com"). */
  qrFallbackUrl?: string;
  /** Agreement document name (e.g. "Dandy Practice Agreement"). */
  agreementName?: string;
  /** Agreement document URL. */
  agreementUrl?: string;
  /** Tenant brand PRIMARY color (hex, e.g. "#0F3D2E"). When supplied (non-Dandy
   *  tenants) the generators derive their dark band / panel fills and on-light
   *  text from it instead of Dandy's hard-coded green. Empty/absent → Dandy. */
  primaryColor?: string;
  /** Tenant brand ACCENT color (hex). When supplied, replaces Dandy's lime for
   *  accent fills, pills, and on-dark highlight text. Empty/absent → Dandy. */
  accentColor?: string;
  /** Embedded brand fonts (base64 TTF). When present, the generators override
   *  jsPDF's built-in "helvetica" (body) and "Bagoss" (display) faces with the
   *  tenant's actual brand fonts. Not part of resolveBrand() defaults — read
   *  directly off the raw brand in registerBrandFonts(). */
  fonts?: BrandPdfFonts;
}

export const DEFAULT_BRAND_CONTEXT: Required<Omit<BrandContext, "fonts">> = {
  wordmark: "dandy",
  productName: "Dandy",
  industryLabel: "DSO",
  labName: "Dandy Dental Lab",
  footerUrl: "www.meetdandy.com/dso",
  qrFallbackUrl: "https://meetdandy.com",
  agreementName: "Dandy Practice Agreement",
  agreementUrl: "https://meetdandy.com/practice-agreement",
  primaryColor: "",
  accentColor: "",
};

function resolveBrand(b?: BrandContext): Required<Omit<BrandContext, "fonts">> {
  if (!b) return DEFAULT_BRAND_CONTEXT;
  return {
    wordmark: b.wordmark ?? DEFAULT_BRAND_CONTEXT.wordmark,
    productName: b.productName ?? DEFAULT_BRAND_CONTEXT.productName,
    industryLabel: b.industryLabel ?? DEFAULT_BRAND_CONTEXT.industryLabel,
    labName: b.labName ?? DEFAULT_BRAND_CONTEXT.labName,
    footerUrl: b.footerUrl ?? DEFAULT_BRAND_CONTEXT.footerUrl,
    qrFallbackUrl: b.qrFallbackUrl ?? DEFAULT_BRAND_CONTEXT.qrFallbackUrl,
    agreementName: b.agreementName ?? DEFAULT_BRAND_CONTEXT.agreementName,
    agreementUrl: b.agreementUrl ?? DEFAULT_BRAND_CONTEXT.agreementUrl,
    primaryColor: b.primaryColor ?? DEFAULT_BRAND_CONTEXT.primaryColor,
    accentColor: b.accentColor ?? DEFAULT_BRAND_CONTEXT.accentColor,
  };
}

// ── Brand palette ──────────────────────────────────────────────────────
// The built-in generators were authored against Dandy's fixed green/lime
// palette. For non-Dandy tenants we derive an equivalent palette from their
// BrandConfig primary/accent colors, with contrast-safe text choices so a
// poorly-contrasting brand color never makes text unreadable. When no brand
// colors are supplied (Dandy / legacy callers) the palette is byte-identical
// to the original constants — Dandy output never changes.
type RGB = [number, number, number];

const _hexToRgb = (hex: string): RGB => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
};
const _relLum = ([r, g, b]: RGB): number => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const _contrast = (a: RGB, c: RGB): number => {
  const l1 = _relLum(a), l2 = _relLum(c);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const _darken = ([r, g, b]: RGB, f: number): RGB => [Math.round(r * f), Math.round(g * f), Math.round(b * f)];
const _lighten = ([r, g, b]: RGB, f: number): RGB => [Math.round(r + (255 - r) * f), Math.round(g + (255 - g) * f), Math.round(b + (255 - b) * f)];

export interface BrandPalette {
  primary: RGB;          // dark brand band fill (was darkGreen)
  primaryMid: RGB;       // lighter panel fill (was midGreen)
  primaryDeep: RGB;      // deepest vignette band (was [0,48,38])
  primaryAlt: RGB;       // header fallback bg (was [20,50,40])
  accent: RGB;           // bright accent fill (was lime)
  accentBorder: RGB;     // accent-ish card border (was [180,200,60])
  primaryOnLight: RGB;   // primary used as TEXT on light bg (was darkGreen text)
  accentOnDark: RGB;     // accent used as TEXT on the primary band (was lime text)
  onPrimaryMuted: RGB;   // light muted tint on primary band (was [180,210,195])
  onPrimaryMuted2: RGB;  // lighter muted tint on primary band (was [200,215,210])
  checkColor: RGB;       // checkmark stroke on light bg (was [0,80,60])
}

export const DANDY_PALETTE: BrandPalette = {
  primary: darkGreen,
  primaryMid: midGreen,
  primaryDeep: [0, 48, 38],
  primaryAlt: [20, 50, 40],
  accent: lime,
  accentBorder: [180, 200, 60],
  primaryOnLight: darkGreen,
  accentOnDark: lime,
  onPrimaryMuted: [180, 210, 195],
  onPrimaryMuted2: [200, 215, 210],
  checkColor: [0, 80, 60],
};

export function resolvePalette(b?: BrandContext): BrandPalette {
  const primaryHex = (b?.primaryColor ?? "").trim();
  const accentHex = (b?.accentColor ?? "").trim();
  // No brand colors → exact Dandy palette (byte-identical legacy output).
  if (!primaryHex && !accentHex) return DANDY_PALETTE;

  const primary = primaryHex ? _hexToRgb(primaryHex) : darkGreen;
  const accent = accentHex ? _hexToRgb(accentHex) : lime;

  // primary used as TEXT on a light (offWhite/white) surface — darken until it
  // reads, so a light brand primary doesn't make stat values unreadable.
  let primaryOnLight = primary;
  let guard = 0;
  while (_contrast(primaryOnLight, white) < 4.5 && guard++ < 16) primaryOnLight = _darken(primaryOnLight, 0.85);

  // accent used as TEXT/marks on the primary band — keep if it reads, else
  // lighten; if still poor, fall back to white.
  let accentOnDark = accent;
  guard = 0;
  while (_contrast(accentOnDark, primary) < 3 && guard++ < 16) accentOnDark = _lighten(accentOnDark, 0.18);
  if (_contrast(accentOnDark, primary) < 3) accentOnDark = white;

  // Light muted tints rendered ON the primary band (subtitles, separators).
  let onPrimaryMuted = _lighten(primary, 0.72);
  if (_contrast(onPrimaryMuted, primary) < 2.2) onPrimaryMuted = white;
  let onPrimaryMuted2 = _lighten(primary, 0.8);
  if (_contrast(onPrimaryMuted2, primary) < 2.2) onPrimaryMuted2 = white;

  return {
    primary,
    primaryMid: _lighten(primary, 0.12),
    primaryDeep: _darken(primary, 0.85),
    primaryAlt: _lighten(primary, 0.1),
    accent,
    accentBorder: accent,
    primaryOnLight,
    accentOnDark,
    onPrimaryMuted,
    onPrimaryMuted2,
    checkColor: primaryOnLight,
  };
}

// ── Contrast diagnostics ───────────────────────────────────────────────
// Reports whether the chosen primary/accent would be auto-adjusted by
// resolvePalette so the UI can warn a rep BEFORE they generate. The thresholds
// and adjustment loop here mirror resolvePalette() exactly — keep them in lock-
// step so the hint always matches the PDF output.
export interface PaletteContrastReport {
  /** Chosen primary is too light to read as text on a light surface and will be auto-darkened. */
  primaryDarkened: boolean;
  /** Chosen accent has low contrast on the dark primary band and will be auto-lightened. */
  accentLightened: boolean;
  /** Chosen accent contrast is so poor it falls back to white text/marks on the band. */
  accentFallbackWhite: boolean;
}

export function analyzePaletteContrast(b?: BrandContext): PaletteContrastReport {
  const primaryHex = (b?.primaryColor ?? "").trim();
  const accentHex = (b?.accentColor ?? "").trim();
  const primary = primaryHex ? _hexToRgb(primaryHex) : darkGreen;
  const accent = accentHex ? _hexToRgb(accentHex) : lime;

  // primary used as TEXT on a light surface — darkened while it fails 4.5:1.
  const primaryDarkened = _contrast(primary, white) < 4.5;

  // accent used as TEXT/marks on the primary band — lightened while it fails
  // 3:1; if still failing after the bounded loop, falls back to white.
  const accentLightened = _contrast(accent, primary) < 3;
  let accentOnDark = accent;
  let guard = 0;
  while (_contrast(accentOnDark, primary) < 3 && guard++ < 16) accentOnDark = _lighten(accentOnDark, 0.18);
  const accentFallbackWhite = _contrast(accentOnDark, primary) < 3;

  return { primaryDarkened, accentLightened, accentFallbackWhite };
}

function drawBrandLogo(doc: jsPDF, x: number, y: number, logoPng: string | null, w = 80, h = 28, wordmark = "dandy") {
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", x, y, w, h); return; } catch { }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...white);
  doc.text(wordmark, x, y + h * 0.8);
}

// Back-compat alias — older callers may still reference drawDandyLogo.
const drawDandyLogo = drawBrandLogo;

/**
 * Replace all Dandy-specific tokens in a string with the resolved brand
 * values. A no-op when the brand is Dandy (productName === "Dandy") so
 * Dandy tenants get the original copy untouched.
 *
 * Order matters: longer/more-specific phrases first so we don't half-replace.
 */
export function scrubBrand(text: string, b?: BrandContext): string {
  const r = resolveBrand(b);
  if (r.productName === "Dandy") return text;
  const safeFooter = r.footerUrl || "";
  return text
    .replace(/Dandy Practice Agreement/gi, r.agreementName)
    .replace(/Dandy Dental Lab/gi, r.labName)
    .replace(/Dandy Vision Scanner and Cart/gi, "our Vision Scanner and Cart")
    .replace(/Dandy Vision Scanner/gi, "our Vision Scanner")
    .replace(/Dandy Insights/gi, `${r.productName} Insights`)
    .replace(/Dandy Portal/gi, `${r.productName} Portal`)
    .replace(/Dandy diagnostic scans/gi, `${r.productName} diagnostic scans`)
    .replace(/Dandy users/gi, `${r.productName} users`)
    .replace(/Dandy doctors/gi, `${r.productName} doctors`)
    .replace(/Dandy experience/gi, `${r.productName} experience`)
    .replace(/Dandy's/g, `${r.productName}'s`)
    .replace(/\bDandy\b/g, r.productName)
    .replace(/\bDSO\b/g, r.industryLabel)
    .replace(/\bDSOs\b/g, `${r.industryLabel}s`)
    .replace(/digital dental lab/gi, "digital lab")
    .replace(/dental lab/gi, "lab")
    .replace(/www\.meetdandy\.com\/dso/gi, safeFooter)
    .replace(/meetdandy\.com\/practice-agreement/gi, r.agreementUrl.replace(/^https?:\/\//, ""))
    .replace(/meetdandy\.com/gi, safeFooter || "");
}

/** Recursively scrub all string values in any nested object/array via scrubBrand. */
export function scrubBrandDeep<T>(value: T, b?: BrandContext): T {
  const r = resolveBrand(b);
  if (r.productName === "Dandy") return value;
  if (typeof value === "string") return scrubBrand(value, b) as unknown as T;
  if (Array.isArray(value)) return value.map(v => scrubBrandDeep(v, b)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubBrandDeep(v, b);
    }
    return out as unknown as T;
  }
  return value;
}

// ── Shared types ───────────────────────────────────────────────────────
export type Audience = "executive" | "clinical" | "practice-manager";

export interface TeamContact {
  name: string;
  title: string;
  contactInfo: string;
}

export interface AudienceContent {
  subtitle: string;
  introText?: string;
  features: { icon: string; title: string; description: string }[];
  checklist?: string[];
}

// ── Agreement Summary one-pager ────────────────────────────────────────
export interface AgreementSection {
  label: string;
  body: string;
}

export interface AgreementContact {
  /** Optional label shown before the contact (e.g. "Sales", "Support"). */
  label?: string;
  phone?: string;
  email?: string;
}

export interface AgreementSummaryContent {
  headline: string;
  subheadline: string;
  sections: AgreementSection[];
  footer: string;
  /**
   * Optional contact rows rendered inside the footer band (phone / email).
   * Empty / undefined means the footer renders only the legal text.
   */
  footerContacts?: AgreementContact[];
  /**
   * Optional font-size overrides (in pt). Each falls back to the historical
   * default when omitted, so existing saved layouts keep rendering identically.
   */
  headlineFontSize?: number;       // default 46
  subheadlineFontSize?: number;    // default 13
  sectionLabelFontSize?: number;   // default 15
  sectionBodyFontSize?: number;    // default 9.5 (auto-shrinks to 8.5 on overflow)
  footerFontSize?: number;         // default 11
  /**
   * Optional layout overrides (in pt). All fall back to historical defaults
   * when omitted so previously-saved layouts render identically.
   *
   * X/Y offsets shift the headline / subheadline relative to their default
   * anchor (left margin / standard Y) — positive moves right / down.
   */
  headerHeight?: number;           // default 290
  footerHeight?: number;           // default 56 (a soft minimum — band still grows for contacts)
  headlineOffsetX?: number;        // default 0
  headlineOffsetY?: number;        // default 0
  subheadlineOffsetX?: number;     // default 0
  subheadlineOffsetY?: number;     // default 0
  /**
   * Vertical nudge (in pt) for the section block. The rows are laid out at
   * their natural height and centered between the header and footer band;
   * this offset shifts that centered block up (negative) or down (positive).
   * Neutral default 0 → block stays centered (clamped to a sane range).
   */
  sectionsOffsetY?: number;        // default 0
  /**
   * Maximum width of the headline/subheadline as a percent of the page
   * width (clamped 30–90). Lowering this forces the text to wrap sooner so
   * it doesn't overlap the scanner image on the right. Default: 58.
   */
  headlineMaxWidthPct?: number;
  /**
   * Width (in pt) of the Dandy wordmark in the top-left of the header.
   * Height auto-derives from the original 78×28 aspect ratio so the logo
   * is never distorted. Clamped 30–200. Default: 78.
   */
  logoWidth?: number;
  /** Show the thin horizontal divider beneath each section row. Default: true. */
  showSectionDividers?: boolean;
  /**
   * Optional clickable link inside the footer text. When both fields are set
   * AND `footerLinkText` is found inside `footer`, that substring is
   * rendered underlined and made clickable. If the link text wraps across
   * lines, only the portion on each line that matches is linked.
   *
   * Contact phones / emails are auto-linked (tel: / mailto:) regardless of
   * these fields.
   */
  footerLinkText?: string;
  footerLinkUrl?: string;
  /**
   * Optional header (scanner) image shown bleeding off the top-right of the
   * header band. This is an LP Studio editor convenience field: the LP Studio
   * wrapper loads it and passes the result as `opts.scannerPng`. The shared
   * generator below reads the image ONLY from `opts.scannerPng` and ignores
   * this field. A `data:` URL (editor upload) or any resolvable URL. When
   * unset, the wrapper falls back to the brand-config product screenshot
   * (which carries the Dandy default for Dandy tenants).
   */
  headerImage?: string | null;
}

export const defaultAgreementSummaryContent: AgreementSummaryContent = {
  headline: "Summary of Dandy Agreement",
  subheadline: "With Dandy, you get a simple, month-to-month contract with no surprise fees.",
  sections: [
    { label: "Equipment", body: "Our software, hardware, and support are all included when you partner with us, subject to terms and conditions. You are just responsible for sending lab work, and please take care of our scanner." },
    { label: "Minimum", body: "$2,000 per month in lab work. Month-to-month, no long-term commitment. Cancel anytime." },
    { label: "Activation Fee", body: "$499 activation fee covers set-up and shipping costs for the scanner, laptop, and the cart." },
    { label: "No Exit Fee", body: "If you don't want to work with us, we'll send a box for you to return our equipment. If you don't return it within 30 days, we'll invoice for the equipment." },
    { label: "Billing", body: "We invoice on the first of the month and bill on the eighth. We prefer bank transfers — no fee. (2.4% fee for credit cards. If you have late lab payments over $20,000, we'll pause your orders.)" },
    { label: "Training", body: "Our CE-accredited training is required for all Dandy users. Unlimited training is included for the whole practice." },
    { label: "Warranty", body: "Lifetime warranty on all products." },
    { label: "Exclusivity", body: "For scans you take with our scanner, please use our lab. That's all we ask!" },
  ],
  footer: "For the full terms and agreement, please see the Dandy Practice Agreement.",
  footerContacts: [],
  headlineFontSize: 46,
  subheadlineFontSize: 13,
  sectionLabelFontSize: 15,
  sectionBodyFontSize: 9.5,
  footerFontSize: 11,
  headerHeight: 290,
  footerHeight: 56,
  headlineOffsetX: 0,
  headlineOffsetY: 0,
  subheadlineOffsetX: 0,
  subheadlineOffsetY: 0,
  sectionsOffsetY: 0,
  headlineMaxWidthPct: 58,
  logoWidth: 78,
  showSectionDividers: true,
  footerLinkText: "Dandy Practice Agreement",
  footerLinkUrl: "https://meetdandy.com/practice-agreement",
};

export const generateAgreementSummaryOnePager = async (
  rawContent: AgreementSummaryContent,
  opts?: { logoPng?: string | null; scannerPng?: string | null; brand?: BrandContext },
): Promise<jsPDF> => {
  const b = resolveBrand(opts?.brand);
  const pal = resolvePalette(opts?.brand);
  // Scrub any Dandy-specific strings out of the content (headline,
  // subheadline, section bodies, footer text, footerLinkText/Url) so a
  // non-Dandy tenant gets fully neutralized PDF text.
  const content = scrubBrandDeep(rawContent, opts?.brand);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  registerBrandFonts(doc, opts?.brand);
  const w = doc.internal.pageSize.getWidth();   // 612pt
  const h = doc.internal.pageSize.getHeight();  // 792pt
  const margin = 48;
  const logoPng = opts?.logoPng ?? null;
  const scannerPng = opts?.scannerPng ?? null;

  const hasBagoss = ensureBagoss(doc);
  const headingFont = hasBagoss ? "Bagoss" : "helvetica";
  const headingStyle = hasBagoss ? "normal" : "bold";
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Defensive: never let an empty / over-long sections array destabilize the
  // single-page row layout. The Agreement Summary template ships with 8 rows
  // and the editor exposes those 8 directly, but guard against bad data.
  const sections = (Array.isArray(content.sections) ? content.sections : []).slice(0, 8);
  if (sections.length === 0) {
    sections.push({ label: " ", body: " " });
  }

  // ── Header band ──────────────────────────────────────────────────────
  // Match the v6 PDF: tall dark-green header (~36% of page), big serif
  // headline on the left, scanner image bleeding off the top-right.
  // Height is user-tunable; clamped to keep the page useable.
  const headerH = clamp(content.headerHeight ?? 290, 140, 480);
  doc.setFillColor(...pal.primary);
  doc.rect(0, 0, w, headerH, "F");

  // Soft radial-ish vignette from the right (the actual PDF has a halo
  // around the scanner). Build it with a few overlapping mid-green bands so
  // the seam between dark and mid green is gradual rather than a hard edge.
  doc.setFillColor(...pal.primaryMid);
  doc.rect(w * 0.62, 0, w * 0.38, headerH, "F");
  // Slightly darker overlay on the very right edge for depth
  doc.setFillColor(...pal.primaryDeep);
  doc.rect(w * 0.86, 0, w * 0.14, headerH, "F");

  // Scanner image top-right (transparent PNG bleeds to the right edge).
  if (scannerPng) {
    try {
      const imgW = 320;
      const imgH = 180;
      // Bleed slightly off the top and right edges for a polished look.
      doc.addImage(scannerPng, "PNG", w - imgW + 30, 14, imgW, imgH, undefined, "FAST");
    } catch { /* ignore — header still looks good without the image */ }
  }

  // Dandy wordmark top-left (use logoPng if provided, else fall back to
  // typed "dandy" in the heading font). Width is user-tunable; height
  // auto-derives from the original 78×28 aspect ratio so the logo never
  // gets stretched. The fallback "dandy" text scales proportionally too.
  const logoW = clamp(content.logoWidth ?? 78, 30, 200);
  const logoH = logoW * (28 / 78);
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, 38, logoW, logoH); }
    catch {
      doc.setFont(headingFont, headingStyle);
      doc.setFontSize(26 * (logoW / 78));
      doc.setTextColor(...white);
      doc.text(b.wordmark, margin, 38 + logoH * 0.78);
    }
  } else {
    doc.setFont(headingFont, headingStyle);
    doc.setFontSize(26 * (logoW / 78));
    doc.setTextColor(...white);
    doc.text(b.wordmark, margin, 38 + logoH * 0.78);
  }

  // Headline — large serif, wraps to multiple lines. Confine width to ~58%
  // of page so it doesn't run into the scanner image on the right.
  // Font sizes are user-tunable via the editor; clamp to a sane range so a
  // bad value can't blow out the page layout. X/Y offsets nudge the
  // anchor relative to its default position.
  const headlinePt = clamp(content.headlineFontSize ?? 46, 18, 72);
  const headlineOffsetX = clamp(content.headlineOffsetX ?? 0, -margin, 200);
  const headlineOffsetY = clamp(content.headlineOffsetY ?? 0, -100, 200);
  const headlineWidthPct = clamp(content.headlineMaxWidthPct ?? 58, 30, 90);
  const headlineMaxW = w * (headlineWidthPct / 100);
  doc.setFont(headingFont, headingStyle);
  doc.setFontSize(headlinePt);
  doc.setTextColor(...white);
  const headlineLines = doc.splitTextToSize(content.headline, headlineMaxW);
  const headlineLineH = headlinePt * 1.09;
  const headlineX = margin + headlineOffsetX;
  const headlineY = 130 + headlineOffsetY;
  doc.text(headlineLines, headlineX, headlineY);
  const headlineBottom = headlineY + (headlineLines.length - 1) * headlineLineH;

  // Subheadline — sans-serif, lighter, just below the headline.
  const subheadlinePt = clamp(content.subheadlineFontSize ?? 13, 8, 24);
  const subheadlineOffsetX = clamp(content.subheadlineOffsetX ?? 0, -margin, 200);
  const subheadlineOffsetY = clamp(content.subheadlineOffsetY ?? 0, -100, 200);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(subheadlinePt);
  doc.setTextColor(225, 232, 228);
  const subX = margin + subheadlineOffsetX;
  const subY = headlineBottom + 32 + subheadlineOffsetY;
  const subLines = doc.splitTextToSize(content.subheadline, headlineMaxW);
  doc.text(subLines, subX, subY, { lineHeightFactor: 1.35 });

  // ── Footer geometry (computed up-front) ─────────────────────────────
  // The footer band can grow when the user adds contacts and/or bumps the
  // footer text size, so we need to know its final height *before* laying
  // out the section rows — otherwise rows can paint underneath the footer.
  // The user-configurable footer height acts as a *minimum* — the band
  // still grows beyond it when contacts / a long footer text need more
  // space (so the rep can't accidentally clip their own contact rows).
  const baseFooterH = clamp(content.footerHeight ?? 56, 32, 200);
  const footerPt = clamp(content.footerFontSize ?? 11, 7, 18);
  const contacts = (content.footerContacts ?? []).filter(
    c => (c?.phone && c.phone.trim()) || (c?.email && c.email.trim()) || (c?.label && c.label.trim()),
  );
  const footerLineH = footerPt * 1.27;
  const contactPt = Math.max(7, footerPt - 1);
  const contactLineH = contactPt * 1.27;
  const footerTextW = w - margin * 2;
  // Pre-measure with the right font so splitTextToSize uses correct widths.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(footerPt);
  const footerLines = doc.splitTextToSize(content.footer || "", footerTextW);
  const footerTextH = footerLines.length * footerLineH;
  const contactsBlockH = contacts.length > 0 ? contactLineH + 4 : 0;
  // Cap the footer at ~18% of the page so rows always have breathing room
  // even if a user pastes a giant footer paragraph.
  const dynamicFooterH = Math.min(
    h * 0.18,
    Math.max(baseFooterH, footerTextH + contactsBlockH + 22),
  );

  // ── Section rows (single column) ────────────────────────────────────
  const rowsTop = headerH + 28;
  const rowsBottom = h - dynamicFooterH - 12;
  const rowsAvailableH = rowsBottom - rowsTop;
  const rowCount = sections.length;

  // Two-column layout inside each row: label LEFT (fixed width), body RIGHT.
  // Smaller label column + smaller body font so the longer descriptions
  // (Equipment, Billing) fit within their row without truncation.
  const labelColW = 110;
  const labelX = margin;
  const bodyX = margin + labelColW + 14;
  const bodyW = w - bodyX - margin;

  // User-tunable section font sizes (clamped to keep the row layout sane).
  const labelPt = clamp(content.sectionLabelFontSize ?? 15, 9, 22);
  const bodyPtPref = clamp(content.sectionBodyFontSize ?? 9.5, 7, 14);
  const labelLineHBase = labelPt * 1.13;
  const bodyLineHPref = bodyPtPref * 1.21;

  // Pre-measure each row's natural content height (max of the label block vs
  // the body block) at the user's preferred sizes. The whole group is then
  // centered between the header and footer at its natural height — rather than
  // stretching every row to fill all available space, which left uneven gaps
  // (especially once the final divider is dropped).
  const ROW_GAP = 16; // even vertical gap between rows at natural spacing
  const measured = sections.map((section) => {
    doc.setFont(headingFont, headingStyle);
    doc.setFontSize(labelPt);
    const labelLines = doc.splitTextToSize(section.label || "", labelColW);
    const labelBlockH = labelLines.length * labelLineHBase;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyPtPref);
    const bodyLines = doc.splitTextToSize(section.body || "", bodyW);
    const bodyBlockH = bodyLines.length * bodyLineHPref;
    return { labelLines, bodyLines, contentH: Math.max(labelBlockH, bodyBlockH) };
  });
  const naturalTotalH =
    measured.reduce((sum, m) => sum + m.contentH, 0) + ROW_GAP * Math.max(0, rowCount - 1);

  // When the natural layout fits, center the block and honor the vertical
  // offset. When it would overflow (very long bodies), fall back to the legacy
  // stretch-to-fill so rows never paint underneath the footer.
  const fits = naturalTotalH <= rowsAvailableH;
  const sectionsOffsetY = clamp(content.sectionsOffsetY ?? 0, -200, 200);
  const blockTop = fits
    ? rowsTop + (rowsAvailableH - naturalTotalH) / 2 + sectionsOffsetY
    : rowsTop;
  const stretchRowH = rowsAvailableH / rowCount;

  let cursorY = blockTop;
  measured.forEach((m, i) => {
    const section = sections[i];
    const rowH = fits ? m.contentH : stretchRowH;
    const ry = cursorY;
    const rowMidY = ry + rowH / 2;

    // Label (heading font, dark)
    doc.setFont(headingFont, headingStyle);
    doc.setFontSize(labelPt);
    doc.setTextColor(...textDark);
    const labelBlockH = m.labelLines.length * labelLineHBase;
    const labelStartY = rowMidY - labelBlockH / 2 + labelPt * 0.8;
    doc.text(m.labelLines, labelX, labelStartY);

    // Body (sans-serif, smaller, dark gray). In the natural path the row is
    // sized to the content; the auto-fit shrink only applies to the stretch
    // fallback, where a long body could overflow the fixed row height.
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 70, 65);
    const maxLines = fits
      ? m.bodyLines.length
      : Math.max(2, Math.floor((rowH - 12) / bodyLineHPref));
    let fontPt = bodyPtPref;
    let bodyLines = m.bodyLines;
    if (!fits && bodyLines.length > maxLines) {
      fontPt = Math.max(7, bodyPtPref - 1);
      doc.setFontSize(fontPt);
      bodyLines = doc.splitTextToSize(section.body || "", bodyW);
    } else {
      doc.setFontSize(fontPt);
    }
    const lineH = fontPt * 1.21;
    const bodyBlockH = bodyLines.length * lineH;
    const bodyStartY = rowMidY - bodyBlockH / 2 + (fontPt - 0.5);
    doc.text(bodyLines.slice(0, maxLines), bodyX, bodyStartY, { lineHeightFactor: 1.22 });

    // Thin horizontal separator BETWEEN rows — always dropped below the LAST
    // row so the section block ends cleanly above the footer.
    if (content.showSectionDividers !== false && i < rowCount - 1) {
      const sepY = fits ? ry + rowH + ROW_GAP / 2 : ry + rowH - 0.5;
      drawSep(doc, margin, sepY, w - margin * 2, [220, 224, 220]);
    }

    cursorY += rowH + (fits ? ROW_GAP : 0);
  });

  // ── Footer band ──────────────────────────────────────────────────────
  // Geometry was computed up-front so the section row layout reserved
  // exactly this much space — here we just paint the band and text.
  doc.setFillColor(...pal.primary);
  doc.rect(0, h - dynamicFooterH, w, dynamicFooterH, "F");

  // Legal text — centred near the top of the band.
  // If footerLinkText is set and present in a wrapped line, render that
  // line in three pieces (pre / link / post) so the link span can be
  // underlined and made clickable. Other lines render plain.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(footerPt);
  doc.setTextColor(...white);
  const footerStartY = h - dynamicFooterH + 14 + footerPt;
  const linkText = (content.footerLinkText ?? "").trim();
  const linkUrl = (content.footerLinkUrl ?? "").trim();
  const hasLink = linkText.length > 0 && linkUrl.length > 0;

  footerLines.forEach((line: string, i: number) => {
    const lineY = footerStartY + i * (footerPt * 1.3);
    const idx = hasLink ? line.indexOf(linkText) : -1;
    if (idx === -1) {
      // Plain centred line.
      doc.text(line, w / 2, lineY, { align: "center" });
      return;
    }
    // Pre / link / post pieces, centred as a unit.
    const pre = line.slice(0, idx);
    const linkPart = line.slice(idx, idx + linkText.length);
    const post = line.slice(idx + linkText.length);
    const preW = pre ? doc.getTextWidth(pre) : 0;
    const linkW = doc.getTextWidth(linkPart);
    const postW = post ? doc.getTextWidth(post) : 0;
    const totalW = preW + linkW + postW;
    const startX = (w - totalW) / 2;
    if (pre) doc.text(pre, startX, lineY);
    const linkX = startX + preW;
    // jsPDF's textWithLink draws text and adds a clickable link region.
    doc.textWithLink(linkPart, linkX, lineY, { url: linkUrl });
    // Underline the link span (1pt below baseline).
    doc.setDrawColor(...white);
    doc.setLineWidth(0.5);
    doc.line(linkX, lineY + 1.5, linkX + linkW, lineY + 1.5);
    if (post) doc.text(post, linkX + linkW, lineY);
  });

  // Contacts row — centred below the legal text. Each entry renders as
  // "Label · phone · email" with phone/email auto-linked (tel: / mailto:).
  if (contacts.length > 0) {
    doc.setFontSize(contactPt);
    doc.setTextColor(225, 232, 228);
    const contactsY = footerStartY + footerTextH + 2;
    const sepEntry = "     |     ";
    const sepField = "  ·  ";

    // Build a flat token list across all contacts so we can centre the
    // whole row, then walk it again to actually paint each piece (with
    // tel:/mailto: links on phones / emails).
    type Token = { text: string; url?: string };
    const tokens: Token[] = [];
    contacts.forEach((c, ci) => {
      if (ci > 0) tokens.push({ text: sepEntry });
      const fields: Token[] = [];
      if (c.label && c.label.trim()) fields.push({ text: c.label.trim() });
      if (c.phone && c.phone.trim()) {
        const p = c.phone.trim();
        // tel: URLs strip spaces and most punctuation per RFC 3966.
        const telHref = `tel:${p.replace(/[^\d+]/g, "")}`;
        fields.push({ text: p, url: telHref });
      }
      if (c.email && c.email.trim()) {
        const e = c.email.trim();
        fields.push({ text: e, url: `mailto:${e}` });
      }
      fields.forEach((f, fi) => {
        if (fi > 0) tokens.push({ text: sepField });
        tokens.push(f);
      });
    });

    const totalW = tokens.reduce((sum, t) => sum + doc.getTextWidth(t.text), 0);
    let cx = (w - totalW) / 2;
    tokens.forEach(t => {
      const tw = doc.getTextWidth(t.text);
      if (t.url) {
        doc.textWithLink(t.text, cx, contactsY, { url: t.url });
        // Underline the linked text.
        doc.setDrawColor(225, 232, 228);
        doc.setLineWidth(0.4);
        doc.line(cx, contactsY + 1.2, cx + tw, contactsY + 1.2);
      } else {
        doc.text(t.text, cx, contactsY);
      }
      cx += tw;
    });
  }

  return doc;
};

export const defaultAudienceContent: Record<Audience, AudienceContent> = {
  executive: {
    subtitle: "Achieve quality, consistency, and control at scale.",
    introText: "What to expect during this pilot: Over the next 90 days, we'll partner with your organization to onboard clinicians efficiently, support adoption of digital workflows, and ensure cases run smoothly in practice.",
    features: [
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your practices up to speed fast with free onboarding." },
      { icon: "💬", title: "Clinical collaboration", description: "Live Chat and Live Scan Review connect clinicians directly with our team of lab technicians in real time." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "📊", title: "Dandy Insights", description: "Dandy surfaces aggregate, pilot-level insights including scanner utilization, workflow adoption, and quality signals." },
      { icon: "📋", title: "Case management simplified", description: "Access the Dandy Portal to track, manage, and review active orders and our dashboard to streamline invoicing." },
      { icon: "💰", title: "Exclusive pricing for your organization", description: "Contact the team below to access a product guide with approved pricing." },
    ],
  },
  clinical: {
    subtitle: "Fully embrace digital dentistry with smarter technology and seamless workflows.",
    features: [
      { icon: "💬", title: "Clinical collaboration", description: "Clinicians and staff can speak with our team of clinical experts in just 60 seconds or collaborate on complex cases virtually." },
      { icon: "🤖", title: "AI-powered quality checks", description: "AI Scan Review automatically reviews every scan while the patient is still in the chair, reducing remakes and adjustments." },
      { icon: "🦷", title: "2-Appointment Dentures", description: "Utilize seamless digital workflows like 2-Appointment Dentures to save chair time and create a better patient experience." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. Get up to speed fast with free onboarding and unlimited access to ongoing digital CPD credit education." },
    ],
  },
  "practice-manager": {
    subtitle: "Reduce operational friction and administrative burden with Dandy.",
    checklist: [
      "Attend an in-person or virtual onboarding session",
      "Use the Dandy Portal to track, manage, and review orders",
      "Access Dandy Insights to get an overview of pilot performance",
      "Check in with clinicians to gather high-level feedback",
    ],
    features: [
      { icon: "💰", title: "Invoicing made easy", description: "Our dashboard makes invoicing a simple and efficient process." },
      { icon: "📊", title: "Get insights in Practice Portal", description: "Gain visibility into order delivery dates, seamless communicate with the lab, scanner, manage payment, and more." },
      { icon: "💬", title: "Real-time lab communication", description: "Our team of clinical experts handle lab communication including live collaboration, fielding questions, and issue resolution." },
      { icon: "👥", title: "Onsite and virtual training", description: "No downtime needed. We handle hardware delivery and set up, then get your teams up to speed fast with free onboarding and CPD training." },
    ],
  },
};

// ── Pilot One-Pager ────────────────────────────────────────────────────
export interface PilotOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  checkboxImgData?: string | null;
  brand?: BrandContext;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    bodyCfg?: Record<string, unknown>;
    teamCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generatePilotOnePager = async (
  dsoName: string,
  audience: Audience,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  editedContent: AudienceContent,
  customLinkText?: string,
  customLinkUrl?: string,
  opts?: PilotOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  registerBrandFonts(doc, opts?.brand);
  // Brand heading font: registerBrandFonts only registers the "Bagoss" face
  // when the brand supplies a resolvable heading font, so its presence in the
  // font list signals a usable brand heading. Match the Agreement Summary:
  // render true headings in that face, falling back to the built-in helvetica
  // (preserving the original weight) for brands with no heading font (e.g. Dandy).
  const hasBrandHeading = !!(doc.getFontList?.() ?? {})["Bagoss"];
  const headingFont = hasBrandHeading ? "Bagoss" : "helvetica";
  const headingStyle = (builtin: "normal" | "bold"): string =>
    hasBrandHeading ? "normal" : builtin;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const bCfg = opts?.layoutOverrides?.bodyCfg ?? {};
  const tCfg = opts?.layoutOverrides?.teamCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;
  const checkboxImgData = opts?.checkboxImgData ?? null;
  const b = resolveBrand(opts?.brand);
  const pal = resolvePalette(opts?.brand);
  // Scrub all Dandy-specific copy out of the user-supplied audience content
  // (subtitle, introText, checklist[], features[].title/description) so a
  // non-Dandy tenant sees fully neutralized PDF text.
  const content = scrubBrandDeep(editedContent, opts?.brand);

  const headerH = (hCfg.height as number | undefined) ?? 280;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 48) / 100);

  doc.setFillColor(...pal.primary);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(...pal.primaryAlt);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawBrandLogo(doc, margin, 50, logoPng, 80, 28, b.wordmark);

  const logoEndX = margin + 90;
  doc.setDrawColor(...pal.onPrimaryMuted);
  doc.setLineWidth(0.75);
  doc.line(logoEndX, 50, logoEndX, 78);

  if (prospectLogoData) {
    try {
      const pScale = Math.max(0.3, Math.min(3, (hCfg.prospectLogoScale as number | undefined) ?? 1));
      const maxW = 135 * pScale, maxH = 36 * pScale;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      doc.addImage(prospectLogoData, "PNG", logoEndX + 12, 64 - lh / 2, lw, lh);
    } catch { }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(dsoName.length > 15 ? 12 : 16);
    doc.setTextColor(...white);
    doc.text(dsoName, logoEndX + 12, 70);
  }

  doc.setFont(headingFont, headingStyle("normal"));
  doc.setFontSize(dsoName.length > 15 ? 22 : ((hCfg.titleFontSize as number | undefined) ?? 28));
  doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize(`${b.productName} x ${dsoName}\n90-Day Pilot`, splitX - margin - 20);
  doc.text(titleLines, margin, 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize((hCfg.subtitleFontSize as number | undefined) ?? 11);
  doc.setTextColor(...pal.onPrimaryMuted2);
  const subLines = doc.splitTextToSize(content.subtitle, splitX - margin - 20);
  doc.text(subLines, margin, 220 + ((hCfg.subtitleOffsetY as number | undefined) ?? 0));

  let y = headerH + 35;
  const offsetX = (bCfg.contentOffsetX as number | undefined) ?? 0;
  const sectionGap = (bCfg.sectionSpacing as number | undefined) ?? 16;

  doc.setFont(headingFont, headingStyle("bold"));
  doc.setFontSize((bCfg.headlineFontSize as number | undefined) ?? 16);
  doc.setTextColor(...textDark);
  const headlineText = ((bCfg.headlineText as string | undefined) ?? "").trim()
    || "Experience the world's most advanced dental lab for 90 days. No long-term commitment needed.";
  const headlineLines = doc.splitTextToSize(
    scrubBrand(headlineText, opts?.brand),
    contentW
  );
  doc.text(headlineLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW });
  y += headlineLines.length * 20 + sectionGap;

  if (content.introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize((bCfg.introFontSize as number | undefined) ?? 9.5);
    doc.setTextColor(...textMuted);
    const introLines = doc.splitTextToSize(content.introText, contentW - 40);
    doc.text(introLines, w / 2 + offsetX, y, { align: "center", maxWidth: contentW - 40 });
    y += introLines.length * 13 + sectionGap;
  }

  const titleDescGap = (bCfg.featureTitleDescSpacing as number | undefined) ?? 14;

  if (audience === "practice-manager" && content.checklist) {
    y += 4;
    const leftColW = contentW * 0.42;
    const rightColX = margin + contentW * 0.48;
    const rightColW = contentW * 0.52;
    const checkGreen: [number, number, number] = pal.checkColor;
    const checkFontSize = (bCfg.checklistFontSize as number | undefined) ?? 9;
    const checkSpacing = (bCfg.checklistSpacing as number | undefined) ?? 10;
    const showDividers = (bCfg.checklistShowDividers as boolean | undefined) ?? false;
    const divLen = (bCfg.dividerLength as number | undefined) ?? 0;
    const divOffX = (bCfg.dividerOffsetX as number | undefined) ?? 0;
    const divOffY = (bCfg.dividerOffsetY as number | undefined) ?? 0;

    const checkHeadingFontSize = (bCfg.checklistHeadingFontSize as number | undefined) ?? 10;
    doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(checkHeadingFontSize); doc.setTextColor(...textDark);
    doc.text(
      ((bCfg.checklistHeadingText as string | undefined) ?? "").trim() || "How to get the most out of this pilot:",
      margin, y,
    );
    let checkY = y + 20;
    content.checklist.forEach((item, idx) => {
      if (checkboxImgData) {
        try { doc.addImage(checkboxImgData, "PNG", margin + 4, checkY - 9, 11, 11); }
        catch {
          doc.setDrawColor(...checkGreen); doc.setLineWidth(1.2);
          doc.line(margin + 6, checkY - 2, margin + 8, checkY); doc.line(margin + 8, checkY, margin + 12, checkY - 6);
        }
      } else {
        doc.setDrawColor(...checkGreen); doc.setLineWidth(1.2);
        doc.line(margin + 6, checkY - 2, margin + 8, checkY); doc.line(margin + 8, checkY, margin + 12, checkY - 6);
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(checkFontSize); doc.setTextColor(...textDark);
      const lineH = checkFontSize * 1.35;
      const lines = doc.splitTextToSize(item, leftColW - 40);
      doc.text(lines, margin + 22, checkY);
      checkY += lines.length * lineH + checkSpacing;
      if (showDividers && idx < content.checklist!.length - 1) {
        const dLen = divLen > 0 ? divLen : leftColW - 20;
        drawSep(doc, margin + divOffX, checkY - checkSpacing / 2 + divOffY, dLen, lineColor);
      }
    });
    let featY = y;
    content.features.forEach((feat, idx) => {
      doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize((bCfg.featureTitleFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
      doc.text(feat.title, rightColX + 28, featY);
      doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.featureDescFontSize as number | undefined) ?? 8.5); doc.setTextColor(...textMuted);
      const descLines = doc.splitTextToSize(feat.description, rightColW - 40);
      doc.text(descLines, rightColX + 28, featY + titleDescGap);
      featY += titleDescGap + descLines.length * 11 + 18;
    });
    y = Math.max(checkY, featY) + 4;
  } else {
    const bx = (bCfg.bulletOffsetX as number | undefined) ?? 0;
    const by = (bCfg.bulletOffsetY as number | undefined) ?? 0;
    y += 4 + by;
    const colW = contentW / 2;
    const features = content.features;
    const rows = Math.ceil(features.length / 2);
    const rowH = (features.length > 4 ? 64 : 80) + ((bCfg.sectionSpacing as number | undefined) ?? 0);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        const idx = row * 2 + col;
        if (idx >= features.length) continue;
        const feat = features[idx];
        const fx = margin + col * colW + offsetX + bx;
        const fy = y + row * rowH;
        doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize((bCfg.featureTitleFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
        doc.text(feat.title, fx, fy);
        doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.featureDescFontSize as number | undefined) ?? 8.5); doc.setTextColor(...textMuted);
        const descLines = doc.splitTextToSize(feat.description, colW - 32);
        doc.text(descLines, fx, fy + titleDescGap);
      }
    }
    y += rows * rowH + 4;
    if (audience === "clinical") {
      const quoteShow = (bCfg.quoteShow as boolean | undefined) !== false;
      if (quoteShow) {
        y -= 20;
        drawSep(doc, margin, y, contentW, lineColor);
        y += 30;
        doc.setFont("helvetica", "bold"); doc.setFontSize(36); doc.setTextColor(...pal.accentOnDark);
        doc.text("\u201C", margin, y + 7);
        const quoteText = (bCfg.quoteText as string | undefined) ?? `I've used ${b.labName} for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.`;
        const quoteFontSize = (bCfg.quoteFontSize as number | undefined) ?? 9.5;
        doc.setFont("helvetica", "italic"); doc.setFontSize(quoteFontSize); doc.setTextColor(...textDark);
        const quoteLines = doc.splitTextToSize(quoteText, contentW - 30);
        doc.text(quoteLines, margin + 18, y);
        y += quoteLines.length * 13 + 8;
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...textDark);
        doc.text("Dr. Tania Arthur", margin + 18, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...textMuted);
        doc.text("Dentist, Oasis Modern Dentistry, TX US", margin + 18, y + 12);
        y += 30;
      }
    }
  }

  const showTeam = (tCfg.show as boolean | undefined) !== false;
  const filteredContacts = teamContacts.filter(c => c.name.trim());
  if (showTeam && filteredContacts.length > 0) {
    drawSep(doc, margin, y, contentW, lineColor);
    y += 29;
    doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize((tCfg.headingFontSize as number | undefined) ?? 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and pilot check-ins.", w / 2, y + 15, { align: "center" });
    y += 44;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.nameFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
      doc.text(contact.name, cx, y, { align: "center" });
      let contactY = y + 14;
      if (contact.title) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
        doc.text(contact.title, cx, contactY, { align: "center" });
        contactY += 14;
      }
      if (contact.contactInfo) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
        doc.text(contact.contactInfo, cx, contactY, { align: "center" });
        contactY += 12;
      }
      maxContactBottom = Math.max(maxContactBottom, contactY);
    });
    y = maxContactBottom + 10;
  }

  const showFooter = (fCfg.show as boolean | undefined) !== false;
  const footerH = showFooter ? (customLinkText?.trim() && customLinkUrl?.trim() ? 56 : 44) : 0;
  const footerY = h - footerH;
  if (y < footerY) { doc.setFillColor(255, 255, 255); doc.rect(0, y, w, footerY - y, "F"); }
  if (showFooter) {
    doc.setFillColor(...pal.primary);
    doc.rect(0, footerY, w, footerH, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 10); doc.setTextColor(...white);
    const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : b.footerUrl;
    if (footerText) doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 20 : 28), { align: "center" });
    if (customLinkText?.trim() && customLinkUrl?.trim()) {
      doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 10); doc.setTextColor(...pal.onPrimaryMuted);
      doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 38, { url: customLinkUrl });
    }
  }

  return doc;
};

// ── Comparison One-Pager ───────────────────────────────────────────────
export const defaultComparisonRows = [
  { capability: "Quality & Remakes", then: "Greater variability across cases", now: "Standardized quality control systems + 96% remake rate reduction with AI scan review" },
  { capability: "Case Acceptance & Diagnostics", then: "Limited diagnostic scan support", now: "Free Dandy diagnostic scans driving ~30% average lift in case acceptance" },
  { capability: "Workflow & Case Management", then: "More manual coordination and back-and-forth", now: "Real-time lab support — 88% say it makes case management easier" },
  { capability: "Turnaround & Predictability", then: "Less predictable production timelines", now: "National manufacturing scale with more consistent turnaround windows" },
  { capability: "Digital Integration", then: "Early-stage digital workflow", now: "Fully integrated digital lab system with streamlined file submission" },
  { capability: "Product Offering", then: "More limited restorative options", now: "Expanded product portfolio across key restorative categories" },
  { capability: "Support Structure", then: "General support model", now: "Dedicated account support with more proactive case visibility" },
] as const;

export const defaultComparisonStats = [
  { value: "88%", label: "say real-time lab support makes case management easier" },
  { value: "~30%", label: "average increase in case acceptance with free Dandy diagnostic scans" },
  { value: "96%", label: "remake rate reduction with AI scan review" },
];

export interface ComparisonOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  brand?: BrandContext;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    bodyCfg?: Record<string, unknown>;
    teamCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
    comparisonRows?: Array<{ capability: string; then: string; now: string }>;
    stats?: Array<{ value: string; label: string }>;
  };
}

export const generateComparisonOnePager = async (
  dsoName: string,
  teamContacts: TeamContact[],
  phoneNumber: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  customLinkText?: string,
  customLinkUrl?: string,
  opts?: ComparisonOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  registerBrandFonts(doc, opts?.brand);
  // Brand heading font: registerBrandFonts only registers the "Bagoss" face
  // when the brand supplies a resolvable heading font, so its presence in the
  // font list signals a usable brand heading. Match the Agreement Summary:
  // render true headings in that face, falling back to the built-in helvetica
  // (preserving the original weight) for brands with no heading font (e.g. Dandy).
  const hasBrandHeading = !!(doc.getFontList?.() ?? {})["Bagoss"];
  const headingFont = hasBrandHeading ? "Bagoss" : "helvetica";
  const headingStyle = (builtin: "normal" | "bold"): string =>
    hasBrandHeading ? "normal" : builtin;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const bCfg = opts?.layoutOverrides?.bodyCfg ?? {};
  const tCfg = opts?.layoutOverrides?.teamCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};
  const rawRows = (opts?.layoutOverrides?.comparisonRows?.length
    ? opts.layoutOverrides.comparisonRows
    : defaultComparisonRows) as Array<{ capability: string; then: string; now: string }>;
  const activeRows = scrubBrandDeep(rawRows, opts?.brand);
  const b = resolveBrand(opts?.brand);
  const pal = resolvePalette(opts?.brand);
  const rawStats = (opts?.layoutOverrides?.stats?.length
    ? opts.layoutOverrides.stats
    : defaultComparisonStats) as Array<{ value: string; label: string }>;
  const stats = scrubBrandDeep(rawStats, opts?.brand);

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;

  const headerH = (hCfg.height as number | undefined) ?? 200;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 55) / 100);

  doc.setFillColor(...pal.primary);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(...pal.primaryAlt);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawBrandLogo(doc, margin, 22, logoPng, 70, 24, b.wordmark);

  if (prospectLogoData) {
    const logoEndX = margin + 80;
    doc.setDrawColor(...pal.onPrimaryMuted); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    try {
      const pScale = Math.max(0.3, Math.min(3, (hCfg.prospectLogoScale as number | undefined) ?? 1));
      const maxW = 135 * pScale, maxH = 30 * pScale;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      doc.addImage(prospectLogoData, "PNG", logoEndX + 10, 34 - lh / 2, lw, lh);
    } catch { }
  } else if (dsoName) {
    const logoEndX = margin + 80;
    doc.setDrawColor(...pal.onPrimaryMuted); doc.setLineWidth(0.75);
    doc.line(logoEndX, 22, logoEndX, 46);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(dsoName.length > 15 ? 11 : 14);
    doc.setTextColor(...white);
    doc.text(dsoName, logoEndX + 10, 40);
  }

  const titleSize = (hCfg.titleFontSize as number | undefined) ?? 20;
  const titleLineSpacing = (hCfg.titleLineSpacing as number | undefined) ?? 1.32;
  const titleLineH = Math.round(titleSize * titleLineSpacing);
  doc.setFont(headingFont, headingStyle("normal")); doc.setFontSize(titleSize); doc.setTextColor(...white);
  doc.text("Stronger Systems.", margin, 90);
  doc.text("Better Outcomes.", margin, 90 + titleLineH);
  doc.setFont("helvetica", "normal"); doc.setFontSize((hCfg.subtitleFontSize as number | undefined) ?? 9.5); doc.setTextColor(...pal.onPrimaryMuted2);
  const subLines = doc.splitTextToSize(`See how ${b.productName} has matured to deliver more consistent clinical performance across practices.`, splitX - margin - 20);
  doc.text(subLines, margin, 90 + titleLineH * 2 + 8 + ((hCfg.subtitleOffsetY as number | undefined) ?? 0));

  let y = headerH + ((bCfg.compTableAboveSpacing as number | undefined) ?? 20);
  const col1W = (bCfg.compTableCapColWidth as number | undefined) ?? 130;
  const col2W = (contentW - col1W) / 2;
  const tableHeaderH = (bCfg.compTableHeaderHeight as number | undefined) ?? 28;
  const tableHeaderFontSize = (bCfg.compTableHeaderFontSize as number | undefined) ?? 8;

  doc.setFillColor(...pal.primary);
  doc.roundedRect(margin, y, contentW, tableHeaderH, 4, 4, "F");
  doc.rect(margin, y + 4, contentW, tableHeaderH - 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(tableHeaderFontSize); doc.setTextColor(180, 200, 190);
  doc.text("CAPABILITY", margin + 12, y + tableHeaderH * 0.65);
  doc.setTextColor(...pal.accentOnDark); doc.text(`${b.productName.toUpperCase()} 2022`, margin + col1W + 12, y + tableHeaderH * 0.65);
  doc.text(`${b.productName.toUpperCase()} TODAY`, margin + col1W + col2W + 12, y + tableHeaderH * 0.65);
  y += tableHeaderH;

  const rowH = (bCfg.compTableRowHeight as number | undefined) ?? 40;
  const tableFontSize = (bCfg.compTableFontSize as number | undefined) ?? 8;
  activeRows.forEach((row, i) => {
    const bgColor: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === activeRows.length - 1;
    doc.setFillColor(...bgColor);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH, 4, 4, "F"); doc.rect(margin, y, contentW, rowH - 4, "F"); }
    else { doc.rect(margin, y, contentW, rowH, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(tableFontSize); doc.setTextColor(...pal.primaryOnLight);
    const capLines = doc.splitTextToSize(row.capability, col1W - 24);
    doc.text(capLines, margin + 12, y + rowH * 0.35);
    doc.setFont("helvetica", "normal"); doc.setFontSize(tableFontSize); doc.setTextColor(...subtleText);
    const thenLines = doc.splitTextToSize(row.then, col2W - 24);
    doc.text(thenLines, margin + col1W + 12, y + rowH * 0.35);
    doc.setFont("helvetica", "normal"); doc.setFontSize(tableFontSize); doc.setTextColor(40, 80, 65);
    const nowLines = doc.splitTextToSize(row.now, col2W - 24);
    doc.text(nowLines, margin + col1W + col2W + 12, y + rowH * 0.35);
    y += rowH;
  });
  y += (bCfg.compTableBelowSpacing as number | undefined) ?? 24;

  const statGap = 14;
  const statW = (contentW - statGap * 2) / 3;
  const statH = (bCfg.compStatCardHeight as number | undefined) ?? 80;
  const statValueSize = (bCfg.compStatValueSize as number | undefined) ?? 22;
  const statLabelSize = (bCfg.compStatLabelSize as number | undefined) ?? 7.5;
  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFillColor(...pal.accent); doc.roundedRect(sx, y, statW, 3, 3, 3, "F"); doc.rect(sx, y + 2, statW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(statValueSize); doc.setTextColor(...pal.primaryOnLight);
    doc.text(stat.value, sx + statW / 2, y + statH * 0.4, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(statLabelSize); doc.setTextColor(...textMuted);
    const labelLines = doc.splitTextToSize(stat.label, statW - 24);
    doc.text(labelLines, sx + statW / 2, y + statH * 0.6, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 20;

  const showTeam = (tCfg.show as boolean | undefined) !== false;
  const filteredContacts = teamContacts.filter(c => c.name.trim());
  if (showTeam && filteredContacts.length > 0) {
    drawSep(doc, margin, y, contentW, lineColor); y += 29;
    doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize((tCfg.headingFontSize as number | undefined) ?? 13); doc.setTextColor(...textDark);
    doc.text("Your dedicated team", w / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
    doc.text("Meet your contacts for training, clinical support, and check-ins.", w / 2, y + 15, { align: "center" });
    y += 39;
    const contactColW = contentW / Math.max(filteredContacts.length, 1);
    let maxContactBottom = y;
    filteredContacts.forEach((contact, i) => {
      const cx = margin + contactColW * i + contactColW / 2;
      doc.setFont("helvetica", "bold"); doc.setFontSize((tCfg.nameFontSize as number | undefined) ?? 10); doc.setTextColor(...textDark);
      doc.text(contact.name, cx, y, { align: "center" });
      let contactY = y + 14;
      if (contact.title) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
        doc.text(contact.title, cx, contactY, { align: "center" });
        contactY += 14;
      }
      if (contact.contactInfo) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...textMuted);
        doc.text(contact.contactInfo, cx, contactY, { align: "center" });
        contactY += 12;
      }
      maxContactBottom = Math.max(maxContactBottom, contactY);
    });
    y = maxContactBottom + 30;
  }

  const showFooter = (fCfg.show as boolean | undefined) !== false;
  const footerH = showFooter ? (customLinkText?.trim() && customLinkUrl?.trim() ? 38 : 30) : 0;
  const footerY = h - footerH;
  if (y < footerY) { doc.setFillColor(255, 255, 255); doc.rect(0, y, w, footerY - y, "F"); }
  if (showFooter) {
    doc.setFillColor(...pal.primary); doc.rect(0, footerY, w, footerH, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(...white);
    const footerText = phoneNumber.trim() ? `To contact us, please call: ${phoneNumber}` : b.footerUrl;
    if (footerText) doc.text(footerText, w / 2, footerY + (customLinkText?.trim() && customLinkUrl?.trim() ? 16 : 24), { align: "center" });
    if (customLinkText?.trim() && customLinkUrl?.trim()) {
      doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(...pal.onPrimaryMuted);
      doc.textWithLink(`${customLinkText}`, w / 2 - doc.getTextWidth(customLinkText) / 2, footerY + 28, { url: customLinkUrl });
    }
  }

  return doc;
};

// ── New Partner One-Pager ──────────────────────────────────────────────
export const defaultPartnerFeatures = [
  { title: "Increase treatment predictability", desc: "Get real-time expert guidance while your patient is in the chair for confident, accurate outcomes." },
  { title: "Digitize every restorative workflow", desc: "Get a free Dandy Vision Scanner and Cart." },
  { title: "Access state-of-the-art lab quality", desc: "Deliver high-quality prosthetics with digital precision, premium materials, and unmatched consistency." },
  { title: "Get your new partnership perks and preferred pricing", desc: "" },
];

export const defaultPartnerStats = [
  { value: "88%", desc: "say Dandy's real-time lab support makes case management easier." },
  { value: "83%", desc: "say they have saved time using Dandy's portal to manage lab cases." },
  { value: "67%", desc: "say Dandy's technology gives them a competitive edge over other practices." },
];

export interface NewPartnerContent {
  headline?: string;
  intro?: string;
  features?: Array<{ title: string; desc: string }>;
  stats?: Array<{ value: string; desc: string }>;
  /** Editable heading above the stats row (defaults to "See what <brand> doctors are saying:"). */
  testimonialsHeading?: string;
  footerLink?: string;
}

export interface NewPartnerOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  content?: NewPartnerContent;
  brand?: BrandContext;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    bodyCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generateNewPartnerOnePager = async (
  dsoName: string,
  prospectLogoData: string | null,
  prospectLogoDims: { w: number; h: number },
  qrUrl: string,
  _fieldValues?: Record<string, string>,
  opts?: NewPartnerOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  registerBrandFonts(doc, opts?.brand);
  // Brand heading font: registerBrandFonts only registers the "Bagoss" face
  // when the brand supplies a resolvable heading font, so its presence in the
  // font list signals a usable brand heading. Match the Agreement Summary:
  // render true headings in that face, falling back to the built-in helvetica
  // (preserving the original weight) for brands with no heading font (e.g. Dandy).
  const hasBrandHeading = !!(doc.getFontList?.() ?? {})["Bagoss"];
  const headingFont = hasBrandHeading ? "Bagoss" : "helvetica";
  const headingStyle = (builtin: "normal" | "bold"): string =>
    hasBrandHeading ? "normal" : builtin;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const bCfg = opts?.layoutOverrides?.bodyCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const b = resolveBrand(opts?.brand);
  const pal = resolvePalette(opts?.brand);
  const rawContent = opts?.content ?? {};
  // Scrub any Dandy literals out of caller-supplied content before use.
  const content = scrubBrandDeep(rawContent, opts?.brand);
  const headline = content.headline ?? scrubBrand(`Unlock the Power of Digital Dentistry with ${b.productName}`, opts?.brand);
  const introRaw = content.intro ?? scrubBrand(`As ${dsoName}'s newest preferred lab partner, ${b.productName} is here to help your practice thrive with the most advanced digital lab in the industry. Together, we're delivering smarter, faster, and more predictable outcomes—while elevating patient care and your bottom line.`, opts?.brand);
  const intro = introRaw.replace(/\{dso\}/g, dsoName).replace(/\{dsoName\}/g, dsoName);
  const features = content.features ?? scrubBrandDeep(defaultPartnerFeatures, opts?.brand);
  const stats = content.stats ?? scrubBrandDeep(defaultPartnerStats, opts?.brand);
  const footerLink = content.footerLink ?? (fCfg.link as string | undefined) ?? b.footerUrl;
  const savedQrUrl = (hCfg as Record<string, unknown>).partnerQrUrl as string | undefined ?? qrUrl;

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;

  const headerH = (hCfg.height as number | undefined) ?? 280;
  const splitX = w * (((hCfg.splitRatio as number | undefined) ?? 55) / 100);

  doc.setFillColor(...pal.primary);
  doc.rect(0, 0, splitX, headerH, "F");

  if (headerImgData) {
    const cropAnchor = (hCfg.imageCropAnchor as "top" | "center" | "bottom" | undefined) ?? "center";
    const croppedHeader = await cropImage(headerImgData, w - splitX, headerH, cropAnchor);
    doc.addImage(croppedHeader, "JPEG", splitX, 0, w - splitX, headerH);
  } else {
    doc.setFillColor(...pal.primaryAlt);
    doc.rect(splitX, 0, w - splitX, headerH, "F");
  }

  drawBrandLogo(doc, margin, 22, logoPng, 70, 24, b.wordmark);

  const logoSepX = margin + 78;
  const legacyPartnerScale = ((hCfg.partnerLogoScale as number | undefined) ?? 100) / 100;
  const newProspectScale = (hCfg.prospectLogoScale as number | undefined) ?? 1;
  const logoScale = Math.max(0.3, Math.min(3, legacyPartnerScale * newProspectScale));
  const logoOffX = (hCfg.partnerLogoOffsetX as number | undefined) ?? 0;
  const logoOffY = (hCfg.partnerLogoOffsetY as number | undefined) ?? 0;
  if (prospectLogoData) {
    doc.setDrawColor(...pal.onPrimaryMuted); doc.setLineWidth(0.75);
    doc.line(logoSepX, 20, logoSepX, 50);
    try {
      const maxW = 70 * logoScale, maxH = 26 * logoScale;
      const ratio = Math.min(maxW / prospectLogoDims.w, maxH / prospectLogoDims.h);
      const lw = prospectLogoDims.w * ratio;
      const lh = prospectLogoDims.h * ratio;
      const format = prospectLogoData.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(prospectLogoData, format, logoSepX + 10 + logoOffX, 35 - lh / 2 + logoOffY, lw, lh);
    } catch { }
  } else if (dsoName) {
    doc.setDrawColor(...pal.onPrimaryMuted); doc.setLineWidth(0.75);
    doc.line(logoSepX, 20, logoSepX, 50);
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...white);
    doc.text(dsoName, logoSepX + 10 + logoOffX, 38 + logoOffY);
  }

  const subtitleFontSize = (hCfg.subtitleFontSize as number | undefined) ?? 12;
  const subtitleOffY = (hCfg.subtitleOffsetY as number | undefined) ?? 0;
  // The "Brand & DSO name:" subtitle line can be hidden, and nudged in X/Y
  // independently of the header title. subtitleOffsetY still shifts the whole
  // header block (subtitle + title) for backward compatibility, while
  // subtitleOffsetX / subtitleLineOffsetY move ONLY this subtitle line.
  const subtitleShow = (hCfg.subtitleShow as boolean | undefined) !== false;
  const subtitleOnlyX = (hCfg.subtitleOffsetX as number | undefined) ?? 0;
  const subtitleOnlyY = (hCfg.subtitleLineOffsetY as number | undefined) ?? 0;
  if (subtitleShow) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(subtitleFontSize); doc.setTextColor(...pal.onPrimaryMuted2);
    doc.text(`${b.productName} & ${dsoName}:`, margin + subtitleOnlyX, 65 + subtitleOffY + subtitleOnlyY);
  }
  const titleFontSz = (hCfg.titleFontSize as number | undefined) ?? 22;
  // Honor the editor's "Bold heading" toggle: when explicitly false, render the
  // header title in normal weight. Undefined/true keeps the default bold.
  const titleWeight: "normal" | "bold" =
    (hCfg as Record<string, unknown>).boldHeading === false ? "normal" : "bold";
  doc.setFont(headingFont, headingStyle(titleWeight)); doc.setFontSize(titleFontSz); doc.setTextColor(...white);
  const titleLines = doc.splitTextToSize("The Winning Combo for Predictable, Precise Dentistry", splitX - margin - 16);
  doc.text(titleLines, margin, 65 + subtitleOffY + subtitleFontSize + 14);

  let y = headerH + 40;

  doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize((bCfg.headlineFontSize as number | undefined) ?? 18); doc.setTextColor(...textDark);
  const headlineLines = doc.splitTextToSize(headline, contentW);
  doc.text(headlineLines, margin, y);
  y += headlineLines.length * 22 + 14;

  doc.setFont("helvetica", "normal"); doc.setFontSize((bCfg.introFontSize as number | undefined) ?? 10); doc.setTextColor(...textMuted);
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 14 + 24;

  const cardGap = 14;
  const cardW = (contentW - cardGap) / 2;
  const cardH = 90;
  const cardBorderColor: [number, number, number] = pal.accentBorder;
  const cardBorderW = 3;
  const cardOffWhite: [number, number, number] = [240, 240, 236];

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const feat = features[idx];
      const cx = margin + col * (cardW + cardGap);
      const cy = y + row * (cardH + cardGap);
      doc.setFillColor(...cardOffWhite); doc.roundedRect(cx, cy, cardW, cardH, 4, 4, "F");
      doc.setFillColor(...cardBorderColor); doc.roundedRect(cx, cy, cardBorderW, cardH, 2, 0, "F");
      const featTitleFs = (bCfg.featureTitleFontSize as number | undefined) ?? 11;
      const featDescFs = (bCfg.featureDescFontSize as number | undefined) ?? 9;
      if (idx === 3) {
        doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(featTitleFs); doc.setTextColor(...textDark);
        doc.text("Learn more about the", cx + 16, cy + 28);
        doc.text(`${b.productName} experience`, cx + 16, cy + 28 + featTitleFs + 4);
        try {
          const QRCode = (await import("qrcode")).default;
          const qrDataUrl: string = await QRCode.toDataURL(savedQrUrl || b.qrFallbackUrl, { width: 400, margin: 1 });
          doc.addImage(qrDataUrl, "PNG", cx + cardW - 72, cy + 14, 58, 58);
        } catch { }
      } else if (feat) {
        doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(featTitleFs); doc.setTextColor(...textDark);
        doc.text(feat.title, cx + 16, cy + 28);
        if (feat.desc) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(featDescFs); doc.setTextColor(...textMuted);
          const descLines = doc.splitTextToSize(feat.desc, cardW - 36);
          doc.text(descLines, cx + 16, cy + 28 + featTitleFs + 6);
        }
      }
    }
  }
  y += 2 * (cardH + cardGap) + 28;

  const testimonialsHeading = content.testimonialsHeading ?? scrubBrand(`See what ${b.productName} doctors are saying:`, opts?.brand);
  doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(16); doc.setTextColor(...pal.primaryOnLight);
  doc.text(testimonialsHeading, margin, y);
  y += 28;

  const statGap = 14;
  const statW = (contentW - statGap * 2) / 3;
  const statH = 120;

  const statValueFs = (bCfg.statValueFontSize as number | undefined) ?? 36;
  const statDescFs = (bCfg.statDescFontSize as number | undefined) ?? 8.5;
  stats.forEach((stat, i) => {
    const sx = margin + (statW + statGap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(sx, y, statW, statH, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(statValueFs); doc.setTextColor(...pal.primaryOnLight);
    doc.text(stat.value, sx + statW / 2, y + 45, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(statDescFs); doc.setTextColor(...textMuted);
    const statDesc = stat.desc;
    const statLines = doc.splitTextToSize(statDesc, statW - 24);
    doc.text(statLines, sx + statW / 2, y + 45 + statValueFs * 0.4 + 6, { align: "center", maxWidth: statW - 24 });
  });
  y += statH + 30;

  if ((fCfg.show as boolean | undefined) !== false) {
    doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 11); doc.setTextColor(...textMuted);
    doc.text(footerLink, w / 2, y, { align: "center" });
  }
  void h;

  return doc;
};

// ── ROI One-Pager ──────────────────────────────────────────────────────
export interface ROIOpts {
  logoPng?: string | null;
  headerImgData?: string | null;
  brand?: BrandContext;
  layoutOverrides?: {
    headerCfg?: Record<string, unknown>;
    footerCfg?: Record<string, unknown>;
  };
}

export const generateROIOnePager = async (
  dsoName: string,
  numPractices: number,
  opts?: ROIOpts,
): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  registerBrandFonts(doc, opts?.brand);
  // Brand heading font: registerBrandFonts only registers the "Bagoss" face
  // when the brand supplies a resolvable heading font, so its presence in the
  // font list signals a usable brand heading. Match the Agreement Summary:
  // render true headings in that face, falling back to the built-in helvetica
  // (preserving the original weight) for brands with no heading font (e.g. Dandy).
  const hasBrandHeading = !!(doc.getFontList?.() ?? {})["Bagoss"];
  const headingFont = hasBrandHeading ? "Bagoss" : "helvetica";
  const headingStyle = (builtin: "normal" | "bold"): string =>
    hasBrandHeading ? "normal" : builtin;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = w - margin * 2;

  const hCfg = opts?.layoutOverrides?.headerCfg ?? {};
  const fCfg = opts?.layoutOverrides?.footerCfg ?? {};

  const logoPng = opts?.logoPng ?? null;
  const headerImgData = (hCfg.headerImage as string | undefined) ?? opts?.headerImgData ?? null;
  const b = resolveBrand(opts?.brand);
  const pal = resolvePalette(opts?.brand);

  const headerH = (hCfg.height as number | undefined) ?? 160;
  doc.setFillColor(...pal.primary);
  doc.rect(0, 0, w, headerH, "F");

  if (headerImgData) {
    const format = headerImgData.startsWith("data:image/png") ? "PNG" : "JPEG";
    const imgNativeW = 1194, imgNativeH = 976;
    const imgAspect = imgNativeW / imgNativeH;
    const imgH = headerH, imgW = imgH * imgAspect;
    const imgX = w - imgW;
    doc.addImage(headerImgData, format, imgX, 0, imgW, imgH);
    doc.setFillColor(...pal.primary);
    doc.rect(0, 0, imgX + imgW * 0.05, headerH, "F");
  }

  drawBrandLogo(doc, margin, Math.round(headerH * 0.225), logoPng, 80, 28, b.wordmark);

  const defaultNameSize = dsoName.length > 15 ? 16 : 22;
  const roiNameSize = (hCfg.titleFontSize as number | undefined) ?? defaultNameSize;
  const titleY = Math.round(headerH * 0.575);
  doc.setFont(headingFont, headingStyle("normal")); doc.setFontSize(roiNameSize); doc.setTextColor(...white);
  doc.text("& ", margin, titleY);
  const ampWidth = doc.getTextWidth("& ");
  doc.text(dsoName, margin + ampWidth, titleY);
  const subtitleText = (hCfg.subtitleText as string | undefined) ?? "Your custom partnership overview — built for scale, savings & growth";
  const subtitleY = Math.round(headerH * 0.8);
  doc.setFont("helvetica", "normal"); doc.setFontSize((hCfg.subtitleFontSize as number | undefined) ?? 11); doc.setTextColor(...pal.onPrimaryMuted);
  doc.text(subtitleText, margin, subtitleY);

  let y = headerH + 28;
  const metricsH = 70;
  doc.setFillColor(...pal.primaryMid); doc.roundedRect(margin, y, contentW, metricsH, 6, 6, "F");

  const practices = numPractices;
  const apptsSavedYear = Math.round(22.5 * practices * 12);
  const chairHoursSavedYear = Math.round(11.25 * practices * 12 + 4.5 * practices);
  const totalUpsideYear = (7500 * practices * 12) + (32500 * practices);
  const fmtShort = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`;

  const metrics = [
    { value: fmtShort(totalUpsideYear), label: "Revenue upside / yr" },
    { value: "96%", label: "First-time right rate" },
    { value: apptsSavedYear.toLocaleString(), label: "Appointments saved / yr" },
    { value: chairHoursSavedYear.toLocaleString(), label: "Chair hours recovered / yr" },
    { value: "$0", label: "CAPEX to start" },
  ];

  const colW = contentW / metrics.length;
  metrics.forEach((m, i) => {
    const cx = margin + colW * i + colW / 2;
    if (i > 0) { doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(margin + colW * i, y + 16, margin + colW * i, y + metricsH - 16); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.setTextColor(...pal.accentOnDark); doc.text(m.value, cx, y + 31, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(m.label, cx, y + 45, { align: "center" });
  });
  y += metricsH + 28;

  const caseStudies = scrubBrandDeep([
    { org: "APEX Dental Partners", stat: "12.5%", statLabel: "annualized revenue potential increase", quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", authorName: "Dr. Layla Lohmann", authorTitle: "Founder" },
    { org: "Open & Affordable Dental", stat: "96%", statLabel: "reduction in remakes", quote: "Reduced crown appointments by 2–3 minutes per case. That adds up to hours of saved chair time per month — and our remake headaches are gone.", authorName: "Clinical Director", authorTitle: "" },
    { org: "Dental Care Alliance", stat: "99%", statLabel: "practices still using Dandy after one year", quote: "The training you guys give is incredible. The onboarding has been incredible. The whole experience has been incredible.", authorName: "Dr. Trey Mueller", authorTitle: "Chief Clinical Officer" },
  ], opts?.brand);

  const gap = 14;
  const pillarW = (contentW - gap * 2) / 3;
  const pillarH = 215;

  caseStudies.forEach((cs, i) => {
    const px = margin + (pillarW + gap) * i;
    doc.setFillColor(...offWhite); doc.roundedRect(px, y, pillarW, pillarH, 6, 6, "F");
    doc.setFillColor(...pal.accent); doc.roundedRect(px, y, pillarW, 3, 3, 3, "F"); doc.rect(px, y + 2, pillarW, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text(cs.org.toUpperCase(), px + 16, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(26); doc.setTextColor(...pal.primaryOnLight); doc.text(cs.stat, px + 16, y + 54);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...subtleText);
    const labelLines = doc.splitTextToSize(cs.statLabel, pillarW - 32); doc.text(labelLines, px + 16, y + 68);
    drawSep(doc, px + 16, y + 86, pillarW - 32, [220, 220, 215]);
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(70, 80, 75);
    const quoteLines = doc.splitTextToSize(`"${cs.quote}"`, pillarW - 32);
    doc.text(quoteLines, px + 16, y + 100);
    const qy = y + 100 + quoteLines.length * 11 + 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...textDark);
    doc.text(cs.authorName, px + 16, qy);
    if (cs.authorTitle) { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...subtleText); doc.text(cs.authorTitle, px + 16, qy + 10); }
  });
  y += pillarH + 24;

  // Next steps
  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 105, 6, 6, "F");
  doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(12); doc.setTextColor(...pal.primaryOnLight); doc.text("Recommended Next Step: Risk-Free Pilot", margin + 20, y + 24);
  const pilotItems = [
    "Start with 5–10 locations — no long-term commitment required",
    "Measure remake reduction, chair time recovered, and revenue lift in real time",
    "Dedicated onboarding team + change management support included",
    "Scale across the full network once ROI is validated",
  ];
  let pilotY = y + 44;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  pilotItems.forEach((item) => {
    doc.setFillColor(...pal.accent); doc.circle(margin + 30, pilotY - 3, 3, "F");
    doc.setTextColor(...textMuted); doc.text(item, margin + 42, pilotY); pilotY += 16;
  });
  y += 105 + 20;

  // Quote block fills remaining page height
  const footerH = 36;
  const quoteBlockH = h - footerH - y - 20;
  doc.setFillColor(...pal.primaryMid); doc.roundedRect(margin, y, contentW, quoteBlockH, 6, 6, "F");
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5);
  const bottomQuote = `I've used ${b.labName} for the last two years for crowns, implant crowns, and removables, and their work is consistently excellent. The quality is outstanding and their customer service is even better. I wouldn't change this lab for any other.`;
  const bqLines = doc.splitTextToSize(bottomQuote, contentW - 110);
  const quoteTextH = bqLines.length * 13;
  const attrH2 = 12; const quoteMarkH = 24; const gapBetween = 10;
  const totalContentH = quoteMarkH + quoteTextH + gapBetween + attrH2;
  const contentStartY = y + (quoteBlockH - totalContentH) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(40); doc.setTextColor(...pal.accentOnDark); doc.text("\u201C", margin + 24, contentStartY + quoteMarkH + 19);
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...white); doc.text(bqLines, margin + 50, contentStartY + quoteMarkH);
  const attrY = contentStartY + quoteMarkH + quoteTextH + gapBetween - 11;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...pal.accentOnDark); doc.text("Dr. Tania Arthur", margin + 50, attrY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...pal.onPrimaryMuted); doc.text("  —  Oasis Modern Dentistry", margin + 50 + doc.getTextWidth("Dr. Tania Arthur "), attrY);

  // Page 1 footer
  doc.setFillColor(...pal.primary); doc.rect(0, h - footerH, w, footerH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, h - footerH + 10, 48, 17); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text(b.wordmark, margin, h - footerH + 24);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text(b.wordmark, margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize((fCfg.fontSize as number | undefined) ?? 8); doc.setTextColor(160, 185, 175);
  if (b.footerUrl) doc.text(b.footerUrl, w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...pal.accentOnDark); doc.text(`Prepared for ${dsoName}  •  Page 1 of 2`, w - margin, h - footerH + 22, { align: "right" });

  // PAGE 2
  doc.addPage();
  const p2HeaderH = 80;
  doc.setFillColor(...pal.primary); doc.rect(0, 0, w, p2HeaderH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, 22, 70, 24); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text(b.wordmark, margin, 40);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...white); doc.text(b.wordmark, margin, 40);
  }
  doc.setFont(headingFont, headingStyle("normal")); doc.setFontSize(15); doc.setTextColor(...white); doc.text(`The ${b.productName} Difference & ROI`, margin, 66);
  y = p2HeaderH + 28;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...pal.accentOnDark); doc.text(`THE ${b.productName.toUpperCase()} DIFFERENCE`, margin, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...textMuted); doc.text(`Built for ${b.industryLabel} scale. Designed for provider trust.`, margin, y + 12); y += 28;

  const tableRows = scrubBrandDeep([
    { need: "Patient Volume Growth", dandy: "30% higher case acceptance, expanded services like Aligners", traditional: "No growth enablement" },
    { need: "Multi-Brand Consistency", dandy: "One standard across all your brands and locations", traditional: "Varies by location and vendor" },
    { need: "Waste Prevention", dandy: "AI Scan Review catches issues before they cost you", traditional: "Remakes discovered after the fact" },
    { need: "Executive Visibility", dandy: "Real-time, actionable data across your entire network", traditional: "Fragmented, non-actionable reports" },
    { need: "Capital Efficiency", dandy: "Premium scanners included — no CAPEX required", traditional: "Heavy CAPEX, scanner bottlenecks" },
    { need: "Change Management", dandy: "Hands-on training that respects provider autonomy", traditional: "Minimal onboarding, slow rollout" },
  ], opts?.brand);

  const col1W2 = 120; const col2W2 = (contentW - col1W2) / 2; const rowH2 = 36;
  doc.setFillColor(...pal.primary); doc.roundedRect(margin, y, contentW, 28, 4, 4, "F"); doc.rect(margin, y + 4, contentW, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(`WHAT YOUR ${b.industryLabel.toUpperCase()} NEEDS`, margin + 12, y + 18);
  doc.setTextColor(...pal.accentOnDark); doc.text(b.productName.toUpperCase(), margin + col1W2 + 12, y + 18);
  doc.setTextColor(180, 200, 190); doc.text("TRADITIONAL LABS", margin + col1W2 + col2W2 + 12, y + 18); y += 28;

  tableRows.forEach((row, i) => {
    const bgColor2: [number, number, number] = i % 2 === 0 ? offWhite : white;
    const isLast = i === tableRows.length - 1;
    doc.setFillColor(...bgColor2);
    if (isLast) { doc.roundedRect(margin, y, contentW, rowH2, 4, 4, "F"); doc.rect(margin, y, contentW, rowH2 - 4, "F"); } else { doc.rect(margin, y, contentW, rowH2, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...pal.primaryOnLight); doc.text(row.need, margin + 12, y + 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 80, 65);
    const dandyLines = doc.splitTextToSize(row.dandy, col2W2 - 24); doc.text(dandyLines, margin + col1W2 + 12, y + 14);
    doc.setTextColor(...subtleText);
    const tradLines = doc.splitTextToSize(row.traditional, col2W2 - 24); doc.text(tradLines, margin + col1W2 + col2W2 + 12, y + 14);
    y += rowH2;
  });
  y += 18;

  // ROI Breakdown
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...pal.accentOnDark); doc.text("ROI BREAKDOWN", margin, y); y += 6;
  const n = practices;
  const apptFreedPerMonth = Math.round(22.5 * n);
  const chairHoursPerMonth = Math.round(11.25 * n * 10) / 10;
  const dentureProductionPerMonth = Math.round(7500 * n);
  const dentureProductionPerYear = dentureProductionPerMonth * 12;
  const remakesAvoidedPerMonth = Math.round(0.75 * n * 10) / 10;
  const labCostsAvoidedPerYear = Math.round(600 * n);
  const chairHoursRestoPerYear = Math.round(4.5 * n * 10) / 10;
  const restoUpsidePerYear = Math.round(32500 * n);
  const combinedTotal = dentureProductionPerYear + restoUpsidePerYear;
  const fmtK = (v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M+` : `$${Math.round(v / 1000)}K+`;
  const fmtDollar2 = (v: number) => `$${v.toLocaleString()}`;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
  doc.text(`Estimated annual financial impact for ${dsoName} (based on ${n} practices).`, margin, y + 12); y += 30;

  const cardGap2 = 14; const cardW2 = (contentW - cardGap2) / 2; const cardH2 = 145;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, cardW2, cardH2, 6, 6, "F");
  doc.setFillColor(...pal.accent); doc.roundedRect(margin, y, cardW2, 3, 3, 3, "F"); doc.rect(margin, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("DENTURE WORKFLOW IMPACT", margin + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...pal.primaryOnLight); doc.text(fmtK(dentureProductionPerYear), margin + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("incremental production / year", margin + 16, y + 66);
  drawSep(doc, margin + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const dentureItems = [`${apptFreedPerMonth.toLocaleString()} appointments freed / month`, `${chairHoursPerMonth} chair hours recovered / month`, "1.5 fewer appointments per case", `${fmtDollar2(dentureProductionPerMonth)} incremental production / month`];
  let dentY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  dentureItems.forEach((item) => { doc.setFillColor(...pal.accent); doc.circle(margin + 22, dentY - 2.5, 2, "F"); doc.setTextColor(...textMuted); doc.text(item, margin + 30, dentY); dentY += 14; });

  const rightX = margin + cardW2 + cardGap2;
  doc.setFillColor(...offWhite); doc.roundedRect(rightX, y, cardW2, cardH2, 6, 6, "F");
  doc.setFillColor(...pal.accent); doc.roundedRect(rightX, y, cardW2, 3, 3, 3, "F"); doc.rect(rightX, y + 2, cardW2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("FIXED RESTO REMAKE IMPACT", rightX + 16, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(24); doc.setTextColor(...pal.primaryOnLight); doc.text(fmtK(restoUpsidePerYear), rightX + 16, y + 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...subtleText); doc.text("total financial upside / year", rightX + 16, y + 66);
  drawSep(doc, rightX + 16, y + 78, cardW2 - 32, [220, 220, 215]);
  const restoItems = ["60% fewer remakes with AI Scan Review", `${remakesAvoidedPerMonth} remakes avoided / month`, `${fmtDollar2(labCostsAvoidedPerYear)} lab costs avoided / year`, `${chairHoursRestoPerYear} chair hours recovered / year`];
  let restoY = y + 92;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  restoItems.forEach((item) => { doc.setFillColor(...pal.accent); doc.circle(rightX + 22, restoY - 2.5, 2, "F"); doc.setTextColor(...textMuted); doc.text(item, rightX + 30, restoY); restoY += 14; });
  y += cardH2 + 20;

  doc.setFillColor(...pal.primary); doc.roundedRect(margin, y, contentW, 58, 6, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text(`COMBINED ANNUAL UPSIDE (${n} PRACTICES)`, margin + 20, y + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...pal.accentOnDark); doc.text(fmtK(combinedTotal), margin + 20, y + 42);
  const div1X = margin + contentW - 280; doc.setDrawColor(60, 90, 80); doc.setLineWidth(0.5); doc.line(div1X, y + 12, div1X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("DENTURE", div1X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...pal.accentOnDark); doc.text(fmtK(dentureProductionPerYear), div1X + 16, y + 42);
  const div2X = div1X + 140; doc.line(div2X, y + 12, div2X, y + 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(180, 200, 190); doc.text("FIXED RESTO REMAKES", div2X + 16, y + 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(18); doc.setTextColor(...pal.accentOnDark); doc.text(fmtK(restoUpsidePerYear), div2X + 16, y + 42);
  y += 58 + 16;

  doc.setFillColor(...offWhite); doc.roundedRect(margin, y, contentW, 55, 6, 6, "F");
  doc.setFont(headingFont, headingStyle("bold")); doc.setFontSize(11); doc.setTextColor(...pal.primaryOnLight); doc.text("Ready to validate these numbers?", margin + 20, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...textMuted);
  doc.text(b.footerUrl ? `Start a risk-free pilot with 5–10 locations. Get a custom ROI analysis at ${b.footerUrl}` : "Start a risk-free pilot with 5–10 locations. Get a custom ROI analysis.", margin + 20, y + 38);

  // Page 2 footer
  doc.setFillColor(...pal.primary); doc.rect(0, h - footerH, w, footerH, "F");
  if (logoPng) {
    try { doc.addImage(logoPng, "PNG", margin, h - footerH + 10, 48, 17); } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text(b.wordmark, margin, h - footerH + 24);
    }
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...white); doc.text(b.wordmark, margin, h - footerH + 24);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 185, 175);
  if (b.footerUrl) doc.text(b.footerUrl, w / 2, h - footerH + 22, { align: "center" });
  doc.setTextColor(...pal.accentOnDark); doc.text(`Prepared for ${dsoName}  •  Page 2 of 2`, w - margin, h - footerH + 22, { align: "right" });

  return doc;
};
