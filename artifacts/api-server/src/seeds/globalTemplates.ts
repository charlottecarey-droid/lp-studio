// Idempotent seed for global landing-page templates that any tenant in the
// matching industry can clone from.
//
// These rows live in `lp_pages` with is_template=true and is_global=true. The
// owning tenant_id is irrelevant for visibility (the GET /lp/templates filter
// pulls all globals regardless of owner) but the FK still has to point at a
// real tenant row, so we own these under the seeded "system" tenant created
// alongside the seed.

export interface GlobalTemplateSeed {
  slug: string;
  title: string;
  templateLabel: string;
  templateDescription: string;
  industry: "dental" | "generic" | null;
  blocks: any[];
}

// Three starter templates for generic B2B SaaS tenants. Block shapes are
// shallow — they rely on the in-code BLOCK_REGISTRY defaults to fill in the
// rest, just like a brand-new block dropped into the builder.
export const GLOBAL_TEMPLATE_SEEDS: GlobalTemplateSeed[] = [
  {
    slug: "global-saas-landing",
    title: "SaaS Landing Page",
    templateLabel: "SaaS Landing Page",
    templateDescription: "A simple hero + features + CTA layout for a generic B2B SaaS landing page.",
    industry: "generic",
    blocks: [
      {
        type: "hero",
        props: {
          headline: "Ship faster, with less drag",
          subheadline: "The platform your team will actually want to use. Built for modern B2B teams.",
          primaryCtaLabel: "Start free",
          secondaryCtaLabel: "Book a demo",
        },
      },
      {
        type: "features",
        props: {
          title: "Why teams choose us",
          features: [
            { title: "Fast", description: "Built for performance from day one." },
            { title: "Secure", description: "SOC 2 Type II, with SSO out of the box." },
            { title: "Loved", description: "Top-rated on G2 by teams like yours." },
          ],
        },
      },
      {
        type: "cta",
        props: {
          headline: "Ready to see it in action?",
          subheadline: "Start a free 14-day trial — no credit card required.",
          primaryCtaLabel: "Start free trial",
        },
      },
    ],
  },
  {
    slug: "global-saas-leadgen",
    title: "Lead Generation Page",
    templateLabel: "Lead Generation Page",
    templateDescription: "Hero + value props + lead capture form. Built for paid traffic and gated content.",
    industry: "generic",
    blocks: [
      {
        type: "hero",
        props: {
          headline: "Get the 2026 B2B Buyer Report",
          subheadline: "200+ pages of original research on how today's buyers evaluate software. Free.",
          primaryCtaLabel: "Download the report",
        },
      },
      {
        type: "valueProps",
        props: {
          title: "What's inside",
          items: [
            { title: "Buyer behavior", description: "How decisions actually get made today." },
            { title: "Channel benchmarks", description: "What's working in 2026 — by segment." },
            { title: "AI-era playbooks", description: "Templates and worksheets to apply right away." },
          ],
        },
      },
      {
        type: "leadForm",
        props: {
          title: "Get instant access",
          submitLabel: "Send me the report",
          fields: [
            { name: "email", label: "Work email", type: "email", required: true },
            { name: "company", label: "Company", type: "text", required: true },
          ],
        },
      },
    ],
  },
  {
    slug: "global-saas-pricing",
    title: "SaaS Pricing Page",
    templateLabel: "SaaS Pricing Page",
    templateDescription: "Tiered pricing with a comparison table and an FAQ. Drops into any generic B2B SaaS site.",
    industry: "generic",
    blocks: [
      {
        type: "hero",
        props: {
          headline: "Simple pricing that scales with you",
          subheadline: "Start free. Pay only when you're getting real value.",
        },
      },
      {
        type: "pricing",
        props: {
          tiers: [
            { name: "Free",      price: "$0",   features: ["Up to 3 users", "Community support"] },
            { name: "Team",      price: "$29",  features: ["Up to 25 users", "Priority email support"], highlight: true },
            { name: "Business",  price: "$99",  features: ["Unlimited users", "SSO + audit logs", "24/7 support"] },
          ],
        },
      },
      {
        type: "faq",
        props: {
          title: "Frequently asked questions",
          items: [
            { question: "Can I change plans later?", answer: "Yes — upgrade or downgrade any time. We prorate the difference." },
            { question: "Is there a contract?", answer: "No long-term contract. Monthly and annual billing both available." },
            { question: "Do you offer non-profit discounts?", answer: "Yes. Reach out and we'll get you set up." },
          ],
        },
      },
    ],
  },
];
