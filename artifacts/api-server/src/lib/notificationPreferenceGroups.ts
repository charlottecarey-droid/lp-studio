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
 *
 * Opt-out is stored at the GROUP level: one `notification_preferences` row whose
 * `template_key` is `grp:<groupId>` (see `groupOptOutKey`). The dispatcher maps a
 * lifecycle template to its group (`groupIdForTemplateKey`) and suppresses on the
 * group row OR a legacy per-template row. Storing at the group level makes a
 * category unsubscribe DURABLE: a template added to a group later inherits the
 * existing opt-out instead of silently re-subscribing the recipient.
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

/** The single catch-all group id (absorbs every unclaimed lifecycle key). */
const CATCH_ALL_GROUP_ID = PREFERENCE_GROUP_DEFS.find((g) => g.catchAll)!.id;

/**
 * Map a lifecycle EMAIL template key to the id of the group that owns it. Keys
 * not explicitly claimed by a named group belong to the catch-all. Used by the
 * dispatcher to resolve a template to its category for the group-level opt-out
 * check — independent of the live registry, so it also covers DB-only templates.
 */
export function groupIdForTemplateKey(templateKey: string): string {
  for (const g of PREFERENCE_GROUP_DEFS) {
    if ((g.templateKeys ?? []).includes(templateKey)) return g.id;
  }
  return CATCH_ALL_GROUP_ID;
}

/**
 * Prefix marking a `notification_preferences` row as a group-level opt-out. The
 * colon is what reserves the namespace: real template keys are validated against
 * `/^[a-z0-9_]{2,64}$/` at every create/update path, so a key can never contain a
 * ":" and therefore can never collide with `grp:<id>`.
 */
export const GROUP_OPTOUT_KEY_PREFIX = "grp:";

/** The synthetic `template_key` used to store a group-level opt-out row. */
export function groupOptOutKey(groupId: string): string {
  return `${GROUP_OPTOUT_KEY_PREFIX}${groupId}`;
}

/**
 * Return the group id if `key` is a group-level opt-out row, else null. Defense
 * in depth: only `grp:<knownGroupId>` is treated as a group row, so any stray /
 * unrecognized `grp:*` value is classified as an ordinary per-template key rather
 * than conjuring a phantom group.
 */
export function parseGroupOptOutKey(key: string): string | null {
  if (!key.startsWith(GROUP_OPTOUT_KEY_PREFIX)) return null;
  const id = key.slice(GROUP_OPTOUT_KEY_PREFIX.length);
  return isKnownPreferenceGroup(id) ? id : null;
}

export interface PreferenceGroupView {
  id: string;
  name: string;
  description: string;
  /** False when the group is opted out (group row, or every member opted out). */
  subscribed: boolean;
}

/**
 * Build the display model: one entry per visible group, in taxonomy order.
 *
 * A group reads as unsubscribed when EITHER a group-level opt-out row exists OR
 * (legacy back-compat) every one of its live members has a per-template opt-out
 * row. The catch-all is always shown so a recipient can pre-emptively unsubscribe
 * from promotions; other groups are hidden only when they currently have no
 * members to manage.
 */
export function buildPreferenceGroups(
  lifecycleEmailKeys: string[],
  perTemplateOptedOut: string[],
  groupOptedOutIds: string[],
): PreferenceGroupView[] {
  const perTemplate = new Set(perTemplateOptedOut);
  const groupOut = new Set(groupOptedOutIds);
  const views: PreferenceGroupView[] = [];
  for (const def of PREFERENCE_GROUP_DEFS) {
    const members = groupMemberKeys(def.id, lifecycleEmailKeys);
    if (members.length === 0 && !def.catchAll) continue;
    const optedOut =
      groupOut.has(def.id) ||
      (members.length > 0 && members.every((k) => perTemplate.has(k)));
    views.push({
      id: def.id,
      name: def.name,
      description: def.description,
      subscribed: !optedOut,
    });
  }
  return views;
}

export function isKnownPreferenceGroup(groupId: string): boolean {
  return PREFERENCE_GROUP_DEFS.some((g) => g.id === groupId);
}
