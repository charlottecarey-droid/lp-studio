import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, Check, Play, ThumbsDown, ThumbsUp, ChevronDown, Copy, Download, FileText, Video, ExternalLink, Eye, EyeOff, Loader2, Mail, PencilLine, Plus, Upload, UserPlus, X, BookOpen, ClipboardList, Image as ImageIcon, Link2, Megaphone, Palette, Phone, Presentation, Quote, Share2, type LucideIcon } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { buildAssetEventPayload, isHostedFileUrl, isPdfUrl, isTrackingSuppressed, opensInViewer, resolveAssetHref, type HubAsset, type HubAssetAction } from "./hub/hub-assets";
import { HubAssetViewer, shouldOpenInline } from "./hub/HubAssetViewer";
import { WinsView } from "./hub/RoomFeed";
import { ScorecardView, type ScorecardGoal } from "./hub/RoomScorecard";
import { OutstandingView, ownerSide, roomMeetingActionKey, type OutstandingItem } from "./hub/RoomOutstanding";
import { resolveHubPalette } from "@/lib/hub-theme";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";
import { ROOM_UPLOAD_ACCEPT, useRoom, type RoomRequest, type RoomSnapshot, type RoomStoreHandle, type RoomPractice, type RoomPracticePage, type RoomPracticeSort, type RoomSyncedEvent, type RoomSyncedMinutes } from "./hub/room-client";

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
  { key: "practices", label: "Scorecard" },
  { key: "marketing", label: "Marketing plan" },
  { key: "kit", label: "Launch kit" },
  { key: "calendar", label: "Calendar" },
  { key: "meetings", label: "Meetings" },
  { key: "requests", label: "Outstanding" },
  { key: "team", label: "Our Team" },
];

export type RoomMilestoneStatus = "done" | "on-track" | "pending" | "blocking" | "not-started";
export const ROOM_STATUS_LABEL: Record<RoomMilestoneStatus, string> = {
  done: "Done",
  "on-track": "On track",
  pending: "Pending",
  blocking: "Overdue",
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

export type RoomAssetKind = "pdf" | "video" | "image" | "text" | "link" | "file";
export interface RoomAsset {
  key?: string;
  kind: RoomAssetKind;
  title: string;
  description?: string;
  fileUrl?: string;
  /** Kind "video": a video file, or a YouTube / Vimeo / Wistia / Loom link. Plays in the page. */
  videoUrl?: string;
  externalUrl?: string;
  /** The copy itself (kind "text"). */
  body?: string;
  /** Which icon sits beside it. Blank = chosen from what the item is; "tag" = the small file-type tag (PDF, TXT). */
  icon?: string;
  hidden?: boolean;
}

/* ── The account name as a variable ──────────────────────────────────────── */

// The builder's page-level names for the same thing ({{account_name}}, {{company}}, {{company_name}}) work too.
const ACCOUNT_TOKEN = /\{\{\s*(?:account|account_name|company|company_name)\s*\}\}|\[partner name\]/gi;
const ACCOUNT_SHORT_TOKEN = /\{\{\s*account_short\s*\}\}|\[partner\]/gi;
const NAME_KEYS = new Set(["partnerName", "partnerShort"]);

/** `{{account}}` / `[Partner name]` → the customer's name; `{{account_short}}` / `[Partner]` → the short name (or the name). Same rule as the server's fillAccountName. */
export function fillAccountName(text: string, name: string, short: string): string {
  return text.includes("{{") || text.includes("[") ? text.replace(ACCOUNT_TOKEN, name).replace(ACCOUNT_SHORT_TOKEN, short) : text;
}

/**
 * The block's props with the account-name variables filled in from the
 * customer name, so one template serves every account and renaming the
 * account updates every sentence. `rawOf` maps each filled object back to the
 * original, so editing on the page still patches the stored props.
 */
export function resolveRoomProps(raw: RoomWorkspaceBlockProps): { props: RoomWorkspaceBlockProps; rawOf: WeakMap<object, object> } {
  const rawOf = new WeakMap<object, object>();
  const name = (raw.partnerName ?? "").trim();
  if (!name || /^\[partner/i.test(name) || /\{\{/.test(name)) return { props: raw, rawOf };
  const shortRaw = (raw.partnerShort ?? "").trim();
  const short = shortRaw && !/^\[partner/i.test(shortRaw) ? shortRaw : name;
  const fill = (node: unknown): unknown => {
    if (typeof node === "string") return fillAccountName(node, name, short);
    if (Array.isArray(node)) {
      let changed = false;
      const out = node.map((n) => {
        const r = fill(n);
        if (r !== n) changed = true;
        return r;
      });
      if (!changed) return node;
      rawOf.set(out, node);
      return out;
    }
    if (node && typeof node === "object") {
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        const r = NAME_KEYS.has(k) ? v : fill(v);
        if (r !== v) changed = true;
        out[k] = r;
      }
      if (!changed) return node;
      rawOf.set(out, node as object);
      return out;
    }
    return node;
  };
  return { props: fill(raw) as RoomWorkspaceBlockProps, rawOf };
}

/* ── Editing on the page (builder only) ──────────────────────────────────── */

/** Replace one object inside the block's props (found by identity), leaving everything else untouched. */
function swapDeep(node: unknown, target: object, next: object): unknown {
  if (node === target) return next;
  if (Array.isArray(node)) {
    let changed = false;
    const out = node.map((n) => {
      const r = swapDeep(n, target, next);
      if (r !== n) changed = true;
      return r;
    });
    return changed ? out : node;
  }
  if (node && typeof node === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      const r = swapDeep(v, target, next);
      if (r !== v) changed = true;
      out[k] = r;
    }
    return changed ? out : node;
  }
  return node;
}

/** Set in the builder: patch any item of the block's props in place. Absent on the live page. */
const RoomEditContext = createContext<((item: object, patch: Record<string, unknown>) => void) | null>(null);

/**
 * A piece of the room's text that can be edited by clicking it in the builder.
 * Plain text only (no formatting), because these values also feed emails,
 * Slack and task keys. On the live page it renders the text and nothing else.
 */
function E<T extends object>({ item, field, multiline, placeholder }: { item: T; field: keyof T & string; multiline?: boolean; placeholder?: string }) {
  const edit = useContext(RoomEditContext);
  const value = String((item as Record<string, unknown>)[field] ?? "");
  if (!edit) return <>{value}</>;
  return (
    <span
      className="prw-edit"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder || field}
      data-ph={placeholder || "Add text"}
      data-room-edit={field}
      onClick={(e) => e.stopPropagation()}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(multiline ? /\r/g : /[\r\n]+/g, multiline ? "" : " "));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.currentTarget.textContent = value;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? "").replace(/\u00a0/g, " ").trim();
        if (next !== value) edit(item, { [field]: next });
      }}
    >
      {value}
    </span>
  );
}

const isVideoLink = (url: string) => !!url && (isNativeVideoUrl(url) || getAutoplayEmbedUrl(url) !== url);

/**
 * A room asset as the content hub understands it, so PDFs, images and videos
 * open in the same in-page viewer (which records views, time and watch
 * progress). A link that points at a hosted PDF or a video opens there too.
 */
export function roomAssetToHub(a: RoomAsset): HubAsset {
  const file = (a.fileUrl ?? "").trim();
  const ext = (a.externalUrl ?? "").trim();
  const video = (a.videoUrl ?? "").trim();
  const base = { key: a.key, title: a.title, description: a.description, body: a.body };
  if (a.kind === "video") return { ...base, kind: "video", videoUrl: video || file || ext };
  if (a.kind === "pdf") return { ...base, kind: "pdf", fileUrl: file, externalUrl: ext };
  if (a.kind === "image") return { ...base, kind: "image", fileUrl: file, externalUrl: ext };
  if (a.kind === "text") return { ...base, kind: "text", externalUrl: ext || file };
  const url = a.kind === "file" ? file || ext : ext || file;
  if (isVideoLink(url)) return { ...base, kind: "video", videoUrl: url };
  if (isPdfUrl(url) && (a.kind === "file" || isHostedFileUrl(url))) return { ...base, kind: "pdf", fileUrl: url };
  return { ...base, kind: "link", externalUrl: url };
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
  phone?: string;
  /** Their booking page (Chili Piper, Calendly, a calendar link). */
  bookingUrl?: string;
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
  /** Size of each logo in the top bar, as a percentage of the standard height (50–300). Blank = 100. */
  partnerLogoScale?: number;
  brandLogoScale?: number;
  /** "Schedule a meeting" in the top bar: where it books (a rep's booking page). Blank = no button. */
  scheduleUrl?: string;
  scheduleLabel?: string;
  /** The name of the rep whose calendar it books, for the builder to show. */
  scheduleRep?: string;
  eyebrow?: string;
  title?: string;
  lede?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** How the cover looks: "split" = text beside a photo card; "fullbleed" = the photo behind the whole cover; "light" = a pale, editorial cover. */
  coverStyle?: "split" | "fullbleed" | "light";
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
  /** A shorter form of the customer's name for running text ("MB2" for "MB2 Dental"). Blank uses the full name. */
  partnerShort?: string;
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
  planIntro: "Every milestone has an owner on each side. Anything overdue for more than a week goes to both executive sponsors.",
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
/**
 * Has a milestone's target date passed? Reads "2026-11-03" and "Nov 3" (with
 * or without a year; without one, the year that puts it closest to today).
 * Anything else ("Day 30", "By kickoff") is not a date, so never overdue.
 */
export function targetHasPassed(target: string | undefined, now: Date): boolean {
  const raw = (target ?? "").trim();
  if (!raw) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime() < today;
  const m = raw.match(/^([A-Za-z]{3,9})\.? (\d{1,2})(?:,? (\d{4}))?$/);
  if (!m) return false;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].slice(0, 3).toLowerCase());
  if (month < 0) return false;
  if (m[3]) return new Date(+m[3], month, +m[2]).getTime() < today;
  // No year: take the one that lands nearest today (a January target seen in December is next month, not eleven months ago).
  const y = now.getFullYear();
  const nearest = [y - 1, y, y + 1].map((yr) => new Date(yr, month, +m[2]).getTime()).sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0];
  return nearest < today;
}

