/**
 * Hand-curated microsite exemplars used as few-shot examples in the AI
 * generation prompt. These represent the "gold standard" of what a great
 * generated microsite looks like — the AI is asked to study them and match
 * the register, specificity and structure (not copy them verbatim).
 *
 * Sources (anonymized DSO-partner microsites Dandy actually shipped):
 *   - PDS regionals      → exemplar "pds-regionals"      (dso-corporate)
 *   - DCA practices      → exemplar "dca-practices"      (dso-practice)
 *   - Smilist pilot      → exemplar "smilist-pilot"      (dso-practice, pilot stage)
 *
 * Maintenance notes:
 *   - Each exemplar's `blocks[].type` MUST match an entry in
 *     BLOCK_PROP_SCHEMAS in generate-microsite.ts. If you rename a block
 *     type, update both files.
 *   - Image / video URLs are intentionally empty strings — the runtime
 *     media-catalog instruction (added later in the prompt) tells the
 *     model to ONLY use catalogued URLs, so example URLs would be
 *     misleading.
 *   - CTA URLs use placeholder "#" — the runtime layer rewrites these
 *     to the brand's chilipiperUrl or defaultCtaUrl.
 *   - When adding new exemplars, add a new entry below and (if the
 *     scenario is novel) extend `segmentHints` so the selector can pick
 *     it for the right accounts.
 */

export interface MicrositeExemplarPage {
  title: string;
  slug: string;
  blocks: Array<{ type: string; props: Record<string, unknown> }>;
}

export interface MicrositeExemplar {
  /** Stable id used for logging which exemplars were sent for a given run. */
  id: string;
  /**
   * Which audience segment this exemplar applies to. Matched against the live
   * `segment.id` in pickExemplars (`e.audience === segmentId`).
   *
   * KNOWN LIMITATION (brittle coupling): this is a checked-in code file pinned to
   * a specific tenant's DB-generated segment ids (Dandy's `seg-…` ids). If that
   * segment is deleted and recreated via Brand Settings it gets a NEW auto id,
   * `e.audience === segment.id` silently stops matching, and the EXEMPLARS
   * section quietly disappears from generated microsites (no compile-time error).
   * Hardening options tracked for post-launch: (a) add a stable, admin-editable
   * `salesConsoleExemplarKey` on AudienceSegment and match on that instead of the
   * raw id; or (b) move exemplars into per-tenant brand-config so they travel
   * with the brand record. Until then: if exemplars stop firing for a tenant,
   * check that these ids still match that tenant's current segment ids.
   */
  audience: string;
  /**
   * Lowercase substrings to match against the account's `segment` field.
   * The selector boosts exemplars whose hints appear in the segment
   * string (case-insensitive). Empty array = no segment-specific boost.
   */
  segmentHints: string[];
  /** Human-readable scenario label inserted into the prompt header. */
  scenario: string;
  /** The example microsite payload (matches the Block[] return shape). */
  page: MicrositeExemplarPage;
}

