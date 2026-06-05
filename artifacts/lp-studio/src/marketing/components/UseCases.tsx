import type { CSSProperties, ReactNode } from "react";
import { useInView } from "../hooks/useInView";

// Use-case section: each case now has a tiny live-looking page preview that
// matches the motion it powers — ABM hero with company name swap, A/B/C
// variant strip, locked-brand block library, QBR success page. Lifts the
// section out of "marketing copy in a 2x2" into a visible product story.

interface UseCase {
  num: string;
  name: string;
  headline: string;
  body: string;
  bullets: string[];
  accent: string;
  tint: string;
  visual: () => ReactNode;
}

// ── Mini-visuals ─────────────────────────────────────────────────────────

function AbmPreview({ accent }: { accent: string }) {
  // ABM hero card: company-logo placeholder, dynamic name in the headline,
  // and a "Viewed by" pill that names the contact.
  return (
    <Frame accent={accent}>
      <BrowserBar accent={accent} label="acme.lpstudio.ai" />
      <div style={{ padding: "14px 14px 16px" }}>
        <div className="flex items-center gap-2 mb-3">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 65%, #000) 100%)`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.02em",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            A
          </div>
          <span style={{ ...meta, color: accent, letterSpacing: "0.18em" }}>For Acme</span>
        </div>
        <Bone w="92%" h={10} mb={6} />
        <Bone w="72%" h={10} mb={10} />
        <Bone w="58%" h={6} mb={4} muted />
        <Bone w="52%" h={6} mb={10} muted />
        <div className="flex items-center gap-2">
          <Pill bg={accent} fg="#FFFFFF" label="Book a call" />
          <Pill bg="rgba(0,0,0,0)" fg="rgba(26,24,21,0.7)" label="See plan" border />
        </div>
      </div>
      <Annotation accent={accent} label="Personalized for Acme · Sarah Chen viewing now" />
    </Frame>
  );
}

