/**
 * Copy that depends on how many gifts a recipient can actually pick: the
 * gifting wizard bakes it in when a rep picks fewer than three gifts, and the
 * live page re-applies it when sold-out gifts are hidden.
 */
const COUNT_WORD = ["", "one", "two", "three", "four"];

/** Swap "one of three" / "three gifts" style copy for the real number of gifts. */
export function fixCountCopy(text: unknown, n: number): unknown {
  if (typeof text !== "string" || n === 3) return text;
  if (n === 1) return text.replace(/\b(choose|pick) one of (three|two|four)\b/gi, "$1 your gift").replace(/\b(three|two|four) gifts\b/gi, "your gift");
  const w = COUNT_WORD[n] ?? String(n);
  return text.replace(/\bone of three\b/gi, `one of ${w}`).replace(/\bthree gifts\b/gi, `${w} gifts`).replace(/\bthree to choose from\b/gi, `${w} to choose from`);
}

/** The picker's header when one gift is left: a featured gift, not a choice. */
export const SINGLE_GIFT_PICKER_COPY = {
  kicker: "Your gift",
  headline: "A gift,\njust for you.",
  subheadline: "It ships straight to you. Claim it below and tell us where to send it.",
  chooseText: "Claim this gift",
};

/** Shown under the picker unless a page sets `limitedNote` to "". */
export const DEFAULT_LIMITED_NOTE = "Quantities are limited. Gifts are available while supplies last.";

/**
 * Hero copy when some gifts are hidden as sold out. `remaining` < `total`
 * only; with one left the "Pick the gift…" headline would be wrong, so it
 * becomes the featured-gift line.
 */
export function adaptHeroCopy<T extends Record<string, unknown>>(props: T, remaining: number): T {
  const out: Record<string, unknown> = { ...props };
  for (const k of ["subheadline", "ctaText"]) out[k] = fixCountCopy(out[k], remaining);
  if (Array.isArray(out.facts)) out.facts = (out.facts as Array<{ label?: unknown }>).map((f) => ({ ...f, label: fixCountCopy(f.label, remaining) }));
  if (remaining === 1) {
    if (typeof out.headline === "string" && /^pick\b/i.test(out.headline)) out.headline = "A gift,\nfrom us to you.";
    out.chooseGiftText = "See your gift";
  }
  return out as T;
}
