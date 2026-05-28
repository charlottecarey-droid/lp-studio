import { useMemo, useState } from "react";
import { useInView } from "../hooks/useInView";

type Category = "All" | "Product" | "Pricing" | "Tech";

interface Faq {
  q: string;
  a: string;
  cat: Category;
}

const faqs: Faq[] = [
  {
    q: "How fast can my team actually launch a page?",
    a: "Most teams ship their first real page within an hour of getting access. Start from 60+ on-brand templates — including 25 industry-specific layouts for dental, healthcare, fitness, real estate, and professional services — let AI fill the copy, swap in your brand assets, and publish. No code, no design ticket, no waiting on marketing.",
    cat: "Product",
  },
  {
    q: "Do I need design or eng help to use this?",
    a: "No. Brand tokens and approved blocks are baked in by your design team once, and after that anyone on the team can ship on-brand pages. If you want to customize, the builder has a properties panel — and devs can extend the block library with custom React components.",
    cat: "Product",
  },
  {
    q: "How does A/B testing work?",
    a: "Create variants right in the editor, set your winning metric (clicks, signups, booked meetings), and split traffic. We detect significance automatically and Smart Traffic routes the majority of visitors to the winning variant once it's clear.",
    cat: "Product",
  },
  {
    q: "Where does the page actually live?",
    a: "On a fast, globally cached domain we host for you, or on your own subdomain if you bring DNS. Pages are statically rendered and load in under a second. SSL is handled.",
    cat: "Tech",
  },
  {
    q: "What about analytics and tracking?",
    a: "Built in: visitors, conversions, scroll depth, click maps, heatmaps, and per-variant performance. We also push events to GA4 and your CRM (Salesforce, Marketo), plus webhooks for anything else — so the data flows where your revenue team already looks.",
    cat: "Tech",
  },
  {
    q: "How is this different from Mutiny, Webflow, or Unbounce?",
    a: "Mutiny's demo is impressive — but their free and $50 tiers are 5-credit and 50-credit demos that won't ship a real page. Real Mutiny starts at $30K/yr. Webflow is a designer's tool — beautiful, but slow when you need 50 ABM pages and there's no Sales Console. Unbounce is generic landing pages, marketing-team owned. LP Studio is the AI revenue workspace that lives between them: the demo magic Mutiny gives you, the on-brand pages Webflow makes you wait for designers to build, and the Sales Console none of them have — at mid-market prices a Director of Demand Gen can sign off on.",
    cat: "Product",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Month-to-month plans cancel from the billing settings page — no calls, no contract clauses. Annual plans pause at renewal. You can export your pages as HTML before you leave.",
    cat: "Pricing",
  },
  {
    q: "Is there a free tier? Free trial?",
    a: "Both. Free is forever — 1 page, 1 form, 1 seat, with a 'Built with LP Studio' badge. Starter ($49/mo annual) drops the badge, gives you a custom domain, and unlocks 10 pages. Every paid tier comes with a 14-day Growth trial — try the Sales Console, microsites, AI outreach, and Salesforce sync before you commit. No card required to start.",
    cat: "Pricing",
  },
];

const CATEGORIES: Category[] = ["All", "Product", "Pricing", "Tech"];

export default function FAQ() {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState<number | null>(0);
  const [cat, setCat] = useState<Category>("All");

  const visible = useMemo(
    () => faqs.filter((f) => cat === "All" || f.cat === cat),
    [cat],
  );

  return (
    <section
      id="faq"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          left: "-12%",
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.08) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(6px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-3xl mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="mb-10">
          <div className="marker marker-rule mb-6">What people ask</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Short answers. No marketing fluff.
          </h2>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap mb-10">
          {CATEGORIES.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCat(c);
                  setOpen(0);
                }}
                className="text-[12.5px] px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: active ? "var(--ink)" : "var(--paper)",
                  color: active ? "var(--cream)" : "var(--ink-soft)",
                  border: `1px solid ${active ? "var(--ink)" : "var(--hairline-strong)"}`,
                  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  boxShadow: active
                    ? "0 4px 10px -4px rgba(26,24,21,0.25), inset 0 1px 0 rgba(255,255,255,0.12)"
                    : "inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                {c}
                <span
                  className="ml-1.5 text-[10px] uppercase"
                  style={{
                    color: active ? "rgba(244,239,227,0.65)" : "var(--ink-mute)",
                    letterSpacing: "0.12em",
                    fontWeight: 700,
                  }}
                >
                  {c === "All" ? faqs.length : faqs.filter((f) => f.cat === c).length}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -20px rgba(26,24,21,0.08)",
          }}
        >
          {visible.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full grid grid-cols-12 gap-3 items-center text-left py-5 px-5 transition-colors"
                  style={{ background: isOpen ? "rgba(75,71,229,0.04)" : "transparent" }}
                  onMouseEnter={(e) => {
                    if (!isOpen) e.currentTarget.style.background = "rgba(26,24,21,0.025)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    className="col-span-1 font-mono tabular-nums"
                    style={{
                      color: isOpen ? "var(--indigo)" : "var(--ink-mute)",
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      fontWeight: 600,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="col-span-10 flex items-center gap-2.5 flex-wrap">
                    <span
                      className="font-display"
                      style={{
                        color: "var(--ink)",
                        fontSize: 18,
                        lineHeight: 1.3,
                        fontWeight: 500,
                        letterSpacing: "-0.018em",
                      }}
                    >
                      {f.q}
                    </span>
                    <span
                      className="text-[10px] uppercase px-1.5 py-0.5 rounded-full"
                      style={{
                        background:
                          f.cat === "Product"
                            ? "var(--indigo-soft)"
                            : f.cat === "Pricing"
                              ? "var(--coral-soft)"
                              : "var(--sage-soft)",
                        color:
                          f.cat === "Product"
                            ? "var(--indigo)"
                            : f.cat === "Pricing"
                              ? "var(--coral)"
                              : "var(--sage)",
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                      }}
                    >
                      {f.cat}
                    </span>
                  </span>
                  <span
                    className="col-span-1 flex justify-end transition-transform"
                    style={{
                      color: isOpen ? "var(--indigo)" : "var(--ink-mute)",
                      transform: isOpen ? "rotate(45deg)" : "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all"
                  style={{ maxHeight: isOpen ? 600 : 0, opacity: isOpen ? 1 : 0 }}
                >
                  <div className="grid grid-cols-12 gap-3 px-5 pb-6">
                    <div className="col-span-1" />
                    <p
                      className="col-span-11 text-[15.5px] leading-[1.65]"
                      style={{ color: "var(--ink-soft)", maxWidth: 620 }}
                    >
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-[14.5px]" style={{ color: "var(--ink-soft)" }}>
          Still curious?{" "}
          <a
            href="#waitlist"
            className="underline underline-offset-4 transition-colors"
            style={{ color: "var(--indigo)", textDecorationColor: "rgba(75, 71, 229, 0.4)" }}
          >
            Get early access and we'll walk you through it live.
          </a>
        </p>
      </div>
    </section>
  );
}
