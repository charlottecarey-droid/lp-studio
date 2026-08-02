import { describe, it, expect } from "vitest";
import {
  resolveOGFields,
  substitutePageTitleToken,
  deriveFirstBlockImage,
  deriveOgCardCopy,
  isLegacyThumioUrl,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  type ResolveOGFieldsInput,
} from "./resolvePageOG";

// A fully-empty cascade input. Each test overrides only the fields that drive
// the branch under examination, so we never accidentally light up a higher- or
// lower-priority source than intended.
const empty: ResolveOGFieldsInput = {
  pageTitle: "",
  pageMetaTitle: "",
  pageMetaDescription: "",
  pageOgImage: "",
  blocks: null,
  tenantName: "",
  tenantDefaultTitle: "",
  tenantDefaultDescription: "",
  tenantDefaultImageUrl: "",
};

function resolve(overrides: Partial<ResolveOGFieldsInput>) {
  return resolveOGFields({ ...empty, ...overrides });
}

describe("substitutePageTitleToken", () => {
  it("substitutes a bare {{page_title}} token", () => {
    expect(substitutePageTitleToken("{{page_title}} | Acme", "Spring Sale")).toBe(
      "Spring Sale | Acme",
    );
  });

  it("tolerates surrounding whitespace inside the braces and is case-insensitive", () => {
    expect(substitutePageTitleToken("{{ page_title }} — Acme", "Hi")).toBe("Hi — Acme");
    expect(substitutePageTitleToken("{{PAGE_TITLE}}", "Hi")).toBe("Hi");
  });

  it("substitutes every occurrence", () => {
    expect(substitutePageTitleToken("{{page_title}} / {{page_title}}", "X")).toBe("X / X");
  });

  it("leaves a template without the token untouched", () => {
    expect(substitutePageTitleToken("Just Acme", "Hi")).toBe("Just Acme");
  });
});

describe("deriveFirstBlockImage", () => {
  it("returns the first plausible image URL under a recognised image-ish key", () => {
    const blocks = [{ type: "hero", props: { heroImage: "/api/storage/objects/a.png" } }];
    expect(deriveFirstBlockImage(blocks)).toBe("/api/storage/objects/a.png");
  });

  it("prefers a top-level image over a deeply-nested one", () => {
    const blocks = {
      image: "https://cdn.example.com/top.jpg",
      nested: { src: "https://cdn.example.com/deep.jpg" },
    };
    expect(deriveFirstBlockImage(blocks)).toBe("https://cdn.example.com/top.jpg");
  });

  it("ignores non-image string values keyed under image-ish keys", () => {
    // `image` here is plain text, not a URL — must not be picked up.
    const blocks = [{ image: "a friendly headline" }];
    expect(deriveFirstBlockImage(blocks)).toBe("");
  });

  it("ignores image URLs keyed under non-image fields", () => {
    const blocks = [{ headline: "https://cdn.example.com/looks-like.png" }];
    expect(deriveFirstBlockImage(blocks)).toBe("");
  });

  it("skips data: URIs", () => {
    const blocks = [{ image: "data:image/png;base64,AAAA" }];
    expect(deriveFirstBlockImage(blocks)).toBe("");
  });

  it("returns '' for empty / non-object input", () => {
    expect(deriveFirstBlockImage(null)).toBe("");
    expect(deriveFirstBlockImage(undefined)).toBe("");
    expect(deriveFirstBlockImage("nope")).toBe("");
    expect(deriveFirstBlockImage([])).toBe("");
  });
});

