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
                  og: false,
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

import { autoTagImage } from "./imageAutoTag";

const BUF = Buffer.from("fake-image-bytes");
const PROVENANCE = ["page-reference", "scraped", "refhost:example.com", "refsrc:abc123"];

describe("autoTagImage source-page hero rule", () => {
  beforeEach(() => {
    writtenTags = null;
    visionPurpose = "lp-hero";
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
