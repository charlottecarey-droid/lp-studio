import { Fragment, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarPlus, PlayCircle, ExternalLink } from "lucide-react";
import { useAnimInitial, useStaticRender } from "@/lib/reveal-fallback";
import { usePageContext } from "@/lib/page-context";
import type { BrandConfig } from "@/lib/brand-config";
import {
  contrastTextColor,
  isValidHex,
  pickContrastingColor,
  relativeLuminance,
} from "@/lib/brand-config";
import { ensureAccentRegisters, mixHex, resolveSectionInk } from "@/lib/section-ink";
import { resolveSectionSurface } from "@/lib/bg-styles";
import { InlineText } from "@/components/InlineText";
import { CtaButton } from "@/components/CtaButton";
import { VideoModal } from "@/components/VideoModal";
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

/** Per-section headline alignment + scale, so sections don't all read alike. */
export type EvaAlign = "left" | "center";
export type EvaHeadingSize = "sm" | "md" | "lg" | "xl";

/**
 * Portrait corner treatment. "rounded" follows the PAGE's corner-radius
 * setting (Page Settings → Sections & images), so squaring a page squares the
 * headshots with everything else; "circle" and "square" are absolute.
 */
export type EvaPortraitShape = "circle" | "rounded" | "square";

/** How many lines of a long paragraph to show before clamping. */
export type EvaClamp = "full" | "2" | "3" | "4";

/**
 * A private 1:1 — the meetings reserved specifically for this account, as
 * opposed to catalog sessions anyone can attend. Time/location are editorial
 * strings (what the rep typed), like the schedule's `time`.
 */
export interface EvaMeeting {
  title: string;
  time?: string;
  location?: string;
  /** Who they're meeting — "Maya Chen" / "Enterprise AE". */
  host?: string;
  hostTitle?: string;
  note?: string;
}

/** A person — the account team and the keynote speakers share this shape. */
export interface EvaPerson {
  name: string;
  /** Role line, e.g. "Enterprise Account Executive" or "CEO, Northwind". */
  title?: string;
  /** Headshot. Falls back to initials on a brand-tinted disc. */
  imageUrl?: string;
  /** One or two sentences — a bio for a speaker, a "how I help" for the team. */
  bio?: string;
  /** Speakers only: the session they're presenting, shown as a linking line. */
  sessionTitle?: string;
  /** Contact details shown UNDER the name on the team roster (plain text, no pills). */
  email?: string;
  phone?: string;
  /** Optional contact/booking link. */
  linkUrl?: string;
  linkLabel?: string;
}

/** A sponsor / partner logo with an optional tier label and link. */
export interface EvaSponsor {
  name: string;
  logoUrl?: string;
  /** e.g. "Founding partner" — groups the wall visually. */
  tier?: string;
  url?: string;
}

/** A downloadable or linkable resource. */
export interface EvaResource {
  title: string;
  /** Short description of what it is. */
  description?: string;
  url?: string;
  /** Small type chip, e.g. "PDF", "Deck", "Recording". */
  kind?: string;
}

/**
 * The reorderable body sections, in render order. Any section omitted from a
 * saved order still renders (appended in canonical order) so adding a section
 * later can never silently hide it on existing pages. The hero and close are
 * NOT reorderable — they bookend the page by definition.
 */
export type EvaSectionId = "note" | "meetings" | "team" | "speakers" | "guest" | "schedule" | "sponsors" | "resources" | "rsvp";

