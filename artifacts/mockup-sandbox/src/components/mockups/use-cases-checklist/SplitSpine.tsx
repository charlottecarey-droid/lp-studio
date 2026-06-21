import "./_group.css";

const fontDisplay = "var(--font-display)";
const fontMono = "var(--font-mono)";

interface Side {
  name: string;
  headline: string;
  items: string[];
  accent: string;
  soft: string;
  cta: { label: string; href: string };
}

const sales: Side = {
  name: "Sales",
  headline: "Personalized pages, account by account.",
  items: [
    "A tailored page for every target account",
    "Live pages embedded in 1:1 outreach",
    "The case study each buyer relates to",
    "See who viewed, and for how long",
    "No design tickets, no waiting",
  ],
  accent: "var(--indigo)",
  soft: "var(--indigo-soft)",
  cta: { label: "Explore sales pages", href: "/for-sales" },
};

const marketing: Side = {
  name: "Marketing",
  headline: "Test everything, ship the winner.",
  items: [
    "A/B and multivariate testing built in",
    "Smart Traffic routes to the winner",
    "Significance detected automatically",
    "Heatmaps and scroll depth, in the box",
    "Five variants live by Friday",
  ],
  accent: "var(--coral)",
  soft: "var(--coral-soft)",
  cta: { label: "Explore marketing pages", href: "/for-marketing" },
};

function Column({ d }: { d: Side }) {
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0, padding: "36px 36px 34px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: d.soft, marginBottom: 20 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: d.accent }} />
        <span style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.16em", fontSize: 11, fontWeight: 600, color: d.accent }}>{d.name}</span>
      </div>
      <h3 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 22px", maxWidth: 300 }}>
        {d.headline}
      </h3>
      <ul style={{ display: "flex", flexDirection: "column", gap: 14, listStyle: "none", padding: 0, margin: 0 }}>
        {d.items.map((it) => (
          <li key={it} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 14.5, lineHeight: 1.4, color: "var(--ink-2)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={d.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true">
              <path d="M5 12.5L10 17.5L20 7.5" />
            </svg>
            {it}
          </li>
        ))}
      </ul>
      <a
        href={d.cta.href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          marginTop: 26,
          fontSize: 14,
          fontWeight: 600,
          color: d.accent,
          textDecoration: "none",
          background: `color-mix(in srgb, ${d.accent} 8%, transparent)`,
          border: `1px solid color-mix(in srgb, ${d.accent} 24%, transparent)`,
          borderRadius: 8,
          padding: "9px 15px",
        }}
      >
        {d.cta.label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

export function SplitSpine() {
  return (
    <section style={{ background: "var(--cream)", padding: "72px 24px", fontFamily: fontDisplay }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 48 }}>
          <div style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, color: "var(--ink-mute)", marginBottom: 18 }}>
            For the whole revenue org
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: "clamp(30px,3.4vw,42px)", lineHeight: 1.08, letterSpacing: "-0.025em", color: "var(--ink)", margin: 0 }}>
            Sales and marketing, shipping from the same canvas.
          </h2>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 20,
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 36px -20px rgba(26,24,21,0.16)",
            overflow: "hidden",
            display: "flex",
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, var(--indigo) 0%, var(--indigo) 50%, var(--coral) 50%, var(--coral) 100%)",
            }}
          />
          <Column d={sales} />
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--hairline)" }} />
          <Column d={marketing} />
        </div>
      </div>
    </section>
  );
}
