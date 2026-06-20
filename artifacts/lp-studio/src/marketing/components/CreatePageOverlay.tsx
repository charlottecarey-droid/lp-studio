import Icon from "./EmbedIcons";

// CreatePageOverlay — "prompt → page" visualization for /for-marketing's
// first FeatureRow. Renders the production "Create New Page" modal as a
// standalone card on the left, an arrow in the middle, and a generated
// landing-page hero on the right — so visitors read it as "type a brief,
// get a page back" without any extra copy.
//
// The right-side hero borrows the SmartTrafficDemo Variant B layout
// (CenterHero) for visual consistency with the A/B section below, but
// uses a fresh title + image so it doesn't read as a duplicate.

const VIOLET = "#2E2A8C";
const LAVENDER = "var(--tint-lavender)";

export default function CreatePageOverlay() {
  return (
    <div
      className="cpo-root"
      style={{
        height: "100%",
        background: "var(--cream)",
        padding: "32px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        overflow: "hidden",
      }}
    >
      {/* On mobile the side-by-side "modal → arrow → generated page" layout
          can't fit, so it gets badly clipped. Below 720px we hide the arrow +
          generated hero and let the Create New Page modal go full-width (the
          optional "Pages to learn from" field is hidden to keep it inside the
          fixed-height frame). Desktop is unchanged. */}
      <style>{`
        @media (max-width: 720px) {
          .cpo-root { padding: 16px 14px !important; gap: 0 !important; }
          .cpo-arrow, .cpo-hero { display: none !important; }
          .cpo-modal {
            min-width: 0 !important;
            max-width: 100% !important;
            flex: 1 1 100% !important;
          }
          .cpo-pages { display: none !important; }
        }
      `}</style>
      <CreateNewPageModal />
      <GenerateArrow />
      <GeneratedPageHero />
    </div>
  );
}

// ---------- the modal (standalone card) ----------

function CreateNewPageModal() {
  return (
    <div
      className="cpo-modal"
      style={{
        flex: "0 1 460px",
        maxWidth: 460,
        minWidth: 360,
        background: "#fff",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        boxShadow:
          "0 30px 70px -24px rgba(20,18,30,0.30), 0 1px 0 rgba(255,255,255,0.7) inset",
        border: "1px solid var(--hairline-strong)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 10px",
        }}
      >
        <span
          style={{
            fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          Create New Page
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            color: "var(--ink-mute)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="x" size={16} />
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "0 20px 4px" }}>
        {/* Who is this page for? */}
        <div
          style={{
            background: LAVENDER,
            border: "1px solid color-mix(in srgb, #2E2A8C 16%, transparent)",
            borderRadius: 12,
            padding: "11px 13px 13px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 7,
            }}
          >
            <Icon name="users" size={13} style={{ color: VIOLET }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              Who is this page for?
            </span>
          </div>
          <Select value="— No specific segment —" />
        </div>

        {/* Three-tab pill row */}
        <div
          style={{
            display: "flex",
            background: "color-mix(in srgb, var(--ink) 6%, var(--paper))",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            padding: 3,
            gap: 3,
            marginBottom: 12,
          }}
        >
          {[
            { id: "template",  label: "Template",         icon: "file-text" as const, active: false },
            { id: "ai",        label: "AI Generate",      icon: "sparkles" as const,  active: true  },
            { id: "brief",     label: "Start with Brief", icon: "pencil" as const,    active: false },
          ].map((t) => (
            <span
              key={t.id}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: t.active ? "var(--ink)" : "transparent",
                color: t.active ? "#fff" : "var(--ink-mute)",
                boxShadow: t.active ? "0 1px 2px rgba(0,0,0,0.18)" : "none",
                fontWeight: 600,
                fontSize: 12,
                padding: "5px 10px",
                borderRadius: 7,
              }}
            >
              <Icon name={t.icon} size={12} /> {t.label}
            </span>
          ))}
        </div>

        {/* Describe your landing page info card */}
        <div
          style={{
            display: "flex",
            gap: 10,
            background: LAVENDER,
            border: "1px solid color-mix(in srgb, #2E2A8C 16%, transparent)",
            borderRadius: 12,
            padding: "11px 13px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              borderRadius: 6,
              background: "rgba(255,255,255,0.7)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: VIOLET,
            }}
          >
            <Icon name="sparkles" size={13} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
              Describe your landing page
            </div>
            <p
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--ink-mute)",
                margin: "2px 0 0",
              }}
            >
              Tell us what you're promoting, who it's for, and the tone you
              want. AI generates the page with all sections, copy, and a lead
              capture form.
            </p>
          </div>
        </div>

        {/* Starting Point */}
        <FieldLabel>Starting Point</FieldLabel>
        <Select value="Generate from scratch (AI chooses blocks)" />

        {/* Your Prompt */}
        <FieldLabel style={{ marginTop: 12 }}>Your Prompt</FieldLabel>
        <div
          style={{
            border: `1px dashed ${VIOLET}`,
            boxShadow: "0 0 0 3px color-mix(in srgb, #2E2A8C 10%, transparent)",
            borderRadius: 10,
            padding: "10px 12px",
            minHeight: 78,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--ink-mute)",
            background: "#fff",
          }}
        >
          e.g. A landing page for our new product or service, targeting the
          audience it's for. Highlight the top benefits and desired tone,
          and include a lead capture form.
        </div>

        {/* Pages to learn from */}
        <div className="cpo-pages">
          <FieldLabel style={{ marginTop: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="link" size={12} style={{ color: "var(--ink-mute)" }} />
              Pages to learn from{" "}
              <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>
                (optional, up to 5)
              </span>
            </span>
          </FieldLabel>
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 9,
              padding: "9px 12px",
              fontSize: 12,
              fontFamily:
                "ui-monospace, SFMono-Regular, 'Roboto Mono', Menlo, Monaco, Consolas, monospace",
              color: "var(--ink-mute)",
              background: "#fff",
            }}
          >
            https://stripe.com{"   "}— paste a URL and press Enter
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 20px",
          borderTop: "1px solid var(--hairline)",
          marginTop: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "7px 12px",
            borderRadius: 8,
            color: "var(--ink-mute)",
            background: "transparent",
          }}
        >
          Cancel
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--ink)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -6px rgba(26,24,21,0.4)",
          }}
        >
          <Icon name="sparkles" size={12} /> Generate Page
        </span>
      </div>
    </div>
  );
}

