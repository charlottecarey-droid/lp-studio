import { sql } from "drizzle-orm";

/**
 * Reserved media tag marking a row as a team-member headshot. Rows carrying it
 * are hard-excluded from the AI image pool (see routes/lp/generate-page.ts
 * `HARD_EXCLUDE_TAGS` + `sanitizeAIImageUrls`, and routes/lp/library.ts). Kept
 * in sync with those literals.
 */
export const RESERVED_TEAM_PHOTO_TAG = "team-photo";

/**
 * Walk a (possibly nested) page blocks tree and collect every headshot URL a
 * `dso-meet-team` block uses (`props.members[].photo`). Container blocks store
 * children at `children`, so we recurse into those. Returns deduped, trimmed,
 * non-empty URLs.
 *
 * Task #1206 reserved team headshots that come from the `team_member` library
 * (routes/lp/library.ts), assuming the block always sources photos from there.
 * But a rep can pick a headshot straight into the block via the image picker —
 * those never pass through the library save path, so they stayed in the AI pool
 * and got reused as hero/feature images. This collector feeds the same
 * `team-photo` reservation for block-level headshots.
 */
export function collectTeamPhotoUrls(blocks: unknown): string[] {
  const out = new Set<string>();
  const walk = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as { type?: unknown; props?: unknown; children?: unknown };
      if (b.type === "dso-meet-team" && b.props && typeof b.props === "object") {
        const members = (b.props as { members?: unknown }).members;
        if (Array.isArray(members)) {
          for (const m of members) {
            const photo = m && typeof m === "object" ? (m as { photo?: unknown }).photo : undefined;
            if (typeof photo === "string" && photo.trim()) out.add(photo.trim());
          }
        }
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return [...out];
}

/**
 * Best-effort: reserve every `dso-meet-team` headshot on a page from AI reuse by
 * merging the `team-photo` tag onto the matching tenant media rows. Mirrors the
 * team_member library tagging (routes/lp/library.ts) for headshots picked
 * directly in the block. Tenant-scoped, idempotent (the `?` guard skips rows
 * already tagged), and never throws — a tagging hiccup must not fail the page
 * save. No-op for URLs with no matching media row (e.g. an external/CDN
 * headshot), which the tag-based AI pool can't reference anyway.
 */
export async function tagTeamPhotosFromBlocks(tenantId: number, blocks: unknown): Promise<void> {
  const urls = collectTeamPhotoUrls(blocks);
  if (urls.length === 0) return;
  // Lazy import so the pure `collectTeamPhotoUrls` collector (and its unit test)
  // never drag in the DB connection, which throws at import time when unset.
  const { db } = await import("@workspace/db");
  for (const url of urls) {
    try {
      await db.execute(
        sql`UPDATE lp_media
               SET tags = COALESCE(tags, '[]'::jsonb) || ${JSON.stringify([RESERVED_TEAM_PHOTO_TAG])}::jsonb
             WHERE tenant_id = ${tenantId}
               AND url = ${url}
               AND NOT (COALESCE(tags, '[]'::jsonb) ? ${RESERVED_TEAM_PHOTO_TAG})`
      );
    } catch {
      // Best-effort per URL — the headshot still renders; only AI-reuse
      // protection for this one image is lost.
    }
  }
}
