import { useState } from "react";
import { useMadLibsPlaceholder } from "../lib/madLibsPlaceholder";

// PromptCard — the Mad Libs prompt block lifted visually from the existing /
// homepage (AssembleScene). Soft white card with traffic-dot-less chrome,
// Mad Libs rotating placeholder textarea, "Reference URL" + "Screenshot"
// text-link affordances (hover-tint, not framed pills), an indigo Generate
// page button, then below the card: "Or start from:" pill row, the "Built
// inside Dandy…" trust line with hairlines, and the centered "OR SCROLL TO
// SEE ONE BUILD" scroll hint. Sits tight to the HeroScene subhead — no big
// gap. Hosts the primary CTA pair too ("Create your workspace" + "See it
// build a page") above the trust line.

const SUGGESTION_PILLS = [
  { label: "Pricing page", prompt: "A clear pricing page for our mid-market plan, with a comparison table and faqs." },
  { label: "Event landing", prompt: "An event landing page for our Q3 customer summit — agenda, speakers, RSVP." },
  { label: "Product hero", prompt: "A product hero block introducing our new AI-powered analytics platform." },
  { label: "Demo-request page", prompt: "A demo-request page that qualifies enterprise buyers, with a short brief form." },
];

const HAIRLINE_STRONG = "rgba(26, 24, 21, 0.18)";

export default function PromptCard() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const { text: placeholder, visible } = useMadLibsPlaceholder(
    focused || value.length > 0,
  );

  function applyPill(prompt: string) {
    setValue(prompt);
  }

  return (
    <section
      id="prompt"
      className="px-6"
      style={{
        background: "var(--cream)",
        paddingTop: 0,
        paddingBottom: 96,
      }}
    >
      <div className="max-w-[1180px] mx-auto" style={{ textAlign: "center" }}>
        {/* Prompt card — single rounded panel, no faux-browser chrome */}
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
            maxWidth: 680,
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.6) inset, 0 30px 60px -28px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.14)",
            }}
          >
            {/* Textarea body */}
            <div style={{ padding: "20px 22px 14px" }}>
              <div style={{ position: "relative", minHeight: 60 }}>
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  rows={2}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                    fontSize: 15.5,
                    color: "var(--ink)",
                    resize: "none",
                    minHeight: 60,
                    padding: "2px 0",
                    lineHeight: 1.5,
                  }}
                  aria-label="Describe the landing page you want"
                />
                {!value && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      padding: "2px 0",
                      fontSize: 15.5,
                      lineHeight: 1.5,
                      color: "var(--ink-mute)",
                      pointerEvents: "none",
                      opacity: visible ? 1 : 0,
                      transition: "opacity 320ms ease",
                    }}
                  >
                    {placeholder}
                  </div>
                )}
              </div>
            </div>

            {/* Footer — text-link affordances + Generate page button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[
                  {
                    label: "Reference URL",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 13a5 5 0 007 0l4-4a5 5 0 00-7-7l-1 1" />
                        <path d="M14 11a5 5 0 00-7 0l-4 4a5 5 0 007 7l1-1" />
                      </svg>
                    ),
                  },
                  {
                    label: "Screenshot",
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    ),
                  },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: "var(--ink-mute)",
                      background: "transparent",
                      padding: "6px 10px",
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                      transition: "background .12s, color .12s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--cream-2)";
                      e.currentTarget.style.color = "var(--ink)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--ink-mute)";
                    }}
                  >
                    {b.icon}
                    {b.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                {/* Secondary — subtle text-link affordance, no surface */}
                <a
                  href="https://app.lpstudio.ai"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--ink-2)",
                    background: "transparent",
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "8px 12px",
                    borderRadius: 7,
                    border: "none",
                    textDecoration: "none",
                    letterSpacing: "-0.005em",
                    transition: "color .12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-2)")}
                >
                  Get started for free
                </a>
                {/* Primary — flat ink, single sparkle, tight shadow */}
                <a
                  href="https://app.lpstudio.ai"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    color: "var(--cream)",
                    background: "var(--ink)",
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "none",
                    boxShadow:
                      "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)",
                    textDecoration: "none",
                    letterSpacing: "-0.005em",
                    transition: "background .15s, transform .15s, box-shadow .15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--ink-2)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 2px rgba(26, 24, 21, 0.10), 0 8px 18px -6px rgba(26, 24, 21, 0.32)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--ink)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)";
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
                  </svg>
                  Generate page
                </a>
              </div>
            </div>
          </div>
        </form>

        {/* Or start from — suggestion pills */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            maxWidth: 680,
            marginInline: "auto",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-faint)",
              letterSpacing: "0.02em",
              marginRight: 4,
            }}
          >
            Or start from:
          </span>
          {SUGGESTION_PILLS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPill(p.prompt)}
              style={{
                fontSize: 12.5,
                background: "transparent",
                color: "var(--ink-faint)",
                border: "1px solid rgba(26, 24, 21, 0.10)",
                borderRadius: 999,
                padding: "6px 14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.color = "var(--ink-soft)";
                el.style.borderColor = "rgba(26, 24, 21, 0.18)";
                el.style.background = "var(--paper)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.color = "var(--ink-faint)";
                el.style.borderColor = "rgba(26, 24, 21, 0.10)";
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Subtle scroll indicator — mouse-style pill with a bouncing dot */}
        <div
          aria-hidden
          style={{
            marginTop: 56,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 20,
              height: 32,
              borderRadius: 999,
              border: "1px solid var(--ink-faint)",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "50%",
                marginLeft: -2,
                width: 4,
                height: 4,
                borderRadius: 999,
                background: "var(--ink-mute)",
                animation: "lp-scroll-bounce 1.7s ease-in-out infinite",
              }}
            />
          </div>
        </div>
        <style>{`
          @keyframes lp-scroll-bounce {
            0%, 100% { top: 6px; opacity: 1; }
            50% { top: 20px; opacity: 0.25; }
          }
        `}</style>
      </div>
    </section>
  );
}
