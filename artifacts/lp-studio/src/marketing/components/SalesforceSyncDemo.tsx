import { useInView } from "../hooks/useInView";

// SalesforceSyncDemo — the sales-buyer-specific integration story. Shows the
// bidirectional Salesforce sync as a side-by-side: LP Studio activity feed
// on the left, the matching Salesforce Lightning contact record with custom
// fields populated on the right. Built for the refactored /for-sales page
// so AE prospects see exactly what their CRM will look like once the sync
// is wired.
//
// The activity feed mirrors John Donahoe's engagement history from
// IdentityWedge's contact-detail modal so the demo reads as coherent: same
// person, same events, two different surfaces. Production-fidelity bar:
// the SF panel must read as real Lightning UI (proper navy chrome, cloud
// mark, blue-tinted secondary text, custom-field badges).

interface ActivityRow {
  ts: string;
  kind: "form" | "click" | "return" | "forward" | "first" | "email-click" | "email-open";
  label: string;
  meta: string;
}

// Mirrors buildEngagementHistory(VISITS[1] /* John Donahoe */) in IdentityWedge.tsx.
// Reverse-chronological touch sequence ending at the most recent visit.
const ACTIVITY: ActivityRow[] = [
  {
    ts: "5h ago",
    kind: "click",
    label: "Clicked CTA",
    meta: "Nike · Executive Microsite — Pricing block · View plans",
  },
  {
    ts: "5h ago",
    kind: "return",
    label: "Returned to Page",
    meta: "Nike · Executive Microsite — scrolled 78% · Desktop · 6m on page",
  },
  {
    ts: "yesterday",
    kind: "forward",
    label: "Forwarded Link",
    meta: "Nike · Executive Microsite — shared with a teammate at Nike (opened from a new IP)",
  },
  {
    ts: "2d ago",
    kind: "first",
    label: "First Visit",
    meta: "Nike · Executive Microsite — entered via Email link · Beaverton, Oregon",
  },
  {
    ts: "3d ago",
    kind: "email-click",
    label: "Clicked Email Link",
    meta: "Outbound — \"How Nike hits 2027 plan\" · clicked CTA in body",
  },
  {
    ts: "3d ago",
    kind: "email-open",
    label: "Opened Email",
    meta: "Outbound — \"How Nike hits 2027 plan\" · opened on desktop",
  },
];

const SF_FIELDS: { label: string; value: string; custom?: boolean }[] = [
  { label: "Name",                       value: "John Donahoe" },
  { label: "Title",                      value: "President & CEO" },
  { label: "Account",                    value: "Nike, Inc." },
  { label: "Last microsite visit",       value: "Today · 5h ago",                  custom: true },
  { label: "Last page viewed",           value: "/pricing",                         custom: true },
  { label: "Total time on site (30d)",   value: "14m 22s",                          custom: true },
  { label: "Forwarded to",               value: "David Park · CFO, Nike",          custom: true },
  { label: "Booked demo",                value: "—",                                custom: true },
];

