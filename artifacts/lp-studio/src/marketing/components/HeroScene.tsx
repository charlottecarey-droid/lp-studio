// HeroScene — the editorial hero from the first design-mockup (v3). Cream
// paper-grain background, eyebrow pill, big DM Sans display headline with an
// indigo→coral gradient on the accent line, supporting subhead only. CTAs
// live below the PromptCard in the next section so they sit closer to the
// "try it" interaction.

export default function HeroScene() {
  return (
    <header
      className="paper-grain px-6 text-center relative"
      style={{
        paddingTop: 160,
        paddingBottom: 48,
        background: "var(--cream)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      {/* Soft indigo orb behind hero — picks up the gradient on "Watch it build".
          Hidden on mobile: it wastes CPU on phones for a decorative blur. */}
      <div
        aria-hidden
        className="absolute pointer-events-none hidden md:block"
        style={{
          top: "-22%",
          left: "50%",
          width: 1100,
          height: 800,
          transform: "translateX(-50%)",
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--indigo) 12%, transparent) 0%, transparent 60%)",
          filter: "blur(8px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          right: "-10%",
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--coral) 10%, transparent) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      <div className="max-w-[1180px] mx-auto relative">
        {/* Eyebrow — simple mono uppercase rule-and-text, no pill */}
        <div
          className="animate-fade-up inline-flex items-center"
          style={{
            gap: 14,
            marginBottom: 30,
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 28,
              height: 1,
              background: "var(--ink-faint)",
            }}
          />
          The AI revenue workspace
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 28,
              height: 1,
              background: "var(--ink-faint)",
            }}
          />
        </div>

        {/* Headline */}
        <h1
          className="text-display-xl animate-fade-up font-display"
          style={{
            margin: "0 auto",
            maxWidth: 980,
            color: "var(--navy)",
            letterSpacing: "-0.02em",
            // Raise only the clamp floor to 48px so the headline reads big and
            // premium on phones (was 42px). Keeping the 7.2vw term means the
            // floor applies below ~666px viewport; tablet/desktop scaling is
            // unchanged (still 7.2vw, capping at 96px).
            fontSize: "clamp(48px, 7.2vw, 96px)",
          }}
        >
          Describe a page.
          <br />
          <span className="hero-gradient-text">
            Watch it build.
          </span>
        </h1>

        {/* Subhead */}
        <p
          className="animate-fade-up"
          style={{
            margin: "30px auto 0",
            maxWidth: 660,
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--ink-soft)",
          }}
        >
          Type a prompt, paste a URL, or drop a screenshot — and get a
          real, on-brand page in{" "}
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            under a minute.
          </strong>
        </p>

      </div>
    </header>
  );
}
