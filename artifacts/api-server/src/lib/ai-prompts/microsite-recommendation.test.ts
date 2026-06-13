/**
 * Microsite recommendation engine — pure-function tests.
 *
 * Each objective → expected funnel-stage template + reasoning trail;
 * segment/persona influence on first-meeting template + messaging;
 * from-scratch → null template. Slugs are asserted against the real
 * funnel-stage seed slugs so a slug rename in globalTemplates.ts surfaces here.
 */
import { describe, it, expect } from "vitest";
import {
  recommendMicrositePlan,
  MICROSITE_OBJECTIVES,
  type MicrositeObjective,
} from "./microsite-recommendation";
import { GLOBAL_TEMPLATE_SEEDS } from "../../seeds/globalTemplates";

const SEED_SLUGS = new Set(GLOBAL_TEMPLATE_SEEDS.map((t) => t.slug));

describe("recommendMicrositePlan — objective → template mapping", () => {
  it("share-business-case → business case template, first-meeting stage", () => {
    const plan = recommendMicrositePlan({ objective: "share-business-case" });
    expect(plan.recommendedTemplateSlug).toBe("global-business-case-split-generic");
    expect(plan.funnelStage).toBe("first-meeting");
    expect(SEED_SLUGS.has(plan.recommendedTemplateSlug!)).toBe(true);
  });

  it("exec-presentation → MEDDIC exec decision brief", () => {
    const plan = recommendMicrositePlan({ objective: "exec-presentation" });
    expect(plan.recommendedTemplateSlug).toBe("global-exec-decision-brief");
    expect(plan.funnelStage).toBe("first-meeting");
  });

  it("support-proposal with executive persona → exec decision brief", () => {
    const plan = recommendMicrositePlan({
      objective: "support-proposal",
      persona: { role: "Chief Financial Officer" },
    });
    expect(plan.recommendedTemplateSlug).toBe("global-exec-decision-brief");
  });

  it("support-proposal with operator persona → business case", () => {
    const plan = recommendMicrositePlan({
      objective: "support-proposal",
      persona: { role: "Operations Manager" },
    });
    expect(plan.recommendedTemplateSlug).toBe("global-business-case-split-generic");
  });

  it("advance-opportunity → deal room, deal-acceleration stage", () => {
    const plan = recommendMicrositePlan({ objective: "advance-opportunity" });
    expect(plan.recommendedTemplateSlug).toBe("global-deal-room");
    expect(plan.funnelStage).toBe("deal-acceleration");
  });

  it("re-engage-stalled → deal room with re-urgency messaging", () => {
    const plan = recommendMicrositePlan({ objective: "re-engage-stalled" });
    expect(plan.recommendedTemplateSlug).toBe("global-deal-room");
    expect(plan.funnelStage).toBe("deal-acceleration");
    expect(plan.messagingPriorities.join(" ").toLowerCase()).toContain("urgency");
  });

  it("drive-expansion → value/renewal review, expansion-renewal stage", () => {
    const plan = recommendMicrositePlan({ objective: "drive-expansion" });
    expect(plan.recommendedTemplateSlug).toBe("global-value-renewal-review");
    expect(plan.funnelStage).toBe("expansion-renewal");
  });

  it("from-scratch → null template, null stage", () => {
    const plan = recommendMicrositePlan({ objective: "from-scratch" });
    expect(plan.recommendedTemplateSlug).toBeNull();
    expect(plan.funnelStage).toBeNull();
    expect(plan.recommendedBlocks.length).toBeGreaterThan(0);
  });

  it("unknown objective degrades to from-scratch (null template, never throws)", () => {
    const plan = recommendMicrositePlan({ objective: "totally-made-up" as MicrositeObjective });
    expect(plan.recommendedTemplateSlug).toBeNull();
    expect(plan.funnelStage).toBeNull();
  });

  it("every funnel-stage template slug it can pick exists in the seeds", () => {
    for (const objective of MICROSITE_OBJECTIVES) {
      const plan = recommendMicrositePlan({ objective });
      if (plan.recommendedTemplateSlug !== null) {
        expect(SEED_SLUGS.has(plan.recommendedTemplateSlug)).toBe(true);
      }
    }
  });
});

describe("recommendMicrositePlan — book-meeting template selection", () => {
  it("default first meeting (no persona/notes) → StoryBrand journey", () => {
    const plan = recommendMicrositePlan({ objective: "book-meeting" });
    expect(plan.recommendedTemplateSlug).toBe("global-storybrand-journey");
    expect(plan.funnelStage).toBe("first-meeting");
  });

  it("executive persona → MEDDIC exec decision brief", () => {
    const plan = recommendMicrositePlan({
      objective: "book-meeting",
      persona: { role: "VP of Operations" },
    });
    expect(plan.recommendedTemplateSlug).toBe("global-exec-decision-brief");
  });

  it("notes mentioning a reframe/challenge → Challenger insight", () => {
    const plan = recommendMicrositePlan({
      objective: "book-meeting",
      notes: "lead with a provocative insight to challenge the status quo",
    });
    expect(plan.recommendedTemplateSlug).toBe("global-challenger-insight");
  });
});

describe("recommendMicrositePlan — reasoning trail (preview/why panel)", () => {
  it("reasoning leads with goal, then segment, then persona, then the chosen template", () => {
    const plan = recommendMicrositePlan({
      objective: "advance-opportunity",
      segment: { id: "dso", name: "DSO" },
      persona: { role: "Chief Executive Officer" },
    });
    expect(plan.reasoning[0]).toContain("Goal = Advance an active opportunity");
    expect(plan.reasoning.some((r) => r.includes("Segment = DSO"))).toBe(true);
    expect(plan.reasoning.some((r) => r.includes("Persona = Chief Executive Officer"))).toBe(true);
    // Final reasoning line states the chosen template.
    expect(plan.reasoning[plan.reasoning.length - 1].toLowerCase()).toContain("deal room");
  });

  it("segment selection surfaces the override-core note in the reasoning", () => {
    const plan = recommendMicrositePlan({
      objective: "book-meeting",
      segment: { id: "dso", name: "DSO" },
    });
    expect(
      plan.reasoning.some((r) => r.toLowerCase().includes("overrides core")),
    ).toBe(true);
  });

  it("DSO + book-meeting leads messaging with segment value props, not core", () => {
    const plan = recommendMicrositePlan({
      objective: "book-meeting",
      segment: { id: "dso", name: "DSO" },
    });
    expect(plan.messagingPriorities[0].toLowerCase()).toContain("dso");
    expect(plan.messagingPriorities[0].toLowerCase()).toContain("segment messaging");
  });

  it("account context enriches reasoning (opportunity stage, customer)", () => {
    const plan = recommendMicrositePlan({
      objective: "drive-expansion",
      accountContext: { opportunityStage: "Negotiation", isCustomer: true },
    });
    expect(plan.reasoning.some((r) => r.includes("Negotiation"))).toBe(true);
    expect(plan.reasoning.some((r) => r.toLowerCase().includes("existing customer"))).toBe(true);
  });
});
