import { useInView } from "@/hooks/useInView";

type IconProps = { className?: string };
const Crosshair = ({ className }: IconProps) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);
const Megaphone = ({ className }: IconProps) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z" />
    <path d="M16 8a5 5 0 0 1 0 8" />
  </svg>
);
const Rocket = ({ className }: IconProps) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 14c-3 0-6 2-6 6 4 0 6-3 6-6Z" />
    <path d="M14.5 4.5a8.5 8.5 0 0 0-7 4l4 4a8.5 8.5 0 0 0 4-7c0-.4-.3-.8-.7-1Z" />
    <path d="M14 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  </svg>
);
const Handshake = ({ className }: IconProps) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11 17 9 19a2 2 0 0 1-3-3l3-3" />
    <path d="m22 8-3-3-7 7 3 3 7-7Z" />
    <path d="M2 16 5 13l3 3-3 3a2 2 0 0 1-3-3Z" />
    <path d="M14 14 9 9" />
  </svg>
);

const cases = [
  {
    Icon: Crosshair,
    name: "ABM Sales",
    headline: "One page per account.",
    body: "Spin up a personalized landing page for every target account. Pull the logo, swap the hero copy, drop in their case study. No marketing ticket required.",
    bullets: ["Personalize at the account level", "Embed in 1:1 outreach", "See who viewed and for how long"],
  },
  {
    Icon: Megaphone,
    name: "Demand Gen",
    headline: "Test five variants by Friday.",
    body: "Run paid traffic across A/B/C variants of headline, hero, and CTA. Smart Traffic routes to the winner once significance is reached.",
    bullets: ["Built-in A/B testing", "Auto-significance detection", "Heatmaps and scroll depth, included"],
  },
  {
    Icon: Rocket,
    name: "Product Launches",
    headline: "Brand-locked, marketer-fast.",
    body: "Brand tokens, blocks, and approvals are baked in. Anyone can ship pages that look on-brand the first time. Designers stay in the loop only when they want to.",
    bullets: ["Tokens enforced at the block level", "Approval workflows when you need them", "Locked vs. editable regions"],
  },
  {
    Icon: Handshake,
    name: "Customer Success",
    headline: "QBRs and renewals, repeatable.",
    body: "Generate executive-ready landing pages for QBRs, expansions, and renewals. Pull in their data, their goals, their next milestones. Send a link, not a deck.",
    bullets: ["Pre-built QBR and renewal templates", "Auto-pull from your CRM", "Branded, shareable, trackable"],
  },
];

export default function UseCases() {
  const { ref, inView } = useInView();
  return (
    <section id="use-cases" className="px-6 py-24 md:py-32" style={{ background: "#0A0A0A" }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="max-w-2xl mb-16">
          <div className="eyebrow mb-5">For the whole revenue org</div>
          <h2 className="font-display text-4xl md:text-[44px] leading-[1.05] font-semibold text-white">
            Pages for every <span className="font-serif-italic" style={{ color: "#D4F542" }}>play</span>.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed" style={{ color: "rgba(250,250,250,0.55)" }}>
            Sales, demand gen, launches, success — one builder, every motion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
          {cases.map((c) => (
            <div
              key={c.name}
              className="p-8 md:p-10 transition-colors"
              style={{ background: "#0A0A0A" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#0F0F0F")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#0A0A0A")}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(212,245,66,0.08)", color: "#D4F542", border: "1px solid rgba(212,245,66,0.2)" }}
                >
                  <c.Icon />
                </div>
                <div className="eyebrow">{c.name}</div>
              </div>
              <h3 className="font-display text-2xl md:text-[26px] font-semibold mb-3 text-white leading-tight">
                {c.headline}
              </h3>
              <p className="text-[14.5px] leading-relaxed mb-6" style={{ color: "rgba(250,250,250,0.55)" }}>
                {c.body}
              </p>
              <ul className="space-y-2.5">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[13.5px]" style={{ color: "rgba(250,250,250,0.7)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4F542" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
