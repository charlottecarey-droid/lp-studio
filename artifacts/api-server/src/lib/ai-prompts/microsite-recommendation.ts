// Microsite recommendation engine (June 2026).
//
// Pure, deterministic decision engine that turns a sales rep's OBJECTIVE
// (plus optional segment / persona / account context) into a microsite PLAN:
// which funnel-stage template to use, what funnel stage the page sits in,
// which blocks to lead with, what to emphasise in the copy, which CTAs to
// surface, and — crucially — a human-readable `reasoning` trail the FE
// "preview / why" panel renders so the rep understands the recommendation
// before generating.
//
// Design constraints (mirror template-intent.ts):
//   • NO model call, NO DB, NO IO — runs synchronously before generation.
//   • Fully deterministic + unit-tested: a given input always yields the same
//     plan, so the preview the rep sees exactly matches what generation
//     receives.
//   • Fail-open: every field is optional; unknown objectives degrade to the
//     "from-scratch" (AI-assembles, no template) behaviour rather than throwing.
//   • The template SLUG it picks is a GLOBAL funnel-stage template slug
//     (see seeds/globalTemplates.ts). The generate-microsite route resolves the
//     slug → templateId (or lets matchTemplateIntent re-derive it from the
//     reasoning when the slug isn't found), respecting explicit-template-wins
//     and brand-aware exclusion. `recommendedTemplateSlug: null` means "no
//     fixed template — let the AI freely assemble".

import type { TemplateFunnelStage } from "../../seeds/globalTemplates";

/** The sales objective the rep picks in the New Microsite questionnaire. */
export type MicrositeObjective =
  | "book-meeting"
  | "advance-opportunity"
  | "re-engage-stalled"
  | "support-proposal"
  | "share-business-case"
  | "exec-presentation"
  | "drive-expansion"
  | "from-scratch";

export const MICROSITE_OBJECTIVES: readonly MicrositeObjective[] = [
  "book-meeting",
  "advance-opportunity",
  "re-engage-stalled",
  "support-proposal",
  "share-business-case",
  "exec-presentation",
  "drive-expansion",
  "from-scratch",
] as const;

/** Minimal persona shape threaded from the segment picker. */
export interface RecommendationPersona {
  id?: string;
  name?: string;
  role?: string;
}

/** Minimal segment shape threaded from the segment picker. */
export interface RecommendationSegment {
  id?: string;
  name?: string;
  /** When set, lets the engine note that segment messaging will override core. */
  messagingAngle?: string;
}

/** Optional account/opportunity context the generator already pulls. The engine
 *  uses it only to enrich the reasoning + nudge CTAs (e.g. a late-stage open
 *  opportunity reinforces "advance the deal"); it never requires any field. */
export interface RecommendationAccountContext {
  name?: string;
  /** Open opportunity stage name, if any (Prospecting … Negotiation). */
  opportunityStage?: string | null;
  /** Whether an open opportunity exists on the account. */
  hasOpenOpportunity?: boolean;
  /** Whether the account is an existing customer (drives expansion framing). */
  isCustomer?: boolean;
}

export interface RecommendMicrositeInput {
  objective: MicrositeObjective | string;
  segment?: RecommendationSegment;
  persona?: RecommendationPersona;
  accountContext?: RecommendationAccountContext;
  notes?: string;
}

export interface MicrositePlan {
  /** Global funnel-stage template slug, or null for AI free-assembly. */
  recommendedTemplateSlug: string | null;
  funnelStage: TemplateFunnelStage | null;
  /** Ordered block-type hints the page should lead with (advisory — the
   *  generator's template/outline resolution remains authoritative). */
  recommendedBlocks: string[];
  /** What the copy must emphasise, in priority order. */
  messagingPriorities: string[];
  /** Suggested CTA labels/intents, in priority order. */
  recommendedCtas: string[];
  /** Kinds of proof to surface (stats, named ROI, peer logos …). */
  suggestedProofPointTypes: string[];
  /** How to choose case studies to feature. */
  suggestedCaseStudyCriteria: string[];
  /** Human-readable "why" trail for the preview panel. */
  reasoning: string[];
}

