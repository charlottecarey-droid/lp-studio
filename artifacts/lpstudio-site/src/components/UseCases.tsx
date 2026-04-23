import { useInView } from "@/hooks/useInView";

const LIME = "#C7E738";

const cases = [
  {
    icon: "🎯",
    name: "ABM Sales",
    headline: "One page per account, in minutes.",
    body: "Spin up a personalized landing page for every target account. Pull the logo, swap the hero copy, drop in their case study. No marketing ticket required.",
    bullets: ["Personalize at the account level", "Embed in 1:1 outreach", "Track who viewed and for how long"],
  },
  {
    icon: "📣",
    name: "Demand Gen",
    headline: "Test five variants by Friday.",
    body: "Run paid traffic across A/B/C variants of headline, hero image, and CTA. LP Studio routes traffic to the winner automatically once significance is reached.",
    bullets: ["Built-in A/B testing", "Auto-significance detection", "Heatmaps and scroll depth out of the box"],
  },
  {
    icon: "🚀",
    name: "Product Launches",
    headline: "Brand-locked, marketer-fast.",
    body: "Brand tokens, blocks, and approvals are baked in. Anyone on the team can ship pages that look on-brand the first time. Designers stay in the loop only when they want to.",
    bullets: ["Brand tokens enforced at the block level", "Approval workflows when you need them", "Locked vs. editable regions"],
  },
  {
    icon: "🤝",
    name: "Customer Success",
    headline: "QBR pages, renewal pages, every time.",
    body: "Generate executive-ready landing pages for QBRs, expansions, and renewals. Pull in their data, their goals, their next milestones. Send a link, not a deck.",
    bullets: ["Pre-built QBR and renewal templates", "Auto-pull from your CRM", "Branded, shareable, trackable"],
  },
];

export default function UseCases() {
  const { ref, inView } = useInView();
  return (
    <section
      id="use-cases"
      className="px-6 py-20 md:py-28 relative"
      style={{ background: "#001512" }}
    >
      <div
        ref={ref}
        className="max-w-6xl mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(24px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{
              background: "rgba(199,231,56,0.08)",
              color: LIME,
              border: "1px solid rgba(199,231,56,0.18)",
            }}
          >
            Built for the whole revenue org
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Pages for <span style={{ color: LIME }}>every play.</span>
          </h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Sales, demand gen, launches, success. One builder, every motion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cases.map((c, i) => (
            <div
              key={c.name}
              className="rounded-2xl p-7 relative overflow-hidden group transition-all"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                transitionDelay: `${i * 80}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(199,231,56,0.04)";
                e.currentTarget.style.borderColor = "rgba(199,231,56,0.2)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(199,231,56,0.12) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background: "rgba(199,231,56,0.12)" }}
                  >
                    {c.icon}
                  </div>
                  <div
                    className="text-xs uppercase tracking-widest font-semibold"
                    style={{ color: LIME }}
                  >
                    {c.name}
                  </div>
                </div>
                <h3
                  className="text-2xl font-bold mb-3 text-white"
                  style={{ fontFamily: "Outfit, sans-serif" }}
                >
                  {c.headline}
                </h3>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  {c.body}
                </p>
                <ul className="space-y-2">
                  {c.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-sm"
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
                        style={{ background: "rgba(199,231,56,0.18)", color: LIME }}
                      >
                        ✓
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
