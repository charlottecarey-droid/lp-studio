/**
 * Support Guide mode (June 2026 chatbot spec — Bot 3, platform-support
 * instance). An in-app help bot for TENANT USERS of LP Studio itself ("how do
 * I publish to a custom domain?"), grounded exclusively on the curated
 * user-guide corpus in ../grounding/userGuide.ts — it never answers from model
 * memory, and when the guide doesn't cover something it says so and proposes
 * escalating to the LP Studio team.
 *
 * Grounding = retrieval, not the whole corpus: the route puts the user's
 * message in the context and `selectGuideSections` keyword-scores the corpus,
 * injecting the top sections in full plus a table of contents (so the bot
 * knows what else exists and can say "ask me about X"). Pure + synchronous,
 * per the engine's groundingBuilder contract.
 *
 * allowedActions: open_page (deep-link the user to the app page a topic lives
 * at — client validates the path against the corpus whitelist) and
 * escalate_to_support (hand off to a human when the guide can't resolve it).
 */
import type { AllowedActionDef } from "../actions";
import type { ConversationContext, ConversationMode } from "../engine";
import { USER_GUIDE_SECTIONS, type GuideSection } from "../grounding/userGuide";

export interface SupportGuideContext extends ConversationContext {
  /** The current user turn — drives guide-section retrieval. */
  userMessage: string;
  /** The in-app route the user was on when they asked (e.g. "/forms") —
   *  optional situational grounding. */
  currentPath?: string;
}

/** Every app path the guide knows about — the open_page whitelist. */
export function guideAppPaths(sections: GuideSection[] = USER_GUIDE_SECTIONS): string[] {
  return [...new Set(sections.map((s) => s.appPath).filter((p): p is string => !!p))];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/** Keyword-score the corpus against the user's message and return the top
 *  `max` sections (score > 0), falling back to the first sections (the
 *  getting-started material) when nothing matches. PURE + exported for tests. */
export function selectGuideSections(
  query: string,
  sections: GuideSection[] = USER_GUIDE_SECTIONS,
  max = 5,
): GuideSection[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return sections.slice(0, Math.min(2, max));

  const scored = sections.map((s) => {
    const keywords = s.keywords.map((k) => k.toLowerCase());
    const titleTokens = tokenize(s.title);
    const bodyLower = s.body.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (keywords.some((k) => k === t || k.includes(t))) score += 3;
      if (titleTokens.includes(t)) score += 2;
      if (bodyLower.includes(t)) score += 1;
    }
    return { s, score };
  });

  const hits = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
  return hits.length > 0 ? hits : sections.slice(0, Math.min(2, max));
}

/** The table of contents — always included so the bot knows the guide's full
 *  scope and never claims a covered topic doesn't exist. */
export function buildGuideToc(sections: GuideSection[] = USER_GUIDE_SECTIONS): string {
  const lines = sections.map((s) => `- ${s.title}${s.appPath ? ` (in-app: ${s.appPath})` : ""}`);
  return `All user-guide topics (ask for any of these):\n${lines.join("\n")}`;
}

export const SUPPORT_GUIDE_ACTIONS: AllowedActionDef[] = [
  {
    type: "open_page",
    description:
      "Offer to take the user directly to the in-app page where they can do what they asked about. Only use a path that appears as 'in-app:' in the context.",
    properties: {
      path: {
        type: "string",
        description: "The in-app route to open (e.g. '/brand'), copied from the context.",
      },
    },
    required: ["path"],
  },
  {
    type: "escalate_to_support",
    description:
      "Offer to hand the question to the LP Studio team — when the guide doesn't cover it, the user reports a bug, or they ask for a feature that doesn't exist.",
    properties: {
      summary: {
        type: "string",
        description:
          "A one-paragraph summary of the user's question/problem, written so a support human can act on it without reading the whole chat.",
      },
    },
    required: ["summary"],
  },
];

const PERSONA =
  "You are LP Studio's support assistant — the product's user guide in " +
  "conversational form. You help tenant users get things done in LP Studio: " +
  "building and publishing pages, brand settings, forms and leads, " +
  "integrations, A/B testing, analytics, and the sales console. Answer ONLY " +
  "from the guide content in the context — never from general knowledge of " +
  "other products, and never guess at UI that isn't described there. Give " +
  "short, step-shaped answers ('Open Brand Settings, then…'). When the guide " +
  "doesn't cover the question, say so plainly and propose escalating to the " +
  "LP Studio team; when the user reports something broken, gather what they " +
  "tried and propose escalating with a clear summary.";

export const supportGuideMode: ConversationMode = {
  id: "support_guide",
  goal:
    "Resolve the user's how-do-I question about LP Studio from the guide, or hand it " +
    "to the LP Studio team with a clear summary when the guide can't.",
  systemPromptBuilder: () => PERSONA,
  groundingBuilder: (ctx: ConversationContext) => {
    const c = ctx as SupportGuideContext;
    const picked = selectGuideSections(c.userMessage ?? "");
    const sections = picked.map((s) => {
      const header = `## ${s.title}${s.appPath ? ` (in-app: ${s.appPath})` : ""}`;
      return `${header}\n${s.body}`;
    });
    const parts = [
      c.currentPath ? `The user is currently on the app page: ${c.currentPath}` : "",
      ...sections,
      buildGuideToc(),
    ];
    return parts.filter(Boolean).join("\n\n");
  },
  allowedActions: SUPPORT_GUIDE_ACTIONS,
};
