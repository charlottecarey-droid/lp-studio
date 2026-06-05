import { useState, type CSSProperties } from "react";

// SalesConsoleEmbed — the full Sales Console UI ported from
// design-preview/ui_kits/app/SalesConsole.jsx into TSX. Lives inside a
// BrowserFrame on the new homepage so prospects see the actual surface they'd
// open in the app: dark-green top nav, hot accounts list, live signals strip,
// quick-access tiles, and the AI Account Briefing dropdown card that's the
// killer differentiator for AEs.
//
// Differences from the JSX source:
//   - Inline SVG icons (no Lucide / no window.lucide dependency)
//   - Explicit React state for the AI brief dropdown so it actually opens
//     when you click "Account briefing" — that's the Charlotte-flagged
//     interaction we want visible at first glance
//   - Brand-mode toggle is decorative (the marketing demo doesn't need to
//     actually switch modes)

const SC_DARK = "#06231a";

interface IconProps {
  size?: number;
  style?: CSSProperties;
}

// Inline icons used in the embed — drawn from Lucide vocabulary, kept tight
// so the dependency surface stays zero.
function I({
  d,
  size = 16,
  style,
}: { d: string; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICON: Record<string, string> = {
  "building-2": "M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18ZM6 12H4a2 2 0 00-2 2v8h4ZM18 9h2a2 2 0 012 2v11h-4ZM10 6h4M10 10h4M10 14h4M10 18h4",
  globe: "M2 12h20",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2",
  wrench: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  "chevron-down": "M6 9l6 6 6-6",
  settings: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z",
  megaphone: "M3 11l18-5v12L3 14v-3zm0 0a3 3 0 003 3M11 6v12",
  target: "M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
  plus: "M12 5v14M5 12h14",
  brain: "M12 5a3 3 0 10-5.997.125 4 4 0 00-2.526 5.77 4 4 0 00.556 6.588A4 4 0 1012 18a4 4 0 105.997-2.51 4 4 0 00-2.55-5.78A3 3 0 0012 5z",
  "user-round": "M18 20a6 6 0 00-12 0M12 7a4 4 0 100 8 4 4 0 000-8z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  "pen-line": "M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z",
  calculator: "M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01",
  "file-text": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  "sliders-horizontal": "M21 4H14M10 4H3M21 12H12M8 12H3M21 20H16M12 20H3M14 2v4M8 10v4M16 18v4",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  flame: "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z",
  thermometer: "M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z",
  snowflake: "M2 12h20M12 2v20M5 5l14 14M19 5L5 19",
  sparkles:
    "M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5zM5 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 14l.7 1.5L21 16l-1.3.5L19 18l-.7-1.5L17 16l1.3-.5z",
  "arrow-right": "M5 12h14M13 5l7 7-7 7",
  link: "M10 13a5 5 0 007 0l4-4a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-4 4a5 5 0 007 7l1-1",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6L12 13 2 6",
  x: "M18 6L6 18M6 6l12 12",
};

interface IconNamedProps extends IconProps {
  name: keyof typeof ICON | string;
}

function Icon({ name, size = 16, style }: IconNamedProps) {
  const d = ICON[name];
  if (!d) {
    // Fallback: small circle so the layout doesn't collapse if a name is wrong
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }
  return <I d={d} size={size} style={style} />;
}

function ScStat({ v, l, hot }: { v: string; l: string; hot?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        border: "1px solid rgba(7,38,28,0.1)",
        borderRadius: 14,
        padding: "18px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: hot ? "#e0622e" : "#11271f",
        }}
      >
        {v}
      </div>
      <div style={{ fontSize: 13, color: "rgba(7,38,28,0.55)", marginTop: 2 }}>
        {l}
      </div>
    </div>
  );
}

