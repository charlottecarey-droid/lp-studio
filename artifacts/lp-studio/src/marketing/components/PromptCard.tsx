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

export default function PromptCard() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const { text: placeholder, visible } = useMadLibsPlaceholder(
    focused || value.length > 0,
  );

  function applyPill(prompt: string) {
    setValue(prompt);
  }

  // Hand the brief off to the app's AI create flow. The app shell reads
  // `prompt` + `new=ai` from the URL (pages-gallery → CreatePageModal) and
  // the auth gate preserves this exact path through sign-up, so a logged-out
  // visitor lands back here with their prompt intact after creating an account.
  function submitHero(override?: string) {
    const brief = (override ?? value).trim();
    const url = brief
      ? `https://app.lpstudio.ai/pages?new=ai&prompt=${encodeURIComponent(brief)}`
      : "https://app.lpstudio.ai/pages?new=ai";
    window.location.href = url;
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
          onSubmit={(e) => {
            e.preventDefault();
            submitHero();
          }}
          style={{
            maxWidth: 680,
            margin: "0 auto",
            textAlign: "left",
          }}
        >
          <div
            style={{
              background: "color-mix(in srgb, var(--cream) 30%, var(--paper))",
              border: focused ? "1px solid var(--indigo)" : "1px solid var(--hairline)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: focused
                ? "0 0 0 3px color-mix(in srgb, var(--indigo) 12%, transparent), 0 22px 48px -30px rgba(26,24,21,0.14), 0 8px 18px -16px rgba(26,24,21,0.09)"
                : "0 1px 0 rgba(255,255,255,0.6) inset, 0 30px 60px -28px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.14)",
              transition: "border-color .15s ease, box-shadow .15s ease",
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

            {/* Footer — primary + secondary CTAs. On mobile they spread
                across the full width (justify-between) so there's no dead
                white space on the right; on desktop they pack to the right. */}
            <div
              className="flex items-center justify-between md:justify-end"
              style={{
                gap: 6,
                padding: "10px 12px",
                borderTop: "1px solid var(--hairline)",
              }}
            >
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
                <button
                  type="submit"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    color: "var(--cream)",
                    background: "var(--navy)",
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
                    e.currentTarget.style.background = "var(--navy-2)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 2px rgba(26, 24, 21, 0.10), 0 8px 18px -6px rgba(26, 24, 21, 0.32)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--navy)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 2px rgba(26, 24, 21, 0.10), 0 4px 12px -6px rgba(26, 24, 21, 0.25)";
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="var(--coral)" aria-hidden="true" style={{ position: "relative", top: "1px" }}>
                    <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13 6.5 8.5 2 7l4.5-1.5L8 1z" />
                  </svg>
                  Generate page
                </button>
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
                background: "color-mix(in srgb, var(--cream) 30%, var(--paper))",
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
                el.style.background = "color-mix(in srgb, var(--cream) 30%, var(--paper))";
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
