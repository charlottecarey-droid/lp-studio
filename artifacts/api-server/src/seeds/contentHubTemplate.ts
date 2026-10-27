// Content Hub family (Oct 2026) — three seeded templates built from the four
// hub-* blocks (hub-hero · hub-featured · hub-library · hub-support):
//
//   1. "Content Hub — Resource Library"   generic, brand-neutral starter
//   2. "Dandy Sleep — Dentist Resource Hub"  dandysleep.com/dentists
//   3. "Dandy Sleep — Patient Resource Hub"  dandysleep.com/patients
//
// The two Dandy Sleep hubs replace the Highspot "Dandy Sleep Resource Hub" /
// "Patient Sleep Resource Hub" PDFs. Every resource keeps the Highspot viewer
// link it has today as its FALLBACK (`externalUrl` — those viewer links open
// without a login), so both pages work the day they are published; once a
// PDF or video is uploaded into the tenant's media library and set on the
// item (`fileUrl` / `videoUrl`), the card opens it in the in-page viewer and
// grows a download button automatically. Help-center articles stay links.
//
// The audience switch in the hero (For dentists / For patients) is the SAME
// list on both pages; the block highlights the link matching the current
// path, so both pages cross-link with one config.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const sidFor = (slug: string) => (type: string, n: number) => `seed-${slug}-${type}-${n}`;

/* ── 1. Generic starter ─────────────────────────────────────────────────── */
const GENERIC_SLUG = "global-content-hub";
const gsid = sidFor(GENERIC_SLUG);

const genericBlocks: Block[] = [
  {
    id: gsid("hub-hero", 1),
    type: "hub-hero",
    props: {
      theme: "site",
      navLinks: [
        { label: "For teams", url: "/teams" },
        { label: "For customers", url: "/customers" },
      ],
      navCtaText: "Email support",
      navCtaUrl: "mailto:support@example.com",
      kicker: "Resource hub",
      headline: "Everything you need,\nright when you need it.",
      subheadline: "Guides, videos and reference sheets for every stage — open anything in a click, download what you want to keep. No login required.",
      ctaText: "Browse the library",
      ctaUrl: "#library",
      secondaryText: "Start here",
      secondaryUrl: "#featured",
      facts: [{ label: "PDFs & videos" }, { label: "No login" }, { label: "Always up to date" }],
      minHeightVh: 64,
    },
  },
  {
    id: gsid("hub-featured", 2),
    type: "hub-featured",
    props: {
      theme: "site",
      kicker: "Start here",
      asset: {
        kind: "video",
        title: "The two-minute overview",
        description: "A short walkthrough of what's in this hub and how to use it — the fastest way to get oriented before you dive into the library.",
        videoUrl: "",
        externalUrl: "",
        thumbnailUrl: "",
        meta: "2 min",
        downloadable: true,
      },
      buttonLabel: "",
      anchorId: "featured",
    },
  },
  {
    id: gsid("hub-library", 3),
    type: "hub-library",
    props: {
      theme: "site",
      kicker: "The library",
      headline: "Pick the stage you're at.",
      subheadline: "Every guide, video and reference sheet, grouped the way you'll actually use them.",
      layout: "rail",
      columns: 3,
      showSearch: true,
      searchPlaceholder: "Search the library",
      anchorId: "library",
      sections: [
        {
          kicker: "Step 1 · Getting started",
          title: "Set up",
          description: "Everything for your first week.",
          items: [
            { kind: "pdf", title: "Quick-start guide", description: "The one-page overview to read first — what's included and where to begin.", fileUrl: "", meta: "4 pages" },
            { kind: "video", title: "A two-minute tour", description: "A short walkthrough of the workspace and the three things to do on day one.", videoUrl: "", meta: "2 min" },
            { kind: "link", title: "Help center", description: "Step-by-step articles for anything this hub doesn't cover.", externalUrl: "", meta: "Help center" },
          ],
        },
        {
          kicker: "Step 2 · Day to day",
          title: "Run it",
          description: "Reference sheets for the routine.",
          items: [
            { kind: "pdf", title: "Reference sheet", description: "The numbers, codes and contacts you'll reach for every week.", fileUrl: "", meta: "2 pages" },
            { kind: "pdf", title: "Checklist", description: "A printable checklist for the full workflow, start to finish.", fileUrl: "", meta: "1 page" },
            { kind: "video", title: "Troubleshooting walkthrough", description: "The five issues that come up most, and how to clear each one in under a minute.", videoUrl: "", meta: "4 min" },
          ],
        },
        {
          kicker: "Anytime",
          title: "Reference & support",
          description: "Pricing, policies and who to call.",
          items: [
            { kind: "pdf", title: "Pricing reference", description: "What's included, what's billed separately, and how invoicing works.", fileUrl: "", meta: "3 pages" },
            { kind: "link", title: "Contact support", description: "Reach the team directly — most questions are answered within a business day.", externalUrl: "mailto:support@example.com", meta: "Email" },
          ],
        },
      ],
    },
  },
  {
    id: gsid("hub-support", 4),
    type: "hub-support",
    props: {
      theme: "site",
      kicker: "Questions?",
      headline: "Can't find what you need?\nJust ask.",
      body: "Our team answers every message — usually within a business day.",
      email: "support@example.com",
      emailLabel: "Email support",
      linkText: "Visit the help center",
      linkUrl: "",
      disclaimer: "",
      anchorId: "support",
    },
  },
];

