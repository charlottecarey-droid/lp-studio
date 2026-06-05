import { useInView } from "../hooks/useInView";

// ComparisonRow — slim 8-row competitive matrix ported from
// design-preview/marketing/home-main.jsx Comparison(). Sits in the /new
// homepage flow as section 06 / Why LP Studio: "The demo magic, minus the
// wait." Not as detailed as the /compare page (no head-to-head cards, no
// migration steps) — this is the on-page proof that lands the differentiator
// quickly before prospects scroll on to pricing.

const COLS = ["LP Studio", "Webflow", "Unbounce", "Mutiny"];

type Cell = true | false | "partial";

const ROWS: [string, Cell[]][] = [
  ["AI page generation", [true, false, "partial", true]],
  ["On-brand by default (brand import)", [true, false, false, "partial"]],
  ["60+ industry templates", [true, "partial", true, false]],
  ["A/B + Smart Traffic", [true, false, true, false]],
  ["Sales Console (ABM)", [true, false, false, false]],
  ["Per-account microsites", [true, false, false, true]],
  ["Per-recipient identity (deterministic)", [true, false, false, false]],
  ["Mid-market pricing", [true, "partial", true, false]],
];

function Mark({ v, hl }: { v: Cell; hl?: boolean }) {
  return (
    <td
      style={{
        textAlign: "center",
        padding: "14px 12px",
        background: hl ? "rgba(75,71,229,0.05)" : "transparent",
        borderLeft: hl ? "1px solid rgba(75,71,229,0.16)" : undefined,
        borderRight: hl ? "1px solid rgba(75,71,229,0.16)" : undefined,
      }}
    >
      {v === true ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke={hl ? "var(--indigo)" : "var(--sage)"}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-label="Yes"
          style={{ display: "inline-block" }}
        >
          <path d="M5 12.5L10 17.5L20 7.5" />
        </svg>
      ) : v === "partial" ? (
        <span
          style={{
            fontSize: 11.5,
            color: "var(--ink-mute)",
            fontWeight: 500,
          }}
        >
          partial
        </span>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-label="No"
          style={{ display: "inline-block" }}
        >
          <path d="M5 12h14" />
        </svg>
      )}
    </td>
  );
}

export default function ComparisonRow() {
  const { ref, inView } = useInView(0.06);
  return (
    <section
      id="why"
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
        <div style={{ maxWidth: 640, marginBottom: 36 }}>
          <div className="marker marker-rule mb-5">06 / Why LP Studio</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            The demo magic, minus the wait.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              margin: "16px 0 0",
              maxWidth: 560,
            }}
          >
            Mutiny&apos;s magic, the on-brand pages Webflow makes you wait on
            designers for, and the Sales Console none of them have — at a
            price a Director of Demand Gen can sign off on.
          </p>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 22px -14px rgba(26,24,21,0.10)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 560,
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "16px 22px",
                    fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    fontWeight: 600,
                    color: "var(--ink-mute)",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Capability
                </th>
                {COLS.map((c, i) => (
                  <th
                    key={c}
                    style={{
                      padding: "16px 12px",
                      fontFamily:
                        "DM Sans, ui-sans-serif, system-ui, sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      textAlign: "center",
                      color: i === 0 ? "var(--indigo)" : "var(--ink-soft)",
                      background:
                        i === 0 ? "rgba(75,71,229,0.05)" : "transparent",
                      borderLeft:
                        i === 0 ? "1px solid rgba(75,71,229,0.16)" : undefined,
                      borderRight:
                        i === 0 ? "1px solid rgba(75,71,229,0.16)" : undefined,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, vals], ri) => (
                <tr
                  key={label}
                  style={{
                    borderTop: ri ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <td
                    style={{
                      textAlign: "left",
                      padding: "13px 22px",
                      color: "var(--ink-2)",
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </td>
                  {vals.map((v, i) => (
                    <Mark key={i} v={v} hl={i === 0} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: "var(--ink-mute)",
            }}
          >
            Reflects each product&apos;s mid-market plan as of June 2026.
          </span>
          <a
            href="/compare"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--indigo)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            See the full comparison
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
