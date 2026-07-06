import { useEffect, useState } from "react";
import { useInView } from "../hooks/useInView";
import ContactDetailModal, {
  type ContactDetail,
} from "./ContactDetailModal";

// John Donahoe (VISITS[1]) is the row we pre-open in the contact-detail
// modal once the analytics section scrolls into view. Picked deliberately:
// recognizable executive name (vs Sarah Chen Acme Corp which reads more
// generic), so the contact-page surface lands as "this is the real app".
const PREOPEN_INDEX = 1;

// IdentityWedge — the post-Mutiny-pivot differentiator made tangible. The
// visual centerpiece is a full-width mock of the production /analytics/pages
// page (breadcrumb · published title · time range · stat row · visits table)
// pulled from the actual app surface. Drives the wedge home: where Mutiny
// shows "someone from Acme visited" the LP Studio analytics page shows the
// resolved person, scroll depth, CTA clicks, and conversion status for every
// tokenized link.

interface VisitRow {
  contact: string;
  role?: string;
  source: "Outreach" | "Salesloft" | "Email" | "Direct" | "Anonymous";
  account: string;
  location: { flag: string; place: string };
  device: "Desktop" | "Mobile";
  scroll: number;
  clicks: number;
  ctaState: "booked" | "pricing" | "demo" | "none";
  when: string;
  anonymous?: boolean;
}

// Page is the Cobalt Systems · Enterprise Pilot microsite, so the
// visits table is mostly Cobalt contacts — that's how a real ABM
// landing-page analytics view reads. A couple of partner / portfolio
// visits round out the table, plus two anonymous hits to show the
// identity-reveal contrast.
const VISITS: VisitRow[] = [
  {
    contact: "Sarah Chen",
    role: "VP, Strategic Sourcing · Cobalt Systems",
    source: "Outreach",
    account: "Cobalt Systems",
    location: { flag: "🇺🇸", place: "San Francisco, California" },
    device: "Desktop",
    scroll: 94,
    clicks: 18,
    ctaState: "booked",
    when: "2h ago",
  },
  {
    contact: "David Park",
    role: "CFO · Cobalt Systems",
    source: "Email",
    account: "Cobalt Systems",
    location: { flag: "🇺🇸", place: "San Francisco, California" },
    device: "Desktop",
    scroll: 78,
    clicks: 11,
    ctaState: "pricing",
    when: "5h ago",
  },
  {
    contact: "Jay Khimani",
    role: "Chief Executive Officer · Cobalt Systems",
    source: "Outreach",
    account: "Cobalt Systems",
    location: { flag: "🇺🇸", place: "Chicago, Illinois" },
    device: "Mobile",
    scroll: 64,
    clicks: 8,
    ctaState: "demo",
    when: "Yesterday",
  },
  {
    contact: "Chandan Advani",
    role: "Chief Operating Officer · Cobalt Systems",
    source: "Salesloft",
    account: "Cobalt Systems",
    location: { flag: "🇺🇸", place: "Irvine, California" },
    device: "Desktop",
    scroll: 52,
    clicks: 6,
    ctaState: "none",
    when: "Yesterday",
  },
  {
    contact: "Priya Nair",
    role: "Investor · Halifax Capital",
    source: "Email",
    account: "Halifax Capital",
    location: { flag: "🇺🇸", place: "Brooklyn, New York" },
    device: "Desktop",
    scroll: 88,
    clicks: 14,
    ctaState: "booked",
    when: "2d ago",
  },
  {
    contact: "Anonymous",
    source: "Anonymous",
    account: "—",
    location: { flag: "🇺🇸", place: "Holden, Massachusetts" },
    device: "Desktop",
    scroll: 38,
    clicks: 2,
    ctaState: "none",
    when: "3d ago",
    anonymous: true,
  },
  {
    contact: "Anonymous",
    source: "Direct",
    account: "—",
    location: { flag: "🇺🇸", place: "Austin, Texas" },
    device: "Mobile",
    scroll: 22,
    clicks: 0,
    ctaState: "none",
    when: "3d ago",
    anonymous: true,
  },
];

const STATS: { label: string; value: string; icon: string }[] = [
  { label: "Visits", value: "124", icon: "users" },
  { label: "Unique visitors", value: "23", icon: "user" },
  { label: "Leads", value: "5", icon: "target" },
  { label: "CVR", value: "4.0%", icon: "trending-up" },
  { label: "Avg scroll", value: "82%", icon: "scroll" },
  { label: "Clicks / session", value: "14.2", icon: "mouse" },
];

