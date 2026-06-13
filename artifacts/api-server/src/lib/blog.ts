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
 * Estimate reading time in whole minutes from an HTML body (bodies are stored
 * as HTML; lingering markdown noise is still stripped so the estimate is stable
 * across the migration). Strips inline SVG infographics + code blocks first
 * (they aren't prose), then html tags + entities, then divides by an average
 * adult reading speed of 225 wpm. Always returns at least 1.
 */
export function readingTimeMin(body: string): number {
  const text = (body || "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ") // inline infographics
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ") // code blocks
    .replace(/```[\s\S]*?```/g, " ") // legacy fenced code blocks
    .replace(/<[^>]+>/g, " ") // remaining html tags
    .replace(/&[a-z]+;/gi, " ") // html entities
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // legacy markdown images
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ") // legacy markdown links
    .replace(/[#>*_`~|]/g, " "); // markdown punctuation
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

export type BlogStatus = "draft" | "scheduled" | "published";
const VALID_STATUSES = new Set<BlogStatus>(["draft", "scheduled", "published"]);

/** Normalize an arbitrary status input to a valid value, defaulting to draft. */
export function normalizeStatus(status: unknown): BlogStatus {
  return typeof status === "string" && VALID_STATUSES.has(status as BlogStatus)
    ? (status as BlogStatus)
    : "draft";
}

// ── Phase 2 (publishing) pure helpers ────────────────────────────────────────

/**
 * Clamp a raw focal-point coordinate into the unit interval [0,1], defaulting
 * to 0.5 (centre) for anything non-finite. Used for OG card object-position.
 */
export function clampFocal(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/**
 * Convert a 0–1 focal point into a CSS object-position string ("X% Y%") for
 * the 1200×630 social-card crop. Pure + shared by the renderer + preview.
 */
export function focalToObjectPosition(x: unknown, y: unknown): string {
  const fx = Math.round(clampFocal(x) * 1000) / 10;
  const fy = Math.round(clampFocal(y) * 1000) / 10;
  return `${fx}% ${fy}%`;
}

/**
 * Parse a client-supplied scheduledAt into a Date, or null if absent/invalid.
 * Accepts ISO strings or epoch millis.
 */
export function parseScheduledAt(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Pure predicate for the scheduled-publish sweep: a post is due to publish iff
 * it is 'scheduled' and its scheduledAt is at or before `now`. Future schedules
 * and non-scheduled rows return false. Exported for unit tests + the poller.
 */
export function isScheduledPostDue(args: {
  status: string;
  scheduledAt: Date | null;
  now: Date;
}): boolean {
  if (args.status !== "scheduled") return false;
  if (!(args.scheduledAt instanceof Date) || Number.isNaN(args.scheduledAt.getTime())) {
    return false;
  }
  return args.scheduledAt.getTime() <= args.now.getTime();
}

/** Max revisions retained per post (bounded so the table can't grow forever). */
export const MAX_REVISIONS_PER_POST = 50;

/**
 * Given the revision IDs for a post sorted NEWEST-first and a retention bound,
 * return the IDs that should be DELETED to keep only the most recent `keep`.
 * Pure (no DB) so the retention rule is unit-testable. The caller is expected
 * to have just inserted the new revision, so it appears in `idsNewestFirst`.
 */
export function revisionIdsToPrune(
  idsNewestFirst: number[],
  keep: number = MAX_REVISIONS_PER_POST,
): number[] {
  if (keep <= 0) return [...idsNewestFirst];
  return idsNewestFirst.slice(keep);
}

/**
 * The editable field-set captured in a revision snapshot + restored from one.
 * Kept loose (all-optional, unknown-tolerant) so older snapshots restore safely.
 */
export interface BlogSnapshot {
  title?: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  coverImageUrl?: string | null;
  authorName?: string;
  tags?: string[];
  status?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  ogFocalX?: number;
  ogFocalY?: number;
  scheduledAt?: string | null;
}

/**
 * Pre-publish checklist. Pure completeness check over the editable fields —
 * returns one item per requirement plus an `ok` rollup so the UI can warn (and
 * the server can enforce a confirm-to-override). A post is "publish-complete"
 * when every required item is satisfied.
 */
export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
}
export interface ChecklistInput {
  title?: unknown;
  excerpt?: unknown;
  coverImageUrl?: unknown;
  ogImageUrl?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  slug?: unknown;
  status?: unknown;
  scheduledAt?: unknown;
}
function nonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
export function prePublishChecklist(input: ChecklistInput): {
  items: ChecklistItem[];
  ok: boolean;
} {
  const isScheduled = normalizeStatus(input.status) === "scheduled";
  // Publish-date requirement: a scheduled post needs a future-or-present
  // scheduledAt; a direct publish is "now" so it is always satisfied.
  const publishDateOk = isScheduled
    ? parseScheduledAt(input.scheduledAt) != null
    : true;
  const items: ChecklistItem[] = [
    { key: "title", label: "Title added", ok: nonEmpty(input.title) },
    { key: "excerpt", label: "Excerpt added", ok: nonEmpty(input.excerpt) },
    { key: "cover", label: "Cover image added", ok: nonEmpty(input.coverImageUrl) },
    {
      key: "og",
      // OG falls back to cover, so the share card works if either is set.
      label: "Social (OG) image set",
      ok: nonEmpty(input.ogImageUrl) || nonEmpty(input.coverImageUrl),
    },
    { key: "seoTitle", label: "SEO title set", ok: nonEmpty(input.seoTitle) },
    {
      key: "seoDescription",
      label: "Meta description set",
      ok: nonEmpty(input.seoDescription),
    },
    { key: "slug", label: "Slug set", ok: nonEmpty(input.slug) },
    { key: "publishDate", label: "Publish date set", ok: publishDateOk },
  ];
  return { items, ok: items.every((i) => i.ok) };
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
