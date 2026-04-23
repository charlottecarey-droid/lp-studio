import { useInView } from "@/hooks/useInView";

const LIME = "#C7E738";
const FOREST = "#003A30";
const FOREST_DEEP = "#001F18";

interface Feature {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  side: "left" | "right";
}

function AICopyVisual() {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: FOREST_DEEP,
        border: "1px solid rgba(199,231,56,0.18)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: LIME, color: FOREST }}
        >
          ✦
        </div>
        <div className="text-xs font-semibold text-white">AI Copy Assistant</div>
        <div
          className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold"
          style={{ background: "rgba(199,231,56,0.15)", color: LIME }}
        >
          GENERATING
        </div>
      </div>
      <div
        className="text-[10px] uppercase tracking-widest mb-1.5"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Prompt
      </div>
      <div
        className="rounded-lg px-3 py-2 mb-3 text-xs"
        style={{
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        Hero for ABM page targeting Acme Co. — VP of Eng, payments
        infrastructure.
      </div>
      <div
        className="text-[10px] uppercase tracking-widest mb-1.5"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Generated headline
      </div>
      {[
        "Acme — ship payment infra without the headcount.",
        "Acme's payments team, supercharged.",
        "Built for Acme's next 10× in payments volume.",
      ].map((h, i) => (
        <div
          key={h}
          className="rounded-lg px-3 py-2.5 mb-1.5 text-sm flex items-center justify-between transition-all cursor-pointer"
          style={{
            background:
              i === 1 ? "rgba(199,231,56,0.12)" : "rgba(255,255,255,0.04)",
            border:
              i === 1
                ? "1px solid rgba(199,231,56,0.4)"
                : "1px solid rgba(255,255,255,0.08)",
            color: i === 1 ? "#fff" : "rgba(255,255,255,0.7)",
          }}
        >
          <span style={{ fontFamily: "Outfit, sans-serif", fontWeight: 600 }}>
            {h}
          </span>
          {i === 1 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: LIME, color: FOREST }}
            >
              USE
            </span>
          )}
        </div>
      ))}
      <button
        className="mt-3 w-full text-xs font-semibold py-2 rounded-lg"
        style={{
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        ↻ Regenerate three more
      </button>
    </div>
  );
}

