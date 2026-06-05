import Icon from "./EmbedIcons";

// BuilderEmbed — ports design-preview/ui_kits/app/Builder.jsx into TSX. Three-
// pane editor: blocks library (left) · live canvas (center) · properties
// (right). The center canvas renders the full fake "Northwind Summit" event
// landing page from the Claude design package — hero · agenda · speakers ·
// venue · footer — with real Unsplash imagery throughout. The outline +
// floating toolbar wraps just the hero (the "selected block") and the rest
// of the page scrolls below it in the canvas pane.

const VIOLET = "#4B47E5";
const NAV_LINKS = ["Agenda", "Details", "Photos"];
const NAV_LINKS_PROPS: [string, string][] = [
  ["Agenda", "#agenda"],
  ["Details", "#details"],
  ["Photos", "#photos"],
];
// Real imagery from Unsplash — matches the photo IDs the design package used.
const HERO_BG =
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=1600&h=900&fit=crop";
const VENUE_BG =
  "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=1200&h=520&fit=crop";

const AGENDA_DAYS: { day: string; items: [string, string][] }[] = [
  {
    day: "Day 01 · Mar 18",
    items: [
      ["09:30", "Opening keynote — The state of revenue"],
      ["11:00", "Workshop — Pipeline that compounds"],
      ["14:00", "Panel — Forecasting leaders trust"],
    ],
  },
  {
    day: "Day 02 · Mar 19",
    items: [
      ["09:30", "Scaling without scaling headcount"],
      ["11:00", "Workshop — Plays that close"],
      ["15:00", "Closing — What's next for RevOps"],
    ],
  },
];

const SPEAKERS: { name: string; role: string; img: number }[] = [
  { name: "Dana Reyes", role: "VP RevOps, Vertex", img: 32 },
  { name: "Marcus Hale", role: "Head of Growth, Globex", img: 12 },
  { name: "Lena Ortiz", role: "CMO, Meridian", img: 45 },
  { name: "Sang Park", role: "Founder, Northstar", img: 60 },
];

const BLOCKS_LAYOUT: { name: string; kind: BlockKind }[] = [
  { name: "Hero", kind: "hero" },
  { name: "Photo Strip", kind: "photo" },
  { name: "Spacer", kind: "spacer" },
  { name: "Nav Header", kind: "nav" },
  { name: "Footer", kind: "footer" },
  { name: "Full-Bleed Hero", kind: "fullbleed" },
  { name: "Parallax Hero", kind: "parallax" },
  { name: "Sticky Header", kind: "sticky" },
];

type BlockKind =
  | "hero"
  | "photo"
  | "spacer"
  | "nav"
  | "footer"
  | "fullbleed"
  | "parallax"
  | "sticky";

