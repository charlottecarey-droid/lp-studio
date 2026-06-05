import { Fragment, type CSSProperties } from "react";
import Navbar from "../components/Navbar";
import FinalCta from "../components/FinalCta";
import Footer from "../components/Footer";
import { useInView } from "../hooks/useInView";
import { usePageMeta } from "../hooks/usePageMeta";

// /compare — ported from design-preview/marketing/comparison.jsx. A grouped
// capability matrix + honest head-to-head cards (where each competitor wins
// and where LP Studio does) + a 3-step migration note. Faithful to the
// source ordering and copy; LP Studio column highlighted.

const COMPARE_COLS = ["LP Studio", "Webflow", "Unbounce", "Mutiny"];

// Brand accents used for column tints, head-to-head mark circles, and the
// hero "comparing against" strip. Picked from each brand's primary color
// (the marketing mention is fair-use editorial — no logos reproduced).
const BRAND_ACCENTS: Record<string, { color: string; soft: string; mark: string }> = {
  "LP Studio": { color: "#4B47E5", soft: "rgba(75,71,229,0.05)", mark: "LP" },
  "Webflow":   { color: "#146EF5", soft: "rgba(20,110,245,0.05)", mark: "Wf" },
  "Unbounce":  { color: "#FF7A30", soft: "rgba(255,122,48,0.06)",  mark: "Ub" },
  "Mutiny":    { color: "#7B5BD8", soft: "rgba(123,91,216,0.05)",  mark: "Mu" },
};

type Cell = true | false | "partial";

// Group icon paths — small monoline glyph per category, set in the
// group-header row of the matrix to break up the table visually.
type CompareGroup = {
  group: string;
  iconPath: string;
  rows: [string, Cell[]][];
};

const COMPARE_GROUPS: CompareGroup[] = [
  {
    group: "Building pages",
    iconPath: "M3 4h18v12H3zM3 20h18M9 16v4M15 16v4",
    rows: [
      ["AI page generation from a prompt", [true, "partial", "partial", true]],
      ["Paste a URL or screenshot to start", [true, false, false, false]],
      ["100+ industry templates", [true, true, true, false]],
      ["Visual block builder", [true, true, true, "partial"]],
      ["Custom code / dev extensibility", ["partial", true, "partial", false]],
    ],
  },
  {
    group: "Staying on-brand",
    iconPath: "M12 3l3 6 6 1-4.5 4 1 6L12 17l-5.5 3 1-6L3 10l6-1z",
    rows: [
      ["One-click brand import (site → tokens)", [true, false, false, false]],
      ["Brand-locked blocks", [true, "partial", false, true]],
      ["Approved-facts mode for AI copy", [true, false, false, false]],
      ["Approvals + roles", [true, "partial", false, true]],
    ],
  },
  {
    group: "Converting & personalizing",
    iconPath:
      "M22 12h-4l-3 9L9 3l-3 9H2",
    rows: [
      ["A/B testing", [true, false, true, false]],
      ["Auto-route to winning variant", [true, false, true, false]],
      ["Sales Console (ABM command center)", [true, false, false, false]],
      ["Per-account microsites", [true, false, false, true]],
      ["Per-recipient identity (deterministic)", [true, false, false, false]],
      ["AI outreach drafting", [true, false, false, "partial"]],
      ["CRM sync (Salesforce / Marketo)", [true, "partial", "partial", true]],
    ],
  },
  {
    group: "Commercials",
    iconPath:
      "M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
    rows: [
      ["Free tier", [true, true, false, true]],
      ["Mid-market pricing", [true, "partial", true, false]],
      ["Self-serve setup (no sales call)", [true, true, true, "partial"]],
    ],
  },
];

const HEAD_TO_HEAD = [
  {
    name: "vs Webflow",
    tag: "The designer's tool",
    theirs:
      "Webflow is the most powerful visual web design tool there is — pixel-perfect, infinitely flexible, great for a marketing site you'll tend for years.",
    ours: "But it assumes a designer. When demand gen needs 40 ABM pages this quarter, that flexibility becomes a queue. LP Studio generates on-brand pages in minutes and never blocks on a designer.",
    win: "Pick LP Studio when speed and volume matter more than bespoke design.",
  },
  {
    name: "vs Unbounce",
    tag: "Generic landing pages",
    theirs:
      "Unbounce pioneered the marketing-owned landing page with solid A/B testing and a deep template library.",
    ours: "But its pages look like landing pages, not like your brand — and it stops at marketing. LP Studio is on-brand by default and carries the same canvas into the Sales Console.",
    win: "Pick LP Studio when on-brand fidelity and a sales motion matter.",
  },
  {
    name: "vs Mutiny",
    tag: "Account-level personalization",
    theirs:
      "Mutiny is excellent at account-based web personalization. Their April 2026 agentic rebuild made it powerful for large enterprise teams with 50K+ target accounts.",
    ours: "But Mutiny resolves identity at the account level (reverse-IP, Outreach/Salesloft cookies) — not the person. LP Studio bakes identity into the URL at send time: deterministic, per-contact, works for cold prospects who aren't in any CRM yet.",
    win: "Pick LP Studio when you care which person, not which account.",
  },
];

