import { useInView } from "../hooks/useInView";

// CampaignsScene — /for-marketing section #03 (sits between Generate
// at #02 and Templates at #04). Tells the orchestration + backflow
// story: build the audience and attach per-account microsites in LP
// Studio, push the tokenized list to Marketo/HubSpot/SFDC/Sheets to
// fire the send, then watch engagement signals flow back into the
// user's CRM and Slack channels — because URLs are tokenized at
// list-build time, not send time.
//
// Mock is a side-by-side: Campaign Wizard (left) with 3 steps and the
// Push-To step active showing a 6-platform picker; Engagement Signals
// (right) showing live stats + one expanded high-intent prospect with
// a click sequence ending on a named forward, then a "Pushed back to
// your stack" panel showing the signal being routed to Salesforce,
// Marketo, and a Slack alert in #revenue-signals.
//
// Used only on /for-marketing — NOT on the homepage. The homepage's
// send → reveal → optimize story is carried by IdentityWedge +
// AnalyticsScene; CampaignsScene used to sit between them and was
// pulled out so the orchestration story has room to breathe on the
// persona page where it actually belongs.

export default function CampaignsScene() {
  const { ref, inView } = useInView(0.05);

  return (
    <section
      id="campaigns"
      className="px-6 py-28 md:py-36"
      style={{
        background: "var(--cream)",
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
          top: "8%",
          left: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.10) 0%, transparent 65%)",
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
          <div className="marker marker-rule mb-5">03 / Campaigns</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Tokenize once.{" "}
            <em style={{ fontStyle: "normal", color: "var(--indigo)" }}>
              Send from anywhere.
            </em>
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              margin: "16px 0 0",
              maxWidth: 640,
            }}
          >
            Build the audience and attach per-account microsites in LP
            Studio. Push the tokenized list to Marketo, HubSpot, Salesforce,
            or Sheets to fire the send.{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              Engagement signals flow back into your CRM and your Slack
              channels — every click pinned to the named person.
            </strong>
          </p>
        </div>

        {/* Bullets row — 1-col on mobile, 2-col on sm, 4-col on md+ */}
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mb-12"
          style={{ listStyle: "none", padding: 0, margin: "0 0 36px", maxWidth: 1180 }}
        >
          {[
            "Build the audience from CRM segments",
            "Attach per-account microsites in one click",
            "Push to Marketo · HubSpot · SFDC · Sheets",
            "Signals route to CRM + Slack alerts",
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

        {/* Mock: orchestration wizard + engagement signals side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WizardMock />
          <EngagementSignalsMock />
        </div>
      </div>
    </section>
  );
}

// ── Shared chrome bar ───────────────────────────────────────────────────

function ChromeBar({
  url,
  status,
  statusColor,
  statusPulse,
}: {
  url: string;
  status?: string;
  statusColor?: string;
  statusPulse?: boolean;
}) {
  return (
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
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
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
          {url}
        </span>
      </div>
      {status && (
        <span
          className="font-mono uppercase inline-flex items-center gap-1.5"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: statusColor ?? "var(--ink-mute)",
            background: statusColor
              ? `color-mix(in srgb, ${statusColor} 14%, transparent)`
              : "var(--cream-2)",
            padding: "2px 7px",
            borderRadius: 4,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {statusPulse && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: statusColor ?? "var(--sage)",
                boxShadow: `0 0 5px ${statusColor ?? "var(--sage)"}`,
              }}
            />
          )}
          {status}
        </span>
      )}
    </div>
  );
}

const CARD_SHELL: React.CSSProperties = {
  background: "var(--paper)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.7) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
};

// ── Left: Campaign Wizard (orchestration) ───────────────────────────────

const PLATFORMS: { name: string; color: string; selected?: boolean }[] = [
  { name: "Marketo", color: "#5C4C9F", selected: true },
  { name: "HubSpot", color: "#FF7A59" },
  { name: "Salesforce", color: "#00A1E0" },
  { name: "Sheets", color: "#0F9D58" },
  { name: "Resend", color: "#0F1217" },
  { name: "Webhook", color: "var(--ink-mute)" },
];

function WizardMock() {
  return (
    <div style={CARD_SHELL}>
      <ChromeBar
        url="app.lpstudio.ai/sales/campaigns/new"
        status="Step 3 of 3"
        statusColor="var(--indigo)"
      />

      <div style={{ padding: "16px 18px 18px" }}>
        {/* Eyebrow */}
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "var(--ink-mute)",
            marginBottom: 12,
          }}
        >
          Campaign Wizard · Q3 Expansion
        </div>

        {/* Step 1 — Audience (complete) */}
        <WizardStep n="1" label="Audience" state="complete">
          <div
            style={{
              padding: "9px 11px",
              background: "var(--cream-2)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "rgba(0,161,224,0.14)",
                color: "#00A1E0",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'DM Sans', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 10,
                flexShrink: 0,
              }}
            >
              SF
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.005em",
                }}
              >
                Q3 Expansion Accounts
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--ink-mute)",
                  letterSpacing: 0,
                  marginTop: 1,
                }}
              >
                Salesforce · active accts · open opps
              </div>
            </div>
            <span
              className="font-display"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.014em",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              1,240
              <span
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--ink-mute)",
                  fontWeight: 500,
                  marginLeft: 3,
                  letterSpacing: 0,
                }}
              >
                ct
              </span>
            </span>
          </div>
        </WizardStep>

        {/* Step 2 — Templates (complete) */}
        <WizardStep n="2" label="Templates" state="complete">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            {[
              {
                title: "Executive Brief",
                kind: "Microsite",
                swatch:
                  "linear-gradient(135deg, var(--indigo) 0%, #6C68F0 100%)",
              },
              {
                title: "Product Teaser",
                kind: "Landing",
                swatch:
                  "linear-gradient(135deg, var(--coral) 0%, #F4A172 100%)",
              },
            ].map((t) => (
              <div
                key={t.title}
                style={{
                  padding: "8px 10px",
                  background: "var(--cream-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 18,
                    borderRadius: 4,
                    background: t.swatch,
                    flexShrink: 0,
                    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    className="font-mono uppercase"
                    style={{
                      fontSize: 8.5,
                      letterSpacing: "0.16em",
                      fontWeight: 700,
                      color: "var(--ink-mute)",
                    }}
                  >
                    {t.kind}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WizardStep>

        {/* Step 3 — Push to (active) */}
        <WizardStep n="3" label="Push to" state="active">
          <div
            style={{
              padding: "8px",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--indigo) 4%, var(--paper)) 0%, var(--paper) 100%)",
              border:
                "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 5,
              }}
            >
              {PLATFORMS.map((p) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 9px",
                    background: p.selected
                      ? "var(--paper)"
                      : "color-mix(in srgb, var(--ink) 2%, var(--paper))",
                    border: p.selected
                      ? `1px solid color-mix(in srgb, ${p.color} 45%, transparent)`
                      : "1px solid var(--hairline)",
                    borderRadius: 7,
                    boxShadow: p.selected
                      ? `0 4px 10px -6px color-mix(in srgb, ${p.color} 40%, transparent), 0 0 0 2px color-mix(in srgb, ${p.color} 10%, transparent)`
                      : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 999,
                      border: p.selected
                        ? `3px solid ${p.color}`
                        : "1.5px solid var(--hairline-strong)",
                      background: p.selected ? "var(--paper)" : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: p.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11.5,
                      fontWeight: p.selected ? 600 : 500,
                      color: p.selected ? "var(--ink)" : "var(--ink-2)",
                      letterSpacing: "-0.005em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </span>
                  {p.selected && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={p.color}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12.5L10 17.5L20 7.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </WizardStep>

        {/* Push CTA footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 11.5,
              color: "var(--ink-mute)",
            }}
          >
            <strong style={{ color: "var(--ink-2)", fontWeight: 600 }}>
              1,240
            </strong>{" "}
            tokenized URLs ready
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, var(--indigo) 0%, #4340D2 100%)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              boxShadow:
                "0 6px 14px -6px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            Push to Marketo
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function WizardStep({
  n,
  label,
  state,
  children,
}: {
  n: string;
  label: string;
  state: "complete" | "active";
  children: React.ReactNode;
}) {
  const isActive = state === "active";
  return (
    <div style={{ marginBottom: 11 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: isActive
              ? "var(--indigo)"
              : "color-mix(in srgb, var(--sage) 18%, var(--paper))",
            color: isActive ? "#fff" : "var(--sage)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Sans', 'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 10,
            flexShrink: 0,
            border: isActive
              ? "1px solid var(--indigo)"
              : "1px solid color-mix(in srgb, var(--sage) 32%, transparent)",
          }}
        >
          {isActive ? (
            n
          ) : (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5L10 17.5L20 7.5" />
            </svg>
          )}
        </span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: isActive ? "var(--indigo)" : "var(--ink-mute)",
          }}
        >
          {label}
        </span>
        {isActive && (
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "var(--indigo)",
              background: "color-mix(in srgb, var(--indigo) 10%, transparent)",
              padding: "1px 5px",
              borderRadius: 3,
            }}
          >
            Active
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Right: Engagement Signals (live) ────────────────────────────────────

function EngagementSignalsMock() {
  return (
    <div style={CARD_SHELL}>
      <ChromeBar
        url="app.lpstudio.ai/sales/campaigns/q3-expansion"
        status="Live · 24h"
        statusColor="var(--sage)"
        statusPulse
      />

      <div style={{ padding: "16px 18px 18px" }}>
        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {[
            { label: "Opens", value: "487", trend: "+38%" },
            { label: "Clicks", value: "142", trend: "+78%" },
            { label: "Hot", value: "8", trend: "live", indigo: true },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "7px 9px",
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
                  color: s.indigo ? "var(--indigo)" : "var(--sage)",
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

        {/* Section label */}
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 9,
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
            fill="none"
            stroke="var(--indigo)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
          High-intent prospect · live
        </div>

        {/* Expanded Michael Chen row */}
        <div
          style={{
            background: "color-mix(in srgb, var(--indigo) 5%, var(--paper))",
            border:
              "1px solid color-mix(in srgb, var(--indigo) 24%, transparent)",
            borderRadius: 10,
            padding: "11px 12px 12px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background:
                    "linear-gradient(135deg, var(--indigo) 0%, var(--coral) 100%)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Sans', 'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  flexShrink: 0,
                }}
              >
                MC
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    Michael Chen
                  </span>
                  <span
                    style={{
                      padding: "1px 6px",
                      background: "rgba(75,71,229,0.1)",
                      border: "1px solid rgba(75,71,229,0.28)",
                      borderRadius: 999,
                      color: "var(--indigo)",
                      fontWeight: 600,
                      fontSize: 9.5,
                      fontFamily: "'DM Sans', 'Inter', sans-serif",
                    }}
                  >
                    98
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-mute)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  VP Sales · TechFlow
                </div>
              </div>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: "var(--sage)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                whiteSpace: "nowrap",
                letterSpacing: 0,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: "var(--sage)",
                  boxShadow: "0 0 6px var(--sage)",
                }}
              />
              active now
            </span>
          </div>

          {/* Click sequence */}
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 8.5,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 4,
            }}
          >
            Click sequence · 12 events
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              {
                t: "0:00",
                e: "Opened email · via Marketo",
                c: "#5C4C9F",
              },
              {
                t: "2:42",
                e: "Clicked pricing · 87% scroll",
                c: "var(--sage)",
              },
              {
                t: "4:08",
                e: "Forwarded → David Park (CTO, TechFlow)",
                c: "var(--coral)",
                bold: true,
              },
            ].map((step) => (
              <div
                key={step.e}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 9px",
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
                    fontSize: 9,
                    color: "var(--ink-mute)",
                    width: 26,
                    flexShrink: 0,
                    letterSpacing: 0,
                  }}
                >
                  {step.t}
                </span>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: step.c,
                    boxShadow: step.bold ? `0 0 6px ${step.c}` : undefined,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 10.5,
                    color: step.bold ? "var(--ink)" : "var(--ink-2)",
                    fontWeight: step.bold ? 600 : 500,
                    letterSpacing: "-0.003em",
                    minWidth: 0,
                  }}
                >
                  {step.e}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pushed back to your stack panel */}
        <div
          style={{
            marginTop: 11,
            padding: "10px 11px 11px",
            background:
              "linear-gradient(180deg, rgba(75,71,229,0.04) 0%, rgba(75,71,229,0) 100%)",
            border: "1px solid rgba(75,71,229,0.18)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--indigo)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 14l-5-5 5-5M4 9h12a5 5 0 0 1 0 10h-1" />
            </svg>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                fontWeight: 700,
                color: "var(--indigo)",
              }}
            >
              Pushed back to your stack
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {/* Salesforce */}
            <BackflowRow
              tile={{ label: "SF", color: "#00A1E0" }}
              text="Activity logged on Michael Chen · score 98"
            />
            {/* Marketo */}
            <BackflowRow
              tile={{ label: "M", color: "#5C4C9F" }}
              text="Lead score synced · added to Hot Outbound list"
            />

            {/* Slack message preview */}
            <SlackAlertCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function BackflowRow({
  tile,
  text,
}: {
  tile: { label: string; color: string };
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 9px",
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 6,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          background: `color-mix(in srgb, ${tile.color} 14%, transparent)`,
          color: tile.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', 'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 9.5,
          flexShrink: 0,
        }}
      >
        {tile.label}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 10.5,
          color: "var(--ink-2)",
          letterSpacing: "-0.003em",
        }}
      >
        {text}
      </span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--sage)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M5 12.5L10 17.5L20 7.5" />
      </svg>
    </div>
  );
}

