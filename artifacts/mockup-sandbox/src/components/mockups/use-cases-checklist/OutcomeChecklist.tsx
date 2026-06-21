import "./_group.css";

const fontDisplay = "var(--font-display)";
const fontMono = "var(--font-mono)";

interface G {
  name: string;
  headline: string;
  items: string[];
  outcome: string;
  accent: string;
  soft: string;
  cta: { label: string; href: string };
}

const groups: G[] = [
  {
    name: "Sales",
    headline: "Personalized pages, account by account.",
    items: [
      "A tailored page for every target account",
      "Live pages embedded in 1:1 outreach",
      "The case study each buyer relates to",
      "See who viewed, and for how long",
    ],
    outcome: "Live in minutes — no design tickets.",
    accent: "var(--indigo)",
    soft: "var(--indigo-soft)",
    cta: { label: "Explore sales pages", href: "/for-sales" },
  },
  {
    name: "Marketing",
    headline: "Test everything, ship the winner.",
    items: [
      "A/B and multivariate testing built in",
      "Significance detected automatically",
      "Heatmaps and scroll depth, in the box",
      "Five variants live by Friday",
    ],
    outcome: "Smart Traffic promotes the winner for you.",
    accent: "var(--coral)",
    soft: "var(--coral-soft)",
    cta: { label: "Explore marketing pages", href: "/for-marketing" },
  },
];

function CheckSquare({ accent }: { accent: string }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        background: accent,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
        boxShadow: `0 2px 6px -2px color-mix(in srgb, ${accent} 60%, transparent)`,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5L10 17.5L20 7.5" />
      </svg>
    </span>
  );
}

export function OutcomeChecklist() {
  return (
    <section style={{ background: "var(--cream)", padding: "72px 24px", fontFamily: fontDisplay }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 52 }}>
          <div style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, color: "var(--ink-mute)", marginBottom: 18 }}>
            For the whole revenue org
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: "clamp(30px,3.4vw,42px)", lineHeight: 1.08, letterSpacing: "-0.025em", color: "var(--ink)", margin: 0 }}>
            Sales and marketing, shipping from the same canvas.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 28 }}>
          {groups.map((g) => (
            <div
              key={g.name}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.10)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ background: `linear-gradient(135deg, ${g.accent} 0%, color-mix(in srgb, ${g.accent} 78%, #000) 100%)`, padding: "22px 30px" }}>
                <span style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>{g.name}</span>
                <h3 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#fff", margin: "8px 0 0", maxWidth: 320 }}>
                  {g.headline}
                </h3>
              </div>
              <div style={{ padding: "28px 30px 30px", display: "flex", flexDirection: "column", flex: 1 }}>
                <ul style={{ display: "flex", flexDirection: "column", gap: 15, listStyle: "none", padding: 0, margin: 0 }}>
                  {g.items.map((it) => (
                    <li key={it} style={{ display: "flex", alignItems: "flex-start", gap: 13, fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>
                      <CheckSquare accent={g.accent} />
                      {it}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 22, padding: "12px 14px", borderRadius: 10, background: g.soft }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: g.accent }}>↳ {g.outcome}</span>
                </div>
                <a
                  href={g.cta.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 22,
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: "#fff",
                    background: g.accent,
                    textDecoration: "none",
                    borderRadius: 9,
                    padding: "12px 18px",
                  }}
                >
                  {g.cta.label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
