import { useInView } from "../hooks/useInView";

// SmartTrafficDemo — the killer marketing-specific value section. Shows three
// page variants (A/B/C) side-by-side with a traffic split + conversion rate
// row underneath each, then a Smart Traffic callout that says "Variant B is
// winning — auto-routing 70% of new visitors there." Built fresh for the
// refactored /for-marketing page (per site-ia-plan.md, this is the surface
// that marketing buyers won't see anywhere else on the site).
//
// Production-fidelity bar: must read as a real product surface, not a
// marketing illustration. Uses the same eyebrow + headline pattern as
// FeatureRow above so the section reads cohesively in the stack.

/** Hero layout treatments — picked per-variant so the three look like
 * legitimately different design takes on the same campaign, not just
 * different copy on one template. */
type HeroLayout = "bottom-left" | "center-middle" | "top-left-tint";

interface Variant {
  letter: "A" | "B" | "C";
  label: string;
  /** Distinct hero copy per variant — three angles being tested */
  eyebrow: string;
  headline: string;
  subline: string;
  cta: string;
  /** Unsplash hero image, sized for the card width (~370px). */
  image: string;
  /** Layout treatment — alignment + overlay style. */
  layout: HeroLayout;
  visits: number;
  conversions: number;
  trafficShare: number; // 0-100, share of new traffic Smart Traffic is sending here
  winning?: boolean;
}

// All three variants are testing different angles on the same campaign
// (Q3 Customer Summit) — same offer, different headlines / sublines / CTAs
// / hero imagery. That's the realistic A/B test shape: not three unrelated
// pages, but three takes on one page.
const VARIANTS: Variant[] = [
  {
    letter: "A",
    label: "Control · Outcome",
    eyebrow: "Q3 Customer Summit · Sept 18 · NYC",
    headline: "The revenue playbook, shipped together.",
    subline:
      "Two days of working sessions with the teams running the most ambitious revenue motions in 2026.",
    cta: "RSVP",
    image:
      "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?q=80&w=900&h=520&fit=crop",
    layout: "bottom-left",
    visits: 4218,
    conversions: 142,
    trafficShare: 15,
  },
  {
    letter: "B",
    label: "Outcome + urgency",
    eyebrow: "Q3 Customer Summit · 38 seats left",
    headline: "Where the best revenue teams compare notes.",
    subline:
      "Working sessions with operators from Ramp, Vercel, and Linear — leave with the playbook, not a tote bag.",
    cta: "Save my seat",
    image:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=900&h=520&fit=crop",
    layout: "center-middle",
    visits: 4290,
    conversions: 264,
    trafficShare: 70,
    winning: true,
  },
  {
    letter: "C",
    label: "Social proof",
    eyebrow: "Q3 Customer Summit · Sept 18",
    headline: "Build your 2027 revenue plan in 2 days.",
    subline:
      "180 operators. 12 working sessions. The room every CRO told us we should be in last year.",
    cta: "Request invite",
    image:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=900&h=520&fit=crop",
    layout: "top-left-tint",
    visits: 4156,
    conversions: 121,
    trafficShare: 15,
  },
];

function cvr(v: Variant): number {
  return (v.conversions / v.visits) * 100;
}

