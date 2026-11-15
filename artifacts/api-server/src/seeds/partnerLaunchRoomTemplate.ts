// Partner Launch Room (Nov 2026) — the customer-facing "room" a new DSO
// partner gets instead of a Word media kit and a zip of images.
//
// One page on the Content Hub family:
//   hub-hero      welcome + jump links
//   hub-featured  the partnership one-pager
//   hub-library   the announcement kit: email + social copy (Copy button),
//                 social images, brand assets, guides for practices
//   hub-plan      the 90-day plan + the shared action plan (two swimlanes)
//   hub-team      named people on both sides
//   hub-paths     welcome event options + co-marketing
//   hub-support   close
//
// Everything account-specific comes from `PartnerLaunchRoomInput`, so the
// SAME builder produces the seeded template (placeholder partner) and a real
// partner's room. Copy is the standard DSO Partner Media Kit and the Lab
// Transition Success Plan; nothing here is partner-confidential (no pricing).

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

export interface LaunchRoomPerson {
  name: string;
  role?: string;
  owns?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
}

export interface LaunchRoomTask {
  /** Stable key for the task's saved state on the page. */
  key?: string;
  task: string;
  owner?: string;
  due?: string;
  status?: "done" | "on-track" | "at-risk" | "not-started";
  /** Let the partner complete it from the room: tick it, or upload a file (private, one-way). */
  customerAction?: "check" | "upload";
  uploadLabel?: string;
}

export interface PartnerLaunchRoomInput {
  /** Used in block ids: `seed-<slug>-<type>-<n>`. */
  slug: string;
  /** Partner name as it should read in copy ("MB2 Dental"). */
  partner: string;
  /** Short form for possessives and sign-offs ("MB2"). Defaults to `partner`. */
  partnerShort?: string;
  /** What the partner calls its locations ("practices"). */
  locationsNoun?: string;
  /** Partnership sign-up page for the partner's practices. */
  signupUrl?: string;
  onePagerUrl?: string;
  onePagerThumbnailUrl?: string;
  practiceWelcomeGuideUrl?: string;
  successGuideUrl?: string;
  brandGuidelinesUrl?: string;
  logosUrl?: string;
  socialImages?: { title: string; url: string; meta?: string }[];
  /** Which 30-day phase is happening now (0–2). Earlier phases show as done. Omit = none lit. */
  currentPhase?: number;
  ourTasks?: LaunchRoomTask[];
  partnerTasks?: LaunchRoomTask[];
  ourTeam?: LaunchRoomPerson[];
  partnerTeam?: LaunchRoomPerson[];
  supportEmail?: string;
}

const DANDY_DESCRIPTION =
  "Dandy is a dental technology company powering the world's most advanced digital dental lab. Dandy partners with dental practices and DSOs to transform their business by combining proprietary manufacturing, real-time technician collaboration, and cutting-edge technology to help clinicians stay one step ahead. With unparalleled quality, efficiency, and experience, Dandy makes the business of dentistry pain-free.";

const DEFAULT_OUR_TASKS: LaunchRoomTask[] = [
  { task: "Executive kickoff & success metrics", owner: "Dandy AE", due: "Week 1", status: "not-started" },
  { task: "Welcome kits shipped to all practices", owner: "Dandy Marketing", due: "Week 2", status: "not-started" },
  { task: "First-wave training scheduled", owner: "Dandy Implementation", due: "Week 3", status: "not-started" },
  { task: "Enterprise Hub walkthrough booked", owner: "Dandy CS", due: "Week 6", status: "not-started" },
];

export const DEFAULT_PARTNER_TASKS: LaunchRoomTask[] = [
  { key: "practice-roster", task: "Send your practice and regional manager roster", owner: "Operations", due: "Week 1", status: "not-started", customerAction: "upload", uploadLabel: "Upload your roster" },
  { key: "brand-guidelines", task: "Share your brand guidelines and logos", owner: "Marketing", due: "Week 1", status: "not-started", customerAction: "upload", uploadLabel: "Upload brand files" },
  { key: "internal-announcement", task: "Internal partnership announcement", owner: "Communications", due: "Week 2", status: "not-started", customerAction: "check" },
  { key: "regional-kickoff", task: "Regional leader kickoff booked", owner: "Operations", due: "Week 3", status: "not-started", customerAction: "check" },
  { key: "clinical-champion", task: "Clinical champion identified", owner: "Clinical leadership", due: "Week 4", status: "not-started", customerAction: "check" },
];