function VariantsPreview({ accent }: { accent: string }) {
  return (
    <Frame accent={accent}>
      <BrowserBar accent={accent} label="campaign-q3 · 3 variants" />
      <div style={{ padding: "12px 14px 14px" }}>
        {[
          { name: "A · Original", traffic: 18, winning: false },
          { name: "B · Bold CTA", traffic: 64, winning: true },
          { name: "C · Image-led", traffic: 18, winning: false },
        ].map((v) => (
          <div
            key={v.name}
            className="mb-2"
            style={{
              background: v.winning ? `color-mix(in srgb, ${accent} 12%, #FFFFFF)` : "#FFFFFF",
              border: `1px solid ${v.winning ? `color-mix(in srgb, ${accent} 30%, transparent)` : "rgba(26,24,21,0.08)"}`,
              borderRadius: 6,
              padding: "7px 9px",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                style={{
                  ...meta,
                  color: v.winning ? accent : "rgba(26,24,21,0.7)",
                  letterSpacing: "0.04em",
                  textTransform: "none",
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                {v.name}
              </span>
              {v.winning && <WinnerChip accent={accent} />}
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "rgba(26,24,21,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${v.traffic + 8}%`,
                  height: "100%",
                  background: v.winning ? accent : "rgba(26,24,21,0.25)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <Annotation accent={accent} label="Smart Traffic routing 64% to variant B" />
    </Frame>
  );
}

function BrandLockedPreview({ accent }: { accent: string }) {
  return (
    <Frame accent={accent}>
      <BrowserBar accent={accent} label="brand-system" />
      <div style={{ padding: "14px 14px 16px" }}>
        <div style={{ ...meta, marginBottom: 8 }}>Color tokens</div>
        <div className="flex items-center gap-1.5 mb-4">
          {["var(--ink)", accent, `color-mix(in srgb, ${accent} 60%, #000)`, "var(--coral)", "#F4E8D8"].map((c, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                width: 24,
                height: 24,
                borderRadius: 5,
                background: c,
                border: "1px solid rgba(26,24,21,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: -3,
                  bottom: -3,
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#FFFFFF",
                  border: `1.5px solid ${accent}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="9" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            </div>
          ))}
        </div>
        <div style={{ ...meta, marginBottom: 8 }}>Approved blocks</div>
        <div className="grid grid-cols-3 gap-1.5">
          {["Hero", "Logos", "Features", "Stats", "Quote", "CTA"].map((b) => (
            <div
              key={b}
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(26,24,21,0.08)",
                borderRadius: 5,
                padding: "6px 7px",
                fontSize: 9,
                fontWeight: 600,
                color: "rgba(26,24,21,0.7)",
                fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
                letterSpacing: "-0.005em",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {b}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5L10 17.5L20 7.5"/>
              </svg>
            </div>
          ))}
        </div>
      </div>
      <Annotation accent={accent} label="Locked tokens · 6 approved blocks · 0 rogue hex" />
    </Frame>
  );
}

function QbrPreview({ accent }: { accent: string }) {
  return (
    <Frame accent={accent}>
      <BrowserBar accent={accent} label="northwind / Q3-2026" />
      <div style={{ padding: "14px 14px 16px" }}>
        <div className="flex items-center justify-between mb-3">
          <Bone w={120} h={10} />
          <Pill bg={`color-mix(in srgb, ${accent} 12%, #FFFFFF)`} fg={accent} label="QBR" border accentBorder={accent} />
        </div>
        <div className="flex items-end justify-between gap-2 mb-3" style={{ height: 56 }}>
          {[34, 46, 38, 58, 50, 70, 64, 82].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i >= 6 ? accent : "rgba(26,24,21,0.18)", borderRadius: 2 }} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ ...meta, color: accent, textTransform: "none", fontWeight: 700, letterSpacing: "-0.005em" }}>
            +28%
          </span>
          <span style={{ ...meta, textTransform: "none", letterSpacing: "-0.005em" }}>
            vs Q2 — renewals trending up
          </span>
        </div>
      </div>
      <Annotation accent={accent} label="Auto-pulled from CRM · refreshes nightly" />
    </Frame>
  );
}

// ── Shared mini-primitives ──────────────────────────────────────────────

const meta: CSSProperties = {
  fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(26,24,21,0.5)",
};

function Frame({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: `1px solid rgba(26,24,21,0.10)`,
        boxShadow:
          `0 24px 60px -20px rgba(26,24,21,0.18), 0 6px 18px -8px color-mix(in srgb, ${accent} 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
      {children}
    </div>
  );
}

function BrowserBar({ accent, label }: { accent: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2"
      style={{ borderBottom: "1px solid rgba(26,24,21,0.06)", background: "rgba(246,242,233,0.6)" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.15)" }} />
      <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.15)" }} />
      <span style={{ width: 7, height: 7, borderRadius: 999, background: "rgba(26,24,21,0.15)" }} />
      <span
        className="ml-1.5"
        style={{
          flex: 1,
          background: "#FFFFFF",
          border: "1px solid rgba(26,24,21,0.06)",
          borderRadius: 4,
          padding: "2px 7px",
          fontSize: 10,
          color: "rgba(26,24,21,0.55)",
          fontFamily: "'DM Mono', ui-monospace, monospace",
        }}
      >
        {label}
      </span>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, boxShadow: `0 0 5px ${accent}` }} />
    </div>
  );
}

function Bone({ w, h, mb, muted }: { w: number | string; h: number; mb?: number; muted?: boolean }) {
  return (
    <div
      style={{
        width: typeof w === "number" ? w : w,
        height: h,
        marginBottom: mb,
        background: muted ? "rgba(26,24,21,0.06)" : "rgba(26,24,21,0.18)",
        borderRadius: 3,
      }}
    />
  );
}

function Pill({
  bg,
  fg,
  label,
  border,
  accentBorder,
}: {
  bg: string;
  fg: string;
  label: string;
  border?: boolean;
  accentBorder?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
        border: border ? `1px solid ${accentBorder ?? "rgba(26,24,21,0.18)"}` : "none",
        letterSpacing: "-0.005em",
      }}
    >
      {label}
    </span>
  );
}

function WinnerChip({ accent }: { accent: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 5px",
        borderRadius: 999,
        background: accent,
        color: "#FFFFFF",
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        boxShadow: `0 1px 2px color-mix(in srgb, ${accent} 50%, transparent)`,
      }}
    >
      <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.7 6.7L22 9.6l-5.4 4.7L18 22l-6-3.5L6 22l1.4-7.7L2 9.6l7.3-.9z" />
      </svg>
      Winner
    </span>
  );
}

function Annotation({ accent, label }: { accent: string; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{
        borderTop: "1px solid rgba(26,24,21,0.06)",
        background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, color-mix(in srgb, ${accent} 5%, transparent) 100%)`,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 65%, #000) 100%)`,
          color: "#FFFFFF",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 800,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        ✦
      </span>
      <span
        style={{
          fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
          fontSize: 10.5,
          color: "rgba(26,24,21,0.7)",
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────

const cases: UseCase[] = [
  {
    num: "01",
    name: "ABM Sales",
    headline: "One page for every account on the list.",
    body:
      "Pull the logo, swap the hero, drop in the case study they actually relate to. Personalized at the account level — no design ticket, no waiting on marketing.",
    bullets: [
      "Personalize at the account level",
      "Embed in 1:1 outreach",
      "See who viewed and for how long",
    ],
    accent: "var(--indigo)",
    tint: "var(--indigo-soft)",
    visual: () => <AbmPreview accent="var(--indigo)" />,
  },
  {
    num: "02",
    name: "Demand Gen",
    headline: "Five variants live by Friday.",
    body:
      "Run paid traffic across A/B/C variants of headline, hero, and CTA. Smart Traffic routes to the winner the moment significance lands.",
    bullets: [
      "Built-in A/B and multivariate testing",
      "Auto-significance detection",
      "Heatmaps and scroll depth, in the box",
    ],
    accent: "var(--coral)",
    tint: "var(--coral-soft)",
    visual: () => <VariantsPreview accent="var(--coral)" />,
  },
  {
    num: "03",
    name: "Product Launches",
    headline: "Brand-locked. Marketer-fast.",
    body:
      "Brand tokens, blocks, and approvals baked in. Anyone ships on-brand the first time. Designers stay in the loop only when they want to.",
    bullets: [
      "Tokens enforced at the block level",
      "Approval workflows when you need them",
      "Locked vs editable regions",
    ],
    accent: "var(--sage)",
    tint: "var(--sage-soft)",
    visual: () => <BrandLockedPreview accent="var(--sage)" />,
  },
  {
    num: "04",
    name: "Customer Success",
    headline: "QBRs and renewals, repeatable.",
    body:
      "Executive-ready pages for QBRs, expansions, and renewals. Build the page once, personalize per account. Send a link, not a deck — and see exactly who opened it.",
    bullets: [
      "Reusable templates per account motion",
      "Per-account personalization, on-brand",
      "Branded, shareable, trackable",
    ],
    accent: "var(--gold)",
    tint: "var(--gold-soft)",
    visual: () => <QbrPreview accent="var(--gold)" />,
  },
];

export default function UseCases() {
  const { ref, inView } = useInView();
  return (
    <section id="use-cases" className="px-6 py-28 md:py-36" style={{ background: "var(--cream)" }}>
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div className="max-w-2xl mb-16 md:mb-20">
          <div className="marker marker-rule mb-6">For the whole revenue org</div>
          <h2 className="font-display text-display-lg" style={{ color: "var(--ink)" }}>
            Sales and marketing, shipping from the same canvas.
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.55]"
            style={{ color: "var(--ink-soft)", maxWidth: 580 }}
          >
            Sales personalizes per account. Demand gen tests every variant. Product launches new pages. Success runs QBRs. Same brand. Same blocks. Same canvas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7">
          {cases.map((c) => (
            <CaseCard key={c.name} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseCard({ c }: { c: UseCase }) {
  return (
    <div
      className="group relative rounded-2xl overflow-hidden p-7 md:p-9 transition-all"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.08)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          `0 1px 0 rgba(255,255,255,0.6) inset, 0 14px 32px -14px rgba(26,24,21,0.16), 0 0 0 1px color-mix(in srgb, ${c.accent} 30%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.08)";
      }}
    >
      {/* Corner accent glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: `radial-gradient(circle, color-mix(in srgb, ${c.accent} 14%, transparent) 0%, transparent 70%)`,
          filter: "blur(4px)",
        }}
      />

      <div className="relative flex items-start justify-between gap-4 mb-7">
        <div className="flex items-center gap-3">
          <span
            className="font-display tabular-nums"
            style={{
              color: c.accent,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {c.num}
          </span>
          <span
            className="font-mono uppercase"
            style={{ color: c.accent, fontSize: 11, letterSpacing: "0.18em", fontWeight: 600 }}
          >
            {c.name}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-1 rounded-full"
          style={{
            background: c.tint,
            color: c.accent,
            border: `1px solid color-mix(in srgb, ${c.accent} 25%, transparent)`,
            letterSpacing: "0.16em",
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: c.accent,
              boxShadow: `0 0 6px color-mix(in srgb, ${c.accent} 50%, transparent)`,
            }}
          />
          Live play
        </span>
      </div>

      <h3
        className="font-display mb-4"
        style={{
          color: "var(--ink)",
          fontSize: "clamp(24px, 2.6vw, 30px)",
          fontWeight: 500,
          letterSpacing: "-0.022em",
          lineHeight: 1.1,
          maxWidth: 420,
        }}
      >
        {c.headline}
      </h3>

      <p
        className="text-[15px] leading-[1.6] mb-7"
        style={{ color: "var(--ink-soft)", maxWidth: 460 }}
      >
        {c.body}
      </p>

      {/* Live mini-preview */}
      <div className="mb-7 relative">{c.visual()}</div>

      <ul className="flex flex-col gap-2.5">
        {c.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-3 text-[13.5px]"
            style={{ color: "var(--ink-2)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={c.accent}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 3, flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M5 12.5L10 17.5L20 7.5"/>
            </svg>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
