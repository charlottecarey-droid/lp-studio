import { describe, it, expect } from "vitest";
import {
  getBlogBannedPhrases,
  buildLpStudioBlogVoicePrompt,
  stripCodeFence,
  parseJsonObject,
  clampToLength,
  slugifyGenerated,
  clampMetadata,
  pickMetadataFields,
  buildMetadataMessages,
  htmlToPromptText,
  buildOutlineMessages,
  parseOutline,
  outlineToText,
  buildDraftMessages,
  cleanDraftHtml,
  findDisallowedTags,
  completionText,
  isMetadataField,
  SEO_TITLE_MAX,
  META_DESCRIPTION_MAX,
  METADATA_FIELDS,
  buildTopicRecommendationMessages,
  parseRecommendedTopics,
  type BlogMetadata,
} from "./blogAi";
import { sanitizeRawBlogHtml } from "./blogHtml";

describe("getBlogBannedPhrases", () => {
  it("includes core clichés + brand-specific bans, de-duped and lower-cased", () => {
    const bans = getBlogBannedPhrases();
    expect(bans).toContain("seamless"); // core
    expect(bans).toContain("revolutionary"); // brand
    expect(bans).toContain("supercharge"); // brand
    expect(bans).toContain("leverage"); // core
    // de-duped
    expect(new Set(bans).size).toBe(bans.length);
    // all lower-cased
    expect(bans.every((b) => b === b.toLowerCase())).toBe(true);
  });
});

describe("buildLpStudioBlogVoicePrompt", () => {
  it("grounds in LP Studio brand voice + strict facts", () => {
    const p = buildLpStudioBlogVoicePrompt();
    expect(p).toMatch(/AI revenue workspace/);
    expect(p).toMatch(/Answer-first/i);
    expect(p).toMatch(/NEVER invent statistics/i);
    expect(p).toMatch(/fake customers, logos/i);
    expect(p).toMatch(/Sentence-case headings/i);
    // banned list embedded
    expect(p).toMatch(/"seamless"/);
    expect(p).toMatch(/"supercharge"/);
  });
});

