/**
 * Shared client-side helpers for the plan-upgrade UX.
 *
 * The api-server denies every plan gate with one machine-readable 402
 * (see api-server/src/lib/planGate.ts):
 *
 *   {
 *     error: "plan_upgrade_required",
 *     gate,                    // feature key OR cap key
 *     currentUsage,            // number for caps, null for boolean gates
 *     cap,                     // number for caps, null for boolean gates
 *     currentPlan,             // the tenant's resolved plan
 *     minimumPlanWithFeature,  // lowest tier that admits it (null if none)
 *     upgradeUrl,              // "/settings/billing"
 *   }
 *
 * Two surfaces consume that signal:
 *
 *   1. The /sales/* route guard + DomainPage render <UpgradePrompt /> inline
 *      for a known boolean feature.
 *   2. A global fetch interceptor (api-fetch.ts) catches the 402 on any
 *      /api/* call and dispatches the `plan-upgrade-required` window event
 *      below; the listener mounted in App.tsx turns it into an upgrade toast.
 *
 * The copy here is the single source of truth for "what does each tier
 * unlock". The unlock tier is driven off the server's
 * `minimumPlanWithFeature` (computed against the live, SuperAdmin-editable
 * config) and falls back to a client-side computation over the shared
 * PLAN_CONFIG when a static caller has no server payload.
 */
import { PLAN_CONFIG, PLANS, type Plan } from "@workspace/plan-config";

/**
 * Server-emitted `gate` string in the 402 payload. Mirrors the boolean
 * feature flags on PlanFeatures plus the numeric caps under
 * PlanFeatures.limits. The wire format is flat (`pages`, not `limits.pages`).
 */
export type GatedFeature =
  | "salesConsole"
  | "aiImageGen"
  | "customDomain"
  | "customEmailDomain"
  | "brandedEmailSubdomain"
  | "pages"
  | "forms"
  | "userSeats"
  | "aiGenerationsPerMonth"
  | "heatmapSessionsPerMonth";

/** Gates whose value is a boolean feature flag rather than a numeric cap. */
const BOOLEAN_GATES = new Set<string>(["salesConsole", "aiImageGen", "customDomain", "customEmailDomain", "brandedEmailSubdomain"]);

export interface UpgradePromptCopy {
  /** Headline shown above the bullets. */
  title: string;
  /** One-line subtitle that names the feature (usage-aware for caps). */
  subtitle: string;
  /** Lowest tier that unlocks this gate; null when no tier offers it. */
  unlockTier: Plan | null;
  /** Whether `unlockTier` is purchasable via self-serve Stripe checkout. */
  selfServe: boolean;
  /** Bullets of what the user gets at the unlock tier. */
  bullets: string[];
}

const SALES_CONSOLE_BULLETS = [
  "Sales Console — accounts, contacts, and signals in one place",
  "Personalized one-pagers and microsites for every account",
  "AI-drafted outreach with campaign tracking",
  "Salesforce sync so every page maps back to a lead",
];

const AI_IMAGE_BULLETS = [
  "On-brand AI image generation inside every block",
  "Generate and refine imagery without leaving the builder",
  "Everything in lower tiers",
];

const CUSTOM_DOMAIN_BULLETS = [
  "Publish on your own domain (lp.yourbrand.com)",
  'Removes the "Powered by LP Studio" badge from public pages',
  "More landing pages and forms",
  "Role-based access for your team",
];

const CUSTOM_EMAIL_DOMAIN_BULLETS = [
  "Send email from your own domain (mail.yourbrand.com)",
  "Self-serve DNS setup with live verification",
  "Full deliverability control with your own SPF/DKIM",
  "Everything in lower tiers",
];

const BRANDED_EMAIL_SUBDOMAIN_BULLETS = [
  "A branded sending subdomain (mail.yourbrand.lpstudio.ai)",
  "One-click provisioning — no DNS setup required",
  "Better deliverability than the shared sending domain",
  "Everything in lower tiers",
];

const PAGES_BULLETS = [
  "A higher landing-page allowance (unlimited on top tiers)",
  "Custom domain (lp.yourbrand.com)",
  'Removes the "Powered by LP Studio" badge',
  "Everything in your current plan",
];

