import { useInView } from "../hooks/useInView";

// FinalCta — the dark indigo closer used on every non-legacy marketing page
// (/new, /features, /for-marketing, /for-sales, /pricing). Tuned to match
// the original Waitlist closer on the legacy / route so the look stays
// consistent: tall py-28/py-40 section, deep dark gradient background with
// indigo + coral orbs bleeding through, "Free to start · no card required"
// eyebrow pill with an indigo dot, gradient-text "Skip the brief. / Ship
// the page." headline, and a cream-primary + ghost-outline CTA pair.

export default function FinalCta() {
  const { ref, inView } = useInView(0.08);

  return (
    <section
      id="cta"
      className="px-6 py-28 md:py-40 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, var(--dark-2) 0%, var(--dark) 70%)",
        color: "var(--dark-text)",
      }}
    >
      {/* Two soft orbs picking up the gradient palette */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          left: "8%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.38) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(10px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: "-15%",
          right: "-5%",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(226,107,79,0.30) 0%, rgba(226,107,79,0) 70%)",
          filter: "blur(10px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[760px] mx-auto text-center relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Eyebrow pill */}
        <div
          className="inline-flex items-center gap-2.5"
          style={{
            background: "rgba(244,239,227,0.06)",
            border: "1px solid var(--dark-hairline)",
            color: "var(--dark-mute)",
            padding: "7px 16px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 32,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--indigo)",
              boxShadow: "0 0 8px var(--indigo)",
            }}
          />
          Free to start · no card required
        </div>

        {/* Headline */}
        <h2
          className="font-display"
          style={{
            margin: 0,
            color: "var(--dark-text)",
            fontSize: "clamp(48px, 7vw, 88px)",
            lineHeight: 1.0,
            letterSpacing: "-0.035em",
            fontWeight: 500,
          }}
        >
          Skip the brief.
          <br />
          <span
            style={{
              background:
                "linear-gradient(135deg, #B0AFFF 0%, #FFB89F 70%, var(--coral) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            Ship the page.
          </span>
        </h2>

        {/* Subhead */}
        <p
          style={{
            marginTop: 26,
            marginInline: "auto",
            maxWidth: 520,
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--dark-mute)",
          }}
        >
          Skip the marketing queue. Every page on-brand, every time — for
          every team that needs one.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: "inline-flex",
            gap: 14,
            justifyContent: "center",
            marginTop: 36,
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://app.lpstudio.ai"
            style={{
              color: "var(--ink)",
              background:
                "linear-gradient(180deg, #FDFBF6 0%, #F4EFE3 100%)",
              padding: "15px 30px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              border: "1px solid rgba(0, 0, 0, 0.18)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.10), 0 14px 32px -10px rgba(0,0,0,0.45)",
              textShadow: "0 1px 0 rgba(255,255,255,0.6)",
              letterSpacing: "-0.005em",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
            </svg>
            Generate your first page
          </a>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20demo"
            style={{
              color: "var(--dark-text)",
              background:
                "linear-gradient(180deg, rgba(244, 239, 227, 0.10) 0%, rgba(244, 239, 227, 0.04) 100%)",
              padding: "15px 30px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              border: "1px solid rgba(244, 239, 227, 0.24)",
              backdropFilter: "blur(10px) saturate(140%)",
              WebkitBackdropFilter: "blur(10px) saturate(140%)",
              boxShadow:
                "inset 0 1px 0 rgba(244, 239, 227, 0.16), inset 0 -1px 0 rgba(0, 0, 0, 0.20), 0 6px 16px -4px rgba(0, 0, 0, 0.35)",
              letterSpacing: "-0.005em",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            See a live page
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
