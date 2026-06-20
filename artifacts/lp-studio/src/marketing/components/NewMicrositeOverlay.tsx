import { useState } from "react";
import Icon from "./EmbedIcons";

// NewMicrositeOverlay — the "New Microsite" port from
// design-preview/ui_kits/app/NewMicrosite.jsx, rendered as a side-by-side
// "modal → generated microsite" flow that mirrors CreatePageOverlay on
// /for-marketing: the modal sits on the left, an arrow in the middle, and
// the resulting account-specific microsite hero on the right.
//
// The modal stays the same as the production "New Microsite" surface
// (Personalize for an account · Cobalt Systems · AI Generate tab · brief
// textarea · Generate microsite footer). The right-side hero is the
// freshly-generated Cobalt Systems microsite landing page.

function Select({ value }: { value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
        border: "1px solid var(--hairline)",
        borderRadius: 9,
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--ink)",
      }}
    >
      {value}
      <Icon name="chevron-down" size={14} style={{ color: "var(--ink-mute)" }} />
    </div>
  );
}

export default function NewMicrositeOverlay() {
  const [tab, setTab] = useState<"template" | "ai">("ai");
  const VIOLET = "#3C38B8";
  const LAVENDER = "var(--tint-lavender)";

  return (
    <div
      className="nmo-wrap"
      style={{
        height: "100%",
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "32px 28px",
        overflow: "hidden",
      }}
    >
      {/* Modal — freestanding card on cream */}
      <div
        className="nmo-card"
        style={{
          flex: "0 1 460px",
          maxWidth: 460,
          minWidth: 360,
          maxHeight: "100%",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--hairline-strong)",
          boxShadow:
            "0 28px 60px -22px rgba(7,38,28,0.22), 0 12px 28px -16px rgba(26,24,21,0.12), 0 1px 0 rgba(255,255,255,0.7) inset",
        }}
      >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 22px 12px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 18,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              <Icon name="sparkles" size={17} style={{ color: VIOLET }} />
              New Microsite
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "transparent",
                color: "var(--ink-mute)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Icon name="x" size={17} />
            </span>
          </div>

          {/* Body */}
          <div
            style={{ overflowY: "auto", padding: "0 22px 4px", minHeight: 0 }}
          >
            {/* Personalize for an account */}
            <div
              style={{
                background: LAVENDER,
                border:
                  "1px solid color-mix(in srgb, #3C38B8 16%, transparent)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", gap: 10, marginBottom: 11 }}>
                <Icon
                  name="building-2"
                  size={15}
                  style={{ color: VIOLET, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    Personalize for an account
                  </div>
                  <p
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.45,
                      color: "var(--ink-mute)",
                      margin: "2px 0 0",
                    }}
                  >
                    Recommended — we&apos;ll create a tailored page and a
                    unique link for each contact.
                  </p>
                </div>
              </div>
              <Select value="Cobalt Systems Inc. - Enterprise" />
              <div
                style={{
                  textAlign: "center",
                  fontSize: 11.5,
                  color: "var(--ink-mute)",
                  marginTop: 9,
                }}
              >
                or create without an account
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "color-mix(in srgb, var(--ink) 6%, var(--paper))",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                padding: 4,
                gap: 4,
                marginBottom: 14,
              }}
            >
              {[
                { id: "template" as const, label: "Template", icon: "file-text" },
                { id: "ai" as const, label: "AI Generate", icon: "sparkles" },
              ].map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      background: active ? "#fff" : "transparent",
                      color: active ? "var(--ink)" : "var(--ink-mute)",
                      border: "none",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      fontWeight: 600,
                      fontSize: 12.5,
                      padding: "6px 12px",
                      borderRadius: 7,
                      cursor: "pointer",
                    }}
                  >
                    <Icon name={t.icon} size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "ai" ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    background: LAVENDER,
                    border:
                      "1px dashed color-mix(in srgb, #3C38B8 28%, transparent)",
                    borderRadius: 12,
                    padding: "13px 15px",
                    marginBottom: 14,
                  }}
                >
                  <Icon
                    name="wand-2"
                    size={15}
                    style={{ color: VIOLET, marginTop: 1, flexShrink: 0 }}
                  />
                  <p
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: "var(--ink-mute)",
                      margin: 0,
                    }}
                  >
                    Describe what you want the microsite to say for{" "}
                    <strong
                      style={{
                        color: "var(--ink)",
                        fontWeight: 600,
                      }}
                    >
                      Cobalt Systems Inc.
                    </strong>{" "}
                    AI will draft the full page — you can edit anything in the
                    builder afterwards.
                  </p>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: "var(--ink-2)",
                  }}
                >
                  Audience segment
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Select value="Auto / no specific segment" />
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: "var(--ink-2)",
                  }}
                >
                  Starting point
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Select value="Predictable growth for enterprise RevOps" />
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: "var(--ink-2)",
                  }}
                >
                  Your prompt
                </div>
                <div
                  style={{
                    border: `1px solid ${VIOLET}`,
                    boxShadow:
                      "0 0 0 3px color-mix(in srgb, #3C38B8 12%, transparent)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    minHeight: 76,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--ink-mute)",
                    marginBottom: 14,
                  }}
                >
                  e.g. A landing page pitching our product to Cobalt Systems —
                  highlight the operations ROI Chandan engaged with most.
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: "var(--ink-2)",
                  }}
                >
                  Microsite name{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                    }}
                  >
                    (optional)
                  </span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      border: "1px solid var(--hairline)",
                      borderRadius: 9,
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "var(--ink-mute)",
                      background: "#fff",
                    }}
                  >
                    Auto-generated from the account name
                  </div>
                </div>
              </>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--ink-mute)",
                  margin: "4px 0 16px",
                }}
              >
                Start from a ready-made microsite template, then personalize
                the copy and brand for Cobalt Systems Inc. in the builder.
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 9,
              padding: "14px 22px",
              borderTop: "1px solid var(--hairline)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: 8,
                color: "var(--ink-mute)",
                cursor: "pointer",
              }}
            >
              Cancel
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 8,
                background: "#06231a",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -6px rgba(6,35,26,0.4)",
              }}
            >
              <Icon name="sparkles" size={13} /> Generate microsite
            </span>
          </div>
        </div>

        {/* Arrow — modal generates the microsite on the right */}
        <GenerateArrow />

        {/* The generated microsite, tailored to Cobalt Systems */}
        <AccountMicrositeHero />
      </div>
  );
}

