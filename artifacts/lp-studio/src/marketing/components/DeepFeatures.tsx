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
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Soft accent orb at the section's top */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          right: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(6px)",
        }}
      />

      <div className="max-w-[1180px] mx-auto relative">
        <div className="max-w-3xl mb-20 md:mb-24">
          <div className="flex items-center gap-3 mb-6">
            <span
              aria-hidden
              style={{
                width: 36,
                height: 1,
                background: "var(--ink-faint)",
              }}
            />
            <span
              className="font-mono uppercase"
              style={{
                color: "var(--ink-soft)",
                fontSize: 11,
                letterSpacing: "0.22em",
                fontWeight: 600,
              }}
            >
              What's inside
            </span>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: INDIGO,
                boxShadow: `0 0 8px color-mix(in srgb, ${INDIGO} 60%, transparent)`,
              }}
            />
          </div>
          <h2
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(46px, 5.4vw, 68px)",
              fontWeight: 500,
              letterSpacing: "-0.034em",
              lineHeight: 1.02,
            }}
          >
            Every part of the page,{" "}
            <span style={{ color: INDIGO, fontStyle: "italic" }}>solved</span>.
          </h2>
          <p className="mt-6 text-[17px] leading-[1.55]" style={{ color: "var(--ink-soft)", maxWidth: 580 }}>
            From copy to conversion. Three things LP Studio does that the cobbled-together stack can't.
          </p>
        </div>

        {/* Connecting spine on the left, behind the feature stack */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute hidden md:block pointer-events-none"
            style={{
              left: -4,
              top: 0,
              bottom: 0,
              width: 1,
              background:
                "linear-gradient(180deg, rgba(26,24,21,0) 0%, rgba(26,24,21,0.18) 8%, rgba(26,24,21,0.18) 92%, rgba(26,24,21,0) 100%)",
            }}
          />

          <div className="space-y-32 md:space-y-40">
            {features.map((f, i) => (
              <FeatureRow key={i} feature={f} index={i} total={features.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature, index, total }: { feature: Feature; index: number; total: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const textCol = (
    <div className="relative">
      {/* Big spine marker */}
      <div
        aria-hidden
        className="absolute hidden md:flex items-center justify-center"
        style={{
          left: -22,
          top: 4,
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${INDIGO} 0%, color-mix(in srgb, ${INDIGO} 60%, #000) 100%)`,
          color: "#FFFFFF",
          boxShadow: `0 6px 16px -6px color-mix(in srgb, ${INDIGO} 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "-0.005em",
          }}
        >
          {feature.marker}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-5 md:pl-5">
        <span
          className="font-mono uppercase md:hidden"
          style={{ color: INDIGO, fontSize: 11, letterSpacing: "0.18em", fontWeight: 700 }}
        >
          {feature.marker}
        </span>
        <span
          className="font-mono uppercase inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{
            color: INDIGO,
            background: "rgba(75,71,229,0.08)",
            border: "1px solid rgba(75,71,229,0.18)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: INDIGO,
              boxShadow: `0 0 5px ${INDIGO}`,
            }}
          />
          {feature.eyebrow}
        </span>
      </div>
      <h3
        className="font-display md:pl-5"
        style={{
          color: "var(--ink)",
          fontSize: "clamp(28px, 3.4vw, 42px)",
          lineHeight: 1.06,
          fontWeight: 500,
          letterSpacing: "-0.024em",
        }}
      >
        {feature.title}
      </h3>
      <p
        className="mt-6 text-[16px] leading-[1.6] md:pl-5"
        style={{ color: "var(--ink-soft)", maxWidth: 520 }}
      >
        {feature.body}
      </p>
      <ul className="mt-7 space-y-3 md:pl-5">
        {feature.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[14.5px]" style={{ color: "var(--ink-2)" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={INDIGO}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 4, flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M5 12.5L10 17.5L20 7.5"/>
            </svg>
            {b}
          </li>
        ))}
      </ul>

      {/* Step indicator */}
      <div className="mt-8 md:pl-5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: 999,
              background: i === index ? `linear-gradient(90deg, ${INDIGO} 0%, #6C68F0 100%)` : "rgba(26,24,21,0.18)",
              transition: "width 240ms ease",
            }}
          />
        ))}
        <span className="ml-2 text-[11px] uppercase" style={{ color: "var(--ink-mute)", letterSpacing: "0.18em", fontWeight: 600 }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center relative"
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