const SOURCE_STYLE: Record<VisitRow["source"], { bg: string; color: string }> = {
  Outreach: { bg: "rgba(75,71,229,0.10)", color: "var(--indigo)" },
  Salesloft: { bg: "rgba(143,124,234,0.10)", color: "#7E66D6" },
  Email: { bg: "rgba(107,145,113,0.14)", color: "var(--sage)" },
  Direct: { bg: "rgba(200,146,61,0.14)", color: "var(--gold)" },
  Anonymous: { bg: "rgba(26,24,21,0.06)", color: "var(--ink-mute)" },
};

const CTA_STATE: Record<VisitRow["ctaState"], { label: string; color: string; bg: string } | null> = {
  booked: {
    label: "Booked",
    color: "var(--sage)",
    bg: "color-mix(in srgb, var(--sage) 14%, transparent)",
  },
  pricing: {
    label: "Viewed pricing",
    color: "var(--indigo)",
    bg: "var(--indigo-soft)",
  },
  demo: {
    label: "Demo req.",
    color: "var(--coral)",
    bg: "var(--coral-soft)",
  },
  none: null,
};

function StatCard({ s }: { s: (typeof STATS)[number] }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {s.label}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.022em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {s.value}
      </div>
    </div>
  );
}

// Exported so /features can reuse this inside a BrowserFrame without the
// wedge framing (eyebrow + "Mutiny resolves accounts" callout) that lives on
// the homepage. Same surface, less positioning.
export function AnalyticsMock() {
  // Modal state — the contact-detail modal is pre-opened on John Donahoe
  // so visitors immediately see the surface and learn that visit rows are
  // clickable. Closing it (×, Esc, backdrop) reveals the table; clicking
  // any other named row opens that contact instead.
  // Initialize deterministically to the pre-opened desktop row so the first
  // client render matches the prerendered desktop HTML (no hydration
  // mismatch). The mobile suppression happens after mount in the effect below.
  const [openContact, setOpenContact] = useState<VisitRow | null>(
    VISITS[PREOPEN_INDEX] ?? null,
  );

  // Don't auto-open the contact-detail modal on mobile — it covers the whole
  // analytics surface on small screens, which is jarring on landing. Run this
  // post-mount (not in the state initializer) to keep hydration markup
  // identical to the desktop-prerendered HTML.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setOpenContact(null);
    }
  }, []);

  return (
    <div
      style={{
        background: "var(--cream)",
        padding: "22px 26px 26px",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        // Make this the containing block for the absolutely-positioned
        // contact-detail modal so the modal stays within the analytics
        // surface rather than covering the whole viewport.
        position: "relative",
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontSize: 13,
          color: "var(--ink-mute)",
          marginBottom: 16,
        }}
      >
        <span style={{ color: "var(--indigo)" }}>Analytics</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span style={{ color: "var(--indigo)" }}>Pages</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>
          Cobalt Systems · Enterprise Pilot
        </span>
      </div>

      {/* Title row + action buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Cobalt Systems · Enterprise Pilot
            </h3>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                background:
                  "linear-gradient(180deg, #6C68F0 0%, #3C38B8 100%)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: 7,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px -4px rgba(75,71,229,0.45)",
              }}
            >
              Published
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12.5,
              color: "var(--ink-mute)",
              marginTop: 6,
            }}
          >
            <span
              className="font-mono"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
              </svg>
              /cobalt-pilot
            </span>
            <span>Last edited Jun 3, 2026</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          {[
            { label: "Copy URL", iconPath: "M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" },
            { label: "View live", iconPath: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z" },
            { label: "Edit", iconPath: "M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" },
          ].map((b) => (
            <span
              key={b.label}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "7px 11px",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink-2)",
                border: "1px solid var(--hairline-strong)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.7) inset, 0 1px 2px rgba(26,24,21,0.04)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={b.iconPath} />
              </svg>
              {b.label}
            </span>
          ))}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 11px",
              borderRadius: 8,
              background: "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)",
              color: "var(--cream)",
              border: "1px solid rgba(0,0,0,0.4)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 10px -4px rgba(26,24,21,0.4)",
              textShadow: "0 1px 0 rgba(0,0,0,0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            Unpublish
          </span>
        </div>
      </div>

      {/* Time range tabs */}
      <div
        style={{
          display: "inline-flex",
          background: "var(--paper)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: 9,
          padding: 3,
          gap: 3,
          marginTop: 18,
          boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
        }}
      >
        {["7d", "30d", "90d", "Custom"].map((t, i) => {
          const active = i === 1;
          return (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 6,
                background: active
                  ? "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)"
                  : "transparent",
                color: active ? "var(--cream)" : "var(--ink-2)",
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 10px -6px rgba(26,24,21,0.35)"
                  : "none",
                textShadow: active ? "0 1px 0 rgba(0,0,0,0.25)" : "none",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t}
            </span>
          );
        })}
      </div>

      {/* Stat cards row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6"
        style={{
          gap: 12,
          marginTop: 18,
        }}
      >
        {STATS.map((s) => (
          <StatCard key={s.label} s={s} />
        ))}
      </div>

      {/* Visits panel */}
      <div
        style={{
          marginTop: 18,
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
        }}
      >
        <div style={{ padding: "16px 22px 14px" }}>
          <div
            className="font-display"
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.014em",
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            Visits
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-mute)",
              margin: "5px 0 12px",
            }}
          >
            Every recorded visit, with resolved identity for personalized links.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--hairline)",
                borderRadius: 9,
                padding: "8px 12px",
                background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
                color: "var(--ink-mute)",
                fontSize: 13,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Search name, company, email…
            </div>
            {[
              { label: "Known only", active: false },
              { label: "Converted only", active: false },
            ].map((b) => (
              <span
                key={b.label}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--paper)",
                  color: "var(--ink-2)",
                  border: "1px solid var(--hairline-strong)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Table — horizontally scrollable on small screens */}
        <div style={{ position: "relative" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 720 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "26px 1.6fr 0.9fr 1.2fr 0.7fr 0.85fr 0.55fr 0.85fr 0.55fr",
            padding: "10px 22px",
            background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
            borderTop: "1px solid var(--hairline)",
            borderBottom: "1px solid var(--hairline)",
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            fontWeight: 700,
          }}
        >
          <div />
          <div>Visitor</div>
          <div>Source</div>
          <div>Location</div>
          <div>Device</div>
          <div>Scroll</div>
          <div style={{ textAlign: "right" }}>Clicks</div>
          <div>Conv.</div>
          <div style={{ textAlign: "right" }}>When</div>
        </div>

        {VISITS.map((v, i) => {
          const src = SOURCE_STYLE[v.source];
          const cta = CTA_STATE[v.ctaState];
          const clickable = !v.anonymous;
          return (
            <div
              key={i}
              onClick={clickable ? () => setOpenContact(v) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenContact(v);
                      }
                    }
                  : undefined
              }
              onMouseEnter={
                clickable
                  ? (e) => {
                      e.currentTarget.style.background =
                        "color-mix(in srgb, var(--indigo) 5%, transparent)";
                    }
                  : undefined
              }
              onMouseLeave={
                clickable
                  ? (e) => {
                      e.currentTarget.style.background = "transparent";
                    }
                  : undefined
              }
              style={{
                display: "grid",
                gridTemplateColumns:
                  "26px 1.6fr 0.9fr 1.2fr 0.7fr 0.85fr 0.55fr 0.85fr 0.55fr",
                padding: "13px 22px",
                alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                fontSize: 13,
                color: "var(--ink-2)",
                cursor: clickable ? "pointer" : "default",
                transition: "background 120ms ease",
              }}
            >
              <div
                style={{
                  color: clickable ? "var(--indigo)" : "var(--ink-faint)",
                  opacity: clickable ? 0.85 : 0.5,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden="true"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                {v.anonymous ? (
                  <span
                    style={{
                      color: "var(--ink-mute)",
                      fontStyle: "italic",
                      fontSize: 13,
                    }}
                  >
                    Anonymous
                  </span>
                ) : (
                  <>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--ink)",
                        fontSize: 13.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {v.contact}
                    </div>
                    {v.role && (
                      <div
                        style={{
                          color: "var(--ink-mute)",
                          fontSize: 11.5,
                          marginTop: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {v.role}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: src.bg,
                    color: src.color,
                  }}
                >
                  {v.source}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ fontSize: 14 }}>{v.location.flag}</span>
                {v.location.place}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                {v.device}
              </div>
              <div>
                <div
                  style={{
                    height: 4,
                    width: "100%",
                    background: "var(--hairline)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${v.scroll}%`,
                      background:
                        v.ctaState === "booked"
                          ? "var(--sage)"
                          : v.scroll > 60
                          ? "var(--coral)"
                          : "var(--ink-mute)",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <div
                  className="font-mono"
                  style={{
                    color: "var(--ink-mute)",
                    fontSize: 10.5,
                    marginTop: 3,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {v.scroll}%
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--ink-2)",
                  fontFamily: "JetBrains Mono, ui-monospace, monospace",
                  fontSize: 12,
                }}
              >
                {v.clicks}
              </div>
              <div>
                {cta ? (
                  <span
                    className="font-mono"
                    style={{
                      display: "inline-block",
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "3px 7px",
                      borderRadius: 4,
                      background: cta.bg,
                      color: cta.color,
                    }}
                  >
                    {cta.label}
                  </span>
                ) : (
                  <span style={{ color: "var(--ink-faint)" }}>—</span>
                )}
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {v.when}
              </div>
            </div>
          );
        })}
            </div>
          </div>
          {/* Right-edge fade hint (mobile only) signalling more columns */}
          <div
            aria-hidden
            className="md:hidden"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 40,
              pointerEvents: "none",
              background:
                "linear-gradient(to right, transparent, var(--paper))",
            }}
          />
        </div>
      </div>

      {/* Contact-detail modal — portal'd to document.body so it escapes the
          analytics-page section and dims the viewport. Opens when a visit
          row is clicked; contact data is built from the row's VisitRow. */}
      {openContact && (
        <ContactDetailModal
          contact={buildContactDetail(openContact)}
          onClose={() => setOpenContact(null)}
        />
      )}
    </div>
  );
}

