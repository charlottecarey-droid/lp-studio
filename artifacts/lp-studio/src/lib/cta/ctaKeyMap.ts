/**
 * ctaKeyMap — boundary adapters that let a block whose CTA props use NON-canonical
 * names (e.g. `primaryCtaAction` / `secondaryCtaText`) reuse the shared
 * CtaActionConfigSection / CtaSecondaryConfigSection unchanged.
 *
 * The shared sections operate on the canonical CtaSuiteFields / CtaSecondaryFields
 * shape. Rather than thread a key-map through the components (which would risk the
 * ~33 panels already migrated), a panel maps at the boundary:
 *
 *   <CtaActionConfigSection
 *     value={readPrimarySuite(props, MAP)}
 *     onChange={(v) => onChange(writePrimarySuite(props, v, MAP) as BlockProps)}
 *     ... />
 *
 * Only the label/action/destination keys are remapped. Modal-config keys
 * (CtaModalConfig) are canonical on every block (they all `extends CtaModalConfig`),
 * so they pass through unchanged. This is editor-only: the block's stored prop
 * names and its renderer are untouched, so published pages can't change.
 *
 * IMPORTANT: only use a key-map for blocks whose action VALUES already match the
 * renderer mode set ("url" | "chilipiper" | "modal-form" | "modal-chilipiper" |
 * "video-modal"). Blocks using a different value vocabulary (e.g. `CtaMode` with
 * "link") need value translation + a renderer check and are out of scope here.
 */

import { pickCtaModalConfig, type CtaSuiteFields, type CtaSecondaryFields } from "@/lib/cta-modal";
import { CTA_MODAL_KEYS } from "@/lib/cta/ctaConfig";

type Props = Record<string, unknown>;

/** Which prop names a block uses for its PRIMARY CTA's action + destinations. */
export interface PrimaryKeyMap {
  action: string;
  url: string;
  chilipiper?: string;
  video?: string;
  videoPoster?: string;
}

/** Which prop names a block uses for its SECONDARY CTA. */
export interface SecondaryKeyMap {
  text: string;
  action: string;
  url: string;
  chilipiper?: string;
  video?: string;
}

export const CANONICAL_PRIMARY_KEYS: PrimaryKeyMap = {
  action: "ctaAction",
  url: "ctaUrl",
  chilipiper: "chilipiperUrl",
  video: "videoUrl",
  videoPoster: "videoPosterUrl",
};

export const CANONICAL_SECONDARY_KEYS: SecondaryKeyMap = {
  text: "ctaSecondaryText",
  action: "ctaSecondaryAction",
  url: "ctaSecondaryUrl",
  chilipiper: "secondaryChilipiperUrl",
  video: "secondaryVideoUrl",
};

/** Build the canonical CtaSuiteFields the shared primary section reads, from a
 *  block's own prop names. Modal config passes through (canonical on all blocks). */
export function readPrimarySuite(props: unknown, map: PrimaryKeyMap = CANONICAL_PRIMARY_KEYS): CtaSuiteFields {
  const p = (props && typeof props === "object" ? props : {}) as Props;
  return {
    ctaAction: p[map.action] as CtaSuiteFields["ctaAction"],
    ctaUrl: p[map.url] as string | undefined,
    chilipiperUrl: map.chilipiper ? (p[map.chilipiper] as string | undefined) : undefined,
    videoUrl: map.video ? (p[map.video] as string | undefined) : undefined,
    videoPosterUrl: map.videoPoster ? (p[map.videoPoster] as string | undefined) : undefined,
    ...pickCtaModalConfig(p as never),
  };
}

/** Apply a canonical CtaSuiteFields edit back onto the block's own prop names.
 *  Returns a NEW props object; the input is not mutated. */
export function writePrimarySuite<T extends object>(props: T, v: CtaSuiteFields, map: PrimaryKeyMap = CANONICAL_PRIMARY_KEYS): T {
  const next: Props = { ...(props as Props) };
  next[map.action] = v.ctaAction;
  next[map.url] = v.ctaUrl;
  if (map.chilipiper) next[map.chilipiper] = v.chilipiperUrl;
  if (map.video) next[map.video] = v.videoUrl;
  if (map.videoPoster) next[map.videoPoster] = v.videoPosterUrl;
  for (const k of CTA_MODAL_KEYS) next[k] = (v as Props)[k];
  return next as T;
}

/** Build the canonical CtaSecondaryFields the shared secondary section reads. */
export function readSecondary(props: unknown, map: SecondaryKeyMap = CANONICAL_SECONDARY_KEYS): CtaSecondaryFields {
  const p = (props && typeof props === "object" ? props : {}) as Props;
  return {
    ctaSecondaryText: p[map.text] as string | undefined,
    ctaSecondaryAction: p[map.action] as CtaSecondaryFields["ctaSecondaryAction"],
    ctaSecondaryUrl: p[map.url] as string | undefined,
    secondaryChilipiperUrl: map.chilipiper ? (p[map.chilipiper] as string | undefined) : undefined,
    secondaryVideoUrl: map.video ? (p[map.video] as string | undefined) : undefined,
  };
}

/** Apply a canonical CtaSecondaryFields edit back onto the block's own prop names. */
export function writeSecondary<T extends object>(props: T, v: CtaSecondaryFields, map: SecondaryKeyMap = CANONICAL_SECONDARY_KEYS): T {
  const next: Props = { ...(props as Props) };
  next[map.text] = v.ctaSecondaryText;
  next[map.action] = v.ctaSecondaryAction;
  next[map.url] = v.ctaSecondaryUrl;
  if (map.chilipiper) next[map.chilipiper] = v.secondaryChilipiperUrl;
  if (map.video) next[map.video] = v.secondaryVideoUrl;
  return next as T;
}
