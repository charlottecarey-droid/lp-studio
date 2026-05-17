import { useInView } from "../hooks/useInView";

// Marketing section is cream/ink; the product mockup cards stay in the app's
// dark mode so they read as actual screenshots of the product, not generic
// chrome. Indigo is the only chromatic accent — matches the app's primary.
const INDIGO = "#4B47E5";
const CARD_BG = "#15130F";
const CARD_INNER = "#1F1C17";
const CARD_TEXT = "#F4EFE3";
const CARD_MUTED = "rgba(244, 239, 227, 0.55)";
const CARD_FAINT = "rgba(244, 239, 227, 0.32)";
const CARD_HAIRLINE = "rgba(244, 239, 227, 0.08)";

interface Feature {
  marker: string;
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
      className="p-5 relative overflow-hidden"
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_HAIRLINE}`,
        borderRadius: 10,
        boxShadow:
          "0 1px 0 rgba(244,239,227,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.45), 0 4px 12px -4px rgba(0,0,0,0.25)",
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CARD_TEXT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
        </svg>
        <div className="text-[12px] font-medium" style={{ color: CARD_TEXT }}>AI Copy</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: CARD_FAINT }}>
          <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: INDIGO }} />
          generating
        </div>
      </div>
      <div className="font-mono uppercase mb-1.5" style={{ color: CARD_FAINT, fontSize: 10, letterSpacing: "0.18em" }}>
        Brief
      </div>
      <div
        className="px-3 py-2.5 mb-4 text-[12.5px] leading-relaxed"
        style={{
          background: CARD_INNER,
          color: "rgba(244,239,227,0.8)",
          border: `1px solid ${CARD_HAIRLINE}`,
          borderRadius: 6,
        }}
      >
        Hero for ABM page targeting Acme Co — VP of Eng, payments infra.
      </div>
      <div className="font-mono uppercase mb-1.5" style={{ color: CARD_FAINT, fontSize: 10, letterSpacing: "0.18em" }}>
        Headlines
      </div>
      {[
        "Acme — ship payment infra without the headcount.",
        "Acme's payments team, supercharged.",
        "Built for Acme's next 10× in volume.",
      ].map((h, i) => (
        <div
          key={h}
          className="px-3 py-2.5 mb-1.5 text-[13px] flex items-center justify-between"
          style={{
            background: i === 1 ? "rgba(75,71,229,0.14)" : CARD_INNER,
            border: i === 1 ? `1px solid rgba(75,71,229,0.4)` : `1px solid ${CARD_HAIRLINE}`,
            color: i === 1 ? CARD_TEXT : CARD_MUTED,
            borderRadius: 6,
          }}
        >
          <span style={{ letterSpacing: "-0.005em" }}>{h}</span>
          {i === 1 && (
            <span className="font-mono uppercase" style={{ color: "#A6A3F5", fontSize: 9, letterSpacing: "0.14em" }}>
              Selected
            </span>
          )}
        </div>
      ))}
      <button
        className="mt-3 w-full text-[12px] font-medium py-2 transition-colors"
        style={{
          background: CARD_INNER,
          color: CARD_MUTED,
          border: `1px solid ${CARD_HAIRLINE}`,
          borderRadius: 6,
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CARD_TEXT} strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" fill={CARD_TEXT} />
        </svg>
        <div className="text-[12px] font-medium" style={{ color: CARD_TEXT }}>Brand system</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: CARD_FAINT }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          locked
        </div>
      </div>

      <div className="font-mono uppercase mb-2" style={{ color: CARD_FAINT, fontSize: 10, letterSpacing: "0.18em" }}>
        Color
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-5">
        {[
          { hex: "#F6F2E9", label: "cream" },
          { hex: INDIGO, label: "accent" },
          { hex: "#1A1815", label: "ink" },
          { hex: "#E26B4F", label: "coral" },
          { hex: "#5C5853", label: "muted" },
        ].map((c) => (
          <div key={c.label}>
            <div
              className="w-full aspect-square mb-1.5"
              style={{ background: c.hex, border: `1px solid ${CARD_HAIRLINE}`, borderRadius: 5 }}
            />
            <div className="font-mono uppercase" style={{ color: CARD_FAINT, fontSize: 9, letterSpacing: "0.1em" }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div className="font-mono uppercase mb-2" style={{ color: CARD_FAINT, fontSize: 10, letterSpacing: "0.18em" }}>
        Type
      </div>
      <div className="space-y-1 mb-1">
        <div className="font-display" style={{ color: CARD_TEXT, fontSize: 22, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.022em" }}>
          Display — DM Sans
        </div>
        <div className="text-[13px]" style={{ color: "rgba(244,239,227,0.7)" }}>
          Body — Inter
        </div>
        <div className="font-mono uppercase mt-0.5" style={{ color: "#A6A3F5", fontSize: 11, letterSpacing: "0.16em" }}>
          accent — indigo
        </div>
      </div>
    </Card>
  );
}

function ABTestVisual() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CARD_TEXT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m13 2-3 7h5l-3 7" />
        </svg>
        <div className="text-[12px] font-medium" style={{ color: CARD_TEXT }}>Test</div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "#A6A3F5" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INDIGO }} />
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
          className="mb-2 p-3"
          style={{
            background: v.winning ? "rgba(75,71,229,0.10)" : CARD_INNER,
            border: v.winning ? `1px solid rgba(75,71,229,0.35)` : `1px solid ${CARD_HAIRLINE}`,
            borderRadius: 6,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium" style={{ color: v.winning ? CARD_TEXT : "rgba(244,239,227,0.85)" }}>
                {v.name}
              </span>
              {v.winning && (
                <span className="font-mono uppercase" style={{ color: "#A6A3F5", fontSize: 9, letterSpacing: "0.14em" }}>
                  winner
                </span>
              )}
            </div>
            <span
              className="font-display tabular-nums"
              style={{ color: v.winning ? CARD_TEXT : CARD_MUTED, fontSize: 16, fontWeight: 500, letterSpacing: "-0.018em" }}
            >
              {v.conv}
            </span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(244,239,227,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${v.traffic + 20}%`,
                background: v.winning ? INDIGO : "rgba(244,239,227,0.25)",
              }}
            />
          </div>
        </div>
      ))}

      <div
        className="mt-4 px-3 py-2.5 text-[11.5px] flex items-center gap-2"
        style={{
          background: "rgba(75,71,229,0.08)",
          border: `1px solid rgba(75,71,229,0.22)`,
          color: "rgba(244,239,227,0.85)",
          borderRadius: 6,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INDIGO} strokeWidth="2" strokeLinecap="round">
          <path d="M3 12h18M12 3l9 9-9 9" />
        </svg>
        Smart Traffic now routing 78% to <span style={{ color: "#A6A3F5" }}>Bold CTA</span>.
      </div>
    </Card>
  );
}