const FORMS_BULLETS = [
  "A higher form allowance for more lead-capture surfaces",
  "More landing pages and teammates",
  "Everything in your current plan",
];

const SEATS_BULLETS = [
  "More teammate seats with role-based access",
  "Everything in your current plan",
];

const AI_GENERATION_BULLETS = [
  "A higher monthly AI page-generation allowance",
  "Keep drafting full pages with AI as your volume grows",
  "Everything in your current plan",
];

const HEATMAP_BULLETS = [
  "A higher monthly heatmap session allowance",
  "Keep recording visitor behavior as your traffic grows",
  "Everything in your current plan",
];

const FALLBACK_BULLETS = [
  "Unlock the full Landing Page Studio toolkit",
  "Talk to us about the right tier for your team",
];

interface GateDescriptor {
  /** Human label for the gated capability. */
  label: string;
  /** Verb phrase used as "Upgrade to {tier} to {blurb}." */
  blurb: string;
  bullets: string[];
}

const GATE_COPY: Record<GatedFeature, GateDescriptor> = {
  salesConsole: {
    label: "Sales Console",
    blurb: "turn landing pages into a full account-based sales motion",
    bullets: SALES_CONSOLE_BULLETS,
  },
  aiImageGen: {
    label: "AI image generation",
    blurb: "generate and refine on-brand imagery without leaving the builder",
    bullets: AI_IMAGE_BULLETS,
  },
  customDomain: {
    label: "Custom domains",
    blurb: "publish on your own domain",
    bullets: CUSTOM_DOMAIN_BULLETS,
  },
  customEmailDomain: {
    label: "Custom email domains",
    blurb: "send email from your own domain",
    bullets: CUSTOM_EMAIL_DOMAIN_BULLETS,
  },
  brandedEmailSubdomain: {
    label: "Branded email subdomain",
    blurb: "send email from a branded subdomain with one-click setup",
    bullets: BRANDED_EMAIL_SUBDOMAIN_BULLETS,
  },
  pages: {
    label: "landing pages",
    blurb: "create more landing pages",
    bullets: PAGES_BULLETS,
  },
  forms: {
    label: "forms",
    blurb: "create more forms",
    bullets: FORMS_BULLETS,
  },
  userSeats: {
    label: "teammate seats",
    blurb: "invite more teammates",
    bullets: SEATS_BULLETS,
  },
  aiGenerationsPerMonth: {
    label: "monthly AI page generations",
    blurb: "generate more pages with AI each month",
    bullets: AI_GENERATION_BULLETS,
  },
  heatmapSessionsPerMonth: {
    label: "monthly heatmap sessions",
    blurb: "record more visitor sessions each month",
    bullets: HEATMAP_BULLETS,
  },
};

function plansBySortOrder(): Plan[] {
  return [...PLANS].sort((a, b) => PLAN_CONFIG[a].sortOrder - PLAN_CONFIG[b].sortOrder);
}

/**
 * Client-side fallback for the lowest tier that admits a gate, mirroring the
 * server's minimumPlanForFeature / minimumPlanForCap over the shared config.
 * Used when a static caller (route guard, DomainPage) has no server payload.
 */
export function minimumTierForGate(gate: string, currentUsage?: number | null): Plan | null {
  if (BOOLEAN_GATES.has(gate)) {
    for (const p of plansBySortOrder()) {
      const features = PLAN_CONFIG[p].features as unknown as Record<string, unknown>;
      if (features[gate] === true) return p;
    }
    return null;
  }
  const usage = typeof currentUsage === "number" ? currentUsage : 0;
  for (const p of plansBySortOrder()) {
    const limits = PLAN_CONFIG[p].features.limits as unknown as Record<string, number | null>;
    const limit = limits[gate];
    if (limit === undefined) continue;
    if (limit === null || limit > usage) return p;
  }
  return null;
}

function tierName(tier: Plan | null): string {
  return tier ? PLAN_CONFIG[tier].displayName : "a higher plan";
}

function indefiniteArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export interface CopyForGateOptions {
  gate: string;
  minimumPlanWithFeature?: Plan | null;
  currentUsage?: number | null;
  cap?: number | null;
}

