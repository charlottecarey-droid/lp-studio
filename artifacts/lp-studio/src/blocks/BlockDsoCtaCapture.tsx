import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Calendar, CheckCircle2, Loader2, ArrowRight, ChevronLeft } from "lucide-react";
import type { DsoCtaCaptureBlockProps } from "@/lib/block-types";
import { getBgStyle, isDarkBg } from "@/lib/bg-styles";

const DISPLAY_FONT = "'Bagoss Standard','Inter',system-ui,sans-serif";
const AW = "hsl(68,60%,52%)";
const API_BASE = "/api";

const BG_HEX: Record<string, string> = {
  "dark":        "#1a1a1a",
  "dandy-green": "#003A30",
  "black":       "#000000",
  "gradient":    "#000000",
  "white":       "#ffffff",
  "light-gray":  "#f8fafc",
  "muted":       "#f5f0e8",
};

interface Props {
  props: DsoCtaCaptureBlockProps;
  pageId?: number;
  variantId?: number;
  prefillCompany?: string;
}

type FormState = "idle" | "loading" | "success";
type FormStep = 1 | 2;

function buildChiliPiperUrl(base: string, email: string, firstName: string, lastName: string, company: string): string {
  if (!base) return "";
  try {
    const url = new URL(base);
    url.searchParams.set("email", email);
    if (firstName) url.searchParams.set("firstName", firstName);
    if (lastName)  url.searchParams.set("lastName", lastName);
    if (company)   url.searchParams.set("company", company);
    return url.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    const params = new URLSearchParams({ email });
    if (firstName) params.set("firstName", firstName);
    if (lastName)  params.set("lastName", lastName);
    if (company)   params.set("company", company);
    return `${base}${sep}${params.toString()}`;
  }
}

