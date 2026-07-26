import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarPlus } from "lucide-react";
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
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import type { CtaModalConfig, HeroCtaConfig, FormStep } from "@/lib/block-types";
import { pickCtaModalConfig } from "@/lib/cta-modal";
import {
  buildGlobalFormSubmissionFields,
  evalCondition,
} from "@/lib/global-form-submission";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK, BRAND_NUMBERS_STACK } from "@/lib/brand-fonts";
import {
  DarkHeroBackdrop,
  MicrositeNavbar,
  heroChromeInk,
  resolveDarkHeroSurface,
  resolveHeroLayout,
  type HeroLayout,
  type MicrositeNavLink,
} from "./microsite-chrome";
import { agendaHasCalendarData, agendaIcsFilename, buildAgendaIcs } from "@/lib/agenda-ics";

const DISPLAY = BRAND_DISPLAY_STACK;
const BODY = BRAND_BODY_STACK;
const NUMBERS = BRAND_NUMBERS_STACK;

/* ----------------------------------------------------------------------------
 * Event Agenda — type "event-agenda"
 *
 * ABM full-page conference agenda: the page a rep publishes per strategic
 * account instead of hand-building a PowerPoint. A dark branded hero (optional
 * editorial image panel; the whole hero can be turned OFF so a page composes
 * its own hero above the schedule), a personal-note letter, an editorial
 * day-by-day timeline (ghost day numerals, accent time rail, hairline session
 * rows — reserved sessions elevated as concierge cards), per-session and
 * whole-agenda add-to-calendar, an RSVP section that either captures
 * name+email inline or renders a LINKED GLOBAL FORM (rsvpFormId — submissions
 * flow through the form's own field definitions, notifications, and
 * integrations via the shared global-form helpers), and a contact close with
 * a "prepared by" brand lockup.
 *
 * Register: a printed itinerary from a five-star hotel — calm cream canvas,
 * ink hairlines, one accent, serif display. Editorial rows, not card grids.
 * All schedule content is editorial strings assembled by the publish route
 * (routes/sales/events.ts); every optional section is render-guarded so
 * saved pages keep rendering. Single h1 (hero; a hidden hero promotes nothing
 * — the schedule heading stays h2 because the composing page brings its own
 * h1). NO_REVEAL — owns its own motion (fail-open per lib/reveal-fallback.ts).
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
  /** Machine start, 24h local "09:00" — powers the .ics downloads only. */
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
  /** Machine calendar date, ISO "2026-10-20" — powers the .ics downloads only. */
  date?: string;
  /** Optional one-line summary under the day heading. */
  summary?: string;
  /** Optional editorial banner image under the day header (brand-scrimmed). */
  imageUrl?: string;
  imageAlt?: string;
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
  /**
   * Show the built-in hero band (and navbar). Turn OFF to compose your own
   * hero above this block and use only the note/schedule/RSVP/close sections.
   * Default true.
   */
  showHero?: boolean;
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
  /** Session count for the hero stat strip; hidden when 0/absent. */
  sessionCount?: number;
  /** Optional hero image. How it renders depends on `heroLayout`. */
  heroImageUrl?: string;
  heroImageAlt?: string;
  /**
   * Hero treatment: "split" = editorial image panel beside the copy;
   * "image-overlay" = full-bleed image behind the copy under a brand scrim;
   * "dark" = aurora band, image ignored. Defaults to "split" when an image
   * is set, "dark" otherwise (layouts needing an image fail closed to dark).
   */
  heroLayout?: HeroLayout;

  /* ── 2. personal note ─────────────────────────────────────────────────── */
  showNote?: boolean;
  noteKicker?: string;
  /** The letter body (multi-line). Section hidden when empty. */
  personalNote?: string;
  /** Signature line, e.g. "— Maya, Jordan, and your account team". */
  noteSignature?: string;
  /** Optional photo beside the letter (your account team, last year's dinner). */
  noteImageUrl?: string;
  noteImageAlt?: string;

  /* ── 3. schedule ──────────────────────────────────────────────────────── */
  scheduleKicker?: string;
  scheduleHeading?: string;
  scheduleIntro?: string;
  days: EvaDay[];
  /** Label on the per-session personalized callout. */
  whyAttendLabel?: string;
  /**
   * Add-to-calendar (.ics) affordances — the hero button for the whole agenda
   * AND the per-session buttons. Default on, but each only renders when the
   * session/agenda carries machine-readable date + start time.
   */
  showAddToCalendar?: boolean;

  /* ── 4. RSVP ──────────────────────────────────────────────────────────── */
  /**
   * Inline RSVP capture. Default OFF for hand-authored pages; the agenda
   * publish route turns it on.
   */
  showRsvp?: boolean;
  /**
   * Linked global form id. When set, the RSVP section renders THAT form's
   * fields and submits through its definitions (notifications, sheets, CRM
   * syncs all managed on the form) instead of the built-in name+email trio.
   */
  rsvpFormId?: number;
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
  /** "Prepared by" brand lockup in the close. Default true (hidden if no logo). */
  showPreparedBy?: boolean;
  /** Optional close background image (heavily scrimmed toward the dark surface). */
  closeImageUrl?: string;
  closeImageAlt?: string;
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
  showHero: true,
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