const DEFAULT_OUR_TEAM: LaunchRoomPerson[] = [
  { name: "[Name]", role: "DSO Partnerships (Account Executive)", owns: "Partnership strategy and your executive relationship." },
  { name: "[Name]", role: "Account Manager", owns: "Your day-to-day partner: business reviews, adoption and expansion planning." },
  { name: "[Name]", role: "Implementation", owns: "Training schedules and go-live for every practice." },
  { name: "[Name]", role: "Partner Marketing", owns: "Your announcement kit, welcome kits, events and co-marketing." },
];

const DEFAULT_PARTNER_TEAM: LaunchRoomPerson[] = [
  { name: "[Name]", role: "Executive sponsor", owns: "Sets the direction for the partnership and clears escalations." },
  { name: "[Name]", role: "Operations lead", owns: "Runs your side of the shared plan and logistics." },
  { name: "[Name]", role: "Clinical champion", owns: "Peer voice for your doctors and your first success story." },
];

export function buildPartnerLaunchRoomBlocks(input: PartnerLaunchRoomInput): Block[] {
  const sid = (type: string, n: number) => `seed-${input.slug}-${type}-${n}`;
  const partner = input.partner;
  const short = input.partnerShort || partner;
  const noun = input.locationsNoun || "practices";
  const phaseStatus = (i: number) => (input.currentPhase === undefined ? "upcoming" : i < input.currentPhase ? "done" : i === input.currentPhase ? "current" : "upcoming");

  const emailBody = [
    "Subject: Introducing Dandy: Our Official Digital Lab & Technology Partner",
    "",
    "Dear Partners,",
    "",
    "We’re excited to announce that Dandy is now our Official Digital Lab & Technology Partner.",
    "",
    "This partnership represents a strategic investment in digital infrastructure across our network. By integrating scanning, AI-powered quality control, advanced manufacturing, and real-time support into one connected platform, Dandy helps us modernize restorative workflows while improving clinical consistency and operational performance.",
    "",
    `Through this partnership, ${short} ${noun} gain access to:`,
    "",
    "• Fully Integrated Digital Workflows: End-to-end digital systems designed to reduce friction and increase predictability.",
    "• Polychromatic Shade™: Next-generation anterior and posterior crowns, so you can give your patients porcelain-like aesthetics at a zirconia pricepoint.",
    "• Flexible Lab Workflows - No Spend Minimums: Whether you're sending a single case or managing high volumes, route scanned cases to Dandy or any preferred lab.",
    "• AI Scan Review & Live Chairside Support: Automated quality checks and real-time technician guidance to reduce remakes and repeat appointments.",
    "• Structured Onboarding & CE Support: Training and implementation resources to ensure a smooth transition and long-term success.",
    "",
    "This is more than just a lab partnership. It’s a move toward a more connected, data-driven restorative model.",
    "",
    "We look forward to the positive impact this partnership creates for your staff and patients.",
    "",
    `Sincerely,\n[${short} Leadership Team]`,
  ].join("\n");

  const social1 = [
    "We’re excited to announce our partnership with Dandy as our Official Digital Lab & Technology Partner.",
    "",
    "This collaboration supports our commitment to modernizing clinical infrastructure, improving predictability, and equipping our clinicians with advanced digital workflows.",
    "",
    "Together, we’re building a more connected and scalable restorative model across our network.",
  ].join("\n");

  const social2 = [
    "We’re proud to announce Dandy as our Official Digital Lab & Technology Partner.",
    "",
    "This partnership brings fully integrated digital workflows, AI-powered quality control, and advanced manufacturing capabilities to our network — strengthening clinical predictability and operational performance across every practice.",
    "",
    `We’re investing in the infrastructure to build a brighter future for ${short} partners, patients, and staff.`,
  ].join("\n");

  const socialImages = (input.socialImages ?? []).map((img, i) => ({
    key: `social-image-${i + 1}`,
    kind: "image",
    title: img.title,
    description: "Co-branded announcement graphic. Download and post with either caption.",
    fileUrl: img.url,
    meta: img.meta ?? "PNG",
    downloadable: true,
  }));

  return [
    {
      id: sid("hub-hero", 1),
      type: "hub-hero",
      props: {
        theme: "site",
        navLinks: [
          { label: "Launch kit", url: "#kit" },
          { label: "The plan", url: "#plan" },
          { label: "Your team", url: "#team" },
          { label: "Co-marketing", url: "#celebrate" },
        ],
        navCtaText: "Contact your team",
        navCtaUrl: "#team",
        kicker: `Dandy × ${partner}`,
        headline: "Welcome to Dandy.\nYour launch room.",
        subheadline: `We’re proud to partner with ${partner} as your Official Digital Lab & Technology Partner. Everything for a coordinated rollout across your network lives here: the announcement kit, the plan we run together, and the people behind it.`,
        ctaText: "Open the launch kit",
        ctaAction: "url",
        ctaUrl: "#kit",
        ctaSecondaryText: "See the 90-day plan",
        ctaSecondaryAction: "url",
        ctaSecondaryUrl: "#plan",
        facts: [{ label: "Announcement kit" }, { label: "90-day plan" }, { label: "Your dedicated team" }],
        mediaImageUrl: "",
        mediaImageAlt: "",
        minHeightVh: 64,
      },
    },
    {
      id: sid("hub-featured", 2),
      type: "hub-featured",
      props: {
        theme: "site",
        kicker: "Start here",
        asset: {
          key: "partnership-one-pager",
          kind: "pdf",
          title: "The partnership, on one page",
          description: `What the Dandy partnership means for ${short} ${noun}: what’s included, how to get started, and where to sign up. Share it with your regional leaders and practices.`,
          fileUrl: input.onePagerUrl ?? "",
          thumbnailUrl: input.onePagerThumbnailUrl ?? "",
          meta: "PDF",
          downloadable: true,
        },
        buttonLabel: "Read the one-pager",
        anchorId: "featured",
      },
    },
    {
      id: sid("hub-library", 3),
      type: "hub-library",
      props: {
        theme: "site",
        kicker: "Launch kit",
        headline: "Everything you need to announce the partnership.",
        subheadline: "Approved copy, graphics and brand assets, ready to copy or download. Send us your own brand guidelines and we’ll follow them in everything we make for you.",
        layout: "rail",
        columns: 3,
        showSearch: false,
        anchorId: "kit",
        sections: [
          {
            kicker: "Step 1 · Tell your network",
            title: "Announcement copy",
            description: "An email for your practices and two captions for social. Open one and copy it in a click.",
            items: [
              { key: "announcement-email", kind: "text", title: "Announcement email", description: "Subject line and body, written to come from your leadership team.", body: emailBody, meta: "Email" },
              { key: "social-caption-1", kind: "text", title: "Social post, version 1", description: "A shorter caption on modernizing clinical infrastructure.", body: social1, meta: "Social" },
              { key: "social-caption-2", kind: "text", title: "Social post, version 2", description: "A fuller caption on what the partnership brings to every practice.", body: social2, meta: "Social" },
              ...(input.signupUrl
                ? [{ key: "signup-page", kind: "link", title: `${short} partnership sign-up page`, description: `Where your ${noun} get started with Dandy. Link to it from your announcement.`, externalUrl: input.signupUrl, meta: "Sign-up page" }]
                : []),
            ],
          },
          ...(socialImages.length
            ? [{ kicker: "Step 2 · Post it", title: "Social graphics", description: "Co-branded images sized for feed posts and link previews.", items: socialImages }]
            : []),
          {
            kicker: `Step ${socialImages.length ? 3 : 2} · Use our brand`,
            title: "Dandy brand assets",
            description: "Logos, guidelines and the approved description of Dandy.",
            items: [
              { key: "dandy-description", kind: "text", title: "Approved Dandy description", description: "The short description to use wherever you introduce Dandy.", body: DANDY_DESCRIPTION, meta: "Boilerplate" },
              { key: "dandy-logos", kind: "link", title: "Dandy logos", description: "Primary and reversed logos in every format.", externalUrl: input.logosUrl ?? "", meta: "Folder" },
              { key: "dandy-brand-guidelines", kind: "link", title: "Dandy brand guidelines", description: "Colours, type and logo usage.", externalUrl: input.brandGuidelinesUrl ?? "", meta: "Guidelines" },
            ],
          },
          {
            kicker: `Step ${socialImages.length ? 4 : 3} · Share with practices`,
            title: `Guides for your ${noun}`,
            description: "What to send regional leaders and practice teams as they get started.",
            items: [
              { key: "practice-welcome-guide", kind: "pdf", title: "Practice Welcome Guide", description: "What a practice can expect: training, first cases and who to call.", fileUrl: input.practiceWelcomeGuideUrl ?? "", meta: "PDF" },
              { key: "partnership-success-guide", kind: "pdf", title: "Partnership Success Guide", description: "The full success plan behind this rollout, for your leadership team.", fileUrl: input.successGuideUrl ?? "", meta: "PDF" },
            ],
          },
        ],
      },
    },
    {
      id: sid("hub-plan", 4),
      type: "hub-plan",
      props: {
        theme: "site",
        kicker: "Your first 90 days",
        headline: "Structured for adoption, momentum and proof.",
        subheadline: "Every phase ends with a shared definition of done. The rollout never advances on assumptions.",
        successLabel: "Done looks like",
        anchorId: "plan",
        phases: [
          {
            label: "Days 1–30",
            title: "Foundation & launch",
            items: [
              "Executive kickoff on success metrics and cadence",
              "Mutual Action Plan finalized",
              "Partnership announced across your network",
              "First wave of practices onboarded with scanners and hands-on training",
            ],
            success: "Plan signed off, partnership announced, first practices trained and submitting cases.",
            status: phaseStatus(0),
          },
          {
            label: "Days 31–60",
            title: "Momentum & optimization",
            items: [
              "Early clinical wins reviewed with leadership",
              "Executive walkthrough of the Enterprise Hub as data populates",
              "Education events booked",
              "Next wave of practices planned",
            ],
            success: "Early wins documented, Hub reviewed, next wave scheduled, events on the calendar.",
            status: phaseStatus(1),
          },
          {
            label: "Days 61–90",
            title: "Scaling & ROI",
            items: [
              "Initial ROI and performance review",
              "A case study from your first activated practices",
              "Regional events to accelerate adoption",
              "First Executive Business Review",
            ],
            success: "ROI reviewed, your own case study in hand, expansion plan agreed.",
            status: phaseStatus(2),
          },
        ],
        planTitle: "Mutual Action Plan",
        planNote: "One plan, two swimlanes. Reviewed at every check-in. Files you upload go straight to your Dandy team and are not shown here.",
        lanes: [
          { title: "Dandy deliverables", rows: input.ourTasks ?? DEFAULT_OUR_TASKS },
          { title: `${short} deliverables`, rows: input.partnerTasks ?? DEFAULT_PARTNER_TASKS },
        ],
      },
    },
    {
      id: sid("hub-team", 5),
      type: "hub-team",
      props: {
        theme: "site",
        kicker: "Your dedicated team",
        headline: "Named people, executive accountability.",
        subheadline: "Who owns what on both sides, and how to reach them. Anything blocked for more than a week goes straight to the executive sponsors.",
        anchorId: "team",
        groups: [
          { title: "Your team at Dandy", members: input.ourTeam ?? DEFAULT_OUR_TEAM },
          { title: `The ${short} team`, members: input.partnerTeam ?? DEFAULT_PARTNER_TEAM },
        ],
      },
    },
    {
      id: sid("hub-paths", 6),
      type: "hub-paths",
      props: {
        theme: "site",
        kicker: "Let’s celebrate the partnership",
        headline: "A welcome event, and more ways to share the news.",
        subheadline: `To kick things off, we’d love to host an event for ${partner}. You bring the guest list; we handle the planning, logistics, cost and hosting.`,
        anchorId: "celebrate",
        paths: [
          {
            kicker: "Welcome event · Option one",
            title: "Lunch, dinner or happy hour",
            description: "At a local restaurant or bar near your headquarters.",
            bullets: ["A “How to succeed with Dandy” overview and discussion", "VR lab tours on Apple Vision Pro", "Co-branded Dandy swag for attendees", "Minimum 10 attendees, plan for 2–3 hours"],
            ctaText: "Choose this option",
            ctaUrl: "#team",
          },
          {
            kicker: "Welcome event · Option two",
            title: "Onsite training at your HQ",
            description: "Hosted at your corporate headquarters.",
            bullets: ["Hands-on onboarding for doctors and staff", "VR lab tours on Apple Vision Pro", "Workflows tailored to your team’s day-to-day", "Flexible schedule, built around patient care"],
            ctaText: "Choose this option",
            ctaUrl: "#team",
          },
          {
            kicker: "Co-marketing",
            title: "Share the story together",
            description: "Optional ways to promote the partnership, written and produced by Dandy.",
            bullets: ["A joint press release, customized for your organization", "A guest spot on our podcast, The Margin Line", "Your own case study from your first activated practices", "Support for your events and internal meetings"],
            ctaText: "Tell us you’re interested",
            ctaUrl: "#team",
          },
        ],
      },
    },
    {
      id: sid("hub-support", 7),
      type: "hub-support",
      props: {
        theme: "site",
        kicker: "Questions?",
        headline: "Need something that isn’t here?\nJust ask.",
        body: "New assets land in this room as we make them. If you need a different format, a custom graphic or an update to anything above, your Dandy team will turn it around.",
        email: input.supportEmail ?? "",
        emailLabel: "",
        linkText: "See your Dandy team",
        linkUrl: "#team",
        disclaimer: "",
        anchorId: "support",
      },
    },
  ];
}

