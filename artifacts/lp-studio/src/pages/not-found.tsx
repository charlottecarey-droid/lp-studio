import { useAuth } from "@/context/AuthContext";

const FG   = "hsl(152,40%,13%)";
const MU   = "hsl(152,8%,48%)";
const BG   = "hsl(152,18%,96%)";
const FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

function DandyNotFound() {
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
        textAlign: "center",
      }}
    >
      <svg width="96" height="32" viewBox="0 0 96 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: "2.5rem" }} aria-label="Dandy">
        <text x="0" y="26" fontFamily={FONT} fontWeight="700" fontSize="28" fill={FG} letterSpacing="-1">dandy</text>
      </svg>

      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          padding: "3rem 2.5rem",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 2px 24px rgba(0,58,48,0.07)",
        }}
      >
        <p style={{ fontSize: "4rem", marginBottom: "0.5rem", lineHeight: 1 }}>🔍</p>
        <h1
          style={{
            fontFamily: FONT,
            fontSize: "clamp(1.25rem,3vw,1.625rem)",
            fontWeight: 700,
            color: FG,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: "1rem",
          }}
        >
          This page doesn't exist
        </h1>
        <p style={{ fontSize: "1rem", lineHeight: 1.7, color: MU, marginBottom: "2rem" }}>
          The link you followed may be outdated or incorrect. If you were expecting a personalized
          Dandy page, reach out to your Dandy representative for a new link.
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

function DevNotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-sm border">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">404 — Page Not Found</h1>
        <p className="text-sm text-gray-500">No route matched this path.</p>
      </div>
    </div>
  );
}

export default function NotFound() {
  const { domainContext } = useAuth();
  if (domainContext?.mode === "microsite-only") return <DandyNotFound />;
  return <DevNotFound />;
}
