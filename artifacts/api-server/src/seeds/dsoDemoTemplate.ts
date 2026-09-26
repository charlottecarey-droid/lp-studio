// "Book a DSO working session" — the Stack family's conversion page: one job,
// get a qualified DSO leader onto a 30-minute call. Built from the CRO
// research summarised below plus the DSO buying-committee brief in this repo.
//
// CRO principles applied (Sept 2026 sources: Surface Labs benchmarks, Unbounce
// / Instapage demo-page guides, Walnut / Apexure demo-page teardowns):
//  - one dominant action, repeated (form in the hero, calendar link, close);
//  - ≤5 fields (3-field forms convert ~10%, 9-field ~3.6%) — name, work
//    email, company, locations; locations doubles as qualification;
//  - named-customer social proof ADJACENT to the form (+22% vs none);
//  - "what happens on the call" agenda to cut no-shows and set expectations;
//  - a risk-reversal line next to the CTA and a direct-to-calendar escape hatch;
//  - product shown, not described (the Insights recording on the agenda step);
//  - objections answered on the page (FAQ) so the visitor doesn't need to
//    "come back later".
//
// DSO-specific angle (repo DSO_Segment_Input.md): the CFO wants "show me the
// numbers" before committing, the CDO fears mandate resistance, the COO fears
// adoption risk across 200 doctors. So the offer is a WORKING SESSION on the
// group's own data, not a feature demo, and it ends in a scoped pilot.
//
// Proof and figures are the same sourced DCA / APEX / MCDC facts used by the
// "Dandy for DSOs" page (see dandyForDsosTemplate.ts header). The $250 gift
// card incentive mirrors meetdandy.com/get-started ("Get a $250 Amazon Gift
// Card with Your Demo … issued after a doctor from your practice joins the
// call") — left ON here because it is Dandy's live offer; remove the
// `incentiveText` if enterprise deals shouldn't carry it.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-dandy-dso-demo";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;

const VIDEO_INSIGHTS = "/api/storage/objects/uploads/f6f413fd-9db8-4772-b888-b6d45e58bbb9";
const VIDEO_DSO_SIZZLE = "/api/storage/objects/uploads/cd964e87-3fc8-432d-af6c-659c3387fe27";
const VIDEO_VISION_SCANNER = "/api/storage/objects/uploads/68967d1d-42e1-4ab9-989c-25e7cdef39e6";
const VIDEO_AI_SCAN_REVIEW = "/videos/ai-scan-review.mp4";
const VIDEO_BROLL = "/videos/dandy-broll.mp4";

const DEMO_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";
const DCA_STORY_URL = "https://www.meetdandy.com/customer-stories/dca-lab-consolidation/";