// ---------- arrow between modal and generated page ----------

function GenerateArrow() {
  return (
    <div
      aria-hidden="true"
      className="cpo-arrow"
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
      {/* Sparkle */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.7 4.5L18 8l-4.3 1.5L12 14l-1.7-4.5L6 8l4.3-1.5L12 2zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
      </svg>
      {/* Arrow */}
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
          writingMode: "horizontal-tb",
          textAlign: "center",
        }}
      >
        Generates
      </span>
    </div>
  );
}

// ---------- generated landing page hero ----------

function GeneratedPageHero() {
  // Same CenterHero treatment as SmartTrafficDemo Variant B (winning),
  // with a different title + image so it reads as a freshly generated page
  // rather than a duplicate of the A/B test below.
  const image =
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=900&h=520&fit=crop";

  return (
    <div
      className="cpo-hero"
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
      {/* Slim browser chrome so it reads as "a real page" */}
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
          lpstudio.ai/p/q4-product-launch
        </span>
      </div>

      {/* The hero itself — CenterHero treatment */}
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
          Q4 Product Launch · Nov 12
        </div>
        <div
          className="font-display"
          style={{
            fontSize: 28,
            lineHeight: 1.06,
            letterSpacing: "-0.028em",
            color: "#fff",
            fontWeight: 700,
            textShadow: "0 1px 3px rgba(0,0,0,0.40)",
            maxWidth: 300,
          }}
        >
          Your launch, fully formed.
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
          Watch the launch land on every channel the day your product ships
          — campaign pages, microsites, follow-up sequences, all on brand.
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
            Request access
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
            View roadmap
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------

function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
        color: "var(--ink-2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

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
        padding: "9px 12px",
        fontSize: 12.5,
        color: "var(--ink)",
      }}
    >
      {value}
      <Icon name="chevron-down" size={13} style={{ color: "var(--ink-mute)" }} />
    </div>
  );
}