/** A logo's size in the top bar: the chosen percentage, kept between half and three times the standard height. */
export function logoScale(value: number | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 100;
  return Math.min(300, Math.max(50, n)) / 100;
}

/** A web address a visitor can safely be sent to (http or https), or "". */
export function safeHttpUrl(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(v) ? v : "";
}

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

/** An option that means "no" ("Not now", "Skip", "No thanks"). Shown as a thumbs-down. */
export const isDeclineOption = (o: string) => /^(not now|no|no thanks|skip|pass|not for us|decline|later)$/i.test(o.trim());
const programKey = (p: RoomProgram) => roomMilestoneKey({ key: p.key, task: p.title });
export function programDeclined(p: RoomProgram, choices: Record<string, { value: string }>): boolean {
  const c = choices[programKey(p)];
  return !!c && isDeclineOption(c.value);
}
/** Programs in their own order, with the declined ones moved to the end. */
export function sortProgramsByDecision(programs: RoomProgram[], choices: Record<string, { value: string }>): RoomProgram[] {
  return [...programs.filter((p) => !programDeclined(p, choices)), ...programs.filter((p) => programDeclined(p, choices))];
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

/**
 * The "Next up" line on the cover: what the builder typed when there is
 * something, otherwise the first milestone in the plan that is not done yet
 * (so it moves on by itself as the plan is worked through). Null when the
 * plan is finished and nothing is typed.
 */
export function roomNextUp(label: string | undefined, date: string | undefined, milestones: { task: string; target?: string; done: boolean }[]): { label: string; date: string } | null {
  const typed = (label ?? "").trim();
  if (typed) return { label: typed, date: (date ?? "").trim() };
  const open = milestones.find((m) => !m.done && (m.task ?? "").trim());
  return open ? { label: open.task.trim(), date: (open.target ?? "").trim() } : null;
}

const fmtDate = (iso: string | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const initials = (name: string) => {
  const w = (name ?? "").trim().split(/\s+/).filter((x) => /^[\p{L}\p{N}]/u.test(x));
  return w.length ? ((w[0][0] ?? "") + (w.length > 1 ? (w[w.length - 1][0] ?? "") : "")).toUpperCase() : "";
};
/** The icons a launch-kit item can carry, in the order the builder offers them. */
export const ROOM_ASSET_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "document", label: "Document", Icon: FileText },
  { key: "email", label: "Email", Icon: Mail },
  { key: "social", label: "Social post", Icon: Share2 },
  { key: "image", label: "Image", Icon: ImageIcon },
  { key: "video", label: "Video", Icon: Video },
  { key: "link", label: "Link", Icon: Link2 },
  { key: "guide", label: "Guide", Icon: BookOpen },
  { key: "brand", label: "Logos and brand", Icon: Palette },
  { key: "announcement", label: "Announcement", Icon: Megaphone },
  { key: "slides", label: "Slides", Icon: Presentation },
  { key: "quote", label: "Approved wording", Icon: Quote },
  { key: "checklist", label: "Checklist", Icon: ClipboardList },
];

/**
 * The icon for a launch-kit item: the one chosen in the builder, else one that
 * fits what the item is (its kind and its title). Null means the small
 * file-type tag was asked for.
 */
export function roomAssetIconKey(asset: Pick<RoomAsset, "kind" | "title" | "icon">): string | null {
  const chosen = (asset.icon ?? "").trim();
  if (chosen === "tag") return null;
  if (chosen && ROOM_ASSET_ICONS.some((i) => i.key === chosen)) return chosen;
  const t = (asset.title ?? "").toLowerCase();
  if (asset.kind === "video") return "video";
  if (asset.kind === "image") return "image";
  if (/\b(e-?mail|newsletter)\b/.test(t)) return "email";
  if (/\b(social|post|caption|linkedin)\b/.test(t)) return "social";
  if (/\b(logos?|brand)\b/.test(t)) return "brand";
  if (/\b(guide|playbook|handbook|plan)\b/.test(t)) return "guide";
  if (/\b(deck|slides|presentation)\b/.test(t)) return "slides";
  if (/\b(press|announcement|release)\b/.test(t)) return "announcement";
  if (/\b(description|boilerplate|wording|messaging)\b/.test(t)) return "quote";
  if (/\b(checklist|roster|list)\b/.test(t)) return "checklist";
  return asset.kind === "link" ? "link" : "document";
}

const FILE_TAG: Record<RoomAssetKind, string> = { pdf: "PDF", video: "VID", image: "IMG", text: "TXT", link: "URL", file: "FILE" };

/**
 * Tables that turn into stacked rows when there isn't room for their columns.
 * Used twice: on a narrow screen (media query), and whenever the room itself
 * is narrow on a wide screen, as in the builder's canvas (`.prw.tight`, set
 * from the room's measured width), where a media query never fires.
 */
const STACK_RULES = `.prw-plan thead,.prw-reqs thead{display:none}
.prw-reqs tr{display:block;border-top:1px solid var(--line)}
.prw-reqs td{display:block;border-top:0;padding:2px 14px}
.prw-reqs td:first-child{padding-top:12px}
.prw-reqs td:last-child{padding-bottom:12px}
.prw-plan tr{display:block}
.prw-plan td{display:block;border-top:0;padding:2px 14px;white-space:normal!important;text-align:left!important}
.prw-plan td:first-child{padding-top:12px}
.prw-plan td:last-child{padding-bottom:12px;border-bottom:1px solid var(--line)}
.prw-plan tr.grp td,.prw-plan tr.chk td{padding:8px 14px}
.prw-prog{grid-template-columns:64px minmax(0,1fr);gap:8px 12px}
.prw-prog .im{width:64px;height:48px}
.prw-prog .who,.prw-prog .when,.prw-prog .dec{grid-column:2;justify-self:start;text-align:left}`;
const TEAM_STACK_RULES = `.prw-team thead{display:none}
.prw-team td{display:block;border-top:0;padding:2px 14px;white-space:normal!important}
.prw-team td:first-child{padding-top:12px;border-top:1px solid var(--line)}
.prw-team td:last-child{padding-bottom:12px}`;
/** Each rule again, applying only inside a tight room. */
const whenTight = (rules: string) =>
  rules
    .split("\n")
    .map((line) => {
      const at = line.indexOf("{");
      return at < 0 ? line : `${line.slice(0, at).split(",").map((sel) => `.prw.tight ${sel.trim()}`).join(",")}${line.slice(at)}`;
    })
    .join("\n");
/** Below this width the plan and marketing tables have no room for their columns. */
export const ROOM_TIGHT_WIDTH = 1200;