export default function SalesforceSyncDemo() {
  const { ref, inView } = useInView(0.1);

  return (
    <section
      id="salesforce-sync"
      className="px-6 py-24 md:py-28"
      style={{
        background: "var(--cream-2)",
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
        {/* Copy block */}
        <div className="max-w-[660px] mb-10">
          <div className="marker marker-rule mb-5">05 / CRM</div>
          <h2
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(30px, 3.6vw, 42px)",
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Every signal lands in Salesforce, on the right contact.
          </h2>
          <div
            className="mt-5 text-[16.5px] leading-[1.6] max-w-[560px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Microsite visits, scroll depth, CTA clicks, and forwards sync to
            the contact record — not the account. Custom field mapping (Scale)
            puts the moments your reps care about exactly where they expect
            to find them.{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              No browser extension, no exports, no manual logging.
            </strong>
          </div>
        </div>

        {/* Two-column compare: LP Studio activity → Salesforce record */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 36px minmax(0, 1fr)",
            gap: 0,
            alignItems: "stretch",
          }}
        >
          {/* LEFT — LP Studio activity feed */}
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline-strong)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -22px rgba(26,24,21,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelHeader chrome="LP Studio · Activity · John Donahoe" />
            <div style={{ padding: "10px 8px 14px", display: "flex", flexDirection: "column" }}>
              {ACTIVITY.map((a, i) => (
                <ActivityItem key={i} row={a} divider={i < ACTIVITY.length - 1} />
              ))}
            </div>
          </div>

          {/* ARROW */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-mute)",
            }}
            aria-hidden="true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </div>

          {/* RIGHT — Salesforce Lightning record */}
          <SalesforcePanel />
        </div>

        {/* Footer note about scale */}
        <div
          style={{
            marginTop: 20,
            fontSize: 12.5,
            color: "var(--ink-mute)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>
            Bidirectional sync · OAuth · custom field mapping on Scale ·
            HubSpot connector with the same surface
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------- LP Studio (left) ----------

function PanelHeader({ chrome }: { chrome: string }) {
  return (
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
      <span style={{ display: "inline-flex", gap: 5 }}>
        <i style={{ width: 7, height: 7, borderRadius: 999, background: "#ec6a5e" }} />
        <i style={{ width: 7, height: 7, borderRadius: 999, background: "#f4bf4f" }} />
        <i style={{ width: 7, height: 7, borderRadius: 999, background: "#61c554" }} />
      </span>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.16em",
          fontWeight: 700,
          color: "var(--indigo)",
        }}
      >
        {chrome}
      </span>
    </div>
  );
}

function ActivityItem({ row, divider }: { row: ActivityRow; divider: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        padding: "11px 12px",
        alignItems: "flex-start",
        borderBottom: divider ? "1px solid var(--hairline)" : "none",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: kindBg(row.kind),
          color: kindColor(row.kind),
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ActivityIcon kind={row.kind} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "var(--ink)",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {row.label}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11.5,
            color: "var(--ink-mute)",
            lineHeight: 1.45,
          }}
        >
          {row.meta}
        </div>
      </div>
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 9,
          letterSpacing: "0.10em",
          fontWeight: 700,
          color: "var(--ink-mute)",
          flexShrink: 0,
          marginTop: 4,
          whiteSpace: "nowrap",
        }}
      >
        {row.ts}
      </div>
    </div>
  );
}

function kindBg(k: ActivityRow["kind"]): string {
  if (k === "form") return "color-mix(in srgb, #8967D0 14%, transparent)";
  if (k === "click" || k === "email-click")
    return "color-mix(in srgb, #5C9B6E 14%, transparent)";
  return "color-mix(in srgb, #2D7DD2 14%, transparent)";
}
function kindColor(k: ActivityRow["kind"]): string {
  if (k === "form") return "#8967D0";
  if (k === "click" || k === "email-click") return "#5C9B6E";
  return "#2D7DD2";
}

