import type { CSSProperties } from "react";
import { useInView } from "../hooks/useInView";

interface Testimonial {
  quote: string;
  name: string;
  initials: string;
  role: string;
  company: string;
  /** Tiny brand-style mark next to the company name. */
  mark: "circle" | "triangle" | "wave" | "diamond";
  /** Gradient used for the avatar puck. */
  avatarGradient: string;
  /** Bold pull-stat shown in the featured tile. */
  pullStat?: { value: string; label: string };
}

const testimonials: Testimonial[] = [
  {
    quote:
      "We used to wait two weeks for marketing to build a landing page. Now our AEs spin one up in an afternoon — on brand, with real copy. It's completely changed how we run outbound.",
    name: "Rachel Tran",
    initials: "RT",
    role: "VP, Revenue Operations",
    company: "Helix · Series B SaaS",
    mark: "circle",
    avatarGradient: "linear-gradient(135deg,#F4A172 0%,#E37051 100%)",
    pullStat: { value: "3 wks → 1 afternoon", label: "Time to ship an ABM page" },
  },
  {
    quote:
      "The visual builder is the best I've used. Fast, intuitive, and the AI copy actually sounds like us — not generic filler. Outbound conversion went up 40% in the first month.",
    name: "Marcus Jordan",
    initials: "MJ",
    role: "Head of Demand Generation",
    company: "Spire · Growth-stage fintech",
    mark: "triangle",
    avatarGradient: "linear-gradient(135deg,#6C68F0 0%,#4B47E5 100%)",
  },
  {
    quote:
      "Smart Traffic changed how we think about optimization. Set it up once and it just keeps improving conversion in the background. No babysitting, no analyst needed.",
    name: "Priya Shah",
    initials: "PS",
    role: "Director, Performance Marketing",
    company: "Vela · B2B SaaS, Enterprise",
    mark: "wave",
    avatarGradient: "linear-gradient(135deg,#7BBE8B 0%,#3F8F5C 100%)",
  },
];

function Mark({ kind, color = "currentColor" }: { kind: Testimonial["mark"]; color?: string }) {
  if (kind === "circle") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="2.5" fill={color} />
      </svg>
    );
  }
  if (kind === "triangle") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4l8 14H4z" fill={color}/>
      </svg>
    );
  }
  if (kind === "wave") {
    return (
      <svg width="18" height="12" viewBox="0 0 32 18" aria-hidden="true">
        <path d="M0 9 Q 4 0, 8 9 T 16 9 T 24 9 T 32 9" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l9 9-9 9-9-9z" fill="none" stroke={color} strokeWidth="2"/>
    </svg>
  );
}

const stars: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
};

function Stars({ color }: { color: string }) {
  return (
    <span style={stars} aria-label="Five out of five stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={color} aria-hidden="true">
          <path d="M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z"/>
        </svg>
      ))}
    </span>
  );
}