// Build the ContactDetail payload for the modal from a VisitRow. Keeps the
// content generic (no Dandy / dental references) — same positioning angle
// for everyone, with the contact name, account, and engagement metrics
// filled in from the row data.
function buildContactDetail(v: VisitRow): ContactDetail {
  const initials = v.contact
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const slug = v.account
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const engagementTone: "engaged" | "hot" | "cold" =
    v.scroll >= 80 && v.ctaState === "booked"
      ? "hot"
      : v.scroll >= 50
      ? "engaged"
      : "cold";
  const statusLabel =
    engagementTone === "hot"
      ? "HOT (5)"
      : engagementTone === "engaged"
      ? "ENGAGED (3)"
      : "COLD (1)";
  return {
    name: v.contact,
    role: v.role ?? "Contact",
    initials,
    statusBadge: { label: statusLabel, tone: engagementTone },
    email: `${v.contact.toLowerCase().replace(/\s+/g, ".")}@${slug}.com`,
    phone: "415-555-0173",
    account: v.account,
    brief: {
      summary: `Decision-maker at ${v.account}. ${v.scroll}% scroll depth and ${v.clicks} clicks on the most recent microsite visit.`,
      whoTheyAre: [
        `${v.role ?? "Senior leader"} — owns the buying decision for tools that touch their team's workflow.`,
        `Visited from ${v.source.toLowerCase() === "anonymous" ? "an untracked source" : `a ${v.source} link`} on ${v.device.toLowerCase()}.`,
        "Public sources confirm role and tenure; no recent job change.",
      ],
      whatTheyCareAbout: [
        "Reducing time-to-pipeline without piling on more vendor tools.",
        "Per-contact engagement signal that actually lands on the right CRM record.",
        "Brand consistency across every page their team ships — no rogue assets.",
      ],
      conversationStarters: [
        `Open with the moment: they spent meaningful time on the pricing block — what about the model would you want to dig into first?`,
        `Reference the page they forwarded internally and ask who else on the buying committee should see the next round.`,
        `Offer to spin up a tailored microsite for their next outbound campaign so they can see the per-recipient identity flow end-to-end.`,
      ],
      positioningAngle:
        "Lead with the identity wedge — most ABM platforms tell you the account showed up; LP Studio tells you which named person engaged, what they clicked, and which other contact they forwarded it to. Pair that with one-click microsite generation to close the loop from signal to send.",
      lastUpdated: `${v.when}`,
    },
    metrics: {
      pageViews: Math.max(1, Math.round(v.clicks * 0.6)),
      emailOpens: Math.max(1, Math.round(v.clicks * 0.8)),
      emailClicks: Math.max(0, Math.round(v.clicks * 0.35)),
      formSubmits: v.ctaState === "booked" ? 1 : 0,
    },
    personalizedLinks: [
      {
        title: `${v.account} · Executive Microsite`,
        url: `https://lpstudio.ai/p/${slug}-${initials.toLowerCase()}`,
      },
    ],
    engagementHistory: buildEngagementHistory(v),
  };
}

