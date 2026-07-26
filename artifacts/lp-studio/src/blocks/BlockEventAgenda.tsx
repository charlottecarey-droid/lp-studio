import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAnimInitial } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  relativeLuminance,
} from "@/lib/brand-config";
import { ensureAccentRegisters, mixHex, resolveSectionInk } from "@/lib/section-ink";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import type { CtaModalConfig, HeroCtaConfig } from "@/lib/block-types";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import {
  DarkHeroBackdrop,
  MicrositeNavbar,
  heroChromeInk,
  resolveDarkHeroSurface,
  type MicrositeNavLink,
} from "./microsite-chrome";
import { agendaHasCalendarData, agendaIcsFilename, buildAgendaIcs } from "@/lib/agenda-ics";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;

/* ----------------------------------------------------------------------------
 * Event Agenda — type "event-agenda"
 *
 * ABM full-page conference agenda: the page a rep publishes per strategic
 * account instead of hand-building a PowerPoint. A dark branded hero with the
 * event lockup and "your agenda is ready" headline, an optional personal note
 * from the account team, a day-by-day schedule of curated session cards (time
 * rail, type/track/room chips, per-account "why this matters" callout,
 * speakers, reserved-slot badge), and a contact close.
 *
 * Concierge register: the page should read like a printed itinerary from a
 * good hotel — calm cream canvas, ink hairlines, one accent. All schedule
 * content is editorial strings assembled server-side by the agenda publish
 * route (routes/sales/events.ts) from the event catalog + the rep's picks;
 * the block renders whatever it's given and guards every optional section.
 * Single h1 (hero). NO_REVEAL — owns its own motion (fail-open per
 * lib/reveal-fallback.ts).
 * -------------------------------------------------------------------------- */

export interface EvaSpeaker {
  /** Speaker display name. */
  name: string;
  /** Title line as displayed, e.g. "CEO, theLinkai". */
  title?: string;
}

export interface EvaSession {
  /** Display time range, e.g. "9:00 AM – 10:30 AM" (editorial string). */
  time?: string;
  /** Machine start, 24h local "09:00" — powers the .ics download only. */
  startTime?: string;
  /** Machine end, 24h local "10:30". Missing → .ics assumes 60 minutes. */
  endTime?: string;
  /** Session title (one line). */
  title: string;
  /** Room / location label. */
  room?: string;
  /** Session type chip, e.g. "Workshop". */
  sessionType?: string;
  /** Track chip, e.g. "Operations". */
  track?: string;
  /** Short session description (2–3 sentences max). */
  description?: string;
  /** Per-account "why this matters" line — the personalized part. */
  whyAttend?: string;
  /** Speakers shown under the card. */
  speakers?: EvaSpeaker[];
  /** Reserved slot (account-team 1:1, dinner) — badged, always kept. */
  isReserved?: boolean;
}

export interface EvaDay {
  /** Day heading, e.g. "Tuesday, Oct 20". */
  label: string;
  /** Machine calendar date, ISO "2026-10-20" — powers the .ics download only. */
  date?: string;
  /** Optional one-line summary under the day heading. */
  summary?: string;
  sessions: EvaSession[];
}

export interface EventAgendaBlockProps extends CtaModalConfig, HeroCtaConfig {
  /* ── palette overrides (all optional; brand-derived defaults) ─────────── */
  /** Page surface. Defaults to the brand page background (or warm cream). */
  bgColor?: string;
  /** Body ink override — honored only when it meets AA on the surface. */
  inkColor?: string;
  /** Display-heading ink on light surfaces. */
  headlineColor?: string;
  /** Accent — time rail, chips, links. Defaults to the brand accent. */
  accentColor?: string;
  /** Dark hero / close surface. Defaults to a deep mix of brand primary. */
  heroBgColor?: string;

  /* ── navbar ───────────────────────────────────────────────────────────── */
  /** Show the slim top navbar over the hero. Default true. */
  showNavbar?: boolean;
  /** 0–4 navbar anchor links. */
  navLinks?: MicrositeNavLink[];
  navCtaText?: string;
  navCtaUrl?: string;
  /** Optional account (co-brand) logo in the navbar lockup. */
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  /** Tenant logo override (falls back to the brand logo). */
  logoUrl?: string;
  logoAlt?: string;

