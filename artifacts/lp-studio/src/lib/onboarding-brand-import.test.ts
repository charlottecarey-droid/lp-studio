import { describe, expect, it } from "vitest";

import { DEFAULT_BRAND, type BrandConfig } from "./brand-config";
import type { BrandImportResult } from "./brand-import-client";
import {
  buildOnboardingBrandConfig,
  computeImportPrefill,
  isFullHex,
  type ReviewedBrandFields,
} from "./onboarding-brand-import";

/**
 * Regression guards for the new-tenant onboarding "import brand from a website"
 * merge path. These lock in the precedence rules that are easy to break
 * silently: the user's reviewed name/logo/colors must beat imported values,
 * salesConsole must merge without dropping existing keys, the UI-only
 * `logoAlternates` list must be stripped, and the tagline must fall back to
 * imported/existing values only when the user leaves it blank. The final block
 * covers the three import outcomes (success / failure / skip).
 */

/** A tenant's pre-existing config with a few populated fields so we can prove
 *  the merge preserves untouched keys and existing salesConsole entries. */
function existingConfig(overrides: Partial<BrandConfig> = {}): BrandConfig {
  return {
    ...DEFAULT_BRAND,
    brandName: "Old Name",
    taglines: ["Existing tagline"],
    logoUrl: "/old-logo.svg",
    companyDescription: "An existing description that nothing should touch.",
    salesConsole: {
      senderName: "Existing Sender",
      replyTo: "existing@tenant.com",
    },
    ...overrides,
  };
}

/** Reviewed wizard fields (name/logo/colors steps). */
function reviewed(overrides: Partial<ReviewedBrandFields> = {}): ReviewedBrandFields {
  return {
    brandName: "Reviewed Co",
    tagline: "Reviewed tagline",
    logoUrl: "/reviewed-logo.png",
    primaryColor: "#112233",
    accentColor: "#445566",
    displayFont: "",
    bodyFont: "",
    ...overrides,
  };
}

describe("isFullHex", () => {
  it("accepts a full 6-digit hex", () => {
    expect(isFullHex("#1a2b3c")).toBe(true);
    expect(isFullHex("#AABBCC")).toBe(true);
  });

  it("rejects shorthand, named, or partial colors", () => {
    expect(isFullHex("#abc")).toBe(false);
    expect(isFullHex("red")).toBe(false);
    expect(isFullHex("#12345")).toBe(false);
    expect(isFullHex("112233")).toBe(false);
    expect(isFullHex("")).toBe(false);
  });
});

