/**
 * Builder Copilot mode (June 2026 chatbot spec — Bot 1, the v1 surface).
 *
 * Persona: an expert landing-page design assistant embedded in the builder. It
 * reads the page the user is editing and the tenant's brand settings, and
 * proposes concrete, executable edits ("there's no social proof above the fold
 * — add a testimonial wall?"). It PROPOSES; the user confirms; nothing auto-
 * applies (the spec's hard v1 guardrail).
 *
 * Grounding (the only facts the bot may rely on):
 *   1. a compact summary of the current page's block sequence + each block's
 *      key copy (built from the blocks the route passes in),
 *   2. the tenant brand config, via the SAME strict-facts-aware
 *      buildBrandSystemPrompt the copy-generate endpoint uses (approved stats /
 *      quotes only — so the copilot can't assert an unapproved number),
 *   3. a compact block catalog (families + one-line purpose),
 *   4. the page-recipe / quality heuristics the server normalizers already
 *      enforce, so the bot's advice matches what the system does.
 *
 * allowedActions (v2 menu — still a fixed, validated set): insert_block,
 * rewrite_copy, replace_image (with optional one-click library imageUrl),
 * remove_block, reorder_block, fix_contrast, update_props (generic prop edit).
 * v2 also grounds the tenant's own media library (starters excluded) so image
 * proposals reference real URLs, and the page summary lists each block's
 * editable field names + image-slot state so proposals target real props.
 */
import {
  buildBrandSystemPrompt,
  type BrandConfig,
} from "../../ai-prompts/brand-and-brief";
import type { AllowedActionDef } from "../actions";
import type { ConversationContext, ConversationMode } from "../engine";

/** Minimal block shape the copilot needs from the page. The builder posts the
 *  page's blocks; we read only id/type + a few well-known copy fields so the
 *  summary stays compact regardless of block variant. */
export interface CopilotPageBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
}

/** One image from the tenant's media library, surfaced to the model so
 *  replace_image proposals can carry a REAL library URL instead of punting to
 *  a manual picker. */
export interface CopilotMediaImage {
  url: string;
  title: string;
  tags: string[];
}

/** Runtime context for the copilot mode. */
export interface BuilderCopilotContext extends ConversationContext {
  brand: BrandConfig;
  pageTitle: string;
  pageBlocks: CopilotPageBlock[];
  /** Tenant-owned library images (starters excluded — stock never gets
   *  recommended over a designed empty slot). Optional: the route may skip the
   *  fetch on failure and the mode degrades to picker-only replace_image. */
  mediaLibrary?: CopilotMediaImage[];
}

/** Well-known copy fields, in priority order, used to surface a one-line
 *  preview of each block's content in the page summary. */
const COPY_FIELD_KEYS = [
  "headline",
  "title",
  "heading",
  "eyebrow",
  "subheadline",
  "subhead",
  "subtitle",
  "body",
  "description",
  "text",
  "ctaText",
  "primaryCtaText",
  "ctaLabel",
];

function firstCopy(props: Record<string, unknown> | undefined): string {
  if (!props) return "";
  for (const key of COPY_FIELD_KEYS) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim().replace(/\s+/g, " ");
      return t.length > 80 ? `${t.slice(0, 77)}…` : t;
    }
  }
  return "";
}

const MAX_DETAIL_FIELDS = 6;