/** Default first-meeting framework. StoryBrand is the broad, customer-as-hero
 *  narrative; Challenger leads with a reframe/insight; the MEDDIC exec-decision
 *  brief is the buyer-committee brief. We pick based on persona seniority +
 *  segment signals so a first meeting with an exec gets the decision brief,
 *  an operator gets StoryBrand, and an explicit "challenge/reframe" note routes
 *  to Challenger. */
const FIRST_MEETING_STORYBRAND = "global-storybrand-journey";
const FIRST_MEETING_CHALLENGER = "global-challenger-insight";
const FIRST_MEETING_EXEC_BRIEF = "global-exec-decision-brief";

const TEMPLATE_DEAL_ROOM = "global-deal-room";
const TEMPLATE_BUSINESS_CASE = "global-business-case-split-generic";
const TEMPLATE_VALUE_RENEWAL = "global-value-renewal-review";
const TEMPLATE_ONBOARDING = "global-onboarding-hub";

/** Persona role/title strings that read as executive / economic-buyer level. */
function personaIsExecutive(persona: RecommendationPersona | undefined): boolean {
  const hay = `${persona?.role ?? ""} ${persona?.name ?? ""}`.toLowerCase();
  if (!hay.trim()) return false;
  return /\b(ceo|cfo|coo|cmo|cto|cio|chief|founder|owner|president|vp|vice president|svp|evp|partner|managing director|head of|principal|board|executive|economic buyer)\b/.test(
    hay,
  );
}

/** Persona role/title strings that read as operator / champion level. */
function personaIsOperator(persona: RecommendationPersona | undefined): boolean {
  const hay = `${persona?.role ?? ""} ${persona?.name ?? ""}`.toLowerCase();
  if (!hay.trim()) return false;
  return /\b(manager|director of operations|ops|operations|practice manager|office manager|regional|coordinator|lead|administrator|champion|specialist|analyst)\b/.test(
    hay,
  );
}

function notesMentionChallenge(notes: string | undefined): boolean {
  const hay = (notes ?? "").toLowerCase();
  return /\b(challenge|reframe|insight|provoke|status quo|disrupt|rethink|contrarian|teach)\b/.test(hay);
}

/** Pick the first-meeting framework template + label from persona/segment/notes. */
function pickFirstMeetingTemplate(
  input: RecommendMicrositeInput,
): { slug: string; label: string } {
  if (notesMentionChallenge(input.notes)) {
    return { slug: FIRST_MEETING_CHALLENGER, label: "Challenger insight" };
  }
  if (personaIsExecutive(input.persona)) {
    return { slug: FIRST_MEETING_EXEC_BRIEF, label: "MEDDIC exec decision brief" };
  }
  // Operators + unknown personas get the customer-as-hero StoryBrand narrative.
  return { slug: FIRST_MEETING_STORYBRAND, label: "StoryBrand journey" };
}

function segmentLabel(segment: RecommendationSegment | undefined): string | null {
  const name = segment?.name?.trim() || segment?.id?.trim();
  return name || null;
}

function personaLabel(persona: RecommendationPersona | undefined): string | null {
  const name = persona?.role?.trim() || persona?.name?.trim();
  return name || null;
}

/**
 * Turn an objective (+ optional context) into a microsite plan.
 *
 * Pure + deterministic. The objective is the primary driver; segment + persona
 * refine the first-meeting template choice and the messaging/CTA priorities;
 * account context only enriches the reasoning + CTA emphasis. An unknown
 * objective is treated as "from-scratch" (null template, AI assembles).
 */
