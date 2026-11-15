import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, ExternalLink, Loader2, Mail, Plus, Upload, X } from "lucide-react";
import type { BrandConfig } from "@/lib/brand-config";
import { contrastTextColor, isValidHex } from "@/lib/brand-config";
import { BRAND_BODY_STACK, BRAND_DISPLAY_STACK } from "@/lib/brand-fonts";
import { usePageContext } from "@/lib/page-context";
import { InlineText } from "@/components/InlineText";
import { BrandLogo, brandHasLogo } from "@/components/BrandLogo";
import { trackHubAsset, type HubAsset } from "./hub/hub-assets";
import { ROOM_UPLOAD_ACCEPT, useRoom, type RoomRequest, type RoomSnapshot, type RoomStoreHandle } from "./hub/room-client";

/* ----------------------------------------------------------------------------
 * Partner Room — Workspace — type "room-workspace"
 *
 * A full-page customer workspace for an enterprise partnership, in place of a
 * shared tracker spreadsheet and a media-kit document: a branded cover (both
 * names, where the rollout stands) over a paper sheet with a module list down
 * the side. Each module is a view:
 *
 *   overview   rollout track, what needs the customer's attention, counts
 *   plan       the mutual action plan: milestones by phase, an owner on each
 *              side, target date, status, a checkpoint per phase. Milestones
 *              can be the customer's to complete (tick it, or upload a file)
 *   kit        launch-kit assets: View / Download / Request changes, plus links
 *   requests   everything the customer asked for and where it stands
 *   team       named people on both sides
 *
 * Any module can be hidden per account (`hiddenModules`), so a rep tailors the
 * room in the builder. Customer actions (tick, upload, request) go through
 * the partner-room API (blocks/hub/room-client.ts) and need a known visitor:
 * a personal link, or a link emailed to an allowed address. Uploads are one
 * way: the page only ever shows that a file was received.
 *
 * Visual language: the brand's dark colour for the cover and table headers,
 * paper for the sheet, a semantic green for progress and "done"; small type,
 * hairlines, 8–14px corners. NO_REVEAL — it is an app surface, not a
 * scroll-animated page.
 * -------------------------------------------------------------------------- */

export type RoomModuleKey = "overview" | "plan" | "kit" | "requests" | "team";
export const ROOM_MODULES: { key: RoomModuleKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "plan", label: "Action plan" },
  { key: "kit", label: "Launch kit" },
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
}

export interface RoomPlanGroup {
  title: string;
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
}

