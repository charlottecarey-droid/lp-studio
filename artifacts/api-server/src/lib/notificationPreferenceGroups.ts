/**
 * Human-friendly grouping for the personal email-preference center.
 *
 * The opt-out store is still per-template (one `notification_preferences` row
 * per lifecycle EMAIL template, consulted by the dispatcher). But surfacing one
 * toggle per internal template — including operator-created ones with junk names
 * — is not how a normal preference center reads. So we bucket every lifecycle
 * email template into a small set of named categories and let a recipient
 * subscribe / unsubscribe a whole category at once.
 *
 * Membership is resolved against the LIVE template list so any template the code
 * registry doesn't name (e.g. an operator-created promo) falls into the catch-all
 * "Product news & offers" group rather than vanishing — and toggling that group
 * off correctly suppresses it. This also closes the old bug where the UI listed
 * DB-only templates the PATCH endpoint then rejected as "unknown".
 */

export interface PreferenceGroupDef {
  id: string;
  name: string;
  description: string;
  /** Template keys explicitly owned by this group. Omitted for the catch-all. */
  templateKeys?: string[];
  /** Exactly one group is the catch-all that absorbs every unclaimed key. */
  catchAll?: boolean;
}

/**
 * Ordered, code-owned category taxonomy. Order is the display order. Only the
 * catch-all may omit `templateKeys`.
 */
export const PREFERENCE_GROUP_DEFS: readonly PreferenceGroupDef[] = [
  {
    id: "getting_started",
    name: "Getting started & product tips",
    description:
      "Your welcome email and occasional tips to help you set up and get the most out of LP Studio.",
    templateKeys: ["welcome"],
  },
  {
    id: "trial_billing",
    name: "Trial & plan reminders",
    description:
      "Friendly reminders about your free trial and upcoming changes to your plan.",
    templateKeys: ["trial_day_7", "trial_day_11", "trial_day_13"],
  },
  {
    id: "account_alerts",
    name: "Account & workspace alerts",
    description:
      "Operational heads-up about your workspace — for example, when an old web address is about to stop working.",
    templateKeys: ["slug_redirect_expiry"],
  },
  {
    id: "news_offers",
    name: "Product news & offers",
    description:
      "New features, product announcements, and the occasional promotion.",
    catchAll: true,
  },
];

/** Keys explicitly claimed by a non-catch-all group. */
function claimedKeys(): Set<string> {
  const s = new Set<string>();
  for (const g of PREFERENCE_GROUP_DEFS) {
    for (const k of g.templateKeys ?? []) s.add(k);
  }
  return s;
}

/**
 * Resolve the member template keys of a group against the live set of lifecycle
 * EMAIL template keys. The catch-all returns every live key not claimed by
 * another group. Returns [] for an unknown group id.
 */
export function groupMemberKeys(groupId: string, lifecycleEmailKeys: string[]): string[] {
  const def = PREFERENCE_GROUP_DEFS.find((g) => g.id === groupId);
  if (!def) return [];
  const live = new Set(lifecycleEmailKeys);
  if (def.catchAll) {
    const claimed = claimedKeys();
    return lifecycleEmailKeys.filter((k) => !claimed.has(k));
  }
  return (def.templateKeys ?? []).filter((k) => live.has(k));
}

export interface PreferenceGroupView {
  id: string;
  name: string;
  description: string;
  /** False only when the recipient is opted out of EVERY member of the group. */
  subscribed: boolean;
}

/**
 * Build the display model: one entry per non-empty group, in taxonomy order. A
 * group reads as subscribed unless every one of its members is opted out, so
 * turning a group off (opt out all members) flips it to off and turning it on
 * (clear all member opt-outs) flips it back on.
 */
export function buildPreferenceGroups(
  lifecycleEmailKeys: string[],
  optedOutKeys: string[],
): PreferenceGroupView[] {
  const optedOut = new Set(optedOutKeys);
  const views: PreferenceGroupView[] = [];
  for (const def of PREFERENCE_GROUP_DEFS) {
    const members = groupMemberKeys(def.id, lifecycleEmailKeys);
    if (members.length === 0) continue; // hide categories with nothing to manage
    views.push({
      id: def.id,
      name: def.name,
      description: def.description,
      subscribed: members.some((k) => !optedOut.has(k)),
    });
  }
  return views;
}

export function isKnownPreferenceGroup(groupId: string): boolean {
  return PREFERENCE_GROUP_DEFS.some((g) => g.id === groupId);
}
