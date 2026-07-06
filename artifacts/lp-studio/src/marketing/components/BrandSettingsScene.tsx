import { useInView } from "../hooks/useInView";

// BrandSettingsScene — a faithful mini of the Brand & Content UI from the
// actual product, paired with the "Set once, ship on-brand forever" pitch.
// This is the section that closes the "but won't every AI-generated page
// look generic?" objection by showing the brand-token system that backs
// every page generation. Strict-AI-facts toggle is shown ON because that's
// also the default in the product post-Task #898 (no-fluff copy principles
// + role validator + facts-only mode).
//
// The "Brand preview" panel shows the imported tokens applied to a sample
// hero (purple Ledgerline fictional-fintech stand-in) so the section visually
// demonstrates the inheritance, not just describes it.

interface Swatch {
  label: string;
  hex: string;
  textColor?: string;
}

const CORE_COLORS: Swatch[] = [
  { label: "Text", hex: "#424770" },
  { label: "Page background", hex: "#F8F8F8", textColor: "#5C5853" },
  { label: "Heading on dark", hex: "#FFFFFF", textColor: "#5C5853" },
];

const INTERACTIVE_COLORS: Swatch[] = [
  { label: "CTA background", hex: "#6B3FBB" },
  { label: "CTA text", hex: "#FFFFFF", textColor: "#5C5853" },
  { label: "Border", hex: "#C8C8D8", textColor: "#5C5853" },
];

const ADDITIONAL_COLORS = [
  "#F888E8",
  "#F89818",
  "#B8C8C8",
  "#F88888",
  "#6B9171",
  "#3F3BD3",
];

function ColorSwatch({ s }: { s: Swatch }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: s.hex,
          border: "1px solid rgba(0,0,0,0.1)",
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink)",
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {s.label}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 10.5,
            color: s.textColor ?? "var(--ink-mute)",
          }}
        >
          {s.hex}
        </div>
      </div>
    </div>
  );
}

