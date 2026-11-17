/**
 * Partner room — browser side of the room state (who the visitor is, which
 * tasks are done) and the actions a visitor can take (ask for access, tick a
 * task, hand over a file). Talks to the public POST /api/lp/room/* routes.
 *
 * Identity travels with every call, never in a cookie:
 *   hl — the personal-link token (`?hl=` or the `hl_ctx` the /p/ resolver
 *        stores), when the visitor came through one;
 *   rt — the room token from the emailed link (`?rt=`), kept in localStorage
 *        per page so the browser stays recognized, and stripped from the
 *        address bar so it is not shared by copy-paste.
 *
 * One store per page id, shared by every block on the page.
 */
import { useEffect, useSyncExternalStore } from "react";
import { isTrackingSuppressed } from "./hub-assets";

export interface RoomTaskState {
  done: boolean;
  at: string;
  by?: string;
  fileName?: string;
}

export interface RoomRequest {
  id: number;
  kind: string;
  subject: string;
  status: "new" | "in_progress" | "review" | "done" | string;
  owner: string | null;
  due: string | null;
  assetKey: string | null;
  by: string;
  createdAt: string;
}

export interface RoomReaction {
  emoji: string;
  count: number;
  /** The viewer added this one. */
  mine: boolean;
}
/** Someone who can be tagged in the feed. The key stands in for their address, which the page never sees. */
export interface RoomPersonRef {
  key: string;
  name: string;
}
export interface RoomWinComment {
  id: number;
  body: string;
  /** Names tagged in the comment ("Dana Lee" for "@Dana Lee"). */
  mentions?: string[];
  side: "customer" | "team" | string;
  by: string;
  createdAt: string;
}
export interface RoomWin {
  id: number;
  body: string;
  headline: string | null;
  region: string | null;
  side: "customer" | "team" | string;
  by: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  /** Photos on the post. */
  images?: string[];
  /** Names tagged in the post. */
  mentions?: string[];
  /** Emoji reactions with counts. */
  reactions?: RoomReaction[];
  comments: RoomWinComment[];
}
export interface RoomContact {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
}

export interface RoomSnapshot {
  status: "idle" | "loading" | "ready" | "error";
  /** `team` is set when the viewer is one of the page owner's own team. */
  viewer: { email: string; name: string | null; team?: boolean } | null;
  tasks: Record<string, RoomTaskState>;
  /** The customer's requests to the team. Empty for an anonymous visitor. */
  requests: RoomRequest[];
  /** Decisions made on the page (marketing programs), by key. */
  choices: Record<string, { value: string; at: string; by?: string }>;
  /** The wins feed, newest first. */
  wins: RoomWin[];
  /** People who can be tagged (known visitors only). */
  people: RoomPersonRef[];
  /** People the customer added to their team. Empty for an anonymous visitor. */
  contacts: RoomContact[];
  /** Practice counts by stage and the regions present (no names: safe for any visitor). */
  practices: {
    total: number;
    byStage: Record<string, number>;
    regions: string[];
    scanners?: { total: number; practices: number };
    byRegion?: { region: string; total: number; live: number; trained: number }[];
    waves?: string[];
    /** One point per day the list was refreshed, oldest first. */
    trend?: { day: string; total: number; byStage: Record<string, number> }[];
    /** Doctors on the customer's roster, and how many sit at a practice we hold. */
    doctors?: { total: number; matched: number };
    /** When the list was last refreshed from its source (about hourly). */
    syncedAt?: string;
  };
  /** Meetings synced from the team's calendar (only ones with a customer guest). */
  events: RoomSyncedEvent[];
  /** Minutes the team published. */
  minutes: RoomSyncedMinutes[];
}

export interface RoomSyncedEvent {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}
export interface RoomSyncedMinutes {
  id: number;
  title: string;
  startsAt: string;
  allDay: boolean;
  attendees: string | null;
  summary: string;
  decisions: string[];
  actions: { text: string; owner?: string; due?: string; done?: boolean }[];
}

