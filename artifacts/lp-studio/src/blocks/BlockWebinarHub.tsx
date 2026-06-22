import { useEffect, useMemo, useState, Component, type ReactNode, type ErrorInfo } from "react";
import {
  Play, ArrowRight, Check, Linkedin, ChevronDown,
  FileText, Download, Sparkles, Share2, Users, Volume2, Settings, Maximize,
} from "lucide-react";
import type { WebinarHubBlockProps, WebinarStatus, WebinarCtaAction } from "@/lib/block-types";
import type { FormStep } from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";
import { getImageBgSectionStyle } from "@/lib/bg-styles";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { ChiliPiperModal } from "@/blocks/ChiliPiperModal";
import { pushMarketoSubmissionToDataLayer } from "@/lib/gtm-datalayer";

/* ------------------------------------------------------------------------- */
/*  Error boundary                                                           */
/* ------------------------------------------------------------------------- */

class WebinarHubErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[WebinarHub] render error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A", color: "#F4F1ED", padding: "2rem" }}>
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Webinar Hub — Render Error</h2>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, lineHeight: 1.6 }}>{this.state.error?.message ?? "Unknown error"}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */

const NEUTRAL_ACCENT = "#6366F1";
const LIVE_ACCENT_FALLBACK = "#E52E20";

interface StatusMeta {
  eyebrow: string;
  kicker: string;
  cta: string;
  formCta: string;
  formSuccess: string;
  videoLabel: string;
  pulse: boolean;
}

const STATUS_META: Record<WebinarStatus, StatusMeta> = {
  upcoming: { eyebrow: "Upcoming Event", kicker: "Reserve your place", cta: "Request Invitation", formCta: "Secure Registration", formSuccess: "You're confirmed. We've sent a calendar invitation and further details to your inbox.", videoLabel: "Trailer preview", pulse: false },
  live: { eyebrow: "Live Broadcast", kicker: "Session in progress", cta: "Enter Broadcast", formCta: "Join Session", formSuccess: "Access granted. Launching the live broadcast environment.", videoLabel: "Live stream", pulse: true },
  "on-demand": { eyebrow: "On Demand", kicker: "Access the archive", cta: "Watch Recording", formCta: "Unlock Recording", formSuccess: "Archive unlocked. The full recording and associated materials are below.", videoLabel: "Archived recording", pulse: false },
};

function initialsFor(name: string | undefined, explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 2).toUpperCase();
  if (!name) return "";
  return name.split(/\s+/).filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const DEFAULT_FORM_STEPS: FormStep[] = [
  {
    title: "Register",
    fields: [
      { id: "first_name", type: "text", label: "First name", placeholder: "First name", required: true },
      { id: "last_name", type: "text", label: "Last name", placeholder: "Last name", required: true },
      { id: "email", type: "email", label: "Work email", placeholder: "Work email", required: true },
      { id: "company", type: "text", label: "Company name", placeholder: "Company name", required: true },
    ],
  },
];

/* ------------------------------------------------------------------------- */
/*  Inner component                                                          */
/* ------------------------------------------------------------------------- */

interface BlockWebinarHubProps {
  props: WebinarHubBlockProps;
  brand?: BrandConfig;
  pageId?: number;
  variantId?: number;
  testId?: number;
  sessionId?: string;
  onFieldChange?: (updated: WebinarHubBlockProps) => void;
}

