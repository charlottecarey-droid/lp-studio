// AppPlaceholder — lightweight stylized representation of an app surface for
// FeatureRow sections whose full embed hasn't been ported yet (Builder,
// Templates, Dashboard). Renders a faux app shell (left sidebar + top toolbar
// + content area with labeled blocks) tinted by the accent color. Looks
// intentional rather than "coming soon" so the page reads as complete while
// the full ports happen in a follow-up.

interface AppPlaceholderProps {
  /** The kind of surface we're representing — drives the body composition. */
  variant: "builder" | "templates" | "dashboard";
  /** Accent color for the active sidebar item + top toolbar action. */
  accent?: string;
}

const SIDEBAR_ITEMS: Record<AppPlaceholderProps["variant"], string[]> = {
  builder: ["Pages", "Templates", "Brand", "Analytics", "Settings"],
  templates: ["Pages", "Templates", "Brand", "Analytics", "Settings"],
  dashboard: ["Dashboard", "Pages", "Templates", "Brand", "Analytics"],
};

const ACTIVE_INDEX: Record<AppPlaceholderProps["variant"], number> = {
  builder: 0,
  templates: 1,
  dashboard: 0,
};

export default function AppPlaceholder({
  variant,
  accent = "var(--indigo)",
}: AppPlaceholderProps) {
  const items = SIDEBAR_ITEMS[variant];
  const activeIdx = ACTIVE_INDEX[variant];

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "190px 1fr",
        background: "var(--cream)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          background: "var(--paper)",
          borderRight: "1px solid var(--hairline)",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            padding: "6px 8px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--indigo)",
              boxShadow: "0 0 6px var(--indigo)",
            }}
          />
          LP Studio
        </div>
        {items.map((label, i) => (
          <div
            key={label}
            style={{
              fontSize: 13,
              fontWeight: i === activeIdx ? 600 : 500,
              color: i === activeIdx ? "var(--ink)" : "var(--ink-soft)",
              background: i === activeIdx ? "var(--indigo-soft)" : "transparent",
              borderRadius: 7,
              padding: "8px 10px",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ overflow: "auto" }}>
        {/* Top toolbar */}
        <div
          style={{
            background: "var(--paper)",
            borderBottom: "1px solid var(--hairline)",
            padding: "14px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "-0.018em",
              color: "var(--ink)",
            }}
          >
            {variant === "builder"
              ? "Q4 Partner Expansion · Hero"
              : variant === "templates"
              ? "Templates"
              : "Dashboard"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--ink)",
                background: "var(--paper)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: 7,
                padding: "6px 12px",
              }}
            >
              {variant === "builder"
                ? "Preview"
                : variant === "templates"
                ? "Filter"
                : "Last 30d"}
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#fff",
                background: accent,
                borderRadius: 7,
                padding: "6px 14px",
                boxShadow: `0 6px 14px -6px ${accent}`,
              }}
            >
              {variant === "builder"
                ? "Publish"
                : variant === "templates"
                ? "New page"
                : "Export"}
            </span>
          </div>
        </div>

        <div style={{ padding: "26px 26px" }}>
          {variant === "builder" && <BuilderBody accent={accent} />}
          {variant === "templates" && <TemplatesBody />}
          {variant === "dashboard" && <DashboardBody accent={accent} />}
        </div>
      </div>
    </div>
  );
}

function BuilderBody({ accent }: { accent: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
      {/* Canvas */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          padding: 24,
          minHeight: 380,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            color: accent,
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            borderRadius: 999,
            padding: "4px 11px",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Selected · Hero block
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "var(--ink)",
            lineHeight: 1.05,
            marginBottom: 8,
          }}
        >
          Pipeline that{" "}
          <span style={{ color: accent }}>writes itself.</span>
        </div>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.55,
            margin: "0 0 18px",
            maxWidth: 420,
          }}
        >
          AI-native CRM that drafts follow-ups, scores intent, and books
          meetings while your team focuses on closing.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <span
            style={{
              background: "var(--ink)",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            Start free trial
          </span>
          <span
            style={{
              border: "1px solid var(--hairline-strong)",
              padding: "8px 16px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Book a demo
          </span>
        </div>
      </div>

      {/* Inspector */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        {["Layout", "Spacing", "Typography", "Colors", "Animation"].map(
          (label, i) => (
            <div
              key={label}
              style={{
                paddingTop: i === 0 ? 0 : 10,
                marginTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 8,
                  fontWeight: 700,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  background: "var(--cream)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--ink-2)",
                }}
              >
                {label === "Layout"
                  ? "SplitRight"
                  : label === "Spacing"
                  ? "Comfy"
                  : label === "Typography"
                  ? "DM Sans · 96px"
                  : label === "Colors"
                  ? accent
                  : "Fade up"}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function TemplatesBody() {
  const cards = [
    { name: "Product launch — hero + logos", meta: "Launch · Demand gen", tint: "var(--indigo-soft)" },
    { name: "Webinar registration", meta: "Event · Demand gen", tint: "var(--coral-soft)" },
    { name: "Pricing tiers", meta: "Conversion", tint: "var(--sage-soft)" },
    { name: "ABM microsite", meta: "Sales · ABM", tint: "var(--gold-soft)" },
    { name: "Demo booking", meta: "Conversion", tint: "var(--indigo-soft)" },
    { name: "Customer story", meta: "Trust · Demand gen", tint: "var(--coral-soft)" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.name}
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              aspectRatio: "4 / 3",
              background: c.tint,
              padding: 14,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                right: 14,
                height: 6,
                borderRadius: 3,
                background: "var(--ink)",
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 32,
                left: 14,
                width: "60%",
                height: 24,
                borderRadius: 4,
                background: "var(--paper)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 62,
                left: 14,
                width: "45%",
                height: 6,
                borderRadius: 3,
                background: "rgba(0,0,0,0.18)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                width: 70,
                height: 18,
                borderRadius: 5,
                background: "var(--ink)",
              }}
            />
          </div>
          <div style={{ padding: "12px 14px" }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 3,
              }}
            >
              {c.name}
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                fontWeight: 600,
              }}
            >
              {c.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardBody({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { v: "8.4%", l: "Conversion rate", delta: "↑ 2.1pp" },
          { v: "12,847", l: "Visits", delta: "↑ 18%" },
          { v: "1,083", l: "Conversions", delta: "↑ 42%" },
          { v: "$148K", l: "Pipeline", delta: "↑ 24%" },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.022em",
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-mute)",
                marginTop: 2,
                display: "flex",
                gap: 8,
              }}
            >
              {s.l}
              <span style={{ color: "var(--sage)", fontWeight: 600 }}>
                {s.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline chart */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            Conversions over time
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              fontWeight: 600,
            }}
          >
            Last 30 days
          </div>
        </div>
        <svg viewBox="0 0 600 180" style={{ width: "100%", height: 180 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="dashSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,140 L40,135 L80,128 L120,130 L160,118 L200,108 L240,98 L280,92 L320,82 L360,76 L400,68 L440,55 L480,48 L520,40 L560,30 L600,22 L600,180 L0,180 Z"
            fill="url(#dashSpark)"
          />
          <path
            d="M0,140 L40,135 L80,128 L120,130 L160,118 L200,108 L240,98 L280,92 L320,82 L360,76 L400,68 L440,55 L480,48 L520,40 L560,30 L600,22"
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
          />
        </svg>
      </div>
    </div>
  );
}
