import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, Check, Play, ThumbsDown, ThumbsUp, ChevronDown, Copy, Download, FileText, Video, ExternalLink, Eye, EyeOff, Loader2, LogIn, Mail, PencilLine, Plus, Upload, UserPlus, X, BookOpen, ClipboardList, Image as ImageIcon, Link2, Megaphone, Palette, Phone, Presentation, Quote, Share2, type LucideIcon } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { ROOM_LOOK_CSS, roomLook, roomLookClass } from "./hub/room-look";
import { useBuilderPageId, usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { buildAssetEventPayload, isHostedFileUrl, isPdfUrl, isTrackingSuppressed, opensInViewer, resolveAssetHref, type HubAsset, type HubAssetAction } from "./hub/hub-assets";
import { HubAssetViewer, shouldOpenInline } from "./hub/HubAssetViewer";
import { WinsView } from "./hub/RoomFeed";
import { OrdersAtAGlance, ScorecardView, type ScorecardGoal } from "./hub/RoomScorecard";
import { PartnershipTimeline, timelineWaves } from "./hub/RoomTimeline";
import { OutstandingView, ownerSide, roomMeetingActionKey, type OutstandingItem } from "./hub/RoomOutstanding";
import { resolveHubPalette } from "@/lib/hub-theme";
import { getAutoplayEmbedUrl, isNativeVideoUrl } from "@/lib/video-utils";
import { ROOM_UPLOAD_ACCEPT, useRoom, type RoomRequest, type RoomSnapshot, type RoomStoreHandle, type RoomPractice, type RoomPracticePage, type RoomPracticeSort, type RoomSyncedEvent, type RoomSyncedMinutes, type RoomWin } from "./hub/room-client";

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

/** The parts of the Overview a rep can show or hide for a hub. Mirrors the server's ROOM_OVERVIEW_SECTIONS. */
export type RoomOverviewSection = "progress" | "next" | "coming" | "overdue" | "orders" | "feed";
export const ROOM_OVERVIEW_SECTIONS: { key: RoomOverviewSection; label: string; hint: string }[] = [
  { key: "progress", label: "Progress", hint: "The timeline at the top" },
  { key: "next", label: "Your next steps", hint: "What is waiting on the customer" },
  { key: "coming", label: "Coming up", hint: "The next meetings" },
  { key: "overdue", label: "Overdue", hint: "Action plan items past their date" },
  { key: "orders", label: "Orders at a glance", hint: "Your team only, after the rollout" },
  { key: "feed", label: "News Feed highlight", hint: "The latest win" },
];

export type RoomModuleKey = "overview" | "wins" | "goals" | "plan" | "practices" | "marketing" | "kit" | "calendar" | "meetings" | "requests" | "team";
export const ROOM_MODULES: { key: RoomModuleKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "practices", label: "Scorecard" },
  { key: "goals", label: "Goals" },
  { key: "plan", label: "Action plan" },
  { key: "marketing", label: "Marketing plan" },
  { key: "kit", label: "Launch kit" },
  { key: "calendar", label: "Calendar" },
  { key: "meetings", label: "Meetings" },
  { key: "requests", label: "Outstanding" },
  { key: "team", label: "Our Team" },
  // The News Feed closes the list: it is where people come back to, not a step in the rollout.
  { key: "wins", label: "News Feed" },
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
  /** What a generated launch asset was made from (names, logos, sizes), so it is made again when those change. Blank for an uploaded file. */
  madeFrom?: string;
  /** Kind "video": a video file, or a YouTube / Vimeo / Wistia / Loom link. Plays in the page. */
  videoUrl?: string;
  externalUrl?: string;
  /** The copy itself (kind "text"). */
  body?: string;
  /** Which icon sits beside it. Blank = chosen from what the item is; "tag" = the small file-type tag (PDF, TXT). */
  icon?: string;
  hidden?: boolean;
  /** Our own brand material (logos, guidelines, the approved description): shown together at the foot of the launch tab. */
  collateral?: boolean;
}

/** Our own brand material: marked so, or one of the kit's standard brand items. */
const BRAND_COLLATERAL_KEYS = new Set(["dandy-description", "dandy-logos", "dandy-brand-guidelines", "brand-description", "brand-logos", "brand-guidelines"]);
export function isBrandCollateral(a: RoomAsset): boolean {
  return !!a.collateral || BRAND_COLLATERAL_KEYS.has(a.key ?? "");
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
  /** Set on a practice's training day from the practice list: the practice. Several on one day are shown as one row. */
  practice?: string;
  /** Set on that one row: every practice training that day. */
  practices?: string[];
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
  /** More about the program, shown when its row is opened: what it involves, what the customer needs to do. */
  details?: string;
  /** Where to read or see more (a guide, an example, a video). */
  links?: { label: string; url: string }[];
  hidden?: boolean;
}
/**
 * Programs the customer always decides on, even on a hub saved before they
 * carried choices: the partnership announcement and the welcome kits used to
 * be fixed ("in plan") on every hub. Mirrors the server's ROOM_PROGRAM_DEFAULT_OPTIONS.
 */
export const ROOM_PROGRAM_DEFAULT_OPTIONS: Record<string, string[]> = {
  "mk-announcement": ["Include", "Not now"],
  "mk-welcome-kits": ["Include", "Not now"],
};
/** A program's choices: its own, or the standing ones for the two programs above when it has none. */
export function roomProgramOptions(p: { key?: string; options?: string[] }): string[] {
  const own = (p.options ?? []).filter((o) => typeof o === "string" && o.trim());
  return own.length >= 2 ? own : (ROOM_PROGRAM_DEFAULT_OPTIONS[(p.key ?? "").trim()] ?? own);
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
  /** Show the customer's logo in its own colours. By default it is recoloured to suit the cover (white on a dark cover), so any logo reads cleanly without a separate white version. */
  partnerLogoOriginal?: boolean;
  /** Ask for a work email before showing anything under the cover. The server then sends a stranger the cover only. */
  requireEmail?: boolean;
  /** Show the Scorecard's map to anyone who opens the hub. Off = the map is for the team's own view only (it shows which offices are not ordering). */
  shareMap?: boolean;
  /** The photo beside the News Feed highlight on the Overview. Unset = the standard lab photo. */
  feedPhotoUrl?: string;
  /** Which look the hub wears. Unset = "classic". */
  look?: "classic" | "polished";
  /** Set by the server on what it sends a stranger to a hub that asks for an email: this is the cover, the rest is withheld. */
  gated?: boolean;
  /** "Schedule" in the top bar: where it books (a rep's booking page). Blank = no button. */
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
  /** Cover look. Nothing chosen = "fade" (the photo runs off the right edge and fades into the cover). */
  coverStyle?: "split" | "fullbleed" | "light" | "fade";
  /** Fading-photo cover: the photo normally stays put while the page scrolls over it. On = it scrolls with the page. */
  coverPhotoScrolls?: boolean;
  /** The cover headline. Blank = "{{account}} × Us Partnership Hub". `{{account}}` is the customer's name. */
  headline?: string;
  /** Kickoff date, YYYY-MM-DD. Drives "Day N of 90" and each phase's state. */
  kickoffDate?: string;
  rolloutDays?: number;
  /** INTERNAL: where the hub is in the partnership. "expansion" = past the rollout. The customer's hub never names a stage. A team member sets it; blank = rollout. */
  stage?: "rollout" | "expansion";
  /** The day the hub moved past its rollout (YYYY-MM-DD). Set with the stage. */
  stageSince?: string;
  /** Past the rollout: the hub's waves, in order. `key` is what the practice list calls the wave. */
  waves?: { key: string; name: string; start?: string; target?: string }[];
  /** Past the rollout: which timeline the Overview opens on. */
  timelineView?: "waves" | "practices";
  nextMilestoneLabel?: string;
  nextMilestoneDate?: string;
  hiddenModules?: RoomModuleKey[];
  /** Parts of the Overview a rep switched off for this hub. Empty = all shown. */
  hiddenOverview?: RoomOverviewSection[];
  /** The order of the modules in the side menu. Empty = the standard order. The first one shown is the view the hub opens on. */
  moduleOrder?: RoomModuleKey[];
  phases?: RoomPhase[];
  planIntro?: string;
  planGroups?: RoomPlanGroup[];
  kitIntro?: string;
  assets?: RoomAsset[];
  /** Important links. One with a `fileUrl` is an uploaded file (PDF or image) and opens in the viewer. */
  links?: { key?: string; title: string; description?: string; url: string; hidden?: boolean; fileUrl?: string; kind?: "pdf" | "image"; /** The name its opens are counted under, kept when a rep renames it. */ viewKey?: string }[];
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
          { key: "mk-announcement", title: "Partnership announcement", description: "Email, social posts and a one-pager for your network.", audience: "Leadership, locations", when: "Week 1", options: ["Include", "Not now"] },
          { key: "mk-welcome-kits", title: "Welcome kits to every location", description: "Shipped to each location on your list.", audience: "Locations", when: "Week 2", options: ["Include", "Not now"] },
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
/** An Important link as the asset the viewer and the view counts know it by. The key comes from its name, as it always has. */
export function roomLinkAsset(l: { title: string; url: string; fileUrl?: string; kind?: "pdf" | "image"; viewKey?: string }): RoomAsset {
  // A renamed link keeps the key it had, so its opens carry over.
  const key = (l.viewKey ?? "").trim() || roomMilestoneKey({ task: l.title });
  const file = (l.fileUrl ?? "").trim();
  return file ? { key, kind: l.kind === "image" ? "image" : "pdf", title: l.title, fileUrl: file } : { key, kind: "link", title: l.title, externalUrl: l.url };
}

/**
 * Plan steps that are done by handing over a file, even on a hub saved when
 * they were only a tick: "Share your brand guidelines" had no way to share
 * anything. Mirrors the server's ROOM_UPLOAD_STEP_KEYS.
 */
export const ROOM_UPLOAD_STEP_KEYS: Record<string, string> = { "brand-guidelines": "Upload brand guidelines" };
/** Plan steps that also take the customer's logo, as a second upload beside the step's own. */
export const ROOM_LOGO_STEP_KEYS = new Set(["brand-guidelines"]);
/** What a logo upload is filed under (the server maps it to the Overview's logo step where the hub has one). Mirrors the server. */
export const ROOM_LOGO_TASK_KEY = "customer-logo";
export const ROOM_LOGO_ACCEPT = ".png,.jpg,.jpeg";
/** Whether the customer has uploaded a logo, from either place it can be done. */
export function roomLogoUploaded(tasks: Record<string, { done: boolean } | undefined>): boolean {
  return !!tasks["onboard-logo"]?.done || !!tasks[ROOM_LOGO_TASK_KEY]?.done;
}
/** What the customer does to complete a plan step: tick it, upload a file, or nothing (it is ours). */
export function roomRowAction(row: { key?: string; task?: string; customerAction?: string }): "check" | "upload" | null {
  if (row.customerAction !== "check" && row.customerAction !== "upload") return null;
  return ROOM_UPLOAD_STEP_KEYS[roomMilestoneKey(row)] ? "upload" : row.customerAction;
}
/** Plan steps that are really done somewhere else in the hub: the step gets a button that goes there. */
export const ROOM_STEP_SHORTCUTS: Record<string, { module: RoomModuleKey; label: string; hint: string }> = {
  "internal-announcement": { module: "marketing", label: "Get the copy", hint: "The announcement email and social posts are in the marketing section" },
  "welcome-event": { module: "marketing", label: "Choose", hint: "Pick your welcome event in the marketing plan" },
};

/**
 * What the launch material is called. During the rollout it is the launch
 * (the "Launch kit", "Launch & marketing"); once a hub has moved past its
 * rollout there is no launch left, so it is plainly "Marketing".
 */
export function roomMarketingNames(stage: string | undefined): { module: string; kit: string; ready: string } {
  return stage === "expansion" ? { module: "Marketing", kit: "Marketing", ready: "Ready to use" } : { module: "Launch & marketing", kit: "Launch kit", ready: "Ready for launch" };
}

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

/** A real person's name, not one of the template's "[Name]" placeholders. */
const realTeamName = (n: string | undefined) => !!n?.trim() && !/^\[.*\]$/.test(n.trim());

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

/**
 * The modules in the order this hub shows them: the ones named in `order`
 * first, in that order, then any it does not name in the standard order (so
 * a module added later still appears on a hub ordered before it existed).
 */
/** How many things the Overview asks of the customer at once. The nav badges carry the full counts. */
export const ROOM_NEXT_UP = 3;

export function orderedModules(order: readonly string[] | undefined): typeof ROOM_MODULES {
  const named = [...new Set(order ?? [])].map((k) => ROOM_MODULES.find((m) => m.key === k)).filter((m): m is (typeof ROOM_MODULES)[number] => !!m);
  return [...named, ...ROOM_MODULES.filter((m) => !named.includes(m))];
}

export function visibleModules(hidden: readonly string[] | undefined, order?: readonly string[]): typeof ROOM_MODULES {
  const all = orderedModules(order);
  const h = new Set(hidden ?? []);
  // Overview is the landing view: it can be hidden only when something else remains.
  // The launch kit lives inside the marketing module: one entry, shown while either has not been hidden.
  // Same for meeting notes, which live inside Calendar.
  const pair: Partial<Record<RoomModuleKey, RoomModuleKey>> = { marketing: "kit", calendar: "meetings" };
  const inside = new Set<RoomModuleKey>(["kit", "meetings"]);
  const rest = all.filter((m) => (inside.has(m.key) ? false : pair[m.key] ? !(h.has(m.key) && h.has(pair[m.key]!)) : !h.has(m.key)));
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
const ROOM_EVENT_KIND_PLURAL: Record<RoomEventKind, string> = { meeting: "Meetings", training: "Trainings", marketing: "Marketing", milestone: "Milestones" };

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
  const training = e.kind === "training";
  return { key: `sync-${e.id}`, date: localDay(e.startsAt, e.allDay), time, title: e.title, kind: training ? "training" : "meeting", ...(training ? { practice: e.title.replace(/^Training:\s*/, "") } : {}), ...(e.allDay ? {} : { startsAt: e.startsAt, endsAt: e.endsAt }) };
}

/**
 * Practice trainings from the practice list, one row per day: a day with
 * several becomes "6 trainings" carrying the practices' names, so a large
 * rollout doesn't bury the meetings. A day with one keeps its own row.
 * Everything else passes through untouched.
 */
export function groupTrainings(events: RoomEvent[]): RoomEvent[] {
  const byDay = new Map<string, RoomEvent[]>();
  for (const e of events) if (e.practice) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const done = new Set<string>();
  const out: RoomEvent[] = [];
  for (const e of events) {
    const same = e.practice ? byDay.get(e.date)! : null;
    if (!same || same.length < 2) {
      out.push(e);
      continue;
    }
    if (done.has(e.date)) continue;
    done.add(e.date);
    out.push({ key: `trainings-${e.date}`, date: e.date, title: `${same.length} trainings`, kind: "training", practices: same.map((t) => t.practice!).sort((a, b) => a.localeCompare(b)) });
  }
  return out;
}

/** The kinds of event a calendar holds, in a fixed order, for its filter. */
export function eventKinds(events: RoomEvent[]): RoomEventKind[] {
  const have = new Set(events.filter((e) => !e.hidden).map((e) => e.kind));
  return (["meeting", "training", "marketing", "milestone"] as const).filter((k) => have.has(k));
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
/**
 * Where a program the customer said yes to has got to, as they should read
 * it. It is "with your account team" until a rep sends it to marketing; after
 * that it follows the request it was sent in. A choice changed after sending
 * is with the account team again. Requests carry the programs they cover in
 * `assetKey` ("mk-plan:<key>,<key>").
 */
export interface RoomProgramStatus {
  state: "team" | "new" | "in_progress" | "review" | "done";
  label: string;
  /** The same thing as a sentence, for a list that has room for one. */
  line: string;
  owner?: string | null;
  due?: string | null;
}
export function roomProgramStatus(key: string, chosen: { value: string; at: string } | undefined, requests: { assetKey: string | null; status: string; owner: string | null; due: string | null; createdAt: string }[]): RoomProgramStatus | null {
  if (!chosen || isDeclineOption(chosen.value)) return null;
  const sent = requests
    .filter((r) => (r.assetKey ?? "").startsWith("mk-plan:") && (r.assetKey as string).slice(8).split(",").includes(key))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!sent || chosen.at > sent.createdAt) return { state: "team", label: "With your account team", line: sent ? "You changed this after it went to marketing. Your account team is passing the change on." : "Your account team is passing this to marketing." };
  const who = { owner: sent.owner, due: sent.due };
  if (sent.status === "done") return { state: "done", label: "Done", line: "Marketing has finished this.", ...who };
  if (sent.status === "review") return { state: "review", label: "Ready for your review", line: "Marketing has something for you to look at.", ...who };
  if (sent.status === "in_progress") return { state: "in_progress", label: "In progress", line: "Marketing is working on this.", ...who };
  return { state: "new", label: "With marketing", line: "Marketing has this and will pick it up.", ...who };
}

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

/** Does a launch-kit item have its content yet (a file, a video, the copy itself)? One without is still being prepared. */
export function assetReady(a: RoomAsset): boolean {
  const has = (v: string | undefined) => !!(v ?? "").trim();
  if (a.kind === "text") return has(a.body);
  if (a.kind === "video") return has(a.videoUrl) || has(a.fileUrl);
  if (a.kind === "link") return has(a.externalUrl);
  return has(a.fileUrl);
}

/** Kit items in their own order, with the ones that only point elsewhere (a folder, a guidelines page) moved to the end. */
const linksLast = (assets: RoomAsset[]) => [...assets.filter((a) => a.kind !== "link"), ...assets.filter((a) => a.kind === "link")];

/**
 * The launch kit and the marketing programs sorted into the sections of the
 * combined module: programs waiting on a yes or no; assets that are
 * ready to use (files and copy first, links to brand folders and the like last); programs that are in the plan (fixed, or said yes to) and
 * assets still being prepared; programs said no to, saved for later.
 */
export function groupLaunch(assets: RoomAsset[], programs: RoomProgram[], choices: Record<string, { value: string }>) {
  const choice = (p: RoomProgram) => choices[roomMilestoneKey({ key: p.key, task: p.title })];
  const hasChoice = (p: RoomProgram) => roomProgramOptions(p).length >= 2;
  // Our own brand material sits in its own group at the foot of the tab. One with nothing to open (a logo folder with no link yet) is left out of the customer's view altogether rather than listed as "in progress".
  const own = assets.filter(isBrandCollateral);
  const theirs = assets.filter((a) => !isBrandCollateral(a));
  return {
    ready: linksLast(theirs.filter(assetReady)),
    preparing: linksLast(theirs.filter((a) => !assetReady(a))),
    collateral: linksLast(own.filter(assetReady)),
    collateralEmpty: own.filter((a) => !assetReady(a)),
    toDecide: programs.filter((p) => hasChoice(p) && !choice(p)),
    inProgress: programs.filter((p) => !hasChoice(p) || (!!choice(p) && !programDeclined(p, choices))),
    later: programs.filter((p) => hasChoice(p) && programDeclined(p, choices)),
  };
}

export const ROOM_GOALS_AGREED_KEY = "goals-agreed";

/** The one line under the hub: "Signature Dental Partners × Dandy Partner Hub". */
export function roomFooterLine(partnerName: string | undefined, brandName: string | undefined): string {
  return `${[(partnerName ?? "").trim(), (brandName ?? "").trim()].filter(Boolean).join(" × ")} Partner Hub`.trim();
}
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

/** "Oct 2026" from a kickoff date, for the cover once the rollout is over. Blank without a valid date. */
export function partnerSince(kickoffDate: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((kickoffDate ?? "").trim());
  const month = m ? MONTHS[+m[2] - 1] : undefined;
  return m && month ? `${month} ${m[1]}` : "";
}

/** Share of practices live, as a whole percent. */
export function liveShare(live: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((live / total) * 100))) : 0;
}

