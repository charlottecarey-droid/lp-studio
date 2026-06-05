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
  { name: "RB2B",              color: "#0A8C5C", mark: Rb2bMark },
  { name: "Apollo",            color: "#5952FF", mark: ApolloMark },
  { name: "Google Analytics 4",color: "#F5B83E", mark: Ga4Mark },
];

const groups: { label: string; subtitle: string; items: Integration[] }[] = [
  { label: "Lead handoff",       subtitle: "Push form fills to MAP, sheets, or any webhook",  items: LEAD_HANDOFF },
  { label: "Scheduling & ops",   subtitle: "Book meetings, route reviews, send follow-ups",   items: SCHEDULING_OPS },
  { label: "Signals & analytics", subtitle: "Know who's on the page, push events to GA4",     items: SIGNALS_ANALYTICS },
];

// ── Brand marks ──────────────────────────────────────────────────────────
// Inline SVG marks approximating each brand's actual logo shape, normalized
// to 24×24 viewBox for visual consistency. Single-color so they tint to the
// brand color the tile uses. Drawn from publicly recognizable logo
// silhouettes — close enough to read as "the real brand" without copying
// proprietary multi-color assets.

function SalesforceMark({ color }: { color: string }) {
  // Three-lobe cloud, flat bottom — Salesforce's signature mark
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.2 6.1c.6-.7 1.5-1.1 2.5-1.1 1.3 0 2.5.7 3.1 1.8.4-.2.8-.3 1.3-.3 1.8 0 3.2 1.5 3.2 3.3 0 .4-.1.8-.2 1.1.7.3 1.2 1 1.2 1.9 0 1.1-.9 2-2 2-.3 0-.5 0-.8-.1-.5 1.1-1.6 1.9-2.9 1.9-.5 0-1-.1-1.4-.3-.5 1.1-1.7 1.9-3 1.9-1.3 0-2.5-.8-3-1.9-.3.1-.6.1-.9.1-1.7 0-3.1-1.4-3.1-3.1 0-1.1.6-2.1 1.5-2.6-.2-.5-.3-1-.3-1.5 0-2 1.6-3.6 3.5-3.6 1.2 0 2.2.5 2.8 1.4z"
        fill={color}
      />
    </svg>
  );
}
function MarketoMark({ color }: { color: string }) {
  // Marketo's slanted-M with the trailing bullet point
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.4 0v24L8.7 19.5V4.5z" fill={color} />
      <path d="M7.05 18.6L4.2 17.1V7l2.85-1.5z" fill={color} fillOpacity="0.6" />
      <path d="M2.7 15.3L1.05 14.4V9.6l1.65-.9z" fill={color} fillOpacity="0.4" />
    </svg>
  );
}
function SheetsMark({ color }: { color: string }) {
  // Google Sheets — dog-eared sheet with column/row grid
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        fill={color}
      />
      <path d="M14 2v6h6" fill="none" stroke="#fff" strokeWidth="1.4" />
      <rect x="7.5" y="11.5" width="9" height="7" rx="0.5" fill="none" stroke="#fff" strokeWidth="1.2" />
      <path d="M7.5 14.5h9 M7.5 17h9 M10.5 11.5v7 M13.5 11.5v7" stroke="#fff" strokeWidth="1.1" />
    </svg>
  );
}
function WebhookMark({ color }: { color: string }) {
  // webhook.org Y-shape with three terminal circles
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="6.5" r="2.6" fill={color} />
      <circle cx="6" cy="18" r="2.6" fill={color} />
      <circle cx="18" cy="18" r="2.6" fill={color} />
      <path d="M12 8.5L7.2 16.2 M12 8.5l4.8 7.7 M7.6 18h8.8" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function ChiliPiperMark({ color }: { color: string }) {
  // Stylized chili pepper — round bell at top tapering to a point
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 4c0-1 .7-1.8 1.5-2 .4-.1.6.2.4.5-.4.6-.4 1.2.1 1.7s1.4.7 2.1.2c.3-.2.7 0 .6.4-.2 1.1-1.3 2-2.5 2-.2 0-.4 0-.6-.1-.3 1.6-1.3 3-2.7 3.8 2.1 1 3.6 3.1 3.6 5.5 0 3.4-2.7 6.1-6.1 6.1S4.3 19.4 4.3 16c0-4.7 4-9 9.7-12z"
        fill={color}
      />
    </svg>
  );
}
function AsanaMark({ color }: { color: string }) {
  // Asana's three-dot cluster (top center + two lower outer)
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="6.5" r="3.5" fill={color} />
      <circle cx="6.5" cy="16" r="3.5" fill={color} />
      <circle cx="17.5" cy="16" r="3.5" fill={color} />
    </svg>
  );
}
function ResendMark({ color }: { color: string }) {
  // Resend's wordmark "R" condensed into a glyph
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.5 4.5h7c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5h-2.5l5 6h-4l-4.5-5.5v5.5h-4v-15h2.5z M9.5 8v3h3c.8 0 1.5-.7 1.5-1.5S13.3 8 12.5 8z"
        fill={color}
      />
    </svg>
  );
}
function Rb2bMark({ color }: { color: string }) {
  // RB2B is a wordmark in their branding; reduce to a compact monogram for
  // tile placement — a rounded "R" with a small terminal dot signalling
  // visitor identity / known-person resolution.
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4h7.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5h-1.7l4.7 6h-3.5l-4.5-5.8V19H5V4zm3 3v3.5h4c1 0 1.7-.8 1.7-1.7S13 7 12 7H8z"
        fill={color}
      />
      <circle cx="19" cy="19" r="2.4" fill={color} />
    </svg>
  );
}
function ApolloMark({ color }: { color: string }) {
  // Apollo.io — geometric A with stacked tiers
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3L3 21h4l1.8-4h6.4l1.8 4h4z" fill={color} />
      <path d="M10 13h4l-2-4.5z" fill="#fff" />
    </svg>
  );
}
function Ga4Mark({ color }: { color: string }) {
  // Google Analytics — three ascending columns, tallest on the right
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="14" width="4.5" height="7" rx="2.25" fill={color} fillOpacity="0.55" />
      <rect x="9.75" y="8" width="4.5" height="13" rx="2.25" fill={color} fillOpacity="0.78" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="2.25" fill={color} />
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
              <div className="col-span-12 md:col-span-9 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
            href="mailto:admin@lpstudio.ai?subject=Integration%20request"
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