const HEADER_CELL: CSSProperties = {
  textAlign: "left",
  padding: "18px 22px",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontWeight: 600,
  color: "var(--ink-mute)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

function CompareCellEl({ v, hl }: { v: Cell; hl?: boolean }) {
  return (
    <td
      style={{
        textAlign: "center",
        padding: "13px 12px",
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

function CompareHero() {
  return (
    <header
      id="top"
      className="px-6 paper-grain relative"
      style={{ paddingTop: 140, paddingBottom: 56 }}
    >
      <div className="max-w-[1180px] mx-auto">
        <div style={{ maxWidth: 780 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              border: "1px solid var(--hairline-strong)",
              color: "var(--ink-soft)",
              borderRadius: 999,
              padding: "6px 14px",
              marginBottom: 26,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background:
                "linear-gradient(180deg, #FFFFFF 0%, #F8F4EC 100%)",
              boxShadow:
                "inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(26, 24, 21, 0.04)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="5" cy="6" r="3" />
              <path d="M5 9v12" />
              <path d="M19 6h-2a4 4 0 00-4 4v11" />
              <circle cx="19" cy="6" r="3" />
            </svg>
            How we compare
          </div>
          <h1
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0, maxWidth: 780 }}
          >
            An honest look at the alternatives.
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--ink-soft)",
              margin: "22px 0 0",
              maxWidth: 600,
            }}
          >
            Webflow, Unbounce and Mutiny are all good at what they do —
            we&apos;ll tell you where. Here&apos;s exactly where LP Studio
            fits, and when it&apos;s the better call.
          </p>

          {/* Comparing against — branded mark chips for each competitor */}
          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "var(--ink-mute)",
              }}
            >
              Side-by-side
            </span>
            {["Webflow", "Unbounce", "Mutiny"].map((name) => {
              const a = BRAND_ACCENTS[name];
              return (
                <span
                  key={name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 12px 5px 5px",
                    background: "var(--paper)",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: a.color,
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily:
                        "DM Sans, ui-sans-serif, system-ui, sans-serif",
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {a.mark}
                  </span>
                  {name}
                </span>
              );
            })}
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-mute)",
                marginLeft: 4,
              }}
            >
              · Last updated June 2026
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function CompareMatrix() {
  const { ref, inView } = useInView(0.06);
  return (
    <section className="px-6" style={{ paddingTop: 16, paddingBottom: 64 }}>
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
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
              minWidth: 640,
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                <th style={HEADER_CELL}>Capability</th>
                {COMPARE_COLS.map((c) => {
                  const a = BRAND_ACCENTS[c];
                  const isLP = c === "LP Studio";
                  return (
                    <th
                      key={c}
                      style={{
                        padding: "16px 12px",
                        fontFamily:
                          "DM Sans, ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: 14,
                        textAlign: "center",
                        color: isLP ? a.color : "var(--ink-2)",
                        background: a.soft,
                        borderLeft: isLP
                          ? `1px solid color-mix(in srgb, ${a.color} 18%, transparent)`
                          : undefined,
                        borderRight: isLP
                          ? `1px solid color-mix(in srgb, ${a.color} 18%, transparent)`
                          : undefined,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            background: a.color,
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily:
                              "DM Sans, ui-sans-serif, system-ui, sans-serif",
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {a.mark}
                        </span>
                        {c}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COMPARE_GROUPS.map((g) => (
                <Fragment key={g.group}>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "18px 22px 10px",
                        fontFamily:
                          "DM Sans, ui-sans-serif, system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--ink)",
                        background: "var(--cream)",
                        borderTop: "1px solid var(--hairline)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background:
                              "color-mix(in srgb, var(--indigo) 12%, transparent)",
                            color: "var(--indigo)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d={g.iconPath} />
                          </svg>
                        </span>
                        {g.group}
                      </span>
                    </td>
                  </tr>
                  {g.rows.map(([label, vals]) => (
                    <tr
                      key={label}
                      style={{ borderTop: "1px solid var(--hairline)" }}
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
                        <CompareCellEl key={i} v={v} hl={i === 0} />
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <p
          className="md:hidden"
          style={{
            fontSize: 11.5,
            color: "var(--ink-mute)",
            margin: "12px 0 0",
            textAlign: "center",
          }}
        >
          Scroll the table horizontally to compare →
        </p>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-mute)",
            margin: "16px 0 0",
            textAlign: "center",
          }}
        >
          Comparison reflects each product&apos;s typical mid-market plan as of
          June 2026. &quot;Partial&quot; means available with caveats, add-ons,
          or higher tiers.
        </p>
      </div>
    </section>
  );
}

function HeadToHead() {
  const { ref, inView } = useInView(0.06);
  return (
    <section className="px-6" style={{ padding: "56px 30px" }}>
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
          <div className="marker marker-rule" style={{ marginBottom: 18 }}>
            Head to head
          </div>
          <h2
            className="font-display text-display-md"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Where each one wins — and where we do.
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {HEAD_TO_HEAD.map((h) => {
            // Map "vs Webflow" → "Webflow" so the mark/color picks up
            const brandKey = h.name.replace(/^vs\s+/i, "");
            const a = BRAND_ACCENTS[brandKey];
            return (
            <div
              key={h.name}
              className="grid grid-cols-1 md:grid-cols-[220px_1fr_1fr] gap-6 md:gap-7"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderLeft: `4px solid ${a.color}`,
                borderRadius: 18,
                padding: "28px 30px",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 22px -14px rgba(26,24,21,0.10)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: a.color,
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily:
                        "DM Sans, ui-sans-serif, system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      letterSpacing: "-0.01em",
                      boxShadow: `0 6px 14px -6px ${a.color}`,
                    }}
                  >
                    {a.mark}
                  </span>
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  {h.name}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-mute)",
                    marginTop: 4,
                  }}
                >
                  {h.tag}
                </div>
              </div>
              <div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-mute)",
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  Where they&apos;re strong
                </div>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  {h.theirs}
                </p>
              </div>
              <div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--indigo)",
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  Where LP Studio wins
                </div>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--ink-2)",
                    margin: "0 0 12px",
                  }}
                >
                  {h.ours}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: "var(--ink)",
                    background: "var(--indigo-soft)",
                    borderRadius: 10,
                    padding: "10px 13px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--indigo)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginTop: 1, flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  {h.win}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Migration() {
  const { ref, inView } = useInView(0.06);
  const steps = [
    {
      iconPath: "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20",
      t: "Import your brand",
      d: "Paste your current site — we pull logos, colors, type, and voice in seconds.",
    },
    {
      iconPath:
        "M20 9h-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h2v2a2 2 0 002 2h10a2 2 0 002-2V11a2 2 0 00-2-2zM10 18H6V6h10v2H10v10zm10 2H10v-9h10v9z",
      t: "Rebuild fast",
      d: "Recreate your top pages from a prompt or a screenshot of the originals.",
    },
    {
      iconPath:
        "M5 17h14M5 17l4-4M5 17l4 4M19 7H5M19 7l-4-4M19 7l-4 4",
      t: "Point your DNS",
      d: "Map your domain, set redirects, and publish. Export to HTML any time — no lock-in.",
    },
  ];
  return (
    <section className="px-6" style={{ padding: "56px 30px" }}>
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        <div
          style={{
            background: "var(--tint-lavender)",
            border:
              "1px solid color-mix(in srgb, var(--indigo) 16%, transparent)",
            borderRadius: 22,
            padding: "40px 40px 36px",
          }}
        >
          <div style={{ maxWidth: 580, marginBottom: 28 }}>
            <div className="marker marker-rule" style={{ marginBottom: 16 }}>
              Switching
            </div>
            <h2
              className="font-display text-display-md"
              style={{ color: "var(--ink)", margin: 0 }}
            >
              Moving over takes an afternoon.
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--ink-soft)",
                margin: "14px 0 0",
              }}
            >
              No re-platforming project. No designer backlog. And no lock-in
              — your pages export to clean HTML whenever you want.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {steps.map((s, i) => (
              <div
                key={s.t}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 14,
                  padding: "22px 22px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--indigo-soft)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--indigo)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={s.iconPath} />
                    </svg>
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 11, color: "var(--ink-mute)" }}
                  >
                    0{i + 1}
                  </span>
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                    marginBottom: 6,
                  }}
                >
                  {s.t}
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ComparePage() {
  usePageMeta({
    title: "Compare LP Studio vs Webflow, Unbounce, and Mutiny",
    description:
      "An honest comparison. Where Webflow, Unbounce, and Mutiny are strong — and exactly when LP Studio is the better call.",
    canonical: "https://lpstudio.ai/compare",
    ogImage: "https://lpstudio.ai/opengraph.jpg",
    ogImageWidth: 1280,
    ogImageHeight: 720,
    ogImageType: "image/jpeg",
    ogImageAlt: "LP Studio comparison",
    siteName: "LP Studio",
  });

  return (
    <div
      style={{
        background: "var(--cream)",
        color: "var(--ink)",
        minHeight: "100vh",
      }}
    >
      <Navbar />
      <main>
        <CompareHero />
        <CompareMatrix />
        <HeadToHead />
        <Migration />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
