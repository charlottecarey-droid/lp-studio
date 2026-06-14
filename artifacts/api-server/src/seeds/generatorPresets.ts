// GLOBAL generator-preset seeds (June 2026).
//
// Seeds the current HARDCODED quick-start options as GLOBAL presets
// (generator_presets.tenant_id NULL), so the owner can curate them in
// Superadmin. Applied marker-gated + idempotent (ON CONFLICT via a stable
// seed_key) by api-server/src/migrate.ts (generator_presets_seed_v1).
//
// ENABLED-BY-DEFAULT choice (documented per the owner's instruction):
//   • MARKETING presets seed DISABLED (enabled=false). The marketing starter
//     chips were intentionally hidden (MARKETING_STARTER_CHIPS_ENABLED=false)
//     pending curation; seeding them disabled preserves that "hidden until a
//     superadmin turns them on" behavior — flipping the code flag is replaced by
//     enabling presets in Superadmin.
//   • SALES objective presets seed ENABLED (enabled=true) so the microsite
//     generator's objective cards keep working exactly as today. (The sales
//     generator ALSO falls back to its built-in OBJECTIVE_CARDS when the config
//     is empty, so unconfigured tenants are never broken either way.)
//
// TEMPLATE TIES: where a current option maps cleanly onto a seeded global
// template slug, we tie it (the tie is only a recommendation INPUT —
// selectEligibleTemplate still gates whether it surfaces). The marketing chips
// historically did NOT tie to a specific template (they only prefilled prompt
// text + relied on the backend template-intent matcher), so most marketing
// presets seed with NO tie ("AI from scratch") and keep their intent-bearing
// prompt phrasing; a couple tie to the obvious global template.

export interface GlobalPresetSeed {
  /** Stable idempotency key (seeded into a marker-keyed dedupe, NOT a column on
   *  its own — we match on (surface,label) when re-seeding). */
  seedKey: string;
  surface: "marketing" | "sales" | "both";
  label: string;
  description: string | null;
  icon: string | null;
  promptSkeleton: string | null;
  objective: string | null;
  tiedTemplateSlug: string | null;
  tiedTemplateIntent: string | null;
  enabled: boolean;
  sortOrder: number;
}

// ── MARKETING — mirrors StarterPromptChips.STARTER_PROMPTS (seeded DISABLED) ──
const MARKETING_SEEDS: GlobalPresetSeed[] = [
  {
    seedKey: "mk-summer-sale",
    surface: "marketing",
    label: "Summer sale",
    description: "A limited-time sale/promotion landing page.",
    icon: "Tag",
    promptSkeleton:
      "A bold summer sale landing page for [product/store], highlighting limited-time discounts, with a hero, featured deals, social proof, and a strong shop-now CTA",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 10,
  },
  {
    seedKey: "mk-product-launch",
    surface: "marketing",
    label: "Product launch",
    description: "Announce a new product with features, proof, and pricing.",
    icon: "Rocket",
    promptSkeleton:
      "A product launch page announcing [product], with an announcement hero, key features, social proof, pricing, and an early-access CTA",
    objective: null,
    // Obvious tie to the launch template; gated by eligibility downstream.
    tiedTemplateSlug: "global-product-launch",
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 20,
  },
  {
    seedKey: "mk-podcast-series",
    surface: "marketing",
    label: "Podcast series",
    description: "An episode-library page for a podcast/show.",
    icon: "Mic",
    promptSkeleton:
      "A podcast series page for [show name] with episode library, host spotlight, and a subscribe CTA",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 30,
  },
  {
    seedKey: "mk-event-rsvp",
    surface: "marketing",
    label: "Event RSVP",
    description: "An event page with agenda, speakers, and an RSVP form.",
    icon: "CalendarDays",
    promptSkeleton:
      "An event landing page for [event] with date/location, agenda highlights, speakers, and an RSVP form",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 40,
  },
  {
    seedKey: "mk-pricing-page",
    surface: "marketing",
    label: "Pricing page",
    description: "A pricing page with tiers, comparison, and FAQ.",
    icon: "Table",
    promptSkeleton:
      "A pricing page for [product] with 3 tiers, feature comparison, FAQ, and a free-trial CTA",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 50,
  },
  {
    seedKey: "mk-customer-story",
    surface: "marketing",
    label: "Customer story",
    description: "A case-study / customer story page.",
    icon: "Quote",
    promptSkeleton:
      "A customer story page about how [customer] achieved [result] with [product], with challenge/solution/results and a quote",
    objective: null,
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: false,
    sortOrder: 60,
  },
];

// ── SALES — mirrors micrositeFlow.OBJECTIVE_CARDS (seeded ENABLED) ──
// objective values MUST match the MicrositeObjective enum. Template ties point
// at the obvious global template for the motion where one exists; the rest leave
// the tie null and let the recommend engine pick (the objective already drives
// it). "Start from scratch" is intentionally last + tie-free.
const SALES_SEEDS: GlobalPresetSeed[] = [
  {
    seedKey: "sl-book-meeting",
    surface: "sales",
    label: "Book a meeting",
    description: "Earn a first conversation with a new prospect.",
    icon: "CalendarCheck",
    promptSkeleton: null,
    objective: "book-meeting",
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 10,
  },
  {
    seedKey: "sl-advance-opportunity",
    surface: "sales",
    label: "Advance an opportunity",
    description: "Move an active deal toward the next step.",
    icon: "TrendingUp",
    promptSkeleton: null,
    objective: "advance-opportunity",
    tiedTemplateSlug: "global-deal-room",
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 20,
  },
  {
    seedKey: "sl-re-engage-stalled",
    surface: "sales",
    label: "Re-engage a stalled deal",
    description: "Reopen a conversation that went quiet.",
    icon: "RefreshCw",
    promptSkeleton: null,
    objective: "re-engage-stalled",
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 30,
  },
  {
    seedKey: "sl-support-proposal",
    surface: "sales",
    label: "Support a proposal",
    description: "Back up a live proposal with proof and detail.",
    icon: "FileCheck",
    promptSkeleton: null,
    objective: "support-proposal",
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 40,
  },
  {
    seedKey: "sl-share-business-case",
    surface: "sales",
    label: "Share a business case",
    description: "Make the quantified case for the decision.",
    icon: "Calculator",
    promptSkeleton: null,
    objective: "share-business-case",
    tiedTemplateSlug: "global-business-case-centered",
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 50,
  },
  {
    seedKey: "sl-exec-presentation",
    surface: "sales",
    label: "Prepare for an executive presentation",
    description: "A polished brief for the decision-maker room.",
    icon: "Presentation",
    promptSkeleton: null,
    objective: "exec-presentation",
    tiedTemplateSlug: "global-exec-decision-brief",
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 60,
  },
  {
    seedKey: "sl-drive-expansion",
    surface: "sales",
    label: "Drive expansion within an account",
    description: "Grow an existing customer relationship.",
    icon: "Sprout",
    promptSkeleton: null,
    objective: "drive-expansion",
    tiedTemplateSlug: "global-value-renewal-review",
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 70,
  },
  {
    seedKey: "sl-from-scratch",
    surface: "sales",
    label: "Start from scratch",
    description: "Let AI assemble a custom page — no fixed goal.",
    icon: "Wand2",
    promptSkeleton: null,
    objective: "from-scratch",
    tiedTemplateSlug: null,
    tiedTemplateIntent: null,
    enabled: true,
    sortOrder: 80,
  },
];

export const GLOBAL_GENERATOR_PRESET_SEEDS: GlobalPresetSeed[] = [
  ...MARKETING_SEEDS,
  ...SALES_SEEDS,
];
