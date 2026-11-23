/**
 * What a page is, from its blocks: a customer Partner Hub, a practice sign-up
 * microsite, or an ordinary page. Hubs and microsites are made per account
 * (dozens at a time), so the Pages list keeps them on their own tabs instead of
 * mixing them in with marketing's pages. Mirrors the server's isPracticeSite.
 */
export type PageKind = "hub" | "microsite" | "page";

const PRACTICE_SITE_BLOCKS = new Set(["dso-practice-hero", "dso-heartland-hero"]);

export function pageKind(blocks: unknown): PageKind {
  if (!Array.isArray(blocks)) return "page";
  const types = blocks.map((b) => (b && typeof b === "object" ? String((b as { type?: unknown }).type ?? "") : ""));
  if (types.includes("room-workspace")) return "hub";
  if (types.some((t) => PRACTICE_SITE_BLOCKS.has(t))) return "microsite";
  return "page";
}