/** Minimal slice of the public /lp/forms/:id payload the RSVP renderer needs. */
interface LinkedRsvpForm {
  id: number;
  steps: FormStep[];
  submitButtonText?: string;
  successMessage?: string | null;
}

function downloadIcsBlob(ics: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const primaryHex = brand?.primaryColor && isValidHex(brand.primaryColor) ? brand.primaryColor : "#221E3F";

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
  // The RSVP form sits directly on the page surface (no card), so its button
  // resolves against `bg` — not cardBg.
  const rsvpBtnBg = pickContrastingColor(brand?.ctaBackground, bg, [accentRaw, brand?.primaryColor, "#221E3F"], 3.0);
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

  /* — RSVP: built-in capture or linked global form — */
  const showRsvp = props.showRsvp === true;
  const [rsvp, setRsvp] = useState({ firstName: "", lastName: "", email: "", website: "" });
  const [rsvpStatus, setRsvpStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [linkedForm, setLinkedForm] = useState<LinkedRsvpForm | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (!showRsvp || props.rsvpFormId == null) { setLinkedForm(null); return; }
    let cancelled = false;
    fetch(`/api/lp/forms/${props.rsvpFormId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LinkedRsvpForm | null) => { if (!cancelled) setLinkedForm(data); })
      .catch(() => { /* fall back to the built-in capture */ });
    return () => { cancelled = true; };
  }, [showRsvp, props.rsvpFormId]);

  // Linked-form fields, flattened across steps with step/field visibility
  // conditions honored live (shared evalCondition — never a local re-impl).
  const linkedVisibleFields = linkedForm
    ? linkedForm.steps.flatMap((step) =>
        step.condition && !evalCondition(step.condition, formValues)
          ? []
          : step.fields.filter(
              (f) =>
                f.type !== "hidden" &&
                (!f.visibilityCondition || evalCondition(f.visibilityCondition, formValues)),
            ),
      )
    : [];

  const postLead = async (fields: Record<string, string>, formId?: number) => {
    if (effectivePageId == null || isEditor) return; // builder/preview: confirm without posting
    const body: Record<string, unknown> = {
      fields,
      pageId: effectivePageId,
      ...(effectiveVariantId != null ? { variantId: effectiveVariantId } : {}),
      ...(pageCtx.sessionId ? { sessionId: pageCtx.sessionId } : {}),
    };
    if (formId != null) body.formId = formId;
    const resp = await fetch("/api/lp/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error("Submission failed");
    try {
      // Omit testId/variantId outside A/B renders — a zero id violates the FK
      // and silently drops the conversion (BlockEventPage lesson).
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
  };

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
      await postLead(fields);
      setRsvpStatus("done");
    } catch {
      setRsvpStatus("error");
    }
  };

  const submitLinkedRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedForm || rsvpStatus === "sending" || rsvpStatus === "done") return;
    if (rsvp.website.trim()) { setRsvpStatus("done"); return; }
    setRsvpStatus("sending");
    try {
      // Canonical payload: EVERY form field in definition order, hidden fields
      // resolved — byte-compatible with the form's own submissions so sheets/
      // CRM rows never land scrambled (see lib/global-form-submission.ts).
      const fields = buildGlobalFormSubmissionFields(linkedForm.steps, formValues);
      await postLead(fields, linkedForm.id);
      setRsvpStatus("done");
    } catch {
      setRsvpStatus("error");
    }
  };

  const showHero = props.showHero !== false;
  const days = props.days.filter((d) => d.sessions.length > 0 || isEditor);
  const sessionTotal =
    typeof props.sessionCount === "number" && props.sessionCount > 0
      ? props.sessionCount
      : props.days.reduce((n, d) => n + d.sessions.length, 0);
  const reservedTotal = props.days.reduce((n, d) => n + d.sessions.filter((s) => s.isReserved).length, 0);
  const showNote = props.showNote !== false && (!!props.personalNote?.trim() || isEditor);
  const showClose = props.showClose !== false;
  const hasHeroImage = !!props.heroImageUrl?.trim();
  // Fail-closed: image layouts without an image fall back to the dark band.
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const heroIsOverlay = heroLayout === "image-overlay";
  const heroIsSplit = heroLayout === "split" && hasHeroImage;

  /* — add-to-calendar (.ics) — only when machine schedule data exists — */
  const calendarEnabled = props.showAddToCalendar !== false;
  const calendarReady = calendarEnabled && agendaHasCalendarData(props.days);
  const downloadAgendaIcs = () => {
    const ics = buildAgendaIcs(
      { eventName: props.eventName, eventLocation: props.eventLocation, days: props.days },
      { uidSeed: [props.accountName, props.eventName].filter(Boolean).join(" ") },
    );
    if (ics) downloadIcsBlob(ics, agendaIcsFilename(props.eventName));
  };
  const downloadSessionIcs = (day: EvaDay, session: EvaSession) => {
    const ics = buildAgendaIcs(
      {
        eventName: props.eventName,
        eventLocation: props.eventLocation,
        days: [{ date: day.date, sessions: [session] }],
      },
      { uidSeed: [props.accountName, props.eventName, session.title].filter(Boolean).join(" ") },
    );
    if (ics) downloadIcsBlob(ics, agendaIcsFilename(session.title));
  };
  const sessionCalendarReady = (day: EvaDay, session: EvaSession) =>
    calendarEnabled && agendaHasCalendarData([{ date: day.date, sessions: [session] }]);

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

  /* — hero stat strip entries (editorial numerals, not pills) — */
  const heroStats = [
    sessionTotal > 0 ? { value: String(sessionTotal), label: sessionTotal === 1 ? "session picked for you" : "sessions picked for you" } : null,
    days.length > 0 ? { value: String(days.length), label: days.length === 1 ? "day" : "days" } : null,
    reservedTotal > 0 ? { value: String(reservedTotal), label: reservedTotal === 1 ? "reserved just for you" : "reserved just for you" } : null,
  ].filter((s): s is { value: string; label: string } => s !== null).slice(0, 3);

  /* — RSVP field rendering: underline-only inputs on the page surface with an
   *   accent rule that draws in on focus (the Event RSVP invitation register).
   *   Shared by the built-in capture and the linked-form renderer so the two
   *   are visually identical. — */
  const underlineInputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${mixHex(ink.text, bg, 0.22)}`,
    borderRadius: 0,
    color: ink.text,
    fontFamily: BODY,
    fontSize: "1rem",
    padding: "0.65rem 0",
    outline: "none",
  };

  function renderUnderlineField(f: {
    id: string;
    label: string;
    placeholder?: string;
    type?: string;
    required?: boolean;
    options?: string[];
    autoComplete?: string;
    value: string;
    onChange: (v: string) => void;
  }) {
    const focused = focusedField === f.id;
    const placeholder = f.placeholder || f.label;
    const common = {
      name: f.id,
      required: f.required,
      "aria-label": f.label,
      onFocus: () => setFocusedField(f.id),
      onBlur: () => setFocusedField(null),
      style: underlineInputStyle,
      className: "focus:outline-none",
    };

    if (f.type === "checkbox") {
      return (
        <label key={f.id} className="flex items-start gap-3 text-[15px]" style={{ color: ink.text }}>
          <input
            type="checkbox"
            name={f.id}
            checked={f.value === "Yes"}
            onChange={(e) => f.onChange(e.target.checked ? "Yes" : "")}
            required={f.required}
            className="mt-1"
          />
          <span>{f.label}</span>
        </label>
      );
    }

    return (
      <div key={f.id} className="relative">
        {/* tiny field label — the itinerary's engraved caption */}
        <span
          className="mb-1 block text-[10px] font-bold uppercase"
          style={{ color: ink.muted, letterSpacing: "0.2em" }}
        >
          {f.label}
          {f.required ? " *" : ""}
        </span>
        {f.type === "textarea" ? (
          <textarea
            {...common}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            style={{ ...underlineInputStyle, resize: "none" }}
          />
        ) : f.type === "select" ? (
          <select
            {...common}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            style={{ ...underlineInputStyle, appearance: "auto" }}
          >
            <option value="">{placeholder}</option>
            {(f.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={f.autoComplete}
          />
        )}
        {/* Accent rule draws in from the left on focus. Plain CSS transition,
            not framer: this is an interaction state (excluded from the reveal
            contract) and a compositor transition can't be stranded mid-flight
            the way an rAF-driven animation can. */}
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-px w-full"
          style={{
            background: accentChrome,
            transformOrigin: "left",
            transform: `scaleX(${focused ? 1 : 0})`,
            transition: reduced ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    );
  }

  return (
    <section className="relative w-full" style={{ background: bg, fontFamily: BODY }}>
      {/* ── 1. hero ─────────────────────────────────────────────────────── */}
      {showHero && (
        <header className="relative overflow-hidden" style={{ background: heroBg }}>
          {heroIsOverlay ? (
            /* full-bleed image under a brand scrim — left column stays readable,
               the image breathes on the right */
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <img
                src={props.heroImageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, ${heroBg}F5 0%, ${heroBg}E0 42%, ${mixHex(heroBg, primaryHex, 0.85)}66 100%), linear-gradient(to top, ${heroBg}F2 0%, transparent 45%)`,
                }}
              />
            </div>
          ) : (
            <DarkHeroBackdrop
              surface={heroBg}
              accent={accentRaw}
              primary={primaryHex}
              isStatic={reduced || isEditor}
              idPrefix="evtag"
            />
          )}
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

          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:px-10">
            <div className={heroIsSplit ? "grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]" : ""}>
              <div>
                {/* itinerary lockup line */}
                <motion.div {...fadeUp(0)} className="flex items-center gap-4">
                  <span aria-hidden className="h-px w-10" style={{ background: heroAccent }} />
                  <p className="text-[12px] font-bold uppercase tracking-[0.26em]" style={{ color: heroChrome.muted }}>
                    <InlineText as="span" value={props.eyebrow} onUpdate={edit("eyebrow")} />
                  </p>
                </motion.div>

                <motion.h1
                  {...fadeUp(0.08)}
                  className="mt-7 max-w-3xl text-balance font-bold"
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: heroIsSplit ? "clamp(2.4rem, 4.6vw, 3.9rem)" : "clamp(2.6rem, 5.8vw, 4.6rem)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.032em",
                    color: heroHeadline,
                  }}
                >
                  <InlineText as="span" value={props.headline} onUpdate={edit("headline")} />
                </motion.h1>

                {(props.subheadline || isEditor) && (
                  <motion.p
                    {...fadeUp(0.16)}
                    className="mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
                    style={{ color: heroInk.muted }}
                  >
                    <InlineText as="span" multiline value={props.subheadline ?? ""} onUpdate={edit("subheadline")} />
                  </motion.p>
                )}

                <motion.div {...fadeUp(0.24)} className="mt-10 flex flex-wrap items-center gap-4">
                  <a
                    href="#schedule"
                    onClick={(e) => handleAnchor(e, "#schedule")}
                    className="inline-flex items-center gap-2.5 rounded-full px-7 py-3 text-[15px] font-bold transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    style={{ background: navCtaBg, color: navCtaTextColor }}
                  >
                    See your schedule
                    <span aria-hidden>↓</span>
                  </a>
                  {calendarReady && (
                    <button
                      type="button"
                      onClick={downloadAgendaIcs}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                      style={{
                        border: `1px solid ${mixHex(heroInk.text, heroBg, 0.35)}`,
                        color: heroInk.text,
                      }}
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden />
                      Add all to calendar
                    </button>
                  )}
                </motion.div>

                {/* editorial stat strip */}
                {heroStats.length > 0 && (
                  <motion.dl
                    {...fadeUp(0.3)}
                    className="mt-12 flex flex-wrap items-stretch gap-x-10 gap-y-6 border-t pt-8"
                    style={{ borderColor: mixHex(heroInk.text, heroBg, 0.16) }}
                  >
                    {heroStats.map((stat) => (
                      <div key={stat.label} className="min-w-[7rem]">
                        <dd
                          className="font-bold tabular-nums"
                          style={{
                            fontFamily: NUMBERS,
                            fontSize: "clamp(2rem, 3.4vw, 2.8rem)",
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            color: heroHeadline,
                          }}
                        >
                          {stat.value}
                        </dd>
                        <dt className="mt-2 max-w-[11rem] text-[13px] leading-snug" style={{ color: heroInk.muted }}>
                          {stat.label}
                        </dt>
                      </div>
                    ))}
                    {props.eventLocation && (
                      <div className="min-w-[7rem]">
                        <dd
                          className="font-bold"
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: "clamp(1.3rem, 2vw, 1.7rem)",
                            lineHeight: 1.15,
                            letterSpacing: "-0.015em",
                            color: heroHeadline,
                            paddingTop: "0.35rem",
                          }}
                        >
                          {props.eventLocation}
                        </dd>
                        <dt className="mt-2 text-[13px] leading-snug" style={{ color: heroInk.muted }}>
                          {props.eventDates || "on location"}
                        </dt>
                      </div>
                    )}
                  </motion.dl>
                )}
              </div>

              {/* optional editorial image panel (split layout only) */}
              {heroIsSplit && (
                <motion.figure
                  {...fadeUp(0.18)}
                  className="relative hidden overflow-hidden rounded-2xl lg:block"
                  style={{ boxShadow: "0 40px 80px -48px rgba(0,0,0,0.65)" }}
                >
                  <img
                    src={props.heroImageUrl}
                    alt={props.heroImageAlt || props.eventName || "Event"}
                    className="h-full max-h-[520px] w-full object-cover"
                    loading="eager"
                  />
                  {/* brand duotone scrim so any photo sits in the palette */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `linear-gradient(160deg, ${mixHex(primaryHex, heroBg, 0.55)}33 0%, transparent 45%), linear-gradient(to top, ${heroBg}E6 0%, transparent 42%)`,
                    }}
                  />
                  <figcaption
                    className="absolute inset-x-0 bottom-0 px-6 pb-5 text-[12px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: heroChrome.ink }}
                  >
                    {[props.eventName, props.eventDates].filter(Boolean).join(" · ")}
                  </figcaption>
                </motion.figure>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ── 2. personal note ────────────────────────────────────────────── */}
      {showNote && (
        <div id="note" className={`mx-auto w-full max-w-4xl px-5 sm:px-8 lg:px-10 ${showHero ? "pt-16 sm:pt-20" : "pt-14 sm:pt-16"}`}>
          <motion.figure
            {...fadeUp(0)}
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: cardBg,
              border: `1px solid ${mixHex(cardInk.text, cardBg, 0.12)}`,
              boxShadow: "0 32px 64px -44px rgba(28, 25, 23, 0.35)",
            }}
          >
            <div className={props.noteImageUrl?.trim() ? "grid sm:grid-cols-[1fr_15rem]" : ""}>
              <div className="relative px-7 py-9 sm:px-12 sm:py-11">
                {/* oversized serif quote mark — letterpress, not clipart */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-6 top-2 select-none font-bold sm:left-8"
                  style={{ fontFamily: DISPLAY, fontSize: "5.5rem", lineHeight: 1, color: mixHex(accentChrome, cardBg, 0.22) }}
                >
                  &ldquo;
                </span>
                <figcaption className={`${kickerClass} relative`} style={{ color: accentOnCard }}>
                  <InlineText as="span" value={props.noteKicker ?? "A note from your account team"} onUpdate={edit("noteKicker")} />
                </figcaption>
                <blockquote
                  className="relative mt-6 whitespace-pre-line text-xl leading-relaxed sm:text-[1.45rem] sm:leading-[1.65]"
                  style={{ color: cardInk.text, fontFamily: DISPLAY, letterSpacing: "-0.005em" }}
                >
                  <InlineText as="span" multiline value={props.personalNote ?? ""} onUpdate={edit("personalNote")} />
                </blockquote>
                {(props.noteSignature || isEditor) && (
                  <p
                    className="relative mt-7 border-t pt-5 text-base font-semibold"
                    style={{ color: cardInk.muted, borderColor: mixHex(cardInk.text, cardBg, 0.12) }}
                  >
                    <InlineText as="span" value={props.noteSignature ?? ""} onUpdate={edit("noteSignature")} />
                  </p>
                )}
              </div>
              {/* optional team/venue photo — full-bleed column on the letter's edge */}
              {!!props.noteImageUrl?.trim() && (
                <div className="relative h-48 sm:h-auto">
                  <img
                    src={props.noteImageUrl}
                    alt={props.noteImageAlt || "Your account team"}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `linear-gradient(to right, ${cardBg} 0%, transparent 18%)` }}
                  />
                </div>
              )}
            </div>
          </motion.figure>
        </div>
      )}

      {/* ── 3. schedule ─────────────────────────────────────────────────── */}
      <div id="schedule" className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <motion.p {...fadeUp(0)} className={kickerClass} style={{ color: accentText }}>
          <InlineText as="span" value={props.scheduleKicker ?? "Your schedule"} onUpdate={edit("scheduleKicker")} />
        </motion.p>
        <motion.h2
          {...fadeUp(0.06)}
          className="mt-4 max-w-2xl font-bold"
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.024em",
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

        <div className="mt-14 space-y-16">
          {days.map((day, dayIdx) => (
            <div key={dayIdx} className="relative">
              {/* ghost day numeral */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 right-0 select-none font-bold tabular-nums sm:-top-10"
                style={{
                  fontFamily: NUMBERS,
                  fontSize: "clamp(4.5rem, 9vw, 7rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: mixHex(ink.text, bg, 0.07),
                }}
              >
                {String(dayIdx + 1).padStart(2, "0")}
              </span>

              {/* Day header */}
              <motion.div {...fadeUp(0)} className="relative">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3
                    className="font-bold"
                    style={{ fontFamily: DISPLAY, fontSize: "clamp(1.45rem, 2.6vw, 1.95rem)", letterSpacing: "-0.018em", color: headline }}
                  >
                    <InlineText as="span" value={day.label} onUpdate={setDay ? (v) => setDay(dayIdx, { label: v }) : undefined} />
                  </h3>
                  {(day.summary || isEditor) && (
                    <p className="text-base" style={{ color: ink.muted }}>
                      <InlineText as="span" value={day.summary ?? ""} onUpdate={setDay ? (v) => setDay(dayIdx, { summary: v }) : undefined} />
                    </p>
                  )}
                </div>
                <div aria-hidden className="mt-5 flex items-center gap-0">
                  <span className="h-px w-14" style={{ background: accentChrome }} />
                  <span className="h-px flex-1" style={{ background: mixHex(ink.text, bg, 0.14) }} />
                </div>
              </motion.div>

              {/* optional day banner — a wide editorial strip under a brand scrim */}
              {!!day.imageUrl?.trim() && (
                <motion.div
                  {...fadeUp(0.06)}
                  className="relative mt-6 h-40 overflow-hidden rounded-2xl sm:h-52"
                  style={{ boxShadow: "0 28px 56px -44px rgba(28, 25, 23, 0.4)" }}
                >
                  <img
                    src={day.imageUrl}
                    alt={day.imageAlt || day.label}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `linear-gradient(165deg, ${mixHex(primaryHex, heroBg, 0.6)}59 0%, transparent 55%), linear-gradient(to top, ${heroBg}B3 0%, transparent 55%)`,
                    }}
                  />
                  <p
                    className="absolute bottom-4 left-5 text-[11px] font-bold uppercase tracking-[0.22em] sm:left-6"
                    style={{ color: heroChrome.ink }}
                  >
                    {day.label}
                  </p>
                </motion.div>
              )}

              {/* Sessions — timeline rail with editorial rows; reserved = card */}
              <ul className="relative mt-2">
                {/* vertical rail */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-6 left-[5px] top-6 hidden w-px sm:block"
                  style={{ background: mixHex(ink.text, bg, 0.13) }}
                />
                {day.sessions.map((session, i) => {
                  const rowInk = session.isReserved ? cardInk : ink;
                  const rowHeadline = session.isReserved ? headlineOnCard : headline;
                  const rowAccent = session.isReserved ? accentOnCard : accentText;
                  const rowSurface = session.isReserved ? cardBg : bg;
                  const body = (
                    <div className="grid gap-x-10 gap-y-2 sm:grid-cols-[10rem_1fr]">
                      {/* time rail */}
                      <div>
                        <p
                          className="text-[13px] font-bold uppercase tracking-[0.08em] tabular-nums leading-6"
                          style={{ color: rowAccent, fontFamily: NUMBERS }}
                        >
                          <InlineText
                            as="span"
                            value={session.time ?? ""}
                            onUpdate={setSession ? (v) => setSession(dayIdx, i, { time: v }) : undefined}
                          />
                        </p>
                        {session.room && (
                          <p className="mt-1 text-sm leading-5" style={{ color: rowInk.muted }}>
                            {session.room}
                          </p>
                        )}
                        {sessionCalendarReady(day, session) && (
                          <button
                            type="button"
                            onClick={() => downloadSessionIcs(day, session)}
                            aria-label={`Add "${session.title}" to your calendar`}
                            title="Add to calendar"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                            style={{
                              border: `1px solid ${mixHex(rowInk.text, rowSurface, 0.22)}`,
                              color: rowInk.muted,
                            }}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                            Calendar
                          </button>
                        )}
                      </div>

                      {/* body */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.16em]">
                          {session.isReserved && (
                            <span className="inline-flex items-center gap-1.5" style={{ color: rowAccent }}>
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: rowAccent }} />
                              Reserved for you
                            </span>
                          )}
                          {session.sessionType && !session.isReserved && (
                            <span style={{ color: rowInk.muted }}>{session.sessionType}</span>
                          )}
                          {session.track && (
                            <span className="flex items-center gap-3" style={{ color: rowInk.muted }}>
                              <span aria-hidden className="h-3 w-px" style={{ background: mixHex(rowInk.text, rowSurface, 0.3) }} />
                              {session.track}
                            </span>
                          )}
                        </div>
                        <h4
                          className="mt-2 font-bold"
                          style={{
                            fontFamily: DISPLAY,
                            fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
                            lineHeight: 1.22,
                            letterSpacing: "-0.014em",
                            color: rowHeadline,
                          }}
                        >
                          <InlineText
                            as="span"
                            value={session.title}
                            onUpdate={setSession ? (v) => setSession(dayIdx, i, { title: v }) : undefined}
                          />
                        </h4>
                        {(session.description || isEditor) && (
                          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed" style={{ color: rowInk.muted }}>
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
                            className="mt-4 max-w-2xl border-l-2 py-0.5 pl-4"
                            style={{ borderColor: accentChrome }}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: rowAccent }}>
                              {props.whyAttendLabel ?? "Why this matters for you"}
                            </p>
                            <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: rowInk.text, fontFamily: DISPLAY }}>
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
                          <p className="mt-3.5 text-sm" style={{ color: rowInk.muted }}>
                            {session.speakers.map((sp, k) => (
                              <span key={k}>
                                <span className="font-semibold" style={{ color: rowInk.text }}>
                                  {sp.name}
                                </span>
                                {sp.title ? ` · ${sp.title}` : ""}
                                {k < (session.speakers?.length ?? 0) - 1 ? "  ·  " : ""}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <motion.li key={i} {...fadeUp(Math.min(i * 0.05, 0.2))} className="relative sm:pl-10">
                      {/* rail node */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-[2.2rem] hidden h-[11px] w-[11px] rounded-full border-2 sm:block"
                        style={{
                          borderColor: session.isReserved ? accentChrome : mixHex(ink.text, bg, 0.35),
                          background: session.isReserved ? accentChrome : bg,
                        }}
                      />
                      {session.isReserved ? (
                        <article
                          className="my-5 rounded-2xl px-6 py-6 sm:px-8"
                          style={{
                            background: cardBg,
                            border: `1px solid ${mixHex(accentChrome, cardBg, 0.4)}`,
                            boxShadow: "0 28px 56px -44px rgba(28, 25, 23, 0.4)",
                          }}
                        >
                          {body}
                        </article>
                      ) : (
                        <article
                          className="border-b py-7"
                          style={{ borderColor: mixHex(ink.text, bg, 0.12) }}
                        >
                          {body}
                        </article>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. RSVP ─────────────────────────────────────────────────────── */}
      {showRsvp && (
        <div id="rsvp" className="relative overflow-hidden px-5 pb-20 pt-4 sm:px-8 sm:pb-24 lg:px-10">
          {/* ambient accent glow — the invitation's warmth, never a card edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: `radial-gradient(circle, ${mixHex(accentChrome, bg, 0.16)} 0%, transparent 70%)` }}
          />
          <motion.div {...fadeUp(0)} className="relative mx-auto w-full max-w-xl">
            {/* centered editorial header */}
            <div className="text-center">
              <p
                className="text-[11px] font-bold uppercase"
                style={{ color: accentText, letterSpacing: "0.4em" }}
              >
                <InlineText as="span" value={props.rsvpKicker ?? "RSVP"} onUpdate={edit("rsvpKicker")} />
              </p>
              <h2
                className="mt-5 font-bold"
                style={{
                  fontFamily: DISPLAY,
                  fontSize: "clamp(1.9rem, 3.6vw, 2.75rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.022em",
                  color: headline,
                }}
              >
                <InlineText as="span" value={props.rsvpHeading ?? "Confirm your spot"} onUpdate={edit("rsvpHeading")} />
              </h2>
              {(props.rsvpSubheadline || isEditor) && (
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed" style={{ color: ink.muted }}>
                  <InlineText as="span" multiline value={props.rsvpSubheadline ?? ""} onUpdate={edit("rsvpSubheadline")} />
                </p>
              )}
              <span
                aria-hidden
                className="mx-auto mt-8 block h-px w-12"
                style={{ background: mixHex(accentChrome, bg, 0.6) }}
              />
            </div>

            {rsvpStatus === "done" ? (
              /* confirmation — a framed acknowledgement, not a green alert bar */
              <motion.div
                initial={reduced ? false : anim({ opacity: 0, scale: 0.97 })}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 px-6 py-12 text-center"
                style={{ border: `1px solid ${mixHex(accentChrome, bg, 0.4)}`, background: mixHex(accentChrome, bg, 0.05) }}
                role="status"
              >
                <span aria-hidden className="mx-auto mb-6 block h-px w-12" style={{ background: mixHex(accentChrome, bg, 0.6) }} />
                <p
                  className="text-2xl italic"
                  style={{ fontFamily: DISPLAY, color: headline }}
                >
                  {props.rsvpConfirmation ?? linkedForm?.successMessage ?? "You're confirmed — we'll see you there."}
                </p>
              </motion.div>
            ) : (
              <form onSubmit={linkedForm ? submitLinkedRsvp : submitRsvp} className="mt-10 flex flex-col gap-7">
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

                {linkedForm
                  ? linkedVisibleFields.map((field) =>
                      renderUnderlineField({
                        id: field.id,
                        label: field.label,
                        placeholder: field.placeholder,
                        type: field.type,
                        required: field.required,
                        options: field.options,
                        value: formValues[field.id] ?? "",
                        onChange: (v) => setFormValues((prev) => ({ ...prev, [field.id]: v })),
                      }),
                    )
                  : (
                      [
                        { id: "firstName", label: "First name", type: "text", required: true, auto: "given-name" },
                        { id: "lastName", label: "Last name", type: "text", required: false, auto: "family-name" },
                        { id: "email", label: "Work email", type: "email", required: true, auto: "email" },
                      ] as const
                    ).map((f) =>
                      renderUnderlineField({
                        id: f.id,
                        label: f.label,
                        type: f.type,
                        required: f.required,
                        autoComplete: f.auto,
                        value: rsvp[f.id],
                        onChange: (v) => setRsvp((r) => ({ ...r, [f.id]: v })),
                      }),
                    )}

                {rsvpStatus === "error" && (
                  <p className="text-sm font-semibold" role="alert" style={{ color: ink.text }}>
                    Something went wrong — please try again.
                  </p>
                )}

                <motion.button
                  type="submit"
                  disabled={rsvpStatus === "sending"}
                  className="relative mt-1 w-full overflow-hidden py-4 text-[12px] font-bold uppercase disabled:opacity-60"
                  style={{
                    background: rsvpBtnBg,
                    color: rsvpBtnText,
                    letterSpacing: "0.18em",
                    cursor: rsvpStatus === "sending" ? "not-allowed" : "pointer",
                  }}
                  whileHover={reduced ? undefined : { scale: 1.005 }}
                  whileTap={reduced ? undefined : { scale: 0.995 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <span className="relative z-10">
                    {rsvpStatus === "sending" ? "Sending…" : props.rsvpButtonText ?? linkedForm?.submitButtonText ?? "Confirm my RSVP"}
                  </span>
                </motion.button>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* ── 5. close ────────────────────────────────────────────────────── */}
      {showClose && (
        <div id="contact" className="relative overflow-hidden" style={{ background: heroBg }}>
          {/* optional close background image — heavily scrimmed toward the dark surface */}
          {!!props.closeImageUrl?.trim() && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <img
                src={props.closeImageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0" style={{ background: `${heroBg}D9` }} />
            </div>
          )}
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
            {/* "prepared by" brand lockup — the itinerary's maker's mark */}
            {props.showPreparedBy !== false && !!brand && brandHasLogo(brand, props.logoUrl) && (
              <motion.div {...fadeUp(0.18)} className="mt-12 flex flex-col items-center gap-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.26em]"
                  style={{ color: heroChrome.muted }}
                >
                  Prepared for {props.accountName} by
                </span>
                <BrandLogo
                  brand={brand}
                  url={props.logoUrl}
                  alt={props.logoAlt || brand.brandName || "Logo"}
                  tone="onDark"
                  autoContrast
                  className="h-6 w-auto"
                />
              </motion.div>
            )}
            {(props.footerNote || isEditor) && (
              <motion.p {...fadeUp(0.22)} className="mt-8 text-sm" style={{ color: heroInk.muted }}>
                <InlineText as="span" value={props.footerNote ?? ""} onUpdate={edit("footerNote")} />
              </motion.p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