function WebinarHubInner({ props: p, brand, pageId, variantId, testId, sessionId, onFieldChange }: BlockWebinarHubProps) {
  const isBuilder = !!onFieldChange;

  /* ---- URL-driven personalization (published page only) ---- */
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const replayParam = params.get("replay") === "true";
  const speakerParam = params.get("speaker");

  const propStatus = (p.status ?? "upcoming") as WebinarStatus;
  const [status, setStatus] = useState<WebinarStatus>(replayParam ? "on-demand" : propStatus);
  useEffect(() => { setStatus(replayParam ? "on-demand" : propStatus); }, [propStatus, replayParam]);

  const m = STATUS_META[status];

  /* ---- Brand-aware colors + fonts ---- */
  const accent = (p.accentColor && p.accentColor.trim())
    || brand?.accentColor
    || brand?.primaryColor
    || NEUTRAL_ACCENT;
  const liveAccent = (p.liveAccentColor && p.liveAccentColor.trim()) || LIVE_ACCENT_FALLBACK;
  const statusAccent = status === "live" ? liveAccent : accent;

  const displayFont = toFontFamilyValue(brand?.displayFont, "display") ?? "'Playfair Display', Georgia, serif";
  const bodyFont = toFontFamilyValue(brand?.bodyFont, "sans") ?? "'Plus Jakarta Sans', system-ui, sans-serif";
  const monoFont = "'DM Mono', ui-monospace, 'SFMono-Regular', monospace";
  useBlockFonts(displayFont, bodyFont, monoFont);

  const C = {
    ink: "#0A0A0A",
    sand: "#F4F1ED",
    paper: "#FFFFFF",
    hairlineLight: "rgba(0,0,0,0.08)",
    hairlineDark: "rgba(255,255,255,0.12)",
  };

  /* ---- Content with defaults ---- */
  const brandName = (p.brandName && p.brandName.trim()) || brand?.brandName || "Your Brand";
  const navLinks = p.navLinks && p.navLinks.length ? p.navLinks : ["Overview", "Speakers", "Agenda", "Resources", "FAQ"];
  const registrations = typeof p.registrations === "number" ? p.registrations : 0;
  const speakers = p.speakers ?? [];
  const agenda = p.agenda ?? [];
  const emailSequence = p.emailSequence ?? [];
  const resources = p.resources ?? [];
  const faqs = p.faqs ?? [];

  const heroOverlay = (typeof p.heroOverlayOpacity === "number" ? p.heroOverlayOpacity : 55) / 100;
  const finalOverlay = (typeof p.finalCtaOverlayOpacity === "number" ? p.finalCtaOverlayOpacity : 55) / 100;

  const primaryCtaLabel = (p.primaryCtaText && p.primaryCtaText.trim()) || m.cta;

  /* ---- Section visibility ---- */
  const show = {
    nav: p.showNav !== false,
    hero: p.showHero !== false,
    form: p.showForm !== false,
    workflow: p.showWorkflow !== false,
    agenda: p.showAgenda !== false,
    video: p.showVideo !== false && status !== "upcoming",
    speakers: p.showSpeakers !== false,
    resources: p.showResources !== false,
    faq: p.showFaq !== false,
    finalCta: p.showFinalCta !== false,
    footer: p.showFooter !== false,
  };

  /* ---- CTA modal state ---- */
  type ModalState =
    | { kind: "form"; which: "primary" | "secondary"; initialEmail?: string }
    | { kind: "chilipiper"; url: string }
    | null;
  const [modal, setModal] = useState<ModalState>(null);

  function handleCta(action: WebinarCtaAction | undefined, url?: string, chilipiper?: string, which: "primary" | "secondary" = "primary") {
    const a = action ?? "scroll-to-form";
    if (a === "scroll-to-form") {
      if (typeof document !== "undefined") {
        document.getElementById("wh-register")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (a === "url") {
      if (url && typeof window !== "undefined") window.open(url, url.startsWith("#") ? "_self" : "_blank");
      return;
    }
    if (a === "open-form") {
      setModal({ kind: "form", which });
      return;
    }
    if (a === "chilipiper") {
      if (chilipiper) setModal({ kind: "chilipiper", url: chilipiper });
    }
  }

  function onPrimaryCta() {
    handleCta(p.primaryCtaAction, p.primaryCtaUrl, p.primaryChilipiperUrl, "primary");
  }
  function onSecondaryCta() {
    handleCta(p.secondaryCtaAction, p.secondaryCtaUrl, p.secondaryChilipiperUrl, "secondary");
  }

  /* ---- Registration form state ---- */
  const formSteps = p.formSteps && p.formSteps.length ? p.formSteps : DEFAULT_FORM_STEPS;
  const allFields = formSteps.flatMap(s => s.fields);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { setSubmitted(false); }, [status]);

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault();
    if (isBuilder) { setSubmitted(true); return; }
    setLoading(true);
    setFormError(null);

    const fields: Record<string, string> = {};
    for (const f of allFields) fields[f.label] = (formValues[f.id] ?? "").trim();

    try {
      const submitUrl = p.formSubmitUrl?.trim() || "/api/lp/leads";
      const resp = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, pageId, variantId, sessionId }),
      });
      if (!resp.ok) throw new Error("Submission failed");

      try { pushMarketoSubmissionToDataLayer(); } catch (err) { console.error("[webinar-hub] dataLayer push threw:", err); }

      try {
        const trackBody: Record<string, unknown> = {
          sessionId: sessionId ?? `anon-${Date.now()}`,
          eventType: "conversion",
          conversionType: "form_submit",
        };
        if (testId != null) trackBody.testId = testId;
        if (variantId != null) trackBody.variantId = variantId;
        await fetch("/api/lp/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trackBody),
        });
      } catch (err) { console.error("[webinar-hub] tracking error:", err); }

      try {
        const hlRaw = sessionStorage.getItem("hl_ctx");
        if (hlRaw) {
          const hlCtx = JSON.parse(hlRaw) as { hotlinkId: number; contactId: number; accountId: number | null; token: string };
          await fetch("/api/sales/signals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "form_submit",
              source: "microsite",
              hotlinkId: hlCtx.hotlinkId,
              contactId: hlCtx.contactId,
              accountId: hlCtx.accountId,
              metadata: { pageId, fields: Object.keys(fields) },
            }),
          });
        }
      } catch (err) { console.error("[webinar-hub] sales signal error:", err); }

      setSubmitted(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /* ===================================================================== */
  /*  Render fragments                                                      */
  /* ===================================================================== */

  const MonoLabel = ({ children, color, opacity = 0.6 }: { children: ReactNode; color?: string; opacity?: number }) => (
    <span style={{ fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", opacity, color }}>{children}</span>
  );

  const Avatar = ({ imageUrl, initials, tint, size = 48 }: { imageUrl?: string; initials: string; tint: string; size?: number }) => (
    imageUrl ? (
      <img src={imageUrl} alt={initials} style={{ width: size, height: size, borderRadius: "9999px", objectFit: "cover", flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
    ) : (
      <div style={{ width: size, height: size, fontSize: size * 0.4, background: tint, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: displayFont, flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }}>
        {initials}
      </div>
    )
  );

  const ctaButton = (label: string, onClick: () => void, bg: string, key?: string) => (
    <button key={key} type="button" onClick={onClick} style={{ background: bg, color: "#fff", padding: "0.625rem 1.25rem", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      {label}
    </button>
  );

  const outlineButton = (label: string, onClick: () => void, color: string, borderColor: string, key?: string) => (
    <button key={key} type="button" onClick={onClick} style={{ background: "transparent", color, padding: "0.625rem 1.25rem", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: `1px solid ${borderColor}`, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      {label}
    </button>
  );

  const statusPill = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.75rem", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#fff" }}>
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 8, height: 8 }}>
        {m.pulse && <span style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "9999px", opacity: 0.6, background: statusAccent }} className="wh-ping" />}
        <span style={{ width: 6, height: 6, borderRadius: "9999px", background: statusAccent }} />
      </span>
      {m.eyebrow}
    </div>
  );

  /* ---- Registration form card ---- */
  const registrationForm = (
    <div id="wh-register" style={{ position: "relative", zIndex: 20, width: "91.666%", marginLeft: "auto", marginTop: "-4rem", background: C.paper, border: `1px solid ${C.hairlineLight}`, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)", padding: "2rem" }}>
      {submitted ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 1.5rem", background: `${accent}1A`, color: accent, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check style={{ width: 32, height: 32 }} strokeWidth={2} />
          </div>
          <h3 style={{ fontFamily: displayFont, fontSize: "1.75rem", color: "#000", marginBottom: "0.75rem" }}>
            {status === "live" ? "Access Granted" : status === "on-demand" ? "Archive Unlocked" : "Confirmed"}
          </h3>
          <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.875rem", lineHeight: 1.6, maxWidth: 260, margin: "0 auto 2rem" }}>
            {(p.formSuccessMessage && p.formSuccessMessage.trim()) || m.formSuccess}
          </p>
          <button type="button" onClick={() => setSubmitted(false)} style={{ width: "100%", padding: "1rem", background: "#000", color: "#fff", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}>
            {status === "on-demand" ? "Play recording" : "Add to calendar"}
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </div>
      ) : (
        <form onSubmit={submitRegistration}>
          <div style={{ marginBottom: "2rem" }}>
            <MonoLabel color="rgba(0,0,0,0.4)" opacity={1}>{status === "on-demand" ? "Archive access" : "Secure your place"}</MonoLabel>
            <h3 style={{ marginTop: "0.5rem", fontFamily: displayFont, fontSize: "1.75rem", color: "#000", lineHeight: 1.2 }}>
              {status === "on-demand" ? "Unlock the recording" : "Register for session"}
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {allFields.map(f => (
              <input
                key={f.id}
                type={f.type === "email" ? "email" : "text"}
                placeholder={f.placeholder || f.label}
                required={f.required}
                value={formValues[f.id] ?? ""}
                onChange={e => setFormValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.hairlineLight}`, padding: "0.75rem 0", fontFamily: bodyFont, fontSize: "0.95rem", color: C.ink, outline: "none" }}
              />
            ))}
          </div>
          {formError && <p style={{ color: "#dc2626", fontSize: "0.8rem", marginTop: "1rem" }}>{formError}</p>}
          <div style={{ borderTop: `2px dashed ${C.hairlineLight}`, margin: "2rem 0" }} />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "1rem", background: statusAccent, color: "#fff", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: loading ? "wait" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Submitting…" : m.formCta}
            <ArrowRight style={{ width: 16, height: 16 }} />
          </button>
        </form>
      )}
    </div>
  );

  const secondaryEnabled = !!(p.secondaryCtaText && p.secondaryCtaText.trim());
  const secondaryLabel = p.secondaryCtaText?.trim() || "";

  /* ===================================================================== */

  return (
    <div style={{ fontFamily: bodyFont, background: C.sand, color: C.ink, overflowX: "hidden", position: "relative" }}>
      <style>{`@keyframes wh-ping{75%,100%{transform:scale(2.2);opacity:0}}.wh-ping{animation:wh-ping 1.2s cubic-bezier(0,0,0.2,1) infinite}`}</style>

      {/* ---- Top Nav ---- */}
      {show.nav && (
        <nav style={{ position: isBuilder ? "relative" : "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(10,10,10,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem", height: 80, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={brandName} style={{ height: 28, width: "auto", objectFit: "contain" }} />
              ) : (
                <>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: "#fff" }} />
                  <span style={{ fontWeight: 500, color: "#fff", letterSpacing: "0.02em" }}>{brandName}</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="wh-nav-links">
              {navLinks.map(item => (
                <a key={item} href={`#${slugify(item)}`} style={{ fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>{item}</a>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button type="button" aria-label="Share event" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "transparent", cursor: "pointer" }}>
                <Share2 style={{ width: 16, height: 16 }} />
              </button>
              {secondaryEnabled && p.secondaryCtaInNav && outlineButton(secondaryLabel, onSecondaryCta, "#fff", "rgba(255,255,255,0.25)", "nav-sec")}
              {ctaButton(primaryCtaLabel, onPrimaryCta, statusAccent, "nav-pri")}
            </div>
          </div>
        </nav>
      )}

      {/* ---- Hero ---- */}
      {show.hero && (
        <section
          style={{
            position: "relative",
            padding: "8rem 1.5rem 12rem",
            overflow: "hidden",
            background: C.ink,
            color: C.sand,
            ...(p.heroBackgroundImageUrl ? getImageBgSectionStyle(p.heroBackgroundImageUrl) : {}),
          }}
        >
          {p.heroBackgroundImageUrl && <div style={{ position: "absolute", inset: 0, backgroundColor: "#0A0A0A", opacity: heroOverlay, pointerEvents: "none" }} />}
          <div style={{ maxWidth: "80rem", margin: "0 auto", position: "relative", zIndex: 10, display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: "2rem", alignItems: "center" }} className="wh-hero-grid">
            {/* Left copy */}
            <div style={{ gridColumn: "span 6 / span 6" }} className="wh-hero-copy">
              <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                {statusPill}
                {p.editionLabel && <span style={{ fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", opacity: 0.5 }}>{p.editionLabel}</span>}
              </div>
              <h1 style={{ fontFamily: displayFont, fontSize: "clamp(2.75rem, 6vw, 4.5rem)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "2rem" }}>{p.title}</h1>
              {p.subtitle && <p style={{ fontSize: "1.125rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: "3rem", maxWidth: "32rem" }}>{p.subtitle}</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem 2rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                {(p.date || p.time) && (
                  <div>
                    <MonoLabel>Date &amp; Time</MonoLabel>
                    {p.date && <div style={{ marginTop: 4, fontSize: "0.875rem" }}>{p.date}</div>}
                    {p.time && <div style={{ fontSize: "0.875rem", opacity: 0.6 }}>{p.time} {p.timezone}</div>}
                  </div>
                )}
                <div>
                  <MonoLabel>Format</MonoLabel>
                  <div style={{ marginTop: 4, fontSize: "0.875rem" }}>{status === "upcoming" ? "Live Broadcast" : "Archive"}</div>
                  <div style={{ fontSize: "0.875rem", opacity: 0.6 }}>Interactive Q&amp;A</div>
                </div>
                {registrations > 0 && (
                  <div>
                    <MonoLabel>{status === "live" ? "Watching now" : status === "on-demand" ? "Have attended" : "Registered"}</MonoLabel>
                    <div style={{ marginTop: 4, fontSize: "0.875rem" }}>{registrations.toLocaleString()}</div>
                    <div style={{ fontSize: "0.875rem", opacity: 0.6 }}>Across all teams</div>
                  </div>
                )}
              </div>
            </div>
            {/* Right video + form */}
            <div style={{ gridColumn: "span 6 / span 6", position: "relative" }} className="wh-hero-media">
              <div style={{ position: "relative", background: "#1A1A1A", boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)", padding: "1rem" }}>
                <div style={{ position: "relative", aspectRatio: "16 / 10", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)", ...(p.heroVideoPosterUrl ? getImageBgSectionStyle(p.heroVideoPosterUrl) : {}) }}>
                  <div style={{ position: "relative", zIndex: 10, width: 80, height: 80, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play style={{ width: 32, height: 32, color: "#fff", marginLeft: 4 }} fill="currentColor" />
                  </div>
                  <div style={{ position: "absolute", top: 24, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontFamily: monoFont, fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", padding: "0.25rem 0.5rem", backdropFilter: "blur(8px)", color: "#fff", background: status === "live" ? "rgba(229,46,32,0.9)" : "rgba(0,0,0,0.5)" }}>
                      {status === "live" && <span style={{ width: 6, height: 6, borderRadius: "9999px", background: "#fff" }} className="wh-ping" />}
                      {m.videoLabel}
                    </span>
                    <span style={{ fontFamily: monoFont, fontSize: "10px", letterSpacing: "0.15em", opacity: 0.5, color: "#fff" }}>{brandName}</span>
                  </div>
                </div>
              </div>
              {show.form && registrationForm}
            </div>
          </div>
        </section>
      )}

      {/* ---- Workflow / email sequence ---- */}
      {show.workflow && emailSequence.length > 0 && (
        <section style={{ padding: "8rem 1.5rem", background: C.paper }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "5rem" }} className="wh-two-col">
            <div>
              <MonoLabel opacity={1}>{p.workflowEyebrow || "The Lifecycle"}</MonoLabel>
              <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1, marginTop: "1rem", marginBottom: "2rem" }}>{p.workflowHeadline || "From registration to pipeline generation"}</h2>
              {p.workflowDescription && <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "1.125rem", lineHeight: 1.6, maxWidth: "28rem" }}>{p.workflowDescription}</p>}
            </div>
            <div style={{ position: "relative", paddingLeft: "3rem" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 23, width: 1, background: "#E6E1D6" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "3rem", position: "relative", zIndex: 10 }}>
                {emailSequence.map((step, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: -46, top: 4, width: 32, height: 32, borderRadius: "9999px", background: "#fff", border: "1px solid #E6E1D6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontFamily: monoFont, fontWeight: 700 }}>0{i + 1}</div>
                    <div>
                      <span style={{ fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: accent }}>{step.when}</span>
                      <h4 style={{ fontSize: "1.125rem", fontWeight: 500, marginTop: 4, marginBottom: 8 }}>{step.label}</h4>
                      {step.desc && <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.875rem" }}>{step.desc}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Agenda ---- */}
      {show.agenda && agenda.length > 0 && (
        <section id="agenda" style={{ padding: "8rem 1.5rem", background: C.sand }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
            <div style={{ marginBottom: "5rem" }}>
              <MonoLabel opacity={1}>{p.agendaEyebrow || "Itinerary"}</MonoLabel>
              <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1rem" }}>{p.agendaHeadline || "Session Agenda"}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {agenda.map((item, i) => (
                <div key={i} style={{ background: "#fff", padding: "2rem", border: "1px solid #E6E1D6", display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
                  <div style={{ fontFamily: monoFont, fontSize: "1.875rem", fontWeight: 300, color: "rgba(0,0,0,0.2)", marginBottom: "1.5rem" }}>{item.time}</div>
                  <h4 style={{ fontSize: "1.25rem", fontWeight: 500, marginBottom: "0.75rem" }}>{item.title}</h4>
                  {item.desc && <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "2rem", flex: 1 }}>{item.desc}</p>}
                  {item.speaker && (
                    <div style={{ paddingTop: "1.5rem", borderTop: "1px solid #E6E1D6", marginTop: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar initials={initialsFor(item.speaker)} tint="#1A1A1A" size={24} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{item.speaker}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Featured video / stream ---- */}
      {show.video && (
        <section style={{ padding: "8rem 1.5rem", background: "#000", color: "#fff" }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
            <div style={{ marginBottom: "4rem" }}>
              <MonoLabel color="rgba(255,255,255,0.5)" opacity={1}>{p.videoEyebrow || (status === "live" ? "On Air" : "The Archive")}</MonoLabel>
              <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1rem" }}>{p.videoHeadline || (status === "live" ? "Live Broadcast" : "Session Materials")}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: "3rem" }} className="wh-video-grid">
              <div style={{ gridColumn: "span 8 / span 8" }} className="wh-video-main">
                <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", ...(p.featuredVideoPosterUrl ? getImageBgSectionStyle(p.featuredVideoPosterUrl) : {}) }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #000, transparent, rgba(0,0,0,0.3))" }} />
                  <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 20 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.625rem", fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "#fff", backdropFilter: "blur(8px)", background: status === "live" ? "rgba(229,46,32,0.9)" : "rgba(0,0,0,0.5)" }}>
                      {status === "live" && <span style={{ width: 6, height: 6, borderRadius: "9999px", background: "#fff" }} className="wh-ping" />}
                      {status === "live" ? "Live" : "Recording"}
                    </span>
                    {registrations > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", fontFamily: monoFont, fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255,255,255,0.8)" }}>
                        <Users style={{ width: 12, height: 12 }} /> {registrations.toLocaleString()} {status === "live" ? "watching" : "views"}
                      </span>
                    )}
                  </div>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                    <div style={{ width: 80, height: 80, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Play style={{ width: 32, height: 32, color: "#fff", marginLeft: 4 }} fill="currentColor" />
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "2.5rem 1rem 1rem", background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                    <div style={{ position: "relative", height: 4, borderRadius: "9999px", background: "rgba(255,255,255,0.2)", marginBottom: "0.75rem" }}>
                      <div style={{ position: "absolute", insetBlock: 0, left: 0, borderRadius: "9999px", width: status === "live" ? "100%" : "38%", background: status === "live" ? liveAccent : accent }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "rgba(255,255,255,0.9)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <Play style={{ width: 16, height: 16 }} fill="currentColor" />
                        <Volume2 style={{ width: 16, height: 16 }} />
                        <span style={{ fontFamily: monoFont, fontSize: "10px", letterSpacing: "0.1em" }}>{status === "live" ? "LIVE" : "18:24 / 48:30"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <Settings style={{ width: 16, height: 16 }} />
                        <Maximize style={{ width: 16, height: 16 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ gridColumn: "span 4 / span 4" }} className="wh-video-side">
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                  <h4 style={{ fontSize: "1.125rem", fontWeight: 500 }}>{status === "live" ? "Live Q&A" : "Session Materials"}</h4>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {["Full Recording", "Executive Summary", "Slides", "Transcript", "Related"].map((tab, i) => (
                    <button key={tab} type="button" onClick={() => setActiveTab(i)} style={{ textAlign: "left", padding: "0.75rem 1rem", fontSize: "0.875rem", fontFamily: monoFont, letterSpacing: "0.05em", background: activeTab === i ? "rgba(255,255,255,0.05)" : "transparent", color: activeTab === i ? "#fff" : "rgba(255,255,255,0.4)", borderLeft: `2px solid ${activeTab === i ? accent : "transparent"}`, border: "none", borderLeftWidth: 2, borderLeftStyle: "solid", borderLeftColor: activeTab === i ? accent : "transparent", cursor: "pointer" }}>
                      0{i + 1} — {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- Speakers ---- */}
      {show.speakers && speakers.length > 0 && (
        <section id="speakers" style={{ padding: "8rem 1.5rem", background: "#fff", borderTop: "1px solid #E6E1D6", borderBottom: "1px solid #E6E1D6" }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5rem", gap: "2rem" }}>
              <div>
                <MonoLabel opacity={1}>{p.speakersEyebrow || "The Panel"}</MonoLabel>
                <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1rem" }}>{p.speakersHeadline || "Industry Experts"}</h2>
              </div>
              {p.speakersDescription && <p style={{ color: "rgba(0,0,0,0.6)", maxWidth: "20rem", textAlign: "right" }}>{p.speakersDescription}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "4rem 2rem" }}>
              {speakers.map((s, idx) => {
                const sid = s.id || slugify(s.name || `speaker-${idx}`);
                const highlighted = !!speakerParam && speakerParam === sid;
                return (
                  <div key={sid} style={{ position: "relative" }}>
                    {highlighted && <div style={{ position: "absolute", inset: "-1.5rem", border: `1px solid ${accent}66`, zIndex: -1 }} />}
                    <div style={{ marginBottom: "1.5rem", position: "relative", display: "inline-block" }}>
                      <Avatar imageUrl={s.imageUrl} initials={initialsFor(s.name, s.initials)} tint="#2A3C34" size={120} />
                      {s.linkedinUrl && (
                        <a href={s.linkedinUrl} target="_blank" rel="noreferrer" style={{ position: "absolute", bottom: 0, right: 0, background: "#0A66C2", color: "#fff", padding: 8, borderRadius: "9999px", border: "2px solid #fff", display: "flex" }}>
                          <Linkedin style={{ width: 16, height: 16 }} />
                        </a>
                      )}
                    </div>
                    {highlighted && <span style={{ display: "inline-block", marginBottom: "0.75rem", padding: "0.25rem 0.5rem", fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "#fff", background: accent }}>Featured for you</span>}
                    <h3 style={{ fontFamily: displayFont, fontSize: "1.5rem", marginBottom: 4 }}>{s.name}</h3>
                    {s.role && <p style={{ fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", color: accent, marginBottom: "1rem" }}>{s.role}</p>}
                    {s.bio && <p style={{ color: "rgba(0,0,0,0.7)", fontSize: "0.875rem", lineHeight: 1.6 }}>{s.bio}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---- Resources ---- */}
      {show.resources && (resources.length > 0 || p.featuredResourceTitle) && (
        <section id="resources" style={{ padding: "8rem 1.5rem", background: C.sand }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto" }}>
            <div style={{ marginBottom: "5rem" }}>
              <MonoLabel opacity={1}>{p.resourcesEyebrow || "Library"}</MonoLabel>
              <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1rem" }}>{p.resourcesHeadline || "Featured Resources"}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {p.featuredResourceTitle && (
                <div style={{ background: "#000", color: "#fff", padding: "1.5rem", display: "flex", flexDirection: "column", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "9999px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Sparkles style={{ width: 16, height: 16 }} /></div>
                    <MonoLabel color="rgba(255,255,255,0.6)" opacity={1}>Recommended</MonoLabel>
                  </div>
                  <h4 style={{ fontSize: "1.125rem", fontWeight: 500, marginBottom: "0.5rem" }}>{p.featuredResourceTitle}</h4>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem", flex: 1 }}>Hand-picked for you. Start here.</p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}><Download style={{ width: 16, height: 16 }} /></div>
                </div>
              )}
              {resources.map((res, i) => (
                <div key={i} style={{ background: "#fff", padding: "1.5rem", border: "1px solid #E6E1D6", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "9999px", background: C.sand, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.6)" }}><FileText style={{ width: 16, height: 16 }} /></div>
                    {res.format && <MonoLabel opacity={1}>{res.format}</MonoLabel>}
                  </div>
                  <h4 style={{ fontSize: "1.125rem", fontWeight: 500, marginBottom: "0.5rem" }}>{res.title}</h4>
                  {res.desc && <p style={{ color: "rgba(0,0,0,0.6)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem", flex: 1 }}>{res.desc}</p>}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}><Download style={{ width: 16, height: 16 }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- FAQ ---- */}
      {show.faq && faqs.length > 0 && (
        <section id="faq" style={{ padding: "8rem 1.5rem", background: "#fff" }}>
          <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "5rem" }}>
              <MonoLabel opacity={1}>{p.faqEyebrow || "Information"}</MonoLabel>
              <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1rem" }}>{p.faqHeadline || "Common Questions"}</h2>
            </div>
            <div style={{ borderTop: "1px solid #E6E1D6" }}>
              {faqs.map((faq, i) => (
                <div key={i} style={{ borderBottom: "1px solid #E6E1D6" }}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", padding: "1.5rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                      <span style={{ fontFamily: displayFont, fontSize: "1.5rem", color: "rgba(0,0,0,0.2)" }}>Q{i + 1}</span>
                      <h4 style={{ fontSize: "1.125rem", fontWeight: 500, paddingRight: "2rem" }}>{faq.q}</h4>
                    </div>
                    <ChevronDown style={{ width: 20, height: 20, color: "rgba(0,0,0,0.4)", transition: "transform 0.3s", transform: openFaq === i ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                  </button>
                  {openFaq === i && (
                    <div style={{ paddingLeft: "3.5rem", paddingBottom: "2rem", color: "rgba(0,0,0,0.6)", lineHeight: 1.6, maxWidth: "32rem" }}>{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Final CTA ---- */}
      {show.finalCta && (
        <section style={{ position: "relative", padding: "8rem 1.5rem", overflow: "hidden", textAlign: "center", background: C.ink, color: C.sand, ...(p.finalCtaBackgroundImageUrl ? getImageBgSectionStyle(p.finalCtaBackgroundImageUrl) : {}) }}>
          {p.finalCtaBackgroundImageUrl && <div style={{ position: "absolute", inset: 0, backgroundColor: "#0A0A0A", opacity: finalOverlay, pointerEvents: "none" }} />}
          <div style={{ maxWidth: "48rem", margin: "0 auto", position: "relative", zIndex: 10 }}>
            <MonoLabel color="rgba(255,255,255,0.5)" opacity={1}>{p.finalCtaKicker || m.kicker}</MonoLabel>
            <h2 style={{ fontFamily: displayFont, fontSize: "clamp(2rem, 6vw, 3.75rem)", marginTop: "1.5rem", marginBottom: "2rem", lineHeight: 1.05 }}>
              {p.finalCtaHeadline || (status === "live" ? "The session is live right now" : status === "on-demand" ? "Watch the full session on your time" : "Save your seat before it fills")}
            </h2>
            {(p.finalCtaSubtitle || p.subtitle) && <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.125rem", marginBottom: "3rem", maxWidth: "36rem", marginInline: "auto" }}>{p.finalCtaSubtitle || p.subtitle}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
              {secondaryEnabled && p.secondaryCtaInFinalCta && outlineButton(secondaryLabel, onSecondaryCta, "#fff", "rgba(255,255,255,0.25)", "final-sec")}
              <button type="button" onClick={onPrimaryCta} style={{ background: statusAccent, color: "#fff", padding: "1rem 2rem", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                {primaryCtaLabel} <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
            {registrations > 0 && (
              <p style={{ fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", marginTop: "2rem" }}>
                {registrations.toLocaleString()} {status === "live" ? "watching now" : status === "on-demand" ? "have attended" : "already registered"}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- Footer ---- */}
      {show.footer && (
        <footer style={{ background: "#000", color: "#fff", padding: "5rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ maxWidth: "80rem", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "2rem" }}>
            <div>
              <h2 style={{ fontFamily: displayFont, fontSize: "1.875rem", marginBottom: "1rem" }}>{brandName}</h2>
              {p.footerTagline && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}>{p.footerTagline}</p>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1.5rem" }}>
              {secondaryEnabled && p.secondaryCtaInFooter && outlineButton(secondaryLabel, onSecondaryCta, "#fff", "rgba(255,255,255,0.25)", "footer-sec")}
              <button type="button" onClick={onPrimaryCta} style={{ background: statusAccent, color: "#fff", padding: "0.75rem 1.5rem", fontFamily: monoFont, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                {primaryCtaLabel} <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
              <div style={{ display: "flex", gap: "1rem" }}>
                <MonoLabel color="rgba(255,255,255,0.4)" opacity={1}>{p.footerCopyright || `© ${new Date().getFullYear()}`}</MonoLabel>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* ---- Builder-only status preview toggle ---- */}
      {isBuilder && (
        <div style={{ position: "sticky", bottom: 16, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", pointerEvents: "auto" }}>
            {(["upcoming", "live", "on-demand"] as WebinarStatus[]).map(o => (
              <button key={o} type="button" onClick={() => setStatus(o)} style={{ padding: "0.5rem 1rem", borderRadius: "9999px", fontFamily: monoFont, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", border: "none", cursor: "pointer", background: status === o ? "#fff" : "transparent", color: status === o ? "#000" : "rgba(255,255,255,0.6)" }}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- CTA modals ---- */}
      {modal?.kind === "form" && (
        <EmailCaptureModal
          open
          onClose={() => setModal(null)}
          email=""
          mode="form"
          formConfig={{
            headline: modal.which === "secondary" ? (p.secondaryFormHeadline || secondaryLabel || "Get in touch") : "Register for session",
            subheadline: modal.which === "secondary" ? (p.secondaryFormSubheadline || "") : "",
            successMessage: modal.which === "secondary" ? (p.secondaryFormSuccessMessage || "Thanks! We'll be in touch shortly.") : ((p.formSuccessMessage && p.formSuccessMessage.trim()) || m.formSuccess),
          }}
          primaryColor={accent}
          {...(brand ? { brand } : {})}
          {...(pageId != null ? { pageId } : {})}
          {...(variantId != null ? { variantId } : {})}
          source="webinar-hub"
        />
      )}
      {modal?.kind === "chilipiper" && (
        <ChiliPiperModal
          url={modal.url}
          onClose={() => setModal(null)}
          {...(pageId != null ? { pageId } : {})}
          {...(testId != null ? { testId } : {})}
          {...(variantId != null ? { variantId } : {})}
          {...(sessionId != null ? { sessionId } : {})}
        />
      )}

      <style>{`
        @media (max-width: 1024px){
          .wh-hero-grid,.wh-two-col,.wh-video-grid{grid-template-columns:1fr !important;}
          .wh-hero-copy,.wh-hero-media,.wh-video-main,.wh-video-side{grid-column:auto !important;}
          .wh-nav-links{display:none !important;}
        }
      `}</style>
    </div>
  );
}

export function BlockWebinarHub(props: BlockWebinarHubProps) {
  return (
    <WebinarHubErrorBoundary>
      <WebinarHubInner {...props} />
    </WebinarHubErrorBoundary>
  );
}

export default BlockWebinarHub;
