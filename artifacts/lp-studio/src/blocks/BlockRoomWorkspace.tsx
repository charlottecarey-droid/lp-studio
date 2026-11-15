import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Check, ChevronDown, Copy, Download, FileText, Video, ExternalLink, Eye, EyeOff, Heart, Loader2, Mail, MessageSquare, PencilLine, Plus, Upload, UserPlus, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { trackHubAsset, type HubAsset } from "./hub/hub-assets";
import { ROOM_UPLOAD_ACCEPT, useRoom, type RoomRequest, type RoomSnapshot, type RoomStoreHandle, type RoomPractice, type RoomSyncedEvent, type RoomSyncedMinutes, type RoomWin } from "./hub/room-client";

/* ----------------------------------------------------------------------------
 * Partner Room — Workspace — type "room-workspace"
 *
 * A full-page customer workspace for an enterprise partnership, in place of a
 * shared tracker spreadsheet and a media-kit document: a branded cover (both
 * names, where the rollout stands) over a paper sheet with a module list down
 * the side. Each module is a view:
 *
 *   overview   onboarding checklist (until it is done), rollout track, what
 *              needs the customer's attention, counts
 *   wins       a feed either side can post to, like and comment on
 *   goals      what success looks like (agreed with the customer), tracked
 *              from the room's own data where it can be, typed in where not
 *   practices  the rollout by location: region filter, search, stage
 *   marketing  the marketing plan: programs the customer includes or skips
 *   plan       the mutual action plan: milestones by phase, an owner on each
 *              side, target date, status, a checkpoint per phase. Milestones
 *              can be the customer's to complete (tick it, or upload a file)
 *   calendar   what is scheduled, with add-to-calendar and a calendar feed
 *   meetings   minutes: what was decided and who took which action
 *   kit        launch-kit assets: View / Download / Request changes, plus links
 *   requests   everything the customer asked for and where it stands
 *   team       named people on both sides
 *
 * Any module can be hidden per account (`hiddenModules`), and so can any single
 * item inside one (a milestone, an asset, a link, a person, a program, an
 * onboarding step: `hidden`), so a rep tailors the room in the builder. Customer actions (tick, upload, request) go through
 * the partner-room API (blocks/hub/room-client.ts) and need a known visitor:
 * a personal link, or a link emailed to an allowed address. Uploads are one
 * way: the page only ever shows that a file was received.
 *
 * Visual language: the brand's dark colour for the cover and table headers,
 * paper for the sheet, a semantic green for progress and "done"; small type,
 * hairlines, 8–14px corners. NO_REVEAL — it is an app surface, not a
 * scroll-animated page.
 * -------------------------------------------------------------------------- */

export type RoomModuleKey = "overview" | "wins" | "goals" | "plan" | "practices" | "marketing" | "kit" | "calendar" | "meetings" | "requests" | "team";
export const ROOM_MODULES: { key: RoomModuleKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "wins", label: "Wins" },
  { key: "goals", label: "Goals" },
  { key: "plan", label: "Action plan" },
  { key: "practices", label: "Practices" },
  { key: "marketing", label: "Marketing plan" },
  { key: "kit", label: "Launch kit" },
  { key: "calendar", label: "Calendar" },
  { key: "meetings", label: "Meetings" },
  { key: "requests", label: "Requests" },
  { key: "team", label: "Your team" },
];

export type RoomMilestoneStatus = "done" | "on-track" | "pending" | "blocking" | "not-started";
export const ROOM_STATUS_LABEL: Record<RoomMilestoneStatus, string> = {
  done: "Done",
  "on-track": "On track",
  pending: "Pending",
  blocking: "Blocking",
  "not-started": "Not started",
};

export interface RoomMilestone {
  /** Stable key for saved state (optional — a slug of the task when blank). */
  key?: string;
  target?: string;
  task: string;
  note?: string;
  ourOwner?: string;
  partnerOwner?: string;
  status?: RoomMilestoneStatus;
  /** Let the customer complete it from the room: tick it, or hand over a file. */
  customerAction?: "check" | "upload";
  uploadLabel?: string;
  hidden?: boolean;
}

export interface RoomPlanGroup {
  title: string;
  hidden?: boolean;
  /** The shared definition of done for the phase. */
  checkpoint?: string;
  rows: RoomMilestone[];
}

export interface RoomPhase {
  label?: string;
  title: string;
  summary?: string;
  /** Last day of the phase, counted from kickoff (30, 60, 90). */
  endDay?: number;
}

export type RoomAssetKind = "pdf" | "image" | "text" | "link" | "file";
export interface RoomAsset {
  key?: string;
  kind: RoomAssetKind;
  title: string;
  description?: string;
  fileUrl?: string;
  externalUrl?: string;
  /** The copy itself (kind "text"). */
  body?: string;
  hidden?: boolean;
}

export type RoomStepAction = "upload" | "check" | "team" | "link" | "request";
/** One line of the onboarding checklist. */
export interface RoomOnboardingStep {
  key: string;
  title: string;
  description?: string;
  /** upload = hand over a file · check = tick it · team = add people · link = open a page, then tick · request = send details to the team. */
  action: RoomStepAction;
  buttonLabel?: string;
  /** Where "link" goes. */
  url?: string;
  /** Checked off by the team in the builder. */
  done?: boolean;
  hidden?: boolean;
  /** For a "request" step: what kind of request it sends ("marketing" also goes to the marketing intake). */
  requestKind?: string;
}

export type RoomEventKind = "meeting" | "training" | "marketing" | "milestone";
export interface RoomEvent {
  key: string;
  /** YYYY-MM-DD. */
  date: string;
  /** As it should read ("2:00 pm CT · 30 min"). */
  time?: string;
  title: string;
  detail?: string;
  kind?: RoomEventKind;
  hidden?: boolean;
  /** Set on meetings synced from the team's calendar: the real start and end (ISO), used for add-to-calendar. */
  startsAt?: string;
  endsAt?: string | null;
}

export interface RoomMeetingAction {
  text: string;
  owner?: string;
  due?: string;
  done?: boolean;
}
export interface RoomMeeting {
  key: string;
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  attendees?: string;
  summary?: string;
  decisions?: string[];
  actions?: RoomMeetingAction[];
  notesUrl?: string;
  recordingUrl?: string;
  hidden?: boolean;
}

/** Where a goal's current value comes from: typed by the team, or counted from the room. */
export type RoomGoalMetric = "manual" | "practices_live" | "practices_trained" | "plan_complete";
export interface RoomGoal {
  key: string;
  title: string;
  detail?: string;
  /** How the target reads ("40 by Day 90"). */
  target?: string;
  /** The target as a number, for the progress bar. */
  targetValue?: number;
  metric?: RoomGoalMetric;
  /** Manual goals: how today's value reads ("22%") and its number. */
  current?: string;
  currentValue?: number;
  /** Where a manual value came from ("Dandy Insights, Nov 14"). */
  source?: string;
  status?: "on-track" | "pending" | "done";
  owner?: string;
  hidden?: boolean;
}

/** A marketing program the customer can include, skip, or pick an option for. */
export interface RoomProgram {
  key: string;
  title: string;
  description?: string;
  audience?: string;
  when?: string;
  imageUrl?: string;
  /** Two or more choices ("Include", "Not now"). None = fixed, shown as in plan. */
  options?: string[];
  /** Label when the program is fixed ("In plan"). */
  fixedLabel?: string;
  hidden?: boolean;
}
export interface RoomProgramGroup {
  title: string;
  note?: string;
  programs: RoomProgram[];
  hidden?: boolean;
}

export interface RoomTeamMember {
  name: string;
  role?: string;
  owns?: string;
  when?: string;
  email?: string;
  photoUrl?: string;
  hidden?: boolean;
}
export interface RoomTeamGroup {
  title: string;
  members: RoomTeamMember[];
  hidden?: boolean;
}

export interface RoomWorkspaceBlockProps {
  partnerName: string;
  partnerLogoUrl?: string;
  eyebrow?: string;
  title?: string;
  lede?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** Kickoff date, YYYY-MM-DD. Drives "Day N of 90" and each phase's state. */
  kickoffDate?: string;
  rolloutDays?: number;
  nextMilestoneLabel?: string;
  nextMilestoneDate?: string;
  hiddenModules?: RoomModuleKey[];
  phases?: RoomPhase[];
  planIntro?: string;
  planGroups?: RoomPlanGroup[];
  kitIntro?: string;
  assets?: RoomAsset[];
  links?: { title: string; description?: string; url: string; hidden?: boolean }[];
  /** The getting-started checklist on the overview, shown until every step is done. */
  onboarding?: { hidden?: boolean; title?: string; intro?: string; steps: RoomOnboardingStep[] };
  marketing?: { intro?: string; groups: RoomProgramGroup[] };
  /** Goals agreed with the customer. `askAgreement` shows an "Agree to these goals" control until someone agrees. */
  goals?: { intro?: string; askAgreement?: boolean; items: RoomGoal[] };
  calendar?: { intro?: string; events: RoomEvent[] };
  meetings?: { intro?: string; items: RoomMeeting[] };
  /** What the customer calls a location ("practices", "locations", "stores"). */
  locationsNoun?: string;
  teamNote?: string;
  team?: RoomTeamGroup[];
  /** Accent on the dark cover (stats, "make a request"). Blank = the brand accent. */
  accentColor?: string;
}

interface Props {
  props: RoomWorkspaceBlockProps;
  brand: BrandConfig;
  blockId?: string;
  onFieldChange?: (updated: RoomWorkspaceBlockProps) => void;
}

export const ROOM_WORKSPACE_DEFAULT_PROPS: RoomWorkspaceBlockProps = {
  partnerName: "Acme Group",
  partnerLogoUrl: "",
  eyebrow: "Partnership workspace",
  title: "Launch plan",
  lede: "The plan we run together, everything your team needs to announce it, and the people accountable on both sides.",
  heroImageUrl: "",
  heroImageAlt: "",
  kickoffDate: "",
  rolloutDays: 90,
  nextMilestoneLabel: "",
  nextMilestoneDate: "",
  hiddenModules: [],
  phases: [
    { label: "Days 1–30", title: "Foundation & launch", summary: "Plan signed off, partnership announced, first locations trained.", endDay: 30 },
    { label: "Days 31–60", title: "Momentum", summary: "Early wins reviewed, reporting live, next wave scheduled.", endDay: 60 },
    { label: "Days 61–90", title: "Scale & review", summary: "Results reviewed, first success story, plan for what comes next.", endDay: 90 },
  ],
  planIntro: "Every milestone has an owner on each side. Anything blocked for more than a week goes to both executive sponsors.",
  planGroups: [
    {
      title: "Days 1–30 · Foundation & launch",
      checkpoint: "Plan signed off · partnership announced · first locations trained",
      rows: [
        { key: "kickoff", target: "Week 1", task: "Executive kickoff and success metrics", ourOwner: "Account lead", partnerOwner: "Executive sponsor", status: "done" },
        { key: "roster", target: "Week 1", task: "Location roster shared", ourOwner: "Implementation", partnerOwner: "Operations", status: "not-started", customerAction: "upload", uploadLabel: "Upload roster" },
        { key: "announcement", target: "Week 2", task: "Internal announcement to your network", ourOwner: "Marketing", partnerOwner: "Communications", status: "on-track", customerAction: "check" },
      ],
    },
    {
      title: "Days 31–60 · Momentum",
      checkpoint: "Early wins documented · next wave scheduled",
      rows: [
        { key: "first-live", target: "Week 5", task: "First locations live", ourOwner: "Implementation", partnerOwner: "Operations", status: "not-started" },
        { key: "next-wave", target: "Week 8", task: "Next wave identified and planned", ourOwner: "Account lead", partnerOwner: "Regional managers", status: "not-started", customerAction: "check" },
      ],
    },
  ],
  onboarding: {
    title: "",
    intro: "A couple of quick things to get started.",
    steps: [
      { key: "onboard-logo", title: "Upload your logo", description: "So everything we make for you carries your brand.", action: "upload", buttonLabel: "Upload logo" },
      { key: "onboard-team", title: "Add your team", description: "Who we should work with on your side.", action: "team", buttonLabel: "Add people" },
    ],
  },
  marketing: {
    intro: "Choose the support you want from us. Your choices become the plan both marketing teams work from.",
    groups: [
      {
        title: "Standard launch package",
        note: "Included",
        programs: [
          { key: "mk-announcement", title: "Partnership announcement", description: "Email, social posts and a one-pager for your network.", audience: "Leadership, locations", when: "Week 1" },
          { key: "mk-welcome-kits", title: "Welcome kits to every location", description: "Shipped to each location on your list.", audience: "Locations", when: "Week 2" },
        ],
      },
      {
        title: "Optional add-ons",
        note: "Based on your needs",
        programs: [
          { key: "mk-case-study", title: "Your own case study", description: "Built from your first live locations.", audience: "Your whole network", when: "Days 60–90", options: ["Include", "Not now"] },
          { key: "mk-press", title: "Joint press release", description: "Written and distributed by us, approved by your team.", audience: "Public", when: "Flexible", options: ["Include", "Not now"] },
        ],
      },
    ],
  },
  goals: {
    intro: "Agreed at kickoff, so every review starts from the same numbers.",
    askAgreement: true,
    items: [
      { key: "goal-live", title: "Locations live", target: "40 by Day 90", targetValue: 40, metric: "practices_live", owner: "Operations", status: "on-track" },
      { key: "goal-plan", title: "Launch plan complete", target: "All milestones by Day 90", targetValue: 5, metric: "plan_complete", owner: "Both teams", status: "on-track" },
    ],
  },
  calendar: { intro: "Meetings, trainings and marketing sends in one place.", events: [] },
  meetings: { intro: "What was decided, and who took which action.", items: [] },
  locationsNoun: "locations",
  kitIntro: "Approved and ready to use. Need an edit? Request a change on any item and follow it under Requests.",
  assets: [
    { key: "one-pager", kind: "pdf", title: "Partnership one-pager", description: "For regional leaders and locations", fileUrl: "" },
    { key: "announcement-email", kind: "text", title: "Announcement email", description: "Subject line and body, from your leadership team", body: "Subject: Introducing our new partner\n\nDear team,\n\nWe're pleased to announce a new partnership." },
  ],
  links: [],
  teamNote: "Replies within one business day",
  team: [
    {
      title: "Our team",
      members: [
        { name: "Alex Morgan", role: "Account lead", owns: "Partnership strategy and your executive relationship", when: "Kickoff onward", email: "alex@example.com" },
        { name: "Jordan Lee", role: "Account manager", owns: "Your day-to-day partner", when: "From kickoff", email: "jordan@example.com" },
      ],
    },
    {
      title: "Your team",
      members: [
        { name: "Executive sponsor", role: "Leadership", owns: "Champions the partnership; decision-maker", when: "Kickoff, checkpoints, reviews" },
        { name: "Operations lead", role: "Operations", owns: "Owns your side of the action plan", when: "Weekly during rollout" },
      ],
    },
  ],
  accentColor: "",
};

