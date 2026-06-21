import "./_group.css";

const fontDisplay = "var(--font-display)";
const fontMono = "var(--font-mono)";

interface Group {
  num: string;
  name: string;
  headline: string;
  items: string[];
  accent: string;
  cta: { label: string; href: string };
}

const groups: Group[] = [
  {
    num: "01",
    name: "Sales",
    headline: "A personalized page for every account.",
    items: [
      "Live pages embedded right in your 1:1 outreach",
      "The exact case study each buyer relates to",
      "Their logo and use case, not a generic deck",
      "See who viewed, and for how long",
      "No design tickets, no waiting on marketing",
    ],
    accent: "var(--indigo)",
    cta: { label: "Explore sales pages", href: "/for-sales" },
  },
  {
    num: "02",
    name: "Marketing",
    headline: "Every page on-brand, on-message, on time.",
    items: [
      "Five variants live by Friday",
      "Pull your brand from any URL — colors, fonts, logo",
      "Save your own templates and reuse them anywhere",
      "Sync to your campaigns, or send straight from LP Studio",
      "AI writes from your media library, with approved stats only",
    ],
    accent: "var(--coral)",
    cta: { label: "Explore marketing pages", href: "/for-marketing" },
  },
];

function Check({ accent }: { accent: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        border: `1.5px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        background: `color-mix(in srgb, ${accent} 8%, transparent)`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5L10 17.5L20 7.5" />
      </svg>
    </span>
  );
}

export function LedgerChecklist() {
  return (
    <section style={{ background: "var(--cream)", padding: "72px 24px", fontFamily: fontDisplay }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 56 }}>
          <div style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12, color: "var(--ink-mute)", marginBottom: 18 }}>
            For the whole revenue org
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: "clamp(30px,3.4vw,42px)", lineHeight: 1.08, letterSpacing: "-0.025em", color: "var(--ink)", margin: 0 }}>
            Sales and marketing, shipping from the same canvas.
          </h2>
          <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.55, color: "var(--ink-soft)", maxWidth: 560 }}>
            The essentials each team reaches for most — and where to dig into the rest.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 28 }}>
          {groups.map((g) => (
            <div
              key={g.name}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 18,
                padding: "34px 34px 30px",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(26,24,21,0.10)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 30, letterSpacing: "-0.04em", color: g.accent, lineHeight: 1 }}>{g.num}</span>
                <span style={{ fontFamily: fontMono, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 11, fontWeight: 600, color: g.accent }}>{g.name}</span>
              </div>
              <div style={{ height: 1, background: `linear-gradient(90deg, color-mix(in srgb, ${g.accent} 35%, transparent), transparent)`, margin: "18px 0 22px" }} />
              <h3 style={{ fontFamily: fontDisplay, fontWeight: 500, fontSize: 23, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 24px", maxWidth: 340 }}>
                {g.headline}
              </h3>
              <ul style={{ display: "flex", flexDirection: "column", gap: 15, listStyle: "none", padding: 0, margin: 0 }}>
                {g.items.map((it) => (
                  <li key={it} style={{ display: "flex", alignItems: "flex-start", gap: 13, fontSize: 15, lineHeight: 1.45, color: "var(--ink-2)" }}>
                    <Check accent={g.accent} />
                    {it}
                  </li>
                ))}
              </ul>
              <a
                href={g.cta.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 28,
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: g.accent,
                  textDecoration: "none",
                  borderBottom: `1px solid color-mix(in srgb, ${g.accent} 30%, transparent)`,
                  paddingBottom: 3,
                }}
              >
                {g.cta.label}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