export default function SmartTrafficDemo() {
  const { ref, inView } = useInView(0.1);

  return (
    <section
      id="smart-traffic"
      className="px-6 py-24 md:py-28"
      style={{
        background: "var(--cream-2)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Copy block */}
        <div className="max-w-[660px] mb-10">
          <div className="marker marker-rule mb-5">01 / Test</div>
          <h2
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(30px, 3.6vw, 42px)",
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            A/B &amp; multivariate testing. Let Smart Traffic pick the winner.
          </h2>
          <div
            className="mt-5 text-[16.5px] leading-[1.6] max-w-[560px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Spin up three headlines, three CTAs, three layouts — LP Studio
            routes traffic, tracks every variant, and shifts new visitors to
            the winner the moment significance lands.{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              No manual reweighting, no waiting.
            </strong>
          </div>
        </div>

        {/* Variants row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {VARIANTS.map((v) => (
            <div key={v.letter} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Hero card — just the hero section of the page with a slim
                  variant-label header. Dropped the faux browser chrome
                  (traffic dots) since these aren't browser windows; the
                  header chip alone reads as "this is variant X". */}
              <div
                style={{
                  background: "var(--paper)",
                  border: v.winning
                    ? "1px solid color-mix(in srgb, var(--indigo) 55%, transparent)"
                    : "1px solid var(--hairline-strong)",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: v.winning
                    ? "0 0 0 5px color-mix(in srgb, var(--indigo) 14%, transparent), 0 24px 50px -22px rgba(75,71,229,0.45), 0 1px 0 rgba(255,255,255,0.7) inset"
                    : "0 10px 28px -18px rgba(26,24,21,0.18), 0 1px 0 rgba(255,255,255,0.7) inset",
                  position: "relative",
                  transform: v.winning ? "translateY(-2px)" : "none",
                }}
              >
                {/* Header — full-bleed band. Winning variant gets an indigo
                    fill with a centered "WINNING · 95% CONFIDENCE" label so
                    the win is impossible to miss. Other variants get a
                    quiet cream chip with the variant letter + angle. */}
                {v.winning ? (
                  <div
                    className="font-mono uppercase"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "9px 14px",
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--indigo) 92%, white) 0%, var(--indigo) 100%)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.20em",
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--indigo) 65%, transparent)",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5z" />
                    </svg>
                    Winning · 95% confidence
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--cream-2)",
                      borderBottom: "1px solid var(--hairline)",
                    }}
                  >
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.16em",
                        fontWeight: 700,
                        color: "var(--ink-mute)",
                      }}
                    >
                      Variant {v.letter} · {v.label}
                    </span>
                  </div>
                )}

                {/* The hero itself — full-bleed image, copy + CTA overlay.
                    Variant C gets a social-proof footer (pull quote + stat
                    row) inside the same hero frame. */}
                <VariantHero variant={v} />
              </div>

              {/* Stats block — tightened gap from the card. Winning variant
                  gets a subtle indigo tint so the win reads at the metric
                  level too, not just on the chrome. */}
              <div
                style={{
                  background: v.winning
                    ? "color-mix(in srgb, var(--indigo) 8%, var(--paper))"
                    : "var(--paper)",
                  border: v.winning
                    ? "1px solid color-mix(in srgb, var(--indigo) 35%, transparent)"
                    : "1px solid var(--hairline-strong)",
                  borderRadius: 10,
                  padding: "11px 16px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                }}
              >
                <Stat label="Visits" value={v.visits.toLocaleString()} />
                <Stat label="CVR" value={`${cvr(v).toFixed(2)}%`} accent={v.winning} />
                <Stat label="Traffic" value={`${v.trafficShare}%`} accent={v.winning} />
              </div>
            </div>
          ))}
        </div>

        {/* Smart Traffic callout */}
        <div
          style={{
            marginTop: 22,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 20px",
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 12,
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 24px -16px rgba(26,24,21,0.16)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "color-mix(in srgb, var(--indigo) 14%, transparent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--indigo)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-mono uppercase"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--indigo)",
              }}
            >
              Smart Traffic
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 14.5,
                color: "var(--ink)",
                letterSpacing: "-0.005em",
              }}
            >
              Variant B reached 95% confidence at 12,664 visits.{" "}
              <strong style={{ fontWeight: 600 }}>
                70% of new traffic is now routed to B
              </strong>{" "}
              while A and C keep a small holdout for ongoing learning.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// VariantHero — full-bleed image hero with copy + CTA overlaid. Reads as
// the hero block of a real landing page (not a card / mini-LP mockup).
// Three layout treatments dispatched on v.layout so the variants read as
// genuinely different design takes on the same campaign, not just three
// copies of one template.
function VariantHero({ variant: v }: { variant: Variant }) {
  if (v.layout === "center-middle") return <CenterHero variant={v} />;
  if (v.layout === "top-left-tint") return <TopLeftTintHero variant={v} />;
  return <BottomLeftHero variant={v} />;
}

// ---------- shared CTA pair ----------

function HeroCTAs({ cta }: { cta: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "10px 18px",
          background: "#fff",
          color: "var(--ink)",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          boxShadow:
            "0 6px 16px -4px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.7)",
          letterSpacing: "-0.005em",
        }}
      >
        {cta}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12.5,
          fontWeight: 500,
          color: "rgba(255,255,255,0.88)",
          textShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
      >
        View agenda
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  );
}

// ---------- A · bottom-left, editorial dark gradient ----------