function Avatar({ initials, gradient, size = 44 }: { initials: string; gradient: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: gradient,
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.32,
        letterSpacing: "0.02em",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)",
        fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
      }}
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  const { ref, inView } = useInView();
  const featured = testimonials[0];
  const rest = testimonials.slice(1);

  return (
    <section
      id="testimonials"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{ background: "var(--tint-blush)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Soft coral aurora */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          left: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(226,107,79,0.16) 0%, rgba(226,107,79,0) 70%)",
          filter: "blur(6px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-10%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,146,61,0.12) 0%, rgba(200,146,61,0) 70%)",
          filter: "blur(6px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12 md:mb-16">
          <div className="max-w-2xl">
            <div className="marker marker-rule mb-6">From the field</div>
            <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
              Teams that have stopped waiting on the page.
            </h2>
          </div>
          <div
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline-strong)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
            }}
          >
            <Stars color="var(--coral)" />
            <span className="text-[12.5px]" style={{ color: "var(--ink)", fontWeight: 600 }}>
              4.9 / 5
            </span>
            <span style={{ color: "var(--ink-faint)" }}>·</span>
            <span className="text-[12px]" style={{ color: "var(--ink-soft)" }}>
              from 240+ reviews
            </span>
          </div>
        </div>

        {/* Bento layout: 1 featured + 2 stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
          {/* Featured */}
          <div
            className="lg:col-span-3 relative rounded-2xl overflow-hidden p-8 md:p-10"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px -28px rgba(26,24,21,0.15)",
            }}
          >
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: -80,
                right: -60,
                width: 320,
                height: 320,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(226,107,79,0.16) 0%, rgba(226,107,79,0) 70%)",
                filter: "blur(6px)",
              }}
            />
            <div className="relative">
              {/* Editorial open-quote */}
              <span
                aria-hidden
                className="font-display block mb-2"
                style={{
                  fontSize: 80,
                  lineHeight: 0.6,
                  color: "var(--coral)",
                  fontWeight: 700,
                  marginLeft: -4,
                }}
              >
                "
              </span>
              <Stars color="var(--coral)" />
              <blockquote
                className="font-display mt-5 mb-8"
                style={{
                  color: "var(--ink)",
                  fontSize: "clamp(20px, 2.2vw, 26px)",
                  lineHeight: 1.4,
                  fontWeight: 400,
                  letterSpacing: "-0.014em",
                  maxWidth: 620,
                }}
              >
                {featured.quote}
              </blockquote>

              <div className="flex items-end justify-between flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <Avatar initials={featured.initials} gradient={featured.avatarGradient} size={52} />
                  <div>
                    <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                      {featured.name}
                    </div>
                    <div className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                      {featured.role}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1.5">
                      <span style={{ color: "var(--ink-mute)" }}>
                        <Mark kind={featured.mark} />
                      </span>
                      <span
                        className="text-[11.5px] uppercase"
                        style={{ color: "var(--ink-mute)", letterSpacing: "0.14em", fontWeight: 600 }}
                      >
                        {featured.company}
                      </span>
                    </div>
                  </div>
                </div>

                {featured.pullStat && (
                  <div
                    className="px-4 py-3 rounded-xl"
                    style={{
                      background: "var(--coral-soft)",
                      border: "1px solid color-mix(in srgb, var(--coral) 25%, transparent)",
                      minWidth: 200,
                    }}
                  >
                    <div
                      className="font-display tabular-nums"
                      style={{
                        color: "var(--coral)",
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: "-0.022em",
                        lineHeight: 1.1,
                      }}
                    >
                      {featured.pullStat.value}
                    </div>
                    <div
                      className="text-[11px] uppercase mt-1"
                      style={{ color: "var(--ink-mute)", letterSpacing: "0.16em", fontWeight: 600 }}
                    >
                      {featured.pullStat.label}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Two stacked smaller quotes */}
          <div className="lg:col-span-2 grid grid-cols-1 gap-4 md:gap-5">
            {rest.map((t) => (
              <SmallQuote key={t.name} t={t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SmallQuote({ t }: { t: Testimonial }) {
  return (
    <figure
      className="relative rounded-2xl overflow-hidden p-6 flex flex-col h-full"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 32px -24px rgba(26,24,21,0.12)",
      }}
    >
      <Stars color="var(--coral)" />
      <blockquote
        className="mt-3 text-[14.5px] leading-[1.55] flex-1"
        style={{
          color: "var(--ink)",
          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
          letterSpacing: "-0.005em",
        }}
      >
        "{t.quote}"
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar initials={t.initials} gradient={t.avatarGradient} size={36} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
            {t.name}
          </div>
          <div className="text-[11px] uppercase mt-0.5 flex items-center gap-1.5" style={{ color: "var(--ink-mute)", letterSpacing: "0.14em" }}>
            <Mark kind={t.mark} />
            <span className="truncate">{t.company}</span>
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
