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
  task: string;
  owner?: string;
  due?: string;
  status?: "done" | "on-track" | "at-risk" | "not-started";
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

const DEFAULT_PARTNER_TASKS: LaunchRoomTask[] = [
  { task: "Internal partnership announcement", owner: "Communications", due: "Week 2", status: "not-started" },
  { task: "Regional leader kickoff booked", owner: "Operations", due: "Week 3", status: "not-started" },
  { task: "Clinical champion identified", owner: "Clinical leadership", due: "Week 4", status: "not-started" },
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
        planNote: "One plan, two swimlanes. Reviewed at every check-in.",
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

const TEMPLATE_SLUG = "global-partner-launch-room";

export const PARTNER_LAUNCH_ROOM_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: TEMPLATE_SLUG,
    title: "Partner Launch Room",
    templateLabel: "Partner Launch Room",
    templateDescription:
      "The customer-facing room for a new DSO partnership, in place of a Word media kit: the announcement email and social captions with a Copy button, co-branded social graphics, Dandy brand assets, guides for practices, the 90-day plan with a two-swimlane Mutual Action Plan, the named team on both sides, welcome event options and co-marketing. Replace [Partner name], attach the files, publish, and send one link. Opens and downloads are tracked per asset.",
    ogImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&h=630&fit=crop",
    industry: "dental",
    premiumRank: 15,
    funnelStage: "onboarding",
    blocks: buildPartnerLaunchRoomBlocks({ slug: TEMPLATE_SLUG, partner: "[Partner name]", partnerShort: "[Partner]" }),
  },
];