/** Canonical order: the two intro sections, the schedule, then the follow-ups. */
export const EVA_SECTION_ORDER: readonly EvaSectionId[] = [
  "note", "meetings", "team", "speakers", "guest", "schedule", "sponsors", "resources", "rsvp",
];

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
  /** Optional account/partner (co-brand) logo in the navbar lockup. Renders
   *  AFTER the tenant mark (tenant leads on agenda pages). */
  accountLogoUrl?: string;
  accountLogoAlt?: string;
  /**
   * Partner-logo sizing, independent of `logoSize`:
   *   "auto" (default) — area-balance against the tenant mark, so a squarish
   *     partner logo isn't dwarfed by a wide tenant wordmark at equal height;
   *   "match" — same height as the tenant mark (the pre-Aug-2026 behavior);
   *   sm|md|lg|xl — fixed heights on the same scale as `logoSize`.
   */
  accountLogoSize?: "auto" | "match" | "sm" | "md" | "lg" | "xl";
  /** Tenant logo override (falls back to the brand logo). */
  logoUrl?: string;
  logoAlt?: string;
  /**
   * Size of the brand marks in the header lockup and the "prepared by" footer.
   * Scales both together (and the co-brand account logo with them, so a paired
   * lockup stays balanced). Defaults to "md" — the original sizing.
   */
  logoSize?: "sm" | "md" | "lg" | "xl";

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
  /* ── hero stat strip ──────────────────────────────────────────────────
   * The three numerals are COMPUTED from the agenda, so they can't be typed
   * over — but they can each be switched off, and their labels rewritten.
   * Switching all three off leaves the location standing on its own, which is
   * the "just show where it is" hero. */
  /**
   * The hero's SECOND button. "calendar" (default) is the .ics download and
   * still only appears when the agenda carries real dates. "video" opens a
   * trailer in the shared lightbox, "link" goes anywhere, "none" leaves the
   * primary CTA on its own.
   */
  heroSecondaryAction?: "calendar" | "video" | "link" | "none";
  heroSecondaryLabel?: string;
  heroSecondaryVideoUrl?: string;
  heroSecondaryUrl?: string;
  showStatSessions?: boolean;
  showStatDays?: boolean;
  showStatReserved?: boolean;
  /** Label overrides. Deliberately UNSET by default so the built-in labels stay
   *  count-aware ("1 day" / "3 days"); once set, your text is used verbatim. */
  statSessionsLabel?: string;
  statDaysLabel?: string;
  statReservedLabel?: string;
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
  scheduleBackgroundStyle?: string;
  scheduleBgColor?: string;
  days: EvaDay[];
  /** Label on the per-session personalized callout. */
  whyAttendLabel?: string;
  /**
   * Day navigation for a multi-day agenda. "anchors" adds a sticky bar that
   * jumps to a day; "tabs" additionally shows one day at a time. Only ever
   * active with 2+ days, and never in the builder or a static snapshot — an
   * export or a scraper must still receive every day (see the prerender
   * contract in this file's test).
   */
  dayNav?: "off" | "anchors" | "tabs";

  /* ── readability ──────────────────────────────────────────────────────
   * A real conference agenda is 25–40 sessions, and scraped abstracts run
   * long, so the honest default page is a wall of prose. These trim what a
   * reader has to wade through WITHOUT deleting anything: the clamps are pure
   * CSS, so the full text stays in the DOM for export, print, search engines
   * and screen readers, and every control is reversible.
   */
  /** Clamp session descriptions to N lines. "full" = no clamp. */
  descriptionLines?: EvaClamp;
  /** Clamp team + speaker bios to N lines. */
  bioLines?: EvaClamp;
  /** The per-session "Why this matters for you" callout — visually the
   *  heaviest element in a row, and repeated on every single session. */
  showWhyAttend?: boolean;
  /** The uppercase session-type / track micro-labels above each title. */
  showSessionMeta?: boolean;
  /**
   * Add-to-calendar (.ics) affordances — the hero button for the whole agenda
   * AND the per-session buttons. Default on, but each only renders when the
   * session/agenda carries machine-readable date + start time.
   */
  showAddToCalendar?: boolean;
  /**
   * What the per-session button does.
   *
   * "calendar" (default) downloads a one-session .ics. "register" links out to
   * the event's own registration/catalog instead — the right choice for a
   * RainFocus event, where seats are held in RainFocus and a calendar file
   * doesn't reserve anything.
   *
   * NOTE we can't show live seat counts: a public RainFocus widget token
   * returns `capacity` but not current registrations or a sold-out flag —
   * that's per-attendee state behind an authenticated token. Linking out sends
   * the reader to the one place that DOES know.
   */
  sessionCtaMode?: "calendar" | "register" | "none";
  /** Registration/catalog URL, shared by every session row. */
  sessionRegisterUrl?: string;
  sessionRegisterLabel?: string;

  /* ── special meetings (private 1:1s for this account) ─────────────────── */
  showMeetings?: boolean;
  meetingsKicker?: string;
  meetingsHeading?: string;
  meetingsSubheadline?: string;
  meetingsAlign?: EvaAlign;
  meetingsHeadingSize?: EvaHeadingSize;
  meetingsBackgroundStyle?: string;
  meetingsBgColor?: string;
  meetings?: EvaMeeting[];

  /* ── account team (before the schedule by default) ────────────────────── */
  showTeam?: boolean;
  teamKicker?: string;
  teamHeading?: string;
  teamSubheadline?: string;
  teamAlign?: EvaAlign;
  teamHeadingSize?: EvaHeadingSize;
  /** Section background preset (brand + contrast aware) or a custom hex. */
  teamBackgroundStyle?: string;
  teamBgColor?: string;
  /**
   * "roster" (default) = large portraits with the name and contact details
   * underneath. "compact" = smaller portrait beside the copy for long lists.
   */
  teamLayout?: "roster" | "compact";
  /** Roster columns. An account team is usually 3–8 people and the names are
   *  reference information, not headlines — 4 across keeps it a directory. */
  teamColumns?: 2 | 3 | 4;
  /** Portrait shape on the roster layout. Default "circle". */
  teamPortraitShape?: EvaPortraitShape;
  team?: EvaPerson[];

  /* ── keynote speakers (before the schedule by default) ────────────────── */
  showSpeakers?: boolean;
  speakersKicker?: string;
  speakersHeading?: string;
  speakersSubheadline?: string;
  speakersAlign?: EvaAlign;
  speakersHeadingSize?: EvaHeadingSize;
  speakersBackgroundStyle?: string;
  speakersBgColor?: string;
  /** Portrait shape for speaker features/grid. Default "rounded". */
  speakersPortraitShape?: EvaPortraitShape;
  /**
   * "feature" (default) = full-width alternating rows, portrait beside a
   * generous bio — deliberately unlike the team grid. "grid" = a tighter
   * 3-up when there are many speakers.
   */
  speakersLayout?: "feature" | "grid";
  speakers?: EvaPerson[];

  /* ── sponsors / partners (after the schedule by default) ──────────────── */
  showSponsors?: boolean;
  sponsorsKicker?: string;
  sponsorsHeading?: string;
  sponsorsSubheadline?: string;
  sponsorsAlign?: EvaAlign;
  sponsorsHeadingSize?: EvaHeadingSize;
  sponsorsBackgroundStyle?: string;
  sponsorsBgColor?: string;
  /**
   * "wall" (default) = logos grouped under a plain tier label, no plates or
   * pills — how a real sponsor wall reads. "plates" = bordered tiles.
   */
  sponsorsLayout?: "wall" | "plates";
  /** Tint the sponsors band to separate it from its neighbours. Default true. */
  sponsorsBand?: boolean;
  /** ONE size for every sponsor mark. Sponsor logos arrive at wildly different
   *  intrinsic sizes; per-sponsor sizing is the fiddly work this removes. */
  sponsorLogoSize?: "sm" | "md" | "lg" | "xl";
  /** Print each sponsor's name under its logo. Off by default — a sponsor wall
   *  is usually marks alone. Ignored for a sponsor with NO logo, where the name
   *  already IS the mark. */
  showSponsorNames?: boolean;
  sponsors?: EvaSponsor[];

  /* ── special guest / musical act ──────────────────────────────────────
   * Deliberately its OWN shape rather than another speaker row: the headline
   * act of an event is a poster, not a directory entry. */
  showGuest?: boolean;
  guestKicker?: string;
  guestHeading?: string;
  guestSubheadline?: string;
  guestAlign?: EvaAlign;
  guestHeadingSize?: EvaHeadingSize;
  guestBackgroundStyle?: string;
  guestBgColor?: string;
  /** The act. No name = no section (unless you're in the builder). */
  guestName?: string;
  /** "Grammy-winning duo", "Special guest", "Live from Nashville"… */
  guestRole?: string;
  guestImageUrl?: string;
  guestBio?: string;
  /** When and where — "Wednesday, 8:00 PM · The Rooftop". */
  guestMeta?: string;
  guestLinkUrl?: string;
  guestLinkLabel?: string;
  /** Play the link in the video lightbox instead of navigating away. */
  guestVideoUrl?: string;

  /* ── resources (after the schedule by default) ────────────────────────── */
  showResources?: boolean;
  resourcesKicker?: string;
  resourcesHeading?: string;
  resourcesSubheadline?: string;
  resourcesAlign?: EvaAlign;
  resourcesHeadingSize?: EvaHeadingSize;
  resourcesBackgroundStyle?: string;
  resourcesBgColor?: string;
  /**
   * "index" (default) = a numbered editorial index, kind set as plain small
   * caps. "cards" = a 2-up card grid when the descriptions run long.
   */
  resourcesLayout?: "index" | "cards";
  resources?: EvaResource[];

  /**
   * Body-section render order. Unlisted sections append in canonical order, so
   * a page saved before a section existed still shows it. Hero/close are fixed.
   */
  sectionOrder?: EvaSectionId[];

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
  showStatSessions: true,
  showStatDays: true,
  showStatReserved: true,
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
  descriptionLines: "3",
  bioLines: "3",
  showWhyAttend: true,
  showSessionMeta: true,
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

  /* account team */
  showTeam: true,
  teamKicker: "Your account team",
  teamHeading: "The people looking after you",
  teamSubheadline: "Find any of us during the event — we've built the week around your priorities.",
  team: [
    {
      name: "Maya Chen",
      title: "Enterprise Account Executive",
      email: "maya.chen@example.com",
      phone: "+1 (415) 555-0142",
      linkLabel: "Book time",
      linkUrl: "#contact",
    },
    {
      name: "Jordan Ellis",
      title: "Solutions Architect",
      email: "jordan.ellis@example.com",
    },
    {
      name: "Priya Raman",
      title: "Customer Success Director",
      email: "priya.raman@example.com",
      phone: "+1 (415) 555-0188",
    },
  ],

  /* keynote speakers */
  showSpeakers: true,
  speakersKicker: "Keynotes",
  speakersHeading: "Who you'll hear from",
  speakersSubheadline: "The sessions we think are worth your leadership team's time.",
  speakers: [
    {
      name: "Alex Rivera",
      title: "Chief Executive Officer",
      bio: "Opens the event with where the platform is going and what ships this year.",
      sessionTitle: "Opening keynote: the year ahead",
    },
    {
      name: "Dr. Simone Vaughn",
      title: "Head of Research",
      bio: "On what the last twelve months of data changed about how teams operate at scale.",
      sessionTitle: "What the data says about scaling",
    },
  ],

  /* sponsors / partners */
  showSponsors: true,
  sponsorsKicker: "Partners",
  teamColumns: 3,
  dayNav: "off",
  heroSecondaryAction: "calendar",
  showMeetings: true,
  meetingsKicker: "Reserved for you",
  meetingsHeading: "Your private meetings",
  meetingsSubheadline: "Time we've set aside for your team alone.",
  meetings: [
    {
      title: "Roadmap working session",
      time: "Wednesday · 2:00 PM",
      location: "Executive Suite 4",
      host: "Maya Chen",
      hostTitle: "Enterprise Account Executive",
      note: "Bring the rollout questions from your ops review — product leadership will be in the room.",
    },
    {
      title: "Welcome dinner",
      time: "Tuesday · 7:00 PM",
      location: "The Rooftop",
      host: "Your account team",
    },
  ],
  showGuest: true,
  guestKicker: "After hours",
  guestHeading: "Your special guest",
  guestSubheadline: "The evening is on us — dinner, then the main event.",
  guestName: "The Northern Sound",
  guestRole: "Live from Nashville",
  guestMeta: "Wednesday, 8:00 PM · The Rooftop",
  guestBio:
    "A four-piece who spent the last two years selling out rooms a tenth of this size. Dinner runs until eight; the set starts right after.",
  guestLinkLabel: "Listen",
  sponsorsHeading: "Who's making it happen",
  sponsorLogoSize: "md",
  showSponsorNames: false,
  sponsorsSubheadline: "The partners joining us on site — several will be running hands-on stations.",
  sponsors: [
    { name: "Northwind Systems", tier: "Founding partner" },
    { name: "Atlas Logistics", tier: "Founding partner" },
    { name: "Beacon Analytics", tier: "Supporting partner" },
    { name: "Harbor Consulting", tier: "Supporting partner" },
  ],

  /* resources */
  showResources: true,
  resourcesKicker: "Before you go",
  resourcesHeading: "Take the week with you",
  resourcesSubheadline: "Everything referenced in your sessions, in one place.",
  resources: [
    { title: "Event guide", description: "Venue maps, dining, and the full schedule at a glance.", kind: "PDF" },
    { title: "Session recordings", description: "Posted within 48 hours of each session ending.", kind: "Video" },
    { title: "Your roadmap summary", description: "The commitments and dates from your working session.", kind: "Deck" },
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

/**
 * Logo heights per size token. Literal Tailwind classes (never interpolated)
 * so the JIT emits them. The footer mark runs one notch smaller than the
 * header — it's a sign-off, not the lockup.
 */
const LOGO_HEIGHTS: Record<NonNullable<EventAgendaBlockProps["logoSize"]>, { header: string; headerRem: number; footer: string }> = {
  sm: { header: "h-5", headerRem: 1.25, footer: "h-4" },
  md: { header: "h-7", headerRem: 1.75, footer: "h-6" },
  lg: { header: "h-10", headerRem: 2.5, footer: "h-8" },
  xl: { header: "h-14", headerRem: 3.5, footer: "h-11" },
};

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
  /** Patch one entry of a person/sponsor/resource array prop. */
  const setItem = set
    ? <K extends "team" | "speakers" | "sponsors" | "resources">(
        key: K,
        i: number,
        patch: Partial<NonNullable<EventAgendaBlockProps[K]>[number]>,
      ) =>
        set(
          key,
          ((props[key] ?? []) as NonNullable<EventAgendaBlockProps[K]>).map((item, j) =>
            j === i ? { ...item, ...patch } : item,
          ) as EventAgendaBlockProps[K],
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
  /** One lightbox for the whole block — the hero trailer and the special
   *  guest's clip both open it. Empty string = closed. */
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [activeDay, setActiveDay] = useState(0);
  const staticRender = useStaticRender();

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

  const logoHeights = LOGO_HEIGHTS[props.logoSize ?? "md"] ?? LOGO_HEIGHTS.md;
  const showHero = props.showHero !== false;
  const days = props.days.filter((d) => d.sessions.length > 0 || isEditor);
  const sessionTotal =
    typeof props.sessionCount === "number" && props.sessionCount > 0
      ? props.sessionCount
      : props.days.reduce((n, d) => n + d.sessions.length, 0);
  const reservedTotal = props.days.reduce((n, d) => n + d.sessions.filter((s) => s.isReserved).length, 0);
  const showNote = props.showNote !== false && (!!props.personalNote?.trim() || isEditor);
  const showClose = props.showClose !== false;
  // Each optional section needs content to render (or the editor, so an author
  // can see and fill an empty one) — never an empty headline on a live page.
  const team = props.team ?? [];
  const speakers = props.speakers ?? [];
  const sponsors = props.sponsors ?? [];
  const resources = props.resources ?? [];
  const showTeam = props.showTeam !== false && (team.length > 0 || isEditor);
  const showSpeakers = props.showSpeakers !== false && (speakers.length > 0 || isEditor);
  const showSponsors = props.showSponsors !== false && (sponsors.length > 0 || isEditor);
  const showResources = props.showResources !== false && (resources.length > 0 || isEditor);
  const hasHeroImage = !!props.heroImageUrl?.trim();
  // Fail-closed: image layouts without an image fall back to the dark band.
  const heroLayout = resolveHeroLayout(props.heroLayout, hasHeroImage, "split");
  const heroIsOverlay = heroLayout === "image-overlay";
  const heroIsSplit = heroLayout === "split" && hasHeroImage;

  /* — add-to-calendar (.ics) — only when machine schedule data exists — */
  const calendarEnabled = props.showAddToCalendar !== false;
  /** `showAddToCalendar: false` still means "no per-session button", so it
   *  keeps working as the master switch alongside the newer mode. */
  const sessionCtaMode = !calendarEnabled ? "none" : (props.sessionCtaMode ?? "calendar");
  /**
   * Per-session registration link.
   *
   * One URL for every row, deliberately: `sales_event_sessions` doesn't store
   * the catalog's own session code, so there's nothing to deep-link WITH.
   * Adding that column is the prerequisite for per-session links — until then
   * a fake `{code}` placeholder would just produce broken URLs.
   */
  const sessionRegisterHref = (): string => props.sessionRegisterUrl?.trim() ?? "";
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

  /**
   * Shared kicker / headline / subheadline lockup so every body section reads
   * as one system with the schedule's own header (same type ramp, same rhythm).
   */
  /**
   * Resolve a body section's own surface. A section may keep the page
   * background (the default) or take a brand-aware preset / custom colour —
   * and everything drawn on it (headings, body ink, hairlines, cards, the
   * accent) has to be re-resolved against THAT surface, or a dark section gets
   * dark text. Returns the same shape the page-level palette uses so a section
   * can be swapped onto it without touching its markup.
   */
  const pagePalette: SectionPalette = {
    bg, ink, headline, cardBg, cardInk, headlineOnCard,
    accentText, accentChrome, accentOnCard, isOwnSurface: false,
  };

  const sectionSurface = (backgroundStyle?: string, bgColorProp?: string): SectionPalette => {
    const custom = !backgroundStyle && !bgColorProp;
    if (custom) return pagePalette;
    const resolved = resolveSectionSurface(
      { backgroundStyle, bgColor: bgColorProp },
      bg,
      { primaryColor: brand?.primaryColor, backgroundPresetColors: brand?.backgroundPresetColors },
    );
    const base = isValidHex(resolved.base) ? resolved.base : bg;
    const sInk = resolveSectionInk({ textColor: resolved.color }, { base });
    const sHeadline = pickContrastingColor(
      resolved.isDark ? brand?.headingOnDarkColor : props.headlineColor ?? brand?.headingOnLightColor,
      base,
      resolved.isDark ? [sInk.text, "#FFFFFF"] : [brand?.primaryColor, "#221E3F", sInk.text],
      4.5,
    );
    const sCardBg = resolved.isDark ? mixHex("#FFFFFF", base, 0.08) : (cardBg === bg ? "#FFFFFF" : cardBg);
    const sCardInk = resolveSectionInk({}, { base: sCardBg });
    return {
      bg: resolved.background,
      ink: sInk,
      headline: sHeadline,
      cardBg: sCardBg,
      cardInk: sCardInk,
      // Candidates must match the CARD's darkness, not the library's
      // light-surface defaults. pickContrastingColor falls back to its first
      // candidate when none clear the ratio, so handing a dark card only dark
      // candidates (brand primary, #221E3F) silently returns near-black ON
      // near-black — measured at 1.24:1 before this.
      headlineOnCard: pickContrastingColor(
        undefined,
        sCardBg,
        resolved.isDark
          ? [sCardInk.text, "#FFFFFF"]
          : [brand?.primaryColor, "#221E3F", sCardInk.text],
        4.5,
      ),
      accentText: pickContrastingColor(accentRaw, base, [brand?.primaryColor, sHeadline], 4.5),
      accentChrome: ensureAccentRegisters(accentRaw, { base }, 1.6),
      accentOnCard: pickContrastingColor(
        accentRaw,
        sCardBg,
        resolved.isDark ? [sCardInk.text, "#FFFFFF"] : [brand?.primaryColor],
        4.5,
      ),
      isOwnSurface: true,
    };
  };

  /**
   * Vertical rhythm for the body sections. Every section gets padding on BOTH
   * sides — relying on the next section's top padding left the last item
   * flush against the boundary (a tall speaker portrait read as "cut off"),
   * and it broke entirely once sections could be reordered. Scales with the
   * page's spacing setting so "more room between sections" is one control.
   */
  const SECTION_PY_SCALE: Record<string, string> = {
    compact: "py-10 sm:py-12",
    comfortable: "py-14 sm:py-20",
    spacious: "py-20 sm:py-28",
  };
  const sectionPy = SECTION_PY_SCALE[brand?.sectionPadding ?? "comfortable"] ?? SECTION_PY_SCALE.comfortable;

  /**
   * Line clamp for long prose. CSS-only on purpose: the full text stays in the
   * DOM, so the prerendered snapshot, the HTML export, print and assistive
   * tech all keep the complete copy — only the on-screen height is capped.
   *
   * Never clamps in the builder. An author editing a description has to see
   * the whole thing, and an inline editor whose overflow is hidden is a trap.
   */
  const clampLines = (setting: EvaClamp | undefined): React.CSSProperties => {
    if (isEditor) return {};
    const n = Number(setting);
    if (!Number.isFinite(n) || n < 1) return {};
    return {
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: n,
      overflow: "hidden",
    };
  };
  const descriptionClamp = clampLines(props.descriptionLines ?? "3");
  const bioClamp = clampLines(props.bioLines ?? "3");
  const showWhyAttend = props.showWhyAttend ?? true;
  const showSessionMeta = props.showSessionMeta ?? true;

  /** Everything a section needs to draw on its own surface. */
  type SectionPalette = {
    bg: string;
    ink: { text: string; muted: string };
    headline: string;
    cardBg: string;
    cardInk: { text: string; muted: string };
    headlineOnCard: string;
    accentText: string;
    accentChrome: string;
    accentOnCard: string;
    isOwnSurface: boolean;
  };

  /** Headline scale per section — authors size sections against each other. */
  const HEADING_SIZES: Record<EvaHeadingSize, string> = {
    sm: "clamp(1.4rem, 2.4vw, 1.85rem)",
    md: "clamp(1.7rem, 3.2vw, 2.4rem)",
    lg: "clamp(2rem, 4vw, 3rem)",
    xl: "clamp(2.4rem, 5vw, 3.75rem)",
  };

  const sectionHeader = (
    kickerKey: keyof EventAgendaBlockProps,
    headingKey: keyof EventAgendaBlockProps,
    subKey: keyof EventAgendaBlockProps,
    fallbacks: { kicker: string; heading: string },
    opts?: { align?: EvaAlign; size?: EvaHeadingSize; surface?: SectionPalette },
  ) => {
    const centered = opts?.align === "center";
    const size = HEADING_SIZES[opts?.size ?? "lg"] ?? HEADING_SIZES.lg;
    // Draw against the SECTION's surface, not the page's — a section that
    // takes a dark background must not keep the page's near-black ink.
    const sf = opts?.surface;
    const sAccent = sf?.accentText ?? accentText;
    const sHeadline = sf?.headline ?? headline;
    const sMuted = sf?.ink.muted ?? ink.muted;
    const sChrome = sf?.accentChrome ?? accentChrome;
    const sBg = sf?.bg ?? bg;
    return (
      <div className={centered ? "text-center" : undefined}>
        <motion.p {...fadeUp(0)} className={kickerClass} style={{ color: sAccent }}>
          <InlineText as="span" value={(props[kickerKey] as string) ?? fallbacks.kicker} onUpdate={edit(kickerKey)} />
        </motion.p>
        <motion.h2
          {...fadeUp(0.06)}
          className={`mt-4 font-bold ${centered ? "mx-auto max-w-3xl" : "max-w-2xl"}`}
          style={{
            fontFamily: DISPLAY,
            fontSize: size,
            lineHeight: 1.06,
            letterSpacing: "-0.024em",
            color: sHeadline,
          }}
        >
          <InlineText as="span" value={(props[headingKey] as string) ?? fallbacks.heading} onUpdate={edit(headingKey)} />
        </motion.h2>
        {(props[subKey] || isEditor) && (
          <motion.p
            {...fadeUp(0.12)}
            className={`mt-4 text-base leading-relaxed sm:text-lg ${centered ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
            style={{ color: sMuted }}
          >
            <InlineText as="span" multiline value={(props[subKey] as string) ?? ""} onUpdate={edit(subKey)} />
          </motion.p>
        )}
        {/* Centered headers get a hairline instead of relying on whitespace. */}
        {centered && (
          <span aria-hidden className="mx-auto mt-7 block h-px w-12" style={{ background: mixHex(sChrome, sBg, 0.6) }} />
        )}
      </div>
    );
  };

  /** Initials disc — the headshot fallback (never a broken image icon). */
  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  /**
   * Portrait at an arbitrary size, with an initials fallback. Used large on the
   * team roster and speaker features — the small-avatar-in-a-card look is what
   * made every section read the same.
   */
  /** Page corner setting → a concrete radius for "rounded" portraits, so
   *  squaring the page (Sections & images) squares the headshots too. */
  const PORTRAIT_ROUNDED: Record<string, string> = {
    square: "0px",
    slight: "0.375rem",
    rounded: "1rem",
    soft: "1.5rem",
  };
  const portraitRadius = (shape: EvaPortraitShape): string => {
    if (shape === "circle") return "9999px";
    if (shape === "square") return "0px";
    return PORTRAIT_ROUNDED[brand?.cardRadius ?? "rounded"] ?? "1rem";
  };

  const portrait = (
    person: EvaPerson,
    opts: { size: string; shape: EvaPortraitShape; surface: string; ink: { text: string; muted: string } },
  ) => {
    const radius = portraitRadius(opts.shape);
    /**
     * A "100%" portrait fills its column (the speakers grid), and its height
     * MUST come from its own width via aspect-ratio — not `height: 100%`.
     *
     * In a grid item, a percentage height resolves against the grid AREA, whose
     * height is set by the tallest cell. The image therefore grew to the full
     * row and the name underneath spilled into the next row. That was the
     * overlapping-names bug.
     *
     * Fixed rem/clamp sizes are square by definition, so they keep both axes.
     */
    const fills = opts.size === "100%";
    const box: React.CSSProperties = fills
      ? { width: "100%", aspectRatio: "1 / 1", borderRadius: radius }
      : { width: opts.size, height: opts.size, borderRadius: radius };
    // `calc(100% / 3)` as a font-size resolves against the INHERITED font size,
    // not the box — it rendered the initials tiny. Use a viewport-aware clamp
    // for the filling case.
    const initialsSize = fills ? "clamp(1.75rem, 4vw, 2.75rem)" : `calc(${opts.size} / 3)`;
    return person.imageUrl?.trim() ? (
      <img
        src={person.imageUrl}
        alt={person.name}
        className="shrink-0 object-cover"
        style={box}
        loading="lazy"
      />
    ) : (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center font-bold"
        style={{
          ...box,
          background: mixHex(accentChrome, opts.surface, 0.13),
          color: pickContrastingColor(accentRaw, mixHex(accentChrome, opts.surface, 0.13), [opts.ink.text], 4.5),
          fontFamily: DISPLAY,
          fontSize: initialsSize,
          letterSpacing: "-0.02em",
        }}
      >
        {initials(person.name)}
      </span>
    );
  };

  /**
   * Roster scale. The account team is REFERENCE information — who to grab in a
   * hallway — so the names are set at body-copy weight, not headline size, and
   * the portrait shrinks as the columns get tighter. Speakers keep their own
   * (much larger) treatment; that section is the billing, this one is a
   * directory.
   */
  const teamColumns = props.teamColumns ?? 3;
  const ROSTER_SCALE: Record<2 | 3 | 4, { portrait: string; name: string; grid: string }> = {
    2: { portrait: "clamp(8rem, 14vw, 10.5rem)", name: "clamp(1.1rem, 1.7vw, 1.3rem)", grid: "sm:grid-cols-2" },
    3: { portrait: "clamp(7rem, 11vw, 9rem)", name: "clamp(1.05rem, 1.5vw, 1.2rem)", grid: "sm:grid-cols-2 lg:grid-cols-3" },
    4: { portrait: "clamp(6rem, 9vw, 7.5rem)", name: "clamp(0.98rem, 1.3vw, 1.1rem)", grid: "grid-cols-2 lg:grid-cols-4" },
  };
  const rosterScale = ROSTER_SCALE[teamColumns] ?? ROSTER_SCALE[3];
  const rosterPortrait = rosterScale.portrait;
  const rosterNameSize = rosterScale.name;

  /** Person card, shared by the account team and the keynote speakers. */
  /**
   * ROSTER entry — the account team's default. A portrait with the name, role
   * and contact details stacked UNDERNEATH it. No card, no chrome: the
   * portrait is the anchor and the contact lines are plain text, because a
   * "who to find" list shouldn't read like a pricing table.
   *
   * NO BIO, deliberately: the reader already knows their own account team —
   * they need to recognise a face and reach someone, not read an
   * introduction. Keynote speakers DO keep bios; that section is billing.
   */
  const rosterEntry = (person: EvaPerson, i: number, sf: SectionPalette = pagePalette) => {
    const shape = props.teamPortraitShape ?? "circle";
    return (
      <motion.li key={i} {...fadeUp(Math.min(i * 0.07, 0.28))} className="text-center">
        <div className="flex justify-center">
          {portrait(person, { size: rosterPortrait, shape, surface: sf.bg, ink: sf.ink })}
        </div>
        <p
          className="mt-5 font-bold"
          style={{ fontFamily: DISPLAY, fontSize: rosterNameSize, lineHeight: 1.25, letterSpacing: "-0.01em", color: sf.headline }}
        >
          <InlineText as="span" value={person.name} onUpdate={setItem ? (v) => setItem("team", i, { name: v }) : undefined} />
        </p>
        {(person.title || isEditor) && (
          <p className="mt-1.5 text-[13px] font-bold uppercase tracking-[0.16em]" style={{ color: sf.accentText }}>
            <InlineText as="span" value={person.title ?? ""} onUpdate={setItem ? (v) => setItem("team", i, { title: v }) : undefined} />
          </p>
        )}
        {/* Contact details — plain lines under the name, deliberately not pills. */}
        {(person.email || person.phone || person.linkUrl || isEditor) && (
          /* Top-anchored, and no divider rule. With bios gone the only height
             variance above this is whether the role wraps, so anchoring to the
             top keeps the contact lines near-level; bottom-aligning instead
             staggered them by however many contact lines each person has. A
             border would just draw attention to the residual half-line. */
          <div className="mx-auto mt-6 w-full max-w-[22rem] space-y-1 text-[14px]">
            {(person.email || isEditor) && (
              <p>
                {person.email?.trim() && !isEditor ? (
                  <a href={`mailto:${person.email.trim()}`} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" style={{ color: sf.ink.text }}>
                    {person.email}
                  </a>
                ) : (
                  <InlineText as="span" value={person.email ?? ""} onUpdate={setItem ? (v) => setItem("team", i, { email: v }) : undefined} />
                )}
              </p>
            )}
            {(person.phone || isEditor) && (
              <p style={{ color: sf.ink.muted }}>
                <InlineText as="span" value={person.phone ?? ""} onUpdate={setItem ? (v) => setItem("team", i, { phone: v }) : undefined} />
              </p>
            )}
            {person.linkUrl?.trim() && (
              <a
                href={person.linkUrl}
                onClick={(e) => handleAnchor(e, person.linkUrl ?? "")}
                className="inline-flex items-center gap-1.5 pt-1 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                style={{ color: sf.accentText }}
              >
                {person.linkLabel?.trim() || "Book time"}
                <span aria-hidden>→</span>
              </a>
            )}
          </div>
        )}
      </motion.li>
    );
  };

  /** COMPACT team entry — portrait beside the copy, for longer rosters. */
  const compactEntry = (person: EvaPerson, i: number, sf: SectionPalette = pagePalette) => (
    <motion.li key={i} {...fadeUp(Math.min(i * 0.06, 0.24))} className="flex gap-5">
      {portrait(person, { size: "5rem", shape: props.teamPortraitShape ?? "circle", surface: sf.bg, ink: sf.ink })}
      <div className="min-w-0 pt-1">
        <p className="font-bold" style={{ fontFamily: DISPLAY, fontSize: "1.15rem", lineHeight: 1.25, color: sf.headline }}>
          <InlineText as="span" value={person.name} onUpdate={setItem ? (v) => setItem("team", i, { name: v }) : undefined} />
        </p>
        {(person.title || isEditor) && (
          <p className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: sf.accentText }}>
            <InlineText as="span" value={person.title ?? ""} onUpdate={setItem ? (v) => setItem("team", i, { title: v }) : undefined} />
          </p>
        )}
        {(person.email || person.phone) && (
          <p className="mt-2 text-[14px]" style={{ color: sf.ink.text }}>
            {person.email?.trim() && (
              <a href={`mailto:${person.email.trim()}`} style={{ color: sf.ink.text }}>{person.email}</a>
            )}
            {person.email?.trim() && person.phone?.trim() ? <span style={{ color: sf.ink.muted }}>{"  ·  "}</span> : null}
            {person.phone?.trim() && <span style={{ color: sf.ink.muted }}>{person.phone}</span>}
          </p>
        )}
      </div>
    </motion.li>
  );

  /**
   * SPEAKER FEATURE row — full width, portrait beside a generous bio, sides
   * alternating down the page. Nothing like the team grid, which is the point:
   * two people-sections in a row must not look like one repeated component.
   */
  const speakerFeature = (person: EvaPerson, i: number, sf: SectionPalette = pagePalette) => {
    const flip = i % 2 === 1;
    return (
      <motion.li
        key={i}
        {...fadeUp(Math.min(i * 0.08, 0.3))}
        className={`flex flex-col gap-7 border-t pt-10 sm:flex-row sm:items-center sm:gap-10 ${flip ? "sm:flex-row-reverse" : ""}`}
        style={{ borderColor: mixHex(sf.ink.text, sf.bg, 0.14) }}
      >
        {portrait(person, { size: "clamp(9rem, 17vw, 13rem)", shape: props.speakersPortraitShape ?? "rounded", surface: sf.bg, ink: sf.ink })}
        <div className="min-w-0 flex-1">
          {(person.sessionTitle || isEditor) && (
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: sf.accentText }}>
              <InlineText
                as="span"
                value={person.sessionTitle ?? ""}
                onUpdate={setItem ? (v) => setItem("speakers", i, { sessionTitle: v }) : undefined}
              />
            </p>
          )}
          <p
            className="mt-3 font-bold"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(1.5rem, 2.8vw, 2.1rem)", lineHeight: 1.14, letterSpacing: "-0.02em", color: sf.headline }}
          >
            <InlineText as="span" value={person.name} onUpdate={setItem ? (v) => setItem("speakers", i, { name: v }) : undefined} />
          </p>
          {(person.title || isEditor) && (
            <p className="mt-1.5 text-[15px]" style={{ color: sf.ink.muted }}>
              <InlineText as="span" value={person.title ?? ""} onUpdate={setItem ? (v) => setItem("speakers", i, { title: v }) : undefined} />
            </p>
          )}
          {(person.bio || isEditor) && (
            <p
              className="mt-4 max-w-2xl text-[17px] leading-relaxed"
              style={{ color: sf.ink.text, fontFamily: DISPLAY, ...bioClamp }}
            >
              <InlineText as="span" multiline value={person.bio ?? ""} onUpdate={setItem ? (v) => setItem("speakers", i, { bio: v }) : undefined} />
            </p>
          )}
        </div>
      </motion.li>
    );
  };

  /** SPEAKER GRID entry — tighter 3-up for long line-ups. */
  const speakerGridEntry = (person: EvaPerson, i: number, sf: SectionPalette = pagePalette) => (
    <motion.li key={i} {...fadeUp(Math.min(i * 0.05, 0.2))}>
      {portrait(person, { size: "100%", shape: props.speakersPortraitShape ?? "rounded", surface: sf.bg, ink: sf.ink })}
      <p className="mt-4 font-bold" style={{ fontFamily: DISPLAY, fontSize: "1.2rem", lineHeight: 1.2, color: sf.headline }}>
        <InlineText as="span" value={person.name} onUpdate={setItem ? (v) => setItem("speakers", i, { name: v }) : undefined} />
      </p>
      {(person.title || isEditor) && (
        <p className="mt-1 text-[13px]" style={{ color: sf.ink.muted }}>
          <InlineText as="span" value={person.title ?? ""} onUpdate={setItem ? (v) => setItem("speakers", i, { title: v }) : undefined} />
        </p>
      )}
      {(person.sessionTitle || isEditor) && (
        <p className="mt-2 text-[13px]" style={{ color: sf.accentText }}>
          <InlineText as="span" value={person.sessionTitle ?? ""} onUpdate={setItem ? (v) => setItem("speakers", i, { sessionTitle: v }) : undefined} />
        </p>
      )}
    </motion.li>
  );
  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href.length < 2) return;
    const target = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  /* — hero stat strip entries (editorial numerals, not pills) — */
  type HeroStat = { key: string; value: string; label: string; field: keyof EventAgendaBlockProps };
  const heroStats: HeroStat[] = ([
    props.showStatSessions !== false && sessionTotal > 0
      ? {
          key: "sessions",
          value: String(sessionTotal),
          label: props.statSessionsLabel ?? (sessionTotal === 1 ? "session picked for you" : "sessions picked for you"),
          field: "statSessionsLabel",
        }
      : null,
    props.showStatDays !== false && days.length > 0
      ? {
          key: "days",
          value: String(days.length),
          label: props.statDaysLabel ?? (days.length === 1 ? "day" : "days"),
          field: "statDaysLabel",
        }
      : null,
    props.showStatReserved !== false && reservedTotal > 0
      ? {
          key: "reserved",
          value: String(reservedTotal),
          label: props.statReservedLabel ?? "reserved just for you",
          field: "statReservedLabel",
        }
      : null,
  ] as (HeroStat | null)[]).filter((x): x is HeroStat => x !== null);
  /**
   * Hero secondary button. Same chrome in every mode so the hero doesn't
   * change shape when you switch what it does. "calendar" stays fail-closed —
   * it only renders when the agenda actually carries dates, because an .ics
   * with no times is worse than no button.
   */
  const heroSecondary = (() => {
    const action = props.heroSecondaryAction ?? "calendar";
    if (action === "none") return null;
    const cls =
      "inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";
    const style = {
      border: `1px solid ${mixHex(heroInk.text, heroBg, 0.35)}`,
      color: heroInk.text,
    };
    if (action === "video") {
      const url = props.heroSecondaryVideoUrl?.trim();
      if (!url && !isEditor) return null;
      return (
        <button type="button" onClick={() => url && setVideoUrl(url)} className={cls} style={style}>
          <PlayCircle className="h-4 w-4" aria-hidden />
          {props.heroSecondaryLabel || "Watch the trailer"}
        </button>
      );
    }
    if (action === "link") {
      const url = props.heroSecondaryUrl?.trim();
      if (!url) return null;
      return (
        <a href={url} target="_blank" rel="noreferrer" className={cls} style={style}>
          {props.heroSecondaryLabel || "Learn more"}
        </a>
      );
    }
    if (!calendarReady) return null;
    return (
      <button type="button" onClick={downloadAgendaIcs} className={cls} style={style}>
        <CalendarPlus className="h-4 w-4" aria-hidden />
        {props.heroSecondaryLabel || "Add all to calendar"}
      </button>
    );
  })();

  /** The location stands on its own — it is NOT one of the computed stats, so
   *  it survives switching all three off. Empty + published = gone; empty in
   *  the builder still offers a click target so it can be put back. */
  const showLocationCell = !!props.eventLocation?.trim() || isEditor;

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

  /* ── body sections ─────────────────────────────────────────────────────
     Each is a value so `sectionOrder` can arrange them; the hero and close
     bookend the page and are rendered directly. ── */
  const noteSection = showNote ? (
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
  ) : null;

  /**
   * Day navigation. "tabs" shows one day at a time, which is the real answer
   * to a 3-day, 40-session agenda — but it is DISABLED under a static render
   * and in the builder. A snapshot never clicks, so tabbing a prerender would
   * ship a page whose days 2 and 3 are invisible (the same class of bug as the
   * scroll-reveal export failure), and an author has to be able to edit every
   * day. Even when tabs ARE live, non-active days stay in the DOM behind
   * `hidden` rather than being unmounted.
   */
  const dayNavMode = props.dayNav ?? "off";
  const dayTabs = dayNavMode === "tabs" && !staticRender && !isEditor && days.length > 1;

  const scheduleSurface = sectionSurface(props.scheduleBackgroundStyle, props.scheduleBgColor);
  /* Short alias — the schedule is the longest section and every ink in it must
     resolve against ITS surface, not the page's. Painting the background alone
     left the rail, ghost numerals, day labels and reserved cards in page ink. */
  const sch = scheduleSurface;
  const scheduleSection = (
      <div
        id="schedule"
        style={scheduleSurface.isOwnSurface ? { background: scheduleSurface.bg } : undefined}
      >
        <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
        <motion.p {...fadeUp(0)} className={kickerClass} style={{ color: sch.accentText }}>
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
            color: sch.headline,
          }}
        >
          <InlineText as="span" value={props.scheduleHeading ?? "Day by day"} onUpdate={edit("scheduleHeading")} />
        </motion.h2>
        {(props.scheduleIntro || isEditor) && (
          <motion.p {...fadeUp(0.12)} className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: sch.ink.muted }}>
            <InlineText as="span" multiline value={props.scheduleIntro ?? ""} onUpdate={edit("scheduleIntro")} />
          </motion.p>
        )}

        {dayNavMode !== "off" && days.length > 1 && (
          <div
            className="sticky top-0 z-30 -mx-5 mt-10 overflow-x-auto px-5 py-3 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10"
            style={{
              background: sch.bg,
              borderBottom: `1px solid ${mixHex(sch.ink.text, sch.bg, 0.12)}`,
            }}
            role={dayTabs ? "tablist" : undefined}
            aria-label="Days"
          >
            <div className="flex gap-2">
              {days.map((day, i) => {
                const active = dayTabs && i === activeDay;
                return (
                  <button
                    key={i}
                    type="button"
                    role={dayTabs ? "tab" : undefined}
                    aria-selected={dayTabs ? active : undefined}
                    aria-controls={dayTabs ? `agenda-day-${i}` : undefined}
                    onClick={() => {
                      if (dayTabs) { setActiveDay(i); return; }
                      document.getElementById(`agenda-day-${i}`)?.scrollIntoView({
                        behavior: reduced ? "auto" : "smooth", block: "start",
                      });
                    }}
                    className="shrink-0 rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                    style={
                      active
                        ? { background: sch.accentChrome, color: contrastTextColor(sch.accentChrome) }
                        : { border: `1px solid ${mixHex(sch.ink.text, sch.bg, 0.2)}`, color: sch.ink.muted }
                    }
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-14 space-y-16">
          {days.map((day, dayIdx) => (
            <div
              key={dayIdx}
              id={`agenda-day-${dayIdx}`}
              className="relative scroll-mt-24"
              role={dayTabs ? "tabpanel" : undefined}
              /* `hidden` rather than unmounting: the copy stays in the DOM for
                 the HTML export, scrapers and in-page search even when a
                 visitor is looking at one day. */
              hidden={dayTabs && dayIdx !== activeDay}
            >
              {/* ghost day numeral */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 right-0 select-none font-bold tabular-nums sm:-top-10"
                style={{
                  fontFamily: NUMBERS,
                  fontSize: "clamp(4.5rem, 9vw, 7rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  color: mixHex(sch.ink.text, sch.bg, 0.07),
                }}
              >
                {String(dayIdx + 1).padStart(2, "0")}
              </span>

              {/* Day header */}
              <motion.div {...fadeUp(0)} className="relative">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3
                    className="font-bold"
                    style={{ fontFamily: DISPLAY, fontSize: "clamp(1.45rem, 2.6vw, 1.95rem)", letterSpacing: "-0.018em", color: sch.headline }}
                  >
                    <InlineText as="span" value={day.label} onUpdate={setDay ? (v) => setDay(dayIdx, { label: v }) : undefined} />
                  </h3>
                  {(day.summary || isEditor) && (
                    <p className="text-base" style={{ color: sch.ink.muted }}>
                      <InlineText as="span" value={day.summary ?? ""} onUpdate={setDay ? (v) => setDay(dayIdx, { summary: v }) : undefined} />
                    </p>
                  )}
                </div>
                <div aria-hidden className="mt-5 flex items-center gap-0">
                  <span className="h-px w-14" style={{ background: sch.accentChrome }} />
                  <span className="h-px flex-1" style={{ background: mixHex(sch.ink.text, sch.bg, 0.14) }} />
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
                  style={{ background: mixHex(sch.ink.text, sch.bg, 0.13) }}
                />
                {day.sessions.map((session, i) => {
                  // Reserved rows are cards, so they re-resolve against the
                  // card surface; everything else against the section's own.
                  const rowInk = session.isReserved ? sch.cardInk : sch.ink;
                  const rowHeadline = session.isReserved ? sch.headlineOnCard : sch.headline;
                  const rowAccent = session.isReserved ? sch.accentOnCard : sch.accentText;
                  const rowSurface = session.isReserved ? sch.cardBg : sch.bg;
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
                        {sessionCtaMode === "register" ? (
                          sessionRegisterHref() && (
                            <a
                              href={sessionRegisterHref()}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Register for "${session.title}"`}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                              style={{
                                border: `1px solid ${mixHex(rowInk.text, rowSurface, 0.22)}`,
                                color: rowInk.muted,
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              {props.sessionRegisterLabel || "Register"}
                            </a>
                          )
                        ) : sessionCtaMode === "calendar" && sessionCalendarReady(day, session) ? (
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
                        ) : null}
                      </div>

                      {/* body */}
                      <div className="min-w-0">
                        {/* Only mount the meta row when something will land in
                            it — otherwise switching the labels off leaves an
                            empty flex row nudging the title down. "Reserved for
                            you" is the personalization the page exists for, so
                            it survives even when the labels are off. */}
                        {(session.isReserved || (showSessionMeta && (session.sessionType || session.track))) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.16em]">
                          {session.isReserved && (
                            <span className="inline-flex items-center gap-1.5" style={{ color: rowAccent }}>
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: rowAccent }} />
                              Reserved for you
                            </span>
                          )}
                          {showSessionMeta && session.sessionType && !session.isReserved && (
                            <span style={{ color: rowInk.muted }}>{session.sessionType}</span>
                          )}
                          {showSessionMeta && session.track && (
                            <span className="flex items-center gap-3" style={{ color: rowInk.muted }}>
                              <span aria-hidden className="h-3 w-px" style={{ background: mixHex(rowInk.text, rowSurface, 0.3) }} />
                              {session.track}
                            </span>
                          )}
                        </div>
                        )}
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
                          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed" style={{ color: rowInk.muted, ...descriptionClamp }}>
                            <InlineText
                              as="span"
                              multiline
                              value={session.description ?? ""}
                              onUpdate={setSession ? (v) => setSession(dayIdx, i, { description: v }) : undefined}
                            />
                          </p>
                        )}
                        {showWhyAttend && (session.whyAttend || isEditor) && (
                          <div
                            className="mt-4 max-w-2xl border-l-2 py-0.5 pl-4"
                            style={{ borderColor: sch.accentChrome }}
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
                          borderColor: session.isReserved ? sch.accentChrome : mixHex(sch.ink.text, sch.bg, 0.35),
                          background: session.isReserved ? sch.accentChrome : sch.bg,
                        }}
                      />
                      {session.isReserved ? (
                        <article
                          className="my-5 rounded-2xl px-6 py-6 sm:px-8"
                          style={{
                            background: sch.cardBg,
                            border: `1px solid ${mixHex(sch.accentChrome, sch.cardBg, 0.4)}`,
                            boxShadow: "0 28px 56px -44px rgba(28, 25, 23, 0.4)",
                          }}
                        >
                          {body}
                        </article>
                      ) : (
                        <article
                          className="border-b py-7"
                          style={{ borderColor: mixHex(sch.ink.text, sch.bg, 0.12) }}
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
      </div>
  );

  /* Four sections, four different shapes — a roster of portraits, alternating
     speaker features, a plain grouped sponsor wall, and a numbered resource
     index. They deliberately share only the header lockup. */
  /* Special meetings: the private 1:1s reserved for THIS account — the most
     personalized thing on the page, so they get the concierge-card register
     (accent rule, card surface), matching how reserved sessions read in the
     schedule. Deliberately not another hairline list. */
  const meetingsSurface = sectionSurface(props.meetingsBackgroundStyle, props.meetingsBgColor);
  const meetingsList = props.meetings ?? [];
  const showMeetings = props.showMeetings !== false && (meetingsList.length > 0 || isEditor);
  const setMeeting = set
    ? (i: number, patch: Partial<EvaMeeting>) =>
        set("meetings", meetingsList.map((m, j) => (j === i ? { ...m, ...patch } : m)))
    : undefined;
  const meetingsSection = showMeetings ? (
    <div
      id="meetings"
      style={meetingsSurface.isOwnSurface ? { background: meetingsSurface.bg } : undefined}
    >
      <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
        {sectionHeader("meetingsKicker", "meetingsHeading", "meetingsSubheadline", {
          kicker: "Reserved for you",
          heading: "Your private meetings",
        }, { align: props.meetingsAlign ?? "left", size: props.meetingsHeadingSize ?? "md", surface: meetingsSurface })}
        <ul className="mt-10 grid gap-5 lg:grid-cols-2">
          {meetingsList.map((meeting, i) => (
            <motion.li
              key={i}
              {...fadeUp(Math.min(i * 0.06, 0.24))}
              className="rounded-2xl border-l-4 p-6 sm:p-7"
              style={{
                background: meetingsSurface.cardBg,
                borderLeftColor: meetingsSurface.accentOnCard,
                border: `1px solid ${mixHex(meetingsSurface.cardInk.text, meetingsSurface.cardBg, 0.1)}`,
                borderLeft: `4px solid ${meetingsSurface.accentOnCard}`,
                boxShadow: "0 20px 44px -36px rgba(28, 25, 23, 0.35)",
              }}
            >
              {(meeting.time || isEditor) && (
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: meetingsSurface.accentOnCard }}>
                  <InlineText as="span" value={meeting.time ?? ""} onUpdate={setMeeting ? (v) => setMeeting(i, { time: v }) : undefined} />
                </p>
              )}
              <p
                className="mt-2 font-bold"
                style={{ fontFamily: DISPLAY, fontSize: "clamp(1.15rem, 1.9vw, 1.4rem)", lineHeight: 1.25, letterSpacing: "-0.012em", color: meetingsSurface.headlineOnCard }}
              >
                <InlineText as="span" value={meeting.title} onUpdate={setMeeting ? (v) => setMeeting(i, { title: v }) : undefined} />
              </p>
              {(meeting.host || isEditor) && (
                <p className="mt-2 text-[14px]" style={{ color: meetingsSurface.cardInk.text }}>
                  {"with "}
                  <span className="font-semibold">
                    <InlineText as="span" value={meeting.host ?? ""} onUpdate={setMeeting ? (v) => setMeeting(i, { host: v }) : undefined} />
                  </span>
                  {(meeting.hostTitle || isEditor) && (
                    <span style={{ color: meetingsSurface.cardInk.muted }}>
                      {" · "}
                      <InlineText as="span" value={meeting.hostTitle ?? ""} onUpdate={setMeeting ? (v) => setMeeting(i, { hostTitle: v }) : undefined} />
                    </span>
                  )}
                </p>
              )}
              {(meeting.location || isEditor) && (
                <p className="mt-1 text-[13px]" style={{ color: meetingsSurface.cardInk.muted }}>
                  <InlineText as="span" value={meeting.location ?? ""} onUpdate={setMeeting ? (v) => setMeeting(i, { location: v }) : undefined} />
                </p>
              )}
              {(meeting.note || isEditor) && (
                <p className="mt-3 text-[14px] leading-relaxed" style={{ color: meetingsSurface.cardInk.muted, fontFamily: DISPLAY }}>
                  <InlineText as="span" multiline value={meeting.note ?? ""} onUpdate={setMeeting ? (v) => setMeeting(i, { note: v }) : undefined} />
                </p>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  ) : null;

  const teamSurface = sectionSurface(props.teamBackgroundStyle, props.teamBgColor);
  const teamSection = showTeam ? (
    <div
      id="team"
      style={teamSurface.isOwnSurface ? { background: teamSurface.bg } : undefined}
    >
      <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
      {sectionHeader("teamKicker", "teamHeading", "teamSubheadline", {
        kicker: "Your account team",
        heading: "The people looking after you",
      }, { align: props.teamAlign ?? "center", size: props.teamHeadingSize, surface: teamSurface })}
      {(props.teamLayout ?? "roster") === "roster" ? (
        <ul className={`mt-12 grid gap-x-8 gap-y-12 ${rosterScale.grid}`}>
          {team.map((person, i) => rosterEntry(person, i, teamSurface))}
        </ul>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2">
          {team.map((person, i) => compactEntry(person, i, teamSurface))}
        </ul>
      )}
      </div>
    </div>
  ) : null;

  const speakersSurface = sectionSurface(props.speakersBackgroundStyle, props.speakersBgColor);
  const speakersSection = showSpeakers ? (
    <div
      id="speakers"
      style={speakersSurface.isOwnSurface ? { background: speakersSurface.bg } : undefined}
    >
      <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
      {sectionHeader("speakersKicker", "speakersHeading", "speakersSubheadline", {
        kicker: "Keynotes",
        heading: "Who you'll hear from",
      }, { align: props.speakersAlign, size: props.speakersHeadingSize ?? "xl", surface: speakersSurface })}
      {(props.speakersLayout ?? "feature") === "feature" ? (
        <ul className="mt-12 space-y-10">
          {speakers.map((person, i) => speakerFeature(person, i, speakersSurface))}
        </ul>
      ) : (
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((person, i) => speakerGridEntry(person, i, speakersSurface))}
        </ul>
      )}
      </div>
    </div>
  ) : null;

  /* Special guest / musical act: a POSTER, not another directory row. The
     headline act of an event gets billing — one large image with the name set
     over it — which is also what stops this section reading as "speakers
     again". Falls back to a typographic band when there's no image. */
  const guestSurface = sectionSurface(props.guestBackgroundStyle, props.guestBgColor);
  const showGuest = props.showGuest !== false && (!!props.guestName?.trim() || isEditor);
  const guestHasImage = !!props.guestImageUrl?.trim();
  const guestBilling = (onImage: boolean) => {
    const nameColor = onImage ? "#FFFFFF" : guestSurface.headline;
    const metaColor = onImage ? "rgba(255,255,255,0.78)" : guestSurface.ink.muted;
    const roleColor = onImage ? "rgba(255,255,255,0.9)" : guestSurface.accentText;
    return (
      <>
        {(props.guestRole || isEditor) && (
          <p className="text-[11px] font-bold uppercase tracking-[0.26em]" style={{ color: roleColor }}>
            <InlineText as="span" value={props.guestRole ?? ""} onUpdate={edit("guestRole")} />
          </p>
        )}
        <p
          className="mt-3 font-bold"
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(2.1rem, 5.5vw, 4rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            color: nameColor,
          }}
        >
          <InlineText as="span" value={props.guestName ?? ""} onUpdate={edit("guestName")} />
        </p>
        {(props.guestMeta || isEditor) && (
          <p className="mt-4 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: metaColor }}>
            <InlineText as="span" value={props.guestMeta ?? ""} onUpdate={edit("guestMeta")} />
          </p>
        )}
      </>
    );
  };
  const guestSection = showGuest ? (
    <div
      id="guest"
      style={guestSurface.isOwnSurface ? { background: guestSurface.bg } : undefined}
    >
      <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
        {sectionHeader("guestKicker", "guestHeading", "guestSubheadline", {
          kicker: "After hours",
          heading: "Your special guest",
        }, { align: props.guestAlign ?? "left", size: props.guestHeadingSize ?? "lg", surface: guestSurface })}

        <motion.div {...fadeUp(0.1)} className="mt-10">
          {guestHasImage ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={props.guestImageUrl}
                alt={props.guestName || "Special guest"}
                className="h-[22rem] w-full object-cover sm:h-[28rem]"
                loading="lazy"
              />
              {/* Scrim so the billing reads on any photograph. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0.05) 75%)" }}
              />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">{guestBilling(true)}</div>
            </div>
          ) : (
            <div
              className="rounded-2xl border px-6 py-10 sm:px-10 sm:py-14"
              style={{
                background: guestSurface.cardBg,
                borderColor: mixHex(guestSurface.cardInk.text, guestSurface.cardBg, 0.12),
              }}
            >
              {guestBilling(false)}
            </div>
          )}
        </motion.div>

        {(props.guestBio || isEditor) && (
          <motion.p
            {...fadeUp(0.16)}
            className="mt-8 max-w-2xl text-[17px] leading-relaxed"
            style={{ color: guestSurface.ink.text, fontFamily: DISPLAY }}
          >
            <InlineText as="span" multiline value={props.guestBio ?? ""} onUpdate={edit("guestBio")} />
          </motion.p>
        )}

        {(props.guestVideoUrl?.trim() || props.guestLinkUrl?.trim()) && (
          <motion.div {...fadeUp(0.2)} className="mt-7">
            {props.guestVideoUrl?.trim() ? (
              <button
                type="button"
                onClick={() => setVideoUrl(props.guestVideoUrl ?? "")}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                style={{
                  border: `1px solid ${mixHex(guestSurface.ink.text, guestSurface.bg, 0.3)}`,
                  color: guestSurface.ink.text,
                }}
              >
                <PlayCircle className="h-4 w-4" aria-hidden />
                {props.guestLinkLabel || "Watch"}
              </button>
            ) : (
              <a
                href={props.guestLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                style={{
                  border: `1px solid ${mixHex(guestSurface.ink.text, guestSurface.bg, 0.3)}`,
                  color: guestSurface.ink.text,
                }}
              >
                {props.guestLinkLabel || "Listen"}
              </a>
            )}
          </motion.div>
        )}
      </div>
    </div>
  ) : null;

  /* Sponsor wall: logos grouped under a plain tier label. No plates, no pills —
     tiers are set as small caps over a hairline, which is how a real sponsor
     wall reads and keeps the page from looking like a dashboard. */
  const sponsorTiers = (() => {
    const groups = new Map<string, { sponsor: EvaSponsor; i: number }[]>();
    sponsors.forEach((sponsor, i) => {
      const tier = (sponsor.tier ?? "").trim();
      groups.set(tier, [...(groups.get(tier) ?? []), { sponsor, i }]);
    });
    return [...groups.entries()];
  })();

  const sponsorsSurface = sectionSurface(props.sponsorsBackgroundStyle, props.sponsorsBgColor);

  /**
   * ONE size for every sponsor mark — sponsor logos arrive at wildly different
   * intrinsic sizes, and sizing them individually is exactly the fiddly work
   * this is meant to remove. The cap scales with its container so a larger
   * setting can't clip the mark against a fixed-height box.
   */
  const SPONSOR_SIZES: Record<NonNullable<EventAgendaBlockProps["sponsorLogoSize"]>, {
    mark: string; row: string; plate: string;
  }> = {
    sm: { mark: "max-h-8", row: "h-14", plate: "h-20" },
    md: { mark: "max-h-12", row: "h-20", plate: "h-24" },
    lg: { mark: "max-h-16", row: "h-24", plate: "h-28" },
    xl: { mark: "max-h-24", row: "h-32", plate: "h-36" },
  };
  const sponsorSize = SPONSOR_SIZES[props.sponsorLogoSize ?? "md"] ?? SPONSOR_SIZES.md;
  const showSponsorNames = props.showSponsorNames ?? false;

  const sponsorMark = (sponsor: EvaSponsor, i: number, plated: boolean) => {
    const sf = sponsorsSurface;
    const hasLogo = !!sponsor.logoUrl?.trim();
    const mark = hasLogo ? (
      <img
        src={sponsor.logoUrl}
        alt={sponsor.name}
        className={`${sponsorSize.mark} w-auto max-w-full object-contain`}
        loading="lazy"
      />
    ) : (
      // No logo — the NAME is the mark. Rendering a name line underneath it
      // too would just print it twice, so `showSponsorNames` is ignored here.
      <span
        className="text-center font-bold"
        style={{ fontFamily: DISPLAY, fontSize: "clamp(1.05rem, 1.8vw, 1.35rem)", color: plated ? sf.headlineOnCard : sf.headline, letterSpacing: "-0.015em" }}
      >
        <InlineText
          as="span"
          value={sponsor.name}
          onUpdate={setItem ? (v) => setItem("sponsors", i, { name: v }) : undefined}
        />
      </span>
    );
    const box = plated ? (
      <span
        className={`flex ${sponsorSize.plate} items-center justify-center rounded-xl px-5`}
        style={{ background: sf.cardBg, border: `1px solid ${mixHex(sf.cardInk.text, sf.cardBg, 0.1)}` }}
      >
        {mark}
      </span>
    ) : (
      <span className={`flex ${sponsorSize.row} items-center justify-center px-2`}>{mark}</span>
    );
    const inner = hasLogo && showSponsorNames ? (
      <span className="flex flex-col items-center gap-2.5">
        {box}
        <span
          className="text-center text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: sf.ink.muted }}
        >
          <InlineText
            as="span"
            value={sponsor.name}
            onUpdate={setItem ? (v) => setItem("sponsors", i, { name: v }) : undefined}
          />
        </span>
      </span>
    ) : (
      box
    );
    return sponsor.url?.trim() && !isEditor ? (
      <a
        href={sponsor.url}
        target="_blank"
        rel="noreferrer"
        className="block transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {inner}
      </a>
    ) : (
      inner
    );
  };
  const sponsorsSection = showSponsors ? (
    <div
      id="sponsors"
      style={
        sponsorsSurface.isOwnSurface
          ? { background: sponsorsSurface.bg }
          // Legacy default: a whisper of accent so the wall separates from its
          // neighbours without needing an explicit background.
          : props.sponsorsBand === false ? undefined : { background: mixHex(accentChrome, bg, 0.05) }
      }
    >
      <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
        {sectionHeader("sponsorsKicker", "sponsorsHeading", "sponsorsSubheadline", {
          kicker: "Partners",
          heading: "Who's making it happen",
        }, { align: props.sponsorsAlign ?? "center", size: props.sponsorsHeadingSize ?? "md", surface: sponsorsSurface })}
        {(props.sponsorsLayout ?? "wall") === "wall" ? (
          <div className="mt-12 space-y-12">
            {sponsorTiers.map(([tier, entries], t) => (
              <motion.div key={tier || `tier-${t}`} {...fadeUp(Math.min(t * 0.08, 0.24))}>
                {tier && (
                  <div className="flex items-center gap-4">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.26em]"
                      style={{ color: sponsorsSurface.ink.muted }}
                    >
                      {tier}
                    </span>
                    <span aria-hidden className="h-px flex-1" style={{ background: mixHex(sponsorsSurface.ink.text, sponsorsSurface.bg, 0.14) }} />
                  </div>
                )}
                <ul className="mt-6 grid grid-cols-2 items-center gap-x-10 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {entries.map(({ sponsor, i }) => (
                    <li key={i}>{sponsorMark(sponsor, i, false)}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        ) : (
          <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sponsors.map((sponsor, i) => (
              <motion.li key={i} {...fadeUp(Math.min(i * 0.04, 0.2))}>
                {sponsorMark(sponsor, i, true)}
                {(sponsor.tier || isEditor) && (
                  <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: sponsorsSurface.ink.muted }}>
                    <InlineText
                      as="span"
                      value={sponsor.tier ?? ""}
                      onUpdate={setItem ? (v) => setItem("sponsors", i, { tier: v }) : undefined}
                    />
                  </p>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  /* Resources: a numbered index. The kind is small-caps text in the number
     column, not a chip — reads like a contents page, not a tag cloud. */
  const resourcesSurface = sectionSurface(props.resourcesBackgroundStyle, props.resourcesBgColor);
  const resourcesSection = showResources ? (
    <div
      id="resources"
      style={resourcesSurface.isOwnSurface ? { background: resourcesSurface.bg } : undefined}
    >
      <div className={`mx-auto w-full max-w-4xl px-5 sm:px-8 lg:px-10 ${sectionPy}`}>
      {sectionHeader("resourcesKicker", "resourcesHeading", "resourcesSubheadline", {
        kicker: "Before you go",
        heading: "Take the week with you",
      }, { align: props.resourcesAlign, size: props.resourcesHeadingSize ?? "md", surface: resourcesSurface })}
      {(props.resourcesLayout ?? "index") === "index" ? (
        <ul className="mt-10">
          {resources.map((resource, i) => {
            const body = (
              <>
                <div className="w-16 shrink-0 pt-1">
                  <span
                    className="block text-[13px] font-bold tabular-nums"
                    style={{ fontFamily: NUMBERS, color: accentText, letterSpacing: "0.04em" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {(resource.kind || isEditor) && (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ink.muted }}>
                      <InlineText
                        as="span"
                        value={resource.kind ?? ""}
                        onUpdate={setItem ? (v) => setItem("resources", i, { kind: v }) : undefined}
                      />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-bold"
                    style={{ fontFamily: DISPLAY, fontSize: "clamp(1.15rem, 2vw, 1.45rem)", lineHeight: 1.22, letterSpacing: "-0.014em", color: headline }}
                  >
                    <InlineText
                      as="span"
                      value={resource.title}
                      onUpdate={setItem ? (v) => setItem("resources", i, { title: v }) : undefined}
                    />
                  </p>
                  {(resource.description || isEditor) && (
                    <p className="mt-2 text-[15px] leading-relaxed" style={{ color: ink.muted }}>
                      <InlineText
                        as="span"
                        multiline
                        value={resource.description ?? ""}
                        onUpdate={setItem ? (v) => setItem("resources", i, { description: v }) : undefined}
                      />
                    </p>
                  )}
                </div>
                {resource.url?.trim() && !isEditor && (
                  <span aria-hidden className="shrink-0 self-center text-xl" style={{ color: accentText }}>→</span>
                )}
              </>
            );
            const rowClass = "flex gap-6 border-b py-7";
            const rowStyle = { borderColor: mixHex(ink.text, bg, 0.12) } as React.CSSProperties;
            return (
              <motion.li key={i} {...fadeUp(Math.min(i * 0.05, 0.2))}>
                {resource.url?.trim() && !isEditor ? (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${rowClass} transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`}
                    style={rowStyle}
                  >
                    {body}
                  </a>
                ) : (
                  <div className={rowClass} style={rowStyle}>{body}</div>
                )}
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {resources.map((resource, i) => {
            const inner = (
              <>
                {(resource.kind || isEditor) && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentOnCard }}>
                    <InlineText
                      as="span"
                      value={resource.kind ?? ""}
                      onUpdate={setItem ? (v) => setItem("resources", i, { kind: v }) : undefined}
                    />
                  </span>
                )}
                <p
                  className="mt-3 font-bold"
                  style={{ fontFamily: DISPLAY, fontSize: "1.25rem", lineHeight: 1.24, color: headlineOnCard }}
                >
                  <InlineText
                    as="span"
                    value={resource.title}
                    onUpdate={setItem ? (v) => setItem("resources", i, { title: v }) : undefined}
                  />
                </p>
                {(resource.description || isEditor) && (
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: cardInk.muted }}>
                    <InlineText
                      as="span"
                      multiline
                      value={resource.description ?? ""}
                      onUpdate={setItem ? (v) => setItem("resources", i, { description: v }) : undefined}
                    />
                  </p>
                )}
              </>
            );
            const cardClass = "flex h-full flex-col rounded-2xl p-6";
            const cardStyle = {
              background: cardBg,
              border: `1px solid ${mixHex(cardInk.text, cardBg, 0.12)}`,
            } as React.CSSProperties;
            return (
              <motion.li key={i} {...fadeUp(Math.min(i * 0.05, 0.2))}>
                {resource.url?.trim() && !isEditor ? (
                  <a href={resource.url} target="_blank" rel="noreferrer" className={cardClass} style={cardStyle}>{inner}</a>
                ) : (
                  <div className={cardClass} style={cardStyle}>{inner}</div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  ) : null;

  const rsvpSection = showRsvp ? (
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
  ) : null;

  /**
   * Resolve the render order: the author's `sectionOrder` first (unknown ids
   * dropped, duplicates ignored), then any canonical section they didn't list
   * appended in its default position. That last part matters — a page saved
   * before a section existed must not silently hide it, and it's what lets a
   * partial order like ["schedule"] mean "schedule first, rest as usual".
   */
  const sectionNodes: Record<EvaSectionId, React.ReactNode> = {
    note: noteSection,
    meetings: meetingsSection,
    team: teamSection,
    speakers: speakersSection,
    guest: guestSection,
    schedule: scheduleSection,
    sponsors: sponsorsSection,
    resources: resourcesSection,
    rsvp: rsvpSection,
  };
  const requested = (props.sectionOrder ?? []).filter((id) => id in sectionNodes);
  const seenSections = new Set<EvaSectionId>();
  const resolvedOrder: EvaSectionId[] = [];
  for (const id of requested) {
    if (seenSections.has(id)) continue;
    seenSections.add(id);
    resolvedOrder.push(id);
  }
  for (const id of EVA_SECTION_ORDER) {
    if (!seenSections.has(id)) resolvedOrder.push(id);
  }
  const orderedBody = resolvedOrder.map((id) =>
    sectionNodes[id] ? <Fragment key={id}>{sectionNodes[id]}</Fragment> : null,
  );

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
              tenantLogoFirst
              logoHeightClass={logoHeights.header}
              logoHeightRem={logoHeights.headerRem}
              balanceAccountLogo={(props.accountLogoSize ?? "auto") === "auto"}
              accountLogoHeightRem={
                props.accountLogoSize && props.accountLogoSize !== "auto" && props.accountLogoSize !== "match"
                  ? LOGO_HEIGHTS[props.accountLogoSize].headerRem
                  : undefined
              }
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
                  {heroSecondary}
                </motion.div>

                {/* editorial stat strip */}
                {(heroStats.length > 0 || showLocationCell) && (
                  <motion.dl
                    {...fadeUp(0.3)}
                    className="mt-12 flex flex-wrap items-stretch gap-x-10 gap-y-6 border-t pt-8"
                    style={{ borderColor: mixHex(heroInk.text, heroBg, 0.16) }}
                  >
                    {heroStats.map((stat) => (
                      <div key={stat.key} className="min-w-[7rem]">
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
                          <InlineText
                            as="span"
                            value={stat.label}
                            onUpdate={edit(stat.field)}
                          />
                        </dt>
                      </div>
                    ))}
                    {showLocationCell && (
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
                          <InlineText as="span" value={props.eventLocation ?? ""} onUpdate={edit("eventLocation")} />
                        </dd>
                        {/* No fallback copy. A hardcoded "on location" here meant
                            clearing the dates field left a phantom line behind
                            instead of removing it. */}
                        {(props.eventDates?.trim() || isEditor) && (
                          <dt className="mt-2 text-[13px] leading-snug" style={{ color: heroInk.muted }}>
                            <InlineText as="span" value={props.eventDates ?? ""} onUpdate={edit("eventDates")} />
                          </dt>
                        )}
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

      {/* ── body: note / team / speakers / schedule / sponsors / resources / rsvp,
             ordered by `sectionOrder` (hero + close bookend the page) ── */}
      {orderedBody}
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
                  className={`${logoHeights.footer} w-auto`}
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

      {/* Shared lightbox for the hero trailer and the special guest's clip. */}
      <VideoModal
        open={!!videoUrl}
        onClose={() => setVideoUrl("")}
        videoUrl={videoUrl}
        ariaLabel={props.eventName ? `${props.eventName} video` : "Video"}
      />
    </section>
  );
}
