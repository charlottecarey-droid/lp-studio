import { useState } from "react";
import { useInView } from "../hooks/useInView";

const faqs = [
  {
    q: "How fast can my team actually launch a page?",
    a: "Most teams ship their first real page within an hour of getting access. Pick a template, let AI fill the copy, swap in your brand assets, and publish. No code, no design ticket, no waiting on marketing.",
  },
  {
    q: "Do I need design or eng help to use this?",
    a: "No. Brand tokens and approved blocks are baked in by your design team once, and after that anyone on the team can ship on-brand pages. If you do want to customize, the builder has a properties panel — and devs can extend the block library with custom React components.",
  },
  {
    q: "How does A/B testing work?",
    a: "Create variants right in the editor, set your winning metric (clicks, signups, booked meetings), and split traffic. We detect significance automatically and Smart Traffic routes the majority of visitors to the winning variant once it's clear.",
  },
  {
    q: "Where does the page actually live?",
    a: "On a fast, globally cached domain we host for you, or on your own subdomain if you bring DNS. Pages are static-rendered and load in under a second. SSL is handled.",
  },
  {
    q: "What about analytics and tracking?",
    a: "Built in: visitors, conversions, scroll depth, click maps, heatmaps, and per-variant performance. We also push events to GA4, Segment, and your CRM — so the data flows where your revenue team already looks.",
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
    <section id="faq" className="px-6 py-24 md:py-32" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div
        ref={ref}
        className="max-w-3xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(16px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="mb-12">
          <div className="eyebrow mb-5">Common questions</div>
          <h2 className="font-display text-4xl md:text-[44px] leading-[1.05] font-semibold text-white">
            The <span className="" style={{ color: "#D4F542" }}>short answers</span>.
          </h2>
        </div>

        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left transition-colors group"
                >
                  <span
                    className="font-display text-[17px] md:text-[18px] font-medium"
                    style={{ color: isOpen ? "#FAFAFA" : "rgba(250,250,250,0.85)" }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="flex-shrink-0 transition-transform"
                    style={{
                      color: "rgba(250,250,250,0.5)",
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
                  <p className="pb-6 pr-10 text-[15px] leading-relaxed" style={{ color: "rgba(250,250,250,0.6)" }}>
                    {f.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-[14px]" style={{ color: "rgba(250,250,250,0.45)" }}>
          Still curious?{" "}
          <a href="#waitlist" className="underline underline-offset-4 transition-colors" style={{ color: "#D4F542" }}>
            Get early access and we'll show you a live walkthrough.
          </a>
        </p>
      </div>
    </section>
  );
}
