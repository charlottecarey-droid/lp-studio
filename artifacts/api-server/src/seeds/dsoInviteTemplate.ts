// "You're invited: a DSO working session" — the Invite-family demo page,
// designed from scratch on the pattern of Dandy's lab-tour event page
// (partners.meetdandy.com/oct-lab-tour), which converts well: invitation
// framing, a dark editorial surface, "The Details" facts, an agenda, a
// numbered look inside, proof, and a short reservation form that the CTA
// jumps to three times (top bar, hero, close).
//
// CRO applied on top of that pattern: ≤5 fields (name, email, phone,
// locations), agenda that sets expectations, named-customer proof right before
// the form, a risk-reversal line under the button, direct-to-calendar escape
// hatch, product shown on real footage. Facts / quotes are the same sourced DSO
// material as the other Dandy pages (DCA customer story, APEX / MCDC quotes,
// repo DSO segment brief). The $250 gift-card incentive is deliberately NOT on
// this page — the invitation framing does the work.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-dandy-dso-invite";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;

const VIDEO_INSIGHTS = "/api/storage/objects/uploads/f6f413fd-9db8-4772-b888-b6d45e58bbb9";
const VIDEO_LAB_FLOOR = "/api/storage/objects/uploads/e93df90e-2d0b-470f-99a6-dfd8daabb4d5";
const DEMO_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";
const DCA_STORY_URL = "https://www.meetdandy.com/customer-stories/dca-lab-consolidation/";