const HOT_ACCOUNTS = [
  {
    n: "Cobalt Systems",
    t: "Hot",
    c: "#e0622e",
    bg: "#fdeee7",
    sig: "1 signal in last 2 weeks",
    act: "email sent 1 day ago",
    ai: "send",
    tempIcon: "flame",
  },
  {
    n: "Brightwave",
    t: "Warm",
    c: "#c08a1e",
    bg: "#fbf3df",
    sig: "2 signals in last 2 weeks",
    act: "visitor identified · 18h ago",
    ai: "user-round",
    tempIcon: "thermometer",
  },
  {
    n: "Meridian Group",
    t: "Cool",
    c: "#3a7bd0",
    bg: "#e8f0fb",
    sig: "4 signals in last 2 weeks",
    act: "page view · 1h ago",
    ai: "eye",
    tempIcon: "snowflake",
  },
  {
    n: "Apex Logistics",
    t: "Cool",
    c: "#3a7bd0",
    bg: "#e8f0fb",
    sig: "1 signal in last 2 weeks",
    act: "visitor identified · 8d ago",
    ai: "user-round",
    tempIcon: "snowflake",
  },
];

const SIGNALS = [
  { who: "Armando Lopez", acct: "Brightwave", role: "VP of Marketing", tag: "identified", t: "18h ago", icon: "user-round" },
  { who: "Marica Vereen", acct: "Brightwave", role: "RevOps Lead", tag: "identified", t: "18h ago", icon: "user-round" },
  { who: "Priya Nair", acct: "Meridian Group", role: "Head of Demand Gen", tag: "identified", t: "18h ago", icon: "user-round" },
  { who: "Cobalt Systems", acct: "Cobalt Systems", role: "email sent", tag: "", t: "1d ago", icon: "send" },
  { who: "Alicia Lowry", acct: "Northstar Retail", role: "page view", tag: "", t: "1d ago", icon: "eye" },
];

const QUICK = [
  { i: "pen-line", l: "Draft Email" },
  { i: "send", l: "Campaigns" },
  { i: "calculator", l: "ROI Calculator" },
  { i: "file-text", l: "One-Pager" },
];

const TABS: { id: string; label: string; icon: string; caret?: boolean }[] = [
  { id: "accounts", label: "Accounts", icon: "building-2" },
  { id: "microsites", label: "Microsites", icon: "globe" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "contacts", label: "Contacts", icon: "users" },
  { id: "tools", label: "Tools", icon: "wrench", caret: true },
];

