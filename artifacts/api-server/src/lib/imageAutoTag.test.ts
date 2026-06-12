/**
 * Unit tests for autoTagImage's source-page hero rule (forbidHeroPurpose).
 *
 * Scraped reference images are vision-tagged by content alone, so any people /
 * lifestyle / clinic photo (including a mid-page team headshot) gets classified
 * "lp-hero" and leaks into generated hero slots. The mirror only lets the image
 * that was the actual hero on the source page keep that purpose; every other
 * scraped image is downgraded to "lp-feature". This suite locks that behaviour
 * in by mocking the vision call to always return purpose "lp-hero" and asserting
 * the persisted tags.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// The vision response the mocked OpenAI client returns for every call.
let visionPurpose = "lp-hero";
let visionOg = false;

vi.mock("openai", () => {
  class OpenAI {
    chat = {
      completions: {
        create: vi.fn(async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tags: ["smiling", "portrait", "team"],
                  purpose: visionPurpose,
                  og: visionOg,
                }),
              },
            },
          ],
        })),
      },
    };
  }
  return { default: OpenAI };
});

// Capture the tags written to the media row.
let writtenTags: string[] | null = null;

vi.mock("@workspace/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn((vals: { tags: string[] }) => ({
        where: vi.fn(async () => {
          writtenTags = vals.tags;
        }),
      })),
    })),
  },
  lpMediaTable: { id: "id", tags: "tags" },
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => ({})) }));

import { autoTagImage, isSocialCardDims } from "./imageAutoTag";

const BUF = Buffer.from("fake-image-bytes");
const PROVENANCE = ["page-reference", "scraped", "refhost:example.com", "refsrc:abc123"];

describe("autoTagImage source-page hero rule", () => {
  beforeEach(() => {
    writtenTags = null;
    visionPurpose = "lp-hero";
    visionOg = false;
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] = "https://example.test";
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] = "test-key";
  });

  it("keeps lp-hero for the source-page hero image (forbidHeroPurpose unset)", async () => {
    await autoTagImage(1, BUF, "image/jpeg", [...PROVENANCE]);
    expect(writtenTags).not.toBeNull();
    expect(writtenTags).toContain("lp-hero");
    expect(writtenTags).not.toContain("lp-feature");
  });

  it("downgrades lp-hero to lp-feature for non-hero scraped images", async () => {
    await autoTagImage(2, BUF, "image/jpeg", [...PROVENANCE], { forbidHeroPurpose: true });
    expect(writtenTags).not.toBeNull();
    expect(writtenTags).not.toContain("lp-hero");
    expect(writtenTags).toContain("lp-feature");
  });

  it("preserves provenance tags while downgrading the purpose", async () => {
    await autoTagImage(3, BUF, "image/jpeg", [...PROVENANCE], { forbidHeroPurpose: true });
    for (const t of PROVENANCE) expect(writtenTags).toContain(t);
  });

  it("leaves a non-hero purpose untouched even when forbidHeroPurpose is set", async () => {
    visionPurpose = "lp-feature";
    await autoTagImage(4, BUF, "image/jpeg", [...PROVENANCE], { forbidHeroPurpose: true });
    expect(writtenTags).toContain("lp-feature");
    expect(writtenTags).not.toContain("lp-hero");
  });
});

// ── og:true geometry gate — true social cards vs content promo graphics ─────
// The vision classifier flags ANY composite/text-bearing image og:true ("when
// in doubt"). Only TRUE social-card geometry (~1200x630 / >=1.8 aspect under
// 1400px wide) may earn the hard "og-image" exclusion; everything else gets
// the soft "promo-graphic" marker and KEEPS its content + purpose tags, so a
// brand's own text-bearing homepage banners stay usable by generation (the
// Old Navy fix).
describe("autoTagImage og geometry gate (og-image vs promo-graphic)", () => {
  const BRAND_TAGS = ["brand-import", "old-navy", "photography"];

  beforeEach(() => {
    writtenTags = null;
    visionPurpose = "lp-hero";
    visionOg = true;
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] = "https://example.test";
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] = "test-key";
  });

  it("og:true + social-card geometry (1200x630) → hard og-image exclusion, no purpose", async () => {
    await autoTagImage(10, BUF, "image/jpeg", [...BRAND_TAGS], { width: 1200, height: 630 });
    expect(writtenTags).toContain("og-image");
    expect(writtenTags).not.toContain("promo-graphic");
    expect(writtenTags).not.toContain("lp-hero");
  });

  it("og:true + content geometry (1600x2000 portrait banner) → promo-graphic, purpose + content tags kept", async () => {
    await autoTagImage(11, BUF, "image/jpeg", [...BRAND_TAGS], { width: 1600, height: 2000 });
    expect(writtenTags).toContain("promo-graphic");
    expect(writtenTags).not.toContain("og-image");
    expect(writtenTags).toContain("lp-hero"); // purpose preserved
    expect(writtenTags).toContain("smiling"); // content tags preserved
    for (const t of BRAND_TAGS) expect(writtenTags).toContain(t); // provenance preserved
  });

  it("og:true + wide hero geometry (1920x800 — wide but real hero width) → promo-graphic", async () => {
    await autoTagImage(12, BUF, "image/jpeg", [...BRAND_TAGS], { width: 1920, height: 800 });
    expect(writtenTags).toContain("promo-graphic");
    expect(writtenTags).not.toContain("og-image");
  });

  it("og:true + UNKNOWN dimensions (undecodable buffer, no hint) stays conservative: og-image", async () => {
    await autoTagImage(13, BUF, "image/jpeg", [...BRAND_TAGS]);
    expect(writtenTags).toContain("og-image");
    expect(writtenTags).not.toContain("promo-graphic");
  });

  it("promo-graphic respects forbidHeroPurpose (downgrades to lp-feature)", async () => {
    await autoTagImage(14, BUF, "image/jpeg", [...BRAND_TAGS], { width: 1600, height: 2000, forbidHeroPurpose: true });
    expect(writtenTags).toContain("promo-graphic");
    expect(writtenTags).toContain("lp-feature");
    expect(writtenTags).not.toContain("lp-hero");
  });

  it("re-tagging replaces a stale og-image tag with promo-graphic (re-scan heals old rows)", async () => {
    await autoTagImage(15, BUF, "image/jpeg", ["og-image", ...BRAND_TAGS], { width: 1600, height: 2000 });
    expect(writtenTags).toContain("promo-graphic");
    expect(writtenTags).not.toContain("og-image");
  });
});

describe("isSocialCardDims", () => {
  it("matches the canonical 1200x630 card and wide-but-small banners", () => {
    expect(isSocialCardDims(1200, 630)).toBe(true);
    expect(isSocialCardDims(1024, 512)).toBe(true);
  });
  it("rejects content geometry (tall, square, or real hero widths)", () => {
    expect(isSocialCardDims(1600, 2000)).toBe(false);
    expect(isSocialCardDims(800, 800)).toBe(false);
    expect(isSocialCardDims(1920, 800)).toBe(false); // aspect 2.4 but full hero width
  });
  it("returns null for unknown dimensions", () => {
    expect(isSocialCardDims(null, 630)).toBeNull();
    expect(isSocialCardDims(1200, null)).toBeNull();
    expect(isSocialCardDims(undefined, undefined)).toBeNull();
  });
});
