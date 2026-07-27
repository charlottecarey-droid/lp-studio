/**
 * Unit coverage for the Sales Assistant mode — entity-token extraction, the
 * console map, grounding assembly, and the action contract. No OpenAI, no DB.
 */
import { describe, it, expect } from "vitest";
import {
  salesAssistantMode,
  extractEntityTokens,
  buildConsoleMapSection,
  SALES_CONSOLE_MAP,
  SALES_ASSISTANT_ACTIONS,
  type SalesAssistantContext,
} from "./modes/salesAssistant";

describe("extractEntityTokens", () => {
  it("keeps entity-ish words and drops action words", () => {
    const tokens = extractEntityTokens("build me a microsite for Aspen Dental");
    expect(tokens).toContain("aspen");
    expect(tokens).toContain("dental");
    expect(tokens).not.toContain("build");
    expect(tokens).not.toContain("microsite");
  });

  it("handles 'one pager for X' and 'email for X contact' phrasings", () => {
    expect(extractEntityTokens("one pager for Bright Smiles")).toEqual(["bright", "smiles"]);
    expect(extractEntityTokens("draft an email to Dana Ruiz")).toEqual(["dana", "ruiz"]);
  });

  it("dedupes, strips punctuation, and caps the token count", () => {
    const tokens = extractEntityTokens("Acme's Acme's alpha beta gamma delta epsilon zeta eta");
    expect(tokens[0]).toBe("acmes");
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.length).toBeLessThanOrEqual(6);
  });

  it("returns empty for action-only messages", () => {
    expect(extractEntityTokens("what would you like to do today")).toEqual([]);
  });
});

describe("console map", () => {
  it("covers the core console destinations", () => {
    const paths = SALES_CONSOLE_MAP.map((e) => e.path);
    for (const p of ["/sales", "/sales/accounts", "/sales/microsites", "/sales/draft-email", "/sales/one-pager", "/sales/signals", "/sales/guide"]) {
      expect(paths).toContain(p);
    }
    expect(buildConsoleMapSection()).toContain("/sales/accounts/{id}");
  });
});

describe("salesAssistantMode", () => {
  it("is tagged sales_assistant with its executable actions", () => {
    expect(salesAssistantMode.id).toBe("sales_assistant");
    expect(SALES_ASSISTANT_ACTIONS.map((a) => a.type).sort()).toEqual([
      "create_event_agenda",
      "create_one_pager",
      "draft_email",
      "generate_microsite",
      "open_page",
    ]);
  });

  it("the event-agenda action requires an account and treats the event as optional", () => {
    const action = SALES_ASSISTANT_ACTIONS.find((a) => a.type === "create_event_agenda");
    expect(action).toBeDefined();
    // An account is mandatory (the agenda is FOR someone); the event is not,
    // so the bot can hand off to the events list instead of guessing which
    // conference the rep meant.
    expect(action!.required).toEqual(["accountId", "accountName"]);
    expect(Object.keys(action!.properties)).toContain("eventId");
  });

  it("grounding lists the tenant's events so the bot can pass a real eventId", () => {
    const grounding = salesAssistantMode.groundingBuilder!({
      tenantId: 1,
      pageId: null,
      userMessage: "agenda for acme",
      accounts: [],
      contacts: [],
      accountsTotal: 0,
      events: [{ id: 7, name: "Summit 2026", dates: "2026-03-10 – 2026-03-12", sessionCount: 42 }],
    } as never);
    expect(grounding).toContain("EVENTS");
    expect(grounding).toContain("7 — Summit 2026");
    expect(grounding).toContain("42 sessions");
  });

  it("grounding says so when no events exist, instead of implying one", () => {
    const grounding = salesAssistantMode.groundingBuilder!({
      tenantId: 1, pageId: null, userMessage: "agenda", accounts: [], contacts: [], accountsTotal: 0, events: [],
    } as never);
    expect(grounding).toContain("EVENTS: none set up yet");
  });

  it("grounding lists matched accounts/contacts with their ids", () => {
    const ctx: SalesAssistantContext = {
      tenantId: 1,
      pageId: null,
      userMessage: "microsite for aspen",
      accounts: [{ id: 42, name: "Aspen Dental" }],
      contacts: [{ id: 7, name: "Dana Ruiz", accountId: 42, accountName: "Aspen Dental" }],
      accountsTotal: 120,
    };
    const grounding = salesAssistantMode.groundingBuilder(ctx);
    expect(grounding).toContain("42 — Aspen Dental");
    expect(grounding).toContain("7 — Dana Ruiz @ Aspen Dental");
    expect(grounding).toContain("/sales/signals");
  });

  it("empty matches tell the bot the workspace still has accounts", () => {
    const ctx: SalesAssistantContext = {
      tenantId: 1,
      pageId: null,
      userMessage: "zzz",
      accounts: [],
      contacts: [],
      accountsTotal: 120,
    };
    const grounding = salesAssistantMode.groundingBuilder(ctx);
    expect(grounding).toContain("120 accounts total");
  });

  it("persona forbids invented ids and prefers doing over describing", () => {
    const persona = salesAssistantMode.systemPromptBuilder({ tenantId: 1, pageId: null });
    expect(persona).toContain("NEVER invent");
    expect(persona.toLowerCase()).toContain("doing over describing");
  });
});