/* ── Pure helpers (exported for tests + the panel) ───────────────────────── */

/** Must match the server (api-server lib/partnerRoom.ts `planTaskKey`). */
export function roomMilestoneKey(row: { key?: string; task?: string }): string {
  const explicit = (row.key ?? "").trim();
  if (explicit) return explicit.slice(0, 80);
  return (row.task ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const STATUSES: RoomMilestoneStatus[] = ["done", "on-track", "pending", "blocking", "not-started"];
export function resolveRoomStatus(s: string | undefined): RoomMilestoneStatus {
  return STATUSES.includes(s as RoomMilestoneStatus) ? (s as RoomMilestoneStatus) : "not-started";
}

/** Day of the rollout (kickoff = day 1). Null without a valid kickoff date or before it. */
export function rolloutDay(kickoffDate: string | undefined, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((kickoffDate ?? "").trim());
  if (!m) return null;
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = Math.floor((today - start) / 86_400_000) + 1;
  return d >= 1 ? d : null;
}

export type RoomPhaseState = "done" | "current" | "upcoming";
/** Where each phase stands on a given day: past its end = done, the first not-yet-ended = current. */
export function phaseStates(phases: RoomPhase[], day: number | null): RoomPhaseState[] {
  if (day === null) return phases.map(() => "upcoming");
  let currentSet = false;
  return phases.map((p) => {
    const end = typeof p.endDay === "number" ? p.endDay : Infinity;
    if (day > end) return "done";
    if (!currentSet) {
      currentSet = true;
      return "current";
    }
    return "upcoming";
  });
}

export function visibleModules(hidden: readonly string[] | undefined): typeof ROOM_MODULES {
  const h = new Set(hidden ?? []);
  // Overview is the landing view: it can be hidden only when something else remains.
  const rest = ROOM_MODULES.filter((m) => !h.has(m.key));
  return rest.length ? rest : ROOM_MODULES.filter((m) => m.key === "overview");
}

/**
 * Who the welcome banner greets: the visitor's first name when we know it (or
 * can read it from a "first.last@" address), otherwise the account name.
 */
export function welcomeName(viewer: { email: string; name: string | null } | null, partnerName: string): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const first = (viewer?.name ?? "").trim().split(/\s+/)[0];
  if (first && /^[\p{L}][\p{L}'’-]*$/u.test(first)) return first === first.toLowerCase() || first === first.toUpperCase() ? cap(first) : first;
  const local = (viewer?.email ?? "").split("@")[0];
  const parts = local.split(/[._]/);
  if (parts.length > 1 && /^[a-z]{2,}$/i.test(parts[0])) return cap(parts[0]);
  return partnerName.trim() || "there";
}

export const ROOM_EVENT_KIND_LABEL: Record<RoomEventKind, string> = { meeting: "Meeting", training: "Training", marketing: "Marketing", milestone: "Milestone" };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const validDay = (v: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim());

/** Visible, dated events split around today, soonest first / most recent first. */
export function splitEvents(events: RoomEvent[] | undefined, today: string): { upcoming: RoomEvent[]; past: RoomEvent[] } {
  const list = (events ?? []).filter((e) => !e.hidden && validDay(e.date) && (e.title ?? "").trim());
  return {
    upcoming: list.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: list.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

const localDay = (iso: string, allDay: boolean) => (allDay ? iso.slice(0, 10) : isoDay(new Date(iso)));

/** A meeting synced from the team's calendar, as a calendar row in the viewer's own time zone. */
export function syncedEventToRoomEvent(e: RoomSyncedEvent): RoomEvent {
  const start = new Date(e.startsAt);
  let time: string | undefined;
  if (!e.allDay && !Number.isNaN(start.getTime())) {
    const mins = e.endsAt ? Math.round((new Date(e.endsAt).getTime() - start.getTime()) / 60_000) : 0;
    time = `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}${mins > 0 && mins < 600 ? ` · ${mins >= 60 && mins % 60 === 0 ? `${mins / 60} hr` : `${mins} min`}` : ""}`;
  }
  return { key: `sync-${e.id}`, date: localDay(e.startsAt, e.allDay), time, title: e.title, kind: "meeting", ...(e.allDay ? {} : { startsAt: e.startsAt, endsAt: e.endsAt }) };
}

/** Published minutes of a synced meeting, as a Meetings row. */
export function syncedMinutesToMeeting(m: RoomSyncedMinutes): RoomMeeting {
  return { key: `sync-${m.id}`, date: localDay(m.startsAt, m.allDay), title: m.title, attendees: m.attendees ?? undefined, summary: m.summary, decisions: m.decisions, actions: m.actions };
}

/** The standing checkpoints of a rollout, dated from the kickoff: kickoff, then Day 30 / 60 / 90. Empty without a valid kickoff date. */
export function standardCheckpoints(kickoffDate: string | undefined): RoomEvent[] {
  if (!validDay(kickoffDate)) return [];
  const k = kickoffDate!.trim();
  const at = (days: number) => {
    const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10) + days));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  return [
    { key: "kickoff", date: at(0), title: "Executive kickoff", detail: "Walk the plan, confirm owners and dates", kind: "milestone" },
    { key: "day-30", date: at(30), title: "Day 30 checkpoint", detail: "First wave, early results, what to adjust", kind: "meeting" },
    { key: "day-60", date: at(60), title: "Day 60 checkpoint", detail: "Rollout health against goals", kind: "meeting" },
    { key: "day-90", date: at(90), title: "Day 90 business review", detail: "Results against goals, and the next wave", kind: "milestone" },
  ];
}

const icsText = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
/** One all-day calendar entry as an .ics file (the time of day rides in the description, so no time zone is guessed). */
export function eventIcs(e: RoomEvent, calendarName: string): string {
  const day = e.date.replace(/-/g, "");
  const next = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(5, 7) - 1, +e.date.slice(8, 10) + 1));
  const end = `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
  // A synced meeting carries its real start and end; anything typed in is an all-day entry.
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const timed = e.startsAt && !Number.isNaN(new Date(e.startsAt).getTime());
  const when = timed ? [`DTSTART:${stamp(e.startsAt!)}`, `DTEND:${stamp(e.endsAt && !Number.isNaN(new Date(e.endsAt).getTime()) ? e.endsAt : new Date(new Date(e.startsAt!).getTime() + 30 * 60_000).toISOString())}`] : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`];
  return ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${icsText(calendarName)}//Room//EN`, "BEGIN:VEVENT", `UID:${icsText(e.key || e.title)}-${day}@room`, `DTSTAMP:${day}T000000Z`, ...when, `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText([e.time, e.detail].filter(Boolean).join(" · "))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

export const ROOM_GOALS_AGREED_KEY = "goals-agreed";
export const ROOM_PRACTICE_STAGE_LABEL: Record<string, string> = { not_started: "Not started", scheduling: "Scheduling", training_booked: "Training booked", trained: "Trained", live: "Live" };

/** A goal's value today: counted from the room for automatic metrics, the typed value otherwise. */
export function goalValue(goal: RoomGoal, ctx: { byStage: Record<string, number>; planDone: number }): number | null {
  if (goal.metric === "practices_live") return ctx.byStage.live ?? 0;
  if (goal.metric === "practices_trained") return (ctx.byStage.trained ?? 0) + (ctx.byStage.live ?? 0);
  if (goal.metric === "plan_complete") return ctx.planDone;
  return typeof goal.currentValue === "number" && Number.isFinite(goal.currentValue) ? goal.currentValue : null;
}

export const ROOM_REQUEST_STATUS_LABEL: Record<string, string> = { new: "Received", in_progress: "In progress", review: "Ready for your review", done: "Done" };
export const ROOM_REQUEST_KIND_LABEL: Record<string, string> = { asset_change: "Asset change", marketing: "Marketing", training: "Training", event: "Event", reporting: "Reporting", other: "Other" };

const fmtDate = (iso: string | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const initials = (name: string) => {
  const w = (name ?? "").trim().split(/\s+/).filter((x) => /^[\p{L}\p{N}]/u.test(x));
  return w.length ? ((w[0][0] ?? "") + (w.length > 1 ? (w[w.length - 1][0] ?? "") : "")).toUpperCase() : "";
};
const FILE_TAG: Record<RoomAssetKind, string> = { pdf: "PDF", image: "IMG", text: "TXT", link: "URL", file: "FILE" };

const CSS = `
.prw{--ink:#0E1A16;--body:#5C6B61;--faint:#9AA69E;--line:#E7E7E0;--paper:#FCFCFA;--page:#F3F4EF;--green:#1AC065;--blue:#224EA0;--amber:#A98600;--red:#B42318;background:var(--page);color:var(--ink);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
.prw *{box-sizing:border-box}
/* The display face is for the page title and each module's headline only; every other heading uses the body face. */
.prw :is(h3,h4,h5,h6){font-family:inherit!important}
.prw a{color:inherit;text-decoration:none}
.prw button{font:inherit;cursor:pointer}
.prw-wrap{max-width:1280px;margin:0 auto;padding:0 32px}
.prw-num{font-variant-numeric:tabular-nums}
.prw-eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--green)}
.prw-cover{background:var(--dark);color:var(--on-dark);position:relative;overflow:hidden}
.prw-top{display:flex;align-items:center;min-height:68px;gap:20px}
.prw-lock{display:flex;align-items:center;gap:12px;font-weight:600;font-size:15px}
.prw-lock img{height:22px;width:auto;display:block}
.prw-lock .x{opacity:.45;font-weight:400}
.prw-req{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:13px;font-weight:700;border:0;white-space:nowrap}
.prw-me{font-size:13px;opacity:.75}
.prw-hero{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:56px;align-items:center;padding:26px 0 100px}
.prw-hero.solo{grid-template-columns:minmax(0,1fr)}
.prw-cover .prw-eyebrow{color:var(--accent)}
.prw-cover h1{font-size:42px;line-height:1.08;letter-spacing:-.03em;font-weight:700;margin:14px 0 12px}
.prw-cover p.lede{opacity:.76;max-width:52ch;font-size:15px;margin:0}
.prw-stats{display:flex;margin-top:28px;border-top:1px solid color-mix(in srgb,var(--on-dark) 18%,transparent)}
.prw-stats>div{padding:16px 28px 0 0}
.prw-stats>div+div{padding-left:28px;border-left:1px solid color-mix(in srgb,var(--on-dark) 18%,transparent)}
.prw-stats b{display:block;font-size:26px;font-weight:700;letter-spacing:-.025em;line-height:1.1}
.prw-stats span{display:block;font-size:12px;opacity:.68;margin-top:5px}
.prw-photo{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:16/10.5;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.prw-photo img{width:100%;height:100%;object-fit:cover;display:block}
.prw-photo .cap{position:absolute;left:14px;bottom:14px;background:color-mix(in srgb,var(--dark) 84%,transparent);backdrop-filter:blur(6px);color:var(--on-dark);border-radius:9px;padding:9px 12px;font-size:12px;display:flex;gap:10px;align-items:center}
.prw-photo .cap b{color:var(--accent);font-size:16px}
.prw-sheet{margin-top:-64px;position:relative;display:grid;grid-template-columns:236px minmax(0,1fr);background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 60px -32px rgba(0,0,0,.35);min-height:520px}
.prw-toc{padding:44px 20px 44px 20px;border-right:1px solid var(--line)}
.prw-toc .h{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 14px 12px}
.prw-toc button{display:flex;gap:12px;align-items:center;width:100%;padding:9px 12px;margin-bottom:2px;border-radius:8px;font-size:13.5px;line-height:1.3;color:var(--body);font-weight:500;background:none;border:0;text-align:left;outline:0}
.prw-toc button:hover{background:color-mix(in srgb,var(--dark) 4%,transparent)}
.prw-toc button:focus-visible{box-shadow:0 0 0 2px color-mix(in srgb,var(--dark) 35%,transparent)}
.prw-toc button .n{color:var(--faint);width:16px}
.prw-toc button em{margin-left:auto;font-style:normal;font-size:11px;font-weight:600;color:var(--amber);white-space:nowrap}
.prw-toc button.on{color:var(--dark);font-weight:600;background:color-mix(in srgb,var(--dark) 6%,transparent)}
.prw-toc button.on .n{color:var(--green)}
.prw-toc .who{margin:24px 12px 0;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--body)}
.prw-toc .who b{display:block;color:var(--ink);font-size:12.5px;word-break:break-word}
.prw-mod{padding:48px 56px 64px;min-width:0}
.prw-sec{margin-top:32px}
.prw-hd{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-bottom:32px}
.prw-hd h2{font-size:32px;line-height:1.12;letter-spacing:-.025em;font-weight:600;color:var(--dark);margin:10px 0 0}
.prw-hd p{margin:12px 0 0;color:var(--body);max-width:60ch;font-size:15px}
.prw-meta{font-size:12.5px;color:var(--body);white-space:nowrap}
.prw-meta b{color:var(--dark)}
.prw-track{position:relative;height:6px;background:#E6E9E3;border-radius:3px;margin:48px 0 24px}
.prw-track i{position:absolute;inset:0 auto 0 0;background:var(--green);border-radius:3px}
.prw-track b{position:absolute;top:-5px;width:2px;height:16px;background:var(--dark)}
.prw-track em{position:absolute;top:-27px;transform:translateX(-50%);font-style:normal;font-size:11.5px;font-weight:700;color:var(--dark);white-space:nowrap}
.prw-phases{display:grid;grid-template-columns:repeat(var(--cols,3),1fr)}
.prw-ph{padding-right:28px}
.prw-ph+.prw-ph{padding-left:28px;border-left:1px solid var(--line)}
.prw-ph .d{font-size:12px;color:var(--body)}
.prw-ph h3{margin:6px 0 8px;font-size:16px;font-weight:600;color:var(--dark)}
.prw-ph p{margin:0;font-size:13px;color:var(--body)}
.prw-st{font-size:12px;font-weight:600;white-space:nowrap}
.prw-st.done{color:var(--green)}.prw-st.on-track,.prw-st.current{color:var(--blue)}.prw-st.pending{color:var(--amber)}.prw-st.blocking{color:var(--red)}.prw-st.not-started,.prw-st.upcoming{color:var(--faint)}
.prw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.prw-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:20px;margin-top:40px}
.prw-kpi{border:1px solid var(--line);border-radius:12px;background:#fff;padding:22px 24px}
.prw-kpi .k{font-size:13px;color:var(--body)}
.prw-kpi .v{font-size:30px;font-weight:600;letter-spacing:-.025em;color:var(--dark);margin-top:8px;line-height:1.1}
.prw-kpi .v small{font-size:12.5px;font-weight:500;color:var(--body);letter-spacing:0}
.prw-card{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
.prw-card>h3{margin:0;padding:18px 24px;font-size:14px;font-weight:600;color:var(--dark);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
.prw-card>h3 button{font-size:12px;font-weight:600;color:var(--body);background:none;border:0;padding:0}
.prw-li{display:flex;gap:16px;align-items:center;padding:16px 24px;border-top:1px solid var(--line);font-size:13.5px}
.prw-li:first-of-type{border-top:0}
.prw-li .t{font-weight:600;color:var(--ink)}
.prw-li .m{font-size:12.5px;color:var(--body);margin-top:2px}
.prw-li .a{margin-left:auto;display:flex;gap:8px;align-items:center;flex:none}
.prw-empty{padding:24px;font-size:13.5px;color:var(--body)}
.prw table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.prw thead th{background:var(--dark);color:var(--on-dark);text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:14px 20px}
.prw td{padding:16px 20px;border-top:1px solid var(--line);font-size:13.5px;vertical-align:middle}
.prw tr.grp td{background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--dark);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 20px}
.prw tr.chk td{background:#FAFBF8;font-size:12.5px;color:var(--body);padding:12px 20px}
.prw tr.chk td b{color:var(--green)}
.prw td .t{font-weight:600;color:var(--ink)}
.prw td .m{font-size:12.5px;color:var(--body);margin-top:3px}
.prw td.c{color:var(--body);white-space:nowrap}
.prw td.r{text-align:right;white-space:nowrap}
.prw-plan,.prw-reqs{table-layout:fixed}
.prw-plan td.c,.prw-reqs td.c{white-space:normal;overflow-wrap:break-word}
.prw-plan td,.prw-plan th{padding-left:16px;padding-right:16px}
.prw-plan td.r{overflow:hidden}
.prw-reqs .prw-chip{white-space:normal}
.prw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border-radius:8px;border:1px solid #D4D8D0;background:#fff;font-size:12.5px;font-weight:600;color:var(--dark);white-space:nowrap}
.prw-btn.pri{background:var(--dark);border-color:var(--dark);color:var(--on-dark)}
.prw-btn:disabled{opacity:.6;cursor:default}
.prw-btn svg{width:13px;height:13px}
.prw-ib{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:8px;border:1px solid #D4D8D0;background:#fff;color:var(--dark);padding:0;flex:none}
.prw-ib svg{width:14px;height:14px}
.prw-ib:hover,.prw-btn:hover{border-color:var(--dark)}
.prw-welcome h2{font-size:40px;line-height:1.08;letter-spacing:-.03em;font-weight:600;color:var(--dark);margin:12px 0 0}
.prw-welcome p{margin:14px 0 0;color:var(--body);font-size:15.5px;max-width:58ch}
.prw-ob{border:1px solid var(--line);border-radius:10px;background:#fff;overflow:hidden;margin-bottom:22px}
.prw-ob .oh{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 20px;background:var(--dark);color:var(--on-dark)}
.prw-ob .oh h3{margin:0;font-size:24px;line-height:1.15;letter-spacing:-.025em;font-weight:700;color:var(--on-dark)}
.prw-ob .oh p{margin:4px 0 0;font-size:13px;opacity:.78}
.prw-ob .oh .prw-meta{color:var(--on-dark);opacity:.8}
.prw-ob .oh .prw-meta b{color:var(--accent)}
.prw-ob .bar{width:140px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--on-dark) 22%,transparent);position:relative;flex:none}
.prw-ob .bar i{position:absolute;inset:0 auto 0 0;border-radius:3px;background:var(--accent)}
.prw-step{display:flex;gap:16px;align-items:center;padding:16px 24px;border-top:1px solid var(--line)}
.prw-att .prw-step .dot{display:none}
.prw-li .a .prw-btn,.prw-step .a .prw-btn,.prw-plan td.r .prw-btn{min-width:104px}
.prw-step:first-of-type{border-top:0}
.prw-step .dot{width:22px;height:22px;border-radius:50%;border:1.5px solid #C9CFC7;display:grid;place-items:center;flex:none;color:#fff;font-size:11px;font-weight:700}
.prw-step.done .dot{background:var(--green);border-color:var(--green)}
.prw-step.done .t{color:var(--body)}
.prw-step .t{font-weight:600;color:var(--ink);font-size:13.5px}
.prw-step .m{font-size:12.5px;color:var(--body);margin-top:2px}
.prw-step .a{margin-left:auto;display:flex;gap:6px;align-items:center;flex:none}
.prw-progs{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.prw-gh{background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--dark);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 20px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}
.prw-gh:first-child{border-top:0}
.prw-gh span{color:var(--body);font-weight:600;letter-spacing:0;text-transform:none;font-size:12px}
.prw-prog{display:grid;grid-template-columns:92px minmax(0,1fr) 132px 96px 236px;gap:20px;align-items:center;padding:16px 20px;border-top:1px solid var(--line)}
.prw-prog .im{width:92px;height:60px;border-radius:7px;object-fit:cover;display:block;background:var(--dark)}
.prw-prog h3{margin:0 0 2px;font-size:14px;font-weight:700;color:var(--dark)}
.prw-prog p{margin:0;font-size:12.5px;color:var(--body)}
.prw-prog .who,.prw-prog .when{font-size:12.5px;color:var(--body)}
.prw-prog .when b{display:block;color:var(--ink);font-weight:600}
.prw-prog .dec{justify-self:end;text-align:right}
.prw-prog .need{display:block;font-size:11.5px;font-weight:700;color:var(--amber);margin-bottom:4px}
.prw-prog .by{display:block;font-size:11.5px;color:var(--body);margin-top:4px}
.prw-seg{display:inline-flex;border:1px solid #D4D8D0;border-radius:8px;overflow:hidden;background:#fff}
.prw-seg button{padding:6px 11px;font-size:12px;font-weight:600;color:var(--body);border:0;border-left:1px solid #D4D8D0;background:#fff;white-space:nowrap}
.prw-seg button:first-child{border-left:0}
.prw-seg button.on{background:var(--dark);color:var(--on-dark)}
.prw-fixed{font-size:12.5px;font-weight:600;color:var(--green)}
.prw-bar{height:5px;border-radius:3px;background:#E6E9E3;position:relative;min-width:90px}
.prw-bar i{position:absolute;inset:0 auto 0 0;border-radius:3px;background:var(--green)}
.prw-bar.warn i{background:#D9A300}
.prw-tools{display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap}
.prw-tools select,.prw-tools input{height:36px;border:1px solid #D4D8D0;border-radius:7px;padding:0 10px;font:inherit;font-size:13px;color:var(--ink);background:#fff}
.prw-tools input{flex:1;min-width:160px}
.prw-pager{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12.5px;color:var(--body)}
.prw-chip.not_started{background:#F1F2EE;color:var(--body)}.prw-chip.scheduling{background:#FBF3D9;color:#7A6100}.prw-chip.training_booked,.prw-chip.trained{background:#E8EEF9;color:var(--blue)}
.prw-agree{display:flex;gap:16px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px 24px;margin-bottom:20px;font-size:13px;color:var(--body)}
.prw-agree b{color:var(--dark)}
.prw-date{width:46px;text-align:center;flex:none;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
.prw-date i{display:block;font-style:normal;background:var(--dark);color:var(--on-dark);font-size:9px;font-weight:700;letter-spacing:.08em;padding:2px 0;text-transform:uppercase}
.prw-date b{display:block;font-size:16px;font-weight:700;color:var(--dark);padding:2px 0 3px}
.prw-chip.kind{background:#F1F2EE;color:var(--body)}
.prw-chip.training{background:#E8EEF9;color:var(--blue)}
.prw-chip.marketing{background:color-mix(in srgb,var(--green) 14%,#fff);color:#0B6B3A}
.prw-chip.milestone{background:#FBF3D9;color:#7A6100}
.prw-month{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:32px 0 12px}
.prw-month:first-of-type{margin-top:0}
.prw-min{border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:16px;overflow:hidden}
.prw-min .mh{display:flex;gap:16px;align-items:center;padding:18px 24px;width:100%;background:none;border:0;text-align:left}
.prw-min .mb{border-top:1px solid var(--line);padding:20px 24px 24px 86px;font-size:13.5px;color:var(--ink);display:grid;grid-template-columns:1fr 1fr;gap:24px}
.prw-min .mb h5{margin:0 0 5px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--green)}
.prw-min .mb ul{margin:0;padding-left:16px}
.prw-min .mb li{margin:3px 0}
.prw-min .mb .sum{grid-column:1/-1;color:var(--body)}
.prw-compose{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px 20px}
.prw-compose textarea,.prw-cbox input{flex:1;border:0;outline:0;font:inherit;background:transparent;color:var(--ink);resize:none;min-width:0}
.prw-win{border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:16px;overflow:hidden}
.prw-win .wt{display:flex;gap:14px;align-items:center;padding:20px 24px 0}
.prw-win .wa{width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--dark) 9%,#fff);color:var(--dark);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.prw-win .wa.team{background:var(--dark);color:var(--accent)}
.prw-win .ww{font-size:13px}
.prw-win .ww b{color:var(--ink)}
.prw-win .ww span{color:var(--body);font-size:12px;display:block}
.prw-win .wb{padding:12px 24px 18px 72px;font-size:14px;color:var(--ink);white-space:pre-wrap}
.prw-win .wb .big{font-size:20px;font-weight:700;letter-spacing:-.02em;color:var(--dark);display:block;margin-bottom:2px}
.prw-win .wx{display:flex;gap:6px;padding:10px 24px 12px 66px;border-top:1px solid var(--line);align-items:center}
.prw-win .wx button{display:inline-flex;gap:6px;align-items:center;padding:5px 10px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--body);background:none;border:0}
.prw-win .wx button.on{background:color-mix(in srgb,var(--dark) 8%,#fff);color:var(--dark)}
.prw-win .wx svg{width:14px;height:14px}
.prw-win .wc{padding:12px 24px 12px 72px;background:#FAFBF8;border-top:1px solid var(--line);font-size:13px;color:var(--body)}
.prw-win .wc b{color:var(--ink)}
.prw-cbox{display:flex;gap:8px;align-items:center;padding:12px 24px 14px 72px;background:#FAFBF8;border-top:1px solid var(--line)}
.prw-link{background:none;border:0;padding:0;font-size:12.5px;font-weight:600;color:var(--dark);text-decoration:underline;text-underline-offset:2px}
.prw-legend{display:flex;gap:18px;margin-top:12px;font-size:12px}
.prw-err{color:var(--red);font-size:12.5px;margin-top:4px}
.prw-docs{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.prw-doc{display:flex;align-items:center;gap:16px;padding:16px 24px;border-top:1px solid var(--line)}
.prw-doc:first-child{border-top:0}
.prw-ft{width:34px;height:40px;border-radius:5px;border:1px solid var(--line);background:var(--paper);display:grid;place-items:end center;padding-bottom:5px;font-size:8.5px;font-weight:700;color:var(--dark);letter-spacing:.04em;flex:none;overflow:hidden}
.prw-ft.img{padding:0;place-items:stretch}
.prw-ft.img img{width:100%;height:100%;object-fit:cover}
.prw-doc .a{margin-left:auto;display:flex;gap:8px;flex:none}
.prw-body{border-top:1px solid var(--line);background:#FAFBF8;padding:14px 16px 16px 64px;font-size:13.5px;white-space:pre-wrap;color:var(--ink)}
.prw-chip{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--green) 14%,#fff);color:#0B6B3A;white-space:nowrap}
.prw-chip.review{background:#FBF3D9;color:#7A6100}.prw-chip.in_progress{background:#E8EEF9;color:var(--blue)}.prw-chip.new{background:#F1F2EE;color:var(--body)}
.prw-sum{display:flex;border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:20px}
.prw-sum div{padding:18px 24px;border-left:1px solid var(--line);font-size:12.5px;color:var(--body)}
.prw-sum div:first-child{border-left:0}
.prw-sum b{display:block;font-size:18px;color:var(--dark);letter-spacing:-.02em}
.prw-av{width:30px;height:30px;border-radius:50%;background:color-mix(in srgb,var(--dark) 9%,#fff);color:var(--dark);display:grid;place-items:center;font-size:11px;font-weight:700;flex:none;object-fit:cover}
.prw-foot{text-align:center;padding:26px 0 48px;font-size:12px;color:var(--faint)}
.prw-modal{position:fixed;inset:0;background:rgba(0,20,16,.5);z-index:1000;display:grid;place-items:center;padding:16px}
.prw-modal .box{width:100%;max-width:480px;background:#fff;border-radius:14px;padding:24px;color:#0E1A16;position:relative;font-size:14px;line-height:1.55}
.prw-modal h3{margin:0 0 4px;font-size:20px;letter-spacing:-.02em;font-weight:700}
.prw-modal p{margin:0 0 14px;color:#5C6B61;font-size:13px}
.prw-modal label{display:block;font-size:12px;font-weight:600;color:#5C6B61;margin:12px 0 5px}
.prw-modal select,.prw-modal textarea,.prw-modal input{width:100%;border:1px solid #D4D8D0;border-radius:8px;padding:9px 11px;font:inherit;color:#0E1A16;background:#fff}
.prw-modal .row{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.prw-modal .x{position:absolute;right:14px;top:14px;background:none;border:0;color:#5C6B61;width:28px;height:28px;display:grid;place-items:center}
@media (max-width:900px){
.prw-wrap{padding:0 16px}
.prw-hero{grid-template-columns:1fr;gap:24px;padding-bottom:88px}
.prw-cover h1{font-size:32px}
.prw-me{display:none}
.prw-top{min-height:60px}
.prw-stats{flex-wrap:wrap;row-gap:4px}
.prw-stats>div{padding:14px 18px 0 0}
.prw-stats>div+div{padding-left:18px}
.prw-stats b{font-size:20px;white-space:nowrap}
.prw-sheet{grid-template-columns:1fr}
.prw-mod{padding:28px 20px 36px}
.prw-welcome h2{font-size:30px}
.prw-hd h2{font-size:26px}
.prw-toc button{margin-bottom:0}
.prw-toc{border-right:0;border-bottom:1px solid var(--line);padding:14px 16px;overflow-x:auto}
.prw-toc .h,.prw-toc .who,.prw-toc button .n{display:none}
.prw-toc .in{display:flex;gap:6px}
.prw-toc button{width:auto;padding:7px 12px;border:1px solid var(--line);border-radius:999px;white-space:nowrap}
.prw-toc button.on{background:var(--dark);color:var(--on-dark);border-color:var(--dark)}
.prw-mod{padding:24px 16px 28px}
.prw-hd{flex-direction:column;align-items:flex-start}
.prw-phases,.prw-grid2,.prw-kpis{grid-template-columns:1fr 1fr}
.prw-ph{padding:0 0 14px!important;border:0!important}
.prw-phases{grid-template-columns:1fr}
.prw-plan thead,.prw-reqs thead{display:none}
.prw-reqs tr{display:block;border-top:1px solid var(--line)}
.prw-reqs td{display:block;border-top:0;padding:2px 14px}
.prw-reqs td:first-child{padding-top:12px}
.prw-reqs td:last-child{padding-bottom:12px}
.prw-plan tr{display:block}
.prw-plan td{display:block;border-top:0;padding:2px 14px;white-space:normal!important;text-align:left!important}
.prw-plan td:first-child{padding-top:12px}
.prw-plan td:last-child{padding-bottom:12px;border-bottom:1px solid var(--line)}
.prw-plan tr.grp td,.prw-plan tr.chk td{padding:8px 14px}
.prw-doc{flex-wrap:wrap}
.prw-doc .a{margin-left:48px;flex-wrap:wrap}
.prw-prog{grid-template-columns:64px minmax(0,1fr);gap:8px 12px}
.prw-prog .im{width:64px;height:48px}
.prw-prog .who,.prw-prog .when,.prw-prog .dec{grid-column:2;justify-self:start;text-align:left}
.prw-step{flex-wrap:wrap}
.prw-min .mb{grid-template-columns:1fr;padding-left:16px}
.prw-win .wb,.prw-win .wx,.prw-win .wc,.prw-cbox{padding-left:16px}
.prw-ob .bar{display:none}
.prw-body{padding-left:16px}
.prw-team thead{display:none}
.prw-team td{display:block;border-top:0;padding:2px 14px;white-space:normal!important}
.prw-team td:first-child{padding-top:12px;border-top:1px solid var(--line)}
.prw-team td:last-child{padding-bottom:12px}
.prw-sum{flex-wrap:wrap}
}
`;

type RequestPreset = { subject: string; assetKey?: string; kind?: string; stepKey?: string; details?: string };
type Ask = { kind: "request"; preset?: RequestPreset } | { kind: "email" } | { kind: "contact" } | null;

export function BlockRoomWorkspace({ props, brand, blockId, onFieldChange }: Props) {
  const isEditor = !!onFieldChange;
  const { pageId, sessionId } = usePageContext();
  const room = useRoom(pageId, !isEditor);
  const { snapshot, store } = room;
  const modules = visibleModules(props.hiddenModules);
  const [view, setView] = useState<RoomModuleKey>(modules[0].key);
  const active = modules.some((m) => m.key === view) ? view : modules[0].key;
  const [ask, setAsk] = useState<Ask>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const dark = isValidHex(brand.primaryColor) ? brand.primaryColor : "#0f172a";
  const accentRaw = (props.accentColor ?? "").trim();
  const accent = isValidHex(accentRaw) ? accentRaw : isValidHex(brand.accentColor) ? brand.accentColor : "#C7E738";
  const vars = { "--dark": dark, "--on-dark": contrastTextColor(dark), "--accent": accent, "--on-accent": contrastTextColor(accent), fontFamily: BRAND_BODY_STACK } as React.CSSProperties;

  const total = Math.max(1, props.rolloutDays ?? 90);
  const day = now ? rolloutDay(props.kickoffDate, now) : null;
  const phases = (props.phases ?? []).slice(0, 5);
  const states = phaseStates(phases, day);
  const groups = useMemo(() => (props.planGroups ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, rows: (g.rows ?? []).filter((r) => !r.hidden) })), [props.planGroups]);
  const assets = (props.assets ?? []).filter((a) => !a.hidden);
  const links = (props.links ?? []).filter((l) => !l.hidden);
  const team = (props.team ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, members: (g.members ?? []).filter((m) => !m.hidden) }));
  const programGroups = (props.marketing?.groups ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, programs: (g.programs ?? []).filter((x) => !x.hidden) }));
  const undecided = programGroups.flatMap((g) => g.programs).filter((x) => (x.options ?? []).length >= 2 && !snapshot.choices[roomMilestoneKey({ key: x.key, task: x.title })]);
  // Onboarding: a step is done when the team ticked it in the builder or the customer completed it.
  const steps = props.onboarding?.hidden ? [] : (props.onboarding?.steps ?? []).filter((x) => !x.hidden).map((x) => ({ step: x, key: roomMilestoneKey({ key: x.key, task: x.title }) })).map((x) => ({ ...x, saved: snapshot.tasks[x.key], done: !!x.step.done || !!snapshot.tasks[x.key]?.done }));
  const stepsOpen = steps.filter((x) => !x.done);
  const goals = (props.goals?.items ?? []).filter((g) => !g.hidden);
  const goalsAgreed = snapshot.tasks[ROOM_GOALS_AGREED_KEY];
  const needsAgreement = !!props.goals?.askAgreement && goals.length > 0 && !goalsAgreed?.done;
  const today = now ? isoDay(now) : "0000-00-00";
  // The page's own events and minutes, plus meetings synced from the team's calendar and the minutes published for them.
  const events = splitEvents([...(props.calendar?.events ?? []), ...snapshot.events.map(syncedEventToRoomEvent)], today);
  const meetings = [...(props.meetings?.items ?? []), ...snapshot.minutes.map(syncedMinutesToMeeting)].filter((m) => !m.hidden && (m.title ?? "").trim()).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const pr = snapshot.practices;
  const noun = (props.locationsNoun ?? "").trim() || "locations";
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  // Milestones with the customer's saved state laid over the builder's status.
  const rows = useMemo(
    () =>
      groups.flatMap((g, gi) =>
        (g.rows ?? []).map((r, ri) => {
          const action = r.customerAction === "check" || r.customerAction === "upload" ? r.customerAction : null;
          const key = roomMilestoneKey(r);
          const saved = action ? snapshot.tasks[key] : undefined;
          return { gi, ri, r, action, key, saved, status: saved?.done ? ("done" as RoomMilestoneStatus) : resolveRoomStatus(r.status) };
        }),
      ),
    [groups, snapshot.tasks],
  );
  const doneCount = rows.filter((x) => x.status === "done").length;
  const mine = rows.filter((x) => x.action && x.status !== "done");
  const reviewRequests = snapshot.requests.filter((q) => q.status === "review");
  const openRequests = snapshot.requests.filter((q) => q.status !== "done");

  const field = (key: keyof RoomWorkspaceBlockProps) => (onFieldChange ? (v: string) => onFieldChange({ ...props, [key]: v }) : undefined);
  const track = (asset: RoomAsset, action: "view" | "download" | "open") => {
    if (isEditor) return;
    const a: HubAsset = { key: asset.key, kind: asset.kind === "file" ? "pdf" : asset.kind, title: asset.title, fileUrl: asset.fileUrl, externalUrl: asset.externalUrl, body: asset.body };
    trackHubAsset({ pageId, sessionId, blockId }, a, action);
  };
  /** Run something that needs a known visitor; ask for their email first when they are anonymous. */
  const needViewer = (fn: () => void) => {
    if (isEditor) return;
    if (!store || !snapshot.viewer) setAsk({ kind: "email" });
    else fn();
  };
  const openRequest = (preset?: RequestPreset) => needViewer(() => setAsk({ kind: "request", preset }));
  const canRequest = modules.some((m) => m.key === "requests");

  const blocked = rows.filter((x) => x.status === "blocking");
  // Everything the customer has to act on, as one number and one list.
  const attention = [...stepsOpen, ...mine, ...reviewRequests];
  const badge: Partial<Record<RoomModuleKey, string>> = {
    overview: stepsOpen.length ? `${stepsOpen.length} to set up` : "",
    goals: needsAgreement ? "to agree" : "",
    marketing: undecided.length ? `${undecided.length} to decide` : "",
    plan: mine.length ? `${mine.length} to do` : "",
    requests: reviewRequests.length ? `${reviewRequests.length} to review` : "",
  };
  const heroImage = (props.heroImageUrl ?? "").trim();
  const partnerLogo = (props.partnerLogoUrl ?? "").trim();
  const pct = day === null ? 0 : Math.min(100, Math.round((day / total) * 100));

  return (
    <section className="prw" style={vars} data-room-workspace>
      <style>{CSS}</style>
      <div className="prw-cover">
        <div className="prw-wrap">
          <div className="prw-top">
            <div className="prw-lock">
              {brandHasLogo(brand) ? <BrandLogo brand={brand} tone="onDark" alt={brand.brandName || "Logo"} /> : <span>{brand.brandName}</span>}
              <span className="x">×</span>
              {partnerLogo ? <img src={partnerLogo} alt={props.partnerName} /> : <span>{props.partnerName}</span>}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
              {!new Set(props.hiddenModules ?? []).has("requests") && (
                <button type="button" className="prw-req" onClick={() => openRequest()} data-room-request-button>
                  <Plus style={{ width: 14, height: 14 }} aria-hidden /> Make a request
                </button>
              )}
              {snapshot.viewer && <span className="prw-me">{snapshot.viewer.name || snapshot.viewer.email}</span>}
            </div>
          </div>
          <div className={`prw-hero${heroImage ? "" : " solo"}`}>
            <div>
              {(props.eyebrow || isEditor) && (
                <div className="prw-eyebrow">
                  <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </div>
              )}
              <h1 style={{ fontFamily: BRAND_DISPLAY_STACK }}>
                {props.partnerName} × {brand.brandName || "us"}
                <br />
                <InlineText as="span" value={props.title ?? ""} onUpdate={field("title")} />
              </h1>
              {(props.lede || isEditor) && (
                <p className="lede">
                  <InlineText as="span" value={props.lede ?? ""} onUpdate={field("lede")} multiline />
                </p>
              )}
              <div className="prw-stats">
                {day !== null && (
                  <div>
                    <b className="prw-num">Day {Math.min(day, total)}</b>
                    <span>of {total}{states.includes("current") ? ` · ${phases[states.indexOf("current")].title}` : ""}</span>
                  </div>
                )}
                {rows.length > 0 && (
                  <div>
                    <b className="prw-num">{doneCount} of {rows.length}</b>
                    <span>plan items complete</span>
                  </div>
                )}
                {mine.length + reviewRequests.length + stepsOpen.length + undecided.length > 0 && (
                  <div>
                    <b className="prw-num">{mine.length + reviewRequests.length + stepsOpen.length + undecided.length}</b>
                    <span>waiting on you</span>
                  </div>
                )}
              </div>
            </div>
            {heroImage && (
              <div className="prw-photo">
                <img src={heroImage} alt={props.heroImageAlt ?? ""} />
                {(props.nextMilestoneLabel ?? "").trim() && (
                  <div className="cap">
                    {(props.nextMilestoneDate ?? "").trim() && <b>{fmtDate(props.nextMilestoneDate)}</b>}
                    <span>Next: {props.nextMilestoneLabel}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="prw-wrap">
        <div className="prw-sheet">
          <aside className="prw-toc">
            <div className="in">
              <div className="h">Workspace</div>
              {modules.map((m, i) => (
                <button key={m.key} type="button" className={m.key === active ? "on" : ""} onClick={() => setView(m.key)} data-room-nav={m.key}>
                  <span className="n prw-num">{String(i + 1).padStart(2, "0")}</span>
                  {m.key === "practices" ? Noun : m.label}
                  {badge[m.key] && <em>{badge[m.key]}</em>}
                </button>
              ))}
              {snapshot.viewer && (
                <div className="who">
                  Signed in as<b>{snapshot.viewer.name || snapshot.viewer.email}</b>
                </div>
              )}
            </div>
          </aside>

          <div className="prw-mod" data-room-view={active}>
            {active === "overview" && (
              <>
                <div className="prw-hd prw-welcome">
                  <div>
                    <div className="prw-eyebrow">Overview</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }} data-room-welcome>
                      {(props.onboarding?.title ?? "").trim() || `Welcome, ${welcomeName(snapshot.viewer, props.partnerName)}!`}
                    </h2>
                    <p>
                      {day !== null
                        ? `Day ${Math.min(day, total)} of ${total}${states.includes("current") ? `, ${phases[states.indexOf("current")].title.toLowerCase()}` : ""}. Here is where the rollout stands.`
                        : "Here is where the rollout stands."}
                    </p>
                  </div>
                  {(props.kickoffDate ?? "").trim() && (
                    <div className="prw-meta">
                      Kickoff <b>{fmtDate(props.kickoffDate)}</b>
                    </div>
                  )}
                </div>
                {phases.length > 0 && (
                  <>
                    <div className="prw-track">
                      <i style={{ width: `${pct}%` }} />
                      {day !== null && (
                        <>
                          <b style={{ left: `${pct}%` }} />
                          <em style={{ left: `${Math.max(8, Math.min(92, pct))}%` }}>Today · Day {Math.min(day, total)}</em>
                        </>
                      )}
                    </div>
                    <div className="prw-phases" style={{ "--cols": phases.length } as React.CSSProperties}>
                      {phases.map((p, i) => (
                        <div className="prw-ph" key={i} data-room-phase={states[i]}>
                          <div className="d">
                            {p.label}
                            {day !== null && (
                              <>
                                {" · "}
                                <span className={`prw-st ${states[i]}`}>{states[i] === "done" ? "Complete" : states[i] === "current" ? "In progress" : "Upcoming"}</span>
                              </>
                            )}
                          </div>
                          <h3>{p.title}</h3>
                          {p.summary && <p>{p.summary}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="prw-kpis">
                  {pr.total > 0 ? (
                    <div className="prw-kpi" data-room-kpi="live">
                      <div className="k">{Noun} live</div>
                      <div className="v prw-num">{pr.byStage.live ?? 0} <small>of {pr.total}</small></div>
                    </div>
                  ) : (
                    <div className="prw-kpi">
                      <div className="k">Plan items complete</div>
                      <div className="v prw-num">{doneCount} <small>of {rows.length}</small></div>
                    </div>
                  )}
                  <div className="prw-kpi">
                    <div className="k">Waiting on you</div>
                    <div className="v prw-num">{attention.length}</div>
                  </div>
                  <div className="prw-kpi">
                    <div className="k">Open requests</div>
                    <div className="v prw-num">{snapshot.viewer ? openRequests.length : "—"}</div>
                  </div>
                </div>
                <div className="prw-grid2 prw-sec">
                  <div className="prw-card prw-att" data-room-attention>
                    <h3>
                      Needs your attention
                      {modules.some((m) => m.key === "plan") && (
                        <button type="button" onClick={() => setView("plan")}>Open action plan</button>
                      )}
                    </h3>
                    {attention.length === 0 && <div className="prw-empty">Nothing is waiting on you.</div>}
                    {/* Setup items (logo, welcome kit, team) sit in the same list as everything else: no separate checklist. */}
                    {stepsOpen.slice(0, 3).map((x) => (
                      <OnboardingStep
                        key={x.key}
                        step={x.step}
                        stepKey={x.key}
                        done={x.done}
                        saved={x.saved}
                        snapshot={snapshot}
                        store={store}
                        isEditor={isEditor}
                        onNeedEmail={() => setAsk({ kind: "email" })}
                        onAddTeam={() => needViewer(() => setAsk({ kind: "contact" }))}
                        onRequest={() => openRequest({ subject: x.step.title, kind: x.step.requestKind || "other", stepKey: x.key })}
                      />
                    ))}
                    {[...mine].sort((a, b) => Number(b.action === "upload") - Number(a.action === "upload")).slice(0, Math.max(2, 5 - Math.min(3, stepsOpen.length))).map((x) => (
                      <div className="prw-li" key={x.key}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t">{x.r.task}</div>
                          <div className="m">{x.r.note || `Action plan${x.r.target ? ` · due ${x.r.target}` : ""}`}</div>
                        </div>
                        <div className="a">
                          <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} />
                        </div>
                      </div>
                    ))}
                    {reviewRequests.slice(0, 2).map((q) => (
                      <div className="prw-li" key={`q${q.id}`}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t">{q.subject}</div>
                          <div className="m">Request · ready for your review</div>
                        </div>
                        <div className="a">
                          <button type="button" className="prw-btn pri" onClick={() => setView("requests")}>Review</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {now && events.upcoming.length > 0 ? (
                    <div className="prw-card" data-room-coming-up>
                      <h3>
                        Coming up
                        {modules.some((m) => m.key === "calendar") && <button type="button" onClick={() => setView("calendar")}>Open calendar</button>}
                      </h3>
                      {events.upcoming.slice(0, 4).map((e) => (
                        <EventRow key={e.key || e.title + e.date} event={e} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                      ))}
                    </div>
                  ) : (
                    <div className="prw-card">
                      <h3>Blocked</h3>
                      {blocked.length === 0 && <div className="prw-empty">Nothing is blocked.</div>}
                      {blocked.slice(0, 4).map((x) => (
                        <div className="prw-li" key={x.key}>
                          <div>
                            <div className="t">{x.r.task}</div>
                            <div className="m">{[x.r.note, x.r.partnerOwner].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {now && events.upcoming.length > 0 && blocked.length > 0 && (
                  <div className="prw-card prw-sec" data-room-blocked>
                    <h3>Blocked</h3>
                    {blocked.slice(0, 4).map((x) => (
                      <div className="prw-li" key={x.key}>
                        <div>
                          <div className="t">{x.r.task}</div>
                          <div className="m">{[x.r.note, x.r.partnerOwner].filter(Boolean).join(" · ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {active === "calendar" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Calendar</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>What’s scheduled</h2>
                    {props.calendar?.intro && <p>{props.calendar.intro}</p>}
                  </div>
                  {pageId && !isEditor && (
                    <a className="prw-btn" href={`webcal://${typeof window !== "undefined" ? window.location.host : ""}/api/lp/room/calendar.ics?pageId=${pageId}`} data-room-calendar-feed>
                      <CalendarPlus aria-hidden /> Subscribe
                    </a>
                  )}
                </div>
                {events.upcoming.length === 0 && events.past.length === 0 && <div className="prw-card"><div className="prw-empty">Nothing is scheduled yet.</div></div>}
                {events.upcoming.length === 0 && events.past.length > 0 && <div className="prw-card"><div className="prw-empty">Nothing upcoming.</div></div>}
                <EventList events={events.upcoming} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                {events.past.length > 0 && (
                  <details className="prw-sec">
                    <summary className="prw-meta" style={{ cursor: "pointer" }}>Earlier ({events.past.length})</summary>
                    <div style={{ marginTop: 16 }}>
                      <EventList events={events.past} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                    </div>
                  </details>
                )}
              </>
            )}

            {active === "meetings" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Meetings</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Minutes and decisions</h2>
                    {props.meetings?.intro && <p>{props.meetings.intro}</p>}
                  </div>
                  {meetings.length > 0 && (
                    <div className="prw-meta">
                      <b>{meetings.length}</b> {meetings.length === 1 ? "meeting" : "meetings"} · <b>{meetings.reduce((n, m) => n + (m.actions ?? []).filter((a) => !a.done).length, 0)}</b> open actions
                    </div>
                  )}
                </div>
                {meetings.length === 0 && <div className="prw-card"><div className="prw-empty">Minutes will appear here after each meeting.</div></div>}
                {meetings.map((m, i) => (
                  <MeetingCard key={m.key || m.title + m.date} meeting={m} defaultOpen={i === 0} isEditor={isEditor} />
                ))}
              </>
            )}

            {active === "plan" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Action plan</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>One shared plan, owned on both sides</h2>
                    {props.planIntro && <p>{props.planIntro}</p>}
                  </div>
                  <div className="prw-meta">
                    <b>{doneCount}</b> of {rows.length} done{mine.length ? <> · <b>{mine.length}</b> yours to do</> : null}
                  </div>
                </div>
                <table className="prw-plan">
                  <thead>
                    <tr>
                      <th style={{ width: 76 }}>Target</th>
                      <th>Milestone</th>
                      <th style={{ width: 136 }}>{brand.brandName || "Us"}</th>
                      <th style={{ width: 136 }}>{props.partnerName}</th>
                      <th style={{ width: 104 }}>Status</th>
                      <th style={{ width: 132 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (
                      <PlanGroup key={gi} group={g} rows={rows.filter((x) => x.gi === gi)} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} />
                    ))}
                  </tbody>
                </table>
                <div className="prw-legend">
                  {STATUSES.map((s) => (
                    <span key={s} className={`prw-st ${s}`}>{ROOM_STATUS_LABEL[s]}</span>
                  ))}
                </div>
              </>
            )}

            {active === "kit" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Launch kit</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Announce the partnership</h2>
                    {props.kitIntro && <p>{props.kitIntro}</p>}
                  </div>
                </div>
                {links.length > 0 && (
                  <>
                    <div className="prw-eyebrow" style={{ margin: "4px 0 10px" }}>Links</div>
                    <div className="prw-card" style={{ marginBottom: 24 }}>
                      {links.map((l, i) => (
                        <div className="prw-li" key={i} data-room-link>
                          <div>
                            <div className="t">{l.title}</div>
                            <div className="m">{l.description || l.url}</div>
                          </div>
                          <div className="a">
                            <CopyButton text={l.url} label="Copy link" />
                            <a className="prw-ib" href={isEditor ? undefined : l.url} target="_blank" rel="noreferrer" title="Open" aria-label={`Open ${l.title}`}>
                              <ExternalLink aria-hidden />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="prw-eyebrow" style={{ margin: "0 0 10px" }}>Assets</div>
                  </>
                )}
                <div className="prw-docs">
                  {assets.map((a, i) => (
                    <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} canRequest={canRequest} onRequest={() => openRequest({ subject: `Change to: ${a.title}`, kind: "asset_change", assetKey: a.key || roomMilestoneKey({ task: a.title }) })} />
                  ))}
                  {assets.length === 0 && <div className="prw-empty">Nothing here yet.</div>}
                </div>
              </>
            )}

            {active === "goals" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Goals</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>What success looks like</h2>
                    {props.goals?.intro && <p>{props.goals.intro}</p>}
                  </div>
                </div>
                {!!props.goals?.askAgreement && goals.length > 0 && (
                  <div className="prw-agree" data-room-goals-agreement={goalsAgreed?.done ? "agreed" : "open"}>
                    {goalsAgreed?.done ? (
                      <span><b>Agreed</b>{goalsAgreed.by ? ` by ${goalsAgreed.by}` : ""}{goalsAgreed.at ? ` · ${fmtDate(goalsAgreed.at)}` : ""}</span>
                    ) : (
                      <>
                        <span><b>Do these goals look right?</b> Agree to them, or ask for a change.</span>
                        <span style={{ display: "flex", gap: 8 }}>
                          {canRequest && <button type="button" className="prw-btn" onClick={() => openRequest({ subject: "Change a goal", kind: "other" })}>Suggest a change</button>}
                          <button type="button" className="prw-btn pri" onClick={() => needViewer(() => void store?.setTaskDone(ROOM_GOALS_AGREED_KEY, true))}><Check aria-hidden /> Agree</button>
                        </span>
                      </>
                    )}
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "34%" }}>Goal</th>
                      <th>Target</th>
                      <th>Today</th>
                      <th style={{ width: 150 }}>Progress</th>
                      <th>Status</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((g) => {
                      const value = goalValue(g, { byStage: pr.byStage, planDone: doneCount });
                      const auto = g.metric && g.metric !== "manual";
                      const pctDone = value !== null && g.targetValue ? Math.max(0, Math.min(100, Math.round((value / g.targetValue) * 100))) : null;
                      const status = pctDone !== null && pctDone >= 100 ? "done" : g.status ?? "on-track";
                      return (
                        <tr key={g.key || g.title} data-room-goal={auto ? "auto" : "manual"}>
                          <td>
                            <div className="t">{g.title}</div>
                            {g.detail && <div className="m">{g.detail}</div>}
                          </td>
                          <td className="c">{g.target}</td>
                          <td className="c">
                            <b style={{ color: "var(--ink)" }}>{auto ? value : g.current || (value ?? "—")}</b>
                            <div className="m">{auto ? "Live from this room" : g.source}</div>
                          </td>
                          <td>{pctDone !== null && <div className={`prw-bar${status === "pending" ? " warn" : ""}`}><i style={{ width: `${pctDone}%` }} /></div>}</td>
                          <td><span className={`prw-st ${status}`}>{status === "done" ? "Achieved" : status === "pending" ? "Needs attention" : "On track"}</span></td>
                          <td className="c">{g.owner}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="prw-eyebrow" style={{ margin: "26px 0 10px" }}>Rollout health</div>
                <div className="prw-kpis" style={{ marginTop: 0 }}>
                  <div className="prw-kpi"><div className="k">{Noun} live</div><div className="v prw-num">{pr.byStage.live ?? 0} <small>of {pr.total}</small></div></div>
                  <div className="prw-kpi"><div className="k">{Noun} trained</div><div className="v prw-num">{(pr.byStage.trained ?? 0) + (pr.byStage.live ?? 0)} <small>of {pr.total}</small></div></div>
                  <div className="prw-kpi"><div className="k">Plan items complete</div><div className="v prw-num">{doneCount} <small>of {rows.length}</small></div></div>
                  <div className="prw-kpi"><div className="k">Blocking</div><div className="v prw-num">{rows.filter((x) => x.status === "blocking").length}</div></div>
                </div>
              </>
            )}

            {active === "practices" && <PracticesView snapshot={snapshot} store={store} isEditor={isEditor} noun={noun} display={BRAND_DISPLAY_STACK} onNeedEmail={() => setAsk({ kind: "email" })} />}

            {active === "wins" && <WinsView snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} display={BRAND_DISPLAY_STACK} />}

            {active === "marketing" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Marketing plan</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>How we bring your teams on board</h2>
                    {props.marketing?.intro && <p>{props.marketing.intro}</p>}
                  </div>
                  {undecided.length > 0 && <div className="prw-meta"><b>{undecided.length}</b> waiting on your decision</div>}
                </div>
                <div className="prw-progs">
                  {programGroups.map((g, gi) => (
                    <div key={gi}>
                      <div className="prw-gh" style={gi === 0 ? { borderTop: 0 } : undefined}>
                        {g.title}
                        {g.note && <span>{g.note}</span>}
                      </div>
                      {g.programs.map((x) => (
                        <ProgramRow key={x.key || x.title} program={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} />
                      ))}
                    </div>
                  ))}
                </div>
                {canRequest && (
                  <div className="prw-li" style={{ border: "1px dashed #CBD1C8", borderRadius: 10, marginTop: 12, background: "#fff" }}>
                    <div>
                      <div className="t">Something else?</div>
                      <div className="m">Tell us what would help your teams adopt, and we’ll scope it.</div>
                    </div>
                    <div className="a">
                      <button type="button" className="prw-btn" onClick={() => openRequest({ subject: "Marketing support", kind: "marketing" })}>Ask for it</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {active === "requests" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Requests</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Everything you’ve asked for</h2>
                    <p>One place to ask and to see where it stands. Each request goes to the right person with a target date.</p>
                  </div>
                  <button type="button" className="prw-btn pri" onClick={() => openRequest()}>
                    <Plus aria-hidden /> Make a request
                  </button>
                </div>
                <RequestsTable snapshot={snapshot} isEditor={isEditor} onSignIn={() => setAsk({ kind: "email" })} />
              </>
            )}

            {active === "team" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Your team</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Named people on both sides</h2>
                  </div>
                  {props.teamNote && <div className="prw-meta">{props.teamNote}</div>}
                </div>
                <table className="prw-team">
                  <thead>
                    <tr>
                      <th style={{ width: "34%" }}>Who</th>
                      <th>What they own</th>
                      <th>When</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((g, gi) => (
                      <TeamGroup key={gi} group={g} isEditor={isEditor} />
                    ))}
                    {snapshot.contacts.length > 0 && (
                      <TeamGroup group={{ title: `Added by ${props.partnerName}`, members: snapshot.contacts.map((c) => ({ name: c.name, role: c.role ?? undefined, email: c.email ?? undefined })) }} isEditor={isEditor} />
                    )}
                  </tbody>
                </table>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="prw-btn" onClick={() => needViewer(() => setAsk({ kind: "contact" }))} data-room-add-contact>
                    <UserPlus aria-hidden /> Add a person
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="prw-foot">
          {props.partnerName} × {brand.brandName} · {props.eyebrow}
        </div>
      </div>

      {ask?.kind === "email" && store && <AccessDialog store={store} onClose={() => setAsk(null)} />}
      {ask?.kind === "contact" && store && <ContactDialog store={store} partnerName={props.partnerName} onClose={() => setAsk(null)} onNeedEmail={() => setAsk({ kind: "email" })} />}
      {ask?.kind === "request" && store && (
        <RequestDialog
          store={store}
          preset={ask.preset}
          onClose={() => setAsk(null)}
          onSent={(stepKey) => {
            setAsk(null);
            // A request sent from an onboarding step completes that step; otherwise show the tracker.
            if (stepKey) void store.setTaskDone(stepKey, true);
            else if (canRequest) setView("requests");
          }}
          onNeedEmail={() => setAsk({ kind: "email" })}
        />
      )}
    </section>
  );
}

/* ── Action plan ─────────────────────────────────────────────────────────── */

type PlanRow = { gi: number; ri: number; r: RoomMilestone; action: "check" | "upload" | null; key: string; saved: RoomSnapshot["tasks"][string] | undefined; status: RoomMilestoneStatus };

function PlanGroup({ group, rows, snapshot, store, isEditor, onNeedEmail }: { group: RoomPlanGroup; rows: PlanRow[]; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void }) {
  return (
    <>
      <tr className="grp">
        <td colSpan={6}>{group.title}</td>
      </tr>
      {rows.map((x) => (
        <tr key={x.key || x.ri} data-room-milestone={x.status}>
          <td className="c">{x.r.target}</td>
          <td>
            <div className="t">{x.r.task}</div>
            {x.saved?.done ? (
              <div className="m" data-room-received>
                {[x.action === "upload" ? (x.saved.fileName ? `Received ${x.saved.fileName}` : "File received") : "Marked complete", x.saved.by, fmtDate(x.saved.at)].filter(Boolean).join(" · ")}
              </div>
            ) : (
              x.r.note && <div className="m">{x.r.note}</div>
            )}
          </td>
          <td className="c">{x.r.ourOwner}</td>
          <td className="c">{x.r.partnerOwner}</td>
          <td>
            <span className={`prw-st ${x.status}`}>{ROOM_STATUS_LABEL[x.status]}</span>
          </td>
          <td className="r">{x.action && <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={onNeedEmail} />}</td>
        </tr>
      ))}
      {group.checkpoint && (
        <tr className="chk">
          <td colSpan={6}>
            <b>Checkpoint</b> · {group.checkpoint}
          </td>
        </tr>
      )}
    </>
  );
}

function MilestoneAction({ row, snapshot, store, isEditor, onNeedEmail }: { row: PlanRow; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const done = row.status === "done" && !!row.saved?.done;
  // Once complete, only a known visitor gets the quiet Replace / Undo control.
  if (done && !snapshot.viewer && !isEditor) return null;

  const run = async (fn: (s: RoomStoreHandle) => Promise<{ ok: true } | { ok: false; error: string; identityRequired?: boolean }>) => {
    if (!store) return;
    setBusy(true);
    setError("");
    const r = await fn(store);
    setBusy(false);
    if (r.ok) return;
    if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  const click = () => {
    if (isEditor || busy) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    if (row.action === "upload") fileRef.current?.click();
    else void run((s) => s.setTaskDone(row.key, !done));
  };
  // Short labels so every action fits its column; the longer wording is the tooltip.
  const label = row.action === "upload" ? (done ? "Replace" : "Upload") : done ? "Undo" : "Complete";
  const hint = row.action === "upload" ? (done ? "Replace the file" : (row.r.uploadLabel ?? "").trim() || "Upload a file") : done ? "Mark as not done" : "Mark complete";
  return (
    <>
      <button type="button" className={`prw-btn${done ? "" : " pri"}`} onClick={click} disabled={busy} data-room-action={row.action} title={hint} aria-label={`${hint}: ${row.r.task}`}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : row.action === "upload" ? <Upload aria-hidden /> : <Check aria-hidden />}
        {busy ? "Saving" : label}
      </button>
      {row.action === "upload" && !isEditor && (
        <input
          ref={fileRef}
          type="file"
          accept={ROOM_UPLOAD_ACCEPT}
          hidden
          aria-label={`Upload a file for ${row.r.task}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run((s) => s.upload(row.key, file));
          }}
        />
      )}
      {error && <div className="prw-err" role="alert" style={{ whiteSpace: "normal" }}>{error}</div>}
    </>
  );
}

/* ── Launch kit ──────────────────────────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="prw-ib"
      title={copied ? "Copied" : label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </button>
  );
}

function AssetRow({ asset, isEditor, onTrack, onRequest, canRequest }: { asset: RoomAsset; isEditor: boolean; onTrack: (a: RoomAsset, action: "view" | "download" | "open") => void; onRequest: () => void; canRequest: boolean }) {
  const [open, setOpen] = useState(false);
  const file = (asset.fileUrl ?? "").trim();
  const ext = (asset.externalUrl ?? "").trim();
  const body = (asset.body ?? "").trim();
  const viewHref = asset.kind === "link" ? ext || file : file || ext;
  return (
    <>
      <div className="prw-doc" data-room-asset={asset.kind}>
        {asset.kind === "image" && file ? (
          <span className="prw-ft img"><img src={file} alt="" loading="lazy" /></span>
        ) : (
          <span className="prw-ft">{FILE_TAG[asset.kind] ?? "FILE"}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{asset.title}</div>
          {asset.description && <div style={{ fontSize: 12, color: "var(--body)" }}>{asset.description}</div>}
        </div>
        <div className="a">
          {asset.kind === "text" && body ? (
            <button type="button" className="prw-ib" title={open ? "Hide" : "View"} aria-label={`${open ? "Hide" : "View"} ${asset.title}`} onClick={() => { setOpen((v) => !v); if (!open) onTrack(asset, "view"); }}>
              {open ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          ) : (
            viewHref && (
              <a className="prw-ib" title="View" aria-label={`View ${asset.title}`} href={isEditor ? undefined : viewHref} target="_blank" rel="noreferrer" onClick={() => onTrack(asset, asset.kind === "link" ? "open" : "view")}>
                <Eye aria-hidden />
              </a>
            )
          )}
          {asset.kind === "text" && body && <CopyButton text={body} label="Copy text" />}
          {asset.kind === "link" && viewHref && <CopyButton text={viewHref} label="Copy link" />}
          {asset.kind !== "text" && asset.kind !== "link" && file && (
            <a className="prw-ib" title="Download" aria-label={`Download ${asset.title}`} href={isEditor ? undefined : file} download onClick={() => onTrack(asset, "download")}>
              <Download aria-hidden />
            </a>
          )}
          {canRequest && (
            <button type="button" className="prw-ib" title="Request changes" aria-label={`Request changes to ${asset.title}`} onClick={onRequest} data-room-request-change>
              <PencilLine aria-hidden />
            </button>
          )}
        </div>
      </div>
      {open && body && <div className="prw-body">{body}</div>}
    </>
  );
}

/* ── Requests ────────────────────────────────────────────────────────────── */

function RequestsTable({ snapshot, isEditor, onSignIn }: { snapshot: RoomSnapshot; isEditor: boolean; onSignIn: () => void }) {
  if (!snapshot.viewer && !isEditor) {
    return (
      <div className="prw-card">
        <div className="prw-li">
          <div>
            <div className="t">Confirm your email to see and make requests</div>
            <div className="m">Requests are shared with your team only.</div>
          </div>
          <div className="a">
            <button type="button" className="prw-btn pri" onClick={onSignIn}>
              <Mail aria-hidden /> Confirm email
            </button>
          </div>
        </div>
      </div>
    );
  }
  const list: RoomRequest[] = snapshot.requests;
  const count = (s: string) => list.filter((q) => q.status === s).length;
  return (
    <>
      <div className="prw-sum">
        <div><b className="prw-num">{count("new") + count("in_progress")}</b>open</div>
        <div><b className="prw-num">{count("review")}</b>ready for your review</div>
        <div><b className="prw-num">{count("done")}</b>completed</div>
      </div>
      {list.length === 0 ? (
        <div className="prw-card"><div className="prw-empty">No requests yet. Use “Make a request”, or “Request changes” on any launch-kit item.</div></div>
      ) : (
        <table className="prw-reqs">
          <thead>
            <tr>
              <th>Request</th>
              <th style={{ width: 116 }}>Type</th>
              <th style={{ width: 150 }}>From</th>
              <th style={{ width: 76 }}>Asked</th>
              <th style={{ width: 136 }}>Owner</th>
              <th style={{ width: 168 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.id} data-room-request={q.status}>
                <td><div className="t">{q.subject}</div></td>
                <td className="c">{ROOM_REQUEST_KIND_LABEL[q.kind] ?? "Other"}</td>
                <td className="c">{q.by}</td>
                <td className="c">{fmtDate(q.createdAt)}</td>
                <td className="c">{q.owner || "Being assigned"}</td>
                <td>
                  <span className={`prw-chip ${q.status}`}>
                    {ROOM_REQUEST_STATUS_LABEL[q.status] ?? q.status}
                    {q.due && q.status !== "done" ? ` · due ${q.due}` : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function RequestDialog({ store, preset, onClose, onSent, onNeedEmail }: { store: RoomStoreHandle; preset?: RequestPreset; onClose: () => void; onSent: (stepKey?: string) => void; onNeedEmail: () => void }) {
  const [kind, setKind] = useState(preset?.kind ?? (preset?.assetKey ? "asset_change" : "other"));
  const [subject, setSubject] = useState(preset?.subject ?? "");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await store.sendRequest({ kind, subject: subject.trim(), details: details.trim(), assetKey: preset?.assetKey });
    setBusy(false);
    if (r.ok) onSent(preset?.stepKey);
    else if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  return createPortal(
    <div className="prw prw-modal" style={{ background: "rgba(0,20,16,.5)" }} onClick={onClose} data-room-request-dialog>
      <form className="box" onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ fontFamily: BRAND_BODY_STACK }}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X style={{ width: 16, height: 16 }} /></button>
        <h3>Make a request</h3>
        <p>It goes to the right person and shows up under Requests with a target date.</p>
        <label htmlFor="prw-kind">What do you need?</label>
        <select id="prw-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="asset_change">A change to an asset</option>
          <option value="marketing">New marketing material</option>
          <option value="training">Training or scheduling</option>
          <option value="event">Event support</option>
          <option value="reporting">Reporting or data</option>
          <option value="other">Something else</option>
        </select>
        <label htmlFor="prw-subject">About</label>
        <input id="prw-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Which item or topic" maxLength={160} />
        <label htmlFor="prw-details">Details</label>
        <textarea id="prw-details" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what you need and by when" maxLength={4000} />
        {error && <div className="prw-err" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="prw-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="prw-btn pri" disabled={busy || (!subject.trim() && !details.trim())} style={{ background: "#0E1A16", borderColor: "#0E1A16", color: "#fff" }}>
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** "Who are you?" — a work email once, then a link by email (or a request to the team). */
function AccessDialog({ store, onClose }: { store: RoomStoreHandle; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"sent" | "requested" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEscape(onClose);
  useEffect(() => inputRef.current?.focus(), []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await store.requestAccess(email.trim());
    setBusy(false);
    if (r.ok) setResult(r.status);
    else setError(r.error);
  };
  const solid = { background: "#0E1A16", borderColor: "#0E1A16", color: "#fff", height: 40, width: "100%", justifyContent: "center" } as const;
  return createPortal(
    <div className="prw prw-modal" style={{ background: "rgba(0,20,16,.5)" }} onClick={onClose} data-room-access-dialog>
      <div className="box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, fontFamily: BRAND_BODY_STACK }}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X style={{ width: 16, height: 16 }} /></button>
        {result === null ? (
          <form onSubmit={submit}>
            <h3>Confirm it’s you</h3>
            <p>Enter your work email and we’ll send you a link. Open it once and this browser can upload files, complete items and make requests.</p>
            <label htmlFor="prw-email">Work email</label>
            <input id="prw-email" ref={inputRef} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            {error && <div className="prw-err" role="alert">{error}</div>}
            <div className="row">
              <button type="submit" className="prw-btn pri" disabled={busy} style={solid}>
                <Mail aria-hidden /> {busy ? "Sending…" : "Email me a link"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3>{result === "sent" ? "Check your inbox" : "We’ve asked the team"}</h3>
            <p>
              {result === "sent"
                ? `We sent a link to ${email.trim()}. Open it on this device and you’re set for the next 90 days.`
                : `${email.trim()} isn’t on this room’s list yet, so we’ve asked the team to add you. You’ll be able to request your link once they do.`}
            </p>
            <div className="row">
              <button type="button" className="prw-btn pri" onClick={onClose} style={{ ...solid, width: "auto" }}>Got it</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Team ────────────────────────────────────────────────────────────────── */

function TeamGroup({ group, isEditor }: { group: RoomTeamGroup; isEditor: boolean }) {
  return (
    <>
      <tr className="grp">
        <td colSpan={4}>{group.title}</td>
      </tr>
      {(group.members ?? []).map((m, i) => {
        const email = (m.email ?? "").trim();
        const photo = (m.photoUrl ?? "").trim();
        return (
          <tr key={i} data-room-member>
            <td>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {photo ? <img className="prw-av" src={photo} alt="" loading="lazy" /> : <span className="prw-av">{initials(m.name) || "·"}</span>}
                <div>
                  <div className="t">{m.name}</div>
                  {m.role && <div className="m">{m.role}</div>}
                </div>
              </div>
            </td>
            <td className="c" style={{ whiteSpace: "normal" }}>{m.owns}</td>
            <td className="c">{m.when}</td>
            <td className="r">
              {email && (
                <a className="prw-ib" title={`Email ${m.name}`} aria-label={`Email ${m.name}`} href={isEditor ? undefined : `mailto:${email}`}>
                  <Mail aria-hidden />
                </a>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

/* ── Onboarding ──────────────────────────────────────────────────────────── */

function OnboardingStep({ step, stepKey, done, saved, snapshot, store, isEditor, onNeedEmail, onAddTeam, onRequest }: { step: RoomOnboardingStep; stepKey: string; done: boolean; saved: RoomSnapshot["tasks"][string] | undefined; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; onAddTeam: () => void; onRequest: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const run = async (fn: (s: RoomStoreHandle) => Promise<{ ok: true } | { ok: false; error: string; identityRequired?: boolean }>) => {
    if (!store) return;
    setBusy(true);
    setError("");
    const r = await fn(store);
    setBusy(false);
    if (r.ok) return;
    if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  const guard = (fn: () => void) => () => {
    if (isEditor || busy) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    fn();
  };
  const tick = guard(() => void run((s) => s.setTaskDone(stepKey, true)));
  const label = (step.buttonLabel ?? "").trim();
  const summary = saved?.done ? [saved.fileName ? `Received ${saved.fileName}` : "Done", saved.by, fmtDate(saved.at)].filter(Boolean).join(" · ") : step.done ? "Done" : step.description;
  return (
    <div className={`prw-step${done ? " done" : ""}`} data-room-step={step.action}>
      <span className="dot">{done ? <Check style={{ width: 12, height: 12 }} aria-hidden /> : null}</span>
      <div style={{ minWidth: 0 }}>
        <div className="t">{step.title}</div>
        {summary && <div className="m">{summary}</div>}
        {error && <div className="prw-err" role="alert">{error}</div>}
      </div>
      {!done && (
        <div className="a">
          {step.action === "upload" && (
            <>
              <button type="button" className="prw-btn pri" disabled={busy} onClick={guard(() => fileRef.current?.click())} title={label || "Upload a file"}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {busy ? "Saving" : "Upload"}
              </button>
              {!isEditor && (
                <input ref={fileRef} type="file" accept={ROOM_UPLOAD_ACCEPT} hidden aria-label={step.title} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run((s) => s.upload(stepKey, f)); }} />
              )}
            </>
          )}
          {step.action === "team" && (
            <button type="button" className="prw-btn pri" onClick={guard(onAddTeam)} title={label || "Add people"}>
              <UserPlus aria-hidden /> Add
            </button>
          )}
          {step.action === "request" && (
            <button type="button" className="prw-btn pri" onClick={guard(onRequest)} title={label || "Send details"}>
              <Check aria-hidden /> {(label || "Send").split(/\s+/)[0]}
            </button>
          )}
          {step.action === "link" && (step.url ?? "").trim() && (
            <a className="prw-btn pri" href={isEditor ? undefined : step.url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> {label || "Open"}
            </a>
          )}
          {(step.action === "check" || step.action === "link") && (
            <button type="button" className="prw-btn" disabled={busy} onClick={tick}>
              <Check aria-hidden /> Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ContactDialog({ store, partnerName, onClose, onNeedEmail }: { store: RoomStoreHandle; partnerName: string; onClose: () => void; onNeedEmail: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  useEscape(onClose);
  useEffect(() => nameRef.current?.focus(), []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    const r = await store.addContact({ name: name.trim(), role: role.trim(), email: email.trim() });
    setBusy(false);
    if (r.ok) {
      setAdded((n) => n + 1);
      setName("");
      setRole("");
      setEmail("");
      nameRef.current?.focus();
    } else if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  const solid = { background: "#0E1A16", borderColor: "#0E1A16", color: "#fff" } as const;
  return createPortal(
    <div className="prw prw-modal" style={{ background: "rgba(0,20,16,.5)" }} onClick={onClose} data-room-contact-dialog>
      <form className="box" onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ fontFamily: BRAND_BODY_STACK }}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X style={{ width: 16, height: 16 }} /></button>
        <h3>Add your team</h3>
        <p>Who should we work with at {partnerName}? Add as many people as you like.</p>
        <label htmlFor="prw-cname">Name</label>
        <input id="prw-cname" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <label htmlFor="prw-crole">Role</label>
        <input id="prw-crole" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Operations lead, regional manager…" maxLength={120} />
        <label htmlFor="prw-cemail">Email</label>
        <input id="prw-cemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <div className="prw-err" role="alert">{error}</div>}
        {added > 0 && <div style={{ fontSize: 12.5, color: "#0B6B3A", marginTop: 8 }}>{added} added. Add another, or close.</div>}
        <div className="row">
          <button type="button" className="prw-btn" onClick={onClose}>{added ? "Done" : "Cancel"}</button>
          <button type="submit" className="prw-btn pri" disabled={busy || !name.trim()} style={solid}>{busy ? "Adding…" : "Add person"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/* ── Marketing plan ──────────────────────────────────────────────────────── */

function ProgramRow({ program, snapshot, store, isEditor, onNeedEmail }: { program: RoomProgram; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void }) {
  const key = roomMilestoneKey({ key: program.key, task: program.title });
  const options = (program.options ?? []).filter((o) => o.trim());
  const chosen = snapshot.choices[key];
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const pick = async (value: string) => {
    if (isEditor || busy) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    setBusy(value);
    setError("");
    const r = await store.setChoice(key, value);
    setBusy("");
    if (!r.ok) {
      if (r.identityRequired) onNeedEmail();
      else setError(r.error);
    }
  };
  const image = (program.imageUrl ?? "").trim();
  return (
    <div className="prw-prog" data-room-program={options.length >= 2 ? (chosen ? "chosen" : "open") : "fixed"}>
      {image ? <img className="im" src={image} alt="" loading="lazy" /> : <span className="im" aria-hidden />}
      <div>
        <h3>{program.title}</h3>
        {program.description && <p>{program.description}</p>}
      </div>
      <div className="who">{program.audience}</div>
      <div className="when">{program.when && <b>{program.when}</b>}</div>
      <div className="dec">
        {options.length >= 2 ? (
          <>
            {!chosen && <span className="need">Your decision</span>}
            <span className="prw-seg" role="group" aria-label={program.title}>
              {options.map((o) => (
                <button key={o} type="button" className={chosen?.value === o ? "on" : ""} aria-pressed={chosen?.value === o} disabled={!!busy} onClick={() => void pick(o)}>
                  {busy === o ? "Saving…" : o}
                </button>
              ))}
            </span>
            {chosen?.by && <span className="by">{chosen.by} · {fmtDate(chosen.at)}</span>}
            {error && <span className="prw-err" role="alert">{error}</span>}
          </>
        ) : (
          <span className="prw-fixed">{program.fixedLabel || "In plan"}</span>
        )}
      </div>
    </div>
  );
}

/* ── Wins ────────────────────────────────────────────────────────────────── */

function WinsView({ snapshot, store, isEditor, onNeedEmail, display }: { snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; display: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditor || busy || !text.trim()) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    setBusy(true);
    setError("");
    const r = await store.postWin({ body: text.trim() });
    setBusy(false);
    if (r.ok) setText("");
    else if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  return (
    <>
      <div className="prw-hd">
        <div>
          <div className="prw-eyebrow">Wins</div>
          <h2 style={{ fontFamily: display }}>What’s going well</h2>
          <p>Anyone on either team can share a win, like one, or comment.</p>
        </div>
        {snapshot.wins.length > 0 && <div className="prw-meta"><b>{snapshot.wins.length}</b> {snapshot.wins.length === 1 ? "win" : "wins"} so far</div>}
      </div>
      <form className="prw-compose" onSubmit={post} data-room-win-compose>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a win: a great case, a happy doctor, a milestone" maxLength={1500} aria-label="Share a win" />
        <button type="submit" className="prw-btn pri" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post"}</button>
      </form>
      {error && <div className="prw-err" role="alert">{error}</div>}
      {snapshot.wins.length === 0 && <div className="prw-card" style={{ marginTop: 10 }}><div className="prw-empty">No wins yet. Be the first to share one.</div></div>}
      {snapshot.wins.map((w) => (
        <WinCard key={w.id} win={w} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={onNeedEmail} />
      ))}
    </>
  );
}

function WinCard({ win, snapshot, store, isEditor, onNeedEmail }: { win: RoomWin; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const act = (fn: (s: RoomStoreHandle) => Promise<{ ok: true } | { ok: false; error: string; identityRequired?: boolean }>) => async () => {
    if (isEditor || busy) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    setBusy(true);
    const r = await fn(store);
    setBusy(false);
    if (!r.ok && r.identityRequired) onNeedEmail();
    return r.ok;
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const ok = await act((s) => s.commentWin(win.id, text.trim()))();
    if (ok) setText("");
  };
  return (
    <div className="prw-win" data-room-win={win.side}>
      <div className="wt">
        <span className={`wa ${win.side === "team" ? "team" : ""}`}>{initials(win.by) || "·"}</span>
        <div className="ww">
          <b>{win.by}</b>
          <span>
            {fmtDate(win.createdAt)}
            {win.region ? ` · ${win.region}` : ""}
          </span>
        </div>
      </div>
      <div className="wb">
        {win.headline && <span className="big">{win.headline}</span>}
        {win.body}
      </div>
      <div className="wx">
        <button type="button" className={win.liked ? "on" : ""} aria-pressed={win.liked} aria-label={win.liked ? "Unlike" : "Like"} onClick={() => void act((s) => s.likeWin(win.id))()}>
          <Heart aria-hidden fill={win.liked ? "currentColor" : "none"} /> {win.likes}
        </button>
        <button type="button" onClick={() => setCommenting((v) => !v)} aria-label="Comment">
          <MessageSquare aria-hidden /> {win.comments.length}
        </button>
      </div>
      {win.comments.map((c) => (
        <div className="wc" key={c.id}>
          <b>{c.by}</b> · {c.body}
        </div>
      ))}
      {commenting && (
        <form className="prw-cbox" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment" maxLength={1000} aria-label="Write a comment" autoFocus />
          <button type="submit" className="prw-btn" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
    </div>
  );
}

/* ── Practices ───────────────────────────────────────────────────────────── */

function PracticesView({ snapshot, store, isEditor, noun, display, onNeedEmail }: { snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; noun: string; display: string; onNeedEmail: () => void }) {
  const pr = snapshot.practices;
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [pageNo, setPageNo] = useState(0);
  const [data, setData] = useState<{ total: number; rows: RoomPractice[]; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const viewerKey = snapshot.viewer?.email ?? "";
  useEffect(() => {
    if (!store || !viewerKey) return;
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      void store.loadPractices({ region, q, page: pageNo }).then((r) => {
        if (cancelled) return;
        setLoading(false);
        if (r && r !== "identity") setData(r);
      });
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [store, viewerKey, region, q, pageNo, pr.total]);
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const stat = (label: string, n: number) => (
    <div><b className="prw-num">{n}</b>{label}</div>
  );
  return (
    <>
      <div className="prw-hd">
        <div>
          <div className="prw-eyebrow">{Noun}</div>
          <h2 style={{ fontFamily: display }}>Rollout by {noun.replace(/s$/, "")}</h2>
          <p>Where each one stands, kept current by our team. No spreadsheet to maintain.</p>
        </div>
        {pr.regions.length > 0 && <div className="prw-meta"><b>{pr.total}</b> {noun} · <b>{pr.regions.length}</b> regions</div>}
      </div>
      <div className="prw-sum" data-room-practice-summary>
        {stat("in the rollout", pr.total)}
        {stat("training booked", pr.byStage.training_booked ?? 0)}
        {stat("trained", (pr.byStage.trained ?? 0) + (pr.byStage.live ?? 0))}
        {stat("live", pr.byStage.live ?? 0)}
      </div>
      {pr.total === 0 ? (
        <div className="prw-card"><div className="prw-empty">Your {noun} will appear here once the list is loaded.</div></div>
      ) : !snapshot.viewer && !isEditor ? (
        <div className="prw-card">
          <div className="prw-li">
            <div>
              <div className="t">Confirm your email to see each {noun.replace(/s$/, "")}</div>
              <div className="m">The list is shared with your team only.</div>
            </div>
            <div className="a"><button type="button" className="prw-btn pri" onClick={onNeedEmail}><Mail aria-hidden /> Confirm email</button></div>
          </div>
        </div>
      ) : (
        <>
          <div className="prw-tools">
            <select value={region} onChange={(e) => { setRegion(e.target.value); setPageNo(0); }} aria-label="Region">
              <option value="">All regions</option>
              {pr.regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} placeholder={`Search ${noun}`} aria-label={`Search ${noun}`} />
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "34%" }}>{Noun.replace(/s$/, "")}</th>
                <th>Region</th>
                <th>Wave</th>
                <th>Training</th>
                <th>Live</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((p) => (
                <tr key={p.id} data-room-practice={p.stage}>
                  <td>
                    <div className="t">{p.name}</div>
                    {(p.city || p.state) && <div className="m">{[p.city, p.state].filter(Boolean).join(", ")}</div>}
                  </td>
                  <td className="c">{p.region}</td>
                  <td className="c">{p.wave}</td>
                  <td className="c">{p.trainingDate}</td>
                  <td className="c">{p.liveDate}</td>
                  <td><span className={`prw-chip ${p.stage}`}>{ROOM_PRACTICE_STAGE_LABEL[p.stage] ?? p.stage}</span></td>
                </tr>
              ))}
              {data && data.rows.length === 0 && (
                <tr><td colSpan={6} className="c">Nothing matches.</td></tr>
              )}
              {!data && (
                <tr><td colSpan={6} className="c">{loading ? "Loading…" : ""}</td></tr>
              )}
            </tbody>
          </table>
          {data && data.total > data.pageSize && (
            <div className="prw-pager">
              <span className="prw-num">{pageNo * data.pageSize + 1}–{Math.min(data.total, (pageNo + 1) * data.pageSize)} of {data.total}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button type="button" className="prw-btn" disabled={pageNo === 0} onClick={() => setPageNo((n) => n - 1)}>Previous</button>
                <button type="button" className="prw-btn" disabled={(pageNo + 1) * data.pageSize >= data.total} onClick={() => setPageNo((n) => n + 1)}>Next</button>
              </span>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── Calendar + meetings ─────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function DateTile({ date }: { date: string }) {
  const m = +date.slice(5, 7) - 1;
  return (
    <span className="prw-date" aria-hidden>
      <i>{MONTHS[m] ?? ""}</i>
      <b className="prw-num">{+date.slice(8, 10) || ""}</b>
    </span>
  );
}

function EventRow({ event, calendarName, isEditor }: { event: RoomEvent; calendarName: string; isEditor: boolean }) {
  const kind = event.kind && ROOM_EVENT_KIND_LABEL[event.kind] ? event.kind : null;
  const download = () => {
    if (isEditor) return;
    const url = URL.createObjectURL(new Blob([eventIcs(event, calendarName)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event"}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="prw-li" data-room-event={event.kind ?? "event"}>
      <DateTile date={event.date} />
      <div style={{ minWidth: 0 }}>
        <div className="t">{event.title}</div>
        <div className="m">
          {[event.time, event.detail].filter(Boolean).join(" · ")}
          {kind && <>{event.time || event.detail ? " · " : ""}<span className={`prw-chip ${kind === "meeting" ? "kind" : kind}`}>{ROOM_EVENT_KIND_LABEL[kind]}</span></>}
        </div>
      </div>
      <div className="a">
        <button type="button" className="prw-ib" title="Add to calendar" aria-label={`Add ${event.title} to your calendar`} onClick={download}>
          <CalendarPlus aria-hidden />
        </button>
      </div>
    </div>
  );
}

function EventList({ events, calendarName, isEditor }: { events: RoomEvent[]; calendarName: string; isEditor: boolean }) {
  const groups: { month: string; items: RoomEvent[] }[] = [];
  for (const e of events) {
    const month = `${MONTH_NAMES[+e.date.slice(5, 7) - 1] ?? ""} ${e.date.slice(0, 4)}`;
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.month}>
          <div className="prw-month">{g.month}</div>
          <div className="prw-card">
            {g.items.map((e) => (
              <EventRow key={e.key || e.title + e.date} event={e} calendarName={calendarName} isEditor={isEditor} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function MeetingCard({ meeting, defaultOpen, isEditor }: { meeting: RoomMeeting; defaultOpen: boolean; isEditor: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const decisions = (meeting.decisions ?? []).filter((d) => d.trim());
  const actions = (meeting.actions ?? []).filter((a) => (a.text ?? "").trim());
  const openCount = actions.filter((a) => !a.done).length;
  const hasBody = !!(meeting.summary || decisions.length || actions.length);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(meeting.date ?? "");
  return (
    <div className="prw-min" data-room-meeting>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button type="button" className="mh" onClick={() => hasBody && setOpen((v) => !v)} aria-expanded={open} style={{ cursor: hasBody ? "pointer" : "default" }}>
          {validDate && <DateTile date={meeting.date} />}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{meeting.title}</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--body)" }}>
              {[meeting.attendees, decisions.length ? `${decisions.length} decision${decisions.length === 1 ? "" : "s"}` : "", actions.length ? `${openCount} open action${openCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
            </span>
          </span>
          {hasBody && <ChevronDown aria-hidden style={{ width: 16, height: 16, marginLeft: "auto", flex: "none", color: "var(--body)", transform: open ? "rotate(180deg)" : undefined }} />}
        </button>
        <span style={{ display: "flex", gap: 6, paddingRight: 16 }}>
          {(meeting.notesUrl ?? "").trim() && (
            <a className="prw-ib" title="Notes" aria-label={`Notes for ${meeting.title}`} href={isEditor ? undefined : meeting.notesUrl} target="_blank" rel="noreferrer"><FileText aria-hidden /></a>
          )}
          {(meeting.recordingUrl ?? "").trim() && (
            <a className="prw-ib" title="Recording" aria-label={`Recording of ${meeting.title}`} href={isEditor ? undefined : meeting.recordingUrl} target="_blank" rel="noreferrer"><Video aria-hidden /></a>
          )}
        </span>
      </div>
      {open && hasBody && (
        <div className="mb">
          {meeting.summary && <div className="sum">{meeting.summary}</div>}
          {decisions.length > 0 && (
            <div>
              <h5>Decisions</h5>
              <ul>{decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}
          {actions.length > 0 && (
            <div>
              <h5>Action items</h5>
              <ul>
                {actions.map((a, i) => (
                  <li key={i}>
                    {a.text}
                    {(a.owner || a.due) && <span style={{ color: "var(--body)" }}> · {[a.owner, a.due].filter(Boolean).join(" · ")}</span>}
                    {" · "}
                    <span className={`prw-st ${a.done ? "done" : "on-track"}`}>{a.done ? "Done" : "Open"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