export interface RoomPractice {
  id: number;
  name: string;
  region: string | null;
  city: string | null;
  state: string | null;
  wave: string | null;
  stage: string;
  trainingDate: string | null;
  liveDate: string | null;
  scannerSent?: string | null;
  scannerActivated?: string | null;
  regionalManager?: string | null;
  scannerCount?: number | null;
  scannerModels?: string | null;
  scannerBrand?: string | null;
  contractSigned?: string | null;
  /** From the customer's roster. */
  address?: string | null;
  zip?: string | null;
  officeManager?: string | null;
  doctors?: { name: string; role: string | null }[];
  /** Team viewers only. */
  owner?: string | null;
  lastActivity?: string | null;
}
export type RoomPracticeSort = "name" | "region" | "wave" | "stage" | "trainingDate" | "liveDate" | "scannerSent" | "scannerActivated" | "regionalManager" | "scannerCount" | "scannerBrand" | "contractSigned" | "state" | "owner" | "lastActivity" | "officeManager" | "doctors";
/** A scorecard tile: one stage, or a group ("trained" includes live; "open" is everything not yet trained). */
export type RoomPracticeStageFilter = "not_started" | "scheduling" | "training_booked" | "trained" | "live" | "open";
/** Team only: how the customer's own rosters compare with what Salesforce lists. */
export interface RoomScorecardCheck {
  checked: boolean;
  fileName?: string;
  onRoster?: number;
  listed?: number;
  matched?: number;
  missingFromSalesforce?: string[];
  missingCount?: number;
  notOnRoster?: string[];
  notOnRosterCount?: number;
  doctors?: number | null;
  /** Doctors on the roster whose practice could not be matched to one we hold. */
  doctorsUnmatched?: number;
  /** Matched by a close name, not the ID or the exact name. */
  likely?: { roster: string; ours: string }[];
  /** Problems in the file itself (a doctor with no practice, a bad email). */
  issues?: string[];
  /** Practices that gained a regional manager, office manager or address from the roster. */
  enriched?: number;
}
export interface RoomPracticePage {
  total: number;
  page: number;
  pageSize: number;
  /** Which optional columns this room has any data for. */
  columns?: { scanner: boolean; scannerCount: boolean; manager: boolean; wave: boolean; brand?: boolean; contract?: boolean; owner?: boolean; activity?: boolean; address?: boolean; office?: boolean; doctors?: boolean };
  rows: RoomPractice[];
}

export type RoomActionResult = { ok: true } | { ok: false; error: string; identityRequired?: boolean };

/** Upload cap (matches the server): JSON bodies stop at 10 MB and base64 adds a third. */
export const ROOM_UPLOAD_MAX_BYTES = 7 * 1024 * 1024;
export const ROOM_UPLOAD_ACCEPT = ".xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.png,.jpg,.jpeg,.zip";

const NO_PRACTICES = { total: 0, byStage: {}, regions: [] };
const EMPTY: RoomSnapshot = { status: "idle", viewer: null, tasks: {}, requests: [], choices: {}, wins: [], people: [], contacts: [], practices: NO_PRACTICES, events: [], minutes: [] };
const rtKey = (pageId: number) => `lp_room_rt_${pageId}`;

function readHl(): string | undefined {
  try {
    const q = new URLSearchParams(window.location.search).get("hl");
    if (q) return q;
    const raw = sessionStorage.getItem("hl_ctx");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" && parsed.token ? parsed.token : undefined;
  } catch {
    return undefined;
  }
}

/** Take `?rt=` off the URL into localStorage (once), then read the stored token. */
function readRt(pageId: number): string | undefined {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("rt");
    if (fromUrl) {
      localStorage.setItem(rtKey(pageId), fromUrl);
      url.searchParams.delete("rt");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return localStorage.getItem(rtKey(pageId)) || undefined;
  } catch {
    return undefined;
  }
}

class RoomStore {
  private snap: RoomSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private started = false;
  constructor(private pageId: number) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  private set(next: RoomSnapshot) {
    this.snap = next;
    this.listeners.forEach((fn) => fn());
  }

  private auth() {
    return { pageId: this.pageId, hl: readHl(), rt: readRt(this.pageId), path: window.location.pathname };
  }

