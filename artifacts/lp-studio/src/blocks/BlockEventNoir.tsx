import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Instagram,
  Linkedin,
  Loader2,
  MapPin,
  Twitter,
} from "lucide-react";
import type {
  EventNoirBlockProps,
  EventFormField,
  EventAgendaDay,
} from "@/lib/block-types";
import {
  resolveSectionSpacingPx,
  resolveContentMaxWidthPx,
  resolveRadiusPx,
  resolveHeadingScale,
} from "@/lib/block-types";
import type { BrandConfig } from "@/lib/brand-config";
import { toFontFamilyValue } from "@/lib/font-catalog";
import { useBlockFonts } from "@/lib/use-block-fonts";

// ── Hardcoded editorial "noir" defaults ─────────────────────────────────────
const NOIR = {
  bg: "#0a0a0a",
  surface: "#121212",
  border: "#2a2a2a",
  borderSoft: "#1a1a1a",
  ink: "#ffffff",
  muted: "#a0a0a0",
  tertiary: "#666666",
  accent: "#d4af37",
  accentInk: "#000000",
};

const DEFAULT_DISPLAY = "'Playfair Display', Georgia, serif";
const DEFAULT_BODY = "'Inter', system-ui, sans-serif";

const DEFAULT_FORM_FIELDS: EventFormField[] = [
  { id: "firstName", label: "First Name", type: "text", placeholder: "Enter first name", required: true },
  { id: "lastName", label: "Last Name", type: "text", placeholder: "Enter last name", required: true },
  { id: "email", label: "Email", type: "email", placeholder: "name@company.com", required: true },
  { id: "organization", label: "Organization", type: "text", placeholder: "Company name" },
  { id: "title", label: "Title / Role", type: "text", placeholder: "Your position" },
  { id: "notes", label: "Notes", type: "textarea", placeholder: "Any specifications we should be aware of..." },
];

function hexToRgb(hex?: string | null): [number, number, number] {
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

interface Props {
  props: EventNoirBlockProps;
  /** Tenant brand config — block colors/fonts fall back to brand when a
   *  per-block style token is absent (prop ?? brand ?? noir default). */
  brand?: BrandConfig;
  /** Builder mode — currently unused for static rendering; accepted so the
   *  renderer can pass it through like sibling full-page blocks. */
  isBuilder?: boolean;
}

interface NoirTheme {
  bg: string;
  surface: string;
  border: string;
  borderSoft: string;
  ink: string;
  muted: string;
  tertiary: string;
  accent: string;
  accentInk: string;
  display: string;
  body: string;
  sectionPad: number;
  maxW: number;
  radius: number;
  headingScale: number;
}

// ── Countdown ───────────────────────────────────────────────────────────────
function useCountdown(targetIso?: string) {
  const compute = useMemo(() => {
    return () => {
      if (!targetIso) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      const target = new Date(targetIso).getTime();
      if (Number.isNaN(target)) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      const diff = Math.max(0, target - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return { days, hours, minutes, seconds };
    };
  }, [targetIso]);

  const [time, setTime] = useState(compute);

  useEffect(() => {
    setTime(compute());
    const id = setInterval(() => setTime(compute()), 1000);
    return () => clearInterval(id);
  }, [compute]);

  return time;
}

// ── Reusable bits ───────────────────────────────────────────────────────────
function Eyebrow({ text, C, withRule = false }: { text: string; C: NoirTheme; withRule?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "1rem",
        color: C.accent,
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        fontSize: "0.72rem",
        fontWeight: 500,
        fontFamily: C.body,
      }}
    >
      {withRule && <span style={{ width: "2rem", height: 1, backgroundColor: C.accent }} />}
      {text}
    </div>
  );
}