function SlackAlertCard() {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--paper)",
        border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
        borderRadius: 7,
        boxShadow: "0 0 0 1px rgba(75,71,229,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 5,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: "#4A154B",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Sans', 'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 10,
          }}
        >
          #
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.005em",
          }}
        >
          #revenue-signals
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            color: "var(--ink-mute)",
            letterSpacing: 0,
          }}
        >
          · LP Studio · just now
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 7,
        }}
      >
        <span
          style={{
            fontSize: 12,
            flexShrink: 0,
            lineHeight: 1.1,
          }}
          aria-hidden="true"
        >
          🔥
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink)",
              lineHeight: 1.35,
            }}
          >
            <strong style={{ fontWeight: 600 }}>Michael Chen</strong> (VP
            Sales · TechFlow) is on Executive Brief · score 98
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: "var(--ink-mute)",
              marginTop: 2,
            }}
          >
            Forwarded to a CTO 30 sec ago
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
        <span
          style={{
            padding: "3px 8px",
            background: "rgba(75,71,229,0.1)",
            color: "var(--indigo)",
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 4,
            letterSpacing: "-0.005em",
          }}
        >
          Open in LP Studio
        </span>
        <span
          style={{
            padding: "3px 8px",
            background: "rgba(15,18,23,0.05)",
            color: "var(--ink-2)",
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 4,
            letterSpacing: "-0.005em",
          }}
        >
          Route to AE
        </span>
      </div>
    </div>
  );
}
