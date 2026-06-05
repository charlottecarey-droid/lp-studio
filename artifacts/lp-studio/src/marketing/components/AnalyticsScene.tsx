import { useInView } from "../hooks/useInView";

// AnalyticsScene — homepage section #11. Sits AFTER IdentityWedge so
// the send → reveal → optimize arc completes. Anchors on the Page
// Detail "Conversion Score with why this score" — Mutiny shows a
// score but doesn't explain which block earned which points. LP
// Studio names the contributing blocks and offers one-click Quick
// Wins to add the missing ones.

export default function AnalyticsScene() {
  const { ref, inView } = useInView(0.05);

  return (
    <section
      id="analytics"
      className="px-6"
      style={{
        background: "var(--cream)",
        paddingTop: 96,
        paddingBottom: 96,
        borderTop: "1px solid var(--hairline)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "12%",
          right: "-12%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--sage) 14%, transparent) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Headline + narrative */}
        <div style={{ maxWidth: 760, marginBottom: 36 }}>
          <div className="marker marker-rule mb-5">11 / Analytics</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Analytics that tell you{" "}
            <em style={{ fontStyle: "normal", color: "var(--indigo)" }}>
              what to fix
            </em>
            .
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              margin: "16px 0 0",
              maxWidth: 600,
            }}
          >
            Every visitor leaves a trail. LP Studio shows you the trail,
            grades the page that captured it, and{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              tells you the exact block to add next
            </strong>{" "}
            — with the impact estimated and one click to ship it.
          </p>
        </div>

        {/* Bullets row */}
        <ul
          className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3 mb-12"
          style={{ listStyle: "none", padding: 0, margin: "0 0 36px", maxWidth: 1180 }}
        >
          {[
            "Conversion Score with named contributing blocks",
            "Heatmap + per-block click attribution",
            "Visit timeline with full click sequence",
            "Multi-touch attribution from ad to lead",
          ].map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 text-[14px] leading-[1.45]"
              style={{ color: "var(--ink-2)" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--indigo)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginTop: 4, flexShrink: 0 }}
                aria-hidden="true"
              >
                <path d="M5 12.5L10 17.5L20 7.5" />
              </svg>
              {b}
            </li>
          ))}
        </ul>

        {/* Mock: Conversion Score + Visit timeline side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ConversionScoreMock />
          <VisitTimelineMock />
        </div>
      </div>
    </section>
  );
}

// ── Conversion Score (left) ─────────────────────────────────────────────

function ConversionScoreMock() {
  const score = 82;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
      }}
    >
      {/* Chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {["#F25C54", "#E8B339", "#3DB158"].map((dot) => (
            <span
              key={dot}
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: dot,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 9px",
            minWidth: 0,
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "var(--ink-mute)",
              letterSpacing: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            app.lpstudio.ai/analytics/pages/cobalt-pilot
          </span>
        </div>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "var(--ink-mute)",
            flexShrink: 0,
          }}
        >
          last 30d
        </span>
      </div>

      <div style={{ padding: "18px 20px 20px" }}>
        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            { label: "Visits", value: "1,284", trend: "+18%" },
            { label: "Leads", value: "164", trend: "+24%" },
            { label: "CVR", value: "12.8%", trend: "+1.4 pts", indigo: true },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "8px 10px",
                background: s.indigo
                  ? "rgba(75,71,229,0.06)"
                  : "var(--cream-2)",
                border: s.indigo
                  ? "1px solid rgba(75,71,229,0.22)"
                  : "1px solid var(--hairline)",
                borderRadius: 8,
              }}
            >
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  color: "var(--ink-mute)",
                  marginBottom: 2,
                }}
              >
                {s.label}
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.018em",
                  color: s.indigo ? "var(--indigo)" : "var(--ink)",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--sage)",
                  marginTop: 3,
                  fontWeight: 600,
                  letterSpacing: 0,
                }}
              >
                {s.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Score ring + grade categories side-by-side */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 18,
            alignItems: "center",
            padding: "14px 14px 14px 4px",
            background: "var(--cream-2)",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          {/* Ring */}
          <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke="rgba(26,24,21,0.08)"
                strokeWidth="9"
              />
              <circle
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                transform="rotate(-90 65 65)"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--indigo)" />
                  <stop offset="100%" stopColor="#6C68F0" />
                </linearGradient>
              </defs>
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: 34,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.028em",
                  lineHeight: 1,
                }}
              >
                {score}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--ink-mute)",
                  letterSpacing: 0,
                }}
              >
                / 100
              </span>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  color: "var(--indigo)",
                  marginTop: 4,
                  padding: "1px 6px",
                  background: "rgba(75,71,229,0.10)",
                  borderRadius: 3,
                }}
              >
                B+
              </span>
            </div>
          </div>

          {/* Categories */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Headline Clarity", grade: "A", color: "var(--sage)" },
              { label: "CTA Effectiveness", grade: "A−", color: "var(--sage)" },
              { label: "Social Proof", grade: "D", color: "var(--coral)" },
              { label: "Form Friction", grade: "C", color: "#C8923D" },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11.5,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    background: `color-mix(in srgb, ${c.color} 14%, transparent)`,
                    color: c.color,
                    fontFamily: "'DM Sans', 'Inter', sans-serif",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {c.grade}
                </span>
                <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Wins */}
        <div>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="var(--indigo)"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Quick wins
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { wins: "Add testimonial block", impact: "+12% est. CVR" },
              { wins: "Move CTA above the fold", impact: "+8% est. CVR" },
            ].map((w) => (
              <div
                key={w.wins}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: "var(--paper)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                }}
              >
                <span style={{ flex: 1, fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>
                  {w.wins}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--sage)",
                    fontWeight: 600,
                    letterSpacing: 0,
                  }}
                >
                  {w.impact}
                </span>
                <span
                  style={{
                    padding: "4px 9px",
                    borderRadius: 6,
                    background: "color-mix(in srgb, var(--indigo) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
                    color: "var(--indigo)",
                    fontSize: 10.5,
                    fontWeight: 600,
                  }}
                >
                  + Add
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Visit timeline (right) ──────────────────────────────────────────────

function VisitTimelineMock() {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
      }}
    >
      {/* Chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {["#F25C54", "#E8B339", "#3DB158"].map((dot) => (
            <span
              key={dot}
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: dot,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 9px",
            minWidth: 0,
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "var(--ink-mute)",
              letterSpacing: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            app.lpstudio.ai/analytics/pages/cobalt-pilot · visits
          </span>
        </div>
        <span
          className="font-mono uppercase inline-flex items-center gap-1.5"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "var(--sage)",
            background: "color-mix(in srgb, var(--sage) 14%, transparent)",
            padding: "2px 7px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--sage)",
              boxShadow: "0 0 5px var(--sage)",
            }}
          />
          Live
        </span>
      </div>

      <div style={{ padding: "16px 20px 18px" }}>
        {/* Visits table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 0.7fr 70px",
            gap: 8,
            padding: "6px 10px",
            background: "var(--cream-2)",
            border: "1px solid var(--hairline)",
            borderRadius: 8,
            marginBottom: 6,
          }}
        >
          {["Visitor", "Source", "Scroll", "When"].map((h) => (
            <span
              key={h}
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--ink-mute)",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Compact row */}
        {[
          { name: "David Park", role: "CFO · Cobalt", source: "Email", scroll: 78, when: "5h ago" },
          { name: "Jay Khimani", role: "CEO · Cobalt", source: "Outreach", scroll: 64, when: "yesterday" },
        ].map((r) => (
          <div
            key={r.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.7fr 70px",
              gap: 8,
              padding: "9px 10px",
              borderBottom: "1px solid var(--hairline)",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, var(--indigo) 0%, var(--coral) 100%)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                  flexShrink: 0,
                }}
              >
                {r.name.split(" ").map((p) => p[0]).join("")}
              </span>
              <span style={{ minWidth: 0, overflow: "hidden" }}>
                <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ink-mute)",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.role}
                </span>
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{r.source}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{r.scroll}%</span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0 }}>
              {r.when}
            </span>
          </div>
        ))}

        {/* Expanded row — Sarah Chen */}
        <div
          style={{
            background: "color-mix(in srgb, var(--indigo) 5%, var(--paper))",
            border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
            borderRadius: 10,
            padding: "12px 12px 14px",
            marginTop: 6,
          }}
        >
          {/* Top row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.7fr 70px",
              gap: 8,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, var(--indigo) 0%, var(--coral) 100%)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                  flexShrink: 0,
                }}
              >
                SC
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink)",
                    fontWeight: 600,
                    display: "block",
                  }}
                >
                  Sarah Chen
                  <span
                    className="font-mono uppercase ml-1.5"
                    style={{
                      fontSize: 8.5,
                      letterSpacing: "0.18em",
                      fontWeight: 700,
                      color: "var(--sage)",
                      background:
                        "color-mix(in srgb, var(--sage) 14%, transparent)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    Lead
                  </span>
                </span>
                <span style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                  VP, Strategic Sourcing · Cobalt
                </span>
              </span>
            </div>
            <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>Outreach link</span>
            <span style={{ fontSize: 11.5, color: "var(--indigo)", fontWeight: 600 }}>94%</span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0 }}>
              2h ago
            </span>
          </div>

          {/* Click sequence */}
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 5,
            }}
          >
            Click sequence · 18 events
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { t: "0:00", e: "Page view · entered via campaign link", c: "var(--indigo)" },
              { t: "0:38", e: "Clicked hero CTA · Book a working session", c: "var(--sage)" },
              { t: "1:42", e: "Scrolled to pricing section · 78% depth", c: "#8967D0" },
              { t: "3:11", e: "Clicked See pricing", c: "var(--sage)" },
              { t: "3:54", e: "Booked demo · routed to AE", c: "var(--coral)", bold: true },
            ].map((step) => (
              <div
                key={step.e}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: step.bold
                    ? "color-mix(in srgb, var(--coral) 10%, var(--paper))"
                    : "var(--paper)",
                  border: step.bold
                    ? "1px solid color-mix(in srgb, var(--coral) 32%, transparent)"
                    : "1px solid var(--hairline)",
                  borderRadius: 6,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9.5,
                    color: "var(--ink-mute)",
                    width: 32,
                    flexShrink: 0,
                    letterSpacing: 0,
                  }}
                >
                  {step.t}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: step.c,
                    boxShadow: step.bold ? `0 0 6px ${step.c}` : undefined,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    color: step.bold ? "var(--ink)" : "var(--ink-2)",
                    fontWeight: step.bold ? 600 : 500,
                    letterSpacing: "-0.003em",
                  }}
                >
                  {step.e}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
