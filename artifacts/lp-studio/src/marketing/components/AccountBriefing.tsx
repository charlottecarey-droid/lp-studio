import { useInView } from "../hooks/useInView";

// AccountBriefing — surfaces the Sales Console as a first-class workflow.
// Rather than describing the Sales Console in prose, we render a faithful mini
// of the actual product chrome (dark green top nav, "Good morning" header,
// hot-accounts list, live signals strip) plus the AI Account Briefing card
// that's the killer differentiator for AEs. The dark-green chrome (#06231a)
// matches the real Sales Console so prospects recognize the surface when they
// log in — important because the Sales Console is what wedge-converts deals
// at the Mid-Market and Enterprise levels.
//
// Content is illustrative. Hot accounts are fictional ("Cobalt Systems",
// "Brightwave") to avoid leaking real customer data. The briefing copy is the
// shape the actual AI brief returns: hook, recent activity, suggested next
// step, drafted email opener.

const SC_DARK = "#06231a";
const SC_DARK_2 = "#0b2e22";

interface HotAccount {
  name: string;
  temp: "Hot" | "Warm" | "Cool";
  tempColor: string;
  tempBg: string;
  signals: string;
  activity: string;
  emoji: string;
}

const HOT_ACCOUNTS: HotAccount[] = [
  {
    name: "Cobalt Systems",
    temp: "Hot",
    tempColor: "#e0622e",
    tempBg: "#fdeee7",
    signals: "1 signal in last 2 weeks",
    activity: "email sent · 1d ago",
    emoji: "🔥",
  },
  {
    name: "Brightwave",
    temp: "Warm",
    tempColor: "#c08a1e",
    tempBg: "#fbf3df",
    signals: "2 signals in last 2 weeks",
    activity: "visitor identified · 18h ago",
    emoji: "🌡",
  },
  {
    name: "Meridian Group",
    temp: "Cool",
    tempColor: "#3a7bd0",
    tempBg: "#e8f0fb",
    signals: "4 signals in last 2 weeks",
    activity: "page view · 1h ago",
    emoji: "❄",
  },
];

