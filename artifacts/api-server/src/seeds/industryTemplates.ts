// Industry-themed premium starter templates.
//
// Five industries × five templates each. All templates are tagged
// `industry: null` so they're visible to every tenant regardless of the
// tenant's `settings.industry` value — the industry context is communicated
// through the `templateLabel`. If we ever want to gate dental templates to
// dental tenants only, flip the dental block to `industry: "dental"`.
//
// All block prop shapes match the BLOCK_REGISTRY contracts in
// artifacts/lp-studio/src/lib/block-types — `BackgroundStyle` is one of
// `white | light-gray | muted | dark | dandy-green | black | gradient`,
// hero `layout` is one of `centered | split | split-right | minimal`, and
// benefits-grid icons are limited to the names in `BlockBenefitsGrid.ICON_MAP`.

import type { GlobalTemplateSeed } from "./globalTemplates";

const ACCENT_BLUE = "#2563EB";
const ACCENT_TEAL = "#0D9488";
const ACCENT_VIOLET = "#7C3AED";
const ACCENT_AMBER = "#D97706";
const ACCENT_FOREST = "#15803D";
const ACCENT_ROSE = "#E11D48";
const ACCENT_NAVY = "#1E3A8A";
const FOOTER_DARK = "#0F172A";

const id = (type: string, n: number) => `seed-ind-${type}-${n}`;

// ─── Reusable block factories ────────────────────────────────────────────────

function nav(
  brand: string,
  links: { label: string; url: string }[],
  cta: { label: string; url: string },
  n: number,
) {
  return {
    id: id("nav-header", n),
    type: "nav-header",
    props: {
      logoText: brand,
      logoUrl: "",
      navLinks: links,
      phone: "",
      cta1: { label: "", url: "" },
      cta2: cta,
    },
  };
}

function footer(brand: string, accent: string, n: number) {
  return {
    id: id("footer", n),
    type: "footer",
    props: {
      backgroundColor: FOOTER_DARK,
      accentColor: accent,
      copyrightText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
      showSocialLinks: true,
      facebookUrl: "#",
      instagramUrl: "#",
      linkedinUrl: "#",
      columns: [
        {
          title: "Explore",
          links: [
            { label: "Services", url: "#services" },
            { label: "About", url: "#about" },
            { label: "Reviews", url: "#reviews" },
            { label: "Contact", url: "#contact" },
          ],
        },
        {
          title: "Resources",
          links: [
            { label: "Insurance & FAQ", url: "#" },
            { label: "Blog", url: "#" },
            { label: "Careers", url: "#" },
            { label: "Press", url: "#" },
          ],
        },
        {
          title: "Get in touch",
          links: [
            { label: "Book online", url: "#book" },
            { label: "Call us", url: "#" },
            { label: "Email", url: "#" },
            { label: "Directions", url: "#" },
          ],
        },
      ],
    },
  };
}

function trustBar(
  items: { value: string; label: string }[],
  n: number,
) {
  return {
    id: id("trust-bar", n),
    type: "trust-bar",
    props: { items },
  };
}

// ─── Template definitions ────────────────────────────────────────────────────

