// BrandSettingsEmbed — the full Brand & Content UI ported from
// design-preview/ui_kits/app/BrandContent.jsx into TSX. Lives inside a
// BrowserFrame on the new homepage. Shows post-Brand-Import state: imported
// from stripe.com, 31 fields applied, Strict AI facts ON, an Import source
// input (URL or Guidelines), then the colors + typography cards. The purple
// hero preview band that lived above the colors is intentionally removed
// (Charlotte feedback: too much purple, lead with the colors).

import type { CSSProperties } from "react";

interface SwatchProps {
  label: string;
  hex: string;
}

function BrandSwatch({ label, hex }: SwatchProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: hex,
          border: "1px solid rgba(0,0,0,0.1)",
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 11.5,
            color: "var(--ink-mute)",
          }}
        >
          {hex}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  title: string;
  iconPath: string;
  children: React.ReactNode;
}

function Card({ title, iconPath, children }: CardProps) {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 16,
        }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--indigo)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={iconPath} />
        </svg>
        <span
          style={{
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--ink)",
            letterSpacing: "-0.012em",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

const PALETTE_ICON =
  "M13.5 6.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM17.5 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM6.5 12.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 2C6.5 2 2 6.5 2 12c0 5.5 4.5 10 10 10 1.8 0 3.3-1.5 3.3-3.3 0-.7-.3-1.4-.8-1.9-.4-.4-.6-1-.6-1.5 0-1.1.9-2 2-2H17c2.8 0 5-2.2 5-5 0-4.4-4.5-7.3-10-7.3z";
const TYPE_ICON = "M4 7V4h16v3M9 20h6M12 4v16";
const VOICE_ICON =
  "M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z";

// Stripe-style brand stand-in to demonstrate the imported token system
const BRAND_PURPLE = "#6B3FBB";

const CORE_COLORS = [
  { label: "Text color", hex: "#424770" },
  { label: "Page background", hex: "#F8F8F8" },
  { label: "Heading on dark", hex: "#FFFFFF" },
];

const INTERACTIVE_COLORS = [
  { label: "CTA background", hex: BRAND_PURPLE },
  { label: "CTA text", hex: "#FFFFFF" },
  { label: "Border", hex: "#C8C8D8" },
];

const ADDITIONAL = [
  ["Secondary 1", "#F888E8"],
  ["Secondary 2", "#F89818"],
  ["Secondary 3", "#B8C8C8"],
  ["Secondary 4", "#F88888"],
  ["Secondary 5", "#F88818"],
];

const LABEL_STYLE: CSSProperties = {
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
  fontWeight: 700,
};

export default function BrandSettingsEmbed() {
  return (
    <div
      style={{
        height: "100%",
        background: "var(--cream)",
        overflow: "auto",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        className="bs-inner"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "28px 36px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12.5,
              color: "var(--ink-mute)",
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>{" "}
            Back
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                  fontSize: 28,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  margin: 0,
                  color: "var(--ink)",
                }}
              >
                Brand &amp; Content
              </h1>
              <p
                style={{
                  color: "var(--ink-mute)",
                  fontSize: 14,
                  margin: "6px 0 0",
                }}
              >
                Configure your brand identity and manage a reusable content
                library.
              </p>
            </div>
            <div className="bs-actions" style={{ display: "flex", gap: 9 }}>
              <button
                type="button"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "8px 13px",
                  borderRadius: 8,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "1px solid var(--hairline-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Import from Website
              </button>
              <button
                type="button"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "8px 13px",
                  borderRadius: 8,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "1px solid var(--hairline-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l1.7 4.5L18 9l-4.3 1.5L12 15l-1.7-4.5L6 9l4.3-1.5z" />
                </svg>
                Import from Guidelines
              </button>
              <button
                type="button"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "8px 13px",
                  borderRadius: 8,
                  background: "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)",
                  color: "var(--cream)",
                  border: "1px solid rgba(0,0,0,0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -6px rgba(26,24,21,0.4)",
                  textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <path d="M17 21v-8H7v8M7 3v5h8" />
                </svg>
                Save Changes
              </button>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              color: "var(--ink-mute)",
              marginTop: 12,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
            </svg>
            imported from{" "}
            <span style={{ color: "var(--indigo)", textDecoration: "underline" }}>
              https://stripe.com/
            </span>{" "}
            · 6/2/2026 · 31 fields applied
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--cream-2)",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            alignSelf: "flex-start",
          }}
        >
          {["Brand Settings", "Sales Console", "Content Library"].map((t, i) => (
            <span
              key={t}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 7,
                background: i === 0 ? "var(--paper)" : "transparent",
                color: i === 0 ? "var(--ink)" : "var(--ink-mute)",
                boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Strict AI facts row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 20px",
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 14,
            boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 5,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--ink)" }}>
                Strict AI facts mode
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "var(--indigo)",
                  background: "color-mix(in srgb, var(--indigo) 12%, transparent)",
                  borderRadius: 5,
                  padding: "2px 7px",
                  letterSpacing: "0.12em",
                }}
              >
                ON
              </span>
            </div>
            <p
              style={{
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--ink-mute)",
                margin: 0,
                maxWidth: 700,
              }}
            >
              AI generation may only use stats, product claims, and customer
              quotes you&apos;ve marked{" "}
              <strong style={{ fontWeight: 600 }}>Approved for AI</strong> — the
              model is instructed never to invent percentages or customer
              counts.
            </p>
          </div>
          <span
            style={{
              width: 40,
              height: 23,
              borderRadius: 999,
              background: "var(--indigo)",
              position: "relative",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 19,
                height: 19,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              }}
            />
          </span>
        </div>

        {/* Import source — segmented "from URL" vs "from Guidelines" + path */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
          }}
        >
          <div
            className="bs-import-head"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--ink)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--indigo)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Import source
            </div>
            <div
              style={{
                display: "inline-flex",
                background: "var(--cream-2)",
                border: "1px solid var(--hairline)",
                borderRadius: 9,
                padding: 3,
                gap: 3,
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: 6,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                From URL
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  padding: "5px 11px",
                  borderRadius: 6,
                  color: "var(--ink-mute)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" />
                </svg>
                From Guidelines
              </span>
            </div>
          </div>
          <div
            className="bs-import-path"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "color-mix(in srgb, var(--ink) 3%, #fff)",
              border: "1px solid var(--hairline)",
              borderRadius: 9,
              padding: "9px 12px",
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: 12.5,
              color: "var(--ink-2)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-mute)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span style={{ flex: 1, color: "var(--ink-mute)" }}>https://</span>
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>
              stripe.com
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--sage)",
                background:
                  "color-mix(in srgb, var(--sage) 14%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--sage) 25%, transparent)",
                padding: "2px 8px",
                borderRadius: 5,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5L10 17.5L20 7.5" />
              </svg>
              Connected
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: "5px 11px",
                borderRadius: 7,
                background:
                  "linear-gradient(180deg, #2D2A24 0%, #1A1815 100%)",
                color: "var(--cream)",
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 10px -4px rgba(26,24,21,0.35)",
                textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Re-sync
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-mute)",
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Last imported 6/2/2026 · 31 fields applied. Re-sync to pull updated
            tokens from the source.
          </div>
        </div>

        {/* Colors card */}
        <Card title="Colors" iconPath={PALETTE_ICON}>
          <div
            className="bs-colors"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px 36px",
            }}
          >
            <div>
              <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>Core</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {CORE_COLORS.map((c) => (
                  <BrandSwatch key={c.label} label={c.label} hex={c.hex} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...LABEL_STYLE, marginBottom: 12 }}>Interactive</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {INTERACTIVE_COLORS.map((c) => (
                  <BrandSwatch key={c.label} label={c.label} hex={c.hex} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ ...LABEL_STYLE, margin: "20px 0 12px" }}>
            Additional palette
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {ADDITIONAL.map(([l, h]) => (
              <BrandSwatch key={l} label={l} hex={h} />
            ))}
          </div>
        </Card>

        {/* Typography card — bigger editorial preview matching production */}
        <Card title="Typography" iconPath={TYPE_ICON}>
          <div
            className="bs-type-prev"
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              padding: "40px 44px",
              background: "var(--paper)",
              minHeight: 320,
            }}
          >
            <div
              style={{
                fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
                fontWeight: 700,
                color: "#424770",
                letterSpacing: "-0.024em",
              }}
            >
              <div style={{ fontSize: 64, lineHeight: 1.0 }}>
                H1 — Your Main Headline
              </div>
              <div style={{ fontSize: 40, lineHeight: 1.1, marginTop: 18 }}>
                H2 — Section Heading
              </div>
              <div style={{ fontSize: 26, lineHeight: 1.15, marginTop: 14 }}>
                H3 — Sub-section Title
              </div>
            </div>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.65,
                color: "#5a607a",
                margin: "26px 0 0",
                maxWidth: 640,
              }}
            >
              Body text — this is how your paragraph copy will look across all
              blocks. Clear, readable, and well-spaced.
            </p>
            <div
              style={{
                ...LABEL_STYLE,
                fontSize: 11,
                marginTop: 22,
                letterSpacing: "0.18em",
              }}
            >
              Eyebrow / caption style
            </div>
          </div>

          {/* Font dropdowns */}
          <div className="bs-fonts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
            {[
              ["Display font (headings)", "Font family for H1/H2/H3", "Bagoss Standard"],
              ["Body font", "Font family for body text", "Inter"],
              ["Numbers font", "Big stat values. Falls back to Display Font.", ""],
            ].map(([l, hint, v]) => (
              <div key={l}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, color: "var(--ink)" }}>
                  {l}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 7, lineHeight: 1.35 }}>
                  {hint}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 9,
                    padding: "9px 12px",
                    fontSize: 13,
                    background: "var(--paper)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                    color: v ? "var(--ink)" : "var(--ink-mute)",
                  }}
                >
                  {v ? (
                    <span>
                      {v}
                      <span style={{ color: "var(--ink-mute)", marginLeft: 6, fontSize: 11.5 }}>
                        (bundled)
                      </span>
                    </span>
                  ) : (
                    "Choose font…"
                  )}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Size selectors */}
          <div
            className="bs-sizes"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
              marginTop: 14,
            }}
          >
            {[
              ["Eyebrow Style", "UPPERCASE"],
              ["H1 Default Size", "X-Large"],
              ["H2 Default Size", "Large"],
              ["H3 Default Size", "Small"],
              ["Heading Font Weight", "Semibold"],
              ["Heading Letter Spacing", "Tight"],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                  {l}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid var(--hairline-strong)",
                    borderRadius: 9,
                    padding: "8px 12px",
                    fontSize: 13,
                    background: "var(--paper)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
                    color: "var(--ink)",
                  }}
                >
                  {v}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Voice & Messaging — two columns: VOICE + MESSAGING */}
        <Card title="Voice & Messaging" iconPath={VOICE_ICON}>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-mute)",
              margin: "0 0 18px",
              lineHeight: 1.55,
              maxWidth: 700,
            }}
          >
            These fields are injected into AI copy generation prompts — they
            directly control the tone and content of AI-generated text.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 36,
            }}
          >
            {/* VOICE column */}
            <div>
              <div style={{ ...LABEL_STYLE, marginBottom: 14 }}>Voice</div>

              <VMField label="Brand Name" value="Stripe" />

              <VMField
                label="Company description"
                hint="1–2 sentences describing your company and what you sell."
                value="Stripe is a financial-infrastructure platform that powers payments, billing, and money movement for businesses of every size."
                multiline
              />

              <VMField
                label="Tone of Voice"
                hint="1–3 sentences describing brand voice"
                value="Direct, confident, and human. We explain complex finance simply, lead with the user benefit, and never patronize."
                multiline
              />

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5, color: "var(--ink)" }}>
                Tone Keywords
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 8 }}>
                Style constraints for AI copy
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["direct", "confident", "human", "precise", "modern", "calm"].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "var(--ink)",
                      background: "var(--paper)",
                      border: "1px solid var(--hairline-strong)",
                      borderRadius: 999,
                      padding: "4px 12px 4px 11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {t}
                    <span style={{ color: "var(--ink-faint)", fontSize: 11, lineHeight: 1 }}>×</span>
                  </span>
                ))}
              </div>
            </div>

            {/* MESSAGING column */}
            <div>
              <div style={{ ...LABEL_STYLE, marginBottom: 14 }}>Messaging</div>

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>
                Taglines (up to 5)
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 9 }}>
                Brand taglines used as copy references
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                {[
                  "Financial infrastructure for the internet",
                  "Increase revenue. Decrease costs.",
                  "Built for builders",
                ].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: "var(--ink)",
                      background: "var(--paper)",
                      border: "1px solid var(--hairline-strong)",
                      borderRadius: 999,
                      padding: "4px 12px 4px 11px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {t}
                    <span style={{ color: "var(--ink-faint)", fontSize: 11, lineHeight: 1 }}>×</span>
                  </span>
                ))}
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--ink-mute)",
                    border: "1px dashed var(--hairline-strong)",
                    borderRadius: 999,
                    padding: "4px 14px",
                  }}
                >
                  Add a tagline…
                </span>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>
                Messaging Pillars (up to 8)
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 9 }}>
                Themes that AI copy should always reflect
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  {
                    name: "Reliable",
                    body: "We deliver on our promises day in and day out and build trust with every integration.",
                  },
                  {
                    name: "Developer-first",
                    body: "We build for the engineers in the room. Clean APIs, real docs, no surprises.",
                  },
                  {
                    name: "Global by default",
                    body: "Localized payments, taxes, and compliance built in — for 195+ countries.",
                  },
                ].map((p) => (
                  <div key={p.name}>
                    <div
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 9,
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        marginBottom: 6,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--hairline-strong)",
                        borderRadius: 9,
                        padding: "8px 12px",
                        fontSize: 12.5,
                        color: "var(--ink-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      {p.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Small field renderer for the Voice column — label + optional hint + boxed
// value (single-line input or multi-line textarea look).
function VMField({
  label,
  hint,
  value,
  multiline,
}: {
  label: string;
  hint?: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, color: "var(--ink)" }}>
        {label}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            marginBottom: 7,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: 9,
          padding: multiline ? "10px 12px" : "8px 12px",
          fontSize: 13,
          color: "var(--ink-2)",
          lineHeight: 1.55,
          minHeight: multiline ? 72 : undefined,
          boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset",
        }}
      >
        {value}
      </div>
    </div>
  );
}
