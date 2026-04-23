import { useState } from "react";
import { useInView } from "@/hooks/useInView";

const LIME = "#C7E738";

const faqs = [
  {
    q: "How fast can my team actually launch a page?",
    a: "Most teams ship their first real page within an hour of getting access. Pick a template, let AI fill the copy, swap in your brand assets, and publish. No code, no design ticket, no waiting on marketing.",
  },
  {
    q: "Do I need design or eng help to use this?",
    a: "No. Brand tokens and approved blocks are baked in by your design team once, and after that anyone on the team can ship on-brand pages. If you do want to customize a block, the builder has a properties panel — and devs can extend the block library with custom React components.",
  },
  {
    q: "How does A/B testing work?",
    a: "Create variants right in the editor, set your winning metric (clicks, signups, booked meetings), and split traffic. LP Studio detects significance automatically and Smart Traffic routes the majority of visitors to the winning variant once it's clear.",
  },
  {
    q: "Where does the page actually live?",
    a: "On a fast, globally cached domain we host for you, or on your own subdomain if you bring DNS. Pages are static-rendered and load in under a second. SSL is handled.",
  },
  {
    q: "What about analytics and tracking?",
    a: "Built-in: visitors, conversions, scroll depth, click maps, heatmaps, and per-variant performance. We also push events to GA4, Segment, and your CRM — so the data flows where your revenue team already looks.",
  },
  {
    q: "How is this different from Webflow or Unbounce?",
    a: "Webflow is a designer's tool — powerful but slow when you need 50 ABM pages. Unbounce is built around templates but lacks brand-system enforcement and AI copy. LP Studio is built for revenue teams that need to ship a lot of personalized, on-brand pages fast.",
  },
];

export default function FAQ() {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      className="px-6 py-20 md:py-28 relative"
      style={{ background: "#000" }}
    >
      <div
        ref={ref}
        className="max-w-3xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{
              background: "rgba(199,231,56,0.08)",
              color: LIME,
              border: "1px solid rgba(199,231,56,0.18)",
            }}
          >
            Common questions
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            The <span style={{ color: LIME }}>short answers.</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: isOpen
                    ? "rgba(199,231,56,0.04)"
                    : "rgba(255,255,255,0.03)",
                  border: isOpen
                    ? "1px solid rgba(199,231,56,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
                  style={{ color: "#fff" }}
                >
                  <span
                    className="text-base md:text-lg font-semibold"
                    style={{ fontFamily: "Outfit, sans-serif" }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-transform"
                    style={{
                      background: isOpen ? LIME : "rgba(255,255,255,0.06)",
                      color: isOpen ? "#003A30" : "rgba(255,255,255,0.5)",
                      transform: isOpen ? "rotate(45deg)" : "none",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all"
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p
                    className="px-5 pb-5 text-sm md:text-base leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {f.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-12 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Still curious?{" "}
          <a
            href="#waitlist"
            className="font-semibold underline underline-offset-4 transition-colors"
            style={{ color: LIME }}
          >
            Get early access and we'll show you a live walkthrough.
          </a>
        </div>
      </div>
    </section>
  );
}
