import { useState } from "react";
import Icon from "./EmbedIcons";

// DraftEmailOverlay — port of design-preview/ui_kits/app/DraftEmail.jsx.
// Rendered as a freestanding card on cream (no SalesConsole background, no
// backdrop dim) so /for-sales doesn't read as a repeating "app + modal"
// pattern. The card itself stays unchanged — contact brief expand/collapse,
// role-based pain-point note, subject line, and the email body draft.

function Dot() {
  return (
    <span
      style={{
        position: "absolute",
        left: 2,
        top: 8,
        width: 3,
        height: 3,
        borderRadius: 999,
        background: "color-mix(in srgb, var(--ink-mute) 60%, transparent)",
      }}
    />
  );
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  margin: "0 0 8px",
};

const BULLET: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "color-mix(in srgb, var(--ink) 90%, transparent)",
  margin: "0 0 7px",
  paddingLeft: 16,
  position: "relative",
};

export default function DraftEmailOverlay() {
  const [briefOpen, setBriefOpen] = useState(true);
  const VIOLET = "#2E2A8C";

  return (
    <div
      className="deo-wrap"
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
        className="deo-card"
        style={{
          flex: "0 1 480px",
          maxWidth: 480,
          minWidth: 380,
          maxHeight: "100%",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid var(--hairline-strong)",
          boxShadow:
            "0 28px 60px -22px rgba(7,38,28,0.22), 0 12px 28px -16px rgba(26,24,21,0.12), 0 1px 0 rgba(255,255,255,0.7) inset",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "18px 22px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div style={{ display: "flex", gap: 11 }}>
              <Icon
                name="sparkles"
                size={17}
                style={{ color: VIOLET, marginTop: 2 }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                    fontWeight: 600,
                    fontSize: 16,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                  }}
                >
                  Draft email — John Donahoe
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-mute)",
                    marginTop: 2,
                  }}
                >
                  Athletic Director · Stanford University
                </div>
              </div>
            </div>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
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

          {/* Scroll body */}
          <div
            style={{
              overflowY: "auto",
              minHeight: 0,
              padding: "14px 22px 4px",
            }}
          >
            {/* Research note */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 13px",
                background: "color-mix(in srgb, var(--ink) 4%, var(--paper))",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                marginBottom: 9,
              }}
            >
              <Icon
                name="globe"
                size={14}
                style={{ color: "var(--ink-mute)" }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  fontStyle: "italic",
                  color: "var(--ink-mute)",
                }}
              >
                Written from role-based pain point (recent context grounded)
              </span>
              <Icon
                name="chevron-down"
                size={14}
                style={{ color: "var(--ink-mute)" }}
              />
            </div>

            {/* Contact brief */}
            <div
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                marginBottom: 15,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setBriefOpen(!briefOpen)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "10px 13px",
                  background:
                    "color-mix(in srgb, var(--ink) 3%, var(--paper))",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon
                  name="file-text"
                  size={14}
                  style={{ color: "var(--ink-mute)" }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: 500,
                    fontStyle: "italic",
                    color: "color-mix(in srgb, var(--ink) 80%, transparent)",
                  }}
                >
                  Contact brief — John Donahoe
                </span>
                <Icon
                  name={briefOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  style={{ color: "var(--ink-mute)" }}
                />
              </button>
              {briefOpen && (
                <div style={{ padding: "14px 16px 16px" }}>
                  <p style={SECTION_LABEL}>Who they are</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px" }}>
                    <li style={BULLET}>
                      <Dot />
                      Athletic Director at Stanford University since September
                      2025; formerly President &amp; CEO of Nike (January
                      2020–October 2024).
                    </li>
                    <li style={BULLET}>
                      <Dot />
                      Previous CEO roles at ServiceNow (named CEO February
                      2017) and eBay/PayPal; early career at Bain &amp; Company.
                    </li>
                    <li style={BULLET}>
                      <Dot />
                      Public leadership themes emphasize continual reinvention
                      and investing in mental, physical, and emotional health.
                    </li>
                  </ul>
                  <p style={SECTION_LABEL}>What they care about</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    <li style={BULLET}>
                      <Dot />
                      Scaling consistent, high-quality experiences across large,
                      distributed organizations through standardization, clear
                      KPIs, and data visibility.
                    </li>
                    <li style={BULLET}>
                      <Dot />
                      Building cultures of curiosity and continuous improvement
                      without sacrificing operational discipline.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Subject line */}
            <p style={LABEL_STYLE}>Subject line</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 13px",
                background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                margin: "7px 0 15px",
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                Intentional luxury without excess
              </span>
              <Icon
                name="copy"
                size={14}
                style={{ color: "var(--ink-mute)" }}
              />
            </div>

            {/* Email body */}
            <p style={LABEL_STYLE}>Email body</p>
            <div
              style={{
                padding: "14px 16px",
                background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                margin: "7px 0 10px",
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 12.5,
                lineHeight: 1.65,
                color: "color-mix(in srgb, var(--ink) 92%, transparent)",
                whiteSpace: "pre-wrap",
              }}
            >
              {`Hi John,

Scaling flagship and concept stores can slip into excess that muddies Nike's core story and inflates build costs.

Royal Design practices intentional luxury — spaces feel premium because every element is considered and necessary, not piled on.`}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 22px",
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                padding: "7px 12px",
                borderRadius: 7,
                background: "var(--paper)",
                color: "var(--ink-2)",
                border: "1px solid var(--hairline-strong)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
              }}
            >
              <Icon name="copy" size={13} /> Copy email
            </span>
            <div style={{ display: "flex", gap: 9 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: "7px 12px",
                  borderRadius: 7,
                  background: "var(--paper)",
                  color: "var(--ink-2)",
                  border: "1px solid var(--hairline-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
                }}
              >
                <Icon name="mail" size={13} /> Email client
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "7px 12px",
                  borderRadius: 7,
                  background:
                    "linear-gradient(180deg, #f25541 0%, #ea4335 100%)",
                  color: "#fff",
                  border: "1px solid #b8362a",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 14px -6px rgba(234,67,53,0.4)",
                  textShadow: "0 1px 0 rgba(184,54,42,0.4)",
                }}
              >
                <Icon name="mail" size={13} /> Open in Gmail
              </span>
            </div>
          </div>
        </div>

        {/* Arrow — Draft Email modal opens pre-filled in Gmail */}
        <SendArrow />

        {/* The Gmail compose window with the drafted email pre-filled */}
        <GmailCompose />
      </div>
  );
}