describe("buildOnboardingBrandConfig — merge precedence", () => {
  it("lets the user's reviewed name/logo/colors override imported proposed values", () => {
    const proposed = {
      brandName: "Imported Name",
      logoUrl: "/imported-logo.svg",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
    };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed());

    expect(out.brandName).toBe("Reviewed Co");
    expect(out.logoUrl).toBe("/reviewed-logo.png");
    expect(out.primaryColor).toBe("#112233");
    expect(out.accentColor).toBe("#445566");
    // CTA colors are derived from the reviewed (safe) colors.
    expect(out.ctaBackground).toBe("#445566");
    expect(out.ctaText).toBe("#112233");
  });

  it("merges salesConsole without dropping existing keys", () => {
    const proposed = {
      salesConsole: {
        senderName: "Imported Sender",
        salesIntroLine: "Imported intro",
      },
    };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed());

    expect(out.salesConsole).toEqual({
      // Existing key preserved…
      replyTo: "existing@tenant.com",
      // …imported key overrides the same-named existing one…
      senderName: "Imported Sender",
      // …and a brand-new imported key is added.
      salesIntroLine: "Imported intro",
    });
  });

  it("keeps the existing salesConsole untouched when the import proposes none", () => {
    const out = buildOnboardingBrandConfig(existingConfig(), { toneOfVoice: "warm" }, reviewed());
    expect(out.salesConsole).toEqual({
      senderName: "Existing Sender",
      replyTo: "existing@tenant.com",
    });
  });

  it("strips the UI-only logoAlternates list from the persisted config", () => {
    const proposed = {
      logoAlternates: [{ url: "/a.svg", source: "header", format: "svg", score: 1 }],
      toneOfVoice: "warm",
    };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed());
    expect("logoAlternates" in out).toBe(false);
    expect((out as Record<string, unknown>).logoAlternates).toBeUndefined();
    // Other imported fields still come through.
    expect(out.toneOfVoice).toBe("warm");
  });

  it("uses the user's tagline when provided (ignoring imported taglines)", () => {
    const proposed = { taglines: ["Imported tagline"] };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed({ tagline: "My tagline" }));
    expect(out.taglines).toEqual(["My tagline"]);
  });

  it("falls back to imported taglines when the user leaves the tagline blank", () => {
    const proposed = { taglines: ["Imported tagline"] };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed({ tagline: "   " }));
    expect(out.taglines).toEqual(["Imported tagline"]);
  });

  it("falls back to existing taglines when both the user and import are blank", () => {
    const out = buildOnboardingBrandConfig(existingConfig(), { toneOfVoice: "warm" }, reviewed({ tagline: "" }));
    expect(out.taglines).toEqual(["Existing tagline"]);
  });

  it("falls back to the existing logo when the user clears the reviewed logo", () => {
    const out = buildOnboardingBrandConfig(existingConfig(), null, reviewed({ logoUrl: "" }));
    expect(out.logoUrl).toBe("/old-logo.svg");
  });

  it("replaces invalid reviewed colors with safe defaults and derives CTA colors", () => {
    const out = buildOnboardingBrandConfig(
      existingConfig(),
      null,
      reviewed({ primaryColor: "not-a-color", accentColor: "#xyz" }),
    );
    expect(out.primaryColor).toBe("#1a1a2e");
    expect(out.accentColor).toBe("#4f46e5");
    expect(out.ctaBackground).toBe("#4f46e5");
    expect(out.ctaText).toBe("#1a1a2e");
  });

  it("preserves existing fields that neither the user nor the import touched", () => {
    const out = buildOnboardingBrandConfig(existingConfig(), { toneOfVoice: "warm" }, reviewed());
    expect(out.companyDescription).toBe("An existing description that nothing should touch.");
  });
});

describe("buildOnboardingBrandConfig — the three import outcomes", () => {
  it("success: imported proposed fields are merged under the reviewed fields", () => {
    const proposed = {
      toneOfVoice: "confident",
      productLines: [{ name: "Widget", description: "", valueProps: [], claims: [], keywords: [] }],
      brandName: "Imported Name", // must be overridden by reviewed
    };
    const out = buildOnboardingBrandConfig(existingConfig(), proposed, reviewed());

    // Reviewed wins.
    expect(out.brandName).toBe("Reviewed Co");
    // Rich imported fields are persisted.
    expect(out.toneOfVoice).toBe("confident");
    expect(out.productLines).toEqual([
      { name: "Widget", description: "", valueProps: [], claims: [], keywords: [] },
    ]);
  });

  it("failure: with no imported data (null), only reviewed fields merge onto existing", () => {
    // An import that throws never sets importedProposed, so handleFinish runs
    // with null — no imported keys may leak into the saved config.
    const existing = existingConfig({ toneOfVoice: "existing-voice" });
    const out = buildOnboardingBrandConfig(existing, null, reviewed());

    expect(out.brandName).toBe("Reviewed Co");
    expect(out.logoUrl).toBe("/reviewed-logo.png");
    // Existing config is otherwise preserved verbatim.
    expect(out.toneOfVoice).toBe("existing-voice");
    expect(out.companyDescription).toBe("An existing description that nothing should touch.");
    expect(out.salesConsole).toEqual({
      senderName: "Existing Sender",
      replyTo: "existing@tenant.com",
    });
  });

  it("reviewed fonts win over imported proposed fonts, and clearing the URL sticks", () => {
    // The wizard seeds the font state from the import, then the user picks a
    // catalog font (clearing the custom URL). The reviewed values must override
    // the imported `proposed` displayFont/displayFontUrl/bodyFont/bodyFontUrl.
    const proposed = {
      displayFont: "Adelle Sans",
      displayFontUrl: "https://use.typekit.net/abc.css",
      bodyFont: "Adelle Sans",
      bodyFontUrl: "https://use.typekit.net/abc.css",
    };
    const out = buildOnboardingBrandConfig(
      existingConfig(),
      proposed,
      reviewed({ displayFont: "Montserrat", displayFontUrl: undefined, bodyFont: "Inter", bodyFontUrl: undefined }),
    );

    expect(out.displayFont).toBe("Montserrat");
    expect(out.bodyFont).toBe("Inter");
    // Picking a catalog font clears the imported custom URL so BrandFontLoader
    // resolves the font deterministically.
    expect(out.displayFontUrl).toBeUndefined();
    expect(out.bodyFontUrl).toBeUndefined();
  });

  it("keeps an imported custom font + its URL when the user leaves it as-is", () => {
    const proposed = {
      displayFont: "Adelle Sans",
      displayFontUrl: "https://use.typekit.net/abc.css",
    };
    const out = buildOnboardingBrandConfig(
      existingConfig(),
      proposed,
      reviewed({ displayFont: "Adelle Sans", displayFontUrl: "https://use.typekit.net/abc.css" }),
    );

    expect(out.displayFont).toBe("Adelle Sans");
    expect(out.displayFontUrl).toBe("https://use.typekit.net/abc.css");
  });

  it("empty reviewed fonts persist as '' (LP Studio default), even over imported fonts", () => {
    // The user chose the "LP Studio default" option, which the wizard stores as
    // an empty family — this must beat anything the importer proposed.
    const out = buildOnboardingBrandConfig(
      existingConfig(),
      { displayFont: "Imported Heading", bodyFont: "Imported Body" },
      reviewed({ displayFont: "", bodyFont: "" }),
    );

    expect(out.displayFont).toBe("");
    expect(out.bodyFont).toBe("");
  });

  it("skip: behaves identically to failure — nothing imported is persisted", () => {
    const out = buildOnboardingBrandConfig(existingConfig(), null, reviewed());
    // Only the reviewed fields differ from existing; no stray imported keys.
    const reviewedKeysApplied = {
      brandName: out.brandName,
      taglines: out.taglines,
      logoUrl: out.logoUrl,
      primaryColor: out.primaryColor,
      accentColor: out.accentColor,
    };
    expect(reviewedKeysApplied).toEqual({
      brandName: "Reviewed Co",
      taglines: ["Reviewed tagline"],
      logoUrl: "/reviewed-logo.png",
      primaryColor: "#112233",
      accentColor: "#445566",
    });
    expect(out.companyDescription).toBe("An existing description that nothing should touch.");
  });
});

