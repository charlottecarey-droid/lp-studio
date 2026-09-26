// "Dandy for DSOs" — a Stack-family replacement candidate for
// meetdandy.com/solutions/dso. Same warm-paper / glow-video language as the
// Hub & Insights page, but organised around the DSO value props: same-store
// growth and EBITDA expansion, Dandy Insights, change management without
// mandates, lab consolidation, clinical consistency, and service-line
// expansion (digital dentures).
//
// Every fact, figure and quote is sourced (Sept 2026):
//  - Dandy's DSO segment brief in this repo (DSO_Segment_Input.md): buyer
//    committee, mandate resistance, $40K–$75K scanner CapEx, 2-appointment
//    dentures with 90% of steps delegated, pilot → validate → scale motion.
//  - meetdandy.com/customer-stories/dca-lab-consolidation: Dental Care
//    Alliance — 400+ practices and 400+ labs before Dandy, 147 offices adopted
//    through provider-led demand (no mandate), 750+ clinicians trained, 160+
//    scanners, 233 → 3,005 monthly orders (May → Oct 2025), $4M+ CapEx
//    savings, 24% average cost savings with digital impressions, 6,550
//    appointments eliminated via the two-appointment denture workflow, 10/10
//    clinician satisfaction; quotes from Dan Gast (VP Procurement) and Jamie
//    Dunkley (Division President).
//  - meetdandy.com/solutions/dso + newsroom (Hub & Insights launch): quotes
//    from Dr. Bob Stefanski (CDO, My Community Dental Centers), Dr. Brad Eller
//    and Dr. Layla Lohmann (APEX Dental Partners); "practices at more than 80
//    DSOs signed up with Dandy in the first half of 2025"; named partner DSOs.
//  - Existing Dandy DSO block defaults (dso-promises / dso-stat-row): 96%
//    first-time fit vs 78% industry average, free remakes, 10-year warranty,
//    zero long-term contracts.
//  - 2026 DSO market context (Group Dentistry Now, Sofer Advisors): the M&A
//    slowdown and the shift to same-store growth and operational discipline.
//
// Palette keys are omitted so the page follows the Dandy brand (forest
// primary + lime glow). Dental-only.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-dandy-for-dsos";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;

// Dandy tenant media-library uploads (lp_media rows, public-by-URL).
const VIDEO_INSIGHTS = "/api/storage/objects/uploads/f6f413fd-9db8-4772-b888-b6d45e58bbb9"; // Insights Recording vff
const VIDEO_DSO_SIZZLE = "/api/storage/objects/uploads/cd964e87-3fc8-432d-af6c-659c3387fe27"; // 2026 DSO Sizzle
const VIDEO_VISION_SCANNER = "/api/storage/objects/uploads/68967d1d-42e1-4ab9-989c-25e7cdef39e6"; // New Dandy Vision Intraoral Scanner
const VIDEO_LAB_FLOOR = "/api/storage/objects/uploads/e93df90e-2d0b-470f-99a6-dfd8daabb4d5"; // Dandy DELIVERY 2997 (lab floor tour)
const VIDEO_DENTURE_TURN = "/api/storage/objects/uploads/9a21f8d7-2e9b-4490-8719-e1dfd8264fe2"; // rotating digital denture on forest green
// Bundled public clips.
const VIDEO_AI_SCAN_REVIEW = "/videos/ai-scan-review.mp4";
const VIDEO_BROLL = "/videos/dandy-broll.mp4";
const VIDEO_DIGITAL_LAB = "/videos/dandy-digital-lab.mp4";

const DEMO_URL = "https://meetdandy.chilipiper.com/round-robin/enterprise--discovery-call";
const DCA_STORY_URL = "https://www.meetdandy.com/customer-stories/dca-lab-consolidation/";
const EBOOK_SAME_STORE_URL = "https://www.meetdandy.com/learning-center/ebooks/unlocking-same-store-growth-the-hidden-power-of-your-dental-lab/";

