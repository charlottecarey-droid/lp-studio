// "Lab Tour in a Box — Meta Quest Setup" — the page the QR code on the card
// inside Dandy's VR lab-tour kit opens (lp.meetdandy.com/quest). The kit holds
// a Dandy-branded Meta Quest 3, a Fusion Denture and a card with a six-digit
// code; the page gets the recipient from the box to the lab tour in five
// steps, on a phone, in about ten minutes.
//
// Copy is lifted from the card itself (kicker, headline, paragraph) and the
// Meta Quest user flow Charlotte supplied (Meta/Horizon account → Immersa from
// the Horizon Store → six-digit Dandy code → dedicated Dandy experience →
// stream / play / download). Images are the kit's own product shots, bundled
// under /images/kit/. The access code is deliberately NOT seeded — codes are
// per kit; the cells render blank with "Your code is on the card in the box."
// unless the QR link carries it as ?code=482193 (codeParam), in which case the
// visitor sees their own code filled in.
// The in-depth guide link (kit-support guideUrl) is blank until Charlotte
// uploads the guide — the link hides itself on the live page until then.

import type { GlobalTemplateSeed } from "./globalTemplates";

type Props = Record<string, unknown>;
type Block = { id: string; type: string; props: Props };

const SLUG = "global-dandy-quest-kit";
const sid = (type: string, n: number) => `seed-${SLUG}-${type}-${n}`;

const IMG_HEADSET = "/images/kit/quest-headset.webp";
const IMG_HEADSET_FRONT = "/images/kit/quest-headset-front.webp";
const IMG_BOX = "/images/kit/lab-tour-box.webp";
const IMG_DENTURE = "/images/kit/fusion-denture.webp";
const META_HELP_URL = "https://www.meta.com/help/quest/";
const LIVE_TOUR_URL = "https://www.meetdandy.com/get-started/";
const TALK_TO_SALES_URL = "https://www.meetdandy.com/get-started/";
const IMG_LAB_FLOOR = "/event-assets/carousel-lab-floor.jpg";