function NoirButton({
  children,
  C,
  href,
  onClick,
  variant = "primary",
  type,
  disabled,
  full,
}: {
  children: React.ReactNode;
  C: NoirTheme;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    padding: "1rem 2rem",
    fontSize: "0.8rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    fontWeight: 500,
    fontFamily: C.body,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    transition: "all 0.3s ease",
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.6 : 1,
  };
  const styles: React.CSSProperties =
    variant === "primary"
      ? { ...base, backgroundColor: C.accent, color: C.accentInk }
      : { ...base, backgroundColor: "transparent", color: C.ink, borderColor: C.border };

  const hoverIn = (el: HTMLElement) => {
    if (disabled) return;
    if (variant === "primary") el.style.backgroundColor = rgba(C.accent, 0.82);
    else {
      el.style.borderColor = C.accent;
      el.style.color = C.accent;
    }
  };
  const hoverOut = (el: HTMLElement) => {
    if (variant === "primary") el.style.backgroundColor = C.accent;
    else {
      el.style.borderColor = C.border;
      el.style.color = C.ink;
    }
  };

  if (href) {
    return (
      <a
        href={href}
        style={styles}
        onMouseEnter={(e) => hoverIn(e.currentTarget)}
        onMouseLeave={(e) => hoverOut(e.currentTarget)}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      style={styles}
      onMouseEnter={(e) => hoverIn(e.currentTarget)}
      onMouseLeave={(e) => hoverOut(e.currentTarget)}
    >
      {children}
    </button>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────
function Nav({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const links = p.navLinks ?? [];
  const ctaLabel = p.navCtaLabel ?? "Request Invite";
  const ctaUrl = p.navCtaUrl ?? "#rsvp";
  return (
    <nav
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "1.5rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.5rem",
        borderBottom: `1px solid ${rgba(C.ink, 0.1)}`,
        mixBlendMode: "difference",
      }}
    >
      <a href="#top" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem" }}>
        {p.logoUrl ? (
          <img src={p.logoUrl} alt={p.logoAlt ?? p.brandName} style={{ height: "1.6rem", width: "auto" }} />
        ) : (
          <span
            style={{
              fontFamily: C.display,
              fontSize: "1.5rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.ink,
            }}
          >
            {p.brandName}
          </span>
        )}
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        {links.length > 0 && (
          <div className="hidden md:flex" style={{ gap: "2rem", alignItems: "center" }}>
            {links.map((l) => (
              <a
                key={`${l.label}-${l.href}`}
                href={l.href}
                style={{
                  fontFamily: C.body,
                  fontSize: "0.7rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: rgba(C.ink, 0.75),
                  textDecoration: "none",
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
        <a
          href={ctaUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.55rem 1.4rem",
            fontSize: "0.7rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 500,
            fontFamily: C.body,
            color: C.ink,
            textDecoration: "none",
            border: `1px solid ${rgba(C.ink, 0.25)}`,
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = C.ink;
            e.currentTarget.style.color = C.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = C.ink;
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </nav>
  );
}

function Hero({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const eyebrow = p.heroEyebrow ?? "";
  const tagline = p.heroTagline ?? "";
  const ctaLabel = p.heroCtaLabel ?? "Secure Your Place";
  const ctaUrl = p.heroCtaUrl ?? "#rsvp";
  const overlay = typeof p.heroOverlayOpacity === "number" ? p.heroOverlayOpacity / 100 : 0.4;
  const heroSize = `clamp(2.75rem, 8vw, ${6 * C.headingScale}rem)`;

  return (
    <section
      id="top"
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "flex-end",
        paddingTop: "8rem",
        paddingBottom: "6rem",
        paddingLeft: "2rem",
        paddingRight: "2rem",
        overflow: "hidden",
        backgroundColor: C.bg,
      }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {p.heroImageUrl ? (
          <img
            src={p.heroImageUrl}
            alt={p.eventName}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6,
              mixBlendMode: "luminosity",
              transform: "scale(1.05)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `radial-gradient(ellipse at 30% 20%, ${rgba(C.accent, 0.12)} 0%, transparent 55%), linear-gradient(160deg, ${C.surface} 0%, ${C.bg} 100%)`,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, ${C.bg} 0%, ${rgba(C.bg, 0.5 + overlay * 0.4)} 50%, ${rgba(C.bg, overlay * 0.4)} 100%)`,
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: C.maxW,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "3rem",
          alignItems: "flex-end",
        }}
        className="lg:grid-cols-12"
      >
        <div className="lg:col-span-8">
          {eyebrow && (
            <div style={{ marginBottom: "1.5rem" }}>
              <Eyebrow text={eyebrow} C={C} withRule />
            </div>
          )}
          <h1
            style={{
              fontFamily: C.display,
              fontSize: heroSize,
              lineHeight: 1.08,
              color: C.ink,
              marginBottom: "1.5rem",
              fontWeight: 500,
            }}
          >
            {p.eventName}
          </h1>
          {tagline && (
            <p
              style={{
                fontFamily: C.body,
                fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
                color: C.muted,
                fontWeight: 300,
                maxWidth: "40rem",
                marginBottom: "3rem",
                lineHeight: 1.5,
              }}
            >
              {tagline}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <NoirButton C={C} href={ctaUrl}>
              {ctaLabel}
              <ArrowRight style={{ width: "1rem", height: "1rem" }} />
            </NoirButton>
            {p.heroSecondaryCtaLabel && (
              <NoirButton C={C} href={p.heroSecondaryCtaUrl ?? "#"} variant="outline">
                {p.heroSecondaryCtaLabel}
              </NoirButton>
            )}
          </div>
        </div>

        <div
          className="lg:col-span-4 lg:text-right"
          style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
        >
          {p.eventDate && (
            <div>
              <div style={{ color: C.tertiary, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.7rem", marginBottom: "0.5rem", fontFamily: C.body }}>
                Date
              </div>
              <div style={{ color: C.ink, fontSize: "1.1rem", fontWeight: 500, fontFamily: C.body }}>{p.eventDate}</div>
            </div>
          )}
          {p.eventLocation && (
            <div>
              <div style={{ color: C.tertiary, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.7rem", marginBottom: "0.5rem", fontFamily: C.body }}>
                Location
              </div>
              <div style={{ color: C.ink, fontSize: "1.1rem", fontWeight: 500, fontFamily: C.body, whiteSpace: "pre-line" }}>
                {p.eventLocation}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Countdown({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const t = useCountdown(p.countdownTargetDate);
  const items = [
    { label: "Days", value: t.days },
    { label: "Hours", value: t.hours },
    { label: "Minutes", value: t.minutes },
    { label: "Seconds", value: t.seconds },
  ];
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg, borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto" }}>
        {p.countdownHeading && (
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontFamily: C.display, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", color: C.ink }}>{p.countdownHeading}</h2>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "2rem" }}>
          {items.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              }}
            >
              <div style={{ fontFamily: C.display, fontSize: "clamp(2.5rem, 6vw, 3.75rem)", color: C.ink, marginBottom: "0.5rem" }}>
                {String(item.value).padStart(2, "0")}
              </div>
              <div style={{ color: C.tertiary, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.7rem", fontFamily: C.body }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const stats = p.aboutStats ?? [];
  const paragraphs = (p.aboutBody ?? "").split(/\n\n+/).filter(Boolean);
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg }}>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ maxWidth: C.maxW, margin: "0 auto", gap: "4rem" }}>
        <div>
          {p.aboutEyebrow && (
            <div style={{ marginBottom: "1.5rem" }}>
              <Eyebrow text={p.aboutEyebrow} C={C} />
            </div>
          )}
          {p.aboutHeading && (
            <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 3rem)", color: C.ink, lineHeight: 1.15, marginBottom: "2rem" }}>
              {p.aboutHeading}
            </h2>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {paragraphs.map((para, i) => (
              <p key={i} style={{ color: C.muted, fontSize: "1.1rem", fontWeight: 300, lineHeight: 1.7, fontFamily: C.body }}>
                {para}
              </p>
            ))}
          </div>
        </div>
        {stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "2rem" }}>
            {stats.map((s, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: C.surface,
                  padding: "2rem",
                  border: `1px solid ${C.borderSoft}`,
                  borderRadius: C.radius,
                }}
              >
                <div style={{ fontFamily: C.display, fontSize: "2.5rem", color: C.accent, marginBottom: "1rem" }}>{s.value}</div>
                <div style={{ color: C.ink, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: C.body }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Agenda({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const days: EventAgendaDay[] = p.agendaDays ?? [];
  const [active, setActive] = useState(0);
  if (days.length === 0) return null;
  const day = days[Math.min(active, days.length - 1)];

  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.surface }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto" }}>
        <div
          className="flex-col md:flex-row"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "4rem", gap: "2rem" }}
        >
          <div>
            {p.agendaEyebrow && (
              <div style={{ marginBottom: "1rem" }}>
                <Eyebrow text={p.agendaEyebrow} C={C} />
              </div>
            )}
            <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 2.75rem)", color: C.ink }}>
              {p.agendaHeading ?? "The Itinerary"}
            </h2>
          </div>
          {days.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {days.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderBottom: `2px solid ${i === active ? C.accent : "transparent"}`,
                    background: "none",
                    cursor: "pointer",
                    color: i === active ? C.ink : C.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    fontSize: "0.7rem",
                    fontFamily: C.body,
                    transition: "color 0.2s",
                  }}
                >
                  {d.dayLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {day.sessions.map((session, i) => (
            <div
              key={i}
              className="flex-col md:flex-row"
              style={{
                display: "flex",
                gap: "2rem",
                padding: "2rem 0",
                borderTop: `1px solid ${C.borderSoft}`,
              }}
            >
              <div style={{ width: "8rem", flexShrink: 0, color: C.muted, fontWeight: 500, letterSpacing: "0.1em", fontFamily: C.body, paddingTop: "0.25rem" }}>
                {session.time}
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <h3 style={{ fontFamily: C.display, fontSize: "1.5rem", color: C.ink }}>{session.title}</h3>
                  {session.speaker && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.16em",
                        padding: "0.25rem 0.6rem",
                        border: `1px solid ${C.border}`,
                        color: C.muted,
                        fontFamily: C.body,
                      }}
                    >
                      {session.speaker}
                    </span>
                  )}
                </div>
                {session.description && (
                  <p style={{ color: C.muted, fontWeight: 300, maxWidth: "40rem", fontFamily: C.body, lineHeight: 1.6 }}>
                    {session.description}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.borderSoft}` }} />
        </div>
      </div>
    </section>
  );
}

function SpeakerImage({ url, name, C }: { url?: string; name: string; C: NoirTheme }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "grayscale(1)",
          opacity: 0.8,
          transition: "all 0.7s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = "grayscale(0)";
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "grayscale(1)";
          e.currentTarget.style.opacity = "0.8";
          e.currentTarget.style.transform = "scale(1)";
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${C.surface} 0%, ${C.bg} 100%)`,
        color: C.tertiary,
        fontFamily: C.display,
        fontSize: "2.5rem",
      }}
    >
      {name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );
}

function Speakers({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const speakers = p.speakers ?? [];
  if (speakers.length === 0) return null;
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto" }}>
        <div style={{ marginBottom: "4rem" }}>
          {p.speakersEyebrow && (
            <div style={{ marginBottom: "1rem" }}>
              <Eyebrow text={p.speakersEyebrow} C={C} />
            </div>
          )}
          <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 2.75rem)", color: C.ink }}>
            {p.speakersHeading ?? "The Voices"}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: "2rem" }}>
          {speakers.map((sp, i) => (
            <div key={i} style={{ cursor: "default" }}>
              <div
                style={{
                  position: "relative",
                  aspectRatio: "3 / 4",
                  marginBottom: "1.5rem",
                  overflow: "hidden",
                  backgroundColor: C.surface,
                  borderRadius: C.radius,
                }}
              >
                <SpeakerImage url={sp.photoUrl} name={sp.name} C={C} />
              </div>
              <h3 style={{ fontFamily: C.display, fontSize: "1.25rem", color: C.ink, marginBottom: "0.25rem" }}>{sp.name}</h3>
              {(sp.role || sp.company) && (
                <p style={{ fontSize: "0.8rem", color: C.tertiary, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: C.body }}>
                  {[sp.role, sp.company].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Venue({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.surface }}>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ maxWidth: C.maxW, margin: "0 auto", gap: "4rem", alignItems: "center" }}>
        <div style={{ position: "relative", aspectRatio: "4 / 3", width: "100%" }}>
          {p.venueImageUrl ? (
            <img
              src={p.venueImageUrl}
              alt={p.venueName ?? "Venue"}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", border: `1px solid ${C.border}`, borderRadius: C.radius }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                border: `1px solid ${C.border}`,
                borderRadius: C.radius,
                background: `radial-gradient(ellipse at center, ${rgba(C.accent, 0.08)} 0%, transparent 60%), linear-gradient(160deg, ${C.bg} 0%, ${C.surface} 100%)`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "1rem",
                  height: "1rem",
                  backgroundColor: C.accent,
                  borderRadius: "999px",
                  boxShadow: `0 0 20px ${rgba(C.accent, 0.5)}`,
                }}
              />
            </div>
          )}
        </div>

        <div>
          {p.venueEyebrow && (
            <div style={{ marginBottom: "1rem" }}>
              <Eyebrow text={p.venueEyebrow} C={C} />
            </div>
          )}
          <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 2.75rem)", color: C.ink, marginBottom: "2rem" }}>
            {p.venueHeading ?? p.venueName ?? "The Venue"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {p.venueAddress && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <MapPin style={{ color: C.accent, width: "1.5rem", height: "1.5rem", flexShrink: 0, marginTop: "0.25rem" }} />
                <div>
                  <h4 style={{ color: C.ink, fontWeight: 500, fontSize: "1.1rem", marginBottom: "0.25rem", fontFamily: C.body }}>Address</h4>
                  <p style={{ color: C.muted, fontWeight: 300, fontFamily: C.body, whiteSpace: "pre-line", lineHeight: 1.6 }}>{p.venueAddress}</p>
                </div>
              </div>
            )}
            {p.venueName && p.venueHeading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <Calendar style={{ color: C.accent, width: "1.5rem", height: "1.5rem", flexShrink: 0, marginTop: "0.25rem" }} />
                <div>
                  <h4 style={{ color: C.ink, fontWeight: 500, fontSize: "1.1rem", marginBottom: "0.25rem", fontFamily: C.body }}>Venue</h4>
                  <p style={{ color: C.muted, fontWeight: 300, fontFamily: C.body, lineHeight: 1.6 }}>{p.venueName}</p>
                </div>
              </div>
            )}
            {p.venueDescription && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                <Clock style={{ color: C.accent, width: "1.5rem", height: "1.5rem", flexShrink: 0, marginTop: "0.25rem" }} />
                <div>
                  <h4 style={{ color: C.ink, fontWeight: 500, fontSize: "1.1rem", marginBottom: "0.25rem", fontFamily: C.body }}>Details</h4>
                  <p style={{ color: C.muted, fontWeight: 300, fontFamily: C.body, lineHeight: 1.6 }}>{p.venueDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Gallery({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const images = p.galleryImages ?? [];
  if (images.length === 0) return null;
  const aspects = ["4 / 3", "3 / 4", "4 / 3"];
  return (
    <section style={{ padding: `${C.sectionPad}px 0`, backgroundColor: C.bg, overflow: "hidden" }}>
      {p.galleryHeading && (
        <div style={{ maxWidth: C.maxW, margin: "0 auto 3rem", padding: "0 2rem" }}>
          <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 2.75rem)", color: C.ink }}>{p.galleryHeading}</h2>
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", padding: "0 2rem", maxWidth: C.maxW, margin: "0 auto" }}>
        {images.slice(0, 6).map((img, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              flex: 1,
              aspectRatio: aspects[i % aspects.length],
              backgroundColor: C.surface,
              overflow: "hidden",
              borderRadius: C.radius,
              opacity: 0.65,
              transition: "opacity 0.5s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
          >
            {img.url ? (
              <img src={img.url} alt={img.caption ?? ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${C.surface} 0%, ${C.bg} 100%)` }} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Sponsors({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const sponsors = p.sponsors ?? [];
  if (sponsors.length === 0) return null;
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.surface, borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto", textAlign: "center" }}>
        <h3 style={{ color: C.tertiary, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.72rem", marginBottom: "3rem", fontFamily: C.body }}>
          {p.sponsorsHeading ?? "In Partnership With"}
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "3rem", opacity: 0.5 }}>
          {sponsors.map((s, i) =>
            s.logoUrl ? (
              <img key={i} src={s.logoUrl} alt={s.name} loading="lazy" style={{ height: "2rem", width: "auto", filter: "grayscale(1) brightness(2)" }} />
            ) : (
              <div key={i} style={{ fontFamily: C.display, fontSize: "1.5rem", letterSpacing: "0.05em", color: C.ink }}>
                {s.name}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function Tickets({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const tiers = p.ticketTiers ?? [];
  if (tiers.length === 0) return null;
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          {p.ticketsEyebrow && (
            <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
              <Eyebrow text={p.ticketsEyebrow} C={C} />
            </div>
          )}
          <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 3rem)", color: C.ink }}>
            {p.ticketsHeading ?? "Registration"}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "2rem" }}>
          {tiers.map((tier, i) => (
            <div
              key={i}
              style={{
                backgroundColor: C.surface,
                border: `1px solid ${tier.featured ? C.accent : C.borderSoft}`,
                borderRadius: C.radius,
                padding: "2.5rem",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {tier.featured && (
                <div style={{ color: C.accent, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.65rem", marginBottom: "1rem", fontFamily: C.body }}>
                  Recommended
                </div>
              )}
              <h3 style={{ fontFamily: C.display, fontSize: "1.5rem", color: C.ink, marginBottom: "0.75rem" }}>{tier.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <span style={{ fontFamily: C.display, fontSize: "2.5rem", color: C.accent }}>{tier.price}</span>
                {tier.period && <span style={{ color: C.tertiary, fontSize: "0.85rem", fontFamily: C.body }}>{tier.period}</span>}
              </div>
              {tier.description && (
                <p style={{ color: C.muted, fontWeight: 300, fontFamily: C.body, marginBottom: "1.5rem", lineHeight: 1.6 }}>{tier.description}</p>
              )}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: "0.75rem", flexGrow: 1 }}>
                {tier.features.map((f, fi) => (
                  <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", color: C.muted, fontFamily: C.body, fontSize: "0.9rem" }}>
                    <Check style={{ width: "1rem", height: "1rem", color: C.accent, flexShrink: 0, marginTop: "0.2rem" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <NoirButton C={C} href={tier.ctaUrl ?? "#rsvp"} variant={tier.featured ? "primary" : "outline"} full>
                {tier.ctaLabel ?? "Select"}
              </NoirButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const items = p.faqItems ?? [];
  if (items.length === 0) return null;
  return (
    <section style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg }}>
      <div style={{ maxWidth: Math.min(C.maxW, 880), margin: "0 auto" }}>
        <h2 style={{ fontFamily: C.display, fontSize: "clamp(2rem, 4.5vw, 2.75rem)", color: C.ink, marginBottom: "4rem", textAlign: "center" }}>
          {p.faqHeading ?? "Inquiries"}
        </h2>
        <div>
          {items.map((item, i) => (
            <details key={i} style={{ padding: "1.5rem 0", borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}` }}>
              <summary
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  listStyle: "none",
                  fontSize: "1.25rem",
                  fontFamily: C.display,
                  color: C.ink,
                }}
              >
                {item.question}
                <ChevronDown style={{ width: "1.25rem", height: "1.25rem", color: C.tertiary, flexShrink: 0 }} />
              </summary>
              <p style={{ marginTop: "1rem", color: C.muted, fontWeight: 300, lineHeight: 1.7, fontFamily: C.body }}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function RsvpForm({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const fields = p.formFields && p.formFields.length > 0 ? p.formFields : DEFAULT_FORM_FIELDS;
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitUrl = p.formSubmitUrl ?? "/api/lp/leads";
  const successMessage = p.formSuccessMessage ?? "Thank you — your request has been received.";

  const handleChange = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        fields: {
          ...values,
          _eventName: p.eventName ?? "",
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
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: `1px solid ${C.border}`,
    padding: "0.75rem 0",
    color: C.ink,
    fontFamily: C.body,
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const renderField = (field: EventFormField) => {
    const val = values[field.id] ?? "";
    const onFocus = (el: HTMLElement) => (el.style.borderBottomColor = C.accent);
    const onBlur = (el: HTMLElement) => (el.style.borderBottomColor = C.border);

    if (field.type === "textarea") {
      return (
        <textarea
          value={val}
          onChange={(e) => handleChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          style={{ ...inputStyle, resize: "none" }}
          onFocus={(e) => onFocus(e.currentTarget)}
          onBlur={(e) => onBlur(e.currentTarget)}
        />
      );
    }
    if (field.type === "select") {
      return (
        <select
          value={val}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
          style={{ ...inputStyle, cursor: "pointer" }}
          onFocus={(e) => onFocus(e.currentTarget)}
          onBlur={(e) => onBlur(e.currentTarget)}
        >
          <option value="" style={{ backgroundColor: C.surface, color: C.ink }}>
            {field.placeholder || "Select..."}
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt} style={{ backgroundColor: C.surface, color: C.ink }}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type}
        value={val}
        onChange={(e) => handleChange(field.id, e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        style={inputStyle}
        onFocus={(e) => onFocus(e.currentTarget)}
        onBlur={(e) => onBlur(e.currentTarget)}
      />
    );
  };

  return (
    <section id="rsvp" style={{ padding: `${C.sectionPad}px 2rem`, backgroundColor: C.bg, position: "relative", borderTop: `1px solid ${C.borderSoft}` }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, ${rgba(C.accent, 0.05)} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ maxWidth: Math.min(C.maxW, 760), margin: "0 auto", position: "relative", zIndex: 10 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          {p.formEyebrow && (
            <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
              <Eyebrow text={p.formEyebrow} C={C} />
            </div>
          )}
          <h2 style={{ fontFamily: C.display, fontSize: "clamp(2.25rem, 5vw, 3rem)", color: C.ink, marginBottom: "1.5rem" }}>
            {p.formHeading ?? "Request Invitation"}
          </h2>
          {p.formSubheading && (
            <p style={{ color: C.muted, fontWeight: 300, fontSize: "1.1rem", fontFamily: C.body, lineHeight: 1.6 }}>{p.formSubheading}</p>
          )}
        </div>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle2 size={44} style={{ color: C.accent, marginBottom: "1.5rem" }} />
            <p style={{ color: C.ink, fontSize: "1.25rem", fontFamily: C.display }}>{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "2rem" }}>
              {fields.map((field, i) => {
                const fullWidth = field.type === "textarea" || field.type === "email" || (fields.length % 2 !== 0 && i === fields.length - 1);
                return (
                  <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", gridColumn: fullWidth ? "1 / -1" : undefined }}>
                    <label style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.16em", color: C.tertiary, fontFamily: C.body }}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    {renderField(field)}
                  </div>
                );
              })}
            </div>

            {error && (
              <p style={{ color: "#ef4444", fontSize: "0.85rem", fontFamily: C.body, textAlign: "center" }}>{error}</p>
            )}

            <div style={{ paddingTop: "1rem" }}>
              <NoirButton C={C} type="submit" full disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    Submitting…
                  </>
                ) : (
                  p.formSubmitLabel ?? "Submit Request"
                )}
              </NoirButton>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Footer({ p, C }: { p: EventNoirBlockProps; C: NoirTheme }) {
  const links = p.footerLinks ?? [];
  return (
    <footer style={{ backgroundColor: C.bg, paddingTop: "6rem", paddingBottom: "3rem", paddingLeft: "2rem", paddingRight: "2rem", borderTop: `1px solid ${C.borderSoft}` }}>
      <div style={{ maxWidth: C.maxW, margin: "0 auto" }}>
        <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: "3rem", marginBottom: "4rem" }}>
          <div className="md:col-span-2">
            {p.logoUrl ? (
              <img src={p.logoUrl} alt={p.logoAlt ?? p.brandName} style={{ height: "2rem", width: "auto", marginBottom: "1.5rem" }} />
            ) : (
              <div style={{ fontFamily: C.display, fontSize: "1.75rem", letterSpacing: "0.18em", textTransform: "uppercase", color: C.ink, marginBottom: "1.5rem" }}>
                {p.brandName}
              </div>
            )}
            {p.footerTagline && (
              <p style={{ color: C.tertiary, fontWeight: 300, maxWidth: "24rem", fontFamily: C.body, lineHeight: 1.6 }}>{p.footerTagline}</p>
            )}
          </div>

          {links.length > 0 && (
            <div>
              <h4 style={{ color: C.ink, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "1.5rem", fontFamily: C.body }}>
                Links
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
                {links.map((l) => (
                  <li key={`${l.label}-${l.href}`}>
                    <a href={l.href} style={{ color: C.muted, fontWeight: 300, fontSize: "0.9rem", textDecoration: "none", fontFamily: C.body }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 style={{ color: C.ink, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "1.5rem", fontFamily: C.body }}>
              Social
            </h4>
            <div style={{ display: "flex", gap: "1rem" }}>
              {[Instagram, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "999px",
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: C.muted,
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = C.accent;
                    e.currentTarget.style.borderColor = C.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = C.muted;
                    e.currentTarget.style.borderColor = C.border;
                  }}
                >
                  <Icon style={{ width: "1rem", height: "1rem" }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex-col md:flex-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "2rem",
            borderTop: `1px solid ${C.borderSoft}`,
            fontSize: "0.72rem",
            color: C.tertiary,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            fontFamily: C.body,
            gap: "1rem",
          }}
        >
          <div>{p.footerNote ?? `© ${new Date().getFullYear()} ${p.brandName}. All rights reserved.`}</div>
        </div>
      </div>
    </footer>
  );
}

// ── Block ───────────────────────────────────────────────────────────────────
export function BlockEventNoir({ props, brand }: Props) {
  const p = props;

  const displayFont =
    toFontFamilyValue(p.displayFontFamily ?? brand?.displayFont, "display") ?? DEFAULT_DISPLAY;
  const bodyFont =
    toFontFamilyValue(p.bodyFontFamily ?? brand?.bodyFont, "sans") ?? DEFAULT_BODY;
  useBlockFonts(displayFont, bodyFont, "Playfair Display");

  const C: NoirTheme = {
    bg: p.bgColor ?? brand?.pageBackground ?? NOIR.bg,
    surface: p.cardBgColor ?? brand?.cardBackground ?? NOIR.surface,
    border: p.borderColor ?? brand?.borderColor ?? NOIR.border,
    borderSoft: NOIR.borderSoft,
    ink: p.inkColor ?? brand?.textColor ?? NOIR.ink,
    muted: p.mutedColor ?? NOIR.muted,
    tertiary: NOIR.tertiary,
    accent: p.accentColor ?? brand?.accentColor ?? NOIR.accent,
    accentInk: p.accentInkColor ?? NOIR.accentInk,
    display: displayFont,
    body: bodyFont,
    sectionPad: resolveSectionSpacingPx(p.sectionSpacing),
    maxW: resolveContentMaxWidthPx(p.contentWidth),
    radius: resolveRadiusPx(p.cornerRadius),
    headingScale: resolveHeadingScale(p.headingScale),
  };

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

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: C.bg,
        color: C.ink,
        fontFamily: C.body,
        overflowX: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin { to { transform: rotate(360deg); } }
          `,
        }}
      />
      {showNav && <Nav p={p} C={C} />}
      {showHero && <Hero p={p} C={C} />}
      {showCountdown && <Countdown p={p} C={C} />}
      {showAbout && <About p={p} C={C} />}
      {showAgenda && <Agenda p={p} C={C} />}
      {showSpeakers && <Speakers p={p} C={C} />}
      {showVenue && <Venue p={p} C={C} />}
      {showGallery && <Gallery p={p} C={C} />}
      {showSponsors && <Sponsors p={p} C={C} />}
      {showTickets && <Tickets p={p} C={C} />}
      {showFaq && <FAQ p={p} C={C} />}
      {showForm && <RsvpForm p={p} C={C} />}
      {showFooter && <Footer p={p} C={C} />}
    </div>
  );
}

export default BlockEventNoir;
