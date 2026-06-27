/**
 * Recipe block VOCABULARY — the set of block types each prompt path's AI can
 * actually build, surfaced to the superadmin recipe builder (June 2026).
 *
 * SINGLE SOURCE OF TRUTH: the assembled system prompts. Every block the model
 * may emit is advertised in its path's system prompt as a `- "type": …` schema
 * bullet, so we parse those bullets to derive:
 *   • the friendly MENU the builder UI offers (availableBlocksForPath), and
 *   • the validation allow-set the save routes enforce (validateSkeleton).
 * This is the exact same advertised-vocabulary view the recipe ↔ prompt drift
 * test uses, so a recipe can never name a block the path's AI can't build.
 *
 * The GENERAL prompt is parsed in its DEFAULT form (no keyword-gated full-page
 * blocks like content-series/storefront — those are self-contained whole pages,
 * not multi-section recipe slots). The DSO prompts are parsed in their NARROWEST
 * (non-Dandy) form so a recipe never offers a Dandy-only block to every tenant.
 */
import {
  buildGeneralSystemPrompt,
  buildDsoSystemPrompt,
  buildDsoPracticesSystemPrompt,
} from "../../routes/lp/generate-page";
import { skeletonBlockTypes, type RecipePromptPath } from "./page-recipes";

export interface AvailableBlock {
  type: string;
  label: string;
  description: string;
}

/** A block schema bullet: `- "type": Description sentence. …` */
const BLOCK_BULLET_RE = /^- "([a-z0-9-]+)":\s*(.*)$/;

/** Title-case a block type for a non-technical label ("kinetic-type-hero" →
 *  "Kinetic Type Hero"), upper-casing a few well-known acronyms. */
const ACRONYMS = new Set(["cta", "dso", "faq", "roi", "ai", "ui", "ux", "seo"]);
export function friendlyBlockLabel(type: string): string {
  return type
    .split("-")
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** First sentence of a bullet's description, capped for the menu. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const m = trimmed.match(/^(.*?[.!?])(\s|$)/);
  const sentence = (m ? m[1] : trimmed).trim();
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}

function systemPromptForPath(path: RecipePromptPath): string {
  switch (path) {
    case "dso":
      return buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" });
    case "dso-practices":
      return buildDsoPracticesSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" });
    default:
      return buildGeneralSystemPrompt();
  }
}

// The advertised vocabulary is derived from code-constant prompts, so it never
// changes at runtime — memoize the parse per path.
const cache = new Map<RecipePromptPath, AvailableBlock[]>();

/** The friendly, de-duplicated, alphabetically-sorted block menu for a path. */
export function availableBlocksForPath(path: RecipePromptPath): AvailableBlock[] {
  const cached = cache.get(path);
  if (cached) return cached;
  const byType = new Map<string, AvailableBlock>();
  for (const line of systemPromptForPath(path).split("\n")) {
    const m = line.match(BLOCK_BULLET_RE);
    if (!m) continue;
    const type = m[1];
    if (byType.has(type)) continue;
    byType.set(type, {
      type,
      label: friendlyBlockLabel(type),
      description: firstSentence(m[2] ?? ""),
    });
  }
  const list = [...byType.values()].sort((a, b) => a.label.localeCompare(b.label));
  cache.set(path, list);
  return list;
}

/** The set of block types a path's AI can build (the validation allow-set). */
export function advertisedBlockTypesForPath(path: RecipePromptPath): Set<string> {
  return new Set(availableBlocksForPath(path).map((b) => b.type));
}

export const MAX_SKELETON_SLOTS = 24;
const MAX_SLOT_LENGTH = 200;

export type SkeletonValidation =
  | { ok: true; skeleton: string[] }
  | { ok: false; error: string };

/**
 * Validate (and normalize) a recipe skeleton against a path's advertised
 * vocabulary. Each slot is trimmed; a slot may offer alternatives via " OR ".
 * Every referenced block type must be advertised by the path's AI, or the save
 * is rejected. Permissive on ordering / roles (no hero-required rule) — the
 * recipe is a soft suggestion the model adapts. Returns the cleaned skeleton.
 */
export function validateSkeleton(path: RecipePromptPath, input: unknown): SkeletonValidation {
  if (!Array.isArray(input)) return { ok: false, error: "Section list must be an array." };
  const slots: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return { ok: false, error: "Each section must be text." };
    const slot = raw.trim().replace(/\s+/g, " ");
    if (!slot) continue;
    if (slot.length > MAX_SLOT_LENGTH) {
      return { ok: false, error: `A section entry is too long (max ${MAX_SLOT_LENGTH} characters).` };
    }
    slots.push(slot);
  }
  if (slots.length === 0) return { ok: false, error: "Add at least one section." };
  if (slots.length > MAX_SKELETON_SLOTS) {
    return { ok: false, error: `Too many sections (max ${MAX_SKELETON_SLOTS}).` };
  }
  const vocab = advertisedBlockTypesForPath(path);
  const unknown = new Set<string>();
  for (const type of skeletonBlockTypes(slots)) {
    if (!vocab.has(type)) unknown.add(type);
  }
  if (unknown.size > 0) {
    return {
      ok: false,
      error: `These block types aren't available for this recipe type: ${[...unknown].join(", ")}.`,
    };
  }
  return { ok: true, skeleton: slots };
}
