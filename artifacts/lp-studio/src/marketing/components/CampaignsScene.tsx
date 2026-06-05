import { useInView } from "../hooks/useInView";

// CampaignsScene — homepage section #9. Sits between Sales Console
// (#08) and IdentityWedge (#10) to set up the "send → reveal → optimize"
// arc that those three sections share. Tells the dual-channel send
// story: build the campaign + tokenized per-recipient pages in LP
// Studio, then either send directly via Resend OR push the list +
// tokenized URLs to an existing send stack (Marketo, HubSpot,
// Salesforce, Google Sheets, or any webhook) and let the MAP/CRM fire
// the send. Because URLs are tokenized at list-build time (not send
// time), the per-recipient identity reveal works either way. Mock is a
// side-by-side: composer (left) with an AI-drafted email, an attached
// per-account page, and a destination picker, plus the recipient's
// view (right) with a floating identity-reveal pill.

export default function CampaignsScene() {
  const { ref, inView } = useInView(0.05);

  return (
    <section
      id="campaigns"
      className="px-6"
      style={{
        background: "var(--cream)",
        paddingTop: 96,
        paddingBottom: 96,
        borderTop: "1px solid var(--hairline)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft accent orb */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          left: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(75,71,229,0.10) 0%, transparent 65%)",
          filter: "blur(10px)",
        }}
      />

      <div
        ref={ref}
        className="max-w-[1180px] mx-auto relative"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(20px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
        }}
      >
        {/* Headline + narrative */}
        <div style={{ maxWidth: 760, marginBottom: 36 }}>
          <div className="marker marker-rule mb-5">09 / Campaigns</div>
          <h2
            className="font-display text-display-lg"
            style={{ color: "var(--ink)", margin: 0 }}
          >
            Build the campaign here.{" "}
            <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>
              Send it from anywhere.
            </em>
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              margin: "16px 0 0",
              maxWidth: 600,
            }}
          >
            Draft AI outreach and attach a per-account page, then send
            directly via Resend — or push the list and per-recipient
            tokenized URLs to Marketo, HubSpot, Salesforce, Google
            Sheets, or any webhook and let your own stack fire the send.{" "}
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              The identity reveal works either way — URLs are tokenized
              at list-build time, not send time.
            </strong>
          </p>
        </div>

        {/* Bullets row */}
        <ul
          className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3 mb-12"
          style={{ listStyle: "none", padding: 0, margin: "0 0 36px", maxWidth: 1180 }}
        >
          {[
            "AI drafts grounded in the contact brief",
            "Per-account pages attached in one click",
            "Per-recipient identity in every URL",
            "Send from LPS, or push to Marketo · HubSpot · SFDC · Sheets · webhook",
          ].map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 text-[14px] leading-[1.45]"
              style={{ color: "var(--ink-2)" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--indigo)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginTop: 4, flexShrink: 0 }}
                aria-hidden="true"
              >
                <path d="M5 12.5L10 17.5L20 7.5" />
              </svg>
              {b}
            </li>
          ))}
        </ul>

        {/* Mock: composer + recipient view */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ComposerMock />
          <RecipientMock />
        </div>
      </div>
    </section>
  );
}

// ── Composer (left) ─────────────────────────────────────────────────────

