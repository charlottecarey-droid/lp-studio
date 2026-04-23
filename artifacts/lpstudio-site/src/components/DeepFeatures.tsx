import { useInView } from "@/hooks/useInView";

const LIME = "#D4F542";

interface Feature {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  side: "left" | "right";
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden"
      style={{
        background: "#101010",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -20px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
}

function AICopyVisual() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
          <path d="M19 16v3M21 17.5h-3M5 17v2M6 18H4" />
        </svg>
        <div className="text-[12px] font-medium text-white">AI Copy</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(250,250,250,0.45)" }}>
          <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: LIME }} />
          generating
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] mb-1.5" style={{ color: "rgba(250,250,250,0.35)" }}>
        Brief
      </div>
      <div
        className="rounded-md px-3 py-2 mb-4 text-[12.5px] leading-relaxed"
        style={{ background: "rgba(255,255,255,0.03)", color: "rgba(250,250,250,0.8)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        Hero for ABM page targeting Acme Co — VP of Eng, payments infra.
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] mb-1.5" style={{ color: "rgba(250,250,250,0.35)" }}>
        Headlines
      </div>
      {[
        "Acme — ship payment infra without the headcount.",
        "Acme's payments team, supercharged.",
        "Built for Acme's next 10× in volume.",
      ].map((h, i) => (
        <div
          key={h}
          className="rounded-md px-3 py-2.5 mb-1.5 text-[13px] flex items-center justify-between"
          style={{
            background: i === 1 ? "rgba(212,245,66,0.08)" : "rgba(255,255,255,0.025)",
            border: i === 1 ? "1px solid rgba(212,245,66,0.32)" : "1px solid rgba(255,255,255,0.05)",
            color: i === 1 ? "#FAFAFA" : "rgba(250,250,250,0.65)",
          }}
        >
          <span className="font-display" style={{ letterSpacing: "-0.01em" }}>
            {h}
          </span>
          {i === 1 && (
            <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: LIME }}>
              Selected
            </span>
          )}
        </div>
      ))}
      <button
        className="mt-3 w-full text-[12px] font-medium py-2 rounded-md transition-colors"
        style={{
          background: "rgba(255,255,255,0.025)",
          color: "rgba(250,250,250,0.55)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        Regenerate three more
      </button>
    </Card>
  );
}

