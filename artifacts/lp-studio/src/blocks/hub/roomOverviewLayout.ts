/**
 * The order of a Partner Hub's Overview: the built-in sections and the team's
 * own (video, Important links, pinned note), in one list a rep can rearrange.
 *
 * Saved as `overviewOrder` (unit keys) on the hub. Hubs saved before it have
 * none and keep their old layout: the team's "top" sections, the built-ins in
 * their usual order, then the team's "bottom" sections. A rep's first move
 * writes the whole list. Keys that no longer exist (a deleted section) are
 * dropped; units missing from a saved list (a section added since) take their
 * usual place, so nothing ever disappears from the page.
 *
 * `overviewBeside` holds the units that sit beside the one before them on a
 * wide screen (two columns; stacked on a phone).
 */

/** The built-in units. "steps" is Your next steps with Coming up / Overdue (hidden one by one, moved together). */
export const OVERVIEW_BUILTIN_UNITS = ["progress", "steps", "orders", "feed"] as const;
export type OverviewBuiltinUnit = (typeof OVERVIEW_BUILTIN_UNITS)[number];

export const OVERVIEW_UNIT_LABEL: Record<OverviewBuiltinUnit, string> = {
  progress: "Progress",
  steps: "Next steps & coming up",
  orders: "Orders",
  feed: "News",
};

/** Units too wide to share a row: they always take the full width. */
const FULL_WIDTH = new Set<string>(["progress", "steps"]);

export const isBuiltinUnit = (k: string): k is OverviewBuiltinUnit => (OVERVIEW_BUILTIN_UNITS as readonly string[]).includes(k);

/** Whether a unit may sit beside another. */
export const canSitBeside = (k: string) => !FULL_WIDTH.has(k);

/** The Overview's order as it shows now: the saved list, cleaned up and completed. */
export function resolveOverviewOrder(
  extras: { key: string; position?: "top" | "bottom" }[],
  saved: string[] | undefined,
): string[] {
  const top = extras.filter((x) => x.position === "top").map((x) => x.key);
  const bottom = extras.filter((x) => x.position !== "top").map((x) => x.key);
  const defaults = [...top, ...OVERVIEW_BUILTIN_UNITS, ...bottom];
  if (!saved || saved.length === 0) return defaults;
  const known = new Set(defaults);
  const seen = new Set<string>();
  const order = saved.filter((k) => known.has(k) && !seen.has(k) && (seen.add(k), true));
  // Anything missing goes back where it would usually be: right after the unit before it in the default order.
  defaults.forEach((k, i) => {
    if (order.includes(k)) return;
    const before = defaults.slice(0, i).reverse().find((p) => order.includes(p));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, k);
  });
  return order;
}

/** Move a unit one place up or down among the units that are showing (`visible`), keeping the rest in place. */
export function moveOverviewUnit(order: string[], visible: string[], key: string, dir: -1 | 1): string[] {
  const at = visible.indexOf(key);
  const neighbour = visible[at + dir];
  if (at < 0 || !neighbour) return order;
  return placeOverviewUnit(order, key, neighbour, dir === -1 ? "before" : "after");
}

/** Put a unit before or after another (drag and drop). */
export function placeOverviewUnit(order: string[], key: string, target: string, where: "before" | "after"): string[] {
  if (key === target || !order.includes(key) || !order.includes(target)) return order;
  const rest = order.filter((k) => k !== key);
  const t = rest.indexOf(target);
  rest.splice(where === "before" ? t : t + 1, 0, key);
  return rest;
}

/** Put a new unit just before `before` (or at the end). */
export function insertOverviewUnit(order: string[], key: string, before: string | null): string[] {
  const rest = order.filter((k) => k !== key);
  const at = before ? rest.indexOf(before) : -1;
  rest.splice(at < 0 ? rest.length : at, 0, key);
  return rest;
}

/**
 * Lay the showing units out in rows: a unit marked "beside" shares a row with
 * the one before it, when both may (never three to a row).
 */
export function overviewRows(visible: string[], beside: string[] | undefined): string[][] {
  const pair = new Set(beside ?? []);
  const rows: string[][] = [];
  for (const k of visible) {
    const last = rows[rows.length - 1];
    if (last && last.length === 1 && pair.has(k) && canSitBeside(k) && canSitBeside(last[0])) last.push(k);
    else rows.push([k]);
  }
  return rows;
}