function truncate(value: string, max: number): string {
  const t = value.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function looksLikeUrl(v: string): boolean {
  return /^(https?:)?\//.test(v.trim()) || v.trim().startsWith("data:");
}

function isImageSlotKey(key: string): boolean {
  return /image|photo|logo|avatar|background|thumbnail/i.test(key);
}

/** Per-block detail lines: the editable copy fields (name: "value") and image
 *  slots (with set/empty state) — so rewrite_copy / update_props /
 *  replace_image proposals can reference REAL prop names instead of guessing.
 *  Kept compact: at most MAX_DETAIL_FIELDS copy fields, values truncated. */
function blockDetailLines(props: Record<string, unknown> | undefined): string[] {
  if (!props) return [];
  const copyParts: string[] = [];
  const imageParts: string[] = [];
  for (const [key, v] of Object.entries(props)) {
    if (typeof v !== "string") continue;
    if (isImageSlotKey(key)) {
      imageParts.push(`${key}=${v.trim() ? "(set)" : "(empty)"}`);
      continue;
    }
    if (!v.trim() || looksLikeUrl(v) || v.length > 400) continue;
    if (copyParts.length < MAX_DETAIL_FIELDS) {
      copyParts.push(`${key}: "${truncate(v, 70)}"`);
    }
  }
  const lines: string[] = [];
  if (copyParts.length > 0) lines.push(`   fields: ${copyParts.join(" | ")}`);
  if (imageParts.length > 0) lines.push(`   image slots: ${imageParts.join(", ")}`);
  return lines;
}

/** Build the compact page summary: numbered block sequence with type + key
 *  copy + id (the id is what the action args reference). PURE + exported for
 *  unit tests. */
export function buildPageSummary(title: string, blocks: CopilotPageBlock[]): string {
  const header = title ? `Page title: "${title}"` : "Untitled page";
  if (blocks.length === 0) {
    return `${header}\nThe page is empty — no blocks yet.`;
  }
  const lines = blocks.flatMap((b, i) => {
    const copy = firstCopy(b.props);
    const copyPart = copy ? ` — "${copy}"` : "";
    return [`${i + 1}. [${b.type}] (id: ${b.id})${copyPart}`, ...blockDetailLines(b.props)];
  });
  return `${header}\nCurrent block sequence (top to bottom):\n${lines.join("\n")}`;
}

/** The tenant's own library images, numbered, so replace_image proposals can
 *  carry an exact URL. Empty library → empty string (section omitted). PURE +
 *  exported for unit tests. */
export function buildImageLibrarySection(media: CopilotMediaImage[] | undefined): string {
  if (!media || media.length === 0) return "";
  const lines = media.slice(0, 40).map((m, i) => {
    const tags = m.tags.slice(0, 6).join(", ");
    const title = m.title ? ` — "${truncate(m.title, 60)}"` : "";
    return `${i + 1}. ${m.url}${title}${tags ? ` [${tags}]` : ""}`;
  });
  return [
    "IMAGE LIBRARY (the tenant's own uploaded images). When proposing replace_image, set `imageUrl` to a URL copied EXACTLY from this list — never invent or modify a URL. If nothing here fits the purpose, omit `imageUrl` and the user will pick manually.",
    ...lines,
  ].join("\n");
}

/** Compact block catalog: the families the copilot most often recommends, with
 *  a one-line purpose each. Deliberately curated (not the full ~180-type
 *  registry) so the prompt stays tight and the model proposes well-known,
 *  high-signal block types. */
const BLOCK_CATALOG: ReadonlyArray<{ type: string; purpose: string }> = [
  { type: "hero", purpose: "Top-of-page headline + subhead + primary CTA; the page's promise." },
  { type: "trust-bar", purpose: "Row of headline stats/metrics for instant credibility." },
  { type: "logo-wall", purpose: "Customer/partner logos as social proof." },
  { type: "testimonial-wall", purpose: "Grid of customer quotes — strong above-the-fold social proof." },
  { type: "single-quote", purpose: "One spotlighted customer testimonial." },
  { type: "benefits-grid", purpose: "Grid of value props / benefits with icons." },
  { type: "how-it-works", purpose: "Numbered step-by-step explanation of the process." },
  { type: "comparison", purpose: "Old-way vs new-way (or us vs them) side-by-side." },
  { type: "stat-callout", purpose: "A single big metric with supporting label." },
  { type: "product-grid", purpose: "Grid of products/offerings with images." },
  { type: "product-showcase", purpose: "Featured product with imagery and copy." },
  { type: "dso-faq", purpose: "Frequently-asked-questions accordion; answers objections." },
  { type: "case-study-card-grid", purpose: "Grid of customer success stories with results." },
  { type: "form", purpose: "Lead-capture form." },
  { type: "video-section", purpose: "Embedded video with supporting copy." },
  { type: "before-after-gallery", purpose: "Before/after image pairs showing transformation." },
  { type: "cta-button", purpose: "A standalone call-to-action button." },
  { type: "bottom-cta", purpose: "Closing call-to-action section." },
  { type: "footer", purpose: "Page footer with links." },
];

export function buildBlockCatalogSection(): string {
  const lines = BLOCK_CATALOG.map((b) => `- ${b.type}: ${b.purpose}`);
  return `Block catalog (the block types you may propose inserting):\n${lines.join("\n")}`;
}

/** The page-quality heuristics the server normalizers already enforce, encoded
 *  so the copilot's advice matches what the system does. Mirrors the recipe /
 *  normalizer rules (no two adjacent CTAs, social proof above the fold,
 *  complete grid rows, sufficient contrast, one clear closing CTA). */
export function buildRecipeHeuristics(): string {
  return [
    "Page-quality heuristics (the rules the builder's own normalizers enforce — your advice MUST agree with them):",
    "- The page should open with a hero, then establish credibility EARLY (social proof — a trust bar, logo wall, or testimonial wall — above the fold or just below the hero).",
    "- Never place two call-to-action sections back to back; put a content section (benefits, how-it-works, FAQ, social proof) between them.",
    "- Grid/row sections should have COMPLETE rows (e.g. don't leave a 3-up grid with a single orphan card).",
    "- Maintain readable contrast: a block's text color must contrast its background (flag low-contrast headers/CTAs).",
    "- A page needs exactly one clear closing CTA near the bottom; the same primary action should repeat, not compete with a different ask.",
    "- Match the brand voice (tone keywords / voice profile in the context) — flag copy that reads off-voice.",
    "- Answer objections (an FAQ or comparison) before the final CTA.",
  ].join("\n");
}

/** The constrained v1 action menu. Each maps 1:1 to an existing builder
 *  mutation (see the frontend CopilotPanel apply handlers). */
export const BUILDER_COPILOT_ACTIONS: AllowedActionDef[] = [
  {
    type: "insert_block",
    description:
      "Propose inserting a new block of a given type after an existing block. Use a block `type` from the catalog.",
    properties: {
      type: { type: "string", description: "The block type to insert (from the catalog)." },
      afterBlockId: {
        type: "string",
        description:
          "The id of the block this new block should appear AFTER. Use the empty string to insert at the very top.",
      },
      defaultPropsHint: {
        type: "string",
        description:
          "Optional plain-English hint about what the inserted block's copy should say (the user can then refine it).",
      },
    },
    required: ["type", "afterBlockId"],
  },
  {
    type: "rewrite_copy",
    description:
      "Propose rewriting one copy field of an existing block (e.g. its headline) following an instruction.",
    properties: {
      blockId: { type: "string", description: "The id of the block whose copy to rewrite." },
      field: {
        type: "string",
        description: "The copy field to rewrite (e.g. 'headline', 'subheadline', 'ctaText').",
      },
      instruction: {
        type: "string",
        description: "How to rewrite it (e.g. 'make it warmer and more specific to dentists').",
      },
    },
    required: ["blockId", "field", "instruction"],
  },
  {
    type: "replace_image",
    description:
      "Propose replacing an image slot on a block. When an IMAGE LIBRARY image fits, pass its exact URL as imageUrl so the swap applies in one click; otherwise omit imageUrl and the user picks manually.",
    properties: {
      blockId: { type: "string", description: "The id of the block whose image to replace." },
      slot: {
        type: "string",
        description:
          "Which image slot — use a prop name from the block's 'image slots' line in the page summary (e.g. 'heroImage', 'backgroundImage', 'image').",
      },
      purpose: {
        type: "string",
        description: "What the replacement image should depict / convey.",
      },
      imageUrl: {
        type: "string",
        description:
          "The replacement image URL, copied EXACTLY from the IMAGE LIBRARY list. Omit when no library image fits — never invent a URL.",
      },
    },
    required: ["blockId", "slot", "purpose"],
  },
  {
    type: "update_props",
    description:
      "Propose setting one or more properties on an existing block — for edits the other tools don't cover (button labels, list items, layout/alignment options, colors). Only set props whose names appear for that block in the page summary, or that are clearly standard for its type.",
    properties: {
      blockId: { type: "string", description: "The id of the block to update." },
      props: {
        type: "object",
        description:
          "Prop name → new value. Values keep the prop's existing shape (string props stay strings, etc.). Never set 'id', 'type', or 'children'.",
      },
    },
    required: ["blockId", "props"],
  },
  {
    type: "remove_block",
    description: "Propose removing a block from the page (e.g. a redundant second CTA).",
    properties: {
      blockId: { type: "string", description: "The id of the block to remove." },
    },
    required: ["blockId"],
  },
  {
    type: "reorder_block",
    description: "Propose moving a block to appear before another block (e.g. lift social proof above the fold).",
    properties: {
      blockId: { type: "string", description: "The id of the block to move." },
      beforeBlockId: {
        type: "string",
        description:
          "The id of the block it should appear BEFORE. Use the empty string to move it to the very bottom.",
      },
    },
    required: ["blockId", "beforeBlockId"],
  },
  {
    type: "fix_contrast",
    description:
      "Propose auto-fixing a low-contrast color issue on a block (the builder recomputes a readable text/background pairing).",
    properties: {
      blockId: { type: "string", description: "The id of the block with the contrast problem." },
    },
    required: ["blockId"],
  },
];

const PERSONA =
  "You are LP Studio's Builder Copilot — an expert landing-page designer and " +
  "conversion copywriter embedded directly in the page builder. You help the " +
  "user improve the page they're editing: spot structural gaps (missing social " +
  "proof, weak hero, back-to-back CTAs), voice mismatches, and contrast issues, " +
  "and propose concrete fixes. Be concise, friendly, and specific — reference " +
  "the actual blocks on their page by what they say. For a focused question, " +
  "prefer one or two high-impact edits. When the user asks for a REVIEW of the " +
  "whole page, walk it top to bottom and propose your top 3–5 edits in priority " +
  "order, each as its own action. Use rewrite_copy for single copy fields, " +
  "update_props for other block settings, and replace_image with a library URL " +
  "when one genuinely fits.";

/** The Builder Copilot ConversationMode. */
export const builderCopilotMode: ConversationMode = {
  id: "builder_copilot",
  goal:
    "Help the user improve the landing page they're editing by proposing concrete, " +
    "high-impact edits they can apply with one click.",
  systemPromptBuilder: () => PERSONA,
  groundingBuilder: (ctx: ConversationContext) => {
    const c = ctx as BuilderCopilotContext;
    const brandSection = buildBrandSystemPrompt(c.brand ?? {});
    const sections = [
      buildPageSummary(c.pageTitle ?? "", c.pageBlocks ?? []),
      brandSection ? `Brand settings:\n${brandSection}` : "Brand settings: (none configured)",
      buildBlockCatalogSection(),
      buildImageLibrarySection(c.mediaLibrary),
      buildRecipeHeuristics(),
    ];
    return sections.filter(Boolean).join("\n\n");
  },
  allowedActions: BUILDER_COPILOT_ACTIONS,
};