/* ─── EXEMPLAR 1 — DSO corporate / regional leadership ───────────────────── */
const PDS_REGIONALS: MicrositeExemplar = {
  id: "pds-regionals",
  // Real Dandy segment id for "Enterprise DSOs" (was legacy enum "dso-corporate").
  // Exemplars are Dandy-only content (gated by salesConsole.useBuiltInExemplars)
  // and pickExemplars matches `audience === segment.id`, so this must be the
  // tenant's actual segment id, not the retired hardcoded enum value.
  audience: "seg-1774646615094-6blv1",
  segmentHints: ["regional", "regional manager", "leadership", "operations"],
  scenario: "Enterprise DSO regional leadership — coaching with data, multi-site visibility",
  page: {
    title: "Dandy for PDS Health regionals — more visibility, faster workflows",
    slug: "pds-regionals",
    blocks: [
      {
        type: "dso-heartland-hero",
        props: {
          eyebrow: "Built for PDS Health",
          headline: "More visibility. Faster workflows. Better results.",
          companyName: "PDS Health",
          subheadline: "Dandy gives regional leaders real-time data on clinical performance, lab workflows, and provider activity — so you can coach with evidence, not assumptions.",
          primaryCtaText: "Talk to us",
          primaryCtaUrl: "#",
          secondaryCtaText: "See how it works",
          secondaryCtaUrl: "#",
          stats: [
            { value: "30%", label: "Avg case acceptance lift" },
            { value: "89%", label: "Fewer remakes with AI Scan Review" },
            { value: "50%", label: "Denture appointments saved" },
            { value: "$0", label: "CAPEX to get started" },
          ],
        },
      },
      {
        type: "dso-stat-bar",
        props: {
          stats: [
            { value: "2.67%", label: "Remake rate" },
            { value: "$0", label: "CAPEX to get started" },
            { value: "30%", label: "Case acceptance lift" },
          ],
          backgroundStyle: "dark",
        },
      },
      {
        type: "dso-challenges",
        props: {
          eyebrow: "The problem",
          headline: "You can't coach what you can't see.",
          backgroundStyle: "white",
          layout: "4-col",
          challenges: [
            { title: "No visibility into clinical performance", desc: "You see the numbers — but not what's driving them. Who's scanning, who's not, and where quality varies." },
            { title: "Inconsistent workflows across locations", desc: "Every office runs removables differently. No standard process means unpredictable quality and efficiency." },
            { title: "Coaching without data", desc: "You're accountable for performance across your region — but coaching without real-time clinical data is guesswork." },
            { title: "Capacity lost to inefficient processes", desc: "4-6 appointments per denture case. That's chair time your providers could be using on higher-value production." },
          ],
        },
      },
      {
        type: "dso-insights-dashboard",
        props: {
          eyebrow: "Dandy Insights",
          headline: "One dashboard. Every location.",
          subheadline: "Real-time scan analysis, AI-flagged margin errors, feature usage and adoption, lab spend and revenue — every scan, every prep, every provider, all in one place.",
          practiceLabel: "PDS Health",
          backgroundStyle: "dark",
          dashboardVariant: "dark",
        },
      },
      {
        type: "dso-success-stories",
        props: {
          eyebrow: "Customer story",
          headline: "DCA went from flat denture adoption to 16x volume growth in 6 months.",
          backgroundStyle: "light-gray",
          cases: [
            { name: "Dental Care Alliance", stat: "16x", label: "Denture volume growth in 6 months", quote: "They've changed the mindset for so many providers to go in and try dentures with the time savings.", author: "Jamie Dunkley, Division President, DCA" },
            { name: "Dental Care Alliance", stat: "1,446", label: "Appointments saved", quote: "Cases always come in time. Excellent customer service.", author: "VA Smiles / Advanced Dental, DCA" },
          ],
        },
      },
      {
        type: "dso-pilot-steps",
        props: {
          eyebrow: "How it works",
          headline: "Start small. Prove it out. Then scale.",
          subheadline: "Growth should be proven before it's scaled. Dandy helps validate impact with a small number of locations and then scale with confidence.",
          backgroundStyle: "white",
          steps: [
            {
              title: "Launch a pilot",
              subtitle: "Start with 15–20 offices",
              desc: "Dandy deploys premium scanners, onboards doctors with hands-on training, and integrates into existing workflows — no CAPEX, no disruption.",
              details: [
                "Premium hardware included for every operatory",
                "Dedicated field team manages change management",
                "Doctors trained and scanning within days",
              ],
            },
            {
              title: "Validate impact",
              subtitle: "Measure results in 60–90 days",
              desc: "Track remake reduction, chair time recovered, and same-store revenue lift in real time — proving ROI before you scale.",
              details: [
                "Live dashboard tracks pilot KPIs",
                "Compare pilot offices vs. control group",
                "Executive-ready reporting for leadership review",
              ],
            },
            {
              title: "Scale with confidence",
              subtitle: "Roll out across the network",
              desc: "Expand across your entire network with the same standard, same playbook, and same results — predictable execution at enterprise scale.",
              details: [
                "Consistent onboarding across all locations",
                "One standard across every office and brand",
                "MSA ensures network-wide alignment at scale",
              ],
            },
          ],
        },
      },
      {
        type: "dso-final-cta",
        props: {
          eyebrow: "Next steps",
          headline: "Better dentistry starts with Dandy.",
          subheadline: "Schedule an intro call to see if Dandy is right for your region.",
          primaryCtaText: "Get started",
          primaryCtaUrl: "#",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
          backgroundStyle: "dark",
        },
      },
    ],
  },
};