export function copyForGate(opts: CopyForGateOptions): UpgradePromptCopy {
  const { gate } = opts;
  const unlockTier =
    opts.minimumPlanWithFeature ?? minimumTierForGate(gate, opts.currentUsage);
  // `free` is never a checkout target even though it is technically
  // self-serve in PLAN_CONFIG — there is no Stripe SKU for it. Guarding here
  // keeps every CTA callsite from ever producing a `free_monthly` checkout.
  const selfServe =
    unlockTier && unlockTier !== "free" ? PLAN_CONFIG[unlockTier].selfServe : false;
  const name = tierName(unlockTier);
  const desc = GATE_COPY[gate as GatedFeature];

  if (!desc) {
    return {
      title: "This feature isn't on your current plan",
      subtitle: `Upgrade to ${name} to unlock it.`,
      unlockTier,
      selfServe,
      bullets: FALLBACK_BULLETS,
    };
  }

  if (!BOOLEAN_GATES.has(gate)) {
    const { currentUsage, cap } = opts;
    const usageLine =
      typeof currentUsage === "number" && typeof cap === "number"
        ? `You've used ${currentUsage} of ${cap} ${desc.label} on your current plan.`
        : `You've reached your ${desc.label} limit.`;
    return {
      title: `You've reached your ${desc.label} limit`,
      subtitle: `${usageLine} Upgrade to ${name} to ${desc.blurb}.`,
      unlockTier,
      selfServe,
      bullets: desc.bullets,
    };
  }

  return {
    title: unlockTier
      ? `${desc.label} is ${indefiniteArticle(name)} ${name} feature`
      : `${desc.label} isn't on your plan`,
    subtitle: `Upgrade to ${name} to ${desc.blurb}.`,
    unlockTier,
    selfServe,
    bullets: desc.bullets,
  };
}

/**
 * Thin alias for static callers that only know a boolean feature key and have
 * no server payload (the /sales route guard, DomainPage). Computes the unlock
 * tier client-side from the shared config.
 */
export function copyForFeature(feature: GatedFeature | string): UpgradePromptCopy {
  return copyForGate({ gate: feature });
}

export const UPGRADE_EVENT = "plan-upgrade-required";

export interface UpgradeEventDetail {
  gate: string;
  currentPlan: string;
  currentUsage: number | null;
  cap: number | null;
  minimumPlanWithFeature: Plan | null;
  upgradeUrl: string;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asPlanOrNull(v: unknown): Plan | null {
  return typeof v === "string" && (PLANS as readonly string[]).includes(v)
    ? (v as Plan)
    : null;
}

/**
 * Parse a parsed JSON body into an UpgradeEventDetail iff it matches the
 * server's structured `plan_upgrade_required` contract (keyed on `gate`).
 * Returns null for any other shape. Pure — used by the fetch interceptor.
 */
export function parseUpgradeBody(body: unknown): UpgradeEventDetail | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.error !== "plan_upgrade_required" || !b.gate) return null;
  return {
    gate: String(b.gate),
    currentPlan: String(b.currentPlan ?? "free"),
    currentUsage: asNumberOrNull(b.currentUsage),
    cap: asNumberOrNull(b.cap),
    minimumPlanWithFeature: asPlanOrNull(b.minimumPlanWithFeature),
    upgradeUrl: typeof b.upgradeUrl === "string" ? b.upgradeUrl : "/settings/billing",
  };
}

/**
 * Dispatch an upgrade event. Called from the global fetch interceptor when it
 * sees a 402 `plan_upgrade_required`. A debounce window suppresses repeat
 * events for the same gate so a screen full of parallel queries hitting the
 * same gate only shows one toast.
 */
const recent = new Map<string, number>();
const DEDUP_MS = 4000;

export function emitUpgradeRequired(detail: UpgradeEventDetail): void {
  if (typeof window === "undefined") return;
  const key = String(detail.gate);
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUP_MS) return;
  recent.set(key, now);
  window.dispatchEvent(new CustomEvent<UpgradeEventDetail>(UPGRADE_EVENT, { detail }));
}