  /* ── 1. hero ──────────────────────────────────────────────────────────── */
  /** Event lockup line, e.g. "Summit 2026 · Austin, TX · Mar 10–12, 2026". */
  eyebrow: string;
  /** The page's only h1, e.g. "{{company_name}}, your agenda is ready". */
  headline: string;
  /** One sentence under the h1. */
  subheadline?: string;
  /** Account display name used in copy. */
  accountName: string;
  /** Event name (used in meta chips + close). */
  eventName?: string;
  eventLocation?: string;
  /** Preformatted date range, e.g. "Mar 10–12, 2026". */
  eventDates?: string;
  /** Session count chip; hidden when 0/absent. */
  sessionCount?: number;

  /* ── 2. personal note ─────────────────────────────────────────────────── */
  showNote?: boolean;
  noteKicker?: string;
  /** The letter body (multi-line). Section hidden when empty. */
  personalNote?: string;
  /** Signature line, e.g. "— Maya, Jordan, and your account team". */
  noteSignature?: string;

  /* ── 3. schedule ──────────────────────────────────────────────────────── */
  scheduleKicker?: string;
  scheduleHeading?: string;
  scheduleIntro?: string;
  days: EvaDay[];
  /** Label on the per-session personalized callout. */
  whyAttendLabel?: string;
  /**
   * "Add to calendar" (.ics) hero button. Default on, but only rendered when
   * at least one session carries machine-readable date + start time.
   */
  showAddToCalendar?: boolean;

  /* ── 4. RSVP ──────────────────────────────────────────────────────────── */
  /**
   * Inline RSVP capture (name + email → the standard lead pipeline). Default
   * OFF for hand-authored pages; the agenda publish route turns it on.
   */
  showRsvp?: boolean;
  rsvpKicker?: string;
  rsvpHeading?: string;
  rsvpSubheadline?: string;
  rsvpButtonText?: string;
  /** Replaces the form after a successful submit. */
  rsvpConfirmation?: string;

  /* ── 5. close ─────────────────────────────────────────────────────────── */
  showClose?: boolean;
  ctaHeadline?: string;
  ctaSubheadline?: string;
  /** Close CTA label lives in `ctaText` (HeroCtaConfig); href in `ctaUrl`. */
  footerNote?: string;
}

export const EVENT_AGENDA_DEFAULT_PROPS: EventAgendaBlockProps = {
  /* CTA suite (HeroCtaConfig) */
  ctaText: "Get in touch",
  ctaUrl: "#contact",
  ctaAction: "url",

  /* navbar */
  showNavbar: true,
  navLinks: [
    { label: "Your note", href: "#note" },
    { label: "Schedule", href: "#schedule" },
    { label: "Contact", href: "#contact" },
  ],
  navCtaText: "Get in touch",
  navCtaUrl: "#contact",

  /* hero */
  eyebrow: "Summit 2026 · Austin, TX · Mar 10–12, 2026",
  headline: "Your team, your agenda",
  subheadline:
    "A schedule curated for your leadership team — every session below was picked with your goals in mind.",
  accountName: "Your company",
  eventName: "Summit 2026",
  eventLocation: "Austin, TX",
  eventDates: "Mar 10–12, 2026",
  sessionCount: 5,

  /* note */
  showNote: true,
  noteKicker: "A note from your account team",
  personalNote:
    "We built this agenda around the conversations we've been having with your team this year. The operations track on day one maps to your rollout plans, and we've reserved time on day two for a working session with our product leadership. Come find us at any point — this event is yours.",
  noteSignature: "— Your account team",

  /* schedule */
  scheduleKicker: "Your schedule",
  scheduleHeading: "Day by day",
  scheduleIntro: "Reserved sessions are held for your team — everything else is our best recommendation, and you're free to trade.",
  whyAttendLabel: "Why this matters for you",
  days: [
    {
      label: "Tuesday, Mar 10",
      date: "2026-03-10",
      summary: "Operations focus + your welcome dinner",
      sessions: [
        {
          time: "9:00 AM – 10:00 AM",
          startTime: "09:00",
          endTime: "10:00",
          title: "Opening keynote: the year ahead",
          sessionType: "Keynote",
          room: "Main stage",
          description: "Where the platform is going and what's shipping this year.",
          whyAttend: "The roadmap segments cover the capabilities your team asked about last quarter.",
          speakers: [{ name: "Alex Rivera", title: "CEO" }],
        },
        {
          time: "11:30 AM – 12:30 PM",
          startTime: "11:30",
          endTime: "12:30",
          title: "Scaling operations across every location",
          sessionType: "Breakout",
          track: "Operations",
          room: "Room 204",
          description: "How multi-site teams standardize workflows without slowing local teams down.",
          whyAttend: "Directly relevant to your rollout — the presenting team runs a network about your size.",
        },
        {
          time: "6:30 PM",
          startTime: "18:30",
          title: "Welcome dinner with your account team",
          sessionType: "Reserved",
          room: "The Terrace",
          isReserved: true,
        },
      ],
    },
    {
      label: "Wednesday, Mar 11",
      date: "2026-03-11",
      summary: "Working sessions + executive time",
      sessions: [
        {
          time: "10:00 AM – 11:00 AM",
          startTime: "10:00",
          endTime: "11:00",
          title: "Working session with product leadership",
          sessionType: "Reserved",
          room: "Boardroom 3",
          description: "A private session on your priorities for the next two quarters.",
          isReserved: true,
        },
        {
          time: "2:00 PM – 3:00 PM",
          startTime: "14:00",
          endTime: "15:00",
          title: "Executive roundtable: measuring what matters",
          sessionType: "Roundtable",
          track: "Leadership",
          room: "Salon B",
          whyAttend: "Peer executives comparing the metrics they actually run on — worth your COO's hour.",
        },
      ],
    },
  ],

  /* rsvp — off by default; the sales publish route opts published agendas in */
  showRsvp: false,
  rsvpKicker: "RSVP",
  rsvpHeading: "Confirm your spot",
  rsvpSubheadline: "Tell us who's coming and we'll have everything ready — badges, reserved seats, and your dinner table.",
  rsvpButtonText: "Confirm my RSVP",
  rsvpConfirmation: "You're confirmed — we'll see you there.",

  /* close */
  showClose: true,
  ctaHeadline: "Questions before the event?",
  ctaSubheadline: "Your account team is one message away — we'll meet you at registration.",
  footerNote: "Prepared for your team. Session times subject to the event's final schedule.",
};

