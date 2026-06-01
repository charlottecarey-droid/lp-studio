import { Link } from "wouter";
import { useAuth, type DomainContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const FG   = "hsl(152,40%,13%)";
const MU   = "hsl(152,8%,48%)";
const BG   = "hsl(152,18%,96%)";
const FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";

/**
 * Dandy's white-labeled microsite 404. Kept verbatim for Dandy microsites
 * (the sole white-label exception); other tenants render the neutral,
 * tenant-aware MicrositeNotFound below.
 */
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

/**
 * Return the URL only when it's a well-formed http(s) link, so a misconfigured
 * tenant can never inject a non-web (e.g. javascript:) scheme into the CTA.
 */
function safeWebUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Derive a clean, clickable label (e.g. "acme.com") from a URL string. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

/**
 * Neutral, tenant-aware 404 for microsite visitors (external prospects who
 * followed a personalized link). Brand-agnostic palette — we don't have the
 * tenant's brand colors here — but uses the tenant's name and website so no
 * visitor is stranded and no other tenant ever sees Dandy branding.
 */
function MicrositeNotFound({ dc }: { dc: DomainContext | null }) {
  const tenantName = dc?.tenantName?.trim() || null;
  const websiteUrl = safeWebUrl(dc?.tenantWebsiteUrl?.trim() || dc?.rootRedirectUrl?.trim() || null);
  const year = new Date().getFullYear();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f6f7f8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        fontFamily: "'Inter',system-ui,sans-serif",
        textAlign: "center",
        color: "#1a1a1a",
      }}
    >
      {tenantName && (
        <div style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "2.5rem", color: "#1a1a1a" }}>
          {tenantName}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          padding: "3rem 2.5rem",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 2px 24px rgba(0,0,0,0.06)",
          border: "1px solid #ececec",
        }}
      >
        <p style={{ fontSize: "4rem", marginBottom: "0.5rem", lineHeight: 1 }}>🔍</p>
        <h1
          style={{
            fontSize: "clamp(1.25rem,3vw,1.625rem)",
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: "1rem",
          }}
        >
          This page doesn't exist
        </h1>
        <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "#6b7280", marginBottom: "2rem" }}>
          The link you followed may be outdated or incorrect. If you were expecting a personalized
          page, reach out to your contact{tenantName ? ` at ${tenantName}` : ""} for a new link.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: "#1a1a1a",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.9375rem",
                padding: "0.75rem 2rem",
                borderRadius: "0.625rem",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              Visit {hostLabel(websiteUrl)} →
            </a>
          )}
          <button
            type="button"
            onClick={goBack}
            style={{
              display: "inline-block",
              background: websiteUrl ? "#fff" : "#1a1a1a",
              color: websiteUrl ? "#1a1a1a" : "#fff",
              border: websiteUrl ? "1px solid #d1d5db" : "1px solid #1a1a1a",
              fontWeight: 600,
              fontSize: "0.9375rem",
              padding: "0.75rem 2rem",
              borderRadius: "0.625rem",
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            ← Go back
          </button>
        </div>
      </div>

      <p style={{ marginTop: "2rem", fontSize: "0.8125rem", color: "#9ca3af" }}>
        © {year}{tenantName ? ` ${tenantName}` : ""}. All rights reserved.
      </p>
    </div>
  );
}

/**
 * In-app 404 for the LP Studio SaaS shell. Members who mistype a route or
 * follow a stale link land here — always with a way back to the dashboard
 * and to the previous page, so they're never stranded.
 */
function AppNotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <div className="text-sm font-semibold tracking-tight text-muted-foreground mb-10">
        LP Studio
      </div>

      <div className="w-full max-w-md rounded-2xl border bg-card p-10 shadow-sm">
        <div className="font-display text-6xl font-bold tracking-tight text-primary mb-3 leading-none">
          404
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground mb-2">
          This page doesn't exist
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground mb-8">
          The page you're looking for may have moved, or the link you followed is out of date.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Home className="h-4 w-4 mr-1.5" />
              Back to dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NotFound() {
  const { domainContext } = useAuth();

  if (domainContext?.mode === "microsite-only") {
    const isDandy =
      domainContext.tenantSlug?.trim().toLowerCase() === "dandy" ||
      domainContext.tenantName?.trim().toLowerCase() === "dandy";
    return isDandy ? <DandyNotFound /> : <MicrositeNotFound dc={domainContext} />;
  }

  return <AppNotFound />;
}