function ActivityIcon({ kind }: { kind: ActivityRow["kind"] }) {
  const p = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "click" || kind === "email-click") {
    // mouse-pointer click
    return (
      <svg {...p}>
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    );
  }
  if (kind === "form") {
    // form / submit
    return (
      <svg {...p}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8" />
      </svg>
    );
  }
  if (kind === "forward") {
    // share / arrow-up-right
    return (
      <svg {...p}>
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13" />
      </svg>
    );
  }
  if (kind === "return") {
    // return / refresh-cw
    return (
      <svg {...p}>
        <path d="M3 12a9 9 0 1015-6.7M21 3v5h-5" />
      </svg>
    );
  }
  if (kind === "first") {
    // page view / eye
    return (
      <svg {...p}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  // email-open
  return (
    <svg {...p}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6L12 13 2 6" />
    </svg>
  );
}

// ---------- Salesforce (right) ----------

const SF_BLUE = "#00A1E0";       // Salesforce sky cloud
const SF_NAVY = "#032E61";       // Lightning navy header (richer than #16325C)
const SF_LINK = "#0070D2";       // Lightning link blue
const SF_TEXT = "#080707";
const SF_MUTED = "#54698D";
const SF_LINE = "#DDDBDA";
const SF_BG_MUTED = "#F3F2F2";

function SalesforcePanel() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${SF_LINE}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 18px 40px -22px rgba(26,24,21,0.18)",
        fontFamily:
          "'Salesforce Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Lightning top bar — cloud logo + Sales Cloud · Contact + app launcher waffle */}
      <div
        style={{
          background: SF_NAVY,
          color: "#FFFFFF",
          padding: "9px 14px",
          fontSize: 11.5,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* App launcher waffle */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
            opacity: 0.8,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <i
              key={i}
              style={{
                width: 3,
                height: 3,
                borderRadius: 1,
                background: "#FFFFFF",
              }}
            />
          ))}
        </span>
        {/* Cloud logo */}
        <SalesforceCloud size={20} />
        <span style={{ fontWeight: 600, letterSpacing: "-0.005em" }}>Sales Cloud</span>
        <span style={{ opacity: 0.55 }}>·</span>
        <span style={{ opacity: 0.85 }}>Contact</span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            opacity: 0.75,
            fontSize: 10.5,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "#48C78E",
              boxShadow: "0 0 4px #48C78E",
            }}
          />
          Live · syncing
        </span>
      </div>

      {/* Contact header — Lightning record-page style */}
      <div
        style={{
          padding: "16px 18px 14px",
          background: SF_BG_MUTED,
          borderBottom: `1px solid ${SF_LINE}`,
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: SF_BLUE,
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.02em",
            flexShrink: 0,
            boxShadow: "0 4px 10px -3px rgba(0,161,224,0.35)",
          }}
        >
          JD
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: SF_MUTED,
            }}
          >
            Contact
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 17,
              fontWeight: 700,
              color: SF_TEXT,
              letterSpacing: "-0.01em",
            }}
          >
            John Donahoe
          </div>
          <div style={{ marginTop: 1, fontSize: 12, color: SF_MUTED }}>
            President &amp; CEO ·{" "}
            <span style={{ color: SF_LINK, fontWeight: 500 }}>Nike, Inc.</span>
          </div>
        </div>
        {/* Action chips — Edit / Follow (Lightning-style) */}
        <div style={{ display: "inline-flex", gap: 6 }}>
          {["Edit", "Follow"].map((b) => (
            <span
              key={b}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: SF_LINK,
                background: "#FFFFFF",
                border: `1px solid ${SF_LINE}`,
                borderRadius: 4,
                padding: "5px 10px",
              }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: "8px 18px 16px" }}>
        {SF_FIELDS.map((f) => (
          <SFField key={f.label} {...f} />
        ))}
      </div>
    </div>
  );
}

function SalesforceCloud({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.2 6.1c.6-.7 1.5-1.1 2.5-1.1 1.3 0 2.5.7 3.1 1.8.4-.2.8-.3 1.3-.3 1.8 0 3.2 1.5 3.2 3.3 0 .4-.1.8-.2 1.1.7.3 1.2 1 1.2 1.9 0 1.1-.9 2-2 2-.3 0-.5 0-.8-.1-.5 1.1-1.6 1.9-2.9 1.9-.5 0-1-.1-1.4-.3-.5 1.1-1.7 1.9-3 1.9-1.3 0-2.5-.8-3-1.9-.3.1-.6.1-.9.1-1.7 0-3.1-1.4-3.1-3.1 0-1.1.6-2.1 1.5-2.6-.2-.5-.3-1-.3-1.5 0-2 1.6-3.6 3.5-3.6 1.2 0 2.2.5 2.8 1.4z"
        fill={SF_BLUE}
      />
    </svg>
  );
}

function SFField({
  label,
  value,
  custom,
}: {
  label: string;
  value: string;
  custom?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
        gap: 12,
        padding: "9px 0",
        borderBottom: `1px solid #ECEBEA`,
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: SF_MUTED,
          letterSpacing: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {custom && (
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.06em",
              background: "#EEF4FF",
              color: SF_LINK,
              padding: "1px 4px",
              borderRadius: 2,
            }}
          >
            LP STUDIO
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: SF_TEXT,
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}
