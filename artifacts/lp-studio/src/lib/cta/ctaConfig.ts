/**
 * ctaConfig — the SINGLE normalized CTA shape + the legacy shim + the resolver.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * LP Studio's renderer (CtaButton + EmailCaptureModal + ChiliPiperButton +
 * MarketoForm) is already unified, but the ~145 CTA-bearing blocks store their
 * CTA across three label namings (`ctaText` / `ctaLabel` / `primaryCtaText`),
 * two action-mode types, and inconsistent secondary/style/modal support. This
 * module gives the app ONE normalized `CtaConfig`, a lossless shim that maps
 * every legacy prop shape onto it (and back), and a pure resolver that applies
 * the hierarchy **tenant default → page override → block override**.
 *
 * ── Backward-compat contract (non-negotiable) ────────────────────────────────
 * • The shim NEVER invents fields. `legacyBlockPropsToCtaConfig` only reads keys
 *   the block actually declares; `ctaConfigToBlockProps` only writes keys the
 *   target already declares (no pollution) — exactly mirroring the
 *   read/write-by-presence rule in cta-propagation.ts.
 * • Every CtaModalConfig field + the Chili-Piper-handoff fields round-trip
 *   losslessly, so a legacy block's props → CtaConfig → block props produces the
 *   identical form / Chili Piper / Marketo / tracking behavior the renderer sees
 *   today.
 * • The action vocabulary is a SUPERSET. The renderer's existing
 *   {@link CtaActionMode} ("url" | "chilipiper" | "modal-form" |
 *   "modal-chilipiper" | "video-modal") is preserved verbatim. The architecture's
 *   7 logical actions (url · anchor · open-form · chilipiper · download · email ·
 *   none) are EDITOR-LEVEL: anchor / download / email are url-variants the
 *   renderer already handles via `ctaUrl` (#section, an asset URL, a mailto:),
 *   and "open-form" maps onto "modal-form". So `CtaConfig.action` stays the
 *   renderer's mode set; the logical 7 are exposed via {@link CtaLogicalAction}
 *   + {@link toLogicalAction} / {@link fromLogicalAction} for the editor's
 *   action dropdown + source indicator, with no renderer change.
 *
 * This is Phase 1 (foundation). cta-propagation.ts is refactored to source its
 * alias/key lists from here so there is exactly ONE place that knows the legacy
 * naming.
 */