function ComposerMock() {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
      }}
    >
      {/* Chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {["#F25C54", "#E8B339", "#3DB158"].map((dot) => (
            <span
              key={dot}
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: dot,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            fontWeight: 700,
            color: "var(--ink-mute)",
          }}
        >
          New campaign · Quick Wizard
        </span>
        <span
          className="font-mono uppercase ml-auto inline-flex items-center gap-1.5"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "var(--indigo)",
            background: "rgba(75,71,229,0.10)",
            border: "1px solid rgba(75,71,229,0.22)",
            padding: "2px 7px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 1l2.4 6.2L21 9l-5.4 4.3L17.5 21 12 17.3 6.5 21l1.9-7.7L3 9l6.6-1.8z" />
          </svg>
          AI · drafting
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px 18px" }}>
        {/* To */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
            borderBottom: "1px solid var(--hairline)",
            flexWrap: "wrap",
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              width: 54,
              flexShrink: 0,
            }}
          >
            To
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "3px 9px 3px 4px",
              background: "color-mix(in srgb, var(--indigo) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
              borderRadius: 999,
              fontSize: 12,
              color: "var(--ink)",
              fontWeight: 500,
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, var(--indigo) 0%, var(--coral) 100%)",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'DM Sans', 'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 9.5,
                flexShrink: 0,
              }}
            >
              SC
            </span>
            Sarah Chen
            <span style={{ color: "var(--ink-mute)", fontWeight: 400 }}>
              · VP, Cobalt Systems
            </span>
          </span>
        </div>

        {/* Subject */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              width: 54,
              flexShrink: 0,
            }}
          >
            Subject
          </span>
          <span
            style={{
              fontSize: 13.5,
              color: "var(--ink)",
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            Cobalt × Northwind — Q3 expansion brief
          </span>
        </div>

        {/* Body text */}
        <div
          style={{
            padding: "14px 0 12px",
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          Hi Sarah —<br />
          <br />
          Saw Cobalt&apos;s $80M Stratos acquisition. With your field-services
          expansion in mind, I put together a one-page brief on how
          Northwind&apos;s vertical-microsite playbook could land your AEs
          ahead of the launch.
          <br />
          <br />
          Take a look — it&apos;s tailored to Cobalt:
        </div>

        {/* Attached page chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            background: "color-mix(in srgb, var(--indigo) 6%, var(--cream-2))",
            border: "1px solid color-mix(in srgb, var(--indigo) 22%, transparent)",
            borderRadius: 10,
            marginBottom: 14,
            maxWidth: "100%",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background:
                "linear-gradient(135deg, var(--indigo) 0%, #6C68F0 100%)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            LP
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.005em",
              }}
            >
              Cobalt Pilot · executive microsite
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--ink-mute)",
                letterSpacing: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              lpstudio.ai/p/cobalt-pilot-sc · per-recipient link
            </div>
          </div>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "var(--sage)",
              background: "color-mix(in srgb, var(--sage) 14%, transparent)",
              padding: "2px 6px",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            ✓ Tokenized
          </span>
        </div>

        {/* Destination row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 0",
            borderTop: "1px solid var(--hairline)",
            flexWrap: "wrap",
          }}
        >
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              fontWeight: 700,
              color: "var(--ink-mute)",
              flexShrink: 0,
            }}
          >
            Destination
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            {[
              { label: "Resend", dot: "var(--indigo)", selected: true },
              { label: "Marketo", dot: "#5C4C9F", selected: false },
              { label: "HubSpot", dot: "#FF7A59", selected: false },
              { label: "Salesforce", dot: "#00A1E0", selected: false },
              { label: "Sheets", dot: "#0F9D58", selected: false },
              { label: "Webhook", dot: "#8A8780", selected: false },
            ].map((d) => (
              <span
                key={d.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  background: d.selected
                    ? "color-mix(in srgb, var(--indigo) 10%, transparent)"
                    : "var(--cream-2)",
                  border: d.selected
                    ? "1px solid color-mix(in srgb, var(--indigo) 30%, transparent)"
                    : "1px solid var(--hairline)",
                  color: d.selected ? "var(--indigo)" : "var(--ink-mute)",
                  opacity: d.selected ? 1 : 0.7,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: d.dot,
                    flexShrink: 0,
                  }}
                />
                {d.label}
                {d.selected && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path d="M5 12.5L10 17.5L20 7.5" />
                  </svg>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Send row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--hairline)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 160,
              fontSize: 11.5,
              color: "var(--ink-mute)",
            }}
          >
            Sending from sarah@northwind.com
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--paper)",
              border: "1px solid var(--hairline-strong)",
              color: "var(--ink-2)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Schedule
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, var(--indigo) 0%, #4340D2 100%)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              boxShadow:
                "0 6px 14px -6px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19l9 2-3-9 3-9-21 7 9 3 3 6z" />
            </svg>
            Send to 1
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Recipient view (right) ──────────────────────────────────────────────

function RecipientMock() {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.7) inset, 0 24px 50px -24px rgba(26,24,21,0.22), 0 10px 22px -14px rgba(26,24,21,0.12)",
        position: "relative",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "color-mix(in srgb, var(--ink) 3%, var(--paper))",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {["#F25C54", "#E8B339", "#3DB158"].map((dot) => (
            <span
              key={dot}
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: dot,
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--paper)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 9px",
            minWidth: 0,
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10.5,
              color: "var(--ink-mute)",
              letterSpacing: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            🔒 lpstudio.ai/p/cobalt-pilot-sc
          </span>
        </div>
      </div>

      {/* Mock page content */}
      <div style={{ padding: "26px 24px 24px", position: "relative" }}>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "var(--indigo)",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          For Cobalt Systems
        </span>
        <h3
          className="font-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.022em",
            lineHeight: 1.1,
            margin: "0 0 10px",
          }}
        >
          Ship 8 vertical microsites by Q2.
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.5,
            margin: "0 0 16px",
            maxWidth: 380,
          }}
        >
          A page-per-vertical workflow built for Cobalt&apos;s field-services
          launch — generated on-brand, ready in an hour.
        </p>

        {/* Two CTAs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background:
                "linear-gradient(180deg, var(--indigo) 0%, #4340D2 100%)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              boxShadow:
                "0 6px 14px -6px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            Book a working session
          </span>
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--hairline-strong)",
              color: "var(--ink-2)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            See pricing
          </span>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            padding: "12px 0",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          {[
            { label: "Time to ship", value: "47s" },
            { label: "Variants live", value: "8" },
            { label: "Halifax portfolio", value: "3 LP" },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="font-mono uppercase"
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  color: "var(--ink-mute)",
                }}
              >
                {s.label}
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  marginTop: 2,
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Floating identity-reveal pill */}
        <div
          style={{
            position: "absolute",
            bottom: 18,
            right: 18,
            maxWidth: "calc(100% - 36px)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px 8px 8px",
            background:
              "linear-gradient(135deg, var(--indigo) 0%, #5854E9 100%)",
            border: "1px solid color-mix(in srgb, var(--indigo) 40%, #FFFFFF)",
            borderRadius: 999,
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            boxShadow:
              "0 12px 28px -10px rgba(75,71,229,0.55), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #FFFFFF 0%, color-mix(in srgb, var(--coral) 70%, #FFFFFF) 100%)",
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 9.5,
              flexShrink: 0,
            }}
          >
            SC
          </span>
          <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
            <span>Sarah Chen is on the page</span>
            <span
              className="font-mono"
              style={{
                fontSize: 9.5,
                fontWeight: 500,
                color: "rgba(255,255,255,0.75)",
                letterSpacing: 0,
              }}
            >
              · just now · from your campaign
            </span>
          </span>
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "#7CFFB8",
              boxShadow: "0 0 8px #7CFFB8",
              marginLeft: 4,
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}