/* ── The workspace (Nov 2026): one full-page `room-workspace` block ──────── */

export interface WorkspaceMilestone {
  key?: string;
  target?: string;
  task: string;
  note?: string;
  ourOwner?: string;
  partnerOwner?: string;
  status?: "done" | "on-track" | "pending" | "blocking" | "not-started";
  customerAction?: "check" | "upload";
  uploadLabel?: string;
}
type WorkspaceGroup = { title: string; checkpoint?: string; rows: WorkspaceMilestone[] };

const M = (key: string, task: string, ourOwner: string, partnerOwner: string, extra: Partial<WorkspaceMilestone> = {}): WorkspaceMilestone => ({ key, task, ourOwner, partnerOwner, status: "not-started", ...extra });

/**
 * The post-signature Mutual Action Plan from the Partnership Success Workbook:
 * every milestone with a Dandy owner and a partner owner, a checkpoint per
 * phase. The partner's own deliverables can be completed from the room.
 */
export const DEFAULT_WORKSPACE_PLAN: WorkspaceGroup[] = [
  {
    title: "Days 0–5 · Setup & welcome",
    checkpoint: "Team named on both sides · roster received · billing verified",
    rows: [
      M("team-assigned", "Your dedicated team assigned and introduced", "AE", "—"),
      M("practice-roster", "Upload your practice list", "—", "Operations Lead", { customerAction: "upload", uploadLabel: "Upload practice list", note: "Practice names, addresses, regional managers and an office contact for each" }),
      M("doctor-roster", "Upload your doctor roster", "—", "Operations Lead", { customerAction: "upload", uploadLabel: "Upload doctor roster", note: "Doctors by practice, so training and support reach the right people" }),
      M("accounts-confirmed", "Accounts, hierarchy and mailing addresses confirmed", "Implementation", "Operations Lead"),
      M("pricing-verified", "Contracted pricing verified against your first invoice", "Dandy Billing", "Procurement"),
      M("welcome-email", "Welcome email and partnership one-pager to your leadership", "Dandy Marketing", "—"),
    ],
  },
  {
    title: "Days 5–15 · Launch",
    checkpoint: "Plan signed off · partnership announced · kits shipped and tracked",
    rows: [
      M("exec-kickoff", "Executive kickoff: walk this plan together, finalize owners and dates", "AE", "Executive Sponsor"),
      M("brand-guidelines", "Your brand guidelines and logos shared", "Dandy Marketing", "Communications"),
      M("internal-announcement", "Internal announcement via the co-branded launch kit", "Dandy Marketing", "Communications", { customerAction: "check" }),
      M("welcome-kits", "Welcome kits shipped to practices; leadership gifts to regional managers", "Dandy Marketing", "—"),
      M("welcome-event", "Welcome event chosen and scoped", "AE", "Executive Sponsor", { customerAction: "check" }),
    ],
  },
  {
    title: "Days 15–30 · Alignment",
    checkpoint: "Regional 1:1s booked · first wave on the calendar · Lunch & Learns underway",
    rows: [
      M("regional-kickoff", "Regional managers kickoff, then 1:1s scheduled", "AE", "Regional Managers", { customerAction: "check" }),
      M("marketing-kickoff", "Marketing kickoff with your marketing leadership", "Dandy Marketing", "Communications"),
      M("lunch-and-learns", "Lunch & Learn program begins across practices", "Practice-Level AE", "Regional Managers"),
      M("first-wave-scheduled", "First-wave practices scheduled: scanner delivery, setup and training", "Implementation", "Operations Lead"),
      M("first-case-watch", "First-case quality watch on: enhanced double-review of every practice's first cases", "Dandy Lab", "—"),
    ],
  },
  {
    title: "Days 31–60 · Momentum & optimization",
    checkpoint: "Early wins documented · Hub reviewed · next wave scheduled · events booked",
    rows: [
      M("regional-1-1s", "1:1 meetings completed with every regional manager", "AE", "Regional Managers"),
      M("first-live", "First practices live and submitting cases; early clinical wins reviewed", "Implementation", "Clinical Champion"),
      M("education-events", "Education events booked for your regions", "Dandy Training", "Regional Managers"),
      M("hub-walkthrough", "Enterprise Hub walkthrough: utilization, quality and ROI by location", "Account Manager", "Executive Sponsor"),
      M("feedback-loop", "Structured feedback loop running with leadership and practice teams", "Account Manager", "Operations Lead"),
      M("next-wave", "Next wave of practices identified and planned", "AE + AM", "Regional Managers", { customerAction: "check" }),
    ],
  },
  {
    title: "Days 61–90 · Scaling & ROI",
    checkpoint: "ROI reviewed · case study in hand · expansion plan agreed · standing executive cadence",
    rows: [
      M("roi-review", "Initial ROI and performance review from the Enterprise Hub", "Account Manager", "Executive Sponsor"),
      M("case-study", "Your own case study from your first practices", "Dandy Marketing", "Clinical Champion"),
      M("regional-events", "Regional events to accelerate adoption", "Dandy Events", "Regional Managers"),
      M("first-ebr", "First Executive Business Review: outcomes vs. goals, expansion plan", "AE + Exec Sponsor", "Executive Sponsor"),
      M("transition", "Transition from onboarding to long-term optimization and growth planning", "Account Manager", "Operations Lead"),
    ],
  },
];