describe("stripCodeFence", () => {
  it("strips a ```json fence", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("strips a bare ``` fence", () => {
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("leaves unfenced content alone", () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseJsonObject", () => {
  it("parses a plain object", () => {
    expect(parseJsonObject('{"seoTitle":"Hi"}')).toEqual({ seoTitle: "Hi" });
  });
  it("parses a fenced object", () => {
    expect(parseJsonObject('```json\n{"slug":"x"}\n```')).toEqual({ slug: "x" });
  });
  it("extracts an object from surrounding prose", () => {
    expect(parseJsonObject('Here you go: {"a":"b"} hope that helps')).toEqual({ a: "b" });
  });
  it("repairs trailing commas", () => {
    expect(parseJsonObject('{"a":"b","c":"d",}')).toEqual({ a: "b", c: "d" });
  });
  it("returns null for unsalvageable input", () => {
    expect(parseJsonObject("not json at all")).toBeNull();
  });
  it("returns null for a JSON array (we want an object)", () => {
    expect(parseJsonObject("[1,2,3]")).toBeNull();
  });
});

describe("clampToLength", () => {
  it("returns short strings unchanged (whitespace-collapsed)", () => {
    expect(clampToLength("  a  b  ", 50)).toBe("a b");
  });
  it("snaps to a word boundary when over the limit", () => {
    const s = "the quick brown fox jumps over the lazy dog again";
    const out = clampToLength(s, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    // no partial trailing word
    expect(s.startsWith(out)).toBe(true);
    expect(out.endsWith(" ")).toBe(false);
  });
  it("hard-cuts when there's no good early boundary", () => {
    const out = clampToLength("supercalifragilisticexpialidocious", 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });
  it("strips trailing punctuation/dashes", () => {
    expect(clampToLength("answer-first guide to,", 14)).not.toMatch(/[\s,;:.\-]$/);
  });
});

describe("slugifyGenerated", () => {
  it("lowercases, hyphenates, trims", () => {
    expect(slugifyGenerated("How To Write A Page!")).toBe("how-to-write-a-page");
  });
  it("strips leading/trailing hyphens and diacritics", () => {
    expect(slugifyGenerated("  --Café Crème--  ")).toBe("cafe-creme");
  });
  it("bounds to 80 chars without trailing hyphen", () => {
    const out = slugifyGenerated("a ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("-")).toBe(false);
  });
  it("returns empty for symbol-only input", () => {
    expect(slugifyGenerated("!!!")).toBe("");
  });
});

describe("clampMetadata", () => {
  it("clamps each field to its limit and slugifies the slug", () => {
    const meta = clampMetadata({
      seoTitle: "x".repeat(200),
      metaDescription: "y".repeat(400),
      slug: "Some Title Here!",
      excerpt: "z".repeat(500),
      ogTitle: "w".repeat(200),
      ogDescription: "v".repeat(400),
      coverImagePrompt: "p".repeat(1000),
    });
    expect(meta.seoTitle.length).toBeLessThanOrEqual(70);
    expect(meta.metaDescription.length).toBeLessThanOrEqual(170);
    expect(meta.slug).toBe("some-title-here");
    expect(meta.excerpt.length).toBeLessThanOrEqual(320);
    expect(meta.coverImagePrompt.length).toBeLessThanOrEqual(600);
  });
  it("falls back ogTitle→seoTitle and ogDescription→metaDescription", () => {
    const meta = clampMetadata({ seoTitle: "Answer first", metaDescription: "A clear summary." });
    expect(meta.ogTitle).toBe("Answer first");
    expect(meta.ogDescription).toBe("A clear summary.");
  });
  it("returns all-empty for null input", () => {
    const meta = clampMetadata(null);
    expect(Object.values(meta).every((v) => v === "")).toBe(true);
  });
});

describe("pickMetadataFields", () => {
  it("returns only the requested fields", () => {
    const full: BlogMetadata = {
      seoTitle: "a", metaDescription: "b", slug: "c", excerpt: "d",
      ogTitle: "e", ogDescription: "f", coverImagePrompt: "g",
    };
    expect(pickMetadataFields(full, ["slug", "excerpt"])).toEqual({ slug: "c", excerpt: "d" });
  });
});

describe("isMetadataField", () => {
  it("validates field names", () => {
    expect(isMetadataField("seoTitle")).toBe(true);
    expect(isMetadataField("bogus")).toBe(false);
    expect(isMetadataField(123)).toBe(false);
  });
});

describe("htmlToPromptText", () => {
  it("strips tags, svg, and entities to plain prose", () => {
    const html = '<h2>Hi</h2><p>One &amp; two</p><svg><path d="x"/></svg>';
    const out = htmlToPromptText(html);
    expect(out).not.toMatch(/</);
    expect(out).not.toMatch(/<svg/);
    expect(out).toMatch(/Hi/);
    expect(out).toMatch(/One/);
  });
  it("bounds length", () => {
    expect(htmlToPromptText("<p>" + "word ".repeat(5000) + "</p>", 100).length).toBeLessThanOrEqual(100);
  });
});

describe("buildMetadataMessages", () => {
  it("assembles a system+user pair scoped to requested fields", () => {
    const msgs = buildMetadataMessages({
      title: "How LP Studio builds pages",
      bodyHtml: "<p>Describe a page, watch it build.</p>",
      targetKeyword: "ai landing page builder",
      fields: ["seoTitle", "slug"],
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
    // JSON shape lists only requested fields
    expect(msgs[0].content).toMatch(/"seoTitle"/);
    expect(msgs[0].content).toMatch(/"slug"/);
    expect(msgs[0].content).not.toMatch(/"excerpt"/);
    // SEO limits referenced
    expect(msgs[0].content).toContain(String(SEO_TITLE_MAX));
    // user carries title + keyword + body
    expect(msgs[1].content).toMatch(/How LP Studio builds pages/);
    expect(msgs[1].content).toMatch(/ai landing page builder/);
    expect(msgs[1].content).toMatch(/Describe a page/);
  });
  it("includes existing values + improve framing when improving", () => {
    const msgs = buildMetadataMessages({
      title: "T", bodyHtml: "<p>b</p>", fields: ["seoTitle"], improve: true,
      existing: { seoTitle: "Old title" },
    });
    expect(msgs[0].content).toMatch(/IMPROVE/);
    expect(msgs[1].content).toMatch(/Old title/);
  });
  it("defaults to all fields when none requested", () => {
    const msgs = buildMetadataMessages({ title: "T", bodyHtml: "", fields: [] });
    for (const f of METADATA_FIELDS) expect(msgs[0].content).toContain(`"${f}"`);
  });
});

describe("buildOutlineMessages + parseOutline + outlineToText", () => {
  it("builds an outline prompt from a brief", () => {
    const msgs = buildOutlineMessages({ topic: "landing page copy", audience: "founders", notes: "be concrete" });
    expect(msgs[0].content).toMatch(/OUTLINE/);
    expect(msgs[1].content).toMatch(/landing page copy/);
    expect(msgs[1].content).toMatch(/founders/);
    expect(msgs[1].content).toMatch(/be concrete/);
  });
  it("parses sections + clamps the title", () => {
    const out = parseOutline(JSON.stringify({
      title: "Z".repeat(200),
      sections: [
        { h2: "First", h3: ["a", "b"] },
        { h2: "Second" },
        { h2: "" }, // dropped
        "garbage", // dropped
      ],
    }));
    expect(out.title.length).toBeLessThanOrEqual(70);
    expect(out.sections).toEqual([{ h2: "First", h3: ["a", "b"] }, { h2: "Second" }]);
  });
  it("tolerates fenced / messy JSON", () => {
    const out = parseOutline('```json\n{"title":"T","sections":[{"h2":"One"}]}\n```');
    expect(out.sections[0].h2).toBe("One");
  });
  it("round-trips to text", () => {
    const text = outlineToText({ title: "T", sections: [{ h2: "A", h3: ["x"] }, { h2: "B" }] });
    expect(text).toMatch(/Title: T/);
    expect(text).toMatch(/H2: A/);
    expect(text).toMatch(/H3: x/);
    expect(text).toMatch(/H2: B/);
  });
});

describe("buildDraftMessages", () => {
  it("constrains output to the sanitizer allowlist + answer-first + one CTA", () => {
    const msgs = buildDraftMessages({
      brief: { topic: "t", targetKeyword: "k" },
      outlineText: "H2: One\nH2: Two",
    });
    expect(msgs[0].content).toMatch(/semantic HTML/);
    expect(msgs[0].content).toMatch(/<h2>/);
    expect(msgs[0].content).toMatch(/Do NOT emit <h1>/);
    expect(msgs[0].content).toMatch(/Answer-first/i);
    expect(msgs[0].content).toMatch(/inline <svg>/);
    expect(msgs[1].content).toMatch(/H2: One/);
  });
});

describe("cleanDraftHtml", () => {
  it("strips a ```html fence", () => {
    expect(cleanDraftHtml('```html\n<p>Hi</p>\n```')).toBe("<p>Hi</p>");
  });
  it("drops a leading h1 (the page renders the title)", () => {
    expect(cleanDraftHtml("<h1>Title</h1>\n<p>Body</p>")).toBe("<p>Body</p>");
  });
  it("leaves clean html alone", () => {
    expect(cleanDraftHtml("<h2>A</h2><p>b</p>")).toBe("<h2>A</h2><p>b</p>");
  });
});

describe("findDisallowedTags", () => {
  it("returns empty for sanitizer-clean html", () => {
    const html = "<h2>Heading</h2><p>Body with <a href='/x'>link</a> and <strong>bold</strong>.</p><ul><li>one</li></ul>";
    expect(findDisallowedTags(html)).toEqual([]);
  });
  it("flags disallowed tags (script, custom)", () => {
    const dropped = findDisallowedTags("<p>ok</p><script>evil()</script><widget>x</widget>");
    expect(dropped).toContain("script");
    expect(dropped).toContain("widget");
  });
  it("allows inline svg infographic tags", () => {
    const svg = '<figure><svg viewBox="0 0 10 10"><rect x="0" y="0" width="5" height="5"/><path d="M0 0"/></svg></figure>';
    expect(findDisallowedTags(svg)).toEqual([]);
  });
});

describe("generated draft HTML is valid against the sanitizer allowlist", () => {
  it("a representative AI draft survives sanitizeRawBlogHtml unchanged (no meaningful stripping)", () => {
    // A draft the model would plausibly return, using only allowlisted tags.
    const draft = [
      "<p>LP Studio builds your page from a description in minutes. You write the brief, it ships the brand.</p>",
      "<h2>How it works</h2>",
      "<p>Three steps, no agency queue:</p>",
      "<ul><li>Describe the page.</li><li>Watch it build.</li><li>Publish and measure.</li></ul>",
      "<h2>Why answer-first wins</h2>",
      "<p>Lead with the payoff so readers — and AI answer engines — get it immediately.</p>",
      '<figure><svg viewBox="0 0 120 40"><rect x="0" y="0" width="120" height="40" fill="#F6F2E9"/><text x="8" y="24" fill="#1A1815">Describe</text><rect x="80" y="8" width="32" height="24" fill="#E26B4F"/></svg><figcaption>The build loop.</figcaption></figure>',
      "<p>Describe a page. Watch it build.</p>",
    ].join("\n");

    // No disallowed tags up front.
    expect(findDisallowedTags(draft)).toEqual([]);

    const sanitized = sanitizeRawBlogHtml(draft);
    // The structural tags survive (sanitizer did not escape them to text).
    expect(sanitized).toMatch(/<h2>How it works<\/h2>/);
    expect(sanitized).toMatch(/<ul>/);
    expect(sanitized).toMatch(/<li>Describe the page\.<\/li>/);
    expect(sanitized).toMatch(/<svg/);
    expect(sanitized).toMatch(/<figcaption>/);
    // No script smuggled, no escaped structural tags.
    expect(sanitized).not.toMatch(/&lt;h2&gt;/);
    expect(sanitized).not.toMatch(/<script/i);
  });

  it("a draft with a disallowed tag has that tag escaped by the sanitizer (content preserved as text)", () => {
    const draft = "<p>Intro.</p><marquee>spin</marquee>";
    expect(findDisallowedTags(draft)).toContain("marquee");
    const sanitized = sanitizeRawBlogHtml(draft);
    expect(sanitized).toMatch(/<p>Intro\.<\/p>/);
    expect(sanitized).not.toMatch(/<marquee>/);
    expect(sanitized).toMatch(/&lt;marquee&gt;/);
  });
});

describe("buildTopicRecommendationMessages (Phase 4)", () => {
  it("grounds the prompt in themes + asks to avoid published titles", () => {
    const msgs = buildTopicRecommendationMessages({
      themes: [{ name: "GEO for SaaS", priority: 5, targetKeywords: ["geo seo"], audience: "marketers" }],
      count: 3,
      existingTitles: ["How LP Studio builds pages"],
    });
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toMatch(/NET-NEW/);
    expect(msgs[1].content).toMatch(/GEO for SaaS/);
    expect(msgs[1].content).toMatch(/geo seo/);
    expect(msgs[1].content).toMatch(/How LP Studio builds pages/);
  });
  it("handles no themes + no published titles gracefully", () => {
    const msgs = buildTopicRecommendationMessages({ themes: [], count: 5 });
    expect(msgs[1].content).toMatch(/no themes configured/);
    expect(msgs[1].content).toMatch(/none yet/);
  });
});

describe("parseRecommendedTopics (Phase 4)", () => {
  it("parses + clamps a topics array, dropping titleless + duplicate rows", () => {
    const raw = JSON.stringify({
      topics: [
        { title: "Answer-first content for AI engines", angle: "how-to", targetKeyword: "geo", rationale: "rising search", theme: "GEO" },
        { title: "Answer-first content for AI engines", angle: "dup" },
        { angle: "no title here" },
      ],
    });
    const out = parseRecommendedTopics(raw);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Answer-first content for AI engines");
    expect(out[0].targetKeyword).toBe("geo");
    expect(out[0].theme).toBe("GEO");
  });
  it("returns [] for garbage / empty", () => {
    expect(parseRecommendedTopics("not json")).toEqual([]);
    expect(parseRecommendedTopics(JSON.stringify({ topics: [] }))).toEqual([]);
  });
});

describe("completionText", () => {
  it("extracts content from a chat completion", () => {
    expect(completionText({ choices: [{ message: { content: "  hi  " } }] })).toBe("hi");
  });
  it("returns empty for missing content", () => {
    expect(completionText({ choices: [] })).toBe("");
    expect(completionText(null)).toBe("");
    expect(completionText(undefined)).toBe("");
  });
});