const blocks: Block[] = [
  {
    id: sid("kit-hero", 1),
    type: "kit-hero",
    props: {
      logoText: "Dandy",
      logoUrl: "/dandy-logo-white.svg",
      navCtaText: "Need help?",
      navCtaUrl: "#help",
      kicker: "Dandy lab tour in a box",
      headline: "The future of dentistry\nis in your hands.",
      subheadline:
        "Step inside Dandy's AI-powered lab to see how a crown comes to life. The Fusion Denture in this kit is another example of what's possible with AI-powered design and precision manufacturing. Then share the experience with your team.",
      ctaText: "Set up the headset",
      ctaUrl: "#steps",
      secondaryText: "What's in the box",
      secondaryUrl: "#inside",
      facts: [{ label: "About 10 minutes" }, { label: "Wi-Fi required" }, { label: "Share it with your team" }],
      heroImageUrl: IMG_HEADSET,
      heroImageAlt: "Dandy-branded Meta Quest 3 headset with two controllers",
      heroImageFit: "contain",
      secondaryImageUrl: IMG_BOX,
      secondaryImageAlt: "The forest-green Dandy lab tour box",
      secondaryImageFit: "cover",
      minHeightVh: 88,
    },
  },
  {
    id: sid("kit-contents", 2),
    type: "kit-contents",
    props: {
      kicker: "What's in the box",
      headline: "Everything you need to step inside the lab.",
      subheadline: "Unpack all three before you start — the setup steps use each one.",
      items: [
        {
          name: "Meta Quest 3 headset",
          caption: "Charged and ready to go, with both controllers. The lab tour plays here.",
          imageUrl: IMG_HEADSET_FRONT,
          imageAlt: "Front view of the Dandy-branded Meta Quest 3",
          fit: "contain",
        },
        {
          name: "A Dandy Fusion Denture",
          caption: "A real denture, AI-designed and precision manufactured in the lab you're about to tour. Pass it around the office.",
          imageUrl: IMG_DENTURE,
          imageAlt: "A gloved hand holding a Dandy Fusion Denture",
          fit: "cover",
        },
        {
          name: "Your access card",
          caption: "The six-digit Dandy code you'll enter in step three, and the QR code that brought you here.",
          imageUrl: IMG_BOX,
          imageAlt: "The Dandy lab tour box",
          fit: "cover",
        },
      ],
      anchorId: "inside",
    },
  },
  {
    id: sid("kit-steps", 3),
    type: "kit-steps",
    props: {
      kicker: "Set up in five steps",
      headline: "From the box to the lab floor\nin about ten minutes.",
      subheadline: "Follow the steps in order on the headset. Each one takes a minute or two.",
      steps: [
        {
          title: "Set up your Meta account",
          body: "Put on the headset and follow the on-screen setup. Sign in to a Meta (Horizon) account — or create one — and connect to Wi-Fi.",
          tip: "Keep your phone nearby: the Meta Horizon app makes pairing and sign-in faster.",
          linkText: "Meta Quest setup help",
          linkUrl: META_HELP_URL,
          visual: "none",
        },
        {
          title: "Download Immersa",
          body: "Open the Horizon Store from the headset's home menu, search for Immersa and install it. It's free.",
          visual: "store",
          visualLabel: "Immersa",
          visualSub: "Horizon Store · Free",
        },
        {
          title: "Enter your six-digit Dandy code",
          body: "Open Immersa and enter the code printed on the card in your kit. It unlocks the Dandy experience.",
          tip: "Codes are specific to your kit. If yours is missing, email us and we'll send a new one.",
          visual: "code",
        },
        {
          title: "Open the Dandy experience",
          body: "Once the code is accepted you'll land in the dedicated Dandy space inside Immersa. Pick the lab tour to begin.",
          visual: "none",
        },
        {
          title: "Stream, play or download",
          body: "Stream the tour instantly over Wi-Fi, or download it to the headset once and watch anywhere — no connection needed afterwards.",
          visual: "stream",
          visualLabel: "Stream · Play · Download",
        },
      ],
      code: "",
      codeParam: "code",
      codeLabel: "Your code is on the card in the box.",
      codeFilledLabel: "This is your kit's code — enter it exactly as shown.",
      anchorId: "steps",
    },
  },
  {
    id: sid("kit-support", 4),
    type: "kit-support",
    props: {
      kicker: "Need a hand?",
      headline: "Stuck on a step?\nWe'll get you inside.",
      body: "The full guide walks through every screen on the headset. And once your team has taken the tour, come see the real lab.",
      guideText: "Download the step-by-step guide",
      guideUrl: "",
      ctaText: "See the lab in person",
      ctaUrl: LIVE_TOUR_URL,
      ctaSecondaryText: "Talk to sales",
      ctaSecondaryUrl: TALK_TO_SALES_URL,
      imageUrl: IMG_LAB_FLOOR,
      imageAlt: "A row of milling machines on the Dandy lab floor",
      imageCaption: "The Dandy lab floor",
      anchorId: "help",
    },
  },
  {
    id: sid("dandy-site-footer", 5),
    type: "dandy-site-footer",
    props: {
      logoUrl: "",
      disclaimer: "Meta Quest and Horizon are trademarks of Meta Platforms, Inc. Immersa is a trademark of its respective owner.",
      copyrightText: "",
      linkGroups: [
        {
          heading: "Dandy",
          links: [
            { label: "Home", url: "https://www.meetdandy.com/" },
            { label: "Inside the lab", url: "https://www.meetdandy.com/labs/" },
            { label: "Get started", url: LIVE_TOUR_URL },
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

export const QUEST_KIT_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: SLUG,
    title: "Lab Tour in a Box — Meta Quest Setup",
    templateLabel: "Lab Tour in a Box — Meta Quest Setup",
    templateDescription:
      "The page a kit's QR code opens: dark hero with the headset and box on floating product tiles, what's in the box, five numbered setup steps (Meta account → Immersa → six-digit code → Dandy experience → stream / download) with inline code cells and a store listing, and a need-a-hand close: guide download link, see-the-lab / talk-to-sales buttons over a lab-floor photo.",
    ogImage: "/images/kit/quest-headset.webp",
    industry: "dental",
    premiumRank: 8,
    funnelStage: "onboarding",
    blocks,
  },
];