export default function AccountBriefing() {
  const { ref, inView } = useInView(0.08);

  return (
    <section
      id="account-briefing"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{
        background: "var(--cream-2)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative grid md:grid-cols-[1fr_1.2fr] gap-16 items-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Left: the pitch */}
        <div>
          <div className="marker marker-rule mb-6">05 / Sales Console</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)" }}
          >
            An AI briefing on every account.<br />
            <span style={{ color: "var(--coral)" }}>Every morning.</span>
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.6] max-w-[460px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Sales doesn't open Slack and start digging for context. The Sales
            Console opens to <strong style={{ color: "var(--ink)" }}>what
            changed overnight</strong> — who clicked, who returned, which
            account is heating up — with an AI brief that synthesizes the
            signal into the next move.
          </p>

          <div className="mt-7 flex flex-col gap-3.5">
            {[
              {
                label: "Hot accounts surface themselves",
                body: "Ranked by signal velocity and conversion intent — not by who you last touched.",
              },
              {
                label: "AI brief on click",
                body: "Hook, recent activity, suggested next step, and a drafted email opener — in one place.",
              },
              {
                label: "Per-contact, per-page",
                body: "Open an account and see exactly which contacts engaged with which page surfaces.",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--coral)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginTop: 4, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <path d="M5 12.5L10 17.5L20 7.5" />
                </svg>
                <div>
                  <div
                    className="font-display"
                    style={{
                      color: "var(--ink)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      letterSpacing: "-0.012em",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: "var(--ink-soft)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      marginTop: 2,
                      maxWidth: 420,
                    }}
                  >
                    {item.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Sales Console mini */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--hairline-strong)",
            boxShadow:
              "0 30px 80px -34px rgba(6,35,26,0.35), 0 12px 28px -18px rgba(6,35,26,0.2)",
            background: "#f7f5ef",
          }}
        >
          {/* Top dark nav */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ background: SC_DARK }}
          >
            <div className="flex items-center gap-5">
              <span
                className="font-mono uppercase"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                }}
              >
                Sales Console
              </span>
              <div className="hidden md:flex items-center gap-1">
                {["Accounts", "Microsites", "Activity", "Contacts"].map((t, i) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "5px 10px",
                      borderRadius: 6,
                      color: i === 0 ? "#fff" : "rgba(255,255,255,0.6)",
                      background: i === 0 ? "rgba(255,255,255,0.10)" : "transparent",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="flex items-center gap-2"
              style={{
                background: "rgba(0,0,0,0.25)",
                borderRadius: 7,
                padding: 2,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 9px",
                  borderRadius: 5,
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 500,
                }}
              >
                Marketing
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 9px",
                  borderRadius: 5,
                  background: "var(--indigo)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                Sales
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div
                  className="font-display"
                  style={{
                    color: "#11271f",
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: "-0.022em",
                  }}
                >
                  Good morning
                </div>
                <div
                  style={{
                    color: "rgba(7,38,28,0.55)",
                    fontSize: 12.5,
                    marginTop: 2,
                  }}
                >
                  Here's what changed overnight.
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5"
                  style={{
                    background: SC_DARK,
                    color: "#fff",
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "6px 11px",
                    borderRadius: 7,
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -6px rgba(6,35,26,0.5)",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                  Account briefing
                </button>
              </div>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[
                { v: "302", l: "Accounts", hot: false },
                { v: "5", l: "Hot (2wk)", hot: true },
                { v: "3", l: "Signals today", hot: false },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-xl"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(7,38,28,0.1)",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    className="font-display"
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: s.hot ? "#e0622e" : "#11271f",
                    }}
                  >
                    {s.v}
                  </div>
                  <div
                    style={{
                      color: "rgba(7,38,28,0.55)",
                      fontSize: 11,
                      marginTop: 1,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Hot accounts list */}
            <div className="flex items-center justify-between mb-2">
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#11271f",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                🔥 Hot accounts
              </span>
              <span style={{ fontSize: 11, color: "rgba(7,38,28,0.45)" }}>
                most engaged · last 14d
              </span>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "#fff",
                border: "1px solid rgba(7,38,28,0.1)",
              }}
            >
              {HOT_ACCOUNTS.map((a, i) => (
                <div
                  key={a.name}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid rgba(7,38,28,0.07)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: a.tempColor,
                      background: a.tempBg,
                      borderRadius: 999,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.emoji} {a.temp}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#11271f",
                      }}
                    >
                      {a.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(7,38,28,0.5)",
                      }}
                    >
                      {a.signals} · {a.activity}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* The actual AI briefing card */}
            <div
              className="mt-4 rounded-xl overflow-hidden relative"
              style={{
                background: "linear-gradient(135deg, #f3eef5 0%, #ede9f5 100%)",
                border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset",
              }}
            >
              {/* sparkle gradient orb */}
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  top: -40,
                  right: -40,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, color-mix(in srgb, var(--indigo) 32%, transparent) 0%, transparent 65%)",
                  filter: "blur(8px)",
                }}
              />
              <div className="relative p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono uppercase"
                    style={{
                      color: "var(--indigo)",
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      fontWeight: 700,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l2.5 6L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.5-1z" />
                    </svg>
                    AI Briefing · Cobalt Systems
                  </span>
                  <span
                    style={{
                      color: "rgba(7,38,28,0.5)",
                      fontSize: 10.5,
                      fontFamily: "JetBrains Mono, ui-monospace, monospace",
                    }}
                  >
                    Updated 7m ago
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#11271f",
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>Why hot:</strong>{" "}
                  Jay Khimani (CEO) opened the pricing microsite 3× in the last
                  48h, then forwarded to Chandan Advani (COO).
                </div>
                <div
                  className="mt-2.5 pt-2.5"
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "#11271f",
                    borderTop:
                      "1px solid color-mix(in srgb, var(--indigo) 18%, transparent)",
                  }}
                >
                  <strong style={{ fontWeight: 600 }}>Next move:</strong>{" "}
                  Send Chandan a one-pager focused on{" "}
                  <em style={{ fontStyle: "normal", color: "var(--indigo)", fontWeight: 600 }}>
                    operations ROI
                  </em>{" "}
                  — match the page Jay engaged with most.
                </div>
                <div className="flex gap-2 mt-3.5">
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "var(--indigo)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 2 11 13" />
                      <path d="M22 2l-7 20-4-9-9-4z" />
                    </svg>
                    Draft email
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.7)",
                      color: "#11271f",
                      border: "1px solid rgba(7,38,28,0.12)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    Generate microsite
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
