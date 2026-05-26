import type { CSSProperties, ComponentType } from "react";
import { useInView } from "../hooks/useInView";

// Marketing accuracy pass (May 2026): only integrations with real, shipped
// code paths are listed here. Previously this file showed 12 logos (HubSpot,
// 6sense, Clearbit, Iterable, Outreach, Segment, Snowflake, Mixpanel, Slack,
// plus "30+ integrations" and "REST + GraphQL") — none of those had backend
// implementations. Source of truth: artifacts/api-server/src/lib/* and
// artifacts/api-server/src/routes/*. Do not re-add a logo here unless there
// is a shipped integration to back it.

interface Integration {
  name: string;
  color: string;
  mark: ComponentType<{ color: string }>;
}

// Salesforce is featured separately above the grid (bidirectional sync with
// field mapping is a different class of integration than the others), so it
// is intentionally omitted from the tile list.
const LEAD_HANDOFF: Integration[] = [
  { name: "Marketo",      color: "#5C4C9F", mark: MarketoMark },
  { name: "Google Sheets",color: "#0F9D58", mark: SheetsMark },
  { name: "Webhooks",     color: "#1A1815", mark: WebhookMark },
];

const SCHEDULING_OPS: Integration[] = [
  { name: "Chili Piper", color: "#E26B4F", mark: ChiliPiperMark },
  { name: "Asana",       color: "#F06A6A", mark: AsanaMark },
  { name: "Resend",      color: "#1A1815", mark: ResendMark },
];

const SIGNALS_ANALYTICS: Integration[] = [
  { name: "Apollo",            color: "#5952FF", mark: ApolloMark },
  { name: "Google Analytics 4",color: "#F5B83E", mark: Ga4Mark },
];

const groups: { label: string; subtitle: string; items: Integration[] }[] = [
  { label: "Lead handoff",       subtitle: "Push form fills to MAP, sheets, or any webhook",  items: LEAD_HANDOFF },
  { label: "Scheduling & ops",   subtitle: "Book meetings, route reviews, send follow-ups",   items: SCHEDULING_OPS },
  { label: "Signals & analytics", subtitle: "Know who's on the page, push events to GA4",     items: SIGNALS_ANALYTICS },
];

// ── Marks ────────────────────────────────────────────────────────────────

function SalesforceMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M9 22c-3.3 0-6-2.7-6-6 0-3.1 2.5-5.7 5.5-6 .9-2.4 3.3-4 6-4 2.4 0 4.4 1.3 5.5 3.2.7-.3 1.4-.4 2.2-.4 3.3 0 6 2.7 6 6 0 .7-.1 1.4-.4 2.1.6.5 1 1.3 1 2.1 0 1.7-1.3 3-3 3H9z"
        fill={color}
      />
    </svg>
  );
}
function MarketoMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 26 L6 6 L12 14 L18 6 L18 26" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="16" r="3" fill={color} />
    </svg>
  );
}
function SheetsMark({ color }: { color: string }) {
  // Spreadsheet glyph: rounded rect with two row/column dividers.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="4" width="22" height="24" rx="3" fill="none" stroke={color} strokeWidth="2.4"/>
      <path d="M5 12 H27 M5 20 H27 M16 4 V28" stroke={color} strokeWidth="2"/>
    </svg>
  );
}
function WebhookMark({ color }: { color: string }) {
  // Three-node webhook glyph.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="8"  cy="22" r="3.4" fill={color}/>
      <circle cx="24" cy="22" r="3.4" fill={color}/>
      <circle cx="16" cy="7"  r="3.4" fill={color}/>
      <path d="M10.5 20 L14 11 M18 11 L21.5 20 M11 22 H21" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
function ChiliPiperMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="7" width="24" height="20" rx="3" fill="none" stroke={color} strokeWidth="2.4"/>
      <path d="M4 13 L28 13" stroke={color} strokeWidth="2.4"/>
      <path d="M16 16 c-1 4 3 6 3 9" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
function AsanaMark({ color }: { color: string }) {
  // Three-circle Asana-style cluster.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="9"  r="4.5" fill={color}/>
      <circle cx="9"  cy="21" r="4.5" fill={color}/>
      <circle cx="23" cy="21" r="4.5" fill={color}/>
    </svg>
  );
}
function ResendMark({ color }: { color: string }) {
  // Envelope with motion line.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="8" width="24" height="16" rx="2.5" fill="none" stroke={color} strokeWidth="2.4"/>
      <path d="M4 10 L16 19 L28 10" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ApolloMark({ color }: { color: string }) {
  // Radar / circle-with-blip — IP reveal.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="2.2"/>
      <circle cx="16" cy="16" r="6"  fill="none" stroke={color} strokeWidth="2" opacity="0.5"/>
      <circle cx="22" cy="11" r="2.6" fill={color}/>
    </svg>
  );
}
function Ga4Mark({ color }: { color: string }) {
  // Two ascending bars + dot.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5"  y="16" width="6" height="12" rx="2" fill={color} fillOpacity="0.55"/>
      <rect x="14" y="8"  width="6" height="20" rx="2" fill={color}/>
      <circle cx="26" cy="6" r="3" fill={color}/>
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export default function Integrations() {
  const { ref, inView } = useInView();
  return (
    <section
      id="integrations"
      className="px-6 py-24 md:py-28 relative overflow-hidden"
      style={{ background: "var(--cream)", borderTop: "1px solid var(--hairline)" }}
    >
      {/* Soft indigo orb behind the API hub */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "12%",
          right: "10%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(75,71,229,0.10) 0%, rgba(75,71,229,0) 70%)",
          filter: "blur(6px)",
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
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="marker marker-rule mb-6">Plays nice with your stack</div>
            <h2 className="font-display text-display-md" style={{ color: "var(--ink)" }}>
              Lead handoff to the tools your revenue team already runs.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
              Form fills land in your CRM. Meetings get booked. Reviews route to the right person. Events flow to analytics. Webhooks cover the rest.
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline-strong)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--indigo)",
                boxShadow: "0 0 6px var(--indigo)",
              }}
            />
            <span
              className="text-[11px] uppercase"
              style={{ color: "var(--ink-soft)", letterSpacing: "0.18em", fontWeight: 600 }}
            >
              REST API · Webhooks
            </span>
          </div>
        </div>

        {/* Featured: Salesforce — first-class, bidirectional sync with field mapping,
         *  Lead + Opportunity sync, and named-account routing. It's the deepest
         *  integration we ship, so it earns its own panel. */}
        <div
          className="mb-6 p-5 md:p-6 rounded-2xl grid grid-cols-12 gap-4 md:gap-6 items-center"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, #00A1E0 7%, var(--paper)) 0%, var(--paper) 65%)",
            border: "1px solid color-mix(in srgb, #00A1E0 25%, var(--hairline))",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <div className="col-span-12 md:col-span-4 flex items-center gap-3">
            <div
              className="shrink-0 inline-flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "color-mix(in srgb, #00A1E0 10%, transparent)",
                border: "1px solid color-mix(in srgb, #00A1E0 30%, transparent)",
              }}
            >
              <SalesforceMark color="#00A1E0" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="font-mono uppercase"
                  style={{ color: "#0085BB", fontSize: 10, letterSpacing: "0.2em", fontWeight: 700 }}
                >
                  Featured · CRM
                </span>
              </div>
              <div
                className="font-display"
                style={{ color: "var(--ink)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                Salesforce, deeply.
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-5">
            <p className="text-[14px] leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
              Two-way sync with custom field mapping. Form fills create Leads or Opportunities, routed by account ownership. Sales Console pulls campaign and opportunity context back into LP Studio so reps build pages around live pipeline.
            </p>
          </div>
          <div className="col-span-12 md:col-span-3">
            <ul className="text-[12.5px] space-y-1.5" style={{ color: "var(--ink)" }}>
              {[
                "Bidirectional Lead + Opp sync",
                "Per-tenant field mapping UI",
                "Named-account routing",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "#00A1E0",
                      marginTop: 7,
                      flexShrink: 0,
                    }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div
              key={g.label}
              className="grid grid-cols-12 gap-4 md:gap-6 items-stretch"
            >
              <div className="col-span-12 md:col-span-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "var(--ink-faint)",
                    }}
                  />
                  <div
                    className="font-mono uppercase"
                    style={{ color: "var(--ink-mute)", fontSize: 11, letterSpacing: "0.18em", fontWeight: 600 }}
                  >
                    {g.label}
                  </div>
                </div>
                <div className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
                  {g.subtitle}
                </div>
              </div>
              <div className="col-span-12 md:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-3">
                {g.items.map((it) => (
                  <IntegrationTile key={it.name} {...it} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom strip: honest framing — no fabricated "30+" claim. */}
        <div
          className="mt-12 p-5 md:p-6 rounded-2xl flex flex-wrap items-center gap-4 md:gap-6"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <span
            className="font-display"
            style={{
              color: "var(--ink)",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.018em",
              lineHeight: 1.2,
            }}
          >
            Don't see your tool?
          </span>
          <span
            className="text-[13.5px]"
            style={{ color: "var(--ink-soft)", flex: "1 1 320px", lineHeight: 1.5 }}
          >
            Every form supports custom webhooks — most teams wire a new tool in under five minutes. New native integrations ship by request from beta customers.
          </span>
          <a
            href="#waitlist"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-colors"
            style={{
              background: "var(--ink)",
              color: "var(--cream)",
              fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
              letterSpacing: "-0.005em",
              boxShadow: "0 4px 10px -4px rgba(26,24,21,0.3)",
            }}
          >
            Request an integration
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14"/>
              <path d="M13 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

const tileBase: CSSProperties = {
  background: "var(--paper)",
  border: "1px solid var(--hairline)",
  borderRadius: 12,
  padding: "14px 14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  transition: "all 200ms ease",
  boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
};

function IntegrationTile({ name, color, mark }: Integration) {
  const MarkComp = mark;
  return (
    <button
      type="button"
      className="group text-left"
      style={tileBase}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 40%, transparent)`;
        e.currentTarget.style.boxShadow =
          `0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 14px -8px color-mix(in srgb, ${color} 50%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "var(--hairline)";
        e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.6) inset";
      }}
    >
      <div
        className="shrink-0 inline-flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `color-mix(in srgb, ${color} 8%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        }}
      >
        <MarkComp color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[13.5px] truncate"
          style={{
            color: "var(--ink)",
            fontFamily: "'DM Sans', 'Inter', ui-sans-serif, sans-serif",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          {name}
        </div>
        <div className="text-[10.5px] uppercase mt-0.5" style={{ color: "var(--ink-mute)", letterSpacing: "0.14em", fontWeight: 600 }}>
          Shipped
        </div>
      </div>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 6px color-mix(in srgb, ${color} 50%, transparent)`,
        }}
      />
    </button>
  );
}
