/**
 * Lead-Capture mode (June 2026 chatbot spec — Bot 2, the published-page bot).
 *
 * The conversational face of the `chat-capture` block: a visitor-facing
 * assistant on a PUBLISHED landing page that answers questions strictly from
 * the page's own content + the tenant's approved brand facts, qualifies the
 * visitor, and — once it has an email — calls `capture_lead`, which the block
 * submits through the exact same POST /lp/leads pipeline the form blocks use
 * (so routing/notifications/integrations all apply unchanged).
 *
 * Public-surface guardrails (beyond the route's rate/turn caps):
 *   - grounding is ONLY the page content + strict-facts brand prompt — the
 *     engine's STRICT_FACTS_RULE forbids invented claims, and the persona adds
 *     a hard "say you don't know + offer the team" fallback so it never bluffs
 *     about pricing, guarantees, or availability.
 *   - capture_lead executes on call (this is the conversation's goal, and the
 *     visitor supplies the data themselves), so the mode overrides the
 *     engine's default review-and-apply action instruction.
 */
import {
  buildBrandSystemPrompt,
  type BrandConfig,
} from "../../ai-prompts/brand-and-brief";
import type { AllowedActionDef } from "../actions";
import type { ConversationContext, ConversationMode } from "../engine";
import type { CopilotPageBlock } from "./builderCopilot";

/** The chat-capture block's server-trusted config (a subset of the block's
 *  props, read from the PERSISTED page row — never from the client request). */
export interface ChatCaptureConfig {
  botName?: string;
  welcomeMessage?: string;
  collectName?: boolean;
  collectCompany?: boolean;
  collectPhone?: boolean;
  qualifyingQuestions?: string[];
}

export interface LeadCaptureContext extends ConversationContext {
  brand: BrandConfig;
  pageTitle: string;
  pageBlocks: CopilotPageBlock[];
  config: ChatCaptureConfig;
}

const MAX_PAGE_CONTENT_CHARS = 4000;

function looksLikeUrl(v: string): boolean {
  return /^(https?:)?\//.test(v.trim()) || v.trim().startsWith("data:");
}

/** Flatten the page's visible copy (including container children) into a
 *  compact text digest the bot may answer from. PURE + exported for tests. */
export function buildPageContentDigest(
  title: string,
  blocks: Array<CopilotPageBlock & { children?: unknown }>,
): string {
  const lines: string[] = [];
  const walk = (list: Array<CopilotPageBlock & { children?: unknown }>) => {
    for (const b of list) {
      const texts: string[] = [];
      const collect = (val: unknown): void => {
        if (typeof val === "string") {
          const t = val.trim().replace(/\s+/g, " ");
          if (t && t.length <= 500 && !looksLikeUrl(t)) texts.push(t);
        } else if (Array.isArray(val)) {
          for (const item of val) collect(item);
        } else if (val && typeof val === "object") {
          for (const v of Object.values(val as Record<string, unknown>)) collect(v);
        }
      };
      collect(b.props ?? {});
      if (texts.length > 0) lines.push(`[${b.type}] ${texts.join(" | ")}`);
      if (Array.isArray(b.children)) {
        walk(b.children as Array<CopilotPageBlock & { children?: unknown }>);
      }
    }
  };
  walk(blocks);
  let out = `Page: "${title}"\n${lines.join("\n")}`;
  if (out.length > MAX_PAGE_CONTENT_CHARS) out = `${out.slice(0, MAX_PAGE_CONTENT_CHARS)}…`;
  return out;
}

/** Minimal shape of a persisted page block for the config search. */
export interface RawPageBlock {
  id?: unknown;
  type?: unknown;
  props?: unknown;
  children?: unknown;
}

/** Depth-first search of the persisted page blocks for the chat-capture
 *  block (the server-trusted config source). PURE + exported for tests. */
export function findChatCaptureBlock(raw: unknown): RawPageBlock | null {
  if (!Array.isArray(raw)) return null;
  for (const b of raw as RawPageBlock[]) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "chat-capture") return b;
    const inChildren = findChatCaptureBlock(b.children);
    if (inChildren) return inChildren;
  }
  return null;
}

export const LEAD_CAPTURE_ACTIONS: AllowedActionDef[] = [
  {
    type: "capture_lead",
    description:
      "Save the visitor's contact details for the team. Call this ONCE you have their email address (plus any other details they shared) — the block submits it immediately.",
    properties: {
      email: { type: "string", description: "The visitor's email address." },
      name: { type: "string", description: "The visitor's name, if shared." },
      company: { type: "string", description: "The visitor's company, if shared." },
      phone: { type: "string", description: "The visitor's phone number, if shared." },
      notes: {
        type: "string",
        description:
          "A 1-3 sentence summary of what the visitor is looking for, their qualifying answers, and any objections — written for the sales team.",
      },
    },
    required: ["email"],
  },
];

/** Build the visitor-facing persona. Exported for tests. */
export function buildLeadCapturePersona(config: ChatCaptureConfig, brandName: string): string {
  const bot = config.botName?.trim() || "the assistant";
  const who = brandName ? `${brandName}'s page` : "this page";
  const collects = [
    "email address",
    config.collectName !== false ? "name" : "",
    config.collectCompany ? "company" : "",
    config.collectPhone ? "phone number" : "",
  ].filter(Boolean);
  return (
    `You are ${bot}, a friendly, human-sounding assistant chatting with a visitor on ${who}. ` +
    "Answer their questions using ONLY the page content and brand facts in the context. " +
    "If the answer isn't there — pricing you don't have, guarantees, availability — say plainly " +
    "that you don't have that detail and offer to have the team follow up; NEVER guess or invent. " +
    "Keep every reply short (1-3 sentences) and conversational. Ask at most one question per turn. " +
    `Your goal: be genuinely helpful first, then naturally collect the visitor's ${collects.join(", ")} ` +
    "so the team can follow up. Once you have their email (plus whatever else they shared), call " +
    "capture_lead with a useful notes summary, confirm you've passed it along, and offer to keep answering questions. " +
    "If they decline to share contact details, keep helping without pressuring them."
  );
}

export const leadCaptureMode: ConversationMode = {
  id: "lead_capture",
  goal:
    "Answer the visitor's questions from the page content, qualify them, and capture their " +
    "contact details for the team via capture_lead.",
  actionInstruction:
    "When you have the visitor's email, call the capture_lead tool with everything they shared — " +
    "it submits to the team immediately (do not ask the visitor to confirm a form). Never call it " +
    "without a real email address the visitor gave you in this conversation.",
  systemPromptBuilder: (ctx: ConversationContext) => {
    const c = ctx as LeadCaptureContext;
    return buildLeadCapturePersona(c.config ?? {}, c.brand?.brandName ?? "");
  },
  groundingBuilder: (ctx: ConversationContext) => {
    const c = ctx as LeadCaptureContext;
    const brandSection = buildBrandSystemPrompt(c.brand ?? {});
    const questions = (c.config?.qualifyingQuestions ?? []).filter(
      (q): q is string => typeof q === "string" && q.trim() !== "",
    );
    const sections = [
      buildPageContentDigest(c.pageTitle ?? "", c.pageBlocks ?? []),
      brandSection ? `Brand facts (the only claims you may assert):\n${brandSection}` : "",
      questions.length > 0
        ? `Qualifying questions to weave in naturally (one at a time):\n${questions
            .map((q) => `- ${q}`)
            .join("\n")}`
        : "",
    ];
    return sections.filter(Boolean).join("\n\n");
  },
  allowedActions: LEAD_CAPTURE_ACTIONS,
};
