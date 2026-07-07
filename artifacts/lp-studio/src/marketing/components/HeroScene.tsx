// HeroScene — editorial hero, restyled July 2026 toward the scroll-saga
// look: single soft indigo halo + scroll-saga display scale (tight tracking,
// 0.95 leading). The indigo→coral gradient on the accent line is a keeper
// (Charlotte's call). CTAs live below the PromptCard in the next section so
// they sit closer to the "try it" interaction; the HeroShowcase visual
// follows the prompt card.

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
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--indigo) 14%, transparent) 0%, transparent 62%)",
          filter: "blur(24px)",
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
          {/* The side rules hide on mobile: the longer audience line wraps
              there and stray mid-height rules read as a glitch. */}
          <span
            aria-hidden
            className="hidden sm:inline-block"
            style={{
              width: 28,
              height: 1,
              background: "var(--ink-faint)",
            }}
          />
          SKIP THE BRIEF. SHIP THE PAGE
          <span
            aria-hidden
            className="hidden sm:inline-block"
            style={{
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
            maxWidth: 1040,
            color: "var(--navy)",
            // Scroll-saga type scale: bigger, tighter, denser — the single
            // fastest premium cue. The indigo→coral gradient on the accent
            // line stays — Charlotte likes the rainbow.
            letterSpacing: "-0.045em",
            lineHeight: 0.95,
            fontWeight: 600,
            fontSize: "clamp(52px, 8.3vw, 104px)",
          }}
        >
          Describe a page.
          <br />
          <span className="hero-gradient-text">Watch it build.</span>
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
            textWrap: "balance",
          }}
        >
          Type a prompt, paste a URL, or drop a screenshot — and get a
          real, on-brand page in under a minute.
        </p>

      </div>
    </header>
  );
}