export const INDUSTRY_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DENTAL (5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    slug: "ind-dental-family-practice",
    title: "Family Dental Practice",
    templateLabel: "Dental — Family Practice",
    templateDescription:
      "Warm, welcoming landing page for a general dental practice serving families. Includes appointment booking, insurance trust signals, and a meet-the-team feel.",
    ogImage:
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Bright Smiles Family Dental",
        [
          { label: "Services", url: "#services" },
          { label: "Our Team", url: "#team" },
          { label: "New Patients", url: "#new-patients" },
          { label: "Reviews", url: "#reviews" },
        ],
        { label: "Book online", url: "#book" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "The dentist your whole family will actually look forward to",
          subheadline:
            "From your toddler's first visit to your grandparents' implants, we treat every patient like family. Same-day emergencies, evening hours, and most insurance accepted.",
          ctaText: "Book your first visit",
          ctaUrl: "#book",
          ctaColor: ACCENT_TEAL,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "★★★★★  4.9 across 1,800+ Google reviews — top-rated in the East Bay",
          imageUrl:
            "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "Since 1998", label: "Family Owned" },
          { value: "★ 4.9", label: "1,800+ Reviews" },
          { value: "Same Day", label: "Emergency Visits" },
          { value: "Most PPO", label: "Insurance Accepted" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "Everything your family needs, all in one office",
          columns: 3,
          items: [
            {
              icon: "CheckCircle",
              title: "General & preventive",
              description:
                "Cleanings, exams, sealants, and fluoride. We catch the small stuff before it becomes a big bill.",
            },
            {
              icon: "Star",
              title: "Cosmetic dentistry",
              description:
                "Whitening, veneers, and bonding done right here — no referral needed.",
            },
            {
              icon: "Users",
              title: "Pediatric care",
              description:
                "Kid-sized chairs, gentle hygienists, and stickers for everyone. We make first visits a great memory.",
            },
            {
              icon: "Zap",
              title: "Same-day emergencies",
              description:
                "Chipped tooth on a Tuesday? Call before noon and we'll see you that afternoon.",
            },
            {
              icon: "Activity",
              title: "Implants & restorations",
              description:
                "Single tooth replacements, full-arch implants, crowns, and bridges done in-house.",
            },
            {
              icon: "Bell",
              title: "Sleep & TMJ",
              description:
                "Custom night guards and oral appliance therapy — sleep better, wake up without jaw pain.",
            },
          ],
        },
      },
      {
        id: id("photo-strip", 5),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=900&fit=crop", alt: "Modern dental operatory" },
            { src: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&fit=crop", alt: "Smiling patient" },
            { src: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&fit=crop", alt: "Bright clean smile" },
            { src: "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?q=80&w=900&fit=crop", alt: "Dentist with patient" },
            { src: "https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?q=80&w=900&fit=crop", alt: "Friendly dental team" },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I switched our whole family here three years ago and never looked back. My six-year-old asks when her next cleaning is. Six! Years! Old! That's how good they are.",
          author: "Rachel Ortiz",
          role: "Patient since 2022",
          practiceName: "Mom of three",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Book your first visit — no insurance hassle",
          subheadline:
            "Tell us a little about yourself and we'll call within one business day to confirm your appointment and verify your benefits.",
          multiStep: false,
          steps: [
            {
              title: "Your info",
              fields: [
                { id: "name", type: "text", label: "Full name", placeholder: "Jane Doe", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "reason", type: "textarea", label: "What brings you in?", placeholder: "Cleaning, second opinion, kids' first visit, emergency, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request appointment",
          submitButtonColor: ACCENT_TEAL,
          successMessage: "Thanks! We'll call within one business day to confirm.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      footer("Bright Smiles Family Dental", ACCENT_TEAL, 8),
    ],
  },

  {
    slug: "ind-dental-cosmetic",
    title: "Cosmetic Dentistry",
    templateLabel: "Dental — Cosmetic Dentistry",
    templateDescription:
      "Premium aesthetic dentistry landing page — Invisalign, veneers, and whitening. Built for high-intent traffic with a portfolio gallery and consult booking.",
    ogImage:
      "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "The smile you've thought about for years — in as little as 6 months",
          subheadline:
            "Invisalign, porcelain veneers, and professional whitening from one of the top-reviewed cosmetic dentists in the region. Free consultation, in-house financing.",
          ctaText: "Book a free consult",
          ctaUrl: "#consult",
          secondaryCtaText: "See our smile gallery",
          secondaryCtaUrl: "#gallery",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 50,
          minHeight: "large",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Services", url: "#services" },
            { label: "Smile Gallery", url: "#gallery" },
            { label: "Financing", url: "#financing" },
            { label: "Reviews", url: "#reviews" },
          ],
        },
      },
      trustBar(
        [
          { value: "2,400+", label: "Smiles Transformed" },
          { value: "★ 4.9", label: "Google Reviews" },
          { value: "0% APR", label: "Financing Available" },
          { value: "Diamond+", label: "Invisalign Provider" },
        ],
        2,
      ),
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "Three signature services. One unforgettable smile.",
          subheadline:
            "Every treatment plan is custom-designed by Dr. Kim and previewed digitally before we touch a tooth.",
          headlineAlign: "center",
          rows: [
            {
              tag: "INVISALIGN",
              headline: "Straighten in 6–18 months — without anyone noticing",
              body: "As a Diamond+ Invisalign provider (top 1% nationally), we've placed over 2,400 cases. Most patients see real movement in the first six weeks. We even handle complex cases other offices refer out.",
              ctaText: "Is Invisalign right for me?",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1581585504334-1cdf9bbb5a05?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "PORCELAIN VENEERS",
              headline: "Hand-crafted veneers, designed by Dr. Kim and a master ceramist",
              body: "We don't outsource. Every veneer is shaped to your face, your bite, and your goals. Most cases are done in two visits, two weeks apart.",
              ctaText: "See veneer cases",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "WHITENING",
              headline: "8 shades whiter in a single visit — and it actually lasts",
              body: "Our in-office Zoom protocol delivers dramatic results in 90 minutes, paired with a take-home kit so your results last for years, not weeks.",
              ctaText: "Whitening details",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("photo-strip", 4),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1581585504334-1cdf9bbb5a05?q=80&w=900&fit=crop", alt: "Invisalign aligners" },
            { src: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&fit=crop", alt: "Bright veneer smile" },
            { src: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=900&fit=crop", alt: "Modern operatory" },
            { src: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&fit=crop", alt: "Patient smiling" },
            { src: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&fit=crop", alt: "Whitening result" },
          ],
        },
      },
      {
        id: id("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "I'd been hiding my smile in photos for fifteen years. Dr. Kim's team designed something that looked exactly like me, just better. I cried when they handed me the mirror.",
          author: "Jordan Mehta",
          role: "Veneers + whitening",
          practiceName: "Patient since 2024",
        },
      },
      {
        id: id("stat-callout", 6),
        type: "stat-callout",
        props: {
          stat: "98%",
          description: "Of our cosmetic patients say their results exceeded expectations",
          footnote: "Anonymous post-treatment survey, 2,400+ responses since 2018.",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Book your free smile consultation",
          subheadline:
            "30 minutes with Dr. Kim. We'll show you a digital preview of your results and walk through pricing and financing.",
          multiStep: false,
          steps: [
            {
              title: "Consult request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "interest", type: "text", label: "What are you considering?", placeholder: "Invisalign, veneers, whitening, or not sure", required: false },
              ],
            },
          ],
          submitButtonText: "Book free consult",
          submitButtonColor: ACCENT_TEAL,
          successMessage: "You're on the books — we'll confirm by phone shortly.",
          redirectUrl: "",
          backgroundStyle: "light-gray",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Lumina Cosmetic Dental", ACCENT_TEAL, 8),
    ],
  },

  {
    slug: "ind-dental-pediatric",
    title: "Pediatric Dental",
    templateLabel: "Dental — Pediatric Practice",
    templateDescription:
      "Bright, kid-friendly landing page for a pediatric dental office. Designed to win over the parent doing the research at 10pm.",
    ogImage:
      "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "TinyTooth Pediatric Dentistry",
        [
          { label: "First Visit", url: "#first-visit" },
          { label: "Services", url: "#services" },
          { label: "Our Team", url: "#team" },
          { label: "Parents", url: "#parents" },
        ],
        { label: "Book online", url: "#book" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "A first dental visit your child will remember for the right reasons",
          subheadline:
            "Board-certified pediatric specialists, an office designed for kids ages 1–18, and a team that genuinely loves what they do. Most insurance accepted, Saturday hours.",
          ctaText: "Book the first visit",
          ctaUrl: "#book",
          ctaColor: ACCENT_VIOLET,
          heroType: "static-image",
          layout: "split-right",
          backgroundStyle: "muted",
          showSocialProof: true,
          socialProofText: "Parent-recommended #1 pediatric dentist in the region 5 years running",
          imageUrl:
            "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "Ages 1–18", label: "All We Do" },
          { value: "Board", label: "Certified Specialists" },
          { value: "Saturday", label: "Hours Available" },
          { value: "★ 4.9", label: "Parent Reviews" },
        ],
        3,
      ),
      {
        id: id("how-it-works", 4),
        type: "how-it-works",
        props: {
          headline: "What the first visit actually looks like",
          steps: [
            {
              number: "01",
              title: "We meet your kiddo where they are",
              description:
                "No sudden gowns, no cold rooms. We'll let your child explore the chair, the light, the suction — at their own pace, with you right there.",
            },
            {
              number: "02",
              title: "A gentle exam, in plain language",
              description:
                "Dr. Maya will count teeth, check growth, and explain what she sees in words your child (and you) can follow. No surprise findings, no upsells.",
            },
            {
              number: "03",
              title: "Sticker, prize, and a plan",
              description:
                "Every visit ends with a treasure-chest pick. You leave with a written plan, photos, and clear pricing for anything we recommend.",
            },
          ],
        },
      },
      {
        id: id("benefits-grid", 5),
        type: "benefits-grid",
        props: {
          headline: "Built for kids. Loved by parents.",
          columns: 3,
          items: [
            {
              icon: "Users",
              title: "Specialist-led care",
              description:
                "All four of our doctors are board-certified pediatric dentists with 2+ years of additional training after dental school.",
            },
            {
              icon: "Star",
              title: "Sensory-friendly visits",
              description:
                "Weighted blankets, noise-canceling headphones, dimmable lights. Just ask — we've got you.",
            },
            {
              icon: "CheckCircle",
              title: "Sedation when needed",
              description:
                "Nitrous, oral, and IV sedation on-site with a board-certified anesthesiologist. Safer outcomes, less trauma.",
            },
            {
              icon: "Bell",
              title: "Same-day emergencies",
              description:
                "Knocked-out tooth at recess? Call before 2pm and we'll see you that afternoon.",
            },
            {
              icon: "BarChart2",
              title: "Insurance + flexible pay",
              description:
                "We're in-network with most PPOs and offer 0%-interest payment plans for everything else.",
            },
            {
              icon: "BookOpen",
              title: "Real parent guidance",
              description:
                "We send a personalized home-care plan after every visit — what to watch, what's normal, what's not.",
            },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "My son has autism and dental visits used to mean meltdowns for everyone. Dr. Maya took 30 minutes just to let him sit in the chair the first time. He now WANTS to go back. I cannot say enough good things.",
          author: "Sam Whitaker",
          role: "Parent of a 7-year-old patient",
          practiceName: "",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Schedule your child's first visit",
          subheadline:
            "We'll call within one business day to confirm and walk you through what to expect.",
          multiStep: false,
          steps: [
            {
              title: "About your child",
              fields: [
                { id: "parent_name", type: "text", label: "Parent name", placeholder: "Jane Doe", required: true },
                { id: "child_name", type: "text", label: "Child's first name", placeholder: "Avery", required: true },
                { id: "child_age", type: "text", label: "Child's age", placeholder: "5", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "notes", type: "textarea", label: "Anything we should know?", placeholder: "First visit, sensory needs, prior bad experience, allergies, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request appointment",
          submitButtonColor: ACCENT_VIOLET,
          successMessage: "Got it — we'll call within one business day to confirm.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      footer("TinyTooth Pediatric Dentistry", ACCENT_VIOLET, 8),
    ],
  },

  {
    slug: "ind-dental-implants",
    title: "Dental Implants & Oral Surgery",
    templateLabel: "Dental — Implants & Oral Surgery",
    templateDescription:
      "Authority-led landing page for an implant or oral surgery specialist. Built for high-value referral traffic with credentials, technology, and case-study proof.",
    ogImage:
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "Implant dentistry, done right the first time",
          subheadline:
            "Dr. Marcus Reid has placed over 6,000 implants in 18 years of practice. Same-day implants, full-arch, and zygomatic cases handled in-house with 3D-guided precision.",
          ctaText: "Request a consultation",
          ctaUrl: "#consult",
          secondaryCtaText: "See case studies",
          secondaryCtaUrl: "#cases",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 55,
          minHeight: "large",
          contentAlignment: "left",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "About Dr. Reid", url: "#about" },
            { label: "Procedures", url: "#procedures" },
            { label: "Technology", url: "#tech" },
            { label: "Case Studies", url: "#cases" },
          ],
        },
      },
      trustBar(
        [
          { value: "6,000+", label: "Implants Placed" },
          { value: "18 yrs", label: "In Practice" },
          { value: "98.7%", label: "10-Year Success" },
          { value: "AAID", label: "Board Certified" },
        ],
        2,
      ),
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "Specialist-level care for the cases that matter most",
          headlineAlign: "center",
          rows: [
            {
              tag: "SINGLE IMPLANTS",
              headline: "Replace one tooth in a single visit",
              body: "Same-day extraction, immediate implant placement, and a temporary crown — all in one appointment with our 3D-guided protocol. Most patients are back to normal eating in under a week.",
              ctaText: "Single implant details",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "FULL-ARCH (ALL-ON-4)",
              headline: "A full set of fixed teeth in a single day",
              body: "We've done over 800 full-arch cases. You'll arrive without teeth and leave the same evening with a fixed, screw-retained provisional you can eat dinner with.",
              ctaText: "All-on-4 case studies",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "BONE GRAFTING & SINUS LIFTS",
              headline: "Cases other offices refer out — we handle in-house",
              body: "Atrophic jaw, failed implants, complex grafting. We're the team general dentists across the state refer their toughest cases to.",
              ctaText: "For referring doctors",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("case-studies", 4),
        type: "case-studies",
        props: {
          headline: "Recent cases",
          subheadline: "A small selection — many more available on request.",
          items: [
            {
              image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Full-arch reconstruction in a single visit, 64-year-old male",
              categories: "ALL-ON-4 / IMMEDIATE LOAD",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Replacing 3 failed implants from a prior office",
              categories: "REVISION / GRAFTING",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Zygomatic implants in a patient with severe atrophy",
              categories: "ZYGOMATIC / COMPLEX",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "98.7%",
          description: "10-year implant success rate across our practice",
          footnote: "Independent audit by ICOI, 2024. Industry average is 91%.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd been told by two other surgeons that I wasn't a candidate. Dr. Reid mapped a plan in 20 minutes that changed my life. I had a complete arch in a day, and a year later I forget the implants are even there.",
          author: "Margaret Lin",
          role: "Full-arch patient",
          practiceName: "12 months post-op",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Request a consultation",
          subheadline:
            "We'll review your case (CBCT welcome) and call within one business day with next steps.",
          multiStep: false,
          steps: [
            {
              title: "Consultation request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "case", type: "textarea", label: "Tell us about your case", placeholder: "Single tooth, full arch, second opinion, referring doctor, etc.", required: true },
              ],
            },
          ],
          submitButtonText: "Request consultation",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Thank you. We'll be in touch within one business day.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Meridian Implant Center", ACCENT_NAVY, 8),
    ],
  },

  {
    slug: "ind-dental-dso-affiliation",
    title: "DSO Practice Affiliation",
    templateLabel: "Dental — DSO Affiliation Hub",
    templateDescription:
      "Recruitment landing page for a DSO seeking practice owners considering affiliation. Built around trust, autonomy, and a real path to liquidity.",
    ogImage:
      "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Crestwood Dental Partners",
        [
          { label: "Why Crestwood", url: "#why" },
          { label: "Our Model", url: "#model" },
          { label: "Partner Stories", url: "#stories" },
          { label: "Leadership", url: "#leadership" },
        ],
        { label: "Talk to a partner", url: "#contact" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Affiliation that respects what you've built",
          subheadline:
            "Crestwood is a clinician-led DSO partnering with high-performing practices in the western US. Real liquidity, real autonomy, and a leadership team that's been in your chair.",
          ctaText: "Start a conversation",
          ctaUrl: "#contact",
          ctaColor: ACCENT_FOREST,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "62 partner practices across 11 states. Founder-led since 2017.",
          imageUrl:
            "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "62", label: "Partner Practices" },
          { value: "11", label: "States" },
          { value: "Clinician", label: "Led" },
          { value: "Since 2017", label: "Founder Owned" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "What partnership actually means at Crestwood",
          subheadline:
            "We're not a roll-up. We're a long-term partner that pays fairly, leaves your team and brand intact, and reinvests in growth.",
          headlineAlign: "center",
          rows: [
            {
              tag: "AUTONOMY",
              headline: "You keep your name, your team, and your clinical voice",
              body: "No forced rebrand. No quotas on hygiene visits. No corporate overlays on your patient flow. We support — we don't override.",
              ctaText: "Read our partner manifesto",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "ECONOMICS",
              headline: "Fair multiples, real liquidity, equity that compounds",
              body: "Most of our partners take 70–80% of value at close and roll the rest into Crestwood equity. Our platform has tripled in five years — that equity has been the better half of the deal.",
              ctaText: "How the deal works",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "GROWTH",
              headline: "Operations, marketing, and HR — handled by people who've done it",
              body: "Our shared services team is staffed by ex-practice owners and ex-DSO operators. We make your week easier, not more bureaucratic.",
              ctaText: "Meet the team",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "I talked to four DSOs before signing with Crestwood. They were the only ones who asked about my team before they asked about my EBITDA. Three years in, my collections are up 38% and I'm working two fewer days a week.",
          author: "Dr. Anita Brar",
          role: "Owner, Brar Family Dentistry",
          practiceName: "Crestwood partner since 2022",
        },
      },
      {
        id: id("stat-callout", 6),
        type: "stat-callout",
        props: {
          stat: "+38%",
          description: "Average collections growth in our partners' first three years",
          footnote: "Across 62 affiliated practices. Same brand, same team, same patients.",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Start a confidential conversation",
          subheadline:
            "A 30-minute call with our affiliation team. No pressure, no obligation. NDA available on request.",
          multiStep: false,
          steps: [
            {
              title: "About your practice",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Dr. Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@practice.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: false },
                { id: "practice", type: "text", label: "Practice name", placeholder: "Acme Dental Group", required: true },
                { id: "state", type: "text", label: "State", placeholder: "CA", required: true },
                { id: "collections", type: "text", label: "Approx. annual collections", placeholder: "$2.5M", required: false },
              ],
            },
          ],
          submitButtonText: "Request a call",
          submitButtonColor: ACCENT_FOREST,
          successMessage: "Thank you. A member of our affiliation team will be in touch within two business days.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Crestwood Dental Partners", ACCENT_FOREST, 8),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTHCARE (5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    slug: "ind-healthcare-primary-care",
    title: "Primary Care Practice",
    templateLabel: "Healthcare — Primary Care Practice",
    templateDescription:
      "Modern primary care landing page emphasizing same-day access, transparent pricing, and a real relationship with your doctor.",
    ogImage:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Sage Primary Care",
        [
          { label: "Services", url: "#services" },
          { label: "Our Doctors", url: "#doctors" },
          { label: "Membership", url: "#membership" },
          { label: "Locations", url: "#locations" },
        ],
        { label: "Become a patient", url: "#join" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Primary care that actually feels like care",
          subheadline:
            "Same-day appointments, 30-minute visits, and a doctor who knows your name. Most insurance accepted, and our membership plan covers everything for $89/month.",
          ctaText: "Become a patient",
          ctaUrl: "#join",
          ctaColor: ACCENT_TEAL,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by 14,000+ patients across our 3 Bay Area locations",
          imageUrl:
            "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "14,000+", label: "Active Patients" },
          { value: "Same Day", label: "Appointments" },
          { value: "30 min", label: "Visit Length" },
          { value: "$89/mo", label: "Membership" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "What it's like to be a Sage patient",
          columns: 3,
          items: [
            {
              icon: "Bell",
              title: "Same-day, every day",
              description:
                "Wake up sick? Message your doctor before 9am, see them by lunch. We hold same-day slots open at every location.",
            },
            {
              icon: "MessageCircle",
              title: "Direct message your doctor",
              description:
                "Refills, lab questions, photos of a weird rash. No phone tree, no portal jail. Real responses, usually same day.",
            },
            {
              icon: "Clipboard",
              title: "Real 30-minute visits",
              description:
                "Enough time to actually solve the problem and talk about the things you usually run out of time to ask about.",
            },
            {
              icon: "Activity",
              title: "Labs & imaging on-site",
              description:
                "Most labs are drawn and run in-house. Walk out with results, not a referral and a 3-week wait.",
            },
            {
              icon: "DollarSign",
              title: "Transparent pricing",
              description:
                "Membership includes unlimited visits, messaging, and same-day care. We bill insurance for labs and procedures at posted rates.",
            },
            {
              icon: "Users",
              title: "Care that follows you",
              description:
                "Need a specialist? We coordinate. Headed to the ER? We talk to them. We are your medical team, not just a clinic.",
            },
          ],
        },
      },
      {
        id: id("how-it-works", 5),
        type: "how-it-works",
        props: {
          headline: "Becoming a patient takes 5 minutes",
          steps: [
            {
              number: "01",
              title: "Pick your doctor",
              description:
                "Browse our team's bios and choose the doctor who feels like the right fit. Switch any time.",
            },
            {
              number: "02",
              title: "Sign up online",
              description:
                "Five-minute online intake. We'll verify your insurance and set your membership for $89/month.",
            },
            {
              number: "03",
              title: "Book your first visit",
              description:
                "Most new patients see their doctor within a week. Bring your medication list — we'll handle the rest.",
            },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I haven't waited on hold or sat in a waiting room since I joined Sage. My doctor texts me back. I forgot what good primary care could feel like.",
          author: "Devon Park",
          role: "Patient since 2023",
          practiceName: "",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Ready for primary care that actually works?",
          subheadline: "Join 14,000+ patients across our 3 Bay Area locations. Cancel any time.",
          ctaText: "Become a patient",
          ctaUrl: "#join",
        },
      },
      footer("Sage Primary Care", ACCENT_TEAL, 8),
    ],
  },

  {
    slug: "ind-healthcare-dermatology",
    title: "Dermatology Clinic",
    templateLabel: "Healthcare — Dermatology Clinic",
    templateDescription:
      "Polished dermatology landing page covering both medical and cosmetic services. Designed to convert both insurance and self-pay traffic.",
    ogImage:
      "https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Lumen Dermatology",
        [
          { label: "Medical", url: "#medical" },
          { label: "Cosmetic", url: "#cosmetic" },
          { label: "Skin Cancer", url: "#cancer" },
          { label: "Our Doctors", url: "#doctors" },
        ],
        { label: "Book online", url: "#book" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Board-certified dermatology, with appointments you can actually get",
          subheadline:
            "Medical, surgical, and cosmetic dermatology under one roof. Five board-certified dermatologists, three locations, and most appointments available within a week.",
          ctaText: "Book an appointment",
          ctaUrl: "#book",
          ctaColor: ACCENT_ROSE,
          heroType: "static-image",
          layout: "split-right",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by 22,000+ patients and the region's leading primary care groups",
          imageUrl:
            "https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "5", label: "Board Certified MDs" },
          { value: "3", label: "Locations" },
          { value: "1 week", label: "Avg. Wait" },
          { value: "22,000+", label: "Patients" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "Three pillars of practice. One trusted team.",
          headlineAlign: "center",
          rows: [
            {
              tag: "MEDICAL DERMATOLOGY",
              headline: "From acne to psoriasis, evidence-based care",
              body: "Acne, eczema, psoriasis, rosacea, hair loss, autoimmune skin conditions, and more. We use the same protocols taught at the country's top academic programs.",
              ctaText: "Medical conditions we treat",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "SKIN CANCER & MOHS",
              headline: "Same-week skin checks, on-site Mohs surgery",
              body: "Annual skin exams, biopsies, and Mohs micrographic surgery — all in-house with our fellowship-trained Mohs surgeon. 99% cure rate on primary basal and squamous cell.",
              ctaText: "Skin cancer screening",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "COSMETIC & AESTHETIC",
              headline: "Subtle, natural results from physician injectors only",
              body: "Botox, fillers, laser, microneedling, and chemical peels — performed by board-certified dermatologists, never by techs. We err on the side of refinement.",
              ctaText: "See cosmetic services",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "99%",
          description: "Cure rate on primary basal and squamous cell carcinomas via Mohs",
          footnote: "Lumen practice data, 2018–2024. National average is 96–98%.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd been putting off a suspicious mole for two years. Lumen got me in within a week, biopsied it on the spot, and removed it cleanly with Mohs the following Monday. They probably saved my life.",
          author: "Theo Kapur",
          role: "Mohs surgery patient",
          practiceName: "",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Book an appointment",
          subheadline:
            "Most appointments are available within a week. We accept most major insurance plans.",
          multiStep: false,
          steps: [
            {
              title: "Appointment request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "reason", type: "text", label: "Reason for visit", placeholder: "Annual skin check, acne, mole, cosmetic, etc.", required: true },
                { id: "insurance", type: "text", label: "Insurance (optional)", placeholder: "Aetna, BCBS, self-pay, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request appointment",
          submitButtonColor: ACCENT_ROSE,
          successMessage: "We'll confirm your appointment by phone within one business day.",
          redirectUrl: "",
          backgroundStyle: "light-gray",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      footer("Lumen Dermatology", ACCENT_ROSE, 8),
    ],
  },

  {
    slug: "ind-healthcare-mental-health",
    title: "Mental Health & Therapy",
    templateLabel: "Healthcare — Mental Health & Therapy",
    templateDescription:
      "Calm, trustworthy landing page for a mental health practice or therapy group. Built around 'find your therapist' — sliding-scale, telehealth, real human matching.",
    ogImage:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Anchor Therapy Group",
        [
          { label: "How it works", url: "#how" },
          { label: "Our therapists", url: "#therapists" },
          { label: "Specialties", url: "#specialties" },
          { label: "FAQ", url: "#faq" },
        ],
        { label: "Find your therapist", url: "#match" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Therapy that fits your life — match with the right therapist in 48 hours",
          subheadline:
            "A network of 60+ licensed therapists across the Northeast. Telehealth or in-person, evening hours, sliding-scale, and most insurance accepted.",
          ctaText: "Find your therapist",
          ctaUrl: "#match",
          ctaColor: ACCENT_TEAL,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "muted",
          showSocialProof: true,
          socialProofText: "12,000+ clients matched since 2019. Most book a first session within a week.",
          imageUrl:
            "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "60+", label: "Licensed Therapists" },
          { value: "48 hr", label: "Avg. Match Time" },
          { value: "Most", label: "Insurance Accepted" },
          { value: "Sliding", label: "Scale Available" },
        ],
        3,
      ),
      {
        id: id("how-it-works", 4),
        type: "how-it-works",
        props: {
          headline: "How matching works",
          steps: [
            {
              number: "01",
              title: "Tell us what you're looking for",
              description:
                "A 5-minute intake. What you want to work on, what kind of therapist feels right, your insurance, your schedule.",
            },
            {
              number: "02",
              title: "We hand-match you within 48 hours",
              description:
                "Not an algorithm. Our care team reviews every intake personally and sends you 2–3 hand-picked therapists.",
            },
            {
              number: "03",
              title: "Book your first session",
              description:
                "Free 15-minute call with each match if you want one. Then book whenever you're ready — most clients are in their first session within a week.",
            },
          ],
        },
      },
      {
        id: id("benefits-grid", 5),
        type: "benefits-grid",
        props: {
          headline: "Specialties our therapists work with",
          columns: 3,
          items: [
            {
              icon: "Activity",
              title: "Anxiety & depression",
              description:
                "CBT, ACT, and other evidence-based approaches for the things most of us deal with at some point.",
            },
            {
              icon: "MessageCircle",
              title: "Couples & relationships",
              description:
                "Gottman-trained therapists for couples therapy, premarital, and post-affair work.",
            },
            {
              icon: "Users",
              title: "Trauma & PTSD",
              description:
                "EMDR, somatic experiencing, and trauma-focused CBT from clinicians with specific advanced training.",
            },
            {
              icon: "Star",
              title: "ADHD coaching",
              description:
                "Therapists who actually understand executive function and the lived experience of adult ADHD.",
            },
            {
              icon: "Bell",
              title: "Grief & life transitions",
              description:
                "Loss, divorce, career change, postpartum, identity shifts. The big stuff deserves real support.",
            },
            {
              icon: "BookOpen",
              title: "LGBTQ+ affirming",
              description:
                "Every therapist on our roster is queer-affirming, with many specializing in LGBTQ+ identities and experiences.",
            },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd tried two other directories and ghosted by both. Anchor matched me with a therapist in 36 hours who actually fit. Two years in, it's been the most important investment I've ever made in myself.",
          author: "Quinn L.",
          role: "Client since 2023",
          practiceName: "",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Ready to find the right therapist?",
          subheadline: "5-minute intake. 48-hour match. No obligation to book.",
          ctaText: "Start your match",
          ctaUrl: "#match",
        },
      },
      footer("Anchor Therapy Group", ACCENT_TEAL, 8),
    ],
  },

  {
    slug: "ind-healthcare-telehealth",
    title: "Telehealth Service",
    templateLabel: "Healthcare — Telehealth Service",
    templateDescription:
      "Conversion-focused telehealth landing page. Built for paid traffic — see a doctor in 15 minutes, transparent pricing, no waiting room.",
    ogImage:
      "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "See a real doctor in 15 minutes — from anywhere",
          subheadline:
            "Licensed US physicians available 24/7. $49 per visit, no insurance required. Most prescriptions sent to your pharmacy in under an hour.",
          ctaText: "See a doctor now",
          ctaUrl: "#start",
          secondaryCtaText: "How it works",
          secondaryCtaUrl: "#how",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 55,
          minHeight: "large",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "What we treat", url: "#treat" },
            { label: "Pricing", url: "#pricing" },
            { label: "How it works", url: "#how" },
            { label: "FAQ", url: "#faq" },
          ],
        },
      },
      trustBar(
        [
          { value: "15 min", label: "Avg. Wait" },
          { value: "$49", label: "Per Visit" },
          { value: "24/7", label: "Available" },
          { value: "★ 4.8", label: "App Store" },
        ],
        2,
      ),
      {
        id: id("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "From 'I should see someone' to 'prescription sent' in under an hour",
          steps: [
            {
              number: "01",
              title: "Tell us what's going on",
              description:
                "Pick your symptom, answer a quick health intake, and pay $49. No insurance card, no portal sign-up.",
            },
            {
              number: "02",
              title: "Connect with a doctor in 15 minutes",
              description:
                "A licensed US physician calls you back, usually within 15 minutes. Talk through it, share photos if needed.",
            },
            {
              number: "03",
              title: "Prescription sent to your pharmacy",
              description:
                "If you need one, it's e-prescribed within an hour. Often ready before you've made it to the pharmacy.",
            },
          ],
        },
      },
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "What we treat",
          columns: 4,
          items: [
            { icon: "Activity", title: "UTIs", description: "Diagnosed and treated in one call." },
            { icon: "Bell", title: "Cold & flu", description: "Symptom relief and Tamiflu when indicated." },
            { icon: "Star", title: "Sinus & allergies", description: "Antibiotics, steroids, or both." },
            { icon: "Zap", title: "Pink eye", description: "Drops sent same-hour." },
            { icon: "Users", title: "Skin issues", description: "Rashes, acne, eczema. Photo-based." },
            { icon: "Clipboard", title: "Birth control", description: "Refills and new prescriptions." },
            { icon: "MessageCircle", title: "Mental health", description: "Anxiety and depression follow-ups." },
            { icon: "BookOpen", title: "Refills", description: "Most non-controlled medications." },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "94%",
          description: "Of visits resolved without a follow-up trip to a clinic or ER",
          footnote: "Internal study, 2024 — across 280,000 completed visits.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I had a UTI on a Saturday night. I was on the phone with a doctor in 11 minutes, prescription was at Walgreens in 35. I will never sit in an urgent care waiting room again.",
          author: "Riley Tompkins",
          role: "Beacon user",
          practiceName: "",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Need to see a doctor right now?",
          subheadline: "$49. 15-minute average wait. Available 24/7 in 48 states.",
          ctaText: "Start a visit",
          ctaUrl: "#start",
        },
      },
      footer("Beacon Health", ACCENT_BLUE, 8),
    ],
  },

  {
    slug: "ind-healthcare-medspa",
    title: "Med Spa & Aesthetics",
    templateLabel: "Healthcare — Med Spa & Aesthetics",
    templateDescription:
      "Premium medical aesthetics landing page — Botox, fillers, laser, member pricing. Built around physician-led care and a refined visual brand.",
    ogImage:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Serene Aesthetics",
        [
          { label: "Treatments", url: "#treatments" },
          { label: "Membership", url: "#membership" },
          { label: "Our Team", url: "#team" },
          { label: "Results", url: "#results" },
        ],
        { label: "Book a consult", url: "#book" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Medical aesthetics done with a physician's restraint",
          subheadline:
            "Board-certified providers, conservative dosing, and a brand of beauty that looks like the best version of you — never overdone. Member pricing, no pressure.",
          ctaText: "Book a free consult",
          ctaUrl: "#book",
          ctaColor: ACCENT_ROSE,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "muted",
          showSocialProof: true,
          socialProofText: "★★★★★  4.9 from 3,200+ Google reviews — and most clients refer a friend within 6 months",
          imageUrl:
            "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "Physician", label: "Owned & Led" },
          { value: "★ 4.9", label: "3,200+ Reviews" },
          { value: "Member", label: "Pricing" },
          { value: "Since 2016", label: "In Business" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "Our most-loved treatments",
          headlineAlign: "center",
          rows: [
            {
              tag: "INJECTABLES",
              headline: "Botox & filler that nobody can quite point to",
              body: "Conservative units, micro-droplet technique, and a 'less now, more later' philosophy. Our injectors are board-certified physicians and physician-trained NPs — never techs.",
              ctaText: "See injector profiles",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "LASER & ENERGY",
              headline: "Skin resurfacing that stays subtle",
              body: "Moxi for tone and texture, BBL for sun damage, Halo for the works. Most patients book a series — we offer member pricing that pays for itself by visit three.",
              ctaText: "Laser consultations",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "MEMBERSHIP",
              headline: "$199/month — the way regular clients save",
              body: "Includes one Botox area or one facial each month, 15% off everything else, and a private booking line. Most members save $1,800+/year vs à la carte.",
              ctaText: "Membership details",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("photo-strip", 5),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=900&fit=crop", alt: "Botox treatment" },
            { src: "https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?q=80&w=900&fit=crop", alt: "Skin treatment" },
            { src: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?q=80&w=900&fit=crop", alt: "Bright skin result" },
            { src: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=900&fit=crop", alt: "Glowing complexion" },
            { src: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=900&fit=crop", alt: "Confident client" },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "Three friends had recommended Serene before I finally went. Now I send everyone. Subtle, expert, and they always tell me what NOT to do as much as what to do.",
          author: "Cassidy R.",
          role: "Member since 2022",
          practiceName: "",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Book your free 30-minute consult",
          subheadline:
            "We'll talk through what you're considering, take a look in good lighting, and walk through pricing — no pressure to book anything.",
          multiStep: false,
          steps: [
            {
              title: "Consult request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "interest", type: "text", label: "What are you considering?", placeholder: "Botox, filler, laser, membership, or just exploring", required: false },
              ],
            },
          ],
          submitButtonText: "Book consult",
          submitButtonColor: ACCENT_ROSE,
          successMessage: "Thank you! We'll confirm your consult by phone shortly.",
          redirectUrl: "",
          backgroundStyle: "light-gray",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Serene Aesthetics", ACCENT_ROSE, 8),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FITNESS & WELLNESS (5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    slug: "ind-fitness-yoga-studio",
    title: "Boutique Yoga Studio",
    templateLabel: "Fitness — Boutique Yoga Studio",
    templateDescription:
      "Calm, beautifully-paced landing page for a boutique yoga or pilates studio. Intro-offer-led conversion with a class browser and teacher bios.",
    ogImage:
      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Stillpoint Yoga",
        [
          { label: "Schedule", url: "#schedule" },
          { label: "Teachers", url: "#teachers" },
          { label: "Pricing", url: "#pricing" },
          { label: "About", url: "#about" },
        ],
        { label: "$49 intro month", url: "#intro" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "A studio that meets you where you are — on the mat and off",
          subheadline:
            "Vinyasa, yin, restorative, and slow flow. Small classes, expert teachers, and an intro month that lets you try every class for $49.",
          ctaText: "Start your $49 month",
          ctaUrl: "#intro",
          ctaColor: ACCENT_FOREST,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "muted",
          showSocialProof: true,
          socialProofText: "Voted Best Yoga Studio in the city — 6 years running",
          imageUrl:
            "https://images.unsplash.com/photo-1545205597-3d9d02c29597?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "12", label: "Senior Teachers" },
          { value: "Max 18", label: "Per Class" },
          { value: "60+", label: "Classes per Week" },
          { value: "Since 2014", label: "In Business" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "What you'll find on our schedule",
          columns: 3,
          items: [
            {
              icon: "Star",
              title: "Slow flow",
              description:
                "Mindful pacing, longer holds, room to actually feel a posture before moving to the next.",
            },
            {
              icon: "Activity",
              title: "Vinyasa",
              description:
                "Steady, breath-led flows for every level. Modifications offered every class.",
            },
            {
              icon: "BookOpen",
              title: "Yin & restorative",
              description:
                "Long, supported holds for the days when your body asks for less, not more.",
            },
            {
              icon: "Users",
              title: "Beginner series",
              description:
                "A 6-week starting point that meets weekly. Smallest classes we run.",
            },
            {
              icon: "Bell",
              title: "Pre/postnatal",
              description:
                "Specialized teachers, dedicated weekly classes, plus 1:1 sessions for harder windows.",
            },
            {
              icon: "Zap",
              title: "Sound baths",
              description:
                "Monthly evening sound baths with crystal bowls and live music. Bring blankets.",
            },
          ],
        },
      },
      {
        id: id("photo-strip", 5),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?q=80&w=900&fit=crop", alt: "Yoga class" },
            { src: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=900&fit=crop", alt: "Studio interior" },
            { src: "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=900&fit=crop", alt: "Outdoor yoga" },
            { src: "https://images.unsplash.com/photo-1593810450967-f9c42742e326?q=80&w=900&fit=crop", alt: "Restorative pose" },
            { src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=900&fit=crop", alt: "Sunlit studio" },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd tried every gym yoga class in the city and never stuck. Stillpoint is different — the teachers actually know my name, and after a year my back pain is just gone. Genuinely life-changing.",
          author: "Renee Okafor",
          role: "Member since 2024",
          practiceName: "",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Try every class for $49 this month",
          subheadline:
            "Unlimited yoga, no auto-renew, no commitment. Just space to find what you like.",
          ctaText: "Start your $49 month",
          ctaUrl: "#intro",
        },
      },
      footer("Stillpoint Yoga", ACCENT_FOREST, 8),
    ],
  },

  {
    slug: "ind-fitness-personal-training",
    title: "Personal Training",
    templateLabel: "Fitness — Personal Training",
    templateDescription:
      "Premium 1:1 personal training landing page. Built around transformation stories and a clear program structure for serious clients.",
    ogImage:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "Personal training that gets you in the best shape of your life",
          subheadline:
            "1:1 coaching with elite trainers, programmed nutrition, and weekly accountability. We work with 40 serious clients at a time. Spots limited — apply for an intake.",
          ctaText: "Apply for an intake",
          ctaUrl: "#apply",
          secondaryCtaText: "See client results",
          secondaryCtaUrl: "#results",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 60,
          minHeight: "large",
          contentAlignment: "left",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Method", url: "#method" },
            { label: "Trainers", url: "#trainers" },
            { label: "Results", url: "#results" },
            { label: "Pricing", url: "#pricing" },
          ],
        },
      },
      trustBar(
        [
          { value: "40", label: "Active Clients" },
          { value: "12", label: "Week Programs" },
          { value: "94%", label: "Hit Their Goal" },
          { value: "Since 2016", label: "In Business" },
        ],
        2,
      ),
      {
        id: id("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "How it works",
          steps: [
            {
              number: "01",
              title: "Apply for an intake",
              description:
                "5-minute application. We respond within 48 hours and book a 60-minute discovery call to see if we're the right fit.",
            },
            {
              number: "02",
              title: "Build your custom program",
              description:
                "Movement assessment, body composition scan, and nutrition baseline. Your trainer designs a 12-week program built around your goal.",
            },
            {
              number: "03",
              title: "Train, track, adjust, win",
              description:
                "Three sessions a week, weekly check-ins, and an app that keeps your nutrition and recovery dialed. Most clients hit their 12-week goal early.",
            },
          ],
        },
      },
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "What makes Apex different",
          headlineAlign: "center",
          rows: [
            {
              tag: "ELITE TRAINERS",
              headline: "Every coach has 8+ years and a real specialty",
              body: "Our trainers come from collegiate strength programs, physical therapy, and elite endurance backgrounds. We hire one trainer for every 25 we interview.",
              ctaText: "Meet the trainers",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "PROGRAMMED, NOT IMPROVISED",
              headline: "Real periodization, written down, tracked weekly",
              body: "Every session is part of a 12-week block built for your goal. We measure, log, and adjust — no random workouts, no winging it.",
              ctaText: "See a sample program",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "NUTRITION INCLUDED",
              headline: "Programmed eating, not generic meal plans",
              body: "Your trainer sets your daily targets, we adjust biweekly based on what's actually happening with your body and your week.",
              ctaText: "Nutrition approach",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "94%",
          description: "Of clients hit or exceed their 12-week goal",
          footnote: "Across 600+ completed programs since 2016. Goals self-defined at intake.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I've trained with five different gyms in this city. Apex is the only one that actually had a plan, kept me accountable, and got me into the best shape of my life — at 47, no less.",
          author: "Daniel Cho",
          role: "Apex client, 18 months",
          practiceName: "Down 32 lbs, deadlifting 405",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Apply for an intake",
          subheadline:
            "We work with 40 clients at a time. We'll respond within 48 hours.",
          multiStep: false,
          steps: [
            {
              title: "Tell us about you",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "goal", type: "textarea", label: "What's your goal?", placeholder: "Lose 20 lbs, run a half-marathon, get strong, look great at our wedding...", required: true },
                { id: "experience", type: "text", label: "Training experience", placeholder: "New to lifting / 1–2 years / serious athlete", required: false },
              ],
            },
          ],
          submitButtonText: "Submit application",
          submitButtonColor: ACCENT_AMBER,
          successMessage: "Got it. We'll respond within 48 hours.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Apex Personal Training", ACCENT_AMBER, 8),
    ],
  },

  {
    slug: "ind-fitness-crossfit-gym",
    title: "CrossFit / Group Gym",
    templateLabel: "Fitness — CrossFit / Group Gym",
    templateDescription:
      "Energetic group-fitness gym landing page. Built around community, daily workouts, and a free-week trial offer.",
    ogImage:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Forge Athletics",
        [
          { label: "Schedule", url: "#schedule" },
          { label: "Coaches", url: "#coaches" },
          { label: "Programs", url: "#programs" },
          { label: "Drop-in", url: "#dropin" },
        ],
        { label: "Free week trial", url: "#trial" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "The gym you'll actually show up to",
          subheadline:
            "Coached group strength and conditioning, six days a week. A community that pushes you (in the best way), and your first week is free — no card required.",
          ctaText: "Claim your free week",
          ctaUrl: "#trial",
          ctaColor: ACCENT_AMBER,
          heroType: "static-image",
          layout: "split-right",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "★★★★★  4.9 across 800+ Google reviews — built by 320+ members and counting",
          imageUrl:
            "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "320+", label: "Members" },
          { value: "8", label: "Coaches" },
          { value: "6 days", label: "A Week" },
          { value: "Since 2018", label: "Open" },
        ],
        3,
      ),
      {
        id: id("how-it-works", 4),
        type: "how-it-works",
        props: {
          headline: "Your first week, broken down",
          steps: [
            {
              number: "01",
              title: "Free intro session",
              description:
                "60 minutes one-on-one with a coach. We'll learn about you, teach you our movements, and walk you through how class works.",
            },
            {
              number: "02",
              title: "Take any class, all week",
              description:
                "Drop into any group class for the rest of your free week. Try the 6am, the 5:30pm, the Saturday WOD — all of it.",
            },
            {
              number: "03",
              title: "Decide if it's for you",
              description:
                "If you love it (most do), pick a membership. If not, no hard feelings — keep what you learned.",
            },
          ],
        },
      },
      {
        id: id("benefits-grid", 5),
        type: "benefits-grid",
        props: {
          headline: "What you get with membership",
          columns: 3,
          items: [
            {
              icon: "Activity",
              title: "Coached classes",
              description:
                "Every class is coached, never just a board on the wall. Real form correction, real scaling, real care.",
            },
            {
              icon: "Users",
              title: "A real community",
              description:
                "Members who notice when you're not there. Friendships that started at 6am and ended on backcountry trips.",
            },
            {
              icon: "Star",
              title: "Programmed for results",
              description:
                "12-week training cycles built by a head coach with a CSCS, not random metcons. Strength up, conditioning up.",
            },
            {
              icon: "BarChart2",
              title: "Track your progress",
              description:
                "Our app logs every workout, lift, and PR. Watch your numbers climb every quarter.",
            },
            {
              icon: "Clipboard",
              title: "Open gym access",
              description:
                "Our floor is open between classes for makeup work, mobility, or accessory days.",
            },
            {
              icon: "Bell",
              title: "Nutrition coaching",
              description:
                "Add 1:1 nutrition coaching to any membership for $99/month. Optional, never pushed.",
            },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd never set foot in a gym in my life. Forge made it feel possible. Two years in, I deadlift 305 and have a group of friends I'd never have met otherwise. Total reset.",
          author: "Maya Brennan",
          role: "Member since 2023",
          practiceName: "Down 22 lbs, up 145 lbs on her squat",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Free week. No card required. No pressure.",
          subheadline: "Show up once. See if it clicks. We're confident it will.",
          ctaText: "Claim your free week",
          ctaUrl: "#trial",
        },
      },
      footer("Forge Athletics", ACCENT_AMBER, 8),
    ],
  },

  {
    slug: "ind-fitness-online-coaching",
    title: "Online Coaching Program",
    templateLabel: "Fitness — Online Coaching Program",
    templateDescription:
      "Long-form sales page for an online coaching program (12-week transformation, app-based, group cohort). Built for paid traffic conversion.",
    ogImage:
      "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "12 weeks. A new body. A method that actually sticks.",
          subheadline:
            "Programmed lifting, dialed nutrition, and a coach in your pocket. The Rebuilt Strength method has guided 4,800+ people to results — most of them after years of failed attempts.",
          ctaText: "See if you qualify",
          ctaUrl: "#apply",
          secondaryCtaText: "Watch the method in 2 minutes",
          secondaryCtaUrl: "#video",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 65,
          minHeight: "large",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Method", url: "#method" },
            { label: "Results", url: "#results" },
            { label: "Pricing", url: "#pricing" },
            { label: "FAQ", url: "#faq" },
          ],
        },
      },
      trustBar(
        [
          { value: "4,800+", label: "Clients Coached" },
          { value: "12 weeks", label: "Program Length" },
          { value: "App", label: "Based" },
          { value: "★ 4.9", label: "App Store" },
        ],
        2,
      ),
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "What you actually get when you join",
          headlineAlign: "center",
          rows: [
            {
              tag: "PROGRAMMED LIFTING",
              headline: "A 12-week strength program built for your goal",
              body: "Three workouts a week, video demos for every movement, and weight prescriptions that update based on your last session. Lift smarter, not just harder.",
              ctaText: "See sample week",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "NUTRITION COACHING",
              headline: "Macros set for you, adjusted weekly",
              body: "We set your protein, calorie, and fiber targets based on your bodyweight, training, and goal — and adjust every week based on your check-in. No restrictive plans.",
              ctaText: "How nutrition works",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "COACH IN YOUR POCKET",
              headline: "DM your coach 7 days a week",
              body: "Form check video at 6am? You'll have a response by 9. Stuck on what to order at the work dinner? Ask. Real human coaches, never bots.",
              ctaText: "Meet the coaches",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 4),
        type: "stat-callout",
        props: {
          stat: "Avg 14 lbs",
          description: "Lost in the first 12 weeks — while gaining strength",
          footnote: "Across 4,800+ completed programs. Most clients also report better sleep, less back pain, and a lifelong skill they can keep using.",
        },
      },
      {
        id: id("photo-strip", 5),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=900&fit=crop", alt: "Transformation" },
            { src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=900&fit=crop", alt: "Lifting" },
            { src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=900&fit=crop", alt: "Group training" },
            { src: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=900&fit=crop", alt: "Healthy meal" },
            { src: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=900&fit=crop", alt: "Strong physique" },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd lost and regained the same 30 lbs three times. Rebuilt Strength was the first thing that taught me how to actually keep it off — because I learned how to lift, eat, and live, not just diet.",
          author: "Sasha Khoury",
          role: "12-week alumni",
          practiceName: "Down 38 lbs, kept it off 2 years",
        },
      },
      {
        id: id("bottom-cta", 7),
        type: "bottom-cta",
        props: {
          headline: "Next cohort starts the first Monday of next month.",
          subheadline:
            "Apply now to lock your spot. Limited to 200 new clients per cohort.",
          ctaText: "See if you qualify",
          ctaUrl: "#apply",
        },
      },
      footer("Rebuilt Strength", ACCENT_AMBER, 8),
    ],
  },

  {
    slug: "ind-fitness-wellness-retreat",
    title: "Wellness Retreat",
    templateLabel: "Fitness — Wellness Retreat",
    templateDescription:
      "Aspirational landing page for a wellness or yoga retreat. Cinematic full-bleed hero, itinerary-style schedule, and a high-touch booking form.",
    ogImage:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "Seven days to come back to yourself",
          subheadline:
            "An all-inclusive wellness retreat in the rainforest of Costa Rica. Daily yoga, breathwork, locally-sourced food, and oceanfront private rooms. Cohorts of 16 max.",
          ctaText: "View dates & book",
          ctaUrl: "#book",
          secondaryCtaText: "Watch the 90-second tour",
          secondaryCtaUrl: "#tour",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 40,
          minHeight: "full",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "The Experience", url: "#experience" },
            { label: "Itinerary", url: "#itinerary" },
            { label: "Dates", url: "#dates" },
            { label: "FAQ", url: "#faq" },
          ],
        },
      },
      trustBar(
        [
          { value: "16", label: "Guests Max" },
          { value: "7 nights", label: "All Inclusive" },
          { value: "Oceanfront", label: "Private Rooms" },
          { value: "Since 2019", label: "5 Cohorts/Yr" },
        ],
        2,
      ),
      {
        id: id("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "What a typical day looks like",
          steps: [
            {
              number: "06:30",
              title: "Sunrise yoga & meditation",
              description:
                "An hour of gentle movement and pranayama on the open-air deck, followed by 20 minutes of guided sit. Optional but most guests come.",
            },
            {
              number: "12:00",
              title: "Locally-sourced lunch & rest",
              description:
                "Plant-forward, three-course lunch made from ingredients sourced within 30 miles. Then unstructured time — beach, hammock, nap.",
            },
            {
              number: "17:00",
              title: "Breathwork, sound, or vinyasa",
              description:
                "Each evening features a different practice. Sound baths, ecstatic breathwork, slow vinyasa, or cacao circles, depending on the day.",
            },
            {
              number: "19:30",
              title: "Long table dinner under the stars",
              description:
                "Wine, candlelight, no phones. By night three, you'll know everyone at the table.",
            },
          ],
        },
      },
      {
        id: id("photo-strip", 4),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=900&fit=crop", alt: "Sunrise yoga" },
            { src: "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=900&fit=crop", alt: "Beach view" },
            { src: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?q=80&w=900&fit=crop", alt: "Yoga deck" },
            { src: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=900&fit=crop", alt: "Tropical retreat" },
            { src: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=900&fit=crop", alt: "Healthy meal" },
          ],
        },
      },
      {
        id: id("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "I went thinking I needed a vacation. I came home knowing I needed a complete recalibration of how I live. Cypress changed me — and I've been to a lot of retreats.",
          author: "Annika Berg",
          role: "Cohort 14 alumni",
          practiceName: "",
        },
      },
      {
        id: id("form", 6),
        type: "form",
        props: {
          headline: "Reserve your spot",
          subheadline:
            "Cohorts fill 4–6 months in advance. We'll respond within one business day with availability and next steps.",
          multiStep: false,
          steps: [
            {
              title: "Booking inquiry",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: false },
                { id: "dates", type: "text", label: "Preferred dates / cohort", placeholder: "March, May, or fall 2026", required: false },
                { id: "notes", type: "textarea", label: "Anything we should know?", placeholder: "First retreat, traveling solo or with a partner, dietary needs, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request booking info",
          submitButtonColor: ACCENT_FOREST,
          successMessage: "Thank you. We'll be in touch within one business day.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Cypress Retreat", ACCENT_FOREST, 7),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ESTATE (5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    slug: "ind-realestate-property-listing",
    title: "Single Property Listing",
    templateLabel: "Real Estate — Single Property Listing",
    templateDescription:
      "Cinematic single-property landing page for a luxury listing. Built around photography, key specs, and a tour-request form.",
    ogImage:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "1247 Cedar Hill Road",
          subheadline:
            "A four-bedroom modern home on 2.4 wooded acres in the Berkshires. Architect-designed in 2019, completed to the studs in 2023. Offered at $4,250,000.",
          ctaText: "Schedule a tour",
          ctaUrl: "#tour",
          secondaryCtaText: "View full gallery",
          secondaryCtaUrl: "#gallery",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 40,
          minHeight: "full",
          contentAlignment: "left",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Gallery", url: "#gallery" },
            { label: "Specs", url: "#specs" },
            { label: "Floor Plan", url: "#plan" },
            { label: "Schedule Tour", url: "#tour" },
          ],
        },
      },
      trustBar(
        [
          { value: "4 BR", label: "+ Office" },
          { value: "3.5 BA", label: "" },
          { value: "4,820 sqft", label: "" },
          { value: "2.4 Acres", label: "Wooded" },
        ],
        2,
      ),
      {
        id: id("photo-strip", 3),
        type: "photo-strip",
        props: {
          images: [
            { src: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=900&fit=crop", alt: "Exterior" },
            { src: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=900&fit=crop", alt: "Living room" },
            { src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=900&fit=crop", alt: "Kitchen" },
            { src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=900&fit=crop", alt: "Modern interior" },
            { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=900&fit=crop", alt: "Bedroom" },
          ],
        },
      },
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "Designed for the long Berkshire weekend",
          headlineAlign: "center",
          rows: [
            {
              tag: "ARCHITECTURE",
              headline: "A modern home that listens to its landscape",
              body: "Designed by Carter Studio (Boston) and built by Heritage Custom. Floor-to-ceiling western glass, 12-foot ceilings, and a great room that opens to a 1,200-sqft cedar deck overlooking the meadow.",
              ctaText: "Architect statement",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "KITCHEN",
              headline: "A chef's kitchen the family actually lives in",
              body: "44-inch Wolf range, integrated Miele appliances, walk-in pantry, and a 12-foot island in honed Calacatta. Open to the dining and great rooms — built for the dinner-party years.",
              ctaText: "More on the kitchen",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "GROUNDS",
              headline: "2.4 acres, professionally landscaped, room to grow",
              body: "Mature oak and birch, fenced perennial garden, and an outdoor fireplace and dining area. Heated in-ground pool and pool house added in 2023.",
              ctaText: "View site plan",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "$4,250,000",
          description: "Offered fully furnished — every piece thoughtfully chosen",
          footnote: "Furniture package optional, list available on request. Property taxes $42,800/yr.",
        },
      },
      {
        id: id("form", 6),
        type: "form",
        props: {
          headline: "Schedule a private tour",
          subheadline:
            "Available by appointment, weekdays and weekends. We'll respond within one business day to confirm.",
          multiStep: false,
          steps: [
            {
              title: "Tour request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "agent", type: "text", label: "Working with an agent?", placeholder: "Agent name & brokerage, or 'no'", required: false },
                { id: "preferred", type: "text", label: "Preferred days/times", placeholder: "Saturday afternoon, Sunday morning, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request tour",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Thank you. We'll confirm by phone within one business day.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Heritage & Co. Real Estate", ACCENT_NAVY, 7),
    ],
  },

  {
    slug: "ind-realestate-agent-brand",
    title: "Real Estate Agent Personal Brand",
    templateLabel: "Real Estate — Agent Personal Brand",
    templateDescription:
      "Personal-brand landing page for a top-producing agent. Built around credibility, recent transactions, and a free home-valuation lead magnet.",
    ogImage:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "The Mara Chen Group",
        [
          { label: "About Mara", url: "#about" },
          { label: "Recent Sales", url: "#sales" },
          { label: "Reviews", url: "#reviews" },
          { label: "Neighborhoods", url: "#neighborhoods" },
        ],
        { label: "Free home valuation", url: "#valuation" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Top 1% in the East Bay. Quietly, for 14 years.",
          subheadline:
            "Mara Chen has closed $1.2 billion in residential transactions across Oakland, Berkeley, and Piedmont. Whether you're listing or buying, you'll get more attention here than at most full-service teams.",
          ctaText: "Get a free home valuation",
          ctaUrl: "#valuation",
          ctaColor: ACCENT_NAVY,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Top 1% Compass Agent nationally — 5 years running. 168 five-star Zillow reviews.",
          imageUrl:
            "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "$1.2B", label: "Closed Volume" },
          { value: "14 yrs", label: "In the East Bay" },
          { value: "Top 1%", label: "Compass Nationally" },
          { value: "168", label: "5★ Reviews" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "How Mara works",
          headlineAlign: "center",
          rows: [
            {
              tag: "FOR SELLERS",
              headline: "Pricing strategy that gets you above ask, on time",
              body: "Mara's average list-to-sale ratio is 109%, with average days on market under 11. That comes from preparing your home properly, pricing it right, and marketing it like the asset it is.",
              ctaText: "How I sell homes",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "FOR BUYERS",
              headline: "An advocate who's seen every house in your range — twice",
              body: "Mara has walked over 4,000 East Bay homes. You'll get honest opinions, off-market access, and a negotiator who knows exactly what to push for.",
              ctaText: "Buying with Mara",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("case-studies", 5),
        type: "case-studies",
        props: {
          headline: "Recent transactions",
          subheadline: "A small selection from the last 12 months.",
          items: [
            {
              image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Sold for $4.2M, $400K over ask, in 9 days",
              categories: "PIEDMONT / 5BR",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Off-market acquisition for a buyer who'd been searching for 18 months",
              categories: "BERKELEY HILLS / 4BR",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "$2.1M sale in Rockridge — 11 offers, no contingencies",
              categories: "OAKLAND / 3BR",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "We interviewed five agents and Mara was the only one who actually told us things we didn't want to hear. Her pricing was right, her staging plan was right, her negotiation got us $310K above ask. Worth every basis point.",
          author: "Erik & Hana Stein",
          role: "Sold Piedmont, 2024",
          practiceName: "",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "What's your home worth in today's market?",
          subheadline:
            "Mara will personally prepare a tailored CMA — not an automated estimate. Delivered within 48 hours.",
          multiStep: false,
          steps: [
            {
              title: "Free home valuation",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "address", type: "text", label: "Property address", placeholder: "1234 Main St, Oakland CA", required: true },
                { id: "timeline", type: "text", label: "Considering selling?", placeholder: "Now, in 3–6 months, just curious", required: false },
              ],
            },
          ],
          submitButtonText: "Get my valuation",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Got it. Mara will personally prepare your CMA and send it within 48 hours.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("The Mara Chen Group at Compass", ACCENT_NAVY, 8),
    ],
  },

  {
    slug: "ind-realestate-new-construction",
    title: "New Construction Development",
    templateLabel: "Real Estate — New Construction",
    templateDescription:
      "Pre-construction development landing page. Built around the renderings, the floor plans, and a reservation form for early buyers.",
    ogImage:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "The Heights at Brookline",
          subheadline:
            "32 architect-designed condominiums, walking distance to the Green Line. One- to three-bedroom homes from $785,000. Reservations now open for an early-2027 delivery.",
          ctaText: "Reserve your home",
          ctaUrl: "#reserve",
          secondaryCtaText: "View floor plans",
          secondaryCtaUrl: "#plans",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 35,
          minHeight: "large",
          contentAlignment: "center",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Residences", url: "#residences" },
            { label: "Amenities", url: "#amenities" },
            { label: "Neighborhood", url: "#neighborhood" },
            { label: "Reserve", url: "#reserve" },
          ],
        },
      },
      trustBar(
        [
          { value: "32", label: "Residences" },
          { value: "From $785K", label: "1 BR" },
          { value: "Q1 2027", label: "Delivery" },
          { value: "8 min", label: "to Green Line" },
        ],
        2,
      ),
      {
        id: id("product-grid", 3),
        type: "product-grid",
        props: {
          headline: "Three home types, custom finishes for early reservations",
          subheadline:
            "Reserve before construction breaks ground in March to choose your finishes from the design library.",
          items: [
            {
              image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=900&h=600&fit=crop",
              title: "The Beacon — 1 BR + Den",
              description:
                "865 sqft, west-facing, with a 6×14 private terrace. From $785,000.",
            },
            {
              image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=900&h=600&fit=crop",
              title: "The Commonwealth — 2 BR",
              description:
                "1,180 sqft, corner unit, two exposures, 9-ft ceilings. From $1,150,000.",
            },
            {
              image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=900&h=600&fit=crop",
              title: "The Penthouse — 3 BR",
              description:
                "1,820 sqft, private rooftop terrace and skyline views. From $1,950,000.",
            },
          ],
        },
      },
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "Building amenities",
          columns: 3,
          items: [
            { icon: "Star", title: "Rooftop terrace", description: "Skyline views, fire pit, and outdoor kitchen — for residents only." },
            { icon: "Activity", title: "Private fitness studio", description: "Peloton bikes, free weights, and Mirror — open 24/7." },
            { icon: "Users", title: "Co-working lounge", description: "Quiet booths, Zoom rooms, espresso bar." },
            { icon: "Bell", title: "24/7 concierge", description: "Package management, dry cleaning, dog walks on request." },
            { icon: "Package", title: "Bike storage & repair", description: "Heated, secure storage with an in-house bike workshop." },
            { icon: "BookOpen", title: "Garage parking", description: "One deeded space included for 2-bedrooms and up." },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "60%",
          description: "Of residences in our last development reserved before construction",
          footnote: "Heights Capital, The Watermark project, 2022. Reserve early to choose your home and finishes.",
        },
      },
      {
        id: id("form", 6),
        type: "form",
        props: {
          headline: "Reserve your residence",
          subheadline:
            "$5,000 fully refundable deposit secures your spot in line and locks in pre-construction pricing.",
          multiStep: false,
          steps: [
            {
              title: "Reservation request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: true },
                { id: "type", type: "text", label: "Home type of interest", placeholder: "Beacon (1 BR), Commonwealth (2 BR), Penthouse, or open", required: true },
                { id: "agent", type: "text", label: "Working with an agent?", placeholder: "Agent name & brokerage, or 'no'", required: false },
              ],
            },
          ],
          submitButtonText: "Request reservation",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Thank you. Our sales team will be in touch within one business day.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Heights Capital", ACCENT_NAVY, 7),
    ],
  },

  {
    slug: "ind-realestate-home-valuation",
    title: "Free Home Valuation Lead Magnet",
    templateLabel: "Real Estate — Free Home Valuation",
    templateDescription:
      "Single-purpose lead-capture page for an agent or team running paid traffic. Free home valuation in 48 hours, prepared by a real human.",
    ogImage:
      "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("hero", 1),
        type: "hero",
        props: {
          headline: "What's your home actually worth in today's market?",
          subheadline:
            "Skip the algorithmic estimates. Our team prepares a custom valuation based on real recent sales in your neighborhood — delivered within 48 hours, free.",
          ctaText: "Get my free valuation",
          ctaUrl: "#form",
          ctaColor: ACCENT_NAVY,
          heroType: "static-image",
          layout: "centered",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Used by 8,400+ Bay Area homeowners since 2021. Average response in 36 hours.",
          imageUrl:
            "https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=1600&h=900&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "48 hr", label: "Avg. Response" },
          { value: "Free", label: "Always" },
          { value: "Real CMA", label: "Not An Algorithm" },
          { value: "8,400+", label: "Used By" },
        ],
        2,
      ),
      {
        id: id("how-it-works", 3),
        type: "how-it-works",
        props: {
          headline: "How it works",
          steps: [
            {
              number: "01",
              title: "Tell us about your home",
              description:
                "30 seconds. Address, beds/baths, and any recent improvements that wouldn't show up in public records.",
            },
            {
              number: "02",
              title: "Our team builds your CMA",
              description:
                "A licensed agent personally pulls comps, walks the block in Street View, and writes you a tailored valuation.",
            },
            {
              number: "03",
              title: "We email it within 48 hours",
              description:
                "PDF report with comps, your projected list price, and a no-obligation conversation if you want one.",
            },
          ],
        },
      },
      {
        id: id("form", 4),
        type: "form",
        props: {
          headline: "Get your free valuation",
          subheadline:
            "We'll respond within 48 hours. We will not call you unless you ask us to.",
          multiStep: false,
          steps: [
            {
              title: "Property info",
              fields: [
                { id: "address", type: "text", label: "Property address", placeholder: "1234 Main St, Oakland CA", required: true },
                { id: "beds", type: "text", label: "Bedrooms", placeholder: "3", required: true },
                { id: "baths", type: "text", label: "Bathrooms", placeholder: "2.5", required: true },
                { id: "improvements", type: "textarea", label: "Recent improvements?", placeholder: "Renovated kitchen 2022, new roof 2024, ADU added, etc.", required: false },
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone (optional)", placeholder: "(555) 555-0140", required: false },
              ],
            },
          ],
          submitButtonText: "Send my free valuation",
          submitButtonColor: ACCENT_NAVY,
          successMessage:
            "Got it. We'll have your valuation in your inbox within 48 hours.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      {
        id: id("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "I'd been getting Zillow estimates for years that were wildly off. The team's CMA came in $180K higher than the algorithm and turned out to be exactly right when we sold three months later.",
          author: "Greg & Tasha Lim",
          role: "Berkeley homeowners",
          practiceName: "Sold for full asking, 2024",
        },
      },
      footer("Heritage & Co. Real Estate", ACCENT_NAVY, 6),
    ],
  },

  {
    slug: "ind-realestate-property-management",
    title: "Property Management Company",
    templateLabel: "Real Estate — Property Management",
    templateDescription:
      "Landing page for a property management company targeting landlords. Built around 'we make owning property a passive investment again'.",
    ogImage:
      "https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Anchor Property Management",
        [
          { label: "Services", url: "#services" },
          { label: "Pricing", url: "#pricing" },
          { label: "Owners", url: "#owners" },
          { label: "Reviews", url: "#reviews" },
        ],
        { label: "Get a free quote", url: "#quote" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Property management that makes owning rentals passive again",
          subheadline:
            "Full-service management for 1–500 unit portfolios. Tenant placement in 21 days on average, 96% on-time rent collection, and an owner portal you'll actually open.",
          ctaText: "Get a free portfolio quote",
          ctaUrl: "#quote",
          ctaColor: ACCENT_FOREST,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by 480+ property owners managing 3,200+ units across the region",
          imageUrl:
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "3,200+", label: "Units Managed" },
          { value: "21 days", label: "Avg. Lease-Up" },
          { value: "96%", label: "On-Time Rent" },
          { value: "Since 2009", label: "In Business" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "What's included",
          columns: 3,
          items: [
            {
              icon: "Users",
              title: "Tenant placement",
              description:
                "Listing, showings, screening, and lease execution. Average lease-up under 21 days.",
            },
            {
              icon: "DollarSign",
              title: "Rent collection",
              description:
                "ACH-first collection with automated late notices. 96% on-time, ACH next-day to your account.",
            },
            {
              icon: "Bell",
              title: "Maintenance coordination",
              description:
                "24/7 emergency line. Vetted vendor network. Photo-documented before/after for every job.",
            },
            {
              icon: "Clipboard",
              title: "Inspections",
              description:
                "Move-in, move-out, and annual interior inspections — with photo reports delivered to your portal.",
            },
            {
              icon: "BarChart2",
              title: "Owner reporting",
              description:
                "Monthly P&L per property, year-end tax package, IRS Form 1099s — no more shoebox accounting.",
            },
            {
              icon: "Activity",
              title: "Compliance",
              description:
                "Local registration, just-cause notices, security deposit accounting — handled, not your problem.",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "21 days",
          description: "Average lease-up time across our managed portfolio",
          footnote: "From listing live to signed lease, across 1,800+ placements in the last 24 months.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I had 14 doors I was self-managing and it was eating my weekends. Switched to Anchor 18 months ago and I genuinely don't think about my rentals anymore. They send a check, the books reconcile, end of story.",
          author: "Patrick O'Connell",
          role: "Owner, 14 units",
          practiceName: "Anchor client since 2024",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Get a free management quote",
          subheadline:
            "Tell us about your portfolio and we'll send tailored pricing within one business day.",
          multiStep: false,
          steps: [
            {
              title: "Quote request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: false },
                { id: "doors", type: "text", label: "Approximate units", placeholder: "1–5, 6–25, 26–100, 100+", required: true },
                { id: "type", type: "text", label: "Property type", placeholder: "Single-family, multi-family, mixed-use", required: false },
                { id: "notes", type: "textarea", label: "Anything we should know?", placeholder: "Currently self-managing, switching from another PM, expanding, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Request quote",
          submitButtonColor: ACCENT_FOREST,
          successMessage: "Thank you. We'll send your tailored quote within one business day.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Anchor Property Management", ACCENT_FOREST, 8),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL SERVICES (5)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    slug: "ind-prof-law-firm",
    title: "Law Firm",
    templateLabel: "Professional Services — Law Firm",
    templateDescription:
      "Boutique law firm landing page. Built around credibility, practice areas, and a confidential consultation request — not a billable-hour pitch.",
    ogImage:
      "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Hartley & Coe",
        [
          { label: "Practice Areas", url: "#practices" },
          { label: "Attorneys", url: "#attorneys" },
          { label: "Results", url: "#results" },
          { label: "About", url: "#about" },
        ],
        { label: "Confidential consult", url: "#consult" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Boutique business law for founders, executives, and investors",
          subheadline:
            "12 attorneys. One floor. Direct access to senior partners on every matter — without the rates of a big firm. Based in Boston, serving clients across the Northeast.",
          ctaText: "Request a confidential consultation",
          ctaUrl: "#consult",
          ctaColor: ACCENT_NAVY,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Chambers-ranked. Recognized in Best Lawyers in America 2024.",
          imageUrl:
            "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "12", label: "Attorneys" },
          { value: "Chambers", label: "Ranked" },
          { value: "Founded 2008", label: "" },
          { value: "Northeast", label: "Coverage" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "Practice areas",
          columns: 3,
          items: [
            {
              icon: "Clipboard",
              title: "Mergers & acquisitions",
              description:
                "We've closed over $4B in M&A volume — from $2M founder buyouts to $450M strategic transactions.",
            },
            {
              icon: "Users",
              title: "Venture & growth",
              description:
                "Seed through Series D financings. Founders' counsel for 80+ portfolio companies of leading East Coast funds.",
            },
            {
              icon: "BookOpen",
              title: "Commercial litigation",
              description:
                "Contract, partnership, and trade-secret disputes. We win in court when settlement isn't an option.",
            },
            {
              icon: "BarChart2",
              title: "Tax & structuring",
              description:
                "Pre-transaction tax planning and ongoing structuring for high-net-worth founders and family offices.",
            },
            {
              icon: "Activity",
              title: "Employment",
              description:
                "Executive comp, separation agreements, and dispute defense for both companies and senior executives.",
            },
            {
              icon: "Bell",
              title: "Trusts & estates",
              description:
                "Wealth transfer planning for founders and high-net-worth families before, during, and after liquidity events.",
            },
          ],
        },
      },
      {
        id: id("case-studies", 5),
        type: "case-studies",
        props: {
          headline: "Recent matters",
          subheadline: "A small selection from the last 12 months — names withheld where required.",
          items: [
            {
              image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Sell-side M&A for a $180M ARR SaaS company",
              categories: "M&A / SAAS",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Series C financing led by a Tier-1 fund",
              categories: "VENTURE / FINTECH",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Defended a partnership dispute through trial — full defense verdict",
              categories: "LITIGATION / PARTNERSHIPS",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "We picked Hartley & Coe over two AmLaw 50 firms for our exit, and we'd do it again. Senior partner attention from day one, no surprises on the bill, and they got us across the line on terms our prior counsel said were impossible.",
          author: "Theodore Reeve",
          role: "Co-Founder & CEO",
          practiceName: "Acquired by NYSE-listed buyer, 2024",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Request a confidential consultation",
          subheadline:
            "We respond to every inquiry within one business day. Initial conversations are without obligation or charge.",
          multiStep: false,
          steps: [
            {
              title: "Confidential inquiry",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@company.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: false },
                { id: "company", type: "text", label: "Company / role", placeholder: "Acme Inc., CEO", required: false },
                { id: "matter", type: "textarea", label: "Briefly, what's the matter?", placeholder: "M&A, financing, dispute, planning, etc. A sentence or two is plenty.", required: true },
              ],
            },
          ],
          submitButtonText: "Submit confidential inquiry",
          submitButtonColor: ACCENT_NAVY,
          successMessage:
            "Thank you. A senior partner will be in touch within one business day.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Hartley & Coe", ACCENT_NAVY, 8),
    ],
  },

  {
    slug: "ind-prof-accounting",
    title: "Accounting & Tax Services",
    templateLabel: "Professional Services — Accounting & Tax",
    templateDescription:
      "Modern CPA firm landing page targeting small businesses and founders. Built around fixed monthly pricing and proactive tax strategy.",
    ogImage:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "North Compass CPA",
        [
          { label: "Services", url: "#services" },
          { label: "Pricing", url: "#pricing" },
          { label: "Industries", url: "#industries" },
          { label: "About", url: "#about" },
        ],
        { label: "Get a quote", url: "#quote" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "The CPA your accountant should have been",
          subheadline:
            "Bookkeeping, monthly reporting, and proactive tax strategy for small businesses and founders. Fixed monthly pricing, no surprise bills, and a CPA who actually picks up the phone.",
          ctaText: "Get a flat-rate quote",
          ctaUrl: "#quote",
          ctaColor: ACCENT_FOREST,
          heroType: "static-image",
          layout: "split-right",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Trusted by 800+ businesses across 14 industries — average client tenure 4.7 years",
          imageUrl:
            "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "800+", label: "Active Clients" },
          { value: "Flat", label: "Monthly Pricing" },
          { value: "4.7 yrs", label: "Avg. Tenure" },
          { value: "Since 2014", label: "In Business" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "What working with North Compass actually looks like",
          headlineAlign: "center",
          rows: [
            {
              tag: "BOOKKEEPING",
              headline: "Books that close on the 5th, every month",
              body: "We use modern accounting tools (Xero or QBO) and reconcile every account every month. By the 5th business day, you have last month's P&L, balance sheet, and cash flow — without asking.",
              ctaText: "Bookkeeping details",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "TAX STRATEGY",
              headline: "Tax planning that happens before December 31, not in April",
              body: "Quarterly tax meetings to plan estimated payments, S-corp distributions, retirement contributions, and entity structure. Most clients save 5–7× our fee in legitimate tax reductions.",
              ctaText: "Tax planning approach",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "ADVISORY",
              headline: "A CFO conversation when you need one",
              body: "Pricing decisions, hiring math, lease vs. buy, M&A diligence prep. Your CPA is on call when the big questions come up — not just at tax time.",
              ctaText: "Advisory engagements",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "5–7×",
          description: "Average fee multiple our clients save in legitimate tax reductions",
          footnote: "Across 800+ active clients. Calculated against fees paid in the same year.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd had three accountants in five years and dreaded April every time. North Compass is the first firm that proactively saves me money — they restructured my entity, set up my solo 401(k), and saved me more in year one than I paid them in three.",
          author: "Anjali Verma",
          role: "Founder",
          practiceName: "Verma Design Co.",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Get a flat-rate monthly quote",
          subheadline:
            "Tell us about your business and we'll send custom pricing within one business day.",
          multiStep: false,
          steps: [
            {
              title: "Quote request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@company.com", required: true },
                { id: "company", type: "text", label: "Company name", placeholder: "Acme Inc.", required: true },
                { id: "revenue", type: "text", label: "Approximate annual revenue", placeholder: "$250K, $1M, $5M, etc.", required: false },
                { id: "entity", type: "text", label: "Entity type", placeholder: "LLC, S-corp, C-corp, sole prop", required: false },
                { id: "needs", type: "textarea", label: "What do you need?", placeholder: "Bookkeeping, tax prep, planning, all of the above, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Get my quote",
          submitButtonColor: ACCENT_FOREST,
          successMessage:
            "Thank you. We'll send your custom quote within one business day.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      footer("North Compass CPA", ACCENT_FOREST, 8),
    ],
  },

  {
    slug: "ind-prof-marketing-agency",
    title: "Marketing & Creative Agency",
    templateLabel: "Professional Services — Marketing Agency",
    templateDescription:
      "B2B marketing agency landing page focused on brand and growth. Confident, case-study-led, and built to attract serious mid-market clients.",
    ogImage:
      "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      {
        id: id("full-bleed-hero", 1),
        type: "full-bleed-hero",
        props: {
          headline: "Brand and growth marketing for B2B teams that have to ship results",
          subheadline:
            "Catalyst Studio is a 24-person agency partnered with Series B–D companies on positioning, demand gen, and brand. Selectively, for about 18 clients at a time.",
          ctaText: "Start a project",
          ctaUrl: "#contact",
          secondaryCtaText: "View our work",
          secondaryCtaUrl: "#work",
          backgroundType: "image",
          backgroundImageUrl:
            "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=1920&h=1080&fit=crop",
          backgroundVideoUrl: "",
          videoAutoplay: false,
          overlayOpacity: 60,
          minHeight: "large",
          contentAlignment: "left",
          headlineColor: "#FFFFFF",
          subheadlineColor: "#FFFFFFCC",
          logoImageUrl: "",
          logoUrl: "#",
          navLinks: [
            { label: "Services", url: "#services" },
            { label: "Work", url: "#work" },
            { label: "About", url: "#about" },
            { label: "Insights", url: "#insights" },
          ],
        },
      },
      trustBar(
        [
          { value: "120+", label: "Brands Launched" },
          { value: "24", label: "Senior People" },
          { value: "Series B–D", label: "Sweet Spot" },
          { value: "Since 2017", label: "In Business" },
        ],
        2,
      ),
      {
        id: id("zigzag-features", 3),
        type: "zigzag-features",
        props: {
          headline: "What we partner on",
          headlineAlign: "center",
          rows: [
            {
              tag: "POSITIONING & MESSAGING",
              headline: "A real point of view, expressed with discipline",
              body: "We work with founders and CMOs to find the position that's both true and unobvious — then build the messaging system that scales it across the entire company.",
              ctaText: "Positioning engagements",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1542744095-fcf48d80b0fd?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "BRAND & WEBSITE",
              headline: "A brand system and site you'll be proud of for five years",
              body: "Identity, voice, design system, and a marketing site we hand-build to spec. Most engagements ship in 10–14 weeks, with senior creative on every page.",
              ctaText: "Brand case studies",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "DEMAND GEN",
              headline: "Pipeline programs that compound, not just spike",
              body: "Paid, content, ABM, and lifecycle programs designed and operated by people who've run marketing at companies we'd recognize. Reporting that ties to revenue, not vanity.",
              ctaText: "How demand gen works",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("case-studies", 4),
        type: "case-studies",
        props: {
          headline: "Selected work",
          subheadline: "A small slice. Full case books available on request.",
          items: [
            {
              image: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Repositioned a Series C SaaS — pipeline up 2.4× in two quarters",
              categories: "POSITIONING / SAAS",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "End-to-end rebrand and site for a $40M ARR fintech",
              categories: "BRAND / FINTECH",
              url: "#",
            },
            {
              image: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=900&h=600&fit=crop",
              logoUrl: "",
              title: "Demand gen program that took CAC from $1,800 to $720",
              categories: "DEMAND GEN / B2B",
              url: "#",
            },
          ],
          backgroundStyle: "light-gray",
        },
      },
      {
        id: id("testimonial", 5),
        type: "testimonial",
        props: {
          quote:
            "We'd worked with three other agencies before Catalyst. They're the only one that felt like an extension of our marketing team — strategic, opinionated, and operationally excellent. Quarter over quarter, the work compounds.",
          author: "Sasha Brennan",
          role: "CMO",
          practiceName: "Pendulum (Series C)",
        },
      },
      {
        id: id("form", 6),
        type: "form",
        props: {
          headline: "Tell us about your project",
          subheadline:
            "We respond to every inquiry within two business days. No discovery deck required.",
          multiStep: false,
          steps: [
            {
              title: "Project inquiry",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@company.com", required: true },
                { id: "company", type: "text", label: "Company", placeholder: "Acme Inc.", required: true },
                { id: "stage", type: "text", label: "Stage", placeholder: "Series A, B, C, growth, public", required: false },
                { id: "scope", type: "text", label: "Approximate budget", placeholder: "$50K–$150K, $150K–$500K, $500K+", required: false },
                { id: "message", type: "textarea", label: "What are you working on?", placeholder: "A few sentences is plenty.", required: true },
              ],
            },
          ],
          submitButtonText: "Send inquiry",
          submitButtonColor: ACCENT_VIOLET,
          successMessage: "Got it. We'll be in touch within two business days.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Catalyst Studio", ACCENT_VIOLET, 7),
    ],
  },

  {
    slug: "ind-prof-financial-advisor",
    title: "Financial Advisor",
    templateLabel: "Professional Services — Financial Advisor",
    templateDescription:
      "Independent fee-only financial advisor landing page. Built around fiduciary trust, transparent pricing, and a clear discovery process.",
    ogImage:
      "https://images.unsplash.com/photo-1554224155-cfa08c2a758f?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Rivermark Wealth",
        [
          { label: "Approach", url: "#approach" },
          { label: "Services", url: "#services" },
          { label: "Pricing", url: "#pricing" },
          { label: "Team", url: "#team" },
        ],
        { label: "Schedule a call", url: "#call" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Fee-only fiduciary wealth management — finally, no conflicts",
          subheadline:
            "We're independent, fee-only, and a true fiduciary at all times. No commissions, no proprietary products, no incentives misaligned with yours. Flat-fee planning, transparent investment management.",
          ctaText: "Schedule an intro call",
          ctaUrl: "#call",
          ctaColor: ACCENT_NAVY,
          heroType: "static-image",
          layout: "split",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "$1.4B AUM. NAPFA member. Featured in Forbes Best-In-State Wealth Advisors 2024.",
          imageUrl:
            "https://images.unsplash.com/photo-1554224155-cfa08c2a758f?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "$1.4B", label: "AUM" },
          { value: "Fee Only", label: "No Commissions" },
          { value: "NAPFA", label: "Member" },
          { value: "Since 2011", label: "Founded" },
        ],
        3,
      ),
      {
        id: id("benefits-grid", 4),
        type: "benefits-grid",
        props: {
          headline: "What it looks like to be a Rivermark client",
          columns: 3,
          items: [
            {
              icon: "Clipboard",
              title: "Comprehensive financial plan",
              description:
                "Cash flow, retirement, tax, estate, insurance, and education — modeled, stress-tested, and updated annually.",
            },
            {
              icon: "BarChart2",
              title: "Tax-efficient investing",
              description:
                "Globally diversified, low-cost portfolios with tax-loss harvesting and asset-location strategy applied automatically.",
            },
            {
              icon: "DollarSign",
              title: "Tax planning",
              description:
                "Roth conversions, Mega Backdoor strategy, charitable bunching, ESPP/RSU planning — coordinated with your CPA.",
            },
            {
              icon: "Users",
              title: "Equity comp planning",
              description:
                "Stock options, RSUs, and concentrated positions — exit-planned and diversified strategically over multi-year windows.",
            },
            {
              icon: "Bell",
              title: "Cash flow & banking",
              description:
                "Treasury yield laddering, mortgage decisions, refinancing analysis, debt strategy — all in plain English.",
            },
            {
              icon: "BookOpen",
              title: "Estate coordination",
              description:
                "Coordinated planning with your attorney for trusts, beneficiary designations, and intergenerational transfer strategy.",
            },
          ],
        },
      },
      {
        id: id("how-it-works", 5),
        type: "how-it-works",
        props: {
          headline: "How working together actually starts",
          steps: [
            {
              number: "01",
              title: "Free 30-minute intro call",
              description:
                "We'll learn about your situation, walk through how we work, and tell you honestly whether we're the right fit.",
            },
            {
              number: "02",
              title: "Discovery & analysis",
              description:
                "Two-week deep dive: cash flow, taxes, holdings, estate, insurance. You'll get a written analysis and our recommendations.",
            },
            {
              number: "03",
              title: "Decide together",
              description:
                "If we're a fit, we move into ongoing planning + investment management. If not, you keep the analysis and our advice — no charge.",
            },
          ],
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "After our IPO we interviewed seven advisors. Rivermark was the only one that gave us a written plan instead of a pitch. Two years in, our taxes are lower, our portfolio is properly diversified, and we don't lose sleep about money decisions anymore.",
          author: "Marcus & Lila Patel",
          role: "Clients since 2023",
          practiceName: "Post-IPO planning",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Schedule a free 30-minute intro call",
          subheadline:
            "We'll respond within one business day with a few times. No obligation, no pitch — we'll tell you honestly if we're the right fit.",
          multiStep: false,
          steps: [
            {
              title: "Intro call request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@email.com", required: true },
                { id: "phone", type: "phone", label: "Phone", placeholder: "(555) 555-0140", required: false },
                { id: "situation", type: "textarea", label: "Briefly, what's your situation?", placeholder: "Equity comp, near retirement, business sale, inheritance, just starting out, etc.", required: false },
              ],
            },
          ],
          submitButtonText: "Schedule intro call",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Thank you. We'll be in touch within one business day with a few times.",
          redirectUrl: "",
          backgroundStyle: "muted",
          cardStyle: "elevated",
          labelStyle: "default",
          formMode: "native",
        },
      },
      footer("Rivermark Wealth", ACCENT_NAVY, 8),
    ],
  },

  {
    slug: "ind-prof-business-consulting",
    title: "Business Consulting",
    templateLabel: "Professional Services — Business Consulting",
    templateDescription:
      "Operations consulting landing page targeting $5M–$50M companies. Built around concrete outcomes and a senior-led engagement model.",
    ogImage:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1200&h=630&fit=crop",
    industry: null,
    blocks: [
      nav(
        "Halcyon Strategy",
        [
          { label: "Engagements", url: "#engagements" },
          { label: "Industries", url: "#industries" },
          { label: "Case Studies", url: "#cases" },
          { label: "Team", url: "#team" },
        ],
        { label: "Schedule a call", url: "#contact" },
        1,
      ),
      {
        id: id("hero", 2),
        type: "hero",
        props: {
          headline: "Operating partners for the $5M–$50M company",
          subheadline:
            "We work alongside founders and CEOs of growing companies on the things that move the P&L: pricing, ops, sales, and org design. Senior-led, embedded engagements — no junior consultants.",
          ctaText: "Schedule a 30-minute call",
          ctaUrl: "#contact",
          ctaColor: ACCENT_NAVY,
          heroType: "static-image",
          layout: "split-right",
          backgroundStyle: "white",
          showSocialProof: true,
          socialProofText: "Worked with 80+ growing companies. Average client engagement length: 9 months.",
          imageUrl:
            "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=1600&h=1200&fit=crop",
          mediaUrl: "",
        },
      },
      trustBar(
        [
          { value: "80+", label: "Engagements" },
          { value: "9 mo", label: "Avg. Length" },
          { value: "Senior", label: "Led, Always" },
          { value: "Since 2018", label: "Founded" },
        ],
        3,
      ),
      {
        id: id("zigzag-features", 4),
        type: "zigzag-features",
        props: {
          headline: "What we typically work on",
          headlineAlign: "center",
          rows: [
            {
              tag: "PRICING & PACKAGING",
              headline: "Get your pricing right and watch margin follow",
              body: "We map willingness to pay, restructure your packaging, and run a controlled rollout. Median outcome across our last 30 pricing engagements: +18% gross margin within two quarters.",
              ctaText: "Pricing engagements",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "OPERATIONS & PROCESS",
              headline: "Cut the cost of getting things done",
              body: "We embed with your team, map the actual process, and rebuild the operating cadence. Most engagements pay for themselves in 90 days through reduced rework and clearer ownership.",
              ctaText: "Ops engagements",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=700&fit=crop",
            },
            {
              tag: "GTM & SALES",
              headline: "Build a sales engine that doesn't depend on heroes",
              body: "Segment, ICP, comp, sales process, pipeline reviews, enablement. We build the system, train your team, and stay long enough to make sure it runs without us.",
              ctaText: "GTM engagements",
              ctaUrl: "#",
              imageUrl:
                "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=900&h=700&fit=crop",
            },
          ],
        },
      },
      {
        id: id("stat-callout", 5),
        type: "stat-callout",
        props: {
          stat: "+18%",
          description: "Median gross margin lift across our pricing engagements",
          footnote: "Last 30 engagements, measured two quarters post-rollout. Range: +6% to +41%.",
        },
      },
      {
        id: id("testimonial", 6),
        type: "testimonial",
        props: {
          quote:
            "I'd hired two prior consulting firms and gotten lots of slides and zero change. Halcyon was different — they showed up in our offices, did the work alongside our team, and left us with an operating model we still use three years later. Best money we've spent.",
          author: "Diane Okeke",
          role: "CEO",
          practiceName: "$28M ARR services company",
        },
      },
      {
        id: id("form", 7),
        type: "form",
        props: {
          headline: "Schedule an introductory call",
          subheadline:
            "30 minutes with a partner. We'll share how we work and tell you honestly if we're the right fit for your situation.",
          multiStep: false,
          steps: [
            {
              title: "Intro call request",
              fields: [
                { id: "name", type: "text", label: "Your name", placeholder: "Jane Doe", required: true },
                { id: "email", type: "email", label: "Email", placeholder: "you@company.com", required: true },
                { id: "company", type: "text", label: "Company", placeholder: "Acme Inc.", required: true },
                { id: "revenue", type: "text", label: "Approximate revenue", placeholder: "$5M, $15M, $30M, etc.", required: false },
                { id: "challenge", type: "textarea", label: "Briefly, what's the challenge?", placeholder: "Pricing, ops, sales, org, all of the above, etc.", required: true },
              ],
            },
          ],
          submitButtonText: "Schedule call",
          submitButtonColor: ACCENT_NAVY,
          successMessage: "Thank you. A partner will be in touch within one business day.",
          redirectUrl: "",
          backgroundStyle: "white",
          cardStyle: "elevated",
          labelStyle: "uppercase",
          formMode: "native",
        },
      },
      footer("Halcyon Strategy", ACCENT_NAVY, 8),
    ],
  },
];