const blocks: Block[] = [
  {
    id: sid("dandy-site-header", 1),
    type: "dandy-site-header",
    props: {
      logoUrl: "",
      phoneNumber: "(315)-859-0703",
      phoneLabel: "Sales: (315)-859-0703",
      primaryCtaText: "BOOK A SESSION",
      primaryCtaUrl: "#book",
      secondaryCtaText: "PICK A TIME",
      secondaryCtaUrl: DEMO_URL,
      navLinks: [
        { label: "For DSOs", url: "https://www.meetdandy.com/solutions/dso/" },
        { label: "Customer stories", url: "https://www.meetdandy.com/customer-stories/" },
        { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
      ],
    },
  },
  {
    id: sid("glow-form-hero", 2),
    type: "glow-form-hero",
    props: {
      eyebrow: "For DSO leadership teams",
      eyebrowIcon: "CalendarCheck",
      headline: "See what your lab spend is hiding.",
      subheadline:
        "A 30-minute working session with Dandy's enterprise team, on your group's own numbers. You leave with a sized opportunity — remakes, chair time, CapEx — and a pilot scoped to prove it.",
      bullets: [
        "Your remake, turnaround and lab-spend exposure, by location",
        "Dandy Insights on real network data — not slides",
        "A 5–10 office pilot plan with success criteria",
      ],
      proofText: "Trusted by",
      logos: [
        { name: "Dental Care Alliance" },
        { name: "APEX Dental Partners" },
        { name: "My Community Dental Centers" },
      ],
      formTitle: "Book your working session",
      formSubtitle: "Enterprise team only — no SDR hand-offs.",
      fields: ["firstName", "lastName", "email", "company", "locations"],
      locationOptions: ["10–19", "20–49", "50–199", "200+", "Fewer than 10"],
      roleOptions: ["CEO / President", "CFO / Finance", "COO / Operations", "CDO / Clinical", "Procurement", "IT", "Other"],
      ctaText: "Book my session",
      riskLine: "30 minutes. No CapEx, no commitment.",
      successHeadline: "You're booked in.",
      successMessage: "Check your inbox for a confirmation. We'll ask for a rough location count and lab spend so the session runs on your numbers.",
      chilipiperUrl: DEMO_URL,
      pickTimeText: "or pick a time now",
      incentiveText: "$250 gift card when a doctor from your group joins the call",
      consentText: "By submitting you agree to receive communications from Dandy about this request. You can unsubscribe at any time.",
    },
  },
  {
    id: sid("video-step-showcase", 3),
    type: "video-step-showcase",
    props: {
      eyebrow: "What happens on the call",
      headline: "Thirty minutes. Three outcomes.",
      subheadline: "We respect an executive calendar: no feature tour, no slide deck — a working session that ends with numbers you can take to your board.",
      autoAdvanceSeconds: 8,
      mediaSide: "right",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "4/3",
      steps: [
        {
          title: "Map your exposure (10 min)",
          body: "We walk your location count, current lab mix, scanner footprint and remake experience, and size the hidden tax — remakes, chair time, CapEx requests — that never shows on a P&L.",
          videoUrl: VIDEO_VISION_SCANNER,
          imageUrl: "",
          imageAlt: "Dandy Vision scanner in an operatory",
        },
        {
          title: "See Insights on real data (10 min)",
          body: "Dandy Insights on a live network: remake rates by provider, scan quality by location, spend across the group, and where a clinical leader would intervene first.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Dandy Insights dashboard",
        },
        {
          title: "Scope a pilot (10 min)",
          body: "Pick 5–10 offices, agree the baseline and the success criteria, and leave with a plan your CFO, CDO and COO can each say yes to — with zero CapEx and no long-term contract.",
          videoUrl: VIDEO_BROLL,
          imageUrl: "",
          imageAlt: "Dandy team planning a rollout with a practice",
        },
      ],
    },
  },
  {
    id: sid("glow-stat-band", 4),
    type: "glow-stat-band",
    props: {
      headline: "Groups that took the meeting.",
      headlineLine2: "And what happened next.",
      showQuotes: true,
      stats: [
        { prefix: "Dental Care Alliance", value: "147", label: "offices adopted Dandy through provider demand — no mandate." },
        { prefix: "Dental Care Alliance", value: "$4M+", label: "in scanner CapEx avoided with premium hardware at $0." },
        { prefix: "Dental Care Alliance", value: "24%", label: "average cost savings with digital impressions." },
        { prefix: "First half of 2025", value: "80+", label: "DSOs signed practices up with Dandy." },
      ],
      quotes: [
        { quote: "With other national lab brands, you're looking at $40,000 to $75,000 just to have a scanner. With Dandy, there's zero cost to bring it in and a lab credit to try it out.", author: "Dr. Brad Eller", role: "Director of Clinical Development, APEX Dental Partners" },
        { quote: "Dandy has completely changed the way we manage our lab work. Their end-to-end workflows give us complete visibility into the process.", author: "Dr. Bob Stefanski", role: "Chief Dental Officer, My Community Dental Centers" },
        { quote: "Dandy has been involved at a practice level. They've showed up to talk to and train providers and clinical teams.", author: "Jamie Dunkley", role: "Division President, Dental Care Alliance" },
        { quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann", role: "Founder and Clinical Director, APEX Dental Partners" },
      ],
    },
  },
  {
    id: sid("video-card-trio", 5),
    type: "video-card-trio",
    props: {
      eyebrow: "Built for the buying committee",
      headline: "Bring your CFO, CDO and COO.",
      subheadline: "Each leaves the session with the answer they came for.",
      playMode: "inview",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      cards: [
        {
          title: "CFO: the numbers, in your numbers.",
          body: "$0 CapEx versus $40K–$75K per office, remake and chair-time waste sized on your volumes, and a pilot that proves ROI before anything scales.",
          icon: "Calculator",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Dandy Insights spend view",
        },
        {
          title: "CDO: consistency without mandates.",
          body: "AI Scan Review, one clinical standard and provider-level data — adopted doctor by doctor because it works, not because it was ordered.",
          icon: "Stethoscope",
          videoUrl: VIDEO_AI_SCAN_REVIEW,
          imageUrl: "",
          imageAlt: "AI Scan Review on an intraoral scan",
        },
        {
          title: "COO: one partner that shows up.",
          body: "One contract, one workflow, an enterprise team plus on-site trainers, so regionals stop refereeing between 400 labs.",
          icon: "Users",
          videoUrl: VIDEO_DSO_SIZZLE,
          imageUrl: "",
          imageAlt: "Dandy platform overview for dental groups",
          mediaBlend: "none",
        },
      ],
    },
  },
  {
    id: sid("dso-faq", 6),
    type: "dso-faq",
    props: {
      eyebrow: "Before you book",
      headline: "The questions that usually come up first.",
      subheadline: "",
      items: [
        {
          question: "Is this a sales pitch or a working session?",
          answer:
            "A working session. We bring Dandy Insights on real network data and a model of your remake, chair-time and CapEx exposure; you bring a rough location count and lab spend. No slide deck, and you leave with a scoped pilot whether or not you proceed.",
        },
        {
          question: "Who from Dandy is on the call?",
          answer:
            "The enterprise team — the people who scope and run DSO pilots — not an SDR qualification call. If it's useful we'll bring a clinical specialist for your CDO.",
        },
        {
          question: "Do we have to mandate Dandy to our doctors?",
          answer:
            "No. Dandy is built for provider-led adoption: on-site training, lab credits to trial real cases, and support at the practice level. At Dental Care Alliance, 147 offices adopted through provider demand rather than a directive.",
        },
        {
          question: "What does a pilot cost?",
          answer:
            "Nothing in capital. Premium scanners are included in every operatory with the lab partnership, there are no long-term contracts, and new practices get a lab credit toward their first cases.",
        },
        {
          question: "Can we keep the scanners we already own?",
          answer:
            "Yes. Dandy accepts digital scans from iTero and 3Shape, so practices already scanning keep their workflow while new operatories get Dandy hardware at no cost.",
        },
      ],
      backgroundStyle: "white",
    },
  },
  {
    id: sid("glow-final-cta", 7),
    type: "glow-final-cta",
    props: {
      headline: "Thirty minutes to size the opportunity.",
      subheadline: "Book the working session, or pick a time on the enterprise team's calendar right now.",
      ctaText: "Book my session",
      ctaUrl: "#book",
      ctaAction: "url",
      ctaSecondaryText: "Pick a time now",
      ctaSecondaryUrl: DEMO_URL,
      ctaSecondaryAction: "chilipiper",
      secondaryChilipiperUrl: DEMO_URL,
      footnote: "No CapEx. No long-term contracts.",
      showGlow: true,
    },
  },
  {
    id: sid("dandy-site-footer", 8),
    type: "dandy-site-footer",
    props: {
      logoUrl: "",
      disclaimer: "",
      copyrightText: "",
      linkGroups: [
        {
          heading: "Dandy",
          links: [
            { label: "Home", url: "https://www.meetdandy.com/" },
            { label: "For DSOs", url: "https://www.meetdandy.com/solutions/dso/" },
            { label: "Customer story: Dental Care Alliance", url: DCA_STORY_URL },
            { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
          ],
        },
        {
          heading: "Legal",
          links: [
            { label: "Privacy Policy", url: "https://www.meetdandy.com/privacy/" },
            { label: "Terms of Use", url: "https://www.meetdandy.com/terms-of-use/" },
            { label: "Privacy Requests", url: "https://www.meetdandy.com/privacy-requests/" },
          ],
        },
      ],
    },
  },
];

export const DSO_DEMO_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "Book a DSO Working Session — Product Stack",
    templateLabel: "Book a DSO Working Session — Product Stack",
    templateDescription:
      "Demo-booking page for DSO leadership: glow form hero (5-field form, proof beside it, risk reversal, direct-to-calendar link), a 'what happens on the call' agenda with product video, DCA proof band with quotes, buying-committee cards, objection FAQ and a glow close that books.",
    ogImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
    industry: "dental",
    premiumRank: 10,
    funnelStage: "first-meeting",
    blocks,
  },
];