const CSS = `
.prw{--ink:#0E1A16;--body:#5C6B61;--faint:#9AA69E;--line:#E7E7E0;--paper:#FCFCFA;--page:#F3F4EF;--green:#1AC065;--blue:#224EA0;--amber:#A98600;--red:#B42318;background:var(--page);color:var(--ink);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
.prw *{box-sizing:border-box}
/* The display face is for the page title and each module's headline only; every other heading uses the body face. */
.prw :is(h3,h4,h5,h6){font-family:inherit!important}
.prw a{color:inherit;text-decoration:none}
.prw button{font:inherit;cursor:pointer}
.prw-wrap{max-width:1280px;margin:0 auto;padding:0 32px}
.prw-num{font-variant-numeric:tabular-nums}
.prw{zoom:1.1}
.prw-cover.fb{background-position:center;background-size:cover;background-repeat:no-repeat}
.prw-cover.fb::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--dark) 94%,transparent) 0%,color-mix(in srgb,var(--dark) 78%,transparent) 42%,color-mix(in srgb,var(--dark) 22%,transparent) 100%),linear-gradient(0deg,color-mix(in srgb,var(--dark) 88%,transparent) 0%,transparent 46%)}
.prw-cover.fb .prw-wrap{position:relative}
.prw-cover.fb .prw-hero{grid-template-columns:minmax(0,680px);padding:64px 0 148px}
.prw-cover.fb h1{font-size:54px}
.prw-cover.fb .prw-next,.prw-cover.lt .prw-next{display:inline-flex;gap:10px;align-items:center;margin-top:22px;padding:8px 14px;border-radius:999px;font-size:12.5px;border:1px solid color-mix(in srgb,currentColor 28%,transparent)}
.prw-cover.fb .prw-next b,.prw-cover.lt .prw-next b{color:var(--accent)}
.prw-cover.lt{background:var(--paper);color:var(--ink);border-bottom:1px solid var(--line)}
.prw-cover.lt .prw-eyebrow{color:var(--green)}
.prw-cover.lt h1{color:var(--dark)}
.prw-cover.lt p.lede{color:var(--body);opacity:1}
.prw-cover.lt .prw-stats,.prw-cover.lt .prw-stats>div+div{border-color:var(--line)}
.prw-cover.lt .prw-stats b{color:var(--dark)}
.prw-cover.lt .prw-req{background:var(--dark);color:var(--on-dark)}
.prw-cover.lt .prw-next b{color:var(--green)}
.prw-cover.lt .prw-hero{padding:34px 0 108px}
.prw-cover.lt .prw-photo{box-shadow:0 24px 48px -28px rgba(0,0,0,.35)}
.prw-thumbs{display:inline-flex;gap:8px;align-items:center}
.prw-thumb{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;border:1.5px solid #D4D8D0;background:#fff;color:var(--body);padding:0;transition:background .12s,color .12s,border-color .12s}
.prw-thumb svg{width:16px;height:16px}
.prw-thumb.up:hover,.prw-thumb.up.on{border-color:#16A34A;color:#16A34A}
.prw-thumb.up.on{background:#16A34A;color:#fff}
.prw-thumb.down:hover,.prw-thumb.down.on{border-color:#DC2626;color:#DC2626}
.prw-thumb.down.on{background:#DC2626;color:#fff}
.prw-thumb:disabled{opacity:.6;cursor:default}
.prw-prog.off{background:#FAFAF8}
.prw-prog.off>*:not(.dec){opacity:.45;filter:grayscale(1)}
.prw-later{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:10px 20px;border-top:1px solid var(--line);background:#FAFAF8}
.prw-scroll{overflow-x:auto;border-radius:12px}
.prw-th{display:inline-flex;align-items:center;gap:5px;background:none;border:0;padding:0;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;white-space:nowrap}
.prw-th svg{width:11px;height:11px;opacity:.55}
.prw-th.on svg{opacity:1}
.prw-edit{outline:0;border-radius:4px;cursor:text;white-space:pre-wrap;transition:box-shadow .12s}
.prw-edit:hover{box-shadow:0 0 0 1px color-mix(in srgb,var(--dark) 28%,transparent)}
.prw-edit:focus{box-shadow:0 0 0 2px var(--green);background:#fff}
.prw-edit:empty::before{content:attr(data-ph);color:var(--faint);font-weight:400}
.prw-eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--green)}
.prw-cover{background:var(--dark);color:var(--on-dark);position:relative;overflow:hidden}
.prw-top{display:flex;align-items:center;min-height:68px;gap:20px}
.prw-lock{display:flex;align-items:center;gap:12px;font-weight:600;font-size:15px}
.prw-lock img{height:calc(22px * var(--blogo,1));width:auto;max-width:min(46vw,420px);object-fit:contain;display:block}
.prw-lock .x{opacity:.45;font-weight:400}
.prw-sched{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 14px;border-radius:8px;border:1px solid color-mix(in srgb,currentColor 34%,transparent);color:inherit;font-size:13px;font-weight:700;white-space:nowrap;text-decoration:none;background:transparent}
.prw-sched:hover{border-color:currentColor}
.prw-team td.r{white-space:nowrap}
.prw-team td.r .prw-ib+.prw-ib{margin-left:6px}
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
.prw-compose{border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px 20px 14px}
.prw-field{position:relative;display:block;flex:1;min-width:0}
.prw-field textarea,.prw-field input{display:block;width:100%;border:0;outline:0;font:inherit;background:transparent;color:var(--ink);resize:none;min-width:0;padding:0}
.prw-field textarea{min-height:64px;line-height:1.5}
.prw-ctools{display:flex;align-items:center;gap:4px;margin-top:10px;padding-top:12px;border-top:1px solid var(--line)}
.prw-ctools .sp{flex:1}
.prw .tool{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 9px;border-radius:8px;border:0;background:none;color:var(--body);font-size:12.5px;font-weight:600}
.prw .tool:hover:not(:disabled){background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--dark)}
.prw .tool:disabled{opacity:.45}
.prw .tool svg{width:17px;height:17px}
.prw-pop{position:relative;display:inline-flex}
.prw-emoji{position:absolute;z-index:30;left:0;top:calc(100% + 6px);display:grid;grid-template-columns:repeat(8,32px);gap:2px;padding:8px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(15,25,20,.14)}
.prw-emoji.react{grid-template-columns:repeat(6,36px);top:auto;bottom:calc(100% + 6px)}
.prw .prw-emoji button{width:auto;height:32px;padding:0;border:0;border-radius:8px;background:none;font-size:18px;line-height:1;display:grid;place-items:center}
.prw .prw-emoji.react button{height:36px;font-size:20px}
.prw .prw-emoji button:hover{background:color-mix(in srgb,var(--dark) 8%,#fff)}
.prw-people{position:absolute;z-index:30;left:0;top:calc(100% + 6px);min-width:220px;max-width:320px;padding:6px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(15,25,20,.14);display:grid;gap:2px}
.prw .prw-people button{display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:none;text-align:left;font-size:13px;font-weight:600;color:var(--ink)}
.prw .prw-people button.on{background:color-mix(in srgb,var(--dark) 8%,#fff)}
.prw-people i{width:24px;height:24px;border-radius:50%;background:color-mix(in srgb,var(--dark) 9%,#fff);color:var(--dark);display:grid;place-items:center;font-size:10px;font-weight:700;font-style:normal;flex:none}
.prw-at{color:var(--dark);font-weight:600;background:color-mix(in srgb,var(--accent) 34%,#fff);border-radius:4px;padding:0 3px}
.prw-pics{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.prw-pics span{position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;background:#F1F3EE;display:grid;place-items:center}
.prw-pics img{width:100%;height:100%;object-fit:cover}
.prw .prw-pics button{position:absolute;top:4px;right:4px;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:rgba(15,25,20,.72);color:#fff;display:grid;place-items:center}
.prw-pics button svg{width:12px;height:12px}
.prw-pics .wait svg{width:18px;height:18px;color:var(--body);animation:prw-spin 1s linear infinite}
@keyframes prw-spin{to{transform:rotate(360deg)}}
.prw-photos{display:grid;gap:4px;margin:0 24px 18px 72px;border-radius:10px;overflow:hidden}
.prw-photos.n2,.prw-photos.n3,.prw-photos.n4{grid-template-columns:1fr 1fr}
.prw .prw-photos button{display:block;padding:0;border:0;background:#F1F3EE;cursor:zoom-in;overflow:hidden}
.prw-photos img{display:block;width:100%;height:100%;object-fit:cover}
.prw-photos.n1 img{max-height:440px}
.prw-photos.n2 button,.prw-photos.n4 button{aspect-ratio:4/3}
.prw-photos.n3 button{aspect-ratio:4/3}
.prw-photos.n3 button:first-child{grid-column:1/-1;aspect-ratio:16/9}
.prw-light{position:fixed;inset:0;z-index:200;background:rgba(10,16,13,.86);display:grid;place-items:center;padding:32px;cursor:zoom-out}
.prw-light img{max-width:100%;max-height:100%;border-radius:8px;cursor:default}
.prw .prw-light button{position:absolute;top:16px;right:16px;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center}
.prw-light button svg{width:18px;height:18px}
.prw-win{border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:16px}
.prw-win .wt{display:flex;gap:14px;align-items:center;padding:20px 24px 0}
.prw-win .wa{width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--dark) 9%,#fff);color:var(--dark);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.prw-win .wa.team{background:var(--dark);color:var(--accent)}
.prw-win .ww{font-size:13px}
.prw-win .ww b{color:var(--ink)}
.prw-win .ww span{color:var(--body);font-size:12px;display:block}
.prw-win .wb{padding:12px 24px 18px 72px;font-size:14px;color:var(--ink);white-space:pre-wrap}
.prw-win .wb .big{font-size:20px;font-weight:700;letter-spacing:-.02em;color:var(--dark);display:block;margin-bottom:2px}
.prw-win .wx{display:flex;flex-wrap:wrap;gap:6px;padding:10px 24px 12px 66px;border-top:1px solid var(--line);align-items:center}
.prw-win .wx button{display:inline-flex;gap:6px;align-items:center;padding:5px 10px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--body);background:none;border:0}
.prw-win .wx button.on{background:color-mix(in srgb,var(--dark) 8%,#fff);color:var(--dark)}
.prw-win .wx button.rx{border:1px solid var(--line);padding:4px 10px;color:var(--ink)}
.prw-win .wx button.rx.on{border-color:color-mix(in srgb,var(--dark) 40%,#fff)}
.prw-win .wx button.rx span{font-size:15px;line-height:1}
.prw-win .wx .prw-emoji button{justify-content:center}
.prw-win .wx svg{width:14px;height:14px}
.prw-win .wc{padding:12px 24px 12px 72px;background:#FAFBF8;border-top:1px solid var(--line);font-size:13px;color:var(--body);white-space:pre-wrap}
.prw-win>:last-child{border-radius:0 0 12px 12px}
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
.prw-ft.ic{width:40px;height:40px;border:0;border-radius:10px;padding:0;place-items:center;background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--dark)}
.prw-ft.ic svg{width:18px;height:18px}
.prw-ft.img img{width:100%;height:100%;object-fit:cover}
.prw-doc .a{margin-left:auto;display:flex;gap:8px;flex:none}
.prw-body{border-top:1px solid var(--line);background:#FAFBF8;padding:14px 16px 16px 64px;font-size:13.5px;white-space:pre-wrap;color:var(--ink)}
.prw-chip{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--green) 14%,#fff);color:#0B6B3A;white-space:nowrap}
.prw-chip.review{background:#FBF3D9;color:#7A6100}.prw-chip.in_progress{background:#E8EEF9;color:var(--blue)}.prw-chip.new{background:#F1F2EE;color:var(--body)}
.prw-sc-tiles{display:grid;grid-template-columns:repeat(var(--n,6),minmax(0,1fr));gap:10px;margin-bottom:14px}
.prw-sc-tile{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;padding:14px 14px 12px;min-width:0;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--body);font-size:12.5px;transition:border-color .12s,box-shadow .12s}
.prw-sc-tile:hover{border-color:color-mix(in srgb,var(--dark) 40%,var(--line))}
.prw-sc-tile.on{border-color:var(--dark);box-shadow:inset 0 0 0 1px var(--dark)}
.prw-sc-tile b{font-size:24px;line-height:1.05;color:var(--dark);letter-spacing:-.03em;font-weight:700}
.prw-sc-tile span{font-weight:600;color:var(--ink);min-height:2.5em;line-height:1.25}
.prw-sc-tile small{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;min-height:15px}
.prw-sc-tile small i{font-style:normal;font-weight:600;white-space:nowrap}
.prw-sc-tile small i.up{color:#0B6B3A}.prw-sc-tile small i.down{color:#A4401B}
@media (max-width:1180px){.prw-sc-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}}
.prw-sc-bar{display:flex;gap:2px;height:8px;border-radius:999px;overflow:hidden;margin-bottom:22px;background:#F1F2EE}
.prw-sc-bar span{display:block;min-width:3px}
.prw-sc-bar .not_started{background:#D9DCD4}.prw-sc-bar .scheduling{background:#E3C65A}.prw-sc-bar .training_booked{background:#9DB5E4}.prw-sc-bar .trained{background:var(--blue)}.prw-sc-bar .live{background:var(--green)}
.prw-sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.prw-sc-panel{padding:18px 20px}
.prw-sc-panel h4,.prw-sc-regions h4{font-size:13px;font-weight:700;color:var(--dark);margin:0 0 12px}
.prw-sc-panel svg{display:block;width:100%;height:70px}
.prw-sc-panel polyline{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.prw-sc-panel polyline.live{stroke:var(--green)}.prw-sc-panel polyline.trained{stroke:var(--blue)}
.prw-sc-panel .key{display:flex;gap:16px;align-items:center;margin-top:10px;font-size:12px;color:var(--body);flex-wrap:wrap}
.prw-sc-panel .key i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
.prw-sc-panel .key i.live{background:var(--green)}.prw-sc-panel .key i.trained{background:var(--blue)}
.prw-sc-panel .key b{color:var(--ink);margin-left:3px}
.prw-sc-panel .key .since{margin-left:auto}
.prw-sc-panel .none{font-size:12.5px;color:var(--body);margin:0;max-width:46ch}
.prw-sc-panel .goal+.goal{margin-top:14px}
.prw-sc-panel .goal .top{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--ink);font-weight:600}
.prw-sc-panel .goal .top b{color:var(--dark);white-space:nowrap}
.prw-sc-panel .track,.prw-sc-regions .track{display:block;height:6px;border-radius:999px;background:#F1F2EE;overflow:hidden;margin:7px 0 5px}
.prw-sc-panel .track span,.prw-sc-regions .track span{display:block;height:100%;background:var(--green);border-radius:999px}
.prw-sc-panel .goal .foot{font-size:11.5px;color:var(--body)}
.prw-sc-regions{padding:18px 20px 10px;margin-bottom:22px}
.prw-sc-regions .hd{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.prw-sc-regions .hd span{font-size:12px;color:var(--body)}
.prw-sc-regions>button{display:grid;grid-template-columns:minmax(120px,1.2fr) 2fr minmax(96px,auto);gap:14px;align-items:center;width:100%;padding:7px 8px;margin:0 -8px;border:0;border-radius:8px;background:none;text-align:left;font-size:13px;color:var(--ink)}
.prw-sc-regions>button:hover{background:#F7F8F5}
.prw-sc-regions>button.on{background:color-mix(in srgb,var(--green) 10%,#fff)}
.prw-sc-regions>button .n{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prw-sc-regions>button .track{margin:0}
.prw-sc-regions>button .v{font-size:12px;color:var(--body);text-align:right;white-space:nowrap}
.prw-sc-regions>button.more{display:block;width:auto;margin:6px 0 4px;padding:4px 0;font-size:12px;font-weight:600;color:var(--dark)}
.prw-sc-tools input{max-width:280px}
.prw-act{display:inline-flex;flex-direction:column;align-items:center;gap:5px;vertical-align:middle}
.prw-rowact{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}
.prw-ib.on{background:var(--dark);border-color:var(--dark);color:var(--on-dark)}
.prw-plan tr.on>td,.prw-reqs tr.on>td{background:#FAFBF8}
.prw-plan tr.prw-edit>td,.prw-reqs tr.prw-edit>td{background:#FAFBF8;border-top:0;padding-top:0;padding-bottom:16px}
.prw-reqs td.r{text-align:right}
.prw-edit .f{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:#fff}
.prw-edit label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:600;color:var(--body)}
.prw-edit .prw-pick{height:34px;min-width:150px;font-size:13px}
.prw-edit input.prw-pick{display:block;width:130px;min-width:0;margin:0}
.prw-edit .b{display:flex;gap:8px;margin-left:auto}
.prw-tplrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--body)}
.prw .prw-tplrow .prw-tpl{display:inline-flex;align-items:center;gap:5px;padding:0;border:0;background:none;font-size:12.5px;font-weight:600;color:var(--dark);text-decoration:underline;text-underline-offset:2px}
.prw .prw-tplrow .prw-tpl svg{width:12px;height:12px}
.prw-sc-docs summary{cursor:pointer;list-style:none;font-weight:600;color:var(--ink)}
.prw-sc-docs summary::-webkit-details-marker{display:none}
.prw-sc-docs summary span{font-weight:400;color:var(--body);font-size:11.5px;margin-left:5px}
.prw-sc-docs ul{margin:6px 0 0;padding:0;list-style:none;font-size:12px;color:var(--body);white-space:normal;min-width:150px}
.prw-sc-docs li{padding:1px 0}
.prw-sc-check .extra{margin:8px 0 0 30px;font-size:12.5px;color:var(--body)}
.prw-sc-check .extra li{margin:2px 0}
.prw-sc-yes{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:5px;background:color-mix(in srgb,var(--green) 16%,#fff);color:#0B6B3A}
.prw-sc-yes svg{width:12px;height:12px}
.prw-sc-cols{position:relative;margin-left:auto}
.prw-sc-cols .menu{position:absolute;right:0;top:38px;z-index:20;min-width:210px;padding:8px;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:0 12px 28px -14px rgba(0,0,0,.3)}
.prw-sc-cols .menu label{display:flex;align-items:center;gap:8px;padding:5px 6px;font-size:13px;color:var(--ink);border-radius:6px;cursor:pointer}
.prw-sc-cols .menu input{flex:none;width:15px;height:15px;min-width:0;max-width:none;padding:0;margin:0;border:0;accent-color:var(--dark)}
.prw-sc-cols .menu label:hover{background:#F7F8F5}
.prw-sc-cols .menu em{margin-left:auto;font-style:normal;font-size:10.5px;color:var(--body)}
.prw-sc-check{border:1px solid color-mix(in srgb,var(--green) 40%,var(--line));background:color-mix(in srgb,var(--green) 7%,#fff);border-radius:12px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:var(--ink)}
.prw-sc-check.warn{border-color:#E3C65A;background:#FDF8E6}
.prw-sc-check .hd{display:flex;gap:12px;align-items:flex-start}
.prw-sc-check .hd svg{width:18px;height:18px;flex:none;margin-top:1px;color:#0B6B3A}
.prw-sc-check.warn .hd svg{color:#8A6A00}
.prw-sc-check .hd b{display:block;color:var(--dark)}
.prw-sc-check .hd span{display:block;color:var(--body);margin-top:2px;max-width:70ch}
.prw-sc-check .hd em{margin-left:auto;font-style:normal;font-size:11px;font-weight:600;color:var(--body);white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:2px 8px;background:#fff}
.prw-sc-check .rows{display:grid;gap:4px;margin:12px 0 12px 30px}
.prw-sc-check .rows b{color:var(--dark);margin-right:4px}
.prw-sc-check>.prw-btn{margin-left:30px}
.prw-sc-check .names{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:12px 0 2px 30px}
.prw-sc-check .names h5{font-size:11.5px;font-weight:700;color:var(--body);margin:0 0 4px}
.prw-sc-check .names ul{margin:0;padding:0;list-style:none;max-height:220px;overflow:auto;font-size:12.5px}
.prw-sc-check .names li{padding:2px 0}
.prw-pick{height:30px;max-width:100%;border:1px solid #D4D8D0;border-radius:7px;padding:0 6px;font:inherit;font-size:12.5px;color:var(--ink);background:#fff}
select.prw-pick.prw-st{font-weight:600}
input.prw-pick{display:block;width:100%;margin-top:5px}
.prw-out-sum .late b{color:var(--red)}
.prw-out-bar{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.prw-out .prw-li .src{font-weight:600;color:var(--dark)}
.prw-out .prw-li .late{color:var(--red);font-weight:600}
.prw-out .prw-li .a{display:flex;gap:10px;align-items:center}
.prw-out .who{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap;background:#F1F2EE;color:var(--body)}
.prw-out .who.you{background:#FBF3D9;color:#7A6100}
.prw-out .who.us{background:#E8EEF9;color:var(--blue)}
.prw-out-h{margin:32px 0 12px}
.prw-out-h h3{margin:0 0 2px;font-size:16px;font-weight:700;color:var(--dark)}
.prw-out-h p{margin:0;font-size:13px;color:var(--body);max-width:68ch}
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
${whenTight(STACK_RULES)}
${whenTight(TEAM_STACK_RULES)}
.prw.tight .prw-sc-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
.prw.tight .prw-sc-grid{grid-template-columns:1fr}
@media (max-width:900px){
.prw-wrap{padding:0 16px}
.prw-doc{flex-wrap:wrap}
.prw-doc .a{margin-left:48px;flex-wrap:wrap}
.prw-hero{grid-template-columns:1fr;gap:24px;padding-bottom:88px}
.prw-cover h1{font-size:32px}
.prw-me{display:none}
.prw-top{min-height:60px}
.prw-stats{flex-wrap:wrap;row-gap:4px}
.prw-stats>div{padding:14px 18px 0 0}
.prw-stats>div+div{padding-left:18px}
.prw-stats b{font-size:20px;white-space:nowrap}
.prw{zoom:1}
.prw-cover.fb h1{font-size:34px}
.prw-cover.fb .prw-hero{padding:36px 0 110px}
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
${STACK_RULES}
.prw-step{flex-wrap:wrap}
.prw-min .mb{grid-template-columns:1fr;padding-left:16px}
.prw-win .wb,.prw-win .wx,.prw-win .wc,.prw-cbox{padding-left:16px}
.prw-photos{margin-left:16px;margin-right:16px}
.prw-emoji{grid-template-columns:repeat(6,32px)}
.prw-ctools .tool span{display:none}
.prw-ob .bar{display:none}
.prw-body{padding-left:16px}
${TEAM_STACK_RULES}
.prw-sc-tiles{grid-template-columns:1fr 1fr}.prw-sc-tile span{min-height:0}.prw-sc-grid{grid-template-columns:1fr}.prw-sc-check .names{grid-template-columns:1fr}.prw-sc-check .hd{flex-wrap:wrap}.prw-sc-check .hd em{margin-left:30px}.prw-sc-regions>button{grid-template-columns:1fr auto}.prw-sc-regions>button .track{display:none}.prw-sc-cols{margin-left:0}
.prw-sum{flex-wrap:wrap}
}
`;