describe("resolveOGFields — title cascade", () => {
  it("1. per-page meta_title wins over everything below it", () => {
    const r = resolve({
      pageMetaTitle: "Per-Page Title",
      tenantDefaultTitle: "{{page_title}} — Tenant",
      pageTitle: "Hero",
      tenantName: "Acme",
    });
    expect(r.title).toBe("Per-Page Title");
  });

  it("2. tenant default (with {{page_title}} substitution) when no per-page title", () => {
    const r = resolve({
      tenantDefaultTitle: "{{page_title}} — Acme",
      pageTitle: "Spring Sale",
      tenantName: "Acme Inc",
    });
    expect(r.title).toBe("Spring Sale — Acme");
  });

  it("2b. tenant default with no token is used verbatim", () => {
    const r = resolve({ tenantDefaultTitle: "Static Tenant Title", pageTitle: "Hero" });
    expect(r.title).toBe("Static Tenant Title");
  });

  it("3. derived page title when no per-page meta and no tenant default", () => {
    const r = resolve({ pageTitle: "Just The Hero", tenantName: "Acme" });
    expect(r.title).toBe("Just The Hero");
  });

  it("4. tenant name when nothing else resolves", () => {
    const r = resolve({ tenantName: "Acme" });
    expect(r.title).toBe("Acme");
  });

  it("4b. 'Untitled' system fallback when truly nothing is set", () => {
    expect(resolve({}).title).toBe("Untitled");
  });
});

describe("resolveOGFields — description cascade", () => {
  it("1. per-page meta_description wins", () => {
    const r = resolve({
      pageMetaDescription: "Per-Page Desc",
      tenantDefaultDescription: "Tenant Desc",
      pageTitle: "Hero",
      tenantName: "Acme",
    });
    expect(r.description).toBe("Per-Page Desc");
  });

  it("2. tenant default description when no per-page description", () => {
    const r = resolve({
      tenantDefaultDescription: "Tenant Desc",
      pageTitle: "Hero",
      tenantName: "Acme",
    });
    expect(r.description).toBe("Tenant Desc");
  });

  it("3. derived page title when no descriptions set", () => {
    const r = resolve({ pageTitle: "Hero", tenantName: "Acme" });
    expect(r.description).toBe("Hero");
  });

  it("4. tenant name when nothing else", () => {
    expect(resolve({ tenantName: "Acme" }).description).toBe("Acme");
  });

  it("4b. empty string when truly nothing is set", () => {
    expect(resolve({}).description).toBe("");
  });
});

describe("resolveOGFields — image cascade + dimensions", () => {
  it("1. per-page og_image wins over tenant default and block image", () => {
    const r = resolve({
      pageOgImage: "https://cdn.example.com/page.png",
      tenantDefaultImageUrl: "https://cdn.example.com/tenant.png",
      blocks: [{ image: "https://cdn.example.com/block.png" }],
    });
    expect(r.image).toBe("https://cdn.example.com/page.png");
  });

  it("2. tenant default image when no per-page og_image", () => {
    const r = resolve({
      tenantDefaultImageUrl: "https://cdn.example.com/tenant.png",
      blocks: [{ image: "https://cdn.example.com/block.png" }],
    });
    expect(r.image).toBe("https://cdn.example.com/tenant.png");
  });

  it("3. first block image when no per-page and no tenant default", () => {
    const r = resolve({ blocks: [{ heroImage: "/api/storage/objects/b.png" }] });
    expect(r.image).toBe("/api/storage/objects/b.png");
  });

  it("4. empty image (system fallback) when nothing resolves", () => {
    expect(resolve({}).image).toBe("");
  });

  it("reports the canonical 1200×630 dimensions only when an image is present", () => {
    const withImg = resolve({ pageOgImage: "https://cdn.example.com/page.png" });
    expect(withImg.width).toBe(OG_IMAGE_WIDTH);
    expect(withImg.height).toBe(OG_IMAGE_HEIGHT);
    expect(withImg.width).toBe(1200);
    expect(withImg.height).toBe(630);

    const noImg = resolve({});
    expect(noImg.width).toBeNull();
    expect(noImg.height).toBeNull();
  });
});

describe("isLegacyThumioUrl", () => {
  it("matches thum.io hosts (any subdomain)", () => {
    expect(isLegacyThumioUrl("https://image.thum.io/get/width/1200/https://x.com")).toBe(true);
    expect(isLegacyThumioUrl("https://thum.io/get/foo")).toBe(true);
  });

  it("does not match our storage URLs, other hosts, or non-URLs", () => {
    expect(isLegacyThumioUrl("/api/storage/objects/uploads/abc")).toBe(false);
    expect(isLegacyThumioUrl("https://cdn.example.com/thum.io.png")).toBe(false);
    expect(isLegacyThumioUrl("")).toBe(false);
    expect(isLegacyThumioUrl("not a url")).toBe(false);
  });
});

