const FG   = "hsl(152,40%,13%)";
const MU   = "hsl(152,8%,48%)";
const AW   = "hsl(68,60%,52%)";
const BG   = "hsl(152,18%,96%)";
const FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

export default function PartnerHome() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: FONT,
      }}
    >
      {/* Logo */}
      <svg
        width="96"
        height="32"
        viewBox="0 0 96 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ marginBottom: "2.5rem" }}
        aria-label="Dandy"
      >
        <text
          x="0"
          y="26"
          fontFamily={FONT}
          fontWeight="700"
          fontSize="28"
          fill={FG}
          letterSpacing="-1"
        >
          dandy
        </text>
      </svg>

      {/* Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          padding: "3rem 2.5rem",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 2px 24px rgba(0,58,48,0.07)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: AW,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V22H4V12" />
            <path d="M22 7H2v5h20V7z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: FONT,
            fontSize: "clamp(1.375rem,3vw,1.75rem)",
            fontWeight: 700,
            color: FG,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            marginBottom: "1rem",
          }}
        >
          Your personalized page lives here
        </h1>

        <p
          style={{
            fontSize: "1rem",
            lineHeight: 1.7,
            color: MU,
            marginBottom: "2rem",
          }}
        >
          It looks like you followed a Dandy partner link without a specific destination.
          Check your email or Slack for your personalized link — it'll look something like{" "}
          <span style={{ color: FG, fontWeight: 600 }}>partners.meetdandy.com/your-company</span>.
        </p>

        <a
          href="https://www.meetdandy.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: FG,
            color: "#fff",
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: "0.9375rem",
            padding: "0.75rem 2rem",
            borderRadius: "0.625rem",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          Visit meetdandy.com →
        </a>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.8125rem", color: MU }}>
        © {new Date().getFullYear()} Dandy. All rights reserved.
      </p>
    </div>
  );
}
