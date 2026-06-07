import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Zap,
  CheckCircle2,
  Building2,
  Ticket,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";
import type { EventSplitBlockProps } from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import type { BrandConfig } from "../lib/brand-config";

// ── small utilities ─────────────────────────────────────────────────────────

function firstNonEmpty(...vals: Array<string | undefined | null>): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

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

const MONO = "'Space Mono', 'IBM Plex Mono', monospace";

function useEventFonts(displayFamily: string, bodyFamily: string) {
  useEffect(() => {
    const families = new Set<string>([
      "Space+Grotesk:wght@500;700",
      "Inter:wght@300;400;500;600",
      "Space+Mono:wght@400;700",
    ]);
    if (displayFamily) families.add(`${displayFamily.replace(/\s+/g, "+")}:wght@400;500;600;700`);
    if (bodyFamily) families.add(`${bodyFamily.replace(/\s+/g, "+")}:wght@300;400;500;600`);
    const href = `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap`;
    const id = `bes-fonts-${href}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [displayFamily, bodyFamily]);
}

interface Props {
  props: EventSplitBlockProps;
  brand?: BrandConfig;
}

export function BlockEventSplit({ props: p, brand }: Props) {
  // ── theme tokens: prop ?? brand ?? hardcoded editorial default ─────────────
  const bg = p.bgColor ?? firstNonEmpty(brand?.pageBackground) ?? "#0A0A0A";
  const dark = p.darkColor ?? "#000000";
  const ink = p.inkColor ?? firstNonEmpty(brand?.textColor) ?? "#FFFFFF";
  const muted = p.mutedColor ?? "#A0A0A0";
  const accent = p.accentColor ?? firstNonEmpty(brand?.accentColor) ?? "#CCFF00";
  const accentInk = p.accentInkColor ?? firstNonEmpty(brand?.ctaText) ?? "#000000";
  const cardBg = p.cardBgColor ?? firstNonEmpty(brand?.cardBackground) ?? "#121212";
  const border = p.borderColor ?? firstNonEmpty(brand?.borderColor) ?? "#2A2A2A";
  const headline = p.headlineColor ?? firstNonEmpty(brand?.headingOnDarkColor) ?? ink;

  const displayFamily = firstNonEmpty(p.displayFontFamily, brand?.displayFont) ?? "Space Grotesk";
  const bodyFamily = firstNonEmpty(p.bodyFontFamily, brand?.bodyFont) ?? "Inter";
  useEventFonts(displayFamily, bodyFamily);
  const displayFont = `'${displayFamily}', sans-serif`;
  const bodyFont = `'${bodyFamily}', sans-serif`;

  // ── spacing / sizing tokens ────────────────────────────────────────────────
  const sectionPad = resolveSectionSpacingPx(p.sectionSpacing);
  const maxW = resolveContentMaxWidthPx(p.contentWidth);
  const radius = resolveRadiusPx(p.cornerRadius);
  const hScale = resolveHeadingScale(p.headingScale);

  // ── section gating (absent => visible) ─────────────────────────────────────
  const showNav = p.showNav !== false;
  const showHero = p.showHero !== false;
  const showCountdown = p.showCountdown !== false;
  const showAbout = p.showAbout !== false;
  const showAgenda = p.showAgenda !== false;
  const showSpeakers = p.showSpeakers !== false;
  const showVenue = p.showVenue !== false;
  const showGallery = p.showGallery !== false;
  const showSponsors = p.showSponsors !== false;
  const showTickets = p.showTickets !== false;
  const showFaq = p.showFaq !== false;
  const showForm = p.showForm !== false;
  const showFooter = p.showFooter !== false;

  // ── content with neutral fallbacks ─────────────────────────────────────────
  const brandName = firstNonEmpty(p.brandName, brand?.brandName) ?? "Summit";
  const eventName = firstNonEmpty(p.eventName) ?? brandName;

  const navLinks = p.navLinks ?? [
    { label: "About", href: "#about" },
    { label: "Agenda", href: "#agenda" },
    { label: "Speakers", href: "#speakers" },
    { label: "Tickets", href: "#tickets" },
  ];
  const navCtaLabel = firstNonEmpty(p.navCtaLabel) ?? "Register Now";
  const navCtaUrl = firstNonEmpty(p.navCtaUrl) ?? "#register";

  // shared style helpers
  const sectionStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    paddingTop: sectionPad,
    paddingBottom: sectionPad,
    borderBottom: `1px solid ${border}`,
    ...extra,
  });
  const containerStyle: React.CSSProperties = {
    maxWidth: maxW,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
    width: "100%",
  };
  const h2Style = (color = headline): React.CSSProperties => ({
    fontFamily: displayFont,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.02,
    fontSize: `clamp(${2.1 * hScale}rem, 5vw, ${3.6 * hScale}rem)`,
    color,
    margin: 0,
  });

  // ── reusable bits ──────────────────────────────────────────────────────────
  const Eyebrow = ({ label }: { label?: string }) =>
    label ? (
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ width: "3rem", height: 1, backgroundColor: accent }} />
        <span
          style={{
            color: accent,
            fontFamily: MONO,
            fontSize: "0.8rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
    ) : null;

  const SectionHeader = ({ eyebrow, title }: { eyebrow?: string; title?: string }) => (
    <div style={{ marginBottom: "clamp(2.5rem, 6vw, 5rem)" }}>
      <Eyebrow label={eyebrow} />
      {title && <h2 style={h2Style()}>{title}</h2>}
    </div>
  );

  const accentBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.9rem 1.75rem",
    backgroundColor: accent,
    color: accentInk,
    fontFamily: MONO,
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    textDecoration: "none",
    border: "none",
    borderRadius: radius,
    cursor: "pointer",
    transition: "opacity 0.25s ease",
    ...extra,
  });

  const outlineBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "0.9rem 1.75rem",
    backgroundColor: "transparent",
    color: ink,
    fontFamily: MONO,
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    textDecoration: "none",
    border: `1px solid ${border}`,
    borderRadius: radius,
    cursor: "pointer",
    ...extra,
  });

  const imgPlaceholder: React.CSSProperties = {
    background: `linear-gradient(135deg, ${rgba(accent, 0.18)} 0%, ${cardBg} 55%, ${dark} 100%)`,
  };

  // ── hero ───────────────────────────────────────────────────────────────────
  const heroEyebrow = firstNonEmpty(p.heroEyebrow) ?? "Registration Now Open";
  const heroTagline = firstNonEmpty(p.heroTagline);
  const eventDate = firstNonEmpty(p.eventDate);
  const eventLocation = firstNonEmpty(p.eventLocation);
  const heroCtaLabel = firstNonEmpty(p.heroCtaLabel) ?? "Secure Your Spot";
  const heroCtaUrl = firstNonEmpty(p.heroCtaUrl) ?? "#register";
  const heroSecondaryCtaLabel = firstNonEmpty(p.heroSecondaryCtaLabel);
  const heroSecondaryCtaUrl = firstNonEmpty(p.heroSecondaryCtaUrl) ?? "#about";
  const stats = p.aboutStats ?? [];
  const ticketTiers = p.ticketTiers ?? [];
  const heroCard = ticketTiers[0];

  // ── countdown ──────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    if (!showCountdown) return;
    const targetStr = firstNonEmpty(p.countdownTargetDate);
    if (!targetStr) return;
    const target = new Date(targetStr).getTime();
    if (Number.isNaN(target)) return;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showCountdown, p.countdownTargetDate]);

  // ── agenda ───────────────────────────────────────────────────────────────
  const agendaDays = p.agendaDays ?? [];
  const [activeDay, setActiveDay] = useState(0);
  const safeActiveDay = Math.min(activeDay, Math.max(0, agendaDays.length - 1));

  // ── faq ─────────────────────────────────────────────────────────────────
  const faqItems = p.faqItems ?? [];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // ── form ───────────────────────────────────────────────────────────────
  const formFields = p.formFields ?? [
    { id: "firstName", label: "First Name", type: "text" as const, required: true },
    { id: "lastName", label: "Last Name", type: "text" as const, required: true },
    { id: "email", label: "Work Email", type: "email" as const, required: true },
    { id: "company", label: "Company", type: "text" as const, required: true },
  ];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleField = (id: string, value: string) =>
    setFormData((prev) => ({ ...prev, [id]: value }));

  const submitUrl = firstNonEmpty(p.formSubmitUrl) ?? "/api/lp/leads";
  const successMessage =
    firstNonEmpty(p.formSuccessMessage) ?? "Thanks! Check your email to confirm your spot.";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setFormError(null);
      try {
        const body = {
          fields: {
            ...formData,
            _eventName: eventName,
            _submittedAt: new Date().toISOString(),
          },
        };
        const res = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
          err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, formData, eventName, submitUrl],
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: cardBg,
    border: `1px solid ${border}`,
    padding: "0.85rem 1rem",
    color: ink,
    fontFamily: bodyFont,
    fontSize: "0.95rem",
    outline: "none",
    borderRadius: radius,
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: "0.72rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: muted,
    display: "block",
    marginBottom: "0.5rem",
  };

  // ── speakers ─────────────────────────────────────────────────────────────
  const speakers = p.speakers ?? [];
  const galleryImages = p.galleryImages ?? [];
  const sponsors = p.sponsors ?? [];

  return (
    <div
      id="top"
      style={{
        backgroundColor: bg,
        color: ink,
        fontFamily: bodyFont,
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      {/* ── NAV ── */}
      {showNav && (
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            backgroundColor: rgba(bg, 0.8),
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: `1px solid ${border}`,
          }}
        >
          <div
            style={{
              ...containerStyle,
              height: "5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <a
              href="#top"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: ink }}
            >
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={p.logoAlt || brandName} style={{ height: "1.6rem", width: "auto" }} />
              ) : (
                <>
                  <Zap size={22} style={{ color: accent }} />
                  <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.02em" }}>
                    {brandName}
                  </span>
                </>
              )}
            </a>
            <div className="hidden md:flex" style={{ alignItems: "center", gap: "2rem" }}>
              {navLinks.map((l) => (
                <a
                  key={`${l.label}-${l.href}`}
                  href={l.href}
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.72rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: muted,
                    textDecoration: "none",
                  }}
                >
                  {l.label}
                </a>
              ))}
            </div>
            <a href={navCtaUrl} style={accentBtn({ padding: "0.55rem 1.25rem" })}>
              {navCtaLabel}
            </a>
          </div>
        </nav>
      )}

      {/* ── HERO (split) ── */}
      {showHero && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            borderBottom: `1px solid ${border}`,
            backgroundColor: bg,
          }}
        >
          {/* Left: branding + info */}
          <div
            style={{
              flex: "1 1 480px",
              padding: "clamp(2rem, 6vw, 5rem)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              borderRight: `1px solid ${border}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 600,
                height: 600,
                background: rgba(accent, 0.06),
                borderRadius: "999px",
                filter: "blur(120px)",
                transform: "translate(40%,-40%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: "999px",
                  fontFamily: MONO,
                  fontSize: "0.72rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: muted,
                  marginBottom: "2rem",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    backgroundColor: accent,
                    display: "inline-block",
                  }}
                />
                {heroEyebrow}
              </div>

              <h1
                style={{
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: `clamp(${3 * hScale}rem, 9vw, ${6.5 * hScale}rem)`,
                  lineHeight: 0.92,
                  letterSpacing: "-0.03em",
                  margin: "0 0 1.5rem",
                  color: headline,
                }}
              >
                {eventName}
              </h1>

              {heroTagline && (
                <p
                  style={{
                    fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
                    color: muted,
                    maxWidth: "36rem",
                    marginBottom: "2.5rem",
                    fontWeight: 300,
                    lineHeight: 1.4,
                  }}
                >
                  {heroTagline}
                </p>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "1.5rem",
                  borderTop: `1px solid ${border}`,
                  paddingTop: "2rem",
                }}
              >
                {eventDate && (
                  <div>
                    <Calendar size={22} style={{ color: accent, marginBottom: "0.5rem" }} />
                    <div style={{ fontFamily: displayFont, fontWeight: 700, marginBottom: "0.15rem" }}>{eventDate}</div>
                    <div style={{ fontSize: "0.85rem", color: muted, fontFamily: MONO }}>Mark your calendar</div>
                  </div>
                )}
                {eventLocation && (
                  <div>
                    <MapPin size={22} style={{ color: accent, marginBottom: "0.5rem" }} />
                    <div style={{ fontFamily: displayFont, fontWeight: 700, marginBottom: "0.15rem" }}>{eventLocation}</div>
                    <div style={{ fontSize: "0.85rem", color: muted, fontFamily: MONO }}>Venue</div>
                  </div>
                )}
                {stats[0] && (
                  <div>
                    <Users size={22} style={{ color: accent, marginBottom: "0.5rem" }} />
                    <div style={{ fontFamily: displayFont, fontWeight: 700, marginBottom: "0.15rem" }}>{stats[0].value}</div>
                    <div style={{ fontSize: "0.85rem", color: muted, fontFamily: MONO }}>{stats[0].label}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "2.5rem" }}>
                <a href={heroCtaUrl} style={accentBtn()}>
                  {heroCtaLabel} <ArrowRight size={16} />
                </a>
                {heroSecondaryCtaLabel && (
                  <a href={heroSecondaryCtaUrl} style={outlineBtn()}>
                    {heroSecondaryCtaLabel}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: visual + registration card */}
          <div
            style={{
              flex: "1 1 360px",
              position: "relative",
              minHeight: 480,
              backgroundColor: cardBg,
            }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              {p.heroImageUrl ? (
                <img
                  src={p.heroImageUrl}
                  alt={eventName}
                  style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, filter: "grayscale(0.6)" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, ...imgPlaceholder }} />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to left, ${rgba(bg, 0.95)}, ${rgba(bg, 0.3)}, transparent)`,
                }}
              />
            </div>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "clamp(1.5rem, 4vw, 3rem)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "26rem",
                  backgroundColor: dark,
                  border: `1px solid ${border}`,
                  padding: "2rem",
                  borderRadius: radius,
                  boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: "0.78rem", color: accent, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {heroCard ? heroCard.name : "Registration"}
                    </div>
                    {heroCard?.price && (
                      <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "2.4rem", color: headline }}>
                        {heroCard.price}
                      </div>
                    )}
                    {heroCard?.period && (
                      <div style={{ fontSize: "0.85rem", color: muted }}>{heroCard.period}</div>
                    )}
                  </div>
                  <Ticket size={30} style={{ color: accent }} />
                </div>

                <ul style={{ listStyle: "none", margin: "0 0 1.5rem", padding: 0, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {(heroCard?.features ?? ["Full access to all sessions", "Networking events", "Recorded sessions"]).slice(0, 4).map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", fontSize: "0.9rem", color: muted }}>
                      <CheckCircle2 size={18} style={{ color: accent, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a href={heroCard?.ctaUrl ?? heroCtaUrl} style={accentBtn({ width: "100%" })}>
                  {heroCard?.ctaLabel ?? heroCtaLabel} <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {showCountdown && (
        <div style={{ borderBottom: `1px solid ${border}`, backgroundColor: cardBg, padding: "1.25rem 0" }}>
          <div
            style={{
              ...containerStyle,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontFamily: MONO, fontSize: "0.85rem", color: muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "999px", backgroundColor: accent, display: "inline-block" }} />
              {firstNonEmpty(p.countdownHeading) ?? "Registration closing soon"}
            </div>
            {timeLeft && (
              <div style={{ display: "flex", gap: "1.5rem", fontFamily: MONO }}>
                {[
                  { label: "Days", value: timeLeft.d },
                  { label: "Hrs", value: timeLeft.h },
                  { label: "Min", value: timeLeft.m },
                  { label: "Sec", value: timeLeft.s },
                ].map((u) => (
                  <div key={u.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: ink, fontFamily: displayFont }}>
                      {u.value.toString().padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{u.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABOUT / VALUE PROPS ── */}
      {showAbout && (
        <section id="about" style={sectionStyle({ backgroundColor: bg })}>
          <div style={containerStyle}>
            <SectionHeader eyebrow={firstNonEmpty(p.aboutEyebrow) ?? "Why Attend"} title={firstNonEmpty(p.aboutHeading) ?? "Beyond the surface."} />
            {p.aboutBody && (
              <p style={{ color: muted, fontSize: "1.15rem", lineHeight: 1.6, maxWidth: "44rem", marginBottom: "3rem", fontWeight: 300 }}>
                {p.aboutBody}
              </p>
            )}
            {stats.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
                {stats.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "2rem",
                      border: `1px solid ${border}`,
                      backgroundColor: cardBg,
                      borderRadius: radius,
                    }}
                  >
                    <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "2.5rem", color: accent, marginBottom: "0.5rem" }}>
                      {s.value}
                    </div>
                    <div style={{ color: muted, fontFamily: MONO, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── AGENDA ── */}
      {showAgenda && agendaDays.length > 0 && (
        <section id="agenda" style={sectionStyle({ backgroundColor: cardBg })}>
          <div style={containerStyle}>
            <SectionHeader eyebrow={firstNonEmpty(p.agendaEyebrow) ?? "Schedule"} title={firstNonEmpty(p.agendaHeading) ?? "The agenda."} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem" }}>
              {/* day tabs */}
              <div style={{ flex: "1 1 200px", maxWidth: "16rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {agendaDays.map((day, i) => {
                  const active = i === safeActiveDay;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveDay(i)}
                      style={{
                        textAlign: "left",
                        padding: "1rem 1.25rem",
                        border: `1px solid ${active ? accent : border}`,
                        backgroundColor: active ? rgba(accent, 0.1) : "transparent",
                        color: active ? accent : muted,
                        cursor: "pointer",
                        fontFamily: MONO,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderRadius: radius,
                      }}
                    >
                      {day.date && <div style={{ fontSize: "0.7rem", marginBottom: "0.25rem" }}>{day.date}</div>}
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: displayFont }}>{day.dayLabel}</div>
                    </button>
                  );
                })}
              </div>
              {/* sessions */}
              <div style={{ flex: "3 1 480px", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {(agendaDays[safeActiveDay]?.sessions ?? []).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "1.5rem",
                      padding: "1.5rem",
                      border: `1px solid ${border}`,
                      backgroundColor: bg,
                      borderRadius: radius,
                    }}
                  >
                    <div style={{ width: "7rem", flexShrink: 0, fontFamily: MONO, color: accent, paddingTop: "0.15rem" }}>
                      {s.time}
                    </div>
                    <div style={{ flex: 1, minWidth: "12rem" }}>
                      <h4 style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.25rem", margin: "0 0 0.5rem", color: headline }}>
                        {s.title}
                      </h4>
                      {s.description && (
                        <p style={{ color: muted, fontSize: "0.95rem", margin: "0 0 0.5rem", lineHeight: 1.5 }}>{s.description}</p>
                      )}
                      {s.speaker && (
                        <div style={{ color: muted, fontSize: "0.85rem", fontFamily: MONO }}>{s.speaker}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── SPEAKERS ── */}
      {showSpeakers && speakers.length > 0 && (
        <section id="speakers" style={sectionStyle({ backgroundColor: bg })}>
          <div style={containerStyle}>
            <SectionHeader eyebrow={firstNonEmpty(p.speakersEyebrow) ?? "Speakers"} title={firstNonEmpty(p.speakersHeading) ?? "The lineup."} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {speakers.map((sp, i) => (
                <div key={i}>
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      marginBottom: "1.25rem",
                      overflow: "hidden",
                      border: `1px solid ${border}`,
                      backgroundColor: cardBg,
                      borderRadius: radius,
                    }}
                  >
                    {sp.photoUrl ? (
                      <img
                        src={sp.photoUrl}
                        alt={sp.name}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.5)" }}
                      />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, ...imgPlaceholder }} />
                    )}
                  </div>
                  <h4 style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.15rem", margin: "0 0 0.25rem", color: headline }}>
                    {sp.name}
                  </h4>
                  <p style={{ color: muted, fontSize: "0.85rem", fontFamily: MONO, margin: 0 }}>
                    {[sp.role, sp.company].filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── VENUE (split) ── */}
      {showVenue && (
        <section style={{ borderBottom: `1px solid ${border}`, backgroundColor: cardBg }}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <div
              style={{
                flex: "1 1 400px",
                padding: "clamp(2rem, 6vw, 6rem)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Eyebrow label={firstNonEmpty(p.venueEyebrow) ?? "The Venue"} />
              <h2 style={{ ...h2Style(), marginBottom: "1.5rem" }}>{firstNonEmpty(p.venueHeading) ?? p.venueName ?? "The Venue"}</h2>
              {p.venueDescription && (
                <p style={{ color: muted, fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "2rem", fontWeight: 300 }}>
                  {p.venueDescription}
                </p>
              )}
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1.5rem", fontFamily: MONO }}>
                {p.venueName && (
                  <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <Building2 size={22} style={{ color: accent, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: ink, marginBottom: "0.25rem" }}>{p.venueName}</div>
                      {p.venueAddress && <div style={{ color: muted }}>{p.venueAddress}</div>}
                    </div>
                  </li>
                )}
                {eventLocation && (
                  <li style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                    <MapPin size={22} style={{ color: accent, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: ink, marginBottom: "0.25rem" }}>Location</div>
                      <div style={{ color: muted }}>{eventLocation}</div>
                    </div>
                  </li>
                )}
              </ul>
            </div>
            <div style={{ flex: "1 1 360px", minHeight: 440, position: "relative", borderLeft: `1px solid ${border}` }}>
              {p.venueImageUrl ? (
                <img
                  src={p.venueImageUrl}
                  alt={p.venueName || "Venue"}
                  loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.5)", opacity: 0.85 }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, ...imgPlaceholder }} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY ── */}
      {showGallery && galleryImages.length > 0 && (
        <section style={sectionStyle({ backgroundColor: bg })}>
          <div style={containerStyle}>
            {firstNonEmpty(p.galleryHeading) && (
              <SectionHeader title={firstNonEmpty(p.galleryHeading)} />
            )}
          </div>
          <div style={{ display: "flex", gap: "1rem", overflowX: "auto", padding: "0 1.5rem 1rem" }}>
            {galleryImages.map((g, i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  width: "min(80vw, 36rem)",
                  aspectRatio: "16 / 9",
                  border: `1px solid ${border}`,
                  backgroundColor: cardBg,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: radius,
                }}
              >
                <img
                  src={g.url}
                  alt={g.caption || `Gallery ${i + 1}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.4)" }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SPONSORS ── */}
      {showSponsors && sponsors.length > 0 && (
        <section style={sectionStyle({ backgroundColor: cardBg })}>
          <div style={containerStyle}>
            <p style={{ textAlign: "center", fontFamily: MONO, fontSize: "0.85rem", color: muted, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "3rem" }}>
              {firstNonEmpty(p.sponsorsHeading) ?? "Backed by industry leaders"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "clamp(2rem, 6vw, 5rem)" }}>
              {sponsors.map((s, i) =>
                s.logoUrl ? (
                  <img
                    key={i}
                    src={s.logoUrl}
                    alt={s.name}
                    loading="lazy"
                    style={{ height: "2.25rem", width: "auto", objectFit: "contain", opacity: 0.7, filter: "grayscale(1)" }}
                  />
                ) : (
                  <div key={i} style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.5rem", color: muted, letterSpacing: "-0.02em" }}>
                    {s.name}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── TICKETS ── */}
      {showTickets && ticketTiers.length > 0 && (
        <section id="tickets" style={sectionStyle({ backgroundColor: bg })}>
          <div style={containerStyle}>
            <SectionHeader eyebrow={firstNonEmpty(p.ticketsEyebrow) ?? "Tickets"} title={firstNonEmpty(p.ticketsHeading) ?? "Secure your access."} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", maxWidth: "60rem", marginLeft: "auto", marginRight: "auto" }}>
              {ticketTiers.map((tier, i) => (
                <div
                  key={i}
                  style={{
                    padding: "clamp(1.75rem, 4vw, 3rem)",
                    border: `1px solid ${tier.featured ? accent : border}`,
                    backgroundColor: dark,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    borderRadius: radius,
                  }}
                >
                  {tier.featured && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: "2rem",
                        transform: "translateY(-50%)",
                        backgroundColor: accent,
                        color: accentInk,
                        fontFamily: MONO,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.3rem 0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderRadius: radius ? Math.min(radius, 8) : 0,
                      }}
                    >
                      Recommended
                    </div>
                  )}
                  <div style={{ marginBottom: "2rem", borderBottom: `1px solid ${border}`, paddingBottom: "2rem" }}>
                    <h3 style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.5rem", margin: "0 0 0.5rem", color: headline }}>
                      {tier.name}
                    </h3>
                    {tier.description && (
                      <p style={{ color: muted, fontSize: "0.9rem", marginBottom: "1.25rem", minHeight: "2.5rem" }}>{tier.description}</p>
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                      <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "3rem", color: headline, letterSpacing: "-0.02em" }}>
                        {tier.price}
                      </span>
                      {tier.period && <span style={{ color: muted, fontSize: "0.95rem" }}>{tier.period}</span>}
                    </div>
                  </div>
                  <ul style={{ listStyle: "none", margin: "0 0 2.5rem", padding: 0, display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
                    {tier.features.map((f, j) => (
                      <li key={j} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                        <CheckCircle2 size={18} style={{ color: tier.featured ? accent : muted, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.9rem", color: ink }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={tier.ctaUrl ?? "#register"}
                    style={tier.featured ? accentBtn({ width: "100%" }) : outlineBtn({ width: "100%" })}
                  >
                    {tier.ctaLabel ?? `Select ${tier.name}`}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {showFaq && faqItems.length > 0 && (
        <section style={sectionStyle({ backgroundColor: bg })}>
          <div style={{ ...containerStyle, display: "flex", flexWrap: "wrap", gap: "clamp(2rem, 6vw, 4rem)" }}>
            <div style={{ flex: "1 1 240px", maxWidth: "22rem" }}>
              <SectionHeader eyebrow="FAQ" title={firstNonEmpty(p.faqHeading) ?? "Got questions?"} />
            </div>
            <div style={{ flex: "2 1 420px", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {faqItems.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={i} style={{ border: `1px solid ${border}`, backgroundColor: cardBg, borderRadius: radius }}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        padding: "1.5rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        color: headline,
                      }}
                    >
                      <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.1rem" }}>{item.question}</span>
                      {open ? <Minus size={20} style={{ color: accent, flexShrink: 0 }} /> : <Plus size={20} style={{ color: muted, flexShrink: 0 }} />}
                    </button>
                    {open && (
                      <div style={{ padding: "0 1.5rem 1.5rem", color: muted, lineHeight: 1.6 }}>{item.answer}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── RSVP FORM ── */}
      {showForm && (
        <section id="register" style={sectionStyle({ backgroundColor: cardBg, position: "relative", overflow: "hidden" })}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 600,
              height: 600,
              background: rgba(accent, 0.05),
              borderRadius: "999px",
              filter: "blur(120px)",
              transform: "translate(-50%,-50%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ ...containerStyle, position: "relative", zIndex: 1 }}>
            <div
              style={{
                maxWidth: "44rem",
                marginLeft: "auto",
                marginRight: "auto",
                border: `1px solid ${border}`,
                backgroundColor: dark,
                padding: "clamp(2rem, 5vw, 4rem)",
                borderRadius: radius,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "3rem" }}>
                <Eyebrow label={firstNonEmpty(p.formEyebrow)} />
                <h2 style={{ ...h2Style(), textAlign: "center" }}>{firstNonEmpty(p.formHeading) ?? "Reserve your seat."}</h2>
                {p.formSubheading && (
                  <p style={{ color: muted, marginTop: "1rem" }}>{p.formSubheading}</p>
                )}
              </div>

              {submitted ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", border: `1px solid ${rgba(accent, 0.3)}`, backgroundColor: rgba(accent, 0.05), borderRadius: radius }}>
                  <CheckCircle2 size={56} style={{ color: accent, marginBottom: "1.5rem" }} />
                  <h3 style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.5rem", margin: "0 0 0.5rem", color: headline }}>
                    You're registered
                  </h3>
                  <p style={{ color: muted, margin: 0 }}>{successMessage}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {formFields.map((field) => (
                    <div key={field.id}>
                      <label htmlFor={`bes-${field.id}`} style={labelStyle}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={`bes-${field.id}`}
                          required={field.required}
                          placeholder={field.placeholder}
                          rows={4}
                          value={formData[field.id] ?? ""}
                          onChange={(e) => handleField(field.id, e.target.value)}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      ) : field.type === "select" ? (
                        <select
                          id={`bes-${field.id}`}
                          required={field.required}
                          value={formData[field.id] ?? ""}
                          onChange={(e) => handleField(field.id, e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">{field.placeholder ?? "Select…"}</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`bes-${field.id}`}
                          type={field.type}
                          required={field.required}
                          placeholder={field.placeholder}
                          value={formData[field.id] ?? ""}
                          onChange={(e) => handleField(field.id, e.target.value)}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  ))}

                  {formError && (
                    <div style={{ color: "#ff6b6b", fontSize: "0.85rem", fontFamily: MONO }}>{formError}</div>
                  )}

                  <button type="submit" disabled={submitting} style={accentBtn({ width: "100%", padding: "1.1rem", opacity: submitting ? 0.7 : 1 })}>
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      <>
                        {firstNonEmpty(p.formSubmitLabel) ?? "Complete Registration"} <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      {showFooter && (
        <footer style={{ backgroundColor: bg, padding: `${sectionPad / 2}px 0`, borderTop: `1px solid ${accent}` }}>
          <div style={containerStyle}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "2rem",
                marginBottom: "3rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt={p.logoAlt || brandName} style={{ height: "2rem", width: "auto" }} />
                ) : (
                  <>
                    <Zap size={28} style={{ color: accent }} />
                    <span style={{ fontFamily: displayFont, fontWeight: 700, fontSize: "1.75rem", letterSpacing: "-0.02em", color: headline }}>
                      {brandName}
                    </span>
                  </>
                )}
              </div>
              {(p.footerLinks ?? []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem" }}>
                  {(p.footerLinks ?? []).map((l) => (
                    <a
                      key={`${l.label}-${l.href}`}
                      href={l.href}
                      style={{ fontFamily: MONO, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: muted, textDecoration: "none" }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                borderTop: `1px solid ${border}`,
                paddingTop: "2rem",
                fontFamily: MONO,
                fontSize: "0.85rem",
                color: muted,
              }}
            >
              <div>{firstNonEmpty(p.footerNote) ?? `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}</div>
              {p.footerTagline && <div style={{ color: ink }}>{p.footerTagline}</div>}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default BlockEventSplit;