export interface PartnerWorkspaceInput extends Pick<PartnerLaunchRoomInput, "slug" | "partner" | "partnerShort" | "locationsNoun" | "signupUrl" | "onePagerUrl" | "practiceWelcomeGuideUrl" | "successGuideUrl" | "brandGuidelinesUrl" | "logosUrl" | "socialImages"> {
  partnerLogoUrl?: string;
  /** YYYY-MM-DD. Drives "Day N of 90" and which phase is in progress. */
  kickoffDate?: string;
  heroImageUrl?: string;
  nextMilestoneLabel?: string;
  nextMilestoneDate?: string;
  planGroups?: WorkspaceGroup[];
  ourTeam?: (LaunchRoomPerson & { when?: string })[];
  partnerTeam?: (LaunchRoomPerson & { when?: string })[];
  hiddenModules?: string[];
}

const WORKSPACE_OUR_TEAM: (LaunchRoomPerson & { when?: string })[] = [
  { name: "[Name]", role: "DSO Partnerships (Account Executive)", owns: "Partnership strategy and your executive relationship", when: "Evaluation to launch" },
  { name: "[Name]", role: "Account Manager", owns: "Your day-to-day partner: business reviews, adoption, expansion planning", when: "From kickoff" },
  { name: "[Name]", role: "Practice-Level Account Executive", owns: "Lunch & Learns, practice questions, scheduling", when: "Launch to rollout" },
  { name: "[Name]", role: "Implementation Specialist", owns: "Scanner delivery, portal setup, training scheduling", when: "First wave onward" },
  { name: "[Name]", role: "Clinical Support & Training", owns: "Onsite and virtual training, CE courses, live chairside support", when: "First training onward" },
  { name: "[Name]", role: "Partner Marketing", owns: "Your launch kit, welcome kits, events and co-marketing", when: "Launch window" },
  { name: "[Name]", role: "Executive Sponsor", owns: "Personally accountable for this partnership; your escalation path", when: "Kickoff, reviews, escalations" },
];
const WORKSPACE_PARTNER_TEAM: (LaunchRoomPerson & { when?: string })[] = [
  { name: "[Name]", role: "Executive Sponsor", owns: "Champions the partnership internally; decision-maker", when: "Kickoff, checkpoints, reviews" },
  { name: "[Name]", role: "Operations Lead", owns: "Owns your side of the action plan; coordinates logistics", when: "Weekly during rollout" },
  { name: "[Name]", role: "Clinical Champion", owns: "Clinical voice of the partnership; peer reference for doctors", when: "Launch and advocacy" },
  { name: "[Name]", role: "Regional Managers", owns: "Territory-level rollout partners", when: "From regional kickoff" },
  { name: "[Name]", role: "Communications / Marketing", owns: "Internal announcement and co-branded communications", when: "Launch window" },
  { name: "[Name]", role: "Procurement / Billing", owns: "Monthly alignment on billing and vendor setup", when: "Monthly" },
  { name: "[Name]", role: "Education Lead", owns: "Your CE calendar and event sponsorships", when: "Day 30 onward" },
];