/* ─── EXEMPLAR 2 — DSO practice (mature partnership) ─────────────────────── */
const DCA_PRACTICES: MicrositeExemplar = {
  id: "dca-practices",
  // Real Dandy segment id for "DSO Practices (Land & Expand)" (was legacy enum
  // "dso-practice"). See pds-regionals above for why this is a real segment id.
  audience: "seg-1774716006240-qdgu9",
  segmentHints: ["dca", "dental care alliance", "established", "rollout"],
  scenario: "Established DSO partnership rolled out to individual practices in the network",
  page: {
    title: "DCA × Dandy — see why 150+ DCA practices choose Dandy",
    slug: "dca-practices",
    blocks: [
      {
        type: "dso-practice-nav",
        props: {
          dsoName: "Dental Care Alliance",
          links: [
            { label: "Perks", anchor: "#perks" },
            { label: "Workflow", anchor: "#workflow" },
            { label: "Get started", anchor: "#cta" },
          ],
          ctaText: "Get started",
          ctaUrl: "#",
        },
      },
      {
        type: "dso-practice-hero",
        props: {
          eyebrow: "DCA × Dandy",
          headline: "See why 150+ DCA practices choose Dandy.",
          subheadline: "Dandy empowers your practice to deliver exceptional patient care through industry-leading turnaround times, AI-powered technology, and preferred partner pricing.",
          primaryCtaText: "Get started",
          primaryCtaUrl: "#",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
          trustLine: "Trusted by 8,000 practices",
          backgroundStyle: "dark",
        },
      },
      {
        type: "dso-stat-row",
        props: {
          eyebrow: "By the numbers",
          headline: "Real results across the DCA network.",
          items: [
            { value: "61", label: "DCA practices net promoter score", detail: "Based on partner-practice NPS surveys" },
            { value: "$0", label: "Scanner included for DCA practices", detail: "TRIOS or Dandy Vision in every operatory" },
            { value: "1,226+", label: "Trainings delivered to DCA teams", detail: "Hands-on, CE-accredited" },
            { value: "97%", label: "Retention rate for DCA practices", detail: "Year-over-year" },
          ],
          backgroundStyle: "white",
        },
      },
      {
        type: "dso-partnership-perks",
        props: {
          eyebrow: "Partnership perks & benefits",
          headline: "Exclusive to DCA practices.",
          subheadline: "Real perks DCA negotiated for every practice in the network.",
          backgroundStyle: "light-gray",
          perks: [
            { icon: "DollarSign", title: "$2,000 lab credit for new customers", desc: "Exclusive, discounted pricing available only to DCA practices." },
            { icon: "Scan", title: "Best-in-class scanners, included", desc: "Access to TRIOS or Dandy Vision scanners across your practices for free." },
            { icon: "MessageSquare", title: "Live clinical support", desc: "Chat with technicians, join video calls, and get scans reviewed in two minutes or less." },
            { icon: "GraduationCap", title: "Free CE credits", desc: "Accredited courses on digital dentistry and scanning workflows." },
            { icon: "Users", title: "Dedicated DCA team", desc: "Account manager, trainer, and DSO partnerships lead overseeing every DCA practice." },
            { icon: "Truck", title: "5-day zirconia crowns", desc: "Standard turnaround for DCA practices, every case." },
          ],
        },
      },
      {
        type: "dso-split-feature",
        props: {
          eyebrow: "The Dandy way",
          headline: "Smarter workflows start here.",
          body: "Dandy transforms your practice with AI-powered tools and reliable results — saving chair time and improving patient care. Old way: juggling multiple vendors, limited to one scanner, issues caught only after the case comes back, dentures requiring 4–6 appointments. Dandy way: one trusted partner, a free scanner for every operatory, AI catches issues while the patient is still in the chair, dentures in 2 visits.",
          bullets: [
            "One partner managing your entire digital workflow",
            "A free scanner for every operatory",
            "AI Scan Review flags issues chairside, not after the case comes back",
            "Digital dentures in 2 visits instead of 4–6",
            "Premium-quality restorations without the premium price",
          ],
          ctaText: "Get started",
          ctaUrl: "#",
          imagePosition: "right",
          backgroundStyle: "white",
        },
      },
      {
        type: "dso-software-showcase",
        props: {
          eyebrow: "DCA × Dandy",
          headline: "Elevating patient care together.",
          body: "Real outcomes from DCA practices already on Dandy.",
          features: [
            { icon: "Clock", label: "5-day zirconia crowns" },
            { icon: "Calendar", label: "2-appointment dentures" },
            { icon: "MessageSquare", label: "Clinical support in under 2 minutes" },
            { icon: "Award", label: "97% case retention" },
          ],
          ctaText: "Get started",
          ctaUrl: "#",
          backgroundStyle: "dark",
          layout: "grid",
        },
      },
      {
        type: "dso-faq",
        props: {
          eyebrow: "Common questions",
          headline: "What DCA practices ask before getting started.",
          subheadline: "",
          backgroundStyle: "white",
          items: [
            { question: "What's the cost to get started as a DCA practice?", answer: "$0 CAPEX. Scanners and onboarding are included as part of the DCA × Dandy partnership. Plus a $2,000 lab credit for new customers." },
            { question: "Which scanner do we get?", answer: "TRIOS or Dandy Vision — your choice. Both are best-in-class intraoral scanners, configured and calibrated for your operatory before they ship." },
            { question: "How fast is onboarding?", answer: "Most DCA practices are scanning real cases within days of equipment delivery. Hands-on training is led by your dedicated trainer at your pace." },
            { question: "What happens if a case doesn't fit?", answer: "Free remakes. Dandy backs every case with a guarantee — and AI Scan Review flags prep issues chairside before the case ever ships to the lab." },
            { question: "Who supports our practice day-to-day?", answer: "A dedicated DCA team: an account manager, a trainer, and a DSO partnerships lead — all overseeing your practice and the broader DCA network." },
          ],
        },
      },
      {
        type: "dso-activation-steps",
        props: {
          eyebrow: "Getting started",
          headline: "Four steps to going live with Dandy.",
          subheadline: "Our onboarding team handles every detail — from scanner delivery to your first case.",
          backgroundStyle: "light-gray",
          steps: [
            { step: "1", title: "Schedule your kickoff", desc: "Meet your dedicated Dandy account manager to align on rollout timeline, goals, and discuss any questions." },
            { step: "2", title: "Equipment setup & delivery", desc: "We ship and install your intraoral scanners and laptops — every operatory fully configured, calibrated, and ready to scan." },
            { step: "3", title: "Clinical team training", desc: "Hands-on training for doctors and staff covering scan technique, case submission, and workflow integration — at your pace." },
            { step: "4", title: "First cases & go live", desc: "Submit your first cases and experience the Dandy difference — real-time case tracking and dedicated support from day one." },
          ],
          ctaText: "Get started",
          ctaUrl: "#",
        },
      },
      {
        type: "dso-final-cta",
        props: {
          eyebrow: "Limited time offer",
          headline: "Get a $2,000 lab credit when you get started.",
          subheadline: "See why 8,000+ dentists and 150+ DCA practices choose Dandy.",
          primaryCtaText: "Get started",
          primaryCtaUrl: "#",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
          backgroundStyle: "dark",
        },
      },
    ],
  },
};