export default function SalesConsoleEmbed() {
  // Closed by default — the homepage scene wants to land on the
  // dashboard, not on a popped-open modal. The "Account briefing"
  // button shimmers (see below) to telegraph that it's interactive.
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f7f5ef",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Scoped keyframes — the Account briefing CTA shimmers to signal
          interactivity (the modal opens on click). The pulse ring fires
          on a longer beat to add a second tier of attention without
          competing with the sweep. */}
      <style>{`
        @keyframes sc-briefing-sweep {
          0%   { transform: translateX(-130%); }
          60%  { transform: translateX(160%); }
          100% { transform: translateX(160%); }
        }
        @keyframes sc-briefing-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(75,71,229,0.45), 0 1px 0 rgba(255,255,255,0.6) inset; }
          70%  { box-shadow: 0 0 0 8px rgba(75,71,229,0.00), 0 1px 0 rgba(255,255,255,0.6) inset; }
          100% { box-shadow: 0 0 0 0 rgba(75,71,229,0.00), 0 1px 0 rgba(255,255,255,0.6) inset; }
        }
      `}</style>

      {/* Backdrop — click anywhere outside to close the briefing.
          Intentionally subtle so the dashboard reads clearly through it
          (the modal is the focus, not the dimming). */}
      {briefOpen && (
        <div
          aria-hidden="true"
          onClick={() => setBriefOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(7,38,28,0.12)",
            zIndex: 4,
            cursor: "pointer",
          }}
        />
      )}

      {/* Top nav — dark green Sales Console chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
          height: 56,
          background: SC_DARK,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: "#fff",
                letterSpacing: "-0.01em",
              }}
            >
              Northwind
            </span>
            <span
              style={{
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
              }}
            >
              SALES CONSOLE
            </span>
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map((t, i) => (
              <span
                key={t.id}
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 13.5,
                  fontWeight: 500,
                  padding: "7px 13px",
                  borderRadius: 8,
                  color: i === 0 ? "#fff" : "rgba(255,255,255,0.62)",
                  background: i === 0 ? "rgba(255,255,255,0.1)" : "transparent",
                }}
              >
                <Icon name={t.icon} size={15} />
                {t.label}
                {t.caret && <Icon name="chevron-down" size={12} style={{ opacity: 0.7 }} />}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Icon name="settings" size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
          <div
            style={{
              display: "flex",
              background: "rgba(0,0,0,0.25)",
              borderRadius: 8,
              padding: 3,
              gap: 3,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                padding: "5px 11px",
                borderRadius: 6,
                color: "rgba(255,255,255,0.55)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="megaphone" size={13} /> Marketing
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: "5px 11px",
                borderRadius: 6,
                background: "var(--indigo)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="target" size={13} /> Sales
            </span>
          </div>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            C
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "28px 36px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {/* Header row + actions */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              position: "relative",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                  fontSize: 28,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  margin: 0,
                  color: "#11271f",
                }}
              >
                Good morning
              </h1>
              <p
                style={{
                  color: "rgba(7,38,28,0.55)",
                  fontSize: 14,
                  margin: "5px 0 0",
                }}
              >
                Here&apos;s what needs your attention today.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, position: "relative" }}>
              <button
                type="button"
                style={{
                  background: SC_DARK,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #051c14",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -6px rgba(6,35,26,0.45)",
                }}
              >
                <Icon name="plus" size={14} /> New microsite
              </button>
              <button
                type="button"
                onClick={() => setBriefOpen((v) => !v)}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background: briefOpen ? "var(--paper)" : "#fff",
                  color: briefOpen ? "var(--indigo)" : "var(--indigo)",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: `1px solid ${briefOpen ? "color-mix(in srgb, var(--indigo) 30%, transparent)" : "color-mix(in srgb, var(--indigo) 22%, transparent)"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: briefOpen
                    ? "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 14px -6px rgba(75,71,229,0.3)"
                    : "0 1px 0 rgba(255,255,255,0.6) inset",
                  animation: briefOpen
                    ? undefined
                    : "sc-briefing-pulse 2.6s ease-out infinite",
                }}
              >
                {/* Shiny shimmer sweep — telegraphs that this is the
                    primary interactive surface. Only runs when the
                    panel is closed; otherwise it'd compete with the
                    open-state styling. */}
                {!briefOpen && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: "70%",
                      pointerEvents: "none",
                      background:
                        "linear-gradient(105deg, transparent 30%, color-mix(in srgb, var(--indigo) 22%, transparent) 50%, transparent 70%)",
                      animation: "sc-briefing-sweep 2.6s ease-in-out infinite",
                    }}
                  />
                )}
                <Icon name="brain" size={14} style={{ position: "relative", zIndex: 1 }} />
                <span style={{ position: "relative", zIndex: 1 }}>Account briefing</span>
                <Icon
                  name="chevron-down"
                  size={12}
                  style={{
                    transform: briefOpen ? "rotate(180deg)" : "none",
                    transition: "transform .2s",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </button>
              <button
                type="button"
                style={{
                  background: "#fff",
                  color: "#11271f",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(7,38,28,0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                }}
              >
                <Icon name="plus" size={14} /> New account
              </button>

              {/* AI Brief dropdown card — opens below Account briefing button */}
              {briefOpen && <AIBriefingPanel onClose={() => setBriefOpen(false)} />}
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "flex", gap: 16 }}>
            <ScStat v="302" l="Accounts" />
            <ScStat v="5" l="Hot (last 2 weeks)" hot />
            <ScStat v="3" l="Signals today" />
          </div>

          {/* Filter chips */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "rgba(7,38,28,0.5)",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="sliders-horizontal" size={14} /> Filter accounts:
            </span>
            {["My Accounts", "All Owners", "All ABM Tiers", "All ABM Stages"].map(
              (f, i) => (
                <span
                  key={f}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    padding: "6px 11px",
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid rgba(7,38,28,0.12)",
                    color: "#11271f",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {f}
                  {i > 0 && (
                    <Icon
                      name="chevron-down"
                      size={11}
                      style={{ opacity: 0.5 }}
                    />
                  )}
                </span>
              ),
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12.5,
                fontWeight: 500,
                padding: "6px 11px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid rgba(7,38,28,0.12)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="bookmark" size={13} /> Views (4)
            </span>
          </div>

          {/* Quick access */}
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(7,38,28,0.5)",
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              Quick access
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 14,
              }}
            >
              {QUICK.map((q) => (
                <div
                  key={q.l}
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(7,38,28,0.1)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "#eef3ea",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={q.i} size={15} style={{ color: "#11271f" }} />
                  </span>
                  <span
                    style={{ fontSize: 13.5, fontWeight: 600, color: "#11271f" }}
                  >
                    {q.l}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Hot accounts + Live signals */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
            }}
          >
            {/* Hot accounts */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#11271f",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <Icon name="flame" size={14} style={{ color: "#e0622e" }} />
                  Hot accounts
                  <span
                    style={{
                      fontWeight: 400,
                      color: "rgba(7,38,28,0.45)",
                      fontSize: 12,
                    }}
                  >
                    most engaged in last 2 weeks
                  </span>
                </span>
                <span
                  style={{ fontSize: 12, color: "rgba(7,38,28,0.5)" }}
                >
                  View all →
                </span>
              </div>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid rgba(7,38,28,0.1)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {HOT_ACCOUNTS.map((a, i) => (
                  <div
                    key={a.n}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 15px",
                      borderTop: i ? "1px solid rgba(7,38,28,0.07)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: a.c,
                        background: a.bg,
                        borderRadius: 999,
                        padding: "3px 9px",
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon name={a.tempIcon} size={11} />
                      {a.t}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#11271f",
                        }}
                      >
                        {a.n}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "rgba(7,38,28,0.5)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 1,
                        }}
                      >
                        {a.sig}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Icon name={a.ai} size={11} />
                          {a.act}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live signals */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#11271f",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: "#e0622e",
                      boxShadow: "0 0 6px #e0622e",
                    }}
                  />
                  Live signals
                </span>
                <span style={{ fontSize: 12, color: "rgba(7,38,28,0.5)" }}>
                  View all →
                </span>
              </div>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid rgba(7,38,28,0.1)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {SIGNALS.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "10px 15px",
                      borderTop: i ? "1px solid rgba(7,38,28,0.07)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: "#eef3ea",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={s.icon} size={12} style={{ color: "#11271f" }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "#11271f" }}>
                        <b>{s.who}</b> · {s.acct}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(7,38,28,0.5)",
                        }}
                      >
                        {s.role}
                        {s.tag && (
                          <span style={{ color: "#3a7bd0" }}> · {s.tag}</span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(7,38,28,0.45)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Briefing — full-account inline panel, modeled on the production Sales
// Console account-detail surface. Sits below the action row when "Account
// briefing" is toggled on. Width spans the dashboard, not a narrow dropdown.

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(7,38,28,0.5)",
  fontWeight: 700,
  marginBottom: 10,
};

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(7,38,28,0.025)",
        borderRadius: 9,
        padding: "12px 14px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ ...SECTION_LABEL, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#11271f",
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LeaderRow({ initials, name, title }: { initials: string; name: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 13px",
        background: "rgba(7,38,28,0.025)",
        borderRadius: 9,
        flex: 1,
        minWidth: 240,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "var(--tint-lavender)",
          color: "var(--indigo)",
          fontSize: 11,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initials}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#11271f",
            lineHeight: 1.3,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(7,38,28,0.55)", lineHeight: 1.3 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

function AIBriefingPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        width: 520,
        background: "#fff",
        border: "1px solid rgba(7,38,28,0.1)",
        borderRadius: 14,
        boxShadow:
          "0 28px 60px -22px rgba(7,38,28,0.20), 0 12px 28px -16px rgba(26,24,21,0.12)",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      {/* Header bar — purple icon + AI Briefing title + ENTERPRISE badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px 12px",
          borderBottom: "1px solid rgba(7,38,28,0.08)",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "var(--tint-lavender)",
            color: "var(--indigo)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="brain" size={16} />
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span
            style={{
              fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: "#11271f",
              letterSpacing: "-0.012em",
            }}
          >
            AI Briefing
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "#FEF3C7",
              color: "#92670C",
              borderRadius: 4,
              padding: "2px 7px",
            }}
          >
            Enterprise
          </span>
          {/* Account name is now shown in the panel body as a paragraph;
              no need to truncate it here. Keep the header tight. */}
          <span style={{ flex: 1, minWidth: 0 }} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close briefing"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            color: "#fff",
            background: "#11271f",
            border: "1px solid #11271f",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 120ms ease, color 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#000";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#11271f";
          }}
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          maxHeight: 340,
          overflowY: "auto",
          padding: "16px 20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Account description */}
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "#11271f",
            margin: 0,
          }}
        >
          Cobalt Systems is a $400M industrial-automation platform owned by
          Halifax Capital, focused on factory-floor monitoring and predictive
          maintenance for mid-market manufacturers. The company is in active
          buying mode for revenue-tech tools to support a 2026 expansion into
          field services.
        </p>

        {/* LOCATIONS / REVENUE / OWNERSHIP */}
        <div style={{ display: "flex", gap: 10 }}>
          <InfoCell label="Locations" value="12 plants · US + EU" />
          <InfoCell label="Revenue" value="$400M ARR (est.)" />
          <InfoCell label="Ownership" value="Halifax Capital (PE)" />
        </div>

        {/* LEADERSHIP */}
        <div>
          <div style={SECTION_LABEL}>Leadership</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <LeaderRow
              initials="JK"
              name="Jay Khimani"
              title="Chief Executive Officer"
            />
            <LeaderRow
              initials="CA"
              name="Chandan Advani"
              title="Chief Operating Officer"
            />
            <LeaderRow
              initials="JB"
              name="Jason Brown"
              title="VP of Procurement"
            />
          </div>
        </div>

        {/* FIT ANALYSIS */}
        <div>
          <div style={SECTION_LABEL}>Fit Analysis</div>
          <div
            style={{
              background: "#E6F5EC",
              border: "1px solid rgba(31,138,91,0.20)",
              borderRadius: 11,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#1F8A5B",
                marginBottom: 10,
              }}
            >
              LP Studio fits Cobalt&apos;s expansion playbook precisely.
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 12,
              }}
            >
              {[
                "PE-backed growth thesis",
                "Field-services expansion",
                "Need for vertical-specific landing pages",
                "Mid-market sales motion",
              ].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "#1F8A5B",
                    background: "#FFFFFF",
                    border: "1px solid rgba(31,138,91,0.25)",
                    borderRadius: 999,
                    padding: "3px 11px",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#0F4A2E" }}>
              <strong style={{ fontWeight: 600 }}>Approach:</strong> Position LP
              Studio as the workspace where Cobalt&apos;s sales team can ship
              account-personalized pages at the pace their expansion targets
              demand.
            </div>
          </div>
        </div>

        {/* BUYING COMMITTEE */}
        <div>
          <div style={SECTION_LABEL}>Buying Committee</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                role: "CEO / Executive Leadership",
                desc: "Set the platform-scale thesis; care about revenue velocity per rep.",
                action:
                  "Lead with how LP Studio reduces time-to-ship from weeks to hours.",
              },
              {
                role: "Sales Ops & RevOps",
                desc: "Own the toolstack; gate-keep procurement and Salesforce.",
                action:
                  "Emphasize per-recipient identity + native Salesforce sync, no extra integrations.",
              },
              {
                role: "Marketing Operations",
                desc: "Need brand-locked templates that AEs can use without breaking guidelines.",
                action:
                  "Show locked-block workflow and how it scales brand consistency across the field.",
              },
            ].map((m) => (
              <div
                key={m.role}
                style={{
                  background: "rgba(7,38,28,0.025)",
                  borderRadius: 9,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#11271f",
                    marginBottom: 4,
                  }}
                >
                  {m.role}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "rgba(7,38,28,0.65)",
                    lineHeight: 1.5,
                    marginBottom: 6,
                  }}
                >
                  {m.desc}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--indigo)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {m.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TALKING POINTS */}
        <div>
          <div style={SECTION_LABEL}>Talking Points</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Halifax Capital's portfolio includes 3 LP Studio customers — pattern-match the wedge.",
              "Cobalt's 2026 field-services launch will need 8+ vertical microsites by Q2.",
              "Per-recipient identity means their AEs can finally measure who's actually reading proposals.",
            ].map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: "#11271f",
                }}
              >
                <Icon
                  name="message-square"
                  size={13}
                  style={{
                    color: "var(--indigo)",
                    flexShrink: 0,
                    marginTop: 3,
                  }}
                />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* RECENT NEWS */}
        <div>
          <div style={SECTION_LABEL}>Recent News</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                title: "Cobalt Systems acquires Stratos Robotics to expand field-services arm",
                date: "2026-01-22",
                brief:
                  "$80M acquisition signals aggressive expansion. Field services now a top-3 GTM priority.",
              },
              {
                title: "Halifax Capital adds $200M to Cobalt growth fund",
                date: "2026-01-10",
                brief:
                  "Funding earmarked for go-to-market acceleration in 2026 — sales tooling and marketing infrastructure.",
              },
              {
                title: "Cobalt names new Chief Revenue Officer from Honeywell",
                date: "2025-12-15",
                brief:
                  "Sara Mehta brings enterprise sales discipline. Will scrutinize the existing toolstack.",
              },
            ].map((n) => (
              <div
                key={n.title}
                style={{
                  background: "rgba(7,38,28,0.025)",
                  borderRadius: 9,
                  padding: "11px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 9,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#11271f",
                      flex: 1,
                    }}
                  >
                    {n.title}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10.5,
                      color: "rgba(7,38,28,0.45)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {n.date}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(7,38,28,0.6)",
                    lineHeight: 1.5,
                  }}
                >
                  {n.brief}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MICROSITE RECOMMENDATIONS */}
        <div>
          <div style={SECTION_LABEL}>Microsite Recommendations</div>
          <div
            style={{
              background: "var(--tint-lavender)",
              border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
              borderRadius: 11,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#11271f",
                marginBottom: 6,
              }}
            >
              &quot;Operations ROI for Field-Services PE Platforms&quot;
            </div>
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "rgba(7,38,28,0.7)",
                marginBottom: 4,
              }}
            >
              <strong style={{ fontWeight: 600, color: "#11271f" }}>Focus:</strong>{" "}
              Show how LP Studio reduces deal-stage friction with brand-locked
              per-account microsites — match the Stratos acquisition narrative.
            </div>
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "rgba(7,38,28,0.7)",
              }}
            >
              <strong style={{ fontWeight: 600, color: "#11271f" }}>CTA:</strong>{" "}
              Book a 20-minute walkthrough with the new CRO — bring Chandan from
              ops.
            </div>
          </div>
        </div>

        {/* SOURCES */}
        <div>
          <div style={SECTION_LABEL}>Sources</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              "cobaltsystems.com",
              "halifaxcapital.com",
              "prnewswire.com",
              "techcrunch.com",
              "pitchbook.com",
              "linkedin.com",
            ].map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "rgba(7,38,28,0.7)",
                  background: "rgba(7,38,28,0.04)",
                  border: "1px solid rgba(7,38,28,0.08)",
                  borderRadius: 999,
                  padding: "3px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="external-link" size={10} />
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Last updated */}
        <div
          style={{
            fontSize: 11,
            color: "rgba(7,38,28,0.45)",
            textAlign: "right",
            marginTop: -8,
          }}
        >
          Last updated Jun 3, 2026 at 10:52 PM
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderTop: "1px solid rgba(7,38,28,0.08)",
          background: "rgba(7,38,28,0.02)",
        }}
      >
        <button
          type="button"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--indigo)",
            color: "#fff",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            boxShadow:
              "0 8px 18px -6px rgba(75,71,229,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          <Icon name="send" size={12} /> Draft email
        </button>
        <button
          type="button"
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#fff",
            color: "#11271f",
            border: "1px solid rgba(7,38,28,0.14)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <Icon name="globe" size={12} /> Generate microsite
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "rgba(7,38,28,0.55)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