/** The welcome checklist: three easy first steps. The heavier asks (practice list, doctor roster) are action-plan uploads, so they sit in "Needs your attention". */
export const DEFAULT_WORKSPACE_ONBOARDING = {
  title: "",
  intro: "Three quick things to get started. The practice list and doctor roster are waiting for you below.",
  steps: [
    { key: "onboard-logo", title: "Upload your logo", description: "So everything we make for you carries your brand. Brand guidelines welcome too.", action: "upload", buttonLabel: "Upload logo" },
    { key: "onboard-gift", title: "Accept your welcome kit", description: "Tell us where to send it and who it's for.", action: "request", buttonLabel: "Accept kit", requestKind: "marketing" },
    { key: "onboard-team", title: "Add your team", description: "Your executive sponsor, operations lead, clinical champion and marketing contact.", action: "team", buttonLabel: "Add people" },
  ],
};

const P = (key: string, title: string, description: string, audience: string, when: string, options?: string[]) => ({ key, title, description, audience, when, imageUrl: "", ...(options ? { options } : {}) });

/** The marketing plan: the standard launch package plus opt-in programs the partner decides on. */
export const DEFAULT_WORKSPACE_MARKETING = {
  intro: "Choose the support you want from Dandy. We run it, and your choices become the plan your marketing team and ours work from.",
  groups: [
    {
      title: "Standard launch package",
      note: "Included in every partnership",
      programs: [
        P("mk-announcement", "Partnership announcement", "Email, social posts and one-pager for your network, in your brand.", "Leadership, practices", "Day 5"),
        P("mk-welcome-kits", "Welcome kits to every practice", "Shipped to each practice on your list, with gifts for regional managers.", "Practices, regional managers", "Day 15"),
        P("mk-lunch-learn", "Lunch & Learn program", "In-practice introductions led by Dandy, booked with your office managers.", "Practices", "Days 15–45", ["Include", "Not now"]),
        P("mk-video-mailer", "Video mailer and lab-credit offer", "A video mailer to every practice with a lab credit toward first cases.", "Practices", "Days 30–45", ["Include", "Not now"]),
        P("mk-welcome-event", "Welcome event for your team", "We plan, host and cover it. You bring the guest list.", "Leadership, regional managers", "By Day 60", ["Dinner", "Onsite training", "Not now"]),
        P("mk-launch-promo", "90-day launch promotion", "A magalog and promotion postcard to every practice.", "Practices", "Day 60", ["Include", "Not now"]),
      ],
    },
    {
      title: "Optional add-ons",
      note: "Based on your network's needs",
      programs: [
        P("mk-lab-tour", "Executive lab tour", "A private tour of the lab for your leadership, in person or in VR.", "Leadership", "Flexible", ["Include", "Not now"]),
        P("mk-case-study", "Your own case study", "Built from your first activated practices, approved by your clinical champion.", "Your whole network", "Days 60–90", ["Include", "Not now"]),
        P("mk-press-release", "Joint press release", "Written and distributed by Dandy, approved by your communications team.", "Public", "Flexible", ["Include", "Not now"]),
        P("mk-podcast", "Podcast feature", "A guest spot for one of your leaders on The Margin Line.", "Public", "Flexible", ["Include", "Not now"]),
        P("mk-regional-events", "Regional events", "Education events by territory to accelerate adoption where you want it most.", "Regional managers, practices", "Days 60–90", ["Include", "Not now"]),
        P("mk-swag", "Co-branded swag", "Custom kits and swag carrying both brands.", "Practices", "Flexible", ["Include", "Not now"]),
      ],
    },
  ],
};

