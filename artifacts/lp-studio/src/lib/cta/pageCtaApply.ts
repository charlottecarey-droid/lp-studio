/**
 * pageCtaApply — the render-time Page CTA transform, made block-TYPE aware
 * (July 2026 coverage fix, phase 2) and CAPABILITY aware (phase 3).
 *
 * ctaConfig's shim is presence-based: it writes only keys the props INSTANCE
 * already declares. That's the right no-pollution rule for arbitrary props,
 * but it under-covers real pages: an AI-generated block often omits optional
 * CTA keys its block type fully supports (e.g. a hero that shipped with
 * `ctaUrl` but no `ctaText`), so the Page CTA's label had nowhere to land and
 * the block silently kept its own button.
 *
 * This wrapper consults the block type's registry `defaultProps()` — the
 * closest thing to a per-type schema — and lets the shim also target primary
 * CTA keys the TYPE declares even when this instance dropped them. Gating is
 * still instance-based on purpose: a block that renders no CTA at all (no
 * primary CTA key on its props) never sprouts a button from the Page CTA;
 * per-block buttons remain an explicit editor action. Unknown types (custom
 * schema blocks, retired types) degrade to the pure presence-based behavior.
 *
 * CAPABILITY RULES (July 2026 field bug): a chilipiper Page CTA wrote its
 * scheduler URL only to `chilipiperUrl`-style keys — but the dso block family
 * declares none; their renderers take the scheduler URL in `ctaUrl`
 * (ChiliPiperButton url={ctaUrl}) — so every followed button kept an EMPTY
 * destination and clicked into nothing. Two rules fix the class:
 *   1. Fallback: a chilipiper Page CTA applied to a block with a url key but
 *      no chilipiper-capable key writes the scheduler URL into the url key
 *      (and forces the action key to "chilipiper" so modal-chilipiper
 *      degrades to the modal the renderer actually implements).
 *   2. Gate: a Page CTA action the block CANNOT render (modal-form without
 *      modal keys, video-modal without a video key, url without a url key)
 *      is not applied at all — the block keeps its own working button.
 *      A broken injected button is strictly worse than no injection.
 *
 * ctaConfig.ts stays a leaf module (no registry import) — the registry pulls
 * in every block thumbnail, which panels/tests that only need the shim
 * shouldn't pay for.
 */
import { getBlockDef } from "@/lib/block-types";
import {
  applyPageCtaToBlockProps,
  PRIMARY_CTA_KEYS,
  CTA_ACTION_KEYS,
  CTA_URL_KEYS,
  CTA_CHILIPIPER_KEYS,
  CTA_VIDEO_URL_KEYS,
  type CtaConfig,
} from "./ctaConfig";

type Props = Record<string, unknown>;