// Build a richer engagement timeline so the modal's "Engagement History"
// section reads like a real CRM timeline, not just two placeholder rows.
// Anchor the most recent event at v.when, then walk backwards through
// synthetic-but-plausible touches (email open → email click → first visit
// → return visit → CTA click → optional form submit). Tweaks per row so
// each contact's timeline reflects their actual visit (booked vs not).
function buildEngagementHistory(v: VisitRow): ContactDetail["engagementHistory"] {
  const microsite = `${v.account} · Executive Microsite`;
  const items: ContactDetail["engagementHistory"] = [];

  if (v.ctaState === "booked") {
    items.push({
      kind: "form",
      label: "Submitted Form",
      meta: `${microsite} — Book a demo · routed to AE in #cobalt-pilot`,
      when: v.when,
    });
  }
  items.push({
    kind: "click",
    label: "Clicked CTA",
    meta: `${microsite} — ${
      v.ctaState === "pricing"
        ? "Pricing block · View plans"
        : v.ctaState === "demo"
        ? "Hero · Book a demo"
        : "Hero · Get started"
    }`,
    when: v.when,
  });
  items.push({
    kind: "view",
    label: "Returned to Page",
    meta: `${microsite} — scrolled ${v.scroll}% · ${
      v.device === "Mobile" ? "Mobile" : "Desktop"
    } · ${Math.max(2, Math.round(v.clicks / 2))}m on page`,
    when: v.when,
  });
  items.push({
    kind: "click",
    label: "Forwarded Link",
    meta: `${microsite} — shared with a teammate at ${v.account} (opened from a new IP)`,
    when: "yesterday",
  });
  items.push({
    kind: "view",
    label: "First Visit",
    meta: `${microsite} — entered via ${v.source} link · ${v.location.place}`,
    when: "2 days ago",
  });
  items.push({
    kind: "click",
    label: "Clicked Email Link",
    meta: `Outbound — "How ${v.account} hits 2026 plan" · clicked CTA in body`,
    when: "3 days ago",
  });
  items.push({
    kind: "view",
    label: "Opened Email",
    meta: `Outbound — "How ${v.account} hits 2026 plan" · opened on ${v.device.toLowerCase()}`,
    when: "3 days ago",
  });

  return items;
}