/** The line under "Partnership progress": how far along the account is, in plain words. */
export function progressLine(live: number, total: number, noun: string): string {
  const left = Math.max(0, total - live);
  if (total <= 0) return "";
  if (left === 0) return `All ${total} ${noun} are live.`;
  return `${live} of ${total} ${noun} are live, with ${left} still to launch.`;
}

/** What the Overview quotes from the newest post: its headline, else its words, cut at a word. "" when there is nothing to quote. */
export function feedHighlightText(win: { headline?: string | null; body?: string | null } | undefined, max = 150): string {
  const text = ((win?.headline ?? "").trim() || (win?.body ?? "").trim()).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s.,;:!?]+$/, "")}…`;
}

/** The photo beside the News Feed highlight when the hub sets none. */
export const ROOM_FEED_PHOTO = "/room/default-feed.jpg";

/** The newest News Feed post, shown on the Overview. Opens the feed. Its photo is the post's own, else the hub's News Feed photo. */
function FeedHighlight({ wins, photo, onOpen }: { wins: RoomWin[]; photo: string; onOpen: () => void }) {
  const win = wins[0];
  const text = feedHighlightText(win);
  if (!win || !text) return null;
  const image = (win.images ?? [])[0] || photo;
  return (
    <button type="button" className={`prw-hl prw-sec${image ? "" : " solo"}`} onClick={onOpen} data-room-feed-highlight>
      <span className="t">
        <span className="prw-eyebrow">From the News Feed</span>
        <span className="q" style={{ fontFamily: BRAND_DISPLAY_STACK }}>{text}</span>
        <span className="by">{[win.by, fmtDate(win.createdAt)].filter(Boolean).join(" · ")}</span>
      </span>
      {image && <span className="im" style={{ backgroundImage: `url(${JSON.stringify(image).slice(1, -1)})` }} aria-hidden />}
    </button>
  );
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
.prw-prog .hd{gap:10px;padding:14px 16px}
.prw-prog .more{padding:2px 16px 16px}
.prw-prog .im{width:44px;height:44px}`;
const MAP_STACK_RULES = `.prw-tl-waves{grid-template-columns:1fr 1fr}
.prw-map{grid-template-columns:minmax(0,1fr)}
.prw-map-side{border-left:0;border-top:1px solid var(--line)}
.prw-sc-hd{flex-direction:column;align-items:flex-start;gap:10px}`;
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
.prw-cover.fd .prw-fade{position:absolute;top:0;right:0;bottom:0;width:54%;background-size:cover;background-position:center;background-repeat:no-repeat;-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.5) 34%,#000 68%);mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.5) 34%,#000 68%)}
.prw-cover.fd.fx .prw-fade{background-attachment:fixed;background-position:right top;background-size:max(56vw,820px) auto}
.prw-cover.fd .prw-fade::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--dark) 62%,transparent) 0%,transparent 30%,transparent 62%,color-mix(in srgb,var(--dark) 70%,transparent) 100%)}
.prw-cover.fd .prw-wrap{position:relative}
.prw-cover.fd .prw-hero{grid-template-columns:minmax(0,600px);padding:52px 0 132px}
.prw-cover.fd h1{font-size:48px}
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
.prw-hero{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:56px;align-items:center;padding:26px 0 100px}
.prw-hero.solo{grid-template-columns:minmax(0,1fr)}
.prw-cover .prw-eyebrow{color:var(--accent)}
.prw-cover h1{font-size:42px;line-height:1.08;letter-spacing:-.03em;font-weight:700;margin:14px 0 12px}
.prw-cover p.lede{opacity:.76;max-width:52ch;font-size:15px;margin:0}
.prw-stats{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);margin-top:28px;border-top:1px solid color-mix(in srgb,var(--on-dark) 18%,transparent)}
.prw-stats>div{padding:16px 16px 0 0;min-width:0}
.prw-stats>div+div{padding-left:20px;border-left:1px solid color-mix(in srgb,var(--on-dark) 18%,transparent)}
.prw-stats b{display:block;font-size:28px;font-weight:700;letter-spacing:-.025em;line-height:1.1;white-space:nowrap}
.prw-stats b i{font-style:normal;font-size:15px;font-weight:500;letter-spacing:0;opacity:.55;margin-left:3px}
.prw-stats span{display:block;font-size:12px;opacity:.68;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prw-photo{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:16/10.5;box-shadow:0 30px 60px -30px rgba(0,0,0,.6)}
.prw-photo img{width:100%;height:100%;object-fit:cover;display:block}
.prw-photo .cap{position:absolute;left:14px;bottom:14px;background:color-mix(in srgb,var(--dark) 84%,transparent);backdrop-filter:blur(6px);color:var(--on-dark);border-radius:9px;padding:9px 12px;font-size:12px;display:flex;gap:10px;align-items:center}
.prw-photo .cap b{color:var(--accent);font-size:16px}
.prw-sheet{margin-top:-64px;position:relative;display:grid;grid-template-columns:236px minmax(0,1fr);background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 60px -32px rgba(0,0,0,.35);min-height:520px}
.prw-toc{padding:44px 20px 44px 20px;border-right:1px solid var(--line)}
.prw-toc .h{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:0 0 14px 12px}
.prw-toc button{display:flex;gap:10px;align-items:center;width:100%;padding:9px 12px;margin-bottom:2px;border-radius:8px;font-size:13.5px;line-height:1.3;color:var(--body);font-weight:500;background:none;border:0;text-align:left;outline:0}
.prw-toc button:hover{background:color-mix(in srgb,var(--dark) 4%,transparent)}
.prw-toc button:focus-visible{box-shadow:0 0 0 2px color-mix(in srgb,var(--dark) 35%,transparent)}
.prw-toc button .n{color:var(--faint);width:16px}
.prw-toc button em{margin-left:auto;font-style:normal;font-size:11.5px;font-weight:600;color:var(--body);white-space:nowrap}
.prw-toc button.on{color:var(--dark);font-weight:600;background:color-mix(in srgb,var(--dark) 6%,transparent)}
.prw-toc button.on .n{color:var(--green)}
.prw-toc .who{margin:24px 12px 0;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--body)}
.prw-toc .who b{display:block;color:var(--ink);font-size:12.5px;word-break:break-word}
.prw-mod{padding:48px 56px 64px;min-width:0}
.prw-sec{margin-top:32px}
.prw-hd{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-bottom:32px}
.prw-hd h2{font-size:32px;line-height:1.12;letter-spacing:-.025em;font-weight:600;color:var(--dark);margin:0}
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
.prw-prog{padding:0;border-top:1px solid var(--line)}
.prw-prog .hd{display:flex;gap:14px;align-items:center;padding:14px 20px}
.prw-prog.open{background:#FCFCFA}
.prw .prw-more{display:inline-grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:none;color:#9AA69E;padding:0;flex:none}
.prw .prw-more:hover{background:#F1F2EE;color:var(--dark)}
.prw-more svg{width:16px;height:16px;transition:transform .15s}
.prw-prog.open .prw-more svg{transform:rotate(180deg)}
.prw .prw-tick{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;border:1.5px solid #BFC5B9;background:#fff;color:#A3AB9C;padding:0;flex:none;transition:background .12s,color .12s,border-color .12s}
.prw .prw-tick svg{width:17px;height:17px}
.prw .prw-tick:not(:disabled):hover{border-color:#16A34A;color:#16A34A}
.prw .prw-tick.on{background:#16A34A;border-color:#16A34A;color:#fff}
.prw .prw-tick.on:not(:disabled):hover{background:#12813B;border-color:#12813B;color:#fff}
.prw .prw-tick:disabled{cursor:default}
.prw-prog .more{padding:2px 20px 18px;margin-left:0;font-size:13px;color:var(--ink)}
.prw-prog .more p{margin:0 0 10px;max-width:70ch;color:var(--ink)}
.prw-prog .more p.hint{color:var(--faint)}
.prw-prog .more dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0 0 12px;font-size:12.5px}
.prw-prog .more dt{color:var(--body)}
.prw-prog .more dd{margin:0;color:var(--ink)}
.prw-prog .more .links{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:12px}
.prw-prog .more .links a{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:var(--dark);text-decoration:underline;text-underline-offset:2px}
.prw-prog .more .links svg{width:12px;height:12px}
.prw-prog .more .opts{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;font-size:12.5px;color:var(--body)}
.prw-prog .more .acts{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.prw .prw-linkbtn{border:0;background:none;padding:0;font-size:12.5px;color:var(--body);text-decoration:underline;text-underline-offset:2px}
.prw .prw-linkbtn:hover{color:var(--dark)}
.prw-prog .im{width:56px;height:56px;border-radius:10px;object-fit:cover;display:block;flex:none}
.prw-prog .im.ph{display:grid;place-items:center;background:color-mix(in srgb,var(--dark) 6%,#fff);color:color-mix(in srgb,var(--dark) 45%,#fff)}
.prw-prog .im.ph svg{width:18px;height:18px}
.prw-prog .tx{flex:1;min-width:0}
.prw-prog h3{margin:0 0 2px;font-size:14px;font-weight:700;color:var(--dark)}
.prw-prog p{margin:0;font-size:12.5px;color:var(--body);max-width:62ch}
.prw-prog .meta{margin-top:5px;font-size:12px;color:var(--faint)}
.prw-prog .dec{margin-left:auto;flex:none;text-align:right}
.prw-prog .need{display:block;font-size:11.5px;font-weight:700;color:var(--amber);margin-bottom:4px}
.prw-prog .by{display:block;font-size:11.5px;color:var(--body);margin-top:4px}
.prw-seg{display:inline-flex;border:1px solid #D4D8D0;border-radius:8px;overflow:hidden;background:#fff}
.prw-seg button{padding:6px 11px;font-size:12px;font-weight:600;color:var(--body);border:0;border-left:1px solid #D4D8D0;background:#fff;white-space:nowrap}
.prw-seg button:first-child{border-left:0}
.prw-seg button.on{background:var(--dark);color:var(--on-dark)}
.prw-fixed{font-size:11.5px;font-weight:600;color:var(--body);background:#F1F2EE;padding:3px 9px;border-radius:999px}
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
.prw-tl{margin-bottom:8px}
.prw-tl-top{margin:36px 0 16px}
.prw-tl-top h3{margin:0 0 4px;font-size:16px;font-weight:600;color:var(--dark)}
.prw-tl-top p{margin:0;font-size:13.5px;color:var(--body)}
.prw-preview{margin:0 0 18px;padding:10px 14px;border-radius:10px;border:1px solid #F1D38A;background:#FFF8E6;color:#6B4E00;font-size:13px;font-weight:500}
.prw-tl-top.link{display:block;width:100%;padding:0;border:0;background:none;text-align:left;font:inherit;cursor:pointer}
.prw-tl-top .go{margin-left:10px;font-size:12.5px;font-weight:500;color:var(--body);opacity:.75;white-space:nowrap}
.prw-tl-top.link:hover .go,.prw-tl-top.link:focus-visible .go{opacity:1;text-decoration:underline}
.prw-tl-open{cursor:pointer;border-radius:12px;transition:opacity .15s}
.prw-tl-open:hover{opacity:.88}
.prw-tl-hd{display:flex;justify-content:flex-end;margin-bottom:14px}
.prw-tl-waves{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:12px}
.prw-tl-wave{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border:1px solid var(--line);border-radius:12px;background:#fff;min-width:0}
.prw-tl-wave[data-room-wave=current]{border-color:var(--dark);box-shadow:inset 0 0 0 1px var(--dark)}
.prw-tl-wave .d{font-size:12px;color:var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prw-tl-wave>b,.prw-tl-all .top b{font-size:28px;line-height:1.05;font-weight:600;letter-spacing:-.025em;color:var(--dark)}
.prw-tl-wave>b i,.prw-tl-all .top b i{font-style:normal;font-size:14px;font-weight:500;color:var(--faint);letter-spacing:0;margin-left:2px}
.prw-tl .track{display:block;height:6px;border-radius:999px;background:#F1F2EE;overflow:hidden}
.prw-tl .track span{display:block;height:100%;background:var(--green);border-radius:999px}
.prw-tl .m{font-size:12px;color:var(--body);min-height:18px}
.prw-tl-all{padding:20px 24px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}
.prw-tl-all .top{display:flex;align-items:baseline;gap:10px;margin-bottom:34px}
.prw-tl-all .top span{font-size:13px;color:var(--body)}
.prw-tl-all .bar{position:relative;margin-bottom:10px}
.prw-tl-all .bar .track{height:10px}
.prw-tl-all .bar>b{position:absolute;top:-5px;width:2px;height:20px;background:var(--dark)}
.prw-tl-all .bar>em{position:absolute;top:-27px;transform:translateX(-50%);font-style:normal;font-size:11.5px;font-weight:700;color:var(--dark);white-space:nowrap}
.prw-cal-tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.prw-trainings{font-size:12.5px;color:var(--body)}
.prw-trainings summary{cursor:pointer;list-style:none;width:max-content;color:var(--body);text-decoration:underline;text-underline-offset:2px}
.prw-trainings summary::-webkit-details-marker{display:none}
.prw-trainings[open] summary{margin-bottom:6px}
.prw-trainings ul{margin:0;padding:0;list-style:none;columns:2;column-gap:28px;color:var(--ink)}
.prw-trainings li{padding:1px 0;break-inside:avoid}
.prw-month{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:36px 0 12px}
.prw-months>div:first-child .prw-month{margin-top:0}
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
.prw-sc-hd{display:flex;align-items:flex-end;gap:18px}
.prw-sc-picked{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:-8px 0 12px;font-size:12.5px;color:var(--body);min-height:32px}
.prw-sc-picked>span:first-child{margin-right:auto;font-weight:600;color:var(--ink)}
.prw-sc-picked select{height:32px;border:1px solid #D4D8D0;border-radius:7px;padding:0 8px;font:inherit;font-size:12.5px;color:var(--ink);background:#fff}
.prw-sc-late{color:var(--red);font-weight:600}
.prw-sc-prod{padding:18px 20px 12px;margin-bottom:18px}
.prw-sc-prod .hd{display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap}
.prw-sc-prod .hd h4{font-size:13px;font-weight:700;color:var(--dark);margin:0}
.prw-sc-prod .hd>span:nth-child(2){font-size:12px;color:var(--body);margin-right:auto}
.prw-sc-prod>button{display:grid;grid-template-columns:minmax(130px,1.1fr) 3fr minmax(84px,auto);gap:14px;align-items:center;width:calc(100% + 16px);margin:0 -8px;padding:6px 8px;border:0;border-radius:8px;background:none;text-align:left;font-size:13px;color:var(--ink)}
.prw-sc-prod>button:hover{background:#F7F8F5}
.prw-sc-prod>button.on{background:color-mix(in srgb,var(--dark) 7%,#fff)}
.prw-sc-prod .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prw-sc-prod .track{display:block;height:8px;border-radius:999px;background:#F1F2EE;overflow:hidden}
.prw-sc-prod .track span{display:block;height:100%;min-width:2px;background:var(--dark);border-radius:999px}
.prw-sc-prod .track span.week{background:var(--green)}
.prw-sc-prod .track span.quarter{background:var(--amber)}
.prw-sc-prod .track span.lapsed{background:var(--red)}
.prw-sc-orders{align-items:start;margin-bottom:18px}
.prw-sc-orders .prw-sc-prod{margin-bottom:0}
.prw-sc-orders .prw-sc-prod>button{grid-template-columns:148px minmax(0,1fr) minmax(64px,auto);gap:12px}
.prw-sc-prod .v{font-size:12.5px;font-weight:600;color:var(--ink);text-align:right;white-space:nowrap}
.prw-sc-prod .v i{font-style:normal;font-weight:400;color:var(--body)}
.prw-sc-kit{margin:0 0 14px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:13px;color:var(--body)}
.prw-sc-kit.warn{border-color:color-mix(in srgb,var(--red) 40%,var(--line))}
.prw-sc-kit p{margin:0 0 4px}
.prw-sc-kit p b{color:var(--ink);font-weight:600}
.prw-sc-kit a{color:var(--dark);font-weight:600;text-decoration:underline}
.prw-sc-kit .b{display:flex;gap:8px;margin-top:10px}
.prw th.prw-sc-pick,.prw td.prw-sc-pick{width:36px;padding-right:0}
.prw-sc-pick input{display:block;width:16px;height:16px;min-width:0;margin:0;padding:0;accent-color:var(--dark);cursor:pointer}
.prw tr.picked td{background:color-mix(in srgb,var(--dark) 4%,#fff)}
.prw-sc-hd .prw-seg button{display:inline-flex;align-items:center;gap:6px}
.prw-sc-hd .prw-seg svg{width:13px;height:13px}
.prw-map{display:grid;grid-template-columns:minmax(0,1fr) 264px;margin-bottom:22px}
.prw-map-wait{height:420px;margin-bottom:22px}
.prw-map-stage{position:relative;background:#F4F6F1;min-width:0;touch-action:pan-y}
.prw-map-stage svg{display:block;width:100%;height:auto;user-select:none}
.prw-map-stage svg.pan{cursor:grab}
.prw-map-stage svg.pan:active{cursor:grabbing}
.prw-map-stage .st{fill:#fff;stroke:#CDD3C8;stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.prw-map-stage .st{transition:fill .12s}
.prw-map-stage .st.has{cursor:pointer}
.prw-map-stage .st.has:hover{fill:#F4F7EF}
.prw-map-stage .st.on{fill:#EEF3E6;stroke:#9AA69E}
.prw-map-stage .sl{fill:#A9B2A8;font-weight:600;text-anchor:middle;dominant-baseline:central;pointer-events:none;letter-spacing:.04em}
.prw-map-stage .pin{cursor:pointer;outline:none;transition:opacity .15s}
.prw-map-stage .pin.off{opacity:.12;pointer-events:none}
.prw-map-stage .pin:hover circle:nth-child(2),.prw-map-stage .pin:focus-visible circle:nth-child(2),.prw-map-stage .pin.sel circle:nth-child(2){stroke:var(--ink);stroke-width:2.5}
.prw-map-zoom{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;border:1px solid #D4D8D0;border-radius:8px;overflow:hidden;background:#fff}
.prw-map-zoom button{display:grid;place-items:center;width:30px;height:30px;border:0;border-top:1px solid #E7E7E0;background:#fff;color:var(--dark)}
.prw-map-zoom button:first-child{border-top:0}
.prw-map-zoom button:disabled{color:var(--faint)}
.prw-map-zoom svg{width:14px;height:14px}
.prw-map-tip{position:absolute;z-index:5;transform:translate(-50%,calc(-100% - 14px));display:flex;flex-direction:column;gap:1px;max-width:240px;padding:8px 11px;border-radius:8px;background:var(--ink);color:#fff;font-size:12px;line-height:1.4;pointer-events:none;box-shadow:0 10px 24px -12px rgba(0,0,0,.5)}
.prw-map-tip b{font-size:12.5px;font-weight:600}
.prw-map-tip span{opacity:.78}
.prw-map-tip span:empty{display:none}
.prw-map-side{padding:18px 18px 14px;border-left:1px solid var(--line);min-width:0}
.prw-map-side h4{font-size:13px;font-weight:700;color:var(--dark);margin:0 0 8px}
.prw-map-groups button{display:grid;grid-template-columns:10px minmax(0,1fr) auto;column-gap:9px;row-gap:5px;align-items:center;width:calc(100% + 16px);margin:0 -8px;padding:7px 8px;border:0;border-radius:8px;background:none;text-align:left;font-size:13px;color:var(--ink)}
.prw-map-groups button:hover{background:#F7F8F5}
.prw-map-groups button.on{background:color-mix(in srgb,var(--dark) 7%,#fff)}
.prw-map-groups i{width:10px;height:10px;border-radius:50%}
.prw-map-groups .n{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prw-map-groups .v{font-size:12px;color:var(--body);white-space:nowrap}
.prw-map-groups .track{grid-column:2 / -1;display:block;height:4px;border-radius:999px;background:#F1F2EE;overflow:hidden}
.prw-map-groups .track span{display:block;height:100%;border-radius:999px}
.prw-map-key{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--body)}
.prw-map-key span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.prw-map-key svg{width:14px;height:14px;color:var(--body)}
.prw-map-note{margin:10px 0 0;font-size:11.5px;color:var(--faint)}
.prw-map-pick{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin:0 0 16px;padding:0 22px 16px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.prw-map-pick>b{font-size:14px;font-weight:600;color:var(--ink);line-height:1.3}
.prw-map-pick>button{position:absolute;right:-6px;top:-4px;display:grid;place-items:center;width:24px;height:24px;border:0;border-radius:6px;background:none;color:var(--body)}
.prw-map-pick>button:hover{background:#F1F2EE}
.prw-map-pick>button svg{width:14px;height:14px}
.prw-map-pick dl{margin:2px 0 0;display:grid;gap:1px}
.prw-map-pick dt{font-size:11px;color:var(--body);margin-top:6px}
.prw-map-pick dd{margin:0;color:var(--ink)}
.prw-topscroll{overflow-x:auto;overflow-y:hidden;height:14px;margin-bottom:6px}
.prw-topscroll>div{height:1px}
.prw-topscroll::-webkit-scrollbar,.prw-scroll.sync::-webkit-scrollbar{height:10px}
.prw-topscroll::-webkit-scrollbar-track,.prw-scroll.sync::-webkit-scrollbar-track{background:#F1F2EE;border-radius:999px}
.prw-topscroll::-webkit-scrollbar-thumb,.prw-scroll.sync::-webkit-scrollbar-thumb{background:#C3C9BF;border-radius:999px}
.prw-topscroll::-webkit-scrollbar-thumb:hover,.prw-scroll.sync::-webkit-scrollbar-thumb:hover{background:#9AA69E}
.prw-sc-search{position:relative;display:block;flex:1 1 220px;max-width:280px}
.prw-sc-search svg{position:absolute;left:11px;top:50%;width:15px;height:15px;transform:translateY(-50%);color:var(--body);opacity:.7;pointer-events:none}
.prw-sc-tools .prw-sc-search input{width:100%;max-width:none;padding-left:33px}
.prw-compose-label{font-size:12.5px;font-weight:600;color:var(--dark);margin-bottom:8px}
.prw-act{display:inline-flex;flex-direction:column;align-items:center;gap:5px;vertical-align:middle}
.prw-sub{background:none;border:0;padding:0;font-size:12px;font-weight:500;color:#5F6B64;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}
.prw-sub:hover{color:var(--dark)}
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
.prw-sc-sync{display:block;margin-top:3px;font-size:11.5px;color:var(--faint)}
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
.prw-gate{margin-top:-64px;position:relative;max-width:640px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 60px -32px rgba(0,0,0,.35);padding:36px 40px 34px}
.prw-gate h2{margin:0 0 8px;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:var(--dark)}
.prw-gate p{margin:0 0 20px;font-size:14px;color:var(--body);max-width:54ch}
.prw-gate .row{display:flex;gap:10px;flex-wrap:wrap}
.prw-gate input{flex:1;min-width:220px;height:44px;border:1px solid #D4D8D0;border-radius:9px;padding:0 14px;font:inherit;font-size:14.5px;color:var(--ink);background:#fff}
.prw-gate .prw-btn{height:44px;padding:0 22px;font-size:14px}
.prw-gate small{display:block;margin-top:14px;font-size:12px;color:var(--faint)}
.prw-gate .wait{margin:0;color:var(--faint)}
.prw .prw-inv{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;margin-right:6px;border-radius:8px;border:1px solid #D4D8D0;background:#fff;font-size:12px;font-weight:600;color:var(--dark);white-space:nowrap;vertical-align:top}
.prw .prw-inv:hover{border-color:var(--dark)}
.prw-inv svg{width:13px;height:13px}
.prw .prw-inv.done{border-color:transparent;background:color-mix(in srgb,var(--green) 12%,#fff);color:#0B6B3A}
.prw-rfs{display:flex;flex-wrap:wrap;gap:0 12px}
.prw-rf{flex:1 1 100%;min-width:0}
.prw-rf.half{flex:1 1 calc(50% - 6px)}
.prw-rf label span{font-weight:400;color:#9AA69E}
.prw-have{margin:0 0 12px;padding:10px 14px;list-style:none;max-height:168px;overflow:auto;border:1px solid #E7E7E0;border-radius:9px;background:#FAFBF8;font-size:13px;color:#0E1A16}
.prw-have li{padding:3px 0}
.prw-have span{color:#5C6B61}
.prw-have-h{margin:14px 0 2px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5C6B61}
.prw-lk{margin-bottom:28px}
.prw-lk-link{gap:16px}
.prw-lk-link>div:first-of-type{min-width:0}
.prw-lk h3{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:15px;font-weight:700;color:var(--dark)}
.prw-lk h3 .prw-num{font-size:11.5px;font-weight:600;color:var(--body);background:#F1F2EE;border-radius:999px;padding:1px 8px}
.prw-lk>p{margin:0 0 10px;font-size:12.5px;color:var(--body);max-width:70ch}
.prw-lk h3+.prw-card,.prw-lk h3+.prw-progs,.prw-lk h3+.prw-docs{margin-top:10px}
.prw-lk .prw-progs>div:first-child .prw-prog{border-top:0}
.prw-o section{margin-bottom:24px}
.prw-o h3{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:13px;font-weight:700;color:var(--dark)}
.prw-o h3 .prw-num{font-size:11.5px;font-weight:600;color:var(--body);background:#F1F2EE;border-radius:999px;padding:1px 8px}
.prw-o-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--line)}
.prw-o-row:first-child{border-top:0}
.prw-o-dot{width:7px;height:7px;border-radius:50%;background:#D4D8D0;flex:none;margin:0 6px}
.prw-o-row.late .prw-o-dot{background:var(--red)}
.prw .prw-o-tick{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;border:1.5px solid #C5CABF;background:#fff;color:transparent;padding:0;flex:none}
.prw .prw-o-tick:hover{border-color:var(--green);color:var(--green)}
.prw-o-tick svg{width:11px;height:11px}
.prw .prw-o-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;text-align:left;background:none;border:0;padding:0;color:inherit}
.prw-o-main .t{font-size:13.5px;font-weight:600;color:var(--ink)}
.prw-o-main .m{font-size:12px;color:var(--body)}
.prw-o-main .d{font-size:12.5px;line-height:1.45;color:var(--body);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line;margin:1px 0 2px}
.prw-plan-sum{margin:0 0 12px;font-size:13.5px;color:var(--body)}
.prw-prog .meta .prw-chip{margin-left:8px;vertical-align:1px}
button.prw-o-main:hover .t{color:var(--dark);text-decoration:underline;text-underline-offset:2px}
.prw-o-end{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}
.prw-o-end .go{width:15px;height:15px;color:#B7BDB2}
.prw-o-act,.prw-o-act .a{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.prw-o-late{font-size:11px;font-weight:700;color:var(--red)}
.prw .prw-o-more{display:block;width:100%;padding:10px 16px;border:0;border-top:1px solid var(--line);background:none;text-align:left;font-size:12.5px;font-weight:600;color:var(--dark)}
.prw-o-row>.prw-edit{flex-basis:100%;margin-top:4px}
.prw-o-done{margin-top:4px;font-size:13px;color:var(--body)}
.prw-o-done summary{cursor:pointer;font-weight:600;color:var(--dark);padding:6px 0}
.prw-o-done summary .prw-num{font-weight:600;color:var(--body);margin-left:4px}
.prw-o-done ul{margin:6px 0 0;padding:0;list-style:none;border:1px solid var(--line);border-radius:12px;background:#fff}
.prw-o-done li{display:flex;justify-content:space-between;gap:16px;padding:9px 16px;border-top:1px solid var(--line)}
.prw-o-done li:first-child{border-top:0}
.prw-o-done em{font-style:normal;font-size:12px;white-space:nowrap}
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
.prw .prw-hl{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);width:100%;min-height:190px;padding:0;border:0;border-radius:12px;overflow:hidden;background:var(--dark);color:var(--on-dark);text-align:left}
.prw .prw-hl.solo{grid-template-columns:1fr;min-height:0}
.prw-hl .t{display:flex;flex-direction:column;justify-content:center;gap:12px;padding:28px 30px;min-width:0}
.prw-hl .prw-eyebrow{color:var(--accent)}
.prw-hl .q{font-size:22px;line-height:1.28;letter-spacing:-.01em;max-width:34ch;overflow-wrap:anywhere}
.prw-hl .by{font-size:12.5px;opacity:.7}
.prw-hl .im{display:block;background-size:cover;background-position:center;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 34%);mask-image:linear-gradient(90deg,transparent 0,#000 34%)}
.prw-hl:focus-visible{outline:2px solid var(--dark);outline-offset:3px}
@media (max-width:900px){.prw .prw-hl{grid-template-columns:1fr}.prw-hl .im{min-height:150px;-webkit-mask-image:none;mask-image:none}}
.prw-foot{text-align:center;padding:26px 0 48px;font-size:12px;color:var(--faint)}
.prw-modal{position:fixed;inset:0;background:rgba(0,20,16,.5);z-index:1000;display:grid;place-items:center;padding:16px}
.prw-modal .box{width:100%;max-width:480px;background:#fff;border-radius:14px;padding:24px;color:#0E1A16;position:relative;font-size:14px;line-height:1.55;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto}
.prw-modal h3{margin:0 0 4px;font-size:20px;letter-spacing:-.02em;font-weight:700}
.prw-modal p{margin:0 0 14px;color:#5C6B61;font-size:13px}
.prw-modal label{display:block;font-size:12px;font-weight:600;color:#5C6B61;margin:12px 0 5px}
.prw-modal select,.prw-modal textarea,.prw-modal input{width:100%;border:1px solid #D4D8D0;border-radius:8px;padding:9px 11px;font:inherit;color:#0E1A16;background:#fff}
.prw-modal .row{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.prw-modal .x{position:absolute;right:14px;top:14px;background:none;border:0;color:#5C6B61;width:28px;height:28px;display:grid;place-items:center}
${whenTight(STACK_RULES)}
${whenTight(TEAM_STACK_RULES)}
${whenTight(MAP_STACK_RULES)}
.prw.tight .prw-sc-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
.prw.tight .prw-sc-grid{grid-template-columns:1fr}
@media (max-width:900px){
.prw-wrap{padding:0 16px}
.prw-gate{padding:26px 20px 24px}
.prw-gate h2{font-size:22px}
.prw-doc{flex-wrap:wrap}
.prw-doc .a{margin-left:48px;flex-wrap:wrap}
.prw-hero{grid-template-columns:1fr;gap:24px;padding-bottom:88px}
.prw-cover h1{font-size:32px}
.prw-top{min-height:60px}
.prw-stats{grid-auto-flow:row;grid-template-columns:1fr 1fr}
.prw-stats>div{padding:14px 8px 0 0}
.prw-stats>div+div{padding-left:14px}
.prw-stats>div:nth-child(odd){padding-left:0;border-left:0}
.prw-stats b{font-size:21px}
.prw-stats b i{font-size:12.5px}
.prw-stats span{font-size:11px}
.prw{zoom:1}
.prw-cover.fb h1{font-size:34px}
.prw-cover.fd h1{font-size:34px}
.prw-cover.fd .prw-hero{padding:32px 0 104px}
.prw-cover.fd.fx .prw-fade{background-attachment:scroll;background-position:center;background-size:cover}
.prw-cover.fd .prw-fade{width:100%;opacity:.3;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 80%);mask-image:linear-gradient(90deg,transparent 0%,#000 80%)}
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
.prw-phases,.prw-kpis{grid-template-columns:1fr 1fr}
.prw-grid2{grid-template-columns:1fr}
.prw .prw-sc-tiles,.prw.tight .prw-sc-tiles{grid-template-columns:1fr 1fr}
.prw-li{flex-wrap:wrap;padding:14px 16px;gap:10px 12px}
.prw-li>div:first-child,.prw-li>.prw-ft+div{flex:1 1 55%;min-width:0}
.prw-li .m,.prw-li .t{overflow-wrap:anywhere}
.prw-li .a{margin-left:0}
.prw-agree{flex-direction:column;align-items:flex-start;padding:16px}
.prw-legend{flex-wrap:wrap;gap:8px 14px}
.prw-min>div:first-child{flex-wrap:wrap}
.prw-min .mh{flex:1 1 70%;min-width:0;width:auto;padding:14px 16px;gap:12px}
.prw-o-row{padding:11px 12px;gap:10px}
.prw-o-end{margin-left:auto}
.prw-edit .f{padding:12px}
.prw-edit .prw-pick,.prw-edit input.prw-pick{min-width:0;width:100%}
.prw-edit label{flex:1 1 44%}
.prw-edit .b{margin-left:0;width:100%}
.prw-lk-link{flex-wrap:nowrap}
.prw table:not(.prw-plan):not(.prw-team){display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
.prw-ph{padding:16px 0!important;border:0!important}
.prw-ph:first-child{padding-top:0!important}
.prw-ph+.prw-ph{border-top:1px solid var(--line)!important}
.prw.v2 .prw-phases{gap:10px}
.prw.v2 .prw-ph,.prw.v2 .prw-ph:first-child{padding:18px 20px!important}
.prw.v2 .prw-ph+.prw-ph{border:0!important}
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
${MAP_STACK_RULES}
.prw-sc-tiles{grid-template-columns:1fr 1fr}.prw-sc-tile span{min-height:0}.prw-sc-grid{grid-template-columns:1fr}.prw-sc-check .names{grid-template-columns:1fr}.prw-sc-check .hd{flex-wrap:wrap}.prw-sc-check .hd em{margin-left:30px}.prw-sc-regions>button{grid-template-columns:1fr auto}.prw-sc-regions>button .track{display:none}.prw-sc-cols{margin-left:0}
.prw-sum{flex-wrap:wrap}
}
`;

type RequestPreset = { subject: string; assetKey?: string; kind?: string; stepKey?: string; details?: string; form?: "shipping" };
type Ask = { kind: "request"; preset?: RequestPreset } | { kind: "email" } | { kind: "contact" } | null;

/** An id made in the browser for one section opening (or one visit when the page gave no session). */
const roomViewId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;

export function BlockRoomWorkspace({ props: sentProps, brand, blockId, onFieldChange }: Props) {
  const isEditor = !!onFieldChange;
  const { pageId: livePageId, sessionId } = usePageContext();
  // In the builder there is no page context (blocks must not track or submit from the editor), but the hub
  // still reads its live data there so the team sees the real scorecard while editing. Read only: see useRoom below.
  const builderPageId = useBuilderPageId();
  const pageId = livePageId ?? (isEditor ? builderPageId : undefined);
  // In the builder the page isn't live, but what the customer will see still matters: load the room's data read-only there.
  const room = useRoom(pageId, true, { readOnly: isEditor });
  // A hub that asks for an email arrives as its cover only; once the visitor is recognised, the room hands over the rest.
  const handed = room.snapshot.props;
  const rawProps = useMemo(() => (sentProps.gated && handed ? ({ ...(handed as unknown as RoomWorkspaceBlockProps), requireEmail: true, gated: false }) : sentProps), [sentProps, handed]);
  // What is shown has the account name filled in; what is saved keeps the variables.
  const { props, rawOf } = useMemo(() => resolveRoomProps(rawProps), [rawProps]);
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
  const modules = visibleModules(props.hiddenModules, props.moduleOrder);
  const [view, setView] = useState<RoomModuleKey>(modules[0].key);
  const active = modules.some((m) => m.key === view) ? view : modules[0].key;
  // Which sections a visitor opens, and for how long: the account team reads it under Performance. Never in the
  // builder, never behind the email gate, and the server drops the page's own team.
  const viewerKnown = !!snapshot.viewer;
  const viewSession = useRef("");
  useEffect(() => {
    if (isEditor || !store || !pageId || isTrackingSuppressed()) return;
    if (props.requireEmail && !viewerKnown) return;
    if (!viewSession.current) viewSession.current = sessionId && /^[A-Za-z0-9_-]{8,64}$/.test(sessionId) ? sessionId : roomViewId();
    const base = { viewId: roomViewId(), sessionId: viewSession.current, module: active };
    const started = Date.now();
    let hiddenAt = 0;
    let away = 0;
    const seconds = () => Math.max(0, Math.round((Date.now() - started - away - (hiddenAt ? Date.now() - hiddenAt : 0)) / 1000));
    store.trackView({ ...base, seconds: 0 });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        store.trackView({ ...base, seconds: seconds() });
        hiddenAt = Date.now();
      } else if (hiddenAt) {
        away += Date.now() - hiddenAt;
        hiddenAt = 0;
      }
    };
    const onLeave = () => store.trackView({ ...base, seconds: seconds() });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      store.trackView({ ...base, seconds: seconds() });
    };
  }, [active, store, isEditor, pageId, sessionId, viewerKnown, props.requireEmail]);
  const [ask, setAsk] = useState<Ask>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const dark = isValidHex(brand.primaryColor) ? brand.primaryColor : "#0f172a";
  const accentRaw = (props.accentColor ?? "").trim();
  const accent = isValidHex(accentRaw) ? accentRaw : isValidHex(brand.accentColor) ? brand.accentColor : "#C7E738";
  const vars = { "--dark": dark, "--on-dark": contrastTextColor(dark), "--accent": accent, "--on-accent": contrastTextColor(accent), "--disp": BRAND_DISPLAY_STACK, fontFamily: BRAND_BODY_STACK } as React.CSSProperties;

  const total = Math.max(1, props.rolloutDays ?? 90);
  const day = now ? rolloutDay(props.kickoffDate, now) : null;
  // Past the rollout the hub stops counting days and reading as a launch. (An internal stage: nothing here names it to the customer.)
  const expansion = props.stage === "expansion";
  const phases = (props.phases ?? []).slice(0, 5);
  const states = phaseStates(phases, day);
  const groups = useMemo(() => (props.planGroups ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, rows: (g.rows ?? []).filter((r) => !r.hidden) })), [props.planGroups]);
  const assets = (props.assets ?? []).filter((a) => !a.hidden);
  const links = (props.links ?? []).filter((l) => !l.hidden);
  const team = (props.team ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, members: (g.members ?? []).filter((m) => !m.hidden) }));
  // Every program carries the choices the customer is offered (see roomProgramOptions), so nothing below has to know about the standing ones.
  const programGroups = (props.marketing?.groups ?? []).filter((g) => !g.hidden).map((g) => ({ ...g, programs: (g.programs ?? []).filter((x) => !x.hidden).map((x) => ({ ...x, options: roomProgramOptions(x) })) }));
  const undecided = programGroups.flatMap((g) => g.programs).filter((x) => (x.options ?? []).length >= 2 && !snapshot.choices[roomMilestoneKey({ key: x.key, task: x.title })]);
  // Onboarding: a step is done when the team ticked it in the builder or the customer completed it.
  const steps = props.onboarding?.hidden ? [] : (props.onboarding?.steps ?? []).filter((x) => !x.hidden).map((x) => ({ step: x, key: roomMilestoneKey({ key: x.key, task: x.title }) })).map((x) => ({ ...x, saved: snapshot.tasks[x.key], done: !!x.step.done || !!snapshot.tasks[x.key]?.done }));
  const stepsOpen = steps.filter((x) => !x.done);
  // The launch kit and the marketing plan are one module: links first, then what needs a decision, what is ready, what is under way, and what is saved for later.
  const hiddenSet = new Set(props.hiddenModules ?? []);
  const showKit = !hiddenSet.has("kit");
  const showMarketing = !hiddenSet.has("marketing");
  const launch = groupLaunch(showKit ? assets : [], showMarketing ? programGroups.flatMap((g) => g.programs) : [], snapshot.choices);
  const goals = (props.goals?.items ?? []).filter((g) => !g.hidden);
  const goalsAgreed = snapshot.tasks[ROOM_GOALS_AGREED_KEY];
  const needsAgreement = !!props.goals?.askAgreement && goals.length > 0 && !goalsAgreed?.done;
  const today = now ? isoDay(now) : "0000-00-00";
  // The page's own events and minutes, plus meetings synced from the team's calendar and the minutes published for them.
  const allEvents = useMemo(() => groupTrainings([...(props.calendar?.events ?? []), ...snapshot.events.map(syncedEventToRoomEvent)]), [props.calendar?.events, snapshot.events]);
  const events = splitEvents(allEvents, today);
  // The Calendar's own filter: one kind of event, or all of them.
  const [calKind, setCalKind] = useState<RoomEventKind | "">("");
  const calKinds = eventKinds(allEvents);
  const shownKind = calKind && calKinds.includes(calKind) ? calKind : "";
  const calEvents = shownKind ? { upcoming: events.upcoming.filter((e) => e.kind === shownKind), past: events.past.filter((e) => e.kind === shownKind) } : events;
  const meetings = [...(props.meetings?.items ?? []), ...snapshot.minutes.map(syncedMinutesToMeeting)].filter((m) => !m.hidden && (m.title ?? "").trim()).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const pr = snapshot.practices;
  // Goals counted from the practice list, with a number to reach: the scorecard shows their progress.
  const scorecardGoals: ScorecardGoal[] = goals
    .filter((g) => (g.metric === "practices_live" || g.metric === "practices_trained") && typeof g.targetValue === "number" && g.targetValue > 0)
    .map((g) => ({ key: g.key, title: g.title, value: goalValue(g, { byStage: pr.byStage, planDone: 0 }) ?? 0, target: g.targetValue as number, targetText: g.target }));
  const liveGoal = goals.find((g) => g.metric === "practices_live" && typeof g.targetValue === "number" && g.targetValue > 0) ?? null;
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
          const action = roomRowAction(r);
          const saved = action ? snapshot.tasks[key] : undefined;
          return { gi, ri, r, action, key, saved, status: saved?.done ? ("done" as RoomMilestoneStatus) : resolveRoomStatus(r.status) };
        }),
      ),
    [groups, snapshot.tasks, planEdits],
  );
  const doneCount = rows.filter((x) => x.status === "done").length;
  // A column with nothing in it is left out: a plan of the customer's own steps has no owner on our side, and one with no dates has no Due column.
  const planCols = { target: isEditor || rows.some((x) => planCell(x.r.target)), ours: rows.some((x) => planCell(x.r.ourOwner)) };
  /** Every milestone in this phase of the plan is done (an empty phase is not "done"). */
  const planGroupDone = (gi: number) => {
    const own = rows.filter((x) => x.gi === gi);
    return own.length > 0 && own.every((x) => x.status === "done");
  };
  // The line on the cover photo: what the builder typed, else the first milestone still open in the plan.
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
  // The account team can invite the customer's people straight from the team list.
  const teamInvite: TeamInvite | null =
    canEditLive && store
      ? {
          invited: (snapshot.invited ?? []).map((e) => e.toLowerCase()),
          send: async (person) => {
            const r = await store.invite(person);
            return r.ok ? null : r.error;
          },
        }
      : null;
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
  // Past the rollout, a launch milestone whose date had already gone by when the hub moved on is no longer counted late: only what slips after that is.
  const movedOn = expansion && /^\d{4}-\d{2}-\d{2}$/.test(props.stageSince ?? "") ? new Date(`${props.stageSince}T12:00:00`) : null;
  const lateByDate = (target: string | undefined) => !!now && targetHasPassed(target, now) && !(expansion && (!movedOn || targetHasPassed(target, movedOn)));
  const blocked = rows.filter((x) => !x.r.hidden && !groups[x.gi]?.hidden && (x.status === "blocking" || (x.status !== "done" && lateByDate(x.r.target))));
  // Everything the customer has to act on, as one number and one list.
  const attention = [...stepsOpen, ...mine, ...reviewRequests];
  // Overview shows the next three things only. The practice list, the doctor roster and the welcome gift
  // always come first; as each is done, the next setup step, plan item or request to review takes its place.
  const nextUp = (() => {
    type Next = { kind: "step"; x: (typeof stepsOpen)[number] } | { kind: "row"; x: (typeof mine)[number] } | { kind: "review"; q: (typeof reviewRequests)[number] };
    const rowIs = (x: (typeof mine)[number], which: "practices" | "doctors") => roomFirstStep(x.key, x.r.task) === which;
    const practiceRow = mine.find((x) => rowIs(x, "practices"));
    const doctorRow = mine.find((x) => rowIs(x, "doctors"));
    const giftStep = stepsOpen.find((x) => isGiftStep(x.step));
    // The practice list, doctor roster and welcome gift lead only during the rollout; after it, whatever is open comes in its own order.
    const first: Next[] = expansion ? [] : [
      ...(practiceRow ? [{ kind: "row" as const, x: practiceRow }] : []),
      ...(doctorRow ? [{ kind: "row" as const, x: doctorRow }] : []),
      ...(giftStep ? [{ kind: "step" as const, x: giftStep }] : []),
    ];
    const rest: Next[] = [
      ...stepsOpen.filter((x) => expansion || x !== giftStep).map((x) => ({ kind: "step" as const, x })),
      ...[...mine].filter((x) => expansion || (x !== practiceRow && x !== doctorRow)).sort((a, b) => Number(b.action === "upload") - Number(a.action === "upload")).map((x) => ({ kind: "row" as const, x })),
      ...reviewRequests.map((q) => ({ kind: "review" as const, q })),
    ];
    return [...first, ...rest].slice(0, ROOM_NEXT_UP);
  })();
  /** Open another part of the hub, when this account shows it. */
  const goTo = (m: RoomModuleKey): boolean => {
    if (!modules.some((x) => x.key === m)) return false;
    setView(m);
    return true;
  };
  // The programs the customer said yes to, each with where it has got to.
  const planned = programGroups
    .flatMap((g) => g.programs)
    .map((x) => ({ x, st: roomProgramStatus(roomMilestoneKey({ key: x.key, task: x.title }), snapshot.choices[roomMilestoneKey({ key: x.key, task: x.title })], snapshot.requests) }))
    .filter((p): p is { x: (typeof p)["x"]; st: RoomProgramStatus } => !!p.st);
  // Outstanding: every open item from every module, with whose move it is.
  const brandLabel = brand.brandName || "Us";
  const partnerLabel = (props.partnerShort ?? "").trim() || props.partnerName || "You";
  const actionDone = (m: RoomMeeting, a: RoomMeetingAction) => !!a.done || !!snapshot.tasks[roomMeetingActionKey(m.key, a.text)]?.done;
  const outstandingAll: OutstandingItem[] = [
    // A setup step and a plan step are done right here in the list: the same button they have where they live.
    ...stepsOpen.map((x): OutstandingItem => ({
      id: `step-${x.key}`,
      title: x.step.title,
      source: "Setup",
      side: "you",
      module: "overview",
      detail: (x.step.description ?? "").trim() || undefined,
      action: (
        <OnboardingStep
          bare
          step={x.step}
          stepKey={x.key}
          done={x.done}
          saved={x.saved}
          snapshot={snapshot}
          store={store}
          isEditor={isEditor}
          teamCount={theirPeople.length}
          onNeedEmail={() => setAsk({ kind: "email" })}
          onAddTeam={() => needViewer(() => setAsk({ kind: "contact" }))}
          onRequest={() => openRequest({ subject: x.step.title, kind: x.step.requestKind || "other", stepKey: x.key, form: isGiftStep(x.step) ? "shipping" : undefined })}
        />
      ),
    })),
    ...(needsAgreement ? [{ id: "goals", title: "Agree the goals for the partnership", source: "Goals", side: "you", module: "goals", detail: "Read the goals we set together and confirm they look right, or tell us what to change." } satisfies OutstandingItem] : []),
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
        detail: (x.r.note ?? "").trim() || (ROOM_STEP_SHORTCUTS[x.key]?.hint ?? undefined),
        ...(x.action ? { action: <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} onGo={goTo} /> } : {}),
      })),
    ...undecided.map((x): OutstandingItem => ({ id: `mk-${x.key}`, title: `Decide: ${x.title}`, source: "Marketing plan", from: [x.audience, x.when].filter(Boolean).join(" · ") || undefined, side: "you", module: "marketing", detail: (x.description ?? "").trim() || undefined })),
    // What they said yes to and are waiting on: with the account team until it goes to marketing (after that, the request below carries it).
    ...programGroups
      .flatMap((g) => g.programs)
      .map((x) => ({ x, st: roomProgramStatus(roomMilestoneKey({ key: x.key, task: x.title }), snapshot.choices[roomMilestoneKey({ key: x.key, task: x.title })], snapshot.requests) }))
      .filter((p) => p.st?.state === "team")
      .map(({ x, st }): OutstandingItem => ({ id: `mkw-${x.key}`, title: x.title, source: "Marketing plan", from: x.when, side: "us", module: "marketing", detail: st!.line })),
    ...snapshot.requests
      .filter((q) => q.status !== "done")
      .map((q): OutstandingItem => ({
        id: `req-${q.id}`,
        title: q.subject,
        detail: (q.details ?? "").trim() ? (q.assetKey ?? "").startsWith("mk-plan:") ? (q.details as string).split("\n").filter(Boolean).join(" · ") : (q.details as string).trim() : undefined,
        source: "Request",
        ...(q.reply?.text ? { reply: { text: q.reply.text, by: q.reply.by, when: q.reply.at ? fmtDate(q.reply.at) : "" } } : {}),
        from: [ROOM_REQUEST_KIND_LABEL[q.kind] ?? "Request", `asked by ${q.by}`, fmtDate(q.createdAt)].filter(Boolean).join(" · "),
        owner: q.owner ?? undefined,
        due: q.due ?? undefined,
        side: q.status === "review" ? "you" : "us",
        module: "requests",
        request: { id: q.id, status: q.status, owner: q.owner, due: q.due },
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
    overview: stepsOpen.length ? String(stepsOpen.length) : "",
    goals: needsAgreement ? "1" : "",
    marketing: undecided.length ? String(undecided.length) : "",
    plan: mine.length ? String(mine.length) : "",
    requests: outstandingYours ? String(outstandingYours) : "",
  };
  const heroImage = (props.heroImageUrl ?? "").trim();
  const cover = props.coverStyle === "fullbleed" || props.coverStyle === "light" || props.coverStyle === "split" ? props.coverStyle : "fade";
  const headline = roomHeadline(props.headline, props.partnerName, brand.brandName);
  // "fade": the photo runs off the right edge of the cover and dissolves into its colour on the left.
  const fadePhoto =
    cover === "fade" && heroImage ? (
      <div className="prw-fade" style={{ backgroundImage: `url(${JSON.stringify(heroImage).slice(1, -1)})` }} role={props.heroImageAlt ? "img" : undefined} aria-label={props.heroImageAlt || undefined} data-room-cover-fade />
    ) : null;
  // The customer's logo is recoloured for the cover: white on the dark covers, dark on the pale one. Kept in its own colours,
  // a logo made for dark covers would vanish on the pale cover, so there the name is set in type instead.
  const partnerLogo = cover === "light" && props.partnerLogoOriginal ? "" : (props.partnerLogoUrl ?? "").trim();
  const partnerLogoFilter = props.partnerLogoOriginal ? undefined : cover === "light" ? "brightness(0)" : "brightness(0) invert(1)";
  const pct = day === null ? 0 : Math.min(100, Math.round((day / total) * 100));

  // A hub that asks for an email shows a stranger the cover and one question. Nothing else is on the page to find.
  if (!isEditor && !!props.requireEmail && !snapshot.viewer) {
    return (
      <section className={`prw${roomLookClass(props.look)}`} style={vars} data-room-workspace data-room-gate data-room-look={roomLook(props.look)}>
        <style>{CSS}</style>
        {roomLook(props.look) === "polished" && <style>{ROOM_LOOK_CSS}</style>}
        <div className={`prw-cover${cover === "fullbleed" ? " fb" : cover === "light" ? " lt" : cover === "fade" ? (props.coverPhotoScrolls || isEditor ? " fd" : " fd fx") : ""}`} style={cover === "fullbleed" && heroImage ? { backgroundImage: `url(${JSON.stringify(heroImage).slice(1, -1)})` } : undefined} data-room-cover={cover}>
          {fadePhoto}
          <div className="prw-wrap">
            <div className="prw-top">
              <div className="prw-lock" style={{ ["--blogo" as string]: logoScale(props.brandLogoScale) }}>
                {brandHasLogo(brand) ? <BrandLogo brand={brand} tone={cover === "light" ? "onLight" : "onDark"} alt={brand.brandName || "Logo"} /> : <span>{brand.brandName}</span>}
                <span className="x">×</span>
                {partnerLogo ? <img src={partnerLogo} alt={props.partnerName} style={{ height: Math.round(22 * logoScale(props.partnerLogoScale)), filter: partnerLogoFilter }} data-room-partner-logo /> : <span>{props.partnerName}</span>}
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button
                  type="button"
                  className="prw-req"
                  onClick={(e) => {
                    const field = e.currentTarget.closest("[data-room-gate]")?.querySelector<HTMLInputElement>("[data-room-gate-email]");
                    field?.scrollIntoView({ block: "center", behavior: "smooth" });
                    field?.focus({ preventScroll: true });
                  }}
                  data-room-signin-button
                >
                  <LogIn style={{ width: 14, height: 14 }} aria-hidden /> Sign in
                </button>
              </div>
            </div>
            <div className={`prw-hero${heroImage && cover === "split" || heroImage && cover === "light" ? "" : " solo"}`}>
              <div>
                {coverLabel(props.eyebrow, brand.brandName) && <div className="prw-eyebrow">{coverLabel(props.eyebrow, brand.brandName)}</div>}
                <h1 style={{ fontFamily: BRAND_DISPLAY_STACK }}>{headline}</h1>
              </div>
              {heroImage && (cover === "split" || cover === "light") && (
                <div className="prw-photo">
                  <img src={heroImage} alt={props.heroImageAlt ?? ""} />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="prw-wrap">
          <RoomGate store={room.reader} loading={snapshot.status === "idle" || snapshot.status === "loading"} partner={props.partnerName} brandName={brand.brandName || ""} />
          <div className="prw-foot">
            {roomFooterLine(props.partnerName, brand.brandName)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <RoomEditContext.Provider value={editItem}>
    <section ref={rootRef} className={`prw${tight ? " tight" : ""}${roomLookClass(props.look)}`} style={vars} data-room-workspace data-room-look={roomLook(props.look)}>
      <style>{CSS}</style>
      {roomLook(props.look) === "polished" && <style>{ROOM_LOOK_CSS}</style>}
      <div className={`prw-cover${cover === "fullbleed" ? " fb" : cover === "light" ? " lt" : cover === "fade" ? (props.coverPhotoScrolls || isEditor ? " fd" : " fd fx") : ""}`} style={cover === "fullbleed" && heroImage ? { backgroundImage: `url(${JSON.stringify(heroImage).slice(1, -1)})` } : undefined} data-room-cover={cover}>
          {fadePhoto}
        <div className="prw-wrap">
          <div className="prw-top">
            <div className="prw-lock" style={{ ["--blogo" as string]: logoScale(props.brandLogoScale) }}>
              {brandHasLogo(brand) ? <BrandLogo brand={brand} tone={cover === "light" ? "onLight" : "onDark"} alt={brand.brandName || "Logo"} /> : <span>{brand.brandName}</span>}
              <span className="x">×</span>
              {partnerLogo ? <img src={partnerLogo} alt={props.partnerName} style={{ height: Math.round(22 * logoScale(props.partnerLogoScale)), filter: partnerLogoFilter }} data-room-partner-logo /> : <span>{props.partnerName}</span>}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {safeHttpUrl(props.scheduleUrl) && (
                <a className="prw-sched" href={isEditor ? undefined : safeHttpUrl(props.scheduleUrl)} target="_blank" rel="noopener noreferrer" data-room-schedule>
                  <CalendarPlus style={{ width: 14, height: 14 }} aria-hidden /> {scheduleButtonLabel(props.scheduleLabel)}
                </a>
              )}
              {!isEditor && store && snapshot.status === "ready" && !snapshot.viewer ? (
                // Nobody is signed in yet: the first thing to do is say who you are, not make a request.
                <button type="button" className="prw-req" onClick={() => setAsk({ kind: "email" })} data-room-signin-button>
                  <LogIn style={{ width: 14, height: 14 }} aria-hidden /> Sign in
                </button>
              ) : !new Set(props.hiddenModules ?? []).has("requests") && (
                <button type="button" className="prw-req" onClick={() => openRequest()} data-room-request-button>
                  <Plus style={{ width: 14, height: 14 }} aria-hidden /> Request
                </button>
              )}
            </div>
          </div>
          <div className={`prw-hero${heroImage && cover === "split" || heroImage && cover === "light" ? "" : " solo"}`}>
            <div>
              {isEditor ? (
                <div className="prw-eyebrow">
                  <InlineText as="span" value={props.eyebrow ?? ""} onUpdate={field("eyebrow")} />
                </div>
              ) : coverLabel(props.eyebrow, brand.brandName) ? (
                <div className="prw-eyebrow">{coverLabel(props.eyebrow, brand.brandName)}</div>
              ) : null}
              <h1 style={{ fontFamily: BRAND_DISPLAY_STACK }}>
                <InlineText as="span" value={headline} onUpdate={field("headline")} />
              </h1>
              <div className="prw-stats">
                {expansion ? (
                  partnerSince(props.kickoffDate) && (
                    <div data-room-kpi="since">
                      <b className="prw-num">{partnerSince(props.kickoffDate)}</b>
                      <span>Partner since</span>
                    </div>
                  )
                ) : day !== null && (
                  <div>
                    <b className="prw-num">{Math.min(day, total)}<i>/{total}</i></b>
                    <span>Day</span>
                  </div>
                )}
                {/* The plan count is a rollout measure; after it the cover leads with how much of the account is live. */}
                {rows.length > 0 && !expansion && (
                  <div>
                    <b className="prw-num">{doneCount}<i>/{rows.length}</i></b>
                    <span>Plan items done</span>
                  </div>
                )}
                {pr.total > 0 && (
                  <div data-room-kpi="live">
                    <b className="prw-num">{pr.byStage.live ?? 0}<i>/{pr.total}</i></b>
                    <span>{noun.charAt(0).toUpperCase() + noun.slice(1)} live</span>
                  </div>
                )}
                {expansion && pr.total > 0 && (
                  <div data-room-kpi="share">
                    <b className="prw-num">{liveShare(pr.byStage.live ?? 0, pr.total)}<i>%</i></b>
                    <span>Of {noun} live</span>
                  </div>
                )}
                {mine.length + reviewRequests.length + stepsOpen.length + undecided.length > 0 && (
                  <div>
                    <b className="prw-num">{mine.length + reviewRequests.length + stepsOpen.length + undecided.length}</b>
                    <span>Waiting on you</span>
                  </div>
                )}
              </div>
            </div>
            {heroImage && (cover === "split" || cover === "light") && (
              <div className="prw-photo">
                <img src={heroImage} alt={props.heroImageAlt ?? ""} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="prw-wrap">
        <div className="prw-sheet">
          <aside className="prw-toc">
            <div className="in">
              {modules.map((m, i) => (
                <button key={m.key} type="button" className={m.key === active ? "on" : ""} onClick={() => setView(m.key)} data-room-nav={m.key}>
                  {m.key === "marketing" ? roomMarketingNames(props.stage).module : m.key === "calendar" && hiddenSet.has("calendar") ? "Meetings" : m.label}
                  {badge[m.key] && <em className="prw-num" aria-label={`${badge[m.key]} waiting on you`}>{badge[m.key]}</em>}
                </button>
              ))}
            </div>
          </aside>

          <div className="prw-mod" data-room-view={active}>
            {snapshot.asCustomer && (
              <div className="prw-preview" role="status" data-room-as-customer>
                You are seeing this hub as the customer does. Anything you tick or upload here is saved.
              </div>
            )}
            {active === "overview" && (() => {
              // What a rep switched off on this hub's Overview, and what is left to lay out.
              const ovHidden = new Set(props.hiddenOverview ?? []);
              const canScorecard = modules.some((m) => m.key === "practices");
              const showNext = !ovHidden.has("next");
              const showComing = !!now && events.upcoming.length > 0 && !ovHidden.has("coming");
              const showOverdue = blocked.length > 0 && !ovHidden.has("overdue");
              return (
              <>
                <div className="prw-hd prw-welcome">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }} data-room-welcome>
                      {(props.onboarding?.title ?? "").trim() || `Welcome, ${welcomeName(snapshot.viewer, props.partnerName)}!`}
                    </h2>
                  </div>
                  {(props.kickoffDate ?? "").trim() && (
                    <div className="prw-meta">
                      Kickoff <b>{fmtDate(props.kickoffDate)}</b>
                    </div>
                  )}
                </div>
                {expansion && pr.total > 0 && !ovHidden.has("progress") && (
                  // The top of the Overview opens the Scorecard, where the same numbers are broken down.
                  canScorecard ? (
                    <button type="button" className="prw-tl-top link" onClick={() => setView("practices")} data-room-progress-heading data-room-progress-link>
                      <h3>Partnership progress <span className="go">Open Scorecard →</span></h3>
                      <p>{progressLine(pr.byStage.live ?? 0, pr.total, noun)}</p>
                    </button>
                  ) : (
                    <div className="prw-tl-top" data-room-progress-heading>
                      <h3>Partnership progress</h3>
                      <p>{progressLine(pr.byStage.live ?? 0, pr.total, noun)}</p>
                    </div>
                  )
                )}
                {expansion && pr.total > 0 && !ovHidden.has("progress") && (
                  <PartnershipTimeline onOpen={canScorecard ? () => setView("practices") : undefined} waves={timelineWaves(props.waves, pr.byWave)} total={pr.total} live={pr.byStage.live ?? 0} goal={liveGoal ? { target: liveGoal.targetValue as number, text: liveGoal.target } : null} defaultView={props.timelineView === "waves" ? "waves" : "practices"} noun={noun} fmtDate={(d) => fmtDate(d)} />
                )}
                {!expansion && phases.length > 0 && !ovHidden.has("progress") && (
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
                {(showNext || showComing || showOverdue) && (
                <div className="prw-grid2 prw-sec" style={!(showNext && (showComing || showOverdue)) ? { gridTemplateColumns: "1fr" } : undefined}>
                  {showNext && (
                  <div className="prw-card prw-att" data-room-attention>
                    <h3>
                      Your next steps
                      {modules.some((m) => m.key === "plan") && (
                        <button type="button" onClick={() => setView("plan")}>Open action plan</button>
                      )}
                    </h3>
                    {attention.length === 0 && <div className="prw-empty">Nothing is waiting on you.</div>}
                    {/* Setup items (logo, welcome kit, team) sit in the same list as everything else: no separate checklist. */}
                    {nextUp.map((n) => {
                      if (n.kind === "step") {
                        const x = n.x;
                        return (
                      <OnboardingStep
                        key={x.key}
                        step={x.step}
                        stepKey={x.key}
                        done={x.done}
                        saved={x.saved}
                        snapshot={snapshot}
                        store={store}
                        isEditor={isEditor}
                        teamCount={theirPeople.length}
                        onNeedEmail={() => setAsk({ kind: "email" })}
                        onAddTeam={() => needViewer(() => setAsk({ kind: "contact" }))}
                        onRequest={() => openRequest({ subject: x.step.title, kind: x.step.requestKind || "other", stepKey: x.key, form: isGiftStep(x.step) ? "shipping" : undefined })}
                      />
                        );
                      }
                      if (n.kind === "row") {
                        const x = n.x;
                        return (
                      <div className="prw-li" key={x.key}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t">{x.r.task}</div>
                          <div className="m">{x.r.note || `Action plan${x.r.target ? ` · due ${x.r.target}` : ""}`}</div>
                          {x.action === "upload" && isRosterTask(x.key) && <RosterTemplateLink store={store} show={!isEditor && !!snapshot.viewer} />}
                        </div>
                        <div className="a">
                          <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} onGo={goTo} />
                        </div>
                      </div>
                        );
                      }
                      const q = n.q;
                      return (
                      <div className="prw-li" key={`q${q.id}`}>
                        <div style={{ minWidth: 0 }}>
                          <div className="t">{q.subject}</div>
                          <div className="m">Request · ready for your review</div>
                        </div>
                        <div className="a">
                          <button type="button" className="prw-btn pri" onClick={() => setView("requests")}>Review</button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  )}
                  {showComing ? (
                    <div className="prw-card" data-room-coming-up>
                      <h3>
                        Coming up
                        {modules.some((m) => m.key === "calendar") && <button type="button" onClick={() => setView("calendar")}>Open calendar</button>}
                      </h3>
                      {events.upcoming.slice(0, 4).map((e) => (
                        <EventRow key={e.key || e.title + e.date} event={e} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                      ))}
                    </div>
                  ) : showOverdue ? (
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
                )}
                {showComing && showOverdue && (
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
                {expansion && !!snapshot.viewer?.team && canScorecard && !ovHidden.has("orders") && (
                  <OrdersAtAGlance store={store ?? room.reader} viewerKey={snapshot.viewer?.email ?? ""} noun={noun} onOpen={() => setView("practices")} />
                )}
                <FeedHighlight wins={modules.some((m) => m.key === "wins") && !ovHidden.has("feed") ? snapshot.wins : []} photo={(props.feedPhotoUrl ?? "").trim() || ROOM_FEED_PHOTO} onOpen={() => setView("wins")} />
              </>
              );
            })()}

            {active === "calendar" && (
              <>
                {!hiddenSet.has("calendar") && (
                <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Calendar</h2>
                  </div>
                  <div className="prw-cal-tools">
                  {calKinds.length > 1 && (
                    <span className="prw-seg" role="group" aria-label="Show" data-room-calendar-filter={shownKind || "all"}>
                      <button type="button" className={shownKind ? "" : "on"} aria-pressed={!shownKind} onClick={() => setCalKind("")}>All</button>
                      {calKinds.map((k) => (
                        <button type="button" key={k} className={shownKind === k ? "on" : ""} aria-pressed={shownKind === k} onClick={() => setCalKind(k)} data-room-calendar-kind={k}>{ROOM_EVENT_KIND_PLURAL[k]}</button>
                      ))}
                    </span>
                  )}
                  {pageId && !isEditor && (
                    <a className="prw-btn" href={`webcal://${typeof window !== "undefined" ? window.location.host : ""}/api/lp/room/calendar.ics?pageId=${pageId}${room.reader?.feedToken() ? `&rt=${encodeURIComponent(room.reader.feedToken())}` : ""}`} data-room-calendar-feed>
                      <CalendarPlus aria-hidden /> Subscribe
                    </a>
                  )}
                  </div>
                </div>
                {calEvents.upcoming.length === 0 && calEvents.past.length === 0 && <div className="prw-card"><div className="prw-empty">Nothing is scheduled yet.</div></div>}
                {calEvents.upcoming.length === 0 && calEvents.past.length > 0 && <div className="prw-card"><div className="prw-empty">Nothing upcoming.</div></div>}
                <EventList events={calEvents.upcoming} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                {calEvents.past.length > 0 && (
                  <details className="prw-sec">
                    <summary className="prw-meta" style={{ cursor: "pointer" }}>Earlier ({calEvents.past.length})</summary>
                    <div style={{ marginTop: 16 }}>
                      <EventList events={calEvents.past} calendarName={`${props.partnerName} × ${brand.brandName}`} isEditor={isEditor} />
                    </div>
                  </details>
                )}
                </>
                )}
                {!hiddenSet.has("meetings") && (
                <div className={hiddenSet.has("calendar") ? undefined : "prw-sec"} data-room-minutes>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Meeting notes</h2>
                  </div>
                </div>
                {meetings.length === 0 && <div className="prw-card"><div className="prw-empty">No minutes yet.</div></div>}
                {meetings.map((m, i) => (
                  <MeetingCard key={m.key || m.title + m.date} meeting={{ ...m, actions: (m.actions ?? []).map((a) => ({ ...a, done: actionDone(m, a) })) }} defaultOpen={i === 0} isEditor={isEditor} />
                ))}
                </div>
                )}
              </>
            )}

            {active === "plan" && (
              <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Action plan</h2>
                  </div>
                </div>
                {/* Past the rollout, a phase whose milestones are all done folds away; anything still open stays in the plan. */}
                {expansion && groups.every((_, gi) => planGroupDone(gi)) && groups.length > 0 ? null : (
                <table className="prw-plan">
                  <thead>
                    <tr>
                      {planCols.target && <th style={{ width: 96 }}>Due</th>}
                      <th>Step</th>
                      {planCols.ours && <th style={{ width: 136 }}>{brand.brandName || "Us"}</th>}
                      <th style={{ width: 150 }}>{planCols.ours ? props.partnerName : "Owner"}</th>
                      <th style={{ width: 104 }}>Status</th>
                      <th style={{ width: canEditLive ? 186 : 132 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (expansion && planGroupDone(gi) ? null : (

                      <PlanGroup key={gi} cols={planCols} group={g} rows={rows.filter((x) => x.gi === gi).map((x) => (blocked.includes(x) ? { ...x, status: "blocking" as RoomMilestoneStatus } : x))} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} onGo={goTo} edit={canEditLive ? { save: editPlan, ours: ourPeople, theirs: theirPeople } : null} />
                    )))}
                  </tbody>
                </table>
                )}
                {expansion && groups.some((_, gi) => planGroupDone(gi)) && (
                  <details className="prw-sec prw-plan-done" data-room-plan-completed>
                    <summary className="prw-meta" style={{ cursor: "pointer" }}>Rollout, completed ({rows.filter((x) => planGroupDone(x.gi)).length})</summary>
                    <div style={{ marginTop: 16 }}>
                <table className="prw-plan">
                  <thead>
                    <tr>
                      {planCols.target && <th style={{ width: 96 }}>Due</th>}
                      <th>Step</th>
                      {planCols.ours && <th style={{ width: 136 }}>{brand.brandName || "Us"}</th>}
                      <th style={{ width: 150 }}>{planCols.ours ? props.partnerName : "Owner"}</th>
                      <th style={{ width: 104 }}>Status</th>
                      <th style={{ width: canEditLive ? 186 : 132 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, gi) => (!planGroupDone(gi) ? null : (

                      <PlanGroup key={gi} cols={planCols} group={g} rows={rows.filter((x) => x.gi === gi).map((x) => (blocked.includes(x) ? { ...x, status: "blocking" as RoomMilestoneStatus } : x))} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} onGo={goTo} edit={canEditLive ? { save: editPlan, ours: ourPeople, theirs: theirPeople } : null} />
                    )))}
                  </tbody>
                </table>
                    </div>
                  </details>
                )}
              </>
            )}

            {active === "goals" && (
              <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Goals</h2>
                  </div>
                </div>
                {!!props.goals?.askAgreement && goals.length > 0 && (
                  <div className="prw-agree" data-room-goals-agreement={goalsAgreed?.done ? "agreed" : "open"}>
                    {goalsAgreed?.done ? (
                      <span><b>Agreed</b>{goalsAgreed.by ? ` by ${goalsAgreed.by}` : ""}{goalsAgreed.at ? ` · ${fmtDate(goalsAgreed.at)}` : ""}</span>
                    ) : (
                      <>
                        <span><b>Do these goals look right?</b></span>
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
                            {!auto && g.source && <div className="m">{g.source}</div>}
                          </td>
                          <td>{pctDone !== null && <div className={`prw-bar${status === "pending" ? " warn" : ""}`}><i style={{ width: `${pctDone}%` }} /></div>}</td>
                          <td><span className={`prw-st ${status}`}>{status === "done" ? "Achieved" : status === "pending" ? "Needs attention" : "On track"}</span></td>
                          <td className="c">{g.owner}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {active === "practices" && <ScorecardView snapshot={snapshot} store={store ?? room.reader} mapShared={!!props.shareMap} isEditor={isEditor} noun={noun} display={BRAND_DISPLAY_STACK} goals={scorecardGoals} onNeedEmail={() => setAsk({ kind: "email" })} />}

            {active === "wins" && <WinsView snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} display={BRAND_DISPLAY_STACK} />}


            {active === "marketing" && (
              <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>{roomMarketingNames(props.stage).module}</h2>
                  </div>
                </div>

                {showKit && links.length > 0 && (
                  <section className="prw-lk" data-room-launch="links">
                    <h3>Important links</h3>
                    <div className="prw-card">
                      {links.map((l, i) => {
                        // An uploaded file opens in the viewer (and its views and time are counted); a web page opens in a new tab and is counted as opened.
                        const asAsset = roomLinkAsset(l);
                        const file = asAsset.kind !== "link";
                        return (
                        <div className="prw-li prw-lk-link" key={i} data-room-link={file ? "file" : "link"}>
                          <span className="prw-ft ic" aria-hidden>{asAsset.kind === "image" ? <ImageIcon /> : file ? <FileText /> : <Link2 />}</span>
                          <div>
                            <div className="t"><E item={l} field="title" placeholder="Link name" /></div>
                            <div className="m">{l.description || (file ? (asAsset.kind === "image" ? "Image" : "PDF") : l.url)}</div>
                          </div>
                          <div className="a">
                            <CopyButton text={l.url} label="Copy link" link />
                            <a
                              className="prw-ib"
                              href={isEditor ? undefined : l.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open"
                              aria-label={`Open ${l.title}`}
                              onClick={(e) => {
                                if (openAsset(asAsset)) e.preventDefault();
                              }}
                            >
                              <ExternalLink aria-hidden />
                            </a>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {showKit && launch.ready.length > 0 && (
                  <section className="prw-lk" data-room-launch="ready">
                    <h3>{roomMarketingNames(props.stage).ready}<span className="prw-num">{launch.ready.length}</span></h3>
                    <div className="prw-docs">
                      {launch.ready.map((a, i) => (
                        <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} onOpen={openAsset} canRequest={canRequest} onRequest={() => openRequest({ subject: `Change to: ${a.title}`, kind: "asset_change", assetKey: a.key || roomMilestoneKey({ task: a.title }) })} />
                      ))}
                    </div>
                  </section>
                )}

                {showMarketing && launch.toDecide.length > 0 && (
                  <section className="prw-lk" data-room-launch="decide">
                    <h3>To decide<span className="prw-num">{launch.toDecide.length}</span></h3>
                    <div className="prw-progs">
                      {launch.toDecide.map((x) => (
                        <div key={x.key || x.title}><ProgramRow program={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} slot={programGroups.some((g) => g.programs.some((y) => (y.imageUrl ?? "").trim()))} onAsk={canRequest ? () => openRequest({ subject: `Question about: ${x.title}`, kind: "marketing" }) : undefined} /></div>
                      ))}
                    </div>
                  </section>
                )}

                {(launch.inProgress.length > 0 || launch.preparing.length > 0) && (
                  <section className="prw-lk" data-room-launch="progress">
                    <h3>{planned.length > 0 ? "Your marketing plan" : "In progress"}<span className="prw-num">{launch.inProgress.length + launch.preparing.length}</span></h3>
                    {planned.length > 0 && (
                      <p className="prw-plan-sum" data-room-plan-summary>
                        {[
                          `${planned.length} ${planned.length === 1 ? "program" : "programs"} you said yes to`,
                          planned.filter((p) => p.st.state === "team").length ? `${planned.filter((p) => p.st.state === "team").length} with your account team` : "",
                          planned.filter((p) => p.st.state === "new" || p.st.state === "in_progress").length ? `${planned.filter((p) => p.st.state === "new" || p.st.state === "in_progress").length} with marketing` : "",
                          planned.filter((p) => p.st.state === "review").length ? `${planned.filter((p) => p.st.state === "review").length} ready for your review` : "",
                          planned.filter((p) => p.st.state === "done").length ? `${planned.filter((p) => p.st.state === "done").length} done` : "",
                        ].filter(Boolean).join(" · ")}
                        . You can change a choice any time.
                      </p>
                    )}
                    <div className="prw-progs">
                      {launch.inProgress.map((x) => (
                        <div key={x.key || x.title}><ProgramRow program={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} slot={programGroups.some((g) => g.programs.some((y) => (y.imageUrl ?? "").trim()))} onAsk={canRequest ? () => openRequest({ subject: `Question about: ${x.title}`, kind: "marketing" }) : undefined} /></div>
                      ))}
                    </div>
                    {launch.preparing.length > 0 && (
                      <div className="prw-docs" style={{ marginTop: launch.inProgress.length ? 12 : 0 }}>
                        {launch.preparing.map((a, i) => (
                          <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} onOpen={openAsset} canRequest={canRequest} onRequest={() => openRequest({ subject: `Change to: ${a.title}`, kind: "asset_change", assetKey: a.key || roomMilestoneKey({ task: a.title }) })} />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {showMarketing && launch.later.length > 0 && (
                  <section className="prw-lk" data-room-launch="later">
                    <h3>Saved for later<span className="prw-num">{launch.later.length}</span></h3>
                    <div className="prw-progs">
                      {launch.later.map((x) => (
                        <div key={x.key || x.title}><ProgramRow program={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={() => setAsk({ kind: "email" })} slot={programGroups.some((g) => g.programs.some((y) => (y.imageUrl ?? "").trim()))} onAsk={canRequest ? () => openRequest({ subject: `Question about: ${x.title}`, kind: "marketing" }) : undefined} /></div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Our own brand material, last. In the builder the ones still missing a link or file are shown too, so they can be filled in. */}
                {showKit && (launch.collateral.length > 0 || (isEditor && launch.collateralEmpty.length > 0)) && (
                  <section className="prw-lk" data-room-launch="collateral">
                    <h3>{brand.brandName ? `${brand.brandName} collateral` : "Brand collateral"}</h3>
                    <div className="prw-docs">
                      {[...launch.collateral, ...(isEditor ? launch.collateralEmpty : [])].map((a, i) => (
                        <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} onOpen={openAsset} canRequest={false} onRequest={() => {}} />
                      ))}
                    </div>
                  </section>
                )}

              </>
            )}

            {active === "requests" && (
              <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Outstanding</h2>
                  </div>
                  <button type="button" className="prw-btn pri" onClick={() => openRequest()}>
                    <Plus aria-hidden /> Make a request
                  </button>
                </div>
                <OutstandingView
                  items={outstanding}
                  doneRequests={snapshot.requests.filter((q) => q.status === "done").map((q) => ({ id: q.id, subject: q.subject, by: q.by, when: fmtDate(q.createdAt) }))}
                  ourName={brandLabel}
                  theirName={partnerLabel}
                  isTeam={isTeam}
                  canAct={!!store && !!snapshot.viewer}
                  people={ourPeople}
                  onOpen={(m) => modules.some((x) => x.key === m) && m !== "requests" && setView(m as RoomModuleKey)}
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
                  onEditRequest={
                    canEditLive && store
                      ? async (id, patch) => {
                          const r = await store.updateRequest(id, patch);
                          return r.ok ? null : r.error;
                        }
                      : undefined
                  }
                />
                {!snapshot.viewer && !isEditor && (
                  <div className="prw-card" style={{ marginTop: 16 }}>
                    <div className="prw-li">
                      <div>
                        <div className="t">Confirm your email to see and make requests</div>
                        
                      </div>
                      <div className="a"><button type="button" className="prw-btn pri" onClick={() => setAsk({ kind: "email" })}><Mail aria-hidden /> Confirm email</button></div>
                    </div>
                  </div>
                )}
              </>
            )}

            {active === "team" && (
              <>
                <div className="prw-hd">
                  <div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Our Team</h2>
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
                      <TeamGroup key={gi} group={g} isEditor={isEditor} invite={gi > 0 ? teamInvite : null} />
                    ))}
                    {snapshot.contacts.length > 0 && (
                      <TeamGroup group={{ title: snapshot.contacts.some((c) => c.invited) ? `Also on ${props.partnerName}’s team` : `Added by ${props.partnerName}`, members: snapshot.contacts.map((c) => ({ name: c.name, role: c.role ?? undefined, email: c.email ?? undefined })) }} isEditor={isEditor} invite={teamInvite} />
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
          {roomFooterLine(props.partnerName, brand.brandName)}
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
      {ask?.kind === "contact" && store && <ContactDialog
          store={store}
          partnerName={props.partnerName}
          existing={[...team.slice(1).flatMap((g) => g.members ?? []).map((m) => ({ name: m.name, role: m.role, email: m.email })), ...snapshot.contacts.map((c) => ({ name: c.name, role: c.role ?? undefined, email: c.email ?? undefined }))].filter((m) => realName(m.name))}
          confirmKey={stepsOpen.find((x) => x.step.action === "team")?.key}
          onClose={() => setAsk(null)}
          onNeedEmail={() => setAsk({ kind: "email" })}
        />}
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

/** A due date as people read it: an ISO date becomes "Dec 5"; anything else ("Week 2") is shown as typed. */
export function planDue(v: string | undefined): string {
  const t = planCell(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m && MONTHS[+m[2] - 1] ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : t;
}

/** What a plan cell shows: a dash typed as a placeholder ("—", "-", "n/a") reads as empty. */
export function planCell(v: string | undefined): string {
  const t = (v ?? "").trim();
  return /^(—|–|-|n\/a)$/i.test(t) ? "" : t;
}

function PlanGroup({ group, rows, snapshot, store, isEditor, onNeedEmail, edit, cols, onGo }: { onGo?: (module: RoomModuleKey) => boolean; cols: { target: boolean; ours: boolean }; group: RoomPlanGroup; rows: PlanRow[]; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; edit: PlanEdit | null }) {
  // The account team edits one row at a time: the table stays plain text, and a pencil opens that row's fields.
  const [editing, setEditing] = useState<string | null>(null);
  const span = 4 + Number(cols.target) + Number(cols.ours);
  return (
    <>
      <tr className="grp">
        <td colSpan={span}>{group.title}</td>
      </tr>
      {rows.map((x) => (
        <Fragment key={x.key || x.ri}>
          <tr data-room-milestone={x.status} className={editing === x.key ? "on" : undefined}>
            {cols.target && <td className="c">{planDue(x.r.target)}</td>}
            <td>
              <div className="t"><E item={x.r} field="task" placeholder="Step" /></div>
              {x.saved?.done ? (
                <div className="m" data-room-received>
                  {[x.action === "upload" ? (x.saved.fileName ? `Received ${x.saved.fileName}` : "File received") : "Marked complete", x.saved.by, fmtDate(x.saved.at)].filter(Boolean).join(" · ")}
                </div>
              ) : (
                x.r.note && <div className="m"><E item={x.r} field="note" placeholder="Note" /></div>
              )}
              {x.action === "upload" && isRosterTask(x.key) && <RosterTemplateLink store={store} show={!isEditor && !!snapshot.viewer} />}
            </td>
            {cols.ours && <td className="c">{planCell(x.r.ourOwner)}</td>}
            <td className="c">{planCell(x.r.partnerOwner)}</td>
            <td>
              <span className={`prw-st ${x.status}`}>{ROOM_STATUS_LABEL[x.status]}</span>
            </td>
            <td className="r">
              <span className="prw-rowact">
                {x.action && <MilestoneAction row={x} snapshot={snapshot} store={store} isEditor={isEditor} onNeedEmail={onNeedEmail} onGo={onGo} />}
                {edit && (
                  <button type="button" className={`prw-ib${editing === x.key ? " on" : ""}`} title="Edit this milestone" aria-label={`Edit: ${x.r.task}`} aria-expanded={editing === x.key} onClick={() => setEditing((k) => (k === x.key ? null : x.key))} data-room-edit-row>
                    <PencilLine aria-hidden />
                  </button>
                )}
              </span>
            </td>
          </tr>
          {edit && editing === x.key && <PlanRowEditor row={x} edit={edit} span={span} onClose={() => setEditing(null)} />}
        </Fragment>
      ))}
      {group.checkpoint && (
        <tr className="chk">
          <td colSpan={span}>
            <b>Checkpoint</b> · {group.checkpoint}
          </td>
        </tr>
      )}
    </>
  );
}

/** One milestone's editable fields, in a strip under its row: target date, both owners and status, saved together. */
function PlanRowEditor({ row, edit, onClose, span }: { row: PlanRow; edit: PlanEdit; onClose: () => void; span: number }) {
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
      <td colSpan={span}>
        <div className="f">
          <label>
            <span>Target date</span>
            <input className="prw-pick" value={target} onChange={(e) => setTarget(e.target.value)} />
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
      {error && <span className="prw-err" role="alert">{error}</span>}
    </div>
  );
}

function MilestoneAction({ row, snapshot, store, isEditor, onNeedEmail, onGo }: { row: PlanRow; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; /** Open another part of the hub, for a step that is really done there. Returns false when that part is hidden. */ onGo?: (module: RoomModuleKey) => boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  // The brand step takes the logo too: a picture that becomes the hub's logo as soon as it is uploaded.
  const takesLogo = ROOM_LOGO_STEP_KEYS.has(row.key);
  const hasLogo = takesLogo && roomLogoUploaded(snapshot.tasks);
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
  // One button a step, never a stack: the thing to do next. Anything else the step can take (marking it done once you
  // have been to the other tab, the second file, replacing or undoing) is a quiet link under it.
  const hint = row.action === "upload" ? (done ? "Replace the file" : (row.r.uploadLabel ?? "").trim() || ROOM_UPLOAD_STEP_KEYS[row.key] || "Upload a file") : done ? "Mark as not done" : "Mark complete";
  const shortcut = !done && onGo ? ROOM_STEP_SHORTCUTS[row.key] : undefined;
  const pickLogo = () => {
    if (isEditor || busy) return;
    if (!store || !snapshot.viewer) return onNeedEmail();
    logoRef.current?.click();
  };
  const ownLabel = row.action === "upload" ? (takesLogo ? (done ? "Replace guidelines" : "Upload guidelines") : done ? "Replace" : "Upload") : done ? "Undo" : "Complete";
  const logoLabel = hasLogo ? "Replace logo" : "Upload logo";
  // Which of the step's actions is the button. A step that sends you elsewhere leads with that; the brand step leads
  // with the logo until there is one; a finished step has no button at all.
  const lead: "shortcut" | "logo" | "own" | null = done ? null : shortcut ? "shortcut" : takesLogo && !hasLogo ? "logo" : "own";
  const ownAs = lead === "own" ? "button" : "link";
  const logoAs = lead === "logo" ? "button" : "link";
  return (
    <span className="prw-act">
      {shortcut && (
        <button type="button" className="prw-btn pri" onClick={() => !isEditor && onGo!(shortcut.module)} title={shortcut.hint} data-room-step-go={shortcut.module}>
          {shortcut.label}
        </button>
      )}
      {takesLogo && logoAs === "button" && (
        <button type="button" className="prw-btn pri" onClick={pickLogo} disabled={busy} title="Upload your logo (PNG or JPG). It goes on the hub and on everything we make for you." aria-label="Upload your logo" data-room-action="logo">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {busy ? "Saving" : logoLabel}
        </button>
      )}
      {ownAs === "button" && (
        <button type="button" className="prw-btn pri" onClick={click} disabled={busy} data-room-action={row.action} title={hint} aria-label={`${hint}: ${row.r.task}`}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : row.action === "upload" ? <Upload aria-hidden /> : <Check aria-hidden />}
          {busy ? "Saving" : ownLabel}
        </button>
      )}
      {ownAs === "link" && (
        <button type="button" className="prw-sub" onClick={click} disabled={busy} data-room-action={row.action} title={hint} aria-label={`${hint}: ${row.r.task}`}>
          {busy ? "Saving…" : shortcut ? "Mark as done" : ownLabel}
        </button>
      )}
      {takesLogo && logoAs === "link" && (
        <button type="button" className="prw-sub" onClick={pickLogo} disabled={busy} title={hasLogo ? "Replace your logo (PNG or JPG)" : "Upload your logo (PNG or JPG)"} aria-label={hasLogo ? "Replace your logo" : "Upload your logo"} data-room-action="logo">
          {logoLabel}
        </button>
      )}
      {takesLogo && !isEditor && (
        <input
          ref={logoRef}
          type="file"
          accept={ROOM_LOGO_ACCEPT}
          hidden
          aria-label="Upload your logo"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!/\.(png|jpe?g)$/i.test(file.name)) return setError("Upload your logo as a PNG or JPG.");
            void run((s) => s.upload(ROOM_LOGO_TASK_KEY, file));
          }}
        />
      )}
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
/** The two uploads every hub asks for first: the practice list and the doctor roster. */
export function roomFirstStep(key: string, task: string): "practices" | "doctors" | null {
  const text = `${key} ${task}`.toLowerCase();
  if (/doctor|provider|dentist/.test(text) && /roster|list/.test(text)) return "doctors";
  if (/(practice|location|office)s?[- ](roster|list)/.test(text)) return "practices";
  return null;
}

export const isRosterTask = (key: string) => /roster|practice-list|doctor/.test(key);

/* ── Launch kit ──────────────────────────────────────────────────────────── */

/** A link as someone outside the hub can open it: a file in our own storage is saved as a path ("/api/storage/…"), which is no use pasted into an email. */
export function absoluteLink(url: string, origin: string): string {
  const u = url.trim();
  if (!u || /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//")) return u;
  return `${origin.replace(/\/+$/, "")}${u.startsWith("/") ? "" : "/"}${u}`;
}

function CopyButton({ text, label, link = false }: { text: string; label: string; /** The text is a web address: copy it in full, with the site in front of a path. */ link?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="prw-ib"
      title={copied ? "Copied" : label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(link ? absoluteLink(text, window.location.origin) : text).then(() => {
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
          {asset.kind === "link" && viewHref && <CopyButton text={viewHref} label="Copy link" link />}
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


function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/* ── Request forms: the right questions for what is being asked ───────────── */

export interface RequestField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** "long" = a text area; "half" = shares a row with the next half-width field. */
  size?: "long" | "half";
  autoComplete?: string;
}

export interface RequestForm {
  title: string;
  intro: string;
  fields: RequestField[];
  submit: string;
}

const SHIPPING_FORM: RequestForm = {
  title: "Where should we send it?",
  intro: "We’ll confirm before it ships.",
  submit: "Send details",
  fields: [
    { key: "recipient", label: "Name", required: true, autoComplete: "name" },
    { key: "company", label: "Company or office", autoComplete: "organization" },
    { key: "street", label: "Street address", required: true, autoComplete: "address-line1" },
    { key: "suite", label: "Suite, floor or unit", autoComplete: "address-line2" },
    { key: "city", label: "City", required: true, size: "half", autoComplete: "address-level2" },
    { key: "state", label: "State", required: true, size: "half", autoComplete: "address-level1" },
    { key: "zip", label: "ZIP code", required: true, size: "half", autoComplete: "postal-code" },
    { key: "phone", label: "Phone", size: "half", autoComplete: "tel" },
    { key: "notes", label: "Anything we should know", placeholder: "Delivery hours, who to ask for, how many people it’s for", size: "long" },
  ],
};

/** What the headline says when nobody typed one, with the customer's name left as a variable. */
export function roomHeadlineDefault(brandName: string | undefined): string {
  const brand = (brandName ?? "").trim();
  return brand ? `{{account}} × ${brand} Partnership Hub` : "{{account}} Partnership Hub";
}

/** The cover headline: what was typed, else "Customer × Us Partnership Hub". */
export function roomHeadline(headline: string | undefined, partnerName: string | undefined, brandName: string | undefined): string {
  const typed = (headline ?? "").trim();
  if (typed) return typed;
  return roomHeadlineDefault(brandName).replace("{{account}}", (partnerName ?? "").trim()).trim();
}

/** The small label above the customer's name. The logos already say who we are, so a leading brand name is dropped ("Dandy Partner Hub" reads "Partner Hub"). */
export function coverLabel(eyebrow: string | undefined, brandName: string | undefined): string {
  const label = (eyebrow ?? "").trim();
  const brand = (brandName ?? "").trim();
  if (!brand || !label.toLowerCase().startsWith(`${brand.toLowerCase()} `)) return label;
  return label.slice(brand.length).trim();
}

/** The top-bar booking button says "Schedule" unless a rep typed their own words (the old default counts as none). */
export function scheduleButtonLabel(label: string | undefined): string {
  const typed = (label ?? "").trim();
  return !typed || typed.toLowerCase() === "schedule a meeting" ? "Schedule" : typed;
}

/** Every other request: the same four questions whatever it is about, so requests line up in one table. */
const GENERAL_FORM: RequestForm = {
  title: "Make a request",
  intro: "Your account team will follow up. You can track it under Outstanding.",
  submit: "Send request",
  fields: [
    { key: "details", label: "Details", required: true, size: "long", placeholder: "Tell us what you need" },
    { key: "by", label: "Needed by", placeholder: "Nov 21" },
  ],
};

/** The setup step that accepts the welcome gift: the one request that asks where to ship something. */
export function isGiftStep(step: { key?: string; title?: string }): boolean {
  return step.key === "onboard-gift" || /\bwelcome (gift|kit)s?\b|\bgift\b/i.test(step.title ?? "");
}

/** The questions a request asks: a shipping address for the welcome gift, the general form for everything else. */
export function requestFormFor(form?: "shipping"): RequestForm {
  return form === "shipping" ? SHIPPING_FORM : GENERAL_FORM;
}

/** The answers as the request's details: one "Label: answer" line each, blanks left out. */
export function requestDetails(form: RequestForm, values: Record<string, string>): string {
  // The general form's details are the customer's own words, with the date they need it by on a line of its own.
  if (form === GENERAL_FORM) return [(values.details ?? "").trim(), (values.by ?? "").trim() ? `Needed by: ${values.by.trim()}` : ""].filter(Boolean).join("\n");
  return form.fields
    .map((f) => [f.label, (values[f.key] ?? "").trim()] as const)
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n");
}

function RequestDialog({ store, preset, onClose, onSent, onNeedEmail }: { store: RoomStoreHandle; preset?: RequestPreset; onClose: () => void; onSent: (stepKey?: string) => void; onNeedEmail: () => void }) {
  const [kind, setKind] = useState(preset?.kind ?? (preset?.assetKey ? "asset_change" : "other"));
  const [subject, setSubject] = useState(preset?.subject ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);
  const form = requestFormFor(preset?.form);
  const shipping = form === SHIPPING_FORM;
  const missing = form.fields.some((f) => f.required && !(values[f.key] ?? "").trim());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await store.sendRequest({ kind, subject: subject.trim() || form.title, details: requestDetails(form, values), assetKey: preset?.assetKey });
    setBusy(false);
    if (r.ok) onSent(preset?.stepKey);
    else if (r.identityRequired) onNeedEmail();
    else setError(r.error);
  };
  const input = (f: RequestField) => {
    const common = { id: `prw-rf-${f.key}`, value: values[f.key] ?? "", placeholder: f.placeholder, required: f.required, autoComplete: f.autoComplete, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f.key]: e.target.value })) };
    return (
      <div key={f.key} className={`prw-rf${f.size === "half" ? " half" : ""}`}>
        <label htmlFor={common.id}>{f.label}{f.required ? "" : <span> (optional)</span>}</label>
        {f.size === "long" ? <textarea rows={3} maxLength={1500} {...common} /> : <input maxLength={200} {...common} />}
      </div>
    );
  };
  return createPortal(
    <div className="prw prw-modal" style={{ background: "rgba(0,20,16,.5)" }} onClick={onClose} data-room-request-dialog>
      <form className="box" onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ fontFamily: BRAND_BODY_STACK }} data-room-request-form={shipping ? "shipping" : "general"}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X style={{ width: 16, height: 16 }} /></button>
        <h3>{shipping ? subject || form.title : form.title}</h3>
        <p>{form.intro}</p>
        {!shipping && (
          <>
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
            <input id="prw-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />
          </>
        )}
        <div className="prw-rfs">{form.fields.map(input)}</div>
        {error && <div className="prw-err" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="prw-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="prw-btn pri" disabled={busy || missing} style={{ background: "#0E1A16", borderColor: "#0E1A16", color: "#fff" }}>
            {busy ? "Sending…" : form.submit}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** "Who are you?" — a work email once, then a link by email (or a request to the team). */
/**
 * The door to a hub that asks for an email: one field, and what happens next.
 * An address the hub knows is emailed a link that opens it; anyone else is
 * passed to the account team to approve.
 */
function RoomGate({ store, loading, partner, brandName }: { store: RoomStoreHandle | null; loading: boolean; partner: string; brandName: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"sent" | "requested" | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !store) return;
    setBusy(true);
    setError("");
    const r = await store.requestAccess(email.trim());
    setBusy(false);
    if (r.ok) setResult(r.status);
    else setError(r.error);
  };
  return (
    <div className="prw-gate" data-room-gate-card>
      {/* A returning visitor is recognised in a moment: show nothing to fill in until we know they aren't. */}
      {loading ? (
        <p className="wait">Opening…</p>
      ) : result === "sent" ? (
        <>
          <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Check your inbox</h2>
          <p>We sent a link to <b>{email.trim()}</b>. Open it on this device.</p>
        </>
      ) : result === "requested" ? (
        <>
          <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Thanks, we’ve let the team know</h2>
          <p><b>{email.trim()}</b> isn’t on the list yet. We’ll email your link once you’re added.</p>
        </>
      ) : (
        <form onSubmit={submit}>
          <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Enter your work email to get started</h2>
          <p>We’ll email you a link that opens the hub.</p>
          <div className="row">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Work email" data-room-gate-email />
            <button type="submit" className="prw-btn pri" disabled={busy || !store}>{busy ? "Sending…" : "Continue"}</button>
          </div>
          {error && <div className="prw-err" role="alert">{error}</div>}
          <small>Already have a link from your {brandName || "account"} team? Open that instead and you’ll skip this step.</small>
        </form>
      )}
    </div>
  );
}

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
            <h3>Verify your email</h3>
            <p>We’ll send a secure link to your work email.</p>
            <label htmlFor="prw-email">Work email</label>
            <input id="prw-email" ref={inputRef} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                ? `We sent a link to ${email.trim()}. Open it on this device to continue. It stays valid for 90 days.`
                : `${email.trim()} isn’t on this room’s list yet, so we’ve asked the team to add you. You’ll be able to request your link once they do.`}
            </p>
            <div className="row">
              <button type="button" className="prw-btn pri" onClick={onClose} style={{ ...solid, width: "auto" }}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Team ────────────────────────────────────────────────────────────────── */

type TeamInvite = { invited: string[]; send: (person: { email: string; name: string }) => Promise<string | null> };

/** "Invite" beside one of the customer's people: emails them their link to the hub. Shows "Invited" once they have been let in. */
function InviteButton({ person, invite }: { person: { email: string; name: string }; invite: TeamInvite }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  if (sent || invite.invited.includes(person.email.trim().toLowerCase())) return <span className="prw-inv done" data-room-invited><Check aria-hidden /> Invited</span>;
  return (
    <button
      type="button"
      className="prw-inv"
      disabled={busy}
      title={error || `Email ${person.name} a link to this hub`}
      data-room-invite
      onClick={async () => {
        setBusy(true);
        setError("");
        const err = await invite.send(person);
        setBusy(false);
        if (err) setError(err);
        else setSent(true);
      }}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />} {error ? "Try again" : "Invite"}
    </button>
  );
}

function TeamGroup({ group, isEditor, invite }: { group: RoomTeamGroup; isEditor: boolean; /** Set on the customer's groups when the account team is looking at the live hub. */ invite?: TeamInvite | null }) {
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
              {invite && email && realTeamName(m.name) && <InviteButton person={{ email, name: m.name }} invite={invite} />}
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

function OnboardingStep({ step, stepKey, done, saved, snapshot, store, isEditor, onNeedEmail, onAddTeam, onRequest, teamCount = 0, bare = false }: { /** Only the step's buttons, for a list that already names the step (Outstanding). */ bare?: boolean; /** How many of the customer's people are already on the team list. */ teamCount?: number; step: RoomOnboardingStep; stepKey: string; done: boolean; saved: RoomSnapshot["tasks"][string] | undefined; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; onAddTeam: () => void; onRequest: () => void }) {
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
  // People are already listed (from the account, or added earlier): say so, so nobody adds them twice.
  const already = step.action === "team" && teamCount > 0;
  const summary = saved?.done ? [saved.fileName ? `Received ${saved.fileName}` : "Done", saved.by, fmtDate(saved.at)].filter(Boolean).join(" · ") : step.done ? "Done" : already ? `${teamCount} ${teamCount === 1 ? "person is" : "people are"} already listed. Check the list and add anyone who is missing.` : step.description;
  const buttons = !done && (
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
            <button type="button" className="prw-btn pri" onClick={guard(onAddTeam)} title={already ? "See who is listed, and add anyone missing" : label || "Add people"} data-room-team-step={already ? "review" : "add"}>
              <UserPlus aria-hidden /> {already ? "Review" : "Add"}
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
  );
  if (bare) {
    return (
      <span className="prw-act prw-o-act" data-room-step-inline={step.action}>
        {buttons}
        {error && <span className="prw-err" role="alert" style={{ whiteSpace: "normal" }}>{error}</span>}
      </span>
    );
  }
  return (
    <div className={`prw-step${done ? " done" : ""}`} data-room-step={step.action}>
      <span className="dot">{done ? <Check style={{ width: 12, height: 12 }} aria-hidden /> : null}</span>
      <div style={{ minWidth: 0 }}>
        <div className="t">{step.title}</div>
        {summary && <div className="m">{summary}</div>}
        {error && <div className="prw-err" role="alert">{error}</div>}
      </div>
      {buttons}
    </div>
  );
}

function ContactDialog({ store, partnerName, existing, confirmKey, onClose, onNeedEmail }: { store: RoomStoreHandle; partnerName: string; /** The customer's people already on the team list. */ existing: { name: string; role?: string; email?: string }[]; /** The "add your team" setup step, when it is still open: "Looks right" ticks it. */ confirmKey?: string; onClose: () => void; onNeedEmail: () => void }) {
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
  // Typing someone who is already listed: say so instead of adding them twice.
  const same = (a: string | undefined, b: string) => !!a?.trim() && !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
  const duplicate = existing.find((p) => same(p.email, email) || same(p.name, name));
  return createPortal(
    <div className="prw prw-modal" style={{ background: "rgba(0,20,16,.5)" }} onClick={onClose} data-room-contact-dialog>
      <form className="box" onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ fontFamily: BRAND_BODY_STACK }}>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><X style={{ width: 16, height: 16 }} /></button>
        <h3>{existing.length ? "Your team" : "Add your team"}</h3>
        {existing.length > 0 ? (
          <>
            <p>Already listed:</p>
            <ul className="prw-have" data-room-team-existing>
              {existing.map((p, i) => (
                <li key={i}><b>{p.name}</b>{p.role ? <span> · {p.role}</span> : null}</li>
              ))}
            </ul>
            {confirmKey && added === 0 && (
              <button type="button" className="prw-btn" style={{ marginBottom: 6 }} disabled={busy} onClick={async () => { const r = await store.setTaskDone(confirmKey, true); if (r.ok) onClose(); else if (r.identityRequired) onNeedEmail(); else setError(r.error); }} data-room-team-confirm>
                <Check aria-hidden /> Looks right, nobody to add
              </button>
            )}
            <div className="prw-have-h">Add someone else</div>
          </>
        ) : (
          <p>Who should we work with at {partnerName}?</p>
        )}
        <label htmlFor="prw-cname">Name</label>
        <input id="prw-cname" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <label htmlFor="prw-crole">Role</label>
        <input id="prw-crole" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
        <label htmlFor="prw-cemail">Email</label>
        <input id="prw-cemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <div className="prw-err" role="alert">{error}</div>}
        {duplicate && <div style={{ fontSize: 12.5, color: "#7A6100", marginTop: 8 }} data-room-team-duplicate>{duplicate.name} is already on the list.</div>}
        {added > 0 && <div style={{ fontSize: 12.5, color: "#0B6B3A", marginTop: 8 }}>{added} added. Add another, or close.</div>}
        <div className="row">
          <button type="button" className="prw-btn" onClick={onClose}>{added ? "Done" : "Cancel"}</button>
          <button type="submit" className="prw-btn pri" disabled={busy || !name.trim() || !!duplicate} style={solid}>{busy ? "Adding…" : "Add person"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/* ── Marketing plan ──────────────────────────────────────────────────────── */

/**
 * One marketing program: a line that opens for more, and one tick to put it
 * in the plan. Grey until chosen, green once it is in; ticking it again
 * takes it back out (it moves to Saved for later). A program with several
 * ways to say yes (dinner or onsite training) opens to show them.
 */
function ProgramRow({ program, snapshot, store, isEditor, onNeedEmail, slot, onAsk }: { program: RoomProgram; snapshot: RoomSnapshot; store: RoomStoreHandle | null; isEditor: boolean; onNeedEmail: () => void; /** Some program on the page has a picture: ones without get a quiet placeholder so the text lines up. */ slot: boolean; /** Ask the team about this program (opens a request). */ onAsk?: () => void }) {
  const key = roomMilestoneKey({ key: program.key, task: program.title });
  const options = roomProgramOptions(program);
  const chosen = snapshot.choices[key];
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
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
  const canChoose = options.length >= 2;
  const declined = !!chosen && !!no && chosen.value === no;
  const included = !canChoose || (!!chosen && !declined);
  const details = (program.details ?? "").trim();
  const links = (program.links ?? []).filter((l) => safeHttpUrl(l.url) && (l.label ?? "").trim());
  // The tick: in → out again; out → in (or, with several ways to say yes, open the row to pick one).
  const toggle = () => {
    if (!canChoose) return;
    if (included) return no ? void pick(no) : undefined;
    if (yes.length === 1) return void pick(yes[0]);
    setOpen(true);
  };
  const state = !canChoose ? "fixed" : declined ? "declined" : chosen ? "chosen" : "open";
  // Where a yes has got to: with the account team, with marketing, ready for review, done.
  const status = roomProgramStatus(key, chosen, snapshot.requests);
  return (
    <div className={`prw-prog${included ? " in" : ""}${open ? " open" : ""}`} data-room-program={state}>
      <div className="hd">
        {image ? <img className="im" src={image} alt="" loading="lazy" /> : slot ? <span className="im ph" aria-hidden><Megaphone /></span> : null}
        <div className="tx" onClick={isEditor ? undefined : () => setOpen((o) => !o)} style={isEditor ? undefined : { cursor: "pointer" }}>
          <h3><E item={program} field="title" placeholder="Program" /></h3>
          {(program.description || isEditor) && <p><E item={program} field="description" multiline placeholder="What it is" /></p>}
          {(program.audience || program.when) && <div className="meta">{[program.audience, program.when].filter(Boolean).join(" · ")}{chosen && !declined && yes.length > 1 ? ` · ${chosen.value}` : ""}{status && <span className={`prw-chip ${status.state === "team" ? "new" : status.state}`} data-room-program-status={status.state}>{status.label}</span>}</div>}
        </div>
        <button type="button" className="prw-more" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details: ${program.title}`} onClick={() => setOpen((o) => !o)} data-room-program-more>
          <ChevronDown aria-hidden />
        </button>
        <button
          type="button"
          className={`prw-tick${included ? " on" : ""}`}
          aria-pressed={included}
          aria-label={!canChoose ? `Included: ${program.title}` : included ? `In the plan. Click to take out: ${program.title}` : `Add to the plan: ${program.title}`}
          title={!canChoose ? program.fixedLabel || "Included in every partnership" : included ? `In the plan${chosen?.by ? ` · ${chosen.by} · ${fmtDate(chosen.at)}` : ""}. Click to take it out.` : "Add to the plan"}
          disabled={!canChoose || !!busy}
          onClick={toggle}
          data-room-tick={included ? "on" : "off"}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="more" data-room-program-details>
          {details ? details.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>) : isEditor ? <p className="hint">Add more about this program in the builder panel: what it involves and what the customer needs to do.</p> : null}
          <dl>
            {program.audience && (<><dt>Who it’s for</dt><dd>{program.audience}</dd></>)}
            {program.when && (<><dt>When</dt><dd>{program.when}</dd></>)}
            {!canChoose && (<><dt>Status</dt><dd>{program.fixedLabel || "Included in every partnership"}</dd></>)}
            {chosen?.by && (<><dt>{declined ? "Saved for later by" : "Added by"}</dt><dd>{chosen.by} · {fmtDate(chosen.at)}</dd></>)}
            {status && (<><dt>Where it is</dt><dd>{status.line}{status.owner ? ` Owner: ${status.owner}.` : ""}{status.due ? ` Due ${status.due}.` : ""}</dd></>)}
          </dl>
          {links.length > 0 && (
            <div className="links">
              {links.map((l, i) => (
                <a key={i} href={isEditor ? undefined : safeHttpUrl(l.url)} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> {l.label}</a>
              ))}
            </div>
          )}
          {canChoose && yes.length > 1 && (
            <div className="opts">
              <span>Choose one:</span>
              <span className="prw-seg">
                {yes.map((o) => (
                  <button key={o} type="button" className={chosen?.value === o ? "on" : ""} aria-pressed={chosen?.value === o} disabled={!!busy} onClick={() => void pick(o)}>
                    {busy === o ? "Saving" : o}
                  </button>
                ))}
              </span>
            </div>
          )}
          <div className="acts">
            {onAsk && <button type="button" className="prw-btn" onClick={onAsk}>Ask about this</button>}
            {canChoose && no && !declined && !included && <button type="button" className="prw-linkbtn" disabled={!!busy} onClick={() => void pick(no)} data-room-program-later>Not for us right now</button>}
          </div>
          {error && <span className="prw-err" role="alert">{error}</span>}
        </div>
      )}
      {!open && error && <span className="prw-err" role="alert">{error}</span>}
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
    const url = URL.createObjectURL(new Blob([eventIcs(event.practices ? { ...event, detail: event.practices.join(", ") } : event, calendarName)], { type: "text/calendar" }));
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
        <div className="t">{event.startsAt || event.practice || event.practices ? event.title : <E item={event} field="title" placeholder="Event" />}</div>
        {event.practices ? (
          <details className="prw-trainings" data-room-trainings={event.practices.length}>
            <summary>Show practices</summary>
            <ul>{event.practices.map((p) => <li key={p}>{p}</li>)}</ul>
          </details>
        ) : (
        <div className="m">
          {[event.time, event.detail].filter(Boolean).join(" · ")}
          {kind && <>{event.time || event.detail ? " · " : ""}<span className={`prw-chip ${kind === "meeting" ? "kind" : kind}`}>{ROOM_EVENT_KIND_LABEL[kind]}</span></>}
        </div>
        )}
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
    <div className="prw-months">
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
    </div>
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