function BlockThumb({ kind }: { kind: BlockKind }) {
  const green = "#16382c";
  const lime = "#c9f24a";
  const navy = "#2a3340";
  const paper = "#e9e4d6";
  const base: React.CSSProperties = {
    width: "100%",
    height: 42,
    borderRadius: 5,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: 6,
    boxSizing: "border-box",
  };
  if (kind === "photo" || kind === "parallax") {
    return (
      <div style={{ ...base, background: navy, flexDirection: "row", gap: 3, padding: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 2 }}
          />
        ))}
      </div>
    );
  }
  if (kind === "spacer") {
    return (
      <div
        style={{
          ...base,
          background: paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "60%", borderTop: "1px dashed #b9b09c" }} />
      </div>
    );
  }
  if (kind === "footer") {
    return (
      <div style={{ ...base, background: green, justifyContent: "flex-end" }}>
        <div style={{ width: "50%", height: 4, background: lime, borderRadius: 2 }} />
        <div style={{ width: "70%", height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 2 }} />
      </div>
    );
  }
  if (kind === "nav") {
    return (
      <div
        style={{
          ...base,
          background: green,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div style={{ width: 14, height: 4, background: lime, borderRadius: 2 }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 8, height: 3, background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
        <div style={{ width: 8, height: 3, background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
      </div>
    );
  }
  if (kind === "fullbleed") {
    return (
      <div
        style={{
          ...base,
          background: green,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "55%", height: 5, background: lime, borderRadius: 2, marginBottom: 2 }} />
        <div style={{ width: "40%", height: 3, background: "rgba(255,255,255,0.35)", borderRadius: 2 }} />
      </div>
    );
  }
  return (
    <div style={{ ...base, background: green, justifyContent: "center" }}>
      <div style={{ width: "60%", height: 5, background: lime, borderRadius: 2 }} />
      <div style={{ width: "75%", height: 3, background: "rgba(255,255,255,0.35)", borderRadius: 2 }} />
      <div style={{ width: "30%", height: 4, background: "rgba(255,255,255,0.5)", borderRadius: 2, marginTop: 2 }} />
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 11.5, fontWeight: 500, marginBottom: 5, color: "var(--ink-2)" }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid var(--hairline)",
          borderRadius: 7,
          padding: "6px 9px",
          background: "#fff",
          fontSize: 12,
          color: "var(--ink)",
          fontFamily: mono
            ? "JetBrains Mono, ui-monospace, monospace"
            : "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10.5,
            color: "var(--ink-mute)",
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function PanelButton({
  label,
  icon,
  primary,
  small,
}: {
  label?: string;
  icon?: string;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: small ? 11.5 : 12,
        fontWeight: 600,
        padding: small ? "4px 8px" : "5px 10px",
        borderRadius: 6,
        background: primary
          ? "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)"
          : "var(--paper)",
        color: primary ? "var(--cream)" : "var(--ink-2)",
        border: primary ? "1px solid rgba(0,0,0,0.4)" : "1px solid var(--hairline-strong)",
        boxShadow: primary
          ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 10px -6px rgba(26,24,21,0.4)"
          : "0 1px 0 rgba(255,255,255,0.6) inset",
        cursor: "default",
        whiteSpace: "nowrap",
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {label}
    </span>
  );
}

export default function BuilderEmbed() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--cream)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 50,
          padding: "0 16px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--paper)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--ink-mute)",
            }}
          >
            <Icon name="arrow-left" size={14} /> Back
          </span>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>
            Northwind Summit
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              color: VIOLET,
              background: "color-mix(in srgb, #4B47E5 10%, #fff)",
              border: "1px solid color-mix(in srgb, #4B47E5 22%, transparent)",
              borderRadius: 999,
              padding: "3px 9px",
              fontWeight: 600,
            }}
          >
            <Icon name="users" size={11} /> Enterprise RevOps
            <Icon name="chevron-down" size={11} />
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1f9d57",
              background: "#e7f6ed",
              borderRadius: 999,
              padding: "3px 9px",
            }}
          >
            Live
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, color: "#b5832a" }}>Unsaved changes</span>
          <PanelButton icon="message-square" label="Comments" small />
          <PanelButton icon="more-horizontal" small />
          <PanelButton icon="external-link" label="View" small />
          <PanelButton icon="save" label="Save" primary small />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 6,
              background:
                "linear-gradient(180deg, #5C58EB 0%, #4B47E5 100%)",
              color: "#fff",
              border: "1px solid rgba(46, 42, 140, 0.55)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 14px -6px rgba(75,71,229,0.45)",
              textShadow: "0 1px 0 rgba(46,42,140,0.4)",
            }}
          >
            <Icon name="globe" size={12} /> Unpublish
          </span>
        </div>
      </div>

      {/* 3-pane body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left — blocks library */}
        <div
          style={{
            width: 230,
            flexShrink: 0,
            borderRight: "1px solid var(--hairline)",
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              padding: "12px 14px 0",
              fontSize: 12.5,
            }}
          >
            {["Blocks", "Segment", "Layers", "Templates"].map((t, i) => (
              <span
                key={t}
                style={{
                  paddingBottom: 8,
                  fontWeight: i === 0 ? 600 : 500,
                  color: i === 0 ? "var(--ink)" : "var(--ink-mute)",
                  borderBottom: i === 0 ? "2px solid var(--ink)" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--hairline)", padding: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--hairline)",
                borderRadius: 7,
                padding: "6px 9px",
                color: "var(--ink-mute)",
                fontSize: 12,
              }}
            >
              <Icon name="search" size={12} />
              <span style={{ flex: 1 }}>Search blocks…</span>
              <Icon name="sliders-horizontal" size={11} />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 12px 14px",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                margin: "6px 2px 8px",
                fontWeight: 700,
              }}
            >
              Layout
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 9,
              }}
            >
              {BLOCKS_LAYOUT.map((b) => (
                <div key={b.name} style={{ cursor: "grab" }}>
                  <div
                    style={{
                      border: "1px solid var(--hairline)",
                      borderRadius: 7,
                      padding: 4,
                      background: "var(--paper)",
                    }}
                  >
                    <BlockThumb kind={b.kind} />
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-2)",
                      marginTop: 4,
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {b.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center — canvas */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            padding: 18,
            display: "flex",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--ink) 4%, var(--cream))",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              borderRadius: 10,
              overflow: "hidden",
              boxShadow:
                "0 28px 60px -22px rgba(26,24,21,0.34), 0 12px 28px -18px rgba(26,24,21,0.18)",
              background: "#fff",
              alignSelf: "flex-start",
            }}
          >
            {/* HERO — the selected block with outline + floating toolbar */}
            <div
              style={{
                position: "relative",
                outline: `2px solid ${VIOLET}`,
                outlineOffset: -2,
                zIndex: 1,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 3,
                  display: "flex",
                  gap: 2,
                  background: "#fff",
                  borderRadius: 7,
                  padding: 3,
                  boxShadow: "0 6px 14px -6px rgba(26,24,21,0.3)",
                }}
              >
                {["grip-vertical", "pencil", "bookmark", "star", "trash-2"].map(
                  (ic) => (
                    <span
                      key={ic}
                      style={{
                        width: 24,
                        height: 24,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 5,
                        color: "var(--ink-mute)",
                      }}
                    >
                      <Icon name={ic} size={13} />
                    </span>
                  ),
                )}
              </div>
              <div
                style={{
                  position: "relative",
                  minHeight: 400,
                  background: "#0c0f12",
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <img
                  src={HERO_BG}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.45,
                    zIndex: 0,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    background:
                      "radial-gradient(120% 90% at 50% 0%, rgba(43,58,68,0.5) 0%, rgba(20,27,34,0.82) 55%, rgba(12,15,18,0.95) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 22px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 20,
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {NAV_LINKS.map((l) => (
                      <span key={l} style={{ textTransform: "uppercase" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      border: "1px solid rgba(255,255,255,0.4)",
                      borderRadius: 4,
                      padding: "6px 12px",
                    }}
                  >
                    Reserve
                  </span>
                </div>
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "40px 24px 52px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.34em",
                      color: "#d8b97a",
                      textTransform: "uppercase",
                      marginBottom: 18,
                    }}
                  >
                    You&apos;re Invited
                  </div>
                  <h1
                    style={{
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: 56,
                      fontWeight: 500,
                      lineHeight: 1,
                      margin: 0,
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      color: "#f3f0ec",
                    }}
                  >
                    Northwind Summit
                  </h1>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.28em",
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "uppercase",
                      margin: "16px 0 14px",
                    }}
                  >
                    The Revenue Leaders Summit · 2026
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 1,
                      background: "rgba(255,255,255,0.4)",
                      marginBottom: 18,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 10.5,
                      letterSpacing: "0.22em",
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      marginBottom: 24,
                    }}
                  >
                    San Francisco, CA · Seats Are Limited
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "#c2a05a",
                      color: "#1c150a",
                      border: "none",
                      borderRadius: 4,
                      padding: "13px 30px",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Request Invite
                  </button>
                </div>
              </div>
            </div>

            {/* AGENDA — ivory band, EB Garamond serif headlines */}
            <div
              style={{
                background: "#f4efe4",
                color: "#1c150a",
                padding: "48px 44px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: "#a98b4e",
                    marginBottom: 12,
                  }}
                >
                  Two Days
                </div>
                <h2
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: 36,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  The Agenda
                </h2>
              </div>
              {AGENDA_DAYS.map((d) => (
                <div
                  key={d.day}
                  style={{ maxWidth: 520, margin: "0 auto 22px" }}
                >
                  <div
                    style={{
                      fontFamily: "JetBrains Mono, ui-monospace, monospace",
                      fontSize: 10.5,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "#a98b4e",
                      marginBottom: 10,
                    }}
                  >
                    {d.day}
                  </div>
                  {d.items.map(([t, title]) => (
                    <div
                      key={title}
                      style={{
                        display: "flex",
                        gap: 18,
                        alignItems: "baseline",
                        padding: "10px 0",
                        borderTop: "1px solid rgba(28,21,10,0.12)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, ui-monospace, monospace",
                          fontSize: 11.5,
                          color: "#6a5a3a",
                          width: 42,
                          flexShrink: 0,
                        }}
                      >
                        {t}
                      </span>
                      <span
                        style={{
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: 17,
                          color: "#241c10",
                        }}
                      >
                        {title}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* SPEAKERS — dark navy, 4-up grid of avatars */}
            <div
              style={{
                background: "#11181f",
                color: "#f3f0ec",
                padding: "48px 44px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    color: "#d8b97a",
                    marginBottom: 12,
                  }}
                >
                  On Stage
                </div>
                <h2
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: 36,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    margin: 0,
                  }}
                >
                  Speakers
                </h2>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 18,
                  maxWidth: 560,
                  margin: "0 auto",
                }}
              >
                {SPEAKERS.map((s) => (
                  <div key={s.name} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 999,
                        margin: "0 auto 10px",
                        overflow: "hidden",
                        border: "1px solid rgba(216,185,122,0.5)",
                        boxShadow:
                          "0 6px 16px -8px rgba(0,0,0,0.6)",
                      }}
                    >
                      <img
                        src={`https://i.pravatar.cc/160?img=${s.img}`}
                        alt={s.name}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          filter: "grayscale(1) sepia(.18)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: "'EB Garamond', Georgia, serif",
                        fontSize: 15,
                        color: "#f3f0ec",
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "rgba(243,240,236,0.55)",
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {s.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VENUE / CTA — ivory, centered, with photo */}
            <div
              style={{
                background: "#f4efe4",
                color: "#1c150a",
                padding: "48px 44px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "#a98b4e",
                  marginBottom: 12,
                }}
              >
                The Venue
              </div>
              <h2
                style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontSize: 30,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  margin: "0 0 10px",
                }}
              >
                The Pavilion, San Francisco
              </h2>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#5a4d34",
                  maxWidth: 380,
                  margin: "0 auto 22px",
                }}
              >
                An intimate two-day gathering on the waterfront. March 18–19,
                2026. Limited to 200 revenue leaders.
              </p>
              <button
                type="button"
                style={{
                  background: "#1c150a",
                  color: "#f3f0ec",
                  border: "none",
                  borderRadius: 4,
                  padding: "12px 28px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Request Invite
              </button>
              <div
                style={{
                  maxWidth: 520,
                  margin: "28px auto 0",
                  aspectRatio: "16/7",
                  borderRadius: 10,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={VENUE_BG}
                  alt="The Pavilion, San Francisco"
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            </div>

            {/* FOOTER — deep dark, centered legal line */}
            <div
              style={{
                background: "#0a0f14",
                color: "rgba(243,240,236,0.5)",
                padding: "22px 44px",
                textAlign: "center",
                fontSize: 10.5,
                letterSpacing: "0.06em",
              }}
            >
              Northwind Summit · San Francisco · 2026
            </div>
          </div>
        </div>

        {/* Right — properties */}
        <div
          style={{
            width: 270,
            flexShrink: 0,
            borderLeft: "1px solid var(--hairline)",
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 18,
              padding: "12px 14px",
              borderBottom: "1px solid var(--hairline)",
              fontSize: 12.5,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                borderBottom: "2px solid var(--ink)",
                paddingBottom: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "var(--ink)",
              }}
            >
              <Icon name="align-left" size={13} /> Content
            </span>
            <span
              style={{
                color: "var(--ink-mute)",
                paddingBottom: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Icon name="sliders-horizontal" size={13} /> Style
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: VIOLET,
                fontWeight: 500,
                marginBottom: 14,
                cursor: "pointer",
              }}
            >
              <Icon name="refresh-cw" size={12} /> Refresh copy
            </div>
            <Field
              label="Nav CTA Text"
              value="Reserve Your Seat"
              hint="Button text in the sticky nav bar"
            />
            <Field
              label="Nav CTA URL"
              value="#rsvp"
              mono
              hint="Where the nav button links"
            />
            <Field
              label="Hero Headline"
              value="Northwind Summit"
              hint="Big serif headline above the eyebrow"
            />
            <Field
              label="Hero Subtitle"
              value="The Revenue Leaders Summit · 2026"
              hint="Spaced uppercase line under the headline"
            />
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                marginBottom: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--ink-2)",
              }}
            >
              Nav Links
              <span
                style={{
                  color: VIOLET,
                  fontSize: 11.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Icon name="plus" size={11} /> Add
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 14,
              }}
            >
              {NAV_LINKS_PROPS.map(([label, href]) => (
                <div key={label} style={{ display: "flex", gap: 5 }}>
                  <div
                    style={{
                      flex: 1,
                      border: "1px solid var(--hairline)",
                      borderRadius: 7,
                      padding: "5px 9px",
                      fontSize: 11.5,
                      color: "var(--ink)",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      border: "1px solid var(--hairline)",
                      borderRadius: 7,
                      padding: "5px 9px",
                      fontSize: 11.5,
                      fontFamily: "JetBrains Mono, ui-monospace, monospace",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {href}
                  </div>
                  <span
                    style={{
                      width: 26,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--ink-mute)",
                    }}
                  >
                    <Icon name="trash-2" size={11} />
                  </span>
                </div>
              ))}
            </div>
            <Field
              label="Hero Eyebrow"
              value="You're Invited"
              hint="Small uppercase label at top"
            />
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                marginBottom: 5,
                color: "var(--ink-2)",
              }}
            >
              Hero Image
            </div>
            <div
              style={{
                height: 80,
                borderRadius: 7,
                background:
                  "radial-gradient(120% 90% at 50% 0%, #2b3a44, #0c0f12)",
                marginBottom: 7,
              }}
            />
            <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
              <PanelButton small label="Tweak" />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  flex: 1,
                  justifyContent: "center",
                  background:
                    "linear-gradient(180deg, #5C58EB 0%, #4B47E5 100%)",
                  color: "#fff",
                  border: "1px solid rgba(46, 42, 140, 0.55)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 10px -4px rgba(75,71,229,0.4)",
                  textShadow: "0 1px 0 rgba(46,42,140,0.4)",
                }}
              >
                <Icon name="sparkles" size={11} /> Generate
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
