import OpenAI from "openai";
import { db, lpMediaTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Landing-page purpose tags an auto-tagged image may receive. */
export const VALID_PURPOSES = ["lp-hero", "lp-feature", "product-detail"] as const;
export type ImagePurpose = typeof VALID_PURPOSES[number];

// ── Backfill row-selection predicate (scripts/retag-media-library.ts) ────────
//
// Media rows created BEFORE the synchronous-tagging fix carry only provenance
// tags (["page-reference","scraped","refhost:…","refsrc:…"]), brand-import
// markers (["brand-import","<brand-slug>","photography"]) or starter-seed
// markers (["starter","flagship"|"generic"|…]). None of those are content
// tags, so the AI page generator's scorer gives the row 0 against every slot
// and image selection degenerates to arbitrary picks. The predicate below
// decides which rows the retag backfill should send through the vision
// tagger. Kept here (next to the tagger) so the tag taxonomy lives in one
// module, and exported so it is unit-testable without a DB.

/** Tags that mark a row as permanently EXCLUDED from AI image selection
 *  (mirrors EXCLUDE_TAGS in routes/lp/generate-page.ts, plus "favicon").
 *  Backfilling content tags onto these rows would be wasted vision calls at
 *  best — and at worst would let a brand mark / favicon / OG card start
 *  winning hero or product slots it must never occupy. */
const BACKFILL_EXCLUDED_TAGS = new Set([
  "og-image", "og", "social", "open-graph", "text-based", "call to action",
  "advertisement", "ad creative", "homepage-screenshot", "team-photo",
  "logo", "favicon",
]);

/** Provenance / structural / junk tags that carry NO content semantics.
 *  A row whose tags are ALL drawn from this set (or the prefix list below)
 *  is "untagged" from the scorer's point of view. */
const NON_CONTENT_TAGS = new Set([
  // reference-scrape / brand-import provenance
  "page-reference", "scraped", "brand-import", "photography",
  // starter-seed markers
  "starter", "flagship", "generic", "industry", "distinctive",
  // folder-junk vocabulary (mirrors SKIP_TAGS in routes/lp/generate-page.ts)
  "untitled folder", "web res", "high res", "abstract", "modern",
  "professional", "hat", "holographic hat", "green glow", "futuristic",
  "digital art",
]);

/** Dynamic provenance tags, matched by prefix. */
const NON_CONTENT_TAG_PREFIXES = ["refhost:", "refsrc:"] as const;

/**
 * True when an lp_media row should be sent through the vision tagger by the
 * retag backfill: it has NO lp-* purpose tag AND NO content tag — i.e. every
 * tag it carries is provenance / starter / junk. Rows that already carry a
 * purpose tag, an exclusion tag (og-image / team-photo / logo / …), or at
 * least one genuine content tag are left alone, so the backfill is
 * idempotent and resumable.
 *
 * Brand-import rows are a special case: their only non-provenance tag is the
 * dynamic brand slug (e.g. "acme-dental"), which is provenance too — so for
 * rows tagged "brand-import" the decision rests purely on purpose tags.
 */
export function needsContentTagBackfill(tags: unknown): boolean {
  const lower = (Array.isArray(tags) ? tags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().trim());

  // Already classified (purpose assigned) or permanently excluded from AI
  // selection — nothing for the backfill to do.
  if (lower.some((t) => (VALID_PURPOSES as readonly string[]).includes(t))) return false;
  if (lower.some((t) => BACKFILL_EXCLUDED_TAGS.has(t))) return false;

  const isBrandImport = lower.includes("brand-import");
  const hasContentTag = lower.some((t) => {
    if (!t) return false;
    if (NON_CONTENT_TAGS.has(t)) return false;
    if (NON_CONTENT_TAG_PREFIXES.some((p) => t.startsWith(p))) return false;
    // On a brand-import row any leftover unknown tag is the brand slug
    // (mirrorBrandAssets only ever writes baseTags + a role marker).
    if (isBrandImport) return false;
    return true;
  });
  return !hasContentTag;
}

/** Auto-tag an image using GPT-4o vision (runs in background, never blocks upload).
 *  Also assigns a landing-page purpose tag:
 *   "lp-hero"        — lifestyle, people, environments, smiles, clinic shots (hero sections)
 *   "lp-feature"     — clean product/procedure shots, moderate close-ups (feature rows)
 *   "product-detail" — very close-up product, diagrams, spec/guide illustrations
 *   "og-image"       — (exclusion tag) social/OG sharing image; auto-excluded from AI page generation
 *
 *  Reused by both the media-drawer upload path (routes/storage.ts) and the
 *  brand-import / reference-scrape mirror (lib/brand-import/assets-uploader.ts)
 *  so scraped reference photography and brand-import photos earn real content
 *  + purpose tags instead of provenance-only tags. Existing (e.g. provenance)
 *  tags are preserved — only stale purpose/og tags are replaced before merging.
 */
export async function autoTagImage(
  mediaId: number,
  imageBuffer: Buffer,
  mimeType: string,
  existingTags: string[] = [],
  opts: { forbidHeroPurpose?: boolean } = {},
): Promise<void> {
  try {
    const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
    if (!baseURL || !apiKey) return;

    const openai = new OpenAI({ baseURL, apiKey });
    const base64 = imageBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            `You are an image tagger for a dental/medical marketing asset library. Return ONLY a valid JSON object (no markdown, no explanation):
{
  "tags": ["tag1", "tag2"],
  "purpose": "lp-hero",
  "og": false
}
Rules:
- "tags": 3–6 short lowercase descriptive tags (1–3 words each) describing subject, style, and mood.
- "purpose": exactly one of:
    "lp-hero"        → lifestyle shot, people smiling, team/clinic environment, before-after results, patient story — suitable as a landing page hero
    "lp-feature"     → clean product/procedure angle, moderate close-up of a device or service, good for a feature row
    "product-detail" → extreme close-up, technical diagram, spec illustration, guide graphic, not suitable as a hero
- "og": true if the image is ANY of the following — social-sharing / Open Graph card (text or logo overlaid on a background, wide 1.91:1 ratio with headline text, brand name, or URL), website screenshot, promotional ad creative, advertisement banner, call-to-action graphic, marketing promotional card with text overlays, or any composite design NOT suitable as a standalone editorial photo. When in doubt, set og: true for images with significant text content. Set false only for clean standalone photos with no text overlays.`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri, detail: "low" } },
            { type: "text", text: "Tag this image, classify its landing page purpose, and detect if it is an OG/social-sharing image." },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let aiTags: string[] = [];
    let purpose: ImagePurpose | "" = "";
    let isOg = false;

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        // Graceful fallback: old plain-array format
        aiTags = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.tags)) aiTags = parsed.tags;
        if (typeof parsed.purpose === "string" && VALID_PURPOSES.includes(parsed.purpose as ImagePurpose)) {
          purpose = parsed.purpose as ImagePurpose;
        }
        if (parsed.og === true) isOg = true;
      }
    } catch {
      // JSON parse failed — skip tagging
    }

    // Scraped reference images may only carry "lp-hero" when they were the
    // actual hero on the source page (the caller sets forbidHeroPurpose for
    // every scraped image except the page hero). Vision tags any people /
    // lifestyle / clinic photo as "lp-hero", so mid-page shots like team
    // headshots would otherwise leak into generated hero slots. Downgrade to
    // "lp-feature" so the image stays usable as feature imagery but never as an
    // auto-selected hero.
    if (opts.forbidHeroPurpose && purpose === "lp-hero") {
      purpose = "lp-feature";
    }

    if (aiTags.length > 0 || purpose || isOg) {
      // OG images get the "og-image" exclusion tag prepended; no LP purpose tag assigned
      const purposeArr: string[] = isOg ? ["og-image"] : (purpose ? [purpose] : []);
      // Remove any stale purpose/og tags from existing tags before merging
      const staleTagSet = new Set([...VALID_PURPOSES as readonly string[], "og-image"]);
      const cleanedExisting = existingTags.filter(t => !staleTagSet.has(t));
      const merged = [...new Set([...purposeArr, ...cleanedExisting, ...aiTags])].slice(0, 11);
      await db
        .update(lpMediaTable)
        .set({ tags: merged })
        .where(eq(lpMediaTable.id, mediaId));
    }
  } catch {
    // Auto-tagging is best-effort — never fail the upload
  }
}