type RequestPreset = { subject: string; assetKey?: string; kind?: string; stepKey?: string; details?: string };
type Ask = { kind: "request"; preset?: RequestPreset } | { kind: "email" } | { kind: "contact" } | null;

export function BlockRoomWorkspace({ props: rawProps, brand, blockId, onFieldChange }: Props) {
  // What is shown has the account name filled in; what is saved keeps the variables.
  const { props, rawOf } = useMemo(() => resolveRoomProps(rawProps), [rawProps]);
  const isEditor = !!onFieldChange;
  const { pageId, sessionId } = usePageContext();
  // In the builder the page isn't live, but what the customer will see still matters: load the room's data read-only there.
  const room = useRoom(pageId, true, { readOnly: isEditor });
  // Is the room itself narrow (the builder's canvas, a small laptop)? Then the wide tables stack instead of squeezing.
  const rootRef = useRef<HTMLElement | null>(null);
  const [tight, setTight] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setTight(el.getBoundingClientRect().width < ROOM_TIGHT_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
  // Goals counted from the practice list, with a number to reach: the scorecard shows their progress.
  const scorecardGoals: ScorecardGoal[] = goals
    .filter((g) => (g.metric === "practices_live" || g.metric === "practices_trained") && typeof g.targetValue === "number" && g.targetValue > 0)
    .map((g) => ({ key: g.key, title: g.title, value: goalValue(g, { byStage: pr.byStage, planDone: 0 }) ?? 0, target: g.targetValue as number, targetText: g.target }));
  const noun = (props.locationsNoun ?? "").trim() || "locations";
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  // Milestones with the customer's saved state laid over the builder's status.
  // Changes the account team made on this page since it loaded (status, owners): saved to the page, and laid over what was loaded.
  const [planEdits, setPlanEdits] = useState<Record<string, Partial<RoomMilestone>>>({});
  const rows = useMemo(
    () =>
      groups.flatMap((g, gi) =>
        (g.rows ?? []).map((row, ri) => {
          const key = roomMilestoneKey(row);
          const r = planEdits[key] ? { ...row, ...planEdits[key] } : row;
          const action = r.customerAction === "check" || r.customerAction === "upload" ? r.customerAction : null;
          const saved = action ? snapshot.tasks[key] : undefined;
          return { gi, ri, r, action, key, saved, status: saved?.done ? ("done" as RoomMilestoneStatus) : resolveRoomStatus(r.status) };
        }),
      ),
    [groups, snapshot.tasks, planEdits],
  );
  const doneCount = rows.filter((x) => x.status === "done").length;
  // The line on the cover photo: what the builder typed, else the first milestone still open in the plan.
  const next = roomNextUp(props.nextMilestoneLabel, props.nextMilestoneDate, rows.filter((x) => !x.r.hidden && !groups[x.gi]?.hidden).map((x) => ({ task: x.r.task, target: x.r.target, done: x.status === "done" })));
  const mine = rows.filter((x) => x.action && x.status !== "done");
  const reviewRequests = snapshot.requests.filter((q) => q.status === "review");
  const openRequests = snapshot.requests.filter((q) => q.status !== "done");
  // The people on each side (the Team module's first group is ours, the rest are the customer's), for assigning owners.
  const realName = (n: string | undefined) => !!n?.trim() && !/^\[.*\]$/.test(n.trim());
  const ourPeople = (team[0]?.members ?? []).map((m) => m.name).filter(realName);
  const theirPeople = [...team.slice(1).flatMap((g) => g.members ?? []).map((m) => m.name), ...snapshot.contacts.map((c) => c.name)].filter(realName);
  // The account team, on the live page, can change the plan and move requests along right here.
  const isTeam = !!snapshot.viewer?.team;
  const canEditLive = isTeam && !!store && !isEditor;
  const editPlan = async (key: string, patch: Partial<RoomMilestone>): Promise<string | null> => {
    if (!store) return null;
    const before = planEdits[key];
    setPlanEdits((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
    const r = await store.editPlan(key, patch as { status?: string; ourOwner?: string; partnerOwner?: string; target?: string });
    if (r.ok) return null;
    setPlanEdits((p) => ({ ...p, [key]: before ?? {} }));
    return r.error;
  };

  /** Builder only: patch one item of the props (a milestone, an asset, a person…) found by identity. */
  const editItem = useMemo(
    () =>
      onFieldChange
        ? (item: object, patch: Record<string, unknown>) => {
            // Patch the stored object (variables intact), not the filled-in copy that is on screen.
            const target = rawOf.get(item) ?? item;
            const next = swapDeep(rawProps, target, { ...target, ...patch });
            if (next !== rawProps) onFieldChange(next as RoomWorkspaceBlockProps);
          }
        : null,
    [onFieldChange, rawProps, rawOf],
  );
  const field = (key: keyof RoomWorkspaceBlockProps) => (onFieldChange ? (v: string) => onFieldChange({ ...rawProps, [key]: v }) : undefined);
  /** Record engagement with an asset. Goes through the room so the event carries who it was when the visitor is known. */
  const trackHub = (a: HubAsset, action: HubAssetAction, value?: number) => {
    if (isEditor || !store || isTrackingSuppressed()) return;
    const payload = buildAssetEventPayload({ pageId, sessionId, blockId }, a, action, value === undefined ? {} : { value });
    if (payload) store.trackAsset(payload);
  };
  const track = (asset: RoomAsset, action: "view" | "download" | "open") => trackHub(roomAssetToHub(asset), action);
  const [viewing, setViewing] = useState<HubAsset | null>(null);
  /** Open an asset: PDFs, images and videos in the in-page viewer, everything else in a new tab. Returns true when the viewer took it. */
  const openAsset = (asset: RoomAsset): boolean => {
    if (isEditor) return true;
    const a = roomAssetToHub(asset);
    if (opensInViewer(a) && a.kind !== "text" && shouldOpenInline(a)) {
      setViewing(a);
      trackHub(a, "view");
      return true;
    }
    trackHub(a, "open");
    return false;
  };
  /** Run something that needs a known visitor; ask for their email first when they are anonymous. */
  const needViewer = (fn: () => void) => {
    if (isEditor) return;
    if (!store || !snapshot.viewer) setAsk({ kind: "email" });
    else fn();
  };
  const openRequest = (preset?: RequestPreset) => needViewer(() => setAsk({ kind: "request", preset }));
  const canRequest = modules.some((m) => m.key === "requests");

  // Overdue: marked so by the team, or not done with a target date that has passed.
  const blocked = rows.filter((x) => !x.r.hidden && !groups[x.gi]?.hidden && (x.status === "blocking" || (x.status !== "done" && !!now && targetHasPassed(x.r.target, now))));
  // Everything the customer has to act on, as one number and one list.
  const attention = [...stepsOpen, ...mine, ...reviewRequests];
  // Outstanding: every open item from every module, with whose move it is.
  const brandLabel = brand.brandName || "Us";
  const partnerLabel = (props.partnerShort ?? "").trim() || props.partnerName || "You";
  const actionDone = (m: RoomMeeting, a: RoomMeetingAction) => !!a.done || !!snapshot.tasks[roomMeetingActionKey(m.key, a.text)]?.done;
  const outstandingAll: OutstandingItem[] = [
    ...stepsOpen.map((x): OutstandingItem => ({ id: `step-${x.key}`, title: x.step.title, source: "Setup", side: "you", module: "overview" })),
    ...(needsAgreement ? [{ id: "goals", title: "Agree the goals for the partnership", source: "Goals", side: "you", module: "goals" } satisfies OutstandingItem] : []),
    ...rows
      .filter((x) => !x.r.hidden && !groups[x.gi]?.hidden && x.status !== "done" && (x.action || blocked.includes(x)))
      .map((x): OutstandingItem => ({
        id: `plan-${x.key}`,
        title: x.r.task,
        source: "Action plan",
        owner: x.action ? x.r.partnerOwner : [x.r.ourOwner, x.r.partnerOwner].filter((o) => o && o !== "—").join(" / "),
        due: x.r.target ? fmtDate(x.r.target) : undefined,
        side: x.action ? "you" : ownerSide(x.r.partnerOwner && x.r.partnerOwner !== "—" && (!x.r.ourOwner || x.r.ourOwner === "—") ? partnerLabel : x.r.ourOwner && x.r.ourOwner !== "—" && (!x.r.partnerOwner || x.r.partnerOwner === "—") ? brandLabel : "", [brandLabel], [partnerLabel]),
        overdue: blocked.includes(x),
        module: "plan",
      })),
    ...undecided.map((x): OutstandingItem => ({ id: `mk-${x.key}`, title: `Decide: ${x.title}`, source: "Marketing plan", from: x.when, side: "you", module: "marketing" })),
    ...snapshot.requests
      .filter((q) => q.status !== "done")
      .map((q): OutstandingItem => ({
        id: `req-${q.id}`,
        title: q.subject,
        source: "Request",
        from: q.status === "review" ? "Ready for your review" : ROOM_REQUEST_STATUS_LABEL[q.status] ?? q.status,
        owner: q.owner ?? undefined,
        due: q.due ?? undefined,
        side: q.status === "review" ? "you" : "us",
        module: "requests",
        ...(q.status === "review" ? { approveRequestId: q.id } : {}),
      })),
    ...meetings.flatMap((m) =>
      (m.actions ?? [])
        .filter((a) => (a.text ?? "").trim() && !actionDone(m, a))
        .map((a): OutstandingItem => ({
          id: `ma-${roomMeetingActionKey(m.key, a.text)}`,
          title: a.text,
          source: "Meeting",
          from: [m.title, m.date ? fmtDate(m.date) : ""].filter(Boolean).join(" · "),
          owner: a.owner,
          due: a.due,
          side: ownerSide(a.owner, [brandLabel, ...ourPeople], [partnerLabel, props.partnerName, ...theirPeople]),
          module: "meetings",
          taskKey: roomMeetingActionKey(m.key, a.text),
        })),
    ),
  ];
  // An item whose module is hidden for this account has nowhere to be done, so it is left out (meeting actions are ticked right in the list).
  const outstanding = outstandingAll.filter((i) => i.source === "Meeting" || modules.some((m) => m.key === i.module));
  const outstandingYours = outstanding.filter((i) => i.side !== "us").length;
  const badge: Partial<Record<RoomModuleKey, string>> = {
    overview: stepsOpen.length ? `${stepsOpen.length} to set up` : "",
    goals: needsAgreement ? "to agree" : "",
    marketing: undecided.length ? `${undecided.length} to decide` : "",
    plan: mine.length ? `${mine.length} to do` : "",
    requests: outstandingYours ? `${outstandingYours} yours` : "",
  };
  const heroImage = (props.heroImageUrl ?? "").trim();
  const cover = props.coverStyle === "fullbleed" || props.coverStyle === "light" ? props.coverStyle : "split";
  // The customer's logo is a light version made for dark covers; on the pale cover their name is set in type instead.
  const partnerLogo = cover === "light" ? "" : (props.partnerLogoUrl ?? "").trim();
  const pct = day === null ? 0 : Math.min(100, Math.round((day / total) * 100));

  return (
    <RoomEditContext.Provider value={editItem}>
    <section ref={rootRef} className={`prw${tight ? " tight" : ""}`} style={vars} data-room-workspace>
      <style>{CSS}</style>
      <div className={`prw-cover${cover === "fullbleed" ? " fb" : cover === "light" ? " lt" : ""}`} style={cover === "fullbleed" && heroImage ? { backgroundImage: `url(${JSON.stringify(heroImage).slice(1, -1)})` } : undefined} data-room-cover={cover}>
        <div className="prw-wrap">
          <div className="prw-top">
            <div className="prw-lock" style={{ ["--blogo" as string]: logoScale(props.brandLogoScale) }}>
              {brandHasLogo(brand) ? <BrandLogo brand={brand} tone={cover === "light" ? "onLight" : "onDark"} alt={brand.brandName || "Logo"} /> : <span>{brand.brandName}</span>}
              <span className="x">×</span>
              {partnerLogo ? <img src={partnerLogo} alt={props.partnerName} style={{ height: Math.round(22 * logoScale(props.partnerLogoScale)) }} data-room-partner-logo /> : <span>{props.partnerName}</span>}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {safeHttpUrl(props.scheduleUrl) && (
                <a className="prw-sched" href={isEditor ? undefined : safeHttpUrl(props.scheduleUrl)} target="_blank" rel="noopener noreferrer" data-room-schedule>
                  <CalendarPlus style={{ width: 14, height: 14 }} aria-hidden /> {(props.scheduleLabel ?? "").trim() || "Schedule a meeting"}
                </a>
              )}
              {!new Set(props.hiddenModules ?? []).has("requests") && (
                <button type="button" className="prw-req" onClick={() => openRequest()} data-room-request-button>
                  <Plus style={{ width: 14, height: 14 }} aria-hidden /> Make a request
                </button>
              )}
              {snapshot.viewer && <span className="prw-me">{snapshot.viewer.name || snapshot.viewer.email}</span>}
            </div>
          </div>
          <div className={`prw-hero${heroImage && cover !== "fullbleed" ? "" : " solo"}`}>
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
              {cover === "fullbleed" && next && (
                <div className="prw-next" data-room-next>
                  {next.date && <b>{fmtDate(next.date)}</b>}
                  <span>Next up: {next.label}</span>
                </div>
              )}
            </div>
            {heroImage && cover !== "fullbleed" && (
              <div className="prw-photo">
                <img src={heroImage} alt={props.heroImageAlt ?? ""} />
                {next && (
                  <div className="cap" data-room-next>
                    {next.date && <b>{fmtDate(next.date)}</b>}
                    <span>Next up: {next.label}</span>
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
                  {m.label}
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
                          <h3><E item={p} field="title" placeholder="Phase" /></h3>
                          {(p.summary || isEditor) && <p><E item={p} field="summary" multiline placeholder="What happens in this phase" /></p>}
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
                <div className="prw-grid2 prw-sec" style={!(now && events.upcoming.length > 0) && blocked.length === 0 ? { gridTemplateColumns: "1fr" } : undefined}>
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
                          {x.action === "upload" && isRosterTask(x.key) && <RosterTemplateLink store={store} show={!isEditor && !!snapshot.viewer} />}
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
                  ) : blocked.length > 0 ? (
                    <div className="prw-card" data-room-blocked>
                      <h3>Overdue</h3>
                      {blocked.slice(0, 4).map((x) => (
                        <div className="prw-li" key={x.key}>
                          <div>
                            <div className="t">{x.r.task}</div>
                            <div className="m">{[x.r.target ? `Due ${fmtDate(x.r.target)}` : "", x.r.note, x.r.partnerOwner].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {now && events.upcoming.length > 0 && blocked.length > 0 && (
                  <div className="prw-card prw-sec" data-room-blocked>
                    <h3>Overdue</h3>
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
                    {props.calendar && (props.calendar.intro || isEditor) && <p><E item={props.calendar} field="intro" multiline placeholder="Intro line" /></p>}
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
                    {props.meetings && (props.meetings.intro || isEditor) && <p><E item={props.meetings} field="intro" multiline placeholder="Intro line" /></p>}
                  </div>
                  {meetings.length > 0 && (
                    <div className="prw-meta">
                      <b>{meetings.length}</b> {meetings.length === 1 ? "meeting" : "meetings"} · <b>{meetings.reduce((n, m) => n + (m.actions ?? []).filter((a) => !actionDone(m, a)).length, 0)}</b> open actions
                    </div>
                  )}
                </div>
                {meetings.length === 0 && <div className="prw-card"><div className="prw-empty">Minutes will appear here after each meeting.</div></div>}
                {meetings.map((m, i) => (
                  <MeetingCard key={m.key || m.title + m.date} meeting={{ ...m, actions: (m.actions ?? []).map((a) => ({ ...a, done: actionDone(m, a) })) }} defaultOpen={i === 0} isEditor={isEditor} />
                ))}
              </>
            )}

            {active === "plan" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Action plan</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>One shared plan, owned on both sides</h2>
                    {(props.planIntro || isEditor) && <p><E item={props} field="planIntro" multiline placeholder="Intro line" /></p>}
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
                      <th style={{ width: canEditLive ? 186 : 132 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (
                      <PlanGroup key={gi} group={g} rows={rows.filter((x) => x.gi === gi).map((x) => (blocked.includes(x) ? { ...x, status: "blocking" as RoomMilestoneStatus } : x))} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} edit={canEditLive ? { save: editPlan, ours: ourPeople, theirs: theirPeople } : null} />
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
                    {(props.kitIntro || isEditor) && <p><E item={props} field="kitIntro" multiline placeholder="Intro line" /></p>}
                  </div>
                </div>
                {links.length > 0 && (
                  <>
                    <div className="prw-eyebrow" style={{ margin: "4px 0 10px" }}>Links</div>
                    <div className="prw-card" style={{ marginBottom: 24 }}>
                      {links.map((l, i) => (
                        <div className="prw-li" key={i} data-room-link>
                          <div>
                            <div className="t"><E item={l} field="title" placeholder="Link name" /></div>
                            <div className="m">{l.description || l.url}</div>
                          </div>
                          <div className="a">
                            <CopyButton text={l.url} label="Copy link" />
                            <a
                              className="prw-ib"
                              href={isEditor ? undefined : l.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open"
                              aria-label={`Open ${l.title}`}
                              onClick={(e) => {
                                if (openAsset({ key: roomMilestoneKey({ task: l.title }), kind: "link", title: l.title, externalUrl: l.url })) e.preventDefault();
                              }}
                            >
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
                    <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} onOpen={openAsset} canRequest={canRequest} onRequest={() => openRequest({ subject: `Change to: ${a.title}`, kind: "asset_change", assetKey: a.key || roomMilestoneKey({ task: a.title }) })} />
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
                    {props.goals && (props.goals.intro || isEditor) && <p><E item={props.goals} field="intro" multiline placeholder="Intro line" /></p>}
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
                            <div className="t"><E item={g} field="title" placeholder="Goal" /></div>
                            {(g.detail || isEditor) && <div className="m"><E item={g} field="detail" placeholder="Detail" /></div>}
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
                  {blocked.length > 0 && <div className="prw-kpi"><div className="k">Overdue</div><div className="v prw-num">{blocked.length}</div></div>}
                </div>
              </>
            )}

            {active === "practices" && <ScorecardView snapshot={snapshot} store={store ?? room.reader} isEditor={isEditor} noun={noun} display={BRAND_DISPLAY_STACK} goals={scorecardGoals} onNeedEmail={() => setAsk({ kind: "email" })} />}

            {active === "wins" && <WinsView snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} display={BRAND_DISPLAY_STACK} />}

            {active === "marketing" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Marketing plan</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>How we bring your teams on board</h2>
                    {props.marketing && (props.marketing.intro || isEditor) && <p><E item={props.marketing} field="intro" multiline placeholder="Intro line" /></p>}
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
                      {/* Declined programs drop to the bottom, greyed, so what is in the plan reads first. */}
                      {sortProgramsByDecision(g.programs, snapshot.choices).map((x, i, all) => {
                        const off = programDeclined(x, snapshot.choices);
                        return (
                          <div key={x.key || x.title}>
                            {off && (i === 0 || !programDeclined(all[i - 1], snapshot.choices)) && <div className="prw-later">Not now</div>}
                            <ProgramRow program={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} />
                          </div>
                        );
                      })}
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
                    <div className="prw-eyebrow">Outstanding</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>What’s open, and who has it</h2>
                    <p>Every open item from the plan, meetings, marketing and your requests, in one list. Finish it here or open it where it lives.</p>
                  </div>
                  <button type="button" className="prw-btn pri" onClick={() => openRequest()}>
                    <Plus aria-hidden /> Make a request
                  </button>
                </div>
                <OutstandingView
                  items={outstanding}
                  ourName={brandLabel}
                  theirName={partnerLabel}
                  isTeam={isTeam}
                  canAct={!!store && !!snapshot.viewer}
                  onOpen={(m) => (!modules.some((x) => x.key === m) ? undefined : m === "requests" ? document.querySelector("[data-room-requests]")?.scrollIntoView({ behavior: "smooth", block: "start" }) : setView(m as RoomModuleKey))}
                  onTick={async (key) => {
                    if (!store) return null;
                    const r = await store.setTaskDone(key, true);
                    return r.ok ? null : r.error;
                  }}
                  onApprove={async (id) => {
                    if (!store) return null;
                    const r = await store.updateRequest(id, { status: "done" });
                    return r.ok ? null : r.error;
                  }}
                />
                <div className="prw-out-h" data-room-requests>
                  <h3>Requests</h3>
                  <p>Ask us for anything: a change to an asset, an event, a report. It goes to the right person with a target date, and you approve it here when it’s ready.</p>
                </div>
                <RequestsTable snapshot={snapshot} isEditor={isEditor} onSignIn={() => setAsk({ kind: "email" })} store={canEditLive ? store : null} customerStore={!isTeam && snapshot.viewer ? store : null} people={ourPeople} />
              </>
            )}

            {active === "team" && (
              <>
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Our Team</div>
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

      <HubAssetViewer
        asset={viewing}
        onClose={() => setViewing(null)}
        palette={resolveHubPalette({}, brand, "library")}
        onDownload={(a) => trackHub(a, "download")}
        onOpenExternal={(a) => trackHub(a, "open")}
        onProgress={(a, pct) => trackHub(a, "progress", pct)}
        onTimeOpen={(a, seconds) => trackHub(a, "time", seconds)}
      />
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
    </RoomEditContext.Provider>
  );
}

/* ── Action plan ─────────────────────────────────────────────────────────── */

type PlanRow = { gi: number; ri: number; r: RoomMilestone; action: "check" | "upload" | null; key: string; saved: RoomSnapshot["tasks"][string] | undefined; status: RoomMilestoneStatus };

type PlanEdit = { save: (key: string, patch: Partial<RoomMilestone>) => Promise<string | null>; ours: string[]; theirs: string[] };

/** A small menu of people for an owner: the team's names, whatever is there now, and "nobody". */
function OwnerPick({ value, people, onPick, label }: { value: string | undefined; people: string[]; onPick: (v: string) => void; label: string }) {
  const current = (value ?? "").trim();
  const options = [...new Set([...(current && current !== "—" ? [current] : []), ...people])];
  return (
    <select className="prw-pick" value={current && current !== "—" ? current : ""} onChange={(e) => onPick(e.target.value)} aria-label={label}>
      <option value="">—</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function PlanGroup({ group, rows, snapshot, store, isEditor, onNeedEmail, edit }: { group: RoomPlanGroup; rows: PlanRow[]; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; edit: PlanEdit | null }) {
  // The account team edits one row at a time: the table stays plain text, and a pencil opens that row's fields.
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <tr className="grp">
        <td colSpan={6}>{group.title}</td>
      </tr>
      {rows.map((x) => (
        <Fragment key={x.key || x.ri}>
          <tr data-room-milestone={x.status} className={editing === x.key ? "on" : undefined}>
            <td className="c">{x.r.target}</td>
            <td>
              <div className="t"><E item={x.r} field="task" placeholder="Milestone" /></div>
              {x.saved?.done ? (
                <div className="m" data-room-received>
                  {[x.action === "upload" ? (x.saved.fileName ? `Received ${x.saved.fileName}` : "File received") : "Marked complete", x.saved.by, fmtDate(x.saved.at)].filter(Boolean).join(" · ")}
                </div>
              ) : (
                x.r.note && <div className="m"><E item={x.r} field="note" placeholder="Note" /></div>
              )}
              {x.action === "upload" && isRosterTask(x.key) && <RosterTemplateLink store={store} show={!isEditor && !!snapshot.viewer} />}
            </td>
            <td className="c">{x.r.ourOwner}</td>
            <td className="c">{x.r.partnerOwner}</td>
            <td>
              <span className={`prw-st ${x.status}`}>{ROOM_STATUS_LABEL[x.status]}</span>
            </td>
            <td className="r">
              <span className="prw-rowact">
                {x.action && <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={onNeedEmail} />}
                {edit && (
                  <button type="button" className={`prw-ib${editing === x.key ? " on" : ""}`} title="Edit this milestone" aria-label={`Edit: ${x.r.task}`} aria-expanded={editing === x.key} onClick={() => setEditing((k) => (k === x.key ? null : x.key))} data-room-edit-row>
                    <PencilLine aria-hidden />
                  </button>
                )}
              </span>
            </td>
          </tr>
          {edit && editing === x.key && <PlanRowEditor row={x} edit={edit} onClose={() => setEditing(null)} />}
        </Fragment>
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

/** One milestone's editable fields, in a strip under its row: target date, both owners and status, saved together. */
function PlanRowEditor({ row, edit, onClose }: { row: PlanRow; edit: PlanEdit; onClose: () => void }) {
  const clean = (v: string | undefined) => ((v ?? "").trim() === "—" ? "" : (v ?? "").trim());
  const [target, setTarget] = useState(row.r.target ?? "");
  const [ours, setOurs] = useState(clean(row.r.ourOwner));
  const [theirs, setTheirs] = useState(clean(row.r.partnerOwner));
  // An item the customer ticked reads as done; an overdue one is shown as overdue. The editor starts from the stored status.
  const [status, setStatus] = useState<RoomMilestoneStatus>(row.saved?.done ? "done" : resolveRoomStatus(row.r.status));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    const patch: Partial<RoomMilestone> = {};
    if (target.trim() !== (row.r.target ?? "").trim()) patch.target = target.trim();
    if (ours !== clean(row.r.ourOwner)) patch.ourOwner = ours || "—";
    if (theirs !== clean(row.r.partnerOwner)) patch.partnerOwner = theirs || "—";
    if (status !== (row.saved?.done ? "done" : resolveRoomStatus(row.r.status))) patch.status = status;
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError("");
    const err = await edit.save(row.key, patch);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };
  return (
    <tr className="prw-edit" data-room-row-editor>
      <td colSpan={6}>
        <div className="f">
          <label>
            <span>Target date</span>
            <input className="prw-pick" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Nov 21" />
          </label>
          <label>
            <span>Our owner</span>
            <OwnerPick value={ours} people={edit.ours} onPick={setOurs} label="Our owner" />
          </label>
          <label>
            <span>Their owner</span>
            <OwnerPick value={theirs} people={edit.theirs} onPick={setTheirs} label="Their owner" />
          </label>
          <label>
            <span>Status</span>
            <select className="prw-pick" value={status} onChange={(e) => setStatus(e.target.value as RoomMilestoneStatus)} aria-label="Status" data-room-status-pick>
              {STATUSES.map((st) => <option key={st} value={st}>{ROOM_STATUS_LABEL[st]}</option>)}
            </select>
          </label>
          <span className="b">
            <button type="button" className="prw-btn pri" disabled={busy} onClick={save} data-room-row-save>{busy ? "Saving" : "Save"}</button>
            <button type="button" className="prw-btn" disabled={busy} onClick={onClose}>Cancel</button>
          </span>
        </div>
        {error && <div className="prw-err" role="alert">{error}</div>}
      </td>
    </tr>
  );
}

/** One request's editable fields, in a strip under its row: status, owner and due date, saved together. */
function RequestRowEditor({ request, store, people, onClose }: { request: RoomRequest; store: RoomStoreHandle; people: string[]; onClose: () => void }) {
  const [status, setStatus] = useState(request.status);
  const [owner, setOwner] = useState(request.owner ?? "");
  const [due, setDue] = useState(request.due ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    const patch: { status?: string; owner?: string; due?: string } = {};
    if (status !== request.status) patch.status = status;
    if (owner !== (request.owner ?? "")) patch.owner = owner;
    if (due.trim() !== (request.due ?? "")) patch.due = due.trim();
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    setError("");
    const r = await store.updateRequest(request.id, patch);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error);
  };
  return (
    <tr className="prw-edit" data-room-request-editor>
      <td colSpan={7}>
        <div className="f">
          <label>
            <span>Status</span>
            <select className="prw-pick" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" data-room-request-status>
              {Object.entries(ROOM_REQUEST_STATUS_LABEL).map(([k, label]) => <option key={k} value={k}>{k === "review" ? "Ready for their review" : label}</option>)}
            </select>
          </label>
          <label>
            <span>Owner</span>
            <OwnerPick value={owner} people={people} onPick={setOwner} label="Owner" />
          </label>
          <label>
            <span>Due</span>
            <input className="prw-pick" value={due} onChange={(e) => setDue(e.target.value)} placeholder="Nov 21" aria-label="Due" />
          </label>
          <span className="b">
            <button type="button" className="prw-btn pri" disabled={busy} onClick={save} data-room-request-save>{busy ? "Saving" : "Save"}</button>
            <button type="button" className="prw-btn" disabled={busy} onClick={onClose}>Cancel</button>
          </span>
        </div>
        {error && <div className="prw-err" role="alert">{error}</div>}
      </td>
    </tr>
  );
}

/**
 * "Download the template", shown with the description of a roster upload (the
 * practice list, the doctor roster): a spreadsheet with the customer's
 * practices already filled in, to complete and upload.
 */
function RosterTemplateLink({ store, show }: { store: RoomStoreHandle | null; show: boolean }) {
  const [error, setError] = useState("");
  if (!show || !store) return null;
  return (
    <div className="prw-tplrow">
      <button
        type="button"
        className="prw-tpl"
        data-room-roster-template
        onClick={async () => {
          setError("");
          const t = await store.rosterTemplate();
          if (!t) return setError("Couldn't make the template. Please try again.");
          const url = URL.createObjectURL(new Blob([t.csv], { type: "text/csv;charset=utf-8" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = t.fileName;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Download aria-hidden /> Download the template
      </button>
      <span>your practices are already filled in</span>
      {error && <span className="prw-err" role="alert">{error}</span>}
    </div>
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
    <span className="prw-act">
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
    </span>
  );
}

/** The upload tasks that take a roster (the practice list, the doctor roster): they offer the template. */
export const isRosterTask = (key: string) => /roster|practice-list|doctor/.test(key);

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

function AssetRow({ asset, isEditor, onTrack, onOpen, onRequest, canRequest }: { asset: RoomAsset; isEditor: boolean; onTrack: (a: RoomAsset, action: "view" | "download" | "open") => void; onOpen: (a: RoomAsset) => boolean; onRequest: () => void; canRequest: boolean }) {
  const [open, setOpen] = useState(false);
  const file = (asset.fileUrl ?? "").trim();
  const ext = (asset.externalUrl ?? "").trim();
  const body = (asset.body ?? "").trim();
  const viewHref = resolveAssetHref(roomAssetToHub(asset));
  return (
    <>
      <div className="prw-doc" data-room-asset={asset.kind}>
        {asset.kind === "image" && file ? (
          <span className="prw-ft img"><img src={file} alt="" loading="lazy" /></span>
        ) : (
          (() => {
            const key = roomAssetIconKey(asset);
            const Icon = ROOM_ASSET_ICONS.find((i) => i.key === key)?.Icon;
            return Icon ? <span className="prw-ft ic" data-room-asset-icon={key}><Icon aria-hidden /></span> : <span className="prw-ft">{FILE_TAG[asset.kind] ?? "FILE"}</span>;
          })()
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}><E item={asset} field="title" placeholder="Asset name" /></div>
          {(asset.description || isEditor) && <div style={{ fontSize: 12, color: "var(--body)" }}><E item={asset} field="description" placeholder="One line about it" /></div>}
        </div>
        <div className="a">
          {asset.kind === "text" && body ? (
            <button type="button" className="prw-ib" title={open ? "Hide" : "View"} aria-label={`${open ? "Hide" : "View"} ${asset.title}`} onClick={() => { setOpen((v) => !v); if (!open) onTrack(asset, "view"); }}>
              {open ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </button>
          ) : (
            viewHref && (
              <a
                className="prw-ib"
                title={asset.kind === "video" ? "Play" : "View"}
                aria-label={`${asset.kind === "video" ? "Play" : "View"} ${asset.title}`}
                href={isEditor ? undefined : viewHref}
                target="_blank"
                rel="noreferrer"
                data-room-open
                onClick={(e) => {
                  // The viewer takes PDFs, images and videos; anything else follows the link in a new tab.
                  if (onOpen(asset)) e.preventDefault();
                }}
              >
                {asset.kind === "video" ? <Play aria-hidden /> : <Eye aria-hidden />}
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

function RequestsTable({ snapshot, isEditor, onSignIn, store, customerStore, people }: { snapshot: RoomSnapshot; isEditor: boolean; onSignIn: () => void; /** Set for the account team on the live page: they can move a request along. */ store: RoomStoreHandle | null; /** Set for a known customer: they can approve a request that is ready. */ customerStore: RoomStoreHandle | null; people: string[] }) {
  // The account team edits one request at a time: the table stays plain text, and a pencil opens that row's fields.
  const [editing, setEditing] = useState<number | null>(null);
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
              {store && <th style={{ width: 64 }} />}
            </tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <Fragment key={q.id}>
                <tr data-room-request={q.status} className={editing === q.id ? "on" : undefined}>
                  <td><div className="t">{q.subject}</div></td>
                  <td className="c">{ROOM_REQUEST_KIND_LABEL[q.kind] ?? "Other"}</td>
                  <td className="c">{q.by}</td>
                  <td className="c">{fmtDate(q.createdAt)}</td>
                  <td className="c">{q.owner || "Being assigned"}</td>
                  <td>
                    <span className={`prw-chip ${q.status}`}>
                      {(store && q.status === "review" ? "Ready for their review" : ROOM_REQUEST_STATUS_LABEL[q.status]) ?? q.status}
                      {q.due && q.status !== "done" ? ` · due ${q.due}` : ""}
                    </span>
                    {q.status === "review" && customerStore && (
                      <button type="button" className="prw-btn pri" style={{ marginTop: 6 }} onClick={() => void customerStore.updateRequest(q.id, { status: "done" })} data-room-request-approve><Check aria-hidden /> Approve</button>
                    )}
                  </td>
                  {store && (
                    <td className="r">
                      <button type="button" className={`prw-ib${editing === q.id ? " on" : ""}`} title="Edit this request" aria-label={`Edit: ${q.subject}`} aria-expanded={editing === q.id} onClick={() => setEditing((k) => (k === q.id ? null : q.id))} data-room-edit-request>
                        <PencilLine aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
                {store && editing === q.id && <RequestRowEditor request={q} store={store} people={people} onClose={() => setEditing(null)} />}
              </Fragment>
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
                  <div className="t"><E item={m} field="name" placeholder="Name" /></div>
                  {(m.role || isEditor) && <div className="m"><E item={m} field="role" placeholder="Role" /></div>}
                </div>
              </div>
            </td>
            <td className="c" style={{ whiteSpace: "normal" }}>{m.owns}</td>
            <td className="c">{m.when}</td>
            <td className="r">
              {safeHttpUrl(m.bookingUrl) && (
                <a className="prw-ib" title={`Book time with ${m.name}`} aria-label={`Book time with ${m.name}`} href={isEditor ? undefined : safeHttpUrl(m.bookingUrl)} target="_blank" rel="noopener noreferrer" data-room-member-book>
                  <CalendarPlus aria-hidden />
                </a>
              )}
              {email && (
                <a className="prw-ib" title={`Email ${m.name}`} aria-label={`Email ${m.name}`} href={isEditor ? undefined : `mailto:${email}`}>
                  <Mail aria-hidden />
                </a>
              )}
              {(m.phone ?? "").replace(/[^\d+]/g, "").length >= 7 && (
                <a className="prw-ib" title={`Call ${m.name}: ${m.phone}`} aria-label={`Call ${m.name}`} href={isEditor ? undefined : `tel:${(m.phone ?? "").replace(/[^\d+]/g, "")}`} data-room-member-call>
                  <Phone aria-hidden />
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
  const no = options.find(isDeclineOption);
  const yes = options.filter((o) => o !== no);
  const declined = !!chosen && !!no && chosen.value === no;
  return (
    <div className={`prw-prog${declined ? " off" : ""}`} data-room-program={options.length >= 2 ? (declined ? "declined" : chosen ? "chosen" : "open") : "fixed"}>
      {image ? <img className="im" src={image} alt="" loading="lazy" /> : <span className="im" aria-hidden />}
      <div>
        <h3><E item={program} field="title" placeholder="Program" /></h3>
        {(program.description || isEditor) && <p><E item={program} field="description" multiline placeholder="What it is" /></p>}
      </div>
      <div className="who">{program.audience}</div>
      <div className="when">{program.when && <b>{program.when}</b>}</div>
      <div className="dec">
        {options.length >= 2 ? (
          <>
            {!chosen && <span className="need">Your decision</span>}
            <span className="prw-thumbs" role="group" aria-label={program.title}>
              {/* Several ways to say yes (Dinner / Onsite training) stay as named choices; one way is a thumbs-up. */}
              {no && yes.length === 1 ? (
                <button type="button" className={`prw-thumb up${chosen?.value === yes[0] ? " on" : ""}`} aria-pressed={chosen?.value === yes[0]} aria-label={`${yes[0]}: ${program.title}`} title={yes[0]} disabled={!!busy} onClick={() => void pick(yes[0])} data-room-thumb="up">
                  {busy === yes[0] ? <Loader2 className="animate-spin" aria-hidden /> : <ThumbsUp aria-hidden />}
                </button>
              ) : (
                <span className="prw-seg">
                  {yes.map((o) => (
                    <button key={o} type="button" className={chosen?.value === o ? "on" : ""} aria-pressed={chosen?.value === o} disabled={!!busy} onClick={() => void pick(o)}>
                      {busy === o ? "Saving" : o}
                    </button>
                  ))}
                </span>
              )}
              {no && (
                <button type="button" className={`prw-thumb down${declined ? " on" : ""}`} aria-pressed={declined} aria-label={`${no}: ${program.title}`} title={no} disabled={!!busy} onClick={() => void pick(no)} data-room-thumb="down">
                  {busy === no ? <Loader2 className="animate-spin" aria-hidden /> : <ThumbsDown aria-hidden />}
                </button>
              )}
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
        <div className="t">{event.startsAt ? event.title : <E item={event} field="title" placeholder="Event" />}</div>
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
          {meeting.summary && <div className="sum"><E item={meeting} field="summary" multiline placeholder="Summary" /></div>}
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
