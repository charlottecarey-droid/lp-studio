/**
 * Pure helpers for the first-party marketing blog (blog_posts).
 *
 * Dependency-free (no db, no express) so they can be unit-tested in isolation
 * and reused by both the public read endpoints and the superadmin CRUD.
 */

/**
 * Derive a URL-safe slug from a title: lowercased, non-alphanumerics collapsed
 * to single hyphens, trimmed of leading/trailing hyphens, bounded to 80 chars.
 * Returns "post" for an empty/symbol-only title so the caller always has a
 * non-empty base to de-duplicate.
 */
export function slugifyTitle(title: string): string {
  const base = (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "post";
}

/**
 * Resolve a unique slug given a desired base and the set of slugs already taken.
 * Appends -2, -3, … until free. `taken` is case-insensitive. When `currentSlug`
 * is provided (an edit), that slug is excluded from the taken set so re-saving a
 * post without renaming keeps its slug.
 */
export function uniqueSlug(
  base: string,
  taken: Iterable<string>,
  currentSlug?: string | null,
): string {
  const root = slugifyTitle(base);
  const takenSet = new Set<string>();
  for (const s of taken) {
    const norm = (s || "").toLowerCase();
    if (currentSlug && norm === currentSlug.toLowerCase()) continue;
    takenSet.add(norm);
  }
  if (!takenSet.has(root.toLowerCase())) return root;
  let n = 2;
  // Bound the loop defensively; in practice n stays tiny.
  while (n < 10000) {
    const candidate = `${root}-${n}`;
    if (!takenSet.has(candidate.toLowerCase())) return candidate;
    n += 1;
  }
  // Pathological fallback — guaranteed-unique suffix.
  return `${root}-${Date.now()}`;
}

/**
 * Estimate reading time in whole minutes from markdown body text. Strips the
 * heaviest markdown/markup noise (code fences, inline SVG, html tags, link/
 * image syntax) so word counts reflect prose, then divides by an average adult
 * reading speed of 225 wpm. Always returns at least 1.
 */
export function readingTimeMin(body: string): number {
  const text = (body || "")
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ") // inline infographics
    .replace(/<[^>]+>/g, " ") // remaining html tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ") // links → drop the (url) part
    .replace(/[#>*_`~|-]/g, " "); // markdown punctuation
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

const VALID_STATUSES = new Set(["draft", "published"]);

/** Normalize an arbitrary status input to a valid value, defaulting to draft. */
export function normalizeStatus(status: unknown): "draft" | "published" {
  return typeof status === "string" && VALID_STATUSES.has(status)
    ? (status as "draft" | "published")
    : "draft";
}

/** Coerce an arbitrary tags input into a clean string[] (trimmed, deduped, capped). */
export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const v = t.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 12) break;
  }
  return out;
}
