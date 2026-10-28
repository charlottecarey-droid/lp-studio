/**
 * Content Hub — resource gate (Oct 2026).
 *
 * A hub-library / hub-featured block can ask for an email before the FIRST
 * resource opens (`mode: "first-open"`) or before any DOWNLOAD (`mode:
 * "downloads"`; viewing stays free). Off by default. The gate's form is the
 * same CtaModalConfig every CTA button uses — the simple built-in form, a
 * linked global form (with all its notifications, Marketo, webhooks and
 * campaign enrolment), or a Marketo embed — so it is configured with the
 * shared "modal form" panel section.
 *
 * Once the visitor submits, the unlock is remembered in localStorage for the
 * whole origin (every hub page of the site) and every later asset beacon
 * carries the lead id, so all further opens and downloads attribute to that
 * person. Events in the same tracking session as the submit attribute through
 * the lead's session id too.
 */
import type { CtaModalConfig } from "@/lib/block-types";

export type HubGateMode = "first-open" | "downloads";

export interface HubGateConfig extends CtaModalConfig {
  enabled?: boolean;
  /** "first-open" = anything (view / open / download) · "downloads" = downloads only. */
  mode?: HubGateMode;
}

export const HUB_GATE_DEFAULTS: HubGateConfig = {
  enabled: false,
  mode: "first-open",
  modalFormSource: "simple",
  modalHeadline: "Unlock the full library",
  modalSubheadline: "Enter your email once and every resource here opens instantly — no login, nothing to remember.",
  modalSubmitText: "Unlock",
  modalSuccessMessage: "You're in — opening your resource.",
  modalDisclaimer: "",
  modalShowFirstName: false,
  modalShowLastName: false,
  modalShowPhone: false,
  modalShowCompany: false,
};

export type HubGatedAction = "view" | "open" | "download";

export interface HubUnlock {
  leadId?: number;
  email?: string;
  at: number;
}

const UNLOCK_KEY = "lp-hub-unlock";
/** Unlocks older than this are forgotten (the visitor is asked again). */
const UNLOCK_TTL_MS = 365 * 86_400_000;

export function readHubUnlock(): HubUnlock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HubUnlock>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > UNLOCK_TTL_MS) return null;
    return { leadId: typeof parsed.leadId === "number" ? parsed.leadId : undefined, email: typeof parsed.email === "string" ? parsed.email : undefined, at: parsed.at };
  } catch {
    return null;
  }
}

export function writeHubUnlock(u: Omit<HubUnlock, "at">): HubUnlock {
  const next: HubUnlock = { ...u, at: Date.now() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(UNLOCK_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked — the gate will ask again next visit */
    }
  }
  return next;
}

export function clearHubUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** Does this action on this block need the gate right now? Pure apart from
 *  reading the unlock; never gates inside the builder (editing must stay
 *  fluid) — the panel previews the modal copy instead. */
export function gateApplies(gate: HubGateConfig | undefined, action: HubGatedAction, opts: { isEditor?: boolean; unlocked?: HubUnlock | null } = {}): boolean {
  if (!gate?.enabled || opts.isEditor) return false;
  const mode = gate.mode ?? "first-open";
  if (mode === "downloads" && action !== "download") return false;
  const unlocked = opts.unlocked === undefined ? readHubUnlock() : opts.unlocked;
  return !unlocked;
}