/* ─── EXEMPLAR 3 — DSO practice (early pilot) ────────────────────────────── */
const SMILIST_PILOT: MicrositeExemplar = {
  id: "smilist-pilot",
  // Real Dandy segment id for "DSO Practices (Land & Expand)" (was legacy enum
  // "dso-practice"). See pds-regionals above for why this is a real segment id.
  audience: "seg-1774716006240-qdgu9",
  segmentHints: ["pilot", "trial", "smilist", "early"],
  scenario: "DSO practice in early pilot stage — leaner deck, smaller credit, prove-it-out tone",
  page: {
    title: "Built for The Smilist — Dandy pilot",
    slug: "smilist-pilot",
    blocks: [
      {
        type: "dso-practice-nav",
        props: {
          dsoName: "The Smilist",
          links: [
            { label: "Perks", anchor: "#perks" },
            { label: "Steps", anchor: "#steps" },
            { label: "Get started", anchor: "#cta" },
          ],
          ctaText: "Get started — Smilist pilot",
          ctaUrl: "#",
        },
      },
      {
        type: "dso-practice-hero",
        props: {
          eyebrow: "Built for The Smilist",
          headline: "You don't have to choose between clinical quality and enterprise value.",
          subheadline: "Dandy gives dentists tools they actually use — and operators visibility across every practice.",
          primaryCtaText: "Get started — Smilist pilot",
          primaryCtaUrl: "#",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
          trustLine: "8,000+ practices already on Dandy",
          backgroundStyle: "dark",
        },
      },
      {
        type: "dso-partnership-perks",
        props: {
          eyebrow: "Partnership perks & benefits",
          headline: "What pilot practices get on day one.",
          subheadline: "Negotiated specifically for The Smilist pilot.",
          backgroundStyle: "white",
          perks: [
            { icon: "DollarSign", title: "$800 lab credit for Smilist pilot customers", desc: "Exclusive, discounted pricing available only to Smilist affiliated practices." },
            { icon: "Scan", title: "Best-in-class scanners, included", desc: "Access to TRIOS or Dandy Vision scanners across your practices for free." },
            { icon: "MessageSquare", title: "Live clinical support", desc: "Chat with technicians, join video calls, and get scans reviewed in two minutes or less." },
            { icon: "GraduationCap", title: "Free CE credits", desc: "Accredited courses on digital dentistry and scanning workflows." },
            { icon: "Truck", title: "5-day crown turnaround", desc: "Standard for every Smilist pilot case." },
            { icon: "Shield", title: "Free remakes, no questions", desc: "If a case doesn't fit, we make it again." },
          ],
        },
      },
      {
        type: "dso-activation-steps",
        props: {
          eyebrow: "Getting started",
          headline: "Four steps to going live with Dandy.",
          subheadline: "Our onboarding team handles every detail — from scanner delivery to your first case.",
          backgroundStyle: "light-gray",
          steps: [
            { step: "1", title: "Schedule your kickoff", desc: "Meet your dedicated Dandy account manager to align on rollout timeline, goals, and discuss any questions." },
            { step: "2", title: "Equipment setup & delivery", desc: "We ship and install your intraoral scanners and laptops — every operatory fully configured, calibrated, and ready to scan." },
            { step: "3", title: "Clinical team training", desc: "Hands-on training for doctors and staff covering scan technique, case submission, and workflow integration — at your pace." },
            { step: "4", title: "First cases & go live", desc: "Submit your first cases and experience the Dandy difference — real-time case tracking and dedicated support from day one." },
          ],
          ctaText: "Get started — Smilist pilot",
          ctaUrl: "#",
        },
      },
      {
        type: "dso-split-feature",
        props: {
          eyebrow: "The Dandy way",
          headline: "Smarter workflows start here.",
          body: "Dandy transforms your practice with AI-powered tools and reliable results — saving chair time and improving patient care.",
          bullets: [
            "One partner managing your entire digital workflow",
            "A free scanner for every operatory",
            "AI catches issues chairside, not after the case comes back",
            "Digital dentures in 2 visits instead of 4–6",
            "Premium-quality restorations without the premium price",
          ],
          ctaText: "Get started — Smilist pilot",
          ctaUrl: "#",
          imagePosition: "left",
          backgroundStyle: "white",
        },
      },
      {
        type: "dso-final-cta",
        props: {
          eyebrow: "Limited time offer",
          headline: "Get an $800 lab credit when you get started.",
          subheadline: "See why 8,000+ dentists choose Dandy.",
          primaryCtaText: "Get started — Smilist pilot",
          primaryCtaUrl: "#",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
          backgroundStyle: "dark",
        },
      },
    ],
  },
};

