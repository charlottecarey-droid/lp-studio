import { useInView } from "../hooks/useInView";

// TwoMotions — ported from design-preview/marketing/home-main.jsx TwoMotions
// function. Two side-by-side cards: For Marketing (indigo) + For Sales
// (coral), each with persona pill, title, four feature bullets, and an
// "Explore" link that points at the future solution pages. Drops into the
// /new homepage between the Brand row and the Sales Console row to give
// prospects an explicit persona-choice moment.

interface PersonaColumn {
  who: string;
  accent: string;
  tint: string;
  iconPath: string;
  title: string;
  items: string[];
  cta: string;
  href: string;
}

const COLUMNS: PersonaColumn[] = [
  {
    who: "For Marketing",
    accent: "var(--indigo)",
    tint: "var(--indigo-soft)",
    iconPath:
      "M3 11l18-5v12L3 14v-3zm0 0a3 3 0 003 3M11 6v12",
    title: "Ship campaigns without a design ticket.",
    items: [
      "Generate a full page from a prompt",
      "60+ on-brand templates by industry",
      "A/B test variants; Smart Traffic picks the winner",
      "Brand-locked blocks — on-brand the first time",
    ],
    cta: "Explore for marketing",
    href: "/for-marketing",
  },
  {
    who: "For Sales",
    accent: "var(--coral)",
    tint: "var(--coral-soft)",
    iconPath:
      "M22 12a10 10 0 11-20 0 10 10 0 0120 0zM17 12a5 5 0 11-10 0 5 5 0 0110 0z",
    title: "Personalize outreach down to the account.",
    items: [
      "An ABM command center with live signals",
      "A microsite for every account, in one click",
      "AI-drafted email from a contact brief",
      "Every send tracked end to end",
    ],
    cta: "Explore for sales",
    href: "/for-sales",
  },
];

export default function TwoMotions() {
  const { ref, inView } = useInView(0.08);

  return (
    <section
      id="motions"
      className="px-6"
      style={{
        background: "var(--cream)",
        paddingTop: 96,
        paddingBottom: 96,
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
        <div className="max-w-[640px] mb-11">
          <div className="marker marker-rule mb-5">02 / One workspace</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Marketing and sales, the same canvas.
          </h2>
          <p
            className="text-[17px] leading-[1.6] mt-4 max-w-[540px]"
            style={{ color: "var(--ink-soft)", margin: "16px 0 0" }}
          >
            One brand, one block library, one place to see what&apos;s working
            — so the whole revenue org ships on-brand without waiting on each
            other.
          </p>
        </div>

        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}
        >
          {COLUMNS.map((c) => (
            <div
              key={c.who}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 20,
                padding: "32px 32px 28px",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 22px -14px rgba(26,24,21,0.10)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  color: c.accent,
                  background: c.tint,
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: 18,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={c.iconPath} />
                </svg>
                {c.who}
              </div>
              <h3
                className="font-display"
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                  margin: "0 0 18px",
                  lineHeight: 1.1,
                  maxWidth: 360,
                }}
              >
                {c.title}
              </h3>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {c.items.map((i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 11,
                      alignItems: "flex-start",
                      fontSize: 14.5,
                      color: "var(--ink-2)",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={c.accent}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginTop: 2, flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path d="M5 12.5L10 17.5L20 7.5" />
                    </svg>
                    {i}
                  </li>
                ))}
              </ul>
              <a
                href={c.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 24,
                  fontSize: 14,
                  fontWeight: 600,
                  color: c.accent,
                  textDecoration: "none",
                }}
              >
                {c.cta}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
