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
          No design queue, no hand-offs. Every page on-brand, every time —
          for one-team GTM.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:justify-center"
          style={{
            gap: 14,
            marginTop: 36,
          }}
        >
          <a
            href="https://app.lpstudio.ai"
            style={{
              color: "var(--cream)",
              background: "var(--navy)",
              padding: "13px 24px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              border: "1px solid rgba(244, 239, 227, 0.14)",
              boxShadow:
                "0 1px 2px rgba(0,0,0,0.25), 0 10px 26px -10px rgba(0,0,0,0.55)",
              letterSpacing: "-0.005em",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "background .15s, transform .15s, box-shadow .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--navy-2)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--navy)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
            </svg>
            Generate your first page
          </a>
          <a
            href="mailto:admin@lpstudio.ai?subject=LP%20Studio%20demo"
            style={{
              color: "var(--dark-mute)",
              background: "transparent",
              padding: "13px 18px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 500,
              border: "none",
              letterSpacing: "-0.005em",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "color .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dark-text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dark-mute)")}
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
