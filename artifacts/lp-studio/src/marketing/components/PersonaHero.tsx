// PersonaHero — shared hero for /features, /for-marketing and /for-sales.
// Ports the PersonaHero pattern from design-preview/marketing/solution-*.jsx.
// Text eyebrow (marker style, matching /pricing), left-aligned big headline,
// supporting subhead, primary + secondary CTAs. Sits above the FeatureRow
// stack on each page.

import PersonaToggle from "./PersonaToggle";

interface PersonaHeroProps {
  /**
   * Text eyebrow (marker style, matches /pricing) shown above the headline.
   * Omitted on the persona solution pages (/for-marketing, /for-sales), where
   * the PersonaToggle is the only element above the headline.
   */
  eyebrow?: string;
  /** Persona accent — typically var(--indigo) for marketing, var(--coral) for sales. */
  accent: string;
  title: string;
  sub: string;
  /** Secondary CTA label, e.g. "Talk to sales" (marketing) or "Book a demo" (sales). */
  secondaryLabel: string;
  secondaryHref?: string;
  /**
   * When set, renders the Clay-style Marketing | Sales persona toggle at the
   * top of the hero (above the eyebrow). The given persona is shown active.
   */
  persona?: "marketing" | "sales";
}

export default function PersonaHero({
  eyebrow,
  accent,
  title,
  sub,
  secondaryLabel,
  secondaryHref = "mailto:admin@lpstudio.ai",
  persona,
}: PersonaHeroProps) {
  // Top padding is tuned per-variant so the H1 lands at the SAME vertical
  // offset as the /pricing hero on every marketing hero page. The persona
  // toggle is taller than the text eyebrow, so toggle pages get less top
  // padding to compensate (and that nudges the toggle clear of the navbar).
  const headerPadClass = persona ? "pt-[91px] md:pt-[123px]" : "pt-28 md:pt-36";
  return (
    <header
      id="top"
      className={`px-6 paper-grain relative ${headerPadClass}`}
      style={{
        paddingBottom: 64,
        overflow: "hidden",
      }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "-15%",
          right: "-10%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 16%, transparent) 0%, transparent 65%)`,
          filter: "blur(10px)",
        }}
      />

      <div className="max-w-[1180px] mx-auto relative">
        <div style={{ maxWidth: 780 }}>
          {persona ? <PersonaToggle active={persona} /> : null}
          {eyebrow ? (
            <div className="marker marker-rule mb-6">{eyebrow}</div>
          ) : null}
          <h1
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0, maxWidth: 720 }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--ink-soft)",
              margin: "22px 0 0",
              maxWidth: 580,
            }}
          >
            {sub}
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 30,
              flexWrap: "wrap",
            }}
          >
            <a
              href="https://app.lpstudio.ai"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#fff",
                background:
                  "linear-gradient(180deg, #5C58EB 0%, #3C38B8 55%, #3F3BD3 100%)",
                fontSize: 14.5,
                fontWeight: 600,
                padding: "13px 24px",
                borderRadius: 11,
                border: "1px solid rgba(46, 42, 140, 0.55)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(46,42,140,0.40), 0 10px 24px -8px rgba(75,71,229,0.55), 0 2px 6px rgba(75,71,229,0.18)",
                textShadow: "0 1px 0 rgba(46,42,140,0.40)",
                textDecoration: "none",
                letterSpacing: "-0.005em",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
              </svg>
              Start free
            </a>
            <a
              href={secondaryHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--ink)",
                background:
                  "linear-gradient(180deg, #FFFFFF 0%, #F8F4EC 100%)",
                fontSize: 14.5,
                fontWeight: 600,
                padding: "13px 22px",
                borderRadius: 11,
                border: "1px solid rgba(26, 24, 21, 0.16)",
                boxShadow:
                  "inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(26, 24, 21, 0.04), 0 4px 12px -4px rgba(26, 24, 21, 0.10)",
                textDecoration: "none",
                letterSpacing: "-0.005em",
              }}
            >
              {secondaryLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