export const EXEMPLARS: MicrositeExemplar[] = [
  PDS_REGIONALS,
  DCA_PRACTICES,
  SMILIST_PILOT,
];

/**
 * Pick the exemplars most relevant to a given audience + account segment.
 *
 * Strategy:
 *  1. Filter EXEMPLARS to those matching the requested audience.
 *  2. If accountSegment matches any exemplar's segmentHints (case-insensitive
 *     substring on either side), boost those to the front.
 *  3. Cap at `max` (default 2) to keep token usage in check.
 *
 * Returns an empty array when no exemplars exist for the audience — caller
 * should fall back gracefully (e.g. omit the EXEMPLARS section entirely).
 *
 * KNOWN LIMITATION: matching is `e.audience === segmentId` where segmentId is the
 * live `segment.id`. Because EXEMPLARS is a checked-in file pinned to Dandy's
 * DB-generated segment ids, recreating a segment in Brand Settings mints a new id
 * and silently breaks matching (no error — the EXEMPLARS section just vanishes).
 * See the `audience` field doc on MicrositeExemplar for the post-launch hardening
 * options (stable exemplar key, or per-tenant brand-config exemplars).
 */
export function pickExemplars(
  segmentId: string,
  accountSegment: string | null | undefined,
  max = 2,
  opts: { useBuiltIn?: boolean } = {},
): MicrositeExemplar[] {
  // The shipped EXEMPLARS are Dandy-branded PDS/DCA/Smilist microsites.
  // Other tenants must opt-in or they'd leak Dandy customer names into
  // their AI prompts.
  if (opts.useBuiltIn === false) return [];
  const eligible = EXEMPLARS.filter(e => e.audience === segmentId);
  if (eligible.length === 0) return [];

  const seg = (accountSegment ?? "").trim().toLowerCase();
  if (!seg) return eligible.slice(0, max);

  const matches = (e: MicrositeExemplar) =>
    e.segmentHints.some(h => {
      const hint = h.trim().toLowerCase();
      return hint.length > 0 && (seg.includes(hint) || hint.includes(seg));
    });

  const boosted = eligible.filter(matches);
  const others = eligible.filter(e => !matches(e));
  return [...boosted, ...others].slice(0, max);
}