/** Minimal BrandImportResult builder. */
function importResult(overrides: Partial<BrandImportResult> = {}): BrandImportResult {
  return {
    proposed: {},
    confidence: {},
    ...overrides,
  };
}

describe("computeImportPrefill — success prefill from an import result", () => {
  it("extracts brand name, first non-blank tagline, logo, and colors", () => {
    const imported = importResult({
      proposed: {
        brandName: "  Acme  ",
        taglines: ["", "  ", "Real tagline", "Second"],
        primaryColor: "#abcdef",
        accentColor: "#123456",
        logoUrl: "/flat-logo.svg",
      },
      logoAlternates: [
        { url: "/best-logo.svg", source: "header", format: "svg", score: 9 },
        { url: "/other.png", source: "footer", format: "png", score: 3 },
      ],
      sourceUrl: "https://acme.com",
    });
    const prefill = computeImportPrefill(imported, "acme.com");

    expect(prefill.brandName).toBe("Acme");
    expect(prefill.tagline).toBe("Real tagline");
    // The flat logoUrl wins: it is the asset-mirrored, social-card-demoted
    // server pick; alternates keep EXTERNAL urls and are only a picker list.
    expect(prefill.logoUrl).toBe("/flat-logo.svg");
    expect(prefill.primaryColor).toBe("#abcdef");
    expect(prefill.accentColor).toBe("#123456");
    expect(prefill.colorImportFailed).toBe(false);
    expect(prefill.sourceUrl).toBe("https://acme.com");
  });

  it("strips logoAlternates from proposedForSave and pins the chosen logo into it", () => {
    const imported = importResult({
      proposed: { logoUrl: "/flat-logo.svg", toneOfVoice: "warm" },
      logoAlternates: [{ url: "/best-logo.svg", source: "header", format: "svg", score: 9 }],
    });
    const prefill = computeImportPrefill(imported, "acme.com");

    expect("logoAlternates" in prefill.proposedForSave).toBe(false);
    expect(prefill.proposedForSave.logoUrl).toBe("/flat-logo.svg");
    expect(prefill.proposedForSave.toneOfVoice).toBe("warm");
  });

  it("surfaces detected fonts and flags fontImportDetected", () => {
    const imported = importResult({
      proposed: {
        displayFont: "  Adelle Sans  ",
        displayFontUrl: " https://use.typekit.net/abc.css ",
        bodyFont: "Inter",
      },
    });
    const prefill = computeImportPrefill(imported, "acme.com");

    expect(prefill.displayFont).toBe("Adelle Sans");
    expect(prefill.displayFontUrl).toBe("https://use.typekit.net/abc.css");
    expect(prefill.bodyFont).toBe("Inter");
    expect(prefill.bodyFontUrl).toBeUndefined();
    expect(prefill.fontImportDetected).toBe(true);
  });

  it("leaves fonts undefined and fontImportDetected false when none were detected", () => {
    const prefill = computeImportPrefill(importResult({ proposed: { brandName: "Acme" } }), "acme.com");
    expect(prefill.displayFont).toBeUndefined();
    expect(prefill.bodyFont).toBeUndefined();
    expect(prefill.fontImportDetected).toBe(false);
  });

  it("falls back to the flat logoUrl when there are no alternates", () => {
    const imported = importResult({ proposed: { logoUrl: "/flat-logo.svg" } });
    const prefill = computeImportPrefill(imported, "acme.com");
    expect(prefill.logoUrl).toBe("/flat-logo.svg");
    expect(prefill.proposedForSave.logoUrl).toBe("/flat-logo.svg");
  });

  it("uses the top alternate only when the server produced no flat logoUrl", () => {
    const imported = importResult({
      proposed: { brandName: "Acme" },
      logoAlternates: [
        { url: "https://ext.example/logo.svg", source: "header", format: "svg", score: 9 },
      ],
    });
    const prefill = computeImportPrefill(imported, "acme.com");
    expect(prefill.logoUrl).toBe("https://ext.example/logo.svg");
  });

  it("flags colorImportFailed and leaves colors undefined when no usable colors come back", () => {
    const imported = importResult({ proposed: { brandName: "Acme", primaryColor: "rgb(1,2,3)" } });
    const prefill = computeImportPrefill(imported, "acme.com");
    expect(prefill.primaryColor).toBeUndefined();
    expect(prefill.accentColor).toBeUndefined();
    expect(prefill.colorImportFailed).toBe(true);
  });

  it("does not flag colorImportFailed when at least one color is usable", () => {
    const imported = importResult({ proposed: { primaryColor: "#abcdef" } });
    const prefill = computeImportPrefill(imported, "acme.com");
    expect(prefill.colorImportFailed).toBe(false);
  });

  it("leaves seed fields undefined when the import produced nothing usable", () => {
    const prefill = computeImportPrefill(importResult(), "acme.com");
    expect(prefill.brandName).toBeUndefined();
    expect(prefill.tagline).toBeUndefined();
    expect(prefill.logoUrl).toBeUndefined();
    expect(prefill.proposedForSave).toEqual({});
    // No echoed sourceUrl → falls back to what the user typed.
    expect(prefill.sourceUrl).toBe("acme.com");
  });
});

describe("computeImportPrefill → buildOnboardingBrandConfig round-trip", () => {
  it("persists the prefill's proposedForSave under the reviewed fields", () => {
    const imported = importResult({
      proposed: {
        brandName: "Imported Co",
        toneOfVoice: "confident",
        salesConsole: { salesIntroLine: "Imported intro" },
        logoAlternates: [{ url: "/best.svg", source: "header", format: "svg", score: 9 }],
      },
    });
    const prefill = computeImportPrefill(imported, "acme.com");
    const out = buildOnboardingBrandConfig(existingConfig(), prefill.proposedForSave, reviewed());

    // logoAlternates never reaches the persisted config.
    expect("logoAlternates" in out).toBe(false);
    // Imported rich fields persist; reviewed brandName wins.
    expect(out.toneOfVoice).toBe("confident");
    expect(out.brandName).toBe("Reviewed Co");
    // salesConsole deep-merged with existing.
    expect(out.salesConsole).toEqual({
      senderName: "Existing Sender",
      replyTo: "existing@tenant.com",
      salesIntroLine: "Imported intro",
    });
  });
});
