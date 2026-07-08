/**
 * Sales Assistant mode — the sales console's "what would you like to do
 * today?" prompt box (July 2026, Charlotte's ask: reps shouldn't have to FIND
 * anything in the console).
 *
 * The bot turns plain-language intents into executable actions:
 *   "build me a microsite for Aspen Dental"  → generate_microsite(accountId)
 *   "one pager for Bright Smiles"            → create_one_pager(accountId)
 *   "email for Dana Ruiz"                    → draft_email(contactId)
 *   "where do I see who opened my emails?"   → open_page("/sales/campaigns")
 *
 * Entity resolution is grounding-driven: the route pre-matches the tenant's
 * accounts/contacts against the user's message (ILIKE on name tokens) and the
 * bot may ONLY use ids from those lists — never invented ids. The client
 * validates every id/path again before running anything, and every action is
 * a card the rep clicks (propose-confirm, like the builder copilot).
 */
import type { AllowedActionDef } from "../actions";
import type { ConversationContext, ConversationMode } from "../engine";

export interface AssistantAccount {
  id: number;
  name: string;
}

export interface AssistantContact {
  id: number;
  name: string;
  accountId: number;
  accountName: string;
}

export interface SalesAssistantContext extends ConversationContext {
  userMessage: string;
  /** Accounts whose names matched the message (or a small recent set when
   *  nothing matched). */
  accounts: AssistantAccount[];
  /** Contacts matching the message by name, or belonging to matched
   *  accounts. */
  contacts: AssistantContact[];
  /** Total account count for the tenant — so the bot knows an empty match
   *  list doesn't mean an empty console. */
  accountsTotal: number;
}

/** Words that describe the ACTION rather than an entity — excluded from
 *  name-token matching so "build a microsite for Aspen" matches "Aspen", not
 *  every account containing "microsite". */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "what", "who", "how", "can",
  "you", "please", "want", "would", "like", "today", "build", "make",
  "create", "generate", "draft", "write", "send", "show", "open", "find",
  "need", "email", "emails", "microsite", "microsites", "page", "pages",
  "one", "pager", "onepager", "account", "accounts", "contact", "contacts",
  "campaign", "campaigns", "template", "templates", "new", "about", "them",
  "her", "his", "their", "our", "get", "give", "let", "see", "look",
]);

/** Candidate entity-name tokens from a user message. PURE + exported for
 *  tests and for the route's DB matching. */