/**
 * A tenant-authored microsite reference page (free-form text) used as a few-shot
 * style example. This is the generic, white-label path: any tenant can supply
 * their own exemplars from Brand Settings without relying on the built-in
 * (Dandy) sample pages. Stored on `salesConsole.customMicrositeExemplars`.
 */
export interface CustomMicrositeExemplar {
  /** Short scenario/audience label shown in the prompt header. */
  label: string;
  /** The example microsite copy or a detailed description of a great page. */
  content: string;
}

/**
 * Parse + validate tenant-authored custom exemplars off the brand config blob.
 * Drops entries with no usable `content`. Capped at 3 to keep token usage in
 * check. Unlike the built-in exemplars, these are NOT gated by
 * useBuiltInExemplars — they're the tenant's own content, always applied.
 */
export function parseCustomExemplars(v: unknown): CustomMicrositeExemplar[] {
  if (!Array.isArray(v)) return [];
  // Bound per-exemplar size so a tenant pasting a huge document can't blow up
  // the prompt token budget (or get silently truncated by the model).
  const MAX_LABEL = 200;
  const MAX_CONTENT = 4000;
  const out: CustomMicrositeExemplar[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const label = typeof obj.label === "string" ? obj.label.trim().slice(0, MAX_LABEL) : "";
    const content = typeof obj.content === "string" ? obj.content.trim().slice(0, MAX_CONTENT) : "";
    if (!content) continue;
    out.push({ label, content });
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Format the picked exemplars as a prompt section. Built-in exemplars are
 * emitted as page JSON; tenant `custom` exemplars are emitted as free-form text.
 * Returns "" when both inputs are empty so the prompt builder can drop the
 * section cleanly via filter(Boolean).
 */
export function formatExemplarsSection(
  exemplars: MicrositeExemplar[],
  custom: CustomMicrositeExemplar[] = [],
  // When TRUE, this page's block lineup + order are fixed by a configured
  // outline (a segment/brand page outline in Brand Settings) or a template.
  // In that case the exemplars must NOT carry the "don't reproduce this layout /
  // choose your own lineup" framing — that contradicts the authored outline and
  // pushes the model to drift off the configured structure. The outline is
  // authoritative for structure; the exemplars are then voice/quality refs only.
  opts: { layoutIsAuthored?: boolean } = {},
): string {
  if (exemplars.length === 0 && custom.length === 0) return "";

  const intro = [
    opts.layoutIsAuthored
      ? "EXEMPLARS — these are the gold standard for the QUALITY of a great microsite: voice, register, level of specificity, and information density. Study them for THOSE qualities and match them. This page's block lineup and section order are already set by the configured outline below — follow that outline exactly. The exemplars are voice and quality references only, not a competing layout. Do NOT copy their words — write something equally good, in the brand's own voice, for the new account."
      : "EXEMPLARS — these are the gold standard for the QUALITY of a great microsite: voice, register, level of specificity, and information density. Study them for THOSE qualities. Their block selection and section order are just ONE example, NOT a layout to reproduce — choose the section lineup and order that best fit THIS account (follow the LAYOUT rules below). Do NOT copy their words OR their structure — write something equally good, but structurally its own, for the new account.",
    "",
  ].join("\n");

  const builtInBlocks = exemplars.map((e, i) => {
    const json = JSON.stringify(e.page, null, 2);
    return `EXAMPLE ${i + 1} — ${e.scenario}:\n${json}`;
  });

  const customBlocks = custom.map((e, i) => {
    const n = exemplars.length + i + 1;
    const label = e.label || "Reference microsite";
    return `EXAMPLE ${n} — ${label}:\n${e.content}`;
  });

  const blocks = [...builtInBlocks, ...customBlocks].join("\n\n");

  const outro = [
    "",
    "The microsite you generate should feel like it belongs alongside these. If yours doesn't measure up, rewrite it before returning.",
  ].join("\n");

  return [intro, blocks, outro].join("\n");
}