describe("resolveOGFields — designed card + thum.io filtering", () => {
  it("treats a legacy thum.io per-page og_image as absent", () => {
    const r = resolve({
      pageOgImage: "https://image.thum.io/get/width/1200/https://x.com",
      pageOgCardImage: "/api/storage/objects/uploads/card.png",
    });
    expect(r.image).toBe("/api/storage/objects/uploads/card.png");
  });

  it("explicit per-page og_image still wins over the auto card", () => {
    const r = resolve({
      pageOgImage: "/api/storage/objects/uploads/custom.png",
      pageOgCardImage: "/api/storage/objects/uploads/card.png",
    });
    expect(r.image).toBe("/api/storage/objects/uploads/custom.png");
  });

  it("auto card wins over tenant default and block image", () => {
    const r = resolve({
      pageOgCardImage: "/api/storage/objects/uploads/card.png",
      tenantDefaultImageUrl: "https://cdn.example.com/tenant.png",
      blocks: [{ image: "https://cdn.example.com/block.png" }],
    });
    expect(r.image).toBe("/api/storage/objects/uploads/card.png");
  });

  it("treats a legacy thum.io tenant default as absent", () => {
    const r = resolve({
      tenantDefaultImageUrl: "https://image.thum.io/get/anything",
      blocks: [{ image: "https://cdn.example.com/block.png" }],
    });
    expect(r.image).toBe("https://cdn.example.com/block.png");
  });
});

describe("deriveOgCardCopy", () => {
  it("pulls the lead block's headline/subheadline pair", () => {
    const copy = deriveOgCardCopy([
      { type: "hero", headline: "Built for Gentle Dental", subheadline: "One lab across 40+ locations." },
      { type: "hero", headline: "Second hero" },
    ]);
    expect(copy.headline).toBe("Built for Gentle Dental");
    expect(copy.subheadline).toBe("One lab across 40+ locations.");
  });

  it("falls through headline key synonyms and ignores image-URL values", () => {
    const copy = deriveOgCardCopy([
      { title: "https://cdn.example.com/pic.png" },
      { heading: "Real heading" },
    ]);
    expect(copy.headline).toBe("Real heading");
  });

  it("surfaces the microsite account badge fields", () => {
    const copy = deriveOgCardCopy([
      {
        type: "account-microsite",
        headline: "Hi",
        accountName: "Gentle Dental",
        accountLogoUrl: "/api/storage/objects/uploads/logo.png",
      },
    ]);
    expect(copy.accountName).toBe("Gentle Dental");
    expect(copy.accountLogo).toBe("/api/storage/objects/uploads/logo.png");
  });

  it("returns empty strings for empty blocks", () => {
    const copy = deriveOgCardCopy(null);
    expect(copy).toEqual({ headline: "", subheadline: "", accountName: "", accountLogo: "" });
  });

  it("takes the lead sponsors/partners entry as the partner badge", () => {
    const copy = deriveOgCardCopy([
      {
        type: "event-agenda",
        headline: "Summit",
        logoUrl: "/api/storage/objects/uploads/tenant-logo.png",
        sponsors: [
          { name: "No Logo Co", tier: "Founding partner" },
          { name: "Weave", logoUrl: "/api/storage/objects/uploads/weave.png" },
          { name: "Later Corp", logoUrl: "/api/storage/objects/uploads/later.png" },
        ],
      },
    ]);
    expect(copy.accountLogo).toBe("/api/storage/objects/uploads/weave.png");
    expect(copy.accountName).toBe("Weave");
  });

  it("never mistakes the tenant's own logoUrl for a partner logo", () => {
    const copy = deriveOgCardCopy([
      { type: "event-page", headline: "Hi", logoUrl: "/api/storage/objects/uploads/tenant.png" },
    ]);
    expect(copy.accountLogo).toBe("");
  });
});