export default function BrandSettingsScene() {
  const { ref, inView } = useInView(0.08);

  return (
    <section
      id="brand"
      className="px-6 py-28 md:py-36 relative overflow-hidden"
      style={{
        background: "var(--cream)",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative grid md:grid-cols-[1.2fr_1fr] gap-16 items-start"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Left: the Brand & Content product mini */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--hairline-strong)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.7) inset, 0 30px 80px -34px rgba(26,24,21,0.30), 0 12px 28px -18px rgba(26,24,21,0.16)",
          }}
        >
          {/* Window chrome */}
          <div
            className="flex items-center gap-2 px-3.5 py-2.5"
            style={{
              background: "var(--cream-2)",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span className="inline-flex gap-1.5">
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#ec6a5e" }} />
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#f4bf4f" }} />
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#61c554" }} />
            </span>
            <span
              className="ml-2 flex-1 font-mono"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 10.5,
                color: "var(--ink-mute)",
              }}
            >
              app.lpstudio.ai/brand
            </span>
          </div>

          {/* Title + breadcrumb */}
          <div className="px-5 pt-5 pb-3">
            <div
              className="font-display"
              style={{
                color: "var(--ink)",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.022em",
              }}
            >
              Brand &amp; Content
            </div>
            <div
              style={{
                color: "var(--ink-mute)",
                fontSize: 12,
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              imported from{" "}
              <span style={{ color: "var(--indigo)", textDecoration: "underline" }}>
                ledgerline.com
              </span>{" "}
              · 31 fields applied
            </div>
          </div>

          {/* Tab strip */}
          <div className="px-5">
            <div
              className="inline-flex p-1 gap-1"
              style={{
                background: "var(--cream-2)",
                border: "1px solid var(--hairline)",
                borderRadius: 9,
              }}
            >
              {["Brand Settings", "Sales Console", "Content Library"].map((t, i) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "5px 12px",
                    borderRadius: 6,
                    background: i === 0 ? "var(--paper)" : "transparent",
                    color: i === 0 ? "var(--ink)" : "var(--ink-mute)",
                    boxShadow: i === 0 ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Strict AI facts row */}
          <div
            className="mx-5 mt-4 rounded-xl flex items-start justify-between gap-4 p-3.5"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-2 mb-1">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--indigo)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  Strict AI facts mode
                </span>
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--indigo)",
                    background: "var(--indigo-soft)",
                    borderRadius: 4,
                    padding: "1px 6px",
                    letterSpacing: "0.12em",
                  }}
                >
                  ON
                </span>
              </div>
              <p
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: "var(--ink-mute)",
                  margin: 0,
                }}
              >
                AI can only use stats, claims, and quotes you marked Approved
                — never invents percentages.
              </p>
            </div>
            <span
              style={{
                width: 32,
                height: 18,
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
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
              />
            </span>
          </div>

          {/* Brand preview band */}
          <div className="mx-5 mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--hairline)" }}>
            <div
              className="flex items-center justify-between px-3.5 py-2.5"
              style={{ background: "#f6f6fb" }}
            >
              <span style={{ width: 58, height: 11, borderRadius: 3, background: "#F89818" }} />
              <span
                style={{
                  background: "#6B3FBB",
                  color: "#fff",
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "5px 12px",
                  borderRadius: 999,
                  letterSpacing: "0.02em",
                }}
              >
                GET PRICING
              </span>
            </div>
            <div
              className="px-4 py-7 text-center"
              style={{ background: "#6B3FBB", color: "#fff" }}
            >
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  opacity: 0.7,
                  marginBottom: 8,
                }}
              >
                Hero section preview
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.018em",
                }}
              >
                GET STARTED FREE
              </div>
            </div>
            <div
              className="text-center"
              style={{
                background: "#F89818",
                color: "#5a3a00",
                padding: 8,
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              Guarantee bar preview
            </div>
          </div>

          {/* Colors card */}
          <div className="m-5 rounded-xl p-4" style={{ background: "var(--paper)", border: "1px solid var(--hairline)" }}>
            <div className="flex items-center gap-2 mb-3.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="2.5" />
                <circle cx="8.5" cy="7.5" r="2.5" />
                <circle cx="6.5" cy="12.5" r="2.5" />
                <path d="M12 2C6.5 2 2 6.5 2 12c0 5.5 4.5 10 10 10 1.8 0 3.3-1.5 3.3-3.3 0-.7-.3-1.4-.8-1.9-.4-.4-.6-1-.6-1.5 0-1.1.9-2 2-2H17c2.8 0 5-2.2 5-5 0-4.4-4.5-7.3-10-7.3z" />
              </svg>
              <span
                className="font-display"
                style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}
              >
                Colors
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div
                  className="font-mono uppercase"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.12em",
                    color: "var(--ink-mute)",
                    marginBottom: 7,
                    fontWeight: 700,
                  }}
                >
                  Core
                </div>
                <div className="flex flex-col gap-2.5">
                  {CORE_COLORS.map((s) => <ColorSwatch key={s.label} s={s} />)}
                </div>
              </div>
              <div>
                <div
                  className="font-mono uppercase"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.12em",
                    color: "var(--ink-mute)",
                    marginBottom: 7,
                    fontWeight: 700,
                  }}
                >
                  Interactive
                </div>
                <div className="flex flex-col gap-2.5">
                  {INTERACTIVE_COLORS.map((s) => <ColorSwatch key={s.label} s={s} />)}
                </div>
              </div>
            </div>
            <div
              className="font-mono uppercase mt-4 mb-2"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.12em",
                color: "var(--ink-mute)",
                fontWeight: 700,
              }}
            >
              Additional palette
            </div>
            <div className="flex gap-2">
              {ADDITIONAL_COLORS.map((c) => (
                <span
                  key={c}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: c,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: the pitch */}
        <div>
          <div className="marker marker-rule mb-6">06 / Brand</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)" }}
          >
            Set your brand once.<br />
            <span style={{ color: "var(--indigo)" }}>Ship on-brand forever.</span>
          </h2>
          <p
            className="mt-6 text-[17px] leading-[1.6] max-w-[440px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Paste your site URL. We extract logos, colors, typography, voice,
            and approved content — then lock the tokens. Every page anyone in
            the org generates inherits the system.{" "}
            <strong style={{ color: "var(--ink)" }}>
              No "we'll fix it in post." No off-brand drift.
            </strong>
          </p>

          <div className="mt-7 flex flex-col gap-3.5">
            {[
              {
                label: "31 tokens extracted in 12 seconds",
                body: "Logos, colors, fonts, voice, proof points, approved customer quotes. Reviewable, editable.",
              },
              {
                label: "Strict AI facts mode",
                body: "AI can only use stats and quotes you've marked Approved — never fabricates percentages or customer counts.",
              },
              {
                label: "Locked blocks travel with the brand",
                body: "Hero, CTA, footer locked once. Anyone on the team ships on-brand without permission.",
              },
              {
                label: "Multi-brand on Scale",
                body: "Run multiple workspaces with separate brand systems for agencies, holding companies, multi-brand operators.",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--indigo)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginTop: 4, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <path d="M5 12.5L10 17.5L20 7.5" />
                </svg>
                <div>
                  <div
                    className="font-display"
                    style={{
                      color: "var(--ink)",
                      fontSize: 14.5,
                      fontWeight: 600,
                      letterSpacing: "-0.012em",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: "var(--ink-soft)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      marginTop: 2,
                      maxWidth: 400,
                    }}
                  >
                    {item.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