export interface RoomTeamMember {
  name: string;
  role?: string;
  owns?: string;
  when?: string;
  email?: string;
  photoUrl?: string;
}
export interface RoomTeamGroup {
  title: string;
  members: RoomTeamMember[];
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
  links?: { title: string; description?: string; url: string }[];
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
.prw{--ink:#0E1A16;--body:#5C6B61;--faint:#9AA69E;--line:#E7E7E0;--paper:#FCFCFA;--page:#F3F4EF;--green:#1AC065;--blue:#224EA0;--amber:#A98600;--red:#B42318;background:var(--page);color:var(--ink);font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}
.prw *{box-sizing:border-box}
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
.prw-sheet{margin-top:-64px;position:relative;display:grid;grid-template-columns:208px minmax(0,1fr);background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 60px -32px rgba(0,0,0,.35);min-height:520px}
.prw-toc{padding:30px 0 30px 28px;border-right:1px solid var(--line)}
.prw-toc .h{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin-bottom:10px}
.prw-toc button{display:flex;gap:10px;align-items:center;width:100%;padding:6px 18px 6px 0;font-size:13px;color:var(--body);font-weight:500;background:none;border:0;text-align:left}
.prw-toc button .n{color:var(--faint);width:16px}
.prw-toc button em{margin-left:auto;font-style:normal;font-size:11px;font-weight:600;color:var(--amber);white-space:nowrap}
.prw-toc button.on{color:var(--dark);font-weight:600}
.prw-toc button.on .n{color:var(--green)}
.prw-toc .who{margin:18px 18px 0 0;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--body)}
.prw-toc .who b{display:block;color:var(--ink);font-size:12.5px;word-break:break-word}
.prw-mod{padding:36px 40px 40px;min-width:0}
.prw-hd{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:18px}
.prw-hd h2{font-size:26px;line-height:1.15;letter-spacing:-.025em;font-weight:700;color:var(--dark);margin:6px 0 0}
.prw-hd p{margin:6px 0 0;color:var(--body);max-width:64ch}
.prw-meta{font-size:12.5px;color:var(--body);white-space:nowrap}
.prw-meta b{color:var(--dark)}
.prw-track{position:relative;height:6px;background:#E6E9E3;border-radius:3px;margin:30px 0 16px}
.prw-track i{position:absolute;inset:0 auto 0 0;background:var(--green);border-radius:3px}
.prw-track b{position:absolute;top:-5px;width:2px;height:16px;background:var(--dark)}
.prw-track em{position:absolute;top:-27px;transform:translateX(-50%);font-style:normal;font-size:11.5px;font-weight:700;color:var(--dark);white-space:nowrap}
.prw-phases{display:grid;grid-template-columns:repeat(var(--cols,3),1fr)}
.prw-ph{padding-right:22px}
.prw-ph+.prw-ph{padding-left:22px;border-left:1px solid var(--line)}
.prw-ph .d{font-size:12px;color:var(--body)}
.prw-ph h3{margin:2px 0 6px;font-size:15px;font-weight:700;color:var(--dark)}
.prw-ph p{margin:0;font-size:13px;color:var(--body)}
.prw-st{font-size:12px;font-weight:600;white-space:nowrap}
.prw-st.done{color:var(--green)}.prw-st.on-track,.prw-st.current{color:var(--blue)}.prw-st.pending{color:var(--amber)}.prw-st.blocking{color:var(--red)}.prw-st.not-started,.prw-st.upcoming{color:var(--faint)}
.prw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.prw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:26px}
.prw-kpi{border:1px solid var(--line);border-radius:10px;background:#fff;padding:14px 16px}
.prw-kpi .k{font-size:12px;color:var(--body)}
.prw-kpi .v{font-size:24px;font-weight:700;letter-spacing:-.025em;color:var(--dark);margin-top:4px}
.prw-kpi .v small{font-size:12.5px;font-weight:500;color:var(--body);letter-spacing:0}
.prw-card{border:1px solid var(--line);border-radius:10px;background:#fff;overflow:hidden}
.prw-card>h3{margin:0;padding:12px 16px;font-size:13.5px;font-weight:700;color:var(--dark);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
.prw-card>h3 button{font-size:12px;font-weight:600;color:var(--body);background:none;border:0;padding:0}
.prw-li{display:flex;gap:12px;align-items:center;padding:11px 16px;border-top:1px solid var(--line);font-size:13px}
.prw-li:first-of-type{border-top:0}
.prw-li .t{font-weight:600;color:var(--ink)}
.prw-li .m{font-size:12px;color:var(--body)}
.prw-li .a{margin-left:auto;display:flex;gap:6px;align-items:center;flex:none}
.prw-empty{padding:18px 16px;font-size:13px;color:var(--body)}
.prw table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.prw thead th{background:var(--dark);color:var(--on-dark);text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px}
.prw td{padding:11px 16px;border-top:1px solid var(--line);font-size:13.5px;vertical-align:middle}
.prw tr.grp td{background:color-mix(in srgb,var(--dark) 7%,#fff);color:var(--dark);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px}
.prw tr.chk td{background:#FAFBF8;font-size:12px;color:var(--body)}
.prw tr.chk td b{color:var(--green)}
.prw td .t{font-weight:600;color:var(--ink)}
.prw td .m{font-size:12px;color:var(--body);margin-top:1px}
.prw td.c{color:var(--body);white-space:nowrap}
.prw td.r{text-align:right;white-space:nowrap}
.prw-plan,.prw-reqs{table-layout:fixed}
.prw-plan td.c,.prw-reqs td.c{white-space:normal;overflow-wrap:break-word}
.prw-plan td,.prw-plan th{padding-left:12px;padding-right:12px}
.prw-reqs .prw-chip{white-space:normal}
.prw-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:7px;border:1px solid #D4D8D0;background:#fff;font-size:12.5px;font-weight:600;color:var(--dark);white-space:nowrap}
.prw-btn.pri{background:var(--dark);border-color:var(--dark);color:var(--on-dark)}
.prw-btn:disabled{opacity:.6;cursor:default}
.prw-btn svg{width:13px;height:13px}
.prw-link{background:none;border:0;padding:0;font-size:12.5px;font-weight:600;color:var(--dark);text-decoration:underline;text-underline-offset:2px}
.prw-legend{display:flex;gap:18px;margin-top:12px;font-size:12px}
.prw-err{color:var(--red);font-size:12.5px;margin-top:4px}
.prw-docs{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.prw-doc{display:flex;align-items:center;gap:14px;padding:12px 16px;border-top:1px solid var(--line)}
.prw-doc:first-child{border-top:0}
.prw-ft{width:34px;height:40px;border-radius:5px;border:1px solid var(--line);background:var(--paper);display:grid;place-items:end center;padding-bottom:5px;font-size:8.5px;font-weight:700;color:var(--dark);letter-spacing:.04em;flex:none;overflow:hidden}
.prw-ft.img{padding:0;place-items:stretch}
.prw-ft.img img{width:100%;height:100%;object-fit:cover}
.prw-doc .a{margin-left:auto;display:flex;gap:6px;flex:none}
.prw-body{border-top:1px solid var(--line);background:#FAFBF8;padding:14px 16px 16px 64px;font-size:13.5px;white-space:pre-wrap;color:var(--ink)}
.prw-chip{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--green) 14%,#fff);color:#0B6B3A;white-space:nowrap}
.prw-chip.review{background:#FBF3D9;color:#7A6100}.prw-chip.in_progress{background:#E8EEF9;color:var(--blue)}.prw-chip.new{background:#F1F2EE;color:var(--body)}
.prw-sum{display:flex;border:1px solid var(--line);border-radius:10px;background:#fff;margin-bottom:14px}
.prw-sum div{padding:12px 18px;border-left:1px solid var(--line);font-size:12.5px;color:var(--body)}
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
.prw-body{padding-left:16px}
.prw-team thead{display:none}
.prw-team td{display:block;border-top:0;padding:2px 14px;white-space:normal!important}
.prw-team td:first-child{padding-top:12px;border-top:1px solid var(--line)}
.prw-team td:last-child{padding-bottom:12px}
.prw-sum{flex-wrap:wrap}
}
`;

type Ask = { kind: "request"; preset?: { subject: string; assetKey?: string } } | { kind: "email" } | null;

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
  const groups = props.planGroups ?? [];

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
  const openRequest = (preset?: { subject: string; assetKey?: string }) => needViewer(() => setAsk({ kind: "request", preset }));

  const badge: Partial<Record<RoomModuleKey, string>> = {
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
                {(mine.length > 0 || reviewRequests.length > 0) && (
                  <div>
                    <b className="prw-num">{mine.length + reviewRequests.length}</b>
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
                <div className="prw-hd">
                  <div>
                    <div className="prw-eyebrow">Overview</div>
                    <h2 style={{ fontFamily: BRAND_DISPLAY_STACK }}>Where things stand</h2>
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
                  <div className="prw-kpi">
                    <div className="k">Plan items complete</div>
                    <div className="v prw-num">{doneCount} <small>of {rows.length}</small></div>
                  </div>
                  <div className="prw-kpi">
                    <div className="k">Yours to do</div>
                    <div className="v prw-num">{mine.length}</div>
                  </div>
                  <div className="prw-kpi">
                    <div className="k">Blocking</div>
                    <div className="v prw-num">{rows.filter((x) => x.status === "blocking").length}</div>
                  </div>
                  <div className="prw-kpi">
                    <div className="k">Open requests</div>
                    <div className="v prw-num">{snapshot.viewer ? openRequests.length : "—"}</div>
                  </div>
                </div>
                <div className="prw-grid2" style={{ marginTop: 14 }}>
                  <div className="prw-card">
                    <h3>
                      Needs your attention
                      {modules.some((m) => m.key === "plan") && (
                        <button type="button" onClick={() => setView("plan")}>Open action plan</button>
                      )}
                    </h3>
                    {mine.length === 0 && reviewRequests.length === 0 && <div className="prw-empty">Nothing is waiting on you.</div>}
                    {mine.slice(0, 4).map((x) => (
                      <div className="prw-li" key={x.key}>
                        <div>
                          <div className="t">{x.r.task}</div>
                          <div className="m">Action plan{x.r.target ? ` · due ${x.r.target}` : ""}</div>
                        </div>
                        <div className="a">
                          <button type="button" className="prw-btn" onClick={() => setView("plan")}>{x.action === "upload" ? "Upload" : "Open"}</button>
                        </div>
                      </div>
                    ))}
                    {reviewRequests.slice(0, 3).map((q) => (
                      <div className="prw-li" key={`q${q.id}`}>
                        <div>
                          <div className="t">{q.subject}</div>
                          <div className="m">Request · ready for your review</div>
                        </div>
                        <div className="a">
                          <button type="button" className="prw-btn" onClick={() => setView("requests")}>Review</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="prw-card">
                    <h3>Blocking</h3>
                    {rows.filter((x) => x.status === "blocking").length === 0 && <div className="prw-empty">Nothing is blocked.</div>}
                    {rows
                      .filter((x) => x.status === "blocking")
                      .slice(0, 4)
                      .map((x) => (
                        <div className="prw-li" key={x.key}>
                          <div>
                            <div className="t">{x.r.task}</div>
                            <div className="m">{[x.r.note, x.r.partnerOwner].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
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
                      <th style={{ width: 164 }} />
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
                <div className="prw-docs">
                  {(props.assets ?? []).map((a, i) => (
                    <AssetRow key={i} asset={a} isEditor={isEditor} onTrack={track} canRequest={modules.some((m) => m.key === "requests")} onRequest={() => openRequest({ subject: `Change to: ${a.title}`, assetKey: a.key || roomMilestoneKey({ task: a.title }) })} />
                  ))}
                  {(props.assets ?? []).length === 0 && <div className="prw-empty">Nothing here yet.</div>}
                </div>
                {(props.links ?? []).length > 0 && (
                  <>
                    <div className="prw-eyebrow" style={{ margin: "24px 0 10px" }}>Links</div>
                    <div className="prw-card">
                      {(props.links ?? []).map((l, i) => (
                        <div className="prw-li" key={i}>
                          <div>
                            <div className="t">{l.title}</div>
                            <div className="m">{l.description || l.url}</div>
                          </div>
                          <div className="a">
                            <CopyButton text={l.url} label="Copy link" />
                            <a className="prw-btn" href={isEditor ? undefined : l.url} target="_blank" rel="noreferrer">
                              <ExternalLink aria-hidden /> Open
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
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
                    {(props.team ?? []).map((g, gi) => (
                      <TeamGroup key={gi} group={g} isEditor={isEditor} />
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
        <div className="prw-foot">
          {props.partnerName} × {brand.brandName} · {props.eyebrow}
        </div>
      </div>

      {ask?.kind === "email" && store && <AccessDialog store={store} onClose={() => setAsk(null)} />}
      {ask?.kind === "request" && store && (
        <RequestDialog
          store={store}
          preset={ask.preset}
          onClose={() => setAsk(null)}
          onSent={() => {
            setAsk(null);
            if (modules.some((m) => m.key === "requests")) setView("requests");
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
  const label = row.action === "upload" ? (done ? "Replace file" : (row.r.uploadLabel ?? "").trim() || "Upload file") : done ? "Undo" : "Mark complete";
  return (
    <>
      <button type="button" className={`prw-btn${!done && row.action === "upload" ? " pri" : ""}`} onClick={click} disabled={busy} data-room-action={row.action}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : row.action === "upload" ? <Upload aria-hidden /> : <Check aria-hidden />}
        {busy ? "Working…" : label}
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
      className="prw-btn"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : label}
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
            <button type="button" className="prw-btn" onClick={() => { setOpen((v) => !v); if (!open) onTrack(asset, "view"); }}>
              {open ? "Hide" : "View"}
            </button>
          ) : (
            viewHref && (
              <a className="prw-btn" href={isEditor ? undefined : viewHref} target="_blank" rel="noreferrer" onClick={() => onTrack(asset, asset.kind === "link" ? "open" : "view")}>
                View
              </a>
            )
          )}
          {asset.kind === "text" && body && <CopyButton text={body} label="Copy text" />}
          {asset.kind === "link" && viewHref && <CopyButton text={viewHref} label="Copy link" />}
          {asset.kind !== "text" && asset.kind !== "link" && file && (
            <a className="prw-btn" href={isEditor ? undefined : file} download onClick={() => onTrack(asset, "download")}>
              <Download aria-hidden /> Download
            </a>
          )}
          {canRequest && (
            <button type="button" className="prw-btn" onClick={onRequest} data-room-request-change>
              Request changes
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

function RequestDialog({ store, preset, onClose, onSent, onNeedEmail }: { store: RoomStoreHandle; preset?: { subject: string; assetKey?: string }; onClose: () => void; onSent: () => void; onNeedEmail: () => void }) {
  const [kind, setKind] = useState(preset?.assetKey ? "asset_change" : "other");
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
    if (r.ok) onSent();
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
                <a className="prw-btn" href={isEditor ? undefined : `mailto:${email}`}>
                  <Mail aria-hidden /> Email
                </a>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