function BrandTokensVisual() {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: FOREST_DEEP,
        border: "1px solid rgba(199,231,56,0.18)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: LIME, color: FOREST }}
        >
          ◉
        </div>
        <div className="text-xs font-semibold text-white">Brand System</div>
      </div>

      <div
        className="text-[10px] uppercase tracking-widest mb-2"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Colors
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {[
          { hex: FOREST, label: "Primary" },
          { hex: LIME, label: "Accent" },
          { hex: "#005A47", label: "Mid" },
          { hex: "#FAFAF7", label: "Surface" },
          { hex: "#0B0B0F", label: "Ink" },
        ].map((c) => (
          <div key={c.label} className="text-center">
            <div
              className="w-full aspect-square rounded-lg mb-1"
              style={{
                background: c.hex,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
            <div
              className="text-[8px]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <div
        className="text-[10px] uppercase tracking-widest mb-2"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Type
      </div>
      <div className="space-y-1.5 mb-4">
        <div
          className="text-2xl font-bold leading-none"
          style={{ fontFamily: "Outfit, sans-serif", color: "#fff" }}
        >
          Display — Outfit
        </div>
        <div
          className="text-sm"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          Body — Inter
        </div>
      </div>

      <div
        className="rounded-lg p-2.5 flex items-center gap-2"
        style={{
          background: "rgba(199,231,56,0.08)",
          border: "1px solid rgba(199,231,56,0.25)",
        }}
      >
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: LIME, color: FOREST }}
        >
          🔒
        </span>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
          Locked. Every block uses these tokens.
        </span>
      </div>
    </div>
  );
}

function ABTestVisual() {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: FOREST_DEEP,
        border: "1px solid rgba(199,231,56,0.18)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: LIME, color: FOREST }}
        >
          ⚡
        </div>
        <div className="text-xs font-semibold text-white">Experiment Live</div>
        <div
          className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
          style={{ background: "rgba(199,231,56,0.15)", color: LIME }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: LIME }} />
          RUNNING — 3d
        </div>
      </div>

      {[
        { name: "A — Original", traffic: 40, conv: "3.2%", winning: false },
        { name: "B — Bold CTA", traffic: 40, conv: "5.8%", winning: true },
        { name: "C — Image hero", traffic: 20, conv: "2.9%", winning: false },
      ].map((v) => (
        <div
          key={v.name}
          className="mb-2 rounded-lg p-3"
          style={{
            background: v.winning
              ? "rgba(199,231,56,0.10)"
              : "rgba(255,255,255,0.04)",
            border: v.winning
              ? "1px solid rgba(199,231,56,0.35)"
              : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold"
                style={{ color: v.winning ? LIME : "#fff" }}
              >
                {v.name}
              </span>
              {v.winning && (
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: LIME, color: FOREST }}
                >
                  WINNER
                </span>
              )}
            </div>
            <span
              className="text-sm font-bold"
              style={{
                color: v.winning ? LIME : "rgba(255,255,255,0.7)",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {v.conv}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${parseFloat(v.conv) * 12}%`,
                background: v.winning
                  ? `linear-gradient(90deg, ${LIME}, #d6f54a)`
                  : "rgba(255,255,255,0.3)",
              }}
            />
          </div>
        </div>
      ))}

      <div
        className="mt-3 rounded-lg p-2.5 flex items-center gap-2"
        style={{
          background: "rgba(199,231,56,0.08)",
          border: "1px solid rgba(199,231,56,0.25)",
        }}
      >
        <span className="text-[14px]">🤖</span>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>
          Smart Traffic now routing 78% to variant B.
        </span>
      </div>
    </div>
  );
}

const features: Feature[] = [
  {
    eyebrow: "AI THAT KNOWS YOUR VOICE",
    title: "Copy that sounds like you, not the AI.",
    body:
      "Trained on your voice, your wins, and your category. Generate headline variants in seconds, then refine without leaving the page. Every prompt remembers your tone, your offer, and what's converted before.",
    bullets: [
      "Voice tuning from your existing pages",
      "Variant generation one click deep",
      "Account, persona, and stage-aware prompts",
    ],
    visual: <AICopyVisual />,
    side: "right",
  },
  {
    eyebrow: "BRAND-LOCKED, ALWAYS",
    title: "Tokens enforce your brand. Blocks enforce your taste.",
    body:
      "Colors, type, spacing, radius — locked at the system level. Anyone in your team can ship pages that look like yours on the first try. No more rogue hex codes, no more 14 different button styles.",
    bullets: [
      "One source of truth for color, type, spacing",
      "Block library with approved variations only",
      "Locked vs. editable regions per template",
    ],
    visual: <BrandTokensVisual />,
    side: "left",
  },
  {
    eyebrow: "TEST. LEARN. AUTOMATE.",
    title: "A/B testing built for revenue, not for engineers.",
    body:
      "Spin up variants in the editor. LP Studio splits traffic, watches significance, and routes visitors to the winning variant the moment it's clear. Heatmaps and scroll depth come in the box.",
    bullets: [
      "Auto-significance detection — no stats degree needed",
      "Smart Traffic routes to the winner automatically",
      "Heatmaps, scroll depth, and click maps included",
    ],
    visual: <ABTestVisual />,
    side: "right",
  },
];

export default function DeepFeatures() {
  return (
    <section
      id="features"
      className="px-6 py-20 md:py-28 relative"
      style={{ background: "#000" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{
              background: "rgba(199,231,56,0.08)",
              color: LIME,
              border: "1px solid rgba(199,231,56,0.18)",
            }}
          >
            What's inside
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold mb-4 text-white"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Every part of the page,{" "}
            <span style={{ color: LIME }}>solved.</span>
          </h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            From copy to conversion. Three things LP Studio does that the
            cobbled-together stack can't.
          </p>
        </div>

        <div className="space-y-24 md:space-y-32">
          {features.map((f) => (
            <FeatureRow key={f.title} feature={f} />
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
      <div
        className="text-xs font-bold tracking-widest mb-3"
        style={{ color: LIME }}
      >
        {feature.eyebrow}
      </div>
      <h3
        className="text-3xl md:text-4xl font-bold mb-4 text-white leading-tight"
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        {feature.title}
      </h3>
      <p
        className="text-base md:text-lg leading-relaxed mb-6"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        {feature.body}
      </p>
      <ul className="space-y-2.5">
        {feature.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-3 text-sm md:text-base"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold"
              style={{ background: "rgba(199,231,56,0.18)", color: LIME }}
            >
              ✓
            </span>
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
        transform: inView ? "none" : "translateY(40px)",
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