// ---------- arrow ----------

function SendArrow() {
  return (
    <div
      aria-hidden="true"
      className="deo-arrow"
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
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
        Opens in
      </span>
    </div>
  );
}

// ---------- Gmail compose window ----------

// Gmail-style compose popup that the "Open in Gmail" CTA triggers — same
// subject and body the modal drafted, now pre-filled in the client.
function GmailCompose() {
  return (
    <div
      className="deo-gmail"
      style={{
        flex: "0 1 480px",
        maxWidth: 480,
        minWidth: 360,
        background: "#fff",
        borderRadius: "8px 8px 0 0",
        border: "1px solid #DADCE0",
        boxShadow:
          "0 30px 70px -18px rgba(60,64,67,0.40), 0 12px 28px -16px rgba(60,64,67,0.25)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "'Google Sans','Roboto','Helvetica Neue',Arial,sans-serif",
      }}
    >
      {/* Gmail compose header */}
      <div
        style={{
          background: "#404040",
          color: "#fff",
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>New Message</span>
        <span aria-hidden="true" style={{ display: "inline-flex", gap: 14, opacity: 0.85 }}>
          {/* Minimize */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
          </svg>
          {/* Pop out */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 00-2 2v4 M21 9V5a2 2 0 00-2-2h-4 M3 15v4a2 2 0 002 2h4 M15 21h4a2 2 0 002-2v-4" />
          </svg>
          {/* Close */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
      </div>

      {/* From / To / Subject fields */}
      <div style={{ padding: "0 16px" }}>
        <Field label="From" value="alex.morgan@royaldesign.com" muted />
        <Field
          label="To"
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 4px 2px 2px",
                  background: "#F1F3F4",
                  borderRadius: 999,
                  fontSize: 13,
                  color: "#202124",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "#1A73E8",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  JD
                </span>
                John Donahoe
              </span>
              <span style={{ color: "#5F6368", fontSize: 12 }}>
                &lt;john.donahoe@nike.com&gt;
              </span>
            </span>
          }
        />
        <Field
          label="Subject"
          value={<span style={{ fontWeight: 600, color: "#202124" }}>Intentional luxury without excess</span>}
        />
      </div>

      {/* Body */}
      <div
        style={{
          padding: "16px 18px 20px",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "#202124",
          fontFamily: "'Roboto','Helvetica Neue',Arial,sans-serif",
          whiteSpace: "pre-wrap",
          minHeight: 180,
        }}
      >
        {`Hi John,

Scaling flagship and concept stores can slip into excess that muddies Nike's core story and inflates build costs.

Royal Design practices intentional luxury — spaces feel premium because every element is considered and necessary, not piled on.

Worth 20 minutes to walk through a few principles for the next wave of openings?

Alex`}
      </div>

      {/* Send toolbar */}
      <div
        style={{
          padding: "10px 16px 14px",
          borderTop: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "#1A73E8",
            color: "#fff",
            fontWeight: 500,
            fontSize: 14,
            padding: "8px 24px 8px 18px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)",
          }}
        >
          Send
        </button>
        <span
          aria-hidden="true"
          style={{
            width: 1,
            height: 18,
            background: "transparent",
          }}
        />
        {/* Toolbar icons */}
        {[
          "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6L12 13 2 6",
          "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48",
          "M12 1v6m0 6v6 M3.5 12h6m6 0h6",
        ].map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              color: "#5F6368",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={p} />
            </svg>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            color: "#5F6368",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid #E8EAED",
        fontSize: 13.5,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: muted ? "#80868B" : "#5F6368",
          minWidth: 50,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: muted ? "#5F6368" : "#202124",
        }}
      >
        {value}
      </span>
    </div>
  );
}