const features: Feature[] = [
  {
    marker: "01",
    eyebrow: "Voice-tuned AI",
    title: "Copy that sounds like you wrote it.",
    body:
      "Trained on your voice, your wins, and your category. Generate variants in seconds and refine in place. Every prompt remembers your tone, your offer, and what has converted before.",
    bullets: [
      "Voice tuning from your existing pages",
      "Variant generation one click deep",
      "Account, persona, and stage-aware prompts",
    ],
    visual: <AICopyVisual />,
    side: "right",
  },
  {
    marker: "02",
    eyebrow: "Brand-locked, always",
    title: "Tokens enforce the brand. Blocks enforce the taste.",
    body:
      "Color, type, spacing, radius — locked at the system level. Anyone on your team ships pages that look like yours on the first try. No rogue hex codes, no 14 button styles.",
    bullets: [
      "One source of truth for color, type, spacing",
      "Block library with approved variations only",
      "Locked vs editable regions per template",
    ],
    visual: <BrandTokensVisual />,
    side: "left",
  },
  {
    marker: "03",
    eyebrow: "Test, learn, automate",
    title: "A/B testing built for revenue, not engineers.",
    body:
      "Spin up variants in the editor. We split traffic, watch significance, and route visitors to the winning variant the moment it lands. Heatmaps and scroll depth come in the box.",
    bullets: [
      "Auto-significance — no stats degree needed",
      "Smart Traffic routes to the winner",
      "Heatmaps, scroll depth, click maps included",
    ],
    visual: <ABTestVisual />,
    side: "right",
  },
];

export default function DeepFeatures() {
  return (
    <section
      id="features"
      className="px-6 py-28 md:py-36"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      <div className="max-w-[1180px] mx-auto">
        <div className="max-w-2xl mb-24 md:mb-28">
          <div className="marker marker-rule mb-6">What's inside</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Every part of the page, solved.
          </h2>
          <p className="mt-6 text-[17px] leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
            From copy to conversion. Three things LP Studio does that the cobbled-together stack can't.
          </p>
        </div>

        <div className="space-y-32 md:space-y-40">
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
      <div className="flex items-baseline gap-4 mb-5">
        <span className="font-mono" style={{ color: "var(--ink-mute)", fontSize: 12, letterSpacing: "0.04em" }}>
          {feature.marker}
        </span>
        <span className="font-mono uppercase" style={{ color: "var(--ink-soft)", fontSize: 11, letterSpacing: "0.18em" }}>
          {feature.eyebrow}
        </span>
      </div>
      <h3 className="font-display" style={{ color: "var(--ink)", fontSize: "clamp(28px, 3.2vw, 38px)", lineHeight: 1.08, fontWeight: 500, letterSpacing: "-0.022em" }}>
        {feature.title}
      </h3>
      <p className="mt-6 text-[16px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
        {feature.body}
      </p>
      <ul className="mt-7 space-y-3">
        {feature.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[14.5px]" style={{ color: "var(--ink-2)" }}>
            <span
              aria-hidden
              style={{
                width: 16,
                height: 1,
                background: "var(--ink-faint)",
                display: "inline-block",
                marginTop: 11,
                flexShrink: 0,
              }}
            />
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