// `num` — the section-sequence eyebrow. This component renders on two pages
// with different positions in the flow: the homepage (after 08 / Sales
// Console → default "09") and /for-sales (after 03 / AI outreach → pass
// "04", with SalesforceSyncDemo's hardcoded "05 / CRM" following it).
export default function IdentityWedge({ num = "09" }: { num?: string } = {}) {
  const { ref, inView } = useInView(0.05);

  return (
    <section
      id="signal"
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
          top: "10%",
          right: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--coral) 12%, transparent) 0%, transparent 65%)",
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
          <div className="marker marker-rule mb-5">{num} / Signal</div>
          <h2
            className="font-display text-display-md"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Know exactly{" "}
            <em style={{ fontStyle: "normal", color: "var(--indigo)" }}>
              who&apos;s on the page
            </em>{" "}
            — not just which account.
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
            Mutiny tells you{" "}
            <span style={{ color: "var(--ink-mute)" }}>
              &quot;someone from Cobalt Systems visited.&quot;
            </span>{" "}
            LP Studio tells you Sarah Chen read the pricing section at
            11:42pm, didn&apos;t click the booking CTA, came back the next
            morning, and forwarded the page to her CFO.{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              Identity is baked into the URL at send.
            </strong>
          </p>
        </div>

        {/* Analytics-page mock — in browser chrome so it reads as "the app" */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.7) inset, 0 30px 60px -28px rgba(26,24,21,0.22), 0 12px 28px -18px rgba(26,24,21,0.16)",
          }}
        >
          {/* Faux window chrome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "var(--cream-2)",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span style={{ display: "inline-flex", gap: 6 }}>
              <i
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#ec6a5e",
                }}
              />
              <i
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#f4bf4f",
                }}
              />
              <i
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#61c554",
                }}
              />
            </span>
            <span
              className="font-mono"
              style={{
                flex: 1,
                marginLeft: 6,
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 11,
                color: "var(--ink-mute)",
              }}
            >
              app.lpstudio.ai/analytics/pages/cobalt-pilot
            </span>
          </div>
          <AnalyticsMock />
        </div>

        {/* Wedge callout */}
        <div
          style={{
            marginTop: 24,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 18px",
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 12,
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 22px -14px rgba(26,24,21,0.16)",
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.18em",
              color: "var(--coral)",
              fontWeight: 700,
            }}
          >
            The wedge
          </span>
          <span
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Mutiny resolves accounts. We resolve people.
          </span>
        </div>
      </div>
    </section>
  );
}