const blocks: Block[] = [
  {
    id: sid("invite-demo-hero", 1),
    type: "invite-demo-hero",
    props: {
      logoText: "Dandy",
      logoUrl: "/dandy-logo-white.svg",
      navCtaText: "Reserve a session",
      navCtaUrl: "#reserve",
      kicker: "You're invited",
      headline: "Bring us your numbers.\nLeave with a plan.",
      subheadline: "A private thirty-minute working session with Dandy's enterprise team, run on your group's own data — not a demo deck.",
      ctaText: "Reserve my session",
      ctaUrl: "#reserve",
      secondaryText: "See the agenda",
      secondaryUrl: "#agenda",
      facts: [{ label: "30 minutes" }, { label: "Enterprise team only" }, { label: "Your numbers, not ours" }],
      heroForm: "cta",
      backgroundVideoUrl: VIDEO_LAB_FLOOR,
      backgroundImageUrl: "",
      overlayOpacity: 68,
      minHeightVh: 92,
      showScrollCue: true,
    },
  },
  {
    id: sid("invite-details", 2),
    type: "invite-details",
    props: {
      kicker: "The details",
      headline: "What to expect",
      subheadline: "Everything is prepared in advance. You bring a rough sense of your scale; we bring the model.",
      items: [
        { label: "Format", value: "Video call", caption: "Thirty minutes, on your calendar" },
        { label: "Who", value: "Enterprise team", caption: "The people who scope DSO pilots — no SDR hand-off" },
        { label: "Cost", value: "Nothing", caption: "No CapEx, no contract, no preparation" },
        { label: "You leave with", value: "A pilot plan", caption: "A sized opportunity and 5–10 offices scoped" },
      ],
      anchorId: "details",
    },
  },
  {
    id: sid("invite-agenda", 3),
    type: "invite-agenda",
    props: {
      kicker: "The agenda",
      headline: "Thirty minutes, three outcomes",
      subheadline: "A working session, not a walkthrough. Every block ends with something your CFO, CDO and COO can use.",
      items: [
        {
          label: "Minutes 0–10",
          title: "Map your exposure",
          body: "Your location count, current lab mix, scanner footprint and remake experience — and a number on the hidden tax that never shows on a P&L: remakes, chair time, CapEx requests.",
        },
        {
          label: "Minutes 10–20",
          title: "See Insights on real data",
          body: "Dandy Insights on a live network: remake rates by provider, scan quality by location, spend across the group, and where a clinical leader would intervene first.",
          body2: "No slides. The views your regionals would use on a Monday morning.",
        },
        {
          label: "Minutes 20–30",
          title: "Scope the pilot",
          body: "Pick 5–10 offices, agree the baseline and the success criteria, and leave with a plan each member of the buying committee can say yes to — with zero CapEx and no long-term contract.",
        },
      ],
      anchorId: "agenda",
    },
  },
  {
    id: sid("invite-showcase", 4),
    type: "invite-showcase",
    props: {
      kicker: "Inside the platform",
      headline: "Where precision meets scale.",
      headlineAccent: "scale",
      body: "Every practice on Dandy rolls into one Hub account. Insights sits on top with the numbers leadership has never had.",
      videoUrl: VIDEO_INSIGHTS,
      imageUrl: "",
      imageAlt: "Dandy Insights dashboard with provider-level metrics",
      mediaAspect: "16/9",
      mediaBlend: "none",
      features: [
        { title: "Every location, one view", body: "Remake rates, case volume, turnaround and spend by location, region and provider — refreshed as cases move." },
        { title: "Quality, caught chairside", body: "AI Scan Review flags margin gaps and prep issues while the patient is still in the chair, before a case ships." },
        { title: "Coach with evidence", body: "Provider-level benchmarks and recommendations, so clinical leaders manage by exception instead of instinct." },
      ],
      anchorId: "showcase",
    },
  },
  {
    id: sid("invite-proof", 5),
    type: "invite-proof",
    props: {
      kicker: "Why groups take the meeting",
      quote: "Dandy has been involved at a practice level. They've showed up to talk to and train providers and clinical teams.",
      author: "Jamie Dunkley",
      role: "Division President, Dental Care Alliance",
      stats: [
        { value: "147", label: "DCA offices adopted through provider demand — no mandate" },
        { value: "$4M+", label: "scanner CapEx avoided at DCA" },
        { value: "24%", label: "average cost savings with digital impressions" },
        { value: "80+", label: "DSOs signed practices up in the first half of 2025" },
      ],
      logosLabel: "Trusted by",
      logos: [{ name: "Dental Care Alliance" }, { name: "APEX Dental Partners" }, { name: "My Community Dental Centers" }],
      anchorId: "proof",
    },
  },
  {
    id: sid("dso-faq", 6),
    type: "dso-faq",
    props: {
      eyebrow: "Before you reserve",
      headline: "The questions that usually come up first.",
      subheadline: "",
      items: [
        { question: "Is this a sales pitch or a working session?", answer: "A working session. We bring Dandy Insights on real network data and a model of your remake, chair-time and CapEx exposure; you bring a rough location count and lab spend. You leave with a scoped pilot whether or not you proceed." },
        { question: "Who from Dandy is on the call?", answer: "The enterprise team — the people who scope and run DSO pilots — not an SDR qualification call. If it's useful we'll bring a clinical specialist for your CDO." },
        { question: "Do we have to mandate Dandy to our doctors?", answer: "No. Dandy is built for provider-led adoption: on-site training, lab credits to trial real cases, and support at the practice level. At Dental Care Alliance, 147 offices adopted through provider demand rather than a directive." },
        { question: "What does a pilot cost?", answer: "Nothing in capital. Premium scanners are included in every operatory with the lab partnership, there are no long-term contracts, and new practices get a lab credit toward their first cases." },
        { question: "Can we keep the scanners we already own?", answer: "Yes. Dandy accepts digital scans from iTero and 3Shape, so practices already scanning keep their workflow while new operatories get Dandy hardware at no cost." },
      ],
      backgroundStyle: "dark",
    },
  },
  {
    id: sid("invite-reserve", 7),
    type: "invite-reserve",
    props: {
      kicker: "Reserve",
      headline: "Reserve your working session",
      subheadline: "Tell us who you are and the enterprise team will come back within one business day with times.",
      nextSteps: [
        "We confirm a time that suits your leadership team",
        "We ask for a rough location count and lab spend so the session runs on your numbers",
        "You leave the call with a written pilot plan",
      ],
      formTitle: "",
      fields: ["name", "email", "phone", "locations"],
      locationOptions: ["10–19", "20–49", "50–199", "200+", "Fewer than 10"],
      ctaText: "Reserve my session",
      riskLine: "30 minutes. No CapEx, no commitment.",
      successHeadline: "You're on the list.",
      successMessage: "Watch for a confirmation from the enterprise team within one business day.",
      chilipiperUrl: DEMO_URL,
      pickTimeText: "or pick a time now",
      consentText: "By submitting you agree to receive communications from Dandy about this request. You can unsubscribe at any time.",
      anchorId: "reserve",
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

export const DSO_INVITE_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "DSO Working Session — Invitation",
    templateLabel: "DSO Working Session — Invitation",
    templateDescription:
      "Invitation-style demo page in the lab-tour idiom: dark editorial hero with ambient lab footage and a sticky reserve CTA, The Details, a minute-by-minute agenda, a look inside Insights, DCA proof, FAQ and a short reservation form with a direct-to-calendar link.",
    ogImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80",
    industry: "dental",
    premiumRank: 9,
    funnelStage: "first-meeting",
    blocks,
  },
];