function has(props: Props, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

/** Primary CTA keys a block TYPE declares in its registry defaultProps().
 *  Cached per type — defaultProps factories are cheap but this runs per block
 *  per render. Empty for unknown types. */
const typeKeysCache = new Map<string, readonly string[]>();
export function primaryCtaKeysForType(blockType: string): readonly string[] {
  const cached = typeKeysCache.get(blockType);
  if (cached) return cached;
  let keys: readonly string[] = [];
  try {
    const defaults = getBlockDef(blockType as never)?.defaultProps();
    if (defaults && typeof defaults === "object") {
      keys = PRIMARY_CTA_KEYS.filter((k) => has(defaults as Props, k));
    }
  } catch {
    /* a throwing defaultProps factory must never break rendering */
  }
  typeKeysCache.set(blockType, keys);
  return keys;
}

/** Modal-chilipiper capable keys (subset of CTA_MODAL_KEYS the renderers key
 *  off). Kept local — only the capability check needs them. */
const MODAL_CHILIPIPER_KEYS: readonly string[] = ["modalChilipiperUrl", "modalChiliPiperHandoffUrl"];
/** Modal-form capable keys. */
const MODAL_FORM_KEYS: readonly string[] = ["modalFormId", "modalFormSource"];

/**
 * Apply the Page CTA to a block's props, targeting both instance-declared AND
 * type-declared primary CTA keys, with the capability gate + chilipiper-in-url
 * fallback described in the header. Returns a NEW props object (or `base`
 * itself when gated). Render-only — exactly like applyPageCtaToBlockProps,
 * callers must restore via restorePrimaryCtaProps before persisting (restore
 * already strips every PRIMARY_CTA_KEYS member, including any key this
 * augmentation introduced).
 */
export function applyPageCtaToBlock(
  blockType: string,
  props: unknown,
  pageCta: CtaConfig | null | undefined,
): Props {
  const base = (props && typeof props === "object" ? props : {}) as Props;
  const typeKeys = primaryCtaKeysForType(blockType);
  const declared = (k: string): boolean => has(base, k) || typeKeys.includes(k);
  const anyDeclared = (keys: readonly string[]): boolean => keys.some(declared);

  // Capability gate — never inject an action this block can't render.
  const action = pageCta?.action ?? "url";
  const chilipiperCapable =
    anyDeclared(CTA_CHILIPIPER_KEYS) || anyDeclared(MODAL_CHILIPIPER_KEYS);
  // The email→scheduler modal flavor stores its scheduler URL in
  // `modalChilipiperUrl` (a CTA_MODAL_KEYS field carried verbatim on the
  // config), NOT in `chilipiper` — reading only cfg.chilipiper is exactly the
  // field bug that made every modal-chilipiper Page CTA a dead button.
  const modalChiliUrl =
    typeof (pageCta as Props | null | undefined)?.["modalChilipiperUrl"] === "string"
      ? ((pageCta as Props)["modalChilipiperUrl"] as string).trim()
      : "";
  const schedulerUrl = (pageCta?.chilipiper ?? "").trim() || modalChiliUrl;
  const modalChiliCapable = anyDeclared(MODAL_CHILIPIPER_KEYS);
  if (action === "modal-form" && !anyDeclared(MODAL_FORM_KEYS)) return base;
  if (action === "video-modal" && !anyDeclared(CTA_VIDEO_URL_KEYS)) return base;
  // modal-chilipiper on a block without modal keys degrades to the plain
  // scheduler popup (below) — but only when there IS a scheduler URL to
  // degrade to; otherwise the block keeps its own working button.
  if (action === "modal-chilipiper" && !modalChiliCapable && schedulerUrl === "") return base;
  if (
    (action === "chilipiper" || action === "modal-chilipiper") &&
    !chilipiperCapable &&
    !anyDeclared(CTA_URL_KEYS)
  ) {
    return base;
  }
  if (action === "url" && !anyDeclared(CTA_URL_KEYS)) return base;

  let written: Props;
  if (typeKeys.length === 0) {
    written = applyPageCtaToBlockProps(blockType, base, pageCta);
  } else {
    // Placeholders make type-declared keys visible to the shim's presence
    // rule; instance values win where both exist.
    const augmented: Props = {};
    for (const k of typeKeys) augmented[k] = undefined;
    Object.assign(augmented, base);

    written = applyPageCtaToBlockProps(blockType, augmented, pageCta);
    // Drop placeholders nothing was written to, so the result carries no keys
    // the instance didn't have and the Page CTA didn't set.
    for (const k of typeKeys) {
      if (written[k] === undefined && !has(base, k)) delete written[k];
    }
  }

  // Chilipiper-in-url fallback: the shim wrote the scheduler URL to a
  // chilipiper key this block doesn't have (and the empty cfg.url into its
  // url key). Route the scheduler URL into the declared url key(s) and force
  // the action to plain "chilipiper" so ChiliPiperButton-style renderers
  // (which read ctaMode + ctaUrl) open the scheduler.
  const chili = (pageCta?.chilipiper ?? "").trim();
  if (action === "chilipiper" && chili !== "" && !chilipiperCapable) {
    for (const k of CTA_URL_KEYS) {
      if (declared(k)) written[k] = chili;
    }
    for (const k of CTA_ACTION_KEYS) {
      if (declared(k)) written[k] = "chilipiper";
    }
  }

  // Modal-chilipiper degrade: the email→scheduler modal needs modal keys the
  // block's renderer forwards to CtaButton. A block without them used to get
  // ctaAction "modal-chilipiper" and no modal URL — a dead button (the old
  // fallback above also only read cfg.chilipiper, which the modal flavor
  // leaves empty). Degrade to the plain scheduler popup those renderers DO
  // implement: dedicated chilipiper key when declared, else the url key. The
  // email-capture step is lost on these blocks, but Chili Piper collects the
  // email itself — a working popup beats a broken modal.
  if (action === "modal-chilipiper" && !modalChiliCapable && schedulerUrl !== "") {
    let wroteDedicated = false;
    for (const k of CTA_CHILIPIPER_KEYS) {
      if (declared(k)) {
        written[k] = schedulerUrl;
        wroteDedicated = true;
      }
    }
    if (!wroteDedicated) {
      for (const k of CTA_URL_KEYS) {
        if (declared(k)) written[k] = schedulerUrl;
      }
    }
    for (const k of CTA_ACTION_KEYS) {
      if (declared(k)) written[k] = "chilipiper";
    }
  }

  return written;
}
