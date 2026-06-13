import { describe, it, expect } from "vitest";
import {
  slugifyTitle,
  uniqueSlug,
  readingTimeMin,
  normalizeStatus,
  normalizeTags,
  clampFocal,
  focalToObjectPosition,
  parseScheduledAt,
  isScheduledPostDue,
  revisionIdsToPrune,
  prePublishChecklist,
  MAX_REVISIONS_PER_POST,
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

// ── Phase 2 (publishing) ─────────────────────────────────────────────────

describe("normalizeStatus (Phase 2 — scheduled)", () => {
  it("accepts scheduled", () => {
    expect(normalizeStatus("scheduled")).toBe("scheduled");
  });
  it("still accepts draft/published and defaults unknown to draft", () => {
    expect(normalizeStatus("published")).toBe("published");
    expect(normalizeStatus("draft")).toBe("draft");
    expect(normalizeStatus("bogus")).toBe("draft");
    expect(normalizeStatus(undefined)).toBe("draft");
  });
});

describe("clampFocal / focalToObjectPosition (OG crop math)", () => {
  it("clamps into [0,1] and defaults non-finite to 0.5", () => {
    expect(clampFocal(-1)).toBe(0);
    expect(clampFocal(2)).toBe(1);
    expect(clampFocal(0.25)).toBe(0.25);
    expect(clampFocal("nope")).toBe(0.5);
    expect(clampFocal(undefined)).toBe(0.5);
    expect(clampFocal(NaN)).toBe(0.5);
  });
  it("maps a 0–1 focal point to a CSS object-position percentage", () => {
    expect(focalToObjectPosition(0.5, 0.5)).toBe("50% 50%");
    expect(focalToObjectPosition(0, 1)).toBe("0% 100%");
    expect(focalToObjectPosition(0.25, 0.75)).toBe("25% 75%");
    // out-of-range coords clamp first
    expect(focalToObjectPosition(-5, 9)).toBe("0% 100%");
  });
});

describe("parseScheduledAt", () => {
  it("parses ISO strings + epoch millis, rejects junk/empty", () => {
    const iso = "2026-07-01T12:00:00.000Z";
    expect(parseScheduledAt(iso)?.toISOString()).toBe(iso);
    expect(parseScheduledAt(Date.parse(iso))?.toISOString()).toBe(iso);
    expect(parseScheduledAt("")).toBeNull();
    expect(parseScheduledAt(null)).toBeNull();
    expect(parseScheduledAt("not-a-date")).toBeNull();
  });
});

describe("isScheduledPostDue (schedule-sweep selection)", () => {
  const now = new Date("2026-06-13T12:00:00.000Z");
  it("publishes a scheduled post whose time has arrived (at or before now)", () => {
    expect(isScheduledPostDue({ status: "scheduled", scheduledAt: new Date("2026-06-13T11:59:00.000Z"), now })).toBe(true);
    expect(isScheduledPostDue({ status: "scheduled", scheduledAt: new Date(now), now })).toBe(true);
  });
  it("does NOT publish a future-scheduled post", () => {
    expect(isScheduledPostDue({ status: "scheduled", scheduledAt: new Date("2026-06-13T12:01:00.000Z"), now })).toBe(false);
  });
  it("ignores non-scheduled statuses + missing/invalid scheduledAt", () => {
    expect(isScheduledPostDue({ status: "draft", scheduledAt: new Date("2020-01-01"), now })).toBe(false);
    expect(isScheduledPostDue({ status: "published", scheduledAt: new Date("2020-01-01"), now })).toBe(false);
    expect(isScheduledPostDue({ status: "scheduled", scheduledAt: null, now })).toBe(false);
    expect(isScheduledPostDue({ status: "scheduled", scheduledAt: new Date("nope"), now })).toBe(false);
  });
});

describe("revisionIdsToPrune (retention)", () => {
  it("keeps the most recent N and returns the rest to delete", () => {
    const ids = Array.from({ length: 53 }, (_, i) => 53 - i); // newest-first 53..1
    const prune = revisionIdsToPrune(ids, 50);
    expect(prune).toEqual([3, 2, 1]); // the 3 oldest
  });
  it("prunes nothing when under the bound", () => {
    expect(revisionIdsToPrune([5, 4, 3], 50)).toEqual([]);
  });
  it("uses MAX_REVISIONS_PER_POST by default", () => {
    const ids = Array.from({ length: MAX_REVISIONS_PER_POST + 2 }, (_, i) => i + 1);
    expect(revisionIdsToPrune(ids)).toHaveLength(2);
  });
  it("prunes all when keep<=0", () => {
    expect(revisionIdsToPrune([3, 2, 1], 0)).toEqual([3, 2, 1]);
  });
});

describe("prePublishChecklist (completeness)", () => {
  const complete = {
    title: "A title",
    excerpt: "A dek",
    coverImageUrl: "/api/storage/c.png",
    ogImageUrl: "/api/storage/og.png",
    seoTitle: "SEO",
    seoDescription: "meta",
    slug: "a-title",
    status: "published",
  };
  it("is ok when every required field is present", () => {
    const r = prePublishChecklist(complete);
    expect(r.ok).toBe(true);
    expect(r.items.every((i) => i.ok)).toBe(true);
  });
  it("flags each missing field", () => {
    const r = prePublishChecklist({ ...complete, title: "", excerpt: "" });
    expect(r.ok).toBe(false);
    expect(r.items.find((i) => i.key === "title")?.ok).toBe(false);
    expect(r.items.find((i) => i.key === "excerpt")?.ok).toBe(false);
  });
  it("OG passes when only a cover is set (OG falls back to cover)", () => {
    const r = prePublishChecklist({ ...complete, ogImageUrl: "" });
    expect(r.items.find((i) => i.key === "og")?.ok).toBe(true);
  });
  it("requires a publish date for scheduled posts, not for direct publish", () => {
    const scheduledNoDate = prePublishChecklist({ ...complete, status: "scheduled", scheduledAt: null });
    expect(scheduledNoDate.items.find((i) => i.key === "publishDate")?.ok).toBe(false);
    const scheduledWithDate = prePublishChecklist({ ...complete, status: "scheduled", scheduledAt: "2026-07-01T00:00:00.000Z" });
    expect(scheduledWithDate.items.find((i) => i.key === "publishDate")?.ok).toBe(true);
    expect(prePublishChecklist(complete).items.find((i) => i.key === "publishDate")?.ok).toBe(true);
  });
});