const blocks: Block[] = [
  {
    id: sid("dandy-site-header", 1),
    type: "dandy-site-header",
    props: {
      logoUrl: "",
      phoneNumber: "(315)-859-0703",
      phoneLabel: "Sales: (315)-859-0703",
      primaryCtaText: "TALK TO THE ENTERPRISE TEAM",
      primaryCtaUrl: DEMO_URL,
      secondaryCtaText: "GET STARTED",
      secondaryCtaUrl: "https://www.meetdandy.com/get-started/",
      navLinks: [
        { label: "Lab Services", url: "https://www.meetdandy.com/labs/" },
        { label: "Solutions", url: "https://www.meetdandy.com/solutions/" },
        { label: "Technology & Support", url: "https://www.meetdandy.com/technology/" },
        { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
      ],
    },
  },
  {
    id: sid("glow-video-hero", 2),
    type: "glow-video-hero",
    props: {
      eyebrow: "Dandy for DSOs",
      eyebrowIcon: "Building2",
      headline: "Same-store growth, powered by your lab.",
      subheadline:
        "Dandy is the AI-powered dental lab platform that turns lab spend from a cost center into a growth lever — standardized across every practice, without mandating a single doctor.",
      align: "center",
      ctaText: "Talk to the enterprise team",
      ctaUrl: DEMO_URL,
      ctaAction: "url",
      ctaSecondaryText: "See how DCA did it",
      ctaSecondaryUrl: DCA_STORY_URL,
      ctaSecondaryAction: "url",
      mediaVideoUrl: VIDEO_DSO_SIZZLE,
      mediaImageUrl: "",
      mediaImageAlt: "Dandy's digital lab platform for dental groups",
      // Cinematic (dark) footage — shown opaque; multiply is for white-UI recordings.
      mediaBlend: "none",
      mediaEdgeFade: true,
      mediaAspect: "16/9",
      showSoundToggle: true,
      soundToggleLabel: "Play with sound",
      logosLabel: "Trusted by leading DSOs",
      logos: [
        { name: "Dental Care Alliance" },
        { name: "APEX Dental Partners" },
        { name: "My Community Dental Centers" },
      ],
    },
  },
  {
    id: sid("glow-stat-band", 3),
    type: "glow-stat-band",
    props: {
      headline: "Growth moved from acquisition to operations.",
      headlineLine2: "Your lab is the lever you haven't pulled.",
      showQuotes: true,
      stats: [
        { prefix: "In the first half of 2025", value: "80+", label: "DSOs signed practices up with Dandy." },
        { prefix: "Dental Care Alliance", value: "24%", label: "average cost savings with digital impressions across the network." },
        { prefix: "Dental Care Alliance", value: "$4M+", label: "in scanner CapEx avoided — premium hardware in every operatory at $0." },
        { prefix: "Dental Care Alliance", value: "6,550", label: "patient appointments eliminated with the two-appointment denture workflow." },
      ],
      quotes: [
        { quote: "Dandy has completely changed the way we manage our lab work. Their end-to-end workflows give us complete visibility into the process.", author: "Dr. Bob Stefanski", role: "Chief Dental Officer, My Community Dental Centers" },
        { quote: "With other national lab brands, you're looking at $40,000 to $75,000 just to have a scanner. With Dandy, there's zero cost to bring it in and a lab credit to try it out.", author: "Dr. Brad Eller", role: "Director of Clinical Development, APEX Dental Partners" },
        { quote: "We have about 400 practices, and we probably had at least 400 labs before Dandy. It was a mess.", author: "Dan Gast", role: "VP Procurement, Dental Care Alliance" },
        { quote: "Dandy values education, technology, and people. That's what makes them a great partner and not just another lab.", author: "Dr. Layla Lohmann", role: "Founder and Clinical Director, APEX Dental Partners" },
      ],
    },
  },
  {
    id: sid("video-zigzag", 4),
    type: "video-zigzag",
    props: {
      eyebrow: "",
      headline: "Five levers. One partner.",
      subheadline: "Everything a multi-location group needs from its lab, in one platform your doctors will actually choose.",
      startSide: "left",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "4/3",
      rows: [
        {
          title: "Expand EBITDA without a single acquisition.",
          body: "Remakes, delays and lost chair time are a hidden tax that never shows on a P&L. Dandy removes it: $0 scanner CapEx instead of $40K–$75K per office, free remakes, and digital workflows that free chair time for more patients and higher case acceptance.",
          videoUrl: VIDEO_VISION_SCANNER,
          imageUrl: "",
          imageAlt: "Dandy Vision intraoral scanner in an operatory",
          linkText: "Read the same-store growth playbook",
          linkUrl: EBOOK_SAME_STORE_URL,
        },
        {
          title: "See every provider. Manage by exception.",
          body: "Dandy Insights turns lab data into decision leverage: scan quality, prep issues, remake rates and spend, broken down by doctor, location and product — with benchmarks and recommendations, not just reports.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Dandy Insights dashboard with provider-level metrics",
          linkText: "Explore Hub & Insights",
          linkUrl: "https://www.meetdandy.com/newsroom/dandy-hub-and-dandy-insights-help-dsos-grow/",
        },
        {
          title: "Consolidate labs without mandating a doctor.",
          body: "Top-down lab mandates fail. Dandy earns adoption practice by practice: trainers on site, lab credits to trial, and support that shows up. At Dental Care Alliance, 147 offices adopted through provider-led demand — and clinicians rate the experience 10 out of 10.",
          videoUrl: VIDEO_BROLL,
          imageUrl: "",
          imageAlt: "Dandy trainer working with a clinical team",
          linkText: "See the DCA story",
          linkUrl: DCA_STORY_URL,
        },
        {
          title: "From 400 labs to one accountable partner.",
          body: "One contract, one workflow, one team that owns the outcome. Every indication — crowns, bridges, implants, dentures, aligners, sleep appliances — flows through a vertically integrated digital lab with the volume advantage a group deserves.",
          videoUrl: VIDEO_LAB_FLOOR,
          imageUrl: "",
          imageAlt: "Inside Dandy's digital dental lab",
          mediaBlend: "none",
        },
        {
          title: "One clinical standard, every location.",
          body: "AI Scan Review flags margin gaps and prep issues while the patient is still in the chair, and the same technicians handle every case. The result is predictable fit and consistent outcomes across every provider — a 96% first-time fit rate, backed by free remakes and a 10-year warranty.",
          videoUrl: VIDEO_AI_SCAN_REVIEW,
          imageUrl: "",
          imageAlt: "AI Scan Review analysing an intraoral scan",
        },
        {
          title: "Turn dentures into a growth line.",
          body: "Traditional dentures take 7–8 appointments and doctor-heavy chair time, so offices avoid them. Dandy's two-appointment digital denture workflow lets assistants handle 90% of the steps — DCA eliminated 6,550 appointments and opened a service line its practices used to turn away.",
          videoUrl: VIDEO_DENTURE_TURN,
          imageUrl: "",
          imageAlt: "A Dandy digital denture rotating on a forest-green background",
          mediaBlend: "none",
        },
      ],
    },
  },
  {
    id: sid("video-step-showcase", 5),
    type: "video-step-showcase",
    props: {
      eyebrow: "",
      headline: "Prove it before you scale it.",
      subheadline: "Growth should be validated before it's rolled out. Dandy pilots with a handful of locations and scales on evidence, not promises.",
      autoAdvanceSeconds: 8,
      mediaSide: "right",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      mediaAspect: "4/3",
      steps: [
        {
          title: "Pilot 5–10 offices",
          body: "Scanners delivered and installed in every operatory at $0 CapEx. On-site training for doctors and teams, lab credits so hesitant clinicians can trial real cases, and a baseline of today's remake, turnaround and spend numbers.",
          videoUrl: VIDEO_BROLL,
          imageUrl: "",
          imageAlt: "Dandy onboarding a practice team",
        },
        {
          title: "Validate impact in 60–90 days",
          body: "Insights tracks case acceptance, first-time fit, remakes and spend for the pilot cohort against the baseline — by provider and by location — so the business case is written in your own data.",
          videoUrl: VIDEO_INSIGHTS,
          imageUrl: "",
          imageAlt: "Insights pilot dashboard",
        },
        {
          title: "Scale across the network",
          body: "Roll out region by region with a dedicated enterprise team, one contract and one workflow. DCA went from 233 to 3,005 monthly orders in six months without a single mandate.",
          videoUrl: VIDEO_DSO_SIZZLE,
          imageUrl: "",
          imageAlt: "Dandy platform overview for dental groups",
        },
      ],
    },
  },
  {
    id: sid("benchmark-bars", 6),
    type: "benchmark-bars",
    props: {
      eyebrow: "",
      headline: "A digital lab that fits the first time.",
      subheadline:
        "Analog impressions introduce variability that propagates through the entire workflow. A fully digital chain — intraoral scan, AI Scan Review, vertically integrated manufacturing — removes it, and the difference shows up in every seat appointment.",
      chartLabel: "First-time fit rate",
      bars: [
        { label: "Dandy network", value: 96, highlighted: true },
        { label: "Industry average", value: 78, delta: "+18 pts" },
      ],
      footnote:
        "Dandy first-time fit rate is network-wide; industry average reflects traditional lab workflows. Every Dandy case is covered by free remakes and a 10-year warranty.",
    },
  },
  {
    id: sid("video-card-trio", 7),
    type: "video-card-trio",
    props: {
      eyebrow: "",
      headline: "Zero CapEx. Zero contracts. Zero excuses.",
      subheadline: "The commercial model is built for a buying committee that has to say yes six times.",
      playMode: "inview",
      mediaBlend: "auto",
      mediaEdgeFade: true,
      cards: [
        {
          title: "Premium scanners at $0 CapEx.",
          body: "Best-in-class intraoral scanners in every operatory, included with the partnership — no capital request, no hardware lifecycle to manage.",
          icon: "ScanLine",
          videoUrl: VIDEO_VISION_SCANNER,
          imageUrl: "",
          imageAlt: "Dandy Vision scanner",
        },
        {
          title: "No long-term contracts.",
          body: "Transparent per-unit pricing, free no-hassle remakes and a 10-year warranty on every restoration. Groups stay because it works, not because they're locked in.",
          icon: "ShieldCheck",
          videoUrl: VIDEO_DIGITAL_LAB,
          imageUrl: "",
          imageAlt: "Dandy digital manufacturing",
        },
        {
          title: "An enterprise team that shows up.",
          body: "Executive-level partnership plus practice-level trainers and clinical support, so your regionals aren't the ones fixing lab problems.",
          icon: "Users",
          videoUrl: VIDEO_BROLL,
          imageUrl: "",
          imageAlt: "Dandy team with a practice",
        },
      ],
    },
  },
  {
    id: sid("dso-faq", 8),
    type: "dso-faq",
    props: {
      eyebrow: "Common questions",
      headline: "What DSO leadership teams ask before they pilot.",
      subheadline: "",
      items: [
        {
          question: "Do we have to mandate Dandy across our doctors?",
          answer:
            "No — and we'd advise against it. Dandy is built for provider-led adoption: on-site training, lab credits to trial real cases, and support at the practice level. At Dental Care Alliance, 147 offices adopted through provider demand rather than a directive.",
        },
        {
          question: "What does this cost in capital?",
          answer:
            "Nothing. Premium intraoral scanners are included in every operatory with the lab partnership — no $40K–$75K purchase per office — and there are no long-term contracts. DCA avoided more than $4M in scanner CapEx.",
        },
        {
          question: "Can we keep the scanners we already own?",
          answer:
            "Yes. Dandy accepts digital scans from iTero and 3Shape, so practices already scanning keep their workflow while new operatories get Dandy hardware at no cost.",
        },
        {
          question: "How does leadership see what's happening across locations?",
          answer:
            "Dandy Hub is the single account every practice works in; Dandy Insights sits on top with scan quality, prep issues, remake rates and spend by doctor, location and product, plus benchmarks and recommendations.",
        },
        {
          question: "How fast can we run a pilot?",
          answer:
            "Most groups pilot with 5–10 offices: scanners installed and teams trained in the first weeks, results measured against your own baseline in 60–90 days, then a region-by-region rollout with a dedicated enterprise team.",
        },
      ],
      backgroundStyle: "white",
    },
  },
  {
    id: sid("glow-final-cta", 9),
    type: "glow-final-cta",
    props: {
      headline: "Let's build the business case for your group.",
      subheadline: "A working session with Dandy's enterprise team to map the financial and clinical impact across your locations.",
      ctaText: "Talk to the enterprise team",
      ctaUrl: DEMO_URL,
      ctaAction: "url",
      ctaSecondaryText: "Read the DCA story",
      ctaSecondaryUrl: DCA_STORY_URL,
      ctaSecondaryAction: "url",
      footnote: "No CapEx. No long-term contracts.",
      showGlow: true,
    },
  },
  {
    id: sid("dandy-site-footer", 10),
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
            { label: "Pricing", url: "https://www.meetdandy.com/pricing/" },
            { label: "Get in touch", url: "https://www.meetdandy.com/get-in-touch/" },
            { label: "Dandy Reviews", url: "https://www.meetdandy.com/reviews/" },
            { label: "Careers", url: "https://www.meetdandy.com/careers/" },
          ],
        },
        {
          heading: "For DSOs",
          links: [
            { label: "Customer story: Dental Care Alliance", url: DCA_STORY_URL },
            { label: "Ebook: Unlocking same-store growth", url: EBOOK_SAME_STORE_URL },
            { label: "Learning Center", url: "https://www.meetdandy.com/learning-center/" },
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

export const DANDY_FOR_DSOS_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "Dandy for DSOs — Product Stack",
    templateLabel: "Dandy for DSOs — Product Stack",
    templateDescription:
      "A replacement candidate for meetdandy.com/dso in the Stack style: glow video hero, dark stat band with DSO proof, six value-prop rows (EBITDA expansion, Insights, change management without mandates, lab consolidation, clinical consistency, digital dentures), pilot-to-scale steps, first-time-fit benchmark, commercial-model cards, FAQ and a glow close.",
    ogImage: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80",
    industry: "dental",
    premiumRank: 11,
    blocks,
  },
];