function BrandTokensVisual() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" fill="#FAFAFA" />
        </svg>
        <div className="text-[12px] font-medium text-white">Brand system</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(250,250,250,0.45)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          locked
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(250,250,250,0.35)" }}>
        Color
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-5">
        {[
          { hex: "#0A2A22", label: "ink" },
          { hex: LIME, label: "accent" },
          { hex: "#1F4F42", label: "deep" },
          { hex: "#FAFAF7", label: "paper" },
          { hex: "#171717", label: "shadow" },
        ].map((c) => (
          <div key={c.label}>
            <div
              className="w-full aspect-square rounded-md mb-1.5"
              style={{ background: c.hex, border: "1px solid rgba(255,255,255,0.06)" }}
            />
            <div className="text-[9px]" style={{ color: "rgba(250,250,250,0.4)" }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(250,250,250,0.35)" }}>
        Type
      </div>
      <div className="space-y-1 mb-1">
        <div className="font-display text-[22px] font-semibold leading-none text-white" style={{ letterSpacing: "-0.03em" }}>
          Display — Inter Tight
        </div>
        <div className="text-[13px]" style={{ color: "rgba(250,250,250,0.65)" }}>
          Body — Inter
        </div>
        <div className="font-serif-italic text-[15px] mt-0.5" style={{ color: LIME }}>
          accent — Instrument Serif
        </div>
      </div>
    </Card>
  );
}

function ABTestVisual() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m13 2-3 7h5l-3 7" />
        </svg>
        <div className="text-[12px] font-medium text-white">Experiment</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: LIME }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: LIME }} />
          live · day 3
        </div>
      </div>

      {[
        { name: "Original", traffic: 24, conv: "3.2%", winning: false },
        { name: "Bold CTA", traffic: 56, conv: "5.8%", winning: true },
        { name: "Image hero", traffic: 20, conv: "2.9%", winning: false },
      ].map((v) => (
        <div
          key={v.name}
          className="mb-2 rounded-md p-3"
          style={{
            background: v.winning ? "rgba(212,245,66,0.06)" : "rgba(255,255,255,0.025)",
            border: v.winning ? "1px solid rgba(212,245,66,0.28)" : "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium" style={{ color: v.winning ? "#FAFAFA" : "rgba(250,250,250,0.85)" }}>
                {v.name}
              </span>
              {v.winning && (
                <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: LIME }}>
                  winner
                </span>
              )}
            </div>
            <span
              className="font-display text-[14px] font-semibold tabular-nums"
              style={{ color: v.winning ? "#FAFAFA" : "rgba(250,250,250,0.65)", letterSpacing: "-0.02em" }}
            >
              {v.conv}
            </span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${v.traffic + 20}%`,
                background: v.winning ? LIME : "rgba(255,255,255,0.25)",
              }}
            />
          </div>
        </div>
      ))}

      <div
        className="mt-4 rounded-md px-3 py-2.5 text-[11.5px] flex items-center gap-2"
        style={{ background: "rgba(212,245,66,0.05)", border: "1px solid rgba(212,245,66,0.18)", color: "rgba(250,250,250,0.85)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth="2" strokeLinecap="round">
          <path d="M3 12h18M12 3l9 9-9 9" />
        </svg>
        Smart Traffic now routing 78% to <span style={{ color: LIME }}>Bold CTA</span>.
      </div>
    </Card>
  );
}

const features: Feature[] = [
  {
    eyebrow: "Voice-tuned AI",
    title: (
      <>
        Copy that sounds like <span className="font-serif-italic" style={{ color: LIME }}>you</span>, not the AI.
      </>
    ),
    body:
      "Trained on your voice, your wins, and your category. Generate variants in seconds and refine in place. Every prompt remembers your tone, your offer, and what's converted before.",
    bullets: ["Voice tuning from your existing pages", "Variant generation one click deep", "Account, persona, and stage-aware prompts"],
    visual: <AICopyVisual />,
    side: "right",
  },
  {
    eyebrow: "Brand-locked, always",
    title: (
      <>
        Tokens enforce the brand. Blocks enforce the <span className="font-serif-italic" style={{ color: LIME }}>taste</span>.
      </>
    ),
    body:
      "Color, type, spacing, radius — locked at the system level. Anyone in your team ships pages that look like yours on the first try. No more rogue hex codes, no more 14 button styles.",
    bullets: ["One source of truth for color, type, spacing", "Block library with approved variations only", "Locked vs. editable regions per template"],
    visual: <BrandTokensVisual />,
    side: "left",
  },
  {
    eyebrow: "Test, learn, automate",
    title: (
      <>
        A/B testing built for revenue, not <span className="font-serif-italic" style={{ color: LIME }}>engineers</span>.
      </>
    ),
    body:
      "Spin up variants in the editor. We split traffic, watch significance, and route visitors to the winning variant the moment it's clear. Heatmaps and scroll depth come in the box.",
    bullets: ["Auto-significance — no stats degree needed", "Smart Traffic routes to the winner", "Heatmaps, scroll depth, click maps included"],
    visual: <ABTestVisual />,
    side: "right",
  },
];

export default function DeepFeatures() {
  return (
    <section id="features" className="px-6 py-24 md:py-32" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-20 md:mb-24">
          <div className="eyebrow mb-5">What's inside</div>
          <h2 className="font-display text-4xl md:text-[44px] leading-[1.05] font-semibold text-white">
            Every part of the page, <span className="font-serif-italic" style={{ color: LIME }}>solved</span>.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed" style={{ color: "rgba(250,250,250,0.55)" }}>
            From copy to conversion. Three things LP Studio does that the cobbled-together stack can't.
          </p>
        </div>

        <div className="space-y-28 md:space-y-36">
          {features.map((f, i) => (
            <FeatureRow key={i} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature }: { feature: Feature }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const textCol = (
    <div>
      <div className="eyebrow mb-4">{feature.eyebrow}</div>
      <h3 className="font-display text-3xl md:text-[36px] font-semibold text-white leading-[1.1]">
        {feature.title}
      </h3>
      <p className="mt-5 text-[16px] leading-relaxed" style={{ color: "rgba(250,250,250,0.6)" }}>
        {feature.body}
      </p>
      <ul className="mt-7 space-y-3">
        {feature.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[14.5px]" style={{ color: "rgba(250,250,250,0.78)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1.5 flex-shrink-0">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : "translateY(28px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      {feature.side === "left" ? (
        <>
          <div className="order-2 md:order-1">{feature.visual}</div>
          <div className="order-1 md:order-2">{textCol}</div>
        </>
      ) : (
        <>
          {textCol}
          {feature.visual}
        </>
      )}
    </div>
  );
}