export function extractEntityTokens(message: string, max = 6): string[] {
  const tokens = (message.toLowerCase().match(/[a-z0-9][a-z0-9'&-]{2,}/g) ?? [])
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(tokens)].slice(0, max);
}

/** The console map — every destination the bot may deep-link, with a one-line
 *  purpose. Paths must exist in App.tsx's /sales routes (the client validates
 *  again before navigating). */
export const SALES_CONSOLE_MAP: ReadonlyArray<{ path: string; purpose: string }> = [
  { path: "/sales", purpose: "Dashboard — engagement overview, hot accounts, quick actions." },
  { path: "/sales/accounts", purpose: "Target account list with filters, ABM stages, saved views." },
  { path: "/sales/contacts", purpose: "All contacts across accounts, with engagement scores and CSV import." },
  { path: "/sales/microsites", purpose: "All account microsites — status, links, visit alerts." },
  { path: "/sales/campaign-pages", purpose: "Personalized Pages — one page sent to many accounts at once." },
  { path: "/sales/campaigns", purpose: "Outreach campaigns — every email sent/opened/clicked." },
  { path: "/sales/signals", purpose: "Live engagement feed — opens, visits, clicks in real time." },
  { path: "/sales/draft-email", purpose: "AI email drafting (works from a specific contact)." },
  { path: "/sales/one-pager", purpose: "One-pager generator for an account." },
  { path: "/sales/one-pager-templates", purpose: "One-pager template management." },
  { path: "/sales/roi-calculator", purpose: "ROI calculator to run before discovery calls." },
  { path: "/sales/marketplace", purpose: "Template library — clone and customize page templates." },
  { path: "/sales/integrations", purpose: "CRM + tool connections (Salesforce, Marketo, HubSpot, Slack)." },
  { path: "/sales/guide", purpose: "The full sales console user guide." },
];

export function buildConsoleMapSection(): string {
  const lines = SALES_CONSOLE_MAP.map((e) => `- ${e.path} — ${e.purpose}`);
  return `Console pages you may open with open_page (account detail is /sales/accounts/{id}, optionally ?tab=contacts|microsites|activity; contact detail is /sales/contacts/{id}):\n${lines.join("\n")}`;
}

export const SALES_ASSISTANT_ACTIONS: AllowedActionDef[] = [
  {
    type: "generate_microsite",
    description:
      "Open the microsite generator preset to an account — for 'build/make a microsite for X'. accountId MUST come from MATCHED ACCOUNTS.",
    properties: {
      accountId: { type: "number", description: "The account id, copied from MATCHED ACCOUNTS." },
      accountName: { type: "string", description: "The account's display name." },
    },
    required: ["accountId", "accountName"],
  },
  {
    type: "create_one_pager",
    description:
      "Open the one-pager generator seeded with an account — for 'one pager for X'. accountId MUST come from MATCHED ACCOUNTS.",
    properties: {
      accountId: { type: "number", description: "The account id, copied from MATCHED ACCOUNTS." },
      accountName: { type: "string", description: "The account's display name." },
    },
    required: ["accountId", "accountName"],
  },
  {
    type: "draft_email",
    description:
      "Open AI email drafting for a specific contact — for 'draft/write an email to X'. contactId MUST come from MATCHED CONTACTS. If the user only named a company, first help them pick one of its contacts.",
    properties: {
      contactId: { type: "number", description: "The contact id, copied from MATCHED CONTACTS." },
      contactName: { type: "string", description: "The contact's name." },
    },
    required: ["contactId", "contactName"],
  },
  {
    type: "open_page",
    description:
      "Navigate the user to a console page — for 'where do I…' / 'show me…' requests, or as the fallback when no entity matched. Use a path from the console map (account/contact detail paths allowed with a real id).",
    properties: {
      path: { type: "string", description: "The console path to open (e.g. '/sales/signals' or '/sales/accounts/42?tab=contacts')." },
    },
    required: ["path"],
  },
];

const PERSONA =
  "You are the LP Studio Sales Console assistant — a fast, no-nonsense " +
  "concierge for sales reps. The user tells you what they want to do; you do " +
  "the finding for them. Prefer DOING over describing: when the request maps " +
  "to an action, propose the action card immediately with at most one short " +
  "sentence of prose. Resolve company and person names against the MATCHED " +
  "ACCOUNTS / MATCHED CONTACTS lists and use those exact ids — NEVER invent " +
  "or guess an id. If several entries could match, ask which one (list them " +
  "briefly). If nothing matched, say so and propose open_page to the page " +
  "where they can search or create it (e.g. /sales/accounts). For 'how do I' " +
  "questions, answer in one or two sentences from the console map and " +
  "propose open_page to the right place. If the user asks for an email to a " +
  "company rather than a person, offer its matched contacts to choose from.";

export const salesAssistantMode: ConversationMode = {
  id: "sales_assistant",
  goal:
    "Turn the rep's plain-language request into the right console action — generate a " +
    "microsite, start a one-pager, draft an email, or open the right page.",
  actionInstruction:
    "When the request maps to an action, CALL the matching tool — ids copied exactly from the " +
    "MATCHED lists in the context. Each proposal renders as a card the user clicks to run; " +
    "nothing runs automatically, so propose confidently. Keep prose to one short sentence per " +
    "reply and let the card do the work.",
  systemPromptBuilder: () => PERSONA,
  groundingBuilder: (ctx: ConversationContext) => {
    const c = ctx as SalesAssistantContext;
    const accounts = c.accounts ?? [];
    const contacts = c.contacts ?? [];
    const accountSection =
      accounts.length > 0
        ? `MATCHED ACCOUNTS (id — name):\n${accounts.map((a) => `${a.id} — ${a.name}`).join("\n")}`
        : `MATCHED ACCOUNTS: none matched the message (the workspace has ${c.accountsTotal ?? 0} accounts total — suggest /sales/accounts to browse or create).`;
    const contactSection =
      contacts.length > 0
        ? `MATCHED CONTACTS (id — name @ account):\n${contacts
            .map((p) => `${p.id} — ${p.name} @ ${p.accountName}`)
            .join("\n")}`
        : "MATCHED CONTACTS: none matched the message.";
    return [buildConsoleMapSection(), accountSection, contactSection].join("\n\n");
  },
  allowedActions: SALES_ASSISTANT_ACTIONS,
};