import type {
  CtaModalConfig,
  HeroCtaActionMode,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";

/** Renderer-level action mode — IDENTICAL to CtaButton's CtaActionMode /
 *  HeroCtaActionMode. Kept as the canonical action on CtaConfig so the shim is a
 *  pass-through for the renderer and nothing about today's behavior changes. */
export type CtaActionMode = HeroCtaActionMode;

/**
 * The 7 LOGICAL actions the unified CTA editor exposes (per the architecture
 * doc). These are an editor convenience layered over the renderer modes:
 *   - "url"        → CtaActionMode "url"
 *   - "anchor"     → CtaActionMode "url" (ctaUrl is a `#section`)
 *   - "download"   → CtaActionMode "url" (ctaUrl is an asset URL)
 *   - "email"      → CtaActionMode "url" (ctaUrl is a `mailto:`)
 *   - "open-form"  → CtaActionMode "modal-form"
 *   - "chilipiper" → CtaActionMode "chilipiper" (or "modal-chilipiper" via modal)
 *   - "none"       → no CTA rendered (empty label/action)
 * "video-modal" has no distinct logical label (it's a content action, not a
 * conversion CTA) and maps to/from CtaActionMode "video-modal" directly.
 */
export type CtaLogicalAction =
  | "url"
  | "anchor"
  | "open-form"
  | "chilipiper"
  | "download"
  | "email"
  | "none"
  | "video-modal";

/** Which layer of the hierarchy supplied the effective label/action. */
export type CtaSource = "tenant" | "page" | "block" | "none";

/** A single CTA's full normalized config. Modal fields are spread inline (not
 *  nested) so they round-trip 1:1 with the block prop shape + CtaButtonProps. */
export interface CtaConfig extends CtaModalConfig {
  /** Button label. Normalized from ctaText / ctaLabel / primaryCtaText. */
  label?: string;
  /** Renderer action mode. Defaults to "url" at render. */
  action?: CtaActionMode;
  /** Used when action === "url" (also holds anchor `#`, mailto:, download URL). */
  url?: string;
  /** Used when action === "chilipiper". */
  chilipiper?: string;
  /** Used when action === "video-modal". */
  videoUrl?: string;
  videoPosterUrl?: string;
  /** Per-CTA fill / label color overrides (HeroCtaConfig style fields). */
  buttonColor?: string;
  buttonTextColor?: string;

  /** Optional secondary CTA (HeroCtaConfig secondary fields). */
  secondary?: {
    label?: string;
    action?: CtaActionMode;
    url?: string;
    chilipiper?: string;
    videoUrl?: string;
  };

  /** Inline email-capture pill variant (HeroCtaConfig.ctaStyle === "email-capture"). */
  ctaStyle?: "buttons" | "email-capture";
  emailCapturePlaceholder?: string;
  emailCaptureButtonText?: string;
  submitMode?: "navigate" | "modal-form" | "modal-chilipiper";

  /** Which hierarchy layer this config's label/action came from. Set by
   *  resolveCtaConfig; undefined for a raw shim output. */
  source?: CtaSource;
}

/* ───────────────────────── canonical legacy key lists ─────────────────────── */

/** Every legacy label alias, in read priority order. The canonical trio comes
 *  first; the tail covers the block families that named their primary CTA
 *  differently and therefore never followed the Page CTA (July 2026 coverage
 *  fix): `ctaPrimaryLabel` (the BenefitsCtaConfig family — benefits / features
 *  / how-it-works / quotes section CTAs, ~22 blocks), `heroPrimaryCtaText`
 *  (the BusinessCase family), and `cta1Text` (the id-hero / id-invitation
 *  dual-CTA family, whose cta2* twin is deliberately treated as secondary and
 *  never touched). */
export const CTA_LABEL_KEYS = [
  "ctaText",
  "ctaLabel",
  "primaryCtaText",
  "ctaPrimaryLabel",
  "heroPrimaryCtaText",
  "cta1Text",
] as const;

/** Legacy action-mode aliases, in read priority order. `cta1Action` already
 *  uses the renderer vocabulary (the id-* blocks normalize it in-block); the
 *  ctaPrimary and heroPrimaryCta families have no action key — they render
 *  plain links, so only their label/url follow the Page CTA. */
export const CTA_ACTION_KEYS = ["ctaAction", "ctaMode", "primaryCtaMode", "cta1Action"] as const;

/** Per-action destination keys (renderer-level), in read priority order. */
export const CTA_URL_KEYS = ["ctaUrl", "ctaPrimaryUrl", "heroPrimaryCtaUrl", "cta1Url"] as const;
export const CTA_CHILIPIPER_KEYS = ["chilipiperUrl", "cta1ChilipiperUrl"] as const;
export const CTA_VIDEO_URL_KEYS = ["videoUrl", "cta1VideoUrl"] as const;
export const CTA_VIDEO_POSTER_KEYS = ["videoPosterUrl"] as const;

/** Per-block button-style overrides. */
export const CTA_STYLE_KEYS = ["ctaButtonColor", "ctaButtonTextColor"] as const;

/** Secondary-CTA keys (HeroCtaConfig + the July 2026 alias families). Kept in
 *  sync with the primary lists above: every family's "second button" naming
 *  must live HERE so it stays out of PRIMARY_CTA_KEYS and the Page CTA can
 *  never touch it. */
export const CTA_SECONDARY_LABEL_KEYS = ["ctaSecondaryText", "ctaSecondaryLabel", "heroSecondaryCtaText", "cta2Text"] as const;
export const CTA_SECONDARY_ACTION_KEYS = ["ctaSecondaryAction", "cta2Action"] as const;
export const CTA_SECONDARY_URL_KEYS = ["ctaSecondaryUrl", "heroSecondaryCtaUrl", "cta2Url"] as const;
export const CTA_SECONDARY_CHILIPIPER_KEYS = ["secondaryChilipiperUrl", "cta2ChilipiperUrl"] as const;
export const CTA_SECONDARY_VIDEO_KEYS = ["secondaryVideoUrl", "cta2VideoUrl"] as const;

/** Inline email-capture variant keys (HeroCtaConfig). */
export const CTA_EMAIL_CAPTURE_KEYS = [
  "ctaStyle",
  "emailCapturePlaceholder",
  "emailCaptureButtonText",
  "submitMode",
] as const;

/** The 19 modal-config keys (CtaModalConfig). Kept as the single source of
 *  truth — cta-modal.ts/pickCtaModalConfig + cta-propagation.ts import this. */
export const CTA_MODAL_KEYS = [
  "modalChilipiperUrl",
  "modalFormSource",
  "modalFormId",
  "modalMarketoBaseUrl",
  "modalMarketoMunchkinId",
  "modalMarketoFormId",
  "modalChiliPiperHandoffUrl",
  "modalChiliPiperHandoffMode",
  "modalChiliPiperHandoffFieldMap",
  "modalHeadline",
  "modalSubheadline",
  "modalSubmitText",
  "modalSuccessMessage",
  "modalDisclaimer",
  "modalShowFirstName",
  "modalShowLastName",
  "modalShowPhone",
  "modalShowCompany",
] as const;

type Props = Record<string, unknown>;

function has(props: Props, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

/** First key in `keys` that exists on `props`, with its value. */
function readFirst(props: Props, keys: readonly string[]): { key: string; value: unknown } | undefined {
  for (const k of keys) {
    if (has(props, k)) return { key: k, value: props[k] };
  }
  return undefined;
}

/* ─────────────────────────── logical action mapping ──────────────────────── */

/**
 * Map a renderer CtaActionMode + its destination URL to the LOGICAL action the
 * editor shows. Pure heuristic on `url` shape (anchor / mailto / download).
 */
export function toLogicalAction(action: CtaActionMode | undefined, url?: string): CtaLogicalAction {
  switch (action) {
    case "chilipiper":
      return "chilipiper";
    case "modal-form":
      return "open-form";
    case "modal-chilipiper":
      return "chilipiper";
    case "video-modal":
      return "video-modal";
    case "url":
    case undefined: {
      const u = (url ?? "").trim();
      if (u === "" ) return "url";
      if (u.startsWith("#")) return "anchor";
      if (u.toLowerCase().startsWith("mailto:")) return "email";
      if (isDownloadUrl(u)) return "download";
      return "url";
    }
    default:
      return "url";
  }
}

/** Reverse: a logical action → the renderer CtaActionMode it persists as. */
export function fromLogicalAction(logical: CtaLogicalAction): CtaActionMode | undefined {
  switch (logical) {
    case "open-form":
      return "modal-form";
    case "chilipiper":
      return "chilipiper";
    case "video-modal":
      return "video-modal";
    case "none":
      return undefined;
    // url / anchor / download / email all persist as the renderer's "url" mode;
    // the distinction lives in the `url` string the editor writes.
    default:
      return "url";
  }
}

const DOWNLOAD_EXT = /\.(pdf|zip|csv|xlsx?|docx?|pptx?|dmg|pkg|mp4|mov|png|jpe?g|svg)(\?|#|$)/i;
function isDownloadUrl(u: string): boolean {
  return DOWNLOAD_EXT.test(u);
}

/* ──────────────────────────── the legacy shim ────────────────────────────── */

/**
 * legacyBlockPropsToCtaConfig — normalize ANY CTA-bearing block's props into a
 * `CtaConfig`. Reads only keys the block declares (presence-based, like
 * cta-propagation), so blocks without a given field don't gain it.
 *
 * `blockType` is accepted for signature stability / future per-type rules but
 * the prop shape is the source of truth (shapes are per-type, and the renderer
 * is structurally typed over them).
 */
export function legacyBlockPropsToCtaConfig(_blockType: string, props: unknown): CtaConfig {
  const p = (props && typeof props === "object" ? props : {}) as Props;
  const cfg: CtaConfig = {};

  const label = readFirst(p, CTA_LABEL_KEYS);
  if (label) cfg.label = label.value as string | undefined;

  const action = readFirst(p, CTA_ACTION_KEYS);
  if (action) cfg.action = action.value as CtaActionMode | undefined;

  const url = readFirst(p, CTA_URL_KEYS);
  if (url) cfg.url = url.value as string | undefined;

  const chili = readFirst(p, CTA_CHILIPIPER_KEYS);
  if (chili) cfg.chilipiper = chili.value as string | undefined;

  const vid = readFirst(p, CTA_VIDEO_URL_KEYS);
  if (vid) cfg.videoUrl = vid.value as string | undefined;

  const poster = readFirst(p, CTA_VIDEO_POSTER_KEYS);
  if (poster) cfg.videoPosterUrl = poster.value as string | undefined;

  if (has(p, "ctaButtonColor")) cfg.buttonColor = p.ctaButtonColor as string | undefined;
  if (has(p, "ctaButtonTextColor")) cfg.buttonTextColor = p.ctaButtonTextColor as string | undefined;

  // Secondary CTA — only build the object if the block declares any of its keys
  // (alias-aware, same readFirst rule as the primary fields).
  const sec: NonNullable<CtaConfig["secondary"]> = {};
  let hasSecondary = false;
  const sLabel = readFirst(p, CTA_SECONDARY_LABEL_KEYS);
  if (sLabel) { sec.label = sLabel.value as string | undefined; hasSecondary = true; }
  const sAction = readFirst(p, CTA_SECONDARY_ACTION_KEYS);
  if (sAction) { sec.action = sAction.value as CtaActionMode | undefined; hasSecondary = true; }
  const sUrl = readFirst(p, CTA_SECONDARY_URL_KEYS);
  if (sUrl) { sec.url = sUrl.value as string | undefined; hasSecondary = true; }
  const sChili = readFirst(p, CTA_SECONDARY_CHILIPIPER_KEYS);
  if (sChili) { sec.chilipiper = sChili.value as string | undefined; hasSecondary = true; }
  const sVideo = readFirst(p, CTA_SECONDARY_VIDEO_KEYS);
  if (sVideo) { sec.videoUrl = sVideo.value as string | undefined; hasSecondary = true; }
  if (hasSecondary) cfg.secondary = sec;

  // Inline email-capture variant.
  for (const k of CTA_EMAIL_CAPTURE_KEYS) {
    if (has(p, k)) (cfg as Props)[k] = p[k];
  }

  // Modal config — round-tripped losslessly. Only declared keys.
  for (const k of CTA_MODAL_KEYS) {
    if (has(p, k)) (cfg as Props)[k] = p[k];
  }

  return cfg;
}

/**
 * ctaConfigToBlockProps — write a CtaConfig back onto block props using the
 * naming the TARGET block expects. Like applyCtaConfig in cta-propagation, only
 * keys the target ALREADY declares are written (no pollution). The label is
 * written to whichever alias the target uses; action likewise.
 *
 * Returns a NEW props object; the input is never mutated.
 */
export function ctaConfigToBlockProps(_blockType: string, cfg: CtaConfig, targetProps: unknown): Props {
  const base = (targetProps && typeof targetProps === "object" ? targetProps : {}) as Props;
  const next: Props = { ...base };

  // Label → the target's alias.
  if (cfg.label !== undefined) {
    const target = readFirst(base, CTA_LABEL_KEYS);
    if (target) next[target.key] = cfg.label;
  }
  // Action → the target's alias.
  if (cfg.action !== undefined) {
    const target = readFirst(base, CTA_ACTION_KEYS);
    if (target) next[target.key] = cfg.action;
  }
  // Destinations → the target's alias (same presence rule as label/action; the
  // hardcoded `ctaUrl`-only check was why the ctaPrimaryUrl/heroPrimaryCtaUrl
  // families never received the Page CTA's destination).
  if (cfg.url !== undefined) {
    const target = readFirst(base, CTA_URL_KEYS);
    if (target) next[target.key] = cfg.url;
  }
  if (cfg.chilipiper !== undefined) {
    const target = readFirst(base, CTA_CHILIPIPER_KEYS);
    if (target) next[target.key] = cfg.chilipiper;
  }
  if (cfg.videoUrl !== undefined) {
    const target = readFirst(base, CTA_VIDEO_URL_KEYS);
    if (target) next[target.key] = cfg.videoUrl;
  }
  if (cfg.videoPosterUrl !== undefined && has(base, "videoPosterUrl")) next.videoPosterUrl = cfg.videoPosterUrl;

  if (cfg.buttonColor !== undefined && has(base, "ctaButtonColor")) next.ctaButtonColor = cfg.buttonColor;
  if (cfg.buttonTextColor !== undefined && has(base, "ctaButtonTextColor")) next.ctaButtonTextColor = cfg.buttonTextColor;

  if (cfg.secondary) {
    const s = cfg.secondary;
    const w = (value: unknown, keys: readonly string[]): void => {
      if (value === undefined) return;
      const target = readFirst(base, keys);
      if (target) next[target.key] = value;
    };
    w(s.label, CTA_SECONDARY_LABEL_KEYS);
    w(s.action, CTA_SECONDARY_ACTION_KEYS);
    w(s.url, CTA_SECONDARY_URL_KEYS);
    w(s.chilipiper, CTA_SECONDARY_CHILIPIPER_KEYS);
    w(s.videoUrl, CTA_SECONDARY_VIDEO_KEYS);
  }

  for (const k of CTA_EMAIL_CAPTURE_KEYS) {
    if ((cfg as Props)[k] !== undefined && has(base, k)) next[k] = (cfg as Props)[k];
  }
  for (const k of CTA_MODAL_KEYS) {
    if ((cfg as Props)[k] !== undefined && has(base, k)) next[k] = (cfg as Props)[k];
  }

  return next;
}

/**
 * The full set of PRIMARY CTA prop keys the shim ever reads or writes. Excludes
 * every `ctaSecondary*` / `secondary*` key on purpose — secondary buttons are
 * always left to the block. Used to apply / restore the page CTA on a block's
 * primary button without disturbing anything else.
 */
export const PRIMARY_CTA_KEYS: readonly string[] = [
  ...CTA_LABEL_KEYS,
  ...CTA_ACTION_KEYS,
  ...CTA_URL_KEYS,
  ...CTA_CHILIPIPER_KEYS,
  ...CTA_VIDEO_URL_KEYS,
  ...CTA_VIDEO_POSTER_KEYS,
  ...CTA_STYLE_KEYS,
  ...CTA_EMAIL_CAPTURE_KEYS,
  ...CTA_MODAL_KEYS,
];

/**
 * True when `props` declares any PRIMARY CTA key — i.e. the block can render a
 * primary button that the Page CTA could drive. Drives the builder's "Use a
 * custom button here" switch visibility and the render-time follow decision.
 */
export function blockHasPrimaryCta(props: unknown): boolean {
  const p = (props && typeof props === "object" ? props : {}) as Props;
  return (
    readFirst(p, CTA_LABEL_KEYS) !== undefined ||
    readFirst(p, CTA_URL_KEYS) !== undefined ||
    readFirst(p, CTA_ACTION_KEYS) !== undefined ||
    has(p, "chilipiperUrl")
  );
}

/**
 * Overwrite a block's PRIMARY CTA props with the page CTA, leaving every
 * secondary key (and all non-CTA props) untouched. Returns a NEW props object;
 * the input is never mutated. The page CTA's own `secondary` (if any) is
 * stripped before writing so the block's secondary button is never disturbed.
 *
 * Render-only: callers must NOT persist the result back onto the block (use
 * {@link restorePrimaryCtaProps} to strip it from any edit that does flow back).
 */
export function applyPageCtaToBlockProps(
  blockType: string,
  props: unknown,
  pageCta: CtaConfig | null | undefined,
): Props {
  const base = (props && typeof props === "object" ? props : {}) as Props;
  if (!ctaConfigHasValue(pageCta)) return base;
  const primaryOnly: CtaConfig = { ...(pageCta as CtaConfig), secondary: undefined };
  return ctaConfigToBlockProps(blockType, primaryOnly, base);
}

/**
 * Restore the PRIMARY CTA portion of `updated` from `original`, so a render-time
 * page-CTA injection never gets baked into a block's saved props. Secondary keys
 * and every non-CTA edit in `updated` are preserved verbatim. Returns a NEW
 * props object.
 */
export function restorePrimaryCtaProps(updated: unknown, original: unknown): Props {
  const next = { ...((updated && typeof updated === "object" ? updated : {}) as Props) };
  const orig = (original && typeof original === "object" ? original : {}) as Props;
  for (const k of PRIMARY_CTA_KEYS) {
    if (has(orig, k)) next[k] = orig[k];
    else delete next[k];
  }
  return next;
}

/* ──────────────────────────── the resolver ───────────────────────────────── */

/** True when a CtaConfig actually supplies a CTA (a label or a non-default
 *  action / destination). Empty configs inherit from the layer below. */
export function ctaConfigHasValue(cfg: CtaConfig | undefined | null): boolean {
  if (!cfg) return false;
  if (typeof cfg.label === "string" && cfg.label.trim() !== "") return true;
  if (cfg.action !== undefined && cfg.action !== "url") return true;
  if (typeof cfg.url === "string" && cfg.url.trim() !== "" && cfg.url !== "#") return true;
  if (typeof cfg.chilipiper === "string" && cfg.chilipiper.trim() !== "") return true;
  return false;
}

const MODAL_AND_VARIANT_KEYS: readonly string[] = [
  ...CTA_MODAL_KEYS,
  ...CTA_EMAIL_CAPTURE_KEYS,
];

/**
 * resolveCtaConfig — merge the hierarchy **tenant < page < block** into one
 * effective CtaConfig. The label/action/destination come from the highest layer
 * that supplies a value ({@link ctaConfigHasValue}); modal + email-capture
 * fields are merged PER-FIELD (a higher layer's field wins only when present),
 * so a page can set its own form copy while inheriting the tenant's Marketo IDs.
 *
 * `source` is set to the layer that supplied the label/action. Pure.
 */
export function resolveCtaConfig(layers: {
  tenantDefault?: CtaConfig | null;
  pageOverride?: CtaConfig | null;
  blockOverride?: CtaConfig | null;
}): CtaConfig {
  const tenant = layers.tenantDefault ?? undefined;
  const page = layers.pageOverride ?? undefined;
  const block = layers.blockOverride ?? undefined;

  // Determine which layer supplies the primary label/action/destination.
  let primary: CtaConfig | undefined;
  let source: CtaSource = "none";
  if (ctaConfigHasValue(block)) { primary = block; source = "block"; }
  else if (ctaConfigHasValue(page)) { primary = page; source = "page"; }
  else if (ctaConfigHasValue(tenant)) { primary = tenant; source = "tenant"; }
  else { primary = block ?? page ?? tenant ?? {}; source = "none"; }

  const out: CtaConfig = {
    label: primary?.label,
    action: primary?.action,
    url: primary?.url,
    chilipiper: primary?.chilipiper,
    videoUrl: primary?.videoUrl,
    videoPosterUrl: primary?.videoPosterUrl,
    buttonColor: primary?.buttonColor,
    buttonTextColor: primary?.buttonTextColor,
    secondary: primary?.secondary,
    source,
  };

  // Per-field merge of modal + email-capture config: block > page > tenant.
  const ordered = [tenant, page, block];
  for (const k of MODAL_AND_VARIANT_KEYS) {
    for (const layer of ordered) {
      if (layer && (layer as Props)[k] !== undefined) (out as Props)[k] = (layer as Props)[k];
    }
  }

  return out;
}

/* ───────────────────────── tenant default at runtime ─────────────────────── */

/**
 * brandDefaultCtaConfig — surface the tenant's Brand-Settings default CTA as a
 * `CtaConfig` so it can be the BASE layer of {@link resolveCtaConfig} at render
 * time (not just at generation time). Reads the existing brand fields
 * (defaultCtaText / defaultCtaUrl / chilipiperUrl / ctaBackground / ctaText)
 * with NO new brand fields. Returns an empty config (no value) when the brand
 * has no usable default, so it never forces a CTA onto a page that has none.
 */
export function brandDefaultCtaConfig(brand: Pick<
  BrandConfig,
  "defaultCtaText" | "defaultCtaUrl" | "chilipiperUrl" | "ctaBackground" | "ctaText"
> | null | undefined): CtaConfig {
  if (!brand) return { source: "tenant" };
  const cfg: CtaConfig = { source: "tenant" };
  const label = (brand.defaultCtaText ?? "").trim();
  const url = (brand.defaultCtaUrl ?? "").trim();
  if (label) cfg.label = label;
  if (url && url !== "#") {
    cfg.url = url;
    cfg.action = "url";
  }
  // The tenant chilipiperUrl is a sensible default destination but we leave the
  // action as "url" unless a URL is set — the tenant default is a link by
  // default; per-page/block can switch to a chilipiper action and reuse this.
  if (brand.chilipiperUrl && brand.chilipiperUrl.trim()) {
    cfg.chilipiper = brand.chilipiperUrl.trim();
  }
  // Surface the tenant's default button colors as the style base. Blocks/pages
  // override per-CTA via buttonColor/buttonTextColor.
  if (brand.ctaBackground) cfg.buttonColor = brand.ctaBackground;
  if (brand.ctaText) cfg.buttonTextColor = brand.ctaText;
  return cfg;
}