interface Props {
  props: EventAgendaBlockProps;
  /** Tenant brand config — drives default palette, fonts, and logos. */
  brand?: BrandConfig;
  /** Optional CTA click handler (analytics / builder preview) for url-mode CTAs. */
  onCtaClick?: () => void;
  /** Builder inline-edit hook. When present, key copy is click-to-edit. */
  onFieldChange?: (updated: EventAgendaBlockProps) => void;
  pageId?: number;
  variantId?: number;
}

export function BlockEventAgenda({ props, brand, onCtaClick, onFieldChange, pageId, variantId }: Props) {
  const reduced = useReducedMotion() ?? false;
  // Fail-open reveal — see lib/reveal-fallback.ts.
  const anim = useAnimInitial();
  const pageCtx = usePageContext();
  const effectivePageId = pageId ?? pageCtx.pageId;
  const effectiveVariantId = variantId ?? pageCtx.variantId;

  /* — palette (brand-absorbed, contrast-guarded) — */
  const bg =
    props.bgColor && isValidHex(props.bgColor)
      ? props.bgColor
      : brand?.pageBackground && isValidHex(brand.pageBackground)
        ? brand.pageBackground
        : "#F7F4EC";
  const ink = resolveSectionInk({ textColor: props.inkColor }, { base: bg });
  const surfaceIsDark = relativeLuminance(isValidHex(bg) ? bg : "#ffffff") < 0.4;

  const cardBg =
    brand?.cardBackground && isValidHex(brand.cardBackground)
      ? brand.cardBackground
      : surfaceIsDark
        ? mixHex("#FFFFFF", bg, 0.08)
        : "#FFFFFF";
  const cardInk = resolveSectionInk({ textColor: props.inkColor }, { base: cardBg });

  const headline = pickContrastingColor(
    props.headlineColor,
    bg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#221E3F", ink.text],
    4.5,
  );
  const headlineOnCard = pickContrastingColor(
    props.headlineColor,
    cardBg,
    [brand?.headingOnLightColor, brand?.primaryColor, "#221E3F", cardInk.text],
    4.5,
  );

  const accentRaw =
    props.accentColor && isValidHex(props.accentColor)
      ? props.accentColor
      : brand?.accentColor && isValidHex(brand.accentColor)
        ? brand.accentColor
        : "#4B47E5";
  const accentText = pickContrastingColor(accentRaw, bg, [brand?.primaryColor, headline], 4.5);
  const accentChrome = ensureAccentRegisters(accentRaw, { base: bg }, 1.6);
  const accentOnCard = pickContrastingColor(accentRaw, cardBg, [brand?.primaryColor, headlineOnCard], 4.5);

  /* — dark hero / close surface — */
  const heroBg = resolveDarkHeroSurface(brand, props.heroBgColor, isValidHex, "#100E24", "#221E3F");
  const heroInk = resolveSectionInk({}, { base: heroBg });
  const heroChrome = heroChromeInk(heroBg);
  const heroAccent = pickContrastingColor(accentRaw, heroBg, [heroInk.text], 4.5);
  // Near-white ink candidates come BEFORE the accent on dark surfaces so brands
  // without headingOnDarkColor never get a dim accent-colored h1.
  const heroHeadline = pickContrastingColor(
    brand?.headingOnDarkColor,
    heroBg,
    [heroInk.text, "#FFFFFF", heroAccent],
    4.5,
  );
  const navCtaBg = pickContrastingColor(
    brand?.ctaBackground,
    heroBg,
    [accentRaw, brand?.primaryColor, "#FFFFFF"],
    3.0,
  );
  const navCtaTextColor = pickContrastingColor(brand?.ctaText, navCtaBg, [contrastTextColor(navCtaBg)], 4.5);
  const closeCtaBg = navCtaBg;
  const closeCtaText = navCtaTextColor;
  const rsvpBtnBg = pickContrastingColor(brand?.ctaBackground, cardBg, [accentRaw, brand?.primaryColor, "#221E3F"], 3.0);
  const rsvpBtnText = pickContrastingColor(brand?.ctaText, rsvpBtnBg, [contrastTextColor(rsvpBtnBg)], 4.5);

  /* — builder edit plumbing — */
  const set = onFieldChange
    ? <K extends keyof EventAgendaBlockProps>(key: K, value: EventAgendaBlockProps[K]) =>
        onFieldChange({ ...props, [key]: value })
    : undefined;
  const edit = (key: keyof EventAgendaBlockProps) =>
    set ? (v: string) => set(key, v as never) : undefined;
  const setDay = set
    ? (i: number, patch: Partial<EvaDay>) =>
        set("days", props.days.map((d, j) => (j === i ? { ...d, ...patch } : d)))
    : undefined;
  const setSession = set
    ? (dayIdx: number, i: number, patch: Partial<EvaSession>) =>
        set(
          "days",
          props.days.map((d, j) =>
            j === dayIdx
              ? { ...d, sessions: d.sessions.map((s, k) => (k === i ? { ...s, ...patch } : s)) }
              : d,
          ),
        )
    : undefined;
  const isEditor = !!onFieldChange;

  /* — RSVP capture (standard lead pipeline, mirrors BlockEventPage) — */
  const showRsvp = props.showRsvp === true;
  const [rsvp, setRsvp] = useState({ firstName: "", lastName: "", email: "", website: "" });
  const [rsvpStatus, setRsvpStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const submitRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rsvpStatus === "sending" || rsvpStatus === "done") return;
    // Honeypot: bots fill the hidden field — swallow silently.
    if (rsvp.website.trim()) { setRsvpStatus("done"); return; }
    const email = rsvp.email.trim();
    if (!email) return;
    setRsvpStatus("sending");
    const fields: Record<string, string> = {
      "First Name": rsvp.firstName.trim(),
      "Last Name": rsvp.lastName.trim(),
      Email: email,
      Source: "Agenda RSVP",
    };
    if (props.eventName?.trim()) fields.Event = props.eventName.trim();
    if (props.accountName?.trim()) fields.Account = props.accountName.trim();
    try {
      // Builder canvas / preview (no page id) confirms without posting —
      // same silent-skip contract as BlockEventPage.
      if (effectivePageId != null && !isEditor) {
        const resp = await fetch("/api/lp/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields,
            pageId: effectivePageId,
            ...(effectiveVariantId != null ? { variantId: effectiveVariantId } : {}),
            ...(pageCtx.sessionId ? { sessionId: pageCtx.sessionId } : {}),
          }),
        });
        if (!resp.ok) throw new Error("Submission failed");
        try {
          // Omit testId/variantId outside A/B renders — a zero id violates
          // the FK and silently drops the conversion (BlockEventPage lesson).
          const trackBody: Record<string, unknown> = {
            sessionId: pageCtx.sessionId ?? `anon-${Date.now()}`,
            eventType: "conversion",
            conversionType: "form_submit",
            pageId: effectivePageId,
          };
          if (pageCtx.testId != null) trackBody.testId = pageCtx.testId;
          if (effectiveVariantId != null) trackBody.variantId = effectiveVariantId;
          await fetch("/api/lp/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trackBody),
          });
        } catch (err) {
          console.error("[event-agenda] RSVP tracking error:", err);
        }
      }
      setRsvpStatus("done");
    } catch {
      setRsvpStatus("error");
    }
  };

  const days = props.days.filter((d) => d.sessions.length > 0 || isEditor);
  const sessionTotal =
    typeof props.sessionCount === "number" && props.sessionCount > 0
      ? props.sessionCount
      : props.days.reduce((n, d) => n + d.sessions.length, 0);
  const showNote = props.showNote !== false && (!!props.personalNote?.trim() || isEditor);
  const showClose = props.showClose !== false;

  /* — add-to-calendar (.ics) — only when machine schedule data exists — */
  const calendarReady = props.showAddToCalendar !== false && agendaHasCalendarData(props.days);
  const downloadIcs = () => {
    if (typeof document === "undefined") return;
    const ics = buildAgendaIcs(
      { eventName: props.eventName, eventLocation: props.eventLocation, days: props.days },
      { uidSeed: [props.accountName, props.eventName].filter(Boolean).join(" ") },
    );
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = agendaIcsFilename(props.eventName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const metaChips = [
    sessionTotal > 0 ? `${sessionTotal} session${sessionTotal === 1 ? "" : "s"}` : "",
    days.length > 0 ? `${days.length} day${days.length === 1 ? "" : "s"}` : "",
    props.eventLocation ?? "",
  ].filter(Boolean);

  const fadeUp = (delay = 0) => ({
    initial: reduced ? false : anim({ opacity: 0, y: 16 }),
    whileInView: reduced ? undefined : ({ opacity: 1, y: 0 } as const),
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  const kickerClass = "text-[11px] font-bold uppercase tracking-[0.22em]";

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const chip = (label: string, key: string, emphasized = false) => (
    <span
      key={key}
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={
        emphasized
          ? { background: mixHex(accentChrome, cardBg, 0.14), color: accentOnCard }
          : { border: `1px solid ${mixHex(cardInk.text, cardBg, 0.25)}`, color: cardInk.muted }
      }
    >
      {label}
    </span>
  );

  return (
    <section className="relative w-full" style={{ background: bg, fontFamily: BODY }}>
      {/* ── 1. hero ─────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden" style={{ background: heroBg }}>
        <DarkHeroBackdrop
          surface={heroBg}
          accent={accentRaw}
          primary={brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#221E3F"}
          isStatic={reduced || isEditor}
          idPrefix="evtag"
        />
        {props.showNavbar !== false && (
          <MicrositeNavbar
            brand={brand}
            logoUrl={props.logoUrl}
            logoAlt={props.logoAlt}
            accountLogoUrl={props.accountLogoUrl}
            accountLogoAlt={props.accountLogoAlt || props.accountName}
            links={props.navLinks ?? EVENT_AGENDA_DEFAULT_PROPS.navLinks ?? []}
            ctaText={props.navCtaText ?? props.ctaText}
            ctaUrl={props.navCtaUrl || props.ctaUrl || "#contact"}
            ctaBg={navCtaBg}
            ctaText_color={navCtaTextColor}
            heroSurface={heroBg}
            isDark
            ink={heroChrome.ink}
            inkMuted={heroChrome.muted}
            accent={heroAccent}
            onAnchor={handleAnchor}
          />
        )}

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-16 lg:px-10">
          <motion.p {...fadeUp(0)} className={kickerClass} style={{ color: heroAccent }}>
            <InlineText as="span" value={props.eyebrow} onUpdate={edit("eyebrow")} />
          </motion.p>
          <motion.h1
            {...fadeUp(0.08)}
            className="mt-5 max-w-3xl text-balance font-bold"
            style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(2.4rem, 5.4vw, 4rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: heroHeadline,
            }}
          >
            <InlineText as="span" value={props.headline} onUpdate={edit("headline")} />
          </motion.h1>
          {(props.subheadline || isEditor) && (
            <motion.p
              {...fadeUp(0.16)}
              className="mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl"
              style={{ color: heroInk.muted }}
            >
              <InlineText as="span" multiline value={props.subheadline ?? ""} onUpdate={edit("subheadline")} />
            </motion.p>
          )}
          {metaChips.length > 0 && (
            <motion.div {...fadeUp(0.22)} className="mt-8 flex flex-wrap items-center gap-2.5">
              {metaChips.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
                  style={{
                    border: `1px solid ${mixHex(heroInk.text, heroBg, 0.3)}`,
                    color: heroInk.text,
                    background: mixHex(heroInk.text, heroBg, 0.06),
                  }}
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: heroAccent }} />
                  {label}
                </span>
              ))}
            </motion.div>
          )}
          <motion.div {...fadeUp(0.28)} className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a
              href="#schedule"
              onClick={(e) => handleAnchor(e, "#schedule")}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              style={{ color: heroAccent }}
            >
              See your schedule
              <span aria-hidden>↓</span>
            </a>
            {calendarReady && (
              <button
                type="button"
                onClick={downloadIcs}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                style={{
                  border: `1px solid ${mixHex(heroInk.text, heroBg, 0.35)}`,
                  color: heroInk.text,
                  background: mixHex(heroInk.text, heroBg, 0.06),
                }}
              >
                <span aria-hidden>＋</span>
                Add to calendar
              </button>
            )}
          </motion.div>
        </div>
      </header>

      {/* ── 2. personal note ────────────────────────────────────────────── */}
      {showNote && (
        <div id="note" className="mx-auto w-full max-w-4xl px-5 pt-16 sm:px-8 sm:pt-20 lg:px-10">
          <motion.figure
            {...fadeUp(0)}
            className="rounded-2xl px-7 py-8 sm:px-10 sm:py-10"
            style={{
              background: cardBg,
              border: `1px solid ${mixHex(cardInk.text, cardBg, 0.15)}`,
              boxShadow: "0 24px 48px -32px rgba(28, 25, 23, 0.28)",
            }}
          >
            <figcaption className={kickerClass} style={{ color: accentOnCard }}>
              <InlineText as="span" value={props.noteKicker ?? "A note from your account team"} onUpdate={edit("noteKicker")} />
            </figcaption>
            <blockquote
              className="mt-5 whitespace-pre-line text-lg leading-relaxed sm:text-xl"
              style={{ color: cardInk.text, fontFamily: DISPLAY }}
            >
              <InlineText as="span" multiline value={props.personalNote ?? ""} onUpdate={edit("personalNote")} />
            </blockquote>
            {(props.noteSignature || isEditor) && (
              <p className="mt-6 text-base font-semibold" style={{ color: cardInk.muted }}>
                <InlineText as="span" value={props.noteSignature ?? ""} onUpdate={edit("noteSignature")} />
              </p>
            )}
          </motion.figure>
        </div>
      )}

      {/* ── 3. schedule ─────────────────────────────────────────────────── */}
      <div id="schedule" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <motion.p {...fadeUp(0)} className={kickerClass} style={{ color: accentText }}>
          <InlineText as="span" value={props.scheduleKicker ?? "Your schedule"} onUpdate={edit("scheduleKicker")} />
        </motion.p>
        <motion.h2
          {...fadeUp(0.06)}
          className="mt-4 max-w-2xl font-bold"
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: headline,
          }}
        >
          <InlineText as="span" value={props.scheduleHeading ?? "Day by day"} onUpdate={edit("scheduleHeading")} />
        </motion.h2>
        {(props.scheduleIntro || isEditor) && (
          <motion.p {...fadeUp(0.12)} className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: ink.muted }}>
            <InlineText as="span" multiline value={props.scheduleIntro ?? ""} onUpdate={edit("scheduleIntro")} />
          </motion.p>
        )}

        <div className="mt-12 space-y-14">
          {days.map((day, dayIdx) => (
            <div key={dayIdx}>
              {/* Day header */}
              <motion.div {...fadeUp(0)} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: accentText, fontFamily: BODY, letterSpacing: "0.08em" }}
                >
                  {String(dayIdx + 1).padStart(2, "0")}
                </span>
                <h3
                  className="font-bold"
                  style={{ fontFamily: DISPLAY, fontSize: "clamp(1.35rem, 2.4vw, 1.8rem)", letterSpacing: "-0.015em", color: headline }}
                >
                  <InlineText as="span" value={day.label} onUpdate={setDay ? (v) => setDay(dayIdx, { label: v }) : undefined} />
                </h3>
                {(day.summary || isEditor) && (
                  <p className="text-base" style={{ color: ink.muted }}>
                    <InlineText as="span" value={day.summary ?? ""} onUpdate={setDay ? (v) => setDay(dayIdx, { summary: v }) : undefined} />
                  </p>
                )}
              </motion.div>
              <div aria-hidden className="mt-4 h-px w-full" style={{ background: mixHex(ink.text, bg, 0.18) }} />

              {/* Sessions */}
              <ul className="mt-6 space-y-5">
                {day.sessions.map((session, i) => (
                  <motion.li key={i} {...fadeUp(Math.min(i * 0.05, 0.2))}>
                    <article
                      className="grid gap-x-8 gap-y-3 rounded-2xl px-6 py-6 sm:grid-cols-[9.5rem_1fr] sm:px-8"
                      style={{
                        background: cardBg,
                        border: `1px solid ${
                          session.isReserved ? mixHex(accentChrome, cardBg, 0.5) : mixHex(cardInk.text, cardBg, 0.14)
                        }`,
                      }}
                    >
                      {/* time rail */}
                      <div className="flex sm:block">
                        <p
                          className="text-sm font-bold tabular-nums leading-6"
                          style={{ color: session.isReserved ? accentOnCard : cardInk.text }}
                        >
                          <InlineText
                            as="span"
                            value={session.time ?? ""}
                            onUpdate={setSession ? (v) => setSession(dayIdx, i, { time: v }) : undefined}
                          />
                        </p>
                        {session.room && (
                          <p className="ml-3 text-sm leading-6 sm:ml-0 sm:mt-1" style={{ color: cardInk.muted }}>
                            {session.room}
                          </p>
                        )}
                      </div>

                      {/* body */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {session.isReserved && chip("Reserved for you", "reserved", true)}
                          {session.sessionType && !session.isReserved && chip(session.sessionType, "type")}
                          {session.track && chip(session.track, "track")}
                        </div>
                        <h4
                          className="mt-2.5 font-bold"
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: "clamp(1.1rem, 1.8vw, 1.35rem)",
                            lineHeight: 1.25,
                            letterSpacing: "-0.01em",
                            color: headlineOnCard,
                          }}
                        >
                          <InlineText
                            as="span"
                            value={session.title}
                            onUpdate={setSession ? (v) => setSession(dayIdx, i, { title: v }) : undefined}
                          />
                        </h4>
                        {(session.description || isEditor) && (
                          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed" style={{ color: cardInk.muted }}>
                            <InlineText
                              as="span"
                              multiline
                              value={session.description ?? ""}
                              onUpdate={setSession ? (v) => setSession(dayIdx, i, { description: v }) : undefined}
                            />
                          </p>
                        )}
                        {(session.whyAttend || isEditor) && (
                          <div
                            className="mt-4 max-w-2xl rounded-lg px-4 py-3"
                            style={{ background: mixHex(accentChrome, cardBg, 0.08) }}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accentOnCard }}>
                              {props.whyAttendLabel ?? "Why this matters for you"}
                            </p>
                            <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: cardInk.text }}>
                              <InlineText
                                as="span"
                                multiline
                                value={session.whyAttend ?? ""}
                                onUpdate={setSession ? (v) => setSession(dayIdx, i, { whyAttend: v }) : undefined}
                              />
                            </p>
                          </div>
                        )}
                        {!!session.speakers?.length && (
                          <p className="mt-3.5 text-sm" style={{ color: cardInk.muted }}>
                            {session.speakers.map((sp, k) => (
                              <span key={k}>
                                <span className="font-semibold" style={{ color: cardInk.text }}>
                                  {sp.name}
                                </span>
                                {sp.title ? ` · ${sp.title}` : ""}
                                {k < (session.speakers?.length ?? 0) - 1 ? "  ·  " : ""}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </article>
                  </motion.li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. RSVP ─────────────────────────────────────────────────────── */}
      {showRsvp && (
        <div id="rsvp" className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10">
          <motion.div
            {...fadeUp(0)}
            className="rounded-2xl px-7 py-8 sm:px-10 sm:py-10"
            style={{
              background: cardBg,
              border: `1px solid ${mixHex(accentChrome, cardBg, 0.35)}`,
              boxShadow: "0 24px 48px -32px rgba(28, 25, 23, 0.28)",
            }}
          >
            <p className={kickerClass} style={{ color: accentOnCard }}>
              <InlineText as="span" value={props.rsvpKicker ?? "RSVP"} onUpdate={edit("rsvpKicker")} />
            </p>
            <h2
              className="mt-4 font-bold"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: headlineOnCard,
              }}
            >
              <InlineText as="span" value={props.rsvpHeading ?? "Confirm your spot"} onUpdate={edit("rsvpHeading")} />
            </h2>
            {(props.rsvpSubheadline || isEditor) && (
              <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: cardInk.muted }}>
                <InlineText as="span" multiline value={props.rsvpSubheadline ?? ""} onUpdate={edit("rsvpSubheadline")} />
              </p>
            )}
            {rsvpStatus === "done" ? (
              <p
                className="mt-6 rounded-lg px-4 py-3.5 text-base font-semibold"
                style={{ background: mixHex(accentChrome, cardBg, 0.1), color: cardInk.text }}
                role="status"
              >
                {props.rsvpConfirmation ?? "You're confirmed — we'll see you there."}
              </p>
            ) : (
              <form onSubmit={submitRsvp} className="mt-6">
                {/* Honeypot — visually hidden, tab-skipped. */}
                <input
                  type="text"
                  name="website"
                  value={rsvp.website}
                  onChange={(e) => setRsvp((r) => ({ ...r, website: e.target.value }))}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute h-0 w-0 overflow-hidden opacity-0"
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
                  {(
                    [
                      { key: "firstName", label: "First name", type: "text", required: true, auto: "given-name" },
                      { key: "lastName", label: "Last name", type: "text", required: false, auto: "family-name" },
                      { key: "email", label: "Work email", type: "email", required: true, auto: "email" },
                    ] as const
                  ).map((f) => (
                    <input
                      key={f.key}
                      type={f.type}
                      value={rsvp[f.key]}
                      onChange={(e) => setRsvp((r) => ({ ...r, [f.key]: e.target.value }))}
                      placeholder={f.label}
                      aria-label={f.label}
                      required={f.required}
                      autoComplete={f.auto}
                      className="w-full rounded-lg px-4 py-3 text-[15px] outline-none transition-shadow focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
                      style={{
                        background: mixHex(cardInk.text, cardBg, 0.04),
                        border: `1px solid ${mixHex(cardInk.text, cardBg, 0.25)}`,
                        color: cardInk.text,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={rsvpStatus === "sending"}
                    className="inline-flex items-center justify-center rounded-full px-7 py-3 text-base font-bold transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
                    style={{ background: rsvpBtnBg, color: rsvpBtnText }}
                  >
                    {rsvpStatus === "sending" ? "Sending…" : props.rsvpButtonText ?? "Confirm my RSVP"}
                  </button>
                  {rsvpStatus === "error" && (
                    <p className="text-sm font-semibold" role="alert" style={{ color: cardInk.text }}>
                      Something went wrong — please try again.
                    </p>
                  )}
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* ── 5. close ────────────────────────────────────────────────────── */}
      {showClose && (
        <div id="contact" className="relative overflow-hidden" style={{ background: heroBg }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(70% 60% at 50% 0%, ${mixHex(accentRaw, heroBg, 0.14)} 0%, transparent 60%)`,
            }}
          />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-16 text-center sm:px-8 sm:py-20 lg:px-10">
            <motion.h2
              {...fadeUp(0)}
              className="text-balance font-bold"
              style={{
                fontFamily: DISPLAY,
                fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: heroHeadline,
              }}
            >
              <InlineText as="span" value={props.ctaHeadline ?? "Questions before the event?"} onUpdate={edit("ctaHeadline")} />
            </motion.h2>
            {(props.ctaSubheadline || isEditor) && (
              <motion.p {...fadeUp(0.08)} className="mx-auto mt-4 max-w-xl text-lg leading-relaxed" style={{ color: heroInk.muted }}>
                <InlineText as="span" multiline value={props.ctaSubheadline ?? ""} onUpdate={edit("ctaSubheadline")} />
              </motion.p>
            )}
            {!!props.ctaText && (
              <motion.div {...fadeUp(0.14)} className="mt-9">
                <CtaButton
                  {...pickCtaModalConfig(props)}
                  ctaAction={props.ctaAction}
                  ctaUrl={props.ctaUrl}
                  chilipiperUrl={props.chilipiperUrl}
                  onClick={onCtaClick}
                  brand={brand}
                  pageId={pageId}
                  variantId={variantId}
                  source="event-agenda-close"
                  className="inline-flex items-center justify-center rounded-full px-8 py-3.5 text-base font-bold transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                  style={{ background: closeCtaBg, color: closeCtaText }}
                >
                  {props.ctaText}
                </CtaButton>
              </motion.div>
            )}
            {(props.footerNote || isEditor) && (
              <motion.p {...fadeUp(0.2)} className="mt-9 text-sm" style={{ color: heroInk.muted }}>
                <InlineText as="span" value={props.footerNote ?? ""} onUpdate={edit("footerNote")} />
              </motion.p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
