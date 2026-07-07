/**
 * Unit coverage for the Lead-Capture mode — page-content digest, persona
 * assembly, block-config discovery, and the capture_lead action contract.
 * No OpenAI, no DB.
 */
import { describe, it, expect } from "vitest";
import {
  leadCaptureMode,
  buildPageContentDigest,
  buildLeadCapturePersona,
  findChatCaptureBlock,
  LEAD_CAPTURE_ACTIONS,
  type LeadCaptureContext,
} from "./modes/leadCapture";

describe("buildPageContentDigest", () => {
  it("flattens copy from blocks including nested children and arrays", () => {
    const digest = buildPageContentDigest("Pricing", [
      {
        id: "hero-1",
        type: "hero",
        props: { headline: "Switch to Acme", items: [{ label: "Fast setup" }] },
      },
      {
        id: "grid-1",
        type: "container",
        props: {},
        children: [{ id: "c1", type: "single-quote", props: { quote: "Acme doubled our leads" } }],
      },
    ]);
    expect(digest).toContain('Page: "Pricing"');
    expect(digest).toContain("Switch to Acme");
    expect(digest).toContain("Fast setup");
    expect(digest).toContain("Acme doubled our leads");
  });

  it("skips URLs and caps total length", () => {
    const digest = buildPageContentDigest("T", [
      {
        id: "b1",
        type: "hero",
        props: {
          image: "https://cdn.example.com/x.jpg",
          body: "y".repeat(10_000),
        },
      },
    ]);
    expect(digest).not.toContain("cdn.example.com");
    expect(digest.length).toBeLessThanOrEqual(4200);
  });
});

describe("findChatCaptureBlock", () => {
  it("finds the block at the top level and nested in children", () => {
    expect(
      findChatCaptureBlock([{ id: "a", type: "hero" }, { id: "b", type: "chat-capture", props: { botName: "Maya" } }])?.props,
    ).toEqual({ botName: "Maya" });
    expect(
      findChatCaptureBlock([
        { id: "a", type: "container", children: [{ id: "b", type: "chat-capture" }] },
      ])?.id,
    ).toBe("b");
  });

  it("returns null when absent or malformed", () => {
    expect(findChatCaptureBlock([{ id: "a", type: "hero" }])).toBeNull();
    expect(findChatCaptureBlock(null)).toBeNull();
    expect(findChatCaptureBlock("nope")).toBeNull();
  });
});

describe("buildLeadCapturePersona", () => {
  it("uses the configured bot name, brand, and collected fields", () => {
    const persona = buildLeadCapturePersona(
      { botName: "Maya", collectCompany: true, collectPhone: true },
      "Acme",
    );
    expect(persona).toContain("Maya");
    expect(persona).toContain("Acme");
    expect(persona).toContain("company");
    expect(persona).toContain("phone number");
    expect(persona.toLowerCase()).toContain("never guess");
  });

  it("defaults sensibly with an empty config", () => {
    const persona = buildLeadCapturePersona({}, "");
    expect(persona).toContain("the assistant");
    expect(persona).toContain("email address");
  });
});

describe("leadCaptureMode", () => {
  it("is tagged lead_capture with a single capture_lead action requiring email", () => {
    expect(leadCaptureMode.id).toBe("lead_capture");
    expect(LEAD_CAPTURE_ACTIONS).toHaveLength(1);
    expect(LEAD_CAPTURE_ACTIONS[0].type).toBe("capture_lead");
    expect(LEAD_CAPTURE_ACTIONS[0].required).toEqual(["email"]);
  });

  it("overrides the action instruction for auto-submitting capture", () => {
    expect(leadCaptureMode.actionInstruction).toBeTruthy();
    expect(leadCaptureMode.actionInstruction).toContain("capture_lead");
  });

  it("grounding folds page digest + approved brand facts + qualifying questions", () => {
    const ctx: LeadCaptureContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [{ id: "hero-1", type: "hero", props: { headline: "Hello world" } }],
      config: { qualifyingQuestions: ["How many locations do you have?"] },
      brand: {
        brandName: "Acme",
        aiStrictFactsMode: true,
        scrapedStats: [
          { value: "99%", label: "uptime", approvedForAi: true },
          { value: "42%", label: "growth", approvedForAi: false },
        ],
      },
    };
    const grounding = leadCaptureMode.groundingBuilder(ctx);
    expect(grounding).toContain("Hello world");
    expect(grounding).toContain("How many locations do you have?");
    expect(grounding).toContain("99%");
    expect(grounding).not.toContain("42%");
  });
});