  private async post(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
    const r = await fetch(`/api/lp/room/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...this.auth(), ...body }) });
    let json: Record<string, unknown> = {};
    try {
      json = (await r.json()) as Record<string, unknown>;
    } catch {
      /* empty body */
    }
    return { status: r.status, json };
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.snap.status === "idle") this.set({ ...this.snap, status: "loading" });
    try {
      const { status, json } = await this.post("state", {});
      if (status !== 200) throw new Error("state");
      this.set({
        status: "ready",
        viewer: (json.viewer as RoomSnapshot["viewer"]) ?? null,
        tasks: (json.tasks as RoomSnapshot["tasks"]) ?? {},
        requests: Array.isArray(json.requests) ? (json.requests as RoomRequest[]) : [],
        choices: json.choices && typeof json.choices === "object" ? (json.choices as RoomSnapshot["choices"]) : {},
        wins: Array.isArray(json.wins) ? (json.wins as RoomWin[]) : [],
        people: Array.isArray(json.people) ? (json.people as RoomPersonRef[]) : [],
        contacts: Array.isArray(json.contacts) ? (json.contacts as RoomContact[]) : [],
        practices: json.practices && typeof json.practices === "object" ? (json.practices as RoomSnapshot["practices"]) : NO_PRACTICES,
        events: Array.isArray(json.events) ? (json.events as RoomSyncedEvent[]) : [],
        minutes: Array.isArray(json.minutes) ? (json.minutes as RoomSyncedMinutes[]) : [],
      });
    } catch {
      this.set({ ...this.snap, status: "error" });
    }
  }

  private async act(path: string, body: Record<string, unknown>): Promise<RoomActionResult> {
    try {
      const { status, json } = await this.post(path, body);
      if (status === 200) {
        await this.refresh();
        return { ok: true };
      }
      const error = typeof json.error === "string" ? json.error : "Something went wrong. Please try again.";
      if (status === 401) {
        // A stored token that no longer works (expired, or access removed).
        try {
          localStorage.removeItem(rtKey(this.pageId));
        } catch {
          /* ignore */
        }
        this.set({ ...this.snap, viewer: null, requests: [], contacts: [], people: [] });
        return { ok: false, error, identityRequired: true };
      }
      return { ok: false, error: status === 429 ? "Too many tries. Please wait a minute." : error };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  setTaskDone(taskKey: string, done: boolean) {
    return this.act("task", { taskKey, done });
  }

  /** The roster template for this room, as a CSV to download. Null when it could not be made. */
  async rosterTemplate(): Promise<{ fileName: string; csv: string } | null> {
    try {
      const { status, json } = await this.post("roster-template", {});
      return status === 200 && typeof json.csv === "string" ? { fileName: String(json.fileName || "roster.csv"), csv: json.csv } : null;
    } catch {
      return null;
    }
  }

  /** Team only: change a milestone's status, owners or target date. */
  editPlan(key: string, patch: { status?: string; ourOwner?: string; partnerOwner?: string; target?: string }) {
    return this.act("plan-edit", { key, ...patch });
  }

  /** The team moves a request along (status, owner, due); the customer can approve one that is ready for review. */
  updateRequest(id: number, patch: { status?: string; owner?: string; due?: string }) {
    return this.act("request-update", { id, ...patch });
  }

  async upload(taskKey: string, file: File): Promise<RoomActionResult> {
    if (file.size > ROOM_UPLOAD_MAX_BYTES) return { ok: false, error: "That file is over 7 MB. Send a smaller file, or ask your contact for another way to share it." };
    let fileBase64: string;
    try {
      fileBase64 = await fileToBase64(file);
    } catch {
      return { ok: false, error: "Couldn't read that file. Please try again." };
    }
    return this.act("upload", { taskKey, fileName: file.name, fileBase64 });
  }

  /** Ask the team for something; it shows up in the snapshot's `requests`. */
  /** Asset engagement (viewed, downloaded, time in the viewer), with who it was when the visitor is known. Best effort; survives the tab closing. */
  trackAsset(payload: Record<string, unknown>): void {
    try {
      void fetch("/api/lp/room/asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...this.auth(), ...payload }), keepalive: true }).catch(() => {});
    } catch {
      /* tracking never blocks the page */
    }
  }

  sendRequest(input: { kind: string; subject: string; details: string; assetKey?: string }) {
    return this.act("request", input);
  }

  /** One page of the practice list (known visitors only). Null when it could not be loaded. */
  /** Team only: compare the customer's rosters with the Salesforce list. Null when not available to this viewer. */
  async checkScorecard(): Promise<RoomScorecardCheck | null> {
    try {
      const { status, json } = await this.post("scorecard-check", {});
      return status === 200 ? (json as unknown as RoomScorecardCheck) : null;
    } catch {
      return null;
    }
  }

  async loadPractices(filter: { region?: string; q?: string; page?: number; sort?: RoomPracticeSort; dir?: "asc" | "desc"; stage?: RoomPracticeStageFilter; wave?: string; scanner?: "yes" | "no" }): Promise<RoomPracticePage | "identity" | null> {
    try {
      const { status, json } = await this.post("practices", filter);
      if (status === 200) return json as unknown as RoomPracticePage;
      return status === 401 ? "identity" : null;
    } catch {
      return null;
    }
  }

  setChoice(key: string, value: string) {
    return this.act("choice", { key, value });
  }
  addContact(input: { name: string; role: string; email: string }) {
    return this.act("contact", input);
  }
  postWin(input: { body: string; region?: string; images?: string[]; mentions?: string[] }) {
    return this.act("win", input);
  }
  /** Add or take back a reaction (the heart when no emoji is named). */
  likeWin(winId: number, emoji?: string) {
    return this.act("win/like", emoji ? { winId, emoji } : { winId });
  }
  commentWin(winId: number, body: string, mentions?: string[]) {
    return this.act("win/comment", { winId, body, mentions: mentions ?? [] });
  }
  /** Upload one photo for a win (already sized down by the page). Resolves to where it is hosted. */
  async uploadWinImage(fileName: string, dataUrl: string): Promise<{ ok: true; url: string } | { ok: false; error: string; identityRequired?: boolean }> {
    try {
      const { status, json } = await this.post("win-image", { fileName, fileBase64: dataUrl });
      if (status === 200 && typeof json.url === "string") return { ok: true, url: json.url };
      const error = typeof json.error === "string" ? json.error : "Couldn't add that photo. Please try again.";
      return status === 401 ? { ok: false, error, identityRequired: true } : { ok: false, error: status === 429 ? "Too many tries. Please wait a minute." : error };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  /** "sent" = a link is on its way; "requested" = the team has been asked to approve this address. */
  async requestAccess(email: string): Promise<{ ok: true; status: "sent" | "requested" } | { ok: false; error: string }> {
    try {
      const { status, json } = await this.post("access", { email });
      if (status === 200 && (json.status === "sent" || json.status === "requested")) return { ok: true, status: json.status };
      return { ok: false, error: status === 429 ? "Too many tries. Please wait a few minutes." : typeof json.error === "string" ? json.error : "Something went wrong. Please try again." };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.readAsDataURL(file);
  });
}

const stores = new Map<number, RoomStore>();
function storeFor(pageId: number): RoomStore {
  let s = stores.get(pageId);
  if (!s) {
    s = new RoomStore(pageId);
    stores.set(pageId, s);
  }
  return s;
}

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY;

/**
 * Room state + actions for a page. Inactive (static snapshot, no requests)
 * without a page id, in the builder, and on preview surfaces.
 */
export type RoomStoreHandle = RoomStore;

export function useRoom(pageId: number | undefined, enabled: boolean, opts: { readOnly?: boolean } = {}): { snapshot: RoomSnapshot; store: RoomStore | null; reader: RoomStore | null } {
  // Dev only: the block fixture page sets `window.__ROOM_PREVIEW__` to exercise the room against a mock API.
  const devPreview = import.meta.env.DEV && typeof window !== "undefined" && !!(window as unknown as { __ROOM_PREVIEW__?: boolean }).__ROOM_PREVIEW__;
  const active = enabled && typeof pageId === "number" && pageId > 0 && typeof window !== "undefined";
  // The builder and in-app previews read the room (so it looks as it will for the customer) but never act as a visitor.
  const readOnly = !!opts.readOnly || (active && !devPreview && isTrackingSuppressed());
  const store = active ? storeFor(pageId as number) : null;
  const snapshot = useSyncExternalStore(store ? store.subscribe : noopSubscribe, store ? store.getSnapshot : emptySnapshot, emptySnapshot);
  useEffect(() => {
    store?.start();
  }, [store]);
  // `reader` is for loading lists (the scorecard's practices); `store` is what visitor actions go through.
  return { snapshot, store: readOnly ? null : store, reader: store };
}
