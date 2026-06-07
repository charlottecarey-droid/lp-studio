import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  MapPin,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Loader2,
  Check,
} from "lucide-react";
import type {
  EventLuminousBlockProps,
  EventFormField,
  EventNavLink,
} from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import { useBrandConfig } from "@/components/BrandSwatches";

interface Props {
  props: EventLuminousBlockProps;
}

// ── color helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex: string | undefined | null): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const m = hex.replace("#", "").trim();
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── countdown helper ────────────────────────────────────────────────────────
function useCountdown(targetIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return useMemo(() => {
    if (!targetIso) return null;
    const target = new Date(targetIso).getTime();
    if (Number.isNaN(target)) return null;
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return [
      { label: "Days", value: pad(days) },
      { label: "Hours", value: pad(hours) },
      { label: "Mins", value: pad(mins) },
      { label: "Secs", value: pad(secs) },
    ];
  }, [targetIso, now]);
}

export function BlockEventLuminous({ props }: Props) {
  const brand = useBrandConfig();

  // ── Style tokens: prop ?? brand ?? hardcoded editorial default ─────────────
  const bg = props.bgColor ?? brand?.pageBackground ?? "#fafbfc";
  const ink = props.inkColor ?? brand?.textColor ?? "#0f172a";
  const muted = props.mutedColor ?? "#64748b";
  const accent = props.accentColor ?? brand?.primaryColor ?? "#4f46e5";
  const accentInk = props.accentInkColor ?? "#ffffff";
  const dark = props.darkColor ?? "#0f172a";
  const card = props.cardBgColor ?? "#ffffff";
  const border = props.borderColor ?? brand?.borderColor ?? "#e2e8f0";
  const headline = props.headlineColor ?? ink;
  const headlineOnDark = props.headlineOnDarkColor ?? "#ffffff";

  const displayFont = props.displayFontFamily
    ? `'${props.displayFontFamily}', sans-serif`
    : brand?.displayFont
      ? `'${brand.displayFont}', sans-serif`
      : "'Plus Jakarta Sans', system-ui, sans-serif";
  const bodyFont = props.bodyFontFamily
    ? `'${props.bodyFontFamily}', sans-serif`
    : brand?.bodyFont
      ? `'${brand.bodyFont}', sans-serif`
      : "'Plus Jakarta Sans', system-ui, sans-serif";

  // Spacing & sizing tokens
  const sectionPad = resolveSectionSpacingPx(props.sectionSpacing);
  const contentMax = resolveContentMaxWidthPx(props.contentWidth);
  const radius = resolveRadiusPx(props.cornerRadius);
  const headingScale = resolveHeadingScale(props.headingScale);

  // Section visibility — default ON.
  const showNav = props.showNav !== false;
  const showHero = props.showHero !== false;
  const showCountdown = props.showCountdown !== false;
  const showAbout = props.showAbout !== false;
  const showAgenda = props.showAgenda !== false;
  const showSpeakers = props.showSpeakers !== false;
  const showVenue = props.showVenue !== false;
  const showGallery = props.showGallery !== false;
  const showSponsors = props.showSponsors !== false;
  const showTickets = props.showTickets !== false;
  const showFaq = props.showFaq !== false;
  const showForm = props.showForm !== false;
  const showFooter = props.showFooter !== false;

  const brandName = props.brandName?.trim() || "The Summit";
  const eventName = props.eventName?.trim() || "Design the future of work.";

  const ctaPrimaryLabel = props.heroCtaLabel ?? "Secure Your Spot";
  const ctaPrimaryUrl = props.heroCtaUrl ?? "#rsvp";

  // ── Nav scroll state ───────────────────────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks: EventNavLink[] =
    props.navLinks ?? [
      { label: "About", href: "#about" },
      { label: "Agenda", href: "#agenda" },
      { label: "Speakers", href: "#speakers" },
    ];
  const navCtaLabel = props.navCtaLabel ?? "Register Now";
  const navCtaUrl = props.navCtaUrl ?? "#rsvp";

  // ── Agenda day state ───────────────────────────────────────────────────────
  const agendaDays = props.agendaDays ?? [];
  const [activeDay, setActiveDay] = useState(0);
  const activeAgenda = agendaDays[activeDay] ?? agendaDays[0];

  // ── FAQ accordion state ────────────────────────────────────────────────────
  const faqItems = props.faqItems ?? [];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // ── Countdown ──────────────────────────────────────────────────────────────
  const countdown = useCountdown(props.countdownTargetDate);
  const fallbackCountdown = [
    { label: "Days", value: "14" },
    { label: "Hours", value: "08" },
    { label: "Mins", value: "45" },
    { label: "Secs", value: "22" },
  ];
  const countdownUnits = countdown ?? fallbackCountdown;

  // ── Form state ─────────────────────────────────────────────────────────────
  const formFields: EventFormField[] =
    props.formFields ?? [
      { id: "firstName", label: "First Name", type: "text", placeholder: "Jane", required: true },
      { id: "lastName", label: "Last Name", type: "text", placeholder: "Doe", required: true },
      { id: "email", label: "Work Email", type: "email", placeholder: "jane@company.com", required: true },
      { id: "company", label: "Company", type: "text", placeholder: "Acme Inc." },
    ];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFieldChange = useCallback((id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setFormError(null);
      try {
        const fields: Record<string, unknown> = {
          ...formData,
          _eventName: eventName,
          _submittedAt: new Date().toISOString(),
        };
        const res = await fetch(props.formSubmitUrl ?? "/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        if (!res.ok) {
          let detail = "";
          try {
            detail = (await res.json())?.error ?? "";
          } catch {
            /* ignore */
          }
          throw new Error(detail || `Submission failed (${res.status})`);
        }
        setSubmitted(true);
      } catch (err) {
        setFormError(
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, formData, eventName, props.formSubmitUrl],
  );

  // ── shared style fragments ──────────────────────────────────────────────────
  const container: React.CSSProperties = {
    width: "100%",
    maxWidth: contentMax,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
  };
  const sectionStyle = (sbg: string): React.CSSProperties => ({
    paddingTop: sectionPad,
    paddingBottom: sectionPad,
    background: sbg,
  });
  const h2Size = `clamp(2rem, ${3.4 * headingScale}vw, ${3 * headingScale}rem)`;
  const heroSize = `clamp(2.75rem, ${6 * headingScale}vw, ${4.5 * headingScale}rem)`;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: Math.min(radius, 14),
    background: rgba(ink, 0.04),
    border: `1px solid transparent`,
    color: ink,
    fontFamily: bodyFont,
    fontSize: "0.95rem",
    outline: "none",
    transition: "box-shadow 0.2s, border-color 0.2s",
  };

  const eyebrowStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: accent,
  };

  const renderField = (field: EventFormField) => {
    const val = formData[field.id] ?? "";
    const label = (
      <label
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: muted,
        }}
      >
        {field.label}
        {field.required ? <span style={{ color: accent }}> *</span> : null}
      </label>
    );
    if (field.type === "textarea") {
      return (
        <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {label}
          <textarea
            value={val}
            required={field.required}
            placeholder={field.placeholder}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      );
    }
    if (field.type === "select") {
      return (
        <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {label}
          <select
            value={val}
            required={field.required}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            style={{ ...inputStyle, appearance: "none" }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="">{field.placeholder ?? "Select…"}</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {label}
        <input
          type={field.type}
          value={val}
          required={field.required}
          placeholder={field.placeholder}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    );
  };

  const Logo = ({ onDark }: { onDark?: boolean }) =>
    props.logoUrl ? (
      <img
        src={props.logoUrl}
        alt={props.logoAlt || brandName}
        style={{ height: "1.75rem", width: "auto" }}
      />
    ) : (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "999px",
            background: onDark ? rgba("#ffffff", 0.12) : accent,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: "0.55rem",
              height: "0.55rem",
              borderRadius: "999px",
              background: "#ffffff",
            }}
          />
        </span>
        <span
          style={{
            fontWeight: 800,
            fontSize: "1.2rem",
            letterSpacing: "-0.02em",
            color: onDark ? "#ffffff" : ink,
          }}
        >
          {brandName}
        </span>
      </span>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: ink,
        fontFamily: bodyFont,
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
          .bel-hide-scrollbar::-webkit-scrollbar{display:none;}
          .bel-hide-scrollbar{scrollbar-width:none;}`,
        }}
      />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      {showNav && (
        <nav
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            transition: "all 0.4s ease",
            padding: scrolled ? "0.85rem 0" : "1.25rem 0",
            background: scrolled ? rgba(bg, 0.85) : "transparent",
            backdropFilter: scrolled ? "blur(12px)" : "none",
            WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
            boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,0.04)" : "none",
          }}
        >
          <div
            style={{
              ...container,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <a href="#top" style={{ textDecoration: "none" }}>
              <Logo />
            </a>

            <div className="hidden md:flex" style={{ alignItems: "center", gap: "2rem" }}>
              {navLinks.map((link) => (
                <a
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: muted,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = muted)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href={navCtaUrl}
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: dark,
                  color: "#ffffff",
                  padding: "0.65rem 1.25rem",
                  borderRadius: "999px",
                  textDecoration: "none",
                  transition: "background 0.3s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = accent)}
                onMouseLeave={(e) => (e.currentTarget.style.background = dark)}
              >
                {navCtaLabel}
              </a>
            </div>

            <button
              type="button"
              className="md:hidden"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((v) => !v)}
              style={{ background: "none", border: "none", color: ink, cursor: "pointer" }}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {mobileOpen && (
            <div
              className="md:hidden"
              style={{
                background: card,
                borderBottom: `1px solid ${border}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {navLinks.map((link) => (
                <a
                  key={`m-${link.label}-${link.href}`}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  style={{ fontSize: "1.1rem", fontWeight: 500, color: ink, textDecoration: "none" }}
                >
                  {link.label}
                </a>
              ))}
              <a
                href={navCtaUrl}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  background: accent,
                  color: accentInk,
                  textAlign: "center",
                  padding: "0.85rem",
                  borderRadius: Math.min(radius, 14),
                  textDecoration: "none",
                  marginTop: "0.5rem",
                }}
              >
                {navCtaLabel}
              </a>
            </div>
          )}
        </nav>
      )}

      <main id="top">
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        {showHero && (
          <section
            style={{
              position: "relative",
              paddingTop: sectionPad + 96,
              paddingBottom: sectionPad,
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "75%",
                height: 800,
                background: rgba(accent, 0.08),
                borderBottomLeftRadius: 100,
                transform: "translate(25%, -25%)",
                filter: "blur(80px)",
                zIndex: 0,
              }}
            />
            <div style={{ ...container, position: "relative", zIndex: 1 }}>
              <div
                style={{ display: "grid", gap: "3rem", alignItems: "center" }}
                className="lg:grid-cols-2"
              >
                <div style={{ maxWidth: "40rem" }}>
                  {(props.heroEyebrow || props.eventDate || props.eventLocation) && (
                    <div
                      style={{
                        ...eyebrowStyle,
                        padding: "0.4rem 0.8rem",
                        borderRadius: "999px",
                        background: rgba(accent, 0.1),
                        border: `1px solid ${rgba(accent, 0.2)}`,
                        marginBottom: "2rem",
                      }}
                    >
                      <span
                        style={{
                          width: "0.4rem",
                          height: "0.4rem",
                          borderRadius: "999px",
                          background: accent,
                        }}
                      />
                      {props.heroEyebrow ||
                        [props.eventDate, props.eventLocation].filter(Boolean).join(" • ")}
                    </div>
                  )}
                  <h1
                    style={{
                      fontFamily: displayFont,
                      fontSize: heroSize,
                      fontWeight: 800,
                      lineHeight: 1.05,
                      letterSpacing: "-0.02em",
                      color: headline,
                      marginBottom: "1.5rem",
                    }}
                  >
                    {eventName}
                  </h1>
                  {props.heroTagline && (
                    <p
                      style={{
                        fontSize: "1.2rem",
                        color: muted,
                        lineHeight: 1.7,
                        fontWeight: 300,
                        maxWidth: "32rem",
                        marginBottom: "2.5rem",
                      }}
                    >
                      {props.heroTagline}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                    <a
                      href={ctaPrimaryUrl}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        background: accent,
                        color: accentInk,
                        padding: "1rem 2rem",
                        borderRadius: "999px",
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: `0 10px 40px -10px ${rgba(accent, 0.5)}`,
                      }}
                    >
                      {ctaPrimaryLabel}
                      <ArrowRight size={18} />
                    </a>
                    {props.heroSecondaryCtaLabel && (
                      <a
                        href={props.heroSecondaryCtaUrl ?? "#agenda"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "1rem 2rem",
                          borderRadius: "999px",
                          fontWeight: 600,
                          color: ink,
                          background: card,
                          border: `1px solid ${border}`,
                          textDecoration: "none",
                        }}
                      >
                        {props.heroSecondaryCtaLabel}
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  {props.heroImageUrl ? (
                    <img
                      src={props.heroImageUrl}
                      alt={eventName}
                      style={{
                        width: "100%",
                        height: "auto",
                        aspectRatio: "4 / 3",
                        objectFit: "cover",
                        borderRadius: Math.max(radius, 24),
                        boxShadow: "0 25px 60px -15px rgba(0,0,0,0.25)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        borderRadius: Math.max(radius, 24),
                        background: `linear-gradient(135deg, ${rgba(accent, 0.18)}, ${rgba(accent, 0.04)})`,
                        boxShadow: "0 25px 60px -15px rgba(0,0,0,0.15)",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── COUNTDOWN ─────────────────────────────────────────────────── */}
        {showCountdown && (
          <section
            style={{
              padding: "3rem 0",
              borderTop: `1px solid ${border}`,
              borderBottom: `1px solid ${border}`,
              background: card,
            }}
          >
            <div
              style={{
                ...container,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "2rem",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: headline,
                    marginBottom: "0.25rem",
                    fontFamily: displayFont,
                  }}
                >
                  {props.countdownHeading ?? "Registration Closes Soon"}
                </h3>
                {props.eventDate && (
                  <p style={{ color: muted, fontSize: "0.9rem" }}>{props.eventDate}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: "2rem" }}>
                {countdownUnits.map((unit) => (
                  <div
                    key={unit.label}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(1.75rem, 4vw, 3rem)",
                        fontWeight: 700,
                        color: accent,
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {unit.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: muted,
                      }}
                    >
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── ABOUT / OVERVIEW ──────────────────────────────────────────── */}
        {showAbout && (
          <section id="about" style={sectionStyle(bg)}>
            <div style={container}>
              <div style={{ maxWidth: "48rem", margin: "0 auto", textAlign: "center", marginBottom: "4rem" }}>
                {props.aboutEyebrow && (
                  <div style={{ ...eyebrowStyle, marginBottom: "1rem" }}>{props.aboutEyebrow}</div>
                )}
                <h2
                  style={{
                    fontSize: h2Size,
                    fontWeight: 700,
                    color: headline,
                    letterSpacing: "-0.02em",
                    marginBottom: "1.5rem",
                    fontFamily: displayFont,
                  }}
                >
                  {props.aboutHeading ?? "Clarity through design."}
                </h2>
                {props.aboutBody && (
                  <p style={{ fontSize: "1.15rem", color: muted, fontWeight: 300, lineHeight: 1.75 }}>
                    {props.aboutBody}
                  </p>
                )}
              </div>

              {(props.aboutStats ?? []).length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gap: "2rem",
                    maxWidth: "56rem",
                    margin: "0 auto",
                  }}
                  className="md:grid-cols-3"
                >
                  {(props.aboutStats ?? []).map((stat, i) => (
                    <div
                      key={i}
                      style={{
                        background: card,
                        padding: "2rem",
                        borderRadius: Math.max(radius, 20),
                        textAlign: "center",
                        border: `1px solid ${border}`,
                        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "2.5rem",
                          fontWeight: 800,
                          color: accent,
                          marginBottom: "0.5rem",
                          fontFamily: displayFont,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: 600, color: headline }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── AGENDA ────────────────────────────────────────────────────── */}
        {showAgenda && agendaDays.length > 0 && (
          <section id="agenda" style={sectionStyle(card)}>
            <div style={container}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: "1.5rem",
                  marginBottom: "3.5rem",
                }}
              >
                <div>
                  {props.agendaEyebrow && (
                    <div style={{ ...eyebrowStyle, marginBottom: "0.75rem" }}>
                      {props.agendaEyebrow}
                    </div>
                  )}
                  <h2
                    style={{
                      fontSize: h2Size,
                      fontWeight: 700,
                      color: headline,
                      letterSpacing: "-0.02em",
                      fontFamily: displayFont,
                    }}
                  >
                    {props.agendaHeading ?? "Agenda"}
                  </h2>
                </div>
                {agendaDays.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      background: rgba(ink, 0.05),
                      padding: "0.25rem",
                      borderRadius: "999px",
                    }}
                  >
                    {agendaDays.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveDay(i)}
                        style={{
                          padding: "0.6rem 1.4rem",
                          borderRadius: "999px",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          transition: "all 0.2s",
                          background: activeDay === i ? card : "transparent",
                          color: activeDay === i ? headline : muted,
                          boxShadow: activeDay === i ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        }}
                      >
                        {d.dayLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ maxWidth: "52rem", margin: "0 auto" }}>
                <div style={{ borderLeft: `1px solid ${border}`, marginLeft: "0.25rem" }}>
                  {(activeAgenda?.sessions ?? []).map((s, i) => (
                    <div key={i} style={{ position: "relative", paddingLeft: "2rem", paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "-5px",
                          top: "2.25rem",
                          width: "10px",
                          height: "10px",
                          borderRadius: "999px",
                          background: accent,
                        }}
                      />
                      <div
                        style={{
                          display: "inline-block",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: accent,
                          marginBottom: "0.5rem",
                        }}
                      >
                        {s.time}
                      </div>
                      <div
                        style={{
                          background: rgba(ink, 0.02),
                          padding: "1.25rem 1.5rem",
                          borderRadius: Math.max(radius, 16),
                          border: `1px solid ${border}`,
                        }}
                      >
                        <h4 style={{ fontSize: "1.15rem", fontWeight: 600, color: headline, marginBottom: s.speaker || s.description ? "0.4rem" : 0 }}>
                          {s.title}
                        </h4>
                        {s.description && (
                          <p style={{ fontSize: "0.9rem", color: muted, marginBottom: s.speaker ? "0.4rem" : 0 }}>
                            {s.description}
                          </p>
                        )}
                        {s.speaker && (
                          <p style={{ fontSize: "0.85rem", color: muted, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ width: "0.35rem", height: "0.35rem", borderRadius: "999px", background: muted }} />
                            {s.speaker}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── SPEAKERS ──────────────────────────────────────────────────── */}
        {showSpeakers && (props.speakers ?? []).length > 0 && (
          <section id="speakers" style={sectionStyle(bg)}>
            <div style={container}>
              <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
                {props.speakersEyebrow && (
                  <div style={{ ...eyebrowStyle, marginBottom: "0.75rem" }}>
                    {props.speakersEyebrow}
                  </div>
                )}
                <h2
                  style={{
                    fontSize: h2Size,
                    fontWeight: 700,
                    color: headline,
                    letterSpacing: "-0.02em",
                    fontFamily: displayFont,
                  }}
                >
                  {props.speakersHeading ?? "Speakers"}
                </h2>
              </div>

              <div
                style={{ display: "grid", gap: "2rem", maxWidth: "64rem", margin: "0 auto" }}
                className="sm:grid-cols-2 lg:grid-cols-3"
              >
                {(props.speakers ?? []).map((sp, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: Math.max(radius, 20),
                      aspectRatio: "4 / 5",
                      background: rgba(accent, 0.08),
                    }}
                  >
                    {sp.photoUrl ? (
                      <img
                        src={sp.photoUrl}
                        alt={sp.name}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: `linear-gradient(135deg, ${rgba(accent, 0.25)}, ${rgba(dark, 0.1)})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2.5rem",
                          fontWeight: 700,
                          color: "#ffffff",
                          fontFamily: displayFont,
                        }}
                      >
                        {sp.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(to top, rgba(15,23,42,0.85), transparent 55%)",
                      }}
                    />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1.75rem" }}>
                      <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ffffff", marginBottom: "0.25rem" }}>
                        {sp.name}
                      </h3>
                      {(sp.role || sp.company) && (
                        <p style={{ fontSize: "0.85rem", color: rgba("#ffffff", 0.8), fontWeight: 500 }}>
                          {[sp.role, sp.company].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── VENUE ─────────────────────────────────────────────────────── */}
        {showVenue && (props.venueName || props.venueAddress || props.venueDescription || props.venueImageUrl) && (
          <section style={sectionStyle(card)}>
            <div style={container}>
              <div
                style={{ display: "grid", gap: "4rem", alignItems: "center" }}
                className="lg:grid-cols-2"
              >
                <div>
                  {props.venueEyebrow && (
                    <div style={{ ...eyebrowStyle, marginBottom: "1rem" }}>{props.venueEyebrow}</div>
                  )}
                  <h2
                    style={{
                      fontSize: h2Size,
                      fontWeight: 700,
                      color: headline,
                      letterSpacing: "-0.02em",
                      marginBottom: "1.5rem",
                      fontFamily: displayFont,
                    }}
                  >
                    {props.venueHeading ?? "The Space"}
                  </h2>
                  {props.venueDescription && (
                    <p style={{ fontSize: "1.1rem", color: muted, fontWeight: 300, lineHeight: 1.75, marginBottom: "2rem" }}>
                      {props.venueDescription}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {(props.venueName || props.venueAddress) && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                        <div
                          style={{
                            width: "2.5rem",
                            height: "2.5rem",
                            borderRadius: "999px",
                            background: rgba(accent, 0.1),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <MapPin size={18} style={{ color: accent }} />
                        </div>
                        <div>
                          {props.venueName && (
                            <h4 style={{ fontWeight: 600, color: headline }}>{props.venueName}</h4>
                          )}
                          {props.venueAddress && (
                            <p style={{ color: muted }}>{props.venueAddress}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {props.eventDate && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                        <div
                          style={{
                            width: "2.5rem",
                            height: "2.5rem",
                            borderRadius: "999px",
                            background: rgba(accent, 0.1),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Calendar size={18} style={{ color: accent }} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 600, color: headline }}>{props.eventDate}</h4>
                          {props.eventLocation && <p style={{ color: muted }}>{props.eventLocation}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  {props.venueImageUrl ? (
                    <img
                      src={props.venueImageUrl}
                      alt={props.venueName || "Venue"}
                      loading="lazy"
                      style={{
                        width: "100%",
                        borderRadius: Math.max(radius, 24),
                        boxShadow: "0 25px 60px -15px rgba(0,0,0,0.2)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        borderRadius: Math.max(radius, 24),
                        background: `linear-gradient(135deg, ${rgba(accent, 0.15)}, ${rgba(dark, 0.05)})`,
                        boxShadow: "0 25px 60px -15px rgba(0,0,0,0.12)",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── GALLERY ───────────────────────────────────────────────────── */}
        {showGallery && (props.galleryImages ?? []).length > 0 && (
          <section style={{ padding: "3rem 0", background: dark, overflow: "hidden" }}>
            {props.galleryHeading && (
              <div style={{ ...container, marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: headlineOnDark, fontFamily: displayFont }}>
                  {props.galleryHeading}
                </h2>
              </div>
            )}
            <div
              className="bel-hide-scrollbar"
              style={{
                display: "flex",
                gap: "1rem",
                padding: "0 1rem",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
              }}
            >
              {(props.galleryImages ?? []).map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.caption || `Gallery image ${i + 1}`}
                  loading="lazy"
                  style={{
                    height: "20rem",
                    width: "auto",
                    borderRadius: Math.max(radius, 16),
                    objectFit: "cover",
                    flexShrink: 0,
                    scrollSnapAlign: "center",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── TICKETS ───────────────────────────────────────────────────── */}
        {showTickets && (props.ticketTiers ?? []).length > 0 && (
          <section id="tickets" style={sectionStyle(bg)}>
            <div style={container}>
              <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
                {props.ticketsEyebrow && (
                  <div style={{ ...eyebrowStyle, marginBottom: "0.75rem" }}>
                    {props.ticketsEyebrow}
                  </div>
                )}
                <h2
                  style={{
                    fontSize: h2Size,
                    fontWeight: 700,
                    color: headline,
                    letterSpacing: "-0.02em",
                    fontFamily: displayFont,
                  }}
                >
                  {props.ticketsHeading ?? "Tickets"}
                </h2>
              </div>

              <div
                style={{ display: "grid", gap: "2rem", maxWidth: "64rem", margin: "0 auto" }}
                className="md:grid-cols-3"
              >
                {(props.ticketTiers ?? []).map((tier, i) => (
                  <div
                    key={i}
                    style={{
                      background: tier.featured ? dark : card,
                      color: tier.featured ? "#ffffff" : ink,
                      padding: "2.25rem",
                      borderRadius: Math.max(radius, 20),
                      border: `1px solid ${tier.featured ? "transparent" : border}`,
                      boxShadow: tier.featured
                        ? `0 25px 60px -15px ${rgba(accent, 0.4)}`
                        : "0 20px 40px -15px rgba(0,0,0,0.05)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: tier.featured ? rgba("#ffffff", 0.7) : muted, marginBottom: "0.75rem" }}>
                      {tier.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "1.25rem" }}>
                      <span style={{ fontSize: "2.5rem", fontWeight: 800, color: tier.featured ? "#ffffff" : accent, fontFamily: displayFont }}>
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span style={{ fontSize: "0.85rem", color: tier.featured ? rgba("#ffffff", 0.6) : muted }}>
                          {tier.period}
                        </span>
                      )}
                    </div>
                    {tier.description && (
                      <p style={{ fontSize: "0.9rem", color: tier.featured ? rgba("#ffffff", 0.75) : muted, marginBottom: "1.5rem" }}>
                        {tier.description}
                      </p>
                    )}
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                      {tier.features.map((f, fi) => (
                        <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.9rem", color: tier.featured ? rgba("#ffffff", 0.85) : ink }}>
                          <Check size={16} style={{ color: accent, flexShrink: 0, marginTop: "0.15rem" }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={tier.ctaUrl ?? "#rsvp"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        padding: "0.85rem 1.5rem",
                        borderRadius: "999px",
                        fontWeight: 600,
                        textDecoration: "none",
                        background: tier.featured ? accent : "transparent",
                        color: tier.featured ? accentInk : accent,
                        border: tier.featured ? "none" : `1px solid ${rgba(accent, 0.4)}`,
                      }}
                    >
                      {tier.ctaLabel ?? "Select"}
                      <ArrowRight size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── SPONSORS ──────────────────────────────────────────────────── */}
        {showSponsors && (props.sponsors ?? []).length > 0 && (
          <section style={{ ...sectionStyle(card), borderBottom: `1px solid ${border}` }}>
            <div style={{ ...container, textAlign: "center" }}>
              <p
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: muted,
                  marginBottom: "3rem",
                }}
              >
                {props.sponsorsHeading ?? "Supported by industry leaders"}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "3rem",
                }}
              >
                {(props.sponsors ?? []).map((s, i) =>
                  s.logoUrl ? (
                    <img
                      key={i}
                      src={s.logoUrl}
                      alt={s.name}
                      loading="lazy"
                      style={{ height: "2rem", width: "auto", objectFit: "contain", opacity: 0.7 }}
                    />
                  ) : (
                    <div
                      key={i}
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        letterSpacing: "-0.04em",
                        color: ink,
                        opacity: 0.5,
                      }}
                    >
                      {s.name}
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {showFaq && faqItems.length > 0 && (
          <section style={sectionStyle(bg)}>
            <div style={{ ...container, maxWidth: "48rem" }}>
              <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
                <h2
                  style={{
                    fontSize: h2Size,
                    fontWeight: 700,
                    color: headline,
                    letterSpacing: "-0.02em",
                    fontFamily: displayFont,
                  }}
                >
                  {props.faqHeading ?? "Questions?"}
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {faqItems.map((faq, i) => (
                  <div
                    key={i}
                    style={{
                      background: card,
                      borderRadius: Math.max(radius, 16),
                      border: `1px solid ${border}`,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      style={{
                        width: "100%",
                        padding: "1.5rem",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: headline,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{faq.question}</span>
                      <ChevronDown
                        size={20}
                        style={{
                          color: muted,
                          flexShrink: 0,
                          transition: "transform 0.2s",
                          transform: openFaq === i ? "rotate(180deg)" : "none",
                        }}
                      />
                    </button>
                    {openFaq === i && (
                      <div
                        style={{
                          padding: "0 1.5rem 1.5rem",
                          color: muted,
                          fontWeight: 300,
                          fontSize: "0.95rem",
                          lineHeight: 1.7,
                        }}
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── RSVP / FORM ───────────────────────────────────────────────── */}
        {showForm && (
          <section id="rsvp" style={{ ...sectionStyle(card), position: "relative", overflow: "hidden" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 800,
                height: 800,
                background: rgba(accent, 0.08),
                borderRadius: "999px",
                filter: "blur(100px)",
                zIndex: 0,
              }}
            />
            <div style={{ ...container, position: "relative", zIndex: 1 }}>
              <div
                style={{
                  maxWidth: "36rem",
                  margin: "0 auto",
                  background: card,
                  borderRadius: Math.max(radius, 24),
                  padding: "2.5rem",
                  boxShadow: "0 20px 60px -15px rgba(0,0,0,0.1)",
                  border: `1px solid ${border}`,
                }}
              >
                <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                  {props.formEyebrow && (
                    <div style={{ ...eyebrowStyle, justifyContent: "center", marginBottom: "0.75rem" }}>
                      {props.formEyebrow}
                    </div>
                  )}
                  <h2
                    style={{
                      fontSize: "clamp(1.6rem, 4vw, 2rem)",
                      fontWeight: 700,
                      color: headline,
                      letterSpacing: "-0.02em",
                      marginBottom: "0.75rem",
                      fontFamily: displayFont,
                    }}
                  >
                    {props.formHeading ?? "Reserve Your Pass"}
                  </h2>
                  {props.formSubheading && (
                    <p style={{ color: muted, fontWeight: 300, fontSize: "0.95rem" }}>
                      {props.formSubheading}
                    </p>
                  )}
                </div>

                {submitted ? (
                  <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <div
                      style={{
                        width: "3.5rem",
                        height: "3.5rem",
                        borderRadius: "999px",
                        background: rgba(accent, 0.12),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.25rem",
                      }}
                    >
                      <CheckCircle2 size={28} style={{ color: accent }} />
                    </div>
                    <p style={{ fontSize: "1.05rem", fontWeight: 500, color: headline }}>
                      {props.formSuccessMessage ?? "Thanks! Your registration is confirmed."}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {formFields.map(renderField)}
                    {formError && (
                      <p style={{ color: "#dc2626", fontSize: "0.85rem" }}>{formError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "1rem",
                        borderRadius: Math.min(radius, 14),
                        border: "none",
                        background: dark,
                        color: "#ffffff",
                        fontWeight: 600,
                        fontSize: "1rem",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        transition: "background 0.3s",
                      }}
                      onMouseEnter={(e) => {
                        if (!submitting) e.currentTarget.style.background = accent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = dark;
                      }}
                    >
                      {submitting && <Loader2 size={16} className="animate-spin" />}
                      {props.formSubmitLabel ?? "Complete Registration"}
                    </button>
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: "0.75rem",
                        color: muted,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <CheckCircle2 size={14} style={{ color: "#10b981" }} /> Secure SSL submission
                    </p>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      {showFooter && (
        <footer
          style={{
            background: dark,
            color: rgba("#ffffff", 0.6),
            padding: "4rem 0",
            borderTop: `1px solid ${rgba("#ffffff", 0.08)}`,
          }}
        >
          <div style={container}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1.5rem",
              }}
            >
              <Logo onDark />
              {(props.footerLinks ?? []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", fontSize: "0.9rem" }}>
                  {(props.footerLinks ?? []).map((link) => (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      style={{ color: rgba("#ffffff", 0.6), textDecoration: "none" }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {props.footerTagline && (
              <p style={{ marginTop: "2rem", fontSize: "0.9rem", color: rgba("#ffffff", 0.5), maxWidth: "32rem" }}>
                {props.footerTagline}
              </p>
            )}
            <div style={{ marginTop: "3rem", textAlign: "center", fontSize: "0.75rem", color: rgba("#ffffff", 0.4) }}>
              {props.footerNote ?? `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default BlockEventLuminous;
