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

export interface RoomWinComment {
  id: number;
  body: string;
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
  viewer: { email: string; name: string | null } | null;
  tasks: Record<string, RoomTaskState>;
  /** The customer's requests to the team. Empty for an anonymous visitor. */
  requests: RoomRequest[];
  /** Decisions made on the page (marketing programs), by key. */
  choices: Record<string, { value: string; at: string; by?: string }>;
  /** The wins feed, newest first. */
  wins: RoomWin[];
  /** People the customer added to their team. Empty for an anonymous visitor. */
  contacts: RoomContact[];
  /** Practice counts by stage and the regions present (no names: safe for any visitor). */
  practices: { total: number; byStage: Record<string, number>; regions: string[] };
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
}
export interface RoomPracticePage {
  total: number;
  page: number;
  pageSize: number;
  rows: RoomPractice[];
}

export type RoomActionResult = { ok: true } | { ok: false; error: string; identityRequired?: boolean };

/** Upload cap (matches the server): JSON bodies stop at 10 MB and base64 adds a third. */
export const ROOM_UPLOAD_MAX_BYTES = 7 * 1024 * 1024;
export const ROOM_UPLOAD_ACCEPT = ".xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.png,.jpg,.jpeg,.zip";

const NO_PRACTICES = { total: 0, byStage: {}, regions: [] };
const EMPTY: RoomSnapshot = { status: "idle", viewer: null, tasks: {}, requests: [], choices: {}, wins: [], contacts: [], practices: NO_PRACTICES };
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
        contacts: Array.isArray(json.contacts) ? (json.contacts as RoomContact[]) : [],
        practices: json.practices && typeof json.practices === "object" ? (json.practices as RoomSnapshot["practices"]) : NO_PRACTICES,
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
        this.set({ ...this.snap, viewer: null, requests: [], contacts: [] });
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
  sendRequest(input: { kind: string; subject: string; details: string; assetKey?: string }) {
    return this.act("request", input);
  }

  /** One page of the practice list (known visitors only). Null when it could not be loaded. */
  async loadPractices(filter: { region?: string; q?: string; page?: number }): Promise<RoomPracticePage | "identity" | null> {
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
  postWin(input: { body: string; region?: string }) {
    return this.act("win", input);
  }
  likeWin(winId: number) {
    return this.act("win/like", { winId });
  }
  commentWin(winId: number, body: string) {
    return this.act("win/comment", { winId, body });
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

export function useRoom(pageId: number | undefined, enabled: boolean): { snapshot: RoomSnapshot; store: RoomStore | null } {
  // Dev only: the block fixture page sets `window.__ROOM_PREVIEW__` to exercise the room against a mock API.
  const devPreview = import.meta.env.DEV && typeof window !== "undefined" && !!(window as unknown as { __ROOM_PREVIEW__?: boolean }).__ROOM_PREVIEW__;
  const active = enabled && typeof pageId === "number" && pageId > 0 && typeof window !== "undefined" && (devPreview || !isTrackingSuppressed());
  const store = active ? storeFor(pageId as number) : null;
  const snapshot = useSyncExternalStore(store ? store.subscribe : noopSubscribe, store ? store.getSnapshot : emptySnapshot, emptySnapshot);
  useEffect(() => {
    store?.start();
  }, [store]);
  return { snapshot, store };
}
