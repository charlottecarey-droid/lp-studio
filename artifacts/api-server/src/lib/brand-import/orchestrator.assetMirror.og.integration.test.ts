/**
 * End-to-end guard for task #1095 / #1109: a site's social-preview image
 * (og:image / twitter:image) must NEVER be mirrored into `lp_media` tagged
 * "photography", because such images are homepage renders with the brand logo
 * + headline baked in and look like a broken mini-screenshot when placed as
 * block creative.
 *
 * The unit tests on `collectImagesFromDom` already pin that og/twitter images
 * are split out of the content pool. THIS test drives the *full* runtime chain
 * that decides what actually lands in the media library:
 *
 *   collectImagesFromDom (og vs content split)
 *     -> extractPhotography (referenceImageUrls = content only)
 *       -> applyAssetMirror (collects photoUrls from the photography result)
 *         -> mirrorBrandAssets (tags "photography", inserts lp_media row)
 *
 * so a future regression in how `referenceImageUrls` flows through ANY of those
 * hops — not just the extractor's local split — is caught.
 *
 * What's real vs. stubbed:
 *  - REAL: the photography extractor, applyAssetMirror, mirrorBrandAssets, and
 *    the Postgres pool (lp_media rows are actually inserted + asserted, then
 *    torn down).
 *  - STUBBED: the OpenAI vision call, outbound image `fetch`, and the object-
 *    storage upload — so no network/storage IO leaves the box. The SSRF host
 *    check (real `dns.lookup`) is satisfied by using a genuinely-resolvable
 *    host (example.com) for the candidate URLs.
 *
 * Gated on DB availability so it skips cleanly when no database is reachable.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type OpenAI from "openai";
import * as cheerio from "cheerio";
import { pool } from "@workspace/db";

import { applyAssetMirror } from "./orchestrator";
import { extractPhotography } from "./extractors/photography";
import { ObjectStorageService } from "../objectStorage";
import type { DimensionResult, Evidence, OrchestratorPayload, PhotographyData } from "./types";

// All candidate URLs live on a genuinely-resolvable host so the SSRF guard's
// real dns.lookup passes (fetch itself is stubbed, so no HTTP actually fires).
const OG_IMAGE = "https://www.example.com/og-preview-1109.jpg";
const TWITTER_IMAGE = "https://www.example.com/twitter-card-1109.jpg";
const CONTENT_IMAGE = "https://www.example.com/real-hero-photo-1109.jpg";

// A real (tiny) PNG so sharp can size it and the content-type guard passes.
const PNG_2X2_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNkYGD4z8DAwMgABAAH/wH+0n8mAAAAAElFTkSuQmCC";
const PNG_BYTES = Buffer.from(PNG_2X2_BASE64, "base64");

function makeEvidence(html: string): Evidence {
  return {
    homeUrl: "https://www.example.com",
    pages: [],
    stylesheets: [],
    $home: cheerio.load(html),
    robots: { allowed: {}, source: null, userAgent: "test" },
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: [],
    cssVarPaletteHints: [],
    darkCssVarHints: [],
    errors: [],
  };
}

// Minimal OpenAI stub: returns a valid photography profile so the extractor
// reports a non-failed status. referenceImageUrls is independent of this, but
// exercising the success path keeps the test faithful to a real import.
function fakeOpenAI(): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  medium: "photographic",
                  palette_temperature: "warm",
                  lightness: "light",
                  subject: "people",
                  mood: "bright, welcoming",
                  summary: "Bright, candid photography of people.",
                }),
              },
            },
          ],
        }),
      },
    },
  } as unknown as OpenAI;
}

async function dbReachable(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

let hasDb = false;
let tenantId = 0;
const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const BRAND_NAME = `OG Guard Co ${SUFFIX}`;

beforeAll(async () => {
  hasDb = await dbReachable();
  if (!hasDb) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, plan, status)
     VALUES ($1, $2, 'growth', 'active')
     RETURNING id`,
    [BRAND_NAME, `og-guard-${SUFFIX}`],
  );
  tenantId = t.rows[0].id;
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (!hasDb) return;
  if (tenantId) {
    await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  }
});

describe("brand-import asset mirror never stores og:image as photography (task #1109)", () => {
  it("mirrors real content photography into lp_media but never the og/twitter preview", async () => {
    if (!hasDb) {
      expect(true).toBe(true);
      return;
    }

    // A homepage whose og:image + twitter:image are social-preview renders,
    // alongside one genuine content photo.
    const html = `
      <head>
        <meta property="og:image" content="${OG_IMAGE}" />
        <meta name="twitter:image" content="${TWITTER_IMAGE}" />
      </head>
      <main><img src="${CONTENT_IMAGE}" /></main>`;

    // 1) Real extractor — produces referenceImageUrls (content only).
    const photoResult: DimensionResult<PhotographyData> = await extractPhotography(
      makeEvidence(html),
      fakeOpenAI(),
    );
    // Sanity: the extractor itself must keep og/twitter out of referenceImageUrls
    // and keep the real content image in.
    expect(photoResult.data?.referenceImageUrls).toContain(CONTENT_IMAGE);
    expect(photoResult.data?.referenceImageUrls).not.toContain(OG_IMAGE);
    expect(photoResult.data?.referenceImageUrls).not.toContain(TWITTER_IMAGE);

    // 2) Build the orchestrator payload exactly as runOrchestrator would: the
    //    photography result lives in both results.photography and the flattened
    //    proposed.photographyProfile.
    const payload = {
      sourceUrl: "https://www.example.com",
      pagesScraped: [],
      sampledPalette: [],
      hasScreenshot: false,
      screenshotDataUrl: null,
      robots: { allowed: {}, source: null, userAgent: "test" },
      results: { photography: photoResult } as OrchestratorPayload["results"],
      proposed: {
        brandName: BRAND_NAME,
        photographyProfile: photoResult.data,
      } as Record<string, unknown>,
      confidence: {} as Record<string, never>,
      unparsed: [],
      durationMs: 0,
      cached: false,
    } as unknown as OrchestratorPayload;

    // 3) Stub the IO leaves: object-storage upload + outbound image fetch.
    const uploadSpy = vi
      .spyOn(ObjectStorageService.prototype, "uploadObjectEntity")
      .mockResolvedValue(`/objects/uploads/og-guard-${SUFFIX}`);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
    );

    // 4) Real applyAssetMirror — the production path runOrchestrator invokes.
    await applyAssetMirror(payload, tenantId);

    // The content image was actually fetched + uploaded...
    const fetchedUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(fetchedUrls).toContain(CONTENT_IMAGE);
    // ...but the og/twitter previews were never even fetched.
    expect(fetchedUrls).not.toContain(OG_IMAGE);
    expect(fetchedUrls).not.toContain(TWITTER_IMAGE);
    expect(uploadSpy).toHaveBeenCalledTimes(1);

    // 5) lp_media reflects exactly one photography-tagged row — the content
    //    image — and zero rows traceable to the og/twitter previews.
    const photoRows = await pool.query<{ url: string; title: string; tags: unknown }>(
      `SELECT url, title, tags
         FROM lp_media
        WHERE tenant_id = $1
          AND tags @> '["photography"]'::jsonb`,
      [tenantId],
    );
    expect(photoRows.rows.length).toBe(1);

    // The mirrored row's title derives from the content image filename, never
    // the og/twitter preview filenames. titleFromUrl normalizes [_-]+ to
    // spaces, so "real-hero-photo-1109.jpg" becomes "real hero photo 1109".
    const title = photoRows.rows[0].title.toLowerCase();
    expect(title).toContain("real hero photo");
    expect(title).not.toContain("og preview");
    expect(title).not.toContain("twitter card");
  });
});