export function BlockDsoCtaCapture({ props, pageId, variantId, prefillCompany }: Props) {
  const {
    eyebrow       = "Get Started Today",
    headline      = "See what Dandy can\ndo for your group.",
    body          = "Join DSO leaders already running smarter, faster dental operations. Setup takes one call.",
    inputLabel    = "Work email",
    inputPlaceholder = "yourname@dsogroup.com",
    ctaLabel      = "Request a Demo",
    trust1        = "1,200+ DSO locations",
    trust2        = "No long-term contract",
    trust3        = "Live in 30 days",
    imageUrl      = "",
    imagePosition = "right",
    chilipiperUrl = "",
    successHeadline = "You're on the list!",
    successBody = "Check your inbox — we'll be in touch shortly to schedule your demo.",
    backgroundStyle = "dandy-green",
  } = props;

  const dark          = isDarkBg(backgroundStyle);
  const pfg           = dark ? "hsl(48,100%,96%)"       : "#003A30";
  const muted         = dark ? "hsla(48,100%,96%,0.50)" : "rgba(0,58,48,0.55)";
  const bgHex         = BG_HEX[backgroundStyle] ?? "#003A30";
  const borderDefault = dark ? "rgba(199,231,56,0.18)"  : "rgba(0,58,48,0.20)";
  const borderFocused = dark ? "rgba(199,231,56,0.50)"  : "rgba(0,58,48,0.40)";
  const inputBgColor  = dark ? "rgba(255,255,255,0.05)" : "rgba(0,58,48,0.04)";

  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-8%" });

  const [step, setStep] = useState<FormStep>(1);
  const [focused1, setFocused1] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState(prefillCompany ?? "");
  const hasCompanyPrefill = Boolean(prefillCompany);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");

  const [formState, setFormState] = useState<FormState>("idle");
  const [cpOpen, setCpOpen] = useState(false);
  const [cpUrl, setCpUrl] = useState("");

  const hasImage  = Boolean(imageUrl);
  const imgOnLeft = imagePosition === "left";
  const trusts = [trust1, trust2, trust3].filter(Boolean);

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid work email.");
      return;
    }
    setEmailError("");
    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    let hasError = false;
    if (!firstName.trim()) { setFirstNameError("Required"); hasError = true; }
    if (!lastName.trim())  { setLastNameError("Required");  hasError = true; }
    if (hasError) return;
    setFirstNameError("");
    setLastNameError("");
    setFormState("loading");

    const fn = firstName.trim();
    const ln = lastName.trim();
    const co = company.trim();

    try {
      if (pageId) {
        await fetch(`${API_BASE}/lp/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            variantId,
            fields: {
              email: email.trim(),
              name: `${fn} ${ln}`,
              firstName: fn,
              lastName: ln,
              organization: co || undefined,
              source: "dso-cta-capture",
            },
          }),
        });
      }
    } catch {
      // silently continue
    }

    setFormState("success");

    if (chilipiperUrl) {
      const url = buildChiliPiperUrl(chilipiperUrl, email.trim(), fn, ln, co);
      setCpUrl(url);
      setCpOpen(true);
    }
  }

  const isLoading = formState === "loading";
  const isSuccess = formState === "success";

  function fieldStyle(key: string, hasError = false): React.CSSProperties {
    const isFocused = focusedField === key;
    return {
      width: "100%",
      background: inputBgColor,
      border: `1px solid ${hasError ? "rgba(239,68,68,0.6)" : isFocused ? borderFocused : borderDefault}`,
      borderRadius: 10,
      padding: "11px 16px",
      color: pfg,
      fontSize: "0.9375rem",
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: isFocused ? `0 0 0 3px ${dark ? "rgba(199,231,56,0.08)" : "rgba(0,58,48,0.06)"}` : "none",
      boxSizing: "border-box",
    };
  }

  const stepDots = (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", gap: 5 }}>
        {([1, 2] as FormStep[]).map(s => (
          <div
            key={s}
            style={{
              height: 4, borderRadius: 999,
              width: s === step ? 22 : 8,
              background: s <= step ? AW : borderDefault,
              transition: "width 0.35s cubic-bezier(0.16,1,0.3,1), background 0.25s",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", color: muted }}>
        STEP {step} OF 2
      </span>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", overflow: "hidden", minHeight: "80vh", display: "flex", alignItems: "stretch", ...getBgStyle(backgroundStyle) }}
    >
      {/* Atmospheric glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: imgOnLeft
          ? "radial-gradient(ellipse 60% 70% at 80% 50%, rgba(60,90,10,0.18) 0%, transparent 70%)"
          : "radial-gradient(ellipse 60% 70% at 20% 50%, rgba(60,90,10,0.18) 0%, transparent 70%)",
      }} />

      {/* Film grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.035,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat", backgroundSize: "256px 256px",
      }} />

      {/* Full-bleed image column */}
      {hasImage && (
        <div style={{
          position: "absolute",
          left:  imgOnLeft ? 0 : "50%",
          right: imgOnLeft ? "50%" : 0,
          top: 0, bottom: 0,
          overflow: "hidden", zIndex: 1,
        }}>
          <motion.img
            src={imageUrl}
            alt=""
            animate={{ scale: [1.06, 1.10, 1.07, 1.06], x: [0, 8, -6, 0], y: [0, -10, 7, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: imgOnLeft
              ? `linear-gradient(to right, transparent 52%, ${bgHex} 100%)`
              : `linear-gradient(to left,  transparent 52%, ${bgHex} 100%)`,
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to bottom, ${bgHex} 0%, transparent 10%, transparent 90%, ${bgHex} 100%)`,
          }} />
        </div>
      )}

      {/* Content grid */}
      <div
        className="dcc-grid"
        style={{
          position: "relative", zIndex: 2,
          maxWidth: 1200, margin: "0 auto",
          padding: "8rem 2.5rem", width: "100%",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 1fr" : "1fr",
          alignItems: "center",
          gap: "5rem",
        }}
      >
        {hasImage && imgOnLeft && <div />}

        <motion.div
          initial={{ opacity: 0, x: hasImage ? (imgOnLeft ? 32 : -32) : 0, y: hasImage ? 0 : 20 }}
          animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem" }}
          >
            <span style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: AW, boxShadow: `0 0 0 3px ${dark ? "rgba(199,231,56,0.18)" : "rgba(0,58,48,0.12)"}`,
              flexShrink: 0,
            }} />
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: AW, margin: 0 }}>
              {eyebrow}
            </p>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
              fontWeight: 800, color: pfg,
              letterSpacing: "-0.045em", lineHeight: 0.95,
              marginBottom: "1.5rem", whiteSpace: "pre-line",
            }}
          >
            {headline}
          </motion.h2>

          {/* Body */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ fontSize: "1.0625rem", lineHeight: 1.68, color: muted, maxWidth: 420, marginBottom: "2rem" }}
          >
            {body}
          </motion.p>

          {/* ── Success state ── */}
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: "flex", flexDirection: "column", gap: "0.625rem",
                maxWidth: 480,
                background: dark ? "rgba(199,231,56,0.07)" : "rgba(0,58,48,0.06)",
                border: `1px solid ${dark ? "rgba(199,231,56,0.22)" : "rgba(0,58,48,0.20)"}`,
                borderRadius: "1rem",
                padding: "1.25rem 1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <CheckCircle2 style={{ width: 18, height: 18, color: AW, flexShrink: 0 }} />
                <span style={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: "1rem", color: pfg }}>{successHeadline}</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: muted, margin: 0, lineHeight: 1.6 }}>{successBody}</p>
              {chilipiperUrl && (
                <button
                  type="button"
                  onClick={() => { setCpUrl(buildChiliPiperUrl(chilipiperUrl, email.trim(), firstName.trim(), lastName.trim(), company.trim())); setCpOpen(true); }}
                  style={{
                    alignSelf: "flex-start", marginTop: "0.25rem",
                    background: AW, color: "#003A30", border: "none", borderRadius: 999,
                    padding: "9px 20px", fontWeight: 700, fontSize: "0.8125rem",
                    cursor: "pointer", fontFamily: DISPLAY_FONT,
                    display: "flex", alignItems: "center", gap: "0.4rem",
                  }}
                >
                  <Calendar style={{ width: 13, height: 13 }} />
                  Open scheduler
                </button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 ? (
                /* ── STEP 1: Email ── */
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ maxWidth: 480 }}
                >
                  {stepDots}

                  {inputLabel && (
                    <p style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: dark ? "rgba(199,231,56,0.6)" : "rgba(0,58,48,0.55)", marginBottom: "0.65rem" }}>
                      {inputLabel}
                    </p>
                  )}

                  <form
                    onSubmit={handleStep1}
                    noValidate
                    style={{
                      display: "flex", alignItems: "center",
                      background: inputBgColor,
                      border: `1px solid ${focused1 ? borderFocused : emailError ? "rgba(239,68,68,0.5)" : borderDefault}`,
                      borderRadius: 999,
                      padding: "5px 5px 5px 22px",
                      gap: 8,
                      backdropFilter: "blur(12px)",
                      boxShadow: focused1 ? `0 0 0 3px ${dark ? "rgba(199,231,56,0.08)" : "rgba(0,58,48,0.06)"}` : "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                      placeholder={inputPlaceholder}
                      onFocus={() => setFocused1(true)}
                      onBlur={() => setFocused1(false)}
                      style={{
                        flex: 1, minWidth: 0,
                        background: "none", border: "none", outline: "none",
                        color: pfg, fontSize: "0.9375rem", fontFamily: "inherit",
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: AW, color: "#003A30", border: "none", borderRadius: 999,
                        padding: "13px 22px", fontWeight: 800, fontSize: "0.875rem",
                        cursor: "pointer", whiteSpace: "nowrap",
                        fontFamily: DISPLAY_FONT, letterSpacing: "-0.01em",
                        flexShrink: 0, display: "flex", alignItems: "center", gap: "0.4rem",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                    >
                      Continue
                      <ArrowRight style={{ width: 14, height: 14 }} />
                    </button>
                  </form>

                  {emailError && (
                    <p style={{ fontSize: "0.75rem", color: "rgba(239,68,68,0.85)", marginTop: "0.5rem", marginLeft: "1rem" }}>
                      {emailError}
                    </p>
                  )}
                </motion.div>
              ) : (
                /* ── STEP 2: Details ── */
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ maxWidth: 480 }}
                >
                  {stepDots}

                  {/* Back + email display */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={{
                        background: "none", border: `1px solid ${borderDefault}`,
                        borderRadius: 999, padding: "4px 12px",
                        color: muted, fontSize: "0.75rem", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
                      }}
                    >
                      <ChevronLeft style={{ width: 12, height: 12 }} />
                      Back
                    </button>
                    <span style={{ fontSize: "0.8125rem", color: muted }}>{email}</span>
                  </div>

                  <form
                    onSubmit={handleStep2}
                    noValidate
                    style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                  >
                    {/* First name | Last name */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div>
                        <input
                          type="text"
                          value={firstName}
                          onChange={e => { setFirstName(e.target.value); if (firstNameError) setFirstNameError(""); }}
                          placeholder="First name *"
                          required
                          onFocus={() => setFocusedField("firstName")}
                          onBlur={() => setFocusedField(null)}
                          disabled={isLoading}
                          style={fieldStyle("firstName", Boolean(firstNameError))}
                        />
                        {firstNameError && (
                          <p style={{ fontSize: "0.7rem", color: "rgba(239,68,68,0.85)", marginTop: "0.25rem", marginLeft: "0.25rem" }}>
                            {firstNameError}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={lastName}
                          onChange={e => { setLastName(e.target.value); if (lastNameError) setLastNameError(""); }}
                          placeholder="Last name *"
                          required
                          onFocus={() => setFocusedField("lastName")}
                          onBlur={() => setFocusedField(null)}
                          disabled={isLoading}
                          style={fieldStyle("lastName", Boolean(lastNameError))}
                        />
                        {lastNameError && (
                          <p style={{ fontSize: "0.7rem", color: "rgba(239,68,68,0.85)", marginTop: "0.25rem", marginLeft: "0.25rem" }}>
                            {lastNameError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Company name — hidden when already personalized */}
                    {!hasCompanyPrefill && (
                      <input
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        placeholder="DSO / Practice group name"
                        onFocus={() => setFocusedField("company")}
                        onBlur={() => setFocusedField(null)}
                        disabled={isLoading}
                        style={fieldStyle("company")}
                      />
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        background: AW, color: "#003A30", border: "none", borderRadius: 999,
                        padding: "15px 32px", fontWeight: 800, fontSize: "0.9375rem",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        fontFamily: DISPLAY_FONT, letterSpacing: "-0.02em",
                        opacity: isLoading ? 0.75 : 1, transition: "opacity 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                        marginTop: "0.25rem",
                      }}
                      onMouseEnter={e => !isLoading && (e.currentTarget.style.opacity = "0.88")}
                      onMouseLeave={e => !isLoading && (e.currentTarget.style.opacity = "1")}
                    >
                      {isLoading && <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />}
                      {ctaLabel}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Trust strip */}
          {trusts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.45 }}
              style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem 2rem", marginTop: "1.75rem", alignItems: "center" }}
            >
              {trusts.map((t, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="6" stroke={dark ? "rgba(199,231,56,0.35)" : "rgba(0,58,48,0.25)"} strokeWidth="1" />
                    <path d="M3.5 6.5l2 2 4-4" stroke={AW} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: "0.8125rem", color: muted, fontWeight: 500 }}>{t}</span>
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>

        {hasImage && !imgOnLeft && <div />}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dcc-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Chili Piper Modal ── */}
      {cpOpen && createPortal(
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) setCpOpen(false); }}
        >
          <div
            style={{
              position: "relative", width: "100%",
              maxWidth: 880, height: "min(90vh, 720px)",
              background: "#fff", borderRadius: "1.25rem",
              overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              display: "flex", flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.875rem 1.25rem", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 16, height: 16, color: "#003A30" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#003A30", fontFamily: "'Inter',system-ui,sans-serif" }}>
                  Schedule a Meeting
                </span>
              </div>
              <button
                onClick={() => setCpOpen(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "0.25rem", borderRadius: "0.375rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#6b7280", transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <iframe
              src={cpUrl}
              style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }}
              allow="camera; microphone; clipboard-write"
              title="Schedule a Meeting"
            />
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
