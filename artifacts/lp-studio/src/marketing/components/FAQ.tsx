import { useState } from "react";
import { useInView } from "../hooks/useInView";

const faqs = [
  {
    q: "How fast can my team actually launch a page?",
    a: "Most teams ship their first real page within an hour of getting access. Pick a template, let AI fill the copy, swap in your brand assets, publish. No code, no design ticket, no waiting on marketing.",
  },
  {
    q: "Do I need design or eng help to use this?",
    a: "No. Brand tokens and approved blocks are baked in by your design team once, and after that anyone on the team can ship on-brand pages. If you want to customize, the builder has a properties panel — and devs can extend the block library with custom React components.",
  },
  {
    q: "How does A/B testing work?",
    a: "Create variants right in the editor, set your winning metric (clicks, signups, booked meetings), and split traffic. We detect significance automatically and Smart Traffic routes the majority of visitors to the winning variant once it's clear.",
  },
  {
    q: "Where does the page actually live?",
    a: "On a fast, globally cached domain we host for you, or on your own subdomain if you bring DNS. Pages are statically rendered and load in under a second. SSL is handled.",
  },
  {
    q: "What about analytics and tracking?",
    a: "Built in: visitors, conversions, scroll depth, click maps, heatmaps, and per-variant performance. We also push events to GA4, Segment, and your CRM — so the data flows where your revenue team already looks.",
  },
  {
    q: "How is this different from Webflow or Unbounce?",
    a: "Webflow is a designer's tool — powerful but slow when you need 50 ABM pages. Unbounce is built around templates but lacks brand-system enforcement and AI copy. LP Studio is built for revenue teams that need to ship a lot of personalized, on-brand pages, fast.",
  },
];

export default function FAQ() {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="px-6 py-28 md:py-36"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      <div
        ref={ref}
        className="max-w-3xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="mb-14">
          <div className="marker marker-rule mb-6">Common questions</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Short answers, before you sign up.
          </h2>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)" }}>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left transition-colors"
                >
                  <span
                    className="font-display"
                    style={{
                      color: "var(--ink)",
                      fontSize: 19,
                      lineHeight: 1.25,
                      fontWeight: 500,
                      letterSpacing: "-0.018em",
                    }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="flex-shrink-0 transition-transform"
                    style={{
                      color: "var(--ink-mute)",
                      transform: isOpen ? "rotate(45deg)" : "none",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all"
                  style={{ maxHeight: isOpen ? 400 : 0, opacity: isOpen ? 1 : 0 }}
                >
                  <p className="pb-7 pr-10 text-[15.5px] leading-[1.65]" style={{ color: "var(--ink-soft)" }}>
                    {f.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-12 text-[14.5px]" style={{ color: "var(--ink-soft)" }}>
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
