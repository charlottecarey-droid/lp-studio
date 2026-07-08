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
  extractLinkedFormFields,
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

describe("extractLinkedFormFields", () => {
  it("flattens visible fields across steps with required flags, deduped by label", () => {
    const fields = extractLinkedFormFields([
      {
        title: "Step 1",
        fields: [
          { id: "a", type: "text", label: "First name", required: true },
          { id: "b", type: "email", label: "Work Email", required: true },
        ],
      },
      {
        title: "Step 2",
        fields: [
          { id: "c", type: "text", label: "Practice name", required: false },
          { id: "d", type: "text", label: "first name", required: false }, // dupe (case-insensitive)
        ],
      },
    ]);
    expect(fields).toEqual([
      { label: "First name", type: "text", required: true },
      { label: "Work Email", type: "email", required: true },
      { label: "Practice name", type: "text", required: false },
    ]);
  });

  it("skips hidden fields and auto-filled defaults — never ask a visitor for {{utm_source}}", () => {
    const fields = extractLinkedFormFields([
      {
        fields: [
          { id: "a", type: "hidden", label: "UTM Source", required: false },
          { id: "b", type: "text", label: "Lead Source", required: false, defaultValue: "Website" },
          { id: "c", type: "text", label: "Role", required: true },
        ],
      },
    ]);
    expect(fields).toEqual([{ label: "Role", type: "text", required: true }]);
  });

  it("returns empty for malformed steps", () => {
    expect(extractLinkedFormFields(null)).toEqual([]);
    expect(extractLinkedFormFields("nope")).toEqual([]);
    expect(extractLinkedFormFields([{ fields: "bad" }])).toEqual([]);
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

  it("encodes the qualification playbook: always advance, qualify before contact, one reframed retry", () => {
    const persona = buildLeadCapturePersona({}, "Acme");
    // Every turn must end with a forward-moving question — no dead-ends.
    expect(persona).toContain("exactly one question");
    expect(persona.toLowerCase()).toContain("never re-ask");
    // Qualifying questions come before the contact ask.
    expect(persona).toContain("Qualify BEFORE asking for contact details");
    // Graceful persistence: one differently-framed retry, then stop.
    expect(persona).toContain("ONE more differently-framed offer");
    expect(persona.toLowerCase()).toContain("decline twice, stop asking");
    // Capture doesn't end qualification.
    expect(persona.toLowerCase()).toContain("even after capture");
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
    // The questions are framed as a numbered checklist to work through.
    expect(grounding).toContain("QUALIFYING QUESTIONS");
    expect(grounding).toContain("1. How many locations do you have?");
    expect(grounding).toContain("99%");
    expect(grounding).not.toContain("42%");
  });

  it("grounding lists linked-form fields with required flags, and capture rules reference them", () => {
    const ctx: LeadCaptureContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [],
      config: {},
      brand: {},
      formFields: [
        { label: "First name", type: "text", required: true },
        { label: "Practice name", type: "text", required: false },
      ],
    };
    const grounding = leadCaptureMode.groundingBuilder(ctx);
    expect(grounding).toContain("LINKED FORM FIELDS");
    expect(grounding).toContain("- First name (required)");
    expect(grounding).toContain("- Practice name (optional)");
    // The action contract carries the required-before-capture rule and the
    // formAnswers arg the client submits under form labels.
    expect(leadCaptureMode.actionInstruction).toContain("LINKED FORM FIELDS");
    const captureDef = LEAD_CAPTURE_ACTIONS.find((a) => a.type === "capture_lead")!;
    expect(Object.keys(captureDef.properties)).toContain("formAnswers");
  });

  it("grounding omits the form section when no form is linked", () => {
    const ctx: LeadCaptureContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [],
      config: {},
      brand: {},
    };
    expect(leadCaptureMode.groundingBuilder(ctx)).not.toContain("LINKED FORM FIELDS");
  });

  it("grounding still directs qualification when no questions are configured", () => {
    const ctx: LeadCaptureContext = {
      tenantId: 1,
      pageId: 7,
      pageTitle: "Demo",
      pageBlocks: [],
      config: {},
      brand: {},
    };
    expect(leadCaptureMode.groundingBuilder(ctx)).toContain("No qualifying questions are configured");
  });
});
