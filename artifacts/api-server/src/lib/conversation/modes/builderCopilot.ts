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
 * allowedActions (CONSTRAINED v1 set — the spec's fixed menu): insert_block,
 * rewrite_copy, replace_image, remove_block, reorder_block, fix_contrast.
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

/** Runtime context for the copilot mode. */
export interface BuilderCopilotContext extends ConversationContext {
  brand: BrandConfig;
  pageTitle: string;
  pageBlocks: CopilotPageBlock[];
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

/** Build the compact page summary: numbered block sequence with type + key
 *  copy + id (the id is what the action args reference). PURE + exported for
 *  unit tests. */
export function buildPageSummary(title: string, blocks: CopilotPageBlock[]): string {
  const header = title ? `Page title: "${title}"` : "Untitled page";
  if (blocks.length === 0) {
    return `${header}\nThe page is empty — no blocks yet.`;
  }
  const lines = blocks.map((b, i) => {
    const copy = firstCopy(b.props);
    const copyPart = copy ? ` — "${copy}"` : "";
    return `${i + 1}. [${b.type}] (id: ${b.id})${copyPart}`;
  });
  return `${header}\nCurrent block sequence (top to bottom):\n${lines.join("\n")}`;
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
    description: "Propose replacing an image slot on a block with one that better fits a stated purpose.",
    properties: {
      blockId: { type: "string", description: "The id of the block whose image to replace." },
      slot: {
        type: "string",
        description: "Which image slot (e.g. 'heroImage', 'backgroundImage', 'image').",
      },
      purpose: {
        type: "string",
        description: "What the replacement image should depict / convey.",
      },
    },
    required: ["blockId", "slot", "purpose"],
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
  "the actual blocks on their page by what they say. Prefer proposing one or two " +
  "high-impact edits over listing everything at once.";

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
      buildRecipeHeuristics(),
    ];
    return sections.join("\n\n");
  },
  allowedActions: BUILDER_COPILOT_ACTIONS,
};