function BottomLeftHero({ variant: v }: { variant: Variant }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 5",
        backgroundImage: `linear-gradient(180deg, rgba(20,18,30,0.10) 0%, rgba(20,18,30,0.40) 55%, rgba(20,18,30,0.85) 100%), url("${v.image}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#fff",
        padding: "22px 22px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        textAlign: "left",
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.88)",
          marginBottom: 10,
        }}
      >
        {v.eyebrow}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 26,
          lineHeight: 1.08,
          letterSpacing: "-0.025em",
          color: "#fff",
          fontWeight: 700,
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {v.headline}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.85)",
          maxWidth: 320,
          textShadow: "0 1px 2px rgba(0,0,0,0.30)",
        }}
      >
        {v.subline}
      </div>
      <div style={{ marginTop: 16 }}>
        <HeroCTAs cta={v.cta} />
      </div>
    </div>
  );
}

// ---------- B · centered, copy in the middle, even darkening ----------

function CenterHero({ variant: v }: { variant: Variant }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 5",
        backgroundImage: `linear-gradient(180deg, rgba(20,18,30,0.55) 0%, rgba(20,18,30,0.55) 100%), url("${v.image}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#fff",
        padding: "22px 22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.88)",
          marginBottom: 14,
        }}
      >
        {v.eyebrow}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 30,
          lineHeight: 1.06,
          letterSpacing: "-0.028em",
          color: "#fff",
          fontWeight: 700,
          textShadow: "0 1px 3px rgba(0,0,0,0.40)",
          maxWidth: 320,
        }}
      >
        {v.headline}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.88)",
          maxWidth: 300,
          textShadow: "0 1px 2px rgba(0,0,0,0.30)",
        }}
      >
        {v.subline}
      </div>
      <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
        <HeroCTAs cta={v.cta} />
      </div>
    </div>
  );
}

// ---------- C · top-left, indigo color-wash overlay (magazine-style) ----------

function TopLeftTintHero({ variant: v }: { variant: Variant }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 5",
        backgroundImage:
          // Lighter dark gradient + tiny indigo accent at the top — drops
          // the heavy indigo duotone (which was washing the photo flat)
          // and lets the underlying image read while still keeping the
          // white type legible. Multiply blend removed; this is a normal
          // composited overlay.
          `linear-gradient(180deg, rgba(20,18,40,0.30) 0%, rgba(15,12,30,0.62) 60%, rgba(8,6,18,0.85) 100%), url("${v.image}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#fff",
        // Extra top padding for variant C: the eyebrow is intentionally
        // omitted, so the headline starts higher than in the other variants.
        // The extra 30px breathing room above the headline keeps the
        // top-aligned copy from hugging the frame edge.
        padding: "56px 24px 26px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        textAlign: "left",
      }}
    >
      {/* Eyebrow intentionally omitted for variant C — the social-proof
          footer carries enough context that an extra event-date eyebrow up
          top read as noisy. */}
      <div
        className="font-display"
        style={{
          fontSize: 28,
          lineHeight: 1.06,
          letterSpacing: "-0.028em",
          color: "#fff",
          fontWeight: 700,
          textShadow: "0 1px 2px rgba(0,0,0,0.30)",
        }}
      >
        {v.headline}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.90)",
          maxWidth: 320,
        }}
      >
        {v.subline}
      </div>
      <div style={{ marginTop: 18 }}>
        <HeroCTAs cta={v.cta} />
      </div>

      {/* Social-proof footer — pull quote + 3-stat row, hugged tight to
       *  the CTAs above (no marginTop:auto dead zone). Wrapped in a solid
       *  black band that breaks out of the hero padding so it spans
       *  edge-to-edge of the frame and visually separates from the hero
       *  copy above. */}
      <div
        style={{
          marginTop: 24,
          marginLeft: -24,
          marginRight: -24,
          marginBottom: -26,
          paddingTop: 22,
          paddingBottom: 22,
          paddingLeft: 24,
          paddingRight: 24,
          background: "#0B0A0F",
          color: "#fff",
        }}
      >
        <div>
          {/* Quote */}
          <div style={{ display: "flex", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 0.6,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "-0.04em",
                flexShrink: 0,
                marginTop: 3,
              }}
            >
              &ldquo;
            </span>
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.42,
                color: "rgba(255,255,255,0.95)",
                fontStyle: "italic",
                fontWeight: 500,
                textShadow: "0 1px 2px rgba(0,0,0,0.25)",
              }}
            >
              Best room I&apos;ve been in all year. Walked out with three
              concrete commitments and a CRO I&apos;m now closing with.
              <div
                style={{
                  marginTop: 8,
                  fontStyle: "normal",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.75)",
                  letterSpacing: "0.01em",
                  fontWeight: 500,
                }}
              >
                — Jordan Maeda · VP RevOps · Plaid
              </div>
            </div>
          </div>

          {/* Stat row */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.18)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {[
              { value: "180", label: "Operators" },
              { value: "12", label: "Sessions" },
              { value: "9", label: "Industries" },
            ].map((s) => (
              <div key={s.label}>
                <div
                  className="font-display"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                    textShadow: "0 1px 2px rgba(0,0,0,0.30)",
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="font-mono uppercase"
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.75)",
                    marginTop: 5,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          fontWeight: 700,
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 14,
          fontWeight: 600,
          color: accent ? "var(--indigo)" : "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
