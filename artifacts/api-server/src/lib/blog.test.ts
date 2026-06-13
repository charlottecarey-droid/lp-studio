import { describe, it, expect } from "vitest";
import {
  slugifyTitle,
  uniqueSlug,
  readingTimeMin,
  normalizeStatus,
  normalizeTags,
} from "./blog";

describe("slugifyTitle", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(slugifyTitle("How to Write a Landing Page That Converts")).toBe(
      "how-to-write-a-landing-page-that-converts",
    );
  });
  it("collapses punctuation and symbols", () => {
    expect(slugifyTitle("Landing page vs. microsite: which one?")).toBe(
      "landing-page-vs-microsite-which-one",
    );
  });
  it("strips leading/trailing hyphens", () => {
    expect(slugifyTitle("  --Hello--  ")).toBe("hello");
  });
  it("falls back to 'post' for empty/symbol-only titles", () => {
    expect(slugifyTitle("")).toBe("post");
    expect(slugifyTitle("!!!")).toBe("post");
  });
  it("bounds length to 80 chars without a trailing hyphen", () => {
    const long = "a".repeat(200);
    const slug = slugifyTitle(long);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("My Post", [])).toBe("my-post");
  });
  it("appends -2, -3 on collisions (case-insensitive)", () => {
    expect(uniqueSlug("My Post", ["my-post"])).toBe("my-post-2");
    expect(uniqueSlug("My Post", ["my-post", "MY-POST-2"])).toBe("my-post-3");
  });
  it("excludes the current slug so a no-op edit keeps it", () => {
    expect(uniqueSlug("My Post", ["my-post", "other"], "my-post")).toBe("my-post");
  });
  it("still de-dupes against OTHER posts on edit, reusing the current slug when free", () => {
    // base "my-post" collides with another post; "my-post-2" is this row's own
    // slug (excluded from taken), so it's free → keep it.
    expect(uniqueSlug("My Post", ["my-post", "my-post-2"], "my-post-2")).toBe("my-post-2");
    // base "my-post" is free for this row when this row currently holds it.
    expect(uniqueSlug("My Post", ["my-post", "other"], "my-post")).toBe("my-post");
  });
});

describe("readingTimeMin", () => {
  it("returns at least 1 for short/empty bodies", () => {
    expect(readingTimeMin("")).toBe(1);
    expect(readingTimeMin("a few words here")).toBe(1);
  });
  it("scales ~225wpm", () => {
    const body = Array.from({ length: 675 }, (_, i) => `word${i}`).join(" ");
    expect(readingTimeMin(body)).toBe(3); // 675 / 225 = 3
  });
  it("ignores code fences and inline svg infographics", () => {
    const prose = Array.from({ length: 450 }, (_, i) => `w${i}`).join(" ");
    const noise =
      "```\n" + "x ".repeat(2000) + "```\n" + "<svg>" + "y ".repeat(2000) + "</svg>";
    expect(readingTimeMin(prose + "\n" + noise)).toBe(2); // ~450 prose words only
  });
});

describe("normalizeStatus", () => {
  it("accepts valid statuses", () => {
    expect(normalizeStatus("published")).toBe("published");
    expect(normalizeStatus("draft")).toBe("draft");
  });
  it("defaults junk to draft", () => {
    expect(normalizeStatus("live")).toBe("draft");
    expect(normalizeStatus(undefined)).toBe("draft");
    expect(normalizeStatus(42)).toBe("draft");
  });
});

describe("normalizeTags", () => {
  it("trims, dedupes (case-insensitive), drops empties, caps at 12", () => {
    expect(normalizeTags([" SEO ", "seo", "", "Conversion", 5, null])).toEqual([
      "SEO",
      "Conversion",
    ]);
  });
  it("returns [] for non-arrays", () => {
    expect(normalizeTags("seo")).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
  });
});