/**
 * Goals. Lab spend is the north star: share of the partner's total lab spend
 * with Dandy. Counted goals come from the room's practice list; the rest are
 * typed in by the account team until the warehouse feed is connected.
 */
export const DEFAULT_WORKSPACE_GOALS = {
  intro: "Agreed at kickoff and reviewed at every business review, so we always start from the same numbers.",
  askAgreement: true,
  items: [
    { key: "goal-lab-spend", title: "Share of lab spend with Dandy", detail: "Across practices live more than 30 days", target: "", metric: "manual", current: "", source: "", owner: "Executive sponsors", status: "on-track" },
    { key: "goal-live", title: "Practices live and submitting cases", target: "", metric: "practices_live", owner: "Operations", status: "on-track" },
    { key: "goal-trained", title: "Practices trained", target: "", metric: "practices_trained", owner: "Implementation", status: "on-track" },
    { key: "goal-doctors", title: "Active doctors at key practices", detail: "Your highest lab-spend practices", target: "", metric: "manual", current: "", source: "", owner: "Clinical leadership", status: "on-track" },
  ],
};

/** The whole room as one `room-workspace` block. Reuses the launch-kit copy from the hub builder above. */
export function buildPartnerWorkspaceBlocks(input: PartnerWorkspaceInput): Block[] {
  const short = input.partnerShort || input.partner;
  const noun = input.locationsNoun || "practices";
  // The announcement copy lives in ONE place: read it back from the hub builder's library block.
  const hub = buildPartnerLaunchRoomBlocks({ ...input });
  const library = hub.find((b) => b.type === "hub-library")?.props as { sections: { items: { key?: string; kind: string; title: string; description?: string; body?: string }[] }[] };
  const copy = library.sections[0].items.filter((i) => i.kind === "text").map((i) => ({ key: i.key, kind: "text", title: i.title, description: i.description, body: i.body }));
  const assets: Props[] = [
    { key: "partnership-one-pager", kind: "pdf", title: "Partnership one-pager", description: `For regional leaders and ${noun}`, fileUrl: input.onePagerUrl ?? "" },
    ...copy,
    ...(input.socialImages ?? []).map((img, i) => ({ key: `social-image-${i + 1}`, kind: "image", title: img.title, description: `Co-branded social graphic${img.meta ? ` · ${img.meta}` : ""}`, fileUrl: img.url })),
    { key: "practice-welcome-guide", kind: "pdf", title: "Practice Welcome Guide", description: "What a practice can expect: training, first cases, who to call", fileUrl: input.practiceWelcomeGuideUrl ?? "" },
    { key: "dandy-description", kind: "text", title: "Approved Dandy description", description: "The short description to use wherever you introduce Dandy", body: DANDY_DESCRIPTION },
    { key: "dandy-logos", kind: "link", title: "Dandy logos", description: "Primary and reversed logos in every format", externalUrl: input.logosUrl ?? "" },
    { key: "dandy-brand-guidelines", kind: "link", title: "Dandy brand guidelines", description: "Colours, type and logo usage", externalUrl: input.brandGuidelinesUrl ?? "" },
  ];
  const links = [
    ...(input.signupUrl ? [{ title: `${short} practice sign-up page`, description: input.signupUrl.replace(/^https?:\/\//, ""), url: input.signupUrl }] : []),
    ...(input.successGuideUrl ? [{ title: "Success Plan", description: "The 90-day plan your leadership reviewed", url: input.successGuideUrl }] : []),
  ];
  return [
    {
      id: `seed-${input.slug}-room-workspace-1`,
      type: "room-workspace",
      props: {
        partnerName: input.partner,
        partnerLogoUrl: input.partnerLogoUrl ?? "",
        eyebrow: "Partnership workspace",
        title: "launch plan",
        lede: `The plan we run together, everything your team needs to announce it, and the people accountable on both sides.`,
        heroImageUrl: input.heroImageUrl ?? "",
        heroImageAlt: "",
        kickoffDate: input.kickoffDate ?? "",
        rolloutDays: 90,
        nextMilestoneLabel: input.nextMilestoneLabel ?? "",
        nextMilestoneDate: input.nextMilestoneDate ?? "",
        hiddenModules: input.hiddenModules ?? [],
        phases: [
          { label: "Days 1–30", title: "Foundation & launch", summary: "Plan signed off, partnership announced, first practices trained and submitting cases.", endDay: 30 },
          { label: "Days 31–60", title: "Momentum & optimization", summary: "Early wins reviewed, Enterprise Hub walkthrough, next wave of practices scheduled.", endDay: 60 },
          { label: "Days 61–90", title: "Scaling & ROI", summary: "ROI review from your own data, your first case study, expansion plan agreed.", endDay: 90 },
        ],
        onboarding: structuredClone(DEFAULT_WORKSPACE_ONBOARDING),
        marketing: structuredClone(DEFAULT_WORKSPACE_MARKETING),
        goals: structuredClone(DEFAULT_WORKSPACE_GOALS),
        calendar: { intro: "Meetings, trainings and marketing sends in one place.", events: [] },
        meetings: { intro: "What was decided, and who took which action.", items: [] },
        locationsNoun: noun,
        planIntro: `Every milestone has an owner at Dandy and at ${short}. Anything blocked for more than a week goes to both executive sponsors. Files you upload go to your Dandy team only.`,
        planGroups: input.planGroups ?? DEFAULT_WORKSPACE_PLAN,
        kitIntro: "Approved and ready to use. Need an edit? Request a change on any item and follow it under Requests.",
        assets,
        links,
        teamNote: "Replies within one business day",
        team: [
          { title: "Dandy", members: input.ourTeam ?? WORKSPACE_OUR_TEAM },
          { title: input.partner, members: input.partnerTeam ?? WORKSPACE_PARTNER_TEAM },
        ],
        accentColor: "",
      },
    },
  ];
}

const TEMPLATE_SLUG = "global-partner-launch-room";

export const PARTNER_LAUNCH_ROOM_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: TEMPLATE_SLUG,
    title: "Partner Launch Room",
    templateLabel: "Partner Launch Room",
    templateDescription:
      "The customer workspace for a new DSO partnership, in place of the shared tracker spreadsheet and the Word media kit. A branded cover over a module list: an overview of where the rollout stands, an onboarding checklist (logo, practice list, doctor roster, team, welcome gift), a wins feed both sides can post to, the Mutual Action Plan by phase with an owner on each side, a marketing plan where the partner chooses programs, the launch kit with view / download / request changes, a request tracker, and the named team on both sides. Hide any module per account. Set the customer name and kickoff date, attach the files, publish, and send one link.",
    ogImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&h=630&fit=crop",
    industry: "dental",
    premiumRank: 15,
    funnelStage: "onboarding",
    blocks: buildPartnerWorkspaceBlocks({ slug: TEMPLATE_SLUG, partner: "[Partner name]", partnerShort: "[Partner]" }),
  },
];