// ---------- arrow ----------

function GenerateArrow() {
  return (
    <div
      aria-hidden="true"
      className="nmo-arrow"
      style={{
        flex: "0 0 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "var(--indigo)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.7 4.5L18 8l-4.3 1.5L12 14l-1.7-4.5L6 8l4.3-1.5L12 2zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
      </svg>
      <svg width="44" height="20" viewBox="0 0 44 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 10h38M32 3l8 7-8 7" />
      </svg>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "var(--ink-mute)",
          textAlign: "center",
        }}
      >
        Generates
      </span>
    </div>
  );
}

// ---------- generated account microsite ----------

// CenterHero-style landing page for the deal, tailored to the account
// selected in the modal (Cobalt Systems Inc.). Different image + copy from
// the /for-marketing prompt→page hero so each side-by-side reads distinctly.
function AccountMicrositeHero() {
  // Manufacturing / industrial automation imagery matches Cobalt's "$400M
  // industrial-automation platform" framing referenced in the AI Briefing
  // and Salesforce sync sections.
  const image =
    "https://images.unsplash.com/photo-1565043666747-69f6646db940?q=80&w=900&h=520&fit=crop";

  return (
    <div
      className="nmo-hero"
      style={{
        flex: "0 1 440px",
        maxWidth: 440,
        minWidth: 340,
        aspectRatio: "4 / 5",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--hairline-strong)",
        boxShadow:
          "0 30px 70px -22px rgba(20,18,30,0.30), 0 1px 0 rgba(255,255,255,0.7) inset",
        position: "relative",
      }}
    >
      {/* Slim browser chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 14px",
          background: "var(--cream-2)",
          borderBottom: "1px solid var(--hairline)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <span style={{ display: "inline-flex", gap: 5 }}>
          <i style={{ width: 7, height: 7, borderRadius: 999, background: "#ec6a5e" }} />
          <i style={{ width: 7, height: 7, borderRadius: 999, background: "#f4bf4f" }} />
          <i style={{ width: 7, height: 7, borderRadius: 999, background: "#61c554" }} />
        </span>
        <span
          className="font-mono"
          style={{
            flex: 1,
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 5,
            padding: "2px 9px",
            fontSize: 10,
            color: "var(--ink-mute)",
          }}
        >
          lpstudio.ai/p/cobalt-systems
        </span>
      </div>

      {/* Hero with copy centered over a tinted manufacturing photo */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `linear-gradient(180deg, rgba(20,18,30,0.55) 0%, rgba(20,18,30,0.55) 100%), url("${image}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "#fff",
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.88)",
            marginBottom: 12,
          }}
        >
          For Cobalt Systems · Q2 Review
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 26,
            lineHeight: 1.06,
            letterSpacing: "-0.028em",
            color: "#fff",
            fontWeight: 700,
            textShadow: "0 1px 3px rgba(0,0,0,0.40)",
            maxWidth: 320,
          }}
        >
          12 plants. One predictive-maintenance signal.
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.88)",
            maxWidth: 290,
            textShadow: "0 1px 2px rgba(0,0,0,0.30)",
          }}
        >
          A 20-minute walkthrough of the field-services rollout for Cobalt's
          2026 expansion — sized to your factory-floor footprint.
        </div>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "9px 16px",
              background: "#fff",
              color: "var(--ink)",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow:
                "0 6px 16px -4px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            Book 20-min walkthrough
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.88)",
              textShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            See the ROI
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