export function recommendMicrositePlan(input: RecommendMicrositeInput): MicrositePlan {
  const objective = (typeof input.objective === "string" ? input.objective : "").trim() as MicrositeObjective;
  const seg = segmentLabel(input.segment);
  const persona = personaLabel(input.persona);

  const reasoning: string[] = [];
  // Lead the reasoning with the goal, then segment + persona influence — this is
  // exactly the order the FE preview panel renders.
  const OBJECTIVE_REASON: Record<string, string> = {
    "book-meeting": "Goal = Book a first meeting",
    "advance-opportunity": "Goal = Advance an active opportunity",
    "re-engage-stalled": "Goal = Re-engage a stalled deal",
    "support-proposal": "Goal = Support a live proposal",
    "share-business-case": "Goal = Share a business case",
    "exec-presentation": "Goal = Deliver an executive presentation",
    "drive-expansion": "Goal = Drive expansion / renewal",
    "from-scratch": "Goal = Build from scratch (AI assembles)",
  };
  reasoning.push(OBJECTIVE_REASON[objective] ?? `Goal = ${objective || "unspecified"} (treated as build from scratch)`);
  if (seg) reasoning.push(`Segment = ${seg}`);
  if (persona) reasoning.push(`Persona = ${persona}`);

  // Account-context enrichment — advisory only.
  const ctx = input.accountContext;
  if (ctx?.opportunityStage) reasoning.push(`Open opportunity stage = ${ctx.opportunityStage}`);
  else if (ctx?.hasOpenOpportunity) reasoning.push("Account has an open opportunity");
  if (ctx?.isCustomer) reasoning.push("Account is an existing customer");

  // Shared messaging-hierarchy note: when a segment is selected its messaging
  // overrides core. The generator enforces this; we surface it in the preview.
  if (seg) {
    reasoning.push(`Segment messaging overrides core/default messaging — leading with ${seg} value props`);
  }
  if (persona) {
    reasoning.push(`Addressing the ${persona} persona's priorities directly`);
  }

  let plan: MicrositePlan;

  switch (objective) {
    case "share-business-case":
    case "support-proposal":
    case "exec-presentation": {
      // Exec / proposal objectives → the business-case / exec-decision brief.
      // An executive persona reinforces the decision-brief framing; otherwise
      // the structured business case.
      const useExecBrief = objective === "exec-presentation" || personaIsExecutive(input.persona);
      const slug = useExecBrief ? FIRST_MEETING_EXEC_BRIEF : TEMPLATE_BUSINESS_CASE;
      const label = useExecBrief ? "MEDDIC exec decision brief" : "Business Case";
      reasoning.push(`→ ${label} template (funnel stage: business-case / first-meeting)`);
      plan = {
        recommendedTemplateSlug: slug,
        funnelStage: "first-meeting",
        recommendedBlocks: useExecBrief
          ? ["business-case-split", "comparison", "stat-callout", "dso-success-stories", "bottom-cta"]
          : ["business-case-split", "stat-callout", "comparison", "testimonial", "bottom-cta"],
        messagingPriorities: [
          "Quantified ROI / business case (cost of inaction vs. the shift)",
          "Executive-level outcomes: margin, efficiency, risk reduction",
          "Proof the model works at this account's scale",
        ],
        recommendedCtas: ["Review the business case", "Book an executive walkthrough"],
        suggestedProofPointTypes: ["named ROI figures", "before/after comparison", "peer/customer outcomes"],
        suggestedCaseStudyCriteria: [
          "same segment / similar scale to this account",
          "quantified financial or operational outcome",
        ],
        reasoning,
      };
      break;
    }

    case "advance-opportunity":
    case "re-engage-stalled": {
      // Mid-funnel objectives → the Deal Room (mutual action plan).
      const stalled = objective === "re-engage-stalled";
      reasoning.push("→ Deal Room template (funnel stage: deal-acceleration)");
      plan = {
        recommendedTemplateSlug: TEMPLATE_DEAL_ROOM,
        funnelStage: "deal-acceleration",
        recommendedBlocks: stalled
          ? ["dso-heartland-hero", "pas-section", "comparison", "dso-success-stories", "how-it-works", "bottom-cta"]
          : ["dso-heartland-hero", "how-it-works", "comparison", "dso-success-stories", "stat-callout", "bottom-cta"],
        messagingPriorities: stalled
          ? [
              "Re-establish urgency: the cost of staying on the current path",
              "Address the specific objection / blocker that stalled the deal",
              "Make the next step small and concrete (mutual action plan)",
            ]
          : [
              "Mutual action plan: clear next steps to close",
              "De-risk the decision (pilot, proof, references)",
              "Reinforce the differentiated value vs. the status quo",
            ],
        recommendedCtas: stalled
          ? ["Pick up where we left off", "Book a 20-minute reset call"]
          : ["Review the mutual action plan", "Confirm the next step"],
        suggestedProofPointTypes: ["mutual action plan / timeline", "peer references", "pilot results"],
        suggestedCaseStudyCriteria: [
          "matched to the open opportunity's use case",
          "shows time-to-value / fast close",
        ],
        reasoning,
      };
      break;
    }

    case "drive-expansion": {
      reasoning.push("→ Value / Renewal Review template (funnel stage: expansion-renewal)");
      plan = {
        recommendedTemplateSlug: TEMPLATE_VALUE_RENEWAL,
        funnelStage: "expansion-renewal",
        recommendedBlocks: ["dso-heartland-hero", "stat-callout", "dso-insights-dashboard", "dso-success-stories", "comparison", "bottom-cta"],
        messagingPriorities: [
          "Value delivered to date (realised ROI, adoption, outcomes)",
          "The expansion / renewal opportunity and its incremental value",
          "Roadmap and partnership continuity",
        ],
        recommendedCtas: ["Review your results", "Plan the next phase"],
        suggestedProofPointTypes: ["account's own realised metrics", "expansion ROI", "benchmark vs. peers"],
        suggestedCaseStudyCriteria: [
          "existing customers who expanded successfully",
          "same segment, demonstrates compounding value",
        ],
        reasoning,
      };
      break;
    }

    case "book-meeting": {
      const fm = pickFirstMeetingTemplate(input);
      reasoning.push(`→ ${fm.label} template (funnel stage: first-meeting)`);
      plan = {
        recommendedTemplateSlug: fm.slug,
        funnelStage: "first-meeting",
        recommendedBlocks: ["dso-heartland-hero", "pas-section", "benefits-grid", "dso-success-stories", "bottom-cta"],
        messagingPriorities: [
          seg ? `${seg}-specific pains and value props (segment messaging, not core)` : "The prospect's primary pain and the promised land",
          persona ? `What the ${persona} persona cares about most` : "A clear, single next step",
          "A reason to take a first meeting now",
        ],
        recommendedCtas: ["Book a 30-minute intro", "See how it works"],
        suggestedProofPointTypes: ["relatable peer story", "one striking stat", "social proof / logos"],
        suggestedCaseStudyCriteria: [
          "same segment, recognisable peer",
          "fast, relatable win (not the biggest, the most relevant)",
        ],
        reasoning,
      };
      break;
    }

    case "from-scratch":
    default: {
      // No template — the AI freely assembles from the segment/brand vocabulary.
      reasoning.push("→ No fixed template — AI assembles a custom layout from the segment + brand vocabulary");
      plan = {
        recommendedTemplateSlug: null,
        funnelStage: null,
        recommendedBlocks: ["hero", "trust-bar", "benefits-grid", "testimonial", "how-it-works", "comparison", "bottom-cta"],
        messagingPriorities: [
          seg ? `Lead with ${seg} segment messaging (overrides core)` : "Lead with the brand's core value props",
          persona ? `Address the ${persona} persona` : "Speak to the account's situation",
          "Personalise every block to the account",
        ],
        recommendedCtas: ["Get started", "Book a conversation"],
        suggestedProofPointTypes: ["customer stats", "testimonials", "comparison vs. status quo"],
        suggestedCaseStudyCriteria: ["most relevant to this account's segment and scale"],
        reasoning,
      };
      break;
    }
  }

  return plan;
}
