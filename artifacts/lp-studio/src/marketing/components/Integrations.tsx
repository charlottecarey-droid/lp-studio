import type { CSSProperties, ComponentType } from "react";
import { useInView } from "../hooks/useInView";

// Tiny brand-style SVG marks. Not licensed wordmarks — abstract glyphs in
// each brand's accent color so the strip reads as real integrations rather
// than a list of uppercase strings. Three categories laid out in their own
// rows: CRM / Marketing / Data + Sales tools.

interface Integration {
  name: string;
  color: string;
  mark: ComponentType<{ color: string }>;
}

const CRM_TOOLS: Integration[] = [
  { name: "Salesforce", color: "#00A1E0", mark: SalesforceMark },
  { name: "HubSpot",    color: "#FF7A59", mark: HubspotMark },
  { name: "6sense",     color: "#1A1A1A", mark: SixsenseMark },
  { name: "Clearbit",   color: "#3B82F6", mark: ClearbitMark },
];

const MARKETING_TOOLS: Integration[] = [
  { name: "Marketo",     color: "#5C4C9F", mark: MarketoMark },
  { name: "Iterable",    color: "#FFB200", mark: IterableMark },
  { name: "Chili Piper", color: "#E26B4F", mark: ChiliPiperMark },
  { name: "Outreach",    color: "#5952FF", mark: OutreachMark },
];

const DATA_TOOLS: Integration[] = [
  { name: "Segment",   color: "#52BD95", mark: SegmentMark },
  { name: "Snowflake", color: "#29B5E8", mark: SnowflakeMark },
  { name: "Mixpanel",  color: "#7856FF", mark: MixpanelMark },
  { name: "Slack",     color: "#611F69", mark: SlackMark },
];

const groups: { label: string; subtitle: string; items: Integration[] }[] = [
  { label: "CRM & ABM",       subtitle: "Read accounts, contacts, intent",    items: CRM_TOOLS },
  { label: "Marketing & sales", subtitle: "Hand off leads, fire events",       items: MARKETING_TOOLS },
  { label: "Data & ops",      subtitle: "Stream events, sync the warehouse", items: DATA_TOOLS },
];

// ── Marks ────────────────────────────────────────────────────────────────

function SalesforceMark({ color }: { color: string }) {
  // Stylized cloud
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M9 22c-3.3 0-6-2.7-6-6 0-3.1 2.5-5.7 5.5-6 .9-2.4 3.3-4 6-4 2.4 0 4.4 1.3 5.5 3.2.7-.3 1.4-.4 2.2-.4 3.3 0 6 2.7 6 6 0 .7-.1 1.4-.4 2.1.6.5 1 1.3 1 2.1 0 1.7-1.3 3-3 3H9z"
        fill={color}
      />
    </svg>
  );
}
function HubspotMark({ color }: { color: string }) {
  // Hub + spoke
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="11" r="4" fill="none" stroke={color} strokeWidth="2.2" />
      <circle cx="16" cy="25" r="3" fill={color} />
      <path d="M16 15v6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 9l4 2.5M24 9l-4 2.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="7" cy="8" r="2" fill={color} />
      <circle cx="25" cy="8" r="2" fill={color} />
    </svg>
  );
}
function SixsenseMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M22 6 L10 6 A6 6 0 0 0 4 12 L4 20 A6 6 0 0 0 10 26 L22 26 A6 6 0 0 0 28 20 L28 12 A6 6 0 0 0 22 6 Z" fill={color}/>
      <text x="16" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800" fontFamily="DM Sans, sans-serif">6</text>
    </svg>
  );
}
function ClearbitMark({ color }: { color: string }) {
  // Bold pixel-cluster glyph
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4"  y="4"  width="10" height="10" rx="2" fill={color} />
      <rect x="18" y="4"  width="10" height="10" rx="2" fill={color} fillOpacity="0.55" />
      <rect x="4"  y="18" width="10" height="10" rx="2" fill={color} fillOpacity="0.55" />
      <rect x="18" y="18" width="10" height="10" rx="2" fill={color} />
    </svg>
  );
}
function MarketoMark({ color }: { color: string }) {
  // M of curves
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 26 L6 6 L12 14 L18 6 L18 26" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="16" r="3" fill={color} />
    </svg>
  );
}
function IterableMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4 L26 16 L16 28 L6 16 Z" fill={color}/>
      <circle cx="16" cy="16" r="3.5" fill="#FFFFFF" />
    </svg>
  );
}
function ChiliPiperMark({ color }: { color: string }) {
  // Calendar with chili
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="7" width="24" height="20" rx="3" fill="none" stroke={color} strokeWidth="2.4"/>
      <path d="M4 13 L28 13" stroke={color} strokeWidth="2.4"/>
      <path d="M16 16 c-1 4 3 6 3 9" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
function OutreachMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 22 L16 4 L28 22 Z" fill={color}/>
      <path d="M11 22 L16 14 L21 22 Z" fill="#FFFFFF" />
    </svg>
  );
}
function SegmentMark({ color }: { color: string }) {
  // Two arcs
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 12 Q 16 4, 28 12" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M4 22 Q 16 30, 28 22" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="6" cy="22" r="2.4" fill={color} />
      <circle cx="26" cy="12" r="2.4" fill={color} />
    </svg>
  );
}
function SnowflakeMark({ color }: { color: string }) {
  // Six-spoke star
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <path d="M16 4 v24" />
        <path d="M5.6 10 L26.4 22" />
        <path d="M5.6 22 L26.4 10" />
      </g>
      <circle cx="16" cy="16" r="3" fill={color} />
    </svg>
  );
}
function MixpanelMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="9" cy="16" r="3" fill={color}/>
      <circle cx="17" cy="16" r="5" fill={color} fillOpacity="0.6"/>
      <circle cx="25" cy="16" r="3" fill={color}/>
    </svg>
  );
}
function SlackMark({ color }: { color: string }) {
  // Four rounded rect cluster
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="13" width="11" height="3.4" rx="1.7" fill={color}/>
      <rect x="17" y="13" width="11" height="3.4" rx="1.7" fill={color}/>
      <rect x="13" y="4"  width="3.4" height="11" rx="1.7" fill={color}/>
      <rect x="13" y="17" width="3.4" height="11" rx="1.7" fill={color}/>
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
              Drops into the tools you already use.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.6]" style={{ color: "var(--ink-soft)" }}>
              CRM, MAP, analytics, scheduling — read from where your data lives, write back to where your team works.
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
              Open API · Zapier · Webhooks
            </span>
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

        {/* Bottom strip: counts + reassurance */}
        <div
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-5 md:p-6 rounded-2xl"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          {[
            { value: "30+", label: "Native integrations" },
            { value: "REST + GraphQL", label: "Open API · webhooks · SDK" },
            { value: "<5 min", label: "Median setup, any tool" },
          ].map((m, i) => (
            <div
              key={m.label}
              className="flex items-baseline gap-3"
              style={{ borderLeft: i === 0 ? "none" : "1px solid var(--hairline)", paddingLeft: i === 0 ? 0 : 20 }}
            >
              <span
                className="font-display"
                style={{
                  color: "var(--ink)",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.022em",
                  lineHeight: 1,
                }}
              >
                {m.value}
              </span>
              <span
                className="text-[12.5px]"
                style={{ color: "var(--ink-soft)" }}
              >
                {m.label}
              </span>
            </div>
          ))}
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
          Connected
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
