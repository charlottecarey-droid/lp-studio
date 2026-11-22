/**
 * Welcome gifts on a Partner Hub. Each person on the customer's side who
 * signs in is offered their own gift ("Accept your welcome gift" in their
 * getting-started list) and accepts it by sending where to ship it. So the
 * step is per person, never ticked for the whole hub.
 *
 * Some customers don't accept gifts: the team turns gifts off for the whole
 * hub, or for one person. The team itself is never offered one. Pure.
 */

export const GIFT_STEP_KEY = "onboard-gift";

/** The getting-started step that accepts the welcome gift. Same rule as the hub page's `isGiftStep`. */
export function isGiftStep(step: { key?: unknown; title?: unknown }): boolean {
  return step.key === GIFT_STEP_KEY || /\bwelcome (gift|kit)s?\b|\bgift\b/i.test(typeof step.title === "string" ? step.title : "");
}

/** The hub's gift step, when it has one the customer can see. */
export function hubGiftStep(blocks: unknown): { key: string; title: string } | null {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (!b || typeof b !== "object" || (b as { type?: unknown }).type !== "room-workspace") continue;
    const ob = (b as { props?: { onboarding?: { hidden?: unknown; steps?: unknown } } }).props?.onboarding;
    if (!ob || ob.hidden === true || !Array.isArray(ob.steps)) continue;
    for (const s of ob.steps) {
      if (!s || typeof s !== "object" || (s as { hidden?: unknown }).hidden === true || !isGiftStep(s as { key?: unknown; title?: unknown })) continue;
      const key = typeof (s as { key?: unknown }).key === "string" && (s as { key: string }).key.trim() ? (s as { key: string }).key.trim() : GIFT_STEP_KEY;
      return { key, title: String((s as { title?: unknown }).title ?? "Accept your welcome gift") };
    }
  }
  return null;
}

/** A request that accepted the gift: sent from the gift step (or, before that was marked, a marketing request about the gift). */
export function isGiftRequest(r: { assetKey?: string | null; kind?: string | null; subject?: string | null }, stepKey = GIFT_STEP_KEY): boolean {
  if (r.assetKey) return r.assetKey === stepKey || r.assetKey === GIFT_STEP_KEY;
  return r.kind === "marketing" && /\bwelcome (gift|kit)\b|\bgift\b/i.test(r.subject ?? "");
}

const norm = (e: string) => e.trim().toLowerCase();

/** Whether this person is offered a gift, and whether they have accepted it. */
export function giftFor(
  settings: { giftsEnabled: boolean; giftOffEmails: string[] },
  viewer: { email: string; team?: boolean } | null,
  hasStep: boolean,
  acceptedBy: Iterable<string>,
): { offered: boolean; accepted: boolean } {
  if (!viewer || viewer.team || !hasStep) return { offered: false, accepted: false };
  const me = norm(viewer.email);
  const accepted = [...acceptedBy].some((e) => norm(e) === me);
  const off = !settings.giftsEnabled || settings.giftOffEmails.some((e) => norm(e) === me);
  // Someone who already accepted keeps seeing it as done, even if gifts were turned off afterwards.
  return { offered: !off || accepted, accepted };
}

/** The team's list of who is not offered a gift, after turning one person on or off. */
export function setGiftOff(list: string[], email: string, off: boolean): string[] {
  const e = norm(email);
  const rest = list.map(norm).filter((x) => x && x !== e);
  return off ? [...rest, e].slice(-2000) : rest;
}