/* ── Dandy Sleep shared bits ────────────────────────────────────────────── */
const SLEEP_EMAIL = "sleep@meetdandy.com";
const SLEEP_NAV = [
  { label: "For dentists", url: "/dentists" },
  { label: "For patients", url: "/patients" },
];
// Highspot viewer links — public (no sign-in) — used as fallbacks until the
// files are uploaded to the tenant media library.
const HS_DENTIST = (iid: string) => `https://meetdandy.highspot.com/viewer/a2fcf4807ce9e1fcade515e8d0e73671?iid=${iid}`;
const HS_PATIENT = (iid: string) => `https://meetdandy.highspot.com/viewer/a784107f29a4699aa52fb92473f62e6c?iid=${iid}`;
const HS_MARKETING_KIT = "https://view-su2.highspot.com/viewer/32659cb66d85c8f0cfc530730d123af1";
const HELP = (path: string) => `https://help.meetdandy.com/hc/en-us/articles/${path}`;
const HELP_WORKFLOW = HELP("45315946025485-Dandy-Sleep-System-End-to-End-Workflow-for-Dentists");

const sleepFooter = (id: string): Block => ({
  id,
  type: "dandy-site-footer",
  props: {
    logoUrl: "",
    disclaimer: "",
    copyrightText: "",
    linkGroups: [
      {
        heading: "Dandy Sleep",
        links: [
          { label: "For dentists", url: "/dentists" },
          { label: "For patients", url: "/patients" },
          { label: "Help center", url: HELP_WORKFLOW },
        ],
      },
      {
        heading: "Dandy",
        links: [
          { label: "Home", url: "https://www.meetdandy.com/" },
          { label: "Get started", url: "https://www.meetdandy.com/get-started/" },
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
});

/* ── 2. Dandy Sleep — Dentist Resource Hub ──────────────────────────────── */
const DENTIST_SLUG = "global-dandy-sleep-dentists";
const dsid = sidFor(DENTIST_SLUG);

const dentistBlocks: Block[] = [
  {
    id: dsid("hub-hero", 1),
    type: "hub-hero",
    props: {
      theme: "site",
      navLinks: SLEEP_NAV,
      navCtaText: "Email support",
      navCtaUrl: `mailto:${SLEEP_EMAIL}`,
      kicker: "Dandy Sleep · For dental teams",
      headline: "Everything your practice needs,\nright when you need it.",
      subheadline: "From opening your onboarding kit to your first titration — pick the stage you're at to find the guides, videos and references for treating sleep patients with Dandy.",
      ctaText: "Browse the library",
      ctaUrl: "#library",
      secondaryText: "Start with the patient journey",
      secondaryUrl: "#featured",
      facts: [{ label: "18 resources" }, { label: "Guides, videos & references" }, { label: "No login needed" }],
      minHeightVh: 64,
    },
  },
  {
    id: dsid("hub-featured", 2),
    type: "hub-featured",
    props: {
      theme: "site",
      kicker: "Start here",
      asset: {
        key: "patient-journey",
        kind: "pdf",
        title: "The Dandy Sleep patient journey",
        description: "What your patients experience from sign-up through treatment — the one map that ties every resource below together.",
        fileUrl: "",
        externalUrl: HS_DENTIST("6a694c215749512c31df225b"),
        thumbnailUrl: "",
        meta: "PDF guide",
        downloadable: true,
      },
      buttonLabel: "Read the journey",
      anchorId: "featured",
    },
  },
  {
    id: dsid("hub-library", 3),
    type: "hub-library",
    props: {
      theme: "site",
      kicker: "The library",
      headline: "Pick the stage you're at.",
      subheadline: "Guides, videos and references, grouped by where you are in the Dandy Sleep workflow.",
      layout: "rail",
      columns: 3,
      showSearch: true,
      searchPlaceholder: "Search the library",
      anchorId: "library",
      sections: [
        {
          kicker: "Step 1 · When your kit arrives",
          title: "Onboarding kit set up",
          description: "Unbox, set up, and get your patient materials ready.",
          items: [
            { key: "patient-materials", kind: "link", title: "Patient materials", description: "Print-ready posters, a trifold, checklists and waivers for your waiting room, plus social, email, SMS and website copy.", externalUrl: HS_MARKETING_KIT, meta: "Marketing kit" },
            { key: "sleep-rings", kind: "pdf", title: "Sleep rings user guide", description: "How to use your home sleep test rings, from charging to the first night.", fileUrl: "", externalUrl: HS_DENTIST("6a73e09e3affbdb8f3b9ce28"), meta: "User guide" },
          ],
        },
        {
          kicker: "Step 2 · Before your first patient",
          title: "Chairside and Practice Portal",
          description: "Short videos on ordering and the patient management toolset.",
          items: [
            { key: "chairside-order", kind: "video", title: "Ordering a sleep test in Chairside", description: "A short walkthrough of the Chairside ordering flow for a home sleep test.", videoUrl: "", externalUrl: HS_DENTIST("6a694c2b574951304be4d39b"), meta: "Video" },
            { key: "patient-status", kind: "video", title: "Viewing patient status and results", description: "How to see your patients' progress, diagnosis and insurance verification in the portal.", videoUrl: "", externalUrl: HS_DENTIST("6a760a5ca36628cb2baf111c"), meta: "Video" },
          ],
        },
        {
          kicker: "Step 3 · Your first patients",
          title: "Screen and guide patients",
          description: "Identify candidates and walk them through what happens next.",
          items: [
            { key: "screening-guide", kind: "pdf", title: "Sleep apnea screening", description: "How to identify candidates for sleep treatment in the chair.", fileUrl: "", externalUrl: HS_DENTIST("6a694c2d530389fee5067e7d"), meta: "Guide" },
            { key: "patient-journey", kind: "pdf", title: "Dandy Sleep patient journey", description: "What your patient experiences from sign-up through treatment.", fileUrl: "", externalUrl: HS_DENTIST("6a694c215749512c31df225b"), meta: "Guide" },
            { key: "telehealth", kind: "video", title: "Patient intake forms experience", description: "See the patient telehealth and intake process from their side.", videoUrl: "", externalUrl: HS_DENTIST("6a694c2c574951e7e6df2843"), meta: "Video" },
            { key: "results-delivery", kind: "video", title: "Patient results delivery", description: "How results are communicated to you and to the patient.", videoUrl: "", externalUrl: HS_DENTIST("6a7238f53668dec4d3709bab"), meta: "Video" },
            { key: "patient-education", kind: "link", title: "Patient educational resources", description: "The patient hub on this site — materials that explain the diagnosis and treatment options in plain language.", externalUrl: "/patients", meta: "Patient hub" },
          ],
        },
        {
          kicker: "Step 4 · Your first HST order & scan",
          title: "Scan and select an appliance",
          description: "Choose the right appliance and capture the scans Dandy needs.",
          items: [
            { key: "mad-selection", kind: "pdf", title: "MAD selection", description: "Comparing appliance options and choosing the right fit for your patient.", fileUrl: "", externalUrl: HS_DENTIST("6a694c255749515136df1f18"), meta: "Guide" },
            { key: "scan-for-mad", kind: "link", title: "How to scan for a MAD", description: "Capturing the protrusive bite and scans Dandy needs to fabricate a mandibular advancement device.", externalUrl: HELP("21498849816845-Create-a-sleep-apnea-device-bite-scan-Protrusive-Bite"), meta: "Help center" },
          ],
        },
        {
          kicker: "Step 5 · Your first delivery",
          title: "Deliver and titrate",
          description: "Fit the appliance, then adjust it over time.",
          items: [
            { key: "deliver-mad", kind: "link", title: "How & when to deliver a MAD", description: "Fitting the appliance and what to cover in the delivery appointment.", externalUrl: HELP("21505930691469-Deliver-Sleep-Apnea-Appliances"), meta: "Help center" },
            { key: "titrate-mad", kind: "link", title: "How to titrate a MAD", description: "Adjusting advancement over time to reach an effective, comfortable position.", externalUrl: HELP("14360305696781-Maintaining-and-Adjusting-a-Sleep-Apnea-Appliance"), meta: "Help center" },
            { key: "patient-ifu", kind: "link", title: "Patient IFU", description: "How patients care for their sleep apnea device — the instructions for use to share at delivery.", externalUrl: HELP("17574923674509-Manage-and-Care-for-Your-Sleep-Apnea-Device-Patient-IFU"), meta: "Help center" },
          ],
        },
        {
          kicker: "Anytime",
          title: "Reference & support",
          description: "Pricing, reading reports, and where to get help.",
          items: [
            { key: "program-fees", kind: "pdf", title: "Dandy Sleep Program fees", description: "What you pay for, specifically — HSTs, appliances, billing and other details.", fileUrl: "", externalUrl: HS_DENTIST("6a694c225749510eb5e4c36a"), meta: "Pricing" },
            { key: "mad-pricing", kind: "pdf", title: "MAD pricing case studies", description: "How to price MADs to help the most patients.", fileUrl: "", externalUrl: HS_DENTIST("6a7d2cf1b5c60ebf4f75b347"), meta: "Pricing" },
            { key: "read-sleep-report", kind: "pdf", title: "How to read a sleep report", description: "How to interpret the SleepImage home sleep test data.", fileUrl: "", externalUrl: HS_DENTIST("6a694c24530389856d9cb503"), meta: "Guide" },
            { key: "help-center", kind: "link", title: "Help center", description: "Step-by-step walkthroughs and answers from Dandy support.", externalUrl: HELP_WORKFLOW, meta: "Help center" },
          ],
        },
      ],
    },
  },
  {
    id: dsid("hub-support", 4),
    type: "hub-support",
    props: {
      theme: "site",
      kicker: "Questions?",
      headline: "Reach out to the\nDandy Sleep team.",
      body: "Email us and a member of the team will get back to you — usually within a business day.",
      email: SLEEP_EMAIL,
      emailLabel: `Email ${SLEEP_EMAIL}`,
      linkText: "Visit the help center",
      linkUrl: HELP_WORKFLOW,
      disclaimer: "",
      anchorId: "support",
    },
  },
  sleepFooter(dsid("dandy-site-footer", 5)),
];

/* ── 3. Dandy Sleep — Patient Resource Hub ──────────────────────────────── */
const PATIENT_SLUG = "global-dandy-sleep-patients";
const psid = sidFor(PATIENT_SLUG);

const patientBlocks: Block[] = [
  {
    id: psid("hub-hero", 1),
    type: "hub-hero",
    props: {
      theme: "site",
      navLinks: SLEEP_NAV,
      navCtaText: "Email us",
      navCtaUrl: `mailto:${SLEEP_EMAIL}`,
      kicker: "Dandy Sleep · Patient guide",
      headline: "Understanding your\nsleep apnea treatment.",
      subheadline: "Resources on what you are treating, why it is worth it, and how your appliance works.",
      ctaText: "Browse the resources",
      ctaUrl: "#library",
      secondaryText: "Watch the explainer",
      secondaryUrl: "#featured",
      facts: [{ label: "5 resources" }, { label: "Short reads & one video" }, { label: "No login needed" }],
      minHeightVh: 60,
    },
  },
  {
    id: psid("hub-featured", 2),
    type: "hub-featured",
    props: {
      theme: "site",
      kicker: "Video",
      asset: {
        key: "mads-explainer",
        kind: "video",
        title: "Sleep apnea and MADs explainer",
        description: "A short video walkthrough of what sleep apnea is and how a mandibular advancement device treats it.",
        videoUrl: "",
        externalUrl: HS_PATIENT("6a7610dbef702f1236c2f38d"),
        thumbnailUrl: "",
        meta: "Video",
        downloadable: true,
      },
      buttonLabel: "Watch",
      anchorId: "featured",
    },
  },
  {
    id: psid("hub-library", 3),
    type: "hub-library",
    props: {
      theme: "site",
      kicker: "Your guide",
      headline: "What to know,\nin four short reads.",
      subheadline: "Open any guide right here, or download it to keep.",
      layout: "stacked",
      columns: 2,
      showSearch: false,
      searchPlaceholder: "",
      anchorId: "library",
      sections: [
        {
          kicker: "Patient guide",
          title: "Understanding your treatment",
          description: "",
          items: [
            { key: "what-the-research-says", kind: "pdf", title: "What the research says", description: "The science behind treating sleep apnea, and what treatment protects.", fileUrl: "", externalUrl: HS_PATIENT("6a7615f448a65c708afdb7be"), meta: "Short read" },
            { key: "what-sleep-apnea-steals", kind: "pdf", title: "What sleep apnea steals from your days", description: "The daily toll on energy, weight, mood and focus — and what you get back.", fileUrl: "", externalUrl: HS_PATIENT("6a761605b68f6e23679abab2"), meta: "Short read" },
            { key: "what-to-expect", kind: "pdf", title: "What to expect from your oral appliance", description: "The first weeks with a new device, and why nightly wear makes it work.", fileUrl: "", externalUrl: HS_PATIENT("6a76113ed0a671b46fe47b45"), meta: "Short read" },
            { key: "how-an-appliance-works", kind: "pdf", title: "How a custom oral appliance works", description: "The simple mechanics that keep your airway open while you sleep.", fileUrl: "", externalUrl: HS_PATIENT("6a761612d0a671f143ebbbbd"), meta: "Short read" },
          ],
        },
      ],
    },
  },
  {
    id: psid("hub-support", 4),
    type: "hub-support",
    props: {
      theme: "site",
      kicker: "Questions?",
      headline: "We're here to help.",
      body: "Email us for more information about your treatment or your appliance.",
      email: SLEEP_EMAIL,
      emailLabel: `Email ${SLEEP_EMAIL}`,
      linkText: "",
      linkUrl: "",
      disclaimer: "Educational information only. Not medical advice. © Dandy Sleep.",
      anchorId: "support",
    },
  },
  sleepFooter(psid("dandy-site-footer", 5)),
];

export const CONTENT_HUB_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: GENERIC_SLUG,
    title: "Content Hub — Resource Library",
    templateLabel: "Content Hub — Resource Library",
    templateDescription:
      "An ungated resource hub in the brand-site style (four presets: Brand site, Editorial dark, Gallery, Index): a hero with an audience switch in its own top bar, a 'start here' spotlight (video or PDF), a sectioned library with a sticky rail, search and in-page PDF / video viewing with downloads, and a questions-and-support close. Per-resource views and downloads are tracked on the page's analytics.",
    ogImage: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=1200&h=630&fit=crop",
    industry: null,
    premiumRank: 13,
    funnelStage: "onboarding",
    blocks: genericBlocks,
  },
  {
    slug: DENTIST_SLUG,
    title: "Dandy Sleep — Dentist Resource Hub",
    templateLabel: "Dandy Sleep — Dentist Resource Hub",
    templateDescription:
      "The dentist-facing Dandy Sleep hub (dandysleep.com/dentists): every stage from the onboarding kit to titration — 18 guides, videos and help-center references grouped by step, the patient journey spotlighted up top, and the sleep@ support close.",
    ogImage: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=1200&h=630&fit=crop",
    industry: "dental",
    premiumRank: 14,
    funnelStage: "onboarding",
    blocks: dentistBlocks,
  },
  {
    slug: PATIENT_SLUG,
    title: "Dandy Sleep — Patient Resource Hub",
    templateLabel: "Dandy Sleep — Patient Resource Hub",
    templateDescription:
      "The patient-facing Dandy Sleep hub (dandysleep.com/patients): the sleep apnea and MADs explainer video up top, four short reads on the research, the daily toll, what to expect and how the appliance works, and a 'we're here to help' close with the medical-advice disclaimer.",
    ogImage: "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?q=80&w=1200&h=630&fit=crop",
    industry: "dental",
    premiumRank: 15,
    funnelStage: "onboarding",
    blocks: patientBlocks,
  },
];
