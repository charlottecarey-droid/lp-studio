/**
 * Shared client-side helpers for the plan-upgrade UX.
 *
 * The api-server returns a machine-readable 402 for any paid feature
 * a starter tenant tries to hit:
 *
 *   { error: "plan_upgrade_required", feature, plan, message }
 *
 * Two surfaces consume that signal:
 *
 *   1. The /sales/* route guard in App.tsx renders <UpgradePrompt /> in
 *      place of the silent redirect that used to live there.
 *   2. A global fetch interceptor (api-fetch.ts) catches 402s with this
 *      shape on any /api/* call and dispatches the
 *      `plan-upgrade-required` window event below. The listener mounted
 *      in App.tsx turns it into an upgrade toast — so even
 *      future-gated features (AI image gen, etc.) get the same
 *      treatment without each call site having to opt in.
 *
 * The copy here is the single source of truth for "what does each tier
 * unlock" — both the inline upgrade page and the toast pull from it,
 * so they always agree.
 */
import type { PlanFeatures } from "./plan-features";

export type GatedFeature = keyof PlanFeatures;

export interface UpgradePromptCopy {
  /** Headline shown above the bullets. */
  title: string;
  /** One-line subtitle that names the feature. */
  subtitle: string;
  /** Tier that unlocks this feature (what the CTA upgrades to). */
  unlockTier: "growth" | "enterprise";
  /** Bullets of what the user gets at the unlock tier. */
  bullets: string[];
}

const GROWTH_SALES_BULLETS = [
  "Sales Console — accounts, contacts, and signals in one place",
  "Personalized one-pagers and microsites for every account",
  "AI-drafted outreach with campaign tracking",
  "Salesforce sync so every page maps back to a lead",
];

const ENTERPRISE_AI_BULLETS = [
  "On-brand AI image generation inside every block",
  "Unlimited image regeneration credits",
  "Everything in Growth, including the Sales Console",
];

const FALLBACK_BULLETS = [
  "Unlock the full Landing Page Studio toolkit",
  "Talk to us about the right tier for your team",
];

export function copyForFeature(feature: GatedFeature | string): UpgradePromptCopy {
  switch (feature) {
    case "salesConsole":
      return {
        title: "Sales Console is a Growth feature",
        subtitle: "Upgrade to Growth to turn landing pages into a full account-based sales motion.",
        unlockTier: "growth",
        bullets: GROWTH_SALES_BULLETS,
      };
    case "aiImageGen":
      return {
        title: "AI image generation is an Enterprise feature",
        subtitle: "Upgrade to Enterprise to generate and refine on-brand imagery without leaving the builder.",
        unlockTier: "enterprise",
        bullets: ENTERPRISE_AI_BULLETS,
      };
    default:
      return {
        title: "This feature isn't on your current plan",
        subtitle: "Upgrade your workspace to unlock it.",
        unlockTier: "growth",
        bullets: FALLBACK_BULLETS,
      };
  }
}

export const UPGRADE_EVENT = "plan-upgrade-required";

export interface UpgradeEventDetail {
  feature: GatedFeature | string;
  plan: string;
  message?: string;
}

/**
 * Dispatch an upgrade event. Called from the global fetch interceptor
 * when it sees a 402 `plan_upgrade_required`. A debounce window
 * suppresses repeat events for the same feature so a screen full of
 * parallel queries hitting the same gate only shows one toast.
 */
const recent = new Map<string, number>();
const DEDUP_MS = 4000;

export function emitUpgradeRequired(detail: UpgradeEventDetail): void {
  if (typeof window === "undefined") return;
  const key = String(detail.feature);
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUP_MS) return;
  recent.set(key, now);
  window.dispatchEvent(new CustomEvent<UpgradeEventDetail>(UPGRADE_EVENT, { detail }));
}
