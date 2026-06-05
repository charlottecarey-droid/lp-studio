import Icon from "./EmbedIcons";

// DashboardEmbed — ports design-preview/ui_kits/app/Dashboard.jsx into TSX.
// Marketing-mode dashboard: 4-stat header, pending review callout, recent
// work list + top pages sidebar. No external dependencies.

const STAT_TILES: { label: string; value: string; icon: string; delta?: number }[] = [
  { label: "Live pages", value: "3", icon: "dot-warm" },
  { label: "Visits · 7d", value: "14,208", icon: "eye", delta: 38 },
  { label: "Leads · 7d", value: "326", icon: "users", delta: 52 },
  { label: "Drafts", value: "5", icon: "file-text" },
];

const RECENT: { name: string; slug: string; date: string; live: boolean }[] = [
  { name: "Product Launch LP", slug: "/product-launch", date: "May 30", live: true },
  { name: "Q3 ABM — Acme", slug: "/abm-acme", date: "May 30", live: true },
  { name: "Pricing Page v2", slug: "/pricing-v2", date: "May 30", live: true },
  { name: "Webinar RSVP — split test", slug: "/webinar-rsvp-test", date: "May 14", live: false },
  { name: "Platform overview demo", slug: "/platform-overview", date: "May 7", live: false },
  { name: "Demo Request v2", slug: "/demo-request-v2", date: "May 7", live: false },
];

const TOP_PAGES: { name: string; visits: string; leads: number }[] = [
  { name: "Product Launch v2", visits: "4,388", leads: 60 },
  { name: "Pricing Page", visits: "232", leads: 11 },
  { name: "Webinar RSVP", visits: "109", leads: 5 },
  { name: "Q3 ABM — Acme", visits: "39", leads: 3 },
  { name: "Demo Request LP", visits: "5", leads: 0 },
];

function StatTile({ t }: { t: (typeof STAT_TILES)[number] }) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span
          style={{
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: "var(--ink)",
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {t.value}
        </span>
        {typeof t.delta === "number" && (
          <span
            style={{
              color: t.delta >= 0 ? "#1f9d57" : "#d4564a",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Icon name={t.delta >= 0 ? "trending-up" : "trending-down"} size={11} />
            {Math.abs(t.delta)}%
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-mute)",
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {t.icon === "dot-warm" ? (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--coral)",
              boxShadow: "0 0 6px var(--coral)",
            }}
          />
        ) : (
          <Icon name={t.icon} size={11} />
        )}
        {t.label}
      </div>
    </div>
  );
}

export default function DashboardEmbed() {
  return (
    <div
      className="de-root"
      style={{
        height: "100%",
        background: "var(--cream)",
        padding: "24px 30px",
        overflow: "auto",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: "var(--ink-faint)",
                margin: "0 0 4px",
              }}
            >
              Monday, June 1
            </p>
            <h1
              style={{
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.022em",
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Good afternoon
            </h1>
            <p
              style={{
                color: "var(--ink-mute)",
                fontSize: 13.5,
                margin: "5px 0 0",
              }}
            >
              3 live · 5 draft · 14,208 visits this week
            </p>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 8,
              background: "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)",
              color: "var(--cream)",
              border: "1px solid rgba(0,0,0,0.4)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 14px -6px rgba(26,24,21,0.4)",
              textShadow: "0 1px 0 rgba(0,0,0,0.25)",
            }}
          >
            <Icon name="plus" size={13} /> New
            <Icon name="chevron-down" size={11} style={{ opacity: 0.7 }} />
          </span>
        </div>

        {/* Stat tiles */}
        <div
          className="de-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          {STAT_TILES.map((t) => (
            <StatTile key={t.label} t={t} />
          ))}
        </div>

        {/* Pending review */}
        <div>
          <div
            className="font-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 10,
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              fontWeight: 700,
            }}
          >
            <Icon name="clock" size={12} /> Pending review
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                background: "#fef3c7",
                color: "#92670c",
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              1
            </span>
          </div>
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: 12,
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  marginBottom: 3,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>
                  Enterprise Plan LP
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: "color-mix(in srgb, var(--ink) 6%, var(--paper))",
                    color: "var(--ink-mute)",
                    padding: "2px 7px",
                    borderRadius: 4,
                  }}
                >
                  Asana
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11.5,
                    color: "var(--ink-mute)",
                  }}
                >
                  <Icon name="eye" size={11} />
                  Preview
                  <Icon name="external-link" size={10} />
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-mute)", margin: 0 }}>
                Submitted by alex.rivera@northwind.io · 21 days ago
              </p>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: 7,
                  color: "#d4564a",
                  border: "1px solid rgba(212,86,74,0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "var(--paper)",
                }}
              >
                <Icon name="thumbs-down" size={12} /> Reject
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: 7,
                  background: "#1f9d57",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 10px -4px rgba(31,157,87,0.4)",
                }}
              >
                <Icon name="thumbs-up" size={12} /> Approve
              </span>
            </div>
          </div>
        </div>

        {/* Two-column work grid */}
        <div
          className="de-work"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 22,
          }}
        >
          {/* Recent work */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Recent work
              </span>
              <div style={{ display: "flex", gap: 14 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--ink-mute)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  All pages
                  <Icon name="arrow-up-right" size={11} />
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--ink-mute)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Tests
                  <Icon name="arrow-up-right" size={11} />
                </span>
              </div>
            </div>
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
              }}
            >
              {RECENT.map((r, i) => (
                <div
                  key={r.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 16px",
                    borderTop: i ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: r.live
                        ? "var(--coral)"
                        : "color-mix(in srgb, var(--ink-mute) 30%, transparent)",
                      boxShadow: r.live ? "0 0 6px var(--coral)" : "none",
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 12.5,
                        color: "var(--ink)",
                        marginBottom: 2,
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-mute)",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <code
                        style={{
                          fontFamily:
                            "JetBrains Mono, ui-monospace, monospace",
                          fontSize: 10.5,
                        }}
                      >
                        {r.slug}
                      </code>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {r.date}
                      </span>
                    </div>
                  </div>
                  <Icon
                    name="pencil"
                    size={12}
                    style={{ color: "var(--ink-faint)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Top pages */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  fontWeight: 700,
                }}
              >
                Top pages · 30d
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--ink-mute)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Analytics
                <Icon name="arrow-up-right" size={11} />
              </span>
            </div>
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
              }}
            >
              {TOP_PAGES.map((p, i) => (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderTop: i ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <Icon
                    name="layout-grid"
                    size={12}
                    style={{ color: "var(--ink-faint)" }}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      display: "flex",
                      gap: 10,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Icon name="eye" size={10} />
                      {p.visits}
                    </span>
                    {p.leads > 0 && (
                      <span
                        style={{
                          color: "var(--ink)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Icon name="users" size={10} />
                        {p.leads}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
